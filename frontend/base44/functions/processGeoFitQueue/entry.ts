import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Max items to process per run — prevents function timeout for large queues
const MAX_BATCH_SIZE = 20;

// Small delay between items to respect Nominatim rate limit (1 req/sec)
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all NEEDS_REVIEW results
    const needsReview = await base44.asServiceRole.entities.GeoFitResult.filter({
      geo_status: 'NEEDS_REVIEW'
    });

    if (needsReview.length === 0) {
      return Response.json({
        success: true,
        message: 'No items in NEEDS_REVIEW queue',
        processed: 0,
        total_in_queue: 0
      });
    }

    // Process only up to MAX_BATCH_SIZE items per run
    const batch = needsReview.slice(0, MAX_BATCH_SIZE);
    const remaining = needsReview.length - batch.length;

    const processed = [];
    const failed = [];

    for (const result of batch) {
      try {
        // Fetch candidate and job
        const [candidateArr, jobArr] = await Promise.all([
          base44.asServiceRole.entities.Candidate.filter({ id: result.candidate_id }),
          base44.asServiceRole.entities.Job.filter({ id: result.job_id })
        ]);

        // Delete orphaned records (entity was removed)
        if (candidateArr.length === 0 || jobArr.length === 0) {
          await base44.asServiceRole.entities.GeoFitResult.delete(result.id);
          processed.push({ id: result.id, action: 'deleted_orphaned' });
          continue;
        }

        const candidate = candidateArr[0];
        const job = jobArr[0];

        let normalizeAttempted = false;

        // Try normalizing candidate location if coordinates are missing
        if (!candidate.geo_latitude || !candidate.geo_longitude) {
          const locationText = candidate.city || candidate.location;
          if (locationText) {
            try {
              await base44.functions.invoke('normalizeLocation', {
                entity_type: 'Candidate',
                entity_id: candidate.id,
                location_text: locationText
              });
              normalizeAttempted = true;
              console.log(`Normalized candidate location: ${candidate.id} → "${locationText}"`);
            } catch (normErr) {
              console.log(`Failed to normalize candidate ${candidate.id} location:`, normErr.message);
            }
          }
        }

        // Try normalizing job location if coordinates are missing
        if (!job.geo_latitude || !job.geo_longitude) {
          const locationText = job.location || job.city;
          if (locationText) {
            // Small delay between Nominatim calls to respect rate limit
            if (normalizeAttempted) await sleep(1100);
            try {
              await base44.functions.invoke('normalizeLocation', {
                entity_type: 'Job',
                entity_id: job.id,
                location_text: locationText
              });
              console.log(`Normalized job location: ${job.id} → "${locationText}"`);
            } catch (normErr) {
              console.log(`Failed to normalize job ${job.id} location:`, normErr.message);
            }
          }
        }

        // Delete old NEEDS_REVIEW result so calculateGeoFit creates a fresh one
        try {
          await base44.asServiceRole.entities.GeoFitResult.delete(result.id);
        } catch (_) { /* already deleted by normalizeLocation cache invalidation */ }

        // Recalculate GeoFit
        const recalcResponse = await base44.functions.invoke('calculateGeoFit', {
          candidate_id: result.candidate_id,
          job_id: result.job_id
        });

        const newStatus = recalcResponse?.data?.result?.geo_status;
        if (recalcResponse?.data?.success && newStatus) {
          processed.push({
            id: result.id,
            new_status: newStatus,
            action: 'recalculated'
          });
        } else {
          failed.push({
            id: result.id,
            error: 'Recalculation returned no result',
            candidate_id: result.candidate_id,
            job_id: result.job_id
          });
        }

      } catch (error) {
        console.error(`Error processing GeoFitResult ${result.id}:`, error.message);
        failed.push({
          id: result.id,
          error: error.message
        });
      }

      // Brief pause between items to reduce load on external APIs
      await sleep(300);
    }

    return Response.json({
      success: true,
      total_in_queue: needsReview.length,
      processed_this_run: batch.length,
      remaining_in_queue: remaining,
      succeeded: processed.length,
      failed: failed.length,
      details: { processed, failed },
      ...(remaining > 0 ? { note: `Run again to process the remaining ${remaining} items` } : {})
    });

  } catch (error) {
    console.error('Process GeoFit queue error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
