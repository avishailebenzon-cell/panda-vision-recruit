import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { job_id, base_score_without_geo, base_score_with_geo } = await req.json();

    if (!job_id || base_score_without_geo === undefined || base_score_with_geo === undefined) {
      return Response.json({ 
        error: 'Missing required fields: job_id, base_score_without_geo, base_score_with_geo' 
      }, { status: 400 });
    }

    // Update Job with both scores
    await base44.asServiceRole.entities.Job.update(job_id, {
      base_score_without_geo,
      base_score_with_geo
    });

    return Response.json({
      success: true,
      message: `Updated job ${job_id} with geo scores`,
      data: {
        base_score_without_geo,
        base_score_with_geo
      }
    });

  } catch (error) {
    console.error('Error adding geo score to job:', error);
    return Response.json({ 
      error: error.message,
      success: false
    }, { status: 500 });
  }
});