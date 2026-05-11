import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    console.log('🚀 Starting full scan for all agents...');

    const agents = [
      { name: 'naama', function: 'runNaamaAgent', display: 'נעמה' },
      { name: 'alik', function: 'runAlikAgent', display: 'אליק' },
      { name: 'itay', function: 'runItayAgent', display: 'איתי' },
      { name: 'lior', function: 'runLiorAgent', display: 'ליאור' },
      { name: 'ofir', function: 'runOfirAgent', display: 'אופיר' },
      { name: 'gc', function: 'runGcAgent', display: 'GC' },
      { name: 'rami', function: 'runRamiAgent', display: 'רמי' }
    ];

    const results = [];

    for (const agent of agents) {
      console.log(`📋 Processing ${agent.display}...`);
      
      try {
        const result = await base44.asServiceRole.functions.invoke(agent.function, {});
        
        results.push({
          agent: agent.display,
          success: result?.data?.success !== false,
          matchesCreated: result?.data?.matchesCreated || 0,
          jobsProcessed: result?.data?.jobsProcessed || 0,
          error: result?.data?.error || null
        });

        console.log(`✅ ${agent.display} completed: ${result?.data?.matchesCreated || 0} matches`);
        
      } catch (error) {
        console.error(`❌ ${agent.display} failed:`, error.message);
        results.push({
          agent: agent.display,
          success: false,
          error: error.message
        });
      }

      // Delay between agents to avoid overload
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Log the full scan activity
    const totalMatches = results.reduce((sum, r) => sum + (r.matchesCreated || 0), 0);
    const successfulAgents = results.filter(r => r.success).length;

    await base44.asServiceRole.entities.SystemActivityLog.create({
      actor_type: 'system',
      actor_name: 'full_scan_all_agents',
      action_type: 'other',
      action_description: `סריקה מלאה של כל הסוכנים הושלמה: ${successfulAgents}/${agents.length} סוכנים הצליחו, ${totalMatches} התאמות נוצרו`,
      status: 'success',
      details: JSON.stringify(results)
    });

    console.log(`🎯 Full scan complete! ${totalMatches} total matches created`);

    return Response.json({
      success: true,
      message: `סריקה מלאה הושלמה: ${totalMatches} התאמות נוצרו`,
      results,
      totalMatches,
      successfulAgents
    });

  } catch (error) {
    console.error('❌ Error in runAllAgentsFullScan:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});