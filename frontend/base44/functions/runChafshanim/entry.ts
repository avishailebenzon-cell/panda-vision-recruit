import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const CHAFSHANIM = {
  rafael: { regex: /רפאל|rafael|raphael/i },
  elbit: { regex: /אלביט|elbit|\bimi\b|תע"ש|תעש|אלאופ|elop/i },
  taa: { regex: /תעשייה אווירית|תע"א|תעא|\biai\b|israel aerospace/i },
  rama1: { regex: /סיווג.{0,20}רמה.{0,10}1|רמה 1/i, checkClearance: true },
};

async function loadCustomChafshanim(base44) {
  try {
    const customs = await base44.asServiceRole.entities.CustomChafshanConfig.filter({ is_active: true });
    return (customs || []).map(cfg => ({
      id: cfg.id,
      name: cfg.name,
      search_type: cfg.search_type,
      search_keywords: cfg.search_keywords || '',
      security_clearance_value: cfg.security_clearance_value || '',
      search_fields: cfg.search_fields || ['job_companies'],
      min_keyword_length: cfg.min_keyword_length || 3,
    }));
  } catch (e) {
    console.warn('[Chafshanim] Could not load custom configs:', e.message);
    return [];
  }
}

function buildCustomSearchText(candidate, searchFields) {
  const parts = [];
  if (searchFields.includes('job_companies')) {
    for (let i = 1; i <= 5; i++) if (candidate[`job_${i}_company`]) parts.push(candidate[`job_${i}_company`]);
  }
  if (searchFields.includes('job_descriptions')) {
    for (let i = 1; i <= 3; i++) if (candidate[`job_${i}_description`]) parts.push(candidate[`job_${i}_description`]);
  }
  if (searchFields.includes('job_roles')) {
    for (let i = 1; i <= 5; i++) if (candidate[`job_${i}_role`]) parts.push(candidate[`job_${i}_role`]);
  }
  if (searchFields.includes('main_experience') && candidate.main_experience) parts.push(candidate.main_experience);
  if (searchFields.includes('full_text') && candidate.full_text) parts.push(candidate.full_text);
  if (searchFields.includes('skills_summary') && candidate.skills_summary) parts.push(candidate.skills_summary);
  if (searchFields.includes('military_service') && candidate.military_service) parts.push(candidate.military_service);
  if (searchFields.includes('education') && candidate.education) parts.push(candidate.education);
  return parts.join(' ').slice(0, 15000);
}

function buildCustomKeywordRegex(keywordsStr) {
  const keywords = keywordsStr.split(',').map(k => k.trim()).filter(Boolean);
  const escaped = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(escaped.join('|'), 'i');
}

function buildSearchText(c) {
  return [
    c.job_1_company, c.job_1_description, c.job_1_role,
    c.job_2_company, c.job_2_description, c.job_2_role,
    c.job_3_company, c.job_3_role,
    c.job_4_company, c.job_5_company,
    c.jobs_history_structured,
    c.main_experience,
  ].filter(Boolean).join(' ').slice(0, 15000);
}

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // ── Entity automation: single new candidate ──
    if (body.event && body.event.entity_id) {
      let candidates = [];
      if (body.data && !body.payload_too_large) {
        candidates = [body.data];
      } else {
        candidates = await base44.asServiceRole.entities.Candidate.filter({ id: body.event.entity_id });
      }
      const customChafshanim = await loadCustomChafshanim(base44);
      const result = await processBatchWithExistingCheck(base44, candidates, customChafshanim);
      return Response.json({ success: true, ...result });
    }

    // ── Full scan (manual or background continuation) ──
    // Require auth only for the FIRST call (skip=0); continuations come from backend self-invoke
    const skip = body.skip || 0;
    const batchSize = 150;
    const isFirstCall = skip === 0;

    if (isFirstCall) {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const candidates = await base44.asServiceRole.entities.Candidate.list('-created_date', batchSize, skip);

    if (!candidates || candidates.length === 0) {
      console.log(`[Chafshanim] Done. Total skip reached: ${skip}`);
      return Response.json({ success: true, candidates_processed: 0, results_created: 0, done: true });
    }

    const customChafshanim = await loadCustomChafshanim(base44);
    const { processed, created } = await processBatchWithExistingCheck(base44, candidates, customChafshanim);

    console.log(`[Chafshanim] Batch skip=${skip}: processed=${processed}, created=${created}`);

    // If there are more candidates, self-invoke the next batch in the background (fire-and-forget)
    if (candidates.length === batchSize) {
      const nextSkip = skip + batchSize;
      base44.asServiceRole.functions.invoke('runChafshanim', { skip: nextSkip }).catch(e => {
        console.error(`[Chafshanim] Failed to invoke next batch skip=${nextSkip}:`, e.message);
      });
    } else {
      console.log(`[Chafshanim] Full scan complete at skip=${skip + candidates.length}`);
    }

    return Response.json({ success: true, candidates_processed: processed, results_created: created });

  } catch (error) {
    console.error('runChafshanim error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function processBatchWithExistingCheck(base44, candidates, customChafshanim = []) {
  const candidateIds = candidates.map(c => c.id);

  // Load existing results for these candidates only
  const existingResults = await base44.asServiceRole.entities.ChafshanResult.filter(
    { candidate_id: { '$in': candidateIds } }
  );
  const existingSet = new Set((existingResults || []).map(r => `${r.chafshan_type}_${r.candidate_id}`));

  let created = 0;
  for (const candidate of candidates) {
    const searchText = buildSearchText(candidate);
    const name = candidate.full_name || `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim();

    // Built-in chafshanim
    for (const [type, cfg] of Object.entries(CHAFSHANIM)) {
      const key = `${type}_${candidate.id}`;
      if (existingSet.has(key)) continue;

      let matched = false;
      let detectedText = '';

      if (cfg.checkClearance && candidate.security_clearance === 'רמה 1') {
        matched = true;
        detectedText = 'סיווג בטחוני: רמה 1';
      } else {
        const m = searchText.match(cfg.regex);
        if (m) { matched = true; detectedText = m[0]; }
      }

      if (matched) {
        await base44.asServiceRole.entities.ChafshanResult.create({
          chafshan_type: type,
          candidate_id: candidate.id,
          candidate_name: name,
          candidate_phone: candidate.phone_primary || '',
          candidate_city: candidate.city || '',
          security_clearance: candidate.security_clearance || '',
          detected_text: detectedText,
          resume_file_url: candidate.resume_file_url || '',
        });
        existingSet.add(key);
        created++;
        await delay(30);
      }
    }

    // Custom chafshanim
    for (const custom of customChafshanim) {
      const typeKey = `custom_${custom.id}`;
      const key = `${typeKey}_${candidate.id}`;
      if (existingSet.has(key)) continue;

      let matched = false;
      let detectedText = '';

      if (custom.search_type === 'exact_security_clearance') {
        if (candidate.security_clearance === custom.security_clearance_value) {
          matched = true;
          detectedText = `סיווג בטחוני: ${custom.security_clearance_value}`;
        }
      } else {
        const customText = buildCustomSearchText(candidate, custom.search_fields);
        const regex = buildCustomKeywordRegex(custom.search_keywords);
        const m = customText.match(regex);
        if (m) { matched = true; detectedText = m[0]; }
      }

      if (matched) {
        await base44.asServiceRole.entities.ChafshanResult.create({
          chafshan_type: typeKey,
          candidate_id: candidate.id,
          candidate_name: name,
          candidate_phone: candidate.phone_primary || '',
          candidate_city: candidate.city || '',
          security_clearance: candidate.security_clearance || '',
          detected_text: detectedText,
          resume_file_url: candidate.resume_file_url || '',
        });
        existingSet.add(key);
        created++;
        await delay(30);
      }
    }
  }

  return { processed: candidates.length, created };
}