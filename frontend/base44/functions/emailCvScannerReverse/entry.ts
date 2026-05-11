import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Scan up to 2 emails per run to avoid timeout (reduced for stability)
const BATCH_SIZE = 2;
const MAX_RETRY_ATTEMPTS = 1;

// Helper function to load and apply synonyms for security clearance detection
async function loadSecuritySynonyms(base44) {
    try {
        const synonyms = await base44.asServiceRole.entities.SynonymMapping.filter({ is_active: true });
        return synonyms || [];
    } catch (error) {
        console.warn('Could not load synonyms:', error.message);
        return [];
    }
}

function detectSecurityClearanceWithSynonyms(text, synonyms) {
    if (!text) return 'לא רלוונטי';
    
    const lowerText = text.toLowerCase();
    
    // Build dynamic detection rules from synonyms
    // Look for synonyms where synonym_word contains security level keywords
    const level1Keywords = ['רמה 1', 'סודי ביותר'];
    const level2Keywords = ['רמה 2', 'סודי'];
    const level3Keywords = ['רמה 3', 'שמור'];
    const lowLevelKeywords = ['סווג נמוך'];
    const noClearanceKeywords = ['ללא סווג'];
    
    // Add synonym mappings - check if original_word appears in text and maps to a security level
    for (const syn of synonyms) {
        const originalLower = (syn.original_word || '').toLowerCase();
        const synonymLower = (syn.synonym_word || '').toLowerCase();
        
        if (lowerText.includes(originalLower)) {
            // Check what security level the synonym maps to
            let detectedLevel = null;
            if (level1Keywords.some(k => synonymLower.includes(k))) detectedLevel = 'רמה 1';
            else if (level2Keywords.some(k => synonymLower.includes(k))) detectedLevel = 'רמה 2';
            else if (level3Keywords.some(k => synonymLower.includes(k))) detectedLevel = 'רמה 3';
            else if (lowLevelKeywords.some(k => synonymLower.includes(k))) detectedLevel = 'סווג נמוך';
            else if (noClearanceKeywords.some(k => synonymLower.includes(k))) detectedLevel = 'ללא סווג';
            
            if (detectedLevel) return detectedLevel;
        }
    }

    // Fallback to direct detection - Hebrew
    if (lowerText.includes('סודי ביותר') || lowerText.includes('רמה 1')) return 'רמה 1';
    if (lowerText.includes('סודי') || lowerText.includes('רמה 2')) return 'רמה 2';
    if (lowerText.includes('שמור') || lowerText.includes('רמה 3')) return 'רמה 3';
    if (lowerText.includes('נמוך')) return 'סווג נמוך';
    if (lowerText.includes('ללא')) return 'ללא סווג';
    
    // English detection patterns - only explicit clearance mentions
    if (lowerText.includes('top secret') ||
        lowerText.includes('clearance level 1') ||
        lowerText.includes('security classification level 1')) return 'רמה 1';
        
    if (lowerText.includes('clearance level 2') ||
        lowerText.includes('security classification level 2')) return 'רמה 2';
        
    if (lowerText.includes('clearance level 3') ||
        lowerText.includes('security classification level 3') ||
        lowerText.includes('confidential')) return 'רמה 3';
    
    return 'לא רלוונטי';
}

async function getAccessToken() {
    const tenantId = Deno.env.get('Directory_tenant_ID');
    const clientId = Deno.env.get('Application_ID');
    const clientSecret = Deno.env.get('Azure_App_secret');

    if (!tenantId || !clientId || !clientSecret) {
        throw new Error('Missing Microsoft Graph credentials');
    }

    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    
    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('scope', 'https://graph.microsoft.com/.default');
    params.append('grant_type', 'client_credentials');
    
    const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
    });
    
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get access token: ${error}`);
    }
    
    const data = await response.json();
    return data.access_token;
}

// Helper to handle rate limiting with retries
async function fetchWithRetry(url, options, maxRetries = 2) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, options);
            
            if (response.ok) {
                return response;
            }
            
            const errorText = await response.text();
            
            // Check for rate limiting / concurrency / transient errors
            if (errorText.includes('CommandConcurrencyLimitReached') || 
                errorText.includes('throttled') || 
                errorText.includes('UnknownError') ||
                errorText.includes('ServiceNotAvailable') ||
                response.status === 429 ||
                response.status === 500 ||
                response.status === 502 ||
                response.status === 503 ||
                response.status === 504) {
                
                // Wait longer with each retry (exponential backoff)
                const waitTime = attempt * 5000; // 5s, 10s
                console.log(`Transient error (attempt ${attempt}/${maxRetries}), waiting ${waitTime/1000}s... Error: ${errorText.substring(0, 200)}`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }
            
            // For other errors, throw immediately
            throw new Error(`API request failed: ${errorText}`);
        } catch (fetchError) {
            // Handle network errors
            if (attempt < maxRetries && (fetchError.message.includes('fetch') || fetchError.message.includes('network'))) {
                const waitTime = attempt * 3000;
                console.log(`Network error (attempt ${attempt}/${maxRetries}), waiting ${waitTime/1000}s...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }
            throw fetchError;
        }
    }
    
    throw new Error('Max retries reached due to transient errors');
}

async function getNewEmails(accessToken, lastProcessedDate) {
    const targetMailbox = 'jobs@pandatech.co.il';
    let url = `https://graph.microsoft.com/v1.0/users/${targetMailbox}/messages`;
    
    const params = new URLSearchParams();
    params.append('$top', BATCH_SIZE.toString());
    params.append('$orderby', 'receivedDateTime desc');
    params.append('$select', 'id,subject,from,receivedDateTime,hasAttachments');
    
    if (lastProcessedDate) {
        // Format date without milliseconds for Graph API compatibility
        const filterDate = new Date(lastProcessedDate).toISOString().split('.')[0] + 'Z';
        params.append('$filter', `receivedDateTime gt ${filterDate}`);
    }
    
    url += '?' + params.toString();
    
    const response = await fetchWithRetry(url, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
    }, 2); // Retries for initial fetch
    
    const data = await response.json();
    return (data.value || []).filter(email => email.hasAttachments);
}

