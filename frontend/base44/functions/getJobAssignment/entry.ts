import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Central job assignment logic - used by both Carmit and all recruitment agents
// This ensures consistency across the system

export const analyzeJobAssignment = (job) => {
  const title = (job.title || '').toLowerCase();
  const description = (job.description || '').toLowerCase();
  const requirements = (job.requirements || '').toLowerCase();
  const fullText = `${title} ${description} ${requirements}`;

  // Define keywords for each agent
  const naamaKeywords = ['תוכנה', 'software', 'developer', 'מפתח', 'embedded', 'firmware', 'c++', 'python', 'java', 'c#', 'react', 'frontend', 'backend', 'full stack', 'fullstack', '.net', 'web', 'משוטט', 'קוד', 'תכנות', 'פיתוח תוכנה', 'algorithm', 'אלגוריתם', 'programming', 'sw ', ' sw', 'matlab', 'simulink', 'real-time', 'real time', 'javascript', 'typescript', 'node', 'angular', 'vue'];
  
  const alikKeywords = ['אלקטרוני', 'electronics', 'hardware', 'pcb', 'fpga', 'vhdl', 'analog', 'digital', 'צב"ד', 'אנלוג'];
  
  const itayKeywords = ['devops', 'cloud', 'aws', 'azure', 'kubernetes', 'docker', 'network', 'security', 'סייבר', 'cyber', 'תשתיות', 'helpdesk', 'noc', 'dba', 'sysadmin', 'linux admin', 'windows server', 'vmware', 'active directory'];
  
  const liorKeywords = ['system engineer', 'systems engineer', 'srs', 'sss', 'mbse', 'doors', 'הנדסת מערכת'];
  
  const ofirKeywords = ['מכונ', 'mechanical', 'מכני', 'solidworks', 'catia', 'תכן מכני', 'הנדסת מכונות'];

  // Score each agent
  const naamaScore = naamaKeywords.filter(k => fullText.includes(k)).length;
  const alikScore = alikKeywords.filter(k => fullText.includes(k)).length;
  const itayScore = itayKeywords.filter(k => fullText.includes(k)).length;
  const liorScore = liorKeywords.filter(k => fullText.includes(k)).length;
  const ofirScore = ofirKeywords.filter(k => fullText.includes(k)).length;

  // Decide based on highest score
  // Priority: Software > Electronics > IT > System > Mechanical > GC
  
  if (naamaScore > 0 && naamaScore >= alikScore && naamaScore >= itayScore && naamaScore >= liorScore && naamaScore >= ofirScore) {
    return { agent: 'naama', displayName: 'נעמה (תוכנה)', functionName: 'runNaamaAgent' };
  }
  
  if (alikScore > 0 && alikScore > itayScore && alikScore > liorScore && alikScore > ofirScore) {
    return { agent: 'alik', displayName: 'אליק (אלקטרוניקה)', functionName: 'runAlikAgent' };
  }
  
  if (itayScore > 0 && itayScore > liorScore && itayScore > ofirScore) {
    return { agent: 'itay', displayName: 'איתי (IT)', functionName: 'runItayAgent' };
  }
  
  // System engineering - only if no PMO/project management/industrial engineering
  if (liorScore > 0 && liorScore > ofirScore &&
      !fullText.includes('תעשי') && !fullText.includes('ניהול') &&
      !fullText.includes('pmo') && !fullText.includes('project manager') &&
      !fullText.includes('פרויקט')) {
    return { agent: 'lior', displayName: 'ליאור (הנדסת מערכת)', functionName: 'runLiorAgent' };
  }
  
  if (ofirScore > 0) {
    return { agent: 'ofir', displayName: 'אופיר (הנדסת מכונות)', functionName: 'runOfirAgent' };
  }
  
  // Special case: "מחשוב" only goes to Itay if no other matches
  if (fullText.includes('מחשוב') && naamaScore === 0 && alikScore === 0 && liorScore === 0 && ofirScore === 0) {
    return { agent: 'itay', displayName: 'איתי (IT)', functionName: 'runItayAgent' };
  }
  
  // Default to GC for everything else
  return { agent: 'gc', displayName: 'GC (כללי)', functionName: 'runGcAgent' };
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    
    if (!payload.job_id) {
      return Response.json({ error: 'Missing job_id' }, { status: 400 });
    }
    
    // Fetch the job
    const jobs = await base44.asServiceRole.entities.Job.filter({ id: payload.job_id });
    if (!jobs || jobs.length === 0) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }
    
    const job = jobs[0];
    const assignment = analyzeJobAssignment(job);
    
    return Response.json({
      success: true,
      job_id: job.id,
      job_title: job.title,
      assigned_agent: assignment.agent,
      agent_display_name: assignment.displayName,
      agent_function_name: assignment.functionName
    });
    
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});