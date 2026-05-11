import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get all tasks without task_number or with invalid task_number
    const allTasks = await base44.asServiceRole.entities.RotemTask.list('-created_date', 10000);
    const tasksWithoutNumber = allTasks.filter(task => 
      !task.task_number || 
      task.task_number === 'TD-00NaN' || 
      task.task_number.includes('NaN')
    );
    
    console.log(`Found ${tasksWithoutNumber.length} tasks without task numbers`);
    
    if (tasksWithoutNumber.length === 0) {
      return Response.json({ status: 'ok', message: 'All tasks already have numbers' });
    }
    
    // Get or create counter
    let counter = null;
    const counters = await base44.asServiceRole.entities.MessageCounter.filter({
      counter_type: 'rotem_task'
    });
    
    if (counters && counters.length > 0) {
      counter = counters[0];
    } else {
      counter = await base44.asServiceRole.entities.MessageCounter.create({
        counter_type: 'rotem_task',
        current_value: 0,
        last_number: 0
      });
    }
    
    let currentNumber = counter.current_value || counter.last_number || 0;
    let updated = 0;
    
    // Sort tasks by created_date (oldest first) to maintain chronological order
    const sortedTasks = tasksWithoutNumber.sort((a, b) => 
      new Date(a.created_date) - new Date(b.created_date)
    );
    
    // Assign numbers to all tasks with delays to avoid rate limit
    for (const task of sortedTasks) {
      currentNumber++;
      const taskNumber = `TD-${String(currentNumber).padStart(5, '0')}`;
      
      await base44.asServiceRole.entities.RotemTask.update(task.id, {
        task_number: taskNumber
      });
      
      updated++;
      console.log(`Assigned ${taskNumber} to task ${task.id}`);
      
      // Delay 500ms between updates to avoid rate limit
      if (updated < sortedTasks.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Update counter
    await base44.asServiceRole.entities.MessageCounter.update(counter.id, {
      current_value: currentNumber
    });
    
    return Response.json({ 
      status: 'ok',
      updated,
      lastNumber: currentNumber
    });
    
  } catch (error) {
    console.error('Error assigning task numbers:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});