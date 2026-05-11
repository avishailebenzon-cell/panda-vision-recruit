import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { candidates } = await req.json();
        
        if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
            return Response.json({ error: 'No candidates data provided' }, { status: 400 });
        }

        console.log(`Saving ${candidates.length} candidates to database...`);
        
        // Build maps of existing candidates for fast lookup
        const candidatesByEmail = new Map();
        const candidatesByIdNumber = new Map();
        const candidatesByName = new Map();
        
        let skip = 0;
        const batchSize = 100;
        let hasMore = true;
        
        while (hasMore) {
            try {
                const batch = await base44.asServiceRole.entities.Candidate.list('-created_date', batchSize, skip);
                if (!batch || batch.length === 0) {
                    hasMore = false;
                    break;
                }
                
                batch.forEach(c => {
                    if (c.email) candidatesByEmail.set(c.email.toLowerCase(), c);
                    if (c.id_number) candidatesByIdNumber.set(c.id_number, c);
                    const name1 = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase().trim();
                    const name2 = `${c.last_name || ''} ${c.first_name || ''}`.toLowerCase().trim();
                    if (name1) candidatesByName.set(name1, c);
                    if (name2) candidatesByName.set(name2, c);
                });
                
                skip += batchSize;
                await new Promise(resolve => setTimeout(resolve, 300));
                
                if (batch.length < batchSize) hasMore = false;
            } catch (error) {
                console.error('Error loading candidate batch:', error);
                hasMore = false;
            }
        }
        
        const results = {
            created: 0,
            updated: 0,
            errors: []
        };
        
        // Process each candidate
        for (let i = 0; i < candidates.length; i++) {
            const candidateData = candidates[i];
            const { rowNumber, ...dataToSave } = candidateData;
            
            try {
                // Remove empty fields
                Object.keys(dataToSave).forEach(key => {
                    if (dataToSave[key] === undefined || dataToSave[key] === '') {
                        delete dataToSave[key];
                    }
                });
                
                // Find existing candidate
                let existingCandidate = null;
                
                if (dataToSave.email) {
                    existingCandidate = candidatesByEmail.get(dataToSave.email.toLowerCase());
                }
                
                if (!existingCandidate && dataToSave.id_number) {
                    existingCandidate = candidatesByIdNumber.get(dataToSave.id_number);
                }
                
                if (!existingCandidate) {
                    const name1 = dataToSave.full_name?.toLowerCase().trim();
                    const name2 = `${dataToSave.last_name} ${dataToSave.first_name}`.toLowerCase().trim();
                    existingCandidate = candidatesByName.get(name1) || candidatesByName.get(name2);
                }
                
                if (existingCandidate) {
                    await base44.asServiceRole.entities.Candidate.update(existingCandidate.id, dataToSave);
                    results.updated++;
                } else {
                    const newCandidate = await base44.asServiceRole.entities.Candidate.create(dataToSave);
                    results.created++;
                    
                    // Add to maps for subsequent lookups
                    if (dataToSave.email) candidatesByEmail.set(dataToSave.email.toLowerCase(), newCandidate);
                    if (dataToSave.id_number) candidatesByIdNumber.set(dataToSave.id_number, newCandidate);
                }
                
                // Delay to avoid rate limiting
                if ((results.created + results.updated) % 3 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                
            } catch (error) {
                console.error(`Error saving candidate row ${rowNumber}:`, error.message);
                results.errors.push({
                    rowNumber,
                    name: dataToSave.full_name,
                    error: error.message
                });
            }
        }
        
        console.log('Save completed:', results);
        
        // Log to SystemActivityLog
        await base44.asServiceRole.entities.SystemActivityLog.create({
            actor_type: 'user',
            actor_name: user.full_name,
            action_type: 'import_onboarding_responses',
            action_description: `ייבוא טפסים: ${results.created} נוצרו, ${results.updated} עודכנו`,
            status: 'success',
            details: JSON.stringify(results)
        });
        
        return Response.json(results);
        
    } catch (error) {
        console.error('Save error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});