import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Central job assignment logic
const analyzeJobAssignment = (job) => {
  const title = (job.title || '').toLowerCase();
  const description = (job.description || '').toLowerCase();
  const requirements = (job.requirements || '').toLowerCase();

  const titleWeight = 3;
  
  if (title.includes('מיגון') || title.includes('מערכת מיגון')) {
    return { agent: 'itay', displayName: 'איתי (IT)', functionName: 'runItayAgent' };
  }

  if (title.includes('מהנדס מערכת') || title.includes('system engineer') || title.includes('systems engineer')) {
    return { agent: 'lior', displayName: 'ליאור (הנדסת מערכת)', functionName: 'runLiorAgent' };
  }
  
  if (title.includes('מהנדס מכונות') || title.includes('mechanical engineer')) {
    return { agent: 'ofir', displayName: 'אופיר (הנדסת מכונות)', functionName: 'runOfirAgent' };
  }
  
  if (title.includes('מהנדס אלקטרוניקה') || title.includes('electronics engineer')) {
    return { agent: 'alik', displayName: 'אליק (אלקטרוניקה)', functionName: 'runAlikAgent' };
  }

  const naamaKeywords = ['תוכנה', 'software', 'developer', 'מפתח', 'embedded', 'firmware', 'c++', 'python', 'java', 'c#', 'react', 'frontend', 'backend', 'full stack', 'fullstack', '.net', 'web', 'משוטט', 'קוד', 'תכנות', 'פיתוח תוכנה', 'algorithm', 'אלגוריתם', 'programming', 'sw ', ' sw', 'matlab', 'simulink', 'real-time', 'real time', 'javascript', 'typescript', 'node', 'angular', 'vue'];
  const dganitKeywords = ['qa', 'quality assurance', 'בדיקות תוכנה', 'בדיקות איכות', 'בודק תוכנה', 'test', 'testing', 'automation tester', 'qa engineer', 'sdet', 'qa manual', 'qa automation', 'quality engineer', 'software tester', 'בדיקות', 'selenium', 'cypress', 'playwright', 'appium', 'qa lead', 'qa manager'];
  const alikKeywords = ['אלקטרוני', 'electronics', 'hardware', 'pcb', 'fpga', 'vhdl', 'analog', 'digital', 'צב"ד', 'אנלוג'];
  const itayKeywords = ['devops', 'cloud', 'aws', 'azure', 'kubernetes', 'docker', 'network', 'security', 'סייבר', 'cyber', 'תשתיות', 'helpdesk', 'noc', 'dba', 'sysadmin', 'linux admin', 'windows server', 'vmware', 'active directory', 'מיגון', 'מערכת מיגון', 'protection system', 'מבחני קבלה', 'מפרט דרישות למערכת'];
  const liorKeywords = ['system engineer', 'systems engineer', 'srs', 'sss', 'mbse', 'doors', 'הנדסת מערכת', 'אוויוניקה', 'avionics', 'מכ"מ', 'radar', 'icd', 'v&v', 'verification', 'traceability'];
  const ofirKeywords = ['מכונ', 'mechanical', 'מכני', 'solidworks', 'catia', 'תכן מכני', 'הנדסת מכונות'];

  const dganitScore = dganitKeywords.filter(k => title.includes(k)).length * titleWeight + dganitKeywords.filter(k => description.includes(k) || requirements.includes(k)).length;
  const naamaScore = naamaKeywords.filter(k => title.includes(k)).length * titleWeight + naamaKeywords.filter(k => description.includes(k) || requirements.includes(k)).length;
  const alikScore = alikKeywords.filter(k => title.includes(k)).length * titleWeight + alikKeywords.filter(k => description.includes(k) || requirements.includes(k)).length;
  const itayScore = itayKeywords.filter(k => title.includes(k)).length * titleWeight + itayKeywords.filter(k => description.includes(k) || requirements.includes(k)).length;
  const liorScore = liorKeywords.filter(k => title.includes(k)).length * titleWeight + liorKeywords.filter(k => description.includes(k) || requirements.includes(k)).length;
  const ofirScore = ofirKeywords.filter(k => title.includes(k)).length * titleWeight + ofirKeywords.filter(k => description.includes(k) || requirements.includes(k)).length;

  if (dganitScore > 0 && dganitScore >= naamaScore && dganitScore > alikScore && dganitScore > itayScore && dganitScore > ofirScore && dganitScore > liorScore) {
    return { agent: 'dganit', displayName: 'דגנית (QA)', functionName: 'runDganitAgent' };
  }

  if (naamaScore > 0 && naamaScore > alikScore && naamaScore > itayScore && naamaScore > ofirScore) {
    return { agent: 'naama', displayName: 'נעמה (תוכנה)', functionName: 'runNaamaAgent' };
  }
  
  if (liorScore > 0 && liorScore > ofirScore && liorScore > alikScore && liorScore > itayScore &&
      !title.includes('תעשי') && !title.includes('ניהול') &&
      !title.includes('pmo') && !title.includes('project manager') &&
      !title.includes('פרויקט')) {
    return { agent: 'lior', displayName: 'ליאור (הנדסת מערכת)', functionName: 'runLiorAgent' };
  }
  
  if (alikScore > 0 && alikScore > itayScore && alikScore > ofirScore) {
    return { agent: 'alik', displayName: 'אליק (אלקטרוניקה)', functionName: 'runAlikAgent' };
  }
  
  if (itayScore > 0 && itayScore > ofirScore) {
    return { agent: 'itay', displayName: 'איתי (IT)', functionName: 'runItayAgent' };
  }
  
  if (ofirScore > 0) {
    return { agent: 'ofir', displayName: 'אופיר (הנדסת מכונות)', functionName: 'runOfirAgent' };
  }
  
  const fullText = `${title} ${description} ${requirements}`;
  if (fullText.includes('מחשוב') && naamaScore === 0 && alikScore === 0 && liorScore === 0 && ofirScore === 0) {
    return { agent: 'itay', displayName: 'איתי (IT)', functionName: 'runItayAgent' };
  }
  
  return { agent: 'gc', displayName: 'GC (כללי)', functionName: 'runGcAgent' };
};

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  let carmitStatus = null;
  
  try {
    // Support both user-triggered and scheduled/automated calls
    let user = null;
    try { user = await base44.auth.me(); } catch (e) { /* running as scheduled automation */ }

    // Use service role throughout - works for both user-triggered and scheduled automation calls
    const db = base44.asServiceRole;

    // === RECOVERY MECHANISM: Check if Carmit is stuck ===
    let carmitStatusList = await db.entities.AgentRunStatus.filter({ agent_name: 'carmit' });
    if (carmitStatusList.length > 0) {
      const existingStatus = carmitStatusList[0];
      const runningFor = existingStatus.is_running && existingStatus.last_run_start
        ? (new Date() - new Date(existingStatus.last_run_start)) / 1000 / 60
        : 0;
      
      if (runningFor > 15) {
        console.log(`⚠️ כרמית תקועה ${Math.floor(runningFor)} דקות - מאפס`);
        await db.entities.AgentRunStatus.update(existingStatus.id, {
          is_running: false,
          last_run_end: new Date().toISOString(),
          last_error: `נתקעה ${Math.floor(runningFor)} דקות - אופסה אוטומטית`,
          current_activity: null
        });
        try {
          await db.entities.SystemActivityLog.create({
            actor_type: 'system', actor_name: 'recovery_system', action_type: 'agent_recovery',
            action_description: `⚠️ כרמית נתקעה ${Math.floor(runningFor)} דקות ואופסה. רביב - בדוק לוגים`,
            status: 'warning',
            details: JSON.stringify({ stuck_duration_minutes: Math.floor(runningFor), last_activity: existingStatus.current_activity })
          });
        } catch (alertError) { console.error('Failed to alert:', alertError); }
      }
    }

    // === CARMIT STARTS HER WORK ===
    carmitStatusList = await db.entities.AgentRunStatus.filter({ agent_name: 'carmit' });
    if (carmitStatusList.length === 0) {
      carmitStatus = await db.entities.AgentRunStatus.create({
        agent_name: 'carmit', is_running: true,
        last_run_start: new Date().toISOString(),
        current_activity: 'מתחילה לנתח את מצב הצוות',
        detailed_log: '', last_error: null
      });
    } else {
      await db.entities.AgentRunStatus.update(carmitStatusList[0].id, {
        is_running: true, last_run_start: new Date().toISOString(),
        current_activity: 'מתחילה לנתח את מצב הצוות',
        detailed_log: '', last_error: null
      });
      carmitStatus = carmitStatusList[0];
    }

    const activityLog = [];
    activityLog.push(`${new Date().toISOString()} - כרמית התחילה לעבוד`);

    // === STEP 0: CHECK FOR NEW JOBS ===
    try {
      await db.entities.AgentRunStatus.update(carmitStatus.id, { current_activity: 'בודקת משרות חדשות שנכנסו' });
      const newJobsInbox = await db.entities.NewJobInbox.filter({ is_viewed: false });
      
      if (newJobsInbox.length > 0) {
        activityLog.push(`נמצאו ${newJobsInbox.length} משרות חדשות לטיפול`);
        
        for (const jobInboxEntry of newJobsInbox) {
          let job = null;
          try {
            const jobs = await db.entities.Job.filter({ id: jobInboxEntry.job_id });
            job = jobs.length > 0 ? jobs[0] : null;
          } catch (jobErr) { console.log(`⚠️ שגיאה בטעינת משרה: ${jobErr.message}`); }
          
          if (!job) {
            await db.entities.NewJobInbox.delete(jobInboxEntry.id);
            activityLog.push(`ניקיתי משרה שנמחקה`);
            continue;
          }
          
          const assignment = analyzeJobAssignment(job);
          activityLog.push(`משרה חדשה: "${job.title}" → ${assignment.displayName}`);
          
          await db.entities.Job.update(job.id, {
            assigned_agent: assignment.agent,
            assigned_agent_name: assignment.displayName,
            assignment_date: new Date().toISOString()
          });
          
          const agentStatuses = await db.entities.AgentRunStatus.filter({ agent_name: assignment.agent });
          const focusData = { focused_job_id: job.id, focused_job_title: job.title, focus_start_time: new Date().toISOString(), focus_matches_found: 0 };
          if (agentStatuses.length > 0) {
            await db.entities.AgentRunStatus.update(agentStatuses[0].id, focusData);
          } else {
            await db.entities.AgentRunStatus.create({ agent_name: assignment.agent, ...focusData });
          }
          
          await db.entities.NewJobInbox.update(jobInboxEntry.id, { is_viewed: true, viewed_date: new Date().toISOString() });
          db.functions.invoke(assignment.functionName, {}); // Fire and forget
          
          await db.entities.SystemActivityLog.create({
            actor_type: 'agent', actor_name: 'carmit',
            actor_image: 'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=40&h=40&fit=crop&crop=face',
            action_type: 'job_assignment',
            action_description: `כרמית הקצתה משרה חדשה "${job.title}" ל-${assignment.displayName} והפעילה מיקוד`,
            status: 'success'
          });
          
          await delay(2000);
        }
      } else {
        activityLog.push('אין משרות חדשות לטיפול');
      }
    } catch (newJobsError) {
      console.error('Error handling new jobs:', newJobsError);
      activityLog.push(`שגיאה בטיפול במשרות חדשות: ${newJobsError.message}`);
    }

    // === STEP 1: CHECK INACTIVE AGENTS ===
    try {
      await db.entities.AgentRunStatus.update(carmitStatus.id, { current_activity: 'בודקת מי מהסוכנים לא עבד ביממה האחרונה' });
      
      const allAgentStatuses = await db.entities.AgentRunStatus.list();
      const agentSchedules = await db.entities.AgentSchedule.list();
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      for (const agentName of ['naama', 'dganit', 'alik', 'itay', 'lior', 'ofir', 'gc', 'etgar']) {
        const agentStatus = allAgentStatuses.find(s => s.agent_name === agentName);
        const agentSchedule = agentSchedules.find(s => s.agent_name === agentName);
        
        if (agentStatus?.last_run_end) {
          const lastRun = new Date(agentStatus.last_run_end);
          if (lastRun < oneDayAgo) {
            const hoursSinceRun = Math.floor((Date.now() - lastRun.getTime()) / (1000 * 60 * 60));
            activityLog.push(`${agentName} לא עבד ${hoursSinceRun} שעות - מעירה אותו`);
            
            if (agentSchedule && !agentSchedule.is_enabled) {
              await db.entities.AgentSchedule.update(agentSchedule.id, { is_enabled: true });
            }
            
            await db.entities.SystemActivityLog.create({
              actor_type: 'agent', actor_name: 'carmit',
              actor_image: 'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=40&h=40&fit=crop&crop=face',
              action_type: 'agent_wakeup',
              action_description: `כרמית זיהתה ש-${agentName} לא עבד כבר ${hoursSinceRun} שעות והפעילה אותו מחדש`,
              status: 'warning',
              details: JSON.stringify({ agent_name: agentName, hours_since_last_run: hoursSinceRun, last_run_date: agentStatus.last_run_end })
            });
          }
        }
      }
    } catch (inactiveAgentsError) {
      console.error('Error checking inactive agents:', inactiveAgentsError);
      activityLog.push(`שגיאה בבדיקת סוכנים לא פעילים: ${inactiveAgentsError.message}`);
    }

    // === STEP 2: VERIFY UNTREATED JOBS ===
    try {
      await db.entities.AgentRunStatus.update(carmitStatus.id, { current_activity: 'בודקת שכל סוכן טיפל בכל המשרות שהוקצו לו' });
      
      const activeJobs = await db.entities.Job.filter({ status: 'פעילה' });
      await delay(2000);
      const allMatches = await db.entities.Match.list('-created_date', 500);
      
      const jobsByAgent = {};
      const agentsList = ['naama', 'dganit', 'alik', 'itay', 'lior', 'ofir', 'gc'];
      agentsList.forEach(a => { jobsByAgent[a] = []; });
      
      for (const job of activeJobs) {
        const assignment = analyzeJobAssignment(job);
        if (job.assigned_agent !== assignment.agent) {
          await db.entities.Job.update(job.id, {
            assigned_agent: assignment.agent,
            assigned_agent_name: assignment.displayName,
            assignment_date: new Date().toISOString()
          });
          await delay(500);
          activityLog.push(`עדכנתי הקצאה: ${job.title} → ${assignment.displayName}`);
        }
        jobsByAgent[assignment.agent].push(job);
      }
      
      activityLog.push('דילוג על ניקוי התאמות לא נכונות (מניעת rate limit)');
      await delay(3000);
      
      let untreatedJobsFound = 0;
      
      // Use already-loaded agentStatuses instead of per-agent DB calls
      const allAgentStatusesForUntreated = await db.entities.AgentRunStatus.list();

      for (const agentName of agentsList) {
        const agentJobs = jobsByAgent[agentName];
        if (agentJobs.length === 0) continue;
        
        const agentHebrewName = { naama: 'נעמה', dganit: 'דגנית', alik: 'אליק', itay: 'איתי', lior: 'ליאור', ofir: 'אופיר', gc: 'GC' }[agentName] || '';
        
        for (const job of agentJobs) {
          const agentMatchesForJob = allMatches.filter(m => m.job_id === job.id && m.user_name?.includes(agentHebrewName));
          
          if (agentMatchesForJob.length === 0) {
            activityLog.push(`זיהיתי משרה לא מטופלת אצל ${agentName}: ${job.title}`);
            untreatedJobsFound++;
            
            const assignment = analyzeJobAssignment(job);
            const focusData = { focused_job_id: job.id, focused_job_title: job.title, focus_start_time: new Date().toISOString(), focus_matches_found: 0 };
            const agentStatusRec = allAgentStatusesForUntreated.find(s => s.agent_name === agentName);
            
            if (agentStatusRec) {
              await db.entities.AgentRunStatus.update(agentStatusRec.id, focusData);
            } else {
              await db.entities.AgentRunStatus.create({ agent_name: agentName, ...focusData });
            }
            
            db.functions.invoke(assignment.functionName, {}); // Fire and forget
            activityLog.push(`הפעלתי את ${assignment.displayName} לטיפול במשרה`);
            
            await delay(500);
            await db.entities.SystemActivityLog.create({
              actor_type: 'agent', actor_name: 'carmit',
              actor_image: 'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=40&h=40&fit=crop&crop=face',
              action_type: 'untreated_job_focus',
              action_description: `כרמית זיהתה שהמשרה "${job.title}" לא טופלה ע"י ${assignment.displayName} והפעילה מיקוד`,
              status: 'success'
            });
            break;
          }
        }
        if (untreatedJobsFound > 0) break;
      }
      
      if (untreatedJobsFound === 0) {
        activityLog.push('כל הסוכנים מעודכנים - אין משרות ממתינות');
      }
      
    } catch (untreatedJobsError) {
      console.error('Error checking untreated jobs:', untreatedJobsError);
      activityLog.push(`שגיאה בבדיקת משרות לא מטופלות: ${untreatedJobsError.message}`);
    }

    // === STEP 3: AGENT ROTATION ===
    const agentStatuses = await db.entities.AgentRunStatus.list();
    const naamaStatus = agentStatuses.find(s => s.agent_name === 'naama') || {};
    const ramiStatus = agentStatuses.find(s => s.agent_name === 'rami') || {};
    const dganitStatus = agentStatuses.find(s => s.agent_name === 'dganit') || {};
    const alikStatus = agentStatuses.find(s => s.agent_name === 'alik') || {};
    const itayStatus = agentStatuses.find(s => s.agent_name === 'itay') || {};
    const liorStatus = agentStatuses.find(s => s.agent_name === 'lior') || {};
    const ofirStatus = agentStatuses.find(s => s.agent_name === 'ofir') || {};
    const gcStatus = agentStatuses.find(s => s.agent_name === 'gc') || {};
    
    const naamaRunning = naamaStatus.is_running || false;
    const ramiRunning = ramiStatus.is_running || false;
    const dganitRunning = dganitStatus.is_running || false;
    const alikRunning = alikStatus.is_running || false;
    const itayRunning = itayStatus.is_running || false;
    const liorRunning = liorStatus.is_running || false;
    const ofirRunning = ofirStatus.is_running || false;
    const gcRunning = gcStatus.is_running || false;
    
    const activeAgentsCount = [naamaRunning, ramiRunning, dganitRunning, alikRunning, itayRunning, liorRunning, ofirRunning, gcRunning].filter(Boolean).length;
    activityLog.push(`סטטוס: ${activeAgentsCount} סוכנים פעילים`);
    
    const currentHour = new Date().getHours();
    const isHighLoadTime = currentHour >= 18 || currentHour < 6;
    const MAX_RUN_MINUTES = isHighLoadTime ? 30 : 15;
    activityLog.push(`מצב: ${isHighLoadTime ? 'עומס גבוה' : 'עומס נמוך'} - רוטציה כל ${MAX_RUN_MINUTES} דק'`);
    
    const now = new Date();
    
    for (const agent of [
      { name: 'naama', status: naamaStatus, running: naamaRunning },
      { name: 'dganit', status: dganitStatus, running: dganitRunning },
      { name: 'alik', status: alikStatus, running: alikRunning },
      { name: 'itay', status: itayStatus, running: itayRunning },
      { name: 'lior', status: liorStatus, running: liorRunning },
      { name: 'ofir', status: ofirStatus, running: ofirRunning },
      { name: 'gc', status: gcStatus, running: gcRunning }
    ]) {
      if (agent.running && agent.status.last_run_start) {
        const minutesRunning = (now - new Date(agent.status.last_run_start)) / (1000 * 60);
        if (minutesRunning > MAX_RUN_MINUTES) {
          activityLog.push(`עצרתי ${agent.name} אחרי ${Math.floor(minutesRunning)} דקות לרוטציה`);
          await db.entities.AgentRunStatus.update(agent.status.id, {
            is_running: false, last_run_end: new Date().toISOString(), current_activity: null
          });
          await db.entities.SystemActivityLog.create({
            actor_type: 'agent', actor_name: 'carmit',
            actor_image: 'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=40&h=40&fit=crop&crop=face',
            action_type: 'agent_rotation',
            action_description: `כרמית עצרה את ${agent.name} אחרי ${Math.floor(minutesRunning)} דקות לצורך רוטציה`,
            status: 'success'
          });
        }
      }
    }
    
    const updatedStatuses = await db.entities.AgentRunStatus.list();
    const activeAgentsCountAfterRotation = updatedStatuses.filter(s => 
      ['naama', 'dganit', 'alik', 'itay', 'lior', 'ofir', 'gc'].includes(s.agent_name) && s.is_running
    ).length;
    
    const TARGET_ACTIVE_AGENTS = isHighLoadTime ? 4 : 2;
    
    if (activeAgentsCountAfterRotation < TARGET_ACTIVE_AGENTS) {
      const agentsNeeded = TARGET_ACTIVE_AGENTS - activeAgentsCountAfterRotation;
      await db.entities.AgentRunStatus.update(carmitStatus.id, { current_activity: `מפעילה ${agentsNeeded} סוכנים נוספים` });
      activityLog.push(`מפעילה ${agentsNeeded} סוכנים (יעד: ${TARGET_ACTIVE_AGENTS})`);
      
      const activeJobsForFocus = await db.entities.Job.filter({ status: 'פעילה' });
      await delay(2000);
      const allMatchesForFocus = await db.entities.Match.list('-created_date', 300);
      
      const jobMatchCounts = new Map();
      for (const job of activeJobsForFocus) {
        jobMatchCounts.set(job.id, allMatchesForFocus.filter(m => m.job_id === job.id && m.is_automatic_recommendation).length);
      }
      
      const agents = [
        { name: 'naama', displayName: 'נעמה (תוכנה)', isRunning: naamaRunning, lastRun: naamaStatus.last_run_end, functionName: 'runNaamaAgent' },
        { name: 'dganit', displayName: 'דגנית (QA)', isRunning: dganitRunning, lastRun: dganitStatus.last_run_end, functionName: 'runDganitAgent' },
        { name: 'alik', displayName: 'אליק (אלקטרוניקה)', isRunning: alikRunning, lastRun: alikStatus.last_run_end, functionName: 'runAlikAgent' },
        { name: 'itay', displayName: 'איתי (IT)', isRunning: itayRunning, lastRun: itayStatus.last_run_end, functionName: 'runItayAgent' },
        { name: 'lior', displayName: 'ליאור (הנדסת מערכת)', isRunning: liorRunning, lastRun: liorStatus.last_run_end, functionName: 'runLiorAgent' },
        { name: 'ofir', displayName: 'אופיר (הנדסת מכונות)', isRunning: ofirRunning, lastRun: ofirStatus.last_run_end, functionName: 'runOfirAgent' },
        { name: 'gc', displayName: 'GC (כללי)', isRunning: gcRunning, lastRun: gcStatus.last_run_end, functionName: 'runGcAgent' }
      ];
      
      const inactiveAgents = agents.filter(a => !a.isRunning).sort((a, b) => {
        const aTime = a.lastRun ? new Date(a.lastRun).getTime() : 0;
        const bTime = b.lastRun ? new Date(b.lastRun).getTime() : 0;
        return aTime - bTime;
      });
      
      for (const agent of inactiveAgents.slice(0, agentsNeeded)) {
        try {
          await db.entities.AgentRunStatus.update(carmitStatus.id, { current_activity: `מפעילה את ${agent.displayName}` });
          
          const agentJobs = activeJobsForFocus.filter(j => j.assigned_agent === agent.name);
          let focusJob = null;
          let focusReason = '';
          
          const zeroMatchJobs = agentJobs.filter(j => jobMatchCounts.get(j.id) === 0);
          if (zeroMatchJobs.length > 0) { focusJob = zeroMatchJobs[0]; focusReason = '0 התאמות'; }
          else {
            const fewMatchJobs = agentJobs.filter(j => { const c = jobMatchCounts.get(j.id); return c >= 1 && c <= 5; });
            if (fewMatchJobs.length > 0) { focusJob = fewMatchJobs[0]; focusReason = `${jobMatchCounts.get(focusJob.id)} התאמות (מעט)`; }
            else {
              const moreMatchJobs = agentJobs.filter(j => jobMatchCounts.get(j.id) > 5);
              if (moreMatchJobs.length > 0) { focusJob = moreMatchJobs[0]; focusReason = `${jobMatchCounts.get(focusJob.id)} התאמות`; }
            }
          }
          
          if (focusJob) {
            const agentStatusRec = agentStatuses.find(s => s.agent_name === agent.name);
            if (agentStatusRec) {
              await db.entities.AgentRunStatus.update(agentStatusRec.id, {
                focused_job_id: focusJob.id, focused_job_title: focusJob.title,
                focus_start_time: new Date().toISOString(), focus_matches_found: 0
              });
            } else {
              await db.entities.AgentRunStatus.create({
                agent_name: agent.name, focused_job_id: focusJob.id, focused_job_title: focusJob.title,
                focus_start_time: new Date().toISOString(), focus_matches_found: 0
              });
            }
            activityLog.push(`מיקוד ${agent.displayName}: "${focusJob.title}" (${focusReason})`);
          }
          
          db.functions.invoke(agent.functionName, {}); // Fire and forget
          
          await db.entities.SystemActivityLog.create({
            actor_type: 'agent', actor_name: 'carmit',
            actor_image: 'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=40&h=40&fit=crop&crop=face',
            action_type: 'agent_activation',
            action_description: `כרמית הפעילה את ${agent.displayName}${focusJob ? ` עם מיקוד על "${focusJob.title}"` : ''}`,
            status: 'success'
          });
          
          await delay(2000);
        } catch (activationError) {
          console.error(`שגיאה בהפעלת ${agent.displayName}:`, activationError);
          activityLog.push(`שגיאה בהפעלת ${agent.displayName}: ${activationError.message}`);
        }
      }
    } else {
      activityLog.push(`יש ${activeAgentsCountAfterRotation}/${TARGET_ACTIVE_AGENTS} סוכנים פעילים`);
    }
    
    // === STEP 4: COLLECT NEW MATCHES FROM AGENTS ===
    const recruitmentAgents = ['naama', 'dganit', 'alik', 'itay', 'lior', 'ofir', 'rami', 'gc', 'etgar'];
    const allEnrichedMatches = [];
    const runId = new Date().toISOString();
    let lowScoreProcessed = 0;

    try {
      await db.entities.AgentRunStatus.update(carmitStatus.id, { current_activity: 'פונה לכל סוכן בנפרד לשאול על התאמות חדשות' });
      activityLog.push('מתחילה לשאול כל סוכן על ההתאמות החדשות שלו');

      for (const agentKey of recruitmentAgents) {
        try {
          await db.entities.AgentRunStatus.update(carmitStatus.id, { current_activity: `שואלת את ${agentKey} על התאמות חדשות` });
          const queryTime = new Date().toISOString();

          let agentResponse = null;
          try {
            agentResponse = await Promise.race([
              db.functions.invoke('getAgentNewMatches', { agent_name: agentKey }),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout after 15s')), 15000))
            ]);
          } catch (queryErr) {
            console.error(`Agent query timeout/error for ${agentKey}:`, queryErr.message);
            agentResponse = null;
          }

          if (agentResponse && agentResponse.data?.success && agentResponse.data.matches_count > 0) {
            activityLog.push(`${agentResponse.data.agent_display_name}: ${agentResponse.data.matches_count} התאמות חדשות`);
            allEnrichedMatches.push(...agentResponse.data.matches);

            const matchesSummary = agentResponse.data.matches.slice(0, 10).map(m => 
              `${m.candidate?.full_name || 'מועמד'} → ${m.job?.title || 'משרה'} (${m.match?.match_score}%)`
            ).join(', ');

            await db.entities.CarmitAgentQuery.create({
              carmit_run_id: runId, agent_name: agentKey,
              agent_display_name: agentResponse.data.agent_display_name,
              query_time: queryTime, matches_count: agentResponse.data.matches_count,
              matches_summary: matchesSummary, success: true
            });
          } else if (agentResponse) {
            activityLog.push(`${agentKey}: אין התאמות חדשות`);
            await db.entities.CarmitAgentQuery.create({
              carmit_run_id: runId, agent_name: agentKey,
              agent_display_name: agentResponse.data?.agent_display_name || agentKey,
              query_time: queryTime, matches_count: 0, success: true
            });
          }

          await delay(1500);
        } catch (error) {
          console.error(`Error querying ${agentKey}:`, error);
          activityLog.push(`שגיאה בשאילתת ${agentKey}: ${error.message}`);
          try {
            await db.entities.CarmitAgentQuery.create({
              carmit_run_id: runId, agent_name: agentKey, agent_display_name: agentKey,
              query_time: new Date().toISOString(), matches_count: 0, success: false, error_message: error.message
            });
          } catch (logErr) { console.error('Failed to log agent query error:', logErr); }
          await delay(1000);
        }
      }

      activityLog.push(`${allEnrichedMatches.length} התאמות חדשות מהסוכנים`);

      // Check unreviewed matches
      await db.entities.AgentRunStatus.update(carmitStatus.id, { current_activity: 'בודקת התאמות שעדיין לא נבדקו' });

      const allUnreviewedRaw = await db.entities.Match.filter({
        carmit_reviewed_date: null, is_automatic_recommendation: true
      }, '-match_score', 50);

      const unreviewedMatches = allUnreviewedRaw.filter(m =>
        m.job_id && m.job_id !== '' && m.candidate_id && m.candidate_id !== '' &&
        m.match_score != null && Number(m.match_score) >= 70
      );

      const lowScoreMatches = allUnreviewedRaw.filter(m =>
        m.job_id && m.job_id !== '' && (m.match_score == null || Number(m.match_score) < 70)
      );

      activityLog.push(`נמצאו ${unreviewedMatches.length} התאמות שעדיין לא נבדקו (70%+)`);

      // Batch-load all needed candidates and jobs in bulk (avoid per-match DB calls)
      const existingMatchIds = new Set(allEnrichedMatches.map(em => em.match?.id));
      const missingMatches = unreviewedMatches.filter(m => !existingMatchIds.has(m.id));

      if (missingMatches.length > 0) {
        // Load all candidates and jobs in two bulk calls (reduced limit to avoid rate limit)
        const allCandidatesRaw = await db.entities.Candidate.list('-created_date', 500);
        const allActiveJobs = await db.entities.Job.filter({ status: 'פעילה' });
        
        const allCandidates = Array.isArray(allCandidatesRaw) ? allCandidatesRaw : [];
        const candidateMap = new Map(allCandidates.map(c => [c.id, c]));
        const jobMap = new Map(allActiveJobs.map(j => [j.id, j]));

        for (const match of missingMatches) {
          const candidate = candidateMap.get(match.candidate_id);
          const job = jobMap.get(match.job_id);
          if (candidate && job) {
            allEnrichedMatches.push({ match, candidate, job });
          }
        }
      }

      // Auto-reject low score matches - batch with delays to avoid rate limit
      await db.entities.AgentRunStatus.update(carmitStatus.id, { current_activity: 'מטפלת בהתאמות עם ציון נמוך' });
      for (const match of lowScoreMatches) {
        await db.entities.Match.update(match.id, {
          carmit_reviewed_date: new Date().toISOString(),
          carmit_decision: 'skipped_low_score',
          status: 'נדחה - ציון נמוך', status_number: 98
        });
        lowScoreProcessed++;
        if (lowScoreProcessed % 10 === 0) await delay(1000); // pace every 10 updates
      }

      if (lowScoreProcessed > 0) activityLog.push(`סימנתי ${lowScoreProcessed} התאמות עם ציון נמוך כנדחות`);

      if (allEnrichedMatches.length === 0) {
        activityLog.push('לא נמצאו התאמות לבדיקה - סיימתי');
        await db.entities.AgentRunStatus.update(carmitStatus.id, {
          is_running: false, last_run_end: new Date().toISOString(),
          matches_created: 0, current_activity: null, detailed_log: activityLog.join('\n')
        });
        return Response.json({ success: true, tasksCreated: 0, lowScoreRejected: lowScoreProcessed });
      }
    } catch (agentQueryError) {
      console.error('CRITICAL ERROR in agent queries loop:', agentQueryError);
      activityLog.push(`שגיאה קריטית בשאילתת סוכנים: ${agentQueryError.message}`);
      await db.entities.AgentRunStatus.update(carmitStatus.id, {
        is_running: false, last_run_end: new Date().toISOString(),
        last_error: agentQueryError.message, current_activity: null, detailed_log: activityLog.join('\n')
      });
      throw agentQueryError;
    }

    // === STEP 5: CREATE ROTEM TASKS ===
    const existingTasks = await db.entities.RotemTask.list('-created_date', 500);
    const existingTaskKeys = new Set(existingTasks.map(t => `${t.job_id}_${t.candidate_id}`));

    let tasksCreated = 0;
    let candidatesSkipped = 0;
    const reasoningLog = [];

    const MAX_MATCHES_PER_RUN = 50;
    if (allEnrichedMatches.length > MAX_MATCHES_PER_RUN) {
      activityLog.push(`מגבילה ל-${MAX_MATCHES_PER_RUN} התאמות מתוך ${allEnrichedMatches.length}`);
      allEnrichedMatches.splice(MAX_MATCHES_PER_RUN);
    }

    for (const enrichedMatch of allEnrichedMatches) {
      const match = enrichedMatch.match;
      const candidate = enrichedMatch.candidate;
      const job = enrichedMatch.job;
      if (!match || !candidate || !job) continue;

      const taskKey = `${match.job_id}_${match.candidate_id}`;
      if (existingTaskKeys.has(taskKey)) {
        if (!match.carmit_reviewed_date) {
          await db.entities.Match.update(match.id, {
            carmit_reviewed_date: new Date().toISOString(),
            carmit_decision: 'skipped_duplicate', status: 'כפילות - משימה קיימת', status_number: 97
          });
        }
        continue;
      }

      if (candidate.status === 'לא מתאים - נסגר' || candidate.status === 'חוזה חתום' || candidate.status === 'מועסק - פעיל') {
        await db.entities.Match.update(match.id, { carmit_reviewed_date: new Date().toISOString(), carmit_decision: 'skipped_status' });
        candidatesSkipped++;
        continue;
      }

      // Skip per-candidate status update to reduce rate limit pressure
      
      let shouldCreateTask = true;
      let reasoning = '';
      
      // Check full green-V match
      let isFullMatch = false;
      try {
        if (match.detailed_analysis) {
          const analysisData = typeof match.detailed_analysis === 'string' ? JSON.parse(match.detailed_analysis) : match.detailed_analysis;
          isFullMatch = Array.isArray(analysisData) && analysisData.length > 0 && analysisData.every(item => item.is_match === 'true' || item.is_match === true);
        }
      } catch (e) { /* ignore */ }

      if (isFullMatch) {
        activityLog.push(`התאמה מלאה (V ירוק) עבור ${candidate.full_name} → ${job.title} - יוצרת משימה`);
      } else if (match.match_score < 80) {
        reasoning = `ציון ההתאמה (${match.match_score}%) נמוך מהסף (80%)`;
        shouldCreateTask = false;
        await db.entities.Match.update(match.id, {
          carmit_reviewed_date: new Date().toISOString(), carmit_decision: 'skipped_low_score',
          status: 'נדחה - ציון נמוך', status_number: 98
        });
        candidatesSkipped++;
        activityLog.push(`דחיתי: ${candidate.full_name} → ${job.title} (ציון ${match.match_score}% < 80%)`);
        continue;
      }
      
      // Check Pipedrive
      try {
        const pipedriveResponse = await db.functions.invoke('fetchPipedriveNotesForCandidate', { candidate_id: candidate.id });
        if (pipedriveResponse?.data?.success && pipedriveResponse?.data?.history) {
          const historyLower = pipedriveResponse.data.history.toLowerCase();
          const hardRejectPhrases = ['לא רלוונטי לפנדה', 'לא מעוניין יותר', 'ביקש שלא ליצור קשר', 'חזר לצבא', 'לא ליצור קשר', 'not relevant', 'do not contact', 'blacklisted'];
          const employedAtClientPhrases = ['תחל עבודה', 'התחיל לעבוד', 'חתם חוזה', 'הצטרף ל'];
          const clientNames = ['תע״א', "תע'א", 'תעא', 'רפאל', 'תומר', 'אלביט'];

          const isHardRejected = hardRejectPhrases.some(p => historyLower.includes(p));
          const isEmployedAtClient = employedAtClientPhrases.some(p => historyLower.includes(p)) && clientNames.some(c => historyLower.includes(c.toLowerCase()));

          if (isHardRejected || isEmployedAtClient) {
            shouldCreateTask = false;
            reasoning = isHardRejected ? 'מועמד סומן כלא רלוונטי לפנדה-טק' : 'מועמד עובד אצל לקוח חברה';
            await db.entities.MatchNote.create({
              match_id: match.id, user_id: user?.id || 'carmit-system',
              user_name: 'כרמית (סוכן AI)',
              note_text: `❌ **לא העברתי לטל**\n\n**סיבה:** ${reasoning}`, is_system_note: true
            });
          }
        }
      } catch (pipedriveError) {
        console.error('Error fetching Pipedrive:', pipedriveError);
        shouldCreateTask = true; // Fail-safe
      }
      await delay(1000); // pace after Pipedrive call

      const reviewDate = new Date().toISOString();
      const geoStatus = match.geo_status;
      
      if (geoStatus === 'REJECTED') {
        await db.entities.Match.update(match.id, { carmit_reviewed_date: reviewDate, carmit_decision: 'skipped_geo_rejected', status: 'נדחה - גיאוגרפיה', status_number: 95 });
        candidatesSkipped++;
        activityLog.push(`דחיתי: ${candidate.full_name} → גיאוגרפיה נדחה`);
        continue;
      }
      
      if (geoStatus === 'NEEDS_REVIEW') {
        await db.entities.Match.update(match.id, { carmit_reviewed_date: reviewDate, carmit_decision: 'skipped_geo_needs_review', status: 'ממתין לבדיקת מיקום', status_number: 96 });
        candidatesSkipped++;
        continue;
      }

      if (job.deadline) {
        const deadlineDate = new Date(job.deadline);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        if (deadlineDate < today) {
          await db.entities.Match.update(match.id, { carmit_reviewed_date: reviewDate, carmit_decision: 'skipped_deadline', status: 'נדחה - דד-ליין עבר', status_number: 94 });
          candidatesSkipped++;
          activityLog.push(`דחיתי: ${candidate.full_name} (דד-ליין עבר: ${job.deadline})`);
          continue;
        }
      }

      if (shouldCreateTask) {
        const jobAge = Date.now() - new Date(job.created_date).getTime();
        const candidateAge = Date.now() - new Date(candidate.created_date).getTime();
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        const isSpecialistAgent = match.user_name === 'רמי (סוכן AI)';
        
        let priority = 'נמוכה';
        if (isSpecialistAgent) {
          priority = (jobAge < sevenDays || candidateAge < sevenDays) ? 'גבוהה' : 'בינונית';
        } else {
          if (jobAge < sevenDays && candidateAge < sevenDays) priority = 'גבוהה';
          else if (jobAge < sevenDays || candidateAge < sevenDays) priority = 'בינונית';
        }

        let taskNotes = '';
        if (candidate.source_email_date || candidate.created_date) {
          const cvDate = new Date(candidate.source_email_date || candidate.created_date);
          const threeYearsAgo = new Date(); threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
          if (cvDate < threeYearsAgo) taskNotes += `⚠️ קורות חיים מ-${cvDate.getFullYear()} - נדרשת אימות רלוונטיות. `;
        }
        if (geoStatus === 'UNKNOWN_ALLOWED') taskNotes += `⚠️ לא נבדקה התאמה גיאוגרפית. `;

        // Prepare summary letter and questions (skip LLM to avoid rate limit issues)
        let clientSummaryLetter = '';
        let clarificationQuestions = [];
        
        // Skip LLM generation due to rate limit constraints - create tasks with basic info only
        // This avoids 502 Bad Gateway errors from excessive LLM load
        activityLog.push(`דילוג על יצירת מכתב (LLM) - משימה תיווצר ללא תוכן AI`);
        clientSummaryLetter = '';
        clarificationQuestions = [];

        let taskNumber = '';
        try {
          const nextNumber = await db.functions.invoke('getNextTaskNumber', {});
          taskNumber = `TD-${String(nextNumber.data?.nextNumber || tasksCreated + 1).padStart(5, '0')}`;
        } catch (numErr) {
          console.warn('Failed to get next number, using fallback:', numErr);
          taskNumber = `TD-${String(tasksCreated + 1).padStart(5, '0')}`;
        }
        
        await db.entities.RotemTask.create({
          task_number: taskNumber, job_id: match.job_id, job_title: match.job_title,
          candidate_id: match.candidate_id, candidate_name: match.candidate_name,
          candidate_phone: candidate.phone_primary, status: 'לא החל', source: 'carmit',
          priority, match_score: match.match_score, match_id: match.id,
          match_reasons: match.match_reasons, detailed_analysis: match.detailed_analysis,
          geo_status: match.geo_status, geo_distance_km: match.geo_distance_km,
          geo_threshold_km: job.geo_threshold_km || 70, notes: taskNotes || null,
          client_summary_letter: clientSummaryLetter,
          clarification_questions: clarificationQuestions.length > 0 ? JSON.stringify(clarificationQuestions) : null
        });

        const matchUpdateData = { carmit_reviewed_date: reviewDate, carmit_decision: 'created_task' };
        if (job.deadline) matchUpdateData.deadline = job.deadline;
        await db.entities.Match.update(match.id, matchUpdateData);

        tasksCreated++;
        existingTaskKeys.add(taskKey);
        activityLog.push(`יצרתי משימה לטל: ${candidate.full_name} → ${job.title} (עדיפות: ${priority})`);
      } else {
        await db.entities.Match.update(match.id, {
          carmit_reviewed_date: reviewDate, carmit_decision: 'skipped_pipedrive',
          status: 'נדחה - Pipedrive', status_number: 99
        });
        candidatesSkipped++;
        activityLog.push(`דחיתי: ${candidate.full_name} → ${job.title} (${reasoning.substring(0, 100)})`);
      }

      await delay(5000); // pace between matches to avoid rate limit
    }
    
    await db.entities.AgentRunStatus.update(carmitStatus.id, {
      current_activity: 'מסכמת תוצאות', focused_candidate_name: null, focused_job_title: null
    });

    activityLog.push(`סיכום: ${tasksCreated} משימות נוצרו לטל, ${candidatesSkipped} מועמדים נדחו`);
    
    if (tasksCreated > 0 || candidatesSkipped > 0) {
      try {
        await db.entities.SystemActivityLog.create({
          actor_type: 'agent', actor_name: 'carmit',
          actor_image: 'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=40&h=40&fit=crop&crop=face',
          action_type: 'match_created',
          action_description: `כרמית בדקה ${allEnrichedMatches.length} התאמות: יצרה ${tasksCreated} משימות לטל, דחתה ${candidatesSkipped} מועמדים`,
          status: 'success',
          details: JSON.stringify({ tasksCreated, candidatesSkipped, reasoningLog: reasoningLog.slice(0, 10) })
        });
      } catch (logErr) { console.warn('Failed to log activity:', logErr.message); }
    }

    await db.entities.AgentRunStatus.update(carmitStatus.id, {
      is_running: false, last_run_end: new Date().toISOString(),
      matches_created: tasksCreated, current_activity: null,
      detailed_log: activityLog.join('\n'), focused_candidate_name: null, focused_job_title: null
    });

    return Response.json({ 
      success: true, tasksCreated, candidatesSkipped,
      lowScoreRejected: lowScoreProcessed || 0,
      message: `כרמית יצרה ${tasksCreated} משימות לטל, דחתה ${candidatesSkipped} מועמדים (Pipedrive), ${lowScoreProcessed || 0} (ציון נמוך)`
    });

  } catch (error) {
    console.error('Error:', error);
    
    try {
      const db = base44.asServiceRole;
      if (carmitStatus?.id) {
        await db.entities.AgentRunStatus.update(carmitStatus.id, {
          is_running: false, last_run_end: new Date().toISOString(),
          last_error: error.message, current_activity: null,
          focused_candidate_name: null, focused_job_title: null
        });
      } else {
        const carmitStatusList = await db.entities.AgentRunStatus.filter({ agent_name: 'carmit' });
        if (carmitStatusList.length > 0) {
          await db.entities.AgentRunStatus.update(carmitStatusList[0].id, {
            is_running: false, last_run_end: new Date().toISOString(),
            last_error: error.message, current_activity: null,
            focused_candidate_name: null, focused_job_title: null
          });
        }
      }
      
      await db.entities.SystemActivityLog.create({
        actor_type: 'agent', actor_name: 'carmit',
        actor_image: 'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=40&h=40&fit=crop&crop=face',
        action_type: 'agent_error',
        action_description: `⚠️ כרמית נתקלה בשגיאה: ${error.message}. רביב - בדוק את הלוגים`,
        status: 'error',
        details: JSON.stringify({ error: error.message, stack: error.stack })
      });
    } catch (statusErr) { console.error('Failed to update error status:', statusErr); }
    
    return Response.json({ error: error.message }, { status: 500 });
  }
});