async function getOldEmails(accessToken, oldestProcessedDate) {
    const targetMailbox = 'jobs@pandatech.co.il';
    let url = `https://graph.microsoft.com/v1.0/users/${targetMailbox}/messages`;
    
    const params = new URLSearchParams();
    params.append('$top', BATCH_SIZE.toString());
    params.append('$orderby', 'receivedDateTime desc');
    params.append('$select', 'id,subject,from,receivedDateTime,hasAttachments');
    
    if (oldestProcessedDate) {
        const filterDate = new Date(oldestProcessedDate).toISOString();
        params.append('$filter', `receivedDateTime lt ${filterDate}`);
    }
    
    url += '?' + params.toString();
    
    const response = await fetchWithRetry(url, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
    });
    
    const data = await response.json();
    return (data.value || []).filter(email => email.hasAttachments);
}

async function getAttachments(accessToken, messageId) {
    const targetMailbox = 'jobs@pandatech.co.il';
    const url = `https://graph.microsoft.com/v1.0/users/${targetMailbox}/messages/${messageId}/attachments`;
    
    const response = await fetchWithRetry(url, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
    });
    
    const data = await response.json();
    return data.value || [];
}

function isResumeFile(filename) {
    const ext = filename.toLowerCase().split('.').pop();
    return ['pdf', 'doc', 'docx', 'rtf', 'odt'].includes(ext);
}

