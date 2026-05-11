import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get audienceType from request body
    const body = await req.json().catch(() => ({}));
    const audienceType = body.audienceType || 'employees'; // Default to employees

    // Get Hila settings
    const schedules = await base44.entities.HilaSchedule.list('-updated_date', 1);
    if (!schedules || schedules.length === 0) {
      return Response.json({ error: 'לא נמצאו הגדרות להילה' }, { status: 400 });
    }
    const settings = schedules[0];

    // Get employee emails from Shiri's employee list
    let employeeEmails = '';
    try {
      const employees = await base44.asServiceRole.entities.Employee.filter({ status: 'פעיל' });
      const emailsList = employees
        .filter(emp => emp.email && emp.email.trim().length > 0)
        .map(emp => emp.email.trim());
      employeeEmails = emailsList.join(', ');
      console.log(`Found ${emailsList.length} active employee emails`);
    } catch (empError) {
      console.warn('Failed to fetch employee emails:', empError.message);
      // Continue without emails - they can be added manually
    }

    // Get active jobs with complete details only (no partial jobs, excluding do_not_publish)
    const allJobs = await base44.entities.Job.filter({ status: 'פעילה' });
    const jobs = allJobs.filter(j => j.title && j.description && j.requirements && j.location && j.do_not_publish !== true);
    
    if (jobs.length === 0) {
      return Response.json({ error: 'אין משרות פעילות עם תיאור מלא' }, { status: 400 });
    }

    // Helper function to normalize text - remove excessive line breaks
    const normalizeText = (text) => {
      if (!text) return '';
      return text.replace(/\n\s*\n+/g, '\n').replace(/\s+\n/g, '\n').trim();
    };

    const cvEmail = 'jobs@pandatech.co.il'; // Always use jobs email for employees
    const bonusText = settings.bonus_description || 'בונוס לעובד שמביא חבר';

    // Format jobs for the email - professional HTML format
    const jobsList = jobs.map((job, index) => {
      const lines = [];
      const jobTitle = job.title || 'ללא כותרת';
      const jobCode = job.job_code || job.pipedrive_deal_id || 'ללא מספר';

      lines.push(`<b style="font-size: 16px; color: #1e40af;">${index + 1}. ${jobTitle}</b>`);
      lines.push(`<span style="color: #64748b;">מספר משרה: ${jobCode}</span>`);

      if (job.location) {
        lines.push(`<div style="margin-top: 8px;"><b>📍 מיקום:</b> ${normalizeText(job.location)}</div>`);
      }

      if (job.security_clearance) {
        lines.push(`<div><b>🔐 סיווג ביטחוני נדרש:</b> ${job.security_clearance}</div>`);
      }

      if (job.description) {
        lines.push(`<div style="margin-top: 8px;"><b>תיאור המשרה:</b><br/>${normalizeText(job.description)}</div>`);
      }

      if (job.requirements) {
        lines.push(`<div style="margin-top: 8px;"><b>דרישות המשרה:</b><br/>${normalizeText(job.requirements)}</div>`);
      }

      // Add apply button with "חבר מביא חבר" in subject
      const mailtoSubject = encodeURIComponent(`חבר מביא חבר - ${jobTitle} (${jobCode})`);
      const mailtoLink = `mailto:${cvEmail}?subject=${mailtoSubject}`;
      lines.push(`<div style="margin-top: 12px;">
        <a href="${mailtoLink}" style="display: inline-block; background-color: #2563eb; color: white; padding: 8px 16px; text-decoration: none; border-radius: 6px; font-weight: 500;">
          📨 שליחת קורות חיים למשרה זו
        </a>
      </div>`);

      return `<div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #2563eb;">
        ${lines.join('\n')}
      </div>`;
    }).join('\n\n');

    // Random opening styles for variety
    const openingStyles = [
      { greeting: 'היי כולם! 👋', intro: `מקווה שהשבוע שלכם מצוין!<br/>אני שמחה לעדכן אתכם ב-<b>${jobs.length} משרות פתוחות חדשות</b> בפנדה-טק.<br/>אם מישהו מהמעגל שלכם מחפש שינוי או הזדמנות חדשה - זה המקום!` },
      { greeting: 'היי כולם! 🌟', intro: `תקווה שהשבוע שלכם עובר מעולה!<br/>יש לי עבורכם <b>${jobs.length} משרות מעולות</b> לחברים ומכרים שמחפשים שינוי.<br/>אם מכירים מועמדים מתאימים - זו ההזדמנות!` },
      { greeting: 'היי כולם! ☕', intro: `אני מקווה שתתחילת השבוע שלכם נהדרת!<br/>מעדכנת אתכם על <b>${jobs.length} הזדמנויות קריירה</b> שפתחו בפנדה-טק.<br/>מכירים מישהו שמחפש אתגר חדש? שלחו אליו את המשרות!` },
      { greeting: 'היי חברים! 💼', intro: `מקווה שהשבוע שלכם התחיל נהדר!<br/><b>${jobs.length} משרות חדשות</b> פתוחות לגיוס בפנדה-טק.<br/>עזרו לנו למצוא את האנשים הטובים ביותר מהמעגל שלכם!` },
      { greeting: 'היי חברים! 🚀', intro: `איזה כיף לשתף אתכם!<br/>יש לנו <b>${jobs.length} משרות מעניינות</b> שזקוקות למועמדים איכותיים.<br/>אולי מישהו מהמכרים שלכם בדיוק מחפש הזדמנות כזאת?` }
    ];
    const randomStyle = openingStyles[Math.floor(Math.random() * openingStyles.length)];

    // Delete only pending_approval/approved drafts (NOT ready ones - they may be scheduled to send)
    try {
      const existingDrafts = await base44.entities.HilaDraft.list();
      for (const draft of existingDrafts) {
        if (draft.status === 'pending_approval' || draft.status === 'approved') {
          await base44.entities.HilaDraft.delete(draft.id);
        }
      }
    } catch (deleteErr) {
      console.warn('Failed to delete existing drafts:', deleteErr.message);
    }

    // Create professional HTML email for employees
    const emailBody = `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; direction: rtl;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">משרות חמות בפנדה-טק 🚀</h1>
    <p style="color: #e0e7ff; margin-top: 10px; font-size: 16px;">הזדמנות להמליץ על חברים ולזכות בבונוס!</p>
    </div>

    <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
    <p style="font-size: 16px; line-height: 1.6; color: #334155;">
    ${randomStyle.greeting}<br/><br/>
    ${randomStyle.intro}
    </p>

    <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border: 2px solid #fbbf24;">
    <p style="color: #78350f; line-height: 1.6; font-size: 14px; margin: 0;">
      💰 <b>תוכנית "חבר מביא חבר":</b> ${bonusText}<br/><br/>
      🤖 כאשר אתם לוחצים על כפתור שליחה ומבצעים את השליחה מהמייל של החברה, אני מזהה זאת אוטומטית ומעדכנת את תוכנית הבונוס עבורכם. במידה וחברים שלכם שולחים בעצמם, בקשו מהם לציין את השם שלכם במייל שהם שולחים בתוכנית "חבר מביא חבר".
    </p>
    </div>

    <hr style="border: none; border-top: 2px solid #e2e8f0; margin: 30px 0;" />

    <h2 style="color: #1e293b; font-size: 22px; margin-bottom: 20px;">המשרות הפתוחות:</h2>

    ${jobsList}

    <hr style="border: none; border-top: 2px solid #e2e8f0; margin: 30px 0;" />

    <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; margin-top: 20px;">
    <h3 style="color: #1e293b; margin-top: 0;">📧 כיצד להגיש מועמדות?</h3>
    <p style="color: #475569; line-height: 1.6;">
      לחצו על כפתור "שליחת קורות חיים" ליד המשרה המעניינת, או שלחו ישירות למייל:
    </p>
    <p style="margin-top: 15px;">
      <a href="mailto:${cvEmail}" style="display: inline-block; background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
        📧 ${cvEmail}
      </a>
    </p>
    <p style="color: #64748b; font-size: 14px; margin-top: 10px;">
      (אל תשכחו לציין את מספר המשרה!)
    </p>
    </div>

    <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 14px;">
    <p>בברכה,<br/><b>הילה (גייסת בינה מלאכותית)</b><br/>ממחלקת הגיוס של פנדה-טק 💜</p>
    </div>
    </div>
    </div>
    `;

    const emailSubject = `🎯 ${jobs.length} משרות פתוחות בפנדה-טק - עדכון שבועי + בונוס חבר מביא חבר!`;

    // Create single draft with "ready" status (no Carmit approval needed)
    const draft = await base44.entities.HilaDraft.create({
      subject: emailSubject,
      body: emailBody,
      jobs_count: jobs.length,
      employee_emails: employeeEmails,
      status: 'ready',
      audience_type: audienceType,
      scheduled_send_time: new Date().toISOString()
    });

    // Log draft creation
    try {
      await base44.entities.SystemActivityLog.create({
        actor_type: 'agent',
        actor_name: 'hila',
        actor_image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=40&h=40&fit=crop&crop=face',
        action_type: 'draft_created',
        action_description: `הילה הכינה טיוטת מייל עם ${jobs.length} משרות`,
        status: 'success',
        details: JSON.stringify({ jobsCount: jobs.length, draftId: draft.id })
      });
      
      await base44.entities.HilaRunLog.create({
        audience_type: audienceType,
        run_type: 'draft_creation',
        status: 'success',
        jobs_count: jobs.length,
        details: JSON.stringify({ draftId: draft.id })
      });
    } catch (logErr) {
      console.warn('Failed to log activity:', logErr.message);
    }

    return Response.json({ 
      success: true, 
      draftId: draft.id,
      jobsCount: jobs.length,
      message: 'הטיוטה נוצרה ומוכנה לשליחה'
    });

  } catch (error) {
    console.error('Error creating Hila draft:', error);
    
    try {
      const base44 = createClientFromRequest(req);
      const body = await req.json().catch(() => ({}));
      const audienceType = body.audienceType || 'employees';
      
      await base44.entities.HilaRunLog.create({
        audience_type: audienceType,
        run_type: 'draft_creation',
        status: 'failed',
        error_message: error.message
      });
    } catch (logErr) {
      console.warn('Failed to log error:', logErr.message);
    }
    
    return Response.json({ error: error.message }, { status: 500 });
  }
});