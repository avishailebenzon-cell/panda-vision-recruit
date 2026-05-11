import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Rebuilds search_index_text / search_index_name for candidates that are missing it.
 * Processes one batch of 20 per call.
 * Payload: { skip: 0 } (optional, defaults to 0)
 * Returns: { updated, errors, next_skip, done, remaining }
 */
Deno.serve(async (req) => {
  // DISABLED - function has been permanently disabled to save integration credits
  return Response.json({ disabled: true, message: 'פונקציה זו הושבתה לצמיתות. אין צורך לבנות מחדש את אינדקס החיפוש.' });

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    let body = {};
    try { body = await req.json(); } catch (_) {}
    const batchSize = 5;

    // Fetch only candidates missing search_index_text
    const page = await base44.asServiceRole.entities.Candidate.filter(
      { search_index_text: null },
      '-created_date',
      batchSize
    );

    console.log(`Found ${page.length} candidates still missing search_index_text`);

    if (page.length === 0) {
      return Response.json({ success: true, updated: 0, done: true, remaining: 0, message: '✅ כל המועמדים עודכנו!' });
    }

    let updated = 0;
    let errors = 0;

    for (const c of page) {
      const parts = [
        c.first_name, c.last_name, c.first_name_english, c.last_name_english,
        c.email, c.phone_primary, c.phone_secondary, c.city, c.address,
        c.id_number, c.candidate_number, c.security_clearance, c.status,
        c.skills_summary, c.main_experience, c.main_role_experience,
        c.main_discipline, c.main_tech_tools, c.main_programming_languages,
        c.education, c.education_1, c.education_2, c.education_3, c.education_level,
        c.languages, c.job_1_company, c.job_1_role, c.job_2_company, c.job_2_role,
        c.job_3_company, c.job_3_role, c.job_4_company, c.job_4_role,
        c.applying_to_company, c.applying_to_position,
        c.military_service, c.military_rank,
        Array.isArray(c.detected_skills) ? c.detected_skills.join(' ') : (c.detected_skills || ''),
        Array.isArray(c.detected_languages) ? c.detected_languages.join(' ') : (c.detected_languages || ''),
        Array.isArray(c.detected_tools) ? c.detected_tools.join(' ') : (c.detected_tools || ''),
        c.full_text ? c.full_text.substring(0, 400) : '',
      ].filter(Boolean);

      const raw = parts.join(' ').toLowerCase().replace(/[^\u05d0-\u05ea\u05f0-\u05f4a-zA-Z0-9]/g, ' ');
      const indexText = [...new Set(raw.split(/\s+/).filter((t) => t.length >= 2))].join(' ') || 'indexed';
      const indexName = [c.first_name, c.last_name, c.first_name_english, c.last_name_english]
        .filter(Boolean).join(' ').toLowerCase().trim() || 'unknown';

      try {
        await base44.asServiceRole.entities.Candidate.update(c.id, {
          search_index_text: indexText,
          search_index_name: indexName,
        });
        updated++;
        await new Promise((r) => setTimeout(r, 800));
      } catch (e) {
        errors++;
        console.error(`Failed ${c.id}: ${e.message}`);
      }
    }

    // Check how many are still missing
    const stillMissing = await base44.asServiceRole.entities.Candidate.filter(
      { search_index_text: null },
      '-created_date',
      1
    );
    const done = stillMissing.length === 0;

    return Response.json({
      success: true,
      updated,
      errors,
      done,
      message: done
        ? '✅ כל המועמדים עודכנו! אין צורך להפעיל שוב.'
        : `עדיין יש מועמדים חסרים. הפעל שוב להמשך.`
    });
  } catch (err) {
    console.error('Error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});