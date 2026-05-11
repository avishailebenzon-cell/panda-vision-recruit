import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Check for test mode
    let testMode = false;
    try {
      const body = await req.json();
      testMode = body?.test_mode === true;
    } catch (e) {
      // No body or invalid JSON - not test mode
    }
    
    // Get current time in Israel
    const now = new Date();
    const israelTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
    const currentDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][israelTime.getDay()];
    const currentHour = israelTime.getHours();
    const currentMinute = israelTime.getMinutes();
    const roundedMinute = Math.floor(currentMinute / 30) * 30;
    const currentTime = `${currentHour.toString().padStart(2, '0')}:${roundedMinute.toString().padStart(2, '0')}`;
    const currentTimeHourOnly = `${currentHour.toString().padStart(2, '0')}:00`;
    // Also match exact time for better precision (e.g., 09:00 matches if current is 09:00-09:29)
    const currentTimeExact = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
    
    const results = {
      timestamp: israelTime.toISOString(),
      currentDay,
      currentTime,
      currentTimeHourOnly,
      testMode,
      actions: []
    };

    // Check Master Switch first (skip in test mode)
    let masterEnabled = true;
    if (!testMode) {
      try {
        const masterSchedules = await base44.asServiceRole.entities.AgentSchedule.filter({ agent_name: 'master' });
        if (masterSchedules.length > 0 && masterSchedules[0].is_enabled === false) {
          masterEnabled = false;
          results.actions.push({ type: 'master_switch', status: 'disabled', message: 'המפסק הראשי כבוי - כל האוטומציות מושבתות' });
        }
      } catch (e) {
        // If can't check master, assume enabled
      }

      if (!masterEnabled) {
        return Response.json({ success: true, ...results });
      }
    }

    // ============ RAVIV'S LOAD BALANCING - DISABLED ============
    // Rotation mechanism removed - all enabled agents now run continuously based on their interval

    // ============ CARMIT'S SYSTEM RULE - AT LEAST ONE RECRUITMENT AGENT MUST BE ACTIVE ============
    if (!testMode) {
      try {
        const recruitmentAgents = ['naama', 'dganit', 'alik', 'itay', 'rami', 'lior', 'ofir', 'gc', 'meni'];
        const agentSchedules = await base44.asServiceRole.entities.AgentSchedule.filter({
          agent_name: { $in: recruitmentAgents }
        });
        
        // Check if at least one is enabled
        const activeAgents = agentSchedules.filter(s => s.is_enabled === true);
        
        if (activeAgents.length === 0) {
          console.log('🚨 CARMIT ALERT: No recruitment agents are active! Activating the one that ran longest ago...');
          
          // Find the agent with the oldest last_run_time
          let oldestAgent = null;
          let oldestTime = new Date();
          
          for (const schedule of agentSchedules) {
            const lastRun = schedule.last_run_time ? new Date(schedule.last_run_time) : new Date('2000-01-01');
            if (lastRun < oldestTime) {
              oldestTime = lastRun;
              oldestAgent = schedule;
            }
          }
          
          if (oldestAgent) {
            // Activate this agent
            await base44.asServiceRole.entities.AgentSchedule.update(oldestAgent.id, {
              is_enabled: true
            });
            
            const agentNames = {
              naama: 'נעמה',
              dganit: 'דגנית',
              alik: 'אליק', 
              itay: 'איתי',
              rami: 'רמי',
              lior: 'ליאור',
              ofir: 'אופיר',
              gc: 'GC',
              meni: 'מני'
            };
            
            const agentDisplayName = agentNames[oldestAgent.agent_name] || oldestAgent.agent_name;
            
            // Log Carmit's action
            await base44.asServiceRole.entities.SystemActivityLog.create({
              actor_type: 'agent',
              actor_name: 'carmit',
              actor_image: 'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=40&h=40&fit=crop&crop=face',
              action_type: 'agent_auto_enabled',
              action_description: `כרמית הפעילה את ${agentDisplayName} - אין סוכנים פעילים והוא לא עבד הכי הרבה זמן`,
              status: 'success',
              details: JSON.stringify({ 
                agent_activated: oldestAgent.agent_name,
                last_run: oldestAgent.last_run_time,
                reason: 'no_active_recruitment_agents'
              })
            });
            
            results.actions.push({ 
              type: 'carmit_system_rule', 
              status: 'agent_activated',
              agent: oldestAgent.agent_name,
              message: `כרמית הפעילה את ${agentDisplayName} כדי להבטיח שיש תמיד סוכן פעיל`
            });
            
            console.log(`✅ CARMIT: Activated ${agentDisplayName} (last ran: ${oldestAgent.last_run_time || 'never'})`);
          }
        } else {
          results.actions.push({ 
            type: 'carmit_system_rule', 
            status: 'ok',
            activeAgents: activeAgents.length,
            message: `${activeAgents.length} סוכנים פעילים - הכל תקין`
          });
        }
      } catch (e) {
        console.error('Error in Carmit system rule:', e);
        results.actions.push({ type: 'carmit_system_rule', status: 'error', error: e.message });
      }
    }

    // Helper to check if should run (respects test mode)
    const shouldRun = (schedule, checkDay, checkTime) => {
      if (testMode) return true; // In test mode, always run
      return schedule?.is_enabled && 
             schedule.days?.includes(checkDay) && 
             schedule.time === checkTime;
    };

    // ============ PIPEDRIVE SYNC ============

    // Pipedrive Organizations
    try {
      const orgsSchedules = await base44.asServiceRole.entities.PipedriveSyncSchedule.filter({ sync_type: 'organizations' });
      const orgsSchedule = orgsSchedules[0];

      if (testMode || (orgsSchedule?.is_enabled && 
          orgsSchedule?.days?.includes(currentDay) && 
          orgsSchedule?.time === currentTime)) {

        results.actions.push({ type: 'pipedrive_organizations', status: 'triggered' });
        await base44.asServiceRole.functions.invoke('syncPipedriveOrganizations', {});
        results.actions[results.actions.length - 1].status = 'success';
      }
    } catch (e) {
      results.actions.push({ type: 'pipedrive_organizations', status: 'error', error: e.message });
    }

    // Pipedrive Jobs
    try {
      const jobsSchedules = await base44.asServiceRole.entities.PipedriveSyncSchedule.filter({ sync_type: 'jobs' });
      const jobsSchedule = jobsSchedules[0];

      if (testMode || (jobsSchedule?.is_enabled && 
          jobsSchedule?.days?.includes(currentDay) && 
          jobsSchedule?.time === currentTime)) {

        results.actions.push({ type: 'pipedrive_jobs', status: 'triggered' });
        await base44.asServiceRole.functions.invoke('syncPipedriveJobs', {});
        results.actions[results.actions.length - 1].status = 'success';

        // After job sync, also sync contacts
        results.actions.push({ type: 'pipedrive_contacts', status: 'triggered' });
        await base44.asServiceRole.functions.invoke('syncContactsToPipedrive', {});
        results.actions[results.actions.length - 1].status = 'success';
      }
    } catch (e) {
      results.actions.push({ type: 'pipedrive_jobs', status: 'error', error: e.message });
    }

    // ============ HILA - JOB DISTRIBUTION ============
    // NOTE: Hila (employees + candidates) is now handled by dedicated weekly automations:
    // - scheduledHilaProcess (employees)
    // - scheduledHilaCandidatesProcess (candidates)
    // Do NOT invoke here to avoid double-running.

    // ============ ELAD - CLIENT DATA CHECK ============
    try {
      const eladSchedules = await base44.asServiceRole.entities.EladSchedule.list();
      const eladSchedule = eladSchedules[0];
      
      // Check if we already ran today at the scheduled time
      const lastRun = eladSchedule?.last_run_time ? new Date(eladSchedule.last_run_time) : null;
      const today = new Date(israelTime.getFullYear(), israelTime.getMonth(), israelTime.getDate());
      const lastRunDate = lastRun ? new Date(lastRun.getFullYear(), lastRun.getMonth(), lastRun.getDate()) : null;
      const alreadyRanToday = lastRunDate && lastRunDate.getTime() === today.getTime();
      
      if (testMode || (eladSchedule?.is_enabled && 
          eladSchedule?.days?.includes(currentDay) && 
          eladSchedule?.time === currentTimeHourOnly &&
          !alreadyRanToday)) {
        
        results.actions.push({ type: 'elad_client_check', status: 'triggered' });
        await base44.asServiceRole.functions.invoke('runEladAgent', {});
        results.actions[results.actions.length - 1].status = 'success';
      }
    } catch (e) {
      results.actions.push({ type: 'elad_client_check', status: 'error', error: e.message });
    }

    // ============ RAVIV - SYSTEM MONITORING ============
    try {
      const ravivSchedules = await base44.asServiceRole.entities.AgentSchedule.filter({ agent_name: 'raviv' });
      const ravivSchedule = ravivSchedules[0];
      
      if (testMode || (ravivSchedule?.is_enabled && ravivSchedule?.interval_hours)) {
        // Check if enough time has passed since last run (skip check in test mode)
        const lastRun = ravivSchedule?.last_run_time ? new Date(ravivSchedule.last_run_time) : null;
        const hoursSinceLastRun = lastRun ? (now - lastRun) / (1000 * 60 * 60) : Infinity;
        
        if (testMode || hoursSinceLastRun >= (ravivSchedule?.interval_hours || 5)) {
          results.actions.push({ type: 'raviv_monitoring', status: 'triggered' });
          await base44.asServiceRole.functions.invoke('runRavivAgent', {});
          
          // Update last run time (skip in test mode)
          if (!testMode && ravivSchedule?.id) {
            await base44.asServiceRole.entities.AgentSchedule.update(ravivSchedule.id, {
              last_run_time: now.toISOString()
            });
          }
          
          results.actions[results.actions.length - 1].status = 'success';
        }
      }
    } catch (e) {
      results.actions.push({ type: 'raviv_monitoring', status: 'error', error: e.message });
    }

    // ============ NAAMA - CANDIDATE MATCHING ============
    try {
      const naamaSchedules = await base44.asServiceRole.entities.AgentSchedule.filter({ agent_name: 'naama' });
      const naamaSchedule = naamaSchedules[0];

      // Check schedule using Days + Interval (Hybrid mechanism)
      const naamaLastRun = naamaSchedule?.last_run_time ? new Date(naamaSchedule.last_run_time) : null;
      const naamaHoursSinceLastRun = naamaLastRun ? (now - naamaLastRun) / (1000 * 60 * 60) : Infinity;

      if (testMode || (naamaSchedule?.is_enabled && 
          (!naamaSchedule?.days?.length || naamaSchedule.days.includes(currentDay)) && 
          naamaHoursSinceLastRun >= (naamaSchedule?.interval_hours || 4))) {

        results.actions.push({ type: 'naama_matching', status: 'triggered' });
        await base44.asServiceRole.functions.invoke('runNaamaAgent', {});

        // Update last run time
        if (!testMode && naamaSchedule?.id) {
          await base44.asServiceRole.entities.AgentSchedule.update(naamaSchedule.id, {
            last_run_time: now.toISOString()
          });
        }

        results.actions[results.actions.length - 1].status = 'success';
      }
    } catch (e) {
      results.actions.push({ type: 'naama_matching', status: 'error', error: e.message });
    }



    // ============ RAMI - LEVEL 1 SPECIALIST ============
    try {
      const ramiSchedules = await base44.asServiceRole.entities.AgentSchedule.filter({ agent_name: 'rami' });
      const ramiSchedule = ramiSchedules[0];

      // Check schedule using Days + Interval (Hybrid mechanism)
      const ramiLastRun = ramiSchedule?.last_run_time ? new Date(ramiSchedule.last_run_time) : null;
      const ramiHoursSinceLastRun = ramiLastRun ? (now - ramiLastRun) / (1000 * 60 * 60) : Infinity;

      if (testMode || (ramiSchedule?.is_enabled && 
          (!ramiSchedule?.days?.length || ramiSchedule.days.includes(currentDay)) && 
          ramiHoursSinceLastRun >= (ramiSchedule?.interval_hours || 4))) {

        results.actions.push({ type: 'rami_level1_specialist', status: 'triggered' });
        await base44.asServiceRole.functions.invoke('runRamiAgent', {});

        // Update last run time
        if (!testMode && ramiSchedule?.id) {
          await base44.asServiceRole.entities.AgentSchedule.update(ramiSchedule.id, {
            last_run_time: now.toISOString()
          });
        }

        results.actions[results.actions.length - 1].status = 'success';
      }
    } catch (e) {
      results.actions.push({ type: 'rami_level1_specialist', status: 'error', error: e.message });
    }

    // ============ YOTAM - HOT CANDIDATES ============
    try {
      const yotamSchedules = await base44.asServiceRole.entities.AgentSchedule.filter({ agent_name: 'yotam' });
      const yotamSchedule = yotamSchedules[0];

      // Check schedule using Days + Interval (Hybrid mechanism)
      const yotamLastRun = yotamSchedule?.last_run_time ? new Date(yotamSchedule.last_run_time) : null;
      const yotamHoursSinceLastRun = yotamLastRun ? (now - yotamLastRun) / (1000 * 60 * 60) : Infinity;

      if (testMode || (yotamSchedule?.is_enabled && 
          (!yotamSchedule?.days?.length || yotamSchedule.days.includes(currentDay)) && 
          yotamHoursSinceLastRun >= (yotamSchedule?.interval_hours || 5))) {

        results.actions.push({ type: 'yotam_hot_candidates', status: 'triggered' });
        await base44.asServiceRole.functions.invoke('runYotamAgent', {});

        // Update last run time
        if (!testMode && yotamSchedule?.id) {
          await base44.asServiceRole.entities.AgentSchedule.update(yotamSchedule.id, {
            last_run_time: now.toISOString()
          });
        }

        results.actions[results.actions.length - 1].status = 'success';
      }
    } catch (e) {
      results.actions.push({ type: 'yotam_hot_candidates', status: 'error', error: e.message });
    }

    // ============ MENI - CREATIVE MATCHER ============
    try {
      const meniSchedules = await base44.asServiceRole.entities.AgentSchedule.filter({ agent_name: 'meni' });
      const meniSchedule = meniSchedules[0];

      // Check schedule using Days + Interval (Hybrid mechanism)
      const meniLastRun = meniSchedule?.last_run_time ? new Date(meniSchedule.last_run_time) : null;
      const meniHoursSinceLastRun = meniLastRun ? (now - meniLastRun) / (1000 * 60 * 60) : Infinity;

      if (testMode || (meniSchedule?.is_enabled && 
          (!meniSchedule?.days?.length || meniSchedule.days.includes(currentDay)) && 
          meniHoursSinceLastRun >= (meniSchedule?.interval_hours || 6))) {

        results.actions.push({ type: 'meni_creative_matcher', status: 'triggered' });
        await base44.asServiceRole.functions.invoke('runMeniAgent', {});

        // Update last run time
        if (!testMode && meniSchedule?.id) {
          await base44.asServiceRole.entities.AgentSchedule.update(meniSchedule.id, {
            last_run_time: now.toISOString()
          });
        }

        results.actions[results.actions.length - 1].status = 'success';
      }
    } catch (e) {
      results.actions.push({ type: 'meni_creative_matcher', status: 'error', error: e.message });
    }

    // ============ LIOR - SYSTEM ENGINEERING SPECIALIST ============
    try {
      const liorSchedules = await base44.asServiceRole.entities.AgentSchedule.filter({ agent_name: 'lior' });
      const liorSchedule = liorSchedules[0];

      // Check schedule using Days + Interval (Hybrid mechanism)
      const liorLastRun = liorSchedule?.last_run_time ? new Date(liorSchedule.last_run_time) : null;
      const liorHoursSinceLastRun = liorLastRun ? (now - liorLastRun) / (1000 * 60 * 60) : Infinity;

      if (testMode || (liorSchedule?.is_enabled && 
          (!liorSchedule?.days?.length || liorSchedule.days.includes(currentDay)) && 
          liorHoursSinceLastRun >= (liorSchedule?.interval_hours || 5))) {

        results.actions.push({ type: 'lior_system_engineering', status: 'triggered' });
        await base44.asServiceRole.functions.invoke('runLiorAgent', {});

        // Update last run time
        if (!testMode && liorSchedule?.id) {
          await base44.asServiceRole.entities.AgentSchedule.update(liorSchedule.id, {
            last_run_time: now.toISOString()
          });
        }

        results.actions[results.actions.length - 1].status = 'success';
      }
    } catch (e) {
      results.actions.push({ type: 'lior_system_engineering', status: 'error', error: e.message });
    }

    // ============ DGANIT - QA SPECIALIST ============
    try {
      const dganitSchedules = await base44.asServiceRole.entities.AgentSchedule.filter({ agent_name: 'dganit' });
      const dganitSchedule = dganitSchedules[0];

      const dganitLastRun = dganitSchedule?.last_run_time ? new Date(dganitSchedule.last_run_time) : null;
      const dganitHoursSinceLastRun = dganitLastRun ? (now - dganitLastRun) / (1000 * 60 * 60) : Infinity;

      if (testMode || (dganitSchedule?.is_enabled && 
          (!dganitSchedule?.days?.length || dganitSchedule.days.includes(currentDay)) && 
          dganitHoursSinceLastRun >= (dganitSchedule?.interval_hours || 5))) {

        results.actions.push({ type: 'dganit_qa', status: 'triggered' });
        await base44.asServiceRole.functions.invoke('runDganitAgent', {});

        if (!testMode && dganitSchedule?.id) {
          await base44.asServiceRole.entities.AgentSchedule.update(dganitSchedule.id, {
            last_run_time: now.toISOString()
          });
        }

        results.actions[results.actions.length - 1].status = 'success';
      }
    } catch (e) {
      results.actions.push({ type: 'dganit_qa', status: 'error', error: e.message });
    }

    // ============ ALIK - ELECTRONICS SPECIALIST ============
    try {
      const alikSchedules = await base44.asServiceRole.entities.AgentSchedule.filter({ agent_name: 'alik' });
      const alikSchedule = alikSchedules[0];

      // Check schedule using Days + Interval (Hybrid mechanism)
      const alikLastRun = alikSchedule?.last_run_time ? new Date(alikSchedule.last_run_time) : null;
      const alikHoursSinceLastRun = alikLastRun ? (now - alikLastRun) / (1000 * 60 * 60) : Infinity;

      if (testMode || (alikSchedule?.is_enabled && 
          (!alikSchedule?.days?.length || alikSchedule.days.includes(currentDay)) && 
          alikHoursSinceLastRun >= (alikSchedule?.interval_hours || 4))) {

        results.actions.push({ type: 'alik_electronics', status: 'triggered' });
        await base44.asServiceRole.functions.invoke('runAlikAgent', {});

        // Update last run time
        if (!testMode && alikSchedule?.id) {
          await base44.asServiceRole.entities.AgentSchedule.update(alikSchedule.id, {
            last_run_time: now.toISOString()
          });
        }

        results.actions[results.actions.length - 1].status = 'success';
      }
    } catch (e) {
      results.actions.push({ type: 'alik_electronics', status: 'error', error: e.message });
    }

    // ============ ITAY - IT SPECIALIST ============
    try {
      const itaySchedules = await base44.asServiceRole.entities.AgentSchedule.filter({ agent_name: 'itay' });
      const itaySchedule = itaySchedules[0];

      // Check schedule using Days + Interval (Hybrid mechanism)
      const itayLastRun = itaySchedule?.last_run_time ? new Date(itaySchedule.last_run_time) : null;
      const itayHoursSinceLastRun = itayLastRun ? (now - itayLastRun) / (1000 * 60 * 60) : Infinity;

      if (testMode || (itaySchedule?.is_enabled && 
          (!itaySchedule?.days?.length || itaySchedule.days.includes(currentDay)) && 
          itayHoursSinceLastRun >= (itaySchedule?.interval_hours || 4))) {

        results.actions.push({ type: 'itay_it', status: 'triggered' });
        await base44.asServiceRole.functions.invoke('runItayAgent', {});

        // Update last run time
        if (!testMode && itaySchedule?.id) {
          await base44.asServiceRole.entities.AgentSchedule.update(itaySchedule.id, {
            last_run_time: now.toISOString()
          });
        }

        results.actions[results.actions.length - 1].status = 'success';
      }
    } catch (e) {
      results.actions.push({ type: 'itay_it', status: 'error', error: e.message });
    }

    // ============ OFIR - MECHANICAL ENGINEERING SPECIALIST ============
    try {
      const ofirSchedules = await base44.asServiceRole.entities.AgentSchedule.filter({ agent_name: 'ofir' });
      const ofirSchedule = ofirSchedules[0];

      // Check schedule using Days + Interval (Hybrid mechanism)
      const ofirLastRun = ofirSchedule?.last_run_time ? new Date(ofirSchedule.last_run_time) : null;
      const ofirHoursSinceLastRun = ofirLastRun ? (now - ofirLastRun) / (1000 * 60 * 60) : Infinity;

      if (testMode || (ofirSchedule?.is_enabled && 
          (!ofirSchedule?.days?.length || ofirSchedule.days.includes(currentDay)) && 
          ofirHoursSinceLastRun >= (ofirSchedule?.interval_hours || 5))) {

        results.actions.push({ type: 'ofir_mechanical', status: 'triggered' });
        await base44.asServiceRole.functions.invoke('runOfirAgent', {});

        // Update last run time
        if (!testMode && ofirSchedule?.id) {
          await base44.asServiceRole.entities.AgentSchedule.update(ofirSchedule.id, {
            last_run_time: now.toISOString()
          });
        }

        results.actions[results.actions.length - 1].status = 'success';
      }
    } catch (e) {
      results.actions.push({ type: 'ofir_mechanical', status: 'error', error: e.message });
    }

    // ============ GC - GENERAL COLLECTOR ============
    try {
      const gcSchedules = await base44.asServiceRole.entities.AgentSchedule.filter({ agent_name: 'gc' });
      const gcSchedule = gcSchedules[0];

      // Check schedule using Days + Interval (Hybrid mechanism)
      const gcLastRun = gcSchedule?.last_run_time ? new Date(gcSchedule.last_run_time) : null;
      const gcHoursSinceLastRun = gcLastRun ? (now - gcLastRun) / (1000 * 60 * 60) : Infinity;

      if (testMode || (gcSchedule?.is_enabled && 
          (!gcSchedule?.days?.length || gcSchedule.days.includes(currentDay)) && 
          gcHoursSinceLastRun >= (gcSchedule?.interval_hours || 6))) {

        results.actions.push({ type: 'gc_general', status: 'triggered' });
        await base44.asServiceRole.functions.invoke('runGcAgent', {});

        // Update last run time
        if (!testMode && gcSchedule?.id) {
          await base44.asServiceRole.entities.AgentSchedule.update(gcSchedule.id, {
            last_run_time: now.toISOString()
          });
        }

        results.actions[results.actions.length - 1].status = 'success';
      }
    } catch (e) {
      results.actions.push({ type: 'gc_general', status: 'error', error: e.message });
    }

    // ============ CARMIT - AUTO TASK CREATION (runs continuously via master) ============
    try {
      const carmitSchedules = await base44.asServiceRole.entities.AgentRunStatus.filter({ agent_name: 'carmit' });
      const carmitStatus = carmitSchedules[0];
      
      // Don't start if already running
      const isRunning = carmitStatus?.is_running === true;
      const lastRunEnd = carmitStatus?.last_run_end ? new Date(carmitStatus.last_run_end) : null;
      const minutesSinceLastRun = lastRunEnd ? (now - lastRunEnd) / (1000 * 60) : Infinity;
      
      // Run if: not currently running AND (never ran OR last run ended 30+ minutes ago)
      if (!testMode && !isRunning && minutesSinceLastRun >= 30) {
        results.actions.push({ type: 'carmit_tasks', status: 'triggered' });
        base44.asServiceRole.functions.invoke('runCarmitAgent', {}); // Fire and forget
        results.actions[results.actions.length - 1].status = 'success';
      } else if (!testMode) {
        const reason = isRunning ? 'כרמית כבר רצה כרגע' : `${Math.floor(minutesSinceLastRun)} דקות מהריצה האחרונה (פחות מ-30)`;
        results.actions.push({ type: 'carmit_tasks', status: 'skipped', reason });
      }
    } catch (e) {
      results.actions.push({ type: 'carmit_tasks', status: 'error', error: e.message });
    }

    // ============ ROTEM - WHATSAPP MESSAGE POLLING (Every run) ============
    try {
      // Poll for new WhatsApp messages every time the scheduler runs
      // This ensures quick response to incoming messages
      results.actions.push({ type: 'rotem_whatsapp_poll', status: 'triggered' });
      await base44.asServiceRole.functions.invoke('pollGreenApiMessages', {});
      results.actions[results.actions.length - 1].status = 'success';
    } catch (e) {
      results.actions.push({ type: 'rotem_whatsapp_poll', status: 'error', error: e.message });
    }

    // ============ RAVIV ALERTS RESET - DAILY AT 07:00 ============
    try {
      // Reset Raviv alerts for Carmit every day at 07:00
      if (!testMode && currentHour === 7 && currentMinute < 30) {
        // Check if we already reset today
        const ravivSchedules = await base44.asServiceRole.entities.AgentSchedule.filter({ agent_name: 'raviv' });
        const ravivSchedule = ravivSchedules[0];
        
        const lastReset = ravivSchedule?.last_alerts_reset ? new Date(ravivSchedule.last_alerts_reset) : null;
        const today = new Date(israelTime.getFullYear(), israelTime.getMonth(), israelTime.getDate());
        const lastResetDate = lastReset ? new Date(lastReset.getFullYear(), lastReset.getMonth(), lastReset.getDate()) : null;
        
        // Only reset if we haven't reset today
        if (!lastResetDate || lastResetDate < today) {
          results.actions.push({ type: 'raviv_alerts_reset', status: 'triggered' });
          
          // Reset Raviv run status to clear alert counts
          const runStatuses = await base44.asServiceRole.entities.AgentRunStatus.filter({ agent_name: 'raviv' });
          if (runStatuses[0]) {
            await base44.asServiceRole.entities.AgentRunStatus.update(runStatuses[0].id, {
              matches_created: 0,
              last_error: null
            });
          }
          
          // Update last reset time
          if (ravivSchedule?.id) {
            await base44.asServiceRole.entities.AgentSchedule.update(ravivSchedule.id, {
              last_alerts_reset: now.toISOString()
            });
          }
          
          results.actions[results.actions.length - 1].status = 'success';
        }
      }
    } catch (e) {
      results.actions.push({ type: 'raviv_alerts_reset', status: 'error', error: e.message });
    }

    // ============ INBAR - EVENT REMINDERS (DAILY AT 08:00) ============
    try {
      // Check for upcoming events and send reminders every day at 08:00
      if (testMode || (currentHour === 8 && currentMinute < 30)) {
        results.actions.push({ type: 'inbar_event_reminders', status: 'triggered' });
        await base44.asServiceRole.functions.invoke('checkInbarEventReminders', {});
        results.actions[results.actions.length - 1].status = 'success';
      }
    } catch (e) {
      results.actions.push({ type: 'inbar_event_reminders', status: 'error', error: e.message });
    }

    // ============ CLOSE EXPIRED JOBS (DAILY AT 06:00) ============
    try {
      // Close jobs whose deadline has passed, delete matches, and delete Pipedrive deals
      if (testMode || (currentHour === 6 && currentMinute < 30)) {
        results.actions.push({ type: 'close_expired_jobs', status: 'triggered' });
        await base44.asServiceRole.functions.invoke('closeExpiredJobs', {});
        results.actions[results.actions.length - 1].status = 'success';
      }
    } catch (e) {
      results.actions.push({ type: 'close_expired_jobs', status: 'error', error: e.message });
    }

    // ============ EITAN - EMPLOYEE SYNC & ONBOARDING FORM SYNC ============
    try {
      const eitanSchedules = await base44.asServiceRole.entities.EitanSchedule.list();
      const eitanSchedule = eitanSchedules[0];

      if (eitanSchedule?.is_enabled) {
        // Check if it's time to sync
        const lastRun = eitanSchedule?.last_run_time ? new Date(eitanSchedule.last_run_time) : null;
        const hoursSinceLastRun = lastRun ? (now - lastRun) / (1000 * 60 * 60) : Infinity;
        
        const shouldSync = testMode || (
          eitanSchedule.sync_frequency === 'daily' 
            ? hoursSinceLastRun >= 24
            : (eitanSchedule.day_of_week === currentDay && eitanSchedule.time === currentTimeHourOnly)
        );

        if (shouldSync) {
          // NOTE: syncPipedriveEmployees (Shiri sync) removed from auto-run.
          // Shiri employee sync must be triggered manually from the management screen only.

          // Sync onboarding form - DISABLED (Google Sheets integration removed)
          // await base44.functions.invoke('syncOnboardingForm', {});
        }
      }
    } catch (e) {
      results.actions.push({ type: 'eitan_sync', status: 'error', error: e.message });
    }

    // ============ EITAN - WEEKLY REPORT ============
    try {
      const eitanSchedules = await base44.asServiceRole.entities.EitanSchedule.list();
      const eitanSchedule = eitanSchedules[0];

      if (eitanSchedule?.weekly_report_enabled) {
        const reportDay = eitanSchedule.weekly_report_day || 'sunday';
        const reportTime = eitanSchedule.weekly_report_time || '09:00';
        
        if (testMode || (currentDay === reportDay && reportTime === currentTimeHourOnly)) {
          results.actions.push({ type: 'eitan_weekly_report', status: 'triggered' });
          await base44.asServiceRole.functions.invoke('sendEitanWeeklyReport', {});
          results.actions[results.actions.length - 1].status = 'success';
        }
      }
    } catch (e) {
      results.actions.push({ type: 'eitan_weekly_report', status: 'error', error: e.message });
    }

    // ============ EMAIL SCAN - STUCK SCANNER SAFETY RESET ============
    // emailScannerManager runs every 2 min, but if its automation stops,
    // we need a fallback. Check for stuck scanner here every master run.
    try {
      const scanStatuses = await base44.asServiceRole.entities.MailScanStatus.list();
      const scanStatus = scanStatuses[0];
      if (scanStatus) {
        const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
        
        if (scanStatus.is_running && scanStatus.last_run_time && new Date(scanStatus.last_run_time) < tenMinutesAgo) {
          console.log('⚠️ MASTER: Detected stuck email scanner - resetting is_running flag');
          await base44.asServiceRole.entities.MailScanStatus.update(scanStatus.id, {
            is_running: false,
            last_error: 'אופס אוטומטי על ידי scheduledMasterProcess (סורק תקוע מעל 10 דקות)',
            current_processing_file: null,
            current_scanner_message: null
          });
          results.actions.push({ type: 'scanner_stuck_reset', status: 'success', message: 'אופס דגל סורק תקוע' });
        }
      }
    } catch (e) {
      console.error('Error in stuck scanner check:', e.message);
    }

    // ============ DUPLICATE CANDIDATES CLEANUP (SUNDAYS AT 03:00) ============
    try {
      const cleanupConfig = await base44.asServiceRole.entities.AgentConfig.filter({ config_key: 'duplicate_cleanup_schedule' });
      if (cleanupConfig.length > 0 && cleanupConfig[0].config_value?.enabled) {
        const settings = cleanupConfig[0].config_value;
        const runDays = settings.run_days || ['ראשון'];
        const runHour = settings.run_hour || '03:00';
        
        // Convert Hebrew day to English
        const dayMap = {
          'ראשון': 'sunday',
          'שני': 'monday',
          'שלישי': 'tuesday',
          'רביעי': 'wednesday',
          'חמישי': 'thursday',
          'שישי': 'friday',
          'שבת': 'saturday'
        };
        
        const englishDays = runDays.map(d => dayMap[d] || d);
        const shouldRunCleanup = englishDays.includes(currentDay) && runHour === currentTimeHourOnly;
        
        if (testMode || shouldRunCleanup) {
          results.actions.push({ type: 'duplicate_cleanup', status: 'triggered' });
          const cleanupResult = await base44.asServiceRole.functions.invoke('cleanDuplicateCandidates', {});
          
          if (cleanupResult.data?.success) {
            results.actions[results.actions.length - 1].status = 'success';
            results.actions[results.actions.length - 1].details = cleanupResult.data.summary;
          } else {
            results.actions[results.actions.length - 1].status = 'error';
            results.actions[results.actions.length - 1].error = cleanupResult.data?.error;
          }
        }
      }
    } catch (e) {
      results.actions.push({ type: 'duplicate_cleanup', status: 'error', error: e.message });
    }

    // ============ LOG ACTIVITY ============
    try {
      const triggeredActions = results.actions.filter(a => a.status !== 'disabled');
      if (triggeredActions.length > 0) {
        await base44.asServiceRole.entities.SystemActivityLog.create({
          actor_type: 'system',
          actor_name: 'master',
          action_type: 'schedule_run',
          action_description: `בדיקת תזמונים - ${triggeredActions.length} פעולות הופעלו`,
          status: triggeredActions.some(a => a.status === 'error') ? 'failed' : 'success',
          details: JSON.stringify(results)
        });
      }
    } catch (e) {
      console.error('Failed to log activity:', e);
    }

    return Response.json({
      success: true,
      ...results
    });

  } catch (error) {
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});