import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    console.log("checkDuplicateCandidates: Function started");
    
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      console.error("checkDuplicateCandidates: Unauthorized access");
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { first_name, last_name, email, phone_primary } = await req.json();
    
    if (!first_name || !last_name) {
      console.error("checkDuplicateCandidates: Missing required fields");
      return Response.json({ success: false, error: 'Missing required fields: first_name, last_name' }, { status: 400 });
    }

    console.log(`checkDuplicateCandidates: Checking for duplicates of: ${first_name} ${last_name}`);

    // Get all candidates for checking
    const allCandidatesRaw = await base44.asServiceRole.entities.Candidate.list('-created_date', 5000);
    const allCandidates = allCandidatesRaw.filter(c => !c.is_deleted);
    
    const potentialDuplicates = [];
    const fullName = `${first_name.trim()} ${last_name.trim()}`.toLowerCase();
    const normalizedEmail = email ? email.toLowerCase().trim() : null;
    const normalizedPhone = phone_primary ? phone_primary.replace(/\D/g, '') : null; // Remove non-digits

    for (const candidate of allCandidates) {
      const candidateFullName = `${candidate.first_name || ''} ${candidate.last_name || ''}`.toLowerCase().trim();
      const candidateEmail = candidate.email ? candidate.email.toLowerCase().trim() : null;
      const candidatePhone = candidate.phone_primary ? candidate.phone_primary.replace(/\D/g, '') : null;

      let matchReason = [];
      let matchScore = 0;

      // Check for exact full name match
      if (candidateFullName === fullName) {
        matchReason.push('שם מלא זהה');
        matchScore += 50;
      }
      
      // Check for similar name (allowing for small differences)
      else if (candidateFullName && fullName) {
        const similarity = calculateStringSimilarity(candidateFullName, fullName);
        if (similarity > 0.8) {
          matchReason.push(`שם דומה (${Math.round(similarity * 100)}%)`);
          matchScore += Math.round(similarity * 30);
        }
      }

      // Check for email match
      if (normalizedEmail && candidateEmail && normalizedEmail === candidateEmail) {
        matchReason.push('אימייל זהה');
        matchScore += 40;
      }

      // Check for phone match (considering last 7 digits)
      if (normalizedPhone && candidatePhone) {
        const phoneEnd = normalizedPhone.slice(-7);
        const candidatePhoneEnd = candidatePhone.slice(-7);
        if (phoneEnd === candidatePhoneEnd && phoneEnd.length >= 7) {
          matchReason.push('טלפון זהה');
          matchScore += 30;
        }
      }

      // If we found any matches, add to potential duplicates
      if (matchReason.length > 0 && matchScore >= 40) {
        potentialDuplicates.push({
          id: candidate.id,
          first_name: candidate.first_name,
          last_name: candidate.last_name,
          email: candidate.email,
          phone_primary: candidate.phone_primary,
          created_date: candidate.created_date,
          matchReason: matchReason.join(', '),
          matchScore: matchScore
        });
      }
    }

    // Sort by match score (highest first)
    potentialDuplicates.sort((a, b) => b.matchScore - a.matchScore);

    console.log(`checkDuplicateCandidates: Found ${potentialDuplicates.length} potential duplicates`);

    return Response.json({
      success: true,
      hasDuplicates: potentialDuplicates.length > 0,
      duplicates: potentialDuplicates,
      message: potentialDuplicates.length > 0 
        ? `נמצאו ${potentialDuplicates.length} מועמדים דומים` 
        : 'לא נמצאו מועמדים דומים'
    });

  } catch (error) {
    console.error("checkDuplicateCandidates: FATAL ERROR:", error);
    return Response.json({ 
      success: false, 
      error: error.message || 'Server error' 
    }, { status: 500 });
  }
});

// Helper function to calculate string similarity
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