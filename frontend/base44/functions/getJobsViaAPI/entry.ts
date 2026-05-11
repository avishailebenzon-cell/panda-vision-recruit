import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    // Get API key from header
    const apiKey = req.headers.get('x-api-key');
    
    if (!apiKey) {
      return Response.json({ error: 'Missing API key' }, { status: 401 });
    }

    // Initialize Base44 client
    const base44 = createClientFromRequest(req);

    // Verify API key is valid and active
    const validKeys = await base44.asServiceRole.entities.APIKey.filter({
      api_key: apiKey,
      is_active: true
    });

    if (!validKeys || validKeys.length === 0) {
      return Response.json({ error: 'Invalid API key' }, { status: 403 });
    }

    const apiKeyRecord = validKeys[0];

    // Update last_used timestamp
    await base44.asServiceRole.entities.APIKey.update(apiKeyRecord.id, {
      last_used: new Date().toISOString()
    });

    // Fetch all active jobs
    const jobs = await base44.asServiceRole.entities.Job.filter({ 
      status: 'פעילה'
    });

    return Response.json({
      success: true,
      count: jobs.length,
      jobs: jobs.map(job => ({
        id: job.id,
        job_code: job.job_code,
        title: job.title,
        description: job.description,
        requirements: job.requirements,
        location: job.location,
        client_name: job.client_name,
        security_clearance: job.security_clearance,
        recruitment_priority: job.recruitment_priority,
        created_date: job.created_date,
        updated_date: job.updated_date
      }))
    }, { status: 200 });

  } catch (error) {
    console.error('Error in getJobsViaAPI:', error);
    return Response.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
});