import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { task_id } = await req.json();

    if (!task_id) {
      return Response.json({ error: 'task_id is required' }, { status: 400 });
    }

    const PIPEDRIVE_API_KEY = Deno.env.get('PIPEDRIVE_API_KEY');
    const PIPEDRIVE_API_URL = 'https://api.pipedrive.com/v1';

    console.log(`Processing task ${task_id} for Pipedrive sync...`);

    // 1. Fetch task details
    const task = await base44.entities.UserTask.filter({ id: task_id });
    if (!task || task.length === 0) {
      return Response.json({ error: 'Task not found' }, { status: 404 });
    }
    const taskData = task[0];

    // 2. Get candidate_id and optionally deal_id from the task's match
    let candidateId = taskData.candidate_id;
    let dealId = null;

    if (taskData.match_id) {
      const match = await base44.entities.Match.filter({ id: taskData.match_id });
      if (match && match.length > 0) {
        const matchData = match[0];
        if (!candidateId) candidateId = matchData.candidate_id;

        // Try to get deal_id from the job linked to this specific match
        if (matchData.job_id) {
          const job = await base44.entities.Job.filter({ id: matchData.job_id });
          if (job && job.length > 0 && job[0].pipedrive_deal_id) {
            dealId = job[0].pipedrive_deal_id;
            console.log(`Found deal_id ${dealId} from match's job`);
          }
        }
      }
    }

    if (!candidateId) {
      console.log('No candidate_id found in task, skipping');
      return Response.json({ success: true, skipped: true, reason: 'No candidate_id in task' });
    }

    // 3. Fetch candidate details
    const candidate = await base44.entities.Candidate.filter({ id: candidateId });
    if (!candidate || candidate.length === 0) {
      console.log('Candidate not found, skipping');
      return Response.json({ success: true, skipped: true, reason: 'Candidate not found' });
    }
    const candidateData = candidate[0];

    console.log(`Creating ONE Pipedrive activity for candidate ${candidateData.full_name} (no deal link)`);

    // 6. Find or create/update Person in Pipedrive
    let personId = null;
    let existingPerson = null;
    
    // Search for existing person by email
    if (candidateData.email) {
      const searchUrl = `${PIPEDRIVE_API_URL}/persons/search?term=${encodeURIComponent(candidateData.email)}&fields=email&api_token=${PIPEDRIVE_API_KEY}`;
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();
      
      if (searchData.success && searchData.data?.items?.length > 0) {
        existingPerson = searchData.data.items[0].item;
        personId = existingPerson.id;
        console.log(`Found existing person: ${personId}`);
      }
    }

    const personPayload = {
      name: candidateData.full_name || `${candidateData.first_name || ''} ${candidateData.last_name || ''}`.trim(),
      email: candidateData.email || null,
      phone: candidateData.phone_primary || null,
    };

    if (personId) {
      // Update existing person
      const updatePersonUrl = `${PIPEDRIVE_API_URL}/persons/${personId}?api_token=${PIPEDRIVE_API_KEY}`;
      const updatePersonRes = await fetch(updatePersonUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(personPayload)
      });

      const updatePersonData = await updatePersonRes.json();
      if (updatePersonData.success) {
        console.log(`Updated existing person: ${personId}`);
      } else {
        console.warn('Failed to update person, continuing with existing:', updatePersonData);
      }
    } else {
      // Create new person
      const createPersonUrl = `${PIPEDRIVE_API_URL}/persons?api_token=${PIPEDRIVE_API_KEY}`;
      const createPersonRes = await fetch(createPersonUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(personPayload)
      });

      const createPersonData = await createPersonRes.json();
      if (!createPersonData.success) {
        console.error('Failed to create person:', createPersonData);
        return Response.json({ 
          error: 'Failed to create person in Pipedrive', 
          details: createPersonData 
        }, { status: 500 });
      }
      
      personId = createPersonData.data.id;
      console.log(`Created new person: ${personId}`);
    }

    // 7. Create activity with due date in 2 days at 10:00 - linked ONLY to person, no deal
    const now = new Date();
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 2);
    dueDate.setHours(10, 0, 0, 0);
    
    const dueDateStr = dueDate.toISOString().split('T')[0]; // YYYY-MM-DD
    const dueTimeStr = '10:00'; // HH:MM

    const activityUrl = `${PIPEDRIVE_API_URL}/activities?api_token=${PIPEDRIVE_API_KEY}`;
    const activityPayload = {
      subject: taskData.task_name,
      type: 'task',
      person_id: personId,
      due_date: dueDateStr,
      due_time: dueTimeStr,
      note: taskData.description || '',
      ...(dealId ? { deal_id: dealId } : {}),
    };

    const activityRes = await fetch(activityUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(activityPayload)
    });

    const activityData = await activityRes.json();
    if (!activityData.success) {
      console.error('Failed to create activity:', activityData);
      return Response.json({ 
        error: 'Failed to create activity in Pipedrive', 
        details: activityData 
      }, { status: 500 });
    }

    console.log(`Created activity: ${activityData.data.id}`);

    // 9. Log to system activity log
    try {
      await base44.asServiceRole.entities.SystemActivityLog.create({
        activity_type: 'pipedrive_activity_created',
        description: `נוצרה פעילות בפייפדרייב עבור משימה: ${taskData.task_name}`,
        entity_type: 'UserTask',
        entity_id: task_id,
        details: JSON.stringify({
          task_id,
          task_name: taskData.task_name,
          candidate_name: candidateData.full_name,
          pipedrive_person_id: personId,
          pipedrive_activity_id: activityData.data.id,
          due_date: dueDateStr,
          due_time: dueTimeStr,
        }),
        performed_by: 'system',
        status: 'success',
      });
    } catch (logError) {
      console.warn('Failed to log to SystemActivityLog:', logError.message);
    }

    // 10. Optional: Trigger Pipedrive sync
    try {
      await base44.functions.invoke('syncPipedriveJobs', {});
      console.log('Triggered Pipedrive sync');
    } catch (syncError) {
      console.warn('Failed to trigger sync, continuing:', syncError.message);
    }

    return Response.json({
      success: true,
      person_id: personId,
      activity_id: activityData.data.id,
      due_date: dueDateStr,
      due_time: dueTimeStr,
    });

  } catch (error) {
    console.error('Error in createPipedriveActivityFromTask:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});