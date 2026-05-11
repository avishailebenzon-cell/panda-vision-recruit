
import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

// --- START: Logic from getGraphToken.js is now embedded ---
const CLIENT_ID = Deno.env.get("Application_ID");
const CLIENT_SECRET = Deno.env.get("Azure_App_secret");
const TENANT_ID = Deno.env.get("Directory_tenant_ID");

async function getGraphToken(base44) {
    try {
        const tokenRecords = await base44.asServiceRole.entities.MicrosoftGraphToken.list();
        let tokenRecord = tokenRecords[0];

        if (!tokenRecord) {
            return { error: 'AUTH_NEEDED' };
        }

        const tokenExpiry = new Date(tokenRecord.expires_at).getTime();
        const now = new Date().getTime();
        const buffer = 5 * 60 * 1000; // 5 minutes buffer

        if (now < tokenExpiry - buffer) {
            return { accessToken: tokenRecord.access_token, userId: tokenRecord.user_id };
        } else {
            console.log('Refreshing expired Graph token...');
            const refreshUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
            const params = new URLSearchParams();
            params.append('client_id', CLIENT_ID);
            params.append('scope', 'offline_access Mail.ReadWrite');
            params.append('refresh_token', tokenRecord.refresh_token);
            params.append('grant_type', 'refresh_token');
            params.append('client_secret', CLIENT_SECRET);

            const response = await fetch(refreshUrl, {
                method: 'POST',
                body: params,
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            const newTokens = await response.json();

            if (!response.ok || newTokens.error) {
                console.error('Failed to refresh token:', newTokens);
                await base44.asServiceRole.entities.MicrosoftGraphToken.delete(tokenRecord.id);
                return { error: 'AUTH_NEEDED' };
            }
            
            const newExpiry = new Date(new Date().getTime() + newTokens.expires_in * 1000).toISOString();

            const updatedRecord = await base44.asServiceRole.entities.MicrosoftGraphToken.update(tokenRecord.id, {
                access_token: newTokens.access_token,
                refresh_token: newTokens.refresh_token,
                expires_at: newExpiry
            });

            console.log('Token refreshed and updated successfully.');
            return { accessToken: updatedRecord.access_token, userId: updatedRecord.user_id };
        }
    } catch (error) {
        console.error('Error in getGraphToken:', error);
        return { error: error.message };
    }
}
// --- END: Embedded logic ---


Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);

    try {
        const { accessToken, userId, error: tokenError } = await getGraphToken(base44);

        if (tokenError) {
            if (tokenError === 'AUTH_NEEDED') {
                const { authUrl } = await exchangeAuthCode(base44); // Assuming this function exists and provides the URL
                return new Response(JSON.stringify({ success: false, needsAuth: true, authUrl: authUrl }), { headers: { 'Content-Type': 'application/json' } });
            }
            throw new Error(`Authentication failed: ${tokenError}`);
        }

        // --- UPGRADED DIAGNOSTIC LOGIC ---
        // Fetch the top 25 most recent emails, regardless of read status.
        const messagesUrl = `https://graph.microsoft.com/v1.0/users/${userId}/mailFolders/inbox/messages?$top=25&$orderby=receivedDateTime desc&$select=subject,sender,hasAttachments,receivedDateTime`;
        
        const response = await fetch(messagesUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Graph API error: ${response.status} ${response.statusText} - ${errorBody}`);
        }

        const messages = await response.json();
        const foundMessages = messages.value || [];

        let summary = `בדיקת חיבור הושלמה.\n\n`;
        summary += `• נסרקו 25 המיילים האחרונים בתיבה.\n`;
        summary += `• נמצאו סה"כ: ${foundMessages.length} מיילים.\n`;
        
        const messagesWithAttachments = foundMessages.filter(m => m.hasAttachments);
        summary += `• מתוכם ${messagesWithAttachments.length} מיילים מכילים קבצים מצורפים.\n\n`;

        if (foundMessages.length > 0) {
            summary += 'פירוט חלקי של המיילים שנמצאו (לצורך אבחון):\n';
            foundMessages.slice(0, 10).forEach(msg => {
                summary += `  - נושא: ${msg.subject}\n`;
                summary += `    שולח: ${msg.sender.emailAddress.name} (${msg.sender.emailAddress.address})\n`;
                summary += `    התקבל בתאריך: ${new Date(msg.receivedDateTime).toLocaleString('he-IL')}\n`;
                summary += `    מכיל קבצים: ${msg.hasAttachments ? 'כן' : 'לא'}\n\n`;
            });
        } else {
            summary += 'לא נמצאו מיילים כלל ב-25 ההודעות האחרונות בתיבה.';
        }

        return new Response(JSON.stringify({ success: true, results: { summary } }), {
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Debug email reader failed:', error);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
});

// We need the exchangeAuthCode function here if it's not globally available
// For safety, let's include it.
async function exchangeAuthCode(base44) {
  try {
    const authUrl = `https://login.microsoftonline.com/${Deno.env.get("Directory_tenant_ID")}/oauth2/v2.0/authorize?` +
      `client_id=${Deno.env.get("Application_ID")}` +
      `&response_type=code` +
      `&redirect_uri=${Deno.env.get("BASE44_FUNCTION_ORIGIN_URL")}/microsoftGraphCallback` +
      `&response_mode=query` +
      `&scope=offline_access Mail.ReadWrite` +
      `&state=12345`; // You can use a more secure state in a real app

    return { authUrl };
  } catch (error) {
    console.error('Error creating auth URL:', error);
    return { error: 'Failed to create auth URL' };
  }
}
