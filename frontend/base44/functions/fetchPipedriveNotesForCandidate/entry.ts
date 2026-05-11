import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { candidate_id } = await req.json();
    
    if (!candidate_id) {
      return Response.json({ error: 'Missing candidate_id' }, { status: 400 });
    }

    // Get candidate data
    const candidates = await base44.asServiceRole.entities.Candidate.filter({ id: candidate_id });
    const candidate = candidates[0];
    
    if (!candidate) {
      return Response.json({ error: 'Candidate not found' }, { status: 404 });
    }

    const apiKey = Deno.env.get('PIPEDRIVE_API_KEY');
    if (!apiKey) {
      return Response.json({ error: 'PIPEDRIVE_API_KEY not configured' }, { status: 500 });
    }

    // Search for the person in Pipedrive by email or name with fuzzy matching
    let personId = null;
    let matchMethod = '';
    
    // Try to find by email first
    if (candidate.email) {
      const searchByEmailUrl = `https://api.pipedrive.com/v1/persons/search?term=${encodeURIComponent(candidate.email)}&fields=email&api_token=${apiKey}`;
      const emailSearchResponse = await fetch(searchByEmailUrl);
      const emailSearchData = await emailSearchResponse.json();
      
      if (emailSearchData.success && emailSearchData.data?.items?.length > 0) {
        personId = emailSearchData.data.items[0].item.id;
        matchMethod = 'email';
        console.log(`✅ Found person by email: ${candidate.email} -> ID ${personId}`);
      }
    }
    
    // If not found by email, try fuzzy name search
    if (!personId) {
      const namesToTry = [];
      
      // Add full name
      if (candidate.full_name) {
        namesToTry.push(candidate.full_name);
      }
      
      // Add first + last name combination
      if (candidate.first_name && candidate.last_name) {
        namesToTry.push(`${candidate.first_name} ${candidate.last_name}`);
      }
      
      // Add last name only (often unique enough)
      if (candidate.last_name) {
        namesToTry.push(candidate.last_name);
      }
      
      // Add first name only as last resort
      if (candidate.first_name) {
        namesToTry.push(candidate.first_name);
      }
      
      console.log(`🔍 Trying to find person with names:`, namesToTry);
      
      for (const searchTerm of namesToTry) {
        if (personId) break; // Already found
        
        try {
          const searchByNameUrl = `https://api.pipedrive.com/v1/persons/search?term=${encodeURIComponent(searchTerm)}&api_token=${apiKey}`;
          const nameSearchResponse = await fetch(searchByNameUrl);
          const nameSearchData = await nameSearchResponse.json();
          
          if (nameSearchData.success && nameSearchData.data?.items?.length > 0) {
            // Calculate similarity for each result
            const results = nameSearchData.data.items.map(item => {
              const itemName = item.item?.name || '';
              const candidateName = candidate.full_name || `${candidate.first_name} ${candidate.last_name}`;
              const similarity = calculateStringSimilarity(
                itemName.toLowerCase().trim(), 
                candidateName.toLowerCase().trim()
              );
              return {
                id: item.item.id,
                name: itemName,
                similarity,
                item: item.item
              };
            });
            
            // Sort by similarity
            results.sort((a, b) => b.similarity - a.similarity);
            
            console.log(`📊 Search results for "${searchTerm}":`, 
              results.map(r => `${r.name} (${(r.similarity * 100).toFixed(0)}%)`).join(', ')
            );
            
            // Accept if similarity is at least 70%
            if (results[0].similarity >= 0.7) {
              personId = results[0].id;
              matchMethod = `name (${(results[0].similarity * 100).toFixed(0)}% match)`;
              console.log(`✅ Found person by fuzzy name: "${searchTerm}" -> "${results[0].name}" (ID ${personId})`);
              break;
            }
          }
        } catch (searchError) {
          console.error(`Error searching for "${searchTerm}":`, searchError);
        }
      }
    }

    if (!personId) {
      console.log(`❌ Person not found in Pipedrive for candidate: ${candidate.full_name}`);
      return Response.json({ 
        success: false, 
        message: 'לא נמצא איש קשר מתאים ב-Pipedrive (נוסו חיפושים לפי אימייל ושם)',
        history: '',
        searched_terms: {
          email: candidate.email,
          names: [candidate.full_name, candidate.first_name, candidate.last_name].filter(Boolean)
        }
      });
    }

    // Get person details
    const personUrl = `https://api.pipedrive.com/v1/persons/${personId}?api_token=${apiKey}`;
    const personResponse = await fetch(personUrl);
    const personData = await personResponse.json();

    // Get ALL notes for this person (paginated)
    const allNotes = [];
    let start = 0;
    const limit = 100; // Max per page
    let hasMore = true;
    
    while (hasMore) {
      const notesUrl = `https://api.pipedrive.com/v1/notes?person_id=${personId}&start=${start}&limit=${limit}&api_token=${apiKey}`;
      const notesResponse = await fetch(notesUrl);
      const notesData = await notesResponse.json();
      
      if (notesData.success && notesData.data?.length > 0) {
        allNotes.push(...notesData.data);
        
        // Check if there are more pages
        if (notesData.additional_data?.pagination?.more_items_in_collection) {
          start += limit;
        } else {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }
    
    console.log(`📝 Retrieved ${allNotes.length} notes from Pipedrive for person ${personId}`);

    // Build history text
    let historyText = '';
    
    // Add person info header
    historyText += `=== מידע על ${candidate.full_name} מ-Pipedrive ===\n\n`;
    historyText += `שם מלא: ${personData.data?.name || 'לא זמין'}\n`;
    historyText += `אימייל: ${personData.data?.email?.[0]?.value || 'לא זמין'}\n`;
    historyText += `טלפון: ${personData.data?.phone?.[0]?.value || 'לא זמין'}\n`;
    historyText += `ארגון: ${personData.data?.org_name || 'לא זמין'}\n`;
    historyText += `שיטת זיהוי: ${matchMethod}\n`;
    historyText += `\n=== הערות והסטוריה ===\n\n`;

    // Add notes sorted by date (newest first)
    if (allNotes.length > 0) {
      const sortedNotes = allNotes.sort((a, b) => 
        new Date(b.add_time) - new Date(a.add_time)
      );

      sortedNotes.forEach((note, index) => {
        const date = new Date(note.add_time).toLocaleDateString('he-IL', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        historyText += `[${date}] - ${note.user?.name || 'לא ידוע'}\n`;
        historyText += `${note.content || ''}\n`;
        historyText += `${'─'.repeat(50)}\n\n`;
      });
      
      historyText += `\nסה"כ ${allNotes.length} הערות`;
    } else {
      historyText += 'אין הערות רשומות ב-Pipedrive\n';
    }

    // Update candidate with history
    await base44.asServiceRole.entities.Candidate.update(candidate_id, {
      pipedrive_history: historyText
    });

    // Log the action
    await base44.asServiceRole.entities.SystemActivityLog.create({
      actor_type: 'user',
      actor_name: user.full_name,
      action_type: 'candidate_updated',
      action_description: `עדכן הסטוריית Pipedrive למועמד ${candidate.full_name}`,
      entity_type: 'Candidate',
      entity_id: candidate_id,
      entity_name: candidate.full_name,
      status: 'success'
    });

    return Response.json({
      success: true,
      message: `נטען היסטוריה מ-Pipedrive עבור ${candidate.full_name}`,
      history: historyText,
      notes_count: allNotes.length,
      match_method: matchMethod,
      person_id: personId
    });

  } catch (error) {
    console.error('Error fetching Pipedrive notes:', error);
    return Response.json({ 
      error: error.message,
      success: false 
    }, { status: 500 });
  }
});

// Helper function to calculate string similarity (Levenshtein-based)
function calculateStringSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

// Levenshtein distance algorithm
function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}