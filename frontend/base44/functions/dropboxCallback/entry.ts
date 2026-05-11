import { createClient } from 'npm:@base44/sdk@0.7.0';

const CLIENT_ID = Deno.env.get("Dropbox_App_key");
const CLIENT_SECRET = Deno.env.get("Dropbox_App_secret");

// This function handles the final step of the OAuth2 flow.
Deno.serve(async (req) => {
    const base44 = createClient(Deno.env.get("BASE44_APP_ID"), Deno.env.get("BASE44_TOKEN"));
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // For security, not used yet but good practice

    const managementPageUrl = `${new URL(req.url).origin.replace(/-deno-dev-.*/, '.base44.app')}/Management`;

    if (!code) {
        return Response.redirect(`${managementPageUrl}?dropbox_error=true&message=Authorization code not found.`, 302);
    }

    try {
        const tokenUrl = 'https://api.dropboxapi.com/oauth2/token';
        const params = new URLSearchParams();
        params.append('code', code);
        params.append('grant_type', 'authorization_code');
        params.append('client_id', CLIENT_ID);
        params.append('client_secret', CLIENT_SECRET);
        // The redirect_uri must EXACTLY match the one used to start the flow.
        params.append('redirect_uri', url.origin + url.pathname);

        const response = await fetch(tokenUrl, {
            method: 'POST',
            body: params,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const tokenData = await response.json();

        if (!response.ok) {
            console.error("Dropbox token exchange failed in callback:", tokenData);
            throw new Error(tokenData.error_description || "Failed to exchange code for token.");
        }

        const { access_token, refresh_token } = tokenData;

        const existingConfigs = await base44.asServiceRole.entities.DropboxConfig.list();
        
        const configData = {
            is_configured: true,
            oauth_access_token: access_token,
            oauth_refresh_token: refresh_token,
            test_status: 'success',
            configuration_notes: `החיבור חודש אוטומטית בתאריך ${new Date().toLocaleString('he-IL')}`
        };

        if (existingConfigs.length > 0) {
            await base44.asServiceRole.entities.DropboxConfig.update(existingConfigs[0].id, configData);
        } else {
            // This case is less likely in the new flow, but good to have
            await base44.asServiceRole.entities.DropboxConfig.create(configData);
        }

        // Redirect back to the management page with a success message
        return Response.redirect(`${managementPageUrl}?dropbox_success=true`, 302);

    } catch (error) {
        console.error("Dropbox callback error:", error);
        // Redirect back to the management page with an error message
        return Response.redirect(`${managementPageUrl}?dropbox_error=true&message=${encodeURIComponent(error.message)}`, 302);
    }
});