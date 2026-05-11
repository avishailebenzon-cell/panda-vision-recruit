import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user (admin only for backfill operations)
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    console.log('Starting backfill of check numbers for Eitan tasks');

    // Get all tasks
    const allTasks = await base44.asServiceRole.entities.EitanTask.list('-created_date', 10000);
    console.log(`Found ${allTasks.length} total tasks`);

    // Filter tasks without check_number
    const tasksWithoutCheckNumber = allTasks.filter(task => !task.check_number);
    console.log(`Found ${tasksWithoutCheckNumber.length} tasks without check number`);

    if (tasksWithoutCheckNumber.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'כל המשימות כבר יש להן מספר מבדק',
        tasksUpdated: 0
      });
    }

    // Find the highest existing check number
    let maxNumber = 0;
    for (const task of allTasks) {
      if (task.check_number) {
        const match = task.check_number.match(/TST-(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNumber) {
            maxNumber = num;
          }
        }
      }
    }

    console.log(`Highest existing check number: ${maxNumber}`);

    // Sort tasks by created_date (oldest first) to maintain chronological order
    tasksWithoutCheckNumber.sort((a, b) => 
      new Date(a.created_date) - new Date(b.created_date)
    );

    // Update tasks with check numbers
    let nextNumber = maxNumber + 1;
    let tasksUpdated = 0;

    for (const task of tasksWithoutCheckNumber) {
      const checkNumber = `TST-${String(nextNumber).padStart(5, '0')}`;
      
      try {
        await base44.asServiceRole.entities.EitanTask.update(task.id, {
          check_number: checkNumber
        });
        
        tasksUpdated++;
        console.log(`Updated task ${task.id} (${task.employee_name}) with check number ${checkNumber}`);
        nextNumber++;

        // Add delay every 10 tasks to avoid rate limiting
        if (tasksUpdated % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (err) {
        console.error(`Failed to update task ${task.id}:`, err.message);
      }
    }

    const summary = {
      success: true,
      tasksUpdated,
      totalTasks: allTasks.length,
      startingNumber: maxNumber + 1,
      endingNumber: nextNumber - 1
    };

    console.log('Backfill completed:', summary);

    return Response.json(summary);

  } catch (error) {
    console.error('Error in backfill:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});