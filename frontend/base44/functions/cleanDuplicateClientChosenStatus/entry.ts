import { createClientFromRequest } from 'npm:@base44/sdk@0.7.0';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.app_role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        console.log("Starting cleanup of duplicate 'לקוח בחר' status...");

        // 1. Find both statuses
        const allStatuses = await base44.asServiceRole.entities.CandidateStatus.list();
        const clientChosenStatuses = allStatuses.filter(s => 
            s.status_name && s.status_name.includes('לקוח בחר')
        );

        console.log(`Found ${clientChosenStatuses.length} statuses with 'לקוח בחר':`);
        clientChosenStatuses.forEach(s => {
            console.log(`- ID: ${s.id}, Name: "${s.status_name}", Number: ${s.status_number}`);
        });

        if (clientChosenStatuses.length < 2) {
            return Response.json({
                success: true,
                message: 'No duplicate status found. Only one "לקוח בחר" status exists.',
                statuses: clientChosenStatuses
            });
        }

        // Find the original and the duplicate
        const originalStatus = clientChosenStatuses.find(s => s.status_name === 'לקוח בחר');
        const duplicateStatus = clientChosenStatuses.find(s => 
            s.status_name.includes('לקוח בחר') && s.status_name !== 'לקוח בחר'
        );

        if (!originalStatus || !duplicateStatus) {
            return Response.json({
                success: false,
                error: 'Could not identify original vs duplicate status',
                statuses: clientChosenStatuses
            });
        }

        console.log(`Original status: "${originalStatus.status_name}" (Number: ${originalStatus.status_number})`);
        console.log(`Duplicate status: "${duplicateStatus.status_name}" (Number: ${duplicateStatus.status_number})`);

        // 2. Update all Match records using the duplicate status
        const matchesWithDuplicateStatus = await base44.asServiceRole.entities.Match.filter({
            status_number: duplicateStatus.status_number
        });

        console.log(`Found ${matchesWithDuplicateStatus.length} matches using duplicate status`);

        let updatedMatches = 0;
        for (const match of matchesWithDuplicateStatus) {
            try {
                await base44.asServiceRole.entities.Match.update(match.id, {
                    status: originalStatus.status_name,
                    status_number: originalStatus.status_number
                });
                updatedMatches++;
            } catch (error) {
                console.error(`Failed to update match ${match.id}:`, error);
            }
        }

        // 3. Update all Candidate records using the duplicate status
        const candidatesWithDuplicateStatus = await base44.asServiceRole.entities.Candidate.filter({
            status_number: duplicateStatus.status_number
        });

        console.log(`Found ${candidatesWithDuplicateStatus.length} candidates using duplicate status`);

        let updatedCandidates = 0;
        for (const candidate of candidatesWithDuplicateStatus) {
            try {
                await base44.asServiceRole.entities.Candidate.update(candidate.id, {
                    status: originalStatus.status_name,
                    status_number: originalStatus.status_number
                });
                updatedCandidates++;
            } catch (error) {
                console.error(`Failed to update candidate ${candidate.id}:`, error);
            }
        }

        // 4. Delete the duplicate status
        await base44.asServiceRole.entities.CandidateStatus.delete(duplicateStatus.id);

        console.log(`Cleanup completed successfully:
- Updated ${updatedMatches} matches
- Updated ${updatedCandidates} candidates  
- Deleted duplicate status "${duplicateStatus.status_name}"`);

        return Response.json({
            success: true,
            message: `Cleanup completed successfully. Removed duplicate status "${duplicateStatus.status_name}" and updated all references to use "${originalStatus.status_name}".`,
            summary: {
                originalStatus: {
                    name: originalStatus.status_name,
                    number: originalStatus.status_number
                },
                removedStatus: {
                    name: duplicateStatus.status_name,
                    number: duplicateStatus.status_number
                },
                updatedMatches,
                updatedCandidates
            }
        });

    } catch (error) {
        console.error("Error in cleanup:", error);
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});