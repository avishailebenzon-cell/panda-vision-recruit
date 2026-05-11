import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Stop Self-Scheduling Email Scanner
 * 
 * Stops the continuous email scanning loop by disabling
 * the self_scheduled_enabled flag in MailScanStatus.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify user is admin
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
    
    const scanStatuses = await base44.asServiceRole.entities.MailScanStatus.list();
    const scanStatus = scanStatuses[0];
    
    if (!scanStatus) {
      return Response.json({ success: false, error: 'No scan status found' }, { status: 404 });
    }
    
    // Disable self-scheduling
    await base44.asServiceRole.entities.MailScanStatus.update(scanStatus.id, {
      self_scheduled_enabled: false,
      is_running: false
    });
    
    console.log('Self-scheduling email scanner stopped');
    
    // Log to system activity
    await base44.asServiceRole.entities.SystemActivityLog.create({
      actor_type: 'user',
      actor_name: user.full_name,
      action_type: 'email_scan',
      action_description: 'עצירת מנגנון סריקת מיילים אוטומטי (self-scheduled)',
      status: 'success',
      performed_by: user.email
    });
    
    return Response.json({
      success: true,
      message: 'Self-scheduling email scanner stopped',
      status: 'Scanner will not run again until manually started'
    });
    
  } catch (error) {
    console.error('Error stopping scanner:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});