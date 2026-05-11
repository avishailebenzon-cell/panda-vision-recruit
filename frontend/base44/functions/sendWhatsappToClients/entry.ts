import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// TESTING MODE - All messages will be sent to admin instead of actual recipients
const TESTING_MODE = true;
const ADMIN_PHONE_NUMBER = '972544770741'; // Admin phone for testing

async function sendWhatsAppViaGreenApi(phone, message, instanceId, apiToken, originalRecipientName, senderName) {
    // Clean phone number
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
            `📞 טלפון מקורי: ${cleanPhone}\n` +
            `👤 נשלח ע"י: ${senderName || 'מערכת'}\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `*תוכן ההודעה:*\n${message}`;
    }

    const url = `https://api.green-api.com/waInstance${instanceId}/sendMessage/${apiToken}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            chatId: `${actualPhone}@c.us`,
            message: actualMessage
        })
    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || 'Failed to send WhatsApp message via Green API');
    }

    return { 
        success: true, 
        messageId: result.idMessage,
        testMode: TESTING_MODE,
        actualRecipient: TESTING_MODE ? ADMIN_PHONE_NUMBER : cleanPhone,
        originalPhone: cleanPhone
    };
}

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);

    if (!(await base44.auth.isAuthenticated())) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401, headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const { candidateId, clientIds, messageTemplate } = await req.json();
        
        if (!candidateId || !clientIds || !Array.isArray(clientIds) || clientIds.length === 0) {
            throw new Error('Missing required parameters: candidateId, clientIds');
        }

        const instanceId = Deno.env.get('GREEN_API_INSTANCE_ID');
        const apiToken = Deno.env.get('GREEN_API_TOKEN');

        if (!instanceId || !apiToken) {
            throw new Error('Green API credentials not configured');
        }

        const currentUser = await base44.auth.me();
        const candidate = await base44.entities.Candidate.get(candidateId);
        if (!candidate) throw new Error('Candidate not found');

        const allClients = await base44.entities.Client.list();
        const selectedClients = allClients.filter(c => clientIds.includes(c.id));
        if (selectedClients.length === 0) throw new Error('No valid clients found');

        const results = [];
        
        for (const client of selectedClients) {
            if (!client.phone) {
                results.push({ client: client.name, status: 'error', message: 'לא קיים מספר טלפון' });
                continue;
            }

            const personalizedMessage = messageTemplate
                .replace(/{client_name}/g, client.name)
                .replace(/{candidate_name}/g, `${candidate.first_name} ${candidate.last_name}`)
                .replace(/{candidate_email}/g, candidate.email || 'לא צוין')
                .replace(/{candidate_phone}/g, candidate.phone_primary || 'לא צוין')
                .replace(/{security_clearance}/g, candidate.security_clearance || 'לא צוין')
                .replace(/{skills_summary}/g, candidate.skills_summary || 'ראה קורות החיים המצורפים');
            
            const fullMessage = `${personalizedMessage}\n\nקישור לקורות חיים: ${candidate.resume_file_url}`;

            try {
                const response = await sendWhatsAppViaGreenApi(
                    client.phone, 
                    fullMessage, 
                    instanceId, 
                    apiToken, 
                    client.name,
                    currentUser.full_name
                );

                // Log to WhatsappOutbox
                await base44.asServiceRole.entities.WhatsappOutbox.create({
                    candidate_id: candidate.id,
                    candidate_name: `${candidate.first_name} ${candidate.last_name}`,
                    client_id: client.id,
                    client_name: client.name,
                    client_phone: client.phone,
                    recipient_phone: TESTING_MODE ? `${response.originalPhone} (בדיקה -> ${ADMIN_PHONE_NUMBER})` : response.originalPhone,
                    recipient_name: client.name,
                    message_content: fullMessage,
                    attachment_url: candidate.resume_file_url,
                    sent_by_user_id: currentUser.id,
                    sent_by_user_name: currentUser.full_name,
                    status: 'sent',
                    is_test_mode: TESTING_MODE,
                    green_api_message_id: response.messageId
                });

                results.push({ client: client.name, status: 'success', message: 'הודעה נשלחה בהצלחה' });

            } catch (clientError) {
                // Log failed attempt
                await base44.asServiceRole.entities.WhatsappOutbox.create({
                    candidate_id: candidate.id,
                    candidate_name: `${candidate.first_name} ${candidate.last_name}`,
                    client_id: client.id,
                    client_name: client.name,
                    client_phone: client.phone,
                    recipient_phone: client.phone,
                    recipient_name: client.name,
                    message_content: fullMessage,
                    attachment_url: candidate.resume_file_url,
                    sent_by_user_id: currentUser.id,
                    sent_by_user_name: currentUser.full_name,
                    status: 'failed',
                    is_test_mode: TESTING_MODE,
                    error_message: clientError.message
                });

                results.push({ client: client.name, status: 'error', message: clientError.message });
            }
        }

        return Response.json({
            success: true,
            results: results,
            totalClients: selectedClients.length,
            successCount: results.filter(r => r.status === 'success').length,
            testMode: TESTING_MODE
        });

    } catch (error) {
        console.error("Error sending candidate to clients via WhatsApp:", error);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
});