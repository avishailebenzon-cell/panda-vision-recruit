import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const user = await base44.auth.me();
        if (!user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        
        const logs = await base44.asServiceRole.entities.EmailRunLog.list('-created_date', 50);

        const logsArray = Array.isArray(logs) ? logs : [];

        const sanitizedLogs = logsArray.map((log, index) => {
            // "Bulletproof" check for corrupted entries
            if (typeof log !== 'object' || log === null) {
                return {
                    id: `corrupted-log-${index}`, // Use index for a stable key
                    status: 'Corrupted',
                    summary: 'Log entry was unreadable or not an object.',
                    start_time: new Date().toISOString(),
                    end_time: null,
                    emails_found: 0,
                    cvs_processed: 0,
                    candidates_created: 0,
                    errors_count: 1,
                };
            }

            const summaryText = typeof log.summary === 'string' ? log.summary : '';
            
            return {
                id: log.id || `unknown-id-${index}`, // Use index for a stable key
                start_time: log.start_time || null,
                end_time: log.end_time || null,
                status: log.status || 'Unknown',
                emails_found: log.emails_found || 0,
                cvs_processed: log.cvs_processed || 0,
                candidates_created: log.candidates_created || 0,
                errors_count: log.errors_count || 0,
                summary: summaryText.substring(0, 1500), // Truncate summary safely
            };
        });

        return new Response(JSON.stringify(sanitizedLogs), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('CRITICAL ERROR in getEmailRunLogs function:', error);
        return new Response(JSON.stringify({ error: `A critical server error occurred: ${error.message}` }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
});