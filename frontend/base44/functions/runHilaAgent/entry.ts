import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

// Send email via Resend API
async function sendEmailViaResend({ to, subject, body, from_name }) {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not configured');

  const emailList = to.split(/[;,]/).map(e => {
    const m = e.match(/<([^>]+)>/);
    return (m ? m[1] : e).trim();
  }).filter(e => e.includes('@'));
  const uniqueEmails = [...new Set(emailList)];

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `${from_name || 'הילה - צוות גיוס PandaTech'} <noreply@pandatech.co.il>`,
      to: uniqueEmails,
      subject,
      html: body
    })
  });

  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Failed to send email via Resend');

  console.log(`Email sent via Resend to ${uniqueEmails.length} recipients, ID: ${result.id}`);
  return result;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body for optional targetEmail override
    let targetEmail = null;
    let isTest = false;
    let overrideDuplicatePrevention = false;
    try {
      const body = await req.json();
      targetEmail = body.targetEmail;
      isTest = body.isTest || false;
      overrideDuplicatePrevention = body.overrideDuplicatePrevention || false;
    } catch (e) {
      // No body or invalid JSON, continue with defaults
    }

    // Get Hila's schedule settings
    const schedules = await base44.entities.HilaSchedule.list('-updated_date', 1);
    if (!schedules || schedules.length === 0) {
      return Response.json({ error: 'לא נמצאו הגדרות להילה' }, { status: 400 });
    }

    const settings = schedules[0];
    
    // Check if already sent today (prevent duplicates) - UNLESS it's a test or override is enabled
    if (!isTest && !overrideDuplicatePrevention) {
      const now = new Date();
      const israelNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
      const todayStart = new Date(israelNow);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(todayStart);
      todayEnd.setHours(23, 59, 59, 999);
      
      const recentLogs = await base44.entities.HilaRunLog.filter({ 
        run_type: 'email_send',
        status: 'success',
        created_date: { $gte: todayStart.toISOString(), $lte: todayEnd.toISOString() }
      });
      
      if (recentLogs && recentLogs.length > 0) {
        console.log('Email already sent today - preventing duplicate');
        
        const rawEmailList = targetEmail || settings.distribution_list_email;
        
        // Log this blocked attempt
        try {
          await base44.entities.HilaRunLog.create({
            run_type: 'email_send',
            status: 'skipped',
            error_message: 'מייל כבר נשלח היום - שליחה נוספת נחסמה',
            emails_sent_to: rawEmailList,
            details: JSON.stringify({ isTest, reason: 'duplicate_prevention' })
          });
        } catch (logErr) {
          console.warn('Failed to log blocked attempt:', logErr.message);
        }
        
        // 🚨 CRITICAL: Send alert to admin about duplicate attempt
        try {
          const adminUsers = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
          for (const admin of adminUsers) {
            await base44.integrations.Core.SendEmail({
              to: admin.email,
              subject: '🚨 התראת אבטחה: ניסיון שליחת מייל כפול - הילה (עובדים - runHilaAgent)',
              body: `
⚠️ ניסיון חסום לשליחת מייל כפול זוהה ונחסם

פרטי הניסיון:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• משתמש: ${user.full_name} (${user.email})
• זמן: ${new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}
• סוג: מייל לעובדים (runHilaAgent)
• מצב: ${isTest ? 'מבחן' : 'ייצור'}
• נמענים: ${rawEmailList}

מייל אחרון שנשלח היום:
• זמן שליחה: ${new Date(recentLogs[0].created_date).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}

✅ המייל הכפול נחסם בהצלחה ולא נשלח.

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
          message: 'מייל לעובדים כבר נשלח היום. שליחה נוספת תיחסם כדי למנוע הפרעה לעובדים.',
          alreadySentToday: true
        });
      }
    }
    
    const rawEmailList = targetEmail || settings.distribution_list_email;
    if (!rawEmailList) {
      return Response.json({ error: 'לא הוגדרה כתובת מייל לשליחה' }, { status: 400 });
    }

    // Parse Outlook format: "First Last <email@domain.com>; First2 Last2 <email2@domain.com>"
    // Also handles plain email addresses
    const parseOutlookEmails = (input) => {
      if (!input) return [];
      
      const emails = [];
      // Split by semicolon
      const parts = input.split(';').map(p => p.trim()).filter(p => p);
      
      for (const part of parts) {
        // Check for Outlook format: Name <email>
        const outlookMatch = part.match(/<([^>]+)>/);
        if (outlookMatch) {
          emails.push(outlookMatch[1].trim());
        } else if (part.includes('@')) {
          // Plain email address
          emails.push(part.trim());
        }
      }
      
      return emails;
    };

    const emailList = parseOutlookEmails(rawEmailList);
    if (emailList.length === 0) {
      return Response.json({ error: 'לא נמצאו כתובות מייל תקינות' }, { status: 400 });
    }

    // Join emails with semicolon for sending
    const emailToSend = emailList.join('; ');

    // Get active jobs with complete details only
    const allJobs = await base44.entities.Job.filter({ status: 'פעילה' });
    const activeJobs = (Array.isArray(allJobs) ? allJobs : []).filter(j => {
      // Only include jobs that are active AND have all required fields filled
      if (j.do_not_publish === true) return false;
      if (!j.title || !j.description || !j.requirements || !j.location) return false;
      return true;
    });

    if (activeJobs.length === 0) {
      return Response.json({ success: true, message: 'אין משרות מלאות ופעילות לשליחה' });
    }

    // Check if there's a ready or approved draft to use
    let readyDrafts = await base44.entities.HilaDraft.filter({ status: 'ready' }, '-created_date', 1);
    if (!readyDrafts || readyDrafts.length === 0) {
      // Fallback to approved for backwards compatibility
      readyDrafts = await base44.entities.HilaDraft.filter({ status: 'approved' }, '-created_date', 1);
    }
    const approvedDrafts = readyDrafts;
    
    if (approvedDrafts && approvedDrafts.length > 0) {
      // Use the approved draft instead of generating new content
      const draft = approvedDrafts[0];
      
      const emailSubject = isTest 
        ? `[בדיקה] ${draft.subject}`
        : draft.subject;
      
      // The draft.body already contains full HTML with buttons - use it as-is
      const emailBody = draft.body;
      
      await sendEmailViaResend({
        to: emailToSend,
        subject: emailSubject,
        body: emailBody,
        from_name: 'הילה - צוות גיוס PandaTech'
      });

      // Update draft status to sent
      await base44.entities.HilaDraft.update(draft.id, {
        status: 'sent',
        sent_date: new Date().toISOString()
      });

      // Update schedule with last run info
      await base44.entities.HilaSchedule.update(settings.id, {
        last_run_time: new Date().toISOString(),
        last_run_status: 'success'
      });

      // Log to SystemActivityLog and HilaRunLog
      try {
        await base44.entities.SystemActivityLog.create({
          actor_type: 'agent',
          actor_name: 'hila',
          actor_image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=40&h=40&fit=crop&crop=face',
          action_type: 'email_sent',
          action_description: isTest 
            ? `הילה שלחה מייל בדיקה מטיוטה מאושרת: ${draft.jobs_count || activeJobs.length} משרות נשלחו ל-${emailToSend}`
            : `הילה שלחה מייל משרות מטיוטה מאושרת: ${draft.jobs_count || activeJobs.length} משרות נשלחו לעובדים`,
          status: 'success',
          details: JSON.stringify({ jobsSent: draft.jobs_count || activeJobs.length, sentTo: emailToSend, isTest, draftId: draft.id })
        });

        await base44.entities.HilaRunLog.create({
          run_type: 'email_send',
          status: 'success',
          jobs_count: draft.jobs_count || activeJobs.length,
          emails_sent_to: emailToSend,
          details: JSON.stringify({ isTest, draftId: draft.id, usedApprovedDraft: true })
        });
      } catch (logErr) {
        console.warn('Failed to log activity:', logErr.message);
      }

      return Response.json({ 
        success: true, 
        jobsSent: draft.jobs_count || activeJobs.length,
        sentTo: emailToSend,
        isTest,
        usedApprovedDraft: true
      });
    }

    // No approved draft - this should not happen in normal flow, but keep as fallback

    const cvEmail = 'jobs@pandatech.co.il'; // Always use jobs email for employees
    const bonusText = settings.bonus_description || 'בונוס כספי נאה';

    // Send the email
    const emailSubject = isTest 
      ? `[בדיקה] ${llmResponse.subject || `משרות חמות השבוע - ${activeJobs.length} משרות פעילות!`}`
      : llmResponse.subject || `משרות חמות השבוע - ${activeJobs.length} משרות פעילות!`;
    
    // Convert LLM response to proper HTML - preserve line breaks
    const convertToHtml = (text) => {
      if (!text) return '';
      // Replace double newlines with paragraph breaks
      // Replace single newlines with <br/>
      // Wrap in RTL div with proper styling
      let html = text
        .replace(/\n\n/g, '</p><p style="margin-bottom: 15px;">')
        .replace(/\n/g, '<br/>');
      return `<div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.8;"><p style="margin-bottom: 15px;">${html}</p></div>`;
    };

    // Fallback email body - should use the draft instead
    const emailBody = `<div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.8;">
<p>שלום לכולם,</p>
<p>אין טיוטה מאושרת - אנא צרו טיוטה תחילה.</p>
<p>בברכה,<br/><b>הילה</b></p>
</div>`;
    
    // Log the failure - no approved draft found
    try {
      await base44.entities.HilaRunLog.create({
        run_type: 'email_send',
        status: 'failed',
        error_message: 'לא נמצאה טיוטה מאושרת - יש ליצור טיוטה תחילה',
        details: JSON.stringify({ isTest })
      });
    } catch (logErr) {
      console.warn('Failed to log error:', logErr.message);
    }
    
    // This fallback should never be used - always create a draft first
    return Response.json({ 
      success: false, 
      error: 'לא נמצאה טיוטה מאושרת - אנא צרו טיוטה תחילה'
    });

  } catch (error) {
    console.error('Error running Hila agent:', error);
    
    // Try to update status on error and log the failure
    try {
      const base44 = createClientFromRequest(req);
      const schedules = await base44.entities.HilaSchedule.list('-updated_date', 1);
      if (schedules && schedules.length > 0) {
        await base44.entities.HilaSchedule.update(schedules[0].id, {
          last_run_time: new Date().toISOString(),
          last_run_status: 'failed',
          last_error: error.message
        });
      }
      
      // Log the failure
      await base44.entities.HilaRunLog.create({
        run_type: 'email_send',
        status: 'failed',
        error_message: error.message,
        details: JSON.stringify({ stack: error.stack?.substring(0, 500) })
      });
    } catch (e) {
      console.error('Could not update status:', e);
    }

    return Response.json({ error: error.message }, { status: 500 });
  }
});