import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Start Self-Scheduling Email Scanner
 * 
 * This function initializes the self-scheduling email scanner loop.
 * Call this once to start continuous email scanning.
 * 
 * The scanner will:
 * 1. Run every 5 minutes (configurable)
 * 2. Automatically continue running indefinitely
 * 3. Can be stopped by setting self_scheduled_enabled=false in MailScanStatus
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify user is admin
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
    
    // Get or create scan status
    const scanStatuses = await base44.asServiceRole.entities.MailScanStatus.list();
    let scanStatus = scanStatuses[0];
    
    if (!scanStatus) {
      scanStatus = await base44.asServiceRole.entities.MailScanStatus.create({
        total_emails_processed: 0,
        total_candidates_created: 0,
        total_candidates_updated: 0,
        is_running: false,
        self_scheduled_enabled: true,
        self_scheduled_interval_minutes: 5
      });
    }
    
    // Enable self-scheduling if disabled
    await base44.asServiceRole.entities.MailScanStatus.update(scanStatus.id, {
      self_scheduled_enabled: true,
      self_scheduled_last_run: null,
      self_scheduled_next_run: new Date().toISOString(),
      self_scheduled_run_count: 0
    });
    
    // Start the first scan cycle (fire and forget)
    base44.asServiceRole.functions.invoke('emailScannerSelfScheduled', {})
      .catch(err => console.error('Error starting first scan:', err));
    
    console.log('Self-scheduling email scanner started successfully');
    
    // Log to system activity
    await base44.asServiceRole.entities.SystemActivityLog.create({
      actor_type: 'user',
      actor_name: user.full_name,
      action_type: 'email_scan',
      action_description: 'הפעלת מנגנון סריקת מיילים אוטומטי (self-scheduled)',
      status: 'success',
      performed_by: user.email
    });
    
    return Response.json({
      success: true,
      message: 'Self-scheduling email scanner started',
      intervalMinutes: scanStatus.self_scheduled_interval_minutes || 5,
      status: 'Scanner will run continuously every few minutes'
    });
    
  } catch (error) {
    console.error('Error starting self-scheduled scanner:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});