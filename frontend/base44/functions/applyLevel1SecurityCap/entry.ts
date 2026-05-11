import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    // Get all matches
    const allMatches = await base44.asServiceRole.entities.Match.list('-created_date', 5000);
    
    if (!Array.isArray(allMatches) || allMatches.length === 0) {
      return Response.json({ 
        message: 'אין התאמות לעדכון',
        processed: 0,
        updated: 0
      });
    }

    // Get all jobs and candidates
    const [allJobs, allCandidates] = await Promise.all([
      base44.asServiceRole.entities.Job.list(),
      base44.asServiceRole.entities.Candidate.list()
    ]);

    const jobsMap = new Map(allJobs.map(j => [j.id, j]));
    const candidatesMap = new Map(allCandidates.map(c => [c.id, c]));

    let processed = 0;
    let updated = 0;
    const errors = [];

    for (const match of allMatches) {
      try {
        processed++;

        const job = jobsMap.get(match.job_id);
        const candidate = candidatesMap.get(match.candidate_id);

        if (!job || !candidate) {
          continue;
        }

        // Check if job requires Level 1 and candidate doesn't have it
        if (job.security_clearance === 'רמה 1' && candidate.security_clearance !== 'רמה 1') {
          if (match.match_score > 70) {
            // Cap the score at 70
            const updatedReasons = `⚠️ ציון מוגבל ל-70% - המשרה דורשת סיווג רמה 1 והמועמד אינו בעל סיווג רמה 1.\n\n${match.match_reasons || ''}`;
            
            await base44.asServiceRole.entities.Match.update(match.id, {
              match_score: 70,
              match_reasons: updatedReasons
            });
            
            updated++;
          }
        }

      } catch (error) {
        console.error(`Error processing match ${match.id}:`, error);
        errors.push({
          match_id: match.id,
          error: error.message
        });
      }
    }

    return Response.json({
      success: true,
      message: `עיבדתי ${processed} התאמות ועדכנתי ${updated} התאמות`,
      processed,
      updated,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error in applyLevel1SecurityCap:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});