import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import webpush from 'npm:web-push@3.6.7';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const vapidKeys = webpush.generateVAPIDKeys();
    return Response.json({
      publicKey: vapidKeys.publicKey,
      privateKey: vapidKeys.privateKey,
      message: 'Copy these keys to your secrets as VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});