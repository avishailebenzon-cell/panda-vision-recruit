import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    // Get all automatic recommendations (matches created by agents)
    const automaticMatches = await base44.asServiceRole.entities.Match.filter({
      is_automatic_recommendation: true
    });

    if (!automaticMatches || automaticMatches.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'לא נמצאו התאמות אוטומטיות',
        updated: 0 
      });
    }

    // Get unique candidate IDs from these matches
    const candidateIds = [...new Set(automaticMatches.map(m => m.candidate_id))];
    
    let updatedCount = 0;
    let skippedCount = 0;
    const errors = [];

    // Update each candidate's status to "המלצה אוטומטית"
    for (const candidateId of candidateIds) {
      try {
        // Get current candidate
        const candidates = await base44.asServiceRole.entities.Candidate.filter({ id: candidateId });
        
        if (candidates && candidates.length > 0) {
          const candidate = candidates[0];
          
          // Only update if candidate is in "מועמד" status (not already progressed)
          if (candidate.status === 'מועמד' || candidate.status_number === 1) {
            await base44.asServiceRole.entities.Candidate.update(candidateId, {
              status: 'המלצה אוטומטית',
              status_number: 3
            });
            updatedCount++;
          } else {
            skippedCount++;
          }
        }
      } catch (error) {
        errors.push(`${candidateId}: ${error.message}`);
        console.error(`Failed to update candidate ${candidateId}:`, error);
      }
    }

    return Response.json({ 
      success: true,
      totalMatches: automaticMatches.length,
      uniqueCandidates: candidateIds.length,
      updated: updatedCount,
      skipped: skippedCount,
      errors: errors.length > 0 ? errors : null
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});