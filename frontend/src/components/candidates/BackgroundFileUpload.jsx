import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload } from "lucide-react";
import { UploadFile, InvokeLLM } from "@/integrations/Core";
import { Candidate } from "@/entities/Candidate";
import { NewCandidateInbox } from "@/entities/NewCandidateInbox";
import { checkDuplicateCandidates } from "@/functions/checkDuplicateCandidates";
import { CandidateStatus } from '@/entities/CandidateStatus';
import { SynonymMapping } from '@/entities/SynonymMapping';
import { SystemActivityLog } from '@/entities/SystemActivityLog';
import { User } from '@/entities/User';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to load and apply synonyms - same as email scanner
async function loadSecuritySynonyms() {
  try {
    const synonyms = await SynonymMapping.filter({ is_active: true });
    return synonyms || [];
  } catch (error) {
    console.warn('Could not load synonyms:', error.message);
    return [];
  }
}

function detectSecurityClearanceWithSynonyms(text, synonyms) {
  if (!text) return 'לא רלוונטי';
  
  const lowerText = text.toLowerCase();
  
  const level1Keywords = ['רמה 1', 'סודי ביותר'];
  const level2Keywords = ['רמה 2', 'סודי'];
  const level3Keywords = ['רמה 3', 'שמור'];
  const lowLevelKeywords = ['סווג נמוך'];
  const noClearanceKeywords = ['ללא סווג'];
  
  // Check synonym mappings first
  for (const syn of synonyms) {
    const originalLower = (syn.original_word || '').toLowerCase();
    const synonymLower = (syn.synonym_word || '').toLowerCase();
    
    if (lowerText.includes(originalLower)) {
      if (level1Keywords.some(k => synonymLower.includes(k))) return 'רמה 1';
      if (level2Keywords.some(k => synonymLower.includes(k))) return 'רמה 2';
      if (level3Keywords.some(k => synonymLower.includes(k))) return 'רמה 3';
      if (lowLevelKeywords.some(k => synonymLower.includes(k))) return 'סווג נמוך';
      if (noClearanceKeywords.some(k => synonymLower.includes(k))) return 'ללא סווג';
    }
  }
  
  // Fallback to direct detection
  if (lowerText.includes('סודי ביותר') || lowerText.includes('רמה 1')) return 'רמה 1';
  if (lowerText.includes('סודי') || lowerText.includes('רמה 2')) return 'רמה 2';
  if (lowerText.includes('שמור') || lowerText.includes('רמה 3')) return 'רמה 3';
  if (lowerText.includes('נמוך')) return 'סווג נמוך';
  if (lowerText.includes('ללא')) return 'ללא סווג';
  
  return 'לא רלוונטי';
}

