import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    console.log('Starting Elad Sending Process - Automatic Email Sending');

    // Get all tasks approved for sending
    const approvedTasks = await base44.asServiceRole.entities.EladTask.filter({
      status: 'מאושר לשליחה'
    }, '-approved_at', 50);

    console.log(`Found ${approvedTasks.length} tasks approved for sending`);

    if (approvedTasks.length === 0) {
      return Response.json({
        success: true,
        processed: 0,
        sent: 0,
        failed: 0,
        manualHandling: 0,
        message: 'No tasks to process'
      });
    }

    // Get Elad settings
    const eladSettings = await base44.asServiceRole.entities.EladSettings.list('-updated_date', 1);
    const settings = eladSettings.length > 0 ? eladSettings[0] : null;

    if (!settings) {
      console.log('No Elad settings found - using defaults');
    }

    let sent = 0;
    let failed = 0;
    let manualHandling = 0;
    const errors = [];

    for (const task of approvedTasks) {
      try {
        console.log(`Processing task ${task.task_number} - ${task.candidate_full_name} → ${task.client_company_name}`);

        // CRITICAL: Check if client is "חברת חשמל" or "חברת החשמל"
        const clientNameLower = (task.client_company_name || '').toLowerCase();
        const isElectricCompany = clientNameLower.includes('חברת חשמל') || 
                                   clientNameLower.includes('חברת החשמל') ||
                                   clientNameLower === 'חברת חשמל' ||
                                   clientNameLower === 'חברת החשמל';

        if (isElectricCompany) {
          console.log(`⚠️ Task ${task.task_number} is for Electric Company - marking for manual handling`);
          
          await base44.asServiceRole.entities.EladTask.update(task.id, {
            status: 'טיפול ידני',
            notes: (task.notes || '') + `\n[${new Date().toLocaleString('he-IL')}] זוהה כלקוח חברת החשמל - דורש הגשה באמצעות מסמך BID. אלעד לא שולח אוטומטית.`
          });
          
          manualHandling++;
          continue;
        }

        // Validate required data
        if (!task.client_email) {
          throw new Error('חסר מייל לקוח');
        }

        if (!task.candidate_cv_file_url) {
          throw new Error('חסר קובץ קורות חיים');
        }

        // Check deadline if settings require it
        if (settings?.do_not_send_if_deadline_passed && task.deadline) {
          const deadlineDate = new Date(task.deadline);
          if (deadlineDate < new Date()) {
            throw new Error('דד-ליין עבר');
          }
        }

        // Prepare email content
        const subject = settings?.subject_template 
          ? settings.subject_template
              .replace('{JobTitle}', task.job_title)
              .replace('{CandidateFullName}', task.candidate_full_name)
              .replace('{ClientCompanyName}', task.client_company_name)
          : `${task.job_title} | ${task.candidate_full_name} | פנדה-טק`;

        const body = settings?.body_template
          ? settings.body_template
              .replace('{JobTitle}', task.job_title)
              .replace('{CandidateFullName}', task.candidate_full_name)
              .replace('{ClientCompanyName}', task.client_company_name)
              .replace('{SignatureText}', settings.signature_text || '')
          : `שלום רב,\n\nמצורפים קורות החיים של ${task.candidate_full_name} להגשה למשרת "${task.job_title}" ב-${task.client_company_name}.\nנשמח לקבל עדכון על התקדמות המועמד בתהליך.\n\nבברכה,\n${settings?.signature_text || 'צוות פנדה-טק'}`;

        // Send email via Resend
        const emailResult = await base44.asServiceRole.functions.invoke('sendEmailViaResend', {
          to: task.client_email,
          subject,
          body,
          from_name: settings?.sender_name || 'פנדה-טק',
          attachment_url: task.candidate_cv_file_url
        });

        if (emailResult.data?.success) {
          await base44.asServiceRole.entities.EladTask.update(task.id, {
            status: 'נשלח',
            sent_at: new Date().toISOString(),
            email_subject_snapshot: subject,
            email_body_snapshot: body,
            resend_message_id: emailResult.data.messageId || null
          });
          
          console.log(`✓ Sent task ${task.task_number} successfully`);
          sent++;
        } else {
          throw new Error(emailResult.data?.error || 'שליחת המייל נכשלה');
        }

      } catch (taskError) {
        console.error(`Error processing task ${task.task_number}:`, taskError);
        
        await base44.asServiceRole.entities.EladTask.update(task.id, {
          status: 'תקלה בשליחה',
          last_error: taskError.message,
          retry_count: (task.retry_count || 0) + 1
        });
        
        failed++;
        errors.push({
          task_number: task.task_number,
          error: taskError.message
        });
      }

      // Rate limiting - wait between sends
      if (sent > 0 && sent % 10 === 0) {
        console.log('Rate limiting - waiting 6 seconds...');
        await new Promise(resolve => setTimeout(resolve, 6000));
      }
    }

    console.log(`Elad process complete: ${sent} sent, ${failed} failed, ${manualHandling} marked for manual handling`);

    return Response.json({
      success: true,
      processed: approvedTasks.length,
      sent,
      failed,
      manualHandling,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Elad sending process error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});