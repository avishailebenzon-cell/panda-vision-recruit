import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    const { agent_name } = await req.json();

    if (!agent_name) {
      return Response.json({ error: 'agent_name is required' }, { status: 400 });
    }

    const agentDisplayNames = {
      'naama': 'נעמה (סוכן AI)',
      'alik': 'אליק (סוכן AI)',
      'itay': 'איתי (סוכן AI)',
      'lior': 'ליאור (סוכן AI)',
      'ofir': 'אופיר (סוכן AI)',
      'gc': 'GC (סוכן AI)',
      'rami': 'רמי (סוכן AI)'
    };

    const userDisplayName = agentDisplayNames[agent_name];
    if (!userDisplayName) {
      return Response.json({ error: 'Invalid agent name' }, { status: 400 });
    }

    console.log(`🔄 Starting continuous revalidation for ${agent_name} (${userDisplayName})...`);

    // Get all jobs and candidates for context (load once)
    const [allJobs, allCandidates] = await Promise.all([
      base44.asServiceRole.entities.Job.list(),
      base44.asServiceRole.entities.Candidate.list()
    ]);

    const jobsMap = new Map(allJobs.map(j => [j.id, j]));
    const candidatesMap = new Map(allCandidates.map(c => [c.id, c]));

    let totalProcessed = 0;
    let totalUpdated = 0;
    let totalDeleted = 0;
    let batchNumber = 0;
    const batchSize = 10;

    // Continuous loop - keep processing until no matches left
    while (true) {
      batchNumber++;
      console.log(`📦 Batch #${batchNumber} - fetching next ${batchSize} matches...`);

      // Get next batch of matches (always get first 10)
      const matches = await base44.asServiceRole.entities.Match.filter(
        { user_name: userDisplayName },
        '-created_date',
        batchSize
      );

      if (matches.length === 0) {
        console.log('✅ No more matches to process - done!');
        break;
      }

      console.log(`Processing ${matches.length} matches in batch #${batchNumber}`);

      // Process each match in this batch
      for (const match of matches) {
        try {
          totalProcessed++;

          const job = jobsMap.get(match.job_id);
          const candidate = candidatesMap.get(match.candidate_id);

          if (!job || !candidate) {
            await base44.asServiceRole.entities.Match.delete(match.id);
            totalDeleted++;
            console.log(`  ❌ Deleted match ${totalProcessed} - job/candidate not found`);
            continue;
          }

          if (candidate.status === "לא רלוונטי יותר" || job.status !== 'פעילה') {
            await base44.asServiceRole.entities.Match.delete(match.id);
            totalDeleted++;
            console.log(`  ❌ Deleted match ${totalProcessed} - candidate/job not active`);
            continue;
          }

          // Generate deep justification using advanced algorithm
          let newJustification = null;
          let shouldKeep = true;

          try {
            const justificationResponse = await base44.asServiceRole.functions.invoke('generateMatchJustification', {
              match_id: match.id,
              candidate_id: candidate.id,
              job_id: job.id,
              agent_type: agent_name
            });
            
            if (justificationResponse?.data?.justification) {
              newJustification = justificationResponse.data.justification;
              
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
            console.error(`  ⚠️ Justification failed for match ${totalProcessed}:`, justErr.message);
            shouldKeep = true;
          }

          // Level 1 Security Gate
          if (job.security_clearance === 'רמה 1' && candidate.security_clearance !== 'רמה 1') {
            shouldKeep = false;
          }

          if (!shouldKeep) {
            await base44.asServiceRole.entities.Match.delete(match.id);
            totalDeleted++;
            console.log(`  ❌ Deleted match ${totalProcessed} - not suitable`);
          } else if (newJustification && newJustification !== match.match_reasons) {
            await base44.asServiceRole.entities.Match.update(match.id, {
              match_reasons: newJustification
            });
            totalUpdated++;
            console.log(`  ✅ Updated match ${totalProcessed}`);
          } else {
            console.log(`  ⏭️ Skipped match ${totalProcessed} - no change needed`);
          }

          // Small delay between matches
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          console.error(`  ⚠️ Error processing match ${totalProcessed}:`, error.message);
        }
      }

      console.log(`Batch #${batchNumber} complete - Total so far: processed=${totalProcessed}, updated=${totalUpdated}, deleted=${totalDeleted}`);

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Log activity
    await base44.asServiceRole.entities.SystemActivityLog.create({
      actor_type: 'system',
      actor_name: `revalidate_${agent_name}`,
      action_type: 'matches_revalidated',
      action_description: `בדיקה מחדש של כל ההתאמות של ${userDisplayName}: ${totalProcessed} נבדקו, ${totalUpdated} עודכנו, ${totalDeleted} נמחקו`,
      status: 'success'
    });

    console.log(`✨ Revalidation complete! Processed: ${totalProcessed}, Updated: ${totalUpdated}, Deleted: ${totalDeleted}`);

    return Response.json({
      success: true,
      message: `בדיקה מחדש הושלמה: ${totalProcessed} התאמות נבדקו`,
      processed: totalProcessed,
      updated: totalUpdated,
      deleted: totalDeleted,
      batches: batchNumber
    });

  } catch (error) {
    console.error('❌ Error in revalidateAllAgentMatches:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});