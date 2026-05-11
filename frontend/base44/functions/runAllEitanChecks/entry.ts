import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user (admin only)
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    console.log('Starting automatic activation of all quality checks');

    // Get all tasks with status "לא החל"
    const pendingTasks = await base44.asServiceRole.entities.EitanTask.filter({ status: 'לא החל' });
    console.log(`Found ${pendingTasks.length} pending tasks`);

    if (pendingTasks.length === 0) {
      return Response.json({ 
        success: true,
        message: 'אין משימות ממתינות',
        tasksProcessed: 0,
        errors: []
      });
    }

    const errors = [];
    const scheduled = [];
    let taskIndex = 0;

    // Validate and schedule tasks
    for (const task of pendingTasks) {
      // Validate task has phone OR email
      const hasPhone = task.client_contact_phone && task.client_contact_phone.trim() !== '';
      const hasEmail = task.client_contact_email && task.client_contact_email.trim() !== '';
      
      if (!hasPhone && !hasEmail) {
        errors.push({
          task_id: task.id,
          check_number: task.check_number,
          employee_name: task.employee_name,
          error: 'חסר מספר טלפון ומייל של איש הקשר'
        });
        console.log(`Task ${task.check_number} (${task.employee_name}): Missing phone and email`);
        continue;
      }

      // Calculate delay (60 minutes = 3600000 ms)
      const delayMinutes = taskIndex * 60;
      const scheduledTime = new Date(Date.now() + delayMinutes * 60 * 1000);

      scheduled.push({
        task_id: task.id,
        check_number: task.check_number,
        employee_name: task.employee_name,
        scheduled_time: scheduledTime.toISOString(),
        delay_minutes: delayMinutes
      });

      // Update task to "מאושר לשיחה" with delay info
      await base44.asServiceRole.entities.EitanTask.update(task.id, {
        status: 'מאושר לשיחה',
        notes: (task.notes || '') + `\n[הפעלה אוטומטית] תוזמן להיות מופעל בעוד ${delayMinutes} דקות (${scheduledTime.toLocaleString('he-IL')})`
      });

      taskIndex++;

      // Small delay to avoid rate limiting
      if (taskIndex % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    const summary = {
      success: true,
      totalPendingTasks: pendingTasks.length,
      tasksScheduled: scheduled.length,
      tasksWithErrors: errors.length,
      scheduled,
      errors,
      message: `${scheduled.length} משימות אושרו להפעלה אוטומטית בהפרש של 60 דקות`
    };

    console.log('Automatic activation completed:', summary);

    return Response.json(summary);

  } catch (error) {
    console.error('Error in automatic activation:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});