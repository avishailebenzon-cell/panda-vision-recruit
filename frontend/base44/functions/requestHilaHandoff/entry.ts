import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { conversationId, reason } = await req.json();
        
        if (!conversationId) {
            return Response.json({ error: 'conversationId is required' }, { status: 400 });
        }

        // Get the WhatsApp conversation
        const conversations = await base44.asServiceRole.entities.WhatsappConversation.filter({ 
            agent_conversation_id: conversationId 
        });

        if (!conversations || conversations.length === 0) {
            return Response.json({ error: 'Conversation not found' }, { status: 404 });
        }

        const conversation = conversations[0];

        // Update the conversation status
        await base44.asServiceRole.entities.WhatsappConversation.update(conversation.id, {
            handoff_requested: true,
            handoff_date: new Date().toISOString(),
            handoff_reason: reason || 'העברה לסוכן אנושי',
            status: 'forwarded_to_human'
        });

        // Send a message in the conversation to inform Hila to stop
        const baseConversation = await base44.agents.getConversation(conversationId);
        
        await base44.agents.addMessage(baseConversation, {
            role: 'user',
            content: `[HANDOFF_REQUESTED] המשתמש ביקש להעביר את השיחה לסוכן אנושי. סיבה: ${reason || 'לא צוין'}. הילה, אנא הפסיקי לענות ולהגיב להודעות הבאות. סוכן אנושי ימשיך מכאן.`
        });

        // Log the handoff
        try {
            await base44.asServiceRole.entities.SystemActivityLog.create({
                actor_type: 'user',
                actor_name: conversation.candidate_name,
                action_type: 'other',
                action_description: `העברת שיחה לסוכן אנושי - ${conversation.candidate_name} ביקש/ה העברה לאדם`,
                entity_type: 'WhatsappConversation',
                entity_id: conversation.id,
                status: 'success',
                details: JSON.stringify({ reason: reason || 'לא צוין' })
            });
        } catch (logErr) {
            console.warn('Failed to log handoff:', logErr.message);
        }

        return Response.json({ 
            success: true,
            message: 'השיחה הועברה לסוכן אנושי בהצלחה'
        });

    } catch (error) {
        console.error('Error requesting handoff:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});