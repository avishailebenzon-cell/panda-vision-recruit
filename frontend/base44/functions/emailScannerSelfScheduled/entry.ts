import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Self-Scheduling Email Scanner
 * 
 * This function runs email scanning and automatically schedules itself
 * to run again after completion. It eliminates dependency on external
 * automations and ensures continuous scanning.
 */

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    console.log('=== SELF-SCHEDULED EMAIL SCANNER START ===');
    
    // Get scan status - wrap in try/catch so a 403 here doesn't kill everything
    let scanStatus = null;
    try {
      const scanStatuses = await base44.asServiceRole.entities.MailScanStatus.list();
      scanStatus = scanStatuses[0] || null;
    } catch (statusErr) {
      console.warn('Could not read MailScanStatus (will proceed anyway):', statusErr.message);
    }
    
    // Check if self-scheduling is disabled
    if (scanStatus && scanStatus.self_scheduled_enabled === false) {
      console.log('Self-scheduling is disabled - stopping');
      return Response.json({ 
        success: true, 
        message: 'Self-scheduling disabled - scanner paused',
        action: 'stopped'
      });
    }
    
    // Check if regular scanner is already running
    if (scanStatus && scanStatus.is_running) {
      console.log('Scanner already running - skipping this cycle');
      const intervalMinutes = scanStatus.self_scheduled_interval_minutes || 5;
      
      setTimeout(() => {
        base44.asServiceRole.functions.invoke('emailScannerSelfScheduled', {})
          .catch(err => console.error('Error scheduling next run:', err));
      }, intervalMinutes * 60 * 1000);
      
      return Response.json({ 
        success: true, 
        message: 'Scanner already running - will retry in next cycle',
        nextRunIn: `${intervalMinutes} minutes`
      });
    }
    
    // Run the email scanner directly
    console.log('Invoking emailCvScanner...');
    let scanResult = {};
    try {
      const scanResponse = await base44.asServiceRole.functions.invoke('emailCvScanner', {});
      scanResult = scanResponse?.data || {};
      console.log('Scanner result:', JSON.stringify({
        success: scanResult.success,
        hasMoreEmails: scanResult.hasMoreEmails,
        stats: scanResult.stats || {}
      }));
    } catch (scanErr) {
      console.error('emailCvScanner failed:', scanErr.message);
      scanResult = { success: false, error: scanErr.message };
    }
    
    // Update scan status
    const intervalMinutes = (scanStatus?.self_scheduled_interval_minutes) || 5;
    const hasMoreEmails = scanResult.hasMoreEmails === true;
    const nextRunMinutes = hasMoreEmails ? 1 : intervalMinutes;
    const nextRunTime = new Date(Date.now() + nextRunMinutes * 60 * 1000);
    
    if (scanStatus) {
      try {
        await base44.asServiceRole.entities.MailScanStatus.update(scanStatus.id, {
          self_scheduled_last_run: new Date().toISOString(),
          self_scheduled_next_run: nextRunTime.toISOString(),
          self_scheduled_run_count: (scanStatus.self_scheduled_run_count || 0) + 1
        });
      } catch (updateErr) {
        console.warn('Could not update MailScanStatus:', updateErr.message);
      }
    }
    
    // Log to activity log
    try {
      await base44.asServiceRole.entities.SystemActivityLog.create({
        actor_type: 'agent',
        actor_name: 'raviv',
        actor_image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face',
        action_type: 'email_scan',
        action_description: `סריקת מיילים הושלמה: ${scanResult.stats?.candidatesCreated || 0} מועמדים חדשים`,
        status: scanResult.success ? 'success' : 'failed',
        details: JSON.stringify(scanResult.stats || {})
      });
    } catch (logErr) {
      console.warn('Failed to log activity:', logErr.message);
    }
    
    // Schedule next run (fire and forget)
    console.log(`Scheduling next run in ${nextRunMinutes} minutes...`);
    setTimeout(() => {
      base44.asServiceRole.functions.invoke('emailScannerSelfScheduled', {})
        .then(() => console.log('Next scan cycle queued successfully'))
        .catch(err => console.error('Error scheduling next run:', err));
    }, nextRunMinutes * 60 * 1000);
    
    console.log('=== SELF-SCHEDULED EMAIL SCANNER COMPLETE ===');
    
    return Response.json({
      success: true,
      message: `Scan completed - next run in ${nextRunMinutes} minutes`,
      scanResult: {
        success: scanResult.success,
        hasMoreEmails: scanResult.hasMoreEmails,
        stats: scanResult.stats
      },
      nextRunAt: nextRunTime.toISOString()
    });
    
  } catch (error) {
    console.error('Critical error in self-scheduled scanner:', error);
    
    try {
      const base44Retry = createClientFromRequest(req);
      await base44Retry.asServiceRole.entities.SystemActivityLog.create({
        actor_type: 'agent',
        actor_name: 'raviv',
        action_type: 'email_scan',
        action_description: `שגיאה בסריקת מיילים אוטומטית: ${error.message}`,
        status: 'failed'
      });
    } catch (_) {}
    
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});