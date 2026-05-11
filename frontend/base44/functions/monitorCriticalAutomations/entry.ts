import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const alerts = [];
    
    // Check email scanner status
    try {
      const scanStatus = await base44.asServiceRole.entities.MailScanStatus.list();
      if (scanStatus.length > 0) {
        const status = scanStatus[0];
        const lastRun = status.last_run_time ? new Date(status.last_run_time) : null;
        const hoursSinceLastRun = lastRun ? (Date.now() - lastRun.getTime()) / (1000 * 60 * 60) : 999;
        
        // If no scan in last 2 hours, alert
        if (hoursSinceLastRun > 2) {
          alerts.push(`🔴 סורק מיילים: לא רץ ${Math.floor(hoursSinceLastRun)} שעות (סריקה אחרונה: ${lastRun?.toLocaleString('he-IL') || 'אף פעם'})`);
        }
      } else {
        alerts.push(`⚠️ סורק מיילים: לא נמצא סטטוס במערכת`);
      }
    } catch (error) {
      alerts.push(`❌ סורק מיילים: שגיאה בבדיקה - ${error.message}`);
    }
    

    
    // Send admin notification if issues found
    if (alerts.length > 0) {
      const adminUsers = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      
      for (const admin of adminUsers) {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: admin.email,
          subject: '[PandaHRAI] התראה: בעיה באוטומציות קריטיות',
          body: `
שלום ${admin.full_name},

זוהו בעיות באוטומציות קריטיות במערכת:

${alerts.join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
תאריך: ${new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}

בברכה,
מערכת ניטור PandaHRAI
          `,
          from_name: 'PandaHRAI - ניטור אוטומציות'
        });
      }
    }
    
    // Log monitoring activity
    await base44.asServiceRole.entities.SystemActivityLog.create({
      actor_type: 'system',
      actor_name: 'ניטור אוטומציות',
      action_type: 'system_check',
      action_description: `בדיקת אוטומציות קריטיות - ${alerts.length > 0 ? 'נמצאו בעיות' : 'הכל תקין'}`,
      status: alerts.length > 0 ? 'failed' : 'success',
      details: JSON.stringify({ alerts, timestamp: new Date().toISOString() })
    });
    
    return Response.json({
      success: true,
      alerts,
      message: alerts.length > 0 
        ? `נמצאו ${alerts.length} בעיות באוטומציות קריטיות`
        : 'כל האוטומציות הקריטיות פעילות'
    });
    
  } catch (error) {
    console.error('Monitor error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});