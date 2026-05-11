import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { task_id } = await req.json();
    if (!task_id) return Response.json({ error: 'task_id is required' }, { status: 400 });

    // Load the task
    const tasks = await base44.entities.RotemTask.filter({ id: task_id });
    if (!tasks || tasks.length === 0) return Response.json({ error: 'Task not found' }, { status: 404 });
    const task = tasks[0];

    // Load candidate and job
    const [candidates, jobs] = await Promise.all([
      base44.entities.Candidate.filter({ id: task.candidate_id }),
      base44.entities.Job.filter({ id: task.job_id })
    ]);

    if (!candidates.length || !jobs.length) {
      return Response.json({ error: 'Candidate or job not found' }, { status: 404 });
    }

    const candidate = candidates[0];
    const job = jobs[0];

    const candidateCvSummary = `
שם המועמד: ${candidate.full_name}
${candidate.years_experience ? `שנות ניסיון: ${candidate.years_experience}` : ''}
${candidate.main_discipline ? `תחום עיקרי: ${candidate.main_discipline}` : ''}
${candidate.education_level ? `השכלה: ${candidate.education_level}` : ''}
${candidate.main_experience ? `ניסיון מרכזי: ${candidate.main_experience.substring(0, 500)}` : ''}
${candidate.skills_summary ? `סיכום כישורים: ${candidate.skills_summary.substring(0, 500)}` : ''}
${candidate.main_tech_tools ? `כלים טכנולוגיים: ${candidate.main_tech_tools.substring(0, 300)}` : ''}
${candidate.security_clearance && candidate.security_clearance !== 'לא רלוונטי' ? `סיווג: ${candidate.security_clearance}` : ''}
${candidate.city ? `עיר מגורים: ${candidate.city}` : ''}
    `.trim();

    const letterPrompt = `את כרמית, מנהלת הגיוס של פנדה-טק. אחד הסוכנים שלך זיהה התאמה בין מועמד למשרה.

תפקידך: לכתוב מכתב סיכום מפורט ושקוף ללקוח על המועמד.

**פרטי המשרה:**
${job.title}
${job.description || ''}

**דרישות המשרה:**
${job.requirements || ''}

**פרופיל המועמד:**
${candidateCvSummary}

**ציון התאמה שקיבל מהסוכן:** ${task.match_score || 'לא צוין'}%

**הנחיות לכתיבת המכתב:**

1. **פתיחה מקצועית:** התחל בהצגת המועמד בצורה מקצועית (ללא פרטים מזהים כמו שם מלא)
2. **נקודות התאמה:** פרט באופן מדויק את כל נקודות החוזק והתאמה של המועמד לדרישות המשרה - התייחס לכל דרישה רלוונטית
3. **פערים וחסרונות:** באופן שקוף, ציין את הפערים או החסרונות - מה חסר למועמד ביחס לדרישות המשרה
4. **סיכום והמלצה:** סיכום קצר האם המועמד מומלץ ולמה

**סגנון כתיבה:**
- מקצועי, שקוף, ישיר
- אל תסתיר פרטים - הלקוח צריך לקבל תמונה מלאה
- הדגש גם יתרונות וגם חסרונות
- כתוב בעברית תקנית ומקצועית
- אורך: 200-400 מילים

כתוב את המכתב:`;

    const letterResponse = await base44.integrations.Core.InvokeLLM({
      prompt: letterPrompt,
      response_json_schema: {
        type: "object",
        properties: {
          summary_letter: { type: "string" }
        }
      }
    });

    const clientSummaryLetter = letterResponse.summary_letter || '';

    // Generate clarification questions too
    let clarificationQuestions = [];
    if (clientSummaryLetter) {
      try {
        const questionsPrompt = `אני מגייס עובדים והתקבל מועמד למשרה. המועמד: ${candidate.full_name}. המשרה: ${job.title}.

כתבתי מכתב ללקוח שמסכם את המועמד ומתאר את הנקודות החזקות שלו, אבל יש בו גם חלק שמדבר על פערים או חסרונות.

הנה המכתב המלא:
${clientSummaryLetter}

---

**המשימה שלך:**
צור רשימה של 5-8 שאלות הבהרה שניתן לשאול את המועמד בשיחת טלפון, כדי לוודא שהוא באמת מתאים למשרה ולנסות למצוא אצלו כישורים/ניסיון שאולי לא רשם בקורות החיים.`;

        const questionsResponse = await base44.integrations.Core.InvokeLLM({
          prompt: questionsPrompt,
          response_json_schema: {
            type: "object",
            properties: {
              questions: {
                type: "array",
                items: { type: "string" }
              }
            },
            required: ["questions"]
          }
        });

        if (questionsResponse?.questions && Array.isArray(questionsResponse.questions)) {
          clarificationQuestions = questionsResponse.questions;
        }
      } catch (qErr) {
        console.error('Error generating questions:', qErr);
      }
    }

    // Update the task
    const updateData = { client_summary_letter: clientSummaryLetter };
    if (clarificationQuestions.length > 0) {
      updateData.clarification_questions = JSON.stringify(clarificationQuestions);
    }

    await base44.entities.RotemTask.update(task_id, updateData);

    return Response.json({
      success: true,
      letter_length: clientSummaryLetter.length,
      questions_count: clarificationQuestions.length
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});