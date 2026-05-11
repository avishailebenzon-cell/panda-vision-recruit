import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const HOURS_THRESHOLD = 48;
  const cutoff = new Date(Date.now() - HOURS_THRESHOLD * 60 * 60 * 1000);

  // Get all RotemTasks created in the last 48 hours
  const recentTasks = await base44.asServiceRole.entities.RotemTask.filter({
    created_date: { $gte: cutoff.toISOString() }
  });

  if (recentTasks.length > 0) {
    return Response.json({
      status: 'ok',
      message: `נמצאו ${recentTasks.length} משימות חדשות לטל ב-48 השעות האחרונות`,
      tasks_count: recentTasks.length
    });
  }

  // No tasks found - trigger alert
  console.log('⚠️ לא נוצרה שום משימה לטל ב-48 שעות האחרונות - שולח התראה');

  // 1. Send alert email to admins
  const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
  
  for (const admin of admins) {
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: admin.email,
      subject: '⚠️ התראה: לא נוצרו משימות לטל ב-48 שעות',
      body: `שלום ${admin.full_name},

⚠️ התראת מערכת אוטומטית

לא נוצרה שום משימה חדשה לטל (RotemTask) ב-48 השעות האחרונות.

זה עשוי להצביע על תקלה בכרמית או בתהליך ההתאמה האוטומטי.

מערכת PandaHRAI מנסה להפעיל את כרמית מחדש אוטומטית.

אנא בדוק את מרכז הפיקוד לפרטים נוספים.

בברכה,
מערכת PandaHRAI`,
      from_name: 'PandaHRAI - ניטור מערכת'
    });
  }

  // 2. Try to restart Carmit - reset is_running if stuck, then invoke
  const carmitStatus = await base44.asServiceRole.entities.AgentRunStatus.filter({ agent_name: 'carmit' });
  
  if (carmitStatus.length > 0 && carmitStatus[0].is_running) {
    // Carmit appears stuck - free it
    await base44.asServiceRole.entities.AgentRunStatus.update(carmitStatus[0].id, {
      is_running: false,
      current_activity: null,
      last_error: 'אופס ידני - שוחרר על ידי ניטור יומי (אין משימות לטל 48 שעות)'
    });
    console.log('כרמית שוחררה מתקיעות');
  }

  // Invoke carmit agent
  try {
    await base44.asServiceRole.functions.invoke('runCarmitAgent', {});
    console.log('כרמית הופעלה מחדש');
  } catch (err) {
    console.error('שגיאה בהפעלת כרמית:', err.message);
  }

  // Log to SystemActivityLog
  await base44.asServiceRole.entities.SystemActivityLog.create({
    actor_type: 'system',
    actor_name: 'ניטור יומי',
    action_type: 'system_check',
    action_description: '⚠️ לא נוצרו משימות לטל ב-48 שעות - נשלחה התראה וכרמית הופעלה מחדש',
    status: 'warning'
  });

  return Response.json({
    status: 'alert_sent',
    message: 'לא נוצרו משימות לטל ב-48 שעות - נשלחה התראה וכרמית הופעלה מחדש',
    admins_notified: admins.length
  });
});