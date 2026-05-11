import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { preview_mode = false, target_email = null } = await req.json();

    // Get settings
    const schedules = await base44.asServiceRole.entities.CarmitSchedule.list('-updated_date', 1);
    const settings = schedules?.[0] || { daily_summary_email: 'avishai@pandatech.co.il' };
    const recipientEmail = target_email || settings.daily_summary_email;

    // Calculate 24 hours ago in UTC (not local time)
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    console.log('Current time (UTC):', now.toISOString());
    console.log('24 hours ago (UTC):', twentyFourHoursAgo.toISOString());

    // Collect data for summary - load all and filter in memory (more reliable)
    const [allMatches, allRotemTasksData, allJobsData, allCandidatesData, allActiveJobs] = await Promise.all([
      base44.asServiceRole.entities.Match.list('-created_date', 200),
      base44.asServiceRole.entities.RotemTask.list('-created_date', 200),
      base44.asServiceRole.entities.Job.list('-updated_date', 200),
      base44.asServiceRole.entities.Candidate.list('-created_date', 200),
      base44.asServiceRole.entities.Job.filter({ status: 'פעילה' })
    ]);
    
    console.log('Loaded data - matches:', allMatches.length, 'tasks:', allRotemTasksData.length, 'jobs:', allJobsData.length, 'candidates:', allCandidatesData.length);
    
    // Filter in memory for last 24 hours - include BOTH created AND reviewed matches
    const matches = allMatches.filter(m => 
      new Date(m.created_date) >= twentyFourHoursAgo || 
      (m.carmit_reviewed_date && new Date(m.carmit_reviewed_date) >= twentyFourHoursAgo)
    );
    const rotemTasks = allRotemTasksData.filter(t => new Date(t.created_date) >= twentyFourHoursAgo);
    const jobs = allJobsData.filter(j => new Date(j.updated_date) >= twentyFourHoursAgo);
    const newCandidates = allCandidatesData.filter(c => new Date(c.created_date) >= twentyFourHoursAgo);
    const newJobs = allJobsData.filter(j => new Date(j.created_date) >= twentyFourHoursAgo);
    const allRotemTasks = allRotemTasksData.filter(t => 
      !['הסתיים', 'הסתיים מוצלח', 'לא ליצור קשר', 'התערבות- לא להתקשר'].includes(t.status)
    );
    
    console.log('Filtered for last 24h - matches:', matches.length, 'tasks:', rotemTasks.length, 'jobs:', jobs.length, 'candidates:', newCandidates.length, 'new jobs:', newJobs.length);

    // Group matches by agent - match both by source field AND user_name field
    const agentGroups = {
      naama: { name: 'נעמה - מומחית תוכנה', matches: [] },
      alik: { name: 'אליק - מומחה אלקטרוניקה', matches: [] },
      itay: { name: 'איתי - מומחה IT', matches: [] },
      lior: { name: 'ליאור - מומחה הנדסת מערכת', matches: [] },
      ofir: { name: 'אופיר - מומחה הנדסת מכונות', matches: [] },
      gc: { name: 'GC - סוכן כללי', matches: [] },
      rami: { name: 'רמי - מומחה רמה 1', matches: [] },
      meni: { name: 'מני - סוכן יצירתי', matches: [] }
    };

    matches.forEach(match => {
      // Try to determine agent from source field or user_name field
      let agentKey = match.source?.toLowerCase();

      // If no source, try to extract from user_name
      if (!agentKey && match.user_name) {
        const userName = match.user_name.toLowerCase();
        if (userName.includes('נעמה')) agentKey = 'naama';
        else if (userName.includes('אליק')) agentKey = 'alik';
        else if (userName.includes('איתי')) agentKey = 'itay';
        else if (userName.includes('ליאור')) agentKey = 'lior';
        else if (userName.includes('אופיר')) agentKey = 'ofir';
        else if (userName.includes('gc')) agentKey = 'gc';
        else if (userName.includes('רמי')) agentKey = 'rami';
        else if (userName.includes('מני')) agentKey = 'meni';
      }

      if (agentKey && agentGroups[agentKey]) {
        agentGroups[agentKey].matches.push(match);
      }
    });

    // Calculate agent completion percentages
    const agentStats = Object.entries(agentGroups).map(([agentKey, data]) => {
      const agentTasks = allRotemTasks.filter(t => t.source === agentKey);
      const total = agentTasks.length;
      const completed = agentTasks.filter(t => 
        t.status === 'הסתיים' || t.status === 'הסתיים מוצלח'
      ).length;
      const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
      
      return {
        name: data.name,
        total,
        completed,
        percentage
      };
    }).filter(stat => stat.total > 0);

    // Build HTML email
    const agentSections = Object.entries(agentGroups)
      .filter(([_, data]) => data.matches.length > 0)
      .map(([agentKey, data]) => {
        const matchList = data.matches
          .map(m => `<li style="margin-bottom: 8px;"><strong>${m.candidate_name}</strong> → ${m.job_title} (ציון: ${m.match_score || 'N/A'})</li>`)
          .join('');
        
        return `
          <div style="margin-bottom: 24px; padding: 16px; background: #f9fafb; border-radius: 8px; border-right: 4px solid #8b5cf6;">
            <h3 style="color: #8b5cf6; font-size: 16px; margin-bottom: 12px; font-weight: 600;">
              ${data.name}
            </h3>
            <p style="color: #6b7280; margin-bottom: 8px;">
              <strong>סה״כ התאמות:</strong> ${data.matches.length}
            </p>
            <ul style="margin: 0; padding-right: 20px; color: #374151;">
              ${matchList}
            </ul>
          </div>
        `;
      }).join('');

    const rotemTasksList = rotemTasks.length > 0
      ? rotemTasks.map(t => `<li style="margin-bottom: 8px;"><strong>${t.candidate_name}</strong> → ${t.job_title}</li>`).join('')
      : '<li style="color: #9ca3af;">לא נמצאו משימות חדשות</li>';

    const jobsList = jobs.length > 0
      ? jobs.slice(0, 10).map(j => `<li style="margin-bottom: 8px;"><strong>${j.job_code || 'N/A'}</strong> - ${j.title}</li>`).join('')
      : '<li style="color: #9ca3af;">לא נמצאו עדכוני משרות</li>';

    const totalMatches = matches.length;
    const totalRotemTasks = rotemTasks.length;
    const totalJobsUpdated = jobs.length;
    const totalNewCandidates = newCandidates.length;
    const totalNewJobs = newJobs.length;
    const totalActiveJobs = allActiveJobs.length;

    // Build new jobs list
    const newJobsList = newJobs.length > 0
      ? newJobs.map(j => `<li style="margin-bottom: 8px;"><strong>${j.job_code || 'N/A'}</strong> - ${j.title} (${j.client_name || 'ללא לקוח'})</li>`).join('')
      : '<li style="color: #9ca3af;">לא נוספו משרות חדשות</li>';

    // Build agent stats section
    const agentStatsSection = agentStats.length > 0
      ? agentStats.map(stat => `
        <div style="margin-bottom: 12px; padding: 12px; background: white; border-radius: 6px; border: 1px solid #e5e7eb;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <strong style="color: #374151;">${stat.name}</strong>
            <span style="font-size: 18px; font-weight: 700; color: ${stat.percentage >= 70 ? '#16a34a' : stat.percentage >= 40 ? '#d97706' : '#dc2626'};">
              ${stat.percentage}%
            </span>
          </div>
          <div style="font-size: 12px; color: #6b7280;">
            ${stat.completed} מתוך ${stat.total} משימות הושלמו
          </div>
          <div style="margin-top: 6px; height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden;">
            <div style="height: 100%; background: ${stat.percentage >= 70 ? '#16a34a' : stat.percentage >= 40 ? '#d97706' : '#dc2626'}; width: ${stat.percentage}%; transition: width 0.3s;"></div>
          </div>
        </div>
      `).join('')
      : '<p style="color: #9ca3af; text-align: center;">אין נתונים זמינים</p>';

    const htmlBody = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>סיכום יומי - כרמית</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px;">
  <div style="max-width: 800px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%); padding: 32px; text-align: center; color: white;">
      <h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 700;">סיכום יומי - כרמית</h1>
      <p style="margin: 0; font-size: 14px; opacity: 0.9;">
        ${new Date().toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </p>
    </div>

    <!-- Content -->
    <div style="padding: 32px;">
      
      <!-- Summary Stats -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px;">
        <div style="text-align: center; padding: 14px; background: #f0fdf4; border-radius: 8px; border: 1px solid #86efac;">
          <div style="font-size: 28px; font-weight: 700; color: #16a34a;">${totalMatches}</div>
          <div style="font-size: 11px; color: #166534; margin-top: 4px;">התאמות חדשות</div>
        </div>
        <div style="text-align: center; padding: 14px; background: #fef3c7; border-radius: 8px; border: 1px solid #fcd34d;">
          <div style="font-size: 28px; font-weight: 700; color: #d97706;">${totalRotemTasks}</div>
          <div style="font-size: 11px; color: #92400e; margin-top: 4px;">הועבר לטל</div>
        </div>
        <div style="text-align: center; padding: 14px; background: #dbeafe; border-radius: 8px; border: 1px solid #93c5fd;">
          <div style="font-size: 28px; font-weight: 700; color: #2563eb;">${totalJobsUpdated}</div>
          <div style="font-size: 11px; color: #1e40af; margin-top: 4px;">משרות עודכנו</div>
        </div>
      </div>

      <!-- New Daily Stats -->
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 32px;">
        <div style="text-align: center; padding: 14px; background: #fce7f3; border-radius: 8px; border: 1px solid #f9a8d4;">
          <div style="font-size: 28px; font-weight: 700; color: #db2777;">${totalNewCandidates}</div>
          <div style="font-size: 11px; color: #9f1239; margin-top: 4px;">מועמדים חדשים היום</div>
        </div>
        <div style="text-align: center; padding: 14px; background: #e0e7ff; border-radius: 8px; border: 1px solid #a5b4fc;">
          <div style="font-size: 28px; font-weight: 700; color: #4f46e5;">${totalNewJobs}</div>
          <div style="font-size: 11px; color: #3730a3; margin-top: 4px;">משרות חדשות היום</div>
        </div>
      </div>

      <!-- Active Jobs Overview -->
      <div style="margin-bottom: 32px; padding: 16px; background: #fffbeb; border-radius: 8px; border: 1px solid #fcd34d; text-align: center;">
        <div style="font-size: 36px; font-weight: 700; color: #d97706;">${totalActiveJobs}</div>
        <div style="font-size: 13px; color: #92400e; margin-top: 4px;">סה״כ משרות פעילות לטיפול</div>
      </div>

      <!-- Agents Section -->
      <div style="margin-bottom: 32px;">
        <h2 style="color: #1f2937; font-size: 20px; margin-bottom: 16px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
          📊 התאמות לפי סוכנים
        </h2>
        ${agentSections || '<p style="color: #9ca3af; text-align: center; padding: 16px;">לא נוצרו התאמות חדשות ב-24 שעות האחרונות</p>'}
      </div>

      <!-- Rotem Tasks Section -->
      <div style="margin-bottom: 32px;">
        <h2 style="color: #1f2937; font-size: 20px; margin-bottom: 16px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
          📞 התאמות שהועברו לטל לטיפול
        </h2>
        <div style="padding: 16px; background: #fef3c7; border-radius: 8px; border-right: 4px solid #f59e0b;">
          <p style="color: #78350f; margin-bottom: 8px;">
            <strong>סה״כ משימות חדשות:</strong> ${totalRotemTasks}
          </p>
          <ul style="margin: 0; padding-right: 20px; color: #78350f;">
            ${rotemTasksList}
          </ul>
        </div>
      </div>

      <!-- New Jobs Section -->
      <div style="margin-bottom: 32px;">
        <h2 style="color: #1f2937; font-size: 20px; margin-bottom: 16px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
          ✨ משרות חדשות שהגיעו היום
        </h2>
        <div style="padding: 16px; background: #e0e7ff; border-radius: 8px; border-right: 4px solid #4f46e5;">
          <p style="color: #3730a3; margin-bottom: 8px;">
            <strong>סה״כ משרות חדשות:</strong> ${totalNewJobs}
          </p>
          <ul style="margin: 0; padding-right: 20px; color: #3730a3;">
            ${newJobsList}
          </ul>
        </div>
      </div>

      <!-- Agent Completion Stats -->
      <div style="margin-bottom: 32px;">
        <h2 style="color: #1f2937; font-size: 20px; margin-bottom: 16px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
          📈 אחוזי טיפול - סוכני גיוס
        </h2>
        <div style="padding: 16px; background: #f9fafb; border-radius: 8px;">
          ${agentStatsSection}
        </div>
      </div>

      <!-- Jobs Section -->
      <div style="margin-bottom: 32px;">
        <h2 style="color: #1f2937; font-size: 20px; margin-bottom: 16px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
          💼 משרות שטופלו (עד 10 אחרונות)
        </h2>
        <div style="padding: 16px; background: #dbeafe; border-radius: 8px; border-right: 4px solid #3b82f6;">
          <p style="color: #1e40af; margin-bottom: 8px;">
            <strong>סה״כ משרות שעודכנו:</strong> ${totalJobsUpdated}
          </p>
          <ul style="margin: 0; padding-right: 20px; color: #1e40af;">
            ${jobsList}
          </ul>
        </div>
      </div>

    </div>

    <!-- Footer -->
    <div style="background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="color: #6b7280; font-size: 12px; margin: 0;">
        סיכום אוטומטי נשלח על ידי כרמית - PandaHRAI
      </p>
    </div>

  </div>
</body>
</html>
    `;

    // Preview mode - return HTML without sending
    if (preview_mode) {
      return Response.json({
        success: true,
        preview: true,
        html: htmlBody
      });
    }

    // Send the email via Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'כרמית - PandaHRAI <notifications@updates.base44.com>',
        to: [recipientEmail],
        subject: `סיכום יומי - ${new Date().toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })}`,
        html: htmlBody
      })
    });

    const emailResult = await emailResponse.json();

    if (!emailResponse.ok) {
      throw new Error(emailResult.message || 'Failed to send email via Resend');
    }

    // Log the email
    await base44.asServiceRole.entities.EmailLog.create({
      to: recipientEmail,
      subject: `סיכום יומי - ${new Date().toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })}`,
      body: htmlBody,
      status: 'sent',
      related_entity_type: 'CarmitDailySummary',
      sent_date: new Date().toISOString(),
      resend_email_id: emailResult.id
    });

    // Update settings with last run info
    if (schedules?.[0]?.id) {
      await base44.asServiceRole.entities.CarmitSchedule.update(schedules[0].id, {
        last_summary_sent: new Date().toISOString(),
        last_summary_status: 'success',
        last_summary_error: null
      });
    }

    return Response.json({ 
      success: true,
      email_sent: true,
      recipient: recipientEmail
    });

  } catch (error) {
    console.error('Error sending Carmit daily summary:', error);
    
    // Try to update settings with error
    try {
      const base44 = createClientFromRequest(req);
      const schedules = await base44.asServiceRole.entities.CarmitSchedule.list('-updated_date', 1);
      if (schedules?.[0]?.id) {
        await base44.asServiceRole.entities.CarmitSchedule.update(schedules[0].id, {
          last_summary_sent: new Date().toISOString(),
          last_summary_status: 'failed',
          last_summary_error: error.message
        });
      }
    } catch (updateError) {
      console.error('Could not update settings with error:', updateError);
    }
    
    return Response.json({ error: error.message }, { status: 500 });
  }
});