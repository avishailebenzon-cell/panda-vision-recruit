import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  try {
    const base44 = createClientFromRequest(req);
    
    // Check if authenticated (for user-triggered emails)
    let user = null;
    try {
      user = await base44.auth.me();
    } catch (e) {
      // Allow service role to send emails even without user auth
    }

    if (!RESEND_API_KEY) {
      return Response.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });
    }

    const { to, subject, body, from_name, cc, bcc, attachments } = await req.json();

    if (!to || !subject || !body) {
      return Response.json({ error: 'Missing required fields: to, subject, body' }, { status: 400 });
    }

    // Get email service config for defaults
    let fromName = from_name || 'PandaHRAI';
    let fromEmail = 'noreply@pandatech.co.il';
    
    try {
      const configs = await base44.asServiceRole.entities.EmailServiceConfig.list();
      if (configs.length > 0 && configs[0].is_active) {
        fromName = from_name || configs[0].default_from_name || 'PandaHRAI';
        fromEmail = configs[0].default_from_email || 'noreply@pandatech.co.il';
        
        // Check daily limit
        const emailsSentToday = configs[0].emails_sent_today || 0;
        const dailyLimit = configs[0].daily_limit || 1000;
        
        if (emailsSentToday >= dailyLimit) {
          return Response.json({ 
            error: `Daily email limit reached (${dailyLimit})`,
            success: false 
          }, { status: 429 });
        }
      }
    } catch (e) {
      console.log('Could not load email service config, using defaults');
    }

    // Convert plain text body to HTML if needed
    const htmlBody = body.includes('<br>') || body.includes('<p>') || body.includes('<div>') 
      ? body 
      : body.replace(/\n/g, '<br>');

    // Send email via Resend API
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: Array.isArray(to) ? to : [to],
        subject: subject,
        html: htmlBody,
        cc: cc ? (Array.isArray(cc) ? cc : [cc]) : undefined,
        bcc: bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : undefined,
        attachments: attachments ? attachments.map(a => ({ url: a.url, filename: a.filename })) : undefined
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Resend API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    // Log to EmailLog
    try {
      await base44.asServiceRole.entities.EmailLog.create({
        to: Array.isArray(to) ? to[0] : to,
        subject: subject,
        from_name: fromName,
        from_email: fromEmail,
        status: 'sent',
        resend_message_id: result.id,
        sent_by_user_id: user?.id || 'system',
        sent_by_user_name: user?.full_name || 'System',
        source: user ? 'manual' : 'system'
      });
      
      // Update email count for today
      const configs = await base44.asServiceRole.entities.EmailServiceConfig.list();
      if (configs.length > 0) {
        const currentCount = configs[0].emails_sent_today || 0;
        await base44.asServiceRole.entities.EmailServiceConfig.update(configs[0].id, {
          emails_sent_today: currentCount + 1
        });
      }
    } catch (logErr) {
      console.error('Failed to log email:', logErr.message);
    }
    
    return Response.json({ 
      success: true, 
      messageId: result.id,
      sentTo: to
    });

  } catch (error) {
    console.error('Send email error:', error);
    
    // Try to log failed email
    try {
      const base44Fallback = createClientFromRequest(req);
      const { to, subject } = await req.json();
      await base44Fallback.asServiceRole.entities.EmailLog.create({
        to: Array.isArray(to) ? to[0] : to,
        subject: subject,
        from_name: 'PandaHRAI',
        from_email: 'noreply@pandatech.co.il',
        status: 'failed',
        error_message: error.message,
        sent_by_user_id: 'system',
        sent_by_user_name: 'System',
        source: 'system'
      });
    } catch (logErr) {
      console.error('Failed to log failed email:', logErr.message);
    }
    
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});