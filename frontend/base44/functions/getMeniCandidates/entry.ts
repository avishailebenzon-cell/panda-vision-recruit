import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('📋 Fetching Level 1 candidates...');

    // Load all candidates
    const allCandidates = await base44.asServiceRole.entities.Candidate.list('-created_date', 10000);
    
    console.log(`Total candidates type: ${typeof allCandidates}`);
    console.log(`Total candidates: ${Array.isArray(allCandidates) ? allCandidates.length : 'NOT AN ARRAY'}`);
    
    // If it's a string, try to parse it
    let candidatesList = allCandidates;
    if (typeof allCandidates === 'string') {
      try {
        candidatesList = JSON.parse(allCandidates);
        console.log('Successfully parsed string to array');
      } catch (parseErr) {
        console.error('Failed to parse candidates:', parseErr.message);
        return Response.json({ error: 'Data parsing error', details: parseErr.message }, { status: 500 });
      }
    }
    
    if (!Array.isArray(candidatesList)) {
      return Response.json({ 
        error: 'Invalid data type', 
        receivedType: typeof candidatesList,
        sample: JSON.stringify(candidatesList).substring(0, 200)
      }, { status: 500 });
    }

    // Filter Level 1 candidates
    const level1Candidates = candidatesList.filter(c => {
      const clearance = c.security_clearance;
      return clearance === 'רמה 1' || clearance?.trim() === 'רמה 1';
    });

    console.log(`Found ${level1Candidates.length} Level 1 candidates`);

    return Response.json({ 
      success: true,
      totalCandidates: candidatesList.length,
      level1Count: level1Candidates.length,
      candidates: level1Candidates.map(c => ({
        id: c.id,
        name: `${c.first_name} ${c.last_name}`,
        security_clearance: c.security_clearance,
        main_discipline: c.main_discipline,
        main_tech_tools: c.main_tech_tools
      }))
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});