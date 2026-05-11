import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get Elad settings
    const eladSchedules = await base44.asServiceRole.entities.EladSchedule.list('-updated_date', 1);
    const settings = eladSchedules.length > 0 ? eladSchedules[0] : null;

    if (!settings || !settings.is_enabled) {
      return Response.json({ 
        success: false, 
        error: 'סוכן אלעד מושבת או לא מוגדר' 
      });
    }

    if (!settings.recipient_email) {
      return Response.json({ 
        success: false, 
        error: 'לא הוגדר מייל נמען לקבלת הדוחות' 
      });
    }

    // Get all clients and contacts
    const clients = await base44.asServiceRole.entities.Client.list();
    const contacts = await base44.asServiceRole.entities.ContactPerson.list();

    const missingData = [];

    // Check each contact for missing data
    for (const contact of contacts) {
      const issues = [];

      // Check organization association
      if (!contact.client_id) {
        issues.push('חסר שיוך ארגוני');
      } else {
        const client = clients.find(c => c.id === contact.client_id);
        if (!client) {
          issues.push('שיוך ארגוני לא תקין');
        }
      }

      // Check email
      if (!contact.email || contact.email.trim() === '') {
        issues.push('חסר מייל');
      }

      // Check phone
      if (!contact.phone || contact.phone.trim() === '') {
        issues.push('חסר טלפון');
      }

      if (issues.length > 0) {
        const clientName = contact.client_id 
          ? clients.find(c => c.id === contact.client_id)?.name || 'לא משויך'
          : 'לא משויך';

        missingData.push({
          name: contact.name || 'ללא שם',
          clientName,
          email: contact.email || '-',
          phone: contact.phone || '-',
          issues: issues.join(', ')
        });
      }
    }

    // Check clients for missing data
    for (const client of clients) {
      const issues = [];

      if (!client.email || client.email.trim() === '') {
        issues.push('חסר מייל');
      }

      if (!client.phone || client.phone.trim() === '') {
        issues.push('חסר טלפון');
      }

      if (issues.length > 0) {
        missingData.push({
          name: `לקוח: ${client.name}`,
          clientName: client.name,
          email: client.email || '-',
          phone: client.phone || '-',
          issues: issues.join(', ')
        });
      }
    }

    // Update last run status
    const updateData = {
      last_run_time: new Date().toISOString(),
      last_run_status: 'success',
      last_missing_count: missingData.length
    };

    if (settings.id) {
      await base44.asServiceRole.entities.EladSchedule.update(settings.id, updateData);
    }

    // Check if there were missing items in the last run and if the count hasn't changed
    const shouldSendEmail = missingData.length > 0 && (
      !settings.last_sent_missing_count || 
      settings.last_sent_missing_count !== missingData.length ||
      !settings.last_email_sent_time ||
      // Only send email again if 24 hours passed since last email
      (new Date().getTime() - new Date(settings.last_email_sent_time).getTime()) > 24 * 60 * 60 * 1000
    );

    // If there are missing items and we should send email, send email
    if (shouldSendEmail) {
      const tableRows = missingData.map(item => `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">${item.name}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${item.clientName}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${item.email}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${item.phone}</td>
          <td style="padding: 8px; border: 1px solid #ddd; color: red;">${item.issues}</td>
        </tr>
      `).join('');

      const emailBody = `
שלום ${settings.recipient_name || 'רב'},

אני אלעד, סוכן ה-AI לניהול לקוחות.

בבדיקה שביצעתי נמצאו ${missingData.length} רשומות עם פרטים חסרים:

<table dir="rtl" style="border-collapse: collapse; width: 100%; font-family: Arial, sans-serif;">
  <thead>
    <tr style="background-color: #f2f2f2;">
      <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">שם</th>
      <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">ארגון</th>
      <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">מייל</th>
      <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">טלפון</th>
      <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">בעיות</th>
    </tr>
  </thead>
  <tbody>
    ${tableRows}
  </tbody>
</table>

אנא עדכן/י את הנתונים החסרים בהקדם האפשרי.

בברכה,
אלעד - סוכן AI לניהול לקוחות
PandaRecruitAI
      `;

      await base44.asServiceRole.functions.invoke('sendEmailViaResend', {
        to: settings.recipient_email,
        subject: `[PandaRecruitAI] דוח פרטים חסרים - ${missingData.length} רשומות דורשות עדכון`,
        body: emailBody,
        from_name: 'אלעד - סוכן לקוחות'
      });

      // Update last email sent time and count
      await base44.asServiceRole.entities.EladSchedule.update(settings.id, {
        last_email_sent_time: new Date().toISOString(),
        last_sent_missing_count: missingData.length
      });

      return Response.json({
        success: true,
        missingCount: missingData.length,
        emailSent: true,
        recipient: settings.recipient_email,
        message: `נמצאו ${missingData.length} רשומות עם פרטים חסרים. נשלח מייל ל-${settings.recipient_email}`
      });
    }

    return Response.json({
      success: true,
      missingCount: missingData.length,
      emailSent: false,
      message: missingData.length > 0 
        ? `נמצאו ${missingData.length} רשומות עם פרטים חסרים - אבל מייל לא נשלח (כבר נשלח לאחרונה או הספירה לא השתנתה)`
        : 'כל הנתונים תקינים - לא נמצאו פרטים חסרים'
    });

  } catch (error) {
    console.error('Error running Elad agent:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});