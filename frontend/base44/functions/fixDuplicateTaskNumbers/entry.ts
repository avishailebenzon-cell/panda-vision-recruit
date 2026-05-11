import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    console.log('Starting duplicate task number fix');
    
    // Get all RotemTasks
    const allTasks = await base44.asServiceRole.entities.RotemTask.list('-created_date', 10000);
    
    // Group by task_number
    const tasksByNumber = {};
    
    for (const task of allTasks) {
      if (task.task_number) {
        if (!tasksByNumber[task.task_number]) {
          tasksByNumber[task.task_number] = [];
        }
        tasksByNumber[task.task_number].push(task);
      }
    }
    
    // Find duplicates
    const duplicates = Object.entries(tasksByNumber).filter(([num, tasks]) => tasks.length > 1);
    
    console.log(`Found ${duplicates.length} duplicate task numbers`);
    
    if (duplicates.length === 0) {
      return Response.json({ 
        status: 'ok', 
        message: 'No duplicates found',
        total_tasks: allTasks.length 
      });
    }
    
    // Get the highest task number to continue from
    let highestNumber = 0;
    for (const [taskNumber, _] of Object.entries(tasksByNumber)) {
      const match = taskNumber.match(/TD-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > highestNumber) highestNumber = num;
      }
    }
    
    console.log(`Highest existing task number: ${highestNumber}`);
    
    let fixed = 0;
    let nextAvailable = highestNumber + 1;
    
    // For each duplicate group, keep the oldest and renumber the rest
    for (const [taskNumber, tasks] of duplicates) {
      console.log(`Processing duplicate group: ${taskNumber} (${tasks.length} tasks)`);
      
      // Sort by created_date - keep the OLDEST one with original number
      const sorted = tasks.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      
      // Renumber all except the first (oldest)
      for (let i = 1; i < sorted.length; i++) {
        const task = sorted[i];
        const newTaskNumber = `TD-${String(nextAvailable).padStart(5, '0')}`;
        
        console.log(`  Renumbering task ${task.id} from ${taskNumber} to ${newTaskNumber}`);
        
        await base44.asServiceRole.entities.RotemTask.update(task.id, {
          task_number: newTaskNumber
        });
        
        // Also update WhatsappConversation if linked
        const conversations = await base44.asServiceRole.entities.WhatsappConversation.filter({
          task_number: taskNumber,
          candidate_phone: task.candidate_phone
        });
        
        for (const conv of conversations) {
          await base44.asServiceRole.entities.WhatsappConversation.update(conv.id, {
            task_number: newTaskNumber
          });
        }
        
        nextAvailable++;
        fixed++;
      }
    }
    
    // Update the counter to the next available number
    const counters = await base44.asServiceRole.entities.MessageCounter.filter({
      counter_type: 'rotem_task'
    });
    
    if (counters && counters.length > 0) {
      await base44.asServiceRole.entities.MessageCounter.update(counters[0].id, {
        current_value: nextAvailable,
        last_number: nextAvailable
      });
      console.log(`Updated counter to ${nextAvailable}`);
    }
    
    return Response.json({
      status: 'ok',
      duplicates_found: duplicates.length,
      tasks_renumbered: fixed,
      next_available: nextAvailable
    });
    
  } catch (error) {
    console.error('Fix error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});