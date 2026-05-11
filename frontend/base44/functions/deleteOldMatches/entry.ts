import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    console.log('Starting deletion of old matches...');

    // Calculate date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString();

    console.log(`Deleting all matches created before: ${cutoffDate}`);

    // Get matches older than 30 days in batches
    let totalDeleted = 0;
    let hasMore = true;
    const batchSize = 100;

    while (hasMore) {
      const batch = await base44.asServiceRole.entities.Match.filter(
        { created_date: { $lt: cutoffDate } },
        'created_date',
        batchSize
      );

      if (!batch || batch.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`Deleting batch of ${batch.length} matches...`);

      // Delete each match
      for (const match of batch) {
        if (!match.id) continue;
        
        await base44.asServiceRole.entities.Match.delete(match.id);
        totalDeleted++;

        // Delay to avoid rate limiting
        if (totalDeleted % 20 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`Deleted ${totalDeleted} matches so far...`);

      if (batch.length < batchSize) {
        hasMore = false;
      }

      // Safety pause between batches
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`✓ Completed. Deleted ${totalDeleted} old matches`);

    return Response.json({
      status: 'ok',
      deleted: totalDeleted,
      cutoff_date: cutoffDate
    });

  } catch (error) {
    console.error('Error deleting old matches:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});