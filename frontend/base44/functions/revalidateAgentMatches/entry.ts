import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    const { agent_name, limit = 10 } = await req.json();

    if (!agent_name) {
      return Response.json({ error: 'agent_name is required' }, { status: 400 });
    }

    const agentDisplayNames = {
      'naama': 'נעמה (סוכן AI)',
      'alik': 'אליק (סוכן AI)',
      'itay': 'איתי (סוכן AI)',
      'lior': 'ליאור (סוכן AI)',
      'ofir': 'אופיר (סוכן AI)',
      'gc': 'GC (סוכן AI)'
    };

    const userDisplayName = agentDisplayNames[agent_name];
    if (!userDisplayName) {
      return Response.json({ error: 'Invalid agent name' }, { status: 400 });
    }

    // Get existing matches for this agent
    const existingMatches = await base44.asServiceRole.entities.Match.filter(
      { user_name: userDisplayName },
      '-created_date',
      limit
    );

    if (existingMatches.length === 0) {
      return Response.json({ 
        message: 'אין התאמות קיימות לבדיקה מחדש',
        processed: 0,
        updated: 0,
        deleted: 0
      });
    }

    const results = {
      processed: 0,
      updated: 0,
      deleted: 0,
      errors: []
    };

    // Get all jobs and candidates for context
    const [allJobs, allCandidates] = await Promise.all([
      base44.asServiceRole.entities.Job.list(),
      base44.asServiceRole.entities.Candidate.list()
    ]);

    const jobsMap = new Map(allJobs.map(j => [j.id, j]));
    const candidatesMap = new Map(allCandidates.map(c => [c.id, c]));

    for (const match of existingMatches) {
      try {
        results.processed++;

        const job = jobsMap.get(match.job_id);
        const candidate = candidatesMap.get(match.candidate_id);

        if (!job || !candidate) {
          // Delete match if job or candidate no longer exists
          await base44.asServiceRole.entities.Match.delete(match.id);
          results.deleted++;
          continue;
        }

        // Check if candidate is still relevant
        if (candidate.status === "לא רלוונטי יותר") {
          await base44.asServiceRole.entities.Match.delete(match.id);
          results.deleted++;
          continue;
        }

        // Check if job is still active
        if (job.status !== 'פעילה') {
          await base44.asServiceRole.entities.Match.delete(match.id);
          results.deleted++;
          continue;
        }

        // Re-evaluate using the advanced justification algorithm
        let newJustification = null;
        let shouldKeep = true;
        let newScore = match.match_score;

        try {
          const justificationResponse = await base44.asServiceRole.functions.invoke('generateMatchJustification', {
            match_id: match.id,
            candidate_id: candidate.id,
            job_id: job.id,
            agent_type: agent_name
          });
          
          if (justificationResponse?.data?.justification) {
            newJustification = justificationResponse.data.justification;
            
            // Check if justification indicates not suitable
            const notSuitableIndicators = [
              'לא מתאים',
              'אינו מתאים',
              'אינה מתאימה',
              'לא מומלץ',
              'אינו עומד',
              'לא עומד',
              'חוסר ב'
            ];
            
            shouldKeep = !notSuitableIndicators.some(indicator => 
              newJustification.toLowerCase().includes(indicator)
            );
          }
        } catch (justErr) {
          console.error('Error generating justification:', justErr);
          // Keep original if justification fails
          shouldKeep = true;
        }

        // Level 1 Security Gate
        if (job.security_clearance === 'רמה 1' && candidate.security_clearance !== 'רמה 1') {
          shouldKeep = false;
        }

        if (!shouldKeep || newScore < 70) {
          await base44.asServiceRole.entities.Match.delete(match.id);
          results.deleted++;
        } else if (newJustification && newJustification !== match.match_reasons) {
          await base44.asServiceRole.entities.Match.update(match.id, {
            match_reasons: newJustification
          });
          results.updated++;
        }

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Error processing match ${match.id}:`, error);
        results.errors.push({
          match_id: match.id,
          error: error.message
        });
      }
    }

    return Response.json({
      message: `בוצעה בדיקה מחדש של ${results.processed} התאמות`,
      ...results
    });

  } catch (error) {
    console.error('Error in revalidateAgentMatches:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});