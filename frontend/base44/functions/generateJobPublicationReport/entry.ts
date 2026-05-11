import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    // Parse request body to check for preview mode and target email
    const body = await req.json().catch(() => ({}));
    const previewMode = body.preview_mode === true;
    const targetEmail = body.target_email || 'Office@pandatech.co.il';
    const isTest = body.is_test === true;

    // Get all active jobs
    const allJobs = await base44.asServiceRole.entities.Job.filter({ status: 'פעילה' });

    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    console.log(`Total active jobs: ${allJobs.length}`);

    // Analyze each job by querying its matches directly
    // Querying per-job avoids pagination issues where Match.list() only returns
    // the most recent N matches, missing older matches for jobs that haven't gotten
    // new candidates recently (exactly the jobs that need publication).
    const jobsAnalysis = [];

    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    for (const job of allJobs) {
      const jobId = job.id;

      await delay(300);

      // Query matches for this specific job
      const jobMatchesRaw = await base44.asServiceRole.entities.Match.filter({ job_id: jobId });
      const jobMatches = Array.isArray(jobMatchesRaw) ? jobMatchesRaw : [];

      // Split into active (not rejected) and rejected quality matches (score 70+)
      const allQualityMatches = jobMatches.filter(m => {
        const score = m.match_score ?? m.data?.match_score;
        return score != null && Number(score) >= 70;
      });

      // IMPROVED: exclude matches that were rejected by the recruiter
      // is_rejected_feedback = true means the recruiter marked this candidate as "not suitable" for this job
      const activeQualityMatches = allQualityMatches.filter(m => !m.is_rejected_feedback);
      const rejectedQualityMatches = allQualityMatches.length - activeQualityMatches.length;

      // New ACTIVE quality matches added in the last 2 weeks (extended from 1 week)
      const newActiveMatchesTwoWeeks = activeQualityMatches.filter(m => {
        const createdDate = m.created_date || m.data?.created_date;
        if (!createdDate) return false;
        return new Date(createdDate) >= twoWeeksAgo;
      });

      console.log(`Job ${job.job_code} (${job.title}): ${activeQualityMatches.length} active quality matches, ${rejectedQualityMatches} rejected, ${newActiveMatchesTwoWeeks.length} new in 2 weeks`);

      // IMPROVED publication criteria (3 tiers):
      //
      // HIGH priority: 0 active quality matches
      // MEDIUM priority: 1–4 active quality matches (not enough pipeline)
      // LOW priority: 5–9 active quality matches but no new ones in the last 2 weeks (stale pipeline)
      //
      // Threshold raised from 3→5 for "few candidates", and window extended from 1 week→2 weeks
      const noActiveCandidates = activeQualityMatches.length === 0;
      const tooFewCandidates = activeQualityMatches.length > 0 && activeQualityMatches.length < 5;
      const stalePipeline = activeQualityMatches.length >= 5 && activeQualityMatches.length < 10 && newActiveMatchesTwoWeeks.length === 0;
      const needsPublication = noActiveCandidates || tooFewCandidates || stalePipeline;

      if (needsPublication) {
        // Build explicit reason
        let reason = '';
        let priority = 'low';

        if (noActiveCandidates) {
          priority = 'high';
          if (rejectedQualityMatches > 0) {
            reason = `אין מועמדים פעילים (${rejectedQualityMatches} נדחו בעבר) — נדרש גיוס מועמדים חדשים`;
          } else {
            reason = 'אין מועמדים איכותיים (ציון 70%+) במערכת למשרה זו';
          }
        } else if (tooFewCandidates) {
          priority = 'medium';
          const rejNote = rejectedQualityMatches > 0 ? ` (${rejectedQualityMatches} נוספים נדחו בעבר)` : '';
          reason = `יש רק ${activeQualityMatches.length} מועמד${activeQualityMatches.length !== 1 ? 'ים' : ''} פעיל${activeQualityMatches.length !== 1 ? 'ים' : ''}${rejNote} — צינור המועמדים דל מדי`;
        } else {
          // stalePipeline
          priority = 'low';
          reason = `יש ${activeQualityMatches.length} מועמדים פעילים אך לא נוספו מועמדים חדשים בשבועיים האחרונים — הצינור מתיישן`;
        }

        jobsAnalysis.push({
          job,
          totalMatches: activeQualityMatches.length,
          rejectedMatches: rejectedQualityMatches,
          newMatchesThisWeek: newActiveMatchesTwoWeeks.length,
          priority,
          reason
        });
      }
    }

    // Sort: high → medium → low, then by fewest active matches
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    jobsAnalysis.sort((a, b) => {
      const pDiff = (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
      if (pDiff !== 0) return pDiff;
      return a.totalMatches - b.totalMatches;
    });

    // Take top 10
    const top10Jobs = jobsAnalysis.slice(0, 10);

    if (top10Jobs.length === 0) {
      return Response.json({
        success: true,
        message: 'לא נמצאו משרות הזקוקות לפרסום השבוע',
        jobs_count: 0
      });
    }

    // Generate email content
    const emailBody = generateEmailHTML(top10Jobs);

    // If preview mode, just return the HTML
    if (previewMode) {
      return Response.json({
        success: true,
        preview: true,
        html: emailBody,
        jobs_count: top10Jobs.length,
        jobs: top10Jobs.map(item => ({
          title: item.job.title,
          code: item.job.job_code,
          totalMatches: item.totalMatches,
          newMatches: item.newMatchesThisWeek,
          reason: item.reason
        }))
      });
    }

    // Send email via Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    const emailSubject = isTest
      ? `[בדיקה] דוח משרות לפרסום - ${top10Jobs.length} משרות מומלצות`
      : `דוח שבועי - ${top10Jobs.length} משרות מומלצות לפרסום באתרי דרושים`;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'הילה - משרות לפרסום <jobs@pandatech.co.il>',
        to: targetEmail,
        subject: emailSubject,
        html: emailBody,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      throw new Error(`Resend API error: ${JSON.stringify(resendData)}`);
    }

    // Log the email
    await base44.asServiceRole.entities.EmailLog.create({
      to: targetEmail,
      subject: emailSubject,
      from_name: 'הילה - משרות לפרסום',
      from_email: 'jobs@pandatech.co.il',
      status: 'sent',
      resend_message_id: resendData.id,
      sent_by_user_id: 'hila_agent',
      sent_by_user_name: 'הילה (סוכן AI)',
      source: 'agent',
      related_entity_type: 'JobPublicationReport',
      related_entity_id: new Date().toISOString(),
      is_test: isTest
    });

    // Log system activity
    await base44.asServiceRole.entities.SystemActivityLog.create({
      actor_type: 'agent',
      actor_name: 'הילה',
      actor_image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop&crop=face',
      action_type: 'email_sent',
      action_description: `דוח שבועי - ${top10Jobs.length} משרות מומלצות לפרסום נשלח למשרד`,
      entity_type: 'Job',
      status: 'success',
      details: JSON.stringify({ jobs_count: top10Jobs.length, recipient: targetEmail })
    });

    return Response.json({
      success: true,
      message: `דוח ${isTest ? 'בדיקה' : 'פרסום'} נשלח בהצלחה - ${top10Jobs.length} משרות`,
      jobs_sent: top10Jobs.length,
      email_id: resendData.id,
      sent_to: targetEmail
    });

  } catch (error) {
    console.error('Error generating job publication report:', error);

    // Try to log the error
    try {
      const base44 = createClientFromRequest(req);
      await base44.asServiceRole.entities.SystemActivityLog.create({
        actor_type: 'agent',
        actor_name: 'הילה',
        action_type: 'email_sent',
        action_description: 'כישלון בשליחת דוח פרסום שבועי',
        status: 'failed',
        error_message: error.message
      });
    } catch (logError) {
      console.error('Error logging failure:', logError);
    }

    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});

