import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { task_id } = await req.json();

    if (!task_id) {
      return Response.json({ error: 'Missing task_id' }, { status: 400 });
    }

    console.log(`Rethinking candidate match for task ${task_id}`);

    // Get the task
    const tasks = await base44.asServiceRole.entities.RotemTask.filter({ id: task_id });
    if (!tasks || tasks.length === 0) {
      return Response.json({ error: 'Task not found' }, { status: 404 });
    }

    const task = tasks[0];

    // Get candidate details
    const candidates = await base44.asServiceRole.entities.Candidate.filter({ id: task.candidate_id });
    if (!candidates || candidates.length === 0) {
      return Response.json({ error: 'Candidate not found' }, { status: 404 });
    }
    const candidate = candidates[0];

    // Get job details
    const jobs = await base44.asServiceRole.entities.Job.filter({ id: task.job_id });
    if (!jobs || jobs.length === 0) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }
    const job = jobs[0];

    // Build context for Carmit
    const candidateContext = buildCandidateContext(candidate);
    const jobContext = buildJobContext(job);

    // Ask Carmit to rethink the match
    const carmitPrompt = `את כרמית, מנהלת הגיוס בפנדה-טק.

${user.full_name} ביקש/ה ממך לבדוק מחדש את ההתאמה הזו:

## פרטי המועמד:
${candidateContext}

## פרטי המשרה:
${jobContext}

## ההחלטה המקורית שלך:
${task.match_reasons || 'לא נרשמה החלטה מקורית'}
ציון התאמה: ${task.match_score || 'לא נקבע'}

---

עכשיו, בצע הערכה מחדש של ההתאמה. בדקי שוב:
1. האם הניסיון של המועמד מתאים לדרישות המשרה?
2. האם הכישורים התפקידיים מתאימים?
3. האם המיקום הגיאוגרפי סביר?
4. האם רמת הסיווג הביטחוני מתאימה?
5. האם רמת הוותק מתאימה?

תני החלטה ברורה:
- האם זו התאמה טובה שרותם צריכה ליצור קשר עם המועמד?
- מה הציון החדש (0-100)?
- מה הסיבות המפורטות?`;

    console.log('Calling Carmit for rethinking...');

    const carmitResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: carmitPrompt,
      response_json_schema: {
        type: 'object',
        properties: {
          should_contact: {
            type: 'boolean',
            description: 'האם רותם צריכה ליצור קשר עם המועמד'
          },
          new_score: {
            type: 'number',
            description: 'ציון ההתאמה החדש (0-100)'
          },
          new_reasoning: {
            type: 'string',
            description: 'הסיבות המפורטות להחלטה החדשה'
          },
          detailed_analysis: {
            type: 'object',
            description: 'ניתוח מפורט של ההתאמה'
          },
          changes_from_original: {
            type: 'string',
            description: 'מה השתנה מההחלטה המקורית ולמה'
          }
        },
        required: ['should_contact', 'new_score', 'new_reasoning']
      }
    });

    console.log('Carmit rethinking result:', carmitResponse);

    // Update the task with new decision
    const updateData = {
      match_score: carmitResponse.new_score,
      match_reasons: carmitResponse.new_reasoning,
      detailed_analysis: JSON.stringify(carmitResponse.detailed_analysis || {}),
      notes: (task.notes || '') + `\n\n[${new Date().toLocaleString('he-IL')}] 🔄 כרמית ביצעה חשיבה מחדש (בקשת ${user.full_name}):\n${carmitResponse.changes_from_original || 'לא צוינו שינויים'}`
    };

    await base44.asServiceRole.entities.RotemTask.update(task_id, updateData);

    // Log to SystemActivityLog
    await base44.asServiceRole.entities.SystemActivityLog.create({
      actor_type: 'user',
      actor_name: user.full_name,
      actor_image: '',
      action_type: 'carmit_rethink',
      action_description: `${user.full_name} ביקש/ה מכרמית לחשוב מחדש על ${task.candidate_name} ← ${task.job_title}`,
      status: 'info',
      details: JSON.stringify({
        task_id: task_id,
        old_score: task.match_score,
        new_score: carmitResponse.new_score,
        should_contact: carmitResponse.should_contact
      })
    });

    return Response.json({
      status: 'ok',
      result: carmitResponse,
      task_updated: true
    });

  } catch (error) {
    console.error('Rethink error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function buildCandidateContext(candidate) {
  const parts = [];
  
  parts.push(`שם: ${candidate.full_name || `${candidate.first_name} ${candidate.last_name}`}`);
  if (candidate.city) parts.push(`עיר: ${candidate.city}`);
  if (candidate.years_experience) parts.push(`שנות ניסיון: ${candidate.years_experience}`);
  if (candidate.education_level) parts.push(`השכלה: ${candidate.education_level}`);
  if (candidate.main_discipline) parts.push(`תחום: ${candidate.main_discipline}`);
  if (candidate.main_experience) parts.push(`ניסיון מרכזי: ${candidate.main_experience}`);
  if (candidate.skills_summary) parts.push(`כישורים: ${candidate.skills_summary}`);
  if (candidate.security_clearance && candidate.security_clearance !== 'לא רלוונטי') {
    parts.push(`סיווג: ${candidate.security_clearance}`);
  }
  
  // Add job history
  for (let i = 1; i <= 3; i++) {
    const company = candidate[`job_${i}_company`];
    const role = candidate[`job_${i}_role`];
    if (company || role) {
      parts.push(`עבודה קודמת ${i}: ${company || ''} - ${role || ''}`);
    }
  }
  
  return parts.join('\n');
}

function buildJobContext(job) {
  const parts = [];
  
  parts.push(`כותרת: ${job.title}`);
  if (job.client_name) parts.push(`לקוח: ${job.client_name}`);
  if (job.location) parts.push(`מיקום: ${job.location}`);
  if (job.security_clearance) parts.push(`דרישת סיווג: ${job.security_clearance}`);
  if (job.description) parts.push(`תיאור:\n${job.description}`);
  if (job.requirements) parts.push(`דרישות:\n${job.requirements}`);
  
  return parts.join('\n');
}