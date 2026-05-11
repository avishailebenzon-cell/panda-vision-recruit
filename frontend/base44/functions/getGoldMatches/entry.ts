import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query params
    const url = new URL(req.url);
    const minScore = parseFloat(url.searchParams.get('min_score') || '85');
    const limit = parseInt(url.searchParams.get('limit') || '300');
    const dateFrom = url.searchParams.get('date_from');

    // Build query filter
    const filter = { match_score: { $gte: minScore }, carmit_reviewed_date: { $exists: true } };
    if (dateFrom) {
      filter.created_date = { $gte: dateFrom };
    }

    // Fetch gold matches (matches with Carmit's approval and good score)
    const matches = await base44.entities.Match.filter(filter, '-match_score', limit);

    // Get stats
    const allMatches = await base44.entities.Match.filter({ carmit_reviewed_date: { $exists: true } });
    const thisWeekMatches = allMatches.filter(m => {
      const createdDate = new Date(m.created_date);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return createdDate >= weekAgo;
    });
    const prevWeekMatches = allMatches.filter(m => {
      const createdDate = new Date(m.created_date);
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return createdDate >= twoWeeksAgo && createdDate < weekAgo;
    });

    // Calculate agent breakdown
    const byAgent = {};
    matches.forEach(m => {
      if (m.user_name) {
        byAgent[m.user_name] = (byAgent[m.user_name] || 0) + 1;
      }
    });

    // Calculate average score
    const avgScore = matches.length > 0 
      ? Math.round(matches.reduce((sum, m) => sum + (m.match_score || 0), 0) / matches.length)
      : 0;

    return Response.json({
      gold_matches: matches,
      stats: {
        total: matches.length,
        this_week: thisWeekMatches.length,
        prev_week: prevWeekMatches.length,
        avg_score: avgScore,
        by_agent: byAgent
      }
    });

  } catch (error) {
    console.error('Error in getGoldMatches:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});