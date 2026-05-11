import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    console.log('Tal WhatsApp Message Processor - Active v2.0');
    
    // Get Rotem's work mode settings
    let workMode = 'advanced'; // Default to advanced
    try {
      const settings = await base44.asServiceRole.entities.RotemSettings.list();
      if (settings && settings.length > 0) {
        workMode = settings[0].work_mode || 'advanced';
      }
    } catch (err) {
      console.warn('Could not load Rotem settings, using advanced mode:', err.message);
    }
    
    console.log(`Tal work mode: ${workMode}`);

    const instanceId = Deno.env.get('GREEN_API_INSTANCE_ID');
    const apiToken = Deno.env.get('GREEN_API_TOKEN');

    if (!instanceId || !apiToken) {
      return Response.json({ error: 'Green API credentials not configured' }, { status: 500 });
    }

    // ===== STEP 1: GET LAST INCOMING MESSAGES FROM GREEN API =====
    const lastMessagesUrl = `https://api.green-api.com/waInstance${instanceId}/lastIncomingMessages/${apiToken}?minutes=60`;
    
    let incomingProcessed = 0;
    let pollAttempts = 1;
    
    try {
      console.log('Fetching last incoming messages from Green API...');
      const lastMsgsResponse = await fetch(lastMessagesUrl);
      const lastMessages = await lastMsgsResponse.json();

      console.log(`Got ${lastMessages?.length || 0} messages from last 60 minutes`);
      console.log('Messages preview:', lastMessages?.slice(0, 3).map(m => ({
        from: m.chatId,
        type: m.typeMessage,
        text: m.textMessage?.substring(0, 50)
      })));
      
      if (Array.isArray(lastMessages) && lastMessages.length > 0) {
        for (const msg of lastMessages) {
          // Only process text messages
          if (msg.typeMessage !== 'textMessage' && msg.typeMessage !== 'extendedTextMessage') {
            continue;
          }
          
          const senderPhone = msg.chatId?.replace('@c.us', '') || msg.senderId?.replace('@c.us', '') || '';
          const senderName = msg.senderName || 'מועמד';
          const messageText = msg.textMessage || msg.extendedTextMessage?.text || '';
          const messageId = msg.idMessage || `incoming_${Date.now()}`;

          if (senderPhone && messageText) {
            console.log(`Incoming message from ${senderPhone}: "${messageText.substring(0, 50)}..."`);

            // Normalize phone for search - try multiple formats
            let phoneWithoutCountry = senderPhone;
            if (senderPhone.startsWith('972')) {
              phoneWithoutCountry = '0' + senderPhone.substring(3);
            }

            // Check if message already exists (by message_id) - prevents double processing
            const existingMsgs = await base44.asServiceRole.entities.WhatsappMessage.filter({
              message_id: messageId
            });

            if (existingMsgs && existingMsgs.length > 0) {
              // Message already saved — skip entirely.
              // CRITICAL: Do NOT reset last_message_direction here!
              // Changing direction back to 'incoming' would make Tal respond again
              // to the same message on every poll run for 60 minutes (loop bug).
              console.log(`Message ${messageId} already in DB — skipping`);
              continue;
            }

            // Find or create conversation - PRIORITIZE conversations with task_number
            let conversation = null;
            console.log(`Looking for conversation with phone: ${senderPhone} or ${phoneWithoutCountry}`);
            
            // Try international format first (972...)
            let existingConvs = await base44.asServiceRole.entities.WhatsappConversation.filter({
              candidate_phone: senderPhone
            }, '-created_date', 10);
            console.log(`Found ${existingConvs?.length || 0} conversations with international format`);
            
            // If not found, try with local format (0...)
            if ((!existingConvs || existingConvs.length === 0) && phoneWithoutCountry !== senderPhone) {
              console.log(`Trying local phone format: ${phoneWithoutCountry}`);
              existingConvs = await base44.asServiceRole.entities.WhatsappConversation.filter({
                candidate_phone: phoneWithoutCountry
              }, '-created_date', 10);
              console.log(`Found ${existingConvs?.length || 0} conversations with local format`);
            }

            if (existingConvs && existingConvs.length > 0) {
              // CRITICAL: Prefer conversations with task_number (linked to active tasks)
              const convsWithTaskNumber = existingConvs.filter(c => c.task_number);
              
              if (convsWithTaskNumber.length > 0) {
                // Use the most recent conversation that has a task_number
                conversation = convsWithTaskNumber[0];
                console.log(`Using existing conversation WITH task_number: ${conversation.id} (task: ${conversation.task_number})`);
                
                // CLEANUP: Delete duplicate conversations for same phone + task
                if (convsWithTaskNumber.length > 1) {
                  console.log(`⚠️ Found ${convsWithTaskNumber.length} duplicate conversations for task ${conversation.task_number} - cleaning up...`);
                  for (let i = 1; i < convsWithTaskNumber.length; i++) {
                    try {
                      await base44.asServiceRole.entities.WhatsappConversation.delete(convsWithTaskNumber[i].id);
                      console.log(`🗑️ Deleted duplicate conversation: ${convsWithTaskNumber[i].id}`);
                    } catch (delErr) {
                      console.error('Error deleting duplicate conversation:', delErr);
                    }
                  }
                }
              } else {
                // Fall back to most recent conversation
                conversation = existingConvs[0];
                console.log(`Using existing conversation WITHOUT task_number: ${conversation.id} (phone: ${conversation.candidate_phone})`);
              }
              
              // If conversation has no agent_conversation_id, create one
              if (!conversation.agent_conversation_id) {
                try {
                  const agentConv = await base44.asServiceRole.agents.createConversation({
                    agent_name: 'tal_whatsapp',
                    metadata: {
                      candidate_phone: phoneWithoutCountry,
                      candidate_name: conversation.candidate_name,
                      source: 'incoming_message'
                    }
                  });
                  
                  await base44.asServiceRole.entities.WhatsappConversation.update(conversation.id, {
                    agent_conversation_id: agentConv.id
                  });
                  
                  conversation.agent_conversation_id = agentConv.id;
                  console.log(`Created agent conversation for existing WhatsappConversation`);
                } catch (err) {
                  console.error('Error creating agent conversation:', err);
                }
              }
            } else {
              // Try to find candidate by phone
              let candidateId = null;
              let candidateName = senderName;
              try {
                const candidates = await base44.asServiceRole.entities.Candidate.filter({ phone_primary: senderPhone });
                if (candidates && candidates.length > 0) {
                  candidateId = candidates[0].id;
                  candidateName = candidates[0].full_name || senderName;
                }
              } catch (e) {
                console.log('Could not find candidate by phone');
              }

              // Create new conversation - use local phone format for consistency
              conversation = await base44.asServiceRole.entities.WhatsappConversation.create({
                candidate_id: candidateId,
                candidate_name: candidateName,
                candidate_phone: phoneWithoutCountry, // Use local format (0...) for consistency
                status: 'active',
                messages_count: 0
              });
              console.log(`Created new conversation: ${conversation.id}`);
            }

            // CRITICAL: Fix orphaned messages - ensure they're linked to the correct conversation
            const orphanedMessages = await base44.asServiceRole.entities.WhatsappMessage.filter({
              message_id: messageId,
              conversation_id: { $ne: conversation.id }
            });
            
            if (orphanedMessages && orphanedMessages.length > 0) {
              console.log(`🔧 Found ${orphanedMessages.length} orphaned messages with ID ${messageId} - fixing...`);
              for (const orphan of orphanedMessages) {
                try {
                  await base44.asServiceRole.entities.WhatsappMessage.update(orphan.id, {
                    conversation_id: conversation.id
                  });
                  console.log(`✓ Fixed orphaned message ${orphan.id} → conversation ${conversation.id}`);
                } catch (fixErr) {
                  console.error('Error fixing orphaned message:', fixErr);
                }
              }
            }
            
            // Save incoming message
            await base44.asServiceRole.entities.WhatsappMessage.create({
              conversation_id: conversation.id,
              candidate_phone: phoneWithoutCountry, // Use local format for consistency
              direction: 'incoming',
              content: messageText,
              message_id: messageId,
              sender_name: senderName,
              status: 'delivered'
            });
            console.log(`Saved incoming message: "${messageText.substring(0, 30)}..." to conversation ${conversation.id}`);

            // Update conversation
            await base44.asServiceRole.entities.WhatsappConversation.update(conversation.id, {
              last_message_date: new Date().toISOString(),
              last_message_direction: 'incoming',
              last_message_preview: messageText.substring(0, 100),
              messages_count: (conversation.messages_count || 0) + 1,
              status: 'active'
            });
            
            console.log(`Updated conversation ${conversation.id} with incoming message`);

            incomingProcessed++;
          }
        }
      }
    } catch (pollErr) {
      console.error('Error fetching last messages from Green API:', pollErr);
    }

    console.log(`Processed ${incomingProcessed} incoming messages`);

    // ===== STEP 2: PROCESS CONVERSATIONS THAT NEED RESPONSES =====
    // CRITICAL: Only respond to conversations linked to active RotemTasks (status "בתהליך")
    // This ensures we only handle ONE active conversation per candidate

    // First, get all active tasks (status "בתהליך")
    // CRITICAL: EXCLUDE tasks with status "תקשורת משתמש" - these are managed by human only
    const activeTasks = await base44.asServiceRole.entities.RotemTask.filter({
      status: 'בתהליך'
    });
    // Also get "תקשורת משתמש" tasks phones to EXCLUDE them from auto-response
    const userManagedTasks = await base44.asServiceRole.entities.RotemTask.filter({
      status: 'תקשורת משתמש'
    });
    const userManagedPhones = new Set(userManagedTasks.map(t => {
      let phone = (t.candidate_phone || '').replace(/[^\d]/g, '');
      if (phone.startsWith('972')) phone = '0' + phone.substring(3);
      return phone;
    }).filter(Boolean));

    console.log(`Found ${activeTasks.length} active RotemTasks`);

    // Get task numbers for filtering
    const activeTaskNumbers = activeTasks.map(t => t.task_number).filter(Boolean);
    const activeCandidatePhones = activeTasks.map(t => {
      if (!t.candidate_phone) return null;
      // Normalize phone to local format (0...) to match WhatsappConversation
      // CRITICAL: Remove ALL non-digit characters including unicode marks
      let phone = t.candidate_phone.replace(/[^\d]/g, '');
      if (phone.startsWith('972')) phone = '0' + phone.substring(3);
      return phone;
    }).filter(Boolean);
 
    if (activeTaskNumbers.length === 0 && activeCandidatePhones.length === 0) {
      console.log('No active tasks to process conversations for');
      return Response.json({ 
        status: 'ok', 
        mode: 'green_api_live',
        incomingProcessed,
        conversationsFound: 0,
        processed: 0,
        responded: 0,
        skipped: 0,
        message: 'No active tasks'
      });
    }

    // Get all conversations where last message was incoming AND linked to active tasks
    const allActiveConversations = await base44.asServiceRole.entities.WhatsappConversation.filter({
      last_message_direction: 'incoming',
      status: 'active'
    }, '-last_message_date', 50);

    // Filter to only conversations linked to active tasks
    // CRITICAL: Also exclude conversations with phones that belong to "תקשורת משתמש" tasks
    const activeConversations = allActiveConversations.filter(conv => {
      // Exclude "תקשורת משתמש" phones - human manages these
      if (conv.candidate_phone && userManagedPhones.has(conv.candidate_phone)) {
        console.log(`Skipping conversation for ${conv.candidate_phone} - task is in "תקשורת משתמש" mode`);
        return false;
      }
      // Match by task_number (most reliable)
      if (conv.task_number && activeTaskNumbers.includes(conv.task_number)) {
        return true;
      }
      // Fallback: match by phone
      if (conv.candidate_phone && activeCandidatePhones.includes(conv.candidate_phone)) {
        return true;
      }
      return false;
    });

    console.log(`Found ${activeConversations.length} conversations needing response (filtered by active tasks)`);

    // Debug: log conversation IDs
    activeConversations.forEach(c => {
      console.log(`  - Conv ${c.id}: phone=${c.candidate_phone}, task=${c.task_number}, last_dir=${c.last_message_direction}`);
    });

    // Clean up stale processing locks (stuck in_progress for > 10 minutes)
    try {
      const staleLogs = await base44.asServiceRole.entities.RotemThinkingLog.filter({ status: 'in_progress' });
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      for (const log of staleLogs) {
        if (log.created_date && new Date(log.created_date) < tenMinutesAgo) {
          await base44.asServiceRole.entities.RotemThinkingLog.update(log.id, { status: 'stale' });
          console.log(`Cleaned up stale lock ${log.id} for conversation ${log.conversation_id}`);
        }
      }
    } catch (_) { /* non-critical */ }

    let processed = 0;
    let responded = 0;
    let skipped = 0;
    const debugLogs = [];

    for (const conv of activeConversations) {
      const phone = conv.candidate_phone;
      const conversationId = conv.id;
      
      // Check if conversation is already being processed (lock mechanism)
      const existingProcessingLogs = await base44.asServiceRole.entities.RotemThinkingLog.filter({
        conversation_id: conversationId,
        status: 'in_progress'
      });

      if (existingProcessingLogs && existingProcessingLogs.length > 0) {
        console.log(`Conversation ${conversationId} is already being processed - skipping`);
        debugLogs.push(`${phone}: Already being processed - skipped`);
        skipped++;
        continue;
      }

      // ACQUIRE PROCESSING LOCK before doing any work.
      // This prevents two concurrent poll runs from both responding to the same conversation.
      let processingLock = null;
      try {
        processingLock = await base44.asServiceRole.entities.RotemThinkingLog.create({
          conversation_id: conversationId,
          status: 'in_progress',
          phone: phone
        });
        console.log(`Acquired lock ${processingLock.id} for conversation ${conversationId}`);
      } catch (lockErr) {
        console.error(`Failed to acquire lock for ${conversationId} — skipping to prevent duplicate send`, lockErr);
        skipped++;
        continue;
      }
      
      // Get all messages for this conversation
      const messages = await base44.asServiceRole.entities.WhatsappMessage.filter({
        conversation_id: conversationId
      }, '-created_date', 50);

      if (!messages || messages.length === 0) {
        if (processingLock) { try { await base44.asServiceRole.entities.RotemThinkingLog.update(processingLock.id, { status: 'completed' }); } catch (_) {} }
        continue;
      }

      // Sort by date ascending (oldest first) to process in order
      const sortedMessages = messages.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));

      // Find all incoming messages that don't have an outgoing response after them
      const unansweredMessages = [];
      for (let i = 0; i < sortedMessages.length; i++) {
        const msg = sortedMessages[i];
        
        if (msg.direction === 'incoming') {
          // Check if there's an outgoing message after this incoming one
          const hasResponseAfter = sortedMessages
            .slice(i + 1)
            .some(m => m.direction === 'outgoing');
          
          if (!hasResponseAfter) {
            unansweredMessages.push(msg);
          }
        }
      }

      if (unansweredMessages.length === 0) {
        // Update conversation status if needed
        const lastMsg = sortedMessages[sortedMessages.length - 1];
        if (lastMsg.direction === 'outgoing' && conv.last_message_direction !== 'outgoing') {
          await base44.asServiceRole.entities.WhatsappConversation.update(conversationId, {
            last_message_direction: 'outgoing'
          });
        }
        skipped++;
        if (processingLock) { try { await base44.asServiceRole.entities.RotemThinkingLog.update(processingLock.id, { status: 'completed' }); } catch (_) {} }
        continue;
      }

      console.log(`Found ${unansweredMessages.length} unanswered messages for ${phone}`);
      debugLogs.push(`${phone}: Found ${unansweredMessages.length} unanswered messages`);

      // CRITICAL: Combine ALL unanswered messages into ONE response
      // This ensures Rotem sends only ONE message, not multiple consecutive messages
      const allIncomingContent = unansweredMessages.map(m => m.content).join('\n\n');
      const senderName = unansweredMessages[0]?.sender_name || 'מועמד';
      
      console.log(`Processing ${unansweredMessages.length} unanswered messages as ONE response for ${phone}`);
      debugLogs.push(`${phone}: Processing ${unansweredMessages.length} incoming messages together`);

      processed++;

      // --- ROTEM RESPONSE LOGIC - BASIC OR ADVANCED MODE ---
      try {
        // Unified response variable — set in EITHER basic or advanced mode, sent in common code below.
        let talResponse = '';
        
        // Get job and task data BEFORE mode logic (needed for both modes)
        let jobData = null;
        let rotemTask = null;
        
        // Get the job from conversation
        if (conv.job_id) {
          try {
            const jobs = await base44.asServiceRole.entities.Job.filter({ id: conv.job_id });
            if (jobs && jobs.length > 0) {
              jobData = jobs[0];
              console.log(`Using job from conversation: ${jobData.title} (${jobData.id})`);
            }
          } catch (e) {
            console.log('Could not fetch job from conversation');
          }
        }
        
        // Get the RotemTask
        if (jobData) {
          try {
            const tasks = await base44.asServiceRole.entities.RotemTask.filter({
              candidate_phone: phone,
              job_id: jobData.id,
              status: { $in: ['בתהליך', 'מאושר לשיחה', 'הסתיים'] }
            }, '-created_date', 1);
            
            if (tasks && tasks.length > 0) {
              rotemTask = tasks[0];
              console.log(`Found matching RotemTask: ${rotemTask.id}`);
            }
          } catch (e) {
            console.log('Could not fetch RotemTask:', e);
          }
        }
        
        // Get message history
        const recentMessages = await base44.asServiceRole.entities.WhatsappMessage.filter({
          conversation_id: conversationId
        }, '-created_date', 50);
        
        // ========== BASIC MODE ==========
        if (workMode === 'basic') {
          console.log('Using BASIC mode for Rotem');
          
          // Check if this is first message or response to candidate
          const hasOutgoingMessages = recentMessages?.filter(m => m.direction === 'outgoing').length > 0;
          
          if (!hasOutgoingMessages) {
            // First message - send initial contact WITHOUT details, just asking if interested
            if (jobData) {
              // Clean job title - remove ALL client names
              let cleanJobTitle = jobData.title || '';
              const clientPatterns = [
                /ב[״"]?מב[״"]?ת[״"]?.*?תע[״"]?א/gi,
                /במב[״"]?ת/gi,
                /ברפאל/gi,
                /בתעשייה אווירית/gi,
                /במפעל תומר/gi,
                /באלתא/gi,
                /ב-?[א-ת]+\s*תע[״"]?א/gi,
                /תע[״"]?א/gi
              ];
              
              for (const pattern of clientPatterns) {
                cleanJobTitle = cleanJobTitle.replace(pattern, '').trim();
              }
              
              talResponse = `שלום ${conv.candidate_name || ''},

אני טל מחברת פנדה-טק 🐼

ראיתי את הפרופיל שלך ונראה לי שיש לנו משרה שיכולה להתאים לך מאוד:
${cleanJobTitle}

האם יש עניין לשמוע פרטים?

מספר פנייה: ${rotemTask?.task_number || 'N/A'}`;
            } else {
              talResponse = `שלום,

אני טל מחברת פנדה-טק 🐼

מצאתי התאמה בינך לבין משרה שיש לנו במערכת.
האם יש עניין לשמוע פרטים? (כן/לא)`;
            }
          } else {
            // CRITICAL: Only respond if last message from candidate was AFTER our last message
            const sortedMsgs = recentMessages.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
            const lastMsg = sortedMsgs[sortedMsgs.length - 1];
            
            // If last message is outgoing from us, DON'T respond - wait for candidate
            if (lastMsg?.direction === 'outgoing') {
              console.log('Last message is from Tal - skipping to wait for candidate response');
              skipped++;
              // Release lock before skipping
              if (processingLock) {
                try { await base44.asServiceRole.entities.RotemThinkingLog.update(processingLock.id, { status: 'completed' }); } catch (_) {}
              }
              continue;
            }
            
            // Response to candidate - check if they said yes/no (including "1" as agreement)
            const lowerContent = allIncomingContent.toLowerCase();

            // Check for YES responses: Hebrew words, "1" for agreement, or 👍 emoji
            const isYesResponse = lowerContent.includes('כן') || 
                                 lowerContent.includes('מעוניין') || 
                                 lowerContent.includes('בטח') || 
                                 lowerContent.includes('בוודאי') ||
                                 lowerContent.trim() === '1' ||
                                 allIncomingContent.includes('👍');

            if (isYesResponse) {
              // Candidate said YES - send FULL job details WITHOUT client name
              if (jobData) {
                const jobDetailsParts = [];
                
                // Clean job title - remove ALL client names
                let cleanJobTitle = jobData.title || '';
                const clientPatterns = [
                  /ב[״"]?מב[״"]?ת[״"]?.*?תע[״"]?א/gi,
                  /במב[״"]?ת/gi,
                  /ברפאל/gi,
                  /בתעשייה אווירית/gi,
                  /במפעל תומר/gi,
                  /באלתא/gi,
                  /ב-?[א-ת]+\s*תע[״"]?א/gi,
                  /תע[״"]?א/gi
                ];
                
                for (const pattern of clientPatterns) {
                  cleanJobTitle = cleanJobTitle.replace(pattern, '').trim();
                }
                
                jobDetailsParts.push(`📋 שם המשרה: ${cleanJobTitle}`);
                if (jobData.location) jobDetailsParts.push(`📍 מיקום: ${jobData.location}`);
                if (jobData.factory_department) jobDetailsParts.push(`🏢 מחלקה: ${jobData.factory_department}`);
                if (jobData.security_clearance) jobDetailsParts.push(`🔒 דרישת סיווג: ${jobData.security_clearance}`);
                
                if (jobData.description) {
                  jobDetailsParts.push(`\n📝 תיאור המשרה:\n${jobData.description}`);
                }
                
                if (jobData.requirements) {
                  jobDetailsParts.push(`\n✅ דרישות:\n${jobData.requirements}`);
                }
                
                talResponse = `מעולה! 😊

הנה פרטי המשרה המלאים:

${jobDetailsParts.join('\n')}

האם המשרה מעניינת? אם כן, אשמח לקבל קורות חיים מעודכנות ואקדם את התהליך.`;
              } else {
                talResponse = 'תודה רבה! אעביר את הפרטים שלך לצוות הגיוס. הם יחזרו אליך בהקדם. 🙂';
              }
              
              // Update task to "הועבר למנהל" - requires human follow-up
              if (rotemTask) {
                await base44.asServiceRole.entities.RotemTask.update(rotemTask.id, {
                  status: 'הועבר למנהל',
                  rotem_execution_note: 'מודל בסיסי - מועמד מעוניין, קיבל פרטים, הועבר לטיפול אנושי',
                  notes: (rotemTask.notes || '') + `\n[${new Date().toLocaleString('he-IL')}] מודל בסיסי - מועמד הביע עניין וקיבל פרטי משרה`
                });
              }
              
              // Create incoming message for human review
              try {
                await base44.asServiceRole.entities.RotemIncomingMessage.create({
                  candidate_id: conv.candidate_id,
                  candidate_name: conv.candidate_name,
                  candidate_phone: conv.candidate_phone,
                  message_summary: 'מודל בסיסי - מועמד הביע עניין וקיבל פרטים - דרוש מעקב אנושי',
                  full_message: allIncomingContent,
                  rotem_response: talResponse,
                  task_id: rotemTask?.id,
                  is_read: false
                });
              } catch (msgErr) {
                console.error('Error creating incoming message:', msgErr);
              }
            } else if (lowerContent.includes('לא') || lowerContent.includes('תודה לא') || lowerContent.includes('לא מעניין') || lowerContent.trim() === '0') {
              talResponse = 'הבנתי, תודה על התשובה. אם בעתיד תהיה מעוניין במשרות נוספות, נשמח להיות בקשר. בהצלחה!';
              
              // Update task to completed
              if (rotemTask) {
                await base44.asServiceRole.entities.RotemTask.update(rotemTask.id, {
                  status: 'הסתיים',
                  rotem_execution_note: 'מודל בסיסי - מועמד לא מעוניין',
                  notes: (rotemTask.notes || '') + `\n[${new Date().toLocaleString('he-IL')}] מודל בסיסי - מועמד לא מעוניין`
                });
              }
            } else {
              // Unclear response - ask again for yes/no
              talResponse = 'תודה על התשובה. כדי שאוכל להמשיך - האם יש עניין במשרה? (כן/לא)';
            }
          }
          
        } 
        // ========== ADVANCED MODE (existing logic) ==========
        else {
          console.log('Using ADVANCED mode for Rotem');
          
        // Get candidate info for context
        let candidateContext = '';
        let candidateName = senderName;
        let candidateData = null;

        // Try to find candidate details - try multiple phone formats
        let phoneWithoutCountry = phone;
        if (phone.startsWith('972')) {
          phoneWithoutCountry = '0' + phone.substring(3);
        }

        let candidates = await base44.asServiceRole.entities.Candidate.filter({ phone_primary: phone });
        if ((!candidates || candidates.length === 0) && phoneWithoutCountry !== phone) {
          candidates = await base44.asServiceRole.entities.Candidate.filter({ phone_primary: phoneWithoutCountry });
        }

        // CRITICAL: Check if candidate answered the gender question and save it
        if (allIncomingContent && allIncomingContent.includes('לשון זכר')) {
          if (candidates && candidates.length > 0 && (!candidates[0].gender || candidates[0].gender === null)) {
            try {
              await base44.asServiceRole.entities.Candidate.update(candidates[0].id, {
                gender: 'זכר'
              });
              console.log(`Updated candidate ${candidates[0].id} gender to זכר`);
              // Reload candidate data
              candidates = await base44.asServiceRole.entities.Candidate.filter({ id: candidates[0].id });
            } catch (genderErr) {
              console.error('Error updating candidate gender:', genderErr);
            }
          }
        } else if (allIncomingContent && allIncomingContent.includes('לשון נקבה')) {
          if (candidates && candidates.length > 0 && (!candidates[0].gender || candidates[0].gender === null)) {
            try {
              await base44.asServiceRole.entities.Candidate.update(candidates[0].id, {
                gender: 'נקבה'
              });
              console.log(`Updated candidate ${candidates[0].id} gender to נקבה`);
              // Reload candidate data
              candidates = await base44.asServiceRole.entities.Candidate.filter({ id: candidates[0].id });
            } catch (genderErr) {
              console.error('Error updating candidate gender:', genderErr);
            }
          }
        }

        if (candidates && candidates.length > 0) {
            candidateData = candidates[0];
            candidateName = candidateData.full_name || `${candidateData.first_name || ''} ${candidateData.last_name || ''}`.trim() || senderName;

            // Build comprehensive candidate context from resume
            const cvParts = [];
            cvParts.push(`שם: ${candidateName}`);
            if (candidateData.gender) cvParts.push(`מין: ${candidateData.gender}`);
            if (candidateData.email) cvParts.push(`אימייל: ${candidateData.email}`);
            if (candidateData.address) cvParts.push(`מיקום: ${candidateData.address}`);
            if (candidateData.years_experience) cvParts.push(`שנות ניסיון: ${candidateData.years_experience}`);
            if (candidateData.education_level) cvParts.push(`השכלה: ${candidateData.education_level}`);
            if (candidateData.education) cvParts.push(`תארים: ${candidateData.education}`);
            if (candidateData.military_service) cvParts.push(`שירות צבאי: ${candidateData.military_service}`);
            if (candidateData.security_clearance && candidateData.security_clearance !== 'לא רלוונטי') {
              cvParts.push(`סיווג ביטחוני: ${candidateData.security_clearance}`);
            }
            if (candidateData.main_experience) cvParts.push(`ניסיון מרכזי: ${candidateData.main_experience}`);
            if (candidateData.skills_summary) cvParts.push(`סיכום כישורים: ${candidateData.skills_summary}`);
            if (candidateData.main_tech_tools) cvParts.push(`כלים טכנולוגיים: ${candidateData.main_tech_tools}`);
            if (candidateData.main_programming_languages) cvParts.push(`שפות תכנות: ${candidateData.main_programming_languages}`);
            if (candidateData.detected_skills?.length > 0) cvParts.push(`כישורים שזוהו: ${candidateData.detected_skills.join(', ')}`);

            // Add job history
            for (let i = 1; i <= 5; i++) {
              const company = candidateData[`job_${i}_company`];
              const role = candidateData[`job_${i}_role`];
              const desc = candidateData[`job_${i}_description`];
              if (company || role) {
                cvParts.push(`מקום עבודה ${i}: ${company || ''} - ${role || ''} ${desc ? `(${desc.substring(0, 100)})` : ''}`);
              }
            }

            candidateContext = cvParts.join('\n');
        }

        // Get active jobs from the system
        const activeJobs = await base44.asServiceRole.entities.Job.filter({
          status: 'פעילה'
        }, '-created_date', 100);
        
        const jobsInfo = activeJobs.map(job => ({
          job_code: job.job_code,
          title: job.title,
          description: job.description,
          requirements: job.requirements,
          location: job.location,
          client_name: job.client_name,
          security_clearance: job.security_clearance
        }));

        // Build job context
        let jobContext = '';
        let matchAnalysis = '';

        if (jobData) {
          const jobParts = [];
          // Use job title from rotemTask if available (most accurate), otherwise from jobData
          const jobTitle = rotemTask?.job_title || jobData.title;
          jobParts.push(`כותרת המשרה: ${jobTitle}`);
          
          // Use client name from rotemTask if available, otherwise from jobData
          const clientName = rotemTask?.client_name || jobData.client_name;
          if (clientName) jobParts.push(`לקוח/חברה: ${clientName}`);
          
          if (jobData.location) jobParts.push(`מיקום: ${jobData.location}`);
          if (jobData.factory_department) jobParts.push(`מחלקה/מפעל: ${jobData.factory_department}`);
          if (jobData.security_clearance) jobParts.push(`דרישת סיווג: ${jobData.security_clearance}`);
          if (jobData.description) jobParts.push(`תיאור המשרה: ${jobData.description}`);
          if (jobData.requirements) jobParts.push(`דרישות: ${jobData.requirements}`);
          jobContext = jobParts.join('\n');
        }
        
        // Build match analysis context from RotemTask (which has match data from Carmit)
        if (rotemTask) {
          const analysisParts = [];
          
          if (rotemTask.match_score) {
            analysisParts.push(`ציון ההתאמה מכרמית: ${rotemTask.match_score}/100`);
          }
          
          if (rotemTask.match_reasons) {
            analysisParts.push(`\nסיבות להתאמה (מכרמית):\n${rotemTask.match_reasons}`);
          }
          
          if (rotemTask.detailed_analysis) {
            try {
              const analysis = JSON.parse(rotemTask.detailed_analysis);
              if (analysis.requirement_matches) {
                analysisParts.push(`\nניתוח דרישות מפורט:`);
                Object.entries(analysis.requirement_matches).forEach(([req, match]) => {
                  analysisParts.push(`- ${req}: ${match}`);
                });
              }
              if (analysis.gaps) {
                analysisParts.push(`\nפערים שזוהו: ${analysis.gaps}`);
              }
            } catch (e) {
              // If not JSON, just add as text
              analysisParts.push(`\nניתוח מפורט:\n${rotemTask.detailed_analysis}`);
            }
          }
          
          if (analysisParts.length > 0) {
            matchAnalysis = analysisParts.join('\n');
          }
        }

        // Build conversation history string - ONLY FROM CURRENT ROUND
        let historyText = '';
        let currentRoundMessages = [];
        
        if (recentMessages && recentMessages.length > 0) {
          const sortedMsgs = recentMessages.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
          
          // Find the LAST outgoing message that looks like an initial contact
          // (Contains introduction phrases like "אני רותם", "ראיתי את הפרופיל", etc.)
          const initialContactIndicators = [
            'אני טל',
            'מגייסת בפנדה-טק',
            'ראיתי את הפרופיל',
            'קורות החיים שלך',
            'משרה שפתוח אצלנו'
          ];
          
          let lastInitialContactIndex = -1;
          for (let i = sortedMsgs.length - 1; i >= 0; i--) {
            if (sortedMsgs[i].direction === 'outgoing' && 
                initialContactIndicators.some(indicator => sortedMsgs[i].content?.includes(indicator))) {
              lastInitialContactIndex = i;
              break;
            }
          }
          
          // If found initial contact, take messages from that point onwards
          // Otherwise, take only the last few messages (probably continuing existing conversation)
          if (lastInitialContactIndex >= 0) {
            currentRoundMessages = sortedMsgs.slice(lastInitialContactIndex);
            console.log(`Found current round start at message ${lastInitialContactIndex}, using ${currentRoundMessages.length} messages`);
          } else {
            // No initial contact found - take only recent messages (last 10)
            currentRoundMessages = sortedMsgs.slice(-10);
            console.log(`No initial contact found, using last ${currentRoundMessages.length} messages`);
          }
          
          historyText = currentRoundMessages.map(m => 
            m.direction === 'incoming' ? `מועמד: ${m.content}` : `טל: ${m.content}`
          ).join('\n');
        }

        // Load Rotem's configuration from AgentConfig
        let rotemInstructions = '';
        try {
          const rotemConfigs = await base44.asServiceRole.entities.AgentConfig.filter({ agent_name: 'tal' });
          if (rotemConfigs && rotemConfigs.length > 0) {
            const rotemConfig = rotemConfigs[0];
            
            // Build instructions from config
            const instructionsParts = [];
            
            if (rotemConfig.custom_instructions) {
              instructionsParts.push(rotemConfig.custom_instructions);
            }
            
            if (rotemConfig.tone_of_voice) {
              instructionsParts.push(`\n## טון דיבור:\n${rotemConfig.tone_of_voice}`);
            }
            
            if (rotemConfig.personality) {
              instructionsParts.push(`\n## אופי הסוכנת:\n${rotemConfig.personality} (${rotemConfig.language_style || 'informal'})`);
            }
            
            if (rotemConfig.allowed_topics && rotemConfig.allowed_topics.length > 0) {
              instructionsParts.push(`\n## נושאים מותרים:\n${rotemConfig.allowed_topics.map(t => `- ${t}`).join('\n')}`);
            }
            
            if (rotemConfig.forbidden_topics && rotemConfig.forbidden_topics.length > 0) {
              instructionsParts.push(`\n## נושאים אסורים:\n${rotemConfig.forbidden_topics.map(t => `- ${t}`).join('\n')}`);
            }
            
            if (rotemConfig.never_say && rotemConfig.never_say.length > 0) {
              instructionsParts.push(`\n## דברים שלעולם לא לומר:\n${rotemConfig.never_say.map(t => `- ${t}`).join('\n')}`);
            }
            
            if (rotemConfig.company_info) {
              instructionsParts.push(`\n## מידע על החברה:\n${rotemConfig.company_info}`);
            }
            
            if (rotemConfig.company_benefits && rotemConfig.company_benefits.length > 0) {
              instructionsParts.push(`\n## יתרונות החברה:\n${rotemConfig.company_benefits.map(b => `- ${b}`).join('\n')}`);
            }
            
            if (rotemConfig.common_job_types && rotemConfig.common_job_types.length > 0) {
              instructionsParts.push(`\n## סוגי משרות נפוצות:\n${rotemConfig.common_job_types.map(j => `- ${j}`).join('\n')}`);
            }
            
            if (rotemConfig.recruitment_process_steps && rotemConfig.recruitment_process_steps.length > 0) {
              instructionsParts.push(`\n## שלבי תהליך הגיוס:\n${rotemConfig.recruitment_process_steps.map(s => `- ${s}`).join('\n')}`);
            }
            
            if (rotemConfig.escalation_triggers && rotemConfig.escalation_triggers.length > 0) {
              instructionsParts.push(`\n## טריגרים להעברה לאדם:\n${rotemConfig.escalation_triggers.map(t => `- ${t}`).join('\n')}`);
            }
            
            if (rotemConfig.escalation_message) {
              instructionsParts.push(`\n## הודעת העברה לאדם:\n${rotemConfig.escalation_message}`);
            }
            
            if (rotemConfig.irrelevant_message_response) {
              instructionsParts.push(`\n## תגובה להודעות לא רלוונטיות:\n${rotemConfig.irrelevant_message_response}`);
            }
            
            if (rotemConfig.greeting_message) {
              instructionsParts.push(`\n## הודעת פתיחה:\n${rotemConfig.greeting_message}`);
            }
            
            if (rotemConfig.out_of_hours_message) {
              instructionsParts.push(`\n## הודעה מחוץ לשעות:\n${rotemConfig.out_of_hours_message}`);
            }
            
            if (rotemConfig.form_url) {
              instructionsParts.push(`\n## קישור לטופס המועמד:\n${rotemConfig.form_url}`);
            }
            
            // Add training examples (sample conversations)
            if (rotemConfig.sample_conversations && rotemConfig.sample_conversations.length > 0) {
              instructionsParts.push(`\n## דוגמאות לשיחות (למידה):\nהנה דוגמאות לאופן שבו את צריכה להגיב במצבים שונים:\n`);
              
              rotemConfig.sample_conversations.forEach((example, idx) => {
                if (example.scenario) {
                  instructionsParts.push(`\n### תרחיש ${idx + 1}: ${example.scenario}`);
                }
                instructionsParts.push(`מועמד: ${example.user_message}`);
                instructionsParts.push(`רותם: ${example.agent_response}\n`);
              });
            }
            
            rotemInstructions = instructionsParts.join('\n');
          } else {
            // Fallback if no config exists
            rotemInstructions = 'את טל, מגייסת בחברת פנדה-טק. דברי בצורה מקצועית ונעימה עם מועמדים.';
          }
        } catch (configErr) {
          console.error('Error loading Rotem config:', configErr);
          rotemInstructions = 'את רותם, מגייסת בחברת פנדה-טק. דברי בצורה מקצועית ונעימה עם מועמדים.';
        }

        // Determine conversation stage based on history
        const hasHistory = historyText && historyText.length > 0;
        const messageCount = recentMessages?.length || 0;
        
        // Check if Rotem has already introduced herself (has sent outgoing messages before)
        const outgoingMessages = recentMessages?.filter(m => m.direction === 'outgoing') || [];
        const hasIntroduced = outgoingMessages.length > 0;
        
        // === CHECK PREVIOUS CONVERSATIONS FOR CLIENT EMPLOYMENT ===
        let employmentWarning = '';
        
        if (candidateData?.id) {
          try {
            // Get ALL conversations with this candidate
            const allCandidateConversations = await base44.asServiceRole.entities.WhatsappConversation.filter({
              candidate_id: candidateData.id
            }, '-created_date', 100);
            
            // Get all messages from all these conversations
            const allConversationIds = allCandidateConversations.map(c => c.id);
            
            if (allConversationIds.length > 0) {
              // Get all messages from all conversations
              const allMessages = await base44.asServiceRole.entities.WhatsappMessage.filter({
                conversation_id: { $in: allConversationIds },
                direction: 'incoming' // Only check what candidate said
              }, '-created_date', 500);
              
              // Check for mentions of working at client companies
              const clientCompanies = ['תע״א', 'תעשייה אווירית', 'רפאל', 'מפעל תומר', 'דרום', 'יבנה'];
              const employmentKeywords = ['עובד', 'עובדת', 'עובדים', 'אני ב', 'התחלתי ב', 'עבודה ב'];
              
              for (const msg of allMessages) {
                const content = msg.content?.toLowerCase() || '';
                
                // Check if message mentions employment at client company
                const mentionsClient = clientCompanies.some(client => 
                  content.includes(client.toLowerCase())
                );
                
                const mentionsEmployment = employmentKeywords.some(keyword => 
                  content.includes(keyword)
                );
                
                if (mentionsClient && mentionsEmployment) {
                  console.log(`⚠️ Found previous mention of employment at client: "${msg.content.substring(0, 100)}"`);
                  employmentWarning = `\n\n⚠️ **אזהרה קריטית - עבודה אצל לקוח:**\nבשיחה קודמת עם מועמד זה, הוא/היא אמר/ה: "${msg.content}"\n\nזה עלול להצביע על כך שהמועמד עובד אצל אחד מלקוחות פנדה-טק (${clientCompanies.join(', ')}).\n\n**חובה לברר:** לפני שאת ממשיכה, את חייבת לשאול: "סליחה, רק רציתי לוודא - האם את/ה עדיין עובד/ת ב[שם החברה]?"\n\nאם התשובה היא כן - את חייבת לסיים את השיחה מיד באדיבות: "אני מבינה, תודה על התשובה. אנחנו בפנדה-טק לא מגייסים עובדים פעילים של לקוחותינו - זה מנוגד לקוד האתי שלנו. אם תחפש/י משרה חדשה בעתיד, אשמח להישאר בקשר. בהצלחה!"`;
                  break; // Stop after finding first mention
                }
              }
            }
          } catch (historyErr) {
            console.error('Error checking previous conversations:', historyErr);
          }
        }
        
        const fullPrompt = `${rotemInstructions}

---

## 🚨 **כללי יסוד - אסור להפר:**
1. **אסור להמציא מידע על משרות** - דברי רק על המשרה הספציפית שאתם מדברים עליה ועל משרות שמופיעות ברשימת המשרות הפעילות
2. **אין גישה למשרות אחרות** - אם מועמד שואל על משרה שלא ברשימה ושלא הועברה אליך, אמרי שאת לא מטפלת בה ותעבירי לצוות
3. **אל תשערי** - אם אין לך מידע מדויק על לקוח/משרה/שכר, תגידי שצוות הגיוס יחזור עם הפרטים
4. **רק עובדות** - שתפי רק מידע שמופיע במפורש במשרה שאתם מדברים עליה או בהגדרות שלך

## 📋 רשימת משרות פעילות במערכת (לצורך הקשר בלבד):
${jobsInfo.length > 0 ? JSON.stringify(jobsInfo, null, 2) : 'אין משרות פעילות כרגע במערכת'}

## מידע על המועמד (מקורות החיים):
${candidateContext || 'אין מידע על המועמד במערכת - זו כנראה פנייה יזומה של מישהו שלא במאגר'}

**קריטי - זהות המועמד:**
את מחליטה על זהות המועמד רק לפי השם שלו כפי שנמצא במערכת בקורות החיים שלו.
את לא מנסה להתאים את שם המועמד לשם אחר של מועמד בפייפדרייב או במקורות אחרים.
אם אין התאמה למועמד במערכת (אין מידע למעלה), אז את לא מבצעת בדיקה בפייפדרייב בכלל.${employmentWarning}

## מידע על המשרה המוצעת (זו המשרה שאתם מדברים עליה):
${jobContext || 'אין מידע על משרה ספציפית כרגע'}

## ניתוח ההתאמה מכרמית (מנהלת הגיוס):
${matchAnalysis || 'אין ניתוח התאמה זמין - כנראה שזו פנייה ישירה בלי התאמה מוקדמת'}

**חשוב:** אם יש ניתוח התאמה מכרמית, השתמשי במידע הזה! כרמית כבר ניתחה את הפערים וההתאמות - זה יעזור לך לשאול שאלות ממוקדות ומדויקות יותר.

## היסטוריית השיחה הנוכחית (רק לקריאה - לא להגיב לזה!):
${historyText || '(אין היסטוריה קודמת - זו פנייה חדשה)'}

---

## ⚠️ ההודעות שצריך להגיב אליהן עכשיו:
"${allIncomingContent}"

**קריטי:** 
- עליך להגיב לכל ההודעות האלו מעלה במסר אחד ממוקד! 
- שלחי רק הודעה אחת שמשלבת את כל התשובות לכל השאלות.
- אסור לפצל לכמה הודעות - רק הודעה אחת!
- **דברי רק על המשרה שאתם מדברים עליה - אין לך גישה למשרות אחרות!**

---

## הנחיות לתגובה:
- כתבי תגובה קצרה ומתאימה (משפט או שניים בלבד)
- דברי בלשון נקבה על עצמך (אני רואה, אשמח, מעריכה)
- **קריטי - ניסוחים נייטרליים תמיד:** כשאת פונה למועמד, חובה להשתמש בניסוחים נייטרליים ככל האפשר! דוגמאות חובה:
  • במקום "האם אתה/את מעוניין/ת?" → "האם זה מעניין?"
  • במקום "יש לך ניסיון?" → "יש ניסיון ב...?"
  • במקום "תוכל/י לספר?" → "אפשר לשמוע עוד על...?"
  • במקום "מה השכלתך?" → "מה רמת ההשכלה?"
  • במקום "אתה/את עובד/ת?" → "האם יש תפקיד נוכחי?"
  • במקום "תרצה/י לשמוע?" → "מעניין לשמוע?"
- **קריטי - זיהוי מגדר רק אם הכרחי:** אם אי אפשר בשום דרך להשתמש בניסוח נייטרלי (מצבים נדירים מאוד), שאלי בשלב מוקדם: "איך לפנות אליך? בזכר או נקבה?"
- **קריטי - התאמת לשון למועמד:** רק אחרי שהמועמד ענה או אם מין המועמד ידוע במערכת - אז פני בלשון המתאימה: זכר (אתה, שלך, מעוניין) או נקבה (את, שלך, מעוניינת).
- **⏱️ אל לשלוח שתי הודעות מהר:** לעולם אל תשלחי שתי הודעות בהפרש זמן של פחות מ-60 שניות. תמיד חכי לתשובה מהמועמד.
- אל תציעי לדבר בזמן אחר - המשיכי את השיחה כאן ועכשיו
- **🤝 ניסיון דומה:** אם מועמד אומר שיש לו ניסיון בכלי או טכנולוגיה מאוד דומה למה שכתוב בדרישה - תאמיני למועמד ותגידי שאת מבינה וזה באמת יכול להתאים. למשל: "בהחלט! C ו-C++ דומים מאוד והניסיון שלך ב-C יכול להתאים למשרה."
- ${!hasIntroduced ? 'זו ההודעה הראשונה שלך בשיחה זו - הצגי את עצמך: "היי, אני טל מגייסת בפנדה-טק"' : 'חשוב מאוד: כבר הצגת את עצמך בהודעה קודמת! אל תחזרי על ההצגה! אל תגידי "היי, אני טל מפנדה-טק" - פשוט המשיכי את השיחה בצורה טבעית.'}
- ${outgoingMessages.length < 4 ? 'את בשלב בדיקת ההתאמה - שאלי שאלת הבהרה אחת ממוקדת ורלוונטית ביחס למשרה ולמועמד' : ''}
- ${outgoingMessages.length >= 4 && outgoingMessages.length < 6 ? '⚠️ כבר שלחת ' + outgoingMessages.length + ' הודעות. הגיע הזמן לסכם: שלחי טופס אם המועמד מתאים, אחרת סיימי בנימוס עם משפט הסיום הקבוע.' : ''}
- ${outgoingMessages.length >= 6 ? '🚨 **חובה לסיים עכשיו!** שלחת ' + outgoingMessages.length + ' הודעות — השיחה ארוכה מדי. בהודעה הזו בלבד, סיימי: שלחי את קישור הטופס אם המועמד מתאים ואמרי "תודה לך על הזמן, צוות הגיוס שלנו יעדכן אותך בהמשך לגבי התקדמות התהליך." — אחרת אמרי "תודה לך על הזמן, נשמח להיות איתך בקשר בעתיד גם לגבי משרות נוספות." אסור להוסיף שאלות נוספות!' : ''}
- השתמשי במידע הספציפי מקורות החיים ומהמשרה כדי לשאול שאלות רלוונטיות

## 📝 סיום שיחה - משפטים קבועים:

### סיום מוצלח (אחרי שליחת טופס):
**קריטי:** לאחר ששלחת למועמד את טופס המועמד (קישור לטופס), חובה לסיים את השיחה עם המשפט הבא בדיוק:

"תודה לך על הזמן, צוות הגיוס שלנו יעדכן אותך בהמשך לגבי התקדמות התהליך."

משפט זה מסמל את סיום השיחה בהצלחה והמערכת תעדכן אוטומטית את הסטטוס ל"הסתיים מוצלח".

### סיום רגיל (מועמד לא מתאים):
**קריטי:** כאשר מסיימים שיחה עם מועמד שאינו מתאים למשרה (ללא שליחת טופס), חובה לסיים עם המשפט הבא בדיוק:

"תודה לך על הזמן, נשמח להיות איתך בקשר בעתיד גם לגבי משרות נוספות."

משפט זה מסמל סיום רגיל של השיחה והמערכת תעדכן אוטומטית את הסטטוס ל"הסתיים".

## התמודדות עם הטרדה והסחת דעת:

### הטרדה מינית, מילולית או פגיעה בפרטיות:
אם המועמד משתמש בשפה בוטה, מטרידה מינית, או שואל שאלות אישיות על רותם עצמה (מי את, איפה את גרה, מה המספר שלך, וכו'):
1. **אזהרה ראשונה (פעם ראשונה בלבד):** "אני לא מוכנה שידברו אליי בצורה כזאת. אם ברצונך להמשיך את השיחה, בבקשה לדבר איתי בכבוד ולהתמקד במשרה."
2. **אזהרה שנייה ואחרונה (אם חוזר שוב):** "אינני ממשיכה את השיחה בצורה כזאת. השיחה מסתיימת כאן."
3. **אם ניסה ליצור קשר שוב אחרי האזהרה השנייה:** אל תענה כלל. אל תשלח שום תגובה.

### הסחת דעת מכוונת:
אם המועמד מושך את השיחה לנושאים לא קשורים למשרה או לקורות החיים שלו (פוליטיקה, ספורט, חדשות כלליות, וכו'):
- תגובה קצרה: "בוא נתמקד במשרה ובניסיון שלך. יש לך שאלות על התפקיד?"
- אם ממשיך להסיח את הדעת: "אני רואה שהנושא לא מעניין אותך כרגע. אם תחליט שאתה רוצה לשמוע עוד על המשרה, אשמח לענות."

### התמודדות עם מצבים אישיים קשים:
אם המועמד משתף אותך על מצב אישי קשה (פטירה במשפחה, מחלה, משבר אישי, וכו'):
1. **הראי אמפתיה אמיתית:** "אני מאוד מצטערת לשמוע. זה באמת לא קל."
2. **שאלי על המשך השיחה:** "האם זה בסדר להמשיך בשיחה כרגע, או שאת מעדיפ/ה שאצור קשר במועד אחר?"
3. **אם המועמד מעדיף מועד אחר:**
   - "אני לא רוצה ללחוץ עליך. מתי יהיה נוח לך שאצור איתך קשר שוב?"
   - המתן לתשובה עם תאריך (למשל "בעוד שבוע", "בחודש הבא", "ב-15 לחודש")
   - אם קיבלת תאריך, כתבי בתשובה שלך את הפורמט הבא (בדיוק כך, בשורה נפרדת):
     **RESCHEDULE:YYYY-MM-DD** (למשל: **RESCHEDULE:2025-01-15**)
   - לאחר מכן סיימי בחום: "אשמח ליצור איתך קשר שוב ב[תאריך]. מאחלת לך המון כוח והחלמה מהירה. 💙"

חשוב: הנחיות אלו עדיפות על כל הנחיה אחרת בשיחה!`;

        console.log(`Calling InvokeLLM for response to ${unansweredMessages.length} messages: "${allIncomingContent.substring(0, 50)}..."`);

        // Call InvokeLLM with retry mechanism (talResponse declared at outer try scope)
        talResponse = '';
        let llmAttempts = 0;

        while (!talResponse && llmAttempts < 3) {
          llmAttempts++;
          try {
            console.log(`LLM attempt ${llmAttempts}/3 for conversation ${conversationId}`);

            const llmResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
              prompt: fullPrompt,
              add_context_from_internet: false
            });

            if (llmResponse && typeof llmResponse === 'string') {
              talResponse = llmResponse.trim();
            } else if (llmResponse && llmResponse.response) {
              talResponse = llmResponse.response.trim();
            }

            console.log(`LLM Response (attempt ${llmAttempts}): "${talResponse?.substring(0, 50) || 'no response'}..."`);

            if (talResponse) break; // Got response - exit retry loop

            // If no response and not last attempt, wait before retry
            if (llmAttempts < 3) {
              console.log('No LLM response, retrying in 2 seconds...');
              await new Promise(resolve => setTimeout(resolve, 2000));
            }

          } catch (llmErr) {
            console.error(`LLM attempt ${llmAttempts} error:`, llmErr);
            if (llmAttempts < 3) {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
        }

        if (!talResponse) {
            console.log(`LLM did not respond after ${llmAttempts} attempts for conversation ${conversationId}`);
            debugLogs.push(`${phone}: No LLM response after ${llmAttempts} attempts`);
            // Release lock before skipping
            if (processingLock) {
              try { await base44.asServiceRole.entities.RotemThinkingLog.update(processingLock.id, { status: 'completed' }); } catch (_) {}
            }
            continue; // Skip to next conversation
        }

        } // End of ADVANCED mode
        
        // Got a response from Tal (either basic or advanced)
        if (talResponse) {
            // Clean up response
            let cleanResponse = talResponse
                .replace(/\[הקשר מערכת[^\]]*\]/g, '')
                .replace(/\[הקשר:[^\]]*\]/g, '')
                .replace(/^\[טל\]:\s*/i, '')
                .trim();
            
            // Remove surrounding quotes if present
            if (cleanResponse.startsWith('"') && cleanResponse.endsWith('"')) {
              cleanResponse = cleanResponse.slice(1, -1);
            }
            if (cleanResponse.startsWith("'") && cleanResponse.endsWith("'")) {
              cleanResponse = cleanResponse.slice(1, -1);
            }

            console.log(`Tal responded: "${cleanResponse}"`);
            
            // Check for reschedule request
            const rescheduleMatch = cleanResponse.match(/\*\*RESCHEDULE:(\d{4}-\d{2}-\d{2})\*\*/);
            
            if (rescheduleMatch) {
              const rescheduleDate = rescheduleMatch[1];
              
              // Create RotemTask for the rescheduled date
              try {
                await base44.asServiceRole.entities.RotemTask.create({
                  job_id: conv.job_id || '',
                  job_title: conv.job_title || 'משרה',
                  candidate_id: conv.candidate_id || '',
                  candidate_name: conv.candidate_name,
                  candidate_phone: conv.candidate_phone,
                  status: 'לא החל',
                  source: 'rotem_reschedule',
                  scheduled_date: rescheduleDate,
                  notes: 'המועמד ביקש לדחות את השיחה בשל מצב אישי'
                });
                
                console.log(`Created RotemTask for ${conv.candidate_name} scheduled for ${rescheduleDate}`);
              } catch (taskError) {
                console.error('Error creating reschedule task:', taskError);
              }
              
              // Remove the RESCHEDULE marker from the message before sending
              cleanResponse = cleanResponse.replace(/\*\*RESCHEDULE:\d{4}-\d{2}-\d{2}\*\*\s*/g, '');
            }
            
            // SEND VIA GREEN API - convert phone to international format (972...)
            let phoneForGreenApi = phone;
            if (phone.startsWith('0')) {
              phoneForGreenApi = '972' + phone.substring(1);
            }
            console.log(`Sending to phone: ${phoneForGreenApi} (original: ${phone})`);
            
            const chatId = `${phoneForGreenApi}@c.us`;
            const sendUrl = `https://api.green-api.com/waInstance${instanceId}/sendMessage/${apiToken}`;

            let messageId = `failed_${Date.now()}`;
            let sendStatus = 'failed';

            try {
              const sendResponse = await fetch(sendUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chatId: chatId,
                  message: cleanResponse
                })
              });

              const sendResult = await sendResponse.json();
              console.log('Green API send result:', sendResult);

              if (sendResult.idMessage) {
                messageId = sendResult.idMessage;
                sendStatus = 'sent';
              }
            } catch (sendErr) {
              console.error('Error sending via Green API:', sendErr);
            }

            await base44.asServiceRole.entities.WhatsappMessage.create({
                conversation_id: conversationId,
                candidate_phone: phone,
                direction: 'outgoing',
                content: cleanResponse,
                sender_name: 'טל',
                status: sendStatus,
                message_id: messageId
            });

            // Check if conversation is ending
            const conversationEndIndicators = [
              'השיחה מסתיימת כאן',
              'לא נמשיך בתהליך',
              'אם תחליט שאתה רוצה לשמוע עוד',
              'אשמח ליצור איתך קשר שוב ב', // Rescheduled
              'תודה על הזמן',
              'בהצלחה בהמשך',
              'נחזור אליך',
              'תודה ששיתפת'
            ];

            const isConversationEnding = conversationEndIndicators.some(indicator => 
              cleanResponse.includes(indicator)
            );

            // Check for successful completion after form sent
            const successfulCompletionIndicator = 'תודה לך על הזמן, צוות הגיוס שלנו יעדכן אותך בהמשך לגבי התקדמות התהליך';
            const isSuccessfulCompletion = cleanResponse.includes(successfulCompletionIndicator);
            
            // Check for regular completion (candidate not suitable)
            const regularCompletionIndicator = 'תודה לך על הזמן, נשמח להיות איתך בקשר בעתיד גם לגבי משרות נוספות';
            const isRegularCompletion = cleanResponse.includes(regularCompletionIndicator);
            
            // Check for ethical rejection (candidate works at client)
            const ethicalRejectionIndicator = 'אנחנו בפנדה-טק לא מגייסים עובדים פעילים של לקוחותינו';
            const isEthicalRejection = cleanResponse.includes(ethicalRejectionIndicator);

            // Check if form link was sent
            const formWasSent = cleanResponse.includes('forms.gle');

            // Update conversation status based on reschedule or ending
            const conversationUpdate = {
                last_message_date: new Date().toISOString(),
                last_message_direction: 'outgoing',
                last_message_preview: cleanResponse.substring(0, 100),
                messages_count: (conv.messages_count || 0) + 1
            };
            
            if (rescheduleMatch) {
              conversationUpdate.status = 'waiting_response';
            } else if (isConversationEnding) {
              conversationUpdate.status = 'completed';
            }

            await base44.asServiceRole.entities.WhatsappConversation.update(conversationId, conversationUpdate);

            // If form was sent, update the RotemTask
            if (formWasSent && (conv.candidate_id || conv.candidate_phone)) {
              try {
                let tasksToUpdate = [];

                if (conv.task_number) {
                  tasksToUpdate = await base44.asServiceRole.entities.RotemTask.filter({
                    task_number: conv.task_number,
                    status: 'בתהליך'
                  });
                }

                if (tasksToUpdate.length === 0) {
                  tasksToUpdate = await base44.asServiceRole.entities.RotemTask.filter({
                    candidate_phone: conv.candidate_phone,
                    status: 'בתהליך'
                  });
                }

                if (tasksToUpdate && tasksToUpdate.length > 0) {
                  for (const task of tasksToUpdate) {
                    await base44.asServiceRole.entities.RotemTask.update(task.id, {
                      form_status: 'הועבר למועמד',
                      form_sent_date: new Date().toISOString(),
                      notes: (task.notes || '') + `\n[${new Date().toLocaleString('he-IL')}] טופס מועמד הועבר`
                    });
                  }
                  console.log(`Updated ${tasksToUpdate.length} RotemTask(s) - form sent to candidate`);
                }
              } catch (taskErr) {
                console.error('Error updating RotemTask form status:', taskErr);
              }
            }

            // If conversation is ending, update the RotemTask
            if ((isConversationEnding || isSuccessfulCompletion || isRegularCompletion) && (conv.candidate_id || conv.candidate_phone)) {
              try {
                // Find the RotemTask by task_number first (most accurate)
                let tasksToUpdate = [];

                if (conv.task_number) {
                  tasksToUpdate = await base44.asServiceRole.entities.RotemTask.filter({
                    task_number: conv.task_number,
                    status: 'בתהליך'
                  });
                }

                // If not found by task_number, fall back to phone
                if (tasksToUpdate.length === 0) {
                  tasksToUpdate = await base44.asServiceRole.entities.RotemTask.filter({
                    candidate_phone: conv.candidate_phone,
                    status: 'בתהליך'
                  });
                }

                if (tasksToUpdate && tasksToUpdate.length > 0) {
                  for (const task of tasksToUpdate) {
                    // Determine final status based on completion type
                    let finalStatus = 'הסתיים';
                    let logMessage = 'השיחה הסתיימה';
                    
                    // CRITICAL: If form was sent in this conversation, it's ALWAYS "הסתיים מוצלח"
                    if (formWasSent || task.form_status === 'הועבר למועמד' || isSuccessfulCompletion) {
                      finalStatus = 'הסתיים מוצלח';
                      logMessage = 'השיחה הסתיימה בהצלחה - טופס נשלח למועמד';
                    } else if (isEthicalRejection) {
                      finalStatus = 'לא ליצור קשר';
                      logMessage = 'השיחה הסתיימה - מועמד עובד אצל לקוח (קוד אתי)';
                    } else if (isRegularCompletion) {
                      finalStatus = 'הסתיים';
                      logMessage = 'השיחה הסתיימה - מועמד לא מתאים למשרה זו';
                    }
                    
                    await base44.asServiceRole.entities.RotemTask.update(task.id, {
                      status: finalStatus,
                      notes: (task.notes || '') + `\n[${new Date().toLocaleString('he-IL')}] ${logMessage}`
                    });
                  }
                  const statusName = (formWasSent || isSuccessfulCompletion) ? '"הסתיים מוצלח"' : '"הסתיים"';
                  console.log(`Updated ${tasksToUpdate.length} RotemTask(s) to ${statusName} for ${conv.candidate_name}`);
                }
              } catch (taskErr) {
                console.error('Error updating RotemTask on conversation end:', taskErr);
              }
            }

            if (sendStatus === 'sent') {
              responded++;
              debugLogs.push(`${phone}: Sent via Green API`);
            } else {
              debugLogs.push(`${phone}: Failed to send`);
            }

        } else {
            console.log(`No response from Tal agent for ${phone}`);
            debugLogs.push(`${phone}: No agent response`);
        }

        // Release processing lock after we are done (success path)
        if (processingLock) {
          try {
            await base44.asServiceRole.entities.RotemThinkingLog.update(processingLock.id, { status: 'completed' });
          } catch (_) { /* non-critical */ }
        }

      } catch (err) {
        console.error(`Error processing conversation ${conversationId}:`, err);
        debugLogs.push(`${phone}: Error - ${err.message}`);
        // Release processing lock on error path too
        if (processingLock) {
          try {
            await base44.asServiceRole.entities.RotemThinkingLog.update(processingLock.id, { status: 'error' });
          } catch (_) { /* non-critical */ }
        }
      }

      // Rate limit between different conversations
      if (activeConversations.indexOf(conv) < activeConversations.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      }

    return Response.json({ 
      status: 'ok', 
      mode: 'green_api_live',
      incomingProcessed,
      pollAttempts,
      conversationsFound: activeConversations.length,
      processed,
      responded,
      skipped,
      debug: { logs: debugLogs }
    });

  } catch (error) {
    console.error('Processor error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});