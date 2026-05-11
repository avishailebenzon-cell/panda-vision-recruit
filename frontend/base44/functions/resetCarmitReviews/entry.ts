import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all matches that Carmit has reviewed
    const reviewedMatches = await base44.asServiceRole.entities.Match.filter({
      carmit_reviewed_date: { $exists: true }
    });

    console.log(`Found ${reviewedMatches.length} matches that Carmit reviewed`);

    // Reset Carmit's review data for all matches
    let resetCount = 0;
    for (const match of reviewedMatches) {
      await base44.asServiceRole.entities.Match.update(match.id, {
        carmit_reviewed_date: null,
        carmit_decision: null
      });
      resetCount++;
    }

    // Log the reset
    await base44.entities.SystemActivityLog.create({
      actor_type: 'user',
      actor_name: user.full_name,
      action_type: 'carmit_reset',
      action_description: `אופס את הזיכרון של כרמית - ${resetCount} התאמות`,
      status: 'success',
      details: JSON.stringify({ resetCount, userId: user.id })
    });

    console.log(`Reset complete: ${resetCount} matches`);

    return Response.json({ 
      success: true,
      message: `אופס ${resetCount} התאמות - כרמית תטפל בהן מחדש`,
      resetCount
    });

  } catch (error) {
    console.error('Error resetting Carmit reviews:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});