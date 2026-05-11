import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const logs = [];
    const issues = [];
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000);

    // Helper to avoid rate limits
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    
    // 1. Check Email Scan Status (every 5 hours)
    try {
      await delay(1000); // Rate limit protection
      const mailStatuses = await base44.entities.MailScanStatus.list('-updated_date', 1);
      if (mailStatuses.length > 0) {
        const mailStatus = mailStatuses[0];
        const lastUpdate = new Date(mailStatus.updated_date);
        
        if (lastUpdate < fiveHoursAgo && !mailStatus.is_running && !mailStatus.is_reverse_running) {
          issues.push({
            type: 'email_scan',
            message: 'סריקת מיילים לא פעילה מעל 5 שעות'
          });
          
          logs.push({
            check_type: 'email_scan',
            status: 'warning',
            message: 'סריקת מיילים לא פעילה מעל 5 שעות',
            action_taken: 'נדרשת הפעלה ידנית של סריקת המיילים',
            notified_carmit: true
          });
        } else {
          logs.push({
            check_type: 'email_scan',
            status: 'success',
            message: 'סריקת מיילים פועלת תקין',
            notified_carmit: false
          });
        }
      }
    } catch (e) {
      logs.push({
        check_type: 'email_scan',
        status: 'error',
        message: `שגיאה בבדיקת סריקת מיילים: ${e.message}`,
        notified_carmit: true
      });
      issues.push({ type: 'email_scan', message: e.message });
    }

    // 2. Check Pipedrive Sync (last 24 hours)
    try {
      await delay(2000); // Rate limit protection
      const syncStatuses = await base44.entities.PipedriveSyncStatus.list('-last_run_time');
      const jobsSync = syncStatuses.find(s => s.sync_type === 'jobs');
      const orgsSync = syncStatuses.find(s => s.sync_type === 'organizations');

      // Check jobs sync
      if (jobsSync) {
        const lastRun = new Date(jobsSync.last_run_time);
        if (lastRun < twentyFourHoursAgo || jobsSync.status === 'failed') {
          issues.push({
            type: 'pipedrive_sync',
            message: 'סנכרון משרות מפייפדרייב לא תקין'
          });
          logs.push({
            check_type: 'pipedrive_sync',
            status: 'warning',
            message: 'סנכרון משרות מפייפדרייב לא רץ ב-24 שעות האחרונות או נכשל',
            action_taken: 'נדרשת הפעלה ידנית של סנכרון משרות',
            notified_carmit: true
          });
        } else {
          logs.push({
            check_type: 'pipedrive_sync',
            status: 'success',
            message: `סנכרון משרות תקין - ${jobsSync.items_synced || 0} פריטים סונכרנו`,
            notified_carmit: false
          });
        }
      }

      // Check organizations sync
      if (orgsSync) {
        const lastRun = new Date(orgsSync.last_run_time);
        if (lastRun < twentyFourHoursAgo || orgsSync.status === 'failed') {
          issues.push({
            type: 'pipedrive_sync',
            message: 'סנכרון ארגונים מפייפדרייב לא תקין'
          });
          logs.push({
            check_type: 'pipedrive_sync',
            status: 'warning',
            message: 'סנכרון ארגונים מפייפדרייב לא רץ ב-24 שעות האחרונות או נכשל',
            action_taken: 'נדרשת הפעלה ידנית של סנכרון ארגונים',
            notified_carmit: true
          });
        }
      }
    } catch (e) {
      logs.push({
        check_type: 'pipedrive_sync',
        status: 'error',
        message: `שגיאה בבדיקת סנכרון פייפדרייב: ${e.message}`,
        notified_carmit: true
      });
    }

    // 3. Check All Recruitment Agents (Naama, Alik, Itay, Lior, Ofir, Roee) AND CARMIT - Auto-restart if needed
    try {
      await delay(2000); // Rate limit protection
      const recruitmentAgents = ['naama', 'alik', 'itay', 'lior', 'ofir', 'carmit'];
      const agentStatuses = await base44.entities.AgentRunStatus.list();
      await delay(1000); // Rate limit protection
      const agentSchedules = await base44.entities.AgentSchedule.filter({ 
        agent_name: { $in: recruitmentAgents } 
      });

      // Priority: Agents with focused jobs/candidates should run first
      const agentsWithFocus = [];
      const agentsWithoutFocus = [];
      
      for (const agentName of recruitmentAgents) {
        const status = agentStatuses.find(s => s.agent_name === agentName);
        if (status?.focused_job_id || status?.focused_candidate_id) {
          agentsWithFocus.push(agentName);
        } else {
          agentsWithoutFocus.push(agentName);
        }
      }
      
      // Process agents with focus first, then others
      const orderedAgents = [...agentsWithFocus, ...agentsWithoutFocus];

      for (const agentName of orderedAgents) {
        const status = agentStatuses.find(s => s.agent_name === agentName);
        
        // For Carmit, always treat as enabled; for others, check schedule
        const schedule = agentName === 'carmit' 
          ? { is_enabled: true } 
          : agentSchedules.find(s => s.agent_name === agentName);
        
        if (status && schedule) {
          const lastRun = status.last_run_end ? new Date(status.last_run_end) : null;
          const hoursSinceRun = lastRun ? (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60) : null;
          const isStuck = status.is_running && hoursSinceRun > 2; // Running for more than 2 hours = stuck
          const hasFocus = status.focused_job_id || status.focused_candidate_id;
          
          // UPDATED: Auto-restart if:
          // 1) Enabled but stuck (running >2h)
          // 2) Enabled with focus but hasn't run in 2+ hours
          // 3) Enabled without focus but hasn't run in 12+ hours
          const needsRestart = schedule.is_enabled && (
            isStuck ||
            (hasFocus && (!lastRun || hoursSinceRun > 2)) ||
            (!hasFocus && (!lastRun || hoursSinceRun > 12))
          );
          
          if (needsRestart) {
            const agentDisplayNames = {
              naama: 'נעמה',
              alik: 'אליק',
              itay: 'איתי',
              lior: 'ליאור',
              ofir: 'אופיר',
              carmit: 'כרמית'
            };
            
            const displayName = agentDisplayNames[agentName];
            const hasFocus = status.focused_job_id || status.focused_candidate_id;
            const reason = isStuck 
              ? 'תקוע בריצה' 
              : hasFocus 
                ? 'ממוקד במשרה/מועמד ולא רץ מעל 2 שעות - עדיפות גבוהה!' 
                : 'לא רץ מעל 12 שעות';
            
            issues.push({
              type: `${agentName}_agent`,
              message: `${displayName} ${reason} - מפעיל מחדש`
            });
            
            logs.push({
              check_type: `${agentName}_agent`,
              status: 'warning',
              message: `${displayName} ${reason} - מפעיל מחדש`,
              action_taken: `הפעלה אוטומטית של ${displayName}`,
              notified_carmit: agentName !== 'carmit' // Don't notify Carmit about Carmit
            });
            
            // Auto-restart the agent
            try {
              const functionNames = {
                naama: 'runNaamaAgent',
                alik: 'runAlikAgent',
                itay: 'runItayAgent',
                lior: 'runLiorAgent',
                ofir: 'runOfirAgent',
                carmit: 'runCarmitAgent'
              };
              
              // First, if the agent is stuck, reset its status before restarting
              if (isStuck) {
                await base44.asServiceRole.entities.AgentRunStatus.update(status.id, {
                  is_running: false,
                  last_run_end: new Date().toISOString(),
                  last_error: `אופסה על ידי רביב - היה תקוע ${Math.floor(hoursSinceRun)} שעות`,
                  current_activity: null,
                  focused_candidate_name: null,
                  focused_job_title: null
                });
              }
              
              await base44.functions.invoke(functionNames[agentName], {});
              
              logs.push({
                check_type: `${agentName}_agent`,
                status: 'success',
                message: `${displayName} הופעל מחדש בהצלחה`,
                action_taken: 'הופעל אוטומטית על ידי רביב',
                notified_carmit: false
              });
              
              // Log to SystemActivityLog
              await base44.entities.SystemActivityLog.create({
                actor_type: 'agent',
                actor_name: 'raviv',
                actor_image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face',
                action_type: 'agent_auto_restart',
                action_description: `🔧 רביב הפעיל מחדש את ${displayName} - ${reason}`,
                status: 'success',
                details: JSON.stringify({ agent: agentName, reason, was_stuck: isStuck })
              });
            } catch (restartErr) {
              logs.push({
                check_type: `${agentName}_agent`,
                status: 'error',
                message: `כשלון בהפעלת ${displayName}: ${restartErr.message}`,
                action_taken: 'נדרשת התערבות ידנית',
                notified_carmit: agentName !== 'carmit'
              });
            }
          } else if (schedule.is_enabled) {
            // Agent is enabled and running properly
            const agentDisplayNames = {
              naama: 'נעמה',
              alik: 'אליק',
              itay: 'איתי',
              lior: 'ליאור',
              ofir: 'אופיר',
              carmit: 'כרמית'
            };
            
            logs.push({
              check_type: `${agentName}_agent`,
              status: 'success',
              message: `${agentDisplayNames[agentName]} פועל תקין - ${status.matches_created || 0} התאמות${hoursSinceRun ? ` (לפני ${Math.round(hoursSinceRun)} שעות)` : ''}`,
              notified_carmit: false
            });
          }
        }
      }

      // Check Roee separately (keeps existing logic)
      const roee = agentStatuses.find(s => s.agent_name === 'roee');
      if (roee) {
        const lastRun = roee.last_run_end ? new Date(roee.last_run_end) : null;
        const hoursSinceRun = lastRun ? (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60) : null;
        
        if (!lastRun || hoursSinceRun > 24) {
          issues.push({
            type: 'roee_agent',
            message: 'רועי לא רץ ב-24 שעות האחרונות'
          });
          logs.push({
            check_type: 'roee_agent',
            status: 'warning',
            message: `הסוכן רועי לא רץ ב-24 שעות האחרונות${lastRun ? ` (ריצה אחרונה: ${lastRun.toISOString()})` : ''}`,
            action_taken: 'נדרשת הפעלה ידנית של רועי',
            notified_carmit: true
          });
        } else {
          logs.push({
            check_type: 'roee_agent',
            status: 'success',
            message: `רועי פועל תקין - יצר ${roee.matches_created || 0} התאמות (לפני ${Math.round(hoursSinceRun)} שעות)`,
            notified_carmit: false
          });
        }
      }
    } catch (e) {
      logs.push({
        check_type: 'system_health',
        status: 'error',
        message: `שגיאה בבדיקת סוכנים: ${e.message}`,
        notified_carmit: true
      });
    }

    // 4. Check for Duplicate Statuses
    try {
      const statuses = await base44.entities.CandidateStatus.list();
      const statusNames = statuses.map(s => s.status_name);
      const duplicateNames = statusNames.filter((name, index) => statusNames.indexOf(name) !== index);
      
      if (duplicateNames.length > 0) {
        issues.push({
          type: 'duplicate_statuses',
          message: `נמצאו ${duplicateNames.length} מצבים כפולים`
        });
        logs.push({
          check_type: 'duplicate_statuses',
          status: 'warning',
          message: `נמצאו מצבים כפולים: ${duplicateNames.join(', ')}`,
          action_taken: 'מומלץ להפעיל ניקוי מצבים כפולים',
          details: JSON.stringify({ duplicates: duplicateNames }),
          notified_carmit: true
        });
      } else {
        logs.push({
          check_type: 'duplicate_statuses',
          status: 'success',
          message: 'לא נמצאו מצבים כפולים',
          notified_carmit: false
        });
      }
    } catch (e) {
      logs.push({
        check_type: 'duplicate_statuses',
        status: 'error',
        message: `שגיאה בבדיקת מצבים כפולים: ${e.message}`,
        notified_carmit: true
      });
    }

    // 5. Check Elad Agent (contacts data quality)
    try {
      await delay(2000); // Rate limit protection
      const eladSchedules = await base44.entities.EladSchedule.list('-updated_date', 1);
      if (eladSchedules.length > 0) {
        const eladSettings = eladSchedules[0];
        
        if (eladSettings.is_enabled) {
          const lastRun = eladSettings.last_run_time ? new Date(eladSettings.last_run_time) : null;
          
          // Check if Elad should have run based on schedule
          if (!lastRun || lastRun < twentyFourHoursAgo) {
            issues.push({
              type: 'elad_agent',
              message: 'אלעד לא רץ ב-24 שעות האחרונות'
            });
            logs.push({
              check_type: 'system_health',
              status: 'warning',
              message: 'הסוכן אלעד לא רץ ב-24 שעות האחרונות',
              action_taken: 'נדרשת הפעלה ידנית של אלעד',
              notified_carmit: true
            });
          } else if (eladSettings.last_run_status === 'failed') {
            issues.push({
              type: 'elad_agent',
              message: 'הריצה האחרונה של אלעד נכשלה'
            });
            logs.push({
              check_type: 'system_health',
              status: 'error',
              message: 'הריצה האחרונה של אלעד נכשלה',
              action_taken: 'נדרשת בדיקה ידנית',
              notified_carmit: true
            });
          } else {
            logs.push({
              check_type: 'system_health',
              status: 'success',
              message: `אלעד פועל תקין - ${eladSettings.last_missing_count || 0} פרטים חסרים בריצה האחרונה`,
              notified_carmit: false
            });
          }
        }
      }
    } catch (e) {
      // Elad entity might not exist yet, skip silently
      console.log('Could not check Elad agent:', e.message);
    }

    // 6. Check for Duplicate Candidates
    try {
      await delay(2000); // Rate limit protection
      const candidates = await base44.entities.Candidate.list();
      const emailMap = {};
      const phoneMap = {};
      const duplicates = [];

      for (const c of candidates) {
        if (c.email && emailMap[c.email]) {
          duplicates.push({ type: 'email', value: c.email, ids: [emailMap[c.email], c.id] });
        } else if (c.email) {
          emailMap[c.email] = c.id;
        }

        if (c.phone_primary && phoneMap[c.phone_primary]) {
          duplicates.push({ type: 'phone', value: c.phone_primary, ids: [phoneMap[c.phone_primary], c.id] });
        } else if (c.phone_primary) {
          phoneMap[c.phone_primary] = c.id;
        }
      }

      if (duplicates.length > 0) {
        issues.push({
          type: 'duplicate_candidates',
          message: `נמצאו ${duplicates.length} מועמדים כפולים פוטנציאליים`
        });
        logs.push({
          check_type: 'duplicate_candidates',
          status: 'warning',
          message: `נמצאו ${duplicates.length} מועמדים כפולים פוטנציאליים`,
          action_taken: 'מומלץ להפעיל איחוד מועמדים כפולים',
          details: JSON.stringify({ count: duplicates.length }),
          notified_carmit: true
        });
      } else {
        logs.push({
          check_type: 'duplicate_candidates',
          status: 'success',
          message: 'לא נמצאו מועמדים כפולים',
          notified_carmit: false
        });
      }
    } catch (e) {
      logs.push({
        check_type: 'duplicate_candidates',
        status: 'error',
        message: `שגיאה בבדיקת מועמדים כפולים: ${e.message}`,
        notified_carmit: true
      });
    }

    // Save all logs with delays
    for (const log of logs) {
      await base44.entities.RavivLog.create(log);
      await delay(500); // Rate limit protection between saves
    }

    // Overall system health log
    const healthStatus = issues.length === 0 ? 'success' : (issues.length <= 2 ? 'warning' : 'error');
    await base44.entities.RavivLog.create({
      check_type: 'system_health',
      status: healthStatus,
      message: issues.length === 0 
        ? 'בדיקת מערכת הושלמה - הכל תקין' 
        : `בדיקת מערכת הושלמה - נמצאו ${issues.length} בעיות`,
      details: JSON.stringify({
        total_checks: logs.length,
        success: logs.filter(l => l.status === 'success').length,
        warnings: logs.filter(l => l.status === 'warning').length,
        errors: logs.filter(l => l.status === 'error').length,
        issues: issues
      }),
      notified_carmit: issues.length > 0
    });

    return Response.json({ 
      success: true, 
      checksRun: logs.length,
      issuesFound: issues.length,
      logs: logs
    });

  } catch (error) {
    console.error('Error running Raviv agent:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});