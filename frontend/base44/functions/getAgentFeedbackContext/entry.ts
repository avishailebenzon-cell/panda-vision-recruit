import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Generic function to get feedback context for a recruitment agent.
 * Returns a formatted string to inject into the agent's prompt.
 * 
 * Usage: invoke('getAgentFeedbackContext', { agent_name: 'itay' })
 * Response: { feedbackText: "..." }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { agent_name } = body;

    if (!agent_name) {
      return Response.json({ error: 'agent_name is required' }, { status: 400 });
    }

    // Load last 30 active feedbacks for this agent
    let feedbacks = [];
    try {
      feedbacks = await base44.asServiceRole.entities.AgentMatchFeedback.filter(
        { agent_name, is_active: true },
        '-created_date',
        30
      );
      if (!Array.isArray(feedbacks)) feedbacks = [];
    } catch (e) {
      console.error('Failed to load feedbacks:', e.message);
      return Response.json({ feedbackText: '' });
    }

    if (feedbacks.length === 0) {
      return Response.json({ feedbackText: '' });
    }

    const approved = feedbacks.filter(f => f.feedback_type === 'approved');
    const rejected = feedbacks.filter(f => f.feedback_type === 'rejected');

    let feedbackText = `\n\n---\n📚 למידה מפידבק היסטורי של המגייסות (${feedbacks.length} דוגמאות):\n`;

    if (approved.length > 0) {
      feedbackText += `\n✅ התאמות שאושרו (למד מה עובד):\n`;
      approved.slice(0, 10).forEach(f => {
        feedbackText += `• ${f.candidate_name} ← "${f.job_title}" (ציון ${f.original_match_score || '?'})\n`;
        if (f.candidate_skills_summary) feedbackText += `  כישורים: ${f.candidate_skills_summary.substring(0, 150)}\n`;
        if (f.notes) feedbackText += `  הערה: ${f.notes}\n`;
      });
    }

    if (rejected.length > 0) {
      feedbackText += `\n❌ התאמות שנדחו (למד מה לא עובד):\n`;
      rejected.slice(0, 15).forEach(f => {
        feedbackText += `• ${f.candidate_name} ← "${f.job_title}" (ציון ${f.original_match_score || '?'})\n`;
        if (f.rejection_reason) feedbackText += `  סיבת דחייה: ${f.rejection_reason}\n`;
        if (f.candidate_skills_summary) feedbackText += `  כישורים: ${f.candidate_skills_summary.substring(0, 100)}\n`;
      });
    }

    feedbackText += `\nהתחשב בפידבקים אלו בעת ניתוח המועמדים הנוכחיים - העלה ציון למועמדים דומים לשאושרו, הורד ציון למועמדים דומים לשנדחו.\n---`;

    return Response.json({ feedbackText });

  } catch (error) {
    console.error('Error in getAgentFeedbackContext:', error);
    return Response.json({ feedbackText: '' });
  }
});