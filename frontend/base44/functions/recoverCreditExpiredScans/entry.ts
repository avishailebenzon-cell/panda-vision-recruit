import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * recoverCreditExpiredScans
 *
 * Runs automatically at the start of each month (scheduled automation).
 * Finds all ScannedFileLog entries that permanently failed due to credit/quota
 * exhaustion, resets them so the scanner retries them with fresh credits.
 *
 * Strategy:
 *  1. Find permanently_failed files from the last 60 days
 *  2. If their error contains credit/quota keywords → guaranteed credit failure
 *     If not, still reset them if they are recent (within 60 days) — they
 *     deserve a retry with a fresh month of credits anyway.
 *  3. Reset processing_status → "failed", retry_count → 0
 *  4. Log summary to SystemActivityLog
 */

const CREDIT_ERROR_KEYWORDS = [
  'credit', 'credits', 'quota', 'insufficient', 'exceeded', 'limit reached',
  'budget', 'billing', 'rate limit', 'too many requests', '429',
  'plan limit', 'monthly limit', 'usage limit'
];

function isCreditError(errorMessage) {
  if (!errorMessage) return false;
  const lower = errorMessage.toLowerCase();
  return CREDIT_ERROR_KEYWORDS.some(kw => lower.includes(kw));
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Allow both admin users and service-role (scheduled automation)
  let isAuthorized = false;
  try {
    const user = await base44.auth.me();
    if (user && (user.role === 'admin' || user.role === 'system')) {
      isAuthorized = true;
    }
  } catch (_) {
    // No user context = called from automation (service role) — allowed
    isAuthorized = true;
  }

  if (!isAuthorized) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  console.log('=== CREDIT RECOVERY SCAN STARTED ===');

  try {
    // Determine time window — default 60 days for monthly run, 7 days for manual recovery
    const body = req.method === 'POST' ? (await req.json().catch(() => ({}))) : {};
    const daysBack = body.days_back || 60;
    const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

    console.log(`Looking for failed files in last ${daysBack} days (since ${cutoffDate})`);

    // Find permanently_failed files
    const permanentlyFailedRaw = await base44.asServiceRole.entities.ScannedFileLog.filter({
      processing_status: 'permanently_failed'
    }, '-created_date', 5000);
    const permanentlyFailed = Array.isArray(permanentlyFailedRaw) ? permanentlyFailedRaw : [];

    // Also find regular failed files (may have retry_count maxed out)
    const regularFailedRaw = await base44.asServiceRole.entities.ScannedFileLog.filter({
      processing_status: 'failed'
    }, '-created_date', 5000);
    const regularFailed = Array.isArray(regularFailedRaw) ? regularFailedRaw : [];

    // Combine and filter by time window
    const allFailed = [...permanentlyFailed, ...regularFailed];
    const recentFailed = allFailed.filter(log => {
      const logDate = log.updated_date || log.created_date;
      return logDate && logDate >= cutoffDate;
    });

    console.log(`Found ${permanentlyFailed.length} permanently_failed, ${regularFailed.length} failed — ${recentFailed.length} within last ${daysBack} days`);

    if (recentFailed.length === 0) {
      return Response.json({
        success: true,
        message: `No failed files found in last ${daysBack} days — nothing to recover`,
        recovered: 0
      });
    }

    // Separate credit-errors from other errors for logging
    const creditErrors = recentFailed.filter(log => isCreditError(log.error_message));
    const otherErrors = recentFailed.filter(log => !isCreditError(log.error_message));

    console.log(`Credit-related failures: ${creditErrors.length}`);
    console.log(`Other failures (also resetting for fresh retry): ${otherErrors.length}`);

    // Reset ALL recent permanently_failed files to failed + retry_count 0
    let recoveredCount = 0;
    let failedToReset = 0;

    for (const log of recentFailed) {
      try {
        await base44.asServiceRole.entities.ScannedFileLog.update(log.id, {
          processing_status: 'failed',
          retry_count: 0,
          error_message: `[אופס קרדיטים - ניסיון מחודש אוטומטי] ${log.error_message || ''}`.substring(0, 500)
        });
        recoveredCount++;
      } catch (err) {
        if (err.message && err.message.includes('Rate limit')) {
          // Back off and retry once
          await new Promise(r => setTimeout(r, 2000));
          try {
            await base44.asServiceRole.entities.ScannedFileLog.update(log.id, {
              processing_status: 'failed',
              retry_count: 0,
              error_message: `[אופס קרדיטים] ${log.error_message || ''}`.substring(0, 500)
            });
            recoveredCount++;
          } catch (retryErr) {
            console.error(`Failed again for ${log.id}:`, retryErr.message);
            failedToReset++;
          }
        } else {
          console.error(`Failed to reset log ${log.id}:`, err.message);
          failedToReset++;
        }
      }
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 150));
    }

    console.log(`Reset ${recoveredCount} files to retry-eligible status`);

    // (retry count reset is already handled above for all recentFailed)
    const retryResetCount = 0;

    // Log to SystemActivityLog
    const summary = `שחזור סריקה אחרי ניצול קרדיטים: ${recoveredCount} קבצים שוחזרו (${creditErrors.length} שגיאות קרדיטים, ${otherErrors.length} שגיאות אחרות), ${retryResetCount} ניסיונות חוזרים אופסו`;

    try {
      await base44.asServiceRole.entities.SystemActivityLog.create({
        actor_type: 'agent',
        actor_name: 'raviv',
        actor_image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face',
        action_type: 'credit_recovery',
        action_description: summary,
        status: 'success',
        details: JSON.stringify({
          totalRecovered: recoveredCount,
          creditErrors: creditErrors.length,
          otherErrors: otherErrors.length,
          retryCountsReset: retryResetCount,
          failedToReset
        })
      });
    } catch (logErr) {
      console.warn('Failed to log to SystemActivityLog:', logErr.message);
    }

    console.log('=== CREDIT RECOVERY SCAN COMPLETED ===');
    console.log(summary);

    return Response.json({
      success: true,
      message: summary,
      recovered: recoveredCount,
      creditErrors: creditErrors.length,
      otherErrors: otherErrors.length,
      retryCountsReset: retryResetCount,
      failedToReset
    });

  } catch (error) {
    console.error('Credit recovery failed:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});