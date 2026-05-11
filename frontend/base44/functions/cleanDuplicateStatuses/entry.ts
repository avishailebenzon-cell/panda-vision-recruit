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

        console.log("Starting cleanup of duplicate statuses...");

        // Get the "לקוח בחר" status from CandidateStatus
        const targetStatusArr = await base44.asServiceRole.entities.CandidateStatus.filter({ status_name: "לקוח בחר" });
        if (!targetStatusArr || targetStatusArr.length === 0) {
            throw new Error("Could not find the status 'לקוח בחר' in CandidateStatus entity.");
        }
        const targetStatus = targetStatusArr[0];

        // Get all matches
        const allMatches = await base44.asServiceRole.entities.Match.list();
        console.log(`Found ${allMatches.length} matches to clean`);

        let cleanedCount = 0;
        let errorCount = 0;

        for (const match of allMatches) {
            try {
                // Create a clean match object with only the necessary fields
                const cleanMatchData = {
                    job_id: match.job_id,
                    job_title: match.job_title,
                    free_text_query: match.free_text_query,
                    candidate_id: match.candidate_id,
                    candidate_name: match.candidate_name,
                    user_id: match.user_id,
                    user_name: match.user_name,
                    user_app_role: match.user_app_role,
                    status: targetStatus.status_name,
                    status_number: targetStatus.status_number,
                    is_read: match.is_read || false
                };

                await base44.asServiceRole.entities.Match.update(match.id, cleanMatchData);
                cleanedCount++;
            } catch (error) {
                console.error(`Failed to clean match ${match.id}:`, error);
                errorCount++;
            }
        }

        console.log(`Cleanup complete. Cleaned: ${cleanedCount}, Errors: ${errorCount}`);

        return new Response(JSON.stringify({
            success: true,
            message: `Successfully cleaned ${cleanedCount} matches. All matches now have single status: '${targetStatus.status_name}'`,
            totalMatches: allMatches.length,
            cleanedCount,
            errorCount
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("Error cleaning duplicate statuses:", error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});