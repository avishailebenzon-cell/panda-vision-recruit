import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Check if this is a scheduled task (no user auth) or manual admin call
    const isAuthenticated = await base44.auth.isAuthenticated();
    
    if (isAuthenticated) {
      const user = await base44.auth.me();
      if (!user || user.role !== 'admin') {
        return Response.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }
    // If not authenticated, allow (it's a scheduled task running via service role)

    console.log('Starting unique number assignment...');

    const startTime = Date.now();
    const MAX_TIME_MS = 110000; // 1.8 minutes max to leave buffer

    // Step 1: Find highest existing number by loading in small batches
    let highestNumber = 0;
    let skip = 0;
    const batchSize = 100;

    while (true) {
      const batch = await base44.asServiceRole.entities.Candidate.list(null, batchSize, skip);
      if (!batch || batch.length === 0) break;

      for (const c of batch) {
        if (c.candidate_number) {
          const match = c.candidate_number.match(/CAN-(\d+)/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > highestNumber && num < 9999) {
              highestNumber = num;
            }
          }
        }
      }

      skip += batchSize;
      if (batch.length < batchSize) break;
    }

    console.log(`Highest existing number: CAN-${String(highestNumber).padStart(4, '0')}`);
    let nextNumber = highestNumber + 1;

    // Step 2: Find candidates without proper numbers (null or duplicates like CAN-0001)
    const candidatesNeedingNumbers = [];
    skip = 0;

    while (true) {
      const batch = await base44.asServiceRole.entities.Candidate.list(null, batchSize, skip);
      if (!batch || batch.length === 0) break;

      for (const c of batch) {
        if (!c.candidate_number || c.candidate_number === 'CAN-0001' || c.candidate_number === 'CAN-0000') {
          candidatesNeedingNumbers.push(c);
        }
      }

      skip += batchSize;
      if (batch.length < batchSize) break;
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Sort by creation date (oldest first)
    candidatesNeedingNumbers.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));

    console.log(`Found ${candidatesNeedingNumbers.length} candidates needing numbers`);

    // Step 3: Process max 15 per run with careful rate limiting
    const maxPerRun = 15;
    const toProcess = candidatesNeedingNumbers.slice(0, maxPerRun);
    
    let updated = 0;

    for (const candidate of toProcess) {
      if (Date.now() - startTime > MAX_TIME_MS) {
        console.log('Timeout approaching - stopping');
        break;
      }

      const newNumber = `CAN-${String(nextNumber).padStart(4, '0')}`;

      try {
        await base44.asServiceRole.entities.Candidate.update(candidate.id, {
          candidate_number: newNumber
        });

        console.log(`✓ Updated ${candidate.first_name} ${candidate.last_name}: ${newNumber}`);
        updated++;
        nextNumber++;

        // Rate limiting: wait 5 seconds between each update
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (updateErr) {
        console.error(`Failed to update ${candidate.id}:`, updateErr.message);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    const remaining = candidatesNeedingNumbers.length - updated;

    return Response.json({
      success: true,
      updated,
      remaining,
      nextAvailable: nextNumber,
      isComplete: remaining === 0,
      message: remaining === 0 
        ? `✅ הושלם! ${updated} מועמדים קיבלו מספרים`
        : `⏸️ ${updated} מועמדים עודכנו. נותרו ${remaining}. הרץ שוב להמשך.`
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});