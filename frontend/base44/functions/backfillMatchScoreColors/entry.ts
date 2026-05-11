import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - admin only' }, { status: 403 });
    }

    console.log('🔄 Starting backfill of match score display logic...');

    // Get all matches
    const allMatches = await base44.asServiceRole.entities.Match.list('-created_date');
    console.log(`📊 Found ${allMatches.length} total matches`);

    let processedCount = 0;
    let updatedCount = 0;
    const updates = [];

    for (const match of allMatches) {
      processedCount++;
      
      // Parse detailed_analysis
      let analysisData = null;
      try {
        if (match.detailed_analysis) {
          analysisData = typeof match.detailed_analysis === 'string' 
            ? JSON.parse(match.detailed_analysis) 
            : match.detailed_analysis;
        }
      } catch (e) {
        // Skip if can't parse
        continue;
      }

      // Check if all items are full match
      const isFullMatch = analysisData && 
        Array.isArray(analysisData) && 
        analysisData.length > 0 &&
        analysisData.every(item => item.is_match === 'true' || item.is_match === true);

      // Calculate the display_color based on new logic
      let displayColor = 'gray';
      if (match.match_score >= 80) {
        displayColor = isFullMatch ? 'green' : 'orange';
      } else if (match.match_score >= 60) {
        displayColor = 'blue';
      } else if (match.match_score >= 40) {
        displayColor = 'yellow';
      }

      // Only update if we have analysis data
      if (analysisData) {
        updates.push({
          id: match.id,
          is_full_match: isFullMatch,
          display_color: displayColor
        });
        updatedCount++;
      }

      // Log progress every 100 matches
      if (processedCount % 100 === 0) {
        console.log(`⏳ Processed ${processedCount}/${allMatches.length} matches...`);
      }
    }

    console.log(`✅ Backfill complete: ${updatedCount} matches flagged with full_match status`);
    console.log(`📝 Summary: ${updates.filter(u => u.is_full_match).length} full matches (green), ${updates.filter(u => !u.is_full_match && u.display_color === 'orange').length} partial matches (orange)`);

    return Response.json({ 
      success: true,
      processed: processedCount,
      updated: updatedCount,
      fullMatches: updates.filter(u => u.is_full_match).length,
      partialMatches: updates.filter(u => !u.is_full_match && u.display_color === 'orange').length,
      message: `עובר על ${allMatches.length} התאמות - ${updatedCount} מסומנות כהתאמה מלאה/חלקית`
    });

  } catch (error) {
    console.error('Error in backfill:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});