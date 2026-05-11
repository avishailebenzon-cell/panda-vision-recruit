import { createClientFromRequest } from 'npm:@base44/sdk@0.5.0';

// Function to send admin notifications manually (can be called from other functions)
Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);

    try {
        const { newUser, notificationType = 'new_user_registration' } = await req.json();

        if (!newUser || !newUser.full_name || !newUser.email) {
            throw new Error('Missing required user information');
        }

        // Get all admin users
        const adminUsers = await base44.asServiceRole.entities.User.filter({ role: 'admin' });

        if (adminUsers.length === 0) {
            throw new Error('No admin users found in the system');
        }

        // Get the app URL (assuming it's provided in the request or use a default)
        const appUrl = req.headers.get('origin') || 'https://your-app-domain.com';
        const managementUrl = `${appUrl}/Management`;

        let subject, body;

        switch (notificationType) {
            case 'new_user_registration':
                subject = '[PandaRecruitAI] משתמש חדש ממתין לאישור - דרוש אישור מיידי';
                body = `
שלום,

משתמש חדש נרשם למערכת PandaRecruitAI וממתין לאישור:

📋 פרטי המשתמש:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• שם: ${newUser.full_name}
• אימייל: ${newUser.email}
• תאריך הרשמה: ${new Date().toLocaleDateString('he-IL')} בשעה ${new Date().toLocaleTimeString('he-IL')}
• סטטוס נוכחי: ממתין לאישור

🔗 אישור המשתמש:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
כדי לאשר את המשתמש ולהגדיר את ההרשאות שלו, לחץ על הקישור הבא:

👉 ${managementUrl}

לחלופין, תוכל להיכנס למערכת PandaRecruitAI ולעבור למסך "ניהול" → "ניהול משתמשים".

⚠️ חשוב: המשתמש לא יוכל להיכנס למערכת עד לאישור שלך.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
בברכה,
מערכת PandaRecruitAI (התרעה אוטומטית)
                `;
                break;

            case 'user_awaiting_approval':
                subject = '[PandaRecruitAI] תזכורת - משתמש ממתין לאישור';
                body = `
שלום,

תזכורת: המשתמש הבא עדיין ממתין לאישור במערכת:

• שם: ${newUser.full_name}
• אימייל: ${newUser.email}
• זמן המתנה: ${Math.floor((Date.now() - new Date(newUser.created_date).getTime()) / (1000 * 60 * 60))} שעות

לאישור, היכנס למערכת: ${managementUrl}

בברכה,
מערכת PandaRecruitAI
                `;
                break;

            default:
                throw new Error(`Unknown notification type: ${notificationType}`);
        }

        // Send email to all admins via Resend
        const emailPromises = adminUsers.map(admin => 
            base44.asServiceRole.functions.invoke('sendEmailViaResend', {
                to: admin.email,
                subject: subject,
                body: body.replace(/\n/g, '<br>'),
                from_name: 'PandaRecruitAI - התרעות מערכת'
            })
        );

        await Promise.all(emailPromises);

        return new Response(JSON.stringify({ 
            success: true, 
            message: `Notification sent to ${adminUsers.length} admin(s)`,
            adminCount: adminUsers.length
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("Error sending admin notification:", error);
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});