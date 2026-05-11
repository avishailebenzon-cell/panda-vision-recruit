import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch (e) { /* running as scheduled automation - no user */ }

    // Check if agent is enabled via toggle
    try {
      const toggles = await base44.asServiceRole.entities.AgentToggleConfig.filter({ agent_name: 'rami' });
      if (toggles.length > 0 && toggles[0].is_enabled === false) {
        console.log('⏸️ Rami is disabled via toggle - skipping run');
        return Response.json({ success: true, skipped: true, reason: 'Agent disabled via toggle' });
      }
    } catch (toggleErr) {
      console.log('Could not check toggle - assuming enabled:', toggleErr.message);
    }

    // Helper to update detailed log
        const updateLog = async (message) => {
            try {
                const statuses = await base44.asServiceRole.entities.AgentRunStatus.filter({ agent_name: 'rami' });
                if (statuses.length > 0) {
                    const currentLog = statuses[0].detailed_log || '';
                    const timestamp = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    const newLog = `[${timestamp}] ${message}\n${currentLog}`;
                    await base44.asServiceRole.entities.AgentRunStatus.update(statuses[0].id, {
                        current_activity: message,
                        detailed_log: newLog.substring(0, 10000)
                    });
                }
            } catch (err) {
                console.error('Failed to update log:', err.message);
            }
        };

        // Cleanup low score matches (< 90)
        try {
            const lowScoreMatches = await base44.asServiceRole.entities.Match.filter({
                is_automatic_recommendation: true,
                match_score: { $lt: 70 },
                user_name: 'רמי (סוכן AI)'
            });
            
            if (lowScoreMatches && lowScoreMatches.length > 0) {
                await updateLog(`מנקה ${lowScoreMatches.length} התאמות עם ציון נמוך`);
                for (const m of lowScoreMatches) {
                    await base44.asServiceRole.entities.Match.delete(m.id);
                }
            }
        } catch (cleanupErr) {
            console.error('Error cleaning up:', cleanupErr);
        }

        // Update agent status to running
        let agentStatus = null;
        try {
            const statuses = await base44.asServiceRole.entities.AgentRunStatus.filter({ agent_name: 'rami' });
            const startData = {
                agent_name: 'rami',
                is_running: true,
                last_run_start: new Date().toISOString(),
                last_error: null,
                current_activity: 'מתחיל לרוץ...',
                detailed_log: ''
            };
            
            if (statuses.length > 0) {
                agentStatus = statuses[0];
                await base44.asServiceRole.entities.AgentRunStatus.update(agentStatus.id, startData);
            } else {
                agentStatus = await base44.asServiceRole.entities.AgentRunStatus.create({ ...startData, matches_created: 0 });
            }
        } catch (statusError) {
            console.warn('Could not update agent status:', statusError.message);
        }

        // Load active Level 1 synonyms
        await updateLog('טוען נרדפות ומשרות רמה 1...');
        let allSynonyms = await base44.asServiceRole.entities.SynonymMapping.filter({ is_active: true });
        if (!Array.isArray(allSynonyms)) {
          if (typeof allSynonyms === 'string') {
            try { allSynonyms = JSON.parse(allSynonyms); } catch { allSynonyms = []; }
          } else { allSynonyms = []; }
        }
        const level1Synonyms = allSynonyms.filter(s => 
            s.synonym_word?.toLowerCase().includes('רמה 1') || 
            s.synonym_word?.toLowerCase().includes('סודי ביותר')
        );
        console.log(`Loaded ${level1Synonyms.length} Level 1 synonyms`);

        // Get all Level 1 jobs (פעילה status only)
        let allJobs = await base44.asServiceRole.entities.Job.list('-created_date', 500);
        if (!Array.isArray(allJobs)) {
          if (typeof allJobs === 'string') {
            try { allJobs = JSON.parse(allJobs); } catch { allJobs = []; }
          } else { allJobs = []; }
        }
        
        const activeLevel1Jobs = allJobs.filter(j => 
            j.status === 'פעילה' && 
            j.security_clearance === 'רמה 1'
        );
        
        // ALWAYS process ALL Level 1 jobs - no time limits
        // Priority: jobs with rami_priority flag first, then by most recent
        const priorityJobs = activeLevel1Jobs.filter(j => j.rami_priority === true);
        const regularJobs = activeLevel1Jobs.filter(j => j.rami_priority !== true);
        
        // Sort regular jobs by last processed date (least recently processed first)
        regularJobs.sort((a, b) => {
          const aDate = a.rami_processed_date ? new Date(a.rami_processed_date).getTime() : 0;
          const bDate = b.rami_processed_date ? new Date(b.rami_processed_date).getTime() : 0;
          return aDate - bDate; // Oldest first
        });
        
        const sortedJobs = [...priorityJobs, ...regularJobs];

        await updateLog(`✅ ${sortedJobs.length} משרות רמה 1 לעיבוד (${priorityJobs.length} בעדיפות)`);

        if (sortedJobs.length === 0) {
            await updateLog('❌ לא נמצאו משרות רמה 1');
            if (agentStatus) {
            await base44.asServiceRole.entities.AgentRunStatus.update(agentStatus.id, {
                is_running: false,
                last_run_end: new Date().toISOString(),
                matches_created: 0
            });
            }
            return Response.json({ 
            success: true, 
            message: 'No Level 1 jobs available',
                matchesCreated: 0
            });
        }

        // Pick ONE random Level 1 job to focus on this run (prioritize priority jobs)
        const randomJob = sortedJobs[0];
        await updateLog(`📌 משרה נבחרה: ${randomJob.title}`);
        
        // Update focused job
        await base44.asServiceRole.entities.AgentRunStatus.update(agentStatus.id, {
            focused_job_id: randomJob.id,
            focused_job_title: randomJob.title,
            focus_start_time: new Date().toISOString(),
            focus_matches_found: 0
        });

        // Get all Level 1 candidates in batches (ONCE, before processing jobs)
        await updateLog('טוען מועמדי רמה 1 בחלקים...');
        let allLevel1Candidates = [];
        const batchSize = 100;
        let skip = 0;
        let hasMore = true;
        
        while (hasMore && skip < 1000) {
          try {
            const batch = await base44.asServiceRole.entities.Candidate.filter({
              security_clearance: 'רמה 1'
            }, '-created_date', batchSize, skip);
            
            if (Array.isArray(batch)) {
              allLevel1Candidates = allLevel1Candidates.concat(batch);
              await updateLog(`✓ טען ${batch.length} מועמדים (סה"כ ${allLevel1Candidates.length})`);
              
              if (batch.length < batchSize) {
                hasMore = false;
              } else {
                skip += batchSize;
                await delay(300);
              }
            } else {
              await updateLog(`⚠ חבילה ${skip}-${skip+batchSize} החזירה ${typeof batch}`);
              hasMore = false;
            }
          } catch (err) {
            await updateLog(`✗ שגיאה בחבילה ${skip}: ${err.message}`);
            hasMore = false;
          }
        }
        
        const level1Candidates = allLevel1Candidates.filter(c => 
            c.status !== 'לא מתאים - נסגר' && 
            c.status !== 'לא רלוונטי יותר' && 
            c.status !== 'מועסק - פעיל'
        );

        await updateLog(`✅ ${level1Candidates.length} מועמדי רמה 1 זמינים`);

        if (level1Candidates.length === 0) {
            await updateLog('❌ אין מועמדי רמה 1 זמינים');
            if (agentStatus) {
                await base44.asServiceRole.entities.AgentRunStatus.update(agentStatus.id, {
                    is_running: false,
                    last_run_end: new Date().toISOString(),
                    matches_created: 0,
                    focused_job_id: null,
                    focused_job_title: null
                });
            }
            return Response.json({ 
                success: true, 
                message: 'No Level 1 candidates available',
                matchesCreated: 0
            });
        }

        // Get existing matches to avoid duplicates
        let existingMatches = await base44.asServiceRole.entities.Match.list('-created_date', 5000);
        if (!Array.isArray(existingMatches)) {
            if (typeof existingMatches === 'string') {
                try { existingMatches = JSON.parse(existingMatches); } catch { existingMatches = []; }
            } else { existingMatches = []; }
        }
        const existingMatchKeys = new Set(existingMatches.map(m => `${m.job_id}_${m.candidate_id}`));

        let totalMatchesCreated = 0;
        const MAX_JOBS_PER_RUN = 10; // Limit to prevent infinite running

        // Process each job SEQUENTIALLY - up to MAX_JOBS_PER_RUN
        for (let jobIndex = 0; jobIndex < Math.min(sortedJobs.length, MAX_JOBS_PER_RUN); jobIndex++) {
            const job = sortedJobs[jobIndex];
            
            // Check if stopped
            try {
                const scheduleCheck = await base44.asServiceRole.entities.AgentSchedule.filter({ agent_name: 'rami' });
                if (scheduleCheck && scheduleCheck[0] && scheduleCheck[0].is_enabled === false) {
                    throw new Error('הסוכן הופסק על ידי המשתמש');
                }
            } catch (checkErr) {
                if (checkErr.message.includes('הופסק')) throw checkErr;
            }

            await updateLog(`📌 משרה ${jobIndex + 1}/${sortedJobs.length}: ${job.title}`);

            // Update focused job
            await base44.asServiceRole.entities.AgentRunStatus.update(agentStatus.id, {
                focused_job_id: job.id,
                focused_job_title: job.title,
                focus_start_time: new Date().toISOString(),
                focus_matches_found: 0
            });

            // Filter candidates not already matched to this job
            let jobExistingMatches = await base44.asServiceRole.entities.Match.filter({ 
                job_id: job.id,
                user_name: 'רמי (סוכן AI)',
                match_score: { $gte: 70 }
            });
            if (!Array.isArray(jobExistingMatches)) {
                if (typeof jobExistingMatches === 'string') {
                    try { jobExistingMatches = JSON.parse(jobExistingMatches); } catch { jobExistingMatches = []; }
                } else { jobExistingMatches = []; }
            }
            
            const jobExistingCandidateIds = new Set(jobExistingMatches.map(m => m.candidate_id));
            
            // Filter out semiconductor/silicon/PCB candidates (not relevant for Panda-Tech)
            const excludedKeywords = ['silicon', 'semiconductor', 'מוליכים למחצה', 'סיליקון', 'pcb'];
            const relevantCandidates = level1Candidates.filter(c => {
              if (jobExistingCandidateIds.has(c.id)) return false;
              const searchText = [
                c.main_experience, c.skills_summary, c.main_tech_tools,
                c.job_1_description, c.job_2_description, c.job_3_description,
                c.education, c.military_service
              ].join(' ').toLowerCase();
              
              return !excludedKeywords.some(keyword => searchText.includes(keyword));
            });
            
            const candidatesToProcess = relevantCandidates;

            await updateLog(`📋 ${candidatesToProcess.length} מועמדים חדשים (${jobExistingMatches.length} כבר נבדקו)`);

            if (candidatesToProcess.length === 0) {
                await updateLog(`✅ כל המועמדים נבדקו למשרה זו`);
                continue;
            }

            await updateLog(`🔄 מתחיל לעבור על ${candidatesToProcess.length} מועמדים...`);

            let jobMatchesCreated = 0;

        // Process candidates in batches to find matches
        const CANDIDATES_PER_BATCH = 30;

        for (let i = 0; i < candidatesToProcess.length; i += CANDIDATES_PER_BATCH) {
            // Check if we reached 10 matches - stop processing this job
            if (jobMatchesCreated >= 10) {
                await updateLog(`✅ הגעתי ל-10 התאמות למשרה זו - עובר למשרה הבאה`);
                break;
            }

            const batch = candidatesToProcess.slice(i, i + CANDIDATES_PER_BATCH);
            await updateLog(`📦 עיבוד חבילה ${Math.floor(i / CANDIDATES_PER_BATCH) + 1}: מועמדים ${i + 1}-${Math.min(i + CANDIDATES_PER_BATCH, candidatesToProcess.length)}`);

            const candidatesContext = batch.map((c, idx) => `
        ${idx + 1}. ${c.first_name || ''} ${c.last_name || ''} - ניסיון: ${(c.main_experience || c.skills_summary || 'לא צוין').substring(0, 150)}, שירות צבאי: ${(c.military_service || 'לא צוין').substring(0, 100)}
        `).join('\n');

            const isPriorityJob = job.rami_priority === true;
            const priorityNote = isPriorityJob ? '\n🔴 משרה בעדיפות גבוהה!' : '';

            // Load feedback context for this agent
            let agentFeedbackText = '';
            try {
              const feedbackResp = await base44.asServiceRole.functions.invoke('getAgentFeedbackContext', { agent_name: 'rami' });
              agentFeedbackText = feedbackResp?.data?.feedbackText || '';
            } catch (e) { /* ignore */ }

            const prompt = `את רמי, מומחית התאמות ברמה 1. מצאי מועמדים מתאימים למשרה.

⛔ PRE-FILTER (לפני כל ניתוח - אם מתקיים אחד מאלה → אל תחזירי את המועמד בכלל):
- ⛔ עובדת כרגע בלקוח פנדה-טק: אם job_1_company (התפקיד הנוכחי בלבד) מכיל: תעשייה אווירית / IAI / רפאל / Rafael / אלתא / Elta → אל תחזירי בכלל. שימי לב: רק תפקיד נוכחי - אם עבדה בעבר אצל הלקוחות האלו זה מותר
- ⛔ תחום לא רלוונטי: אם main_discipline הוא אדריכלות/בנייה/עיצוב פנים/אינסטלציה/סולארי/אזרחית ואין ניסיון הייטקי תעשייתי מוכח → אל תחזירי בכלל
- ⛔ HARD GATE - ניסיון אקדמי בלבד: אם אין אף תפקיד תעשייתי ממשי (Engineer/Developer/Technician בחברה) → אל תחזירי בכלל
- ⛔ HARD GATE - בוגרת טרייה: אם years_experience ≤ 1 והמשרה דורשת "X שנות ניסיון" (X>1) → אל תחזירי בכלל

🎯 **כלל ברזל - MUST HAVE**:
אם במשרה מופיעים כלים/טכנולוגיות/תוכנות ספציפיות (לדוגמה: Mentor Expedition, SolidWorks, DOORS, CATIA, וכו') - המועמד חייב להכיר אותם.
⚠️ ללא הכלים הנדרשים - ציון התאמה מקסימלי הוא 50. אל תחזירי מועמדים כאלה.

משרה: ${job.title}${priorityNote}
מיקום: ${job.location || 'לא צוין'}
תיאור: ${(job.description || '').substring(0, 400)}
דרישות: ${(job.requirements || '').substring(0, 400)}
סיווג: רמה 1

מועמדים (כולם רמה 1):
${candidatesContext}

**קריטריונים להערכה (לפי סדר חשיבות)**:
1. התאמת כלים וטכנולוגיות ספציפיות - קריטי (ללא זה מקסימום 50)
2. התאמה מקצועית - תחום עיסוק, תפקיד, ניסיון
3. התאמה טכנית נוספת - שפות, מערכות

**החזירי רק התאמות 90%+** עם כל הכלים הנדרשים.
החזירי עד 3 מועמדים מתאימים. כתבי בלשון נקבה: "מצאתי...", "בדקתי...", "ממליצה...".
${agentFeedbackText}`;

                const result = await base44.integrations.Core.InvokeLLM({
                    prompt: prompt,
                    response_json_schema: {
                        type: "object",
                        properties: {
                            matches: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        candidate_index: { type: "number" },
                                        candidate_name: { type: "string" },
                                        match_score: { type: "number" },
                                        match_reasons: { type: "string" }
                                    }
                                }
                            }
                        }
                    }
                });

                const matches = result?.matches || [];
                const highScoreMatches = matches.filter(m => (m.match_score || 0) >= 70);

                for (const match of highScoreMatches) {
                    if (jobMatchesCreated >= 10) break; // Stop at 10 matches per job
                    
                    const idx = (match.candidate_index || 0) - 1;
                    if (idx < 0 || idx >= batch.length) {
                        await updateLog(`⚠️ מועמד אינדקס ${match.candidate_index} לא בטווח - מדלג`);
                        continue;
                    }
                    const candidate = batch[idx];
                    if (match.candidate_name) {
                      const expectedName = `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim().toLowerCase();
                      const returnedName = match.candidate_name.trim().toLowerCase();
                      if (!expectedName.includes(returnedName.split(' ')[0]) && !returnedName.includes(expectedName.split(' ')[0])) {
                        await updateLog(`⚠️ אי-התאמה בשם: ציפינו ${expectedName}, קיבלנו ${returnedName} - מדלג`);
                        continue;
                      }
                    }
                    if (true) {
                        const matchKey = `${job.id}_${candidate.id}`;
                        
                        if (!existingMatchKeys.has(matchKey)) {
                            // Double-check if match already exists
                            const doubleCheck = await base44.asServiceRole.entities.Match.filter({
                                job_id: job.id,
                                candidate_id: candidate.id
                            });
                            
                            if (doubleCheck && doubleCheck.length > 0) {
                                existingMatchKeys.add(matchKey);
                                continue;
                            }

                            // Mahat Penalty: Reduce 10% if candidate studied at מה״ט
                            const educationText = (candidate.education || '') + ' ' + (candidate.education_1 || '') + ' ' + (candidate.education_2 || '') + ' ' + (candidate.education_3 || '');
                            if (educationText.includes('מה״ט') || educationText.toLowerCase().includes('מהט')) {
                              const originalScore = match.match_score;
                              match.match_score = Math.max(0, match.match_score - 10);
                              match.match_reasons = `⚠️ הורדה של 10% בגלל לימודים במה״ט (${originalScore}% → ${match.match_score}%)\n\n${match.match_reasons || ''}`;
                            }

                            // Experience Gate: Reject candidates with ≤1 year experience if job requires multi-year experience
                            const candidateExperience = candidate.overall_years_of_experience || candidate.years_experience || 0;
                            const jobRequirementsText = `${job.requirements || ''} ${job.description || ''}`.toLowerCase();
                            const requiresExperience = /(\d+)\+?\s*(שנ(ו|י)ת|years).*?(ניסיון|experience)/i.test(jobRequirementsText);
                            
                            if (requiresExperience && candidateExperience <= 1) {
                              await updateLog(`🚫 ${candidate.first_name} - ניסיון ${candidateExperience} שנים (משרה דורשת ניסיון מרובה) - נדחתה`);
                              continue;
                            }

                            // 🚨 GeoFit Gate - MANDATORY CHECK
                            let geoFitResult = null;
                            try {
                              const geoResponse = await base44.asServiceRole.functions.invoke('calculateGeoFit', {
                                candidate_id: candidate.id,
                                job_id: job.id
                              });
                              geoFitResult = geoResponse.data?.result;
                            } catch (geoErr) {
                              await updateLog(`⚠️ GeoFit failed: ${geoErr.message}`);
                              continue;
                            }

                            // Gate decision
                            if (geoFitResult.geo_status === 'REJECTED' || geoFitResult.geo_status === 'NEEDS_REVIEW') {
                              await updateLog(`🚫 ${candidate.first_name} - נדחה גיאוגרפית`);
                              continue;
                            }

                            await updateLog(`✅ התאמה: ${candidate.first_name} ${candidate.last_name} (${match.match_score})`);

                            // Build geo display text
                            let geoDisplayText = '';
                            if (geoFitResult.geo_status === 'APPROVED') {
                              geoDisplayText = `\n\n📍 התאמה גיאוגרפית: אושר | מרחק: ${geoFitResult.distance_km} ק"מ | סף: ${geoFitResult.threshold_km} ק"מ`;
                            } else if (geoFitResult.geo_status === 'UNKNOWN_ALLOWED') {
                              geoDisplayText = `\n\n📍 התאמה גיאוגרפית: לא נבדקה (חסר נתון מיקום)`;
                            }

                            // Generate deep justification using advanced algorithm
                            let finalMatchReasons = match.match_reasons || 'התאמה אוטומטית';
                            
                            try {
                              const justificationResponse = await base44.asServiceRole.functions.invoke('generateMatchJustification', {
                                match_id: 'temp',
                                candidate_id: candidate.id,
                                job_id: job.id,
                                agent_type: 'rami'
                              });
                              
                              if (justificationResponse?.data?.justification) {
                                finalMatchReasons = justificationResponse.data.justification + geoDisplayText;
                                await updateLog(`🔍 נימוק מעמיק נוצר עבור ${candidate.first_name}`);
                                if (justificationResponse.data.isNotSuitable) {
                                  await updateLog(`🚫 ${candidate.first_name} - נדחה ע"י נימוק מעמיק (לא מתאים)`);
                                  continue;
                                }
                              } else {
                                finalMatchReasons = (match.match_reasons || 'התאמה אוטומטית') + geoDisplayText;
                              }
                            } catch (justErr) {
                              await updateLog(`⚠️ נימוק מעמיק נכשל, משתמש בבסיסי`);
                              finalMatchReasons = (match.match_reasons || 'התאמה אוטומטית') + geoDisplayText;
                            }

                            const candidateFullName = `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim();

                            await base44.asServiceRole.entities.Match.create({
                                job_id: job.id,
                                job_title: job.title,
                                candidate_id: candidate.id,
                                candidate_name: candidateFullName,
                                user_id: user?.id || 'system',
                                user_name: 'רמי (סוכן AI)',
                                user_app_role: 'system',
                                status: 'חדש',
                                status_number: 1,
                                is_read: false,
                                match_score: match.match_score,
                                match_reasons: finalMatchReasons,
                                is_automatic_recommendation: true,
                                geo_status: geoFitResult.geo_status,
                                geo_distance_km: geoFitResult.distance_km
                            });
                            
                            // Update candidate status to "המלצה אוטומטית"
                            await base44.asServiceRole.entities.Candidate.update(candidate.id, {
                              status: 'המלצה אוטומטית',
                              status_number: 3
                            });
                            
                            existingMatchKeys.add(matchKey);
                            jobMatchesCreated++;
                            totalMatchesCreated++;
                            
                            // Update focus counter
                            await base44.asServiceRole.entities.AgentRunStatus.update(agentStatus.id, {
                                focus_matches_found: jobMatchesCreated
                            });
                        }
                    }
                }

                await delay(500);
            }

            // Mark job as processed
            await base44.asServiceRole.entities.Job.update(job.id, {
                rami_processed_date: new Date().toISOString(),
                rami_priority: false
            });

            await updateLog(`✅ סיימתי "${job.title}" - ${jobMatchesCreated} התאמות`);
            await delay(1000);
        }

        await updateLog(`🎯 רמי סיים! ${totalMatchesCreated} התאמות ב-${sortedJobs.length} משרות`);

        // Update agent status to finished
        if (agentStatus) {
            await base44.asServiceRole.entities.AgentRunStatus.update(agentStatus.id, {
                is_running: false,
                last_run_end: new Date().toISOString(),
                matches_created: totalMatchesCreated,
                current_activity: null,
                focused_job_id: null,
                focused_job_title: null,
                focused_candidate_id: null,
                focused_candidate_name: null
            });
        }

        // Log to system activity if matches were created
        if (totalMatchesCreated > 0) {
            try {
                await base44.asServiceRole.entities.SystemActivityLog.create({
                    actor_type: 'agent',
                    actor_name: 'רמי',
                    actor_image: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=40&h=40&fit=crop&crop=face',
                    action_type: 'match_created',
                    action_description: `רמי עבר על ${sortedJobs.length} משרות רמה 1 ומצא ${totalMatchesCreated} התאמות`,
                    status: 'success'
                });
            } catch (logError) {
                console.warn('Failed to log activity:', logError.message);
            }
        }

        return Response.json({
            success: true,
            matchesCreated: totalMatchesCreated,
            jobsProcessed: sortedJobs.length
        });

    } catch (error) {
        console.error('Rami agent error:', error.message);
        
        // Update status with error
        try {
            const base44Fallback = createClientFromRequest(req);
            const statuses = await base44Fallback.entities.AgentRunStatus.filter({ agent_name: 'rami' });
            if (statuses.length > 0) {
                const currentLog = statuses[0].detailed_log || '';
                const timestamp = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                const newLog = `[${timestamp}] ❌ שגיאה: ${error.message}\n${currentLog}`;
                
                await base44Fallback.entities.AgentRunStatus.update(statuses[0].id, {
                    is_running: false,
                    last_run_end: new Date().toISOString(),
                    last_error: error.message,
                    detailed_log: newLog.substring(0, 10000),
                    focused_job_id: null,
                    focused_job_title: null
                });
            }
        } catch (statusError) {
            console.error('Failed to update status with error:', statusError.message);
        }

        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});