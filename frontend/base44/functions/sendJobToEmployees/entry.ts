import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// TESTING MODE - All messages will be sent to admin instead of actual recipients
const TESTING_MODE = true;
const ADMIN_PHONE_NUMBER = '972544770741';
const ADMIN_EMAIL = 'admin@pandatech.co.il';

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
        actualMessage = `🔔 *הודעת בדיקה - עובד פנימי*\n` +
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

    try {
        const { 
            jobId, 
            employeeIds, 
            deliveryMethod, 
            messageTemplate, 
            templateType 
        } = await req.json();
        
        if (!jobId || !employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
            throw new Error('Missing required parameters: jobId, employeeIds');
        }

        if (!deliveryMethod || !['email', 'whatsapp'].includes(deliveryMethod)) {
            throw new Error('Invalid delivery method. Must be email or whatsapp');
        }

        if (!templateType || ![1, 2, 3].includes(templateType)) {
            throw new Error('Invalid template type. Must be 1, 2, or 3');
        }

        const instanceId = Deno.env.get('GREEN_API_INSTANCE_ID');
        const apiToken = Deno.env.get('GREEN_API_TOKEN');

        const currentUser = await base44.auth.me();
        
        if (!currentUser.can_send_messages_to_employees) {
            throw new Error('אין הרשאה לשליחת משרות לעובדים');
        }

        const job = await base44.entities.Job.get(jobId);
        if (!job) throw new Error('Job not found');

        let employeesToContact;
        if (employeeIds.includes('all')) {
            employeesToContact = await base44.entities.Candidate.filter({ status: 'עובד חברה' });
        } else {
            employeesToContact = await base44.entities.Candidate.filter({ id: { '$in': employeeIds }});
        }
        
        const selectedEmployees = employeesToContact.filter(e => e.can_receive_job_notifications !== false);

        if (selectedEmployees.length === 0) {
            throw new Error('No valid employees found for notification');
        }

        const results = [];
        
        for (const employee of selectedEmployees) {
            const employeeFullName = `${employee.first_name} ${employee.last_name}`;

            const templateKey = deliveryMethod === 'whatsapp' 
                ? `employee_job_whatsapp_template_${templateType}`
                : `employee_job_email_template_${templateType}`;
            
            const template = messageTemplate || currentUser[templateKey] || '';
            
            if (!template) {
                results.push({ 
                    employee: employeeFullName, 
                    status: 'error', 
                    message: 'תבנית הודעה לא נמצאה' 
                });
                continue;
            }

            const personalizedMessage = template
                .replace(/{employee_name}/g, employeeFullName)
                .replace(/{job_title}/g, job.title)
                .replace(/{client_name}/g, job.client_name || 'לא צוין')
                .replace(/{job_location}/g, job.location || 'לא צוין')
                .replace(/{security_clearance}/g, job.security_clearance || 'לא צוין')
                .replace(/{job_description}/g, job.description || 'אין תיאור זמין')
                .replace(/{job_requirements}/g, job.requirements || 'אין דרישות זמינות');

            try {
                if (deliveryMethod === 'whatsapp') {
                    if (!employee.phone_primary) {
                        results.push({ employee: employeeFullName, status: 'error', message: 'לא קיים מספר טלפון' });
                        continue;
                    }

                    if (!instanceId || !apiToken) {
                        throw new Error('Green API credentials not configured');
                    }

                    const response = await sendWhatsAppViaGreenApi(
                        employee.phone_primary,
                        personalizedMessage,
                        instanceId,
                        apiToken,
                        employeeFullName,
                        currentUser.full_name
                    );

                    await base44.asServiceRole.entities.WhatsappOutbox.create({
                        candidate_id: employee.id,
                        candidate_name: employeeFullName,
                        client_id: 'internal_employee',
                        client_name: 'עובד פנימי',
                        client_phone: employee.phone_primary,
                        recipient_phone: TESTING_MODE ? `${response.originalPhone} (בדיקה -> ${ADMIN_PHONE_NUMBER})` : response.originalPhone,
                        recipient_name: employeeFullName,
                        message_content: personalizedMessage,
                        sent_by_user_id: currentUser.id,
                        sent_by_user_name: currentUser.full_name,
                        status: 'sent',
                        is_test_mode: TESTING_MODE,
                        green_api_message_id: response.messageId
                    });

                    results.push({ employee: employeeFullName, status: 'success', message: 'הודעת WhatsApp נשלחה בהצלחה' });
                    
                } else { // email
                    if (!employee.email) {
                        results.push({ employee: employeeFullName, status: 'error', message: 'לא קיימת כתובת מייל' });
                        continue;
                    }

                    const actualEmail = TESTING_MODE ? ADMIN_EMAIL : employee.email;
                    
                    // Build professional HTML email body with same format as Hila's regular emails
                    const getGeneralRegion = (location) => {
                      if (!location) return 'לא צוין';
                      const loc = location.toLowerCase();
                      
                      const northCities = ['חיפה', 'עכו', 'כרמיאל', 'נהריה', 'עפולה', 'טבריה', 'צפת', 'קריות', 'קרית', 'נצרת', 'מגדל העמק', 'יקנעם', 'עתלית', 'טירת כרמל', 'נשר', 'זכרון', 'פרדס חנה', 'חדרה', 'קיסריה'];
                      if (northCities.some(city => loc.includes(city)) || loc.includes('צפון')) {
                        return 'צפון';
                      }
                      
                      const southCities = ['באר שבע', 'אשדוד', 'אשקלון', 'דימונה', 'אילת', 'קרית גת', 'נתיבות', 'אופקים', 'שדרות'];
                      if (southCities.some(city => loc.includes(city)) || loc.includes('דרום') || loc.includes('נגב')) {
                        return 'דרום';
                      }
                      
                      return 'מרכז';
                    };

                    const htmlBody = `<div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.8;">
<p>שלום!</p>
<p>רציתי לעדכן על הזדמנות קריירה מעולה שנפתחה:</p>

<p style="margin-bottom: 20px; background-color: #f3f4f6; padding: 15px; border-right: 4px solid #3b82f6; border-radius: 4px;">
<b style="font-size: 18px; color: #1f2937;">${job.title}</b><br/>
🔢 קוד משרה: ${job.job_code || 'ללא קוד'}<br/>
📍 מיקום: ${getGeneralRegion(job.location)}<br/>
🔐 סיווג ביטחוני: ${job.security_clearance || 'לא נדרש'}<br/><br/>
📝 <b>תיאור:</b><br/>
${job.description}<br/><br/>
✅ <b>דרישות:</b><br/>
${job.requirements}
</p>

<p>אם אתם מכירים מישהו מתאים, נשמח לקבל המלצה!</p>

<p style="margin-top: 30px;">
נודה מאוד על העברת קורות חיים למייל: <b>jobs@pandatech.co.il</b> וציינו את קוד המשרה.
</p>

<p style="margin-top: 20px; border-top: 2px solid #333; padding-top: 15px;">
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━<br/>
<b>הילה</b><br/>
רכזת גיוס ומשאבי אנוש, PandaTech<br/>
<a href="https://www.pandatech.co.il">www.pandatech.co.il</a><br/>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
</p>
</div>`;
                    
                    let actualSubject = `🎯 הזדמנות קריירה - ${job.title}`;
                    
                    if (TESTING_MODE) {
                        actualSubject = `[בדיקה - ${employeeFullName}] ${actualSubject}`;
                    }

                    const emailResult = await base44.functions.invoke('sendEmailViaResend', {
                        to: actualEmail,
                        subject: actualSubject,
                        body: htmlBody,
                        from_name: 'הילה - צוות גיוס PandaTech'
                    });

                    await base44.asServiceRole.entities.EmailOutbox.create({
                        candidate_id: employee.id,
                        candidate_name: employeeFullName,
                        client_id: 'internal_employee',
                        client_name: 'עובד פנימי',
                        client_email: TESTING_MODE ? `${employee.email} (בדיקה -> ${ADMIN_EMAIL})` : employee.email,
                        subject: `🎯 הזדמנות קריירה חדשה - ${job.title}`,
                        message_content: personalizedMessage,
                        sent_by_user_id: currentUser.id,
                        sent_by_user_name: currentUser.full_name,
                        status: emailResult.success ? 'sent' : 'failed',
                        error_message: emailResult.error || null
                    });

                    if (emailResult.success) {
                        results.push({ employee: employeeFullName, status: 'success', message: 'מייל נשלח בהצלחה' });
                    } else {
                        throw new Error(emailResult.error || 'Email sending failed');
                    }
                }
            } catch (employeeError) {
                console.error(`Error sending to employee ${employeeFullName}:`, employeeError);
                results.push({ employee: employeeFullName, status: 'error', message: employeeError.message });
            }
        }

        return Response.json({
            success: true,
            results: results,
            totalEmployees: selectedEmployees.length,
            successCount: results.filter(r => r.status === 'success').length,
            testMode: TESTING_MODE
        });

    } catch (error) {
        console.error("Error sending job to employees:", error);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
});