import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!RESEND_API_KEY) {
            return Response.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });
        }

        // Get Shiri schedule settings
        const schedules = await base44.asServiceRole.entities.ShiriSchedule.list('-updated_date', 1);
        if (!schedules || schedules.length === 0) {
            return Response.json({ error: 'לא נמצאו הגדרות לשירי' }, { status: 400 });
        }
        
        const settings = schedules[0];
        const recipientName = settings.missing_data_alert_name;
        const recipientEmail = settings.missing_data_alert_email;
        
        if (!recipientEmail) {
            return Response.json({ error: 'לא הוגדר מייל נמען להתראות' }, { status: 400 });
        }

        // Get all employees
        const employees = await base44.asServiceRole.entities.Employee.list();
        
        // Filter employees with missing data
        const missingData = employees.filter(emp => !emp.email || !emp.phone);
        
        if (missingData.length === 0) {
            return Response.json({ 
                success: true, 
                message: 'אין עובדים עם פרטים חסרים',
                employeesCount: 0 
            });
        }

        // Build detailed employee list - each employee on separate lines with better formatting
        const employeesList = missingData.map((emp, index) => {
            const missingFields = [];
            if (!emp.email) missingFields.push('❌ מייל');
            if (!emp.phone) missingFields.push('❌ טלפון');

            return `
        ${index + 1}. ${emp.full_name}
        חסר: ${missingFields.join(' | ')}
        ${emp.department ? `מחלקה: ${emp.department}` : ''}`;
        }).join('\n');

        const shiriWhatsappNumber = '972547774553'; // Shiri's WhatsApp number

        const emailBody = `שלום ${recipientName || ''},

        זוהי התראה אוטומטית ממערכת ניהול העובדים של פנדה-טק.

        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        ⚠️ נמצאו ${missingData.length} עובדים עם פרטים חסרים ב-Pipedrive

        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        📋 רשימת עובדים עם חוסרים:
        ${employeesList}

        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        📊 סיכום כללי:

        סה"כ עובדים במערכת:        ${employees.length}
        עובדים עם פרטים חסרים:     ${missingData.length}

        חסרי מייל:                  ${missingData.filter(e => !e.email).length}
        חסרי טלפון:                 ${missingData.filter(e => !e.phone).length}

        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        ✅ מה לעשות?

        1. היכנסו ל-Pipedrive
        2. עדכנו את הפרטים החסרים עבור העובדים ברשימה
        3. הריצו סנכרון מחדש במערכת PandaHRAI

        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        בברכה,
        שירי 💼
        קשרי עובדים | מחלקת משאבי אנוש
        📱 וואטסאפ: https://wa.me/${shiriWhatsappNumber}

        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

        // Send email via Resend
        const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'שירי - קשרי עובדים <shiri@pandatech.co.il>',
                to: recipientEmail,
                subject: `⚠️ התראה: ${missingData.length} עובדים עם פרטים חסרים במערכת`,
                text: emailBody
            })
        });

        if (!resendResponse.ok) {
            const errorData = await resendResponse.json();
            throw new Error(`Resend API error: ${JSON.stringify(errorData)}`);
        }

        const resendData = await resendResponse.json();

        // Update last alert sent time
        await base44.asServiceRole.entities.ShiriSchedule.update(settings[0].id, {
            last_alert_sent: new Date().toISOString()
        });

        // Log activity
        try {
            await base44.asServiceRole.entities.SystemActivityLog.create({
                actor_type: 'agent',
                actor_name: 'shiri',
                actor_image: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=40&h=40&fit=crop&crop=face',
                action_type: 'email_sent',
                action_description: `שירי שלחה התראה על ${missingData.length} עובדים עם פרטים חסרים ל-${recipientEmail}`,
                status: 'success'
            });
        } catch (logErr) {
            console.warn('Failed to log activity:', logErr.message);
        }

        return Response.json({ 
            success: true, 
            employeesCount: missingData.length,
            sentTo: recipientEmail,
            resendId: resendData.id
        });

    } catch (error) {
        console.error('Error sending missing data alert:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});