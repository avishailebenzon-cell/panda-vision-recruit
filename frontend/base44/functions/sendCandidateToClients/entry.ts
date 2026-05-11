import { createClientFromRequest } from 'npm:@base44/sdk@0.5.0';
import { Candidate } from '@/entities/Candidate';
import { Client } from '@/entities/Client';
import { EmailOutbox } from '@/entities/EmailOutbox';
import { User } from '@/entities/User';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    if (!(await base44.auth.isAuthenticated())) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401, headers: { 'Content-Type': 'application/json' }
        });
    }
    const user = await base44.auth.me();

    try {
        const { candidateId, clientIds, messageTemplate } = await req.json();

        if (!candidateId || !clientIds || clientIds.length === 0 || !messageTemplate) {
            throw new Error('Missing required fields');
        }

        const candidate = await base44.asServiceRole.entities.Candidate.get(candidateId);
        if (!candidate) {
            throw new Error('Candidate not found');
        }

        const clients = await base44.asServiceRole.entities.Client.filter({ id: { $in: clientIds } });
        if (!clients || clients.length === 0) {
            throw new Error('No valid clients found');
        }

        let successCount = 0;
        const errors = [];

        for (const clientId of clientIds) {
            try {
                const client = clients.find(c => c.id === clientId);
                if (!client || !client.email) {
                    errors.push({ clientId, error: 'Client not found or has no email' });
                    continue;
                }

                const finalMessage = messageTemplate
                    .replace(/{client_name}/g, client.name)
                    .replace(/{candidate_name}/g, `${candidate.first_name} ${candidate.last_name}`)
                    .replace(/{candidate_email}/g, candidate.email || 'לא צוין')
                    .replace(/{candidate_phone}/g, candidate.phone_primary || 'לא צוין')
                    .replace(/{security_clearance}/g, candidate.security_clearance || 'לא צוין')
                    .replace(/{skills_summary}/g, candidate.skills_summary || 'לא צוין');

                const emailResult = await base44.functions.invoke('sendEmailViaResend', {
                    to: client.email,
                    subject: `מועמד חדש: ${candidate.first_name} ${candidate.last_name}`,
                    body: finalMessage,
                    from_name: 'פנדה-טק'
                });

                if (!emailResult.success) {
                    throw new Error(emailResult.error || 'Unknown error from sendOutlookEmail');
                }

                successCount++;
                
                await base44.asServiceRole.entities.EmailOutbox.create({
                    candidate_id: candidate.id,
                    candidate_name: `${candidate.first_name} ${candidate.last_name}`,
                    client_id: client.id,
                    client_name: client.name,
                    client_email: client.email,
                    subject: `מועמד חדש: ${candidate.first_name} ${candidate.last_name}`,
                    message_content: finalMessage,
                    sent_by_user_id: user.id,
                    sent_by_user_name: user.full_name,
                    status: 'sent'
                });
            } catch (e) {
                const clientInfo = clients.find(c => c.id === clientId);
                errors.push({ 
                    clientId, 
                    clientName: clientInfo?.name || 'Unknown', 
                    error: e.message 
                });
            }
        }

        return Response.json({ success: true, successCount, totalClients: clientIds.length, errors });

    } catch (error) {
        console.error("Error in sendCandidateToClients:", error);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
});