import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { to, subject, body, from_name } = await req.json();

    if (!to || !subject || !body) {
      return Response.json({ error: 'Missing required fields: to, subject, body' }, { status: 400 });
    }

    // CRITICAL DUPLICATE PREVENTION: Check if ANY email was sent to employees TODAY
    const now = new Date();
    const israelNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
    const todayStart = new Date(israelNow);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);
    
    const todaysSends = await base44.asServiceRole.entities.HilaRunLog.filter({
      run_type: 'email_send',
      status: 'success',
      created_date: { $gte: todayStart.toISOString(), $lte: todayEnd.toISOString() }
    });
    
    if (todaysSends && todaysSends.length > 0) {
      console.log('🚫 BLOCKED: Email already sent today - preventing duplicate send');
      
      await base44.asServiceRole.entities.HilaRunLog.create({
        run_type: 'email_send',
        status: 'blocked',
        error_message: 'מייל כבר נשלח היום - חסימה למניעת כפילות',
        emails_sent_to: to
      });
      
      return Response.json({ 
        success: false, 
        error: 'מייל כבר נשלח לעובדים היום - חסימה למניעת כפילות'
      }, { status: 409 });
    }

    // Send email via Resend API
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not configured');

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${from_name || 'הילה - צוות גיוס PandaTech'} <noreply@pandatech.co.il>`,
        to: [to],
        subject,
        html: body
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Resend API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    return Response.json({ 
      success: true, 
      messageId: result.id,
      sentTo: to
    });

  } catch (error) {
    console.error('Send Hila email error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});