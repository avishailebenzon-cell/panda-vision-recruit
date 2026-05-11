import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch (e) { /* running as scheduled automation - no user */ }

    // Check if agent is enabled via toggle
    try {
      const toggles = await base44.asServiceRole.entities.AgentToggleConfig.filter({ agent_name: 'ofir' });
      if (toggles.length > 0 && toggles[0].is_enabled === false) {
        console.log('⏸️ Ofir is disabled via toggle - skipping run');
        return Response.json({ success: true, skipped: true, reason: 'Agent disabled via toggle' });
      }
    } catch (toggleErr) {
      console.log('Could not check toggle - assuming enabled:', toggleErr.message);
    }

    // Helper to update detailed log
    const updateLog = async (message) => {
      try {
        const statuses = await base44.asServiceRole.entities.AgentRunStatus.filter({ agent_name: 'ofir' });
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
        match_score: { $lt: 90 },
        user_name: 'אופיר (סוכן AI)'
      });
      
      if (lowScoreMatches && lowScoreMatches.length > 0) {
        await updateLog(`מנקה ${lowScoreMatches.length} התאמות עם ציון נמוך (<90)`);
        for (const m of lowScoreMatches) {
          await base44.asServiceRole.entities.Match.delete(m.id);
        }
      }
    } catch (cleanupErr) {
      console.error('Error cleaning up:', cleanupErr);
    }

    // Update run status
    const runStatuses = await base44.asServiceRole.entities.AgentRunStatus.filter({ agent_name: 'ofir' });
    const startData = {
      agent_name: 'ofir',
      is_running: true,
      last_run_start: new Date().toISOString(),
      last_error: null,
      current_activity: 'מתחיל לרוץ...',
      detailed_log: ''
    };
    
    if (runStatuses && runStatuses.length > 0) {
      await base44.asServiceRole.entities.AgentRunStatus.update(runStatuses[0].id, startData);
    } else {
      await base44.asServiceRole.entities.AgentRunStatus.create({ ...startData, matches_created: 0 });
    }

    // Get ONLY jobs assigned to Ofir by Carmit
    await updateLog('טוען משרות שכרמית הקצתה לי...');
    
    let allJobs = await base44.entities.Job.list('-created_date', 500);
    if (!Array.isArray(allJobs)) {
      if (typeof allJobs === 'string') {
        try { allJobs = JSON.parse(allJobs); } catch { allJobs = []; }
      } else { allJobs = []; }
    }
    
    // Filter ONLY jobs that Carmit assigned to Ofir
    const activeJobs = allJobs.filter(j => {
      if (j.status !== 'פעילה') return false;
      return j.assigned_agent === 'ofir';
    });

    // Priority order:
    // 1. Jobs with ofir_priority flag (what Carmit explicitly assigned)
    // 2. Within each group - sort by recruitment_priority (1 > 2 > 3 > 4)
    // 3. Then by last processed date (oldest first)

    const priorityJobsExplicit = activeJobs.filter(j => j.ofir_priority === true);
    const regularJobs = activeJobs.filter(j => j.ofir_priority !== true);

    const priorityOrder = {
      'עדיפות גיוס 1': 1,
      'עדיפות גיוס 2': 2,
      'עדיפות גיוס 3': 3,
      'עדיפות גיוס 4': 4
    };

    const sortJobsByPriority = (jobs) => {
      return jobs.sort((a, b) => {
        const aPriority = priorityOrder[a.recruitment_priority] || 3;
        const bPriority = priorityOrder[b.recruitment_priority] || 3;

        if (aPriority !== bPriority) {
          return aPriority - bPriority; // Lower number = higher priority
        }

        const aDate = a.ofir_processed_date ? new Date(a.ofir_processed_date).getTime() : 0;
        const bDate = b.ofir_processed_date ? new Date(b.ofir_processed_date).getTime() : 0;
        return aDate - bDate; // Oldest first
      });
    };

    const sortedPriorityJobs = sortJobsByPriority(priorityJobsExplicit);
    const sortedRegularJobs = sortJobsByPriority(regularJobs);

    const sortedJobs = [...sortedPriorityJobs, ...sortedRegularJobs];

    if (sortedJobs.length === 0) {
      await updateLog('❌ לא נמצאו משרות מכונות כלל');
      await base44.entities.AgentRunStatus.update(runStatuses[0].id, {
        is_running: false,
        last_run_end: new Date().toISOString(),
        matches_created: 0
      });
      return Response.json({ success: true, matchesCreated: 0 });
    }

    await updateLog(`✅ ${sortedJobs.length} משרות מכונות לעיבוד (${priorityJobsExplicit.length} בעדיפות)`);

    await updateLog('טוען מועמדים בחלקים...');
    let allCandidates = [];
    const batchSize = 100;
    let skip = 0;
    let hasMore = true;

    while (hasMore && skip < 300) {
      try {
        const batch = await base44.asServiceRole.entities.Candidate.filter({}, '-created_date', batchSize, skip);

        if (Array.isArray(batch)) {
          allCandidates = allCandidates.concat(batch);
          await updateLog(`✓ טען ${batch.length} מועמדים (סה"כ ${allCandidates.length})`);

          if (batch.length < batchSize) {
            hasMore = false;
          } else {
            skip += batchSize;
            await delay(400);
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

    const availableCandidates = allCandidates.filter(c => 
      c.status !== 'לא מתאים - נסגר' && 
      c.status !== 'מועסק - פעיל'
    );

    await updateLog(`✅ ${availableCandidates.length} מועמדים זמינים מתוך ${allCandidates.length}`);

    if (availableCandidates.length === 0) {
      await updateLog('❌ אין מועמדים');
      await base44.asServiceRole.entities.AgentRunStatus.update(runStatuses[0].id, {
        is_running: false,
        last_run_end: new Date().toISOString(),
        matches_created: 0
      });
      return Response.json({ success: true, matchesCreated: 0 });
    }

    let existingMatches = await base44.asServiceRole.entities.Match.list('-created_date', 5000);
    if (!Array.isArray(existingMatches)) {
      if (typeof existingMatches === 'string') {
        try { existingMatches = JSON.parse(existingMatches); } catch { existingMatches = []; }
      } else { existingMatches = []; }
    }
    const existingMatchKeys = new Set(existingMatches.map(m => `${m.job_id}_${m.candidate_id}`));

    let totalMatchesCreated = 0;
    const MAX_JOBS_PER_RUN = 3; // Reduced from 10 to 3 to prevent timeout
    const MAX_CANDIDATES_PER_JOB = 30; // Limit candidates per job

    // Process each job - up to MAX_JOBS_PER_RUN
    for (let jobIndex = 0; jobIndex < Math.min(sortedJobs.length, MAX_JOBS_PER_RUN); jobIndex++) {
      const job = sortedJobs[jobIndex];

      await updateLog(`📌 משרה ${jobIndex + 1}/${sortedJobs.length}: ${job.title}`);

      await base44.asServiceRole.entities.AgentRunStatus.update(runStatuses[0].id, {
        focused_job_id: job.id,
        focused_job_title: job.title,
        focus_start_time: new Date().toISOString(),
        focus_matches_found: 0
      });

      let jobExistingMatches = await base44.asServiceRole.entities.Match.filter({ 
        job_id: job.id,
        user_name: 'אופיר (סוכן AI)',
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
      const relevantCandidates = availableCandidates.filter(c => {
        if (jobExistingCandidateIds.has(c.id)) return false;
        const searchText = [
          c.main_experience, c.skills_summary, c.main_tech_tools,
          c.job_1_description, c.job_2_description, c.job_3_description,
          c.education, c.military_service
        ].join(' ').toLowerCase();
        
        return !excludedKeywords.some(keyword => searchText.includes(keyword));
      });
      
      // Limit candidates per job to prevent timeout
      const candidatesToProcess = relevantCandidates.slice(0, MAX_CANDIDATES_PER_JOB);

      await updateLog(`📋 ${candidatesToProcess.length} מועמדים (${jobExistingMatches.length} נבדקו, מוגבל ל-${MAX_CANDIDATES_PER_JOB})`);

      if (candidatesToProcess.length === 0) {
        await updateLog(`✅ כל המועמדים נבדקו`);
        continue;
      }

      await updateLog(`🔄 עובר על ${candidatesToProcess.length} מועמדים (מוגבל ל-${MAX_CANDIDATES_PER_JOB})...`);

      let jobMatchesCreated = 0;

      // Reduced batch size from 15 to 10 to speed up processing
      for (let batchStart = 0; batchStart < candidatesToProcess.length; batchStart += 10) {
        const batchEnd = Math.min(batchStart + 10, candidatesToProcess.length);
        const candidatesBatch = candidatesToProcess.slice(batchStart, batchEnd);

        await updateLog(`📦 חבילה ${Math.floor(batchStart / 10) + 1}: ${batchStart + 1}-${batchEnd}`);

        const candidatesList = candidatesBatch.map((c, i) => 
          `${i + 1}. ${c.first_name || ''} ${c.last_name || ''}\n   סיווג: ${c.security_clearance || 'לא צוין'}\n   עיר: ${c.city || 'לא צוין'}\n   ניסיון: ${c.main_experience || 'לא צוין'}\n   השכלה: ${c.education || 'לא צוין'}\n   כישורים: ${c.skills_summary || 'לא צוין'}\n   שפות: ${c.languages || 'לא צוין'}\n   כלים: ${c.main_tech_tools || 'לא צוין'}`
        ).join('\n\n');

        const isPriorityJob = job.ofir_priority === true;
        const priorityNote = isPriorityJob ? '\n🔴 עדיפות!' : '';

        // Load feedback context for this agent
        let agentFeedbackText = '';
        try {
          const feedbackResp = await base44.asServiceRole.functions.invoke('getAgentFeedbackContext', { agent_name: 'ofir' });
          agentFeedbackText = feedbackResp?.data?.feedbackText || '';
        } catch (e) { /* ignore */ }

        const prompt = `אתה אופיר, סוכן גיוס מומחה לתחום הנדסת מכונות (Mechanical Engineering) בחברת פנדה-טק. דבר תמיד בלשון זכר.

⛔ PRE-FILTER (לפני כל ניתוח - אם מתקיים אחד מאלה → אל תחזיר את המועמד בכלל):
- ⛔ עובד כרגע בלקוח פנדה-טק: אם job_1_company (התפקיד הנוכחי) מכיל: תעשייה אווירית / רפאל / אלתא / IAI / Rafael / Elta → אל תחזיר בכלל (עבודה עבר אצל אותם לקוחות - מותר)
- תחום ראשי הוא תוכנה/אלקטרוניקה/IT ואין ניסיון מכני תעשייתי מוכח (תכן/אנליזה/ייצור מכני)
- ⛔ תחום לא רלוונטי: אם main_discipline הוא אדריכלות/בנייה/עיצוב פנים/אינסטלציה/סולארי/אזרחית ואין ניסיון הנדסת מכונות תעשייתי מוכח → אל תחזיר בכלל
- ⛔ HARD GATE - ניסיון אקדמי בלבד: אם אין אף תפקיד תעשייתי ממשי (Engineer/Designer/Technician בחברה) → אל תחזיר בכלל
- ⛔ HARD GATE - בוגר טרי: אם years_experience ≤ 1 והמשרה דורשת "X שנות ניסיון" (X>1) → אל תחזיר בכלל

כללים לא סחירים:
1) הנדסת מכונות בלבד - תכן מכני, CAD, אנליזה (FEA/CFD), תרמי, זיווד, ייצור (DFM/DFA), חומרים, Medical Devices, Pharma/Biotech
2) לא ממציא נתונים - אם אין הוכחה בקו"ח → "לא מוכח" = חסר
3) Hard Gates - אם דרישת מינימום לא מתקיימת → match_score ≤69 + ציין מה נכשל
4) Core Skills - הגדר 3-6 כישורי ליבה. "לא מוכח" = חסר
5) כלל מחמיר: חסרים 2 כישורי ליבה → max 75 וברירת מחדל <70. חובה לציין אילו חסרים
6) חסר 1 כישור ליבה → max 85
7) ציון 90+ נדיר - רק אם 0 חוסרי Core + כל Hard Gates + הוכחות חזקות לתוצרים מכניים
8) סף הצגה: 70+ בלבד
9) מרחק >100 ק"מ → Hard Gate (69 ומטה)
10) Hands-on - מועמדים ניהוליים בעיקרם ללא עשייה → הורד משמעותית
11) ⛔ ניסיון תעשייתי: ספור רק Engineer/Designer/Technician בחברות. אל תספור: שירות צבאי, פרויקטים אקדמיים

פרטי המשרה:
כותרת: ${job.title}${priorityNote}
מיקום: ${job.location || 'לא צוין'}
תיאור: ${job.description || 'לא צוין'}
דרישות: ${job.requirements || 'לא צוין'}
${job.dana_supplement ? 'הגדרות נוספות: ' + job.dana_supplement : ''}
סיווג בטחוני נדרש: ${job.security_clearance || 'לא צוין'}

רשימת מועמדים:
${candidatesList}

עקרון ראיות: כלי/תחום נחשבים "קיימים" רק עם ניסיון מוכח בתפקיד/פרויקט/תוצר. לא נחשב: skills list, אזכור יחיד, "היכרות".

קו"ח ישנים (>3 שנים): הורד 10-15 נקודות + הוסף "⚠️ קורות חיים מ-[שנה]".
${agentFeedbackText}

הוראות פלט:
1. נתח משרה: Hard Gates, Core Skills (3-6), Secondary Skills, קלסטר מכני
2. בדוק מועמדים: Hard Gates? Core מוכחים? כלים ספציפיים מוכחים?
3. החזר רק 70+
4. detailed_analysis מלא: requirement, candidate_qualification, is_match
5. match_reasons (זכר): Hard Gates, Core Skills (מוכח/חלש/חסר + איפה), כלים, קלסטר, Medical/Pharma, ניסיון, פערים

החזר עד 5 מועמדים.`;

        let llmResponse = null;
        let retries = 0;
        const maxRetries = 3;
        
        while (retries < maxRetries && !llmResponse) {
          try {
            llmResponse = await base44.integrations.Core.InvokeLLM({
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
                      } catch (rateLimitErr) {
            if (rateLimitErr.message?.includes('Rate limit') && retries < maxRetries - 1) {
              retries++;
              const waitTime = Math.pow(2, retries) * 2000;
              await updateLog(`⏳ Rate limit - ממתין ${waitTime/1000}s (ניסיון ${retries}/${maxRetries})`);
              await delay(waitTime);
            } else {
              throw rateLimitErr;
            }
          }
        }

        try {
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

              // Mahat Penalty: Reduce 10% if candidate studied at מה״ט
              const educationText = (candidate.education || '') + ' ' + (candidate.education_1 || '') + ' ' + (candidate.education_2 || '') + ' ' + (candidate.education_3 || '');
              if (educationText.includes('מה״ט') || educationText.toLowerCase().includes('מהט')) {
                const originalScore = match.match_score;
                match.match_score = Math.max(0, match.match_score - 10);
                match.match_reasons = `⚠️ הורדה של 10% בגלל לימודים במה״ט (${originalScore}% → ${match.match_score}%)\n\n${match.match_reasons || ''}`;
              }

              // Level 1 Security Gate: If job requires Level 1 and candidate doesn't have it - cap at 70
              if (job.security_clearance === 'רמה 1' && candidate.security_clearance !== 'רמה 1') {
                if (match.match_score > 70) {
                  match.match_score = 70;
                  match.match_reasons = `⚠️ ציון מוגבל ל-70% - המשרה דורשת סיווג רמה 1 והמועמד אינו בעל סיווג רמה 1.\n\n${match.match_reasons || ''}`;
                }
              }

              // Experience Gate: Reject candidates with ≤1 year experience if job requires multi-year experience
              const candidateExperience = candidate.overall_years_of_experience || candidate.years_experience || 0;
              const jobRequirementsText = `${job.requirements || ''} ${job.description || ''}`.toLowerCase();
              const requiresExperience = /(\d+)\+?\s*(שנ(ו|י)ת|years).*?(ניסיון|experience)/i.test(jobRequirementsText);
              
              if (requiresExperience && candidateExperience <= 1) {
                await updateLog(`🚫 ${candidate.first_name} - ניסיון ${candidateExperience} שנים (משרה דורשת ניסיון מרובה) - נדחה`);
                continue;
              }

              if (!existingMatchKeys.has(matchKey)) {
                const doubleCheck = await base44.asServiceRole.entities.Match.filter({
                  job_id: job.id,
                  candidate_id: candidate.id
                });
                
                if (doubleCheck && doubleCheck.length > 0) {
                  existingMatchKeys.add(matchKey);
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

                await updateLog(`✅ ${candidate.first_name} ${candidate.last_name} (${match.match_score})`);

                // Build geo display text
                let geoDisplayText = '';
                if (geoFitResult.geo_status === 'APPROVED') {
                  geoDisplayText = `\n\n📍 התאמה גיאוגרפית: אושר | מרחק: ${geoFitResult.distance_km} ק"מ | סף: ${geoFitResult.threshold_km} ק"מ`;
                } else if (geoFitResult.geo_status === 'UNKNOWN_ALLOWED') {
                  geoDisplayText = `\n\n📍 התאמה גיאוגרפית: לא נבדקה (חסר נתון מיקום)`;
                }

                // Skip deep justification to save time - use basic match_reasons from LLM
                const finalMatchReasons = (match.match_reasons || 'התאמה אוטומטית') + geoDisplayText;
                await updateLog(`✓ ${candidate.first_name} - משתמש בניתוח בסיסי`);

                const candidateFullName = `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim();

                await base44.asServiceRole.entities.Match.create({
                  job_id: job.id,
                  job_title: job.title,
                  candidate_id: candidate.id,
                  candidate_name: candidateFullName,
                  user_id: user?.id || 'system',
                  user_name: 'אופיר (סוכן AI)',
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
                
                // Update candidate status to "המלצה אוטומטית"
                try {
                  await base44.asServiceRole.entities.Candidate.update(candidate.id, {
                    status: 'המלצה אוטומטית',
                    status_number: 3
                  });
                } catch (updateCandidateErr) {
                  console.error('Failed to update candidate status:', updateCandidateErr.message);
                }
                
                existingMatchKeys.add(matchKey);
                jobMatchesCreated++;
                totalMatchesCreated++;

                try {
                  await base44.asServiceRole.entities.AgentRunStatus.update(runStatuses[0].id, {
                    focus_matches_found: jobMatchesCreated
                  });
                } catch (updateStatusErr) {
                  console.error('Failed to update agent status:', updateStatusErr.message);
                }
              }
            }
          }
        } catch (llmError) {
          await updateLog(`⚠️ שגיאה: ${llmError.message}`);
        }

        await delay(2500);
      }

      // Update job processed date
      try {
        // Update only the processed date and priority separately
        await base44.asServiceRole.entities.Job.update(job.id, {
          ofir_processed_date: new Date().toISOString(),
          ofir_priority: false
        });
      } catch (updateJobErr) {
        console.error('Failed to update job processed date:', updateJobErr.message);
        await updateLog(`⚠️ נכשל עדכון מועדי קו"ח: ${updateJobErr.message}`);
        
        // Try individual updates as fallback
        try {
          await base44.asServiceRole.entities.Job.update(job.id, { ofir_processed_date: new Date().toISOString() });
        } catch (e) {
          console.error('Failed to update processed date:', e.message);
        }
        try {
          await base44.asServiceRole.entities.Job.update(job.id, { ofir_priority: false });
        } catch (e) {
          console.error('Failed to update priority:', e.message);
        }
      }

      await updateLog(`✅ סיימתי "${job.title}" - ${jobMatchesCreated} התאמות`);
      await delay(500);
    }

    const jobsProcessedCount = Math.min(sortedJobs.length, MAX_JOBS_PER_RUN);
    await updateLog(`🎯 אופיר סיים! ${totalMatchesCreated} התאמות ב-${jobsProcessedCount} משרות`);
    
    await base44.asServiceRole.entities.AgentRunStatus.update(runStatuses[0].id, {
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
        actor_name: 'ofir',
        actor_image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face',
        action_type: 'match_created',
        action_description: `אופיר עבר על ${jobsProcessedCount} משרות הנדסת מכונות ומצא ${totalMatchesCreated} התאמות`,
        status: 'success'
      });
    }

    return Response.json({ 
      success: true, 
      matchesCreated: totalMatchesCreated,
      jobsProcessed: jobsProcessedCount
    });

  } catch (error) {
    console.error('Error:', error);
    
    try {
      const base44Fallback = createClientFromRequest(req);
      const runStatuses = await base44Fallback.asServiceRole.entities.AgentRunStatus.filter({ agent_name: 'ofir' });
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