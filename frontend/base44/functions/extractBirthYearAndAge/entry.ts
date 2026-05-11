import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Extracts birth year from resume text using AI and calculates age
 */
async function extractBirthYearFromResume(candidateData, base44) {
  try {
    // If full_text (resume) exists, try to extract birth year via AI
    if (candidateData.full_text) {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `בקורות החיים הבאים, חלץ את שנת הלידה של המועמד. אם קיים תאריך לידה מלא, חלץ רק את השנה. תשובה: מספר בלבד (שנה בפורמט 4 ספרות) או null אם לא נמצא.

קורות החיים:
${candidateData.full_text.substring(0, 2000)}`,
        response_json_schema: {
          type: "object",
          properties: {
            birth_year: {
              type: ["number", "null"],
              description: "שנת הלידה או null אם לא נמצאה"
            }
          }
        }
      });

      if (response?.birth_year) {
        return { 
          birthYear: response.birth_year, 
          source: 'extracted_from_cv',
          isEmpty: false 
        };
      }
    }

    return { birthYear: null, source: null, isEmpty: true };
  } catch (error) {
    console.log('Error extracting birth year from resume:', error.message);
    return { birthYear: null, source: null, isEmpty: true };
  }
}

/**
 * Calculates candidate age from available data
 */
function calculateCandidateAge(candidate) {
  const currentYear = new Date().getFullYear();
  
  // Method 1: Use date_of_birth
  if (candidate.date_of_birth) {
    try {
      const birthDate = new Date(candidate.date_of_birth);
      const age = currentYear - birthDate.getFullYear();
      const currentDate = new Date();
      const birthdayThisYear = new Date(currentYear, birthDate.getMonth(), birthDate.getDate());
      const adjustedAge = currentDate < birthdayThisYear ? age - 1 : age;
      return { age: Math.max(0, adjustedAge), source: 'תאריך לידה', isEmpty: false };
    } catch (e) {
      console.log('Invalid date_of_birth');
    }
  }

  // Method 2: Use military_discharge_year
  if (candidate.military_discharge_year) {
    try {
      const dischargeYear = parseInt(candidate.military_discharge_year, 10);
      if (!isNaN(dischargeYear)) {
        const ageAtDischarge = 21;
        const yearsAgo = currentYear - dischargeYear;
        const age = ageAtDischarge + yearsAgo;
        return { age: Math.max(0, age), source: 'מועד סיום צבא', isEmpty: false };
      }
    } catch (e) {
      console.log('Invalid military_discharge_year');
    }
  }

  return { age: null, source: null, isEmpty: true };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only admins can run this
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('Starting extraction of birth years and age calculation...');

    // Fetch candidates with resume data
    const candidates = await base44.asServiceRole.entities.Candidate.list('', 500);
    console.log(`Processing ${candidates.length} candidates`);

    let updatedCount = 0;
    let birthYearsFound = 0;
    let agesCalculated = 0;
    let errors = [];

    for (const candidate of candidates) {
      try {
        let updateData = {};

        // Try to extract birth year from resume if not already set
        if (!candidate.date_of_birth && candidate.full_text) {
          const extracted = await extractBirthYearFromResume(candidate, base44);
          
          if (!extracted.isEmpty && extracted.birthYear) {
            birthYearsFound++;
            // Store as date (Jan 1 of that year) for consistency
            const birthDate = new Date(extracted.birthYear, 0, 1);
            updateData.date_of_birth = birthDate.toISOString();
            console.log(`Extracted birth year ${extracted.birthYear} for candidate ${candidate.id}`);
          }
        }

        // Calculate age
        const ageInfo = calculateCandidateAge({...candidate, ...updateData});
        if (!ageInfo.isEmpty && ageInfo.age !== null) {
          agesCalculated++;
        }

        // Update if we found new data
        if (Object.keys(updateData).length > 0) {
          await base44.asServiceRole.entities.Candidate.update(candidate.id, updateData);
          updatedCount++;
        }

      } catch (error) {
        const errorMsg = `Error processing candidate ${candidate.id}: ${error.message}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    const result = {
      success: true,
      message: 'Successfully extracted birth years and calculated ages',
      totalCandidates: candidates.length,
      updatedCandidates: updatedCount,
      birthYearsExtracted: birthYearsFound,
      agesCalculated: agesCalculated,
      errors: errors
    };

    console.log(JSON.stringify(result));
    return Response.json(result);

  } catch (error) {
    console.error('Error in extractBirthYearAndAge:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});