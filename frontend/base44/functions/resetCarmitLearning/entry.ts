import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Authenticate user
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get all CarmitLearning records
        const learningRecords = await base44.asServiceRole.entities.CarmitLearning.list();
        
        console.log(`Found ${learningRecords.length} Carmit learning records to reset`);

        // Delete all learning records
        let deletedCount = 0;
        for (const record of learningRecords) {
            try {
                await base44.asServiceRole.entities.CarmitLearning.delete(record.id);
                deletedCount++;
                console.log(`Deleted learning record ${record.id}`);
            } catch (error) {
                console.error(`Failed to delete learning record ${record.id}:`, error);
            }
        }

        // Log the action
        await base44.asServiceRole.entities.SystemActivityLog.create({
            actor_type: 'user',
            actor_name: user.full_name,
            actor_image: null,
            action_type: 'data_cleanup',
            action_description: `איפס את למידת כרמית (${deletedCount} רשומות נמחקו)`,
            status: 'success'
        });

        return Response.json({
            success: true,
            message: `Successfully reset Carmit's learning (${deletedCount} records deleted)`,
            deletedCount: deletedCount,
            totalFound: learningRecords.length
        });

    } catch (error) {
        console.error('Error in resetCarmitLearning:', error);
        return Response.json({ 
            error: error.message,
            success: false 
        }, { status: 500 });
    }
});