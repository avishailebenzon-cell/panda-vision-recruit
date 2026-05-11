import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Scan 1 email per run - AI extraction can take 3-5 minutes per file, stays within 502 timeout
const BATCH_SIZE = 1;
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

    // Set a maximum execution time to avoid timeout (leave 10s buffer for cleanup before 502)
    const MAX_EXECUTION_TIME_MS = 50000; // 50 seconds
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
        console.log('=== EMAIL CV SCANNER STARTED ===');

                    // Load synonyms for security clearance detection
                    const securitySynonyms = await loadSecuritySynonyms(base44);
                    console.log(`Loaded ${securitySynonyms.length} synonyms for security clearance detection`);

                    // Load the default "new candidate" status by name
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
        
        // Get or create scan status
        let scanStatuses = await base44.asServiceRole.entities.MailScanStatus.list();
        let scanStatus = scanStatuses[0];
        
        if (!scanStatus) {
            scanStatus = await base44.asServiceRole.entities.MailScanStatus.create({
                total_emails_processed: 0,
                total_candidates_created: 0,
                total_candidates_updated: 0,
                is_running: false
            });
        }
        
        // Auto-reset if stuck running for more than 7 minutes (automation runs every 5min, scan can take up to 6min)
        if (scanStatus.is_running) {
            const lastRunTime = scanStatus.last_run_time ? new Date(scanStatus.last_run_time) : null;
            const sevenMinutesAgo = new Date(Date.now() - 7 * 60 * 1000);
            if (!lastRunTime || lastRunTime < sevenMinutesAgo) {
                console.log('Scanner was stuck (running > 7min) - auto-resetting...');
                await base44.asServiceRole.entities.MailScanStatus.update(scanStatus.id, {
                    is_running: false,
                    last_error: null,
                    current_processing_file: null,
                    current_scanner_message: null
                });
                scanStatus.is_running = false;
            } else {
                console.log('Scanner already running (recently started) - skipping');
                return Response.json({ success: false, message: 'סריקה כבר רצה' });
            }
        }
        
        // Update status to running
        await base44.asServiceRole.entities.MailScanStatus.update(scanStatus.id, {
            is_running: true,
            last_run_time: startTime,
            last_error: null,
            current_processing_file: null,
            current_scanner_message: 'מתחיל סריקה רגילה...'
        });

        // Log to SystemActivityLog
        try {
            await base44.asServiceRole.entities.SystemActivityLog.create({
                actor_type: 'agent',
                actor_name: 'raviv',
                actor_image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face',
                action_type: 'email_scan',
                action_description: 'התחלת סריקת מיילים לקורות חיים',
                status: 'in_progress'
            });
        } catch (logErr) {
            console.warn('Failed to log activity:', logErr.message);
        }
        
        // Create run log
        const runLog = await base44.asServiceRole.entities.EmailScanLog.create({
            start_time: startTime,
            status: 'Running',
            emails_scanned: 0,
            attachments_found: 0,
            candidates_created: 0,
            candidates_updated: 0,
            errors_count: 0
        });
        
        const accessToken = await getAccessToken();
        console.log('Got access token');
        
        // Get all previously processed files to avoid duplicates
         // Fetch ALL logs (not just first 50) to ensure complete coverage
         let allPreviousLogs = await base44.asServiceRole.entities.ScannedFileLog.list('-created_date', 10000) || [];
         if (!Array.isArray(allPreviousLogs)) {
             console.log('Warning: allPreviousLogs is not an array, converting to empty array');
             allPreviousLogs = [];
         }
        
        // Build a set of ALL files we've ever tried to process (including processing, success, skipped, permanently_failed)
        // Only 'failed' with retry attempts left should be retried
        const allProcessedFiles = new Set(
            allPreviousLogs
                .filter(log => log.processing_status !== 'failed' || (log.retry_count || 0) >= MAX_RETRY_ATTEMPTS)
                .map(log => `${log.email_id}_${log.file_name}`)
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
        
        // Find failed files that need retry (less than MAX_RETRY_ATTEMPTS)
        // Use a Map to avoid duplicates by file key
        const failedFilesMap = new Map();
        allPreviousLogs
            .filter(log => log.processing_status === 'failed' && (log.retry_count || 0) < MAX_RETRY_ATTEMPTS)
            .forEach(log => {
                const key = `${log.email_id}_${log.file_name}`;
                // Keep only the most recent log entry for each file
                if (!failedFilesMap.has(key) || log.created_date > failedFilesMap.get(key).created_date) {
                    failedFilesMap.set(key, log);
                }
            });
        const failedFilesToRetry = Array.from(failedFilesMap.values());
        
        // Find stuck "processing" files (from previous crashed runs) and mark them as failed
        // Only reset files that have been stuck for more than 10 minutes
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        const stuckProcessingFiles = allPreviousLogs.filter(log => 
            log.processing_status === 'processing' &&
            new Date(log.updated_date) < tenMinutesAgo
        );
        
        console.log(`Total files in log: ${allPreviousLogs.length}`);
        console.log(`Previously successful files: ${successfulFiles.size}`);
        console.log(`Permanently failed files: ${permanentlyFailedFiles.size}`);
        console.log(`Failed files to retry: ${failedFilesToRetry.length}`);
        console.log(`Stuck processing files to reset: ${stuckProcessingFiles.length}`);
        
        // Reset stuck processing files to failed so they can be retried
        for (const stuckLog of stuckProcessingFiles) {
            try {
                const newRetryCount = (stuckLog.retry_count || 0) + 1;
                const isPermanent = newRetryCount >= MAX_RETRY_ATTEMPTS;
                
                await base44.asServiceRole.entities.ScannedFileLog.update(stuckLog.id, {
                    processing_status: isPermanent ? 'permanently_failed' : 'failed',
                    error_message: `ניסיון ${newRetryCount}/${MAX_RETRY_ATTEMPTS}: הריצה הקודמת נקטעה`,
                    retry_count: newRetryCount
                });
                
                // Add to retry list only if not exceeded max attempts and not already in list
                const fileKey = `${stuckLog.email_id}_${stuckLog.file_name}`;
                if (!isPermanent && !failedFilesMap.has(fileKey)) {
                    failedFilesToRetry.push({
                        ...stuckLog,
                        retry_count: newRetryCount
                    });
                }
            } catch (e) {
                console.error(`Failed to reset stuck file ${stuckLog.file_name}:`, e.message);
            }
        }
        
        // Get NEW emails (after last processed date)
        await base44.asServiceRole.entities.MailScanStatus.update(scanStatus.id, {
            current_scanner_message: 'מחפש מיילים חדשים...'
        });
        const newEmails = await getNewEmails(accessToken, scanStatus.last_processed_date);
        newEmails.sort((a, b) => new Date(a.receivedDateTime) - new Date(b.receivedDateTime));
        console.log(`Found ${newEmails.length} NEW emails with attachments`);

        // Get OLD emails (before oldest processed date) for backfill
        let oldEmails = [];
        if (newEmails.length < BATCH_SIZE) {
            // If we have capacity, fetch old emails to backfill
            oldEmails = await getOldEmails(accessToken, scanStatus.oldest_processed_date);
            oldEmails.sort((a, b) => new Date(b.receivedDateTime) - new Date(a.receivedDateTime)); // newest old first
            console.log(`Found ${oldEmails.length} OLD emails to backfill`);
        }

        // Combine: process new emails first, then old emails
        const emails = [...newEmails, ...oldEmails].slice(0, BATCH_SIZE);
        console.log(`Processing ${emails.length} total emails this run`);
        
        if (emails.length === 0) {
            console.log('No emails to process - all caught up!');
            // Still mark as completed
            await base44.asServiceRole.entities.MailScanStatus.update(scanStatus.id, {
                is_running: false,
                last_error: null
            });
            await base44.asServiceRole.entities.EmailScanLog.update(runLog.id, {
                end_time: new Date().toISOString(),
                status: 'Completed',
                summary: 'אין מיילים חדשים לעיבוד'
            });
            return Response.json({ success: true, message: 'No new emails to process' });
        }
        
        let processedCount = 0;
        let createdCount = 0;
        let updatedCount = 0;
        let attachmentsFound = 0;
        let errorsCount = 0;
        let retriedCount = 0;
        let retrySuccessCount = 0;
        let lastProcessedId = scanStatus.last_processed_email_id;
        let lastProcessedDate = scanStatus.last_processed_date;
        let oldestProcessedDate = scanStatus.oldest_processed_date;
        
        // Track files being processed in THIS run to prevent duplicates within same scan
        const currentRunProcessedFiles = new Set();

        // Helper function to process a single attachment
        const processAttachment = async (email, attachment, existingLogId = null, retryCount = 0) => {
            const fileKey = `${email.id}_${attachment.name}`;

            // CRITICAL: Skip if already processed in THIS run (prevents double processing)
            if (currentRunProcessedFiles.has(fileKey)) {
                console.log(`⚠️ DUPLICATE IN SAME RUN - Skipping: ${attachment.name}`);
                return { skipped: true };
            }

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

            // Mark as being processed in THIS run
            currentRunProcessedFiles.add(fileKey);

            // CRITICAL: Double-check database to prevent race conditions between concurrent runs
            // This catches files that were processed in parallel runs that haven't updated the in-memory Set yet
            if (!existingLogId) {
                const recentLogs = await base44.asServiceRole.entities.ScannedFileLog.filter({
                    email_id: email.id,
                    file_name: attachment.name,
                    processing_status: { $in: ['success', 'processing', 'skipped'] }
                });
                
                if (recentLogs.length > 0) {
                    console.log(`⚠️ RACE CONDITION DETECTED - File already in database: ${attachment.name} (${recentLogs.length} entries found)`);
                    return { skipped: true };
                }
            }

            // Check if candidate name from filename already exists AND was scanned recently (within 12 months)
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
                    retry_count: 0
                });
                // Mark this file as processed so we don't create duplicate logs within the same run
                allProcessedFiles.add(fileKey);
            }
            
            try {
                // Update status for upload phase
                try {
                    await base44.asServiceRole.entities.MailScanStatus.update(scanStatus.id, {
                        current_processing_file: attachment.name,
                        current_scanner_message: `מעלה: ${attachment.name.substring(0, 40)}...`
                    });
                } catch (statusErr) {
                    console.warn('Could not update processing file status:', statusErr.message);
                }
                
                // Detect if file is Word document and convert to PDF
                const fileExt = attachment.name.toLowerCase().split('.').pop();
                const isWordFile = ['doc', 'docx'].includes(fileExt);
                
                let fileUrl;
                let finalFileName = attachment.name;
                let wasConverted = false;
                let pdfBytes = null; // Keep PDF bytes in scope for AI extraction
                
                if (isWordFile) {
                    console.log(`Word document detected: ${attachment.name}`);

                    // Check if this file was already converted (successfully or failed permanently)
                    const expectedPdfName = attachment.name.replace(/\.(doc|docx)$/i, '.pdf');
                    const allConversions = await base44.asServiceRole.entities.ConversionLog.filter({
                        file_name: attachment.name
                    });

                    // Check for successful conversion
                    const successfulConversion = allConversions.find(c => c.status === 'success');
                    
                    // Check for failed conversion (don't retry files that already failed)
                    const failedConversion = allConversions.find(c => c.status === 'failed');

                    if (successfulConversion && successfulConversion.converted_url) {
                        // Verify the URL is still accessible before using it
                        let urlStillValid = false;
                        try {
                            const checkResp = await fetch(successfulConversion.converted_url, { method: 'HEAD' });
                            urlStillValid = checkResp.ok;
                        } catch (e) {
                            urlStillValid = false;
                        }
                        
                        if (urlStillValid) {
                            console.log(`File already converted - using existing PDF: ${successfulConversion.converted_url}`);
                            fileUrl = successfulConversion.converted_url;
                            finalFileName = expectedPdfName;
                            wasConverted = true;
                            await base44.asServiceRole.entities.ScannedFileLog.update(fileLog.id, {
                                was_converted_to_pdf: true,
                                conversion_attempted: false,
                                file_url: fileUrl
                            });
                        } else {
                            console.log(`Existing converted PDF URL is no longer accessible - re-converting: ${attachment.name}`);
                            // Fall through to re-convert below
                        }
                    }
                    
                    if (!fileUrl && failedConversion) {
                        console.log(`File conversion previously failed - skipping to avoid wasted conversions: ${attachment.name}`);
                        
                        // Mark as skipped to avoid wasting conversion attempts
                        await base44.asServiceRole.entities.ScannedFileLog.update(fileLog.id, {
                            processing_status: 'skipped',
                            error_message: `קובץ Word שכבר נכשל בהמרה בעבר - לא מנסים שוב כדי לחסוך בעלויות`,
                            was_converted_to_pdf: false,
                            conversion_attempted: false
                        });
                        
                        return { skipped: true };
                    }
                    
                    if (!fileUrl) {
                        console.log(`Converting to PDF: ${attachment.name}...`);

                            try {
                                await base44.asServiceRole.entities.MailScanStatus.update(scanStatus.id, {
                                    current_scanner_message: `ממיר Word ל-PDF: ${attachment.name.substring(0, 30)}...`
                                });

                        // Log conversion start
                        const conversionLogId = (await base44.asServiceRole.entities.ConversionLog.create({
                            file_name: attachment.name,
                            source_format: fileExt,
                            target_format: 'pdf',
                            status: 'in_progress',
                            email_id: email.id,
                            scan_session_id: sessionId
                        })).id;

                        const conversionStartTime = Date.now();

                        // Convert Word to PDF using ConvertAPI - send base64 directly (no URL needed)
                        const convertApiSecret = Deno.env.get('CONVERTAPI_SECRET');
                        if (!convertApiSecret) {
                            throw new Error('ConvertAPI secret not configured - cannot convert Word files');
                        }

                        // Convert with retry logic
                        let convertError = null;
                        const maxConvertRetries = 3;

                        for (let convertAttempt = 1; convertAttempt <= maxConvertRetries; convertAttempt++) {
                            try {
                                const convertUrl = `https://v2.convertapi.com/convert/${fileExt}/to/pdf?Secret=${convertApiSecret}`;

                                if (convertAttempt > 1) {
                                    const waitTime = (convertAttempt - 1) * 2000;
                                    console.log(`Waiting ${waitTime/1000}s before retry...`);
                                    await new Promise(resolve => setTimeout(resolve, waitTime));
                                }

                                // Send file as base64 directly - no external URL needed
                                const convertResponse = await fetch(convertUrl, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        Parameters: [
                                            {
                                                Name: 'File',
                                                FileValue: {
                                                    Name: attachment.name,
                                                    Data: attachment.contentBytes
                                                }
                                            }
                                        ]
                                    })
                                });

                                if (!convertResponse.ok) {
                                    const errorText = await convertResponse.text();
                                    console.log(`ConvertAPI error (attempt ${convertAttempt}/${maxConvertRetries}): ${errorText.substring(0, 200)}`);
                                    convertError = errorText;
                                    continue;
                                }

                                const convertResult = await convertResponse.json();
                                const convertedFile = convertResult.Files?.[0];

                                if (convertedFile?.FileData) {
                                    // Got base64 PDF data back
                                    pdfBytes = Uint8Array.from(atob(convertedFile.FileData), c => c.charCodeAt(0));
                                    console.log(`ConvertAPI returned PDF data on attempt ${convertAttempt}`);
                                    convertError = null;
                                    break;
                                } else if (convertedFile?.Url) {
                                    // Got URL back - download it
                                    console.log(`ConvertAPI returned URL, downloading: ${convertedFile.Url}`);
                                    const dlResponse = await fetch(convertedFile.Url);
                                    if (dlResponse.ok) {
                                        pdfBytes = new Uint8Array(await dlResponse.arrayBuffer());
                                        convertError = null;
                                        break;
                                    }
                                    convertError = `Failed to download PDF from URL: ${convertedFile.Url}`;
                                } else {
                                    console.log(`ConvertAPI returned no data (attempt ${convertAttempt}/${maxConvertRetries})`);
                                    convertError = `No FileData or Url in response: ${JSON.stringify(convertResult).substring(0, 300)}`;
                                    continue;
                                }

                            } catch (fetchErr) {
                                console.log(`ConvertAPI network error (attempt ${convertAttempt}/${maxConvertRetries}): ${fetchErr.message}`);
                                convertError = fetchErr.message;
                            }
                        }

                        if (!pdfBytes) {
                            await base44.asServiceRole.entities.ConversionLog.update(conversionLogId, {
                                status: 'failed',
                                error_message: convertError || 'No PDF data after retries',
                                conversion_time_ms: Date.now() - conversionStartTime
                            });
                            throw new Error(`Failed to convert Word document after ${maxConvertRetries} attempts: ${convertError}`);
                        }

                        // Upload the PDF bytes to storage
                        const pdfFileName = attachment.name.replace(/\.(doc|docx)$/i, '.pdf');
                        const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
                        const pdfFile = new File([pdfBlob], pdfFileName, { type: 'application/pdf' });

                        let uploadedFileUrl = null;
                        for (let uploadAttempt = 1; uploadAttempt <= 3; uploadAttempt++) {
                            try {
                                const pdfUploadResult = await base44.asServiceRole.integrations.Core.UploadFile({ file: pdfFile });
                                uploadedFileUrl = pdfUploadResult.file_url;
                                console.log(`PDF uploaded successfully on attempt ${uploadAttempt}: ${uploadedFileUrl}`);
                                break;
                            } catch (uploadErr) {
                                console.log(`PDF upload failed (attempt ${uploadAttempt}/3): ${uploadErr.message}`);
                                if (uploadAttempt < 3) {
                                    await new Promise(resolve => setTimeout(resolve, uploadAttempt * 3000));
                                } else {
                                    throw new Error(`Failed to upload converted PDF after 3 attempts: ${uploadErr.message}`);
                                }
                            }
                        }
                        fileUrl = uploadedFileUrl;
                        finalFileName = pdfFileName;
                        wasConverted = true;

                        await base44.asServiceRole.entities.ConversionLog.update(conversionLogId, {
                            status: 'success',
                            converted_url: fileUrl,
                            conversion_time_ms: Date.now() - conversionStartTime
                        });

                        console.log(`Word→PDF conversion complete: ${fileUrl}`);

                        // Wait 3 seconds after upload to ensure file is fully accessible
                        console.log('Waiting 3 seconds for converted file to be ready...');
                        await new Promise(resolve => setTimeout(resolve, 3000));

                        // Update log to track conversion
                        await base44.asServiceRole.entities.ScannedFileLog.update(fileLog.id, {
                            was_converted_to_pdf: true,
                            conversion_attempted: true,
                            file_url: fileUrl
                        });
                        
                        } catch (convertError) {
                        console.error(`Word→PDF conversion failed for ${attachment.name}: ${convertError.message}`);

                        // Conversion log is already updated in the error paths above

                        // Update log with conversion failure
                        await base44.asServiceRole.entities.ScannedFileLog.update(fileLog.id, {
                            was_converted_to_pdf: false,
                            conversion_attempted: true
                        });

                        // Re-throw to handle as regular processing error
                        throw new Error(`Failed to convert Word document: ${convertError.message}`);
                        }
                    } // end if (!fileUrl)
                } else {
                    // Upload the file directly (PDF or other supported format)
                    const blob = new Blob(
                        [Uint8Array.from(atob(attachment.contentBytes), c => c.charCodeAt(0))],
                        { type: attachment.contentType }
                    );
                    const file = new File([blob], attachment.name, { type: attachment.contentType });
                    
                    const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({ file });
                    fileUrl = uploadResult.file_url;
                    console.log(`Uploaded directly: ${fileUrl}`);
                }

                // Get next candidate number - inline to avoid inter-function auth issues
                const recentCandidates = await base44.asServiceRole.entities.Candidate.filter(
                    { candidate_number: { $ne: null } }, '-created_date', 1
                );
                let nextCandNum = 1;
                if (recentCandidates.length > 0) {
                    const lastNum = recentCandidates[0].candidate_number;
                    const numMatch = lastNum?.match(/CAN-(\d+)/);
                    if (numMatch) nextCandNum = parseInt(numMatch[1], 10) + 1;
                }
                const candidateNumber = `CAN-${String(nextCandNum).padStart(6, '0')}`;
                
                // Update status for AI extraction
                await base44.asServiceRole.entities.MailScanStatus.update(scanStatus.id, {
                    current_scanner_message: `מנתח עם AI: ${attachment.name.substring(0, 30)}...`
                });
                
                // Extract data using AI - upload to private storage and get signed URL for AI access
                console.log(`Calling AI extraction for: ${finalFileName}`);
                
                // Build file bytes for upload
                let aiFileBytes;
                let aiMimeType;
                if (wasConverted && pdfBytes) {
                    aiFileBytes = pdfBytes;
                    aiMimeType = 'application/pdf';
                } else {
                    aiFileBytes = Uint8Array.from(atob(attachment.contentBytes), c => c.charCodeAt(0));
                    aiMimeType = attachment.contentType || 'application/pdf';
                }
                
                // Upload to private storage and get a signed URL (accessible by AI)
                const privateFile = new File([aiFileBytes], finalFileName, { type: aiMimeType });
                const privateUploadResult = await base44.asServiceRole.integrations.Core.UploadPrivateFile({ file: privateFile });
                const signedUrlResult = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ 
                    file_uri: privateUploadResult.file_uri,
                    expires_in: 300 // 5 minutes - enough for AI extraction
                });
                const signedUrl = signedUrlResult.signed_url;
                
                const aiLlmResult = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
                    file_url: signedUrl,
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
                            main_experience: { type: "string", description: "ניסיון מרכזי" },
                            military_service: { type: "string", description: "שירות צבאי" },
                            security_clearance: { type: "string", description: "סיווג בטחוני - חלץ רק אם מצוין במפורש בקובץ קורות החיים המצורף (רמה 1/2/3, סודי, סודי ביותר, שמור). אל תסתמך על גוף המייל או נושא המייל. אל תשער על בסיס שם חיל בלבד." },
                            years_experience: { type: "number", description: "שנות ניסיון" },
                            job_1_company: { type: "string" }, job_1_role: { type: "string" }, job_1_description: { type: "string" },
                            job_2_company: { type: "string" }, job_2_role: { type: "string" }, job_2_description: { type: "string" },
                            job_3_company: { type: "string" }, job_3_role: { type: "string" }, job_3_description: { type: "string" },
                            job_4_company: { type: "string" }, job_4_role: { type: "string" }, job_4_description: { type: "string" },
                            job_5_company: { type: "string" }, job_5_role: { type: "string" }, job_5_description: { type: "string" },
                            main_tech_tools: { type: "array", items: { type: "string" }, description: "כלים טכנולוגיים" },
                            main_programming_languages: { type: "array", items: { type: "string" }, description: "שפות תכנות" },
                            detected_skills: { type: "array", items: { type: "string" }, description: "כישורים טכניים בלבד" }
                        }
                    }
                });
                
                console.log(`AI extraction result: ${aiLlmResult?.status}`);
                if (aiLlmResult?.status === 'error') {
                    throw new Error(`AI extraction failed: ${aiLlmResult.details || 'Unknown error'}`);
                }
                
                console.log(`AI extraction completed for: ${finalFileName}`);
                const candidateData = aiLlmResult?.output || {};
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
                // Check multiple text sources for security clearance hints
                const textToCheck = [
                    candidateData.security_clearance || '',
                    candidateData.military_service || '',
                    candidateData.main_experience || '',
                    candidateData.job_1_description || '',
                    candidateData.job_2_description || '',
                    candidateData.job_3_description || ''
                ].join(' ');

                const securityClearance = detectSecurityClearanceWithSynonyms(textToCheck, securitySynonyms);
                
                // Filter arrays before saving
                const filteredSkills = filterNonTechnical(candidateData.detected_skills || []);
                const filteredLanguages = filterNonTechnical(candidateData.main_programming_languages || []);
                const filteredTools = filterNonTechnical(candidateData.main_tech_tools || []);

                // Check for "Friend Brings Friend" referral - SEPARATE LOGIC
                let referralData = {};
                let referringEmployee = null;
                const isReferralEmail = email.subject && email.subject.includes('חבר מביא חבר');
                
                if (isReferralEmail) {
                    const senderEmail = email.from?.emailAddress?.address;
                    if (senderEmail) {
                        try {
                            // Search for employee with case-insensitive email comparison
                            const allEmployees = await base44.asServiceRole.entities.Employee.list();
                            const employee = allEmployees.find(emp => emp.email && emp.email.toLowerCase() === senderEmail.toLowerCase());
                            
                            if (employee) {
                                referringEmployee = employee;
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
                                
                                // Send alert email to office about missing employee
                                try {
                                    const alertSubject = `⚠️ התראה: "חבר מביא חבר" מעובד לא רשום`;
                                    const alertBody = `שלום,\n\nהגיע מועמד עם קוד "חבר מביא חבר" אבל המייל של העובד (${senderEmail}) לא נמצא בטבלת עובדים.\n\nשם המועמד: ${candidateData.full_name || '(לא זוהה)'}\nמייל השולח: ${senderEmail}\n\nבבקשה לעדכן את טבלת העובדים כדי שתהליך "חבר מביא חבר" יפעל כראוי.\n\nתודה,\nמערכת Pandatech`;
                                    
                                    await base44.asServiceRole.integrations.Core.SendEmail({
                                        to: 'office@pandatech.co.il',
                                        subject: alertSubject,
                                        body: alertBody,
                                        from_name: 'מערכת סריקה'
                                    });
                                    
                                    console.log(`Sent alert email to office about missing employee: ${senderEmail}`);
                                } catch (alertError) {
                                    console.warn(`Failed to send alert email: ${alertError.message}`);
                                }
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
                                  // Store filtered arrays
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
                                  status: defaultNewCandidateStatus?.status_name || 'מועמד',
                                  status_number: defaultNewCandidateStatus?.status_number || 10,
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
                            const matchNumberResponse = await base44.asServiceRole.functions.invoke('getNextMatchNumber', {});
                            const matchNumberResult = matchNumberResponse?.data || matchNumberResponse || {};
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
                        current_scanner_message: `משבח קו"ח: ${cleanData.full_name.substring(0, 30)}...`
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
                console.log(`${created ? 'Created' : 'Updated'}: ${cleanData.full_name}`);
                
                // IMPORTANT: Record referral REGARDLESS of CV processing success
                // This ensures referral data is always captured even if CV extraction fails
                if (isReferralEmail && referringEmployee) {
                    try {
                        console.log(`Recording Friend Brings Friend referral: ${referringEmployee.full_name} → ${cleanData.full_name}`);

                        // Update the candidate with referral data ALWAYS (overwrite if already exists)
                        if (existingCandidate) {
                            await base44.asServiceRole.entities.Candidate.update(candidateId, referralData);
                        } else {
                            // For new candidates, referral data was already included in creation
                            console.log(`Referral data already included in new candidate creation`);
                        }

                        // Send confirmation email only for newly created candidates
                         if (created) {
                             try {
                                 const confirmationSubject = `אישור רישום "חבר מביא חבר" על המועמד ${cleanData.full_name}`;
                                 const confirmationBody = `היי, זו הילה.\nמאשרת את רישום המועמד על שמך אצלי במערכת :).`;

                                 await base44.asServiceRole.integrations.Core.SendEmail({
                                     to: referringEmployee.email,
                                     subject: confirmationSubject,
                                     body: confirmationBody,
                                     from_name: 'הילה - פנדה-טק'
                                 });

                                 console.log(`Sent referral confirmation email for ${cleanData.full_name} to ${referringEmployee.email}`);

                                 // Send copy to office
                                 try {
                                     await base44.asServiceRole.integrations.Core.SendEmail({
                                         to: 'office@pandatech.co.il',
                                         subject: `העתק: אישור רישום "חבר מביא חבר" - ${cleanData.full_name}`,
                                         body: `שלום,\n\nהעתק הודעה מ-הילה:\n\n${confirmationBody}\n\nעובד המפנה: ${referringEmployee.full_name} (${referringEmployee.email})\nמועמד: ${cleanData.full_name}\n\nתודה`,
                                         from_name: 'הילה - פנדה-טק'
                                     });
                                     console.log(`Sent copy email to office@pandatech.co.il`);
                                 } catch (officeEmailError) {
                                     console.warn(`Failed to send copy to office: ${officeEmailError.message}`);
                                 }

                                 // Log the referral email action to ScannedFileLog
                                 await base44.asServiceRole.entities.ScannedFileLog.update(fileLog.id, {
                                     referral_email_sent: true,
                                     referral_email_sent_to: referringEmployee.email,
                                     referral_email_sent_date: new Date().toISOString()
                                 });
                             } catch (emailError) {
                                 console.warn(`Failed to send referral confirmation email: ${emailError.message}`);
                                 // Log the failure
                                 await base44.asServiceRole.entities.ScannedFileLog.update(fileLog.id, {
                                     referral_email_sent: false,
                                     referral_email_error: emailError.message
                                 });
                             }
                         }
                    } catch (referralError) {
                        console.error(`Failed to record referral: ${referralError.message}`);
                    }
                }
                
                return { created, updated };
                
            } catch (error) {
                console.error(`Error processing ${attachment.name}: ${error.message}`, error.stack);
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
        
        // First, retry previously failed files
        for (const failedLog of failedFilesToRetry) {
            const currentStatus = await base44.asServiceRole.entities.MailScanStatus.list();
            if (currentStatus[0] && !currentStatus[0].is_running) {
                console.log('Scan stopped by user');
                break;
            }
            
            console.log(`Retrying failed file: ${failedLog.file_name}`);
            
            try {
                const emailResponse = await fetch(
                    `https://graph.microsoft.com/v1.0/users/jobs@pandatech.co.il/messages/${failedLog.email_id}`,
                    { headers: { 'Authorization': `Bearer ${accessToken}` } }
                );
                
                if (!emailResponse.ok) {
                    console.log(`Email no longer exists: ${failedLog.email_id}`);
                    continue;
                }
                
                const email = await emailResponse.json();
                const attachments = await getAttachments(accessToken, failedLog.email_id);
                const attachment = attachments.find(att => 
                    att.name === failedLog.file_name &&
                    att['@odata.type'] === '#microsoft.graph.fileAttachment' && 
                    att.contentBytes
                );
                
                if (!attachment) {
                    console.log(`Attachment no longer exists: ${failedLog.file_name}`);
                    continue;
                }
                
                const result = await processAttachment(
                    email, 
                    attachment, 
                    failedLog.id, 
                    failedLog.retry_count || 0
                );
                
                retriedCount++;
                if (result.created || result.updated) {
                    retrySuccessCount++;
                    if (result.created) createdCount++;
                    if (result.updated) updatedCount++;
                }
                
            } catch (retryError) {
                console.error(`Error retrying ${failedLog.file_name}:`, retryError.message);
                errorsCount++;
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        console.log(`Retried ${retriedCount} failed files, ${retrySuccessCount} succeeded`);
        
        // Now process new emails
        for (const email of emails) {
            // Check for timeout
            try {
                checkTimeout();
            } catch (timeoutError) {
                console.log('Approaching timeout - stopping gracefully');
                break;
            }
            
            const currentStatus = await base44.asServiceRole.entities.MailScanStatus.list();
            if (currentStatus[0] && !currentStatus[0].is_running) {
                console.log('Scan stopped by user');
                break;
            }
            
            console.log(`Processing email: ${email.subject?.substring(0, 50)}`);
            await base44.asServiceRole.entities.MailScanStatus.update(scanStatus.id, {
                current_scanner_message: `מעבד מייל: ${email.subject?.substring(0, 40) || 'ללא נושא'}...`
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
                
                // Process attachments ONE BY ONE sequentially
                for (let i = 0; i < resumeAttachments.length; i++) {
                    const attachment = resumeAttachments[i];
                    console.log(`Processing attachment ${i + 1}/${resumeAttachments.length}: ${attachment.name}`);
                    await base44.asServiceRole.entities.MailScanStatus.update(scanStatus.id, {
                        current_processing_file: attachment.name,
                        current_scanner_message: `מנתח: ${attachment.name.substring(0, 40)}...`
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
                            // DO NOT stop - continue to next attachment
                        }
                    } catch (attachmentError) {
                        console.error(`Unexpected error processing ${attachment.name}: ${attachmentError.message}`);
                        errorsCount++;
                        // DO NOT stop - continue to next attachment
                    }
                    
                    // Wait before processing next attachment
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                
                // Update tracking dates based on whether this is a new or old email
                const emailDate = new Date(email.receivedDateTime);
                const lastDate = lastProcessedDate ? new Date(lastProcessedDate) : null;
                const oldestDate = oldestProcessedDate ? new Date(oldestProcessedDate) : null;
                
                // If this email is newer than our last processed, update forward pointer
                if (!lastDate || emailDate > lastDate) {
                    lastProcessedId = email.id;
                    lastProcessedDate = email.receivedDateTime;
                }
                
                // If this email is older than our oldest processed, update backward pointer
                if (!oldestDate || emailDate < oldestDate) {
                    oldestProcessedDate = email.receivedDateTime;
                }
                
                processedCount++;
                
                // Update scan status after EACH email to save progress
                await base44.asServiceRole.entities.MailScanStatus.update(scanStatus.id, {
                    last_processed_email_id: lastProcessedId,
                    last_processed_date: lastProcessedDate,
                    oldest_processed_date: oldestProcessedDate
                });
                
            } catch (emailError) {
                console.error(`Error processing email:`, emailError.message);
                errorsCount++;
            }
            
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        // Finalize
        const endTime = new Date().toISOString();
        
        await base44.asServiceRole.entities.MailScanStatus.update(scanStatus.id, {
            last_processed_email_id: lastProcessedId || scanStatus.last_processed_email_id,
            last_processed_date: lastProcessedDate || scanStatus.last_processed_date,
            oldest_processed_date: oldestProcessedDate || scanStatus.oldest_processed_date,
            total_emails_processed: (scanStatus.total_emails_processed || 0) + processedCount,
            total_candidates_created: (scanStatus.total_candidates_created || 0) + createdCount,
            total_candidates_updated: (scanStatus.total_candidates_updated || 0) + updatedCount,
            is_running: false,
            current_processing_file: null,
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
            summary: `סריקה הושלמה | מיילים: ${processedCount} | קבצים: ${attachmentsFound} | חדשים: ${createdCount} | עודכנו: ${updatedCount} | ניסיונות חוזרים: ${retriedCount} (${retrySuccessCount} הצליחו) | שגיאות: ${errorsCount}`
        });
        
        console.log('=== SCAN COMPLETED ===');

        // Log completion to SystemActivityLog
        try {
            await base44.asServiceRole.entities.SystemActivityLog.create({
                actor_type: 'agent',
                actor_name: 'raviv',
                actor_image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face',
                action_type: 'email_scan',
                action_description: `סריקת מיילים הושלמה: ${processedCount} מיילים, ${createdCount} מועמדים חדשים, ${updatedCount} עודכנו`,
                status: errorsCount > 0 ? 'failed' : 'success',
                details: JSON.stringify({ processedCount, createdCount, updatedCount, errorsCount })
            });
        } catch (logErr) {
            console.warn('Failed to log activity:', logErr.message);
        }
        
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
        
        // Check if there are more emails to process - if yes, trigger another scan automatically
        const moreNewEmails = await getNewEmails(accessToken, lastProcessedDate);
        const moreOldEmails = await getOldEmails(accessToken, oldestProcessedDate);
        const hasMoreEmails = moreNewEmails.length > 0 || moreOldEmails.length > 0;
        
        console.log(`More emails available: ${hasMoreEmails} (new: ${moreNewEmails.length}, old: ${moreOldEmails.length})`);
        
        return Response.json({
            success: true,
            hasMoreEmails: hasMoreEmails,
            stats: {
                emailsScanned: processedCount,
                attachmentsFound: attachmentsFound,
                candidatesCreated: createdCount,
                candidatesUpdated: updatedCount,
                retriedFiles: retriedCount,
                retrySuccesses: retrySuccessCount,
                errors: errorsCount
            }
        });
        
    } catch (error) {
        console.error('Critical error:', error.message);
        
        // Handle timeout gracefully - don't report as error
        if (error.message === 'TIMEOUT_APPROACHING') {
            if (base44) {
                try {
                    const scanStatuses = await base44.asServiceRole.entities.MailScanStatus.list();
                    if (scanStatuses[0]) {
                        await base44.asServiceRole.entities.MailScanStatus.update(scanStatuses[0].id, {
                            is_running: false,
                            last_error: null,
                            current_processing_file: null,
                            current_scanner_message: null
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
                        is_running: false,
                        last_error: error.message,
                        current_processing_file: null,
                        current_scanner_message: null
                    });
                }
            } catch (e) {
                console.error('Failed to update status:', e.message);
            }
        }
        
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});