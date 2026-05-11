import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    console.log('Starting Candidate Form Submission Check v1.0');

    // Get the sheet ID from environment
    let sheetId = Deno.env.get('CANDIDATE_FORM_SHEET_ID');
    
    if (!sheetId) {
      return Response.json({ error: 'CANDIDATE_FORM_SHEET_ID not configured' }, { status: 500 });
    }

    // Extract spreadsheet ID if full URL was provided
    if (sheetId.includes('docs.google.com')) {
      const match = sheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match) {
        sheetId = match[1];
        console.log('Extracted spreadsheet ID from URL:', sheetId);
      } else {
        console.error('Could not extract spreadsheet ID from URL:', sheetId);
        return Response.json({ error: 'Invalid spreadsheet URL format' }, { status: 500 });
      }
    }
 
    console.log('Using Google Sheet ID:', sheetId);

    // Get Google Sheets access token
    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlesheets');
    
    if (!accessToken) {
      return Response.json({ error: 'Google Sheets not authorized' }, { status: 401 });
    }

    // Read the Google Sheet
    const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A:Z`;
    const sheetResponse = await fetch(sheetUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!sheetResponse.ok) {
      const errorText = await sheetResponse.text();
      console.error('Google Sheets API error:', errorText);
      return Response.json({ error: 'Failed to read Google Sheet' }, { status: 500 });
    }

    const sheetData = await sheetResponse.json();
    const rows = sheetData.values || [];

    if (rows.length === 0) {
      console.log('Sheet is empty');
      return Response.json({ status: 'ok', checked: 0, updated: 0, message: 'Sheet is empty' });
    }

    // Get header row to find relevant columns
    const headers = rows[0] || [];
    
    // Find all name-related columns - match the actual Google Sheet headers
    // Column C (index 2) = שם פרטי בעברית
    // Column D (index 3) = שם משפחה בעברית
    // Column E (index 4) = שם פרטי באנגלית
    // Column F (index 5) = שם משפחה באנגלית
    const firstNameHebrewIdx = headers.findIndex(h => h && h.includes('שם פרטי') && !h.includes('אנגלית'));
    const lastNameHebrewIdx = headers.findIndex(h => h && h.includes('שם משפחה') && !h.includes('אנגלית'));
    const firstNameEnglishIdx = headers.findIndex(h => h && h.includes('שם פרטי') && h.includes('אנגלית'));
    const lastNameEnglishIdx = headers.findIndex(h => h && h.includes('שם משפחה') && h.includes('אנגלית'));
    
    const emailColumnIndex = headers.findIndex(h => 
      h && (h.includes('מייל') || h.toLowerCase().includes('email'))
    );
    const timestampColumnIndex = headers.findIndex(h => 
      h && (h.includes('תאריך') || h.toLowerCase().includes('timestamp') || h.toLowerCase().includes('date'))
    );

    console.log(`Found columns - Hebrew: firstName=${firstNameHebrewIdx}, lastName=${lastNameHebrewIdx}, English: firstName=${firstNameEnglishIdx}, lastName=${lastNameEnglishIdx}, email=${emailColumnIndex}, timestamp=${timestampColumnIndex}`);

    // Build a map of submitted names with their timestamps and emails
    const submittedCandidates = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      
      // Build full names from all available columns
      const firstNameHeb = firstNameHebrewIdx !== -1 ? (row[firstNameHebrewIdx] || '').trim() : '';
      const lastNameHeb = lastNameHebrewIdx !== -1 ? (row[lastNameHebrewIdx] || '').trim() : '';
      const firstNameEng = firstNameEnglishIdx !== -1 ? (row[firstNameEnglishIdx] || '').trim() : '';
      const lastNameEng = lastNameEnglishIdx !== -1 ? (row[lastNameEnglishIdx] || '').trim() : '';
      
      const email = emailColumnIndex !== -1 ? row[emailColumnIndex] : null;
      const timestamp = timestampColumnIndex !== -1 ? row[timestampColumnIndex] : null;
      
      // Build all possible name combinations
      const nameVariations = [];
      if (firstNameHeb && lastNameHeb) nameVariations.push(`${firstNameHeb} ${lastNameHeb}`);
      if (firstNameEng && lastNameEng) nameVariations.push(`${firstNameEng} ${lastNameEng}`);
      if (firstNameHeb && lastNameEng) nameVariations.push(`${firstNameHeb} ${lastNameEng}`);
      if (firstNameEng && lastNameHeb) nameVariations.push(`${firstNameEng} ${lastNameHeb}`);
      
      // Add entry for each name variation
      if (nameVariations.length > 0 || email) {
        submittedCandidates.push({
          nameVariations: nameVariations,
          firstNameHeb,
          lastNameHeb,
          firstNameEng,
          lastNameEng,
          email: email ? email.trim().toLowerCase() : '',
          timestamp: timestamp,
          rowIndex: i
        });
      }
    }

    console.log(`Found ${submittedCandidates.length} submitted candidates in sheet`);

    // Get all RotemTasks with form_status = "הועבר למועמד"
    const tasksToCheck = await base44.asServiceRole.entities.RotemTask.filter({
      form_status: 'הועבר למועמד'
    });

    console.log(`Found ${tasksToCheck.length} tasks waiting for form completion`);

    let checked = 0;
    let updated = 0;
    const results = [];

    for (const task of tasksToCheck) {
      checked++;
      
      const candidateName = task.candidate_name;
      const candidatePhone = task.candidate_phone;
      const formSentDate = task.form_sent_date ? new Date(task.form_sent_date) : null;
      
      if (!candidateName) {
        console.log(`Task ${task.id}: No candidate name, skipping`);
        continue;
      }

      console.log(`Checking if ${candidateName} submitted form...`);

      // Get candidate email from system
      let candidateEmail = null;
      if (task.candidate_id) {
        try {
          const candidate = await base44.asServiceRole.entities.Candidate.get(task.candidate_id);
          candidateEmail = candidate?.email?.toLowerCase();
        } catch (err) {
          console.log(`Could not fetch candidate email for ${candidateName}`);
        }
      }

      // Normalize candidate name for flexible matching
      const normalizeForMatch = (name) => {
        return name
          .replace(/\s+/g, '') // Remove all spaces
          .replace(/[״׳']/g, '') // Remove quotes
          .toLowerCase();
      };

      const candidateNameNormalized = normalizeForMatch(candidateName);
      
      // Split name into parts for reversed and partial matching
      const nameParts = candidateName.trim().split(/\s+/);
      const firstName = nameParts[0] ? normalizeForMatch(nameParts[0]) : '';
      const lastName = nameParts[nameParts.length - 1] ? normalizeForMatch(nameParts[nameParts.length - 1]) : '';

      // Search for matching submission
      let matchFound = false;
      let matchedSubmission = null;
      let bestSimilarity = 0;
      let bestMatch = null;

      for (const submission of submittedCandidates) {
        // PRIORITY 1: Email match (most reliable)
        if (candidateEmail && submission.email && submission.email === candidateEmail) {
          matchFound = true;
          matchedSubmission = submission;
          console.log(`✓ Email match found: "${candidateName}" matched via email ${candidateEmail}`);
          break;
        }

        // PRIORITY 2: Match by first name + last name components
        if (firstName && lastName) {
          // Check Hebrew names
          const firstHebNorm = normalizeForMatch(submission.firstNameHeb);
          const lastHebNorm = normalizeForMatch(submission.lastNameHeb);
          
          if (firstHebNorm && lastHebNorm) {
            const firstSim = calculateSimilarity(firstName, firstHebNorm);
            const lastSim = calculateSimilarity(lastName, lastHebNorm);
            
            if (firstSim >= 0.8 && lastSim >= 0.8) {
              matchFound = true;
              matchedSubmission = submission;
              console.log(`✓ Hebrew name match: "${candidateName}" matched with "${submission.firstNameHeb} ${submission.lastNameHeb}" (first: ${(firstSim * 100).toFixed(0)}%, last: ${(lastSim * 100).toFixed(0)}%)`);
              break;
            }
          }
          
          // Check English names
          const firstEngNorm = normalizeForMatch(submission.firstNameEng);
          const lastEngNorm = normalizeForMatch(submission.lastNameEng);
          
          if (firstEngNorm && lastEngNorm) {
            const firstSim = calculateSimilarity(firstName, firstEngNorm);
            const lastSim = calculateSimilarity(lastName, lastEngNorm);
            
            if (firstSim >= 0.8 && lastSim >= 0.8) {
              matchFound = true;
              matchedSubmission = submission;
              console.log(`✓ English name match: "${candidateName}" matched with "${submission.firstNameEng} ${submission.lastNameEng}" (first: ${(firstSim * 100).toFixed(0)}%, last: ${(lastSim * 100).toFixed(0)}%)`);
              break;
            }
          }
        }
        
        // PRIORITY 3: Check all name variations
        for (const nameVar of submission.nameVariations) {
          const submissionNameNormalized = normalizeForMatch(nameVar);
          const similarity = calculateSimilarity(candidateNameNormalized, submissionNameNormalized);
          
          // Track best match for debugging
          if (similarity > bestSimilarity) {
            bestSimilarity = similarity;
            bestMatch = nameVar;
          }
          
          if (similarity >= 0.85) {
            matchFound = true;
            matchedSubmission = submission;
            console.log(`✓ Name variation match: "${candidateName}" matched with "${nameVar}" (similarity: ${(similarity * 100).toFixed(0)}%)`);
            break;
          }
        }
        
        if (matchFound) break;
      }
      
      if (!matchFound && bestMatch) {
        console.log(`✗ No match for "${candidateName}". Best candidate was "${bestMatch}" with similarity ${(bestSimilarity * 100).toFixed(0)}%`);
      }

      if (matchFound && matchedSubmission) {
        // Check if timestamp is within 2 weeks from form_sent_date
        let isWithinTimeframe = true;
        
        if (formSentDate && matchedSubmission.timestamp) {
          try {
            const submissionDate = new Date(matchedSubmission.timestamp);
            const twoWeeksAfterSent = new Date(formSentDate.getTime() + 14 * 24 * 60 * 60 * 1000);
            
            // Check if submission is after form was sent and within 2 weeks
            if (submissionDate < formSentDate || submissionDate > twoWeeksAfterSent) {
              isWithinTimeframe = false;
              console.log(`Match found for ${candidateName} but timestamp out of range (sent: ${formSentDate.toLocaleDateString()}, submitted: ${submissionDate.toLocaleDateString()})`);
            }
          } catch (dateErr) {
            console.log(`Could not parse timestamp for ${candidateName}, proceeding anyway`);
          }
        }

        if (isWithinTimeframe) {
          console.log(`✓ Found submission for ${candidateName} (matched with "${matchedSubmission.name}")`);
          
          // Update task
          await base44.asServiceRole.entities.RotemTask.update(task.id, {
            form_status: 'מולא',
            notes: (task.notes || '') + `\n[${new Date().toLocaleString('he-IL')}] המועמד מילא את הטופס (אותר אוטומטית ב-Google Sheet)`
          });
          
          // NEW: Update candidate data from Google Sheet
          try {
            // Parse the Google Sheet row to extract candidate data
            const candidateRowData = rows[matchedSubmission.rowIndex] || [];
            
            // Step 1: Find the candidate in the system using flexible search
            let candidateId = task.candidate_id;
            
            if (!candidateId) {
              console.log(`No candidate_id on task, searching by name: ${candidateName}`);
              
              // Flexible search by name
              const allCandidates = await base44.asServiceRole.entities.Candidate.list('-created_date', 1000);
              
              for (const c of allCandidates) {
                const candidateFullName = c.full_name || `${c.first_name || ''} ${c.last_name || ''}`.trim();
                const candidateNameNorm = normalizeForMatch(candidateFullName);
                const taskNameNorm = normalizeForMatch(candidateName);
                
                const similarity = calculateSimilarity(candidateNameNorm, taskNameNorm);
                
                // Match if similarity >= 85% or exact match
                if (similarity >= 0.85) {
                  candidateId = c.id;
                  console.log(`✓ Found candidate by flexible name search: ${candidateFullName} (similarity: ${(similarity * 100).toFixed(0)}%)`);
                  break;
                }
                
                // Try reversed name match (שם משפחה + שם פרטי vs שם פרטי + שם משפחה)
                const nameParts = candidateName.trim().split(/\s+/);
                if (nameParts.length >= 2) {
                  const reversedName = nameParts.reverse().join('');
                  const reversedNorm = normalizeForMatch(reversedName);
                  const reversedSimilarity = calculateSimilarity(reversedNorm, candidateNameNorm);
                  
                  if (reversedSimilarity >= 0.85) {
                    candidateId = c.id;
                    console.log(`✓ Found candidate by reversed name: ${candidateFullName} (similarity: ${(reversedSimilarity * 100).toFixed(0)}%)`);
                    break;
                  }
                }
              }
            }
            
            if (!candidateId) {
              console.log(`Could not find candidate in system for name: ${candidateName}`);
            } else {
              // Step 2: Call Yael agent to parse and update candidate from sheet data
              console.log(`Calling Yael to update candidate ${candidateId} from sheet row ${matchedSubmission.rowIndex}`);
              
              const yaeelResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
                prompt: `את יעל, ציידת המועמדים בחברת פנדה-טק.

