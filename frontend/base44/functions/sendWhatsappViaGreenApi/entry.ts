import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// TESTING MODE - All messages will be sent to admin instead of actual recipients
const TESTING_MODE = false;
const ADMIN_PHONE_NUMBER = '972544770741'; // Admin phone for testing

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { phone, message, originalRecipientName, originalRecipientPhone } = await req.json();

        if (!phone || !message) {
            return Response.json({ error: 'Missing required fields: phone, message' }, { status: 400 });
        }

        const instanceId = Deno.env.get('GREEN_API_INSTANCE_ID');
        const apiToken = Deno.env.get('GREEN_API_TOKEN');

        if (!instanceId || !apiToken) {
            return Response.json({ error: 'Green API credentials not configured' }, { status: 500 });
        }

        // Clean phone number - remove spaces, dashes, and leading zeros/plus
        let cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
        if (cleanPhone.startsWith('+')) {
            cleanPhone = cleanPhone.substring(1);
        }
        if (cleanPhone.startsWith('0')) {
            cleanPhone = '972' + cleanPhone.substring(1);
        }

        // In TESTING MODE, redirect all messages to admin
        let actualPhone = cleanPhone;
        let actualMessage = message;
        
        if (TESTING_MODE) {
            actualPhone = ADMIN_PHONE_NUMBER;
            actualMessage = `🔔 *הודעת בדיקה*\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n` +
                `📱 נמען מקורי: ${originalRecipientName || 'לא צוין'}\n` +
                `📞 טלפון מקורי: ${originalRecipientPhone || cleanPhone}\n` +
                `👤 נשלח ע"י: ${user.full_name || user.email}\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `*תוכן ההודעה:*\n${message}`;
        }

        // Send via Green API
        const chatId = `${actualPhone}@c.us`;
        const apiUrl = `https://api.green-api.com/waInstance${instanceId}/sendMessage/${apiToken}`;

        console.log(`Sending WhatsApp to ${chatId} via Green API`);

        const greenApiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chatId: chatId,
                message: actualMessage
            })
        });

        const greenApiResult = await greenApiResponse.json();
        console.log('Green API response:', greenApiResult);

        if (!greenApiResponse.ok || !greenApiResult.idMessage) {
            // Log failed attempt
            try {
                await base44.asServiceRole.entities.WhatsappOutbox.create({
                    recipient_phone: cleanPhone,
                    recipient_name: originalRecipientName || 'לא צוין',
                    message_content: message,
                    sent_by_user_id: user.id,
                    sent_by_user_name: user.full_name || user.email,
                    status: 'failed',
                    is_test_mode: TESTING_MODE,
                    error_message: greenApiResult.message || 'Unknown error'
                });
            } catch (logError) {
                console.error('Failed to log WhatsApp error:', logError);
            }
            return Response.json({ 
                success: false, 
                error: greenApiResult.message || 'Failed to send via Green API' 
            }, { status: 500 });
        }

        const messageId = greenApiResult.idMessage;

        // Save to WhatsappMessage entity for conversation tracking
        try {
            await base44.asServiceRole.entities.WhatsappMessage.create({
                candidate_phone: cleanPhone,
                direction: 'outgoing',
                content: message,
                message_id: messageId,
                sender_name: 'רותם',
                status: 'sent'
            });
        } catch (msgErr) {
            console.log('Could not save to WhatsappMessage:', msgErr.message);
        }

        // Log the message to WhatsappOutbox
        try {
            await base44.asServiceRole.entities.WhatsappOutbox.create({
                recipient_phone: cleanPhone,
                recipient_name: originalRecipientName || 'לא צוין',
                message_content: message,
                sent_by_user_id: user.id,
                sent_by_user_name: user.full_name || user.email,
                status: 'sent',
                is_test_mode: TESTING_MODE,
                green_api_message_id: messageId
            });
        } catch (logError) {
            console.error('Failed to log WhatsApp message:', logError);
        }

        return Response.json({
            success: true,
            messageId: messageId,
            testMode: TESTING_MODE
        });

    } catch (error) {
        console.error('Error sending WhatsApp:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});