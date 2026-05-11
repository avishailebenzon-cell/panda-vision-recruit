import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        // Fetch all job IDs
        const allJobs = await base44.asServiceRole.entities.Job.list();
        const jobIds = new Set(allJobs.map(j => j.id));
        console.log(`Found ${allJobs.length} active jobs`);

        // Process matches page by page, delete orphans immediately
        // Limit total deletes per run to avoid timeout
        const MAX_DELETES_PER_RUN = 200;
        let deleted = 0;
        let totalChecked = 0;
        let skip = 0;
        const pageSize = 100;
        let hasMore = true;

        while (hasMore && deleted < MAX_DELETES_PER_RUN) {
            const page = await base44.asServiceRole.entities.Match.list(null, pageSize, skip);
            if (!page || page.length === 0) break;

            const orphans = page.filter(m => m.job_id && !jobIds.has(m.job_id));
            totalChecked += page.length;

            for (const match of orphans) {
                if (deleted >= MAX_DELETES_PER_RUN) break;
                await base44.asServiceRole.entities.Match.delete(match.id);
                deleted++;
                await new Promise(r => setTimeout(r, 500));
            }

            console.log(`Checked ${totalChecked} matches, deleted ${deleted} orphans so far`);

            if (page.length < pageSize) {
                hasMore = false;
            } else {
                // Advance skip only by non-deleted count (deleted items shift the list)
                skip += (page.length - orphans.length);
                await new Promise(r => setTimeout(r, 200));
            }
        }

        return Response.json({
            success: true,
            total_matches_checked: totalChecked,
            orphan_matches_deleted: deleted,
            has_more: deleted >= MAX_DELETES_PER_RUN
        });

    } catch (error) {
        console.error('Error cleaning orphan matches:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});