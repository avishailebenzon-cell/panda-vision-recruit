import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    console.log('Starting WhatsApp responses check...');
    
    // Get all incoming WhatsApp messages with "1" that haven't been processed
    const incomingMessages = await base44.asServiceRole.entities.WhatsappMessage.filter({
      direction: 'incoming',
      content: '1'
    });
    
    console.log(`Found ${incomingMessages.length} incoming "1" responses`);
    
    let notificationsSent = 0;
    
    for (const message of incomingMessages) {
      // Check if we already sent a notification for this message
      if (message.notification_sent) {
        continue;
      }
      
      // Get the agent name from the job_title or match_id
      let agentName = 'הסוכן';
      if (message.job_title) {
        if (message.job_title.includes('נעמה')) agentName = 'נעמה (תוכנה)';
        else if (message.job_title.includes('רמי')) agentName = 'רמי (רמה 1)';
        else if (message.job_title.includes('אליק')) agentName = 'אליק (אלקטרוניקה)';
        else if (message.job_title.includes('איתי')) agentName = 'איתי (IT)';
        else if (message.job_title.includes('ליאור')) agentName = 'ליאור (הנדסת מערכת)';
        else if (message.job_title.includes('אופיר')) agentName = 'אופיר (מכונות)';
        else if (message.job_title.includes('GC')) agentName = 'GC (כללי)';
      }
      
      // Send email notification
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: 'office@pandatech.co.il',
          subject: `מועמד מעוניין - תשובה חיובית מ-WhatsApp`,
          body: `
שלום,

מועמד הגיב בחיוב (1) להודעת WhatsApp שנשלחה אליו על ידי ${agentName}.

פרטי המועמד:
━━━━━━━━━━━━━━━━━━━━━━━━━━
• שם: ${message.candidate_name || 'לא צוין'}
• טלפון: ${message.phone_number || message.candidate_phone || 'לא צוין'}
• משרה: ${message.job_title || 'לא צוינה'}
• מזהה התאמה: ${message.match_id || 'אין'}

תאריך התשובה: ${new Date(message.created_date).toLocaleString('he-IL')}

יש להמשיך בטיפול במועמד זה.

בברכה,
מערכת HRAI - התרעות אוטומטיות
          `,
          from_name: 'HRAI - תשובות מועמדים'
        });
        
        // Mark message as processed
        await base44.asServiceRole.entities.WhatsappMessage.update(message.id, {
          notification_sent: true,
          notification_sent_date: new Date().toISOString()
        });
        
        notificationsSent++;
        console.log(`Notification sent for candidate: ${message.candidate_name}`);
        
      } catch (emailError) {
        console.error(`Failed to send notification for message ${message.id}:`, emailError);
      }
    }
    
    console.log(`WhatsApp responses check completed. Notifications sent: ${notificationsSent}`);
    
    return Response.json({
      success: true,
      messagesChecked: incomingMessages.length,
      notificationsSent
    });
    
  } catch (error) {
    console.error('Error checking WhatsApp responses:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});