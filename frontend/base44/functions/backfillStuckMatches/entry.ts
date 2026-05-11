import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Fetch 50 unreviewed matches per run (small batch to avoid timeout)
    const allUnreviewed = await base44.asServiceRole.entities.Match.filter({
      carmit_reviewed_date: null,
      is_automatic_recommendation: true
    }, '-match_score', 50);

    console.log(`נמצאו ${allUnreviewed.length} התאמות לא מסווגות`);

    if (allUnreviewed.length === 0) {
      return Response.json({ success: true, total: 0, message: 'אין התאמות לטיפול' });
    }

    // Fetch existing RotemTask keys to detect duplicates
    const existingTasks = await base44.asServiceRole.entities.RotemTask.list('-created_date', 500);
    const existingTaskKeys = new Set(existingTasks.map(t => `${t.job_id}_${t.candidate_id}`));

    const reviewedDate = new Date().toISOString();
    let duplicate = 0, lowScore = 0, noJobId = 0, geoRejected = 0, pending = 0;

    // Collect all updates and run them in parallel batches of 10
    const updates = [];

    for (const match of allUnreviewed) {
      if (!match.job_id) {
        updates.push({ id: match.id, data: { carmit_reviewed_date: reviewedDate, carmit_decision: 'skipped_status', status: 'נדחה - אין משרה מוגדרת', status_number: 98 } });
        noJobId++;
      } else if (match.match_score == null || Number(match.match_score) < 80) {
        updates.push({ id: match.id, data: { carmit_reviewed_date: reviewedDate, carmit_decision: 'skipped_low_score', status: 'נדחה - ציון נמוך', status_number: 98 } });
        lowScore++;
      } else if (existingTaskKeys.has(`${match.job_id}_${match.candidate_id}`)) {
        updates.push({ id: match.id, data: { carmit_reviewed_date: reviewedDate, carmit_decision: 'skipped_duplicate', status: 'כפילות - משימה קיימת', status_number: 97 } });
        duplicate++;
      } else if (match.geo_status === 'REJECTED') {
        updates.push({ id: match.id, data: { carmit_reviewed_date: reviewedDate, carmit_decision: 'skipped_geo_rejected', status: 'נדחה - גיאוגרפיה', status_number: 95 } });
        geoRejected++;
      } else {
        // Score >= 80, has job_id, not duplicate → leave for Carmit
        pending++;
      }
    }

    // Execute updates in parallel batches of 10
    const BATCH_SIZE = 10;
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(u => base44.asServiceRole.entities.Match.update(u.id, u.data)));
    }

    const processed = duplicate + lowScore + noJobId + geoRejected;
    console.log(`סיכום: ${duplicate} כפילויות, ${lowScore} ציון נמוך, ${noJobId} ללא משרה, ${geoRejected} גיאו, ${pending} ממתינים לכרמית`);

    return Response.json({
      success: true,
      total: allUnreviewed.length,
      processed,
      duplicate,
      lowScore,
      noJobId,
      geoRejected,
      pending,
      message: `טופלו ${processed} התאמות. ${pending} נשארו לכרמית.`
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});