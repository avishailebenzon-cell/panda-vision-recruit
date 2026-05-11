import { createClientFromRequest } from 'npm:@base44/sdk@0.7.0';

const DROPBOX_ACCESS_TOKEN = Deno.env.get("dropbox_access_token");

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);

    if (!DROPBOX_ACCESS_TOKEN) {
        return new Response(JSON.stringify({ 
            success: false, 
            error: "dropbox_access_token is not set." 
        }), { 
            status: 500, 
            headers: { 'Content-Type': 'application/json' }
        });
    }

    let masterSummary = "סיכום ריצת סנכרון משרות מ-Dropbox:\n\n";
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalFailed = 0;
    let hasErrors = false;

    try {
        // Get admin settings for jobs folder URL
        const adminUsers = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
        if (adminUsers.length === 0) {
            throw new Error("No admin user found to get Dropbox settings from.");
        }
        
        const adminSettings = adminUsers[0];
        const jobsFolderUrl = adminSettings.dropbox_jobs_url;

        if (!jobsFolderUrl) {
            console.log("No Dropbox jobs folder configured. Exiting.");
            return new Response(JSON.stringify({ 
                success: true, 
                message: "No Dropbox jobs folder configured." 
            }), { status: 200 });
        }

        // Create a log entry for the jobs run - WITH ERROR HANDLING
        let runLog;
        try {
            runLog = await base44.asServiceRole.entities.DropboxRunLog.create({
                start_time: new Date().toISOString(),
                status: 'Running',
                run_type: 'jobs'
            });
        } catch (logError) {
            console.warn("Could not create run log:", logError);
            // Continue without logging
        }

        const failedFilesDetails = [];
        const newJobs = []; // Track new jobs for inbox

        masterSummary += `סורק תיקיית משרות: ${jobsFolderUrl.substring(0, 50)}...\n`;

        // List files in jobs folder
        const listFolderResponse = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${DROPBOX_ACCESS_TOKEN}`, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ 
                path: '', 
                shared_link: { url: jobsFolderUrl } 
            })
        });

        if (!listFolderResponse.ok) {
            throw new Error(`Failed to list Dropbox jobs folder: ${await listFolderResponse.text()}`);
        }
        
        const filesData = await listFolderResponse.json();
        
        // Filter for PDF files modified in last 7 days (more flexible than candidates)
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        
        const recentJobFiles = filesData.entries
            .filter(file => 
                file && 
                file['.tag'] === 'file' && 
                file.name && 
                file.name.toLowerCase().endsWith('.pdf') &&
                file.client_modified && 
                new Date(file.client_modified) > weekAgo
            )
            .map(file => ({
                id: file.id || `fallback_${Date.now()}_${Math.random()}`,
                name: file.name || 'unknown_job.pdf',
                modified_time: file.client_modified || new Date().toISOString(),
                size: file.size || 0
            }));

        if (recentJobFiles.length === 0) {
            masterSummary += `- לא נמצאו קבצי משרות חדשים.\n`;
        } else {
            masterSummary += `- נמצאו ${recentJobFiles.length} קבצי משרות חדשים.\n`;

            for (const file of recentJobFiles) {
                try {
                    // Download file content
                    const downloadResponse = await fetch('https://content.dropboxapi.com/2/files/download', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${DROPBOX_ACCESS_TOKEN}`,
                            'Dropbox-API-Arg': JSON.stringify({
                                path: file.id
                            })
                        }
                    });

                    if (!downloadResponse.ok) {
                        throw new Error(`Failed to download file: ${file.name}`);
                    }

                    const fileBuffer = await downloadResponse.arrayBuffer();
                    const fileBase64 = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));

                    // Extract job data using LLM
                    const extractResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
                        prompt: `אתה מומחה לעיבוד משרות. נתח את קובץ המשרה המצורף וחלץ את המידע הבא:

1. כותרת המשרה
2. תיאור המשרה (מפורט)
3. דרישות המשרה
4. מיקום גיאוגרפי
5. שם הלקוח/חברה
6. מחלקה/מפעל (אם יש)
7. איש קשר (אם יש)
8. דרישות סיווג בטחוני (אם יש)

חשוב: החזר תשובה בעברית בלבד, גם אם המסמך באנגלית.`,
                        file_urls: [`data:application/pdf;base64,${fileBase64}`],
                        response_json_schema: {
                            type: "object",
                            properties: {
                                title: { type: "string" },
                                description: { type: "string" },
                                requirements: { type: "string" },
                                location: { type: "string" },
                                client_name: { type: "string" },
                                factory_department: { type: "string" },
                                contact_person: { type: "string" },
                                security_clearance: { 
                                    type: "string",
                                    enum: ["רמה 1", "רמה 2", "רמה 3", "סווג נמוך", "ללא סווג"]
                                }
                            }
                        }
                    });

                    const jobData = extractResponse;

                    // Generate job code
                    const jobCode = `pan-${String(Math.floor(Math.random() * 900) + 100)}`;

                    // Check for existing similar jobs
                    const existingJobs = await base44.asServiceRole.entities.Job.list();
                    const similarJobs = existingJobs.filter(job => 
                        job.title && jobData.title &&
                        job.title.toLowerCase().trim() === jobData.title.toLowerCase().trim() &&
                        job.client_name && jobData.client_name &&
                        job.client_name.toLowerCase().trim() === jobData.client_name.toLowerCase().trim()
                    );

                    if (similarJobs.length > 0) {
                        // Update existing job
                        const jobToUpdate = similarJobs[0];
                        await base44.asServiceRole.entities.Job.update(jobToUpdate.id, {
                            description: jobData.description || jobToUpdate.description,
                            requirements: jobData.requirements || jobToUpdate.requirements,
                            location: jobData.location || jobToUpdate.location,
                            factory_department: jobData.factory_department || jobToUpdate.factory_department,
                            contact_person: jobData.contact_person || jobToUpdate.contact_person,
                            security_clearance: jobData.security_clearance || jobToUpdate.security_clearance,
                            status: "פעילה"
                        });

                        // Delete duplicates if more than one
                        if (similarJobs.length > 1) {
                            const sortedJobs = similarJobs.sort((a, b) => 
                                new Date(b.created_date) - new Date(a.created_date)
                            );
                            for (let i = 1; i < sortedJobs.length; i++) {
                                await base44.asServiceRole.entities.Job.delete(sortedJobs[i].id);
                            }
                        }

                        totalUpdated++;
                    } else {
                        // Create new job
                        const newJob = await base44.asServiceRole.entities.Job.create({
                            job_code: jobCode,
                            title: jobData.title,
                            description: jobData.description,
                            requirements: jobData.requirements,
                            location: jobData.location,
                            client_name: jobData.client_name,
                            factory_department: jobData.factory_department,
                            contact_person: jobData.contact_person,
                            security_clearance: jobData.security_clearance || "ללא סווג",
                            status: "פעילה"
                        });

                        totalCreated++;

                        // Add to new jobs for inbox (only truly new jobs, not updates)
                        newJobs.push({
                            job_id: newJob.id,
                            job_title: newJob.title,
                            job_code: newJob.job_code,
                            client_name: newJob.client_name,
                            location: newJob.location,
                            security_clearance: newJob.security_clearance,
                            source: 'dropbox_auto'
                        });
                    }

                } catch (fileError) {
                    console.error(`Error processing job file ${file.name}:`, fileError);
                    totalFailed++;
                    hasErrors = true;
                    failedFilesDetails.push({ 
                        file: file.name, 
                        error: fileError.message 
                    });
                }
            }
        }

        // Add new jobs to inbox - WITH ERROR HANDLING
        for (const jobData of newJobs) {
            try {
                await base44.asServiceRole.entities.NewJobInbox.create(jobData);
            } catch (inboxError) {
                console.error('Error adding job to inbox:', inboxError);
                // Continue even if inbox creation fails
            }
        }

        // Finalize summary
        masterSummary += `\nסיכום כללי:\n- ${totalCreated} משרות חדשות נוצרו.\n- ${totalUpdated} משרות עודכנו.\n- ${totalSkipped} קבצים דולגו.\n- ${totalFailed} שגיאות.\n- ${newJobs.length} משרות נוספו לדואר נכנס.`;

        // Update the log entry - WITH ERROR HANDLING
        if (runLog) {
            try {
                await base44.asServiceRole.entities.DropboxRunLog.update(runLog.id, {
                    end_time: new Date().toISOString(),
                    status: hasErrors ? 'Failed' : 'Completed',
                    files_found: totalCreated + totalUpdated + totalSkipped + totalFailed,
                    files_created: totalCreated,
                    files_updated: totalUpdated,
                    files_skipped: totalSkipped,
                    files_failed: totalFailed,
                    failed_files_details: JSON.stringify(failedFilesDetails),
                    summary: masterSummary
                });
            } catch (updateError) {
                console.warn("Could not update run log:", updateError);
            }
        }

        // Send email notification to admins
        if (totalCreated > 0 || totalUpdated > 0 || totalFailed > 0) {
            const emailSubject = hasErrors 
                ? '[PandaRecruitAI] דוח סנכרון משרות - יש שגיאות'
                : '[PandaRecruitAI] דוח סנכרון משרות מ-Dropbox';

            for (const admin of adminUsers) {
                try {
                    await base44.asServiceRole.integrations.Core.SendEmail({
                        to: admin.email,
                        subject: emailSubject,
                        body: masterSummary,
                        from_name: 'PandaRecruitAI System'
                    });
                } catch (emailError) {
                    console.error(`Failed to send email to ${admin.email}:`, emailError);
                }
            }
        }

        return new Response(JSON.stringify({ 
            success: true, 
            message: "Jobs sync completed.", 
            results: masterSummary 
        }), {
            status: 200, 
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("Jobs sync error:", error);
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
        }), {
            status: 500, 
            headers: { 'Content-Type': 'application/json' }
        });
    }
});