import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

const CLIENT_ID = Deno.env.get("Application_ID");
const TENANT_ID = Deno.env.get("Directory_tenant_ID");
const CLIENT_SECRET = Deno.env.get("Azure_App_secret");

async function getGraphToken(base44) {
    const existingTokens = await base44.asServiceRole.entities.MicrosoftGraphToken.filter({ service: 'microsoft_graph_email' });

    if (existingTokens.length === 0) {
        return { error: 'not_authenticated' };
    }

    const tokenData = existingTokens[0];
    const now = new Date();
    const expiry = new Date(tokenData.expires_at);

    // If token is still valid for more than 5 minutes, return it
    if (expiry > new Date(now.getTime() + 5 * 60 * 1000)) {
        return { accessToken: tokenData.access_token };
    }

    // Token is expired or about to expire, refresh it
    console.log('Refreshing Microsoft Graph token...');
    const tokenUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
    const params = new URLSearchParams();
    params.append("client_id", CLIENT_ID);
    params.append("scope", "https://graph.microsoft.com/.default");
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
        // If refresh fails, it likely means re-authentication is needed
        return { error: 'not_authenticated' };
    }

    const { access_token, refresh_token, expires_in } = data;
    const expires_at = new Date(new Date().getTime() + expires_in * 1000).toISOString();

    await base44.asServiceRole.entities.MicrosoftGraphToken.update(tokenData.id, {
        access_token,
        refresh_token, // Microsoft often returns a new refresh token
        expires_at
    });

    return { accessToken: access_token };
}

// This function is not meant to be served, but imported by others.
// We add a serve block to comply with platform requirements.
Deno.serve(async (req) => {
  return new Response(JSON.stringify({ message: "This is a helper function module and not meant to be called directly." }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

export { getGraphToken };