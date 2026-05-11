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
        // Get all jobs without job_code
        const allJobs = await base44.entities.Job.list();
        const jobsWithoutCode = allJobs.filter(job => !job.job_code);
        
        if (jobsWithoutCode.length === 0) {
            return Response.json({
                success: true,
                message: 'All jobs already have codes',
                updated: 0
            });
        }

        // Find the highest existing code number
        const existingCodes = allJobs
            .map(job => job.job_code)
            .filter(code => code && code.startsWith('pan-'))
            .map(code => parseInt(code.replace('pan-', '')))
            .filter(num => !isNaN(num));
        
        let nextNumber = existingCodes.length > 0 ? Math.max(...existingCodes) + 1 : 1;
        
        // Update jobs without codes
        let updatedCount = 0;
        for (const job of jobsWithoutCode) {
            const jobCode = `pan-${nextNumber.toString().padStart(3, '0')}`;
            await base44.entities.Job.update(job.id, {
                job_code: jobCode
            });
            nextNumber++;
            updatedCount++;
        }

        return Response.json({
            success: true,
            message: `Updated ${updatedCount} jobs with new codes`,
            updated: updatedCount
        });

    } catch (error) {
        console.error("Error updating job codes:", error);
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});