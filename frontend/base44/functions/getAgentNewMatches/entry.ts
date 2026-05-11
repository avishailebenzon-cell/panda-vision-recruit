import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Support both user-triggered and scheduled/automated calls
    let user = null;
    try { user = await base44.auth.me(); } catch (e) { /* running as scheduled automation */ }

    const { agent_name } = await req.json();

    if (!agent_name) {
      return Response.json({ error: 'agent_name is required' }, { status: 400 });
    }

    // Map agent key to display name
    const agentDisplayNames = {
      'naama': 'נעמה (סוכן AI)',
      'roee': 'רועי (סוכן AI)',
      'alik': 'אליק (סוכן AI)',
      'itay': 'איתי (סוכן AI)',
      'lior': 'ליאור (סוכן AI)',
      'ofir': 'אופיר (סוכן AI)',
      'rami': 'רמי (סוכן AI)',
      'gc': 'GC (סוכן AI)',
      'etgar': 'אתגר (סוכן AI)'
    };

    const displayName = agentDisplayNames[agent_name];

    if (!displayName) {
      return Response.json({ error: 'Invalid agent name' }, { status: 400 });
    }

    console.log(`📞 ${displayName} מקבל שאילתה מכרמית להתאמות חדשות...`);

    // FIX 1: Fetch matches WITHOUT complex operators ($gte, $exists, $ne) that may not be
    // supported by the base44 SDK - filter client-side instead.
    // We fetch only matches for this agent sorted newest first.
    const allAgentMatches = await base44.asServiceRole.entities.Match.filter(
      {
        is_automatic_recommendation: true,
        user_name: displayName
      },
      '-created_date',
      200 // Fetch more to ensure quality matches are found after client-side filtering
    );

    // Client-side filter: only keep matches with score >= 80 AND valid job/candidate IDs
    const newMatches = allAgentMatches.filter(m =>
      m.match_score != null &&
      Number(m.match_score) >= 80 &&
      m.job_id &&
      m.job_id !== '' &&
      m.candidate_id &&
      m.candidate_id !== ''
    );

    console.log(`  ${displayName}: ${allAgentMatches.length} total → ${newMatches.length} with score 80%+`);

    // FIX 2: Load enough RotemTasks to cover all existing ones (was only 200, causing 152 to slip through)
    const allRotemTasks = await base44.asServiceRole.entities.RotemTask.list('-created_date', 1000);
    const rotemTaskKeys = new Set(allRotemTasks.map(t => `${t.job_id}_${t.candidate_id}`));

    const now = Date.now();

    // FIX 3: Properly block re-cycling of already-reviewed matches.
    // Previous code only blocked 3 specific decision types for 7 days; ALL others were re-shown
    // every single Carmit run, wasting the 50-match processing limit.
    const filteredMatches = newMatches.filter(m => {
      const matchKey = `${m.job_id}_${m.candidate_id}`;

      // If already has a Rotem task, definitely skip
      if (rotemTaskKeys.has(matchKey)) return false;

      // If Carmit previously reviewed this match, apply waiting periods by decision type
      if (m.carmit_reviewed_date) {
        const daysSinceReview = (now - new Date(m.carmit_reviewed_date).getTime()) / (1000 * 60 * 60 * 24);

        switch (m.carmit_decision) {
          case 'created_task':
            // Task was already created — rotemTaskKeys check above should catch this,
            // but if somehow missed, don't re-show
            return false;

          case 'skipped_low_score':
            // Score was 70-79% last time. Re-check only after 30 days
            // (candidate profile may have been enriched, or score recalculated)
            return daysSinceReview >= 30;

          case 'skipped_pipedrive':
          case 'skipped_status':
          case 'skipped_duplicate':
            // Rejected for Pipedrive/status reason or duplicate — retry after 7 days
            return daysSinceReview >= 7;

          case 'skipped_geo_rejected':
            // Geographic rejection — don't re-show until geo_status is manually corrected
            // (checking candidate geo won't change on its own in < 60 days)
            return daysSinceReview >= 60;

          case 'skipped_geo_needs_review':
            // Geo data needs review — check again after 14 days
            return daysSinceReview >= 14;

          case 'skipped_deadline':
            // Deadline passed — don't re-show (job deadline doesn't revert)
            return false;

          default:
            // Unknown decision — re-check after 7 days (conservative default)
            return daysSinceReview >= 7;
        }
      }

      // carmit_reviewed_date is null → genuinely new, always show
      return true;
    });

    console.log(`✅ ${displayName} מחזיר ${filteredMatches.length} התאמות לכרמית (מתוך ${newMatches.length} עם ציון 80%+)`);

    // If no filtered matches, return early
    if (filteredMatches.length === 0) {
      return Response.json({
        success: true,
        agent_name: agent_name,
        agent_display_name: displayName,
        matches_count: 0,
        matches: []
      });
    }

    // Get unique IDs only from FILTERED matches to reduce DB calls
    const candidateIds = [...new Set(filteredMatches.map(m => m.candidate_id).filter(Boolean))];
    const jobIds = [...new Set(filteredMatches.map(m => m.job_id).filter(Boolean))];

    // Fetch all needed candidates and jobs in bulk
    const candidates = candidateIds.length > 0
      ? await base44.asServiceRole.entities.Candidate.filter({ id: { $in: candidateIds } })
      : [];
    const jobs = jobIds.length > 0
      ? await base44.asServiceRole.entities.Job.filter({ id: { $in: jobIds } })
      : [];

    // Create lookup maps for efficient access
    const candidateMap = new Map(candidates.map(c => [c.id, c]));
    const jobMap = new Map(jobs.map(j => [j.id, j]));

    // Enrich FILTERED matches with candidate and job data
    const enrichedMatches = filteredMatches.map(match => ({
      match: match,
      candidate: candidateMap.get(match.candidate_id) || null,
      job: jobMap.get(match.job_id) || null
    }));

    return Response.json({
      success: true,
      agent_name: agent_name,
      agent_display_name: displayName,
      matches_count: enrichedMatches.length,
      matches: enrichedMatches
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});