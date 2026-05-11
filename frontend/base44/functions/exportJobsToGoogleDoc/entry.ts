import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);

    if (!(await base44.auth.isAuthenticated())) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401, headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        // Get all active jobs (excluding do_not_publish)
        const allJobs = await base44.entities.Job.filter({ status: 'פעילה' });
        const publishableJobs = allJobs.filter(j => j.do_not_publish !== true);

        // Build HTML content for Google Doc
        const currentDate = new Date().toLocaleDateString('he-IL');
        
        let htmlContent = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
    <meta charset="UTF-8">
    <title>משרות לפרסום - ${currentDate}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            direction: rtl;
            padding: 20px;
            max-width: 800px;
            margin: 0 auto;
        }
        h1 {
            color: #1a56db;
            text-align: center;
            border-bottom: 2px solid #1a56db;
            padding-bottom: 10px;
        }
        .job-card {
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            background-color: #f9fafb;
        }
        .job-title {
            color: #1f2937;
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .job-section {
            margin-bottom: 10px;
        }
        .job-section-title {
            font-weight: bold;
            color: #4b5563;
        }
        .job-location {
            color: #6b7280;
            font-size: 14px;
        }
        .contact-info {
            background-color: #dbeafe;
            padding: 10px;
            border-radius: 5px;
            margin-top: 10px;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            color: #6b7280;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <h1>רשימת משרות לפרסום</h1>
    <p style="text-align: center; color: #6b7280;">תאריך הפקה: ${currentDate} | סה"כ ${publishableJobs.length} משרות לפרסום</p>
`;

        for (let i = 0; i < publishableJobs.length; i++) {
            const job = publishableJobs[i];
            const jobNumber = i + 1;
            
            htmlContent += `
    <div class="job-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <div class="job-title">משרה #${jobNumber} - ${job.title || 'משרה ללא כותרת'}</div>
            <div style="font-size: 12px; color: #6b7280;">
                ${job.job_code ? `קוד: ${job.job_code}` : ''} | ${job.status || 'לא צוין'}
            </div>
        </div>
        ${job.location ? `<div class="job-location">📍 ${job.location}</div>` : ''}
        
        <div class="job-section">
            <div class="job-section-title">תיאור המשרה:</div>
            <div>${job.description || 'לא צוין'}</div>
        </div>
        
        <div class="job-section">
            <div class="job-section-title">דרישות:</div>
            <div>${job.requirements || 'לא צוין'}</div>
        </div>
        
        <div class="contact-info">
            <strong>לשליחת קורות חיים:</strong> jobs@pandatech.co.il<br>
            <strong>ארגון:</strong> פנדה-טק
        </div>
    </div>
`;
        }

        htmlContent += `
    <div class="footer">
        <p>מסמך זה הופק אוטומטית על ידי מערכת PandaRecruitAI</p>
    </div>
</body>
</html>
`;

        // Generate filename
        const fileName = `משרות_לפרסום_${currentDate.replace(/\./g, '-')}.html`;

        // Encode HTML content to Base64 (chunked to avoid call stack exceeded)
        const encoder = new TextEncoder();
        const uint8Array = encoder.encode(htmlContent);
        let binaryString = '';
        const chunkSize = 8192;
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          binaryString += String.fromCharCode(...uint8Array.slice(i, i + chunkSize));
        }
        const base64Data = btoa(binaryString);

        // Return a JSON response with the Base64 data and filename
        return Response.json({
            success: true,
            fileData: base64Data,
            fileName: fileName,
            jobsCount: publishableJobs.length
        });

    } catch (error) {
        console.error("Error creating document:", error);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
});