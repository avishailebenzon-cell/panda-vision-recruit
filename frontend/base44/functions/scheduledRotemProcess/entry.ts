import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    console.log('Starting Rotem Auto Contact Process');

    // Get Rotem's config
    const configs = await base44.asServiceRole.entities.AgentConfig.filter({ agent_name: 'rotem' });
    
    if (!configs || configs.length === 0) {
      return Response.json({ error: 'Rotem config not found' }, { status: 404 });
    }

    const config = configs[0];

    // Check if Rotem is active
    if (!config.is_active) {
      return Response.json({ status: 'skipped', reason: 'Agent is not active' });
    }

    // Check test mode - if enabled, skip working hours check
    const testMode = config.test_mode || false;

    if (!testMode) {
      // Check if we're within working hours (Israel time zone)
      const now = new Date();
      const israelTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
      const currentHour = israelTime.getHours();
      const currentMinute = israelTime.getMinutes();
      const currentTimeInMinutes = currentHour * 60 + currentMinute;

      const [startHour, startMinute] = (config.working_hours_start || '08:00').split(':').map(Number);
      const [endHour, endMinute] = (config.working_hours_end || '18:00').split(':').map(Number);
      const startTimeInMinutes = startHour * 60 + startMinute;
      const endTimeInMinutes = endHour * 60 + endMinute;

      if (currentTimeInMinutes < startTimeInMinutes || currentTimeInMinutes > endTimeInMinutes) {
        console.log('Outside working hours, skipping');
        return Response.json({ 
          status: 'skipped', 
          reason: 'Outside working hours',
          current_time: `${currentHour}:${currentMinute.toString().padStart(2, '0')}`,
          working_hours: `${config.working_hours_start} - ${config.working_hours_end}`
        });
      }
    } else {
      console.log('Test mode enabled - ignoring working hours');
    }

    // Get Green API credentials
    const instanceId = Deno.env.get('GREEN_API_INSTANCE_ID');
    const apiToken = Deno.env.get('GREEN_API_TOKEN');

    if (!instanceId || !apiToken) {
      return Response.json({ error: 'Green API credentials not configured' }, { status: 500 });
    }

    // Find tasks with status "מאושר לשיחה"
    const allApprovedTasks = await base44.asServiceRole.entities.RotemTask.filter({
      status: 'מאושר לשיחה'
    }, '-created_date', 10); // Process max 10 at a time

    console.log(`Found ${allApprovedTasks.length} approved tasks to process`);
    
    const approvedTasks = allApprovedTasks;

    if (approvedTasks.length === 0) {
      return Response.json({ status: 'ok', processed: 0, message: 'No approved tasks to process' });
    }

    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    const results = [];

    for (const task of approvedTasks) {
      try {
        // Get candidate and job details
        const [candidate, job] = await Promise.all([
          task.candidate_id ? base44.asServiceRole.entities.Candidate.get(task.candidate_id).catch(() => null) : null,
          task.job_id ? base44.asServiceRole.entities.Job.get(task.job_id).catch(() => null) : null
        ]);

        if (!task.candidate_phone) {
          console.log(`Task ${task.id}: No phone number, skipping`);
          
          // Update task with execution note
          await base44.asServiceRole.entities.RotemTask.update(task.id, {
            rotem_execution_note: `[${new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}] נועה: חסר מספר טלפון - לא ניתן ליצור קשר`
          });
          
          results.push({ task_id: task.id, status: 'failed', reason: 'No phone number' });
          failed++;
          continue;
        }

        // Build initial message with task number
        const candidateFirstName = candidate?.first_name || task.candidate_name.split(' ')[0];
        const jobTitle = task.job_title || 'משרה';
        const clientName = task.client_name || job?.client_name || '';
        const jobDescription = job?.description || '';
        const jobRequirements = job?.requirements || '';

        const initialMessage = `שלום ${candidateFirstName},

אני נועה - סוכנת בינה מלאכותית של פנדה-טק 🤖🐼

מצאתי התאמה בין הפרופיל שלך למשרה הבאה:

📋 *${jobTitle}*${clientName ? ` ב${clientName}` : ''}

${jobDescription ? `*תיאור המשרה:*\n${jobDescription.substring(0, 300)}${jobDescription.length > 300 ? '...' : ''}\n\n` : ''}${jobRequirements ? `*דרישות:*\n${jobRequirements.substring(0, 300)}${jobRequirements.length > 300 ? '...' : ''}\n\n` : ''}האם המשרה הזו מעניינת אותך?
אנא השב כן/לא.

_מספר פנייה: ${task.task_number}_`;

        // Clean phone number - normalize to local format (0...) for consistency
        // Remove all non-digit characters including hidden unicode marks
        let cleanPhone = task.candidate_phone.replace(/[^\d]/g, '');
        // If starts with country code, convert to local format
        if (cleanPhone.startsWith('972')) cleanPhone = '0' + cleanPhone.substring(3);

        // 1. Find or create WhatsApp conversation
        let conversation = null;
        const existingConvs = await base44.asServiceRole.entities.WhatsappConversation.filter({
          candidate_phone: cleanPhone
        }, '-created_date', 1);

        if (existingConvs && existingConvs.length > 0) {
          conversation = existingConvs[0];

          // Check if this conversation already has the same task_number
          if (conversation.task_number === task.task_number) {
            console.log(`Task ${task.task_number} already has an active conversation - skipping to prevent duplicate`);
            
            // Update task note
            await base44.asServiceRole.entities.RotemTask.update(task.id, {
              rotem_execution_note: `[${new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}] נועה: שיחה כבר קיימת עבור משימה זו - דילגתי על שליחה כפולה`
            });
            
            results.push({ task_id: task.id, status: 'skipped', reason: 'Conversation already exists for this task' });
            continue; // Skip to next task
          }

          // CRITICAL: Update conversation with current task's job details and task number
          // This ensures each new RotemTask creates a fresh conversation context
          await base44.asServiceRole.entities.WhatsappConversation.update(conversation.id, {
            job_id: task.job_id,
            job_title: task.job_title,
            task_number: task.task_number,
            status: 'active'
          });

          console.log(`Updated existing conversation ${conversation.id} with new job: ${task.job_title} (${task.task_number})`);
        } else {
          conversation = await base44.asServiceRole.entities.WhatsappConversation.create({
            candidate_id: task.candidate_id || '',
            candidate_name: task.candidate_name,
            candidate_phone: task.candidate_phone,
            job_id: task.job_id,
            job_title: task.job_title,
            task_number: task.task_number,
            status: 'active',
            messages_count: 0
          });
        }

        // 2. Send via Green API - convert to international format (972...)
        let phoneForGreenApi = cleanPhone;
        if (cleanPhone.startsWith('0')) {
          phoneForGreenApi = '972' + cleanPhone.substring(1);
        }
        const chatId = `${phoneForGreenApi}@c.us`;
        const sendUrl = `https://api.green-api.com/waInstance${instanceId}/sendMessage/${apiToken}`;

        let messageSent = false;
        let greenApiMessageId = `local_${Date.now()}`;
        let sendError = null;

        console.log(`Attempting to send to: ${task.candidate_phone} -> cleaned: ${cleanPhone} -> Green API: ${phoneForGreenApi} -> chatId: ${chatId}`);

        // Retry mechanism - try up to 3 times
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            console.log(`Send attempt ${attempt}/3 to ${phoneForGreenApi}`);

            const sendResponse = await fetch(sendUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chatId: chatId,
                message: initialMessage
              }),
              signal: AbortSignal.timeout(15000) // 15 second timeout
            });

            const sendResult = await sendResponse.json();
            console.log(`Green API response (attempt ${attempt}):`, JSON.stringify(sendResult));

            if (sendResult.idMessage) {
              messageSent = true;
              greenApiMessageId = sendResult.idMessage;
              console.log(`✓ Sent successfully to ${task.candidate_phone}: ${greenApiMessageId}`);
              break; // Success - exit retry loop
            } else {
              sendError = `Green API error (attempt ${attempt}): ${JSON.stringify(sendResult)}`;
              console.error(`✗ Attempt ${attempt} failed:`, sendResult);

              // If not last attempt, wait before retry
              if (attempt < 3) {
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
              }
            }
          } catch (sendErr) {
            sendError = `Network error (attempt ${attempt}): ${sendErr.message}`;
            console.error(`✗ Attempt ${attempt} error:`, sendErr);

            // If not last attempt, wait before retry
            if (attempt < 3) {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
        }

        // 3. Save message
        await base44.asServiceRole.entities.WhatsappMessage.create({
          conversation_id: conversation.id,
          candidate_phone: task.candidate_phone,
          direction: 'outgoing',
          content: initialMessage,
          message_id: greenApiMessageId,
          sender_name: 'נועה',
          status: messageSent ? 'sent' : 'failed'
        });

        // 4. Update conversation
        await base44.asServiceRole.entities.WhatsappConversation.update(conversation.id, {
          last_message_date: new Date().toISOString(),
          last_message_direction: 'outgoing',
          last_message_preview: initialMessage.substring(0, 100),
          messages_count: (conversation.messages_count || 0) + 1
        });

        // 5. Only if message sent successfully, update task to "בתהליך"
        if (messageSent) {
          // 5a. CRITICAL: FIRST - Stop any other active conversations with this candidate BEFORE updating current task
          // This ensures only ONE conversation is active at a time
          const otherActiveTasks = await base44.asServiceRole.entities.RotemTask.filter({
            candidate_phone: task.candidate_phone,
            status: 'בתהליך'
          });

          // Stop them to prevent multiple simultaneous conversations
          for (const otherTask of otherActiveTasks) {
            if (otherTask.id !== task.id) {
              await base44.asServiceRole.entities.RotemTask.update(otherTask.id, {
                status: 'שיחה נעצרה',
                notes: (otherTask.notes || '') + `\n[${new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}] שיחה נעצרה אוטומטית - התחילה שיחה חדשה עבור משרה אחרת`
              });
              console.log(`Stopped task ${otherTask.id} - new conversation started for same candidate`);
            }
          }

          // 5b. NOW update current task status to "בתהליך"
          await base44.asServiceRole.entities.RotemTask.update(task.id, {
            status: 'בתהליך',
            last_outgoing_message_date: new Date().toISOString(),
            notes: (task.notes || '') + `\n[${new Date().toLocaleString('he-IL')}] נועה יצרה קשר אוטומטי`,
            rotem_execution_note: `[${new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}] ✓ הודעה נשלחה בהצלחה ל-${phoneForGreenApi}`
          });

          succeeded++;
          results.push({ task_id: task.id, status: 'success', candidate: task.candidate_name });
        } else {
          failed++;

          // Update task with execution note about send failure - keep status as "מאושר לשיחה"
          await base44.asServiceRole.entities.RotemTask.update(task.id, {
            rotem_execution_note: `[${new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}] נועה: שליחה נכשלה - ${sendError || 'שירות לא זמין'}\nטלפון מקורי: ${task.candidate_phone}\nטלפון מנוקה: ${cleanPhone}\nטלפון Green API: ${phoneForGreenApi}\nchatId: ${chatId}`
          });

          results.push({ task_id: task.id, status: 'failed', reason: sendError || 'Failed to send WhatsApp', candidate: task.candidate_name });
        }

        processed++;

        // Rate limiting - wait 2 seconds between messages
        if (processed < approvedTasks.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (taskErr) {
        console.error(`Error processing task ${task.id}:`, taskErr);
        failed++;
        results.push({ task_id: task.id, status: 'error', reason: taskErr.message });
      }
    }

    // Check for tasks with no response after 3 days
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const inProgressTasks = await base44.asServiceRole.entities.RotemTask.filter({
      status: 'בתהליך'
    });

    let markedNoResponse = 0;
    for (const task of inProgressTasks) {
      // If task has last_outgoing_message_date but no last_incoming_message_date
      if (task.last_outgoing_message_date && !task.last_incoming_message_date) {
        const lastOutgoing = new Date(task.last_outgoing_message_date);
        
        // If more than 3 days since last outgoing message with no response
        if (lastOutgoing < threeDaysAgo) {
          await base44.asServiceRole.entities.RotemTask.update(task.id, {
            status: 'מועמד לא עונה',
            notes: (task.notes || '') + `\n[${new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}] המועמד לא ענה במשך 3 ימים - עבר לסטטוס "מועמד לא עונה"`,
            rotem_execution_note: `[${new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}] נועה: המועמד לא ענה תוך 3 ימים מהשליחה הראשונה`
          });
          markedNoResponse++;
          console.log(`Task ${task.id}: No response for 3 days, marked as "מועמד לא עונה"`);
        }
      }
    }

    return Response.json({ 
      status: 'ok',
      processed,
      succeeded,
      failed,
      markedNoResponse,
      results,
      working_hours: `${config.working_hours_start} - ${config.working_hours_end}`,
      interval_minutes: config.auto_contact_interval_minutes || 15
    });

  } catch (error) {
    console.error('Scheduler error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});