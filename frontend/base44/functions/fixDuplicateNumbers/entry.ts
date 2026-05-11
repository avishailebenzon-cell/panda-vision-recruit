import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    console.log('Finding candidates with duplicate/invalid numbers...');

    // Get all candidates
    let allCandidates = [];
    let skip = 0;
    const batchSize = 500;

    while (true) {
      const batch = await base44.asServiceRole.entities.Candidate.list(null, batchSize, skip);
      if (!batch || batch.length === 0) break;
      allCandidates = allCandidates.concat(batch);
      skip += batchSize;
      if (batch.length < batchSize) break;
    }

    // Filter candidates needing numbers AND have valid ID
    const needsNumbers = allCandidates.filter(c => 
      c && c.id && (
        !c.candidate_number || 
        c.candidate_number === 'CAN-0000' || 
        c.candidate_number === 'CAN-0001'
      )
    );

    console.log(`Found ${needsNumbers.length} valid candidates needing unique numbers`);

    if (needsNumbers.length === 0) {
      return Response.json({
        success: true,
        message: 'כל המועמדים כבר בעלי מספרים ייחודיים',
        updated: 0
      });
    }

    // Sort by creation date
    needsNumbers.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));

    // Get highest existing valid number
    const validNumbers = await base44.asServiceRole.entities.Candidate.filter({
      candidate_number: { $regex: '^CAN-(?!0000$|0001$)' }
    });

    let nextNumber = 2; // Start from 2 since 1 is the duplicate
    for (const c of validNumbers) {
      if (c.candidate_number) {
        const match = c.candidate_number.match(/CAN-(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num >= nextNumber && num < 9999) {
            nextNumber = num + 1;
          }
        }
      }
    }

    console.log(`Starting from number: ${nextNumber}`);

    // Process in small batches
    const maxPerRun = 50;
    const toProcess = needsNumbers.slice(0, maxPerRun);
    let updated = 0;

    for (const candidate of toProcess) {
      const newNumber = `CAN-${String(nextNumber).padStart(4, '0')}`;

      try {
        await base44.asServiceRole.entities.Candidate.update(candidate.id, {
          candidate_number: newNumber
        });

        console.log(`✓ ${candidate.first_name || ''} ${candidate.last_name || ''}: ${newNumber}`);
        updated++;
        nextNumber++;

        // Delay every 5 updates
        if (updated % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (err) {
        console.error(`Failed ${candidate.id}:`, err.message);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    const remaining = needsNumbers.length - updated;

    return Response.json({
      success: true,
      updated,
      remaining,
      isComplete: remaining === 0,
      message: remaining === 0
        ? `✅ הושלם! ${updated} מועמדים קיבלו מספרים ייחודיים`
        : `⏸️ ${updated} עודכנו, נותרו ${remaining}. הרץ שוב.`
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});