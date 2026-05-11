import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import webpush from 'npm:web-push@3.6.7';

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { subscription } = body;

    if (!subscription) {
      return Response.json(
        { error: 'Missing subscription' },
        { status: 400 }
      );
    }

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    if (!vapidPublicKey || !vapidPrivateKey) {
      return Response.json(
        { error: 'VAPID keys not configured' },
        { status: 500 }
      );
    }

    webpush.setVapidDetails(
      'mailto:admin@pandatech.co.il',
      vapidPublicKey,
      vapidPrivateKey
    );

    const payload = JSON.stringify({
      title: '🎉 הודעת בדיקה',
      body: 'מערכת ההתרעות עובדת בהצלחה!',
      data: {
        url: '/'
      }
    });

    await webpush.sendNotification(subscription, payload);

    return Response.json({
      success: true,
      message: 'Test notification sent successfully'
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});