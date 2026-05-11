import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all existing check numbers
    const allTasks = await base44.asServiceRole.entities.EitanTask.list('-created_date', 10000);
    
    // Find the highest number
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

    const nextNumber = maxNumber + 1;

    return Response.json({ 
      nextNumber,
      formattedNumber: `TST-${String(nextNumber).padStart(5, '0')}`
    });

  } catch (error) {
    console.error('Error getting next check number:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});