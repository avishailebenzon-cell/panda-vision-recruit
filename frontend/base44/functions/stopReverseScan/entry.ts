import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204 });
    }

    try {
        const base44 = createClientFromRequest(req);
        
        const scanStatuses = await base44.asServiceRole.entities.MailScanStatus.list();
        if (scanStatuses.length > 0) {
            await base44.asServiceRole.entities.MailScanStatus.update(scanStatuses[0].id, {
                is_reverse_running: false
            });
        }
        
        return Response.json({ success: true, message: 'סריקה הפוכה נעצרה' });
        
    } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});