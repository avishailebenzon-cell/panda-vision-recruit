import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Batch matching: finds existing Pipedrive persons for candidates that don't have pipedrive_person_id.
 * ONLY matches (never creates) — purely a linking operation.
 * Matching priority: 1) email exact match, 2) full name exact match, 3) fuzzy Hebrew name match.
 */

const PIPEDRIVE_API_KEY = Deno.env.get('PIPEDRIVE_API_KEY');

/**
 * Normalize Hebrew name for fuzzy comparison:
 * - Remove vowel letters that are commonly omitted/added: י, ו, ה at end of words
 * - Lowercase (for English names)
 * - Collapse multiple spaces
 */
function normalizeHebrew(name) {
  if (!name) return '';
  return name
    .trim()
    .toLowerCase()
    // Remove trailing י or ה from each word (common omission in Hebrew)
    .replace(/[יה](?=\s|$)/g, '')
    // Remove ו in the middle of words when acting as mater lectionis (between consonants)
    // e.g. דוד → דד, but be conservative — only remove ו between two Hebrew letters
    .replace(/(?<=[\u05d0-\u05ea])ו(?=[\u05d0-\u05ea])/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if two names are a fuzzy Hebrew match.
 * Strategy: normalized forms must be equal, OR first+last words must both match after normalization.
 * This prevents false positives like "יוסף גרתי" matching "יוסי יוסף".
 */
function hebrewNamesMatch(nameA, nameB) {
  const normA = normalizeHebrew(nameA);
  const normB = normalizeHebrew(nameB);
  if (!normA || !normB) return false;

  // 1. Normalized forms are identical
  if (normA === normB) return true;

  const wordsA = normA.split(' ').filter(Boolean);
  const wordsB = normB.split(' ').filter(Boolean);

  // 2. Both must have at least 2 words (first + last name)
  if (wordsA.length < 2 || wordsB.length < 2) return false;

  // 3. First word AND last word must both match between the two names
  // (handles middle name insertion/removal, or extra suffix)
  const firstA = wordsA[0], lastA = wordsA[wordsA.length - 1];
  const firstB = wordsB[0], lastB = wordsB[wordsB.length - 1];

  if (firstA === firstB && lastA === lastB) return true;

  // 4. Handle case where words are same but one has an extra middle word
  // e.g. "אנה ניקול בלינסקי" vs "אנה ניקול" — first and last of shorter must appear in longer in order
  const [shorter, longer] = wordsA.length <= wordsB.length ? [wordsA, wordsB] : [wordsB, wordsA];
  if (shorter.length >= 2) {
    const shorterFirst = shorter[0];
    const shorterLast = shorter[shorter.length - 1];
    const longerFirst = longer[0];
    const longerLast = longer[longer.length - 1];
    if (shorterFirst === longerFirst && shorterLast === longerLast) return true;
  }

  return false;
}

async function searchPipedriveByEmail(email) {
  const url = `https://api.pipedrive.com/v1/persons/search?term=${encodeURIComponent(email)}&fields=email&exact_match=true&api_token=${PIPEDRIVE_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.success && data.data?.items?.length > 0) {
    return String(data.data.items[0].item.id);
  }
  return null;
}

/**
 * Search Pipedrive by name — first tries exact, then fuzzy Hebrew match against results.
 * Returns { id, method } or null.
 */
async function searchPipedriveByName(fullName) {
  // Use a shorter search term (first word) to get broader results from Pipedrive,
  // then filter locally using fuzzy match
  const firstWord = fullName.trim().split(/\s+/)[0];
  const url = `https://api.pipedrive.com/v1/persons/search?term=${encodeURIComponent(firstWord)}&fields=name&api_token=${PIPEDRIVE_API_KEY}&limit=20`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.success || !data.data?.items?.length) return null;

  const items = data.data.items;

  // 1. Exact match (case-insensitive)
  const exactMatch = items.find(i =>
    i.item.name.trim().toLowerCase() === fullName.trim().toLowerCase()
  );
  if (exactMatch) return { id: String(exactMatch.item.id), method: 'name_exact' };

  // 2. Fuzzy Hebrew match
  const fuzzyMatch = items.find(i => hebrewNamesMatch(i.item.name, fullName));
  if (fuzzyMatch) return { id: String(fuzzyMatch.item.id), method: 'name_fuzzy', pipedriveNameFound: fuzzyMatch.item.name };

  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    if (!PIPEDRIVE_API_KEY) {
      return Response.json({ error: 'PIPEDRIVE_API_KEY not configured' }, { status: 500 });
    }

    console.log('=== Starting batch Pipedrive person matching ===');

    // Support pagination via offset — run multiple times to cover all candidates
    const body = await req.json().catch(() => ({}));
    const BATCH_SIZE = 200;
    const offset = body.offset || 0;

    const allCandidates = await base44.asServiceRole.entities.Candidate.list('-created_date', 10000);
    const allUnlinked = allCandidates.filter(c => !c.pipedrive_person_id || c.pipedrive_person_id.trim() === '');
    const unlinked = allUnlinked.slice(offset, offset + BATCH_SIZE);

    console.log(`Total candidates: ${allCandidates.length}, total unlinked: ${allUnlinked.length}, processing batch offset=${offset} size=${unlinked.length}`);

    let matchedByEmail = 0;
    let matchedByNameExact = 0;
    let matchedByNameFuzzy = 0;
    let notFound = 0;
    let errors = 0;

    for (const candidate of unlinked) {
      try {
        const fullName = candidate.full_name || `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim();
        let personId = null;
        let method = '';
        let extraInfo = '';

        // 1. Try email match
        if (candidate.email) {
          const emailId = await searchPipedriveByEmail(candidate.email);
          if (emailId) {
            personId = emailId;
            method = 'email';
          }
        }

        // 2. Try name match (exact + fuzzy Hebrew)
        if (!personId && fullName && fullName.length > 2) {
          const nameResult = await searchPipedriveByName(fullName);
          if (nameResult) {
            personId = nameResult.id;
            method = nameResult.method;
            if (nameResult.pipedriveNameFound) {
              extraInfo = ` (Pipedrive: "${nameResult.pipedriveNameFound}")`;
            }
          }
        }

        if (personId) {
          await base44.asServiceRole.entities.Candidate.update(candidate.id, {
            pipedrive_person_id: personId,
            pipedrive_synced: true,
            pipedrive_sync_date: new Date().toISOString()
          });

          if (method === 'email') matchedByEmail++;
          else if (method === 'name_exact') matchedByNameExact++;
          else matchedByNameFuzzy++;

          console.log(`✅ Matched [${method}]: ${fullName}${extraInfo} → Pipedrive ID ${personId}`);
        } else {
          notFound++;
        }

        // Rate limit: 200ms between requests
        await new Promise(r => setTimeout(r, 200));

      } catch (err) {
        errors++;
        console.error(`Error matching ${candidate.full_name}:`, err.message);
        await new Promise(r => setTimeout(r, 500));
      }
    }

    const nextOffset = offset + BATCH_SIZE;
    const hasMore = nextOffset < allUnlinked.length;

    const totalMatched = matchedByEmail + matchedByNameExact + matchedByNameFuzzy;

    const summary = {
      success: true,
      total_unlinked: allUnlinked.length,
      batch_offset: offset,
      batch_size: unlinked.length,
      matched_by_email: matchedByEmail,
      matched_by_name_exact: matchedByNameExact,
      matched_by_name_fuzzy: matchedByNameFuzzy,
      total_matched: totalMatched,
      not_found: notFound,
      errors,
      has_more: hasMore,
      next_offset: hasMore ? nextOffset : null
    };

    console.log('=== Matching complete ===', summary);

    try {
      await base44.asServiceRole.entities.SystemActivityLog.create({
        actor_type: 'system',
        actor_name: 'scheduler',
        action_type: 'pipedrive_sync',
        action_description: `תיאום מועמדים עם Pipedrive (batch offset=${offset}): ${totalMatched} תואמו (${matchedByEmail} מייל, ${matchedByNameExact} שם מדויק, ${matchedByNameFuzzy} שם מקורב עברית), ${notFound} לא נמצאו`,
        status: 'success',
        details: JSON.stringify(summary)
      });
    } catch (logErr) {
      console.warn('Failed to log:', logErr.message);
    }

    return Response.json(summary);

  } catch (error) {
    console.error('Fatal error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});