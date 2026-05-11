import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// חברות להדרה - מועמד שעובד/עבד שם לא ישובץ למשרה של אותה חברה
const EXCLUSION_COMPANIES = [
  'רפאל', 'rafael', 'תע"א', "תע'א", 'תעשייה אווירית', 'תעשיה אווירית',
  'israel aerospace', 'iai', 'אלתא', 'elta', 'תע״א'
];

// סף ציון מינימלי ליצירת התאמה
const MIN_MATCH_SCORE = 60;
// מספר מועמדים לעיבוד בכל ריצה
const BATCH_SIZE = 8;

function normalizeCompanyName(name) {
  if (!name) return '';
  return name.toLowerCase().trim()
    .replace(/['"״׳]/g, '')
    .replace(/\s+/g, ' ');
}

function isExcludedCompany(candidateCompany, jobClientName) {
  if (!candidateCompany || !jobClientName) return false;
  
  const normCandidate = normalizeCompanyName(candidateCompany);
  const normJob = normalizeCompanyName(jobClientName);
  
  // בדיקה ישירה
  if (normCandidate.includes(normJob) || normJob.includes(normCandidate)) {
    if (normJob.length > 2 && normCandidate.length > 2) return true;
  }
  
  // בדיקה מול רשימת החברות להדרה
  const normalizedExclusions = EXCLUSION_COMPANIES.map(normalizeCompanyName);
  const isExcludedClient = normalizedExclusions.some(ex => 
    normJob.includes(ex) || ex.includes(normJob)
  );
  const isExcludedCandidate = normalizedExclusions.some(ex => 
    normCandidate.includes(ex) || ex.includes(normCandidate)
  );
  
  return isExcludedClient && isExcludedCandidate;
}

function getCandidateCompanies(candidate) {
  const companies = [];
  for (let i = 1; i <= 5; i++) {
    const company = candidate[`job_${i}_company`];
    if (company) companies.push(company);
  }
  return companies;
}

function checkCandidateExclusion(candidate, job) {
  const companies = getCandidateCompanies(candidate);
  for (const company of companies) {
    if (isExcludedCompany(company, job.client_name)) {
      return { excluded: true, reason: `מועמד עבד ב-${company} - לא ניתן להתאים למשרה של ${job.client_name}` };
    }
  }
  return { excluded: false };
}

function checkSecurityClearance(candidateClearance, jobClearance) {
  const clearanceLevels = {
    'ללא סיווג': 0,
    'לא רלוונטי': 0,
    'לא יודע/ת': 0,
    'סיווג נמוך': 1,
    'שמור': 2,
    'רמה 1': 3,
    'ס"מ - רמה 1': 3,
    'רמה 2': 4,
    'רמה 3': 5,
    'סודי': 5,
    'סודי ביותר': 6
  };
  
  const candidateLevel = clearanceLevels[candidateClearance] ?? 0;
  const jobLevel = clearanceLevels[jobClearance] ?? 0;
  
  if (jobLevel === 0) return { ok: true, penalty: 0 };
  if (candidateLevel === 0) return { ok: true, penalty: 15 }; // לא ידוע
  if (candidateLevel >= jobLevel) return { ok: true, penalty: 0 };
  if (candidateLevel === jobLevel - 1) return { ok: true, penalty: 20 };
  return { ok: false, reason: `סיווג לא מתאים: מועמד - ${candidateClearance}, משרה דורשת ${jobClearance}` };
}

function calculateGeoDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function analyzeMatchWithAI(base44, candidate, job) {
  const candidateText = candidate.skills_summary || candidate.full_text || 
    `${candidate.main_experience || ''} ${candidate.main_tech_tools || ''} ${candidate.main_programming_languages || ''}`.trim();
  
  if (!candidateText || candidateText.length < 20) {
    return { score: 0, reasons: 'אין מספיק מידע על המועמד', detailed: null };
  }

  const jobText = `${job.title}\n${job.description || ''}\n${job.requirements || ''}`;

  const prompt = `אתה מומחה גיוס טכנולוגי מהמגזר הביטחוני בישראל.
  
משרה:
כותרת: ${job.title}
תיאור: ${jobText.substring(0, 800)}
סיווג ביטחוני נדרש: ${job.security_clearance || 'לא צוין'}
מיקום: ${job.location || 'לא צוין'}

מועמד:
${candidateText.substring(0, 1000)}
סיווג ביטחוני: ${candidate.security_clearance || 'לא ידוע'}
עיר מגורים: ${candidate.city || 'לא ידועה'}

הערך את ההתאמה בין המועמד למשרה. התמקד בכישורים, ניסיון רלוונטי לתעשיות ביטחוניות, טכנולוגיה, והתאמה לדרישות. 
החזר JSON בלבד:
{
  "score": <מספר 0-100>,
  "reasons": "<2-3 משפטים בעברית על ההתאמה>",
  "strengths": ["<חוזק 1>", "<חוזק 2>"],
  "gaps": ["<פער 1>"]
}`;

  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: "object",
      properties: {
        score: { type: "number" },
        reasons: { type: "string" },
        strengths: { type: "array", items: { type: "string" } },
        gaps: { type: "array", items: { type: "string" } }
      }
    }
  });

  return {
    score: result.score || 0,
    reasons: result.reasons || '',
    detailed: JSON.stringify({ strengths: result.strengths || [], gaps: result.gaps || [] })
  };
}

