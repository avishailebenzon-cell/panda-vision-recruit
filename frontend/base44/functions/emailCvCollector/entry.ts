
import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';
// Buffer is no longer needed with this direct approach
// import { Buffer } from 'npm:buffer'; 

const CLIENT_ID = Deno.env.get("Application_ID");
const TENANT_ID = Deno.env.get("Directory_tenant_ID");
const CLIENT_SECRET = Deno.env.get("Azure_App_secret");
const EMAIL_ACCOUNT = 'jobs@pandatech.co.il';
const MAX_EMAILS_PER_RUN = 50; // Increased limit

// This function remains the same as it's for fetching tokens, but now returns userId
async function getGraphToken(base44) {
    const existingTokens = await base44.asServiceRole.entities.MicrosoftGraphToken.filter({ service: 'microsoft_graph_email' });

    if (existingTokens.length === 0) {
        return { error: 'not_authenticated' };
    }

    const tokenData = existingTokens[0];
    const now = new Date();
    const expiry = new Date(tokenData.expires_at);

    if (expiry > new Date(now.getTime() + 5 * 60 * 1000)) {
        return { accessToken: tokenData.access_token, userId: EMAIL_ACCOUNT }; // Added userId
    }

    console.log('Refreshing Microsoft Graph token...');
    const tokenUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
    const params = new URLSearchParams();
    params.append("client_id", CLIENT_ID);
    params.append("scope", "offline_access Mail.Read");
    params.append("refresh_token", tokenData.refresh_token);
    params.append("grant_type", "refresh_token");
    params.append("client_secret", CLIENT_SECRET);

    const response = await fetch(tokenUrl, {
        method: "POST",
        body: params,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const data = await response.json();

    if (data.error) {
        console.error("Error refreshing token:", data);
        return { error: 'not_authenticated' };
    }

    const { access_token, refresh_token, expires_in } = data;
    const expires_at = new Date(new Date().getTime() + expires_in * 1000).toISOString();

    await base44.asServiceRole.entities.MicrosoftGraphToken.update(tokenData.id, {
        access_token,
        refresh_token,
        expires_at
    });

    return { accessToken: access_token, userId: EMAIL_ACCOUNT }; // Added userId
}

// New function to fetch unread messages
async function getUnreadMessages(accessToken, userId) {
    const messagesUrl = `https://graph.microsoft.com/v1.0/users/${userId}/mailFolders/inbox/messages?$filter=isRead eq false&$top=${MAX_EMAILS_PER_RUN}&$expand=attachments`;
    const messagesResponse = await fetch(messagesUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });

    if (!messagesResponse.ok) {
        const errorData = await messagesResponse.json();
        throw new Error(`Graph API error fetching unread messages: ${errorData.error.message}`);
    }

    const { value: messages } = await messagesResponse.json();
    return messages;
}

// New function to process a single email message
async function processMessage(base44, message, stats) {
    let processedAttachmentInEmail = false;

    // --- ENHANCED DIAGNOSTIC VALIDATION ---
    if (!message || typeof message !== 'object') {
        stats.errors.push(`Invalid message object passed to processMessage; skipping. Content: ${String(message)}`);
        return processedAttachmentInEmail; // No attachments to process
    }

    // This function will now be extremely defensive and log issues.
    if (message.attachments && message.attachments.length > 0) {
        for (const attachment of message.attachments) {
            if (attachment.contentBytes && attachment.name && (attachment.name.endsWith('.pdf') || attachment.name.endsWith('.docx'))) {
                const contentBytes = new Uint8Array(Object.values(attachment.contentBytes));
                try {
                    // --- RADICALLY NEW AND DIFFERENT APPROACH ---
                    // Instead of using a faulty integration, we now directly use the storage API.
                    // This is a more robust, lower-level way to upload files.

                    const mimeTypes = {
                        '.pdf': 'application/pdf',
                        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                    };
                    const extension = attachment.name.substring(attachment.name.lastIndexOf('.')).toLowerCase();
                    const mimeType = mimeTypes[extension] || 'application/octet-stream';
                    
                    // Create a unique file path to prevent overwrites
                    const filePath = `cv-inbox/${Date.now()}-${attachment.name}`;

                    // Directly upload the binary content to the 'private' storage bucket.
                    const { data, error } = await base44.asServiceRole.storage
                        .from('private')
                        .upload(filePath, contentBytes, {
                            contentType: mimeType,
                            upsert: true, // Overwrite if for some reason the same file exists
                        });

                    if (error) {
                        throw new Error(`Direct storage upload failed for attachment ${attachment.name}: ${error.message}`);
                    }

                    // The 'filePath' is now our permanent URI.
                    const fileUri = filePath;
                    stats.processed++; 
                    
                    // --- CRITICAL DATA VALIDATION ---
                    // Before accessing nested properties, ensure the parent objects exist.
                    // This prevents the "Cannot read properties of undefined" error.
                    if (!message.from || typeof message.from !== 'object') {
                        throw new Error(`Message (ID: ${message.id}) is missing 'from' property or is not an object. Message content: ${JSON.stringify(message)}`);
                    }
                    if (!message.from.emailAddress || typeof message.from.emailAddress !== 'object') {
                        throw new Error(`'from' property (of message ID: ${message.id}) is missing 'emailAddress' or is not an object. Message content: ${JSON.stringify(message)}`);
                    }
                    const fromAddress = message.from.emailAddress.address;
                    const fromName = message.from.emailAddress.name || 'Unknown Name';

                    if (!fromAddress) {
                        // If we can't get the sender's email, we can't check for duplicates
                        // or create a meaningful candidate record. We'll log it as an error.
                        throw new Error(`Could not determine sender's email address for message ID: ${message.id}. Message content: ${JSON.stringify(message)}`);
                    }

                    const existingCandidate = await base44.asServiceRole.entities.Candidate.filter({
                        email: fromAddress
                    });

                    if (existingCandidate && existingCandidate.length > 0) {
                        stats.duplicates++;
                        continue; // Skip creating a new candidate
                    }

                    const candidateData = {
                        first_name: fromName.split(' ')[0] || 'Unknown',
                        last_name: fromName.split(' ').slice(1).join(' ') || 'Name',
                        email: fromAddress,
                        original_filename: attachment.name,
                        resume_file_uri: fileUri, // Store the direct path
                        ai_processing_status: 'pending',
                        source: 'email-auto'
                    };
                    
                    await base44.asServiceRole.entities.Candidate.create(candidateData);
                    stats.created++;
                    processedAttachmentInEmail = true;

                } catch (e) {
                    // Log the full error for better diagnostics
                    stats.errors.push(`Attachment ${attachment.name} (Message ID: ${message ? message.id : 'unknown'}): ${JSON.stringify({
                        message: e.message, 
                        stack: e.stack,
                        error: e.toString()
                    })}`);
                }
            } else {
                stats.skippedNonRelevant++;
            }
        }
    }
    // Return whether any attachments were processed in this email.
    return processedAttachmentInEmail;
}


Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    // Check for initialization signal
    const url = new URL(req.url);
    if (url.searchParams.get('initialize') === 'true') {
        // This is a health check or initialization call. Just respond.
        return new Response(JSON.stringify({ success: true, message: "Initialization check complete." }), { headers: { 'Content-Type': 'application/json' } });
    }

    let logEntryId = null; // Renamed from runLogId to logEntryId
    const startTime = new Date().toISOString();
    
    // Updated stats object structure to reflect new workflow
    const stats = {
        found: 0,
        processed: 0,
        created: 0,
        duplicates: 0,
        skippedNonRelevant: 0,
        errors: []
    };

    // Create a robust, safe logging payload (kept global definition)
    const createSafeLogPayload = (data) => {
        return {
            start_time: data.start_time || new Date().toISOString(),
            end_time: data.end_time || null,
            status: typeof data.status === 'string' ? data.status.substring(0, 50) : 'Unknown',
            emails_found: Number.isInteger(data.emails_found) ? data.emails_found : 0,
            cvs_processed: Number.isInteger(data.cvs_processed) ? data.cvs_processed : 0, // Now refers to files saved privately
            candidates_created: Number.isInteger(data.candidates_created) ? data.candidates_created : 0, // Now refers to Candidate entities created
            errors_count: Number.isInteger(data.errors_count) ? data.errors_count : 0,
            summary: typeof data.summary === 'string' ? data.summary.substring(0, 5000) : '',
        };
    };

    try {
        const { accessToken, userId, error: tokenError } = await getGraphToken(base44);
        if (tokenError) throw new Error(`Authentication failed: ${tokenError}`);

        // Create initial log entry with startTime
        // Assuming create returns an array and we need the first item's ID
        const initialLogPayload = createSafeLogPayload({
            start_time: startTime,
            status: 'Running',
            summary: 'מתחיל תהליך איסוף קורות חיים...'
        });
        const logEntryResponse = await base44.asServiceRole.entities.EmailRunLog.create(initialLogPayload);
        logEntryId = Array.isArray(logEntryResponse) && logEntryResponse.length > 0 ? logEntryResponse[0].id : null;
        if (!logEntryId) {
            console.warn("Failed to create an initial EmailRunLog entry. Continuing execution without logging this run.");
        }

        const messages = await getUnreadMessages(accessToken, userId); // Use new function
        stats.found = messages.length;

        for (const message of messages) {
            // Add a safety check here as well for malformed messages from Graph API
            if (!message || typeof message !== 'object' || !message.id) { // Ensure message has an ID for marking as read
                stats.errors.push(`Invalid message item found in list; skipping. Content: ${String(message)}`);
                continue;
            }
            try {
                // processMessage now returns only a boolean
                const processedAttachmentInEmail = await processMessage(base44, message, stats);
                
                if (processedAttachmentInEmail) {
                    // If any attachment led to a candidate record, mark the email as read.
                    const markAsReadUrl = `https://graph.microsoft.com/v1.0/users/${userId}/messages/${message.id}`;
                    await fetch(markAsReadUrl, {
                        method: 'PATCH',
                        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ isRead: true })
                    });
                }
            } catch (e) {
                // Catch errors specific to processing a single message
                stats.errors.push(`Error processing message ${message.id}: ${e.message} Stack: ${e.stack}`);
            }
        }

        let summary = `תהליך איסוף המיילים הסתיים.\n`;
        summary += `• מיילים חדשים שנמצאו: ${stats.found}\n`;
        summary += `• קבצים שנוצרו באחסון פרטי: ${stats.processed}\n`;
        summary += `• מועמדים חדשים שנוצרו: ${stats.created}\n`;
        summary += `• כפילויות שזוהו ודולגו: ${stats.duplicates}\n`;
        summary += `• קבצים מצורפים שדולגו (לא רלוונטיים/חסרי תוכן): ${stats.skippedNonRelevant}\n`;
        summary += `• שגיאות: ${stats.errors.length}\n`;
        if (stats.errors.length > 0) summary += `\n\nפירוט שגיאות:\n${stats.errors.join('\n')}`;

        const finalLogPayload = createSafeLogPayload({
            end_time: new Date().toISOString(),
            status: stats.errors.length > 0 ? 'Completed with Errors' : 'Completed',
            emails_found: stats.found,
            cvs_processed: stats.processed, // Mapped to files saved privately
            candidates_created: stats.created, // Mapped to candidate entities created
            errors_count: stats.errors.length,
            summary: summary
        });
        
        if (logEntryId) {
            await base44.asServiceRole.entities.EmailRunLog.update(logEntryId, finalLogPayload);
        } else {
            console.error("No logEntryId available to update the run. Final log details:", finalLogPayload);
        }
        
        return new Response(JSON.stringify({ success: true, summary }), { headers: { "Content-Type": "application/json" } });

    } catch (e) {
        const errorSummary = `הריצה נכשלה: ${e.message} Stack: ${e.stack}`;
        if (logEntryId) { // Use logEntryId
            const errorLogPayload = createSafeLogPayload({
                end_time: new Date().toISOString(),
                status: 'Failed',
                emails_found: stats.found, // Include found count if available
                cvs_processed: stats.processed, // Include processed count if available
                candidates_created: stats.created, // Include created count if available
                errors_count: stats.errors.length + 1, // Add 1 for the main catch error
                summary: errorSummary
            });
            await base44.asServiceRole.entities.EmailRunLog.update(logEntryId, errorLogPayload);
        } else {
            // If logEntryId was never created (e.g., token failure), just log to console
            console.error("Critical failure before log entry creation:", errorSummary);
        }
        return new Response(JSON.stringify({ success: false, summary: errorSummary }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
});
