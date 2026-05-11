import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const PIPEDRIVE_API_KEY = Deno.env.get('PIPEDRIVE_API_KEY');

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!PIPEDRIVE_API_KEY) {
            return Response.json({ error: 'PIPEDRIVE_API_KEY not configured' }, { status: 500 });
        }

        console.log('Checking for expired jobs - v2.0...');

        // Get all active jobs with a deadline
        const activeJobs = await base44.asServiceRole.entities.Job.filter({ 
            status: 'פעילה'
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0); // Start of today

        let jobsClosed = 0;
        let dealsDeleted = 0;
        let matchesDeleted = 0;
        const errors = [];

        for (const job of activeJobs) {
            if (!job.deadline) continue;

            const deadline = new Date(job.deadline);
            deadline.setHours(0, 0, 0, 0);

            // Check if deadline has passed
            if (deadline < today) {
                console.log(`Closing expired job: "${job.title}" (deadline: ${job.deadline})`);

                try {
                    // Close the job in our system AND remove agent assignment
                    await base44.asServiceRole.entities.Job.update(job.id, {
                        status: 'סגורה',
                        assigned_agent: null,
                        assigned_agent_name: null,
                        do_not_publish: true // Stop publishing the job
                    });
                    jobsClosed++;
 
                    // Delete all matches for this job
                    try {
                        const jobMatches = await base44.asServiceRole.entities.Match.filter({ 
                            job_id: job.id 
                        });
                        for (const match of jobMatches) {
                            await base44.asServiceRole.entities.Match.delete(match.id);
                        }
                        matchesDeleted += jobMatches.length;
                        if (jobMatches.length > 0) {
                            console.log(`Deleted ${jobMatches.length} matches for expired job`);
                        }
                    } catch (matchErr) {
                        console.error(`Error deleting matches for job ${job.id}:`, matchErr);
                    }

                    // Delete the deal in Pipedrive if it exists
                    if (job.pipedrive_deal_id) {
                        try {
                            const deleteUrl = `https://api.pipedrive.com/v1/deals/${job.pipedrive_deal_id}?api_token=${PIPEDRIVE_API_KEY}`;
                            const deleteRes = await fetch(deleteUrl, {
                                method: 'DELETE'
                            });
                            const deleteResult = await deleteRes.json();

                            if (deleteResult.success) {
                                dealsDeleted++;
                                console.log(`Deleted Pipedrive deal ${job.pipedrive_deal_id} for expired job`);
                            } else {
                                console.error(`Failed to delete Pipedrive deal ${job.pipedrive_deal_id}:`, deleteResult);
                                errors.push(`Failed to delete deal for "${job.title}"`);
                            }
                        } catch (pipedriveErr) {
                            console.error(`Error deleting Pipedrive deal for job ${job.id}:`, pipedriveErr);
                            errors.push(`Pipedrive error for "${job.title}": ${pipedriveErr.message}`);
                        }
                    }

                    // Small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 200));

                } catch (jobErr) {
                    console.error(`Error closing job ${job.id}:`, jobErr);
                    errors.push(`Failed to close job "${job.title}": ${jobErr.message}`);
                }
            }
        }

        const summary = {
            success: true,
            jobsClosed,
            dealsDeleted,
            matchesDeleted,
            errors: errors.length > 0 ? errors : undefined
        };

        console.log('Expired jobs check completed:', summary);

        // Log to SystemActivityLog
        if (jobsClosed > 0) {
            try {
                await base44.asServiceRole.entities.SystemActivityLog.create({
                    actor_type: 'system',
                    actor_name: 'auto_close',
                    action_type: 'close_expired_jobs',
                    action_description: `סגירה אוטומטית של משרות: ${jobsClosed} משרות נסגרו (דד-ליין עבר), ${dealsDeleted} דילים נמחקו ב-Pipedrive, ${matchesDeleted} התאמות נמחקו`,
                    status: 'success',
                    details: JSON.stringify(summary)
                });
            } catch (logErr) {
                console.warn('Failed to log activity:', logErr.message);
            }
        }

        return Response.json(summary);

    } catch (error) {
        console.error('Error checking expired jobs:', error);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});