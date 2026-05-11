import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Authenticate user
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get all jobs
        const allJobs = await base44.asServiceRole.entities.Job.list();
        
        console.log(`Found ${allJobs.length} jobs to reset`);

        // Reset processed dates for all agents
        let updatedCount = 0;
        for (const job of allJobs) {
            try {
                await base44.asServiceRole.entities.Job.update(job.id, {
                    naama_processed_date: null,
                    alik_processed_date: null,
                    itay_processed_date: null,
                    lior_processed_date: null,
                    ofir_processed_date: null
                });
                updatedCount++;
                console.log(`Reset processed dates for job ${job.id} - ${job.title}`);
            } catch (error) {
                console.error(`Failed to reset job ${job.id}:`, error);
            }
        }

        // Log the action
        await base44.asServiceRole.entities.SystemActivityLog.create({
            actor_type: 'user',
            actor_name: user.full_name,
            actor_image: null,
            action_type: 'data_cleanup',
            action_description: `איפס תאריכי טיפול של כל הסוכנים (${updatedCount} משרות עודכנו)`,
            status: 'success'
        });

        return Response.json({
            success: true,
            message: `Successfully reset agent processed dates for ${updatedCount} jobs`,
            updatedCount: updatedCount,
            totalJobs: allJobs.length
        });

    } catch (error) {
        console.error('Error in resetAgentProcessedDates:', error);
        return Response.json({ 
            error: error.message,
            success: false 
        }, { status: 500 });
    }
});