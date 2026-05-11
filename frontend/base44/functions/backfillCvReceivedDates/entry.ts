import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    // Process in batches to avoid timeout - get only 100 candidates per run
    const BATCH_SIZE = 100;
    
    // Also catch dates that were saved without 'Z' suffix (broken format from Python datetime)
    const candidatesWithoutDate = await base44.asServiceRole.entities.Candidate.filter(
      { $or: [
        { cv_received_date: { $exists: false } },
        { cv_received_date: null }
      ]},
      '-created_date',
      BATCH_SIZE
    );

    // Fix candidates that have cv_received_date but in broken format (missing Z suffix)
    let allCandidates = await base44.asServiceRole.entities.Candidate.list('-created_date', 500);
    if (!Array.isArray(allCandidates)) allCandidates = [];
    const brokenDateCandidates = allCandidates.filter(c => {
      if (!c.cv_received_date) return false;
      const d = c.cv_received_date.toString();
      // Broken format: has microseconds (6 digits after dot) but no Z
      return /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(d);
    });

    console.log(`Found ${brokenDateCandidates.length} candidates with broken date format`);
    let fixedDates = 0;
    for (const c of brokenDateCandidates) {
      try {
        // Convert Python datetime format to proper ISO UTC string
        const fixedDate = c.cv_received_date.toString().replace(/(\.\d{3})\d{3}$/, '$1Z');
        await base44.asServiceRole.entities.Candidate.update(c.id, { cv_received_date: fixedDate });
        fixedDates++;
      } catch (e) {
        console.error(`Failed to fix date for ${c.full_name}:`, e.message);
      }
    }
    console.log(`Fixed ${fixedDates} broken date formats`);
    
    console.log(`Processing ${candidatesWithoutDate.length} candidates (batch of ${BATCH_SIZE})`);
    
    let updated = 0;
    let skipped = 0;
    const details = [];
    
    for (const candidate of candidatesWithoutDate) {
      try {
        // Priority 1: Use source_email_date if available (most accurate)
        if (candidate.source_email_date) {
          await base44.asServiceRole.entities.Candidate.update(candidate.id, {
            cv_received_date: candidate.source_email_date
          });
          
          updated++;
          details.push({
            name: candidate.full_name,
            method: 'source_email_date',
            date: candidate.source_email_date
          });
          continue;
        }
        
        // Priority 2: Extract all job end dates
        const endDates = [
          candidate.job_1_end_date,
          candidate.job_2_end_date,
          candidate.job_3_end_date,
          candidate.job_4_end_date,
          candidate.job_5_end_date
        ].filter(Boolean);
        
        if (endDates.length === 0) {
          // No job dates - use created_date as fallback
          if (candidate.created_date) {
            await base44.asServiceRole.entities.Candidate.update(candidate.id, {
              cv_received_date: candidate.created_date
            });
            
            updated++;
            details.push({
              name: candidate.full_name,
              method: 'created_date',
              date: candidate.created_date
            });
          } else {
            skipped++;
            details.push({
              name: candidate.full_name,
              method: 'skipped',
              reason: 'no dates available'
            });
          }
          continue;
        }
        
        // Parse dates and find the latest year
        const years = endDates.map(dateStr => {
          // Try to extract year from various formats
          const yearMatch = dateStr.match(/\d{4}/);
          return yearMatch ? parseInt(yearMatch[0]) : null;
        }).filter(y => y !== null && y > 1970 && y < 2030);
        
        if (years.length === 0) {
          // No valid years found - use created_date
          if (candidate.created_date) {
            await base44.asServiceRole.entities.Candidate.update(candidate.id, {
              cv_received_date: candidate.created_date
            });
            
            updated++;
            details.push({
              name: candidate.full_name,
              method: 'created_date',
              date: candidate.created_date
            });
          } else {
            skipped++;
            details.push({
              name: candidate.full_name,
              method: 'skipped',
              reason: 'no valid years'
            });
          }
          continue;
        }
        
        // Get the latest year
        const latestYear = Math.max(...years);
        
        // Estimate CV received date as 1.1 of the year AFTER the latest job end year
        const estimatedYear = latestYear + 1;
        const cvReceivedDate = `${estimatedYear}-01-01T00:00:00Z`;
        
        await base44.asServiceRole.entities.Candidate.update(candidate.id, {
          cv_received_date: cvReceivedDate
        });
        
        updated++;
        details.push({
          name: candidate.full_name,
          method: 'estimated',
          latest_job_year: latestYear,
          estimated_cv_date: cvReceivedDate
        });
        
      } catch (error) {
        console.error(`Error processing candidate ${candidate.id}:`, error);
        skipped++;
        details.push({
          name: candidate.full_name,
          method: 'error',
          error: error.message
        });
      }
    }
    
    // Check if there are more candidates to process
    const remainingCount = await base44.asServiceRole.entities.Candidate.filter(
      { $or: [
        { cv_received_date: { $exists: false } },
        { cv_received_date: null }
      ]},
      '-created_date',
      1
    );
    
    const hasMore = remainingCount.length > 0;
    
    // Log to system activity
    await base44.asServiceRole.entities.SystemActivityLog.create({
      actor_type: 'user',
      actor_name: user.full_name,
      action_type: 'data_cleanup',
      action_description: `עדכון מועד הגעת קו"ח - עובד ${updated} מועמדים (Batch)`,
      status: 'success',
      details: JSON.stringify({
        batch_size: candidatesWithoutDate.length,
        updated,
        skipped,
        has_more: hasMore,
        sample_details: details.slice(0, 10)
      })
    });
    
    return Response.json({
      success: true,
      batch_processed: candidatesWithoutDate.length,
      updated,
      skipped,
      fixed_broken_dates: fixedDates,
      has_more: hasMore,
      message: hasMore 
        ? `עובדו ${updated} מועמדים בהצלחה. יש עוד מועמדים לעדכון - הרץ שוב להמשך.`
        : `הושלם! עודכנו ${updated} מועמדים, תוקנו ${fixedDates} תאריכים שגויים.`,
      details: details.slice(0, 20)
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});