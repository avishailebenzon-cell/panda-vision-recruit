import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Parse request body
    const { email } = await req.json();
    
    if (!email || !email.includes('@')) {
      return Response.json({ 
        success: false, 
        error: 'כתובת המייל לא תקינה' 
      }, { status: 400 });
    }

    // Find all mail logs for this candidate email using service role (public access)
    const mailLogs = await base44.asServiceRole.entities.HilaMailLog.filter({ 
      candidate_email: email.toLowerCase() 
    });

    if (mailLogs.length === 0) {
      // Email not found in our system
      return Response.json({ 
        success: false, 
        notFound: true,
        message: 'כתובת המייל לא נמצאה במערכת' 
      });
    }

    // Update all mail logs to mark as unsubscribed using service role
    for (const log of mailLogs) {
      if (!log.unsubscribed) {
        await base44.asServiceRole.entities.HilaMailLog.update(log.id, {
          unsubscribed: true,
          unsubscribe_date: new Date().toISOString()
        });
      }
    }

    // Log the unsubscribe event
    try {
      await base44.asServiceRole.entities.SystemActivityLog.create({
        actor_type: 'candidate',
        actor_name: email,
        action_type: 'unsubscribe',
        action_description: `מועמד ביטל מנוי: ${email}`,
        status: 'success',
        details: JSON.stringify({ email, logsUpdated: mailLogs.length })
      });
    } catch (logErr) {
      console.warn('Failed to log unsubscribe event:', logErr);
    }

    return Response.json({ 
      success: true,
      logsUpdated: mailLogs.length,
      message: 'המנוי בוטל בהצלחה'
    });

  } catch (error) {
    console.error('Error unsubscribing:', error);
    return Response.json({ 
      success: false, 
      error: error.message || 'אירעה שגיאה בעת ביטול המנוי' 
    }, { status: 500 });
  }
});