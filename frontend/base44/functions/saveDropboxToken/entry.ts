import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);

    try {
        const user = await base44.auth.me();
        if (!user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
        }

        const { accessToken, cvFolderUrls, jobsFolderUrl } = await req.json();

        if (!accessToken || !accessToken.trim()) {
            return new Response(JSON.stringify({ success: false, error: "Access Token חסר" }), { status: 400 });
        }

        const trimmedToken = accessToken.trim();

        // Check if it's a short-lived token
        if (trimmedToken.startsWith('sl.')) {
            return new Response(JSON.stringify({ 
                success: false, 
                error: "הטוקן שהזנת הוא זמני (Short-Lived Token) ויפוג אחרי 4 שעות. אנא צור טוקן קבוע ב-Dropbox App Console עם 'No expiration' והזן אותו במקום." 
            }), { status: 400 });
        }

        // Test the token by making a simple API call
        try {
            const testResponse = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${trimmedToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!testResponse.ok) {
                const errorData = await testResponse.json().catch(() => ({}));
                console.error('Dropbox token test failed:', testResponse.status, errorData);
                
                let errorMessage = 'הטוקן אינו תקין';
                if (testResponse.status === 401) {
                    errorMessage = 'הטוקן אינו תקין או שפג תוקפו. אנא צור טוקן חדש ב-Dropbox App Console עם "No expiration".';
                } else if (testResponse.status === 429) {
                    errorMessage = 'יותר מדי בקשות ל-Dropbox. נסה שוב בעוד מספר דקות.';
                }
                
                throw new Error(errorMessage);
            }

            const accountInfo = await testResponse.json();
            console.log('✅ Dropbox account connected successfully:', accountInfo.email);
        } catch (error) {
            console.error('Error testing Dropbox token:', error);
            return new Response(JSON.stringify({ 
                success: false, 
                error: `לא ניתן להתחבר ל-Dropbox: ${error.message}`
            }), { status: 400 });
        }

        // Save or update the config
        const existingConfigs = await base44.asServiceRole.entities.DropboxConfig.list();
        
        const configData = {
            is_configured: true,
            oauth_access_token: trimmedToken,
            cv_folder_urls: cvFolderUrls || [],
            jobs_folder_url: jobsFolderUrl || '',
            folder_urls: [...(cvFolderUrls || []), jobsFolderUrl].filter(Boolean),
            test_status: 'success',
            last_test_date: new Date().toISOString(),
            configuration_notes: `הוגדר על ידי ${user.full_name} ב-${new Date().toLocaleString('he-IL')}`
        };

        let config;
        if (existingConfigs.length > 0) {
            config = await base44.asServiceRole.entities.DropboxConfig.update(existingConfigs[0].id, configData);
        } else {
            config = await base44.asServiceRole.entities.DropboxConfig.create(configData);
        }

        return new Response(JSON.stringify({ 
            success: true, 
            message: "Dropbox הוגדר בהצלחה", 
            config_id: config.id 
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("Dropbox token save error:", error);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});