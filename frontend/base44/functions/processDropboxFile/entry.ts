import { createClientFromRequest } from 'npm:@base44/sdk@0.7.0';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    try {
        const { fileUrl, fileName, fileSize, sessionId, registryId, runId } = await req.json();
        
        console.log(`🔄 [${runId || 'manual'}] Processing file: ${fileName}`);
        console.log(`📊 File size: ${fileSize} bytes`);
        console.log(`🔗 File URL: ${fileUrl}`);
        
        // Step 1: Validate inputs
        if (!fileUrl || !fileName) {
            throw new Error("פרמטרים חסרים: fileUrl או fileName");
        }
        
        // Step 2: Check file size limit - reject very large files to prevent timeout
        if (fileSize && fileSize > 5 * 1024 * 1024) { // 5MB limit
            throw new Error(`הקובץ גדול מדי (${(fileSize / 1024 / 1024).toFixed(1)}MB). מגבלה: 5MB`);
        }
        
        // Step 3: Check file extension - PDF only for now
        const fileExtension = fileName.toLowerCase().split('.').pop();
        if (fileExtension !== 'pdf') {
            throw new Error(`סוג קובץ לא נתמך: ${fileExtension}. נתמכים: PDF בלבד`);
        }
        
        // Step 4: Download file with timeout protection
        console.log(`📥 Downloading PDF file from Dropbox...`);
        let fileBlob;
        try {
            const downloadController = new AbortController();
            const downloadTimeout = setTimeout(() => downloadController.abort(), 30000); // 30 second timeout
            
            const response = await fetch(fileUrl, {
                signal: downloadController.signal
            });
            
            clearTimeout(downloadTimeout);
            
            if (!response.ok) {
                throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
            }
            
            fileBlob = await response.blob();
            console.log(`✅ File downloaded successfully. Size: ${fileBlob.size} bytes`);
            
            // Validate file size after download
            if (fileBlob.size < 1024) { // Less than 1KB is suspicious
                throw new Error(`הקובץ קטן מדי (${fileBlob.size} bytes). ייתכן שהוא פגום.`);
            }
            
            if (fileBlob.size > 10 * 1024 * 1024) { // 10MB absolute limit
                throw new Error(`הקובץ גדול מדי (${(fileBlob.size / 1024 / 1024).toFixed(1)}MB). מגבלת גודל: 10MB`);
            }
            
        } catch (error) {
            console.error("❌ Error downloading file:", error);
            if (error.name === 'AbortError') {
                throw new Error(`תם הזמן להורדת הקובץ מ-Dropbox (מעל 30 שניות)`);
            }
            throw new Error(`שגיאה בהורדת הקובץ מ-Dropbox: ${error.message}`);
        }
        
        // Step 5: Upload to our system with retry logic
        console.log("📤 Uploading file to our system...");
        let uploadResult;
        try {
            // Try upload with timeout protection
            uploadResult = await uploadWithTimeout(base44, fileBlob, 45000); // 45 second timeout
            console.log(`✅ File uploaded successfully: ${uploadResult.file_url}`);
        } catch (error) {
            console.error("❌ Error uploading file:", error);
            if (error.message.includes('timeout') || error.message.includes('DatabaseTimeout')) {
                throw new Error(`תם הזמן להעלאת הקובץ למערכת (מעל 45 שניות). הקובץ עלול להיות גדול מדי.`);
            }
            throw new Error(`שגיאה בהעלאת הקובץ למערכת: ${error.message}`);
        }
        
        // Step 6: Extract text using our PDF service with timeout
        console.log("🔍 Extracting text from PDF...");
        let extractedData;
        try {
            extractedData = await extractTextWithTimeout(base44, uploadResult.file_url, 60000); // 60 second timeout
            
            console.log("✅ Text extraction completed");
            
            if (!extractedData.output || !extractedData.output.full_text) {
                throw new Error("לא הצלחנו לחלץ טקסט מהקובץ PDF. ייתכן שהקובץ פגום או מוגן בסיסמה.");
            }
            
            const extractedText = extractedData.output.full_text.trim();
            if (extractedText.length < 50) {
                throw new Error(`הטקסט שחולץ קצר מדי (${extractedText.length} תווים). ייתכן שהקובץ ריק או לא קריא.`);
            }
            
            console.log(`📝 Extracted text length: ${extractedText.length} characters`);
            
        } catch (error) {
            console.error("❌ Error extracting text:", error);
            
            // Enhanced error messages for PDF issues
            let friendlyError = error.message;
            if (error.message.includes('Unsupported file type')) {
                friendlyError = "הקובץ PDF לא קריא או פגום. נסה לשמור אותו שוב או לבדוק שהוא לא מוגן בסיסמה.";
            } else if (error.message.includes('timeout') || error.message.includes('Request timeout')) {
                friendlyError = "הקובץ גדול מדי או מורכב מדי לעיבוד. נסה לפשט את התוכן או לצמצם את הגודל.";
            } else if (error.message.includes('password') || error.message.includes('encrypted')) {
                friendlyError = "הקובץ מוגן בסיסמה. אנא הסר את ההגנה ונסה שוב.";
            }
            
            throw new Error(`שגיאה בחילוץ טקסט מהקובץ: ${friendlyError}`);
        }
        
        // Step 7: Parse candidate data using AI with timeout
        console.log("🤖 Parsing candidate information with AI...");
        let candidateData;
        try {
            candidateData = await parseWithAITimeout(base44, {
                fullText: extractedData.output.full_text,
                fileName: fileName,
                fileUrl: uploadResult.file_url
            }, 90000); // 90 second timeout for AI
            
            if (!candidateData || !candidateData.data) {
                throw new Error("כישלון בניתוח קורות החיים עם AI");
            }
            
            console.log("✅ AI parsing completed successfully");
            
        } catch (error) {
            console.error("❌ Error parsing with AI:", error);
            throw new Error(`שגיאה בניתוח קורות החיים: ${error.message}`);
        }
        
        // Step 8: Create or update candidate with timeout protection
        console.log("💾 Creating/updating candidate in database...");
        try {
            const finalCandidateData = {
                ...candidateData.data.candidateData,
                resume_file_url: uploadResult.file_url,
                original_filename: fileName,
                full_text: extractedData.output.full_text
            };
            
            // Check for existing candidate by email or name
            let existingCandidate = null;
            if (finalCandidateData.email) {
                try {
                    const existingByEmail = await base44.asServiceRole.entities.Candidate.filter({
                        email: finalCandidateData.email
                    });
                    if (existingByEmail.length > 0) {
                        existingCandidate = existingByEmail[0];
                    }
                } catch (searchError) {
                    console.warn("Could not search for existing candidate by email:", searchError);
                }
            }
            
            let candidate;
            if (existingCandidate) {
                console.log(`📝 Updating existing candidate: ${existingCandidate.id}`);
                candidate = await base44.asServiceRole.entities.Candidate.update(
                    existingCandidate.id,
                    finalCandidateData
                );
                candidate.id = existingCandidate.id; // Ensure ID is preserved
            } else {
                console.log("🆕 Creating new candidate");
                candidate = await base44.asServiceRole.entities.Candidate.create(finalCandidateData);
            }
            
            console.log(`✅ Candidate processed successfully. ID: ${candidate.id}`);
            
            return Response.json({
                success: true,
                candidate: candidate,
                action: existingCandidate ? 'updated' : 'created',
                message: `קורות החיים של ${candidate.first_name} ${candidate.last_name} (PDF) ${existingCandidate ? 'עודכנו' : 'נקלטו'} בהצלחה`
            });
            
        } catch (error) {
            console.error("❌ Error creating/updating candidate:", error);
            throw new Error(`שגיאה בשמירת המועמד במאגר: ${error.message}`);
        }
        
    } catch (error) {
        console.error("❌ Overall processing error:", error);
        
        return Response.json({
            success: false,
            error: error.message || "שגיאה לא מוגדרת בעיבוד הקובץ"
        }, { status: 500 });
    }
});

