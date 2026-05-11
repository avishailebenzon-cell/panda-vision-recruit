import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const PIPEDRIVE_API_KEY = Deno.env.get('PIPEDRIVE_API_KEY');

async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      if ([429, 502, 503, 504].includes(response.status)) {
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, attempt * 2000));
          continue;
        }
      }
      const errorText = await response.text();
      throw new Error(`Pipedrive API error (${response.status}): ${errorText.substring(0, 200)}`);
    } catch (fetchError) {
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, attempt * 2000));
        continue;
      }
      throw fetchError;
    }
  }
}

async function getStatusFieldInfo() {
  const res = await fetchWithRetry(`https://api.pipedrive.com/v1/personFields?api_token=${PIPEDRIVE_API_KEY}`);
  const data = await res.json();
  const fields = data.success ? data.data : [];

  for (const field of fields) {
    if (!field.options) continue;
    const candidateOption = field.options.find(o => o.label === 'מועמד לחברה');
    if (candidateOption) {
      return { fieldKey: field.key, optionId: candidateOption.id };
    }
  }
  return null;
}

async function findOrCreatePipedrivePerson(candidate, statusFieldKey, statusOptionId) {
  // If we already have a pipedrive_person_id, return it
  if (candidate.pipedrive_person_id) {
    return candidate.pipedrive_person_id;
  }

  // Search by name in Pipedrive
  const searchTerm = encodeURIComponent(candidate.full_name || `${candidate.first_name} ${candidate.last_name}`);
  const searchRes = await fetchWithRetry(
    `https://api.pipedrive.com/v1/persons/search?term=${searchTerm}&fields=name&api_token=${PIPEDRIVE_API_KEY}`
  );
  const searchData = await searchRes.json();

  // Try to find exact match by email or name
  let existingId = null;
  if (searchData.data?.items?.length > 0) {
    for (const item of searchData.data.items) {
      const p = item.item;
      // Match by email if available
      if (candidate.email && p.emails?.some(e => e.toLowerCase() === candidate.email.toLowerCase())) {
        existingId = p.id;
        break;
      }
      // Match by exact name
      const candidateFullName = candidate.full_name || `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim();
      if (p.name === candidateFullName) {
        existingId = p.id;
        break;
      }
    }
  }

  if (existingId) {
    console.log(`Found existing Pipedrive person: ${candidate.full_name} (ID: ${existingId})`);
    // Update status to מועמד לחברה
    const updateData = { [statusFieldKey]: statusOptionId };
    if (candidate.email) updateData.email = [{ value: candidate.email, primary: true }];
    if (candidate.phone_primary) updateData.phone = [{ value: candidate.phone_primary, primary: true }];

    await fetchWithRetry(
      `https://api.pipedrive.com/v1/persons/${existingId}?api_token=${PIPEDRIVE_API_KEY}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      }
    );
    return String(existingId);
  }

  // Create new person
  const candidateFullName = candidate.full_name || `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim();
  const createData = {
    name: candidateFullName,
    [statusFieldKey]: statusOptionId
  };
  if (candidate.email) createData.email = [{ value: candidate.email, primary: true }];
  if (candidate.phone_primary) createData.phone = [{ value: candidate.phone_primary, primary: true }];

  const createRes = await fetchWithRetry(
    `https://api.pipedrive.com/v1/persons?api_token=${PIPEDRIVE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createData)
    }
  );
  const createData2 = await createRes.json();
  if (!createData2.success) throw new Error(`Failed to create person: ${JSON.stringify(createData2)}`);
  console.log(`Created Pipedrive person: ${candidateFullName} (ID: ${createData2.data.id})`);
  return String(createData2.data.id);
}

async function syncNotesToPipedrive(personId, notes) {
  // Fetch existing notes for this person from Pipedrive
  const existingRes = await fetchWithRetry(
    `https://api.pipedrive.com/v1/notes?person_id=${personId}&api_token=${PIPEDRIVE_API_KEY}`
  );
  const existingData = await existingRes.json();
  const existingNotes = existingData.success ? existingData.data || [] : [];

  let created = 0;
  let updated = 0;

  for (const note of notes) {
    const content = `[HRAi] [${note.user_name || 'מערכת'} - ${new Date(note.created_date).toLocaleDateString('he-IL')}]\n${note.note_text}`;

    // Check if note already synced (look for pipedrive_note_id on note)
    if (note.pipedrive_note_id) {
      // Update existing note
      await fetchWithRetry(
        `https://api.pipedrive.com/v1/notes/${note.pipedrive_note_id}?api_token=${PIPEDRIVE_API_KEY}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content })
        }
      );
      updated++;
    } else {
      // Check if content already exists in Pipedrive notes (by note id stored)
      const createRes = await fetchWithRetry(
        `https://api.pipedrive.com/v1/notes?api_token=${PIPEDRIVE_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, person_id: parseInt(personId) })
        }
      );
      const createResult = await createRes.json();
      if (createResult.success && note.id) {
        // Save pipedrive_note_id back to the note
        try {
          const base44 = globalBase44;
          await base44.asServiceRole.entities.MatchNote.update(note.id, {
            pipedrive_note_id: String(createResult.data.id)
          });
        } catch (e) {
          console.warn('Could not save pipedrive_note_id:', e.message);
        }
      }
      created++;
    }
    await new Promise(r => setTimeout(r, 200));
  }

  return { created, updated };
}

