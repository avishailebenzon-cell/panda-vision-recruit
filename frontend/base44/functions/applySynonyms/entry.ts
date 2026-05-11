import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    if (!(await base44.auth.isAuthenticated())) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const { searchText } = await req.json();
        
        if (!searchText || typeof searchText !== 'string') {
            return new Response(JSON.stringify({ 
                enhancedText: searchText,
                appliedSynonyms: []
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Get all active synonyms from the database
        const synonyms = await base44.entities.SynonymMapping.filter({ is_active: true });
        
        let enhancedText = searchText;
        const appliedSynonyms = [];
        
        // Apply synonyms to the search text
        for (const synonym of synonyms) {
            const originalWord = synonym.original_word.toLowerCase();
            const synonymWord = synonym.synonym_word.toLowerCase();
            
            // Create regex that matches whole words (with word boundaries)
            const regex = new RegExp(`\\b${originalWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
            
            if (regex.test(enhancedText)) {
                // Replace the original word with both original and synonym
                enhancedText = enhancedText.replace(regex, `${originalWord} ${synonymWord}`);
                
                appliedSynonyms.push({
                    original: synonym.original_word,
                    synonym: synonym.synonym_word,
                    category: synonym.category
                });

                // Update usage count
                try {
                    await base44.asServiceRole.entities.SynonymMapping.update(synonym.id, {
                        usage_count: (synonym.usage_count || 0) + 1
                    });
                } catch (updateError) {
                    console.error('Error updating synonym usage count:', updateError);
                }
            }
        }

        return new Response(JSON.stringify({
            enhancedText,
            appliedSynonyms,
            originalText: searchText
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error in applySynonyms:', error);
        return new Response(JSON.stringify({ 
            error: 'Internal server error',
            enhancedText: '',
            appliedSynonyms: []
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});