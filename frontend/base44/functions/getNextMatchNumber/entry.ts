import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get or create the match counter
    let counter = await base44.asServiceRole.entities.MessageCounter.filter({
      counter_type: 'match_number'
    });

    if (!counter || counter.length === 0) {
      // Create initial counter
      counter = await base44.asServiceRole.entities.MessageCounter.create({
        counter_type: 'match_number',
        last_number: 0,
        current_value: 0
      });
    } else {
      counter = counter[0];
    }

    // Increment the counter atomically
    const nextNumber = (counter.current_value || 0) + 1;

    // Update the counter
    await base44.asServiceRole.entities.MessageCounter.update(counter.id, {
      current_value: nextNumber,
      last_number: nextNumber
    });

    // Format as M-XXXXX
    const matchNumber = `M-${String(nextNumber).padStart(5, '0')}`;

    return Response.json({
      status: 'ok',
      match_number: matchNumber,
      numeric_value: nextNumber
    });

  } catch (error) {
    console.error('Error getting next match number:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});