function generateEmailHTML(jobsData) {
  const jobsHTML = jobsData.map((item, index) => {
    const job = item.job;
    const priorityBadge = item.priority === 'high'
      ? '<span style="background: #DC2626; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">⚡ עדיפות גבוהה</span>'
      : item.priority === 'medium'
        ? '<span style="background: #F59E0B; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">🔶 עדיפות בינונית</span>'
        : '<span style="background: #6B7280; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">🔵 עדיפות נמוכה</span>';

    return `
      <div style="background: white; border: 2px solid #E5E7EB; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
          <h3 style="color: #1F2937; font-size: 18px; font-weight: bold; margin: 0;">
            ${index + 1}. ${job.title || 'ללא כותרת'}
          </h3>
          ${priorityBadge}
        </div>

        <div style="background: #F3F4F6; padding: 12px; border-radius: 8px; margin-bottom: 12px;">
          <div style="color: #6B7280; font-size: 13px; margin-bottom: 8px;">
            <strong>קוד משרה:</strong> ${job.job_code || 'לא מוגדר'}
          </div>
          <div style="color: #6B7280; font-size: 13px; margin-bottom: 8px;">
            <strong>לקוח:</strong> ${job.client_name || 'לא מוגדר'}
          </div>
          <div style="color: #6B7280; font-size: 13px; margin-bottom: 8px;">
            <strong>מיקום:</strong> ${job.location || 'לא מוגדר'}
          </div>
          <div style="color: #6B7280; font-size: 13px; margin-bottom: 8px;">
            <strong>סיווג ביטחוני:</strong> ${job.security_clearance || 'ללא'}
          </div>
          ${job.recruitment_priority ? `
          <div style="color: #6B7280; font-size: 13px;">
            <strong>עדיפות גיוס:</strong> ${job.recruitment_priority}
          </div>
          ` : ''}
        </div>

        <div style="margin-bottom: 12px;">
          <div style="color: #374151; font-size: 14px; font-weight: 600; margin-bottom: 6px;">תיאור המשרה:</div>
          <div style="color: #4B5563; font-size: 13px; white-space: pre-wrap; line-height: 1.6;">
            ${job.description || 'אין תיאור'}
          </div>
        </div>

        <div style="margin-bottom: 12px;">
          <div style="color: #374151; font-size: 14px; font-weight: 600; margin-bottom: 6px;">דרישות:</div>
          <div style="color: #4B5563; font-size: 13px; white-space: pre-wrap; line-height: 1.6;">
            ${job.requirements || 'אין דרישות'}
          </div>
        </div>

        <div style="background: #FEF3C7; border-right: 4px solid #F59E0B; padding: 10px; border-radius: 6px;">
          <div style="color: #92400E; font-size: 13px; font-weight: 600; margin-bottom: 6px;">
            📊 סטטיסטיקת מועמדים
          </div>
          <div style="color: #78350F; font-size: 12px; margin-bottom: 8px;">
            <strong>🎯 סיבת הבחירה לפרסום:</strong> ${item.reason}
          </div>
          <div style="color: #78350F; font-size: 12px;">
            • מועמדים פעילים איכותיים (70%+): <strong>${item.totalMatches}</strong><br>
            • מועמדים שנדחו בעבר: <strong>${item.rejectedMatches || 0}</strong><br>
            • מועמדים חדשים (שבועיים אחרונים): <strong>${item.newMatchesThisWeek}</strong>
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="he">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #F9FAFB; margin: 0; padding: 20px;">
      <div style="max-width: 800px; margin: 0 auto; background: white; border-radius: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden;">

        <!-- Header -->
        <div style="background: linear-gradient(135deg, #EC4899 0%, #DB2777 100%); padding: 30px; text-align: center;">
          <div style="display: inline-block; width: 60px; height: 60px; background: white; border-radius: 50%; margin-bottom: 12px; display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 30px;">📢</span>
          </div>
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">
            דוח שבועי - משרות לפרסום
          </h1>
          <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 16px;">
            מאת הילה - סוכנת הפצת משרות
          </p>
        </div>

        <!-- Content -->
        <div style="padding: 30px;">
          <div style="background: #DBEAFE; border-right: 4px solid #3B82F6; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
            <p style="color: #1E40AF; margin: 0; font-size: 14px; line-height: 1.6;">
              <strong>שלום,</strong><br><br>
              זוהו <strong>${jobsData.length} משרות</strong> שזקוקות לפרסום באתרי דרושים השבוע.<br>
              המשרות נבחרו על בסיס מחסור במועמדים איכותיים (ציון 70%+) או היעדר מועמדים חדשים בשבוע האחרון.
            </p>
          </div>

          <h2 style="color: #1F2937; font-size: 20px; margin-bottom: 20px; border-bottom: 2px solid #E5E7EB; padding-bottom: 10px;">
            📋 משרות מומלצות לפרסום
          </h2>

          ${jobsHTML}

          <!-- Footer -->
          <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin-top: 24px; text-align: center;">
            <p style="color: #6B7280; margin: 0; font-size: 13px;">
              דוח זה נוצר אוטומטית על ידי הילה - סוכנת AI להפצת משרות<br>
              <strong>תאריך:</strong> ${new Date().toLocaleDateString('he-IL', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}