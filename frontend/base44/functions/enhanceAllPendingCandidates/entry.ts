import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    console.log('=== Starting batch CV enhancement for pending candidates ===');

    // Find all candidates that haven't been enhanced yet
    const allCandidates = await base44.entities.Candidate.list('-created_date', 1000);
    const pendingCandidates = allCandidates.filter(c => 
      !c.cv_enhancement_version || c.cv_enhancement_version === 0
    );

    console.log(`Found ${pendingCandidates.length} candidates pending enhancement`);

    let successCount = 0;
    let failedCount = 0;
    const errors = [];

    // Process each candidate
    for (const candidate of pendingCandidates) {
      try {
        console.log(`Enhancing: ${candidate.full_name || candidate.first_name + ' ' + candidate.last_name}`);
        
        await base44.functions.invoke('enhanceCandidateCv', {
          candidate_id: candidate.id,
          force_reprocess: false
        });
        
        successCount++;
        console.log(`✓ Enhanced: ${candidate.full_name}`);
        
        // Wait between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        failedCount++;
        console.error(`✗ Failed: ${candidate.full_name} - ${error.message}`);
        errors.push({
          candidate_id: candidate.id,
          candidate_name: candidate.full_name,
          error: error.message
        });
      }
    }

    return Response.json({
      success: true,
      total: pendingCandidates.length,
      enhanced: successCount,
      failed: failedCount,
      errors: errors
    });

  } catch (error) {
    console.error('Error in batch enhancement:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});