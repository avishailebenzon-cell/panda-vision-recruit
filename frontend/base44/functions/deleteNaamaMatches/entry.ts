import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Authenticate user
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get all matches created by Naama
        const naamaMatches = await base44.asServiceRole.entities.Match.filter({
            user_name: 'נעמה (סוכן AI)'
        });

        console.log(`Found ${naamaMatches.length} matches created by Naama`);

        // Delete all matches
        let deletedCount = 0;
        for (const match of naamaMatches) {
            try {
                await base44.asServiceRole.entities.Match.delete(match.id);
                deletedCount++;
                console.log(`Deleted match ${match.id}`);
            } catch (error) {
                console.error(`Failed to delete match ${match.id}:`, error);
            }
        }

        return Response.json({
            success: true,
            message: `Successfully deleted ${deletedCount} out of ${naamaMatches.length} Naama matches`,
            deletedCount: deletedCount,
            totalFound: naamaMatches.length
        });

    } catch (error) {
        console.error('Error in deleteNaamaMatches:', error);
        return Response.json({ 
            error: error.message,
            success: false 
        }, { status: 500 });
    }
});