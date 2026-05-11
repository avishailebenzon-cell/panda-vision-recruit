import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Starting backfill of EladTasks from filled forms');

    // Get all RotemTasks with form_status = "מולא"
    const filledTasks = await base44.asServiceRole.entities.RotemTask.filter({
      form_status: 'מולא'
    });

    console.log(`Found ${filledTasks.length} tasks with filled forms`);

    let created = 0;
    let skipped = 0;
    let errors = 0;
    const results = [];

    for (const task of filledTasks) {
      try {
        // Check if EladTask already exists for this match
        const existingEladTasks = await base44.asServiceRole.entities.EladTask.filter({
          match_id: task.match_id
        });

        if (existingEladTasks.length > 0) {
          console.log(`✓ EladTask already exists for match ${task.match_id}`);
          skipped++;
          continue;
        }

        // Get job and candidate data
        const job = await base44.asServiceRole.entities.Job.get(task.job_id);
        const candidate = await base44.asServiceRole.entities.Candidate.get(task.candidate_id);

        if (!job || !candidate) {
          console.log(`⚠️ Missing job or candidate for task ${task.id}`);
          errors++;
          results.push({
            task_id: task.id,
            candidate_name: task.candidate_name,
            status: 'error',
            reason: 'Missing job or candidate'
          });
          continue;
        }

        if (!candidate.resume_file_url) {
          console.log(`⚠️ No CV for candidate ${candidate.full_name}`);
          errors++;
          results.push({
            task_id: task.id,
            candidate_name: task.candidate_name,
            status: 'error',
            reason: 'No CV file'
          });
          continue;
        }

        const clientEmail = job.contact_person_email || job.client_email || 'avishai@pandatech.co.il';
        const contactPersonName = job.contact_person || 'מנהל מערכת';
        
        console.log(`📧 Using email: ${clientEmail}, contact: ${contactPersonName}`);

        // Get next task number for Elad
        const nextNumber = await base44.asServiceRole.functions.invoke('getNextTaskNumber', {});
        const taskNumber = `ET-${String(nextNumber.data.nextNumber).padStart(5, '0')}`;

        // Create EladTask
        await base44.asServiceRole.entities.EladTask.create({
          task_number: taskNumber,
          job_id: task.job_id,
          job_title: task.job_title,
          client_id: job.client_id,
          client_company_name: job.client_name,
          client_email: clientEmail,
          client_contact_person: contactPersonName,
          candidate_id: task.candidate_id,
          candidate_full_name: task.candidate_name,
          candidate_cv_file_url: candidate.resume_file_url,
          match_id: task.match_id,
          rotem_conversation_summary: task.conversation_summary,
          status: 'לא החל',
          priority: task.priority || 'בינונית',
          deadline: job.deadline || null,
          notes: `נוצרה אוטומטית - backfill של טופס שמולא ב-${task.form_sent_date ? new Date(task.form_sent_date).toLocaleDateString('he-IL') : 'תאריך לא ידוע'}`
        });

        console.log(`✓ Created EladTask ${taskNumber} for ${candidate.full_name} → ${job.client_name}`);
        created++;
        
        results.push({
          task_id: task.id,
          candidate_name: task.candidate_name,
          job_title: task.job_title,
          elad_task_number: taskNumber,
          status: 'created'
        });

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (taskError) {
        console.error(`Error processing task ${task.id}:`, taskError);
        errors++;
        results.push({
          task_id: task.id,
          candidate_name: task.candidate_name,
          status: 'error',
          reason: taskError.message
        });
      }
    }

    return Response.json({
      status: 'ok',
      filled_forms_found: filledTasks.length,
      elad_tasks_created: created,
      already_existed: skipped,
      errors: errors,
      results
    });

  } catch (error) {
    console.error('Backfill error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});