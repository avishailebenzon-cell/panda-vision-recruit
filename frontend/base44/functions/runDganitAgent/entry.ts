import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch (e) { /* running as scheduled automation - no user */ }

    // Check if agent is enabled via toggle
    try {
      const toggles = await base44.asServiceRole.entities.AgentToggleConfig.filter({ agent_name: 'dganit' });
      if (toggles.length > 0 && toggles[0].is_enabled === false) {
        console.log('⏸️ Dganit is disabled via toggle - skipping run');
        return Response.json({ success: true, skipped: true, reason: 'Agent disabled via toggle' });
      }
    } catch (toggleErr) {
      console.log('Could not check toggle - assuming enabled:', toggleErr.message);
    }

    const updateLog = async (message) => {
      try {
        const statuses = await base44.asServiceRole.entities.AgentRunStatus.filter({ agent_name: 'dganit' });
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

    // Cleanup low score matches
    try {
      const lowScoreMatches = await base44.asServiceRole.entities.Match.filter({
        is_automatic_recommendation: true,
        match_score: { $lt: 70 },
        user_name: 'דגנית (סוכנת AI)'
      });
      
      if (lowScoreMatches && lowScoreMatches.length > 0) {
        await updateLog(`מנקה ${lowScoreMatches.length} התאמות עם ציון נמוך (<70)`);
        for (const m of lowScoreMatches) {
          await base44.asServiceRole.entities.Match.delete(m.id);
        }
      }
    } catch (cleanupErr) {
      console.error('Error cleaning up:', cleanupErr);
    }

    // Update run status
    const runStatuses = await base44.asServiceRole.entities.AgentRunStatus.filter({ agent_name: 'dganit' });
    const startData = {
      agent_name: 'dganit',
      is_running: true,
      last_run_start: new Date().toISOString(),
      last_error: null,
      current_activity: 'מתחילה לרוץ...',
      detailed_log: ''
    };
    
    if (runStatuses && runStatuses.length > 0) {
      await base44.asServiceRole.entities.AgentRunStatus.update(runStatuses[0].id, startData);
    } else {
      await base44.asServiceRole.entities.AgentRunStatus.create({ ...startData, matches_created: 0 });
    }

    const currentStatuses = await base44.asServiceRole.entities.AgentRunStatus.filter({ agent_name: 'dganit' });
    const statusRecord = currentStatuses[0];

    // Get ONLY jobs assigned to Dganit by Carmit
    await updateLog('טוענת משרות QA שכרמית הקצתה לי...');
    
    let allJobs = await base44.asServiceRole.entities.Job.list('-created_date', 500);
    if (!Array.isArray(allJobs)) {
      try { allJobs = JSON.parse(allJobs); } catch { allJobs = []; }
    }
    
    const activeJobs = allJobs.filter(j => {
      if (j.status !== 'פעילה') return false;
      return j.assigned_agent === 'dganit';
    });

    const priorityJobsExplicit = activeJobs.filter(j => j.dganit_priority === true);
    const regularJobs = activeJobs.filter(j => j.dganit_priority !== true);
    
    const priorityOrder = {
      'עדיפות גיוס 1': 1, 'עדיפות גיוס 2': 2, 'עדיפות גיוס 3': 3, 'עדיפות גיוס 4': 4
    };
    
    const sortJobsByPriority = (jobs) => {
      return jobs.sort((a, b) => {
        const aPriority = priorityOrder[a.recruitment_priority] || 3;
        const bPriority = priorityOrder[b.recruitment_priority] || 3;
        if (aPriority !== bPriority) return aPriority - bPriority;
        const aDate = a.dganit_processed_date ? new Date(a.dganit_processed_date).getTime() : 0;
        const bDate = b.dganit_processed_date ? new Date(b.dganit_processed_date).getTime() : 0;
        return aDate - bDate;
      });
    };
    
    const sortedJobs = [...sortJobsByPriority(priorityJobsExplicit), ...sortJobsByPriority(regularJobs)];

    if (sortedJobs.length === 0) {
      await updateLog('❌ לא נמצאו משרות QA מוקצות');
      await base44.asServiceRole.entities.AgentRunStatus.update(statusRecord.id, {
        is_running: false, last_run_end: new Date().toISOString(), matches_created: 0
      });
      return Response.json({ success: true, matchesCreated: 0, message: 'אין משרות QA' });
    }

    await updateLog(`✅ ${sortedJobs.length} משרות QA לעיבוד (${priorityJobsExplicit.length} בעדיפות)`);

    // Load candidates in batches
    await updateLog('טוענת מועמדים בחלקים...');
    let allCandidates = [];
    const batchSize = 100;
    let skip = 0;
    let hasMore = true;
    
    while (hasMore && skip < 1000) {
      try {
        const batch = await base44.asServiceRole.entities.Candidate.filter({}, '-created_date', batchSize, skip);
        if (Array.isArray(batch)) {
          allCandidates = allCandidates.concat(batch);
          if (batch.length < batchSize) hasMore = false;
          else { skip += batchSize; await delay(300); }
        } else { hasMore = false; }
      } catch (err) {
        await updateLog(`✗ שגיאה בחבילה ${skip}: ${err.message}`);
        hasMore = false;
      }
    }
    
    const availableCandidates = allCandidates.filter(c => 
      c.status !== 'לא מתאים - נסגר' && c.status !== 'מועסק - פעיל'
    );
    
    await updateLog(`✅ ${availableCandidates.length} מועמדים זמינים`);

    if (availableCandidates.length === 0) {
      await updateLog('❌ אין מועמדים זמינים');
      await base44.asServiceRole.entities.AgentRunStatus.update(statusRecord.id, {
        is_running: false, last_run_end: new Date().toISOString(), matches_created: 0
      });
      return Response.json({ success: true, matchesCreated: 0, message: 'אין מועמדים' });
    }

    let existingMatches = await base44.asServiceRole.entities.Match.list('-created_date', 5000);
    if (!Array.isArray(existingMatches)) {
      try { existingMatches = JSON.parse(existingMatches); } catch { existingMatches = []; }
    }
    const existingMatchKeys = new Set(existingMatches.map(m => `${m.job_id}_${m.candidate_id}`));

    let totalMatchesCreated = 0;
    const MAX_JOBS_PER_RUN = 10;

    for (let jobIndex = 0; jobIndex < Math.min(sortedJobs.length, MAX_JOBS_PER_RUN); jobIndex++) {
      const job = sortedJobs[jobIndex];

      await updateLog(`📌 משרה ${jobIndex + 1}/${sortedJobs.length}: ${job.title}`);

      await base44.asServiceRole.entities.AgentRunStatus.update(statusRecord.id, {
        focused_job_id: job.id,
        focused_job_title: job.title,
        focus_start_time: new Date().toISOString(),
        focus_matches_found: 0
      });

      let jobExistingMatches = await base44.asServiceRole.entities.Match.filter({ 
        job_id: job.id,
        user_name: 'דגנית (סוכנת AI)',
        match_score: { $gte: 70 }
      });
      if (!Array.isArray(jobExistingMatches)) {
        try { jobExistingMatches = JSON.parse(jobExistingMatches); } catch { jobExistingMatches = []; }
      }
      
      const jobExistingCandidateIds = new Set(jobExistingMatches.map(m => m.candidate_id));
      
      // Filter out semiconductor/silicon/PCB candidates (not relevant for Panda-Tech)
      const excludedKeywords = ['silicon', 'semiconductor', 'מוליכים למחצה', 'סיליקון', 'pcb'];
      const relevantCandidates = availableCandidates.filter(c => {
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
        await updateLog('✅ כל המועמדים נבדקו');
        continue;
      }

      let jobMatchesCreated = 0;

      for (let batchStart = 0; batchStart < candidatesToProcess.length; batchStart += 30) {
        const batchEnd = Math.min(batchStart + 30, candidatesToProcess.length);
        const candidatesBatch = candidatesToProcess.slice(batchStart, batchEnd);

        await updateLog(`📦 חבילה ${Math.floor(batchStart / 30) + 1}: מועמדים ${batchStart + 1}-${batchEnd}`);

        const candidatesList = candidatesBatch.map((c, i) => 
          `${i + 1}. ${c.first_name || ''} ${c.last_name || ''}\n   סיווג: ${c.security_clearance || 'לא צוין'}\n   עיר: ${c.city || 'לא צוין'}\n   ניסיון: ${c.main_experience || 'לא צוין'}\n   השכלה: ${c.education || 'לא צוין'}\n   כישורים: ${c.skills_summary || 'לא צוין'}\n   כלים: ${c.main_tech_tools || 'לא צוין'}\n   שפות תכנות: ${c.main_programming_languages || 'לא צוין'}`
        ).join('\n\n');

        const isPriorityJob = job.dganit_priority === true;
        const priorityNote = isPriorityJob ? '\n🔴 משרה בעדיפות!' : '';

        // Load feedback context for this agent
        let agentFeedbackText = '';
        try {
          const feedbackResp = await base44.asServiceRole.functions.invoke('getAgentFeedbackContext', { agent_name: 'dganit' });
          agentFeedbackText = feedbackResp?.data?.feedbackText || '';
        } catch (e) { /* ignore */ }

        const prompt = `את דגנית, סוכנת גיוס מומחית QA של חברת פנדה-טק. דברי תמיד בלשון נקבה.

⛔ PRE-FILTER (לפני כל ניתוח - אם מתקיים אחד מאלה → אל תחזירי את המועמד בכלל):
- ⛔ עובדת כרגע בלקוח פנדה-טק: אם job_1_company (התפקיד הנוכחי בלבד) מכיל: תעשייה אווירית / IAI / רפאל / Rafael / אלתא / Elta → אל תחזירי בכלל. שימי לב: רק תפקיד נוכחי - אם עבדה בעבר אצל הלקוחות האלו זה מותר
- ⛔ תחום לא רלוונטי: אם main_discipline הוא אדריכלות/בנייה/עיצוב פנים/אינסטלציה/סולארי/אזרחית ואין ניסיון QA/תוכנה תעשייתי מוכח → אל תחזירי בכלל
- ⛔ HARD GATE - ניסיון אקדמי בלבד: אם אין אף תפקיד תעשייתי ממשי (QA/SDET/Test Engineer בחברה) → אל תחזירי בכלל
- ⛔ HARD GATE - בוגרת טרייה: אם years_experience ≤ 1 והמשרה דורשת "X שנות ניסיון" (X>1) → אל תחזירי בכלל

כללים לא סחירים:
1) QA בלבד - QA Manual, QA Automation, SDET, בדיקות Web/Mobile/API/Backend/Embedded
2) לא ממציאה נתונים - אם אין הוכחה בקו"ח → "לא מוכח" = חסר
3) Hard Gates - אם דרישת מינימום לא מתקיימת → match_score ≤69 + ציין מה נכשל
4) Core Skills - הגדר 3-6 כישורי ליבה. "לא מוכח" = חסר
5) כלל מחמיר: חסרים 2 כישורי ליבה → max 75 וברירת מחדל <70. חובה לציין אילו חסרים
6) חסר 1 כישור ליבה → max 85
7) ציון 90+ נדיר - רק אם 0 חוסרי Core + כל Hard Gates + כישורי ליבה מוכחים
8) סף הצגה: 70+ בלבד
9) מרחק >100 ק"מ → Hard Gate (69 ומטה)
10) אם משרה דורשת סיווג רמה 1 ולמועמד אין → ציון מוגבל ל-70%
11) ⛔ ניסיון תעשייתי: ספרי רק QA/SDET/Test Engineer בחברות. אל תספרי: שירות צבאי, פרויקטים אקדמיים

פרטי המשרה:
כותרת: ${job.title}${priorityNote}
מיקום: ${job.location || 'לא צוין'}
תיאור: ${job.description || 'לא צוין'}
דרישות: ${job.requirements || 'לא צוין'}
${job.dana_supplement ? 'הגדרות נוספות: ' + job.dana_supplement : ''}
סיווג בטחוני נדרש: ${job.security_clearance || 'לא צוין'}

רשימת מועמדים:
${candidatesList}

עקרון ראיות: טכנולוגיה/כישור "קיימים" רק עם ניסיון מוכח בתפקיד/פרויקט. לא נחשב: skills list, אזכור יחיד, "היכרות".

קו"ח ישנים (>3 שנים): הורד 10-15 נקודות + הוסף "⚠️ קורות חיים מ-[שנה]".
${agentFeedbackText}

הוראות פלט:
1. נתחי את המשרה: סוג QA, Hard Gates, Core Skills (3-6)
2. בדקי מועמדים: Hard Gates? Core מוכחים? כלים ספציפיים מוכחים?
3. החזירי רק 70+
4. match_reasons (נקבה): Hard Gates, Core Skills (מוכח/חלש/חסר), כלים, ניסיון, פערים
5. detailed_analysis מלא

החזירי עד 5 מועמדים.`;

        try {
          const llmResponse = await base44.integrations.Core.InvokeLLM({
            prompt,
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
                      match_reasons: { type: "string" },
                      detailed_analysis: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            requirement: { type: "string" },
                            candidate_qualification: { type: "string" },
                            is_match: { type: "string", enum: ["true", "false", "partial"] }
                          },
                          required: ["requirement", "candidate_qualification", "is_match"]
                        }
                      }
                    },
                    required: ["candidate_index", "candidate_name", "match_score", "match_reasons", "detailed_analysis"]
                  }
                }
              }
            }
          });

          const matches = llmResponse?.matches || [];
          const highScoreMatches = matches.filter(m => (m.match_score || 0) >= 70);

          for (const match of highScoreMatches) {
            const idx = (match.candidate_index || 0) - 1;
            if (idx < 0 || idx >= candidatesBatch.length) {
              await updateLog(`⚠️ מועמד אינדקס ${match.candidate_index} לא בטווח - מדלג`);
              continue;
            }
            const candidate = candidatesBatch[idx];
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

              if (job.security_clearance === 'רמה 1' && candidate.security_clearance !== 'רמה 1') {
                if (match.match_score > 70) {
                  match.match_score = 70;
                  match.match_reasons = `⚠️ ציון מוגבל ל-70% - המשרה דורשת סיווג רמה 1.\n\n${match.match_reasons || ''}`;
                }
              }

              // Experience Gate: Reject candidates with ≤1 year experience if job requires multi-year experience
              const candidateExperience = candidate.overall_years_of_experience || candidate.years_experience || 0;
              const jobRequirementsText = `${job.requirements || ''} ${job.description || ''}`.toLowerCase();
              const requiresExperience = /(\d+)\+?\s*(שנ(ו|י)ת|years).*?(ניסיון|experience)/i.test(jobRequirementsText);
              
              if (requiresExperience && candidateExperience <= 1) {
                await updateLog(`🚫 ${candidate.first_name} - ניסיון ${candidateExperience} שנים (משרה דורשת ניסיון מרובה) - נדחתה`);
                continue;
              }

              if (!existingMatchKeys.has(matchKey)) {
                const doubleCheck = await base44.asServiceRole.entities.Match.filter({
                  job_id: job.id, candidate_id: candidate.id
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

                // GeoFit Gate
                let geoFitResult = null;
                try {
                  const geoResponse = await base44.asServiceRole.functions.invoke('calculateGeoFit', {
                    candidate_id: candidate.id, job_id: job.id
                  });
                  geoFitResult = geoResponse.data?.result;
                } catch (geoErr) {
                  await updateLog(`⚠️ GeoFit failed: ${geoErr.message}`);
                  continue;
                }

                if (geoFitResult.geo_status === 'REJECTED' || geoFitResult.geo_status === 'NEEDS_REVIEW') {
                  await updateLog(`🚫 ${candidate.first_name} - נדחה גיאוגרפית`);
                  continue;
                }

                await updateLog(`✅ ${candidate.first_name} ${candidate.last_name} (${match.match_score})`);

                let geoDisplayText = '';
                if (geoFitResult.geo_status === 'APPROVED') {
                  geoDisplayText = `\n\n📍 התאמה גיאוגרפית: אושר | מרחק: ${geoFitResult.distance_km} ק"מ | סף: ${geoFitResult.threshold_km} ק"מ`;
                } else if (geoFitResult.geo_status === 'UNKNOWN_ALLOWED') {
                  geoDisplayText = `\n\n📍 התאמה גיאוגרפית: לא נבדקה (חסר נתון מיקום)`;
                }

                let finalMatchReasons = match.match_reasons || 'התאמה אוטומטית';
                
                try {
                  const justificationResponse = await base44.asServiceRole.functions.invoke('generateMatchJustification', {
                    match_id: 'temp', candidate_id: candidate.id, job_id: job.id, agent_type: 'dganit'
                  });
                  
                  if (justificationResponse?.data?.justification) {
                    finalMatchReasons = justificationResponse.data.justification + geoDisplayText;
                    if (justificationResponse.data.isNotSuitable) {
                      await updateLog(`🚫 ${candidate.first_name} - נדחה ע"י נימוק מעמיק (לא מתאים)`);
                      continue;
                    }
                  } else {
                    finalMatchReasons = (match.match_reasons || 'התאמה אוטומטית') + geoDisplayText;
                  }
                } catch (justErr) {
                  finalMatchReasons = (match.match_reasons || 'התאמה אוטומטית') + geoDisplayText;
                }

                const candidateFullName = `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim();

                await base44.asServiceRole.entities.Match.create({
                  job_id: job.id,
                  job_title: job.title,
                  candidate_id: candidate.id,
                  candidate_name: candidateFullName,
                  user_id: user?.id || 'system',
                  user_name: 'דגנית (סוכנת AI)',
                  user_app_role: 'system',
                  status: 'חדש',
                  status_number: 1,
                  is_read: false,
                  match_score: match.match_score,
                  match_reasons: finalMatchReasons,
                  detailed_analysis: match.detailed_analysis ? JSON.stringify(match.detailed_analysis) : null,
                  is_automatic_recommendation: true,
                  geo_status: geoFitResult.geo_status,
                  geo_distance_km: geoFitResult.distance_km
                });
                
                existingMatchKeys.add(matchKey);
                jobMatchesCreated++;
                totalMatchesCreated++;

                await base44.asServiceRole.entities.AgentRunStatus.update(statusRecord.id, {
                  focus_matches_found: jobMatchesCreated
                });
              }
            }
          }
        } catch (llmError) {
          await updateLog(`⚠️ שגיאת AI: ${llmError.message}`);
        }

        await delay(500);
      }

      await base44.asServiceRole.entities.Job.update(job.id, {
        dganit_processed_date: new Date().toISOString(),
        dganit_priority: false
      });

      await updateLog(`✅ סיימתי "${job.title}" - ${jobMatchesCreated} התאמות`);
      await delay(1000);
    }

    await updateLog(`🎯 דגנית סיימה! ${totalMatchesCreated} התאמות ב-${sortedJobs.length} משרות`);
    
    await base44.asServiceRole.entities.AgentRunStatus.update(statusRecord.id, {
      is_running: false,
      last_run_end: new Date().toISOString(),
      matches_created: totalMatchesCreated,
      current_activity: null,
      focused_job_id: null,
      focused_job_title: null,
      focused_candidate_id: null,
      focused_candidate_name: null
    });

    if (totalMatchesCreated > 0) {
      await base44.asServiceRole.entities.SystemActivityLog.create({
        actor_type: 'agent',
        actor_name: 'dganit',
        actor_image: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=40&h=40&fit=crop&crop=face',
        action_type: 'match_created',
        action_description: `דגנית עברה על ${sortedJobs.length} משרות QA ומצאה ${totalMatchesCreated} התאמות`,
        status: 'success'
      });
    }

    return Response.json({ 
      success: true, 
      matchesCreated: totalMatchesCreated,
      jobsProcessed: sortedJobs.length
    });

  } catch (error) {
    console.error('Error:', error);
    
    try {
      const base44Fallback = createClientFromRequest(req);
      const runStatuses = await base44Fallback.asServiceRole.entities.AgentRunStatus.filter({ agent_name: 'dganit' });
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