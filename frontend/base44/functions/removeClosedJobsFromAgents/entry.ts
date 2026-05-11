import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        console.log('Checking for closed jobs assigned to agents...');

        // Get all closed jobs that are still assigned to agents
        const closedJobsWithAssignments = await base44.asServiceRole.entities.Job.filter({ 
            status: 'סגורה',
            assigned_agent: { $ne: null }
        });

        let jobsUpdated = 0;
        let matchesDeleted = 0;

        for (const job of closedJobsWithAssignments) {
            console.log(`Removing assignment from closed job: "${job.title}" (was: ${job.assigned_agent})`);

            try {
                // Remove agent assignment
                await base44.asServiceRole.entities.Job.update(job.id, {
                    assigned_agent: null,
                    assigned_agent_name: null,
                    do_not_publish: true
                });
                jobsUpdated++;

                // Delete all matches for this closed job
                const jobMatches = await base44.asServiceRole.entities.Match.filter({ 
                    job_id: job.id 
                });
                
                for (const match of jobMatches) {
                    await base44.asServiceRole.entities.Match.delete(match.id);
                }
                
                matchesDeleted += jobMatches.length;
                if (jobMatches.length > 0) {
                    console.log(`Deleted ${jobMatches.length} matches for closed job`);
                }

                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 200));

            } catch (jobErr) {
                console.error(`Error updating job ${job.id}:`, jobErr);
            }
        }

        const summary = {
            success: true,
            jobsUpdated,
            matchesDeleted
        };

        console.log('Cleanup completed:', summary);

        // Log to SystemActivityLog
        if (jobsUpdated > 0) {
            try {
                await base44.asServiceRole.entities.SystemActivityLog.create({
                    actor_type: 'system',
                    actor_name: 'cleanup',
                    action_type: 'remove_closed_jobs_from_agents',
                    action_description: `ניקוי משרות סגורות: ${jobsUpdated} משרות הוסרו מהסוכנים, ${matchesDeleted} התאמות נמחקו`,
                    status: 'success',
                    details: JSON.stringify(summary)
                });
            } catch (logErr) {
                console.warn('Failed to log activity:', logErr.message);
            }
        }

        return Response.json(summary);

    } catch (error) {
        console.error('Error removing closed jobs from agents:', error);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});