// Helper function to upload file with timeout - fixed async issues
function uploadWithTimeout(base44, fileBlob, timeoutMs) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error(`Upload timeout after ${timeoutMs}ms`));
        }, timeoutMs);

        base44.asServiceRole.integrations.Core.UploadFile({ file: fileBlob })
            .then(result => {
                clearTimeout(timeout);
                resolve(result);
            })
            .catch(error => {
                clearTimeout(timeout);
                reject(error);
            });
    });
}

// Helper function to extract text with timeout - fixed async issues
function extractTextWithTimeout(base44, fileUrl, timeoutMs) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error(`Text extraction timeout after ${timeoutMs}ms`));
        }, timeoutMs);

        base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
            file_url: fileUrl,
            json_schema: {
                type: "object",
                properties: {
                    full_text: {
                        type: "string",
                        description: "הטקסט המלא של קורות החיים"
                    }
                }
            }
        })
        .then(result => {
            clearTimeout(timeout);
            resolve(result);
        })
        .catch(error => {
            clearTimeout(timeout);
            reject(error);
        });
    });
}

// Helper function to parse with AI with timeout - fixed async issues
function parseWithAITimeout(base44, data, timeoutMs) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error(`AI parsing timeout after ${timeoutMs}ms`));
        }, timeoutMs);

        base44.asServiceRole.functions.invoke('parseResumeWithAI', data)
            .then(result => {
                clearTimeout(timeout);
                resolve(result);
            })
            .catch(error => {
                clearTimeout(timeout);
                reject(error);
            });
    });
}