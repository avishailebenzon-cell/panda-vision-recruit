import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Authenticate user
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { job_id, deal_id, supplement_text } = await req.json();

        if (!deal_id || !supplement_text) {
            return Response.json({ 
                error: 'Missing required parameters: deal_id and supplement_text' 
            }, { status: 400 });
        }

        const pipedriveApiKey = Deno.env.get('PIPEDRIVE_API_KEY');
        if (!pipedriveApiKey) {
            return Response.json({ 
                error: 'Pipedrive API key not configured' 
            }, { status: 500 });
        }

        // Add note to Pipedrive deal
        const noteContent = `תוספת הגדרות למשרה (נוספה על ידי דנה):

${supplement_text}

---
נוסף על ידי: ${user.full_name}
תאריך: ${new Date().toLocaleString('he-IL')}`;

        const noteResponse = await fetch(
            `https://api.pipedrive.com/v1/notes?api_token=${pipedriveApiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content: noteContent,
                    deal_id: parseInt(deal_id),
                    pinned_to_deal_flag: 1
                })
            }
        );

        if (!noteResponse.ok) {
            const errorData = await noteResponse.json();
            throw new Error(`Pipedrive API error: ${errorData.error || 'Unknown error'}`);
        }

        const result = await noteResponse.json();

        return Response.json({
            success: true,
            note_id: result.data?.id,
            message: 'Supplement synced to Pipedrive successfully'
        });

    } catch (error) {
        console.error('Error syncing supplement to Pipedrive:', error);
        return Response.json({ 
            error: error.message || 'Failed to sync supplement to Pipedrive' 
        }, { status: 500 });
    }
});