Deno.serve(async (req) => {
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204 });
    }

    // Set a maximum execution time to avoid timeout
    const MAX_EXECUTION_TIME_MS = 55000; // 55 seconds (leave buffer for cleanup)
    const executionStartTime = Date.now();
    
    const checkTimeout = () => {
        if (Date.now() - executionStartTime > MAX_EXECUTION_TIME_MS) {
            throw new Error('TIMEOUT_APPROACHING');
        }
    };

    const startTime = new Date().toISOString();
    const sessionId = crypto.randomUUID();
    let base44 = null;
    let defaultNewCandidateStatus = null;
    
    try {
        base44 = createClientFromRequest(req);
        
        if (!base44) {
            throw new Error('Failed to create base44 client');
        }
        console.log('=== REVERSE EMAIL CV SCANNER STARTED ===');

                    // Load synonyms for security clearance detection
                    const securitySynonyms = await loadSecuritySynonyms(base44);
                    console.log(`Loaded ${securitySynonyms.length} synonyms for security clearance detection`);

                    // Get or create scan status
        let scanStatuses = await base44.asServiceRole.entities.MailScanStatus.list();
        let scanStatus = scanStatuses[0];
        
        if (!scanStatus) {
            scanStatus = await base44.asServiceRole.entities.MailScanStatus.create({
                total_emails_processed: 0,
                total_candidates_created: 0,
                total_candidates_updated: 0,
                is_running: false,
                is_reverse_running: false
            });
        }
        
        // Check if reverse scanner is already running
        if (scanStatus.is_reverse_running) {
            return Response.json({ 
                success: false, 
                message: 'סריקה הפוכה כבר רצה' 
            });
        }
        
        // Load the default "new candidate" status
        try {
            const statuses = await base44.asServiceRole.entities.CandidateStatus.filter({ is_active: true });
            defaultNewCandidateStatus = statuses.find(s => s.status_name === 'מועמד חדש');
            if (!defaultNewCandidateStatus) {
                console.warn('Warning: Could not find "מועמד חדש" status, will use fallback');
            } else {
                console.log(`Found default status: "${defaultNewCandidateStatus.status_name}" with number ${defaultNewCandidateStatus.status_number}`);
            }
        } catch (statusError) {
            console.warn('Warning: Could not load candidate statuses:', statusError.message);
        }
        
        // Update status to running
        await base44.asServiceRole.entities.MailScanStatus.update(scanStatus.id, {
            is_reverse_running: true,
            last_reverse_run_time: startTime,
            last_error: null,
            current_processing_file_reverse: null,
            current_scanner_message_reverse: 'מתחיל סריקה הפוכה...'
        });
        
        // Create run log
        const runLog = await base44.asServiceRole.entities.EmailScanLog.create({
            start_time: startTime,
            status: 'Running',
            scan_type: 'reverse',
            emails_scanned: 0,
            attachments_found: 0,
            candidates_created: 0,
            candidates_updated: 0,
            errors_count: 0
        });
        
        const accessToken = await getAccessToken();
        console.log('Got access token');
        
        // Get all previously processed files to avoid duplicates
        const allPreviousLogs = await base44.asServiceRole.entities.ScannedFileLog.filter({});
        const processedEmailIds = new Set(allPreviousLogs.map(log => log.email_id));
        
        // Build a set of ALL files we've ever tried to process
        const allProcessedFiles = new Set(
            allPreviousLogs.map(log => `${log.email_id}_${log.file_name}`)
        );
        
        const successfulFiles = new Set(
            allPreviousLogs
                .filter(log => log.processing_status === 'success')
                .map(log => `${log.email_id}_${log.file_name}`)
        );
        
        // Track successful candidate names to skip duplicate CVs from same person
        const successfulCandidateNames = new Set(
            allPreviousLogs
                .filter(log => log.processing_status === 'success' && log.candidate_name)
                .map(log => log.candidate_name.trim().toLowerCase())
        );
        
        const permanentlyFailedFiles = new Set(
            allPreviousLogs
                .filter(log => log.processing_status === 'permanently_failed')
                .map(log => `${log.email_id}_${log.file_name}`)
        );
        
        console.log(`Found ${processedEmailIds.size} previously processed emails`);
        console.log(`Previously successful files: ${successfulFiles.size}`);
        console.log(`Permanently failed files: ${permanentlyFailedFiles.size}`);
        
        let processedCount = 0;
        let createdCount = 0;
        let updatedCount = 0;
        let attachmentsFound = 0;
        let errorsCount = 0;
        let skippedCount = 0;
        
        // Get current skip count from scan status (to continue from where we left off)
        let skipCount = scanStatus.reverse_skip_count || 0;
        
        // Helper function to process a single attachment (same as regular scanner)
        const processAttachment = async (email, attachment, existingLogId = null, retryCount = 0) => {
            const fileKey = `${email.id}_${attachment.name}`;
            
            // Skip if already successfully processed
            if (successfulFiles.has(fileKey)) {
                console.log(`Skipping already processed: ${attachment.name}`);
                return { skipped: true };
            }
            
            // Skip if permanently failed
            if (permanentlyFailedFiles.has(fileKey)) {
                console.log(`Skipping permanently failed: ${attachment.name}`);
                return { skipped: true };
            }
            
            // For new files (not retries), check if we already have ANY log entry for this file
            if (!existingLogId && allProcessedFiles.has(fileKey)) {
                console.log(`Skipping file with existing log entry: ${attachment.name}`);
                return { skipped: true };
            }
            
            // Check if candidate name from filename already exists
            const fileNameWithoutExt = attachment.name.replace(/\.[^/.]+$/, '');
            const cleanedFileName = fileNameWithoutExt
                .replace(/[-_]/g, ' ')
                .replace(/cv|קורות חיים|resume/gi, '')
                .replace(/\d+/g, '')
                .trim()
                .toLowerCase();
            
            if (cleanedFileName.length > 3 && successfulCandidateNames.has(cleanedFileName)) {
                // Check when this candidate was last scanned
                const previousLog = allPreviousLogs.find(log => 
                    log.processing_status === 'success' && 
                    log.candidate_name?.trim().toLowerCase() === cleanedFileName
                );
                
                if (previousLog) {
                    const lastScanDate = new Date(previousLog.created_date);
                    const twelveMonthsAgo = new Date();
                    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
                    
                    if (lastScanDate > twelveMonthsAgo) {
                        console.log(`Skipping - candidate "${cleanedFileName}" scanned within 12 months (${lastScanDate.toLocaleDateString('he-IL')}): ${attachment.name}`);
                        
                        // Create a skipped log entry
                        if (!existingLogId) {
                            await base44.asServiceRole.entities.ScannedFileLog.create({
                                email_id: email.id,
                                email_subject: email.subject?.substring(0, 200),
                                email_date: email.receivedDateTime,
                                email_from: email.from?.emailAddress?.address || 'unknown',
                                file_name: attachment.name,
                                file_size: attachment.size || 0,
                                file_type: attachment.name.split('.').pop()?.toLowerCase() || 'unknown',
                                processing_status: 'skipped',
                                scan_session_id: sessionId,
                                scan_type: 'reverse',
                                retry_count: 0,
                                error_message: `מועמד "${cleanedFileName}" כבר נסרק לפני פחות מ-12 חודשים (${lastScanDate.toLocaleDateString('he-IL')})`
                            });
                            allProcessedFiles.add(fileKey);
                        }
                        return { skipped: true };
                    } else {
                        console.log(`Candidate "${cleanedFileName}" last scanned ${lastScanDate.toLocaleDateString('he-IL')} - over 12 months ago, will process updated CV`);
                    }
                }
            }
            
            console.log(`Processing: ${attachment.name} (attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS})`);
            
            const fileStartTime = Date.now();
            let fileLog;
            if (existingLogId) {
                await base44.asServiceRole.entities.ScannedFileLog.update(existingLogId, {
                    processing_status: 'processing',
                    scan_session_id: sessionId,
                    retry_count: retryCount
                });
                fileLog = { id: existingLogId };
            } else {
                fileLog = await base44.asServiceRole.entities.ScannedFileLog.create({
                    email_id: email.id,
                    email_subject: email.subject?.substring(0, 200),
                    email_date: email.receivedDateTime,
                    email_from: email.from?.emailAddress?.address || 'unknown',
                    file_name: attachment.name,
                    file_size: attachment.size || 0,
                    file_type: attachment.name.split('.').pop()?.toLowerCase() || 'unknown',
                    processing_status: 'processing',
                    scan_session_id: sessionId,
                    scan_type: 'reverse',
                    retry_count: 0
                });
                allProcessedFiles.add(fileKey);
            }
            
            try {
                // Update status for upload phase
                try {
                    await base44.asServiceRole.entities.MailScanStatus.update(scanStatus.id, {
                        current_processing_file_reverse: attachment.name,
                        current_scanner_message_reverse: `מעלה: ${attachment.name.substring(0, 40)}...`
                    });
                } catch (statusErr) {
                    console.warn('Could not update processing file status:', statusErr.message);
                }
                
                // Detect if file is Word document and convert to PDF
                const fileExt = attachment.name.toLowerCase().split('.').pop();
                const isWordFile = ['doc', 'docx'].includes(fileExt);
                
                let fileUrl;
                let finalFileName = attachment.name;
                
                if (isWordFile) {
                    console.log(`Word document detected: ${attachment.name} - converting to PDF...`);
                    await base44.asServiceRole.entities.MailScanStatus.update(scanStatus.id, {
                        current_scanner_message_reverse: `ממיר Word ל-PDF: ${attachment.name.substring(0, 30)}...`
                    });
                    
                    // Upload original Word file to convert
                    const wordBlob = new Blob(
                        [Uint8Array.from(atob(attachment.contentBytes), c => c.charCodeAt(0))],
                        { type: attachment.contentType }
                    );
                    const wordFile = new File([wordBlob], attachment.name, { type: attachment.contentType });
                    const wordUploadResult = await base44.asServiceRole.integrations.Core.UploadFile({ file: wordFile });
                    const wordUrl = wordUploadResult.file_url;
                    
                    // Log conversion start
                    const conversionLogId = (await base44.asServiceRole.entities.ConversionLog.create({
                        file_name: attachment.name,
                        source_format: fileExt,
                        target_format: 'pdf',
                        status: 'in_progress',
                        source_url: wordUrl,
                        email_id: email.id,
                        scan_session_id: sessionId
                    })).id;
                    
                    const conversionStartTime = Date.now();
                    
                    // Convert Word to PDF using ConvertAPI
                    const convertApiSecret = Deno.env.get('CONVERTAPI_SECRET');
                    if (!convertApiSecret) {
                        await base44.asServiceRole.entities.ConversionLog.update(conversionLogId, {
                            status: 'failed',
                            error_message: 'ConvertAPI secret not configured',
                            conversion_time_ms: Date.now() - conversionStartTime
                        });
                        throw new Error('ConvertAPI secret not configured');
                    }
                    
                    const convertUrl = `https://v2.convertapi.com/convert/${fileExt}/to/pdf?Secret=${convertApiSecret}`;
                    const convertResponse = await fetch(convertUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            Parameters: [
                                {
                                    Name: 'File',
                                    FileValue: {
                                        Url: wordUrl
                                    }
                                }
                            ]
                        })
                    });
                    
                    if (!convertResponse.ok) {
                        const errorText = await convertResponse.text();
                        await base44.asServiceRole.entities.ConversionLog.update(conversionLogId, {
                            status: 'failed',
                            error_message: errorText,
                            conversion_time_ms: Date.now() - conversionStartTime
                        });
                        throw new Error(`ConvertAPI failed: ${errorText}`);
                    }
                    
                    const convertResult = await convertResponse.json();
                    const pdfUrl = convertResult.Files?.[0]?.Url;
                    
                    if (!pdfUrl) {
                        await base44.asServiceRole.entities.ConversionLog.update(conversionLogId, {
                            status: 'failed',
                            error_message: 'No PDF URL in conversion result',
                            conversion_time_ms: Date.now() - conversionStartTime
                        });
                        throw new Error('No PDF URL in conversion result');
                    }
                    
                    console.log(`Converted to PDF: ${pdfUrl}`);
                    
                    // Download the converted PDF
                    const pdfResponse = await fetch(pdfUrl);
                    const pdfBlob = await pdfResponse.blob();
                    const pdfFileName = attachment.name.replace(/\.(doc|docx)$/i, '.pdf');
                    const pdfFile = new File([pdfBlob], pdfFileName, { type: 'application/pdf' });
                    
                    // Upload the PDF to our storage
                    const pdfUploadResult = await base44.asServiceRole.integrations.Core.UploadFile({ file: pdfFile });
                    fileUrl = pdfUploadResult.file_url;
                    finalFileName = pdfFileName;
                    
                    // Log conversion success
                    await base44.asServiceRole.entities.ConversionLog.update(conversionLogId, {
                        status: 'success',
                        converted_url: fileUrl,
                        conversion_time_ms: Date.now() - conversionStartTime
                    });
                    
                    console.log(`Uploaded converted PDF: ${fileUrl}`);
                } else {
                    // Upload the file directly (AI can handle PDF)
                    const blob = new Blob(
                        [Uint8Array.from(atob(attachment.contentBytes), c => c.charCodeAt(0))],
                        { type: attachment.contentType }
                    );
                    const file = new File([blob], attachment.name, { type: attachment.contentType });
                    
                    const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({ file });
                    fileUrl = uploadResult.file_url;
                    console.log(`Uploaded: ${fileUrl}`);
                }

                // Get next candidate number
                await base44.asServiceRole.entities.MailScanStatus.update(scanStatus.id, {
                    current_scanner_message: `מקצה מספר מועמד...`
                });
                const numberResult = await base44.asServiceRole.functions.invoke('getNextCandidateNumber', {});
                const candidateNumber = numberResult.candidateNumber;
                
                // Update status for AI extraction
                await base44.asServiceRole.entities.MailScanStatus.update(scanStatus.id, {
                    current_scanner_message_reverse: `מנתח עם AI: ${attachment.name.substring(0, 30)}...`
                });
                
                // Extract data using AI
                const aiResult = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
                    file_url: fileUrl,
                    json_schema: {
                        type: "object",
                        properties: {
                            full_name: { type: "string", description: "שם מלא" },
                            first_name: { type: "string", description: "שם פרטי" },
                            last_name: { type: "string", description: "שם משפחה" },
                            id_number: { type: "string", description: "תעודת זהות" },
                            email: { type: "string", description: "אימייל" },
                            phone_primary: { type: "string", description: "טלפון" },
                            address: { type: "string", description: "כתובת מגורים" },
                            date_of_birth: { type: "string", description: "תאריך לידה" },
                            education_1: { type: "string", description: "השכלה 1" },
                            education_2: { type: "string", description: "השכלה 2" },
                            education_3: { type: "string", description: "השכלה 3" },
                            education_level: { type: "string", description: "רמת השכלה גבוהה ביותר" },
                            main_experience: { type: "string", description: "ניסיון מרכזי - תיאור קצר" },
                            military_service: { type: "string", description: "שירות צבאי" },
                            security_clearance: { type: "string", description: "סיווג בטחוני - חלץ רק אם מצוין במפורש בקובץ קורות החיים המצורף (רמה 1/2/3, סודי, סודי ביותר, שמור). אל תסתמך על גוף המייל או הנושא. אל תשער על בסיס שם חיל בלבד." },
                            years_experience: { type: "number", description: "מספר שנות ניסיון מקצועי משוער" },
                            job_1_company: { type: "string" },
                            job_1_role: { type: "string" },
                            job_1_description: { type: "string" },
                            job_2_company: { type: "string" },
                            job_2_role: { type: "string" },
                            job_2_description: { type: "string" },
                            job_3_company: { type: "string" },
                            job_3_role: { type: "string" },
                            job_3_description: { type: "string" },
                            job_4_company: { type: "string" },
                            job_4_role: { type: "string" },
                            job_4_description: { type: "string" },
                            job_5_company: { type: "string" },
                            job_5_role: { type: "string" },
                            job_5_description: { type: "string" },
                            main_tech_tools: { type: "array", items: { type: "string" } },
                            main_programming_languages: { type: "array", items: { type: "string" } },
                            detected_skills: { type: "array", items: { type: "string" } }
                        }
                    }
                });
                
                if (aiResult.status === 'error') {
                    throw new Error(aiResult.details || 'AI extraction failed');
                }
                
                const candidateData = aiResult.output || {};
                console.log(`Extracted name: ${candidateData.full_name || 'לא זוהה'}`);
                
                // Filter out non-technical words from skills arrays
                const filterNonTechnical = (items) => {
                    if (!Array.isArray(items)) return [];
                    const nonTechnicalWords = [
                        'חרוץ', 'אדיב', 'מסור', 'אמין', 'יצירתי', 'אחראי', 'מקצועי', 'מנוסה',
                        'בעל', 'רב', 'גבוה', 'טוב', 'מצוין', 'יסודי', 'קפדני', 'מדויק', 'חברותי',
                        'ממוקד', 'יעיל', 'דייקן', 'ארגון', 'סדר', 'למידה', 'עבודה', 'צוות', 'קבוצה',
                        'hard', 'working', 'diligent', 'kind', 'creative', 'reliable', 'responsible',
                        'professional', 'experienced', 'excellent', 'thorough', 'friendly', 'efficient'
                    ];
                    return items.filter(item => {
                        const itemLower = item.toLowerCase().trim();
                        return !nonTechnicalWords.some(word => itemLower === word || itemLower.includes(word));
                    });
                };
                
                // Build candidate data
                let firstName = candidateData.first_name || '';
                let lastName = candidateData.last_name || '';
                
                if (!firstName && !lastName && candidateData.full_name) {
                    const parts = candidateData.full_name.trim().split(/\s+/);
                    firstName = parts[0] || '(לא זוהה)';
                    lastName = parts.slice(1).join(' ') || '(לא זוהה)';
                }
                
                if (!firstName) firstName = '(לא זוהה)';
                if (!lastName) lastName = '(לא זוהה)';
                
                // Normalize security clearance using synonyms
                                      const textToCheck = [
                                          candidateData.security_clearance || '',
                                          candidateData.military_service || '',
                                          candidateData.main_experience || '',
                                          candidateData.job_1_description || '',
                                          candidateData.job_2_description || '',
                                          candidateData.job_3_description || ''
                                      ].join(' ');

                                      let securityClearance = detectSecurityClearanceWithSynonyms(textToCheck, securitySynonyms);
                
                // Filter arrays before saving
                const filteredSkills = filterNonTechnical(candidateData.detected_skills || []);
                const filteredLanguages = filterNonTechnical(candidateData.main_programming_languages || []);
                const filteredTools = filterNonTechnical(candidateData.main_tech_tools || []);

                // Check for "Friend Brings Friend" referral
                let referralData = {};
                if (email.subject && email.subject.includes('חבר מביא חבר')) {
                    const senderEmail = email.from?.emailAddress?.address;
                    if (senderEmail) {
                        try {
                            const employees = await base44.asServiceRole.entities.Employee.filter({ email: senderEmail });
                            if (employees.length > 0) {
                                const employee = employees[0];
                                referralData = {
                                    is_employee_referral: true,
                                    referred_by_employee_name: employee.full_name,
                                    referred_by_employee_id: employee.id,
                                    referral_date: new Date().toISOString(),
                                    how_found_pandatech: ['חבר מביא חבר']
                                };
                                console.log(`Detected Friend Brings Friend referral from: ${employee.full_name}`);
                            } else {
                                console.log(`Referral email subject detected but sender ${senderEmail} not found in Employee list.`);
                            }
                        } catch (err) {
                            console.warn('Error looking up employee for referral:', err.message);
                        }
                    }
                }
                
                const finalData = {
                                  ...referralData,
                                  candidate_number: candidateNumber,
                                  full_name: candidateData.full_name || `${firstName} ${lastName}`,
                                  first_name: firstName,
                                  last_name: lastName,
                                          id_number: candidateData.id_number || null,
                                          email: candidateData.email || null,
                                          phone_primary: candidateData.phone_primary || null,
                                          address: candidateData.address || null,
                                          date_of_birth: candidateData.date_of_birth || null,
                                          education_1: candidateData.education_1 || null,
                                          education_2: candidateData.education_2 || null,
                                          education_3: candidateData.education_3 || null,
                                          education: [candidateData.education_1, candidateData.education_2, candidateData.education_3].filter(e => e).join(' | ') || null,
                                          main_experience: candidateData.main_experience || null,
                                          military_service: candidateData.military_service || null,
                                          security_clearance: securityClearance,
                                          job_1_company: candidateData.job_1_company || null,
                                          job_1_role: candidateData.job_1_role || null,
                                          job_1_description: candidateData.job_1_description || null,
                                          job_2_company: candidateData.job_2_company || null,
                                          job_2_role: candidateData.job_2_role || null,
                                          job_2_description: candidateData.job_2_description || null,
                                          job_3_company: candidateData.job_3_company || null,
                                          job_3_role: candidateData.job_3_role || null,
                                          job_3_description: candidateData.job_3_description || null,
                                          job_4_company: candidateData.job_4_company || null,
                                          job_4_role: candidateData.job_4_role || null,
                                          job_4_description: candidateData.job_4_description || null,
                                          job_5_company: candidateData.job_5_company || null,
                                          job_5_role: candidateData.job_5_role || null,
                                          job_5_description: candidateData.job_5_description || null,
                                          main_tech_tools: filteredTools.join(', '),
                                          main_programming_languages: filteredLanguages.join(', '),
                                          skills_summary: candidateData.main_experience || '',
                                          // NEW: Store detected tags from AI
                                          detected_skills: filteredSkills,
                                          detected_languages: filteredLanguages,
                                          detected_tools: filteredTools,
                                          years_experience: candidateData.years_experience || null,
                                          education_level: candidateData.education_level || null,
                                          resume_file_url: fileUrl,
                                          original_filename: finalFileName,
                                          source_email_id: email.id,
                                          source_email_subject: email.subject,
                                          source_email_date: email.receivedDateTime,
                                          status: defaultNewCandidateStatus?.status_name || 'מועמד חדש',
                                          status_number: defaultNewCandidateStatus?.status_number || 1,
                                          is_read: false
                                      };
                
                // Clean null/undefined values
                const cleanData = {};
                for (const [key, value] of Object.entries(finalData)) {
                    if (value !== null && value !== undefined && value !== '') {
                        cleanData[key] = value;
                    }
                }
                
                // Check for existing candidate
                let existingCandidate = null;
                
                if (cleanData.id_number) {
                    const existing = await base44.asServiceRole.entities.Candidate.filter({ id_number: cleanData.id_number });
                    if (existing.length > 0) existingCandidate = existing[0];
                }
                
                if (!existingCandidate && cleanData.email) {
                    const existing = await base44.asServiceRole.entities.Candidate.filter({ email: cleanData.email });
                    if (existing.length > 0) existingCandidate = existing[0];
                }
                
                let candidateId;
                let created = false;
                let updated = false;
                
                // Check for job code in email subject (Recruitment Agent Helper)
                let directAgentMatch = null;
                if (email.subject) {
                    const jobCodeMatch = email.subject.match(/\(pan-(\d+)\)/i);
                    if (jobCodeMatch) {
                        const jobCode = `pan-${jobCodeMatch[1]}`;
                        console.log(`🎯 Detected job code in subject: ${jobCode}`);
                        
                        try {
                            // Find the job
                            const jobs = await base44.asServiceRole.entities.Job.filter({ job_code: jobCode });
                            if (jobs.length > 0) {
                                const job = jobs[0];
                                const assignedAgent = job.assigned_agent;
                                
                                if (assignedAgent) {
                                    console.log(`✅ Job ${jobCode} is assigned to agent: ${assignedAgent}`);
                                    directAgentMatch = {
                                        jobId: job.id,
                                        jobTitle: job.title,
                                        jobCode: jobCode,
                                        agentName: assignedAgent,
                                        agentDisplayName: job.assigned_agent_name || assignedAgent
                                    };
                                } else {
                                    console.log(`⚠️ Job ${jobCode} found but no agent assigned yet`);
                                }
                            } else {
                                console.log(`⚠️ Job code ${jobCode} not found in system`);
                            }
                        } catch (jobError) {
                            console.warn(`Error looking up job ${jobCode}:`, jobError.message);
                        }
                    }
                }

                if (existingCandidate) {
                    await base44.asServiceRole.entities.Candidate.update(existingCandidate.id, cleanData);
                    candidateId = existingCandidate.id;
                    updated = true;
                } else {
                    const newCandidate = await base44.asServiceRole.entities.Candidate.create(cleanData);
                    candidateId = newCandidate.id;
                    created = true;
                    
                    // Add to inbox
                    await base44.asServiceRole.entities.NewCandidateInbox.create({
                        candidate_id: candidateId,
                        candidate_name: cleanData.full_name,
                        candidate_email: cleanData.email,
                        candidate_phone: cleanData.phone_primary,
                        security_clearance: cleanData.security_clearance,
                        resume_file_url: fileUrl,
                        original_filename: finalFileName,
                        source: 'email_auto',
                        skills_summary: cleanData.skills_summary,
                        is_processed: false
                    });
                    
                    // If job code detected, create direct match to assigned agent
                    if (directAgentMatch) {
                        try {
                            console.log(`🚀 Creating direct match: ${cleanData.full_name} → ${directAgentMatch.jobTitle} (${directAgentMatch.agentDisplayName})`);
                            
                            // Get next match number
                            const matchNumberResult = await base44.asServiceRole.functions.invoke('getNextMatchNumber', {});
                            const matchNumber = matchNumberResult.matchNumber;
                            
                            // Get recommended match status (status 3)
                            const statuses = await base44.asServiceRole.entities.CandidateStatus.filter({ is_active: true });
                            const recommendedStatus = statuses.find(s => s.status_number === 3);
                            
                            // Create match directly to agent
                            await base44.asServiceRole.entities.Match.create({
                                match_number: matchNumber,
                                job_id: directAgentMatch.jobId,
                                job_title: directAgentMatch.jobTitle,
                                candidate_id: candidateId,
                                candidate_name: cleanData.full_name,
                                user_id: 'system_auto_route',
                                user_name: `${directAgentMatch.agentDisplayName} (סיוע לסוכן)`,
                                user_app_role: 'system',
                                status: recommendedStatus?.status_name || 'המלצה אוטומטית',
                                status_number: 3,
                                match_score: 85,
                                match_reasons: `המועמד הגיש מועמדות ישירה למשרה ${directAgentMatch.jobCode} - הועבר אוטומטית ל${directAgentMatch.agentDisplayName} לבדיקה`,
                                is_automatic_recommendation: true,
                                is_read: false
                            });
                            
                            console.log(`✅ Direct match created successfully for ${directAgentMatch.agentDisplayName}`);
                            
                            // Update log with agent routing info
                            await base44.asServiceRole.entities.ScannedFileLog.update(fileLog.id, {
                                agent_routed_to: directAgentMatch.agentName,
                                agent_routed_display_name: directAgentMatch.agentDisplayName,
                                job_code_detected: directAgentMatch.jobCode
                            });
                            
                        } catch (matchError) {
                            console.warn(`Failed to create direct agent match: ${matchError.message}`);
                        }
                    } else {
                        // Regular auto-matching to all relevant agents
                        try {
                            await base44.asServiceRole.functions.invoke('findJobMatches', {
                                candidateId: candidateId,
                                candidateData: cleanData
                            });
                            console.log(`Created auto-matches for: ${cleanData.full_name}`);
                        } catch (matchError) {
                            console.warn(`Failed to auto-match candidate: ${matchError.message}`);
                        }
                    }
                }
                
                // Enhance CV automatically after saving
                try {
                    console.log(`Triggering CV enhancement for: ${cleanData.full_name}`);
                    await base44.asServiceRole.entities.MailScanStatus.update(scanStatus.id, {
                        current_scanner_message_reverse: `משבח קו"ח: ${cleanData.full_name.substring(0, 30)}...`
                    });
                    await base44.asServiceRole.functions.invoke('enhanceCandidateCv', {
                        candidate_id: candidateId
                    });
                    console.log(`CV enhancement triggered for: ${cleanData.full_name}`);
                } catch (enhanceError) {
                    console.warn(`Failed to enhance CV for ${cleanData.full_name}: ${enhanceError.message}`);
                }
                
                // Update file log with success
                const processingTimeMs = Date.now() - fileStartTime;
                await base44.asServiceRole.entities.ScannedFileLog.update(fileLog.id, {
                    processing_status: 'success',
                    candidate_id: candidateId,
                    candidate_name: cleanData.full_name,
                    security_clearance: cleanData.security_clearance,
                    file_url: fileUrl,
                    detected_skills: filteredSkills,
                    detected_languages: filteredLanguages,
                    detected_tools: filteredTools,
                    years_experience: candidateData.years_experience || null,
                    education_level: candidateData.education_level || null,
                    error_message: null,
                    processing_time_ms: processingTimeMs
                });
                
                successfulFiles.add(fileKey);
                successfulCandidateNames.add(cleanData.full_name.trim().toLowerCase());
                console.log(`${created ? 'Created' : 'Updated'}: ${cleanData.full_name}`);
                return { created, updated };
                
            } catch (error) {
                const newRetryCount = retryCount + 1;
                const isPermanentlyFailed = newRetryCount >= MAX_RETRY_ATTEMPTS;
                
                await base44.asServiceRole.entities.ScannedFileLog.update(fileLog.id, {
                    processing_status: isPermanentlyFailed ? 'permanently_failed' : 'failed',
                    error_message: `ניסיון ${newRetryCount}/${MAX_RETRY_ATTEMPTS}: ${error.message}`,
                    retry_count: newRetryCount
                });
                
                if (isPermanentlyFailed) {
                    permanentlyFailedFiles.add(fileKey);
                    console.log(`Permanently failed after ${MAX_RETRY_ATTEMPTS} attempts: ${attachment.name}`);
                } else {
                    console.log(`Failed (attempt ${newRetryCount}): ${attachment.name} - ${error.message}`);
                }
                
                return { error: true };
            }
        };
        
        // Get emails for this batch
        await base44.asServiceRole.entities.MailScanStatus.update(scanStatus.id, {
            current_scanner_message_reverse: `מחפש מיילים ישנים (דילוג: ${skipCount})...`
        });
        const emails = await getOldEmails(accessToken, skipCount);
        console.log(`Fetched ${emails.length} emails with attachments (skip: ${skipCount})`);
        
        if (emails.length === 0) {
            console.log('No more emails to process in reverse scan');
            // Reset skip count for next run
            await base44.asServiceRole.entities.MailScanStatus.update(scanStatus.id, {
                is_reverse_running: false,
                reverse_skip_count: 0,
                last_error: null
            });
            await base44.asServiceRole.entities.EmailScanLog.update(runLog.id, {
                end_time: new Date().toISOString(),
                status: 'Completed',
                summary: 'סריקה הפוכה הושלמה - אין מיילים נוספים'
            });
            return Response.json({ 
                success: true, 
                hasMoreEmails: false,
                message: 'No more emails to process' 
            });
        }
        
        // Process emails
        for (const email of emails) {
            // Check for timeout
            try {
                checkTimeout();
            } catch (timeoutError) {
                console.log('Approaching timeout - stopping gracefully');
                break;
            }
            
            // Check if stopped by user
            const currentStatus = await base44.asServiceRole.entities.MailScanStatus.list();
            if (currentStatus[0] && !currentStatus[0].is_reverse_running) {
                console.log('Reverse scan stopped by user');
                break;
            }
            
            // Skip if this email was already processed
            if (processedEmailIds.has(email.id)) {
                console.log(`Skipping already processed email: ${email.subject?.substring(0, 30)}...`);
                skippedCount++;
                continue;
            }
            
            console.log(`Processing email: ${email.subject?.substring(0, 50)}`);
            const emailDate = new Date(email.receivedDateTime).toLocaleDateString('he-IL');
            await base44.asServiceRole.entities.MailScanStatus.update(scanStatus.id, {
                current_scanner_message_reverse: `מעבד מייל מ-${emailDate}: ${email.subject?.substring(0, 30) || 'ללא נושא'}...`
            });
            
            try {
                const attachments = await getAttachments(accessToken, email.id);
                const resumeAttachments = attachments.filter(att => 
                    att['@odata.type'] === '#microsoft.graph.fileAttachment' && 
                    att.contentBytes &&
                    isResumeFile(att.name)
                );
                
                attachmentsFound += resumeAttachments.length;
                console.log(`Found ${resumeAttachments.length} resume attachments`);
                
                // Process attachments ONE BY ONE sequentially (same as regular scanner)
                for (let i = 0; i < resumeAttachments.length; i++) {
                    const attachment = resumeAttachments[i];
                    console.log(`Processing attachment ${i + 1}/${resumeAttachments.length}: ${attachment.name}`);
                    await base44.asServiceRole.entities.MailScanStatus.update(scanStatus.id, {
                        current_processing_file_reverse: attachment.name,
                        current_scanner_message_reverse: `מנתח: ${attachment.name.substring(0, 40)}...`
                    });
                    
                    try {
                        const result = await processAttachment(email, attachment);
                        
                        if (result.skipped) {
                            console.log(`Skipped: ${attachment.name}`);
                            continue;
                        }
                        if (result.created) {
                            createdCount++;
                            console.log(`Created candidate from: ${attachment.name}`);
                        }
                        if (result.updated) {
                            updatedCount++;
                            console.log(`Updated candidate from: ${attachment.name}`);
                        }
                        if (result.error) {
                            errorsCount++;
                            console.log(`Error processing ${attachment.name} - continuing to next file`);
                        }
                    } catch (attachmentError) {
                        console.error(`Unexpected error processing ${attachment.name}: ${attachmentError.message}`);
                        errorsCount++;
                    }
                    
                    // Wait before processing next attachment
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                
                processedCount++;
                processedEmailIds.add(email.id);
                
            } catch (emailError) {
                console.error(`Error processing email:`, emailError.message);
                errorsCount++;
            }
            
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        // Update skip count for next batch
        const newSkipCount = skipCount + BATCH_SIZE;
        
        // Check if there are more emails
        const moreEmails = await getOldEmails(accessToken, newSkipCount);
        const hasMoreEmails = moreEmails.length > 0;
        
        // Finalize
        const endTime = new Date().toISOString();
        
        await base44.asServiceRole.entities.MailScanStatus.update(scanStatus.id, {
            is_reverse_running: false,
            reverse_skip_count: hasMoreEmails ? newSkipCount : 0, // Reset if done
            total_emails_processed: (scanStatus.total_emails_processed || 0) + processedCount,
            total_candidates_created: (scanStatus.total_candidates_created || 0) + createdCount,
            total_candidates_updated: (scanStatus.total_candidates_updated || 0) + updatedCount,
            current_processing_file_reverse: null,
            current_scanner_message_reverse: null,
            last_error: null
        });
        
        await base44.asServiceRole.entities.EmailScanLog.update(runLog.id, {
            end_time: endTime,
            status: 'Completed',
            emails_scanned: processedCount,
            attachments_found: attachmentsFound,
            candidates_created: createdCount,
            candidates_updated: updatedCount,
            errors_count: errorsCount,
            summary: `סריקה הפוכה | מיילים: ${processedCount} | דילוג: ${skippedCount} | קבצים: ${attachmentsFound} | חדשים: ${createdCount} | עודכנו: ${updatedCount} | שגיאות: ${errorsCount}`
        });
        
        console.log('=== REVERSE SCAN BATCH COMPLETED ===');
        console.log(`More emails available: ${hasMoreEmails}`);
        
        // Trigger Yotam agent if new candidates were created
        if (createdCount > 0) {
            console.log(`Triggering Yotam agent - ${createdCount} new candidates detected`);
            try {
                await base44.asServiceRole.functions.invoke('runYotamAgent', {});
                console.log('Yotam agent triggered successfully');
            } catch (yotamError) {
                console.warn('Failed to trigger Yotam agent:', yotamError.message);
            }
        }
        
        return Response.json({
            success: true,
            hasMoreEmails: hasMoreEmails,
            stats: {
                emailsScanned: processedCount,
                emailsSkipped: skippedCount,
                attachmentsFound: attachmentsFound,
                candidatesCreated: createdCount,
                candidatesUpdated: updatedCount,
                errors: errorsCount
            }
        });
        
    } catch (error) {
        console.error('Critical error:', error.message);
        
        // Handle timeout gracefully
        if (error.message === 'TIMEOUT_APPROACHING') {
            if (base44) {
                try {
                    const scanStatuses = await base44.asServiceRole.entities.MailScanStatus.list();
                    if (scanStatuses[0]) {
                        await base44.asServiceRole.entities.MailScanStatus.update(scanStatuses[0].id, {
                            is_reverse_running: false,
                            last_error: null,
                            current_processing_file_reverse: null,
                            current_scanner_message_reverse: null
                        });
                    }
                } catch (e) {
                    console.error('Failed to update status:', e.message);
                }
            }
            return Response.json({ 
                success: true, 
                hasMoreEmails: true,
                message: 'Stopped gracefully before timeout - run again to continue'
            });
        }
        
        if (base44) {
            try {
                const scanStatuses = await base44.asServiceRole.entities.MailScanStatus.list();
                if (scanStatuses[0]) {
                    await base44.asServiceRole.entities.MailScanStatus.update(scanStatuses[0].id, {
                        is_reverse_running: false,
                        last_error: error.message,
                        current_processing_file_reverse: null,
                        current_scanner_message_reverse: null
                    });
                }
            } catch (e) {
                console.error('Failed to update status:', e.message);
            }
        }
        
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});