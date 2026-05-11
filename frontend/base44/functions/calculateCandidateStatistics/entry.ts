import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const startTime = Date.now();
  
  try {
    const base44 = createClientFromRequest(req);
    
    // Classification keywords per discipline
    const disciplineKeywords = {
      'תוכנה': ['c++', 'python', 'java', 'javascript', 'react', 'angular', 'vue', 'node', 'frontend', 'backend', 'fullstack', 'embedded', 'firmware', 'software', 'developer', 'מפתח', 'תוכנה'],
      'אלקטרוניקה': ['pcb', 'fpga', 'analog', 'digital', 'hardware', 'electronics', 'schematic', 'אלקטרוניקה', 'חשמל', 'מעגלים'],
      'IT': ['devops', 'cloud', 'aws', 'azure', 'gcp', 'network', 'security', 'cyber', 'sysadmin', 'helpdesk', 'noc', 'dba', 'infrastructure', 'it', 'מחשוב', 'תשתיות', 'סייבר'],
      'הנדסת מערכת': ['system engineer', 'systems engineer', 'integration', 'requirements', 'architect', 'הנדסת מערכת', 'אינטגרציה', 'דרישות'],
      'מכונות': ['mechanical', 'cad', 'solidworks', 'autocad', 'inventor', 'catia', 'manufacturing', 'מכונות', 'מכני'],
      'QA': ['qa', 'quality', 'testing', 'test', 'automation', 'selenium', 'cypress', 'בדיקות', 'איכות', 'טסטר']
    };
    
    // Initialize counters
    const byDiscipline = {
      'תוכנה': 0,
      'אלקטרוניקה': 0,
      'IT': 0,
      'הנדסת מערכת': 0,
      'מכונות': 0,
      'QA': 0,
      'כללי': 0
    };
    
    const byStatus = {};
    const bySeniority = {
      'Junior': 0,
      'Intermediate': 0,
      'Senior': 0,
      'Expert': 0,
      'לא מוגדר': 0
    };
    const bySecurityClearance = {};
    
    // Load candidates in batches
    const batchSize = 100;
    let skip = 0;
    let totalCandidates = 0;
    let hasMore = true;
    
    console.log('Starting candidate statistics calculation...');
    
    while (hasMore) {
      const batch = await base44.asServiceRole.entities.Candidate.filter(
        {}, 
        '-created_date', 
        batchSize,
        skip
      );
      
      if (batch.length === 0) {
        hasMore = false;
        break;
      }
      
      console.log(`Processing batch ${skip / batchSize + 1}: ${batch.length} candidates`);
      
      totalCandidates += batch.length;
      
      batch.forEach(candidate => {
        // Count by status
        const status = candidate.status || 'לא מוגדר';
        byStatus[status] = (byStatus[status] || 0) + 1;
        
        // Count by seniority
        const seniority = candidate.overall_seniority_level || 'לא מוגדר';
        if (bySeniority.hasOwnProperty(seniority)) {
          bySeniority[seniority]++;
        } else {
          bySeniority['לא מוגדר']++;
        }
        
        // Count by security clearance
        const clearance = candidate.security_clearance || 'לא רלוונטי';
        bySecurityClearance[clearance] = (bySecurityClearance[clearance] || 0) + 1;
        
        // Classify by discipline
        const searchText = [
          candidate.skills_summary,
          candidate.main_experience,
          candidate.main_tech_tools,
          candidate.main_programming_languages,
          candidate.detected_skills?.join(' '),
          candidate.detected_languages?.join(' '),
          candidate.detected_tools?.join(' '),
          candidate.main_discipline,
          candidate.desired_field
        ].filter(Boolean).join(' ').toLowerCase();
        
        let classified = false;
        
        for (const [discipline, keywords] of Object.entries(disciplineKeywords)) {
          const hasMatch = keywords.some(keyword => searchText.includes(keyword));
          if (hasMatch) {
            byDiscipline[discipline]++;
            classified = true;
            break;
          }
        }
        
        if (!classified) {
          byDiscipline['כללי']++;
        }
      });
      
      if (batch.length < batchSize) {
        hasMore = false;
      } else {
        skip += batchSize;
      }
    }
    
    console.log(`Processed ${totalCandidates} candidates total`);
    
    // Save statistics
    const statisticsData = {
      total_candidates: totalCandidates,
      by_discipline: byDiscipline,
      by_status: byStatus,
      by_seniority: bySeniority,
      by_security_clearance: bySecurityClearance,
      last_calculated: new Date().toISOString(),
      calculation_duration_ms: Date.now() - startTime
    };
    
    const existing = await base44.asServiceRole.entities.CandidateStatistics.list();
    
    if (existing.length > 0) {
      await base44.asServiceRole.entities.CandidateStatistics.update(existing[0].id, statisticsData);
      console.log('Updated existing statistics record');
    } else {
      await base44.asServiceRole.entities.CandidateStatistics.create(statisticsData);
      console.log('Created new statistics record');
    }
    
    console.log(`Calculation completed in ${Date.now() - startTime}ms`);
    console.log('By Discipline:', byDiscipline);
    
    return Response.json({
      success: true,
      statistics: statisticsData
    });
  } catch (error) {
    console.error('Error calculating statistics:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});