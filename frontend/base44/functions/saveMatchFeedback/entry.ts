import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Saves feedback on a match (approved/rejected) for agent learning.
 * Called when a user approves or rejects a match.
 * 
 * Payload: { match_id, feedback_type: "approved"|"rejected", rejection_reason?, notes? }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { match_id, feedback_type, rejection_reason, notes } = body;

    if (!match_id || !feedback_type) {
      return Response.json({ error: 'match_id and feedback_type are required' }, { status: 400 });
    }

    // Fetch the match
    const matches = await base44.entities.Match.filter({ id: match_id });
    if (!matches || matches.length === 0) {
      return Response.json({ error: 'Match not found' }, { status: 404 });
    }
    const match = matches[0];

    // Only save feedback for automatic recommendations
    if (!match.is_automatic_recommendation) {
      return Response.json({ success: true, skipped: true, reason: 'Not an automatic match' });
    }

    // Determine agent name from match user_name
    const agentNameMap = {
      'נעמה (סוכן AI)': 'naama',
      'אליק (סוכן AI)': 'alik',
      'איתי (סוכן AI)': 'itay',
      'ליאור (סוכן AI)': 'lior',
      'אופיר (סוכן AI)': 'ofir',
      'דגנית (סוכנת AI)': 'dganit',
      'GC (סוכן AI)': 'gc',
      'רמי (סוכן AI)': 'rami',
    };

    const agent_name = agentNameMap[match.user_name];
    if (!agent_name) {
      return Response.json({ success: true, skipped: true, reason: 'Unknown agent' });
    }

    // Fetch candidate skills for context
    let candidateSkillsSummary = '';
    try {
      const candidates = await base44.entities.Candidate.filter({ id: match.candidate_id });
      if (candidates && candidates.length > 0) {
        const c = candidates[0];
        candidateSkillsSummary = [
          c.skills_summary,
          c.main_experience,
          c.main_tech_tools,
          c.main_programming_languages
        ].filter(Boolean).join(' | ').substring(0, 300);
      }
    } catch (e) { /* ignore */ }

    // Check if feedback already exists for this match
    const existing = await base44.entities.AgentMatchFeedback.filter({ 
      agent_name,
      candidate_id: match.candidate_id,
      job_id: match.job_id
    });

    if (existing && existing.length > 0) {
      // Update existing feedback
      await base44.entities.AgentMatchFeedback.update(existing[0].id, {
        feedback_type,
        rejection_reason: rejection_reason || null,
        notes: notes || null,
        reviewer_name: user.full_name,
        original_match_score: match.match_score
      });
    } else {
      // Create new feedback
      await base44.entities.AgentMatchFeedback.create({
        agent_name,
        job_id: match.job_id,
        job_title: match.job_title,
        candidate_id: match.candidate_id,
        candidate_name: match.candidate_name,
        candidate_skills_summary: candidateSkillsSummary,
        feedback_type,
        rejection_reason: rejection_reason || null,
        original_match_score: match.match_score,
        reviewer_name: user.full_name,
        notes: notes || null,
        is_active: true
      });
    }

    return Response.json({ success: true, agent_name, feedback_type });

  } catch (error) {
    console.error('Error saving match feedback:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});