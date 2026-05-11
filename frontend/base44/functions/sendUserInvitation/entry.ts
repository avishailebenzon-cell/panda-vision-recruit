import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);

    try {
        const invitingUser = await base44.auth.me();
        if (!invitingUser || (invitingUser.app_role !== 'admin' && !invitingUser.can_manage_users)) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
        }

        const { full_name, email, app_role, invitation_message, resend, predefined_permissions } = await req.json();

        // 1. Check if user already exists
        const existingUsers = await base44.asServiceRole.entities.User.filter({ email: email.toLowerCase().trim() });
        if (existingUsers.length > 0) {
            return new Response(JSON.stringify({ error: `משתמש עם כתובת האימייל "${email}" כבר קיים במערכת.` }), { status: 409 });
        }
        
        // 2. Handle existing invitations
        let existingInvitation = null;
        const existingInvitations = await base44.asServiceRole.entities.UserInvitation.filter({ 
            email: email.toLowerCase().trim() 
        });

        if (existingInvitations.length > 0) {
            existingInvitation = existingInvitations[0];
            if (existingInvitation.invitation_status === 'sent' && !resend) {
                return new Response(JSON.stringify({ error: 'Active invitation already exists' }), { status: 409 });
            }
        }

        // 3. Create or update invitation record
        let invitationRecord;
        const invitationData = {
            full_name,
            email: email.toLowerCase().trim(),
            app_role,
            invited_by: invitingUser.id,
            invited_by_name: invitingUser.full_name,
            invitation_status: 'sent',
            invitation_message: invitation_message || '',
            predefined_permissions: predefined_permissions || null
        };

        if (existingInvitation) {
            invitationRecord = await base44.asServiceRole.entities.UserInvitation.update(existingInvitation.id, invitationData);
        } else {
            invitationRecord = await base44.asServiceRole.entities.UserInvitation.create(invitationData);
        }
        
        // 4. Construct the email content
        const loginUrl = new URL(req.headers.get('origin')).origin;
        const defaultTemplateKey = `invitation_message_${app_role}`;
        
        const adminUserRecords = await base44.asServiceRole.entities.User.filter({role: 'admin'});
        const adminUser = adminUserRecords.length > 0 ? adminUserRecords[0] : invitingUser;

        const defaultTemplate = adminUser[defaultTemplateKey] || `
            שלום {user_name},
            
            הוזמנת להצטרף למערכת PandaRecruitAI.
            
            לחץ על הקישור כדי להירשם: {login_url}
            
            בברכה,
            צוות PandaRecruitAI
        `;
        
        const customMessage = invitation_message ? `<p style="white-space: pre-wrap; margin-bottom: 20px;">${invitation_message}</p>` : '';
        const bodyText = defaultTemplate
            .replace('{user_name}', full_name)
            .replace('{login_url}', loginUrl);

        const emailBody = `
            <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.6;">
                ${customMessage}
                <p style="white-space: pre-wrap;">${bodyText}</p>
            </div>
        `;
        
        const subject = `💌 הוזמנת להצטרף ל-PandaRecruitAI`;

        // 5. Send email using Resend
        const emailResponse = await base44.asServiceRole.functions.invoke('sendEmailViaResend', {
            to: email,
            subject: subject,
            body: emailBody,
            from_name: 'PandaRecruitAI'
        });

        if (!emailResponse.success) {
            // If email fails, roll back the invitation status to avoid confusion
            await base44.asServiceRole.entities.UserInvitation.update(invitationRecord.id, { invitation_status: 'failed' });
            throw new Error(emailResponse.error || 'Failed to send email via Resend');
        }

        return new Response(JSON.stringify({ success: true, message: 'Invitation sent successfully' }), {
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error("sendUserInvitation error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
});