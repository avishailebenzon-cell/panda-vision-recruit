import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { candidate_job_pairs } = await req.json();

    if (!candidate_job_pairs || !Array.isArray(candidate_job_pairs)) {
      return Response.json({ 
        error: 'Missing or invalid candidate_job_pairs array' 
      }, { status: 400 });
    }

    const results = [];
    const errors = [];

    // Process each pair by calling the single calculateGeoFit function
    for (const pair of candidate_job_pairs) {
      try {
        const response = await base44.functions.invoke('calculateGeoFit', {
          candidate_id: pair.candidate_id,
          job_id: pair.job_id
        });

        if (response.data.success) {
          results.push(response.data.result);
        } else {
          errors.push({
            candidate_id: pair.candidate_id,
            job_id: pair.job_id,
            error: 'Calculation failed'
          });
        }
      } catch (error) {
        errors.push({
          candidate_id: pair.candidate_id,
          job_id: pair.job_id,
          error: error.message
        });
      }
    }

    return Response.json({
      success: true,
      total: candidate_job_pairs.length,
      succeeded: results.length,
      failed: errors.length,
      results,
      errors
    });

  } catch (error) {
    console.error('Bulk GeoFit calculation error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});