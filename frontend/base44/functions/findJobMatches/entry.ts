import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    try {
        const { candidateId, candidateData } = await req.json();

        if (!candidateId || !candidateData) {
            throw new Error("Missing required parameters: candidateId and candidateData");
        }

        // Optimized: Load all required data in parallel
        const [activeJobs, candidateStatuses, synonyms] = await Promise.all([
            base44.asServiceRole.entities.Job.filter({ status: 'פעילה' }),
            base44.asServiceRole.entities.CandidateStatus.list(),
            base44.asServiceRole.entities.SynonymMapping.filter({ is_active: true })
        ]);
        
        if (activeJobs.length === 0) {
            return new Response(JSON.stringify({ 
                success: true, 
                matches: [], 
                message: "No active jobs found for matching" 
            }), { 
                status: 200, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        // Find recommendation status once
        const recommendationStatus = candidateStatuses.find(s => 
            s.status_name && s.status_name.includes('המלצה אוטומטית')
        ) || { status_name: 'המלצה אוטומטית', status_number: 1 };

        // Apply synonyms helper function
        const applySynonymsToText = (text, usedSynonyms) => {
            let enhancedText = text;
            for (const synonym of synonyms) {
                const originalWord = synonym.original_word.toLowerCase();
                const synonymWord = synonym.synonym_word.toLowerCase();
                const regex = new RegExp(`\\b${originalWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
                
                if (regex.test(enhancedText)) {
                    enhancedText = enhancedText.replace(regex, `${originalWord} ${synonymWord}`);
                    if (!usedSynonyms.has(synonym.id)) {
                        usedSynonyms.add(synonym.id);
                    }
                }
            }
            return enhancedText;
        };

        const usedSynonyms = new Set();
        const matches = [];
        
        let candidateSkills = (candidateData.skills_summary || '').toLowerCase();
        let candidateFullText = (candidateData.full_text || '').toLowerCase();
        
        // Apply synonyms to candidate data
        candidateSkills = applySynonymsToText(candidateSkills, usedSynonyms);
        candidateFullText = applySynonymsToText(candidateFullText, usedSynonyms);
        
        const candidateName = `${candidateData.first_name || ''} ${candidateData.last_name || ''}`.trim();

        // Security clearance levels for comparison
        const clearanceLevels = { 'רמה 1': 4, 'רמה 2': 3, 'רמה 3': 2, 'סווג נמוך': 1, 'ללא סווג': 0 };
        
        // Pre-compile keywords for efficiency
        const techKeywords = ['java', 'python', 'javascript', 'react', 'angular', 'vue', 'nodejs', 'sql', 'oracle', 'mongodb', 'aws', 'azure', 'docker', 'kubernetes'];
        const domainKeywords = ['cyber', 'security', 'data', 'analytics', 'ai', 'frontend', 'backend', 'fullstack', 'mobile'];

        // Batch create matches to reduce database calls
        const matchesToCreate = [];

        for (const job of activeJobs) {
            let matchScore = 0;
            const matchReasons = [];

            // Security clearance matching (most important factor)
            if (candidateData.security_clearance && job.security_clearance) {
                const candidateLevel = clearanceLevels[candidateData.security_clearance] || 0;
                const jobLevel = clearanceLevels[job.security_clearance] || 0;
                
                if (candidateData.security_clearance === job.security_clearance) {
                    matchScore += 40;
                    matchReasons.push(`התאמה מלאה בסיווג בטחוני (${candidateData.security_clearance})`);
                } else if (candidateLevel >= jobLevel) {
                    matchScore += 25;
                    matchReasons.push(`סיווג בטחוני מתאים`);
                }
            }

            // Skills matching (optimized) - apply synonyms to job requirements
            let jobRequirements = `${job.requirements || ''} ${job.description || ''}`.toLowerCase();
            jobRequirements = applySynonymsToText(jobRequirements, usedSynonyms);
            
            let techMatches = 0;
            let domainMatches = 0;

            // Count keyword matches more efficiently
            for (const keyword of techKeywords) {
                if ((candidateSkills.includes(keyword) || candidateFullText.includes(keyword)) && 
                    jobRequirements.includes(keyword)) {
                    techMatches++;
                    matchScore += 3;
                }
            }

            for (const keyword of domainKeywords) {
                if ((candidateSkills.includes(keyword) || candidateFullText.includes(keyword)) && 
                    jobRequirements.includes(keyword)) {
                    domainMatches++;
                    matchScore += 5;
                }
            }

            if (techMatches > 0) matchReasons.push(`${techMatches} התאמות טכנולוגיות`);
            if (domainMatches > 0) matchReasons.push(`${domainMatches} התאמות תחום`);

            // Location matching using geo coordinates if available
            const threshold = job.geo_threshold_km || 70;
            if (candidateData.geo_latitude && candidateData.geo_longitude && job.geo_latitude && job.geo_longitude) {
                // Haversine distance calculation
                const R = 6371;
                const dLat = (job.geo_latitude - candidateData.geo_latitude) * Math.PI / 180;
                const dLon = (job.geo_longitude - candidateData.geo_longitude) * Math.PI / 180;
                const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                          Math.cos(candidateData.geo_latitude * Math.PI / 180) * Math.cos(job.geo_latitude * Math.PI / 180) *
                          Math.sin(dLon/2) * Math.sin(dLon/2);
                const distanceKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                
                if (distanceKm <= threshold) {
                    matchScore += 15;
                    matchReasons.push(`התאמה גיאוגרפית (${Math.round(distanceKm)} ק"מ)`);
                } else if (distanceKm <= 100) {
                    matchScore += 7;
                    matchReasons.push(`מרחק גיאוגרפי בינוני (${Math.round(distanceKm)} ק"מ)`);
                } else {
                    matchReasons.push(`מרחק גיאוגרפי גדול (${Math.round(distanceKm)} ק"מ) - לא מתאים`);
                }
            } else if (candidateData.city && job.location) {
                // Fallback to text matching
                const candidateCity = (candidateData.city || '').toLowerCase();
                const jobLocation = job.location.toLowerCase();
                if (candidateCity && (candidateCity.includes(jobLocation) || jobLocation.includes(candidateCity))) {
                    matchScore += 10;
                    matchReasons.push('התאמה גיאוגרפית (לפי עיר)');
                }
            }

            // Experience matching (simplified)
            const experienceKeywords = ['ניסיון', 'senior', 'lead', 'ניהול'];
            const hasExperience = experienceKeywords.some(keyword => candidateFullText.includes(keyword));
            if (hasExperience) {
                matchScore += 10;
                matchReasons.push('מועמד מנוסה');
            }

            // Only create matches above threshold
            if (matchScore >= 25) {
                matchesToCreate.push({
                    job_id: job.id,
                    job_title: job.title,
                    candidate_id: candidateId,
                    candidate_name: candidateName,
                    user_id: 'system',
                    user_name: 'מערכת אוטומטית',
                    user_app_role: 'system',
                    status: recommendationStatus.status_name,
                    status_number: recommendationStatus.status_number,
                    is_read: false,
                    match_score: matchScore,
                    match_reasons: matchReasons.join(', '),
                    is_automatic_recommendation: true
                });

                matches.push({
                    jobTitle: job.title,
                    clientName: job.client_name || 'לקוח לא ידוע',
                    matchScore: matchScore,
                    matchReasons: matchReasons
                });
            }
        }

        // Batch create all matches at once
        if (matchesToCreate.length > 0) {
            await Promise.all(
                matchesToCreate.map(matchData => 
                    base44.asServiceRole.entities.Match.create(matchData)
                )
            );
        }

        // Update synonym usage counts
        if (usedSynonyms.size > 0) {
            await Promise.all(
                Array.from(usedSynonyms).map(async (synonymId) => {
                    const synonym = synonyms.find(s => s.id === synonymId);
                    if (synonym) {
                        try {
                            await base44.asServiceRole.entities.SynonymMapping.update(synonymId, {
                                usage_count: (synonym.usage_count || 0) + 1
                            });
                        } catch (error) {
                            console.error('Error updating synonym usage:', error);
                        }
                    }
                })
            );
        }

        return new Response(JSON.stringify({ 
            success: true, 
            matches: matches,
            message: `Found ${matches.length} potential job matches for candidate`
        }), { 
            status: 200, 
            headers: { 'Content-Type': 'application/json' } 
        });

    } catch (error) {
        console.error("Error finding job matches:", error);
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
        }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
});