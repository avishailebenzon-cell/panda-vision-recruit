import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Calculates candidate age from available data
 */
function calculateCandidateAge(candidate) {
  const currentYear = new Date().getFullYear();
  
  // Method 1: Use date_of_birth
  if (candidate.date_of_birth) {
    try {
      const birthDate = new Date(candidate.date_of_birth);
      const age = currentYear - birthDate.getFullYear();
      const currentDate = new Date();
      const birthdayThisYear = new Date(currentYear, birthDate.getMonth(), birthDate.getDate());
      const adjustedAge = currentDate < birthdayThisYear ? age - 1 : age;
      return { age: Math.max(0, adjustedAge), source: 'תאריך לידה', isEmpty: false };
    } catch (e) {
      console.log('Invalid date_of_birth');
    }
  }

  // Method 2: Use military_discharge_year
  if (candidate.military_discharge_year) {
    try {
      const dischargeYear = parseInt(candidate.military_discharge_year, 10);
      if (!isNaN(dischargeYear)) {
        const ageAtDischarge = 21;
        const yearsAgo = currentYear - dischargeYear;
        const age = ageAtDischarge + yearsAgo;
        return { age: Math.max(0, age), source: 'מועד סיום צבא', isEmpty: false };
      }
    } catch (e) {
      console.log('Invalid military_discharge_year');
    }
  }

  return { age: null, source: null, isEmpty: true };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only admins can run this
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('Starting enrichment of matches with age and scores...');

    // Fetch all matches
    const matches = await base44.asServiceRole.entities.Match.list('', 1000);
    console.log(`Found ${matches.length} matches to enrich`);

    // Fetch all candidates and jobs for reference
    const candidates = await base44.asServiceRole.entities.Candidate.list('', 1000);
    const jobs = await base44.asServiceRole.entities.Job.list('', 1000);

    console.log(`Loaded ${candidates.length} candidates and ${jobs.length} jobs`);

    // Debug: Check what data exists
    let candidatesWithBirthDate = 0;
    let candidatesWithMilitaryDischarge = 0;
    let jobsWithScoreData = 0;

    for (const c of candidates) {
      if (c.date_of_birth) candidatesWithBirthDate++;
      if (c.military_discharge_year) candidatesWithMilitaryDischarge++;
    }

    for (const j of jobs) {
      if (j.base_score_without_geo || j.base_score_with_geo) jobsWithScoreData++;
    }

    console.log(`Candidates with birth date: ${candidatesWithBirthDate}`);
    console.log(`Candidates with military discharge: ${candidatesWithMilitaryDischarge}`);
    console.log(`Jobs with score data: ${jobsWithScoreData}`);

    // Create lookup maps for faster access
    const candidateMap = {};
    const jobMap = {};
    
    for (const c of candidates) {
      candidateMap[c.id] = c;
    }
    
    for (const j of jobs) {
      jobMap[j.id] = j;
    }

    let updatedCount = 0;
    let errors = [];
    let ageFoundCount = 0;
    let scoresFoundCount = 0;

    for (const match of matches) {
      try {
        const candidate = candidateMap[match.candidate_id];
        const job = jobMap[match.job_id];

        if (!candidate) {
          continue;
        }

        let updateData = {};
        let hasChanges = false;

        // 1. Add age information to match_reasons
        const ageInfo = calculateCandidateAge(candidate);
        if (!ageInfo.isEmpty) {
          ageFoundCount++;
          let updatedReasons = match.match_reasons || '';
          
          // Add age info if not already there
          if (!updatedReasons.includes('גיל:')) {
            const ageMarker = `גיל: ${ageInfo.age} שנים`;
            updatedReasons = updatedReasons ? `${updatedReasons}\n${ageMarker}` : ageMarker;
            hasChanges = true;
          }
          
          // Add age warning if over 60
          if (ageInfo.age > 60 && !updatedReasons.includes('⚠️')) {
            updatedReasons += '\n⚠️ שים לב: המועמד בן/בת למעלה מ-60 שנים';
            hasChanges = true;
          }
          
          if (hasChanges) {
            updateData.match_reasons = updatedReasons;
          }
        }

        // 2. Add score information if job has it
        if (job && (job.base_score_without_geo || job.base_score_with_geo)) {
          scoresFoundCount++;
          let scoreInfo = '';
          
          if (job.base_score_without_geo) {
            scoreInfo += `ציון בסיס (ללא גיאוגרפיה): ${job.base_score_without_geo}`;
          }
          
          if (job.base_score_with_geo) {
            scoreInfo += (scoreInfo ? '\n' : '') + `ציון בסיס (עם גיאוגרפיה): ${job.base_score_with_geo}`;
          }
          
          if (scoreInfo) {
            let updatedReasons = updateData.match_reasons || match.match_reasons || '';
            
            // Add score info if not already there
            if (!updatedReasons.includes('ציון בסיס')) {
              updatedReasons = updatedReasons ? `${updatedReasons}\n${scoreInfo}` : scoreInfo;
              updateData.match_reasons = updatedReasons;
              hasChanges = true;
            }
          }
        }

        // Only update if there are changes
        if (hasChanges) {
          await base44.asServiceRole.entities.Match.update(match.id, updateData);
          updatedCount++;
        }

      } catch (error) {
        const errorMsg = `Error processing match ${match.id}: ${error.message}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    const result = {
      success: true,
      message: `Successfully enriched matches`,
      totalMatches: matches.length,
      totalCandidates: candidates.length,
      totalJobs: jobs.length,
      updatedMatches: updatedCount,
      candidatesWithAge: ageFoundCount,
      jobsWithScores: scoresFoundCount,
      debugInfo: {
        candidatesWithBirthDate,
        candidatesWithMilitaryDischarge,
        jobsWithScoreData
      },
      errors: errors
    };

    console.log(JSON.stringify(result));
    return Response.json(result);

  } catch (error) {
    console.error('Error in enrichMatchesWithAgeAndScores:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});