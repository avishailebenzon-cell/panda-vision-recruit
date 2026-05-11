import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const BATCH_SIZE = 5; // Process 5 candidates per batch to avoid timeout

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { candidate_ids, session_id } = await req.json();

    if (!candidate_ids || !Array.isArray(candidate_ids)) {
      return Response.json({ error: 'Missing or invalid candidate_ids array' }, { status: 400 });
    }

    const batchToProcess = candidate_ids.slice(0, BATCH_SIZE);
    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: []
    };

    for (const candidateId of batchToProcess) {
      try {
        // Call the single enhancement function
        const response = await base44.asServiceRole.functions.invoke('enhanceCandidateCv', {
          candidate_id: candidateId
        });

        if (response.data?.success) {
          results.succeeded++;
        } else {
          results.failed++;
          results.errors.push({
            candidate_id: candidateId,
            error: response.data?.error || 'Unknown error'
          });
        }
        results.processed++;

        // Update session log entry if exists
        if (session_id) {
          const logs = await base44.entities.CvEnhancementLog.filter({
            session_id: session_id,
            candidate_id: candidateId
          });
          if (logs.length > 0) {
            await base44.entities.CvEnhancementLog.update(logs[0].id, {
              session_id: session_id
            });
          }
        }

      } catch (candidateError) {
        results.failed++;
        results.processed++;
        results.errors.push({
          candidate_id: candidateId,
          error: candidateError.message
        });
      }

      // Small delay between candidates to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const hasMore = candidate_ids.length > BATCH_SIZE;
    const remaining = hasMore ? candidate_ids.length - BATCH_SIZE : 0;

    return Response.json({
      success: true,
      results: results,
      hasMore: hasMore,
      remaining: remaining,
      message: `עובדו ${results.processed} מועמדים: ${results.succeeded} הצליחו, ${results.failed} נכשלו`
    });

  } catch (error) {
    console.error('Error in enhanceCandidatesBatch:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});