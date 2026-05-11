import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // This function is intended to be run manually/admin only
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        // 1. Fetch matches for Alik
        // We'll fetch a batch of matches to check.
        // Filtering in memory for 'detailed_analysis' existence might be safer if filter query doesn't support "exists": false perfectly in all versions
        const matches = await base44.asServiceRole.entities.Match.filter({
            user_name: 'אליק (סוכן AI)'
        }, '-created_date', 100); 

        const matchesToUpdate = matches.filter(m => !m.detailed_analysis || m.detailed_analysis === 'null');

        if (matchesToUpdate.length === 0) {
            return Response.json({ message: 'No matches found that require backfill.' });
        }

        // Process a batch (e.g. 5) to avoid timeouts
        const BATCH_SIZE = 5;
        const processingBatch = matchesToUpdate.slice(0, BATCH_SIZE);
        const results = [];

        console.log(`Found ${matchesToUpdate.length} matches to update. Processing batch of ${BATCH_SIZE}...`);

        for (const match of processingBatch) {
            try {
                // Fetch Job and Candidate
                const [jobs, candidates] = await Promise.all([
                    base44.asServiceRole.entities.Job.filter({ id: match.job_id }),
                    base44.asServiceRole.entities.Candidate.filter({ id: match.candidate_id })
                ]);

                const job = jobs[0];
                const candidate = candidates[0];

                if (!job || !candidate) {
                    console.log(`Skipping match ${match.id}: Job or Candidate not found`);
                    results.push({ matchId: match.id, status: 'skipped_missing_data' });
                    continue;
                }

                // Construct Prompt
                const prompt = `אתה אליק, מומחה אלקטרוניקה ותיק ומקצועי.
ישנה התאמה קיימת בין מועמד למשרה, ועליך לספק ניתוח מפורט עבורה בדיעבד עבור המערכת החדשה.

פרטי המשרה:
כותרת: ${job.title}
מיקום: ${job.location || 'לא צוין'}
תיאור: ${job.description || 'לא צוין'}
דרישות: ${job.requirements || 'לא צוין'}
סיווג בטחוני נדרש: ${job.security_clearance || 'לא צוין'}

פרטי המועמד:
שם: ${candidate.first_name} ${candidate.last_name}
סיווג: ${candidate.security_clearance || 'לא צוין'}
עיר: ${candidate.city || 'לא צוין'}
ניסיון: ${candidate.main_experience || 'לא צוין'}
השכלה: ${candidate.education || 'לא צוין'}
כישורים: ${candidate.skills_summary || 'לא צוין'}
שפות: ${candidate.languages || 'לא צוין'}
כלים: ${candidate.main_tech_tools || 'לא צוין'}

הוראות:
1. נתח את ההתאמה בין המועמד למשרה.
2. ספק "detailed_analysis" שהוא מערך של אובייקטים. כל אובייקט ייצג דרישה אחת מהמשרה והמענה של המועמד.
   המבנה של כל אובייקט:
   - requirement: דרישת המשרה (למשל "נסיון ב-FPGA")
   - candidate_qualification: מה יש למועמד בהקשר זה (למשל "5 שנות נסיון באלטרה")
   - is_match: האם יש התאמה בדרישה זו (true/false/partial)
3. ב-match_reasons תן סיכום קצר וקולע של ההתאמה (2-3 משפטים).

החזר JSON בלבד.`;

                const llmResponse = await base44.integrations.Core.InvokeLLM({
                    prompt,
                    response_json_schema: {
                        type: "object",
                        properties: {
                            detailed_analysis: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        requirement: { type: "string" },
                                        candidate_qualification: { type: "string" },
                                        is_match: { type: "string", enum: ["true", "false", "partial"] }
                                    },
                                    required: ["requirement", "candidate_qualification", "is_match"]
                                }
                            },
                            match_reasons: { type: "string" }
                        },
                        required: ["detailed_analysis", "match_reasons"]
                    }
                });

                // Update Match
                if (llmResponse.detailed_analysis) {
                    await base44.asServiceRole.entities.Match.update(match.id, {
                        detailed_analysis: JSON.stringify(llmResponse.detailed_analysis),
                        match_reasons: llmResponse.match_reasons
                    });
                    results.push({ matchId: match.id, candidate: match.candidate_name, status: 'updated' });
                } else {
                    results.push({ matchId: match.id, status: 'failed_llm' });
                }

            } catch (err) {
                console.error(`Error processing match ${match.id}:`, err);
                results.push({ matchId: match.id, status: 'error', error: err.message });
            }
        }

        return Response.json({ 
            processed: results.length, 
            remaining_in_this_fetch: matchesToUpdate.length - processingBatch.length,
            results 
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});