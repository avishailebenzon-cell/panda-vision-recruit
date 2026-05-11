import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const delay = (ms) => new Promise(r => setTimeout(r, ms));

// Bulk-reject ONE batch of pending matches per call.
// Call repeatedly (pass offset) until done.
// score < 80  → skipped_low_score
// score >= 80 but older than 30 days → skipped_stale

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const db = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const offset = body.offset || 0;
    const batchSize = 50; // small batch to stay within rate limit

    const pending = await db.entities.Match.filter(
      { is_automatic_recommendation: true, carmit_reviewed_date: null },
      '-created_date',
      batchSize,
      offset
    );

    if (!Array.isArray(pending) || pending.length === 0) {
      return Response.json({ success: true, done: true, rejected: 0, message: 'הכל טופל' });
    }

    console.log(`Processing batch offset=${offset}, size=${pending.length}`);

    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const reviewDate = new Date().toISOString();

    let lowScoreRejected = 0;
    let staleRejected = 0;

    for (const match of pending) {
      const score = match.match_score ?? 0;
      const ageMs = now - new Date(match.created_date).getTime();

      let decision = null;
      let status = null;
      let statusNumber = null;

      if (score < 80) {
        decision = 'skipped_low_score';
        status = 'נדחה - ציון נמוך';
        statusNumber = 98;
        lowScoreRejected++;
      } else if (ageMs > thirtyDaysMs) {
        decision = 'skipped_stale';
        status = 'נדחה - ממתין יותר מ-30 יום';
        statusNumber = 97;
        staleRejected++;
      }

      if (decision) {
        await db.entities.Match.update(match.id, {
          carmit_reviewed_date: reviewDate,
          carmit_decision: decision,
          status,
          status_number: statusNumber
        });
        await delay(200);
      }
    }

    const rejected = lowScoreRejected + staleRejected;
    const done = pending.length < batchSize;

    return Response.json({
      success: true,
      done,
      batch_size: pending.length,
      next_offset: done ? null : offset + batchSize,
      low_score_rejected: lowScoreRejected,
      stale_rejected: staleRejected,
      rejected,
      message: `עיבדתי ${pending.length} התאמות, דחיתי ${rejected} (${lowScoreRejected} ציון נמוך, ${staleRejected} ישנות)`
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});