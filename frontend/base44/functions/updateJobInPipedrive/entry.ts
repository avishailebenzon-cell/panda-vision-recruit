import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const PIPEDRIVE_API_KEY = Deno.env.get('PIPEDRIVE_API_KEY');

async function fetchDealFields() {
    const url = `https://api.pipedrive.com/v1/dealFields?api_token=${PIPEDRIVE_API_KEY}`;
    const response = await fetch(url);
    
    if (!response.ok) {
        throw new Error(`Pipedrive API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.success ? data.data : [];
}

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

        const { jobId } = await req.json();
        
        if (!jobId) {
            return Response.json({ error: 'jobId is required' }, { status: 400 });
        }

        // Get job from database
        const job = await base44.asServiceRole.entities.Job.get(jobId);
        
        if (!job) {
            return Response.json({ error: 'Job not found' }, { status: 404 });
        }

        // Skip generic jobs - they are local only
        if (job.is_generic_job) {
            return Response.json({
                success: false,
                message: 'משרה גנרית - לא מסונכרנת עם Pipedrive'
            });
        }

        // If job doesn't have pipedrive_deal_id, we can't update it in Pipedrive
        if (!job.pipedrive_deal_id) {
            return Response.json({ 
                success: false, 
                message: 'המשרה לא מסונכרנת עם Pipedrive - אין מזהה דיל'
            });
        }

        console.log(`Updating job "${job.title}" in Pipedrive (Deal ID: ${job.pipedrive_deal_id})`);

        // Fetch deal fields to find custom field keys
        const dealFields = await fetchDealFields();
        
        // Find the custom field keys
        const fieldMapping = {};
        for (const field of dealFields) {
            const fieldNameLower = field.name?.toLowerCase().trim();
            
            if (fieldNameLower === 'job title') {
                fieldMapping.jobTitle = field.key;
            } else if (fieldNameLower === 'job description') {
                fieldMapping.jobDescription = field.key;
            } else if (fieldNameLower === 'job qualifications') {
                fieldMapping.jobQualifications = field.key;
            } else if (fieldNameLower === 'job location') {
                fieldMapping.jobLocation = field.key;
            } else if (fieldNameLower === 'jobs security clearance' || fieldNameLower === 'job security clearance') {
                fieldMapping.securityClearance = field.key;
            } else if (fieldNameLower === 'deadline' || fieldNameLower === 'dead line') {
                fieldMapping.deadline = field.key;
            } else if (fieldNameLower === 'label') {
                fieldMapping.label = field.key;
            }
        }

        // Build update data for Pipedrive
        const updateData = {};

        if (fieldMapping.jobTitle && job.title) {
            updateData[fieldMapping.jobTitle] = job.title;
        }
        if (fieldMapping.jobDescription && job.description) {
            updateData[fieldMapping.jobDescription] = job.description;
        }
        if (fieldMapping.jobQualifications && job.requirements) {
            updateData[fieldMapping.jobQualifications] = job.requirements;
        }
        if (fieldMapping.jobLocation && job.location) {
            updateData[fieldMapping.jobLocation] = job.location;
        }
        if (fieldMapping.securityClearance && job.security_clearance) {
            updateData[fieldMapping.securityClearance] = job.security_clearance;
        }
        if (fieldMapping.deadline && job.deadline) {
            updateData[fieldMapping.deadline] = job.deadline;
        }
        if (fieldMapping.label && job.recruitment_priority) {
            updateData[fieldMapping.label] = job.recruitment_priority;
        }

        // Update deal in Pipedrive
        const pipedriveUrl = `https://api.pipedrive.com/v1/deals/${job.pipedrive_deal_id}?api_token=${PIPEDRIVE_API_KEY}`;
        const response = await fetch(pipedriveUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });

        const result = await response.json();

        if (result.success) {
            console.log(`Successfully updated job in Pipedrive: ${job.title}`);
            return Response.json({
                success: true,
                message: 'המשרה עודכנה בהצלחה ב-Pipedrive',
                dealId: job.pipedrive_deal_id
            });
        } else {
            console.error('Pipedrive update failed:', result);
            return Response.json({
                success: false,
                error: result.error || 'שגיאה בעדכון ב-Pipedrive'
            }, { status: 500 });
        }

    } catch (error) {
        console.error('Error updating job in Pipedrive:', error);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});