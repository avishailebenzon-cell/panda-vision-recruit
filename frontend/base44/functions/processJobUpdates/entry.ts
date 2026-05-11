import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get pending job updates
    const pendingUpdates = await base44.asServiceRole.entities.JobUpdateLog.filter({
      is_processed: false
    }, '-created_date', 50);

    if (pendingUpdates.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'No pending job updates',
        processed: 0
      });
    }

    const results = [];

    // Helper function to determine which agent should handle a job
    const determineJobAgent = (job) => {
      const title = (job.title || '').toLowerCase();
      const description = (job.description || '').toLowerCase();
      const requirements = (job.requirements || '').toLowerCase();
      const fullText = `${title} ${description} ${requirements}`;
      
      // Level 1 jobs go to rami
      if (job.security_clearance === 'רמה 1') {
        return { name: 'rami', displayName: 'רמי (סוכן AI)' };
      }

      const naamaKeywords = ['תוכנה', 'software', 'developer', 'מפתח', 'embedded', 'firmware', 'c++', 'python', 'java'];
      const alikKeywords = ['אלקטרוני', 'electronics', 'hardware', 'pcb', 'analog', 'fpga'];
      const itayKeywords = ['it', 'מחשוב', 'devops', 'cloud'];
      const liorKeywords = ['מערכת', 'system engineer'];
      const ofirKeywords = ['מכונות', 'mechanical', 'מכני'];

      const naamaScore = naamaKeywords.filter(k => fullText.includes(k)).length;
      const alikScore = alikKeywords.filter(k => fullText.includes(k)).length;
      const itayScore = itayKeywords.filter(k => fullText.includes(k)).length;
      const liorScore = liorKeywords.filter(k => fullText.includes(k)).length;
      const ofirScore = ofirKeywords.filter(k => fullText.includes(k)).length;

      const scores = [
        { name: 'naama', displayName: 'נעמה (סוכן AI)', score: naamaScore },
        { name: 'alik', displayName: 'אליק (סוכן AI)', score: alikScore },
        { name: 'itay', displayName: 'איתי (סוכן AI)', score: itayScore },
        { name: 'lior', displayName: 'ליאור (סוכן AI)', score: liorScore },
        { name: 'ofir', displayName: 'אופיר (סוכן AI)', score: ofirScore }
      ];

      scores.sort((a, b) => b.score - a.score);
      
      if (scores[0].score > 0) {
        return scores[0];
      }
      
      return { name: 'gc', displayName: 'GC (סוכן AI)' };
    };

    for (const update of pendingUpdates) {
      try {
        // Get the updated job
        const job = await base44.asServiceRole.entities.Job.get(update.job_id);
        
        if (!job) {
          console.log(`Job ${update.job_id} not found, skipping`);
          await base44.asServiceRole.entities.JobUpdateLog.update(update.id, {
            is_processed: true,
            notification_status: 'failed'
          });
          continue;
        }

        // Determine which agent should handle this job
        const assignedAgent = determineJobAgent(job);
        console.log(`Job "${job.title}" assigned to ${assignedAgent.displayName}`);

        // Set focus for the agent
        try {
          const agentStatuses = await base44.asServiceRole.entities.AgentRunStatus.filter({
            agent_name: assignedAgent.name
          });

          const focusData = {
            focused_job_id: job.id,
            focused_job_title: job.title,
            focus_start_time: new Date().toISOString(),
            focus_matches_found: 0
          };

          if (agentStatuses.length > 0) {
            await base44.asServiceRole.entities.AgentRunStatus.update(agentStatuses[0].id, focusData);
          } else {
            await base44.asServiceRole.entities.AgentRunStatus.create({
              agent_name: assignedAgent.name,
              ...focusData
            });
          }
          
          console.log(`✅ Set focus for ${assignedAgent.displayName} on job "${job.title}"`);
        } catch (focusErr) {
          console.error(`Failed to set focus for ${assignedAgent.name}:`, focusErr);
        }

        // Set priority flag for the agent
        try {
          const priorityField = `${assignedAgent.name}_priority`;
          await base44.asServiceRole.entities.Job.update(job.id, {
            [priorityField]: true
          });
          console.log(`✅ Set ${priorityField} flag for job "${job.title}"`);
        } catch (priorityErr) {
          console.error(`Failed to set priority for ${assignedAgent.name}:`, priorityErr);
        }

        // Create system activity log
        try {
          await base44.asServiceRole.entities.SystemActivityLog.create({
            actor_type: 'agent',
            actor_name: 'כרמית',
            actor_image: 'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=40&h=40&fit=crop&crop=face',
            action_type: 'job_updated',
            action_description: `עדכון במשרה "${update.job_title}": ${update.change_summary}. כרמית הנחתה את ${assignedAgent.displayName} לבצע חיפוש מחדש.`,
            status: 'info',
            details: JSON.stringify({
              job_id: update.job_id,
              job_title: update.job_title,
              changed_fields: update.changed_fields,
              assigned_agent: assignedAgent.displayName
            })
          });
        } catch (logErr) {
          console.error('Failed to create activity log:', logErr);
        }

        // Mark update as processed
        await base44.asServiceRole.entities.JobUpdateLog.update(update.id, {
          is_processed: true,
          agents_notified: [assignedAgent.displayName],
          notification_status: 'sent'
        });

        results.push({
          job_title: update.job_title,
          agent_assigned: assignedAgent.displayName,
          focus_set: true
        });

      } catch (updateErr) {
        console.error(`Error processing update for job ${update.job_id}:`, updateErr);
        
        // Mark as failed
        await base44.asServiceRole.entities.JobUpdateLog.update(update.id, {
          is_processed: true,
          notification_status: 'failed'
        });
      }
    }

    return Response.json({
      success: true,
      processed: results.length,
      results
    });

  } catch (error) {
    console.error('Error in processJobUpdates:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});