import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

// Helper function to send email via Resend API
async function sendEmailViaResend({ to, subject, body, from_name }) {
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY not configured');
  }

  // Parse multiple email addresses (semicolon or comma separated)
  const emailList = to.split(/[;,]/).map(e => e.trim()).filter(e => e.includes('@'));
  
  const emailPayload = {
    from: `${from_name} <noreply@pandatech.co.il>`,
    to: emailList,
    subject: subject,
    html: body
  };

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(emailPayload)
  });

  const result = await response.json();

  if (!response.ok) {
    console.error('Resend API error:', result);
    throw new Error(result.message || 'Failed to send email via Resend');
  }

  console.log(`Email sent successfully via Resend to ${emailList.join(', ')}, ID: ${result.id}`);
  return result;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    let targetEmail = null;
    let isTest = false;
    try {
      const body = await req.json();
      targetEmail = body.targetEmail;
      isTest = body.isTest || false;
    } catch (e) {
      // No body or invalid JSON
    }

    // CRITICAL: Prevent duplicate sends to candidates - check if sent TODAY
    if (!isTest) {
      const now = new Date();
      const israelNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
      const todayStart = new Date(israelNow);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(todayStart);
      todayEnd.setHours(23, 59, 59, 999);
      
      const todaysCandidateSends = await base44.asServiceRole.entities.HilaRunLog.filter({
        audience_type: 'candidates',
        run_type: 'email_send',
        status: 'success',
        created_date: { $gte: todayStart.toISOString(), $lte: todayEnd.toISOString() }
      });
      
      if (todaysCandidateSends && todaysCandidateSends.length > 0) {
        console.log('🚫 BLOCKED: Email already sent to candidates today - preventing duplicate');
        
        await base44.asServiceRole.entities.HilaRunLog.create({
          audience_type: 'candidates',
          run_type: 'email_send',
          status: 'blocked',
          error_message: 'מייל למועמדים כבר נשלח היום - חסימה למניעת כפילות',
          candidates_sent: 0,
          candidates_skipped: 0
        });
        
        // 🚨 CRITICAL: Send alert to admin about duplicate attempt
        try {
          const adminUsers = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
          for (const admin of adminUsers) {
            await base44.integrations.Core.SendEmail({
              to: admin.email,
              subject: '🚨 התראת אבטחה: ניסיון שליחת מייל כפול - הילה (מועמדים)',
              body: `
⚠️ ניסיון חסום לשליחת מייל כפול זוהה ונחסם

פרטי הניסיון:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• משתמש: ${user.full_name} (${user.email})
• זמן: ${new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}
• סוג: מייל למועמדים
• מצב: ${isTest ? 'מבחן' : 'ייצור'}
• נמענים: ${targetEmail || 'רשימת תפוצה מלאה'}

מייל אחרון שנשלח היום:
• זמן שליחה: ${new Date(todaysCandidateSends[0].created_date).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}

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
          error: 'מייל למועמדים כבר נשלח היום - חסימה למניעת כפילות'
        }, { status: 409 });
      }
    }

    // Get Hila settings
    const schedules = await base44.entities.HilaSchedule.list('-updated_date', 1);
    if (!schedules || schedules.length === 0) {
      return Response.json({ error: 'לא נמצאו הגדרות להילה' }, { status: 400 });
    }
    const settings = schedules[0];

    // Get ready draft for candidates
    const readyDrafts = await base44.asServiceRole.entities.HilaDraft.filter({ 
      audience_type: 'candidates',
      status: 'ready' 
    }, '-created_date', 1);
    
    if (!readyDrafts || readyDrafts.length === 0) {
      return Response.json({ error: 'אין טיוטה מוכנה לשליחה למועמדים' }, { status: 400 });
    }

    const draft = readyDrafts[0];

    // Determine target emails
    const emailsToSend = targetEmail || draft.candidate_emails || settings.candidate_distribution_email;
    if (!emailsToSend) {
      return Response.json({ error: 'לא נמצאו כתובות מייל לשליחה' }, { status: 400 });
    }

    // Process and filter candidate emails
    const parseEmails = (input) => {
      if (!input) return [];
      return input.split(/[;,]/).map(e => e.trim()).filter(e => e.includes('@'));
    };

    let candidateEmails = parseEmails(emailsToSend);
    
    // Filter out unsubscribed candidates
    if (!isTest) {
      const mailLogs = await base44.asServiceRole.entities.HilaMailLog.list();
      const unsubscribedEmails = new Set(
        mailLogs.filter(log => log.unsubscribed).map(log => log.candidate_email?.toLowerCase())
      );
      
      const beforeFilter = candidateEmails.length;
      candidateEmails = candidateEmails.filter(email => !unsubscribedEmails.has(email.toLowerCase()));
      const skippedCount = beforeFilter - candidateEmails.length;
      
      console.log(`Filtered ${skippedCount} unsubscribed candidates`);
    }

    if (candidateEmails.length === 0) {
      return Response.json({ 
        success: false, 
        message: 'אין מועמדים זמינים לשליחה (כולם ביטלו מנוי)' 
      });
    }

    const emailToSend = candidateEmails.join('; ');

    // Process draft body to add personalized unsubscribe links for each candidate
    // We'll send individual emails instead of one bulk email to support personalized unsubscribe
    const candidateEmailsList = candidateEmails;
    let successCount = 0;
    let failCount = 0;

    const emailSubject = isTest 
      ? `[בדיקה] ${draft.subject}`
      : draft.subject;

    // Send individual emails to each candidate with personalized unsubscribe link
    for (const candidateEmail of candidateEmailsList) {
      try {
        // Create personalized email body with candidate-specific unsubscribe link
        const appUrl = (Deno.env.get('BASE44_APP_URL') || 'https://pandahrai.base44.app').replace(/\/$/, '');
        const unsubscribeUrl = `${appUrl}/#/Unsubscribe?email=${encodeURIComponent(candidateEmail)}`;
        const personalizedBody = draft.body.replace(
          /{UNSUBSCRIBE_LINK}/g,
          unsubscribeUrl
        );

        // Send via Resend
        await sendEmailViaResend({
          to: candidateEmail,
          subject: emailSubject,
          body: personalizedBody,
          from_name: 'הילה - צוות גיוס PandaTech'
        });

        // Create mail log entry for tracking
        if (!isTest) {
          try {
            await base44.asServiceRole.entities.HilaMailLog.create({
              candidate_email: candidateEmail,
              candidate_id: candidates.find(c => c.email?.toLowerCase() === candidateEmail.toLowerCase())?.id || null,
              candidate_name: candidates.find(c => c.email?.toLowerCase() === candidateEmail.toLowerCase())?.full_name || candidateEmail,
              job_id: 'bulk_distribution',
              job_title: `${draft.jobs_count} משרות - תפוצה קבועה`,
              delivery_status: 'sent',
              status_at_send: candidates.find(c => c.email?.toLowerCase() === candidateEmail.toLowerCase())?.status || 'לא ידוע',
              cv_link_clicked: false,
              website_clicked: false,
              unsubscribed: false
            });
          } catch (logErr) {
            console.warn(`Failed to create mail log for ${candidateEmail}:`, logErr.message);
          }
        }

        successCount++;
        console.log(`✅ Email sent to ${candidateEmail}`);
      } catch (emailError) {
        failCount++;
        console.error(`❌ Failed to send to ${candidateEmail}:`, emailError.message);
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`📊 Sending completed: ${successCount} sent, ${failCount} failed`);

    // Update draft status
    if (!isTest) {
      await base44.asServiceRole.entities.HilaDraft.update(draft.id, {
        status: 'sent',
        sent_date: new Date().toISOString()
      });
    }

    // Log success
    try {
      await base44.entities.HilaRunLog.create({
        audience_type: 'candidates',
        run_type: isTest ? 'test_send' : 'email_send',
        status: successCount > 0 ? 'success' : 'failed',
        jobs_count: draft.jobs_count || 0,
        candidates_sent: successCount,
        candidates_skipped: isTest ? 0 : (parseEmails(emailsToSend).length - candidateEmails.length),
        details: JSON.stringify({ isTest, draftId: draft.id, successCount, failCount })
      });

      await base44.entities.SystemActivityLog.create({
        actor_type: 'agent',
        actor_name: 'hila',
        actor_image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=40&h=40&fit=crop&crop=face',
        action_type: 'email_sent',
        action_description: isTest 
          ? `הילה שלחה מייל בדיקה למועמדים: ${draft.jobs_count} משרות`
          : `הילה שלחה מייל למועמדים: ${draft.jobs_count} משרות ל-${candidateEmails.length} מועמדים`,
        status: 'success',
        details: JSON.stringify({ 
          jobsCount: draft.jobs_count, 
          candidatesCount: candidateEmails.length,
          isTest 
        })
      });
    } catch (logErr) {
      console.warn('Failed to log activity:', logErr.message);
    }

    return Response.json({ 
      success: successCount > 0,
      candidatesSent: successCount,
      candidatesFailed: failCount,
      candidatesSkipped: parseEmails(emailsToSend).length - candidateEmails.length,
      isTest
    });

  } catch (error) {
    console.error('Error sending Hila candidate email:', error);
    
    try {
      const base44 = createClientFromRequest(req);
      await base44.entities.HilaRunLog.create({
        audience_type: 'candidates',
        run_type: 'email_send',
        status: 'failed',
        error_message: error.message
      });
    } catch (logErr) {
      console.warn('Failed to log error:', logErr.message);
    }
    
    return Response.json({ error: error.message }, { status: 500 });
  }
});