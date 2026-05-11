import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        // Get all conversations and find the highest number
        const allConversations = await base44.asServiceRole.entities.WhatsappConversationNoam.list();
        
        let maxNumber = 0;
        for (const conv of allConversations) {
            if (conv.conversation_number) {
                const match = conv.conversation_number.match(/NC-(\d+)/);
                if (match) {
                    const num = parseInt(match[1], 10);
                    if (num > maxNumber) maxNumber = num;
                }
            }
        }

        const nextNumber = maxNumber + 1;
        const conversationNumber = `NC-${String(nextNumber).padStart(5, '0')}`;

        return Response.json({ conversation_number: conversationNumber });

    } catch (error) {
        console.error('Error generating conversation number:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});