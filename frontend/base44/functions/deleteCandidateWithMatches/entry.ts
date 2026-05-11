import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { candidate_id } = await req.json();

    if (!candidate_id) {
      return Response.json({ error: 'candidate_id is required' }, { status: 400 });
    }

    // Get all matches for this candidate
    const matches = await base44.entities.Match.filter({ candidate_id });
    
    // Delete all matches
    await Promise.all(matches.map(match => 
      base44.entities.Match.delete(match.id)
    ));

    // Delete the candidate
    await base44.entities.Candidate.delete(candidate_id);

    return Response.json({ 
      success: true,
      message: `המועמד נמחק בהצלחה יחד עם ${matches.length} התאמות`,
      deleted_matches: matches.length
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});