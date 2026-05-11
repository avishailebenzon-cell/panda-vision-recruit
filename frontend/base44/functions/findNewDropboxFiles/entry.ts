import { createClientFromRequest } from 'npm:@base44/sdk@0.5.0';

const DROPBOX_ACCESS_TOKEN = Deno.env.get("dropbox_access_token");

Deno.serve(async (req) => {
    const { folderUrl } = await req.json();

    if (!folderUrl) {
        return new Response(JSON.stringify({ success: false, error: "Folder URL is required." }), { 
            status: 400, headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        if (!DROPBOX_ACCESS_TOKEN) {
            throw new Error("טוקן הגישה ל-Dropbox לא הוגדר במערכת. אנא פנה למנהל המערכת.");
        }

        const listFolderResponse = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${DROPBOX_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: '', shared_link: { url: folderUrl } })
        });

        if (!listFolderResponse.ok) {
            const errorText = await listFolderResponse.text();
            let errorData;
            
            try {
                errorData = JSON.parse(errorText);
            } catch (e) {
                throw new Error(`שגיאה בחיבור ל-Dropbox: ${listFolderResponse.status} ${listFolderResponse.statusText}`);
            }

            // Handle specific Dropbox errors
            if (errorData.error && errorData.error['.tag']) {
                const errorTag = errorData.error['.tag'];
                
                switch (errorTag) {
                    case 'expired_access_token':
                        throw new Error("טוקן הגישה ל-Dropbox פג תוקף. אנא פנה למנהל המערכת לחידוש הטוקן בהגדרות המערכת.");
                    case 'invalid_access_token':
                        throw new Error("טוקן הגישה ל-Dropbox לא תקין. אנא פנה למנהל המערכת לעדכון הטוקן בהגדרות המערכת.");
                    case 'shared_link_not_found':
                        throw new Error("הקישור לתיקיית Dropbox לא נמצא או לא זמין. אנא בדוק את הקישור בהגדרות המערכת.");
                    case 'shared_link_access_denied':
                        throw new Error("אין הרשאת גישה לתיקיית Dropbox. אנא וודא שהקישור מאפשר גישה לכולם או עדכן את ההרשאות.");
                    case 'rate_limit':
                        throw new Error("חרגת ממגבלת הקריאות ל-Dropbox. אנא נסה שוב בעוד מספר דקות.");
                    default:
                        throw new Error(`שגיאה ב-Dropbox: ${errorData.error_summary || errorTag}`);
                }
            }
            
            throw new Error(`שגיאה בחיבור ל-Dropbox: ${errorData.error_summary || errorText}`);
        }
        
        const filesData = await listFolderResponse.json();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        const recentPdfFiles = filesData.entries
            .filter(file => 
                file && // Ensure file object exists
                file['.tag'] === 'file' && 
                file.name && file.name.toLowerCase().endsWith('.pdf') &&
                file.client_modified && new Date(file.client_modified) > yesterday
            )
            .map(file => ({
                id: file.id || `fallback_${Date.now()}_${Math.random()}`,
                name: file.name || 'unknown_file.pdf',
                modified_time: file.client_modified || new Date().toISOString(),
                size: file.size || 0 // Default to 0 if size is undefined
            }));

        return new Response(JSON.stringify({ success: true, files: recentPdfFiles }), {
            status: 200, headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("Error in findNewDropboxFiles:", error.message);
        return new Response(JSON.stringify({ success: false, error: error.message }), { 
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
});