async function processCandidate(base44, candidate, jobs, existingMatchCandidateJobPairs) {
  let matchesCreated = 0;
  let skipped = 0;

  for (const job of jobs) {
    const pairKey = `${candidate.id}_${job.id}`;
    if (existingMatchCandidateJobPairs.has(pairKey)) continue;

    // בדיקת הדרה - חברה זהה
    const exclusionCheck = checkCandidateExclusion(candidate, job);
    if (exclusionCheck.excluded) {
      skipped++;
      continue;
    }

    // בדיקת סיווג ביטחוני
    const clearanceCheck = checkSecurityClearance(candidate.security_clearance, job.security_clearance);
    if (!clearanceCheck.ok) {
      skipped++;
      continue;
    }

    // בדיקת מרחק גיאוגרפי
    let geoPenalty = 0;
    const distance = calculateGeoDistance(
      candidate.geo_latitude, candidate.geo_longitude,
      job.geo_latitude, job.geo_longitude
    );
    const threshold = job.geo_threshold_km || 70;
    if (distance !== null) {
      if (distance > threshold * 1.5) {
        skipped++;
        continue; // רחוק מדי
      } else if (distance > threshold) {
        geoPenalty = 15;
      }
    }

    // ניתוח AI
    const aiResult = await analyzeMatchWithAI(base44, candidate, job);
    let finalScore = aiResult.score - clearanceCheck.penalty - geoPenalty;
    finalScore = Math.max(0, Math.min(100, finalScore));

    if (finalScore >= MIN_MATCH_SCORE) {
      const matchNumber = `M-ATG-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
      await base44.asServiceRole.entities.Match.create({
        match_number: matchNumber,
        job_id: job.id,
        job_title: job.title,
        candidate_id: candidate.id,
        candidate_name: candidate.full_name,
        user_id: 'etgar_agent',
        user_name: 'אתגר (סוכן AI)',
        user_app_role: 'etgar',
        match_score: finalScore,
        match_reasons: aiResult.reasons,
        detailed_analysis: aiResult.detailed,
        is_automatic_recommendation: true,
        deadline: job.deadline || null
      });
      matchesCreated++;
      existingMatchCandidateJobPairs.add(pairKey);
    }
  }

  return { matchesCreated, skipped };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // יצירת לוג ריצה
  const runLog = await base44.asServiceRole.entities.EtgarRunLog.create({
    start_time: new Date().toISOString(),
    status: 'Running',
    batch_size: BATCH_SIZE
  });

  let candidatesScanned = 0;
  let jobsScanned = 0;
  let matchesCreated = 0;
  let candidatesSkipped = 0;
  let errorsCount = 0;

  try {
    // קבלת כל רשומות ChafshanResult שטרם עובדו
    const allChafshanResults = await base44.asServiceRole.entities.ChafshanResult.list('-created_date', 200);
    const pendingResults = allChafshanResults.filter(r => 
      !r.etgar_status || r.etgar_status === 'pending'
    );

    // קבלת ID ייחודיים של מועמדים
    const uniqueCandidateIds = [...new Set(pendingResults.map(r => r.candidate_id))];
    const batchIds = uniqueCandidateIds.slice(0, BATCH_SIZE);

    if (batchIds.length === 0) {
      await base44.asServiceRole.entities.EtgarRunLog.update(runLog.id, {
        end_time: new Date().toISOString(),
        status: 'Completed',
        candidates_scanned: 0,
        summary: 'אין מועמדים חדשים לעיבוד'
      });
      return Response.json({ success: true, message: 'אין מועמדים חדשים', matchesCreated: 0 });
    }

    // קבלת משרות פתוחות
    const allJobs = await base44.asServiceRole.entities.Job.filter({ status: 'פעילה' });
    const activeJobs = allJobs.filter(j => !j.do_not_publish);
    jobsScanned = activeJobs.length;

    // קבלת התאמות קיימות כדי למנוע כפילויות
    const existingMatches = await base44.asServiceRole.entities.Match.list('-created_date', 500);
    const existingPairs = new Set(existingMatches.map(m => `${m.candidate_id}_${m.job_id}`));

    // עיבוד כל מועמד
    for (const candidateId of batchIds) {
      try {
        const candidateList = await base44.asServiceRole.entities.Candidate.filter({ id: candidateId });
        if (!candidateList || candidateList.length === 0) {
          // עדכון ChafshanResult
          const chafshanRecs = pendingResults.filter(r => r.candidate_id === candidateId);
          for (const rec of chafshanRecs) {
            await base44.asServiceRole.entities.ChafshanResult.update(rec.id, {
              etgar_status: 'skipped',
              etgar_processed_date: new Date().toISOString()
            });
          }
          continue;
        }

        const candidate = candidateList[0];
        candidatesScanned++;

        const result = await processCandidate(base44, candidate, activeJobs, existingPairs);
        matchesCreated += result.matchesCreated;
        candidatesSkipped += result.skipped;

        // עדכון ChafshanResult
        const chafshanRecs = pendingResults.filter(r => r.candidate_id === candidateId);
        for (const rec of chafshanRecs) {
          await base44.asServiceRole.entities.ChafshanResult.update(rec.id, {
            etgar_status: 'completed',
            etgar_processed_date: new Date().toISOString(),
            etgar_matches_created: result.matchesCreated
          });
        }

      } catch (err) {
        errorsCount++;
        console.error(`Error processing candidate ${candidateId}:`, err.message);
        const chafshanRecs = pendingResults.filter(r => r.candidate_id === candidateId);
        for (const rec of chafshanRecs) {
          await base44.asServiceRole.entities.ChafshanResult.update(rec.id, {
            etgar_status: 'error',
            etgar_processed_date: new Date().toISOString()
          });
        }
      }
    }

    const summary = `עיבד ${candidatesScanned} מועמדים, ${jobsScanned} משרות, נוצרו ${matchesCreated} התאמות, ${candidatesSkipped} דולגו, ${errorsCount} שגיאות. נותרו ${uniqueCandidateIds.length - batchIds.length} מועמדים לריצה הבאה.`;

    await base44.asServiceRole.entities.EtgarRunLog.update(runLog.id, {
      end_time: new Date().toISOString(),
      status: 'Completed',
      candidates_scanned: candidatesScanned,
      jobs_scanned: jobsScanned,
      matches_created: matchesCreated,
      candidates_skipped: candidatesSkipped,
      errors_count: errorsCount,
      summary
    });

    return Response.json({
      success: true,
      candidatesScanned,
      jobsScanned,
      matchesCreated,
      candidatesSkipped,
      errorsCount,
      remaining: uniqueCandidateIds.length - batchIds.length,
      summary
    });

  } catch (error) {
    await base44.asServiceRole.entities.EtgarRunLog.update(runLog.id, {
      end_time: new Date().toISOString(),
      status: 'Failed',
      errors_count: errorsCount + 1,
      summary: `שגיאה כללית: ${error.message}`
    });
    return Response.json({ error: error.message }, { status: 500 });
  }
});