import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const { event, data } = body;

    console.log(`Automation triggered: ${event?.type} on ${event?.entity_name} (id: ${event?.entity_id})`);

    // Extract candidate_id from the entity
    let candidateId = null;

    if (event?.entity_name === 'MatchNote') {
      candidateId = data?.candidate_id;
    } else if (event?.entity_name === 'RotemTask') {
      candidateId = data?.candidate_id;
    }

    if (!candidateId) {
      console.log('No candidate_id found in event data, skipping');
      return Response.json({ success: true, skipped: true, reason: 'no candidate_id' });
    }

    // Check if candidate exists
    const candidate = await base44.asServiceRole.entities.Candidate.get(candidateId);
    if (!candidate) {
      console.log(`Candidate ${candidateId} not found`);
      return Response.json({ success: true, skipped: true, reason: 'candidate not found' });
    }

    console.log(`Triggering Pipedrive sync for candidate: ${candidate.full_name || candidateId}`);

    // Invoke the sync function
    const result = await base44.asServiceRole.functions.invoke('syncCandidateToPipedrive', {
      candidate_id: candidateId
    });

    console.log('Sync result:', result);
    return Response.json({ success: true, result });

  } catch (error) {
    console.error('onCandidateActivityCreated error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});