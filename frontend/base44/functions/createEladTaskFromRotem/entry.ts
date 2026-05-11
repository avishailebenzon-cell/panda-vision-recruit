import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { rotem_task_id } = await req.json();

    if (!rotem_task_id) {
      return Response.json({ error: 'חסר מזהה משימה של רותם' }, { status: 400 });
    }

    // Get the Rotem task
    const rotemTasks = await base44.asServiceRole.entities.RotemTask.filter({ id: rotem_task_id });
    if (rotemTasks.length === 0) {
      return Response.json({ error: 'משימת רותם לא נמצאה' }, { status: 404 });
    }

    const rotemTask = rotemTasks[0];

    // Verify the task is in "הסתיים מוצלח" status
    if (rotemTask.status !== 'הסתיים מוצלח') {
      return Response.json({ 
        error: `לא ניתן ליצור משימה לאלעד - הסטטוס הוא "${rotemTask.status}" ולא "הסתיים מוצלח"` 
      }, { status: 400 });
    }

    // Get job details
    const jobs = await base44.asServiceRole.entities.Job.filter({ id: rotemTask.job_id });
    if (jobs.length === 0) {
      return Response.json({ error: 'משרה לא נמצאה' }, { status: 404 });
    }
    const job = jobs[0];

    // Get candidate details
    const candidates = await base44.asServiceRole.entities.Candidate.filter({ id: rotemTask.candidate_id });
    if (candidates.length === 0) {
      return Response.json({ error: 'מועמד לא נמצא' }, { status: 404 });
    }
    const candidate = candidates[0];

    // Check if candidate has CV
    if (!candidate.resume_file_url) {
      return Response.json({ 
        success: false,
        error: 'למועמד אין קורות חיים - לא ניתן ליצור משימה לאלעד' 
      });
    }

    // Check if EladTask already exists for this combination
    const existingEladTasks = await base44.asServiceRole.entities.EladTask.filter({
      job_id: rotemTask.job_id,
      candidate_id: rotemTask.candidate_id
    });

    if (existingEladTasks.length > 0) {
      return Response.json({ 
        success: false,
        message: 'משימה לאלעד כבר קיימת עבור מועמד ומשרה זו',
        existing_task_id: existingEladTasks[0].id
      });
    }

    // Get next task number for Elad
    const nextNumberResponse = await base44.asServiceRole.functions.invoke('getNextTaskNumber', {});
    const taskNumber = `ET-${String(nextNumberResponse.data.nextNumber).padStart(5, '0')}`;

    // Get client email (with fallback)
    const clientEmail = job.contact_person_email || job.client_email || 'avishai@pandatech.co.il';
    const contactPersonName = job.contact_person || 'מנהל מערכת';

    // Create EladTask
    await base44.asServiceRole.entities.EladTask.create({
      task_number: taskNumber,
      job_id: rotemTask.job_id,
      job_title: rotemTask.job_title,
      client_id: job.client_id,
      client_company_name: job.client_name,
      client_email: clientEmail,
      client_contact_person: contactPersonName,
      candidate_id: rotemTask.candidate_id,
      candidate_full_name: rotemTask.candidate_name,
      candidate_cv_file_url: candidate.resume_file_url,
      match_id: rotemTask.match_id,
      status: 'לא החל',
      priority: rotemTask.priority || 'בינונית',
      deadline: job.deadline || null,
      notes: `נוצרה אוטומטית מרותם לאחר סיום מוצלח של משימה ${rotemTask.task_number}`
    });

    // Log to system activity
    await base44.asServiceRole.entities.SystemActivityLog.create({
      actor_type: 'agent',
      actor_name: 'rotem',
      actor_image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=40&h=40&fit=crop&crop=face',
      action_type: 'elad_task_created',
      action_description: `רותם העבירה משימה לאלעד: ${rotemTask.candidate_name} → ${job.client_name} (${rotemTask.job_title})`,
      status: 'success',
      details: JSON.stringify({
        rotem_task_id: rotemTask.id,
        rotem_task_number: rotemTask.task_number,
        elad_task_number: taskNumber,
        candidate_name: rotemTask.candidate_name,
        job_title: rotemTask.job_title,
        client_email: clientEmail
      })
    });

    return Response.json({
      success: true,
      elad_task_number: taskNumber,
      message: `נוצרה משימה לאלעד: ${taskNumber}`
    });

  } catch (error) {
    console.error('Error creating Elad task:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});