import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Maximum retry attempts to prevent infinite loops
    const MAX_RETRIES = 10;
    let attempts = 0;
    
    while (attempts < MAX_RETRIES) {
      attempts++;
      
      // CRITICAL: Get or create counter entity with proper initialization
      let counter = null;
      const counters = await base44.asServiceRole.entities.MessageCounter.filter({
        counter_type: 'rotem_task'
      });
      
      if (counters && counters.length > 0) {
        counter = counters[0];
      } else {
        // Initialize counter by scanning all existing tasks
        const allTasks = await base44.asServiceRole.entities.RotemTask.list('-created_date', 2000);
        let highestNumber = 0;
        
        if (allTasks && allTasks.length > 0) {
          const taskNumbers = allTasks
            .map(t => t.task_number)
            .filter(Boolean)
            .map(tn => {
              const match = tn.match(/TD-(\d+)/);
              return match ? parseInt(match[1], 10) : 0;
            });
          
          if (taskNumbers.length > 0) {
            highestNumber = Math.max(...taskNumbers);
          }
        }
        
        counter = await base44.asServiceRole.entities.MessageCounter.create({
          counter_type: 'rotem_task',
          current_value: highestNumber,
          last_number: highestNumber
        });
      }
      
      // Calculate next number
      const counterValue = Math.max(counter.current_value || 0, counter.last_number || 0);
      const nextNumber = counterValue + 1;
      const taskNumber = `TD-${String(nextNumber).padStart(5, '0')}`;
      
      // CRITICAL: Check for uniqueness BEFORE updating counter
      const existingWithNumber = await base44.asServiceRole.entities.RotemTask.filter({
        task_number: taskNumber
      });
      
      if (existingWithNumber && existingWithNumber.length > 0) {
        console.warn(`Collision detected on attempt ${attempts}: ${taskNumber} already exists. Skipping to next number.`);
        // Force counter to skip this number
        await base44.asServiceRole.entities.MessageCounter.update(counter.id, {
          current_value: nextNumber,
          last_number: nextNumber
        });
        continue; // Try again with next number
      }
      
      // Update counter atomically
      await base44.asServiceRole.entities.MessageCounter.update(counter.id, {
        current_value: nextNumber,
        last_number: nextNumber
      });
      
      // Final verification after update
      const finalCheck = await base44.asServiceRole.entities.RotemTask.filter({
        task_number: taskNumber
      });
      
      if (finalCheck && finalCheck.length > 0) {
        console.error(`Race condition detected on attempt ${attempts}: ${taskNumber} was created by another process!`);
        continue; // Try again
      }
      
      console.log(`Successfully generated unique task number: ${taskNumber} (attempt ${attempts})`);
      return Response.json({ nextNumber });
    }
    
    // If we got here, all retries failed
    console.error(`Failed to generate unique task number after ${MAX_RETRIES} attempts`);
    return Response.json({ 
      error: 'Failed to generate unique task number after multiple attempts',
      attempts: MAX_RETRIES 
    }, { status: 500 });
    
  } catch (error) {
    console.error('Error getting next task number:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});