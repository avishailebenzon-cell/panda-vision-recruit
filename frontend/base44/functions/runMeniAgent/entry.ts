import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch (e) { /* running as scheduled automation - no user */ }

    // Check if agent is enabled via toggle
    try {
      const toggles = await base44.asServiceRole.entities.AgentToggleConfig.filter({ agent_name: 'meni' });
      if (toggles.length > 0 && toggles[0].is_enabled === false) {
        console.log('⏸️ Meni is disabled via toggle - skipping run');
        return Response.json({ success: true, skipped: true, reason: 'Agent disabled via toggle' });
      }
    } catch (toggleErr) {
      console.log('Could not check toggle - assuming enabled:', toggleErr.message);
    }

    console.log('🎨 Starting Meni Creative Matcher...');

    // Helper function to update log
    const updateLog = async (message, runStatusId = null) => {
      try {
        const statuses = runStatusId ? [{ id: runStatusId }] : await base44.asServiceRole.entities.AgentRunStatus.filter({ agent_name: 'meni' });
        if (statuses.length > 0) {
          const currentLog = statuses[0].detailed_log || '';
          const timestamp = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          const newLog = `[${timestamp}] ${message}\n${currentLog}`;
          await base44.asServiceRole.entities.AgentRunStatus.update(statuses[0].id, {
            current_activity: message,
            detailed_log: newLog.substring(0, 10000) // Keep last 10k chars
          });
        }
      } catch (err) {
        console.error('Failed to update log:', err.message);
      }
    };

    // Get or update agent run status
    let runStatus;
    try {
      const runStatuses = await base44.asServiceRole.entities.AgentRunStatus.filter({ agent_name: 'meni' });
      if (runStatuses && runStatuses.length > 0) {
        runStatus = runStatuses[0];
        await base44.asServiceRole.entities.AgentRunStatus.update(runStatus.id, {
          is_running: true,
          last_run_start: new Date().toISOString(),
          last_error: null,
          current_activity: 'מתחיל להריץ את מני...',
          detailed_log: ''
        });
      } else {
        runStatus = await base44.asServiceRole.entities.AgentRunStatus.create({
          agent_name: 'meni',
          is_running: true,
          last_run_start: new Date().toISOString(),
          matches_created: 0,
          current_activity: 'מתחיל להריץ את מני...',
          detailed_log: ''
        });
      }
    } catch (statusErr) {
      console.error('Error updating run status:', statusErr);
    }

    // Load candidates from NewCandidateInbox with security clearance רמה 1
    await updateLog('מחפש מועמדי רמה 1 בתיבת הדואר הנכנס...');
    await delay(500);
    
    let inboxCandidates = [];
    try {
      inboxCandidates = await base44.asServiceRole.entities.NewCandidateInbox.filter({ 
        security_clearance: 'רמה 1'
      });
      
      if (!Array.isArray(inboxCandidates)) {
        console.log('Inbox returned non-array, trying to parse...');
        if (typeof inboxCandidates === 'string') {
          try {
            inboxCandidates = JSON.parse(inboxCandidates);
          } catch {
            inboxCandidates = [];
          }
        } else {
          inboxCandidates = [];
        }
      }
      
      console.log(`Found ${inboxCandidates.length} Level 1 candidates in inbox`);
    } catch (inboxErr) {
      console.error('Failed to load inbox:', inboxErr.message);
      inboxCandidates = [];
    }
    
    await delay(800);
    
    // Get last processed candidate ID from run status to support pagination
    const lastProcessedId = runStatus?.last_processed_candidate_id || null;
    
    // Sort inbox by candidate_id to maintain consistent order
    inboxCandidates.sort((a, b) => a.candidate_id.localeCompare(b.candidate_id));
    
    // Skip candidates we already processed in previous runs
    let candidatesToLoad = inboxCandidates;
    if (lastProcessedId) {
      const lastIndex = inboxCandidates.findIndex(c => c.candidate_id === lastProcessedId);
      if (lastIndex >= 0) {
        candidatesToLoad = inboxCandidates.slice(lastIndex + 1);
        console.log(`Resuming from candidate after ${lastProcessedId}, ${candidatesToLoad.length} remaining`);
      }
    }
    
    // Process maximum 10 candidates per run to avoid timeout
    const MAX_CANDIDATES_PER_RUN = 10;
    candidatesToLoad = candidatesToLoad.slice(0, MAX_CANDIDATES_PER_RUN);
    
    // Load EACH candidate individually
    const level1Candidates = [];
    
    await updateLog(`טוען ${candidatesToLoad.length} מועמדי רמה 1 (אחד אחד)...`);
    
    for (const inboxItem of candidatesToLoad) {
      try {
        await delay(300);
        const candidateList = await base44.asServiceRole.entities.Candidate.filter({ 
          id: inboxItem.candidate_id 
        });
        
        if (Array.isArray(candidateList) && candidateList.length > 0) {
          level1Candidates.push(candidateList[0]);
          console.log(`Loaded candidate: ${candidateList[0].first_name} ${candidateList[0].last_name}`);
        }
      } catch (err) {
        console.error(`Failed to load candidate ${inboxItem.candidate_id}:`, err.message);
      }
    }
    
    console.log(`📊 Successfully loaded ${level1Candidates.length} Level 1 candidates`);
    await updateLog(`נטענו ${level1Candidates.length} מועמדי רמה 1`);
    
    if (level1Candidates.length > 0) {
      console.log(`Sample: ${level1Candidates.slice(0, 3).map(c => `${c.first_name} ${c.last_name} - ${c.security_clearance}`).join(', ')}`);
    }

    if (level1Candidates.length === 0) {
      const runStatuses = await base44.asServiceRole.entities.AgentRunStatus.filter({ agent_name: 'meni' });
      if (runStatuses && runStatuses.length > 0) {
        await base44.asServiceRole.entities.AgentRunStatus.update(runStatuses[0].id, {
          is_running: false,
          last_run_end: new Date().toISOString(),
          matches_created: 0
        });
      }

      return Response.json({ success: true, recommendations: [], message: 'אין מועמדי רמה 1 זמינים' });
    }

    // Get all contact persons with professional field (clients/potential clients only)
    await updateLog('טוען רשימת אנשי קשר...');
    await delay(800);
    const allContacts = await base44.asServiceRole.entities.ContactPerson.list();
    await delay(800);

    console.log(`Total contacts in system: ${allContacts?.length || 0}`);
    
    const contactsWithField = (Array.isArray(allContacts) ? allContacts : []).filter(c => 
      c.professional_field && 
      c.professional_field.trim().length > 0 &&
      (c.contact_status === 'לקוח' || c.contact_status === 'לקוח פוטנציאלי')
    );

    console.log(`Found ${contactsWithField.length} contacts with professional field (clients only) out of ${allContacts?.length || 0} total`);
    console.log(`Sample contacts: ${contactsWithField.slice(0, 3).map(c => `${c.name} - ${c.professional_field}`).join(', ')}`);
    await updateLog(`נמצאו ${contactsWithField.length} אנשי קשר עם תחום מקצועי (לקוחות בלבד) מתוך ${allContacts?.length || 0} סה"כ`);

    if (contactsWithField.length === 0) {
      const runStatuses = await base44.asServiceRole.entities.AgentRunStatus.filter({ agent_name: 'meni' });
      if (runStatuses && runStatuses.length > 0) {
        await base44.asServiceRole.entities.AgentRunStatus.update(runStatuses[0].id, {
          is_running: false,
          last_run_end: new Date().toISOString(),
          matches_created: 0
        });
      }

      return Response.json({ success: true, recommendations: [], message: 'אין אנשי קשר עם תחום מקצועי' });
    }

    // Get all clients for reference
    await updateLog('טוען רשימת לקוחות...');
    await delay(800);
    const allClients = await base44.asServiceRole.entities.Client.list();
    await delay(800);
    const clientsMap = {};
    for (const client of allClients) {
      clientsMap[client.id] = client;
    }

    const recommendations = [];
    const candidatesToProcess = level1Candidates;
    
    await updateLog(`מתחיל לעבד ${candidatesToProcess.length} מועמדים (אחד אחד עם בדיקה מול אנשי קשר)...`);
    
    let processedCount = 0;
    for (const candidate of candidatesToProcess) {
      processedCount++;
      await updateLog(`מעבד מועמד ${processedCount}/${candidatesToProcess.length}: ${candidate.first_name} ${candidate.last_name}`);
      try {
        const candidateName = `${candidate.first_name} ${candidate.last_name}`;
        
        // Identify candidate's professional field
        const candidateField = candidate.main_tech_tools || 
                              candidate.detected_tools?.join(', ') || 
                              candidate.skills_summary || 
                              candidate.main_experience || 
                              '';
        
        if (!candidateField) {
          console.log(`Skipping ${candidateName} - no professional field`);
          await updateLog(`דילוג על ${candidateName} - אין תחום מקצועי מזוהה`);
          continue;
        }

        await updateLog(`מזהה תחום מקצועי עבור ${candidateName}: ${candidateField.substring(0, 50)}...`);

        // Build contact list for prompt
        const contactsList = contactsWithField.map(contact => {
          const client = clientsMap[contact.client_id];
          return `שם: ${contact.name}, ארגון: ${client?.name || 'לא ידוע'}, תחום מקצועי: ${contact.professional_field}, תפקיד: ${contact.role || 'לא צוין'}`;
        }).join('\n');

        const prompt = `אתה מני – סוכן בינה מלאכותית למכירות אפקטיביות.

מועמד:
שם: ${candidateName}
סיווג: ${candidate.security_clearance}
תחום מקצועי: ${candidateField}

רשימת אנשי קשר במערכת:
${contactsList}

בחר עד 10 אנשי קשר המתאימים ביותר למועמד זה על פי התחום המקצועי בלבד.
התמקד בהתאמה בין תחום המועמד לתחום המקצועי של איש הקשר.

חשוב:
- עבוד רק לפי שדה "תחום מקצועי" של אנשי הקשר
- אל תמציא שמות שלא קיימים ברשימה
- בחר רק אנשי קשר שיש להם קשר מקצועי ברור לתחום של המועמד
- תעדף איכות על כמות
- תעדף אנשי קשר עם תפקידים רלוונטיים (מנהל, מגייס, ראש צוות)

החזר רשימה של עד 10 אנשי קשר בפורמט הבא בדיוק, כל שורה בנפרד:
שליחת מועמד ${candidateName} לאיש קשר <שם איש הקשר> בארגון <שם הארגון>

אל תוסיף כותרות, מספרי שורות, או טקסט נוסף. רק את השורות עצמן.
אם אין אנשי קשר מתאימים, החזר: "אין המלצות – לא נמצאו אנשי קשר מתאימים לפי תחום מקצועי."`;

        await updateLog(`שולח שאילתה ל-AI עבור ${candidateName}...`);
        await delay(1000);
        const llmResponse = await base44.integrations.Core.InvokeLLM({ prompt });
        await delay(800);
        await updateLog(`התקבלה תשובה מ-AI עבור ${candidateName}`);

        // Parse the LLM response - expecting plain text format
        const responseText = typeof llmResponse === 'string' ? llmResponse : (llmResponse.response || llmResponse.text || '');
        
        // Check for "no matches" response
        if (responseText.includes('אין המלצות')) {
          console.log(`No matches found for ${candidateName}`);
          await updateLog(`לא נמצאו התאמות עבור ${candidateName}`);
          continue;
        }
        
        await updateLog(`מנתח המלצות עבור ${candidateName}...`);
        
        const lines = responseText.split('\n').filter(line => line.trim().length > 0);
        
        const validatedContacts = [];
        
        for (const line of lines) {
          // Parse format: שליחת מועמד <name> לאיש קשר <contact> בארגון <org>
          const match = line.match(/שליחת מועמד .+ לאיש קשר (.+?) בארגון (.+)/);
          if (match) {
            const contactName = match[1].trim();
            const orgName = match[2].trim();
            
            // Find the actual contact - be flexible with name matching
            const contact = contactsWithField.find(c => {
              const client = clientsMap[c.client_id];
              const nameMatch = c.name?.includes(contactName) || 
                              contactName?.includes(c.name) ||
                              c.name?.toLowerCase().includes(contactName.toLowerCase());
              const orgMatch = client?.name?.includes(orgName) || 
                             orgName?.includes(client?.name) ||
                             client?.name?.toLowerCase().includes(orgName.toLowerCase());
              return nameMatch && orgMatch;
            });
            
            if (contact) {
              const client = clientsMap[contact.client_id];
              
              // Avoid duplicates
              if (!validatedContacts.find(vc => vc.contact_id === contact.id)) {
                validatedContacts.push({
                  contact_id: contact.id,
                  contact_name: contact.name,
                  contact_email: contact.email,
                  contact_phone: contact.phone,
                  client_id: contact.client_id,
                  client_name: client?.name || 'לא ידוע',
                  professional_field: contact.professional_field,
                  match_score: 90,
                  match_reason: `התאמה מקצועית בתחום: ${contact.professional_field}`
                });
              }
            }
          }
          
          // Limit to 10 contacts per candidate
          if (validatedContacts.length >= 10) break;
        }

        if (validatedContacts.length > 0) {
          await updateLog(`נמצאו ${validatedContacts.length} התאמות עבור ${candidateName}`);
          recommendations.push({
            candidate_id: candidate.id,
            candidate_name: candidateName,
            candidate_city: candidate.city,
            identified_field: candidateField,
            resume_url: candidate.resume_file_url,
            recommended_contacts: validatedContacts
          });

          // Create Match entities for each recommendation
          for (const contact of validatedContacts) {
            try {
              await delay(300);
              
              // Find if there's an active job for this client/contact
              const clientJobs = await base44.asServiceRole.entities.Job.filter({ 
                client_id: contact.client_id,
                status: 'פעילה'
              });
              
              // Use the first active job for this client, or null if none exists
              const relatedJob = clientJobs.length > 0 ? clientJobs[0] : null;
              
              await base44.asServiceRole.entities.Match.create({
                candidate_id: candidate.id,
                candidate_name: candidateName,
                job_id: relatedJob?.id || null,
                job_title: relatedJob?.title || null,
                user_id: 'meni_agent',
                user_name: 'מני - סוכן יצירתי',
                user_app_role: 'agent',
                status: 'המלצה יצירתית - ממתין לבדיקה',
                status_number: 1,
                is_read: false,
                match_score: contact.match_score,
                match_reasons: `${contact.match_reason}\nאיש קשר: ${contact.contact_name}\nארגון: ${contact.client_name}\nתחום: ${contact.professional_field}`,
                is_automatic_recommendation: true,
                free_text_query: `מועמד רמה 1: ${candidateName} -> איש קשר: ${contact.contact_name} (${contact.client_name})`
              });
              await updateLog(`✅ נוצרה התאמה: ${candidateName} -> ${contact.contact_name}`);
            } catch (matchErr) {
              console.error(`Failed to create match for ${candidateName} -> ${contact.contact_name}:`, matchErr.message);
              await updateLog(`⚠️ שגיאה ביצירת התאמה: ${candidateName} -> ${contact.contact_name}`);
            }
          }
        } else {
          await updateLog(`לא נמצאו התאמות מאומתות עבור ${candidateName}`);
        }

        // No delay between candidates - continuous processing
      } catch (err) {
        console.error(`Error processing candidate ${candidate.id}:`, err.message);
        await updateLog(`שגיאה במועמד ${candidate.first_name} ${candidate.last_name}: ${err.message}`);
      }
    }

    // Update agent run status with last processed ID for pagination
    await updateLog(`✅ מני סיים בהצלחה! נוצרו ${recommendations.length} המלצות`);
    
    // Save the last processed candidate ID for next run
    const lastProcessedCandidateId = candidatesToProcess.length > 0 
      ? candidatesToProcess[candidatesToProcess.length - 1].id 
      : null;
    
    const hasMoreToProcess = inboxCandidates.length > candidatesToLoad.length;
    
    try {
      const runStatuses = await base44.asServiceRole.entities.AgentRunStatus.filter({ agent_name: 'meni' });
      const statusData = {
        agent_name: 'meni',
        is_running: false,
        last_run_end: new Date().toISOString(),
        matches_created: recommendations.length,
        current_activity: hasMoreToProcess ? `הושלם - נותרו עוד ${inboxCandidates.length - candidatesToLoad.length} מועמדים` : 'הושלם',
        last_processed_candidate_id: lastProcessedCandidateId
      };
      
      if (runStatuses && runStatuses.length > 0) {
        await base44.asServiceRole.entities.AgentRunStatus.update(runStatuses[0].id, statusData);
      } else {
        await base44.asServiceRole.entities.AgentRunStatus.create(statusData);
      }
    } catch (statusErr) {
      console.error('Error updating run status:', statusErr);
    }

    // Log to SystemActivityLog
    if (recommendations.length > 0) {
      try {
        await base44.asServiceRole.entities.SystemActivityLog.create({
          actor_type: 'agent',
          actor_name: 'meni',
          actor_image: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=40&h=40&fit=crop&crop=face',
          action_type: 'match_created',
          action_description: `מני מצא ${recommendations.length} התאמות יצירתיות`,
          status: 'success',
          details: JSON.stringify({ recommendations: recommendations.length })
        });
      } catch (logErr) {
        console.warn('Failed to log activity:', logErr.message);
      }
    }

    console.log(`✅ Meni completed: ${recommendations.length} creative recommendations`);

    return Response.json({ 
      success: true, 
      recommendations,
      candidatesProcessed: candidatesToProcess.length
    });

  } catch (error) {
    console.error('Error:', error);
    
    try {
      const base44Fallback = createClientFromRequest(req);
      const runStatuses = await base44Fallback.asServiceRole.entities.AgentRunStatus.filter({ agent_name: 'meni' });
      if (runStatuses && runStatuses.length > 0) {
        await base44Fallback.asServiceRole.entities.AgentRunStatus.update(runStatuses[0].id, {
          is_running: false,
          last_error: error.message,
          last_run_end: new Date().toISOString()
        });
      }
    } catch (updateErr) {
      console.error('Failed to update error status:', updateErr.message);
    }
    
    return Response.json({ error: error.message }, { status: 500 });
  }
});