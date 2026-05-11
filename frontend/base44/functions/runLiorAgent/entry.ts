import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch (e) { /* running as scheduled automation - no user */ }

    // Check if agent is enabled via toggle
    try {
      const toggles = await base44.asServiceRole.entities.AgentToggleConfig.filter({ agent_name: 'lior' });
      if (toggles.length > 0 && toggles[0].is_enabled === false) {
        console.log('⏸️ Lior is disabled via toggle - skipping run');
        return Response.json({ success: true, skipped: true, reason: 'Agent disabled via toggle' });
      }
    } catch (toggleErr) {
      console.log('Could not check toggle - assuming enabled:', toggleErr.message);
    }

    // Helper to update detailed log
    const updateLog = async (message) => {
      try {
        const statuses = await base44.asServiceRole.entities.AgentRunStatus.filter({ agent_name: 'lior' });
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
        user_name: 'ליאור (סוכן AI)'
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
    const runStatuses = await base44.asServiceRole.entities.AgentRunStatus.filter({ agent_name: 'lior' });
    const startData = {
      agent_name: 'lior',
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

    // Get ONLY jobs assigned to Lior by Carmit
    await updateLog('טוען משרות שכרמית הקצתה לי...');
    
    let allJobs = await base44.asServiceRole.entities.Job.list('-created_date', 500);
    if (!Array.isArray(allJobs)) {
      if (typeof allJobs === 'string') {
        try { allJobs = JSON.parse(allJobs); } catch { allJobs = []; }
      } else { allJobs = []; }
    }
    
    // Filter ONLY jobs that Carmit assigned to Lior
    const activeJobs = allJobs.filter(j => {
      if (j.status !== 'פעילה') return false;
      return j.assigned_agent === 'lior';
    });

    // Priority order:
    // 1. Jobs with lior_priority flag (what Carmit explicitly assigned)
    // 2. Within each group - sort by recruitment_priority (1 > 2 > 3 > 4)
    // 3. Then by last processed date (oldest first)
    
    const priorityJobsExplicit = activeJobs.filter(j => j.lior_priority === true);
    const regularJobs = activeJobs.filter(j => j.lior_priority !== true);
    
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
        
        const aDate = a.lior_processed_date ? new Date(a.lior_processed_date).getTime() : 0;
        const bDate = b.lior_processed_date ? new Date(b.lior_processed_date).getTime() : 0;
        return aDate - bDate; // Oldest first
      });
    };
    
    const sortedPriorityJobs = sortJobsByPriority(priorityJobsExplicit);
    const sortedRegularJobs = sortJobsByPriority(regularJobs);
    
    const sortedJobs = [...sortedPriorityJobs, ...sortedRegularJobs];

    if (sortedJobs.length === 0) {
      await updateLog('❌ לא נמצאו משרות הנדסת מערכת');
      await base44.asServiceRole.entities.AgentRunStatus.update(runStatuses[0].id, {
        is_running: false,
        last_run_end: new Date().toISOString(),
        matches_created: 0
      });
      return Response.json({ success: true, matchesCreated: 0, message: 'אין משרות' });
    }

    await updateLog(`✅ ${sortedJobs.length} משרות מערכת לעיבוד (${priorityJobsExplicit.length} בעדיפות)`);

    await updateLog('טוען מועמדים בחלקים...');
    let allCandidates = [];
    const batchSize = 100;
    let skip = 0;
    let hasMore = true;

    while (hasMore && skip < 1000) {
      try {
        const batch = await base44.asServiceRole.entities.Candidate.filter({}, '-created_date', batchSize, skip);

        if (Array.isArray(batch)) {
          allCandidates = allCandidates.concat(batch);
          await updateLog(`✓ טען ${batch.length} מועמדים (סה"כ ${allCandidates.length})`);

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

    // Process each job - NO LIMIT, work through all assigned jobs
    for (let jobIndex = 0; jobIndex < sortedJobs.length; jobIndex++) {
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
        user_name: 'ליאור (סוכן AI)',
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
      
      const candidatesToProcess = relevantCandidates;

      await updateLog(`📋 ${candidatesToProcess.length} מועמדים (${jobExistingMatches.length} נבדקו)`);

      if (candidatesToProcess.length === 0) {
        await updateLog(`✅ כל המועמדים נבדקו`);
        continue;
      }

      await updateLog(`🔄 עובר על ${candidatesToProcess.length} מועמדים...`);

      let jobMatchesCreated = 0;

      for (let batchStart = 0; batchStart < candidatesToProcess.length; batchStart += 30) {
        const batchEnd = Math.min(batchStart + 30, candidatesToProcess.length);
        const candidatesBatch = candidatesToProcess.slice(batchStart, batchEnd);

        await updateLog(`📦 חבילה ${Math.floor(batchStart / 30) + 1}: ${batchStart + 1}-${batchEnd}`);

        const candidatesList = candidatesBatch.map((c, i) => 
          `${i + 1}. ${c.first_name || ''} ${c.last_name || ''}\n   סיווג: ${c.security_clearance || 'לא צוין'}\n   עיר: ${c.city || 'לא צוין'}\n   ניסיון: ${c.main_experience || 'לא צוין'}\n   השכלה: ${c.education || 'לא צוין'}\n   כישורים: ${c.skills_summary || 'לא צוין'}\n   שפות: ${c.languages || 'לא צוין'}\n   כלים: ${c.main_tech_tools || 'לא צוין'}`
        ).join('\n\n');

        const isPriorityJob = job.lior_priority === true;
        const priorityNote = isPriorityJob ? '\n🔴 עדיפות!' : '';

        // Load feedback context for this agent
        let agentFeedbackText = '';
        try {
          const feedbackResp = await base44.asServiceRole.functions.invoke('getAgentFeedbackContext', { agent_name: 'lior' });
          agentFeedbackText = feedbackResp?.data?.feedbackText || '';
        } catch (e) { /* ignore */ }

        const prompt = `אתה ליאור, סוכן גיוס מומחה למשרות הנדסת מערכת של חברת פנדה-טק. דבר תמיד בלשון זכר.

⛔ PRE-FILTER (לפני כל ניתוח - אם מתקיים אחד מאלה → אל תחזיר את המועמד בכלל):
- ⛔ עובד כרגע בלקוח פנדה-טק: אם job_1_company (התפקיד הנוכחי בלבד) מכיל: תעשייה אווירית / IAI / רפאל / Rafael / אלתא / Elta → אל תחזיר בכלל. שים לב: רק תפקיד נוכחי - אם עבד בעבר אצל הלקוחות האלו זה מותר
- ⛔ תחום לא רלוונטי: אם main_discipline הוא אדריכלות/בנייה/עיצוב פנים/אינסטלציה/סולארי/אזרחית ואין ניסיון הנדסת מערכת תעשייתי מוכח → אל תחזיר בכלל
- ⛔ HARD GATE - ניסיון אקדמי בלבד: אם אין אף תפקיד תעשייתי ממשי (System Engineer/Architect בחברה) → אל תחזיר בכלל
- ⛔ HARD GATE - בוגר טרי: אם years_experience ≤ 1 והמשרה דורשת "X שנות ניסיון" (X>1) → אל תחזיר בכלל

כללים לא סחירים:
1) הנדסת מערכת בלבד - SE/דרישות/ארכיטקטורה/ICD/V&V/Integration/MBSE. תוכנה/IT/אלקטרוניקה/מיגון טהורים לא בתחום
1א) ⚠️ אם המשרה עוסקת במערכות מיגון (protection systems), כתיבת מפרט דרישות למיגון, או פיקוח על מבחני קבלה למיגון - זה תחום תשתיות/IT ולא הנדסת מערכת. החזר רשימה ריקה במקרה כזה.
2) לא ממציא נתונים - אם אין הוכחה בקו"ח → "לא מוכח" = חסר
3) Hard Gates - אם דרישת מינימום לא מתקיימת → match_score ≤69 + ציין מה נכשל
4) Core Skills - הגדר 3-6 כישורי ליבה. "לא מוכח" = חסר
5) כלל מחמיר: חסרים 2 כישורי ליבה → max 75 וברירת מחדל <70. חובה לציין אילו חסרים
6) חסר 1 כישור ליבה → max 85
7) ציון 90+ נדיר - רק אם 0 חוסרי Core + כל Hard Gates + ניסיון SE מוכח (לא ניהול/תיאומים בלבד)
8) סף הצגה: 70+ בלבד
9) מרחק >100 ק"מ → Hard Gate (69 ומטה)
10) Hands-on SE - מועמדים ניהוליים/PMO/תיאומים בלי תוצרי SE → הורד משמעותית
11) ⛔ ניסיון תעשייתי: ספור רק System Engineer/Architect בחברות. אל תספור: שירות צבאי, פרויקטים אקדמיים

פרטי המשרה:
כותרת: ${job.title}${priorityNote}
מיקום: ${job.location || 'לא צוין'}
תיאור: ${job.description || 'לא צוין'}
דרישות: ${job.requirements || 'לא צוין'}
${job.dana_supplement ? 'הגדרות נוספות: ' + job.dana_supplement : ''}
סיווג בטחוני נדרש: ${job.security_clearance || 'לא צוין'}

רשימת מועמדים:
${candidatesList}

עקרון ראיות: תחום/כלי/מתודולוגיה "קיימים" רק עם ניסיון מוכח בתוצרי SE: SRD/SSS, SSD, ICD, ארכיטקטורה, Traceability, Change Control, Verification Matrix, V&V, אינטגרציה, ניהול סיכונים. לא נחשב: skills list, אזכור יחיד, "היכרות".

SE אמיתי מול תפקידים דומים: PMO/מנהל פרויקט/תיאומים ללא תוצרי דרישות/ICD/V&V = לא SE. אם אין תוצרי SE → חסר Core.

קו"ח ישנים (>3 שנים): הורד 10-15 נקודות + הוסף "⚠️ קורות חיים מ-[שנה]".
${agentFeedbackText}

הוראות פלט:
1. נתח משרה: Hard Gates, Core Skills (3-6), Secondary, קלסטר SE
2. בדוק מועמדים: Hard Gates? Core מוכחים? כלים/תחומים ספציפיים מוכחים?
3. החזר רק 70+
4. עבור כל מועמד - ציין candidate_index (המספר ברשימה, 1-based) ו-candidate_name (שמו המלא בדיוק כפי שמופיע ברשימה)
5. detailed_analysis מלא: requirement, candidate_qualification, is_match
6. match_reasons (זכר): Hard Gates, Core Skills (מוכח/חלש/חסר + איפה), תחומים/כלים, קלסטר, Medical/Pharma, ניסיון, פערים

חשוב מאוד: candidate_index חייב להיות המספר המדויק מהרשימה (1,2,3...) וcandidate_name חייב להיות שם המועמד בדיוק.
החזר עד 5 מועמדים.`;

        try {
          // Add timeout wrapper for LLM call (60 seconds max)
          const llmResponse = await Promise.race([
            base44.integrations.Core.InvokeLLM({
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
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('LLM timeout after 60s')), 60000))
          ]);

          const matches = llmResponse?.matches || [];
          const highScoreMatches = matches.filter(m => (m.match_score || 0) >= 70);

          for (const match of highScoreMatches) {
            const idx = (match.candidate_index || 0) - 1;
            if (idx < 0 || idx >= candidatesBatch.length) {
              await updateLog(`⚠️ מועמד אינדקס ${match.candidate_index} לא בטווח - מדלג`);
              continue;
            }
            const candidate = candidatesBatch[idx];
            // Safety check: validate the name matches
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

                // Generate deep justification using advanced algorithm
                let finalMatchReasons = match.match_reasons || 'התאמה אוטומטית';
                
                try {
                  const justificationResponse = await base44.asServiceRole.functions.invoke('generateMatchJustification', {
                    match_id: 'temp',
                    candidate_id: candidate.id,
                    job_id: job.id,
                    agent_type: 'lior'
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
                  user_name: 'ליאור (סוכן AI)',
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
                await base44.asServiceRole.entities.Candidate.update(candidate.id, {
                  status: 'המלצה אוטומטית',
                  status_number: 3
                });
                
                existingMatchKeys.add(matchKey);
                jobMatchesCreated++;
                totalMatchesCreated++;

                await base44.asServiceRole.entities.AgentRunStatus.update(runStatuses[0].id, {
                  focus_matches_found: jobMatchesCreated
                });
              }
            }
          }
        } catch (llmError) {
          await updateLog(`⚠️ שגיאת LLM: ${llmError.message}`);
          console.error(`LLM error for job ${job.title}:`, llmError);
          // Continue to next batch despite error
        }

        await delay(500);
        
        // Stop if we already have 3 matches for this job
        if (jobMatchesCreated >= 3) {
          break;
        }
      }

      // Update job processed date
      await base44.asServiceRole.entities.Job.update(job.id, {
        lior_processed_date: new Date().toISOString(),
        lior_priority: false
      });

      await updateLog(`✅ סיימתי "${job.title}" - ${jobMatchesCreated} התאמות`);
      await delay(1000);
    }

    await updateLog(`🎯 ליאור סיים! ${totalMatchesCreated} התאמות ב-${sortedJobs.length} משרות`);
    
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
        actor_name: 'lior',
        actor_image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=40&h=40&fit=crop&crop=face',
        action_type: 'match_created',
        action_description: `ליאור עבר על ${sortedJobs.length} משרות הנדסת מערכת ומצא ${totalMatchesCreated} התאמות`,
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
      const runStatuses = await base44Fallback.entities.AgentRunStatus.filter({ agent_name: 'lior' });
      if (runStatuses && runStatuses.length > 0) {
        await base44Fallback.entities.AgentRunStatus.update(runStatuses[0].id, {
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