import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Starting Eitan Weekly Report Generation');

    // Get Eitan settings
    const schedules = await base44.asServiceRole.entities.EitanSchedule.list('-updated_date', 1);
    if (!schedules || schedules.length === 0) {
      return Response.json({ error: 'No Eitan settings found' }, { status: 404 });
    }

    const settings = schedules[0];
    
    if (!settings.recipient_email) {
      return Response.json({ error: 'No recipient email configured' }, { status: 400 });
    }

    // Fetch all employees
    const employees = await base44.asServiceRole.entities.Employee.list('-created_date', 1000);
    
    // PART A: Employees without a manager in Pipedrive
    const employeesWithoutManager = employees.filter(emp => 
      emp.status === 'פעיל' && !emp.manager_pipedrive_id
    );

    // PART B: Managers with missing contact info
    // Build a map of unique managers
    const managerMap = {};
    for (const emp of employees) {
      if (emp.manager_name && emp.manager_pipedrive_id) {
        if (!managerMap[emp.manager_pipedrive_id]) {
          managerMap[emp.manager_pipedrive_id] = {
            name: emp.manager_name,
            phone: emp.client_contact_phone,
            email: emp.client_contact_email,
            employees: []
          };
        }
        managerMap[emp.manager_pipedrive_id].employees.push(emp.full_name);
      }
    }

    // Find managers with missing data
    const managersWithMissingData = Object.entries(managerMap)
      .filter(([id, manager]) => !manager.phone || !manager.email)
      .map(([id, manager]) => ({
        id,
        name: manager.name,
        missingPhone: !manager.phone,
        missingEmail: !manager.email,
        employees: manager.employees
      }));

    // Build email report
    let reportHtml = `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
        <h1 style="color: #2563eb; border-bottom: 3px solid #2563eb; padding-bottom: 10px;">
          📊 דוח שבועי - נתונים חסרים במערך איכות השירות
        </h1>
        
        <p style="color: #4b5563; margin: 20px 0;">
          דוח זה נוצר אוטומטית על ידי איתן, מנהל בדיקות איכות השירות.
        </p>

        <p style="background: #fef3c7; border-right: 4px solid #f59e0b; padding: 12px; margin: 20px 0;">
          <strong>⚠️ חשוב:</strong> הדוח מציג רק עובדים ומנהלים עם נתונים חסרים. מנהלים עם פרטים מלאים לא מופיעים ברשימה.
        </p>
    `;

    // Section A: Employees without manager
    reportHtml += `
      <div style="margin: 30px 0;">
        <h2 style="color: #dc2626; background: #fee2e2; padding: 10px; border-right: 4px solid #dc2626;">
          א. עובדים ללא מנהל ישיר בפייפדרייב (${employeesWithoutManager.length})
        </h2>
    `;

    if (employeesWithoutManager.length === 0) {
      reportHtml += `<p style="color: #059669; padding: 10px;">✅ כל העובדים הפעילים שויכו למנהל ישיר</p>`;
    } else {
      reportHtml += `
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
          <thead>
            <tr style="background: #f3f4f6; text-align: right;">
              <th style="padding: 10px; border: 1px solid #e5e7eb;">שם עובד</th>
              <th style="padding: 10px; border: 1px solid #e5e7eb;">מחלקה</th>
              <th style="padding: 10px; border: 1px solid #e5e7eb;">תאריך הצטרפות</th>
            </tr>
          </thead>
          <tbody>
      `;

      for (const emp of employeesWithoutManager) {
        reportHtml += `
          <tr>
            <td style="padding: 10px; border: 1px solid #e5e7eb;"><strong>${emp.full_name}</strong></td>
            <td style="padding: 10px; border: 1px solid #e5e7eb;">${emp.department || '-'}</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb;">${emp.start_date ? new Date(emp.start_date).toLocaleDateString('he-IL') : '-'}</td>
          </tr>
        `;
      }

      reportHtml += `
          </tbody>
        </table>
      `;
    }

    reportHtml += `</div>`;

    // Section B: Managers with missing data
    reportHtml += `
      <div style="margin: 30px 0;">
        <h2 style="color: #d97706; background: #fef3c7; padding: 10px; border-right: 4px solid #d97706;">
          ב. מנהלים ישירים עם נתונים חסרים (${managersWithMissingData.length})
        </h2>
    `;

    if (managersWithMissingData.length === 0) {
      reportHtml += `<p style="color: #059669; padding: 10px;">✅ לכל המנהלים הישירים יש טלפון ומייל</p>`;
    } else {
      reportHtml += `
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
          <thead>
            <tr style="background: #f3f4f6; text-align: right;">
              <th style="padding: 10px; border: 1px solid #e5e7eb;">שם מנהל</th>
              <th style="padding: 10px; border: 1px solid #e5e7eb;">נתונים חסרים</th>
              <th style="padding: 10px; border: 1px solid #e5e7eb;">עובדים תחתיו</th>
            </tr>
          </thead>
          <tbody>
      `;

      for (const manager of managersWithMissingData) {
        const missingFields = [];
        if (manager.missingPhone) missingFields.push('טלפון');
        if (manager.missingEmail) missingFields.push('מייל');

        reportHtml += `
          <tr>
            <td style="padding: 10px; border: 1px solid #e5e7eb;"><strong>${manager.name}</strong></td>
            <td style="padding: 10px; border: 1px solid #e5e7eb; color: #dc2626;">${missingFields.join(', ')}</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb; font-size: 12px;">${manager.employees.join(', ')}</td>
          </tr>
        `;
      }

      reportHtml += `
          </tbody>
        </table>
      `;
    }

    reportHtml += `</div>`;

    // Summary
    reportHtml += `
      <div style="margin: 30px 0; background: #eff6ff; border: 2px solid #3b82f6; padding: 15px; border-radius: 8px;">
        <h3 style="color: #1e40af; margin: 0 0 10px 0;">📈 סיכום</h3>
        <ul style="margin: 0; padding-right: 20px;">
          <li>סה״כ עובדים פעילים: ${employees.filter(e => e.status === 'פעיל').length}</li>
          <li>עובדים ללא מנהל: ${employeesWithoutManager.length}</li>
          <li>מנהלים עם נתונים חסרים: ${managersWithMissingData.length}</li>
        </ul>
      </div>

      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; text-align: center;">
        דוח זה נוצר אוטומטית על ידי איתן, מנהל בדיקות איכות השירות | ${new Date().toLocaleString('he-IL')}
      </div>
    </div>
    `;

    // Send email via Resend
    await base44.asServiceRole.functions.invoke('sendEmailViaResend', {
      to: settings.recipient_email,
      subject: `דוח שבועי איתן - נתונים חסרים (${new Date().toLocaleDateString('he-IL')})`,
      body: reportHtml,
      from_name: 'איתן - בדיקות איכות'
    });

    console.log(`Weekly report sent to ${settings.recipient_email}`);

    return Response.json({
      success: true,
      employeesWithoutManager: employeesWithoutManager.length,
      managersWithMissingData: managersWithMissingData.length,
      sentTo: settings.recipient_email
    });

  } catch (error) {
    console.error('Eitan weekly report error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});