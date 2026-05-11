import { createClientFromRequest } from 'npm:@base44/sdk@0.7.0';

const CLIENT_ID = Deno.env.get("Dropbox_App_key");
const CLIENT_SECRET = Deno.env.get("Dropbox_App_secret");
const REDIRECT_URI = 'https://base44.app/oauth/dropbox/callback'; // Using a single, canonical Redirect URI

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);

    try {
        const user = await base44.auth.me();
        if (!user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
        }

        const { authCode, cvFolderUrls, jobsFolderUrl } = await req.json();

        if (!authCode) {
            return new Response(JSON.stringify({ success: false, error: "קוד הרשאה חסר" }), { status: 400 });
        }

        const tokenUrl = 'https://api.dropboxapi.com/oauth2/token';
        const params = new URLSearchParams();
        params.append('code', authCode);
        params.append('grant_type', 'authorization_code');
        params.append('client_id', CLIENT_ID);
        params.append('client_secret', CLIENT_SECRET);
        params.append('redirect_uri', REDIRECT_URI);

        const response = await fetch(tokenUrl, {
            method: 'POST',
            body: params,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const tokenData = await response.json();

        if (!response.ok) {
            console.error("Dropbox token exchange failed:", tokenData);
            throw new Error("לא הצלחנו לקבל אסימון מ-Dropbox. קוד ההרשאה פג או לא תקין. אנא קבל קוד חדש.");
        }

        const { access_token, refresh_token, expires_in } = tokenData;

        let config;
        const existingConfigs = await base44.asServiceRole.entities.DropboxConfig.list();
        
        const configData = {
            is_configured: true,
            oauth_access_token: access_token,
            oauth_refresh_token: refresh_token,
            cv_folder_urls: cvFolderUrls || [],
            jobs_folder_url: jobsFolderUrl || '',
            folder_urls: [...(cvFolderUrls || []), jobsFolderUrl].filter(Boolean),
            test_status: 'success',
            configuration_notes: `הוגדר על ידי ${user.full_name} ב-${new Date().toLocaleString('he-IL')}`
        };

        if (existingConfigs.length > 0) {
            config = await base44.asServiceRole.entities.DropboxConfig.update(existingConfigs[0].id, configData);
        } else {
            config = await base44.asServiceRole.entities.DropboxConfig.create(configData);
        }

        return new Response(JSON.stringify({ success: true, message: "Dropbox הוגדר בהצלחה", config_id: config.id }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("Dropbox setup error:", error);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});