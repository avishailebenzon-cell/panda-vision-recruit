import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    console.log('Running scheduled number assignment...');

    // Run the assignment function
    const result = await base44.asServiceRole.functions.invoke('assignUniqueNumbers', {});

    console.log('Assignment result:', result);

    // Check if completed
    if (result.isComplete) {
      console.log('✅ Assignment completed! Sending notification and stopping task...');

      // Get all admin users
      const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });

      // Send email to all admins
      for (const admin of admins) {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: admin.email,
          subject: '✅ תיקון מספור מועמדים הושלם',
          body: `שלום ${admin.full_name},

תהליך תיקון מספור המועמדים הושלם בהצלחה!

📊 סיכום:
• סה"כ מועמדים שעודכנו: ${result.updated}
• המספר הבא הזמין: ${result.nextAvailable}

כל המועמדים במערכת כעת בעלי מספרים ייחודיים.

בברכה,
מערכת PandaHRAI`,
          from_name: 'PandaHRAI - התרעות מערכת'
        });
      }

      // Get all scheduled tasks and delete the one running this function
      const response = await fetch(
        `https://api.base44.com/v1/apps/${Deno.env.get('BASE44_APP_ID')}/scheduled-tasks`,
        {
          headers: {
            'Authorization': `Bearer ${Deno.env.get('BASE44_SERVICE_ROLE_KEY')}`
          }
        }
      );

      const tasks = await response.json();
      const thisTask = tasks.find(t => t.function_name === 'scheduledNumberAssignment');

      if (thisTask) {
        await fetch(
          `https://api.base44.com/v1/apps/${Deno.env.get('BASE44_APP_ID')}/scheduled-tasks/${thisTask.id}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${Deno.env.get('BASE44_SERVICE_ROLE_KEY')}`
            }
          }
        );
        console.log('Deleted scheduled task');
      }

      return Response.json({
        success: true,
        completed: true,
        message: 'תהליך הושלם ונעצר'
      });
    }

    return Response.json({
      success: true,
      completed: false,
      updated: result.updated,
      remaining: result.remaining,
      message: result.message
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});