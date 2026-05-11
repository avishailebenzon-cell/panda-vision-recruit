import { createClientFromRequest } from 'npm:@base44/sdk@0.7.0';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { fromStatusNumber, toStatusNumber } = await req.json();

        // Get all statuses
        const statuses = await base44.entities.CandidateStatus.list();
        
        // Find the current status
        const currentStatus = statuses.find(s => s.status_number === fromStatusNumber && s.is_active);
        
        if (!currentStatus) {
            return Response.json({ 
                valid: false, 
                error: 'מצב נוכחי לא נמצא או לא פעיל' 
            });
        }

        // Find the target status
        const targetStatus = statuses.find(s => s.status_number === toStatusNumber && s.is_active);
        
        if (!targetStatus) {
            return Response.json({ 
                valid: false, 
                error: 'מצב היעד לא נמצא או לא פעיל' 
            });
        }

        // Check if transition is allowed
        const allowedTransitions = currentStatus.next_possible_statuses || [];
        const isTransitionAllowed = allowedTransitions.includes(toStatusNumber);

        if (!isTransitionAllowed) {
            return Response.json({ 
                valid: false, 
                error: `מעבר ממצב "${currentStatus.status_name}" למצב "${targetStatus.status_name}" אינו מותר` 
            });
        }

        // Check user permissions
        const canUpdate = targetStatus.who_can_update?.includes('פנדה-טק') || 
                          (user.app_role === 'admin') || 
                          targetStatus.who_can_update?.includes('מערכת');

        if (!canUpdate) {
            return Response.json({ 
                valid: false, 
                error: 'אין לך הרשאה לעדכן למצב זה' 
            });
        }

        return Response.json({ 
            valid: true, 
            message: `מעבר ממצב "${currentStatus.status_name}" למצב "${targetStatus.status_name}" מותר`,
            fromStatus: currentStatus.status_name,
            toStatus: targetStatus.status_name
        });

    } catch (error) {
        console.error('Error validating status transition:', error);
        return Response.json({ 
            valid: false, 
            error: error.message 
        }, { status: 500 });
    }
});