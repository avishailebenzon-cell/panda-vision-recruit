import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Weekly scheduler for Hila candidate emails.
// Runs hourly via automation - checks HilaSchedule settings to determine if it's time to act.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const schedules = await base44.asServiceRole.entities.HilaSchedule.list('-updated_date', 1);
    if (!schedules || schedules.length === 0) {
      return Response.json({ message: 'No Hila settings found' });
    }

    const settings = schedules[0];

    if (!settings.candidates_is_enabled) {
      return Response.json({ message: 'Hila candidates is disabled' });
    }

    const now = new Date();
    const israelTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
    const currentDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][israelTime.getDay()];
    const currentHour = israelTime.getHours();
    const currentMinute = israelTime.getMinutes();
    const roundedMinute = Math.floor(currentMinute / 30) * 30;
    const currentTime = `${currentHour.toString().padStart(2, '0')}:${roundedMinute.toString().padStart(2, '0')}`;

    const results = { currentDay, currentTime, actions: [] };

    // Check if it's time to create a draft for candidates
    const draftDays = settings.candidates_draft_days || ['thursday'];
    const draftTime = settings.candidates_draft_send_time || '10:00';

    if (draftDays.includes(currentDay) && currentTime === draftTime) {
      // Check if draft already created today
      const todayStart = new Date(israelTime);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(todayStart);
      todayEnd.setHours(23, 59, 59, 999);

      const todayDrafts = await base44.asServiceRole.entities.HilaRunLog.filter({
        run_type: 'draft_creation',
        audience_type: 'candidates',
        status: 'success',
        created_date: { $gte: todayStart.toISOString(), $lte: todayEnd.toISOString() }
      });

      if (!todayDrafts || todayDrafts.length === 0) {
        results.actions.push('Creating candidate draft...');
        await base44.asServiceRole.functions.invoke('createHilaCandidateDraft', {});
        results.draftCreated = true;
      } else {
        results.actions.push('Draft already created today - skipping');
      }
    }

    // Check if it's time to send email to candidates
    const sendDays = settings.candidates_days || ['sunday'];
    const sendTime = settings.candidates_time || '11:00';

    if (sendDays.includes(currentDay) && currentTime === sendTime) {
      // Check if email already sent today
      const todayStart = new Date(israelTime);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(todayStart);
      todayEnd.setHours(23, 59, 59, 999);

      const todaySends = await base44.asServiceRole.entities.HilaRunLog.filter({
        run_type: 'email_send',
        audience_type: 'candidates',
        status: 'success',
        created_date: { $gte: todayStart.toISOString(), $lte: todayEnd.toISOString() }
      });

      if (todaySends && todaySends.length > 0) {
        results.actions.push('Email already sent today - skipping');
      } else {
        // Find a ready candidates draft
        const readyDrafts = await base44.asServiceRole.entities.HilaDraft.filter(
          { status: 'ready', audience_type: 'candidates' },
          '-created_date',
          1
        );

        if (!readyDrafts || readyDrafts.length === 0) {
          results.actions.push('No ready candidates draft found - skipping send');
        } else {
          results.actions.push('Sending candidate email...');
          await base44.asServiceRole.functions.invoke('sendHilaCandidateEmail', {
            isTest: false
          });
          results.emailSent = true;
        }
      }
    }

    if (results.actions.length > 0) {
      await base44.asServiceRole.entities.SystemActivityLog.create({
        actor_type: 'system',
        actor_name: 'scheduler',
        action_type: 'schedule_run',
        action_description: `בדיקת תזמון הילה - מועמדים: ${results.actions.join(', ')}`,
        status: 'success',
        details: JSON.stringify(results)
      });
    }

    return Response.json({ success: true, ...results });

  } catch (error) {
    console.error('scheduledHilaCandidatesProcess error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});