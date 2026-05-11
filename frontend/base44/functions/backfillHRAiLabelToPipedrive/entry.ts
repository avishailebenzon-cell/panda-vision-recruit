import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const PIPEDRIVE_API_KEY = Deno.env.get('PIPEDRIVE_API_KEY');
const HRAI_PREFIX = '[HRAi]';
const BATCH_SIZE = 30; // items per run to avoid timeout

async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      if ([429, 502, 503, 504].includes(response.status)) {
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, attempt * 2000));
          continue;
        }
      }
      const errorText = await response.text();
      throw new Error(`Pipedrive API error (${response.status}): ${errorText.substring(0, 200)}`);
    } catch (err) {
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, attempt * 2000));
        continue;
      }
      throw err;
    }
  }
}

async function updateBatch(entityType, startOffset) {
  const res = await fetchWithRetry(
    `https://api.pipedrive.com/v1/${entityType}?limit=${BATCH_SIZE}&start=${startOffset}&api_token=${PIPEDRIVE_API_KEY}`
  );
  const data = await res.json();
  const items = data.success ? (data.data || []) : [];
  const hasMore = data.additional_data?.pagination?.more_items_in_collection || false;

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of items) {
    const field = entityType === 'notes' ? 'content' : 'subject';
    const value = item[field];
    if (!value || value.startsWith(HRAI_PREFIX)) { skipped++; continue; }

    try {
      await fetchWithRetry(
        `https://api.pipedrive.com/v1/${entityType}/${item.id}?api_token=${PIPEDRIVE_API_KEY}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: `${HRAI_PREFIX} ${value}` })
        }
      );
      updated++;
      await new Promise(r => setTimeout(r, 150));
    } catch(e) {
      console.error(`Failed to update ${entityType} ${item.id}: ${e.message}`);
      failed++;
    }
  }

  return { updated, skipped, failed, hasMore, nextOffset: startOffset + BATCH_SIZE };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch(e) { /* unauthenticated */ }

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    if (!PIPEDRIVE_API_KEY) {
      return Response.json({ error: 'PIPEDRIVE_API_KEY not configured' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    // type: 'notes' | 'activities' (default: notes)
    // offset: starting position (default: 0)
    const entityType = body.type === 'activities' ? 'activities' : 'notes';
    const offset = parseInt(body.offset || '0', 10);

    console.log(`Backfilling HRAi label: ${entityType} from offset ${offset}...`);
    const result = await updateBatch(entityType, offset);

    const response = {
      success: true,
      type: entityType,
      offset,
      ...result,
      // Instructions for next batch if needed
      nextCall: result.hasMore
        ? { type: entityType, offset: result.nextOffset }
        : null,
      message: result.hasMore
        ? `יש עוד פריטים! קרא שוב עם offset: ${result.nextOffset}`
        : `סיום! כל ה-${entityType} עודכנו.`
    };

    console.log('Batch result:', response);
    return Response.json(response);

  } catch (error) {
    console.error('Backfill HRAi label error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});