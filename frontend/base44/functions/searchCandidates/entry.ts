import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Fast candidate search using pre-built search_index_text and search_index_name fields.
 * 
 * Strategy:
 * 1. Fetch ALL candidates via service role (to avoid pagination cap)
 * 2. Apply fast in-memory text search on indexed fields
 * 3. Apply equality filters (security, status)
 * 4. Sort and return
 * 
 * The index fields (search_index_text, search_index_name) are pre-built by rebuildSearchIndex
 * and kept fresh by the updateCandidateSearchIndex function called on save/update.
 */
Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
        searchTerm = "",
        securityFilter = "all",
        statusFilter = "all",
        sortBy = "created_date",
        limit = 2000
    } = await req.json();

    // Fetch all candidates (service role bypasses pagination)
    const candidatesRaw = await base44.asServiceRole.entities.Candidate.list('-created_date', limit);

    // Apply equality filters first (fast O(n) pass)
    let filtered = candidatesRaw;

    if (securityFilter !== "all") {
        filtered = filtered.filter(c => c.security_clearance === securityFilter);
    }
    if (statusFilter !== "all") {
        filtered = filtered.filter(c => c.status === statusFilter);
    }

    // Apply sort
    if (sortBy === 'security_clearance') {
        const order = { 'רמה 1': 1, 'רמה 2': 2, 'רמה 3': 3, 'סודי ביותר': 4, 'סודי': 5, 'שמור': 6, 'סווג נמוך': 7, 'ללא סווג': 8, 'לא רלוונטי': 9 };
        filtered = [...filtered].sort((a, b) => (order[a.security_clearance] || 99) - (order[b.security_clearance] || 99));
    } else if (sortBy === 'status') {
        filtered = [...filtered].sort((a, b) => (a.status || '').localeCompare(b.status || '', 'he'));
    }

    // If no search term — return filtered results directly
    if (!searchTerm || !searchTerm.trim()) {
        return Response.json({
            success: true,
            candidates: filtered,
            total: filtered.length
        });
    }

    // --- Full-text search on indexed fields ---
    const normalizedSearch = searchTerm.toLowerCase().trim();
    // Split into tokens, ignore very short ones
    const searchTokens = normalizedSearch
        .replace(/[^\u05d0-\u05ea\u05f0-\u05f4a-zA-Z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length >= 1);

    if (searchTokens.length === 0) {
        return Response.json({ success: true, candidates: filtered, total: filtered.length });
    }

    const results = filtered.filter(c => {
        // Primary: use pre-built index (fast)
        const indexText = c.search_index_text || '';
        const indexName = c.search_index_name || '';

        // Fallback fields for candidates without a pre-built index
        const fallback = !indexText ? [
            c.first_name, c.last_name, c.first_name_english, c.last_name_english,
            c.email, c.phone_primary, c.phone_secondary,
            c.city, c.skills_summary, c.security_clearance, c.id_number,
            c.candidate_number
        ].filter(Boolean).join(' ').toLowerCase() : '';

        const searchableText = indexText || fallback;
        const nameText = indexName || `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase();

        // Every token must be found somewhere (AND logic)
        return searchTokens.every(token => 
            searchableText.includes(token) || nameText.includes(token)
        );
    });

    // Score and sort by relevance: candidates where name matches come first
    const scored = results.map(c => {
        const nameText = (c.search_index_name || `${c.first_name || ''} ${c.last_name || ''}`).toLowerCase();
        const nameMatchCount = searchTokens.filter(t => nameText.includes(t)).length;
        return { ...c, _score: nameMatchCount };
    }).sort((a, b) => b._score - a._score);

    // Strip internal score field
    const candidates = scored.map(({ _score, ...c }) => c);

    return Response.json({
        success: true,
        candidates,
        total: candidates.length
    });
});