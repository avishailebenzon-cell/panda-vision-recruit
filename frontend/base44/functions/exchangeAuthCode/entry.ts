import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

const CLIENT_ID = Deno.env.get("Application_ID");
const TENANT_ID = Deno.env.get("Directory_tenant_ID");
const CLIENT_SECRET = Deno.env.get("Azure_App_secret");
const REDIRECT_URI = `https://recruit-ai-288c7bb5.base44.app/OAuthCallback`;

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    const { code } = await req.json();

    if (!code) {
        return Response.json({ success: false, error: "Authorization code is missing." }, { status: 400 });
    }

    try {
        const tokenUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
        const params = new URLSearchParams();
        params.append("client_id", CLIENT_ID);
        params.append("scope", "offline_access Mail.Read");
        params.append("code", code);
        params.append("redirect_uri", REDIRECT_URI);
        params.append("grant_type", "authorization_code");
        params.append("client_secret", CLIENT_SECRET);

        const response = await fetch(tokenUrl, {
            method: "POST",
            body: params,
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });

        const data = await response.json();

        if (data.error) {
            console.error("Error fetching token from MS Graph:", data);
            throw new Error(data.error_description || data.error);
        }

        const { access_token, refresh_token, expires_in } = data;
        const expires_at = new Date(new Date().getTime() + expires_in * 1000).toISOString();

        const tokenRecord = {
            service: 'microsoft_graph_email',
            access_token,
            refresh_token,
            expires_at
        };

        const existingTokens = await base44.asServiceRole.entities.MicrosoftGraphToken.filter({ service: 'microsoft_graph_email' });
        if (existingTokens.length > 0) {
            await base44.asServiceRole.entities.MicrosoftGraphToken.update(existingTokens[0].id, tokenRecord);
        } else {
            await base44.asServiceRole.entities.MicrosoftGraphToken.create(tokenRecord);
        }

        return Response.json({ success: true });

    } catch (error) {
        console.error("Token exchange function error:", error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});