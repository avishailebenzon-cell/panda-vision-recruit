import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { UploadFile, InvokeLLM } from "@/integrations/Core";
import { Candidate } from "@/entities/Candidate";
import { NewCandidateInbox } from "@/entities/NewCandidateInbox";
import { checkDuplicateCandidates } from "@/functions/checkDuplicateCandidates";
import { findJobMatches } from "@/functions/findJobMatches";
import { getNextCandidateNumber } from "@/functions/getNextCandidateNumber";
import { CandidateStatus } from '@/entities/CandidateStatus';
import DuplicateCheckDialog from "./DuplicateCheckDialog";
import {
  Upload,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export default function FileUploadArea({ onUploadComplete }) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState({ message: "", type: "" });
  const [uploadResults, setUploadResults] = useState([]);
  const [isStopping, setIsStopping] = useState(false);
  const shouldStopRef = useRef(false);
  const [totalFilesToProcess, setTotalFilesToProcess] = useState(0);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [duplicateDialog, setDuplicateDialog] = useState({
    isOpen: false,
    candidateData: null,
    duplicates: [],
    pendingActions: null
  });
  const [systemLoad, setSystemLoad] = useState('normal');

  const isValidCvFile = (fileName) => {
    // Only PDF is supported by the AI analysis (InvokeLLM)
    const validExtensions = ['.pdf'];
    const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
    return validExtensions.includes(extension);
  };

  const getFileTypeLabel = (fileName) => {
    const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
    switch (extension) {
      case '.pdf': return 'PDF';
      case '.doc': return 'Word (DOC) - לא נתמך';
      case '.docx': return 'Word (DOCX) - לא נתמך';
      case '.rtf': return 'RTF - לא נתמך';
      case '.odt': return 'OpenDocument - לא נתמך';
      case '.txt': return 'Text - לא נתמך';
      default: return 'קובץ לא נתמך';
    }
  };

  // ניתוח קורות חיים עם AI - אותו מנגנון כמו סריקת מיילים
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

  // בניית נתוני מועמד מתוצאת ה-AI
  const buildCandidateData = async (parsed, fileUrl, fileName) => {
    let firstName = '(לא זוהה)';
    let lastName = '(לא זוהה)';
    
    if (parsed.full_name) {
      const nameParts = parsed.full_name.trim().split(/\s+/);
      firstName = nameParts[0] || '(לא זוהה)';
      lastName = nameParts.slice(1).join(' ') || '(לא זוהה)';
    }
    
    // ניסיון לחלץ שם מקובץ אם לא נמצא
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

    // נרמול סיווג ביטחוני
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

    // Get default new candidate status by name (not by number)
    let defaultStatus = 'מועמד חדש';
    let defaultStatusNumber = 1; // Fallback to 1 instead of 20
    try {
      const statuses = await CandidateStatus.filter({ is_active: true });
      const newStatus = statuses.find(s => s.status_name === 'מועמד חדש');
      if (newStatus) {
        defaultStatus = newStatus.status_name;
        defaultStatusNumber = newStatus.status_number;
        console.log(`Found default status: "${defaultStatus}" with number ${defaultStatusNumber}`);
      } else {
        console.warn('Could not find "מועמד חדש" status, using fallback');
      }
    } catch (error) {
      console.warn('Could not load default status, using fallback:', error);
    }

    return {
      full_name: parsed.full_name || `${firstName} ${lastName}`,
      first_name: firstName,
      last_name: lastName,
      id_number: parsed.id_number,
      email: parsed.email,
      phone_primary: parsed.phone,
      address: parsed.address,
      date_of_birth: parsed.date_of_birth,
      education_1: parsed.education_1,
      education_2: parsed.education_2,
      education_3: parsed.education_3,
      education: [parsed.education_1, parsed.education_2, parsed.education_3].filter(e => e).join(' | '),
      main_experience: parsed.main_experience,
      military_service: parsed.military_service,
      security_clearance: securityClearance,
      job_1_company: parsed.job_1_company,
      job_1_role: parsed.job_1_role,
      job_1_description: parsed.job_1_description,
      job_2_company: parsed.job_2_company,
      job_2_role: parsed.job_2_role,
      job_2_description: parsed.job_2_description,
      job_3_company: parsed.job_3_company,
      job_3_role: parsed.job_3_role,
      job_3_description: parsed.job_3_description,
      job_4_company: parsed.job_4_company,
      job_4_role: parsed.job_4_role,
      job_4_description: parsed.job_4_description,
      job_5_company: parsed.job_5_company,
      job_5_role: parsed.job_5_role,
      job_5_description: parsed.job_5_description,
      main_tech_tools: Array.isArray(parsed.main_tech_tools) ? parsed.main_tech_tools.join(', ') : '',
      main_programming_languages: Array.isArray(parsed.main_programming_languages) ? parsed.main_programming_languages.join(', ') : '',
      skills_summary: parsed.main_experience || (Array.isArray(parsed.detected_skills) ? parsed.detected_skills.join(', ') : ''),
      resume_file_url: fileUrl,
      original_filename: fileName,
      status: defaultStatus,
      status_number: defaultStatusNumber,
      is_read: false
    };
  };

  // Helper function to categorize errors
  const categorizeError = (error) => {
    const errorMessage = error.message || error.toString();
    
    if (errorMessage.includes('DatabaseTimeout') || errorMessage.includes('database timed out') || errorMessage.includes('544')) {
      return {
        type: 'database_timeout',
        userMessage: 'שגיאת עומס בבסיס הנתונים. המערכת עמוסה מאוד. מומלץ להמתין מספר דקות ולנסות שוב עם קובץ אחד בלבד.',
        severity: 'critical'
      };
    }
    
    if (errorMessage.includes('Network Error')) {
      return {
        type: 'network_error',
        userMessage: 'בעיית רשת - נסה שוב בעוד רגע',
        severity: 'high'
      };
    }
    
    if (errorMessage.includes('The document has no pages') || errorMessage.includes('no pages')) {
      return {
        type: 'empty_document',
        userMessage: 'הקובץ ריק או פגום - נסה קובץ אחר',
        severity: 'medium'
      };
    }
    
    if (errorMessage.includes('Poor quality text')) {
      return {
        type: 'poor_quality',
        userMessage: 'לא הצלחנו לחלץ טקסט מהקובץ - יתכן שהוא מוגן בסיסמה או פגום',
        severity: 'medium'
      };
    }
    
    return {
      type: 'unknown',
      userMessage: errorMessage.substring(0, 100) + (errorMessage.length > 100 ? '...' : ''),
      severity: 'medium'
    };
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (uploading) return;
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const retryNetworkOperation = async (operation, maxRetries = 3, baseDelay = 2000) => {
    let lastError;
    let timeoutCount = 0;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        const errorInfo = categorizeError(error);
        console.warn(`Network operation attempt ${attempt + 1}/${maxRetries + 1} failed:`, error.message);
        
        if (errorInfo.type === 'database_timeout') {
          timeoutCount++;
          if (timeoutCount >= 2) {
            setSystemLoad('critical');
          }
        }
        
        const isRetryableError = ['database_timeout', 'network_error'].includes(errorInfo.type) ||
          (error.response && [500, 502, 503, 504, 544].includes(error.response.status));
        
        if (!isRetryableError || attempt === maxRetries) {
          throw error;
        }
        
        const delayMs = errorInfo.type === 'database_timeout' ? 
          (baseDelay * 3) * Math.pow(2, attempt) + Math.random() * 3000 :
          baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        
        console.log(`Waiting ${Math.round(delayMs)}ms before retry (attempt ${attempt + 1})...`);
        await delay(delayMs);
      }
    }
    throw lastError;
  };

  const handleFilesUpload = async (files) => {
    if (files.length === 0 || uploading) return;

    setSystemLoad('normal');
    setUploading(true);
    setUploadProgress(0);
    setUploadResults([]);
    shouldStopRef.current = false;
    setIsStopping(false);
    setTotalFilesToProcess(files.length);
    setCurrentFileIndex(0);
    setUploadStatus({ message: "מתחיל העלאה...", type: "info" });

    const results = [];
    const totalFiles = files.length;
    let consecutiveErrors = 0;

    for (let i = 0; i < files.length; i++) {
        setCurrentFileIndex(i + 1);

        if (shouldStopRef.current) {
            setUploadStatus({
                message: `העלאה הופסקה. הושלמו ${i} מתוך ${totalFiles} קבצים.`,
                type: "warning"
            });
            break;
        }

        const file = files[i];
        let fileResult;

        try {
            if (!isValidCvFile(file.name)) {
                throw new Error(`סוג קובץ לא נתמך: ${getFileTypeLabel(file.name)}. נתמכים: קבצי PDF בלבד`);
            }

            // Step 1: Upload
            setUploadStatus({ message: `[${i+1}/${totalFiles}] מעלה ${file.name}...`, type: 'info' });
            let uploadResult;
            try {
              uploadResult = await retryNetworkOperation(() => UploadFile({ file }), 7, 4000);
              consecutiveErrors = 0;
            } catch (uploadError) {
              consecutiveErrors++;
              const errorInfo = categorizeError(uploadError);
              if (errorInfo.severity === 'critical') {
                setSystemLoad('critical');
              }
              throw new Error(errorInfo.userMessage);
            }
            
            // Step 2: Analyze with AI (same mechanism as email scanner)
            setUploadStatus({ message: `[${i+1}/${totalFiles}] מנתח עם AI את ${file.name}...`, type: 'info' });
            let parsedData;
            try {
              parsedData = await retryNetworkOperation(() => 
                analyzeResumeWithAI(uploadResult.file_url, file.name), 3, 2000);
            } catch (aiError) {
              const errorInfo = categorizeError(aiError);
              throw new Error(errorInfo.userMessage);
            }

            // Build candidate data from AI response
            const candidateData = await buildCandidateData(parsedData, uploadResult.file_url, file.name);

            // Step 3: Check for duplicates
            setUploadStatus({ message: `[${i+1}/${totalFiles}] בודק כפלים עבור ${file.name}...`, type: 'info' });
            
            let shouldCreateCandidate = true;
            
            try {
                const duplicateCheck = await retryNetworkOperation(() => checkDuplicateCandidates({
                    first_name: candidateData.first_name,
                    last_name: candidateData.last_name,
                    email: candidateData.email,
                    phone_primary: candidateData.phone_primary
                }), 2, 1000);

                if (duplicateCheck.data?.hasDuplicates) {
                    console.log(`Found ${duplicateCheck.data.duplicates.length} potential duplicates for ${candidateData.first_name} ${candidateData.last_name}`);
                    
                    const highConfidenceDuplicates = duplicateCheck.data.duplicates.filter(d => d.matchScore >= 80);
                    if (highConfidenceDuplicates.length > 0) {
                        shouldCreateCandidate = false;
                        fileResult = { 
                            name: file.name, 
                            status: "skipped", 
                            message: `דולג - מועמד דומה כבר קיים במערכת: ${highConfidenceDuplicates[0].first_name} ${highConfidenceDuplicates[0].last_name}`,
                            candidateName: `${candidateData.first_name || ''} ${candidateData.last_name || ''}`.trim()
                        };
                    }
                }
            } catch (duplicateError) {
                console.warn(`Warning: Duplicate check failed for ${file.name}:`, duplicateError);
                // Continue with creation if duplicate check fails
            }

            // Step 4: Get next candidate number
            if (shouldCreateCandidate) {
                setUploadStatus({ message: `[${i+1}/${totalFiles}] מקצה מספר מועמד...`, type: 'info' });
                const numberResult = await retryNetworkOperation(() => getNextCandidateNumber({}), 2, 1000);
                candidateData.candidate_number = numberResult.data.candidateNumber;
                
                // Step 5: Create Candidate
                setUploadStatus({ message: `[${i+1}/${totalFiles}] יוצר מועמד עבור ${file.name}...`, type: 'info' });
                const newCandidate = await retryNetworkOperation(() => Candidate.create(candidateData), 3, 2000);

                // Step 6: Create Inbox Entry
                await retryNetworkOperation(() => NewCandidateInbox.create({
                    candidate_id: newCandidate.id,
                    candidate_name: `${newCandidate.first_name || ''} ${newCandidate.last_name || ''}`.trim(),
                    candidate_email: newCandidate.email,
                    candidate_phone: newCandidate.phone_primary,
                    security_clearance: newCandidate.security_clearance,
                    resume_file_url: uploadResult.file_url,
                    original_filename: file.name,
                    source: 'manual_upload',
                    skills_summary: newCandidate.skills_summary,
                    is_processed: false,
                }), 2, 1000);
                
                // Step 7: Auto-match to jobs using synonyms
                try {
                    setUploadStatus({ message: `[${i+1}/${totalFiles}] מחפש התאמות עם מילים נרדפות...`, type: 'info' });
                    await findJobMatches({
                        candidateId: newCandidate.id,
                        candidateData: candidateData
                    });
                    console.log(`Created auto-matches for: ${newCandidate.first_name} ${newCandidate.last_name}`);
                } catch (matchError) {
                    console.warn(`Failed to auto-match candidate: ${matchError.message}`);
                }
                
                fileResult = { 
                    name: file.name, 
                    status: "success", 
                    message: `הועלה ונותח בהצלחה (${getFileTypeLabel(file.name)})`,
                    candidateName: `${newCandidate.first_name || ''} ${newCandidate.last_name || ''}`.trim()
                };
            }
        } catch (error) {
            console.error(`❌ Error processing file ${file.name}:`, error);
            const errorInfo = categorizeError(error);
            
            if (errorInfo.severity === 'critical') {
                setSystemLoad('critical');
            }
            
            fileResult = { 
                name: file.name, 
                status: "error", 
                message: `${errorInfo.userMessage} (${getFileTypeLabel(file.name)})` 
            };
        }

        results.push(fileResult);
        setUploadProgress(((i + 1) / totalFiles) * 100);

        // Adaptive delay
        if (i < files.length - 1) {
          let delayTime = 3000;
          
          if (systemLoad === 'high') delayTime = 6000;
          if (systemLoad === 'critical') delayTime = 10000;
          if (consecutiveErrors > 0) delayTime += consecutiveErrors * 2000;
          
          setUploadStatus({ message: `ממתין ${delayTime / 1000} שניות לפני הקובץ הבא...`, type: 'info' });
          await delay(delayTime);
        }
    }

    setUploadResults(results);
    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;
    
    let finalMessage;
    if (shouldStopRef.current) {
        finalMessage = `העיבוד הופסק. ${successCount} הצלחות, ${errorCount} שגיאות, ${skippedCount} דולגו.`;
    } else {
        finalMessage = `העיבוד הושלם! ${successCount} הצלחות, ${errorCount} שגיאות, ${skippedCount} דולגו.`;
    }
    
    if (systemLoad === 'critical') {
        finalMessage += `\n\n⚠️ זוהה עומס קריטי על המערכת. אם הבעיה ממשיכה, אנא פנה לתמיכה.`;
    }

    setUploadStatus({
        message: finalMessage,
        type: errorCount > 0 ? "error" : (skippedCount > 0 ? "warning" : "success")
    });

    setUploading(false);
    setIsStopping(false);

    if (onUploadComplete) {
        onUploadComplete();
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesUpload(Array.from(e.dataTransfer.files));
      e.dataTransfer.clearData();
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesUpload(Array.from(e.target.files));
    }
  };

  const handleStopUpload = () => {
    shouldStopRef.current = true;
    setIsStopping(true);
    setUploadStatus({
      message: "בקשת עצירה התקבלה, התהליך יפסיק לאחר סיום הקובץ הנוכחי...",
      type: "warning"
    });
  };

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            העלאת קורות חיים
            {systemLoad !== 'normal' && (
              <Badge className={systemLoad === 'critical' ? 'bg-red-500 text-white' : 'bg-yellow-500 text-white'}>
                {systemLoad === 'critical' ? 'עומס קריטי' : 'עומס גבוה'}
              </Badge>
            )}
          </CardTitle>
          <div className="text-sm text-gray-600 space-y-1">
            <div>• נתמכים: <strong>קבצי PDF בלבד</strong></div>
            <div>• גודל מקסימלי: 50MB</div>
            <div>• הקובץ לא יכול להיות מוגן בסיסמה</div>
            <div>• המערכת תבצע ניתוח אוטומטי של התוכן</div>
            <div className="text-amber-600">⚠️ קבצי Word (DOC/DOCX) אינם נתמכים - יש להמיר ל-PDF</div>
            {systemLoad !== 'normal' && (
              <Alert className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <strong>המערכת עמוסה כרגע.</strong> מומלץ להעלות קובץ אחד בכל פעם ולהמתין בין העלאות.
                  {systemLoad === 'critical' && (
                    <><br /><strong>עומס קריטי:</strong> המתן 5-10 דקות לפני ניסיון חוזר.</>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
              isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
            } ${uploading ? 'pointer-events-none opacity-50' : ''}`}
          >
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-600 mb-2">
              גרור ושחרר קבצי קורות חיים כאן
            </p>
            <p className="text-xs text-gray-500 mb-4">או</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => document.getElementById('file-upload').click()}
              disabled={uploading}
            >
              בחר קבצים
            </Button>
            <input
              id="file-upload"
              type="file"
              multiple
              accept=".pdf"
              className="hidden"
              onChange={handleFileInput}
              disabled={uploading}
            />
            <p className="text-xs text-blue-600 mt-3 font-medium">
              ✅ נתמכים: קבצי PDF בלבד
            </p>
          </div>

          {uploading && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <Progress value={uploadProgress} className="flex-1 mr-4" />
                <span className="text-sm text-gray-600 min-w-max">
                  {currentFileIndex}/{totalFilesToProcess}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-blue-600 flex-1 min-w-0">
                  <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                  <span className="text-sm truncate">{uploadStatus.message}</span>
                </div>
                {!isStopping ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStopUpload}
                    className="text-red-600 border-red-200 hover:bg-red-50 flex-shrink-0"
                  >
                    עצור העלאה
                  </Button>
                ) : (
                  <Badge variant="outline" className="text-orange-600 border-orange-300 flex-shrink-0">
                    עוצר לאחר קובץ נוכחי...
                  </Badge>
                )}
              </div>
            </div>
          )}

          {uploadResults.length > 0 && (
              <div className="mt-4 space-y-3">
                   <Alert className={`mt-4 ${
                      uploadStatus.type === 'success' ? 'border-green-200 bg-green-50' :
                      uploadStatus.type === 'error' ? 'border-red-200 bg-red-50' :
                      uploadStatus.type === 'warning' ? 'border-yellow-200 bg-yellow-50' :
                      'border-blue-200 bg-blue-50'
                   }`}>
                      {uploadStatus.type === 'success' ? <CheckCircle className="h-4 w-4 text-green-600" /> :
                       uploadStatus.type === 'error' ? <AlertCircle className="h-4 w-4 text-red-600" /> :
                       uploadStatus.type === 'warning' ? <AlertCircle className="h-4 w-4 text-yellow-600" /> :
                       <RefreshCw className="h-4 w-4 text-blue-600" />}
                      <AlertDescription className={`${
                          uploadStatus.type === 'success' ? 'text-green-700' :
                          uploadStatus.type === 'error' ? 'text-red-700' :
                          uploadStatus.type === 'warning' ? 'text-yellow-700' :
                          'text-blue-700'
                      } whitespace-pre-line`}>
                        {uploadStatus.message}
                      </AlertDescription>
                  </Alert>
                <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                    <AnimatePresence>
                      {uploadResults.map((result, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className={`flex items-center gap-3 p-3 rounded-lg border ${
                            result.status === 'success' ? 'bg-green-50 border-green-200' :
                            result.status === 'skipped' ? 'bg-yellow-50 border-yellow-200' : 
                            'bg-red-50 border-red-200' 
                          }`}
                        >
                          {result.status === 'success' ? (
                            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                          ) : result.status === 'skipped' ? ( 
                            <Info className="w-5 h-5 text-yellow-600 flex-shrink-0" /> 
                          ) : (
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{result.name}</p>
                            <p className={`text-xs ${
                              result.status === 'success' ? 'text-green-600' :
                              result.status === 'skipped' ? 'text-yellow-600' : 
                              'text-red-600'
                            } truncate`}>
                              {result.message}
                              {result.candidateName && ` - ${result.candidateName}`}
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                </div>
                <div className="mt-4 text-center">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setUploadResults([]);
                      setUploadStatus({ message: "", type: "" });
                      setSystemLoad('normal');
                    }}
                    className="text-sm"
                  >
                    סגור תוצאות
                  </Button>
                </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      <DuplicateCheckDialog
        isOpen={duplicateDialog.isOpen}
        onClose={() => setDuplicateDialog({ isOpen: false, candidateData: null, duplicates: [], pendingActions: null })}
        duplicates={duplicateDialog.duplicates}
        candidateName={duplicateDialog.candidateData ? `${duplicateDialog.candidateData.first_name} ${duplicateDialog.candidateData.last_name}` : ''}
        onProceed={() => {
          if (duplicateDialog.pendingActions) {
            duplicateDialog.pendingActions.proceed();
          }
          setDuplicateDialog({ isOpen: false, candidateData: null, duplicates: [], pendingActions: null });
        }}
        onCancel={() => {
          if (duplicateDialog.pendingActions) {
            duplicateDialog.pendingActions.cancel();
          }
          setDuplicateDialog({ isOpen: false, candidateData: null, duplicates: [], pendingActions: null });
        }}
      />
    </>
  );
}