import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Get the most recent candidate with a candidate_number
        const recentCandidates = await base44.asServiceRole.entities.Candidate.filter(
            { candidate_number: { $ne: null } },
            '-created_date',
            1
        );
        
        let nextNumber = 1;
        
        if (recentCandidates.length > 0) {
            const lastNumber = recentCandidates[0].candidate_number;
            // Extract number from format "CAN-000001"
            const match = lastNumber.match(/CAN-(\d+)/);
            if (match) {
                nextNumber = parseInt(match[1], 10) + 1;
            }
        }
        
        const candidateNumber = `CAN-${String(nextNumber).padStart(6, '0')}`;
        
        return Response.json({
            candidateNumber,
            nextNumber
        });
        
    } catch (error) {
        console.error('Error getting next candidate number:', error);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});