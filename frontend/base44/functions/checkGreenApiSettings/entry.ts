import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const instanceId = Deno.env.get('GREEN_API_INSTANCE_ID');
    const apiToken = Deno.env.get('GREEN_API_TOKEN');

    if (!instanceId || !apiToken) {
      return Response.json({ error: 'Green API credentials not configured' }, { status: 500 });
    }

    // Get current settings
    const settingsUrl = `https://api.green-api.com/waInstance${instanceId}/getSettings/${apiToken}`;
    const settingsResponse = await fetch(settingsUrl);
    const settings = await settingsResponse.json();

    // Get state info
    const stateUrl = `https://api.green-api.com/waInstance${instanceId}/getStateInstance/${apiToken}`;
    const stateResponse = await fetch(stateUrl);
    const state = await stateResponse.json();

    return Response.json({
      instanceId,
      state,
      settings: {
        incomingWebhook: settings.incomingWebhook,
        outgoingMessageWebhook: settings.outgoingMessageWebhook,
        outgoingAPIMessageWebhook: settings.outgoingAPIMessageWebhook,
        webhookUrl: settings.webhookUrl,
        delaySendMessagesMilliseconds: settings.delaySendMessagesMilliseconds,
        markIncomingMessagesReaded: settings.markIncomingMessagesReaded,
        markIncomingMessagesReadedOnReply: settings.markIncomingMessagesReadedOnReply,
        keepOnlineStatus: settings.keepOnlineStatus
      },
      fullSettings: settings
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});