import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// TESTING MODE - All messages will be sent to admin instead of actual recipients
const TESTING_MODE = true;
const ADMIN_PHONE_NUMBER = '972544770741'; // Admin phone for testing
const ADMIN_EMAIL = 'admin@pandatech.co.il'; // Admin email for testing

async function sendWhatsAppViaGreenApi(phone, message, instanceId, apiToken, originalRecipientName, senderName) {
    let cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    if (cleanPhone.startsWith('+')) {
        cleanPhone = cleanPhone.substring(1);
    }
    if (cleanPhone.startsWith('0')) {
        cleanPhone = '972' + cleanPhone.substring(1);
    }

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
        headers: { 'Content-Type': 'application/json' },
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
        actualRecipient: actualPhone,
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
    const user = await base44.auth.me();

    // Helper function to get next message number
    const getNextMessageNumber = async () => {
        const counters = await base44.asServiceRole.entities.MessageCounter.filter({ counter_type: 'outgoing_message' });
        let nextNumber;
        
        if (counters.length === 0) {
            await base44.asServiceRole.entities.MessageCounter.create({
                counter_type: 'outgoing_message',
                last_number: 1
            });
            nextNumber = 1;
        } else {
            nextNumber = (counters[0].last_number || 0) + 1;
            await base44.asServiceRole.entities.MessageCounter.update(counters[0].id, {
                last_number: nextNumber
            });
        }
        
        return `MSG-${String(nextNumber).padStart(5, '0')}`;
    };

    try {
        const payload = await req.json();
        const { candidateId, clientId, contactId, messageTemplate, attachCv, deliveryMethod, ccEmail } = payload;
        
        // Also support alternative payload format from SendMatchMessageDialog
        const {
            candidate_id, client_id, job_id, match_id,
            communication_type, subject, message: directMessage,
            target_type, target_email, target_phone
        } = payload;

        const instanceId = Deno.env.get('GREEN_API_INSTANCE_ID');
        const apiToken = Deno.env.get('GREEN_API_TOKEN');

        // Handle SendCvToClientDialog format
        if (candidateId && clientId && contactId && deliveryMethod) {
            const [candidate, client, targetContact] = await Promise.all([
                base44.asServiceRole.entities.Candidate.get(candidateId),
                base44.asServiceRole.entities.Client.get(clientId),
                base44.asServiceRole.entities.ContactPerson.get(contactId)
            ]);

            if (!candidate || !client || !targetContact) {
                throw new Error('Could not find candidate, client, or contact person.');
            }
            
            let attachmentUrl = null;
            if (attachCv && candidate.resume_file_url) {
                attachmentUrl = candidate.resume_file_url;
            }

            if (deliveryMethod === 'email' && targetContact.email) {
                // Get unique message number
                const messageNumber = await getNextMessageNumber();
                
                const emailSubject = `קורות חיים עבורך: ${candidate.first_name} ${candidate.last_name}`;
                let emailBody = messageTemplate;
                if (attachmentUrl) {
                    emailBody += `<br><br><p>קורות חיים מצורפים בקישור הבא: <a href="${attachmentUrl}">לחץ כאן לצפייה</a></p>`;
                }

                // In testing mode, redirect email to admin
                const actualEmail = TESTING_MODE ? ADMIN_EMAIL : targetContact.email;
                let actualBody = emailBody;
                if (TESTING_MODE) {
                    actualBody = `🔔 הודעת בדיקה\n━━━━━━━━━━━━━━━━━━━━━\n📧 נמען מקורי: ${targetContact.name}\n📧 מייל מקורי: ${targetContact.email}\n👤 נשלח ע"י: ${user.full_name}\n━━━━━━━━━━━━━━━━━━━━━\n\n` + emailBody;
                }

                const emailResult = await base44.functions.invoke('sendEmailViaResend', {
                    to: actualEmail,
                    subject: TESTING_MODE ? `[בדיקה] ${emailSubject}` : emailSubject,
                    body: actualBody,
                    from_name: 'פנדה-טק',
                    cc: ccEmail || null
                });

                if (!emailResult.success) {
                    throw new Error(emailResult.error || 'Failed to send email via Outlook');
                }

                await base44.asServiceRole.entities.EmailOutbox.create({
                    message_number: messageNumber,
                    candidate_id: candidate.id,
                    candidate_name: `${candidate.first_name} ${candidate.last_name}`,
                    client_id: client.id,
                    client_name: client.name,
                    client_email: TESTING_MODE ? `${targetContact.email} (בדיקה -> ${ADMIN_EMAIL})` : targetContact.email,
                    subject: emailSubject,
                    message_content: emailBody,
                    attachment_filename: attachmentUrl ? candidate.original_filename || 'resume.pdf' : null,
                    sent_by_user_id: user.id,
                    sent_by_user_name: user.full_name,
                    status: 'sent',
                });

                return Response.json({ success: true, testMode: TESTING_MODE, messageNumber });
            }
            else if (deliveryMethod === 'whatsapp' && targetContact.phone) {
                if (!instanceId || !apiToken) {
                    throw new Error('Green API credentials not configured');
                }

                // Get unique message number
                const messageNumber = await getNextMessageNumber();

                let whatsappBody = messageTemplate;
                if (attachmentUrl) {
                    whatsappBody += `\n\nקורות חיים מצורפים בקישור: ${attachmentUrl}`;
                }

                const response = await sendWhatsAppViaGreenApi(
                    targetContact.phone,
                    whatsappBody,
                    instanceId,
                    apiToken,
                    targetContact.name,
                    user.full_name
                );

                await base44.asServiceRole.entities.WhatsappOutbox.create({
                    message_number: messageNumber,
                    candidate_id: candidate.id,
                    candidate_name: `${candidate.first_name} ${candidate.last_name}`,
                    client_id: client.id,
                    client_name: client.name,
                    client_phone: targetContact.phone,
                    recipient_phone: TESTING_MODE ? `${response.originalPhone} (בדיקה -> ${ADMIN_PHONE_NUMBER})` : response.originalPhone,
                    recipient_name: targetContact.name,
                    message_content: whatsappBody,
                    attachment_url: attachmentUrl,
                    sent_by_user_id: user.id,
                    sent_by_user_name: user.full_name,
                    status: 'sent',
                    is_test_mode: TESTING_MODE,
                    green_api_message_id: response.messageId
                });

                return Response.json({ success: true, testMode: TESTING_MODE, messageNumber });
            } else {
                throw new Error(`Invalid delivery method or missing contact info for ${deliveryMethod}.`);
            }
        }
        
        // Handle SendMatchMessageDialog format
        if (communication_type && directMessage) {
            const recipientName = target_type === 'candidate' ? 'מועמד' : 'לקוח';
            
            if (communication_type === 'email' && target_email) {
                // Get unique message number
                const messageNumber = await getNextMessageNumber();
                
                const actualEmail = TESTING_MODE ? ADMIN_EMAIL : target_email;
                let actualBody = directMessage;
                if (TESTING_MODE) {
                    actualBody = `🔔 הודעת בדיקה\n━━━━━━━━━━━━━━━━━━━━━\n📧 נמען מקורי: ${recipientName}\n📧 מייל מקורי: ${target_email}\n👤 נשלח ע"י: ${user.full_name}\n━━━━━━━━━━━━━━━━━━━━━\n\n` + directMessage;
                }

                const emailResult = await base44.functions.invoke('sendEmailViaResend', {
                    to: actualEmail,
                    subject: TESTING_MODE ? `[בדיקה] ${subject}` : subject,
                    body: actualBody,
                    from_name: 'פנדה-טק',
                    cc: ccEmail || null
                });

                if (!emailResult.success) {
                    throw new Error(emailResult.error || 'Failed to send email');
                }

                await base44.asServiceRole.entities.EmailOutbox.create({
                    message_number: messageNumber,
                    candidate_id: candidate_id || '',
                    candidate_name: recipientName,
                    client_id: client_id || '',
                    client_name: target_type === 'client' ? recipientName : '',
                    client_email: TESTING_MODE ? `${target_email} (בדיקה -> ${ADMIN_EMAIL})` : target_email,
                    subject: subject,
                    message_content: directMessage,
                    sent_by_user_id: user.id,
                    sent_by_user_name: user.full_name,
                    status: 'sent',
                });

                return Response.json({ success: true, testMode: TESTING_MODE, messageNumber });
            }
            else if (communication_type === 'whatsapp' && target_phone) {
                if (!instanceId || !apiToken) {
                    throw new Error('Green API credentials not configured');
                }

                // Get unique message number
                const messageNumber = await getNextMessageNumber();

                const response = await sendWhatsAppViaGreenApi(
                    target_phone,
                    directMessage,
                    instanceId,
                    apiToken,
                    recipientName,
                    user.full_name
                );

                await base44.asServiceRole.entities.WhatsappOutbox.create({
                    message_number: messageNumber,
                    candidate_id: candidate_id || '',
                    candidate_name: target_type === 'candidate' ? recipientName : '',
                    client_id: client_id || '',
                    client_name: target_type === 'client' ? recipientName : '',
                    client_phone: target_phone,
                    recipient_phone: TESTING_MODE ? `${response.originalPhone} (בדיקה -> ${ADMIN_PHONE_NUMBER})` : response.originalPhone,
                    recipient_name: recipientName,
                    message_content: directMessage,
                    sent_by_user_id: user.id,
                    sent_by_user_name: user.full_name,
                    status: 'sent',
                    is_test_mode: TESTING_MODE,
                    green_api_message_id: response.messageId
                });

                return Response.json({ success: true, testMode: TESTING_MODE, messageNumber });
            } else {
                throw new Error(`Invalid communication type or missing contact info.`);
            }
        }

        throw new Error('Invalid request format.');

    } catch (error) {
        console.error("Error in sendCandidateToSingleClient:", error);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
});