export default function BackgroundFileUpload({ onUploadComplete }) {
  const fileInputRef = useRef(null);

  const isValidCvFile = (fileName) => {
    const validExtensions = ['.pdf'];
    const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
    return validExtensions.includes(extension);
  };

  const analyzeResumeWithAI = async (fileUrl, fileName) => {
    const prompt = `אתה מנתח קורות חיים. חלץ פרטי מועמד בסיסיים מהמסמך המצורף.

חלץ רק מידע שמופיע במסמך:
1. שם, אימייל, טלפון
2. השכלה (עד 2 תארים עיקריים)
3. מקומות עבודה אחרונים (עד 3)
4. כישורים וטכנולוגיות עיקריים
5. שירות צבאי וסיווג ביטחוני

שם הקובץ: ${fileName}`;

    const response = await InvokeLLM({
      prompt: prompt,
      file_urls: [fileUrl],
      response_json_schema: {
        type: "object",
        properties: {
          full_name: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          address: { type: "string" },
          education_1: { type: "string" },
          education_2: { type: "string" },
          main_experience: { type: "string" },
          military_service: { type: "string" },
          security_clearance: { type: "string" },
          job_1_company: { type: "string" },
          job_1_role: { type: "string" },
          job_2_company: { type: "string" },
          job_2_role: { type: "string" },
          job_3_company: { type: "string" },
          job_3_role: { type: "string" },
          detected_skills: { 
            type: "array", 
            items: { type: "string" }
          },
          main_programming_languages: { 
            type: "array", 
            items: { type: "string" }
          },
          main_tech_tools: { 
            type: "array", 
            items: { type: "string" }
          }
        }
      }
    });

    return response || {};
  };

  const buildCandidateData = async (parsed, fileUrl, fileName, synonyms) => {
    let firstName = '(לא זוהה)';
    let lastName = '(לא זוהה)';
    
    if (parsed.full_name) {
      const nameParts = parsed.full_name.trim().split(/\s+/);
      firstName = nameParts[0] || '(לא זוהה)';
      lastName = nameParts.slice(1).join(' ') || '(לא זוהה)';
    }
    
    if (firstName === '(לא זוהה)' && fileName) {
      const nameFromFile = fileName.replace(/\.(pdf|doc|docx|rtf|odt|txt)$/i, '').replace(/[-_]/g, ' ').trim();
      if (nameFromFile && !nameFromFile.match(/^(cv|resume|קורות|חיים)/i)) {
        const parts = nameFromFile.split(/\s+/);
        if (parts.length >= 2) {
          firstName = parts[0];
          lastName = parts.slice(1).join(' ');
        }
      }
    }

    // Ensure we have valid names before proceeding
    if (!firstName || !lastName || firstName === '(לא זוהה)' || lastName === '(לא זוהה)') {
      throw new Error('לא ניתן לזהות שם מועמד בקובץ');
    }

    // Normalize security clearance using synonyms - same logic as email scanner
    const textToCheck = [
      parsed.security_clearance || '',
      parsed.military_service || '',
      parsed.main_experience || '',
      parsed.job_1_description || '',
      parsed.job_2_description || '',
      parsed.job_3_description || ''
    ].join(' ');
    
    const securityClearance = detectSecurityClearanceWithSynonyms(textToCheck, synonyms);

    // Get default new candidate status by name (same as email scanner)
    let defaultStatus = 'מועמד חדש';
    let defaultStatusNumber = 1;
    try {
      const statuses = await CandidateStatus.filter({ is_active: true });
      const newStatus = statuses.find(s => s.status_name === 'מועמד חדש');
      if (newStatus) {
        defaultStatus = newStatus.status_name;
        defaultStatusNumber = newStatus.status_number;
      }
    } catch (error) {
      console.warn('Could not load default status, using fallback:', error);
    }

    // Get next candidate number
    let candidateNumber = 'CAN-0000';
    try {
      const { base44 } = await import('@/api/base44Client');
      const numberResult = await base44.functions.invoke('getNextCandidateNumber', {});
      candidateNumber = numberResult.candidateNumber;
    } catch (error) {
      console.warn('Could not get next candidate number:', error);
    }

    return {
      candidate_number: candidateNumber,
      full_name: parsed.full_name || `${firstName} ${lastName}`,
      first_name: firstName,
      last_name: lastName,
      email: parsed.email || null,
      phone_primary: parsed.phone || null,
      address: parsed.address || null,
      education_1: parsed.education_1 || null,
      education_2: parsed.education_2 || null,
      education: [parsed.education_1, parsed.education_2].filter(e => e).join(' | ') || null,
      main_experience: parsed.main_experience || null,
      military_service: parsed.military_service || null,
      security_clearance: securityClearance,
      job_1_company: parsed.job_1_company || null,
      job_1_role: parsed.job_1_role || null,
      job_2_company: parsed.job_2_company || null,
      job_2_role: parsed.job_2_role || null,
      job_3_company: parsed.job_3_company || null,
      job_3_role: parsed.job_3_role || null,
      main_tech_tools: Array.isArray(parsed.main_tech_tools) ? parsed.main_tech_tools.join(', ') : '',
      main_programming_languages: Array.isArray(parsed.main_programming_languages) ? parsed.main_programming_languages.join(', ') : '',
      skills_summary: parsed.main_experience || (Array.isArray(parsed.detected_skills) ? parsed.detected_skills.join(', ') : ''),
      detected_skills: parsed.detected_skills || [],
      detected_languages: parsed.main_programming_languages || [],
      detected_tools: parsed.main_tech_tools || [],
      resume_file_url: fileUrl,
      original_filename: fileName,
      source_email_id: null,
      source_email_subject: null,
      source_email_date: new Date().toISOString(),
      status: defaultStatus,
      status_number: defaultStatusNumber,
      is_read: false
    };
  };

  const retryNetworkOperation = async (operation, maxRetries = 3, baseDelay = 2000) => {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt === maxRetries) throw error;
        const delayMs = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        await delay(delayMs);
      }
    }
    throw lastError;
  };

  const emitStatus = (state) => {
    window.dispatchEvent(new CustomEvent('manual-upload-status', { detail: state }));
  };

  const handleFilesUpload = async (files) => {
    if (files.length === 0) return;

    const uploadState = {
      isUploading: true,
      currentFileName: '',
      progress: 0,
      totalFiles: files.length,
      currentFileIndex: 0,
      statusMessage: 'מתחיל העלאה...',
      results: []
    };
    emitStatus(uploadState);

    // Load synonyms once at the start
    uploadState.statusMessage = 'טוען מילים נרדפות...';
    emitStatus(uploadState);
    const synonyms = await loadSecuritySynonyms();
    console.log(`Loaded ${synonyms.length} synonyms for manual upload`);

    const uploadResults = [];
    let stopRequested = false;

    const stopHandler = () => {
      stopRequested = true;
    };
    window.addEventListener('stop-manual-upload', stopHandler);

    for (let i = 0; i < files.length; i++) {
      if (stopRequested) {
        uploadState.statusMessage = `העלאה הופסקה. הושלמו ${i} מתוך ${files.length} קבצים.`;
        emitStatus(uploadState);
        break;
      }

      const file = files[i];
      uploadState.currentFileIndex = i + 1;
      uploadState.currentFileName = file.name;
      uploadState.statusMessage = `מעלה ${file.name}...`;
      emitStatus(uploadState);

      let fileResult;

      try {
        if (!isValidCvFile(file.name)) {
          throw new Error(`סוג קובץ לא נתמך. נתמכים: קבצי PDF בלבד`);
        }

        // Upload
        const uploadResult = await retryNetworkOperation(() => UploadFile({ file }), 7, 4000);
        
        uploadState.statusMessage = `מנתח עם AI את ${file.name}...`;
        emitStatus(uploadState);

        // Analyze with AI
        const parsedData = await retryNetworkOperation(() => 
          analyzeResumeWithAI(uploadResult.file_url, file.name), 3, 2000);

        const candidateData = await buildCandidateData(parsedData, uploadResult.file_url, file.name, synonyms);

        // Clean null/undefined values
        const cleanData = {};
        for (const [key, value] of Object.entries(candidateData)) {
          if (value !== null && value !== undefined && value !== '') {
            cleanData[key] = value;
          }
        }

        uploadState.statusMessage = `בודק כפלים עבור ${file.name}...`;
        emitStatus(uploadState);
        
        let shouldCreateCandidate = true;
        
        try {
          const duplicateCheck = await retryNetworkOperation(() => checkDuplicateCandidates({
            first_name: cleanData.first_name,
            last_name: cleanData.last_name,
            email: cleanData.email,
            phone_primary: cleanData.phone_primary
          }), 2, 1000);

          if (duplicateCheck.data?.hasDuplicates && duplicateCheck.data.duplicates.length > 0) {
            // Check for exact name match OR high confidence match (80%+)
            const exactNameMatch = duplicateCheck.data.duplicates.find(d => 
              d.first_name?.trim().toLowerCase() === cleanData.first_name?.trim().toLowerCase() &&
              d.last_name?.trim().toLowerCase() === cleanData.last_name?.trim().toLowerCase()
            );
            
            const highConfidenceMatch = duplicateCheck.data.duplicates.find(d => d.matchScore >= 80);
            
            if (exactNameMatch || highConfidenceMatch) {
              const matchedCandidate = exactNameMatch || highConfidenceMatch;
              shouldCreateCandidate = false;
              fileResult = { 
                name: file.name, 
                status: "skipped", 
                message: `דולג - מועמד כבר קיים במערכת: ${matchedCandidate.first_name} ${matchedCandidate.last_name}`,
                candidateName: `${cleanData.first_name || ''} ${cleanData.last_name || ''}`.trim()
              };
            }
          }
        } catch (duplicateError) {
          console.warn(`Duplicate check failed for ${file.name}:`, duplicateError);
        }

        if (shouldCreateCandidate) {
          uploadState.statusMessage = `יוצר מועמד עבור ${file.name}...`;
          emitStatus(uploadState);
          
          // Check for existing candidate by email or ID
          let existingCandidate = null;
          
          if (cleanData.id_number) {
            const existing = await Candidate.filter({ id_number: cleanData.id_number });
            if (existing.length > 0) existingCandidate = existing[0];
          }
          
          if (!existingCandidate && cleanData.email) {
            const existing = await Candidate.filter({ email: cleanData.email });
            if (existing.length > 0) existingCandidate = existing[0];
          }

          let candidateId;
          let created = false;

          if (existingCandidate) {
            await Candidate.update(existingCandidate.id, cleanData);
            candidateId = existingCandidate.id;
          } else {
            const newCandidate = await retryNetworkOperation(() => Candidate.create(cleanData), 3, 2000);
            candidateId = newCandidate.id;
            created = true;
          }

          // Create Inbox Entry
          await retryNetworkOperation(() => NewCandidateInbox.create({
            candidate_id: candidateId,
            candidate_name: cleanData.full_name,
            candidate_email: cleanData.email,
            candidate_phone: cleanData.phone_primary,
            security_clearance: cleanData.security_clearance,
            resume_file_url: uploadResult.file_url,
            original_filename: file.name,
            source: 'manual_upload',
            skills_summary: cleanData.skills_summary,
            is_processed: false
          }), 2, 1000);
          
          // Enhance CV automatically (same as email scanner)
          uploadState.statusMessage = `משבח קורות חיים עבור ${cleanData.full_name}...`;
          emitStatus(uploadState);
          
          try {
            const { base44 } = await import('@/api/base44Client');
            await base44.functions.invoke('enhanceCandidateCv', {
              candidate_id: candidateId
            });
            console.log(`CV enhancement completed for: ${cleanData.full_name}`);
          } catch (enhanceError) {
            console.warn(`Failed to enhance CV for ${cleanData.full_name}: ${enhanceError.message}`);
            // Don't fail the whole upload if enhancement fails
          }
          
          fileResult = { 
            name: file.name, 
            status: "success", 
            message: created ? 'הועלה, נותח והושבח בהצלחה' : 'עודכן והושבח מועמד קיים',
            candidateName: cleanData.full_name
          };
        }
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
        fileResult = { 
          name: file.name, 
          status: "error", 
          message: error.message?.substring(0, 100) || 'שגיאה לא ידועה'
        };
      }

      uploadResults.push(fileResult);
      uploadState.results = [...uploadResults];
      uploadState.progress = ((i + 1) / files.length) * 100;
      emitStatus(uploadState);

      // Delay between files
      if (i < files.length - 1) {
        await delay(2000);
      }
    }

    window.removeEventListener('stop-manual-upload', stopHandler);

    const successCount = uploadResults.filter(r => r.status === 'success').length;
    const errorCount = uploadResults.filter(r => r.status === 'error').length;
    const skippedCount = uploadResults.filter(r => r.status === 'skipped').length;
    
    uploadState.isUploading = false;
    uploadState.statusMessage = `הושלם: ${successCount} הצלחות, ${errorCount} שגיאות, ${skippedCount} דולגו`;
    emitStatus(uploadState);

    // Log to SystemActivityLog
    try {
      const currentUser = await User.me();
      await SystemActivityLog.create({
        actor_type: 'user',
        actor_name: currentUser?.full_name || 'משתמש',
        action_type: 'manual_upload',
        action_description: `העלאה ידנית של קורות חיים: ${successCount} הועלו בהצלחה, ${errorCount} שגיאות, ${skippedCount} דולגו`,
        status: errorCount > 0 ? 'partial' : 'success',
        details: JSON.stringify({
          totalFiles: files.length,
          successCount,
          errorCount,
          skippedCount,
          results: uploadResults.map(r => ({ name: r.name, status: r.status, candidateName: r.candidateName }))
        })
      });
    } catch (logError) {
      console.warn('Failed to log upload activity:', logError);
    }

    // Clear after 10 seconds
    setTimeout(() => {
      emitStatus({ 
        isUploading: false, 
        currentFileName: '', 
        progress: 0, 
        totalFiles: 0, 
        currentFileIndex: 0, 
        statusMessage: '', 
        results: [] 
      });
    }, 10000);

  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesToUpload = Array.from(e.target.files);
      // Close dialog immediately and start background upload
      if (onUploadComplete) {
        onUploadComplete();
      }
      // Start background upload after dialog closes
      setTimeout(() => {
        handleFilesUpload(filesToUpload);
      }, 100);
    }
  };

  return (
    <div className="w-full">
      <Card className="border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors p-6">
        <div className="text-center space-y-4">
          <Upload className="mx-auto h-12 w-12 text-gray-400" />
          <div>
            <p className="text-gray-600 mb-2">בחר קבצי PDF לניתוח</p>
            <p className="text-xs text-blue-600 font-medium mb-4">
              🔄 לאחר בחירת קבצים, החלון ייסגר והעלאה תתבצע ברקע.<br/>
              סטטוס ההעלאה יופיע בשורת הסטטוס למטה.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="gap-2"
            >
              <Upload className="w-4 h-4" />
              בחר קבצים
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf"
              className="hidden"
              onChange={handleFileInput}
            />
          </div>
          <div className="text-xs text-gray-600 space-y-1">
            <div>• נתמכים: <strong>קבצי PDF בלבד</strong></div>
            <div>• גודל מקסימלי: 50MB</div>
            <div className="text-amber-600">⚠️ קבצי Word (DOC/DOCX) אינם נתמכים - יש להמיר ל-PDF</div>
          </div>
        </div>
      </Card>
    </div>
  );
}