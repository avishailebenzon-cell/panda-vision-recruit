import { createClientFromRequest } from 'npm:@base44/sdk@0.5.0';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);

    if (!(await base44.auth.isAuthenticated())) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const user = await base44.auth.me();
        if (user.app_role !== 'admin') {
            return new Response(JSON.stringify({ error: 'Admin access required' }), {
                status: 403,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        console.log("Fetching target status 'לקוח בחר'...");
        const targetStatusArr = await base44.asServiceRole.entities.CandidateStatus.filter({ status_name: "לקוח בחר" });

        if (!targetStatusArr || targetStatusArr.length === 0) {
            throw new Error("Could not find the status 'לקוח בחר' in CandidateStatus entity. Please ensure it exists.");
        }
        const targetStatus = targetStatusArr[0];
        console.log(`Found target status: ID ${targetStatus.id}, Name: ${targetStatus.status_name}, Number: ${targetStatus.status_number}`);

        console.log("Starting update of all matches to 'לקוח בחר' status...");

        const allMatches = await base44.asServiceRole.entities.Match.list();
        console.log(`Found ${allMatches.length} matches to update`);

        let updatedCount = 0;
        let errorCount = 0;
        const errors = [];

        // Update each match to the dynamically found status
        for (const match of allMatches) {
            try {
                await base44.asServiceRole.entities.Match.update(match.id, {
                    status: targetStatus.status_name,
                    status_number: targetStatus.status_number
                });
                updatedCount++;
            } catch (error) {
                console.error(`Failed to update match ${match.id}:`, error);
                errorCount++;
                errors.push(`Match ID ${match.id}: ${error.message}`);
            }
        }

        console.log(`Update complete. Updated: ${updatedCount}, Errors: ${errorCount}`);

        return new Response(JSON.stringify({
            success: true,
            message: `Successfully updated ${updatedCount} matches to '${targetStatus.status_name}' status. ${errorCount > 0 ? `${errorCount} errors occurred.` : ''}`,
            totalMatches: allMatches.length,
            updatedCount,
            errorCount,
            errors: errorCount > 0 ? errors : undefined
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("Error updating matches status:", error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});