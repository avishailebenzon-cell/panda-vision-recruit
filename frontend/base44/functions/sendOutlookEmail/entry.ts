import { createClientFromRequest } from 'npm:@base44/sdk@0.5.0';
import nodemailer from 'npm:nodemailer@6.9.8';

const EMAIL_CREDENTIALS = Deno.env.get("jobs@pandatech.co.il");

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);

    if (!(await base44.auth.isAuthenticated())) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401, headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const { to, subject, body, cc, bcc } = await req.json();

        if (!to || !subject || !body) {
            throw new Error('Missing required fields: to, subject, body');
        }

        if (!EMAIL_CREDENTIALS) {
            throw new Error('Email credentials not configured');
        }

        // Parse credentials (assuming format: "password" or "username:password")
        let username = 'jobs@pandatech.co.il';
        let password = EMAIL_CREDENTIALS;
        
        if (EMAIL_CREDENTIALS.includes(':')) {
            [username, password] = EMAIL_CREDENTIALS.split(':', 2);
        }

        // Create transporter for Outlook/Office365
        const transporter = nodemailer.createTransporter({
            host: 'smtp-mail.outlook.com',
            port: 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: username,
                pass: password,
            },
            tls: {
                ciphers: 'SSLv3'
            }
        });

        // Mail options
        const mailOptions = {
            from: `"פנדה-טק" <${username}>`,
            to: to,
            subject: subject,
            html: body.replace(/\n/g, '<br>'), // Convert line breaks to HTML
            cc: cc || undefined,
            bcc: bcc || undefined
        };

        // Send mail
        const info = await transporter.sendMail(mailOptions);

        return Response.json({
            success: true,
            messageId: info.messageId,
            message: 'Email sent successfully'
        });

    } catch (error) {
        console.error("Error sending email:", error);
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
        }), {
            status: 500, 
            headers: { 'Content-Type': 'application/json' }
        });
    }
});