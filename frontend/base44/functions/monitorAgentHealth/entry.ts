import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole;

    console.log('🏥 Agent Health Monitor starting...');

    // Check all agent statuses for stuck agents
    const allAgentStatuses = await db.entities.AgentRunStatus.list();
    const STUCK_THRESHOLD_MINUTES = 20; // Consider stuck after 20 minutes
    const now = new Date();
    
    let recoveredAgents = 0;
    const recoveryLog = [];

    for (const agentStatus of allAgentStatuses) {
      if (!agentStatus.is_running || !agentStatus.last_run_start) continue;

      const runningFor = (now - new Date(agentStatus.last_run_start)) / 1000 / 60;
      
      if (runningFor > STUCK_THRESHOLD_MINUTES) {
        console.log(`⚠️ Agent ${agentStatus.agent_name} stuck for ${Math.floor(runningFor)} minutes - resetting`);
        
        await db.entities.AgentRunStatus.update(agentStatus.id, {
          is_running: false,
          last_run_end: now.toISOString(),
          last_error: `נתקע ${Math.floor(runningFor)} דקות - אופסה אוטומטית ע"י Health Monitor`,
          current_activity: null,
          focused_candidate_name: null,
          focused_job_title: null
        });

        recoveryLog.push({
          agent_name: agentStatus.agent_name,
          stuck_duration_minutes: Math.floor(runningFor),
          last_activity: agentStatus.current_activity,
          recovered_at: now.toISOString()
        });

        recoveredAgents++;

        // Log to system activity
        await db.entities.SystemActivityLog.create({
          actor_type: 'system',
          actor_name: 'health_monitor',
          action_type: 'agent_recovery',
          action_description: `⚠️ ${agentStatus.agent_name} נתקע ${Math.floor(runningFor)} דקות ואופסה. רביב - בדוק לוגים`,
          status: 'warning',
          details: JSON.stringify({ 
            stuck_duration_minutes: Math.floor(runningFor), 
            last_activity: agentStatus.current_activity 
          })
        });
      }
    }

    console.log(`✅ Health Monitor completed: ${recoveredAgents} agents recovered`);

    return Response.json({
      success: true,
      agents_checked: allAgentStatuses.length,
      agents_recovered: recoveredAgents,
      recovery_log: recoveryLog
    });

  } catch (error) {
    console.error('Health Monitor Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});