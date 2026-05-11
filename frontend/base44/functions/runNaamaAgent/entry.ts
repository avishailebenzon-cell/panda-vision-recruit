import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch (e) { /* running as scheduled automation - no user */ }

    // Check if agent is enabled via toggle
    try {
      const toggles = await base44.asServiceRole.entities.AgentToggleConfig.filter({ agent_name: 'naama' });
      if (toggles.length > 0 && toggles[0].is_enabled === false) {
        console.log('⏸️ Naama is disabled via toggle - skipping run');
        return Response.json({ success: true, skipped: true, reason: 'Agent disabled via toggle' });
      }
    } catch (toggleErr) {
      console.log('Could not check toggle - assuming enabled:', toggleErr.message);
    }

    // Helper to update detailed log
    const updateLog = async (message) => {
      try {
        const statuses = await base44.asServiceRole.entities.AgentRunStatus.filter({ agent_name: 'naama' });
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
        match_score: { $lt: 50 },
        user_name: 'נעמה (סוכן AI)'
      });
      
      if (lowScoreMatches && lowScoreMatches.length > 0) {
        await updateLog(`מנקה ${lowScoreMatches.length} התאמות עם ציון נמוך (<50)`);
        for (const m of lowScoreMatches) {
          await base44.asServiceRole.entities.Match.delete(m.id);
        }
      }
    } catch (cleanupErr) {
      console.error('Error cleaning up:', cleanupErr);
    }

    // Update run status to running
    const runStatuses = await base44.asServiceRole.entities.AgentRunStatus.filter({ agent_name: 'naama' });
    const startData = {
      agent_name: 'naama',
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

    // Get ONLY jobs assigned to Naama by Carmit
    await updateLog('טוענת משרות שכרמית הקצתה לי...');
    
    let allJobs = await base44.asServiceRole.entities.Job.list('-created_date', 500);
    if (!Array.isArray(allJobs)) {
      if (typeof allJobs === 'string') {
        try { allJobs = JSON.parse(allJobs); } catch { allJobs = []; }
      } else { allJobs = []; }
    }
    
    // Filter ONLY jobs that Carmit assigned to Naama
    const activeJobs = allJobs.filter(j => {
      if (j.status !== 'פעילה') return false;
      return j.assigned_agent === 'naama';
    });

    // Priority order:
    // 1. Jobs with naama_priority flag (what Carmit explicitly assigned)
    // 2. Within each group - sort by recruitment_priority (1 > 2 > 3 > 4)
    // 3. Then by last processed date (oldest first)
    
    const priorityJobsExplicit = activeJobs.filter(j => j.naama_priority === true);
    const regularJobs = activeJobs.filter(j => j.naama_priority !== true);
    
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
        
        const aDate = a.naama_processed_date ? new Date(a.naama_processed_date).getTime() : 0;
        const bDate = b.naama_processed_date ? new Date(b.naama_processed_date).getTime() : 0;
        return aDate - bDate; // Oldest first
      });
    };
    
    const sortedPriorityJobs = sortJobsByPriority(priorityJobsExplicit);
    const sortedRegularJobs = sortJobsByPriority(regularJobs);
    
    const sortedJobs = [...sortedPriorityJobs, ...sortedRegularJobs];

    if (sortedJobs.length === 0) {
      await updateLog('❌ לא נמצאו משרות תוכנה');
      await base44.entities.AgentRunStatus.update(runStatuses[0].id, {
        is_running: false,
        last_run_end: new Date().toISOString(),
        matches_created: 0
      });
      return Response.json({ success: true, matchesCreated: 0, message: 'אין משרות תוכנה' });
    }

    await updateLog(`✅ ${sortedJobs.length} משרות תוכנה לעיבוד (${priorityJobsExplicit.length} בעדיפות)`);

    // COST OPTIMIZATION: Load candidates using search_index_text filter to get only relevant ones
    // Instead of loading all 5000+ candidates, load only those with indexed data (max 500)
    await updateLog('טוענת מועמדים רלוונטיים...');
    let allCandidates = [];
    
    try {
      // Load candidates who have been indexed and are available
      const batch1 = await base44.asServiceRole.entities.Candidate.filter({
        status: { $nin: ['לא מתאים - נסגר', 'מועסק - פעיל'] }
      }, '-updated_date', 500);
      allCandidates = Array.isArray(batch1) ? batch1 : [];
      await updateLog(`✓ טען ${allCandidates.length} מועמדים`);
    } catch (err) {
      await updateLog(`✗ שגיאה בטעינת מועמדים: ${err.message}`);
    }
    
    // Exclude unavailable statuses
    const availableCandidates = allCandidates.filter(c => 
      c.status !== 'לא מתאים - נסגר' && 
      c.status !== 'מועסק - פעיל'
    );
    
    await updateLog(`✅ ${availableCandidates.length} מועמדים זמינים מתוך ${allCandidates.length}`);



    // Ensure it's an array before proceeding
    if (!Array.isArray(availableCandidates)) {
      await updateLog('ERROR: availableCandidates is not an array!');
      availableCandidates = [];
    }

    if (availableCandidates.length === 0) {
      await updateLog('❌ אין מועמדים זמינים');
      await base44.entities.AgentRunStatus.update(runStatuses[0].id, {
        is_running: false,
        last_run_end: new Date().toISOString(),
        matches_created: 0
      });
      return Response.json({ success: true, matchesCreated: 0, message: 'אין מועמדים' });
    }

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

      await updateLog(`📌 משרה ${jobIndex + 1}/${sortedJobs.length}: ${job.title}`);

      await base44.asServiceRole.entities.AgentRunStatus.update(runStatuses[0].id, {
        focused_job_id: job.id,
        focused_job_title: job.title,
        focus_start_time: new Date().toISOString(),
        focus_matches_found: 0
      });

      let jobExistingMatches = await base44.asServiceRole.entities.Match.filter({ 
        job_id: job.id,
        user_name: 'נעמה (סוכן AI)',
        match_score: { $gte: 50 }
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

      await updateLog(`📋 ${candidatesToProcess.length} מועמדים חדשים (${jobExistingMatches.length} כבר נבדקו)`);

      if (candidatesToProcess.length === 0) {
        await updateLog(`✅ כל המועמדים נבדקו`);
        continue;
      }

      await updateLog(`🔄 מתחילה לעבור על ${candidatesToProcess.length} מועמדים...`);

      let jobMatchesCreated = 0;

      // COST OPTIMIZATION: Process in batches of 20 (fewer LLM tokens per call), max 100 per job
      const maxCandidatesPerJob = 100;
      const limitedCandidates = candidatesToProcess.slice(0, maxCandidatesPerJob);
      if (candidatesToProcess.length > maxCandidatesPerJob) {
        await updateLog(`⚡ מגביל ל-${maxCandidatesPerJob} מועמדים (מתוך ${candidatesToProcess.length}) לחיסכון בעלויות`);
      }
      
      for (let batchStart = 0; batchStart < limitedCandidates.length; batchStart += 20) {
        const batchEnd = Math.min(batchStart + 20, limitedCandidates.length);
        const candidatesBatch = limitedCandidates.slice(batchStart, batchEnd);

        await updateLog(`📦 חבילה ${Math.floor(batchStart / 30) + 1}: מועמדים ${batchStart + 1}-${batchEnd}`);

        const candidatesList = candidatesBatch.map((c, i) => 
          `${i + 1}. ${c.first_name || ''} ${c.last_name || ''}\n   סיווג: ${c.security_clearance || 'לא צוין'}\n   עיר: ${c.city || 'לא צוין'}\n   ניסיון: ${c.main_experience || 'לא צוין'}\n   השכלה: ${c.education || 'לא צוין'}\n   כישורים: ${c.skills_summary || 'לא צוין'}\n   שפות: ${c.languages || 'לא צוין'}\n   כלים: ${c.main_tech_tools || 'לא צוין'}`
        ).join('\n\n');

        const isPriorityJob = job.naama_priority === true;
        const priorityNote = isPriorityJob ? '\n🔴 משרה בעדיפות גבוהה!' : '';

        // Load feedback context for this agent
        let agentFeedbackText = '';
        try {
          const feedbackResp = await base44.asServiceRole.functions.invoke('getAgentFeedbackContext', { agent_name: 'naama' });
          agentFeedbackText = feedbackResp?.data?.feedbackText || '';
        } catch (e) { /* ignore */ }

        const prompt = `את נעמה, סוכנת גיוס כ"א (Recruiter Agent) של חברת פנדה-טק. תפקידך להיות סוכנת מומחית בתחום התוכנה ובתחום ה-Data/Analytics. דברי תמיד בלשון נקבה.

⛔ PRE-FILTER (לפני כל ניתוח - אם מתקיים אחד מאלה → אל תחזירי את המועמד בכלל):
- ⛔ עובד כרגע בלקוח פנדה-טק: אם job_1_company (התפקיד הנוכחי בלבד) מכיל: תעשייה אווירית / IAI / רפאל / Rafael / אלתא / Elta → אל תחזירי בכלל. שימי לב: רק תפקיד נוכחי - אם עבד בעבר אצל הלקוחות האלו זה מותר
- ⛔ תחום לא רלוונטי: אם main_discipline הוא אדריכלות/בנייה/עיצוב פנים/אינסטלציה/סולארי/אזרחית ואין ניסיון תוכנה/Data תעשייתי מוכח → אל תחזירי בכלל
- ⛔ HARD GATE - ניסיון אקדמי בלבד: אם אין אף תפקיד תעשייתי ממשי (Engineer/Developer/Analyst בחברה) → אל תחזירי בכלל
- ⛔ HARD GATE - בוגרת טרייה: אם years_experience ≤ 1 והמשרה דורשת "X שנות ניסיון" (X>1) → אל תחזירי בכלל

========================
⚠️ שלב 0 קריטי: זיהוי תחום המשרה
========================
לפני הכל - זהי מהי המשרה:

**Data/Analytics** - אם המשרה מכילה: אנליסט נתונים/דיגיטל/מידע, Data Analyst, BI, Business Intelligence, Data Engineer, Data Architect, ETL, Data Pipeline, האחדת מקורות נתונים, Power BI, Tableau, Google Analytics, Adobe Analytics, SQL כמיומנות ראשית, Big Data, Spark, Data Warehouse, דוחות/KPI/Dashboards, Marketing Analytics.

**תוכנה** - אם המשרה מכילה: Embedded, Backend, Frontend, QA, DevOps, ATE, Firmware, Real-Time, Full-Stack.

**כלל קריטי:** אם המשרה היא Data/Analytics → חפשי מועמדי Data בלבד (Data Analyst, Data Engineer, BI Developer, אנליסט מידע, ארכיטקט מידע). מפתחי תוכנה (Backend/Embedded/QA) ללא ניסיון Data מוכח = לא מתאים (ציון 50-65 בלבד).

========================
כללים לא סחירים:
========================
1) תוכנה + Data/Analytics - שני התחומים בתחום אחריותך
2) לא ממציאה נתונים - אם אין הוכחה בקו"ח → "לא מוכח" = חסר
3) Hard Gates - אם דרישת מינימום לא מתקיימת → match_score ≤69 + ציין מה נכשל
4) Core Skills - הגדירי 3-6 כישורי ליבה. "לא מוכח" = חסר
5) כלל מחמיר: חסרים 2 כישורי ליבה → max 75 וברירת מחדל <70 (לא להצגה). חובה לציין אילו חסרים
6) חסר 1 כישור ליבה → max 85
7) ציון 90+ נדיר - רק אם התאמה מלאה של כל סעיפי הבדיקה (0 חוסרים בכל הקטגוריות)
8) סף הצגה: 50+ בלבד
9) מרחק גיאוגרפי - אל תפסלי אוטומטית, המערכת תטפל בכך
10) כל התפקידים hands-on. מועמדים ניהוליים בעיקרם → הורידי משמעותית
11) ⛔ ניסיון תעשייתי: ספרי רק Engineer/Developer/Analyst בחברות. אל תספרי: שירות צבאי, פרויקטים אקדמיים

פרטי המשרה:
כותרת: ${job.title}${priorityNote}
מיקום: ${job.location || 'לא צוין'}
תיאור: ${job.description || 'לא צוין'}
דרישות: ${job.requirements || 'לא צוין'}
${job.dana_supplement ? 'הגדרות נוספות: ' + job.dana_supplement : ''}
סיווג בטחוני נדרש: ${job.security_clearance || 'לא צוין'}
ציון בסיס ללא גיאו: ${job.base_score_without_geo || 'לא מוגדר'}
ציון בסיס עם גיאו: ${job.base_score_with_geo || 'לא מוגדר'}

רשימת מועמדים לבדיקה:
${candidatesList}

עקרון ראיות: כל טכנולוגיה/כישור נחשבים "קיימים" רק עם ניסיון מוכח בתפקיד/פרויקט. לא נחשב: רשימת skills בלבד, אזכור יחיד, "היכרות עם".

קו"ח ישנים (>3 שנים): אם source_email_date או created_date מעל 3 שנים → הורידי 10-15 נקודות + הוסיפי "⚠️ קורות חיים מ-[שנה]".
${agentFeedbackText}

הוראות פלט:
1. נתחי את המשרה - זהי: Hard Gates (תנאי סף), Core Skills (3-6), Secondary Skills, קלסטר תוכנה
2. בדקי כל מועמד: Hard Gates מתקיימים? Core Skills מוכחים? טכנולוגיות ספציפיות מוכחות?
3. החזירי רק ציון 50+ (אחרי תקרות)
4. לכל התאמה ספקי detailed_analysis מלא: requirement, candidate_qualification, is_match
5. ב-match_reasons (בלשון נקבה): Hard Gates, Core Skills (מוכח/חלש/חסר + איפה), טכנולוגיות, קלסטר, ניסיון, פערים, קו"ח ישנים

החזירי עד 5 מועמדים הטובים ביותר.`;

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
          const highScoreMatches = matches.filter(m => (m.match_score || 0) >= 50);

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
                  await updateLog(`⚠️ GeoFit failed for ${candidate.first_name}: ${geoErr.message}`);
                  continue; // Skip this match
                }

                // Gate decision: REJECTED → block match, allow NEEDS_REVIEW and UNKNOWN_ALLOWED
                if (geoFitResult.geo_status === 'REJECTED') {
                  await updateLog(`🚫 ${candidate.first_name} - נדחה גיאוגרפית (מרחק גדול מדי)`);
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

                // Use match reasons from LLM analysis (already detailed)
                const finalMatchReasons = (match.match_reasons || 'התאמה אוטומטית') + geoDisplayText;

                const candidateFullName = `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim();

                await base44.asServiceRole.entities.Match.create({
                  job_id: job.id,
                  job_title: job.title,
                  candidate_id: candidate.id,
                  candidate_name: candidateFullName,
                  user_id: user?.id || 'system',
                  user_name: 'נעמה (סוכן AI)',
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
          await updateLog(`⚠️ שגיאת AI: ${llmError.message}`);
          console.error('LLM error:', llmError.message);
        }

        await delay(3000);
      }

      // Update job processed date
      await base44.asServiceRole.entities.Job.update(job.id, {
        naama_processed_date: new Date().toISOString(),
        naama_priority: false
      });

      await updateLog(`✅ סיימתי "${job.title}" - ${jobMatchesCreated} התאמות`);
      await delay(5000);
    }

    // Final status
    await updateLog(`🎯 נעמה סיימה! ${totalMatchesCreated} התאמות ב-${sortedJobs.length} משרות`);
    
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
        actor_name: 'naama',
        actor_image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=40&h=40&fit=crop&crop=face',
        action_type: 'match_created',
        action_description: `נעמה עברה על ${sortedJobs.length} משרות תוכנה ומצאה ${totalMatchesCreated} התאמות`,
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
      const runStatuses = await base44Fallback.asServiceRole.entities.AgentRunStatus.filter({ agent_name: 'naama' });
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