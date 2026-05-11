import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    console.log('Starting cleanup of rejected matches v1.1...');

    // Calculate date 3 months ago
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const cutoffDate = threeMonthsAgo.toISOString();

    console.log(`Deleting rejected matches created before: ${cutoffDate}`);

    // Carmit's rejection decisions
    const rejectionTypes = [
      'skipped_pipedrive',
      'skipped_duplicate',
      'skipped_status',
      'skipped_deadline',
      'skipped_geo_rejected',
      'skipped_geo_needs_review'
    ];

    let totalDeleted = 0;
    const maxExecutionTime = 25000; // 25 seconds safety margin
    const startTime = Date.now();

    for (const rejectionType of rejectionTypes) {
      // Check time limit
      if (Date.now() - startTime > maxExecutionTime) {
        console.log('⚠️ Approaching time limit, stopping cleanup');
        break;
      }

      console.log(`Processing ${rejectionType}...`);
      
      const batchSize = 20; // Reduced for faster processing
      const maxBatches = 5; // Limit batches per type to avoid timeout
      let batchCount = 0;

      while (batchCount < maxBatches) {
        // Check time limit again
        if (Date.now() - startTime > maxExecutionTime) {
          console.log('⚠️ Time limit reached, stopping');
          break;
        }

        const batch = await base44.asServiceRole.entities.Match.filter(
          { 
            carmit_decision: rejectionType,
            created_date: { $lt: cutoffDate }
          },
          'created_date',
          batchSize
        );
 
        if (!batch || batch.length === 0) {
          break;
        }

        console.log(`Deleting ${batch.length} ${rejectionType} matches...`);

        for (const match of batch) {
          if (!match.id) continue;
          await base44.asServiceRole.entities.Match.delete(match.id);
          totalDeleted++;
        }

        batchCount++;

        if (batch.length < batchSize) {
          break;
        }

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`✓ Completed. Deleted ${totalDeleted} rejected matches`);

    return Response.json({
      status: 'ok',
      deleted: totalDeleted,
      cutoff_date: cutoffDate,
      rejection_types_cleaned: rejectionTypes
    });

  } catch (error) {
    console.error('Error cleaning rejected matches:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});