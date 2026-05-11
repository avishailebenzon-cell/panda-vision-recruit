import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const REPORT_EMAIL = 'avishai.lebenzon@gmail.com';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Fetch all non-handled matches
    const allMatches = await base44.asServiceRole.entities.Match.filter(
      { is_manually_handled: false },
      '-created_date',
      2000
    );

    // Fetch all open jobs
    const openJobs = await base44.asServiceRole.entities.Job.filter({ status: 'פעילה' });
    const openJobIds = new Set(openJobs.map(j => j.id));

    // Filter: not handled + open job + all detailed_analysis items are is_match: "true"
    const pending = allMatches.filter(m => {
      if (!openJobIds.has(m.job_id)) return false;

      // Parse detailed_analysis
      let analysis = [];
      try {
        analysis = typeof m.detailed_analysis === 'string'
          ? JSON.parse(m.detailed_analysis)
          : (m.detailed_analysis || []);
      } catch {
        return false;
      }

      if (!Array.isArray(analysis) || analysis.length === 0) return false;

      // All items must be is_match: "true"
      if (!analysis.every(item => item.is_match === 'true' || item.is_match === true)) return false;

      // Exclude matches with level-1 security cap warning
      const reasons = m.match_reasons || '';
      if (reasons.includes('ציון מוגבל ל-70%') || reasons.includes('סיווג רמה 1')) return false;

      return true;
    });

    if (pending.length === 0) {
      console.log('No pending matches with all green checks — skipping email');
      return Response.json({ success: true, sent: 0, message: 'No matches to report' });
    }

    // Group by job for better readability
    const byJob = {};
    for (const m of pending) {
      if (!byJob[m.job_id]) {
        byJob[m.job_id] = { job_title: m.job_title || 'משרה לא ידועה', matches: [] };
      }
      byJob[m.job_id].matches.push(m);
    }

    // Build HTML email
    let tableRows = '';
    for (const [jobId, group] of Object.entries(byJob)) {
      for (const m of group.matches) {
        const score = m.match_score != null ? `${m.match_score}%` : '—';
        const reasons = (m.match_reasons || '').replace(/\n/g, '<br>');
        tableRows += `
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #eee;">${m.candidate_name || '—'}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #eee;">${group.job_title}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:13px;color:#555;">${reasons}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center;font-weight:bold;color:${m.match_score >= 80 ? '#16a34a' : '#2563eb'};">${score}</td>
          </tr>`;
      }
    }

    const today = new Date().toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });
    const html = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f9fafb;padding:24px;">
  <div style="max-width:900px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <h2 style="color:#1e293b;margin-bottom:4px;">📋 דוח התאמות ממתינות לטיפול</h2>
    <p style="color:#64748b;margin-top:0;">${today} | סה"כ ${pending.length} התאמות עם ✅ על כל הסעיפים</p>
    <table style="width:100%;border-collapse:collapse;margin-top:16px;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:10px 12px;text-align:right;color:#475569;font-size:13px;">מועמד</th>
          <th style="padding:10px 12px;text-align:right;color:#475569;font-size:13px;">משרה</th>
          <th style="padding:10px 12px;text-align:right;color:#475569;font-size:13px;">תיאור ההתאמה</th>
          <th style="padding:10px 12px;text-align:center;color:#475569;font-size:13px;">אחוזים</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
    <p style="margin-top:24px;font-size:12px;color:#94a3b8;">נשלח אוטומטית מ-HRAI בשעה 08:00</p>
  </div>
</body>
</html>`;

    // Send via Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'HRAI Reports <onboarding@resend.dev>',
        to: [REPORT_EMAIL],
        subject: `📋 דוח התאמות ממתינות - ${today} (${pending.length} התאמות)`,
        html
      })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Resend error: ${err}`);
    }

    console.log(`Daily pending matches report sent: ${pending.length} matches`);
    return Response.json({ success: true, sent: pending.length });

  } catch (error) {
    console.error('sendDailyPendingMatchesReport error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});