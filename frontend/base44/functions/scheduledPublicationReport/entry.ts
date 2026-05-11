import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get Hila settings to check if publication report is enabled and when to send
    const schedules = await base44.asServiceRole.entities.HilaSchedule.list('-updated_date', 1);
    
    if (!schedules || schedules.length === 0) {
      console.log('No Hila schedule found - using defaults');
      // Use defaults if no schedule exists
      await runPublicationReport(base44, 'tuesday', '12:00', 'Office@pandatech.co.il');
      return Response.json({ success: true, message: 'Publication report sent (default schedule)' });
    }

    const schedule = schedules[0];
    
    // Check if publication report is enabled
    if (schedule.publication_report_enabled === false) {
      return Response.json({ 
        success: true, 
        message: 'Publication report is disabled',
        skipped: true 
      });
    }

    const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Jerusalem' }).toLowerCase();
    const currentTime = new Date().toLocaleTimeString('he-IL', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Jerusalem'
    });

    // Support both single day (old) and multiple days (new)
    const targetDays = schedule.publication_report_days && schedule.publication_report_days.length > 0
      ? schedule.publication_report_days
      : [schedule.publication_report_day || 'tuesday'];
    const targetTime = schedule.publication_report_time || '12:00';
    const targetEmail = schedule.publication_report_email || 'Office@pandatech.co.il';

    // Check if current day is in target days and approximately the right time (within 10 minutes)
    if (targetDays.includes(currentDay)) {
      const [currentHour, currentMin] = currentTime.split(':').map(Number);
      const [targetHour, targetMin] = targetTime.split(':').map(Number);
      
      const currentMinutes = currentHour * 60 + currentMin;
      const targetMinutes = targetHour * 60 + targetMin;
      
      // Send if we're within 10 minutes of target time
      if (Math.abs(currentMinutes - targetMinutes) <= 10) {
        await runPublicationReport(base44, currentDay, targetTime, targetEmail);
        return Response.json({ 
          success: true, 
          message: `Publication report sent to ${targetEmail}` 
        });
      }
    }

    return Response.json({ 
      success: true, 
      message: 'Not time to send publication report yet',
      skipped: true,
      current: { day: currentDay, time: currentTime },
      target: { days: targetDays, time: targetTime }
    });

  } catch (error) {
    console.error('Error in scheduled publication report:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function runPublicationReport(base44, day, time, targetEmail) {
  // Call the main function to generate and send the report
  const result = await base44.asServiceRole.functions.invoke('generateJobPublicationReport', { 
    preview_mode: false 
  });
  
  if (result?.success) {
    // Update last run time in settings
    const schedules = await base44.asServiceRole.entities.HilaSchedule.list('-updated_date', 1);
    if (schedules && schedules.length > 0) {
      await base44.asServiceRole.entities.HilaSchedule.update(schedules[0].id, {
        last_publication_report_time: new Date().toISOString()
      });
    }
  }
  
  return result;
}