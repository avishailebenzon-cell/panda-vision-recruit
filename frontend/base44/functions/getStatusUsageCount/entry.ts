import { createClientFromRequest } from 'npm:@base44/sdk@0.7.0';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { statusNumber } = await req.json();

        if (typeof statusNumber !== 'number') {
            return Response.json({ error: 'statusNumber must be a number' }, { status: 400 });
        }

        const [matches, candidates] = await Promise.all([
            base44.asServiceRole.entities.Match.filter({ status_number: statusNumber }),
            base44.asServiceRole.entities.Candidate.filter({ status_number: statusNumber })
        ]);

        return Response.json({
            success: true,
            matchesCount: matches.length,
            candidatesCount: candidates.length,
        });

    } catch (error) {
        console.error("Error getting status usage count:", error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});