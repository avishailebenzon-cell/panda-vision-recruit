import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Auto-switch scanner manager - ensures one of the scanners is always running
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get scan status
    const scanStatuses = await base44.asServiceRole.entities.MailScanStatus.list();
    let scanStatus = scanStatuses[0];
    
    if (!scanStatus) {
      // Create initial status
      scanStatus = await base44.asServiceRole.entities.MailScanStatus.create({
        total_emails_processed: 0,
        total_candidates_created: 0,
        total_candidates_updated: 0,
        is_running: false,
        is_reverse_running: false
      });
    }
    
    // Don't check if scanners are running - we want both to run in parallel
    // Each scanner will check its own status flag internally
    
    // Check for stuck scanners (running flag is true but last run was more than 3 minutes ago)
    const now = new Date();
    const threeMinutesAgo = new Date(now.getTime() - 3 * 60 * 1000);
    
    let isRegularStuck = false;
    let isReverseStuck = false;
    
    if (scanStatus.is_running && scanStatus.last_run_time) {
      const lastRun = new Date(scanStatus.last_run_time);
      if (lastRun < threeMinutesAgo) {
        isRegularStuck = true;
        console.log('Regular scanner appears stuck - resetting');
        await base44.asServiceRole.entities.MailScanStatus.update(scanStatus.id, {
          is_running: false,
          last_error: 'נעצר אוטומטית (תקוע למעלה מ-3 דקות)'
        });
      }
    }
    
    if (scanStatus.is_reverse_running && scanStatus.last_reverse_run_time) {
      const lastRun = new Date(scanStatus.last_reverse_run_time);
      if (lastRun < threeMinutesAgo) {
        isReverseStuck = true;
        console.log('Reverse scanner appears stuck - resetting');
        await base44.asServiceRole.entities.MailScanStatus.update(scanStatus.id, {
          is_reverse_running: false,
          last_error: 'סריקה הפוכה נעצרה אוטומטית (תקוע למעלה מ-3 דקות)'
        });
      }
    }
    
    // Reload status after potential reset
    if (isRegularStuck || isReverseStuck) {
      const updatedStatuses = await base44.asServiceRole.entities.MailScanStatus.list();
      scanStatus = updatedStatuses[0];
    }
    
    // NEW STRATEGY: Run BOTH scanners in parallel
    // Regular scanner handles new emails (forward in time)
    // Reverse scanner handles old emails (backward in time)
    
    const lastRegularRun = scanStatus.last_run_time ? new Date(scanStatus.last_run_time) : null;
    const lastReverseRun = scanStatus.last_reverse_run_time ? new Date(scanStatus.last_reverse_run_time) : null;
    
    const scannersToRun = [];
    
    // Run regular scanner if it hasn't run recently (less than 1 minute ago)
    const regularCanRun = !scanStatus.is_running && 
      (!lastRegularRun || (now.getTime() - lastRegularRun.getTime()) > 60000);
    
    // Run reverse scanner if enabled and hasn't run recently (less than 1 minute ago)
    const reverseCanRun = !scanStatus.is_reverse_running && 
      scanStatus.reverse_scan_enabled !== false &&
      (!lastReverseRun || (now.getTime() - lastReverseRun.getTime()) > 60000);
    
    if (regularCanRun) {
      scannersToRun.push({ name: 'regular', function: 'emailCvScanner' });
      console.log('Regular scanner ready to run');
    }
    
    if (reverseCanRun) {
      scannersToRun.push({ name: 'reverse', function: 'emailCvScannerReverse' });
      console.log('Reverse scanner ready to run');
    }
    
    if (scannersToRun.length === 0) {
      console.log('No scanners need to run right now');
      return Response.json({ 
        success: true, 
        message: 'כל הסורקים רצים לאחרונה או פועלים כרגע',
        scannersRunning: {
          regular: scanStatus.is_running,
          reverse: scanStatus.is_reverse_running
        }
      });
    }
    
    // Invoke all ready scanners in parallel (don't await - fire and forget)
    const promises = scannersToRun.map(scanner => 
      base44.asServiceRole.functions.invoke(scanner.function, {})
        .catch(err => console.error(`Error starting ${scanner.name}:`, err))
    );
    
    // Don't wait for them to complete - let them run in background
    Promise.all(promises);
    
    console.log(`Started ${scannersToRun.length} scanner(s): ${scannersToRun.map(s => s.name).join(', ')}`);
    
    return Response.json({ 
      success: true, 
      message: `הופעלו ${scannersToRun.length} סורקים במקביל`,
      scannersStarted: scannersToRun.map(s => s.name)
    });
    
  } catch (error) {
    console.error('Error in scanner manager:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});