import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Called by entity automation whenever a Candidate is created or updated.
 * Updates search_index_text and search_index_name for that specific candidate.
 */
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const body = await req.json();

        // Support both: direct call with candidate_id, and entity automation payload
        const candidateId = body.candidate_id || body.event?.entity_id;
        let candidate = body.data || null;

        if (!candidateId) {
            return Response.json({ error: 'candidate_id required' }, { status: 400 });
        }

        // If full candidate data not provided (or payload_too_large), fetch it
        if (!candidate || body.payload_too_large) {
            candidate = await base44.asServiceRole.entities.Candidate.list();
            candidate = candidate.find(c => c.id === candidateId);
        }

        if (!candidate) {
            return Response.json({ error: 'Candidate not found' }, { status: 404 });
        }

        const indexText = buildSearchIndexText(candidate);
        const indexName = buildSearchIndexName(candidate);

        await base44.asServiceRole.entities.Candidate.update(candidateId, {
            search_index_text: indexText,
            search_index_name: indexName
        });

        console.log(`Search index updated for candidate ${candidateId}: ${indexName}`);

        return Response.json({ success: true, candidate_id: candidateId });

    } catch (error) {
        console.error('updateCandidateSearchIndex error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

function buildSearchIndexText(c) {
    const parts = [
        c.first_name, c.last_name, c.first_name_english, c.last_name_english,
        c.email, c.phone_primary, c.phone_secondary,
        c.city, c.address, c.id_number, c.candidate_number,
        c.security_clearance, c.status,
        c.skills_summary, c.main_experience, c.main_role_experience,
        c.main_discipline, c.main_tech_tools, c.main_programming_languages,
        c.education, c.education_1, c.education_2, c.education_3, c.education_level,
        c.languages,
        c.job_1_company, c.job_1_role,
        c.job_2_company, c.job_2_role,
        c.job_3_company, c.job_3_role,
        c.job_4_company, c.job_4_role,
        c.job_5_company, c.job_5_role,
        c.detected_skills ? (Array.isArray(c.detected_skills) ? c.detected_skills.join(' ') : c.detected_skills) : null,
        c.detected_languages ? (Array.isArray(c.detected_languages) ? c.detected_languages.join(' ') : c.detected_languages) : null,
        c.detected_tools ? (Array.isArray(c.detected_tools) ? c.detected_tools.join(' ') : c.detected_tools) : null,
        c.secondary_disciplines ? (Array.isArray(c.secondary_disciplines) ? c.secondary_disciplines.join(' ') : c.secondary_disciplines) : null,
        c.applying_to_company, c.applying_to_position,
        c.military_service, c.military_rank,
        c.hobbies, c.references,
        c.full_text ? c.full_text.substring(0, 300) : null,
    ].filter(Boolean);

    const rawText = parts.join(' ').toLowerCase();
    const normalized = rawText.replace(/[^\u05d0-\u05ea\u05f0-\u05f4a-zA-Z0-9]/g, ' ');
    const tokens = normalized.split(/\s+/).filter(t => t.length >= 2);
    const unique = [...new Set(tokens)];
    return unique.join(' ');
}

function buildSearchIndexName(c) {
    return [c.first_name, c.last_name, c.first_name_english, c.last_name_english]
        .filter(Boolean).join(' ').toLowerCase().trim();
}