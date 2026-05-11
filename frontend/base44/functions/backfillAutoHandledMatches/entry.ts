import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    console.log('Starting backfill of auto-handled matches...');

    // Fetch all matches
    const allMatches = await base44.asServiceRole.entities.Match.list();
    console.log(`Found ${allMatches.length} total matches`);

    // Fetch all tasks to check which matches have tasks
    const allTasks = await base44.asServiceRole.entities.UserTask.list();
    const matchesWithTasks = new Set(
      allTasks
        .filter(task => task.match_id)
        .map(task => task.match_id)
    );
    console.log(`Found ${matchesWithTasks.size} matches with tasks`);

    // Fetch all agent feedback to check which matches have conversations
    const allFeedback = await base44.asServiceRole.entities.AgentMatchFeedback.list();
    const matchesWithConversations = new Set(
      allFeedback
        .filter(feedback => feedback.feedback_text && feedback.feedback_text.trim().length > 0)
        .map(feedback => feedback.match_id)
    );
    console.log(`Found ${matchesWithConversations.size} matches with agent conversations`);

    // Process matches that should be auto-marked as handled
    let updatedCount = 0;
    let alreadyMarkedCount = 0;
    const matchesToUpdate = [];

    for (const match of allMatches) {
      const hasTask = matchesWithTasks.has(match.id);
      const hasConversation = matchesWithConversations.has(match.id);
      
      // Should be auto-handled if has task or conversation, but not already manually marked
      if ((hasTask || hasConversation) && !match.is_manually_handled) {
        matchesToUpdate.push(match.id);
      } else if (match.is_manually_handled) {
        alreadyMarkedCount++;
      }
    }

    console.log(`Found ${matchesToUpdate.length} matches to auto-mark as handled`);
    console.log(`Found ${alreadyMarkedCount} matches already manually marked`);

    // Update in batches
    const batchSize = 50;
    for (let i = 0; i < matchesToUpdate.length; i += batchSize) {
      const batch = matchesToUpdate.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(matchId =>
          base44.asServiceRole.entities.Match.update(matchId, {
            is_manually_handled: true,
            manually_handled_date: new Date().toISOString(),
            manually_handled_by_user_id: 'system',
            manually_handled_by_user_name: 'עדכון אוטומטי'
          })
        )
      );
      
      updatedCount += batch.length;
      console.log(`Updated ${updatedCount}/${matchesToUpdate.length} matches...`);
    }

    const summary = {
      success: true,
      totalMatches: allMatches.length,
      matchesWithTasks: matchesWithTasks.size,
      matchesWithConversations: matchesWithConversations.size,
      alreadyMarkedCount,
      updatedCount,
      message: `עודכנו ${updatedCount} התאמות באופן אוטומטי (משימות או שיחות עם סוכן)`
    };

    console.log('Backfill completed:', summary);
    return Response.json(summary);

  } catch (error) {
    console.error('Error in backfill:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});