// HR activity type key in Pipedrive (custom type, confirmed key: code100474061)
const HR_ACTIVITY_TYPE_KEY = 'code100474061';

async function syncTasksToPipedrive(personId, tasks, jobDealMap = {}) {
  let created = 0;
  let updated = 0;

  for (const task of tasks) {
    const subject = `[HRAi] ${task.job_title || 'משרה'} - ${task.candidate_name || ''}`;
    const note = [task.notes, task.conversation_summary, task.match_reasons].filter(Boolean).join('\n\n');

    // Use approved_for_call_date if exists, otherwise created_date
    const dateSource = task.approved_for_call_date || task.created_date;
    const dateObj = dateSource ? new Date(dateSource) : new Date();
    const dueDate = dateObj.toISOString().split('T')[0];
    const dueTime = dateObj.toTimeString().substring(0, 5); // HH:MM
    const isDone = ['הסתיים', 'הסתיים מוצלח', 'לא ליצור קשר'].includes(task.status) ? 1 : 0;

    // Look up deal_id from job
    const dealId = task.job_id && jobDealMap[task.job_id] ? parseInt(jobDealMap[task.job_id]) : null;

    if (task.pipedrive_activity_id) {
      const updatePayload = { subject, note, due_date: dueDate, due_time: dueTime, done: isDone };
      if (dealId) updatePayload.deal_id = dealId;
      await fetchWithRetry(
        `https://api.pipedrive.com/v1/activities/${task.pipedrive_activity_id}?api_token=${PIPEDRIVE_API_KEY}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatePayload)
        }
      );
      updated++;
    } else {
      const createPayload = {
        subject,
        type: HR_ACTIVITY_TYPE_KEY,
        person_id: parseInt(personId),
        note,
        due_date: dueDate,
        due_time: dueTime,
        done: isDone
      };
      if (dealId) createPayload.deal_id = dealId;

      const createRes = await fetchWithRetry(
        `https://api.pipedrive.com/v1/activities?api_token=${PIPEDRIVE_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createPayload)
        }
      );
      const createResult = await createRes.json();
      if (createResult.success && task.id) {
        try {
          await globalBase44.asServiceRole.entities.RotemTask.update(task.id, {
            pipedrive_activity_id: String(createResult.data.id)
          });
        } catch (e) {
          console.warn('Could not save pipedrive_activity_id:', e.message);
        }
      }
      created++;
    }
    await new Promise(r => setTimeout(r, 200));
  }

  return { created, updated };
}

// Global reference for use inside helpers
let globalBase44 = null;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    globalBase44 = base44;
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!PIPEDRIVE_API_KEY) {
      return Response.json({ error: 'PIPEDRIVE_API_KEY not configured' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const { candidate_id } = body;

    if (!candidate_id) {
      return Response.json({ error: 'candidate_id is required' }, { status: 400 });
    }

    console.log(`Syncing candidate ${candidate_id} to Pipedrive...`);

    // Get status field info
    const statusInfo = await getStatusFieldInfo();
    if (!statusInfo) {
      return Response.json({ error: 'לא נמצאה האופציה "מועמד לחברה" בשדה סטטוס ב-Pipedrive' }, { status: 400 });
    }

    // Fetch candidate
    const candidate = await base44.asServiceRole.entities.Candidate.get(candidate_id);
    if (!candidate) {
      return Response.json({ error: 'Candidate not found' }, { status: 404 });
    }

    // Find or create Pipedrive person
    const personId = await findOrCreatePipedrivePerson(candidate, statusInfo.fieldKey, statusInfo.optionId);

    // Update candidate with pipedrive_person_id and pipedrive_synced
    await base44.asServiceRole.entities.Candidate.update(candidate_id, {
      pipedrive_person_id: personId,
      pipedrive_synced: true,
      pipedrive_sync_date: new Date().toISOString()
    });

    // Fetch and sync notes (MatchNotes)
    const notes = await base44.asServiceRole.entities.MatchNote.filter({ candidate_id });
    const notesResult = await syncNotesToPipedrive(personId, notes);

    // Fetch and sync tasks (RotemTasks)
    const tasks = await base44.asServiceRole.entities.RotemTask.filter({ candidate_id });

    // Build job->deal map for tasks
    const jobIds = [...new Set(tasks.map(t => t.job_id).filter(Boolean))];
    const jobDealMap = {};
    for (const jobId of jobIds) {
      try {
        const job = await base44.asServiceRole.entities.Job.get(jobId);
        if (job?.pipedrive_deal_id) jobDealMap[jobId] = job.pipedrive_deal_id;
      } catch (e) { /* skip */ }
    }

    const tasksResult = await syncTasksToPipedrive(personId, tasks, jobDealMap);

    const summary = {
      success: true,
      candidate_name: candidate.full_name || `${candidate.first_name} ${candidate.last_name}`,
      pipedrive_person_id: personId,
      notes: notesResult,
      tasks: tasksResult
    };

    console.log('Candidate sync completed:', summary);
    return Response.json(summary);

  } catch (error) {
    console.error('Candidate sync error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});