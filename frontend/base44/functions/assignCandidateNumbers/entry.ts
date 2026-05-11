import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    console.log('Fetching all candidates...');
    const allCandidates = await base44.asServiceRole.entities.Candidate.list();
    console.log(`Total candidates: ${allCandidates.length}`);

    // Find candidates with invalid numbers
    const needsUpdate = [];
    const validNumbers = [];

    for (const c of allCandidates) {
      if (c.candidate_number && c.candidate_number.startsWith('CAN-') && c.candidate_number !== 'CAN-0001') {
        const numPart = c.candidate_number.replace('CAN-', '');
        const num = parseInt(numPart);
        if (!isNaN(num) && num > 0) {
          validNumbers.push(num);
        } else {
          needsUpdate.push(c);
        }
      } else {
        needsUpdate.push(c);
      }
    }

    console.log(`Candidates needing update: ${needsUpdate.length}`);
    console.log(`Valid numbers found: ${validNumbers.length}`);

    if (needsUpdate.length === 0) {
      return Response.json({ message: 'All candidates have valid numbers', updated: 0 });
    }
 
    // Find next number to use
    const maxNumber = validNumbers.length > 0 ? Math.max(...validNumbers) : 0;
    let nextNumber = maxNumber + 1;
    console.log(`Starting from number: ${nextNumber}`);

    // Update candidates one by one
    let updated = 0;
    for (const candidate of needsUpdate) {
      const newNumber = `CAN-${String(nextNumber).padStart(4, '0')}`;
      
      await base44.asServiceRole.entities.Candidate.update(candidate.id, {
        candidate_number: newNumber
      });

      console.log(`${updated + 1}/${needsUpdate.length}: ${candidate.full_name || candidate.first_name} -> ${newNumber}`);
      updated++;
      nextNumber++;
    }

    return Response.json({
      success: true,
      message: `Assigned unique numbers to ${updated} candidates`,
      updated,
      total: allCandidates.length,
      next_available: nextNumber
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});