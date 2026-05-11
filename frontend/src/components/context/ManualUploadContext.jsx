import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { UploadFile, InvokeLLM } from "@/integrations/Core";
import { Candidate } from "@/entities/Candidate";
import { NewCandidateInbox } from "@/entities/NewCandidateInbox";
import { checkDuplicateCandidates } from "@/functions/checkDuplicateCandidates";
import { CandidateStatus } from '@/entities/CandidateStatus';

const ManualUploadContext = createContext(null);

export const useManualUpload = () => {
  const context = useContext(ManualUploadContext);
  if (!context) {
    throw new Error('useManualUpload must be used within ManualUploadProvider');
  }
  return context;
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export function ManualUploadProvider({ children }) {
  const [isUploading, setIsUploading] = useState(false);
  const [currentFileName, setCurrentFileName] = useState('');
  const [progress, setProgress] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [results, setResults] = useState([]);
  const shouldStopRef = useRef(false);

  const isValidCvFile = (fileName) => {
    const validExtensions = ['.pdf'];
    const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
    return validExtensions.includes(extension);
  };

  const analyzeResumeWithAI = async (fileUrl, fileName) => {
    const prompt = `אתה מנתח קורות חיים מומחה. הקובץ המצורף הוא קורות חיים.
נתח את המסמך וחלץ את כל המידע האפשרי.

הנחיות חשובות:
1. חלץ שם מלא, אימייל, טלפון, כתובת
2. חלץ את כל ההשכלה והתארים
3. חלץ את כל מקומות העבודה (עד 5)
4. חלץ את כל הטכנולוגיות, שפות תכנות וכלים
5. זהה שנות ניסיון ורמת סיווג ביטחוני אם מצוין
6. אל תמציא מידע - רק חלץ ממה שמופיע במסמך
7. אם שדה לא נמצא, החזר null

שם הקובץ: ${fileName}`;

    const response = await InvokeLLM({
      prompt: prompt,
      file_urls: [fileUrl],
      response_json_schema: {
        type: "object",
        properties: {
          full_name: { type: ["string", "null"], description: "שם מלא" },
          id_number: { type: ["string", "null"], description: "תעודת זהות" },
          email: { type: ["string", "null"], description: "כתובת אימייל" },
          phone: { type: ["string", "null"], description: "טלפון" },
          address: { type: ["string", "null"], description: "כתובת מגורים" },
          date_of_birth: { type: ["string", "null"], description: "תאריך לידה" },
          education_1: { type: ["string", "null"], description: "השכלה ראשונה - מוסד ותואר" },
          education_2: { type: ["string", "null"], description: "השכלה שנייה" },
          education_3: { type: ["string", "null"], description: "השכלה שלישית" },
          education_level: { type: ["string", "null"], description: "רמת השכלה גבוהה ביותר" },
          main_experience: { type: ["string", "null"], description: "תיאור קצר של הניסיון המקצועי" },
          military_service: { type: ["string", "null"], description: "שירות צבאי" },
          security_clearance: { type: ["string", "null"], description: "סיווג ביטחוני" },
          years_experience: { type: ["number", "null"], description: "שנות ניסיון" },
          job_1_company: { type: ["string", "null"] },
          job_1_role: { type: ["string", "null"] },
          job_1_description: { type: ["string", "null"] },
          job_2_company: { type: ["string", "null"] },
          job_2_role: { type: ["string", "null"] },
          job_2_description: { type: ["string", "null"] },
          job_3_company: { type: ["string", "null"] },
          job_3_role: { type: ["string", "null"] },
          job_3_description: { type: ["string", "null"] },
          job_4_company: { type: ["string", "null"] },
          job_4_role: { type: ["string", "null"] },
          job_4_description: { type: ["string", "null"] },
          job_5_company: { type: ["string", "null"] },
          job_5_role: { type: ["string", "null"] },
          job_5_description: { type: ["string", "null"] },
          detected_skills: { 
            type: "array", 
            items: { type: "string" },
            description: "רשימת כל הכישורים והטכנולוגיות"
          },
          main_programming_languages: { 
            type: "array", 
            items: { type: "string" },
            description: "שפות תכנות בלבד"
          },
          main_tech_tools: { 
            type: "array", 
            items: { type: "string" },
            description: "כלים וטכנולוגיות"
          }
        }
      }
    });

    return response || {};
  };

  const buildCandidateData = async (parsed, fileUrl, fileName) => {
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

    // Normalize security clearance - same logic as email scanner
    let securityClearance = 'לא רלוונטי';
    if (parsed.security_clearance) {
      const sc = parsed.security_clearance.toLowerCase();
      if (sc.includes('סודי ביותר') || sc.includes('רמה 1')) {
        securityClearance = 'רמה 1';
      } else if (sc.includes('סודי') || sc.includes('רמה 2')) {
        securityClearance = 'רמה 2';
      } else if (sc.includes('שמור') || sc.includes('רמה 3')) {
        securityClearance = 'רמה 3';
      } else if (sc.includes('נמוך')) {
        securityClearance = 'סווג נמוך';
      } else if (sc.includes('ללא')) {
        securityClearance = 'ללא סווג';
      }
    }

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

    return {
      full_name: parsed.full_name || `${firstName} ${lastName}`,
      first_name: firstName,
      last_name: lastName,
      id_number: parsed.id_number || null,
      email: parsed.email || null,
      phone_primary: parsed.phone || null,
      address: parsed.address || null,
      date_of_birth: parsed.date_of_birth || null,
      education_1: parsed.education_1 || null,
      education_2: parsed.education_2 || null,
      education_3: parsed.education_3 || null,
      education: [parsed.education_1, parsed.education_2, parsed.education_3].filter(e => e).join(' | ') || null,
      main_experience: parsed.main_experience || null,
      military_service: parsed.military_service || null,
      security_clearance: securityClearance,
      job_1_company: parsed.job_1_company || null,
      job_1_role: parsed.job_1_role || null,
      job_1_description: parsed.job_1_description || null,
      job_2_company: parsed.job_2_company || null,
      job_2_role: parsed.job_2_role || null,
      job_2_description: parsed.job_2_description || null,
      job_3_company: parsed.job_3_company || null,
      job_3_role: parsed.job_3_role || null,
      job_3_description: parsed.job_3_description || null,
      job_4_company: parsed.job_4_company || null,
      job_4_role: parsed.job_4_role || null,
      job_4_description: parsed.job_4_description || null,
      job_5_company: parsed.job_5_company || null,
      job_5_role: parsed.job_5_role || null,
      job_5_description: parsed.job_5_description || null,
      main_tech_tools: Array.isArray(parsed.main_tech_tools) ? parsed.main_tech_tools.join(', ') : '',
      main_programming_languages: Array.isArray(parsed.main_programming_languages) ? parsed.main_programming_languages.join(', ') : '',
      skills_summary: parsed.main_experience || (Array.isArray(parsed.detected_skills) ? parsed.detected_skills.join(', ') : ''),
      // Store detected tags from AI - same as email scanner
      detected_skills: parsed.detected_skills || [],
      detected_languages: parsed.main_programming_languages || [],
      detected_tools: parsed.main_tech_tools || [],
      years_experience: parsed.years_experience || null,
      education_level: parsed.education_level || null,
      resume_file_url: fileUrl,
      original_filename: fileName,
      source_email_id: null, // Manual upload has no email
      source_email_subject: null,
      source_email_date: new Date().toISOString(), // Use current date for manual uploads
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

  const startUpload = useCallback(async (files, onComplete) => {
    if (files.length === 0 || isUploading) return;

    setIsUploading(true);
    setProgress(0);
    setResults([]);
    shouldStopRef.current = false;
    setTotalFiles(files.length);
    setCurrentFileIndex(0);
    setStatusMessage("מתחיל העלאה...");

    const uploadResults = [];

    for (let i = 0; i < files.length; i++) {
      setCurrentFileIndex(i + 1);
      const file = files[i];
      setCurrentFileName(file.name);

      if (shouldStopRef.current) {
        setStatusMessage(`העלאה הופסקה. הושלמו ${i} מתוך ${files.length} קבצים.`);
        break;
      }

      let fileResult;

      try {
        if (!isValidCvFile(file.name)) {
          throw new Error(`סוג קובץ לא נתמך. נתמכים: קבצי PDF בלבד`);
        }

        // Step 1: Upload
        setStatusMessage(`מעלה ${file.name}...`);
        const uploadResult = await retryNetworkOperation(() => UploadFile({ file }), 7, 4000);
        
        // Step 2: Analyze with AI
        setStatusMessage(`מנתח עם AI את ${file.name}...`);
        const parsedData = await retryNetworkOperation(() => 
          analyzeResumeWithAI(uploadResult.file_url, file.name), 3, 2000);

        // Build candidate data
        const candidateData = await buildCandidateData(parsedData, uploadResult.file_url, file.name);

        // Clean null/undefined values
        const cleanData = {};
        for (const [key, value] of Object.entries(candidateData)) {
          if (value !== null && value !== undefined && value !== '') {
            cleanData[key] = value;
          }
        }

        // Step 3: Check for duplicates
        setStatusMessage(`בודק כפלים עבור ${file.name}...`);
        
        let shouldCreateCandidate = true;
        
        try {
          const duplicateCheck = await retryNetworkOperation(() => checkDuplicateCandidates({
            first_name: cleanData.first_name,
            last_name: cleanData.last_name,
            email: cleanData.email,
            phone_primary: cleanData.phone_primary
          }), 2, 1000);

          if (duplicateCheck.data?.hasDuplicates) {
            const highConfidenceDuplicates = duplicateCheck.data.duplicates.filter(d => d.matchScore >= 80);
            if (highConfidenceDuplicates.length > 0) {
              shouldCreateCandidate = false;
              fileResult = { 
                name: file.name, 
                status: "skipped", 
                message: `דולג - מועמד דומה כבר קיים: ${highConfidenceDuplicates[0].first_name} ${highConfidenceDuplicates[0].last_name}`,
                candidateName: `${cleanData.first_name || ''} ${cleanData.last_name || ''}`.trim()
              };
            }
          }
        } catch (duplicateError) {
          console.warn(`Duplicate check failed for ${file.name}:`, duplicateError);
        }

        // Step 4: Create Candidate
        if (shouldCreateCandidate) {
          setStatusMessage(`יוצר מועמד עבור ${file.name}...`);
          
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
          let updated = false;

          if (existingCandidate) {
            await Candidate.update(existingCandidate.id, cleanData);
            candidateId = existingCandidate.id;
            updated = true;
          } else {
            const newCandidate = await retryNetworkOperation(() => Candidate.create(cleanData), 3, 2000);
            candidateId = newCandidate.id;
            created = true;
          }

          // Step 5: Create Inbox Entry (same as email scanner)
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
          
          fileResult = { 
            name: file.name, 
            status: "success", 
            message: created ? 'הועלה ונותח בהצלחה' : 'עודכן מועמד קיים',
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
      setResults([...uploadResults]);
      setProgress(((i + 1) / files.length) * 100);

      // Delay between files
      if (i < files.length - 1) {
        await delay(2000);
      }
    }

    const successCount = uploadResults.filter(r => r.status === 'success').length;
    const errorCount = uploadResults.filter(r => r.status === 'error').length;
    const skippedCount = uploadResults.filter(r => r.status === 'skipped').length;
    
    setStatusMessage(`הושלם: ${successCount} הצלחות, ${errorCount} שגיאות, ${skippedCount} דולגו`);
    setIsUploading(false);
    setCurrentFileName('');

    if (onComplete) {
      onComplete();
    }
  }, [isUploading]);

  const stopUpload = useCallback(() => {
    shouldStopRef.current = true;
    setStatusMessage("עוצר לאחר הקובץ הנוכחי...");
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
    setStatusMessage('');
    setProgress(0);
    setTotalFiles(0);
    setCurrentFileIndex(0);
  }, []);

  const value = {
    isUploading,
    currentFileName,
    progress,
    totalFiles,
    currentFileIndex,
    statusMessage,
    results,
    startUpload,
    stopUpload,
    clearResults
  };

  return (
    <ManualUploadContext.Provider value={value}>
      {children}
    </ManualUploadContext.Provider>
  );
}