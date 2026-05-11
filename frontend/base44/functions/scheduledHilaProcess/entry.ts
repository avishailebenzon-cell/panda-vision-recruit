import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Simplified Hila process:
// 1. Creates draft on draft_send_day at draft_send_time
// 2. Sends the email on day_of_week at time (if ready draft exists)

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get Hila's schedule settings
    const schedules = await base44.asServiceRole.entities.HilaSchedule.list('-updated_date', 1);
    if (!schedules || schedules.length === 0) {
      return Response.json({ message: 'No Hila settings found' });
    }

    const settings = schedules[0];
    
    if (!settings.is_enabled) {
      return Response.json({ message: 'Hila is disabled' });
    }

    // Get current day and time in Israel timezone (using Intl for reliability in Deno)
    const now = new Date();
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Jerusalem',
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const parts = Object.fromEntries(fmt.formatToParts(now).map(p => [p.type, p.value]));
    const currentDay = parts.weekday.toLowerCase();
    const currentHour = parts.hour.padStart(2, '0');
    const currentMinute = parseInt(parts.minute, 10);
    const roundedMinute = Math.floor(currentMinute / 30) * 30;
    const currentTime = `${currentHour}:${roundedMinute.toString().padStart(2, '0')}`;

    console.log(`Israel time: ${currentDay} ${currentHour}:${parts.minute} → matched slot: ${currentTime}`);

    const results = {
      currentDay,
      currentTime, 
      realTime: `${currentHour}:${currentMinute.toString().padStart(2, '0')}`,
      actions: []
    };

    // Check if it's time to create draft
    const draftDays = settings.draft_days || [settings.draft_send_day || 'thursday'];
    const draftTime = settings.draft_send_time || '10:00';
    
    if (draftDays.includes(currentDay) && currentTime === draftTime) {
      results.actions.push('Creating draft...');
      const draftResult = await createDraft(base44, settings);
      results.draftCreation = draftResult;
    }

    // Check if it's time to send the email
    const rawSendDays = settings.days;
    const sendDays = (rawSendDays && rawSendDays.length > 0) ? rawSendDays : [settings.day_of_week || 'sunday'];
    const sendTime = settings.time || '11:00';

    const isSendDay = sendDays.includes(currentDay);
    const isSendTime = currentTime === sendTime;

    if (isSendDay && isSendTime) {
      // Check if sending is enabled
      if (!settings.is_enabled) {
        results.actions.push('Email sending is disabled - skipping send');
        results.emailSent = { success: false, reason: 'Email sending is disabled' };
      } else {
        results.actions.push('Checking for ready drafts to send...');

        // Prevent sending more than once per day (Israel timezone)
        const today = new Date();
        const israelDateParts2 = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Jerusalem',
          year: 'numeric', month: '2-digit', day: '2-digit'
        }).formatToParts(today);
        const israelDate2 = Object.fromEntries(israelDateParts2.map(p => [p.type, p.value]));
        const todayStart = new Date(`${israelDate2.year}-${israelDate2.month}-${israelDate2.day}T00:00:00+03:00`);
        const todayEnd = new Date(`${israelDate2.year}-${israelDate2.month}-${israelDate2.day}T23:59:59+03:00`);

        const recentSends = await base44.asServiceRole.entities.HilaRunLog.filter({
          run_type: 'email_send',
          status: 'success',
          created_date: { $gte: todayStart.toISOString(), $lte: todayEnd.toISOString() }
        });

        if (recentSends && recentSends.length > 0) {
          results.actions.push('Email already sent today - skipping to prevent duplicate sends');
          results.emailSent = { success: false, reason: 'Email already sent today' };
        } else {
          // Check if there's a ready draft
          const readyDrafts = await base44.asServiceRole.entities.HilaDraft.filter(
            { status: 'ready' },
            '-created_date',
            1
          );

          if (readyDrafts && readyDrafts.length > 0) {
            const draft = readyDrafts[0];

            // Validate draft has required content
            if (!draft.subject || !draft.body || draft.body.trim().length < 50) {
              results.actions.push('Draft found but is invalid (missing subject or body) - skipping send');
              results.emailSent = { success: false, reason: 'Draft is invalid or empty' };
            } else if (!draft.jobs_count || draft.jobs_count === 0) {
              results.actions.push('Draft found but contains no jobs - skipping send');
              results.emailSent = { success: false, reason: 'Draft has no jobs' };
            } else {
              results.actions.push(`Valid draft found (${draft.jobs_count} jobs) - sending email...`);
              const sendResult = await sendEmail(base44, settings, draft);
              results.emailSent = sendResult;
            }
          } else {
            results.actions.push('No ready draft found - skipping send. Create a draft first.');
            results.emailSent = { success: false, reason: 'No ready draft available. Please create a draft before the send time.' };
            // Alert admin that no draft was available at send time
            try {
              const adminUsers = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
              for (const admin of adminUsers) {
                await base44.asServiceRole.integrations.Core.SendEmail({
                  to: admin.email,
                  subject: '⚠️ הילה - לא נמצאה טיוטה לשליחה בשעה המתוזמנת',
                  body: `שלום,\n\nהילה ניסתה לשלוח מייל לעובדים בשעה ${settings.time} אבל לא נמצאה טיוטה מוכנה (סטטוס "ready").\n\nכדי לשלוח - יש ליצור טיוטה ולוודא שהיא בסטטוס "ready" לפני שעת השליחה.\n\nמערכת PandaHRAI`,
                  from_name: 'PandaHRAI - הילה'
                });
              }
            } catch (alertErr) {
              console.warn('Failed to send no-draft alert:', alertErr.message);
            }
          }
        }
      }
    } else if (isSendDay && !isSendTime) {
      results.actions.push(`Send day but not send time yet (current: ${currentTime}, scheduled: ${sendTime})`);
    } else {
      results.actions.push(`Not a send day (today: ${currentDay}, send days: ${JSON.stringify(sendDays)})`);
    }

    // Log activity
    try {
      if (results.actions.length > 0) {
        await base44.asServiceRole.entities.SystemActivityLog.create({
          actor_type: 'system',
          actor_name: 'scheduler',
          action_type: 'scheduled_check',
          action_description: `בדיקת תזמון הילה: ${results.actions.join(', ')}`,
          status: 'success',
          details: JSON.stringify(results)
        });
      }
    } catch (logErr) {
      console.warn('Failed to log:', logErr.message);
    }

    return Response.json(results);

  } catch (error) {
    console.error('Scheduled Hila process error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// Create draft function
async function createDraft(base44, settings) {
  try {
    // CRITICAL: Check if draft was already created today
    const now = new Date();
    // Get today's date boundaries in Israel timezone
    const israelDateParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Jerusalem',
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(now);
    const israelDateObj = Object.fromEntries(israelDateParts.map(p => [p.type, p.value]));
    // Build today's UTC boundaries based on Israel date
    const todayStart = new Date(`${israelDateObj.year}-${israelDateObj.month}-${israelDateObj.day}T00:00:00+03:00`);
    const todayEnd = new Date(`${israelDateObj.year}-${israelDateObj.month}-${israelDateObj.day}T23:59:59+03:00`);
    
    const todaysDraftCreations = await base44.asServiceRole.entities.HilaRunLog.filter({
      run_type: 'draft_creation',
      status: 'success',
      created_date: { $gte: todayStart.toISOString(), $lte: todayEnd.toISOString() }
    });
    
    if (todaysDraftCreations && todaysDraftCreations.length > 0) {
      console.log('🚫 Draft already created today - skipping to prevent duplicates');
      
      // 🚨 Send alert to admin about duplicate attempt
      try {
        const adminUsers = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
        for (const admin of adminUsers) {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: admin.email,
            subject: '🚨 התראת אבטחה: ניסיון יצירת טיוטה כפולה - הילה (עובדים)',
            body: `
⚠️ ניסיון חסום ליצור טיוטה כפולה זוהה ונחסם

פרטי הניסיון:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• תהליך: Scheduled Hila Process (אוטומטי)
• זמן: ${new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}
• סוג: יצירת טיוטה לעובדים

טיוטה אחרונה שנוצרה היום:
• זמן יצירה: ${new Date(todaysDraftCreations[0].created_date).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}

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
      
      return { success: false, reason: 'Draft already created today' };
    }
    
    // Get active jobs
    const allJobs = await base44.asServiceRole.entities.Job.list('-created_date', 100);
    const activeJobs = (Array.isArray(allJobs) ? allJobs : []).filter(j => {
      if (j.status !== 'פעילה') return false;
      if (j.do_not_publish === true) return false;
      if (!j.title || !j.description || !j.requirements || !j.location) return false;
      return true;
    });

    if (activeJobs.length === 0) {
      return { success: false, reason: 'No active complete jobs found' };
    }

    // Delete existing ready/pending_approval drafts to ensure only ONE draft exists
    const existingDrafts = await base44.asServiceRole.entities.HilaDraft.filter({ 
      status: { $in: ['ready', 'pending_approval'] }
    });
    for (const d of existingDrafts) {
      await base44.asServiceRole.entities.HilaDraft.delete(d.id);
    }

    const normalizeText = (text) => {
      if (!text) return '';
      return text.replace(/\n\s*\n+/g, '\n').replace(/\s+\n/g, '\n').trim();
    };

    const jobsList = activeJobs.map((job, index) => {
      const lines = [];
      lines.push(`<b>${index + 1}. 📌 ${job.title}</b>`);
      lines.push(`   🔢 מספר משרה: ${job.job_code || 'ללא מספר'}`);
      if (job.location) lines.push(`   📍 מיקום: ${normalizeText(job.location)}`);
      if (job.security_clearance) lines.push(`   🔐 סיווג ביטחוני: ${job.security_clearance}`);
      if (job.description) lines.push(`   📝 תיאור: ${normalizeText(job.description)}`);
      if (job.requirements) lines.push(`   ✅ דרישות: ${normalizeText(job.requirements)}`);
      return lines.join('\n');
    }).join('\n\n');

    const cvEmail = settings.cv_target_email || 'jobs@pandatech.co.il';
    const bonusText = settings.bonus_description || 'בונוס לעובד שמביא חבר';

    const emailBody = `היי כולם! 👋

מקווה שהשבוע שלכם מצוין!

רציתי לעדכן אתכם ב-${activeJobs.length} משרות חמות שנפתחו אצלנו.
אם מישהו מהמעגל שלכם מחפש שינוי או הזדמנות חדשה - זה המקום!

═══════════════════════════════════════

${jobsList}

═══════════════════════════════════════

📧 קורות חיים? שלחו אלינו: ${cvEmail}
(אל תשכחו לציין את מספר המשרה!)

💰 תוכנית "חבר מביא חבר":
${bonusText}
המלצה טובה משתלמת לכולם!

אשמח לכל הפניה או שאלה.

בברכה,
הילה 💜
מצוות הגיוס

`;

    const emailSubject = `📋 ${activeJobs.length} משרות פתוחות - עדכון שבועי`;

    const draft = await base44.asServiceRole.entities.HilaDraft.create({
      subject: emailSubject,
      body: emailBody,
      jobs_count: activeJobs.length,
      status: 'ready',
      scheduled_send_time: new Date().toISOString()
    });

    // Log to HilaRunLog
    await base44.asServiceRole.entities.HilaRunLog.create({
      run_type: 'draft_creation',
      status: 'success',
      jobs_count: activeJobs.length,
      details: JSON.stringify({ draftId: draft.id })
    });

    return { success: true, draftId: draft.id, jobsCount: activeJobs.length };
  } catch (error) {
    // Log failure
    try {
      await base44.asServiceRole.entities.HilaRunLog.create({
        run_type: 'draft_creation',
        status: 'failed',
        error_message: error.message
      });
    } catch (logErr) {
      console.warn('Failed to log error:', logErr.message);
    }
    return { success: false, error: error.message };
  }
}

// Send email function
async function sendEmail(base44, settings, draft) {
  try {
    if (!settings.distribution_list_email) {
      return { success: false, reason: 'No distribution list configured' };
    }

    // Convert to HTML
    const convertToHtml = (text) => {
      if (!text) return '';
      let normalized = text.replace(/\n{3,}/g, '\n\n');
      let html = normalized
        .replace(/\n\n/g, '</p><p style="margin-bottom: 15px;">')
        .replace(/\n/g, '<br/>');
      return `<div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.8;"><p style="margin-bottom: 15px;">${html}</p></div>`;
    };

    await base44.asServiceRole.functions.invoke('sendHilaEmail', {
      to: settings.distribution_list_email,
      subject: draft.subject,
      body: convertToHtml(draft.body),
      from_name: 'הילה - צוות גיוס PandaTech'
    });

    // Mark draft as sent
    await base44.asServiceRole.entities.HilaDraft.update(draft.id, {
      status: 'sent',
      sent_date: new Date().toISOString()
    });

    // Update schedule
    await base44.asServiceRole.entities.HilaSchedule.update(settings.id, {
      last_run_time: new Date().toISOString(),
      last_run_status: 'success'
    });

    // Log activity
    await base44.asServiceRole.entities.SystemActivityLog.create({
      actor_type: 'agent',
      actor_name: 'hila',
      actor_image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=40&h=40&fit=crop&crop=face',
      action_type: 'email_sent',
      action_description: `הילה שלחה מייל משרות לעובדים (אוטומטי)`,
      status: 'success'
    });

    await base44.asServiceRole.entities.HilaRunLog.create({
      run_type: 'email_send',
      status: 'success',
      jobs_count: draft.jobs_count,
      emails_sent_to: settings.distribution_list_email
    });

    return { success: true, sentTo: settings.distribution_list_email };
  } catch (error) {
    // Log failure
    try {
      await base44.asServiceRole.entities.HilaRunLog.create({
        run_type: 'email_send',
        status: 'failed',
        error_message: error.message
      });
    } catch (logErr) {
      console.warn('Failed to log error:', logErr.message);
    }
    return { success: false, error: error.message };
  }
}