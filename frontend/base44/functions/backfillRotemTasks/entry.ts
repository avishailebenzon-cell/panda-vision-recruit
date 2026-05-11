import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔄 Starting backfill of Rotem tasks with detailed match data...');

    // Fetch all Rotem tasks from Carmit source that are missing detailed analysis
    const allTasks = await base44.entities.RotemTask.list('-created_date', 1000);
    
    // Filter tasks from Carmit that are missing match_reasons or detailed_analysis
    const tasksToUpdate = allTasks.filter(task => 
      task.source === 'carmit' && (!task.match_reasons || !task.detailed_analysis)
    );

    console.log(`📊 Found ${tasksToUpdate.length} Carmit tasks to backfill`);

    if (tasksToUpdate.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'No Carmit tasks need backfilling',
        tasksProcessed: 0 
      });
    }

    // Fetch all jobs and candidates
    console.log('📚 Loading jobs and candidates...');
    const jobsResult = await base44.asServiceRole.entities.Job.list();
    const allJobs = Array.isArray(jobsResult) ? jobsResult : [];
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const candidatesResult = await base44.asServiceRole.entities.Candidate.list();
    const allCandidates = Array.isArray(candidatesResult) ? candidatesResult : [];
    
    const jobsMap = new Map(allJobs.map(j => [j.id, j]));
    const candidatesMap = new Map(allCandidates.map(c => [c.id, c]));
    
    console.log(`📚 Loaded ${allJobs.length} jobs and ${allCandidates.length} candidates`);

    let tasksUpdated = 0;
    let tasksSkipped = 0;
    const results = [];

    for (const task of tasksToUpdate) {
      try {
        const job = jobsMap.get(task.job_id);
        const candidate = candidatesMap.get(task.candidate_id);
        
        if (!job) {
          console.log(`⏭️ Skipping task ${task.id} - job not found`);
          tasksSkipped++;
          results.push({
            task_id: task.id,
            candidate_name: task.candidate_name,
            job_title: task.job_title,
            status: 'skipped',
            reason: 'Job not found'
          });
          continue;
        }

        if (!candidate) {
          console.log(`⏭️ Skipping task ${task.id} - candidate not found`);
          tasksSkipped++;
          results.push({
            task_id: task.id,
            candidate_name: task.candidate_name,
            job_title: task.job_title,
            status: 'skipped',
            reason: 'Candidate not found'
          });
          continue;
        }

        console.log(`🔍 Analyzing ${candidate.first_name} ${candidate.last_name} -> ${job.title}`);

        // Build detailed analysis using LLM
        const analysisPrompt = `נתח את ההתאמה בין המועמד למשרה והחזר JSON מפורט.

משרה: ${job.title}
דרישות: ${job.requirements || 'לא צוינו'}
${job.dana_supplement ? `תוספת דנה: ${job.dana_supplement}` : ''}

מועמד: ${candidate.first_name} ${candidate.last_name}
ניסיון: ${candidate.main_experience || 'לא צוין'}
כישורים: ${candidate.skills_summary || candidate.main_tech_tools || 'לא צוין'}
השכלה: ${candidate.education_level || 'לא צוינה'}
סיווג: ${candidate.security_clearance || 'לא צוין'}

נתח כל דרישה מרכזית מול כישורי המועמד. החזר מערך של אובייקטים:
[
  {
    "requirement": "דרישה ספציפית",
    "candidate_qualification": "איך המועמד עונה על הדרישה",
    "is_match": "true/false/partial"
  }
]`;

        const llmResponse = await base44.integrations.Core.InvokeLLM({
          prompt: analysisPrompt,
          response_json_schema: {
            type: "object",
            properties: {
              analysis: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    requirement: { type: "string" },
                    candidate_qualification: { type: "string" },
                    is_match: { type: "string" }
                  }
                }
              },
              match_score: { type: "number" },
              summary: { type: "string" }
            }
          }
        });

        // Update the task
        const updateData = {
          detailed_analysis: JSON.stringify(llmResponse.analysis || []),
          match_reasons: llmResponse.summary || `התאמה בין ${candidate.first_name} למשרה ${job.title}`,
          match_score: llmResponse.match_score || 85
        };
        
        await base44.asServiceRole.entities.RotemTask.update(task.id, updateData);

        tasksUpdated++;
        console.log(`✅ Updated task ${task.id}`);
        
        results.push({
          task_id: task.id,
          candidate_name: task.candidate_name,
          job_title: task.job_title,
          status: 'updated',
          match_score: updateData.match_score
        });
        
        // Delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`❌ Error processing task ${task.id}:`, error.message);
        tasksSkipped++;
        results.push({
          task_id: task.id,
          candidate_name: task.candidate_name,
          status: 'error',
          reason: error.message
        });
      }
    }

    console.log(`\n📈 Backfill Summary:`);
    console.log(`   ✅ Updated: ${tasksUpdated}`);
    console.log(`   ⏭️ Skipped: ${tasksSkipped}`);

    // Log to system activity
    try {
      await base44.entities.SystemActivityLog.create({
        actor_type: 'system',
        actor_name: 'Backfill Process',
        actor_image: '',
        action_type: 'data_cleanup',
        action_description: `עדכון רטרואקטיבי של ${tasksUpdated} משימות רותם עם נתוני התאמה מפורטים`,
        status: 'success',
        details: JSON.stringify({
          tasksUpdated,
          tasksSkipped,
          totalProcessed: tasksToUpdate.length
        })
      });
    } catch (logErr) {
      console.warn('Failed to log activity:', logErr.message);
    }

    return Response.json({ 
      success: true,
      tasksUpdated,
      tasksSkipped,
      totalProcessed: tasksToUpdate.length,
      results: results.slice(0, 20), // Return first 20 for debugging
      message: `עדכנתי ${tasksUpdated} משימות, דילגתי על ${tasksSkipped}`
    });

  } catch (error) {
    console.error('Error in backfillRotemTasks:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});