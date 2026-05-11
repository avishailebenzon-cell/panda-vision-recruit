import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all active CarmitLearning records
    const activeLearning = await base44.asServiceRole.entities.CarmitLearning.filter({ is_active: true });
    
    let updatedCount = 0;
    const updates = [];

    for (const learning of activeLearning) {
      try {
        // Build update object
        const priorityField = `${learning.user_override}_priority`;
        const processedDateField = `${learning.user_override}_processed_date`;
        const oldPriorityField = `${learning.original_assignment}_priority`;
        const oldProcessedDateField = `${learning.original_assignment}_processed_date`;

        await base44.asServiceRole.entities.Job.update(learning.job_id, {
          [priorityField]: true,
          [processedDateField]: null, // Clear so agent will reprocess
          [oldPriorityField]: false, // Remove from old agent
          [oldProcessedDateField]: null // Clear old agent's date
        });

        // Delete matches from the old agent for this job
        const agentNameMap = {
          naama: 'נעמה (סוכן AI)',
          rami: 'רמי (סוכן AI)',
          alik: 'אליק (סוכן AI)',
          itay: 'איתי (סוכן AI)',
          lior: 'ליאור (סוכן AI)',
          ofir: 'אופיר (סוכן AI)',
          gc: 'GC (סוכן AI)'
        };
        
        const oldAgentName = agentNameMap[learning.original_assignment];
        const newAgentName = agentNameMap[learning.user_override];
        let matchesDeleted = 0;
        
        if (oldAgentName) {
          const matchesToDelete = await base44.asServiceRole.entities.Match.filter({
            job_id: learning.job_id,
            user_name: oldAgentName,
            is_automatic_recommendation: true
          });
          
          for (const match of matchesToDelete) {
            await base44.asServiceRole.entities.Match.delete(match.id);
          }
          
          matchesDeleted = matchesToDelete.length;
        }
 
        // Update AgentRunStatus for both old and new agents
        const oldAgentStatuses = await base44.asServiceRole.entities.AgentRunStatus.filter({ 
          agent_name: learning.original_assignment 
        });
        const newAgentStatuses = await base44.asServiceRole.entities.AgentRunStatus.filter({ 
          agent_name: learning.user_override 
        });

        // Clear focus from old agent if they were focused on this job
        if (oldAgentStatuses.length > 0) {
          const oldStatus = oldAgentStatuses[0];
          if (oldStatus.focused_job_id === learning.job_id) {
            await base44.asServiceRole.entities.AgentRunStatus.update(oldStatus.id, {
              focused_job_id: null,
              focused_job_title: null,
              focus_start_time: null,
              focus_matches_found: 0
            });
            console.log(`🔄 ניקיתי מיקוד מ-${learning.original_assignment} על משרה ${learning.job_title}`);
          }
        }

        // Set focus for new agent on this job
        const job = await base44.asServiceRole.entities.Job.filter({ id: learning.job_id });
        if (job.length > 0 && newAgentStatuses.length > 0) {
          await base44.asServiceRole.entities.AgentRunStatus.update(newAgentStatuses[0].id, {
            focused_job_id: learning.job_id,
            focused_job_title: learning.job_title,
            focus_start_time: new Date().toISOString(),
            focus_matches_found: 0
          });
          console.log(`🎯 הגדרתי מיקוד ל-${learning.user_override} על משרה ${learning.job_title}`);
        } else if (job.length > 0) {
          // Create new AgentRunStatus if doesn't exist
          await base44.asServiceRole.entities.AgentRunStatus.create({
            agent_name: learning.user_override,
            focused_job_id: learning.job_id,
            focused_job_title: learning.job_title,
            focus_start_time: new Date().toISOString(),
            focus_matches_found: 0,
            is_running: false
          });
          console.log(`🎯 יצרתי סטטוס חדש ל-${learning.user_override} עם מיקוד על ${learning.job_title}`);
        }

        // Log the reassignment
        await base44.asServiceRole.entities.SystemActivityLog.create({
          actor_type: 'agent',
          actor_name: 'carmit',
          actor_image: 'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=40&h=40&fit=crop&crop=face',
          action_type: 'job_reassignment',
          action_description: `כרמית העבירה משרה "${learning.job_title}" מ-${learning.original_assignment} ל-${learning.user_override}. ${matchesDeleted} התאמות נמחקו`,
          status: 'success',
          details: JSON.stringify({
            job_id: learning.job_id,
            from_agent: learning.original_assignment,
            to_agent: learning.user_override,
            matches_deleted: matchesDeleted,
            reason: learning.learning_reason
          })
        });

        updatedCount++;
        updates.push({
          job_title: learning.job_title,
          from: learning.original_assignment,
          to: learning.user_override,
          matches_deleted: matchesDeleted
        });

      } catch (error) {
        console.error(`Error updating job ${learning.job_id}:`, error);
      }
    }

    return Response.json({
      success: true,
      message: `עודכנו ${updatedCount} משרות בהתאם להחלטות כרמית`,
      updatedCount,
      updates
    });

  } catch (error) {
    console.error('Error in syncCarmitLearningToJobs:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});