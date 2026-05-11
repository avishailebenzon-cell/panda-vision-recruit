import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    // Support both direct call (with job_id) and entity automation payload
    let jobId = body.job_id;
    let newDeadline = body.deadline;

    // If called from entity automation
    if (!jobId && body.event?.entity_id) {
      jobId = body.event.entity_id;
      const jobData = body.data;
      newDeadline = jobData?.deadline;
    }

    // If no job_id but old_data/data available (entity automation update)
    if (!jobId && body.data?.id) {
      jobId = body.data.id;
      newDeadline = body.data?.deadline;
    }

    // Validate that there's actually a deadline change worth syncing
    if (!jobId) {
      return Response.json({ success: false, error: 'Missing job_id' }, { status: 400 });
    }

    // Check if deadline actually changed (entity automation provides old_data)
    if (body.old_data !== undefined && body.old_data?.deadline === newDeadline) {
      return Response.json({ success: true, message: 'Deadline unchanged, skipping sync', synced: 0 });
    }

    console.log(`🔄 מסנכרן deadline "${newDeadline}" למשרה ${jobId}...`);

    // Update all Matches with this job_id
    const matches = await base44.asServiceRole.entities.Match.filter({ job_id: jobId });
    let matchesSynced = 0;

    for (const match of matches) {
      if (match.deadline !== newDeadline) {
        await base44.asServiceRole.entities.Match.update(match.id, {
          deadline: newDeadline || null
        });
        matchesSynced++;
      }
    }

    // Update all RotemTasks with this job_id (store in notes if no deadline field, but RotemTask has no deadline)
    // We update the notes to reflect deadline if it changed
    const tasks = await base44.asServiceRole.entities.RotemTask.filter({ job_id: jobId });
    let tasksSynced = 0;

    if (newDeadline) {
      for (const task of tasks) {
        // Only update active tasks (not closed ones)
        const closedStatuses = ['הסתיים', 'הסתיים מוצלח', 'לא ליצור קשר', 'מועמד לא עונה'];
        if (closedStatuses.includes(task.status)) continue;

        const deadlineNote = `⏰ דד-ליין משרה: ${newDeadline}`;
        const currentNotes = task.notes || '';

        // Replace existing deadline note or add new one
        const updatedNotes = currentNotes.includes('⏰ דד-ליין משרה:')
          ? currentNotes.replace(/⏰ דד-ליין משרה: \S+/, deadlineNote)
          : (currentNotes ? `${currentNotes}\n${deadlineNote}` : deadlineNote);

        if (updatedNotes !== currentNotes) {
          await base44.asServiceRole.entities.RotemTask.update(task.id, {
            notes: updatedNotes
          });
          tasksSynced++;
        }
      }
    }

    console.log(`✅ עודכנו ${matchesSynced} התאמות ו-${tasksSynced} משימות`);

    return Response.json({
      success: true,
      job_id: jobId,
      new_deadline: newDeadline,
      matches_synced: matchesSynced,
      tasks_synced: tasksSynced
    });

  } catch (error) {
    console.error('Error in syncJobDeadlineToMatches:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});