import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch(e) { /* unauthenticated */ }

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get all candidates that need Pipedrive sync:
    // either already synced (re-sync to update) or have pipedrive_person_id
    const allCandidates = await base44.asServiceRole.entities.Candidate.list();
    const toSync = allCandidates.filter(c => c.pipedrive_synced || c.pipedrive_person_id);

    console.log(`Found ${toSync.length} candidates to backfill to Pipedrive`);

    let succeeded = 0;
    let failed = 0;
    const errors = [];

    for (const candidate of toSync) {
      try {
        const result = await base44.functions.invoke('syncCandidateToPipedrive', {
          candidate_id: candidate.id
        });
        console.log(`Synced ${candidate.full_name || candidate.first_name}: ${JSON.stringify(result)}`);
        succeeded++;
      } catch (e) {
        console.error(`Failed to sync candidate ${candidate.id} (${candidate.full_name}): ${e.message}`);
        errors.push({ candidate_id: candidate.id, name: candidate.full_name, error: e.message });
        failed++;
      }
      // Rate limit protection
      await new Promise(r => setTimeout(r, 500));
    }

    return Response.json({
      success: true,
      total: toSync.length,
      succeeded,
      failed,
      errors: errors.slice(0, 20) // return up to 20 errors
    });

  } catch (error) {
    console.error('Backfill error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});