import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // CRITICAL: Prevent duplicate draft creation for candidates TODAY
    const now = new Date();
    const israelNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
    const todayStart = new Date(israelNow);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);
    
    const todaysCandidateDrafts = await base44.asServiceRole.entities.HilaRunLog.filter({
      audience_type: 'candidates',
      run_type: 'draft_creation',
      status: 'success',
      created_date: { $gte: todayStart.toISOString(), $lte: todayEnd.toISOString() }
    });
    
    if (todaysCandidateDrafts && todaysCandidateDrafts.length > 0) {
      console.log('🚫 BLOCKED: Candidate draft already created today - preventing duplicate');
      
      // 🚨 CRITICAL: Send alert to admin about duplicate attempt
      try {
        const adminUsers = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
        for (const admin of adminUsers) {
          await base44.integrations.Core.SendEmail({
            to: admin.email,
            subject: '🚨 התראת אבטחה: ניסיון יצירת טיוטה כפולה - הילה (מועמדים)',
            body: `
⚠️ ניסיון חסום ליצור טיוטה כפולה זוהה ונחסם

פרטי הניסיון:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• משתמש: ${user.full_name} (${user.email})
• זמן: ${new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}
• סוג: יצירת טיוטה למועמדים

טיוטה אחרונה שנוצרה היום:
• זמן יצירה: ${new Date(todaysCandidateDrafts[0].created_date).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}

✅ הטיוטה הכפולה נחסמה בהצלחה.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
מערכת PandaHRAI - התראה אוטומטית
            `,
            from_name: 'PandaHRAI - אבטחה'
          });
        }
      } catch (alertError) {
        console.error('Failed to send admin alert:', alertError);
      }
      
      return Response.json({ 
        success: false, 
        error: 'טיוטה למועמדים כבר נוצרה היום - חסימה למניעת כפילות'
      }, { status: 409 });
    }

    // Get Hila settings
    const schedules = await base44.entities.HilaSchedule.list('-updated_date', 1);
    if (!schedules || schedules.length === 0) {
      return Response.json({ error: 'לא נמצאו הגדרות להילה' }, { status: 400 });
    }
    const settings = schedules[0];

    // Get active jobs with complete details only
    let allJobs = await base44.asServiceRole.entities.Job.filter({ status: 'פעילה' });
    if (!Array.isArray(allJobs)) {
      allJobs = [];
    }
    const jobs = allJobs.filter(j => j.title && j.description && j.requirements && j.location && j.do_not_publish !== true);
    
    if (jobs.length === 0) {
      return Response.json({ error: 'אין משרות פעילות עם תיאור מלא' }, { status: 400 });
    }

    // Get active candidates (not in excluded statuses)
    const excludedStatuses = [
      'לא מתאים – נסגר',
      'אושר – בהמתנה להצעת שכר',
      'חוזה חתום',
      'סיווג אושר – בהמתנה לתחילת עבודה',
      'מועסק – פעיל',
      'סגור'
    ];
    
    let allCandidates = await base44.asServiceRole.entities.Candidate.list();
    if (!Array.isArray(allCandidates)) {
      allCandidates = [];
    }
    const candidates = allCandidates.filter(cand => 
      cand.email && 
      cand.email.trim() && 
      !excludedStatuses.includes(cand.status)
    );

    // Helper function to normalize text
    const normalizeText = (text) => {
      if (!text) return '';
      return text.replace(/\n\s*\n+/g, '\n').replace(/\s+\n/g, '\n').trim();
    };

    // Format jobs for candidates email - more detailed and professional
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
      
      // Add apply button
      const cvEmail = settings.candidates_cv_email || 'jobs@pandatech.co.il';
      const mailtoSubject = encodeURIComponent(`קורות חיים למשרה: ${jobTitle} (${jobCode})`);
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

    const cvEmail = settings.candidates_cv_email || 'jobs@pandatech.co.il';
    const websiteUrl = 'https://www.pandatech.co.il';

    // Delete existing candidate drafts
    const existingDrafts = await base44.asServiceRole.entities.HilaDraft.list();
    const candidateDrafts = existingDrafts.filter(d => d.audience_type === 'candidates');
    for (const draft of candidateDrafts) {
      if (draft.status === 'pending_approval' || draft.status === 'approved' || draft.status === 'ready') {
        await base44.asServiceRole.entities.HilaDraft.delete(draft.id);
      }
    }

    // Create HTML email for candidates - professional and engaging
    const emailBody = `
<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; direction: rtl;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">משרות חמות בפנדה-טק 🚀</h1>
    <p style="color: #e0e7ff; margin-top: 10px; font-size: 16px;">הזדמנויות קריירה מעולות ממתינות לך</p>
  </div>

  <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
    <p style="font-size: 16px; line-height: 1.6; color: #334155;">
      שלום רב,<br/><br/>
      אני שמחה לעדכן אותך ב-<b>${jobs.length} משרות פתוחות חדשות</b> בפנדה-טק.<br/>
      אם אתה מחפש אתגר חדש או מכיר מישהו מתאים - זו ההזדמנות שלך!
    </p>

    <hr style="border: none; border-top: 2px solid #e2e8f0; margin: 30px 0;" />

    <h2 style="color: #1e293b; font-size: 22px; margin-bottom: 20px;">המשרות הפתוחות:</h2>

    ${jobsList}

    <hr style="border: none; border-top: 2px solid #e2e8f0; margin: 30px 0;" />

    <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; margin-top: 30px;">
      <h3 style="color: #1e293b; margin-top: 0;">💼 כיצד להגיש מועמדות?</h3>
      <p style="color: #475569; line-height: 1.6;">
        1. לחץ על כפתור "שליחת קורות חיים" ליד המשרה המעניינת אותך<br/>
        2. צרף את קורות החיים שלך (יש לציין את מספר המשרה)<br/>
        3. נחזור אליך בהקדם!
      </p>
      <p style="margin-top: 15px;">
        <a href="mailto:${cvEmail}" style="display: inline-block; background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
          📧 שליחת קורות חיים כללי
        </a>
      </p>
    </div>

    <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin-top: 20px; border: 2px solid #fbbf24;">
      <h3 style="color: #92400e; margin-top: 0;">🌐 למידע נוסף על החברה</h3>
      <p style="color: #78350f; line-height: 1.6;">
        בקר באתר שלנו וגלה עוד על פנדה-טק, הצוות שלנו והערכים שמובילים אותנו:
      </p>
      <p style="margin-top: 10px;">
        <a href="${websiteUrl}" style="display: inline-block; background-color: #f59e0b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600;">
          🔗 בקר באתר פנדה-טק
        </a>
      </p>
    </div>

    <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 13px;">
      <p>בברכה,<br/>הילה (גייסת בינה מלאכותית) ממחלקת הגיוס של פנדה-טק 💜</p>
      <p style="margin-top: 15px; font-size: 11px;">
        <a href="{UNSUBSCRIBE_LINK}" style="color: #94a3b8; text-decoration: underline;">לביטול מנוי לחץ כאן</a>
      </p>
    </div>
  </div>
</div>
`;

    const emailSubject = `🎯 ${jobs.length} משרות פתוחות בפנדה-טק - הזדמנות שלך להצטרף!`;

    // Create draft with "ready" status - no approval needed
    const draft = await base44.asServiceRole.entities.HilaDraft.create({
      subject: emailSubject,
      body: emailBody,
      jobs_count: jobs.length,
      candidate_emails: candidates.map(c => c.email).join('; '),
      status: 'ready',
      audience_type: 'candidates',
      scheduled_send_time: new Date().toISOString()
    });

    // Log draft creation
    try {
      await base44.entities.SystemActivityLog.create({
        actor_type: 'agent',
        actor_name: 'hila',
        actor_image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=40&h=40&fit=crop&crop=face',
        action_type: 'draft_created',
        action_description: `הילה הכינה טיוטת מייל למועמדים עם ${jobs.length} משרות`,
        status: 'success',
        details: JSON.stringify({ jobsCount: jobs.length, draftId: draft.id, candidatesCount: candidates.length })
      });
      
      await base44.entities.HilaRunLog.create({
        audience_type: 'candidates',
        run_type: 'draft_creation',
        status: 'success',
        jobs_count: jobs.length,
        candidates_sent: candidates.length,
        details: JSON.stringify({ draftId: draft.id })
      });
    } catch (logErr) {
      console.warn('Failed to log activity:', logErr.message);
    }

    return Response.json({ 
      success: true, 
      draftId: draft.id,
      jobsCount: jobs.length,
      candidatesCount: candidates.length,
      message: 'הטיוטה למועמדים נוצרה ומוכנה לשליחה'
    });

  } catch (error) {
    console.error('Error creating Hila candidate draft:', error);
    
    try {
      const base44 = createClientFromRequest(req);
      await base44.entities.HilaRunLog.create({
        audience_type: 'candidates',
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