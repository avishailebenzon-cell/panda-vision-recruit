import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Auto-Activate Recruitment Agents
 * מפעיל סוכן אחד בלבד בכל ריצה - הסוכן הכי "מיושן"
 * מונע Rate Limit על ידי מניעת הפעלה מקבילית של מרובה סוכנים
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const now = new Date();
    const results = {
      timestamp: now.toISOString(),
      activated: [],
      already_running: [],
      errors: []
    };
    
    console.log('=== AUTO-ACTIVATE RECRUITMENT AGENTS (single agent per run) ===');
    
    // All recruitment agents
    const recruitmentAgents = [
      { key: 'naama', name: 'נעמה - מומחית תוכנה', function: 'runNaamaAgent' },
      { key: 'alik', name: 'אליק - מומחה אלקטרוניקה', function: 'runAlikAgent' },
      { key: 'itay', name: 'איתי - מומחה IT', function: 'runItayAgent' },
      { key: 'lior', name: 'ליאור - מומחה הנדסת מערכת', function: 'runLiorAgent' },
      { key: 'ofir', name: 'אופיר - מומחה הנדסת מכונות', function: 'runOfirAgent' },
      { key: 'gc', name: 'GC - סוכן כללי', function: 'runGcAgent' },
      { key: 'rami', name: 'רמי - מומחה רמה 1', function: 'runRamiAgent' },
      { key: 'meni', name: 'מני - סוכן יצירתי', function: 'runMeniAgent' }
    ];

    const defaultIntervals = {
      naama: 8, alik: 8, itay: 8, lior: 10,
      ofir: 10, gc: 12, rami: 8, meni: 12
    };
    
    // Get schedules and run statuses
    const [schedules, runStatuses] = await Promise.all([
      base44.asServiceRole.entities.AgentSchedule.filter({ 
        agent_name: { $in: recruitmentAgents.map(a => a.key) } 
      }),
      base44.asServiceRole.entities.AgentRunStatus.filter({ 
        agent_name: { $in: recruitmentAgents.map(a => a.key) } 
      })
    ]);
    
    // Find the SINGLE most overdue agent — one per run to avoid Rate Limit
    let mostOverdueAgent = null;
    let maxOverdueHours = 0;

    for (const agent of recruitmentAgents) {
      const schedule = schedules.find(s => s.agent_name === agent.key);
      const runStatus = runStatuses.find(r => r.agent_name === agent.key);
      
      // Skip if disabled
      if (schedule && !schedule.is_enabled) {
        console.log(`⏸️ ${agent.name} - מושבת בתזמון`);
        continue;
      }
      
      // Skip if already running
      if (runStatus?.is_running) {
        console.log(`✅ ${agent.name} - כבר רץ`);
        results.already_running.push(agent.name);
        continue;
      }
      
      const intervalHours = schedule?.interval_hours || defaultIntervals[agent.key] || 8;
      const lastRun = runStatus?.last_run_end || schedule?.last_run_time;
      const hoursSinceLastRun = lastRun ? (now - new Date(lastRun)) / (1000 * 60 * 60) : 999;

      if (hoursSinceLastRun >= intervalHours) {
        const overdueBy = hoursSinceLastRun - intervalHours;
        if (overdueBy > maxOverdueHours) {
          maxOverdueHours = overdueBy;
          mostOverdueAgent = { agent, schedule, intervalHours, hoursSinceLastRun };
        }
      } else {
        console.log(`⏰ ${agent.name} - יריץ בעוד ${(intervalHours - hoursSinceLastRun).toFixed(1)} שעות`);
      }
    }

    // Activate only the single most overdue agent this run
    if (mostOverdueAgent) {
      const { agent, schedule, intervalHours, hoursSinceLastRun } = mostOverdueAgent;
      try {
        console.log(`🚀 מפעיל ${agent.name} (${hoursSinceLastRun.toFixed(1)} שעות מאז ריצה אחרונה, פרק זמן: ${intervalHours}ש')`);
        await base44.asServiceRole.functions.invoke(agent.function, {});
        if (schedule?.id) {
          await base44.asServiceRole.entities.AgentSchedule.update(schedule.id, {
            last_run_time: now.toISOString()
          });
        }
        results.activated.push({
          agent: agent.name,
          hours_since_last_run: hoursSinceLastRun.toFixed(1),
          interval: intervalHours
        });
        console.log(`✅ ${agent.name} הופעל בהצלחה`);
      } catch (error) {
        console.error(`❌ שגיאה בהפעלת ${agent.name}:`, error.message);
        results.errors.push({ agent: agent.name, error: error.message });
      }
    } else {
      console.log('✅ כל הסוכנים עדכניים - אין צורך בהפעלה');
    }
    
    // Log activity
    if (results.activated.length > 0 || results.errors.length > 0) {
      await base44.asServiceRole.entities.SystemActivityLog.create({
        actor_type: 'system',
        actor_name: 'auto_activator',
        action_type: 'schedule_run',
        action_description: `הפעלה אוטומטית של סוכן: ${results.activated.map(a => a.agent).join(', ') || 'אין'}`,
        status: results.errors.length > 0 ? 'partial' : 'success',
        details: JSON.stringify(results)
      });
    }
    
    return Response.json({
      success: true,
      summary: `${results.activated.length} סוכנים הופעלו, ${results.already_running.length} כבר רצים, ${results.errors.length} שגיאות`,
      ...results
    });
    
  } catch (error) {
    console.error('Critical error in auto-activate:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});