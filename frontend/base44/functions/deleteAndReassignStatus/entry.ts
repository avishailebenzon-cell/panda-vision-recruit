import { createClientFromRequest } from 'npm:@base44/sdk@0.7.0';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.app_role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        const { statusToDeleteId, newStatusId } = await req.json();

        if (!statusToDeleteId || !newStatusId) {
            return Response.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        // 1. Get status details
        const allStatuses = await base44.asServiceRole.entities.CandidateStatus.list();
        const statusToDelete = allStatuses.find(s => s.id === statusToDeleteId);
        const newStatus = allStatuses.find(s => s.id === newStatusId);

        if (!statusToDelete || !newStatus) {
            return Response.json({ error: 'Status not found' }, { status: 404 });
        }

        // 2. Reassign Matches
        const matchesToUpdate = await base44.asServiceRole.entities.Match.filter({ status_number: statusToDelete.status_number });
        for (const match of matchesToUpdate) {
            await base44.asServiceRole.entities.Match.update(match.id, {
                status: newStatus.status_name,
                status_number: newStatus.status_number
            });
        }

        // 3. Reassign Candidates
        const candidatesToUpdate = await base44.asServiceRole.entities.Candidate.filter({ status_number: statusToDelete.status_number });
        for (const candidate of candidatesToUpdate) {
            await base44.asServiceRole.entities.Candidate.update(candidate.id, {
                status: newStatus.status_name, // This field exists on Candidate
                status_number: newStatus.status_number
            });
        }
        
        // 4. Update next_possible_statuses in other statuses
        let updatedNextStatusesCount = 0;
        for (const status of allStatuses) {
            if (status.next_possible_statuses && status.next_possible_statuses.includes(statusToDelete.status_number)) {
                const updatedNext = status.next_possible_statuses.filter(num => num !== statusToDelete.status_number);
                await base44.asServiceRole.entities.CandidateStatus.update(status.id, { next_possible_statuses: updatedNext });
                updatedNextStatusesCount++;
            }
        }

        // 5. Delete the old status
        await base44.asServiceRole.entities.CandidateStatus.delete(statusToDeleteId);

        return Response.json({
            success: true,
            message: `Status "${statusToDelete.status_name}" deleted and all items reassigned to "${newStatus.status_name}".`,
            summary: {
                updatedMatches: matchesToUpdate.length,
                updatedCandidates: candidatesToUpdate.length,
                updatedNextStatuses: updatedNextStatusesCount
            }
        });

    } catch (error) {
        console.error("Error deleting and reassigning status:", error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});