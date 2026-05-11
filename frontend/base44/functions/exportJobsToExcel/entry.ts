import { createClientFromRequest } from 'npm:@base44/sdk@0.5.0';
import { utils, write } from 'npm:xlsx@0.18.5';
import { encode } from "https://deno.land/std@0.208.0/encoding/base64.ts";

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);

    if (!(await base44.auth.isAuthenticated())) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401, headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        // Get all active jobs
        const allJobs = await base44.entities.Job.filter({ status: 'פעילה' });

        // Prepare data for Excel
        const excelData = allJobs.map(job => ({
            'כותרת המשרה': job.title || '',
            'תיאור המשרה': job.description || '',
            'דרישות המשרה': job.requirements || '',
            'מיקום': job.location || '',
            'ארגון': 'פנדה-טק',
            'אימייל לשליחת קורות חיים': 'jobs@pandatech.co.il'
        }));

        const wb = utils.book_new();
        const ws = utils.json_to_sheet(excelData);
        ws['!cols'] = [ { wch: 25 }, { wch: 50 }, { wch: 40 }, { wch: 20 }, { wch: 15 }, { wch: 25 } ];
        utils.book_append_sheet(wb, ws, 'משרות לפרסום');

        // Write workbook to array buffer
        const excelBuffer = write(wb, { type: 'array', bookType: 'xlsx' });
        const uint8Array = new Uint8Array(excelBuffer);

        // Encode the file content to Base64
        const base64Data = encode(uint8Array);

        // Generate filename
        const currentDate = new Date().toLocaleDateString('he-IL').replace(/\./g, '-');
        const fileName = `משרות_לפרסום_${currentDate}.xlsx`;

        // Return a JSON response with the Base64 data and filename
        return Response.json({
            success: true,
            fileData: base64Data,
            fileName: fileName
        });

    } catch (error) {
        console.error("Error creating Excel file:", error);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
});