import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Returns { candidateId: matchCount } for a list of candidate IDs.
// Uses asServiceRole to bypass pagination and auth limits.
// Called from Candidates page to show filled briefcase icon when matches exist.

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { candidate_ids = [] } = await req.json();

    if (!Array.isArray(candidate_ids) || candidate_ids.length === 0) {
        return Response.json({ success: true, counts: {} });
    }

    const counts: Record<string, number> = {};

    // Process in batches of 20 to run parallel queries without overloading the server
    const BATCH_SIZE = 20;

    for (let i = 0; i < candidate_ids.length; i += BATCH_SIZE) {
        const batch = candidate_ids.slice(i, i + BATCH_SIZE);

        await Promise.all(
            batch.map(async (candidateId: string) => {
                try {
                    // Fetch up to 50 matches per candidate (enough to show a meaningful count)
                    const matches = await base44.asServiceRole.entities.Match.filter(
                        { candidate_id: candidateId },
                        '-created_date',
                        50
                    );
                    if (matches.length > 0) {
                        counts[candidateId] = matches.length;
                    }
                } catch {
                    // Ignore individual candidate errors — missing count is non-critical
                }
            })
        );
    }

    return Response.json({ success: true, counts });
});