קיבלת שורת נתונים מטופס Google Forms של מועמד שמילא את הטופס:

Headers: ${headers.join(' | ')}
Data: ${candidateRowData.join(' | ')}

תפקידך:
1. חלצי את כל הנתונים הרלוונטיים מהשורה
2. התאם את הנתונים לשדות של טבלת המועמדים במערכת
3. החזר JSON עם הנתונים המעודכנים בפורמט הנכון

שדות חשובים להתמקד בהם:
- שם מלא / שם פרטי / שם משפחה
- מייל
- טלפון
- כתובת / עיר
- תאריכים (לידה, עלייה)
- השכלה ותעודות
- ניסיון תעסוקתי
- שפות
- רישיון נהיגה
- סיווג ביטחוני
- כל שדה אחר שרלוונטי

החזר רק את השדות שיש להם ערך חדש בטופס. אל תכתוב שדות שאין להם ערך או שהם ריקים.`,
                response_json_schema: {
                  type: 'object',
                  properties: {
                    candidateData: {
                      type: 'object',
                      description: 'נתוני המועמד לעדכון במערכת'
                    }
                  },
                  required: ['candidateData']
                }
              });
              
              if (yaeelResult?.candidateData && Object.keys(yaeelResult.candidateData).length > 0) {
                // Update candidate with parsed data
                await base44.asServiceRole.entities.Candidate.update(candidateId, yaeelResult.candidateData);
                console.log(`✓ Updated candidate ${candidateId} with form data:`, Object.keys(yaeelResult.candidateData));
                
                // Update task with the found candidate_id if it was missing
                if (!task.candidate_id) {
                  await base44.asServiceRole.entities.RotemTask.update(task.id, {
                    candidate_id: candidateId
                  });
                  console.log(`✓ Updated task ${task.id} with candidate_id: ${candidateId}`);
                }
              }
            }
          } catch (candidateUpdateErr) {
            console.error(`Error updating candidate from sheet:`, candidateUpdateErr);
          }
          
          // Update the Match record - mark as ready to send to client
          try {
            let matchToUpdate = null;

            // Try to find match by match_id first
            if (task.match_id) {
              matchToUpdate = await base44.asServiceRole.entities.Match.get(task.match_id);
            }

            // If no match_id or match not found, search by candidate + job
            if (!matchToUpdate && task.candidate_id && task.job_id) {
              const matchesByCandidate = await base44.asServiceRole.entities.Match.filter({
                candidate_id: task.candidate_id,
                job_id: task.job_id
              });
              if (matchesByCandidate.length > 0) {
                matchToUpdate = matchesByCandidate[0];
              }
            }

            if (matchToUpdate) {
              await base44.asServiceRole.entities.Match.update(matchToUpdate.id, {
                ready_to_send_to_client: true,
                ready_to_send_date: new Date().toISOString()
              });
              console.log(`✓ Updated Match ${matchToUpdate.id} - ready to send to client`);

              // Update the task with the match_id if it was missing
              if (!task.match_id) {
                await base44.asServiceRole.entities.RotemTask.update(task.id, {
                  match_id: matchToUpdate.id
                });
                console.log(`✓ Updated task ${task.id} with match_id: ${matchToUpdate.id}`);
              }

              // Create EladTask if not already exists
              try {
                const existingEladTasks = await base44.asServiceRole.entities.EladTask.filter({
                  match_id: matchToUpdate.id
                });

                if (existingEladTasks.length === 0) {
                  // No EladTask exists - create one
                  const job = await base44.asServiceRole.entities.Job.get(task.job_id);
                  const candidate = await base44.asServiceRole.entities.Candidate.get(task.candidate_id);

                  if (job && candidate && candidate.resume_file_url) {
                    const clientEmail = job.contact_person_email || job.client_email || 'avishai@pandatech.co.il';
                    const contactPersonName = job.contact_person || 'מנהל מערכת';

                    // Get next task number
                    const nextNumber = await base44.asServiceRole.functions.invoke('getNextTaskNumber', {});
                    const taskNumber = `ET-${String(nextNumber.data.nextNumber).padStart(5, '0')}`;

                    await base44.asServiceRole.entities.EladTask.create({
                      task_number: taskNumber,
                      job_id: task.job_id,
                      job_title: task.job_title,
                      client_id: job.client_id,
                      client_company_name: job.client_name,
                      client_email: clientEmail,
                      client_contact_person: contactPersonName,
                      candidate_id: task.candidate_id,
                      candidate_full_name: task.candidate_name,
                      candidate_cv_file_url: candidate.resume_file_url,
                      match_id: matchToUpdate.id,
                      rotem_conversation_summary: task.conversation_summary,
                      status: 'לא החל',
                      priority: task.priority || 'בינונית',
                      deadline: job.deadline || null,
                      notes: `נוצרה אוטומטית לאחר מילוי טופס מועמד`
                    });

                    console.log(`✓ Created EladTask ${taskNumber} for ${candidate.full_name} → ${job.client_name} (${clientEmail})`);
                  } else {
                    console.log(`⚠️ Missing job/candidate/CV for EladTask creation`);
                  }
                } else {
                  console.log(`✓ EladTask already exists for match ${matchToUpdate.id}`);
                }
              } catch (eladErr) {
                console.error(`Error creating EladTask:`, eladErr);
              }

            } else {
              console.log(`⚠️ No match found for task ${task.id} (candidate: ${task.candidate_id}, job: ${task.job_id})`);
            }
          } catch (matchErr) {
            console.error(`Error updating Match:`, matchErr);
          }
          
          updated++;
          results.push({
            task_id: task.id,
            candidate_name: candidateName,
            matched_with: matchedSubmission.name,
            status: 'updated'
          });
        }
      } else {
        console.log(`✗ No submission found for ${candidateName}`);
      }

      // Rate limiting - small delay between checks
      if (checked < tasksToCheck.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return Response.json({
      status: 'ok',
      checked,
      updated,
      submissions_in_sheet: submittedCandidates.length,
      results
    });

  } catch (error) {
    console.error('Form check error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// Helper function to calculate string similarity (Levenshtein-based)
function calculateSimilarity(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  
  if (len1 === 0) return len2 === 0 ? 1 : 0;
  if (len2 === 0) return 0;
  
  const matrix = [];
  
  for (let i = 0; i <= len2; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= len1; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= len2; i++) {
    for (let j = 1; j <= len1; j++) {
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
  
  const distance = matrix[len2][len1];
  const maxLen = Math.max(len1, len2);
  
  return 1 - (distance / maxLen);
}