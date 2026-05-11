import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    console.log('Starting match number assignment v1.0...');

    // Get or create the match counter first
    let counter = await base44.asServiceRole.entities.MessageCounter.filter({
      counter_type: 'match_number'
    });

    let currentValue = 0;

    if (!counter || counter.length === 0) {
      counter = await base44.asServiceRole.entities.MessageCounter.create({
        counter_type: 'match_number',
        last_number: 0,
        current_value: 0
      });
    } else {
      counter = counter[0];
      currentValue = counter.current_value || 0;
    }

    console.log(`Starting from counter value: ${currentValue}`);

    // Get recent matches and filter client-side to avoid timeout
    const recentMatches = await base44.asServiceRole.entities.Match.list('created_date', 100);
    
    // Filter for matches without numbers
    const batch = recentMatches.filter(m => !m.match_number || m.match_number === '').slice(0, 20);

    if (!batch || batch.length === 0) {
      return Response.json({
        status: 'ok',
        message: 'All recent matches already have numbers',
        assigned: 0
      });
    }

    console.log(`Processing batch of ${batch.length} matches...`);

    // Update matches sequentially in small batches to avoid overload
    let completed = 0;
    
    for (const match of batch) {
      if (!match.id) continue;

      currentValue++;
      const matchNumber = `M-${String(currentValue).padStart(5, '0')}`;
 
      try {
        await base44.asServiceRole.entities.Match.update(match.id, {
          match_number: matchNumber
        });
        completed++;
        
        // Small delay every 5 updates
        if (completed % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (err) {
        console.error(`Failed to update match ${match.id}:`, err.message);
      }
    }

    // Update counter
    await base44.asServiceRole.entities.MessageCounter.update(counter.id, {
      current_value: currentValue,
      last_number: currentValue
    });

    console.log(`✓ Assigned ${completed} match numbers (counter: ${currentValue})`);

    return Response.json({
      status: 'ok',
      assigned: completed,
      final_counter: currentValue,
      message: batch.length === 20 ? 'Run again to assign more' : 'All done'
    });

  } catch (error) {
    console.error('Error assigning match numbers:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});