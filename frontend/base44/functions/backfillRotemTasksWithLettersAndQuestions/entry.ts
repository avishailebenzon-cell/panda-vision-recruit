import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters for pagination
    const url = new URL(req.url);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const batchSize = 10; // Process only 10 at a time

    // Get all RotemTasks that are missing either client_summary_letter or clarification_questions
    const allTasks = await base44.asServiceRole.entities.RotemTask.list('-created_date', 1000);
    
    const tasksNeedingUpdate = allTasks.filter(task => 
      !task.client_summary_letter || !task.clarification_questions
    );

    const totalTasks = tasksNeedingUpdate.length;
    const tasksBatch = tasksNeedingUpdate.slice(offset, offset + batchSize);

    console.log(`📋 מצאתי ${totalTasks} משימות שצריכות עדכון - עדכון גיץ ${Math.floor(offset/batchSize) + 1} (משימות ${offset + 1}-${Math.min(offset + batchSize, totalTasks)})`);

    let updated = 0;
    const log = [];

    for (const task of tasksBatch) {
      try {
        // Fetch candidate and job data
        const candidates = await base44.asServiceRole.entities.Candidate.filter({ id: task.candidate_id });
        const jobs = await base44.asServiceRole.entities.Job.filter({ id: task.job_id });

        if (candidates.length === 0 || jobs.length === 0) {
          console.log(`⏭️ דילוג: משימה ${task.task_number} - לא נמצא קנדידייט או משרה`);
          continue;
        }

        const candidate = candidates[0];
        const job = jobs[0];

        console.log(`\n📝 עדכון משימה: ${task.task_number} - ${candidate.full_name} → ${job.title}`);

        const updateData = {};

        // Generate client summary letter if missing
        if (!task.client_summary_letter) {
          console.log(`  → יוצר מכתב ללקוח...`);

          const candidateCvSummary = `שם: ${candidate.full_name}
ניסיון: ${candidate.years_experience || 'לא צוין'} שנות
תחום: ${candidate.main_discipline || 'לא צוין'}
השכלה: ${candidate.education_level || 'לא צוין'}
כישורים עיקריים: ${candidate.skills_summary ? candidate.skills_summary.substring(0, 200) : 'לא צוין'}`;

          const letterPrompt = `כתוב מכתב קצר (150 מילים) על התאמת מועמד למשרה.

משרה: ${job.title}
דרישות: ${(job.requirements || '').substring(0, 300)}

פרופיל מועמד:
${candidateCvSummary}

ציון התאמה: ${task.match_score}%

כתוב ישירות: נקודות חוזק, פערים, המלצה סופית.`;

          try {
            const letterResponse = await Promise.race([
              base44.integrations.Core.InvokeLLM({
                prompt: letterPrompt,
                response_json_schema: {
                  type: "object",
                  properties: {
                    summary_letter: { type: "string" }
                  }
                }
              }),
              new Promise((_, reject) => setTimeout(() => reject(new Error('LLM timeout')), 30000))
            ]);

            updateData.client_summary_letter = letterResponse.summary_letter || '';
            console.log(`    ✅ מכתב נוצר`);
          } catch (letterError) {
            console.log(`    ⚠️ דילוג על מכתב בגלל timeout`);
            updateData.client_summary_letter = `משרה: ${job.title}, מועמד: ${candidate.full_name}, ציון: ${task.match_score}%`;
          }
        }

        // Generate clarification questions if missing
        if (!task.clarification_questions) {
          console.log(`  → יוצר שאלות הבהרה...`);

          const questionsPrompt = `צור 5 שאלות להבהרה בשיחת טלפון עם ${candidate.full_name} למשרת ${job.title}.
שאלות צריכות לתהות על חוסרי ידע בתחומים: ${(job.requirements || '').substring(0, 150)}
תבנית: שאלה 1 text, שאלה 2 text, וכו'`;

          try {
            const questionsResponse = await Promise.race([
              base44.integrations.Core.InvokeLLM({
                prompt: questionsPrompt,
                response_json_schema: {
                  type: "object",
                  properties: {
                    questions: {
                      type: "array",
                      items: { type: "string" }
                    }
                  }
                }
              }),
              new Promise((_, reject) => setTimeout(() => reject(new Error('LLM timeout')), 30000))
            ]);

            if (questionsResponse?.questions && Array.isArray(questionsResponse.questions)) {
              updateData.clarification_questions = JSON.stringify(questionsResponse.questions);
              console.log(`    ✅ ${questionsResponse.questions.length} שאלות נוצרו`);
            }
          } catch (questionsError) {
            console.log(`    ⚠️ דילוג על שאלות בגלל timeout`);
            updateData.clarification_questions = JSON.stringify([
              `מה הניסיון שלך ב-${job.title}?`,
              `איזה כלים השתמשת בהם?`
            ]);
          }
        }

        // Update task if there's data to update
        if (Object.keys(updateData).length > 0) {
          await base44.asServiceRole.entities.RotemTask.update(task.id, updateData);
          updated++;
          log.push(`✅ ${task.task_number}: ${candidate.full_name}`);
        }

        await delay(8000); // Delay between tasks to avoid rate limiting
      } catch (error) {
        console.error(`שגיאה בעדכון משימה ${task.task_number}:`, error);
        log.push(`❌ ${task.task_number}: ${error.message}`);
        await delay(2000);
      }
    }

    console.log(`\n✅ סיים גיץ זה - עדכנתי ${updated} משימות`);
    const hasMore = (offset + batchSize) < totalTasks;

    return Response.json({
      success: true,
      totalTasksNeedingUpdate: totalTasks,
      currentBatch: Math.floor(offset/batchSize) + 1,
      tasksInBatch: tasksBatch.length,
      tasksUpdated: updated,
      processedCount: offset + batchSize,
      hasMore: hasMore,
      nextOffset: offset + batchSize,
      message: `עדכנתי ${updated}/${tasksBatch.length} משימות בגיץ זה. ${hasMore ? `יש עוד ${totalTasks - (offset + batchSize)} משימות לעדכן.` : 'סיימנו!'}`,
      log: log
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});