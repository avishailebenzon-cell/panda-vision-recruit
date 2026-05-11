import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Resets the email scanner to re-scan ALL emails from scratch.
 * - Clears date pointers so the scanner goes backwards through all history
 * - Resets permanently_failed / skipped / failed ScannedFileLogs so they get retried
 * - Deletes failed ConversionLog entries so Word→PDF conversion is attempted again
 * - Does NOT touch already-successful ScannedFileLogs (won't re-process good ones)
 */
Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const results = {};

    // 1. Reset MailScanStatus pointers
    const statuses = await base44.asServiceRole.entities.MailScanStatus.list();
    const status = statuses[0];
    if (status) {
        await base44.asServiceRole.entities.MailScanStatus.update(status.id, {
            oldest_processed_date: null,
            last_processed_date: null,
            last_processed_email_id: null,
            is_running: false,
            is_reverse_running: false,
            reverse_scan_enabled: true,
            current_processing_file: null,
            current_scanner_message: 'ממתין לסריקה מחדש מהתחלה...',
            last_error: null,
            reverse_skip_count: 0,
            total_emails_processed: 0,
            total_candidates_created: 0,
            total_candidates_updated: 0,
        });
        results.mailScanStatus = 'reset';
        console.log('MailScanStatus reset successfully');
    }

    // 2. Reset ScannedFileLogs - fire in background without awaiting all
    // Fetch counts only - actual update happens lazily during scan (MAX_RETRY_ATTEMPTS reset)
    let resetCount = 0;
    let conversionLogsDeleted = 0;

    const [permanentLogs, skippedLogs, failedLogs] = await Promise.all([
        base44.asServiceRole.entities.ScannedFileLog.filter({ processing_status: 'permanently_failed' }, '-created_date', 2000),
        base44.asServiceRole.entities.ScannedFileLog.filter({ processing_status: 'skipped' }, '-created_date', 2000),
        base44.asServiceRole.entities.ScannedFileLog.filter({ processing_status: 'failed' }, '-created_date', 2000),
    ]);

    const allToReset = [...(permanentLogs || []), ...(skippedLogs || []), ...(failedLogs || [])];
    console.log(`Found ${allToReset.length} logs to reset - updating in background`);

    // Fire-and-forget background updates (don't await - return immediately)
    (async () => {
        for (let i = 0; i < allToReset.length; i += 20) {
            const batch = allToReset.slice(i, i + 20);
            await Promise.all(batch.map(log =>
                base44.asServiceRole.entities.ScannedFileLog.update(log.id, {
                    processing_status: 'failed',
                    retry_count: 0,
                    error_message: 'איפוס ידני - יסרק מחדש',
                }).catch(() => {})
            ));
            await new Promise(r => setTimeout(r, 50));
        }
        console.log(`Background reset complete: ${allToReset.length} logs`);
    })();

    resetCount = allToReset.length;
    results.scannedFileLogsReset = `${resetCount} (resetting in background)`;

    // 3. Delete failed ConversionLogs so Word→PDF is retried
    const convLogs = await base44.asServiceRole.entities.ConversionLog.filter(
        { status: 'failed' }, '-created_date', 500
    ).catch(() => []);
    if (convLogs && convLogs.length > 0) {
        (async () => {
            for (let i = 0; i < convLogs.length; i += 20) {
                const batch = convLogs.slice(i, i + 20);
                await Promise.all(batch.map(log =>
                    base44.asServiceRole.entities.ConversionLog.delete(log.id).catch(() => {})
                ));
                await new Promise(r => setTimeout(r, 50));
            }
            console.log(`Background conversion log delete complete: ${convLogs.length}`);
        })();
        conversionLogsDeleted = convLogs.length;
    }
    results.conversionLogsDeleted = `${conversionLogsDeleted} (deleting in background)`;
    console.log(`Queued deletion of ${conversionLogsDeleted} failed ConversionLogs`);
    return Response.json({
        success: true,
        message: 'איפוס הושלם. הסורק יתחיל לסרוק מחדש את כל תיבת המייל מהתחלה.',
        results,
    });
});