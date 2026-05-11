import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    // Green API sends webhooks via POST
    if (req.method === 'GET') {
      // Health check
      return Response.json({ status: 'ok', message: 'Green API Webhook ready', timestamp: new Date().toISOString() });
    }

    const body = await req.json();
    
    // COMPREHENSIVE LOGGING - LOG EVERYTHING
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 WEBHOOK RECEIVED AT:', new Date().toISOString());
    console.log('Instance from body:', body?.instanceData?.idInstance);
    console.log('Type:', body?.typeWebhook);
    console.log('Phone:', body?.senderData?.chatId);
    console.log('Full body:', JSON.stringify(body, null, 2));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Route Shacahr webhooks to dedicated entities
    const instanceIdShacahr = Deno.env.get('GREEN_API_INSTANCE_ID_SHACAHR');

    const isShacahr = body?.instanceData?.idInstance === instanceIdShacahr;

    console.log(`Webhook routing: ${isShacahr ? 'SHACAHR' : 'ROTEM'} instance`);

    // Get the webhook type
    const typeWebhook = body.typeWebhook;

    // Route to appropriate handler based on instance
    if (isShacahr) {
      console.log('🔀 Routing to Shacahr handler');
      // Shacahr uses separate entities - handled by pollGreenApiMessagesShacahr
      return Response.json({ 
        status: 'ok',
        message: 'Shacahr webhook received - will be processed by polling'
      });
    }

    // We're interested in incoming messages (for Rotem/Shiri/Mitar)
    if (typeWebhook === 'incomingMessageReceived') {
      const messageData = body.messageData;
      const senderData = body.senderData;
      
      // Extract phone number (remove @c.us suffix)
      const chatId = senderData?.chatId || '';
      const phone = chatId.replace('@c.us', '');
      const senderName = senderData?.senderName || senderData?.sender || phone;
      
      // Get message content based on type
      let content = '';
      let mediaUrl = '';
      let mediaType = '';
      
      if (messageData?.typeMessage === 'textMessage') {
        content = messageData.textMessageData?.textMessage || '';
      } else if (messageData?.typeMessage === 'extendedTextMessage') {
        content = messageData.extendedTextMessageData?.text || '';
      } else if (messageData?.typeMessage === 'imageMessage') {
        content = messageData.imageMessage?.caption || '[תמונה]';
        mediaUrl = messageData.imageMessage?.downloadUrl || '';
        mediaType = 'image';
      } else if (messageData?.typeMessage === 'documentMessage') {
        content = messageData.documentMessage?.caption || `[קובץ: ${messageData.documentMessage?.fileName || 'document'}]`;
        mediaUrl = messageData.documentMessage?.downloadUrl || '';
        mediaType = 'document';
      } else if (messageData?.typeMessage === 'audioMessage') {
        content = '[הודעה קולית]';
        mediaUrl = messageData.audioMessage?.downloadUrl || '';
        mediaType = 'audio';
      } else if (messageData?.typeMessage === 'videoMessage') {
        content = messageData.videoMessage?.caption || '[וידאו]';
        mediaUrl = messageData.videoMessage?.downloadUrl || '';
        mediaType = 'video';
      } else {
        content = `[${messageData?.typeMessage || 'הודעה'}]`;
      }

      const messageId = body.idMessage || '';

      // Initialize base44 client with service role for webhook
      const base44 = createClientFromRequest(req);

      // Normalize phone for search - convert 972 to 0 format for local
      let phoneLocal = phone;
      if (phone.startsWith('972')) {
        phoneLocal = '0' + phone.slice(3);
      }
      
      console.log(`=== INCOMING MESSAGE FROM ${phone} (local: ${phoneLocal}) ===`);
      console.log(`Message: "${content.substring(0, 50)}..."`);

      // Find or create conversation by phone - try LOCAL format FIRST since that's how they're stored
      let conversations = [];
      try {
        // Try local format first (0...) - this is how conversations are stored
        console.log(`Searching for conversation with local phone: ${phoneLocal}`);
        conversations = await base44.asServiceRole.entities.WhatsappConversation.filter({ 
          candidate_phone: phoneLocal 
        }, '-created_date', 5);
        console.log(`Found ${conversations?.length || 0} with local format`);
        
        // If not found, try international format
        if ((!conversations || conversations.length === 0) && phoneLocal !== phone) {
          console.log(`Trying international phone format: ${phone}`);
          conversations = await base44.asServiceRole.entities.WhatsappConversation.filter({ 
            candidate_phone: phone 
          }, '-created_date', 5);
          console.log(`Found ${conversations?.length || 0} with international format`);
        }
      } catch (e) {
        console.log('Error finding conversation:', e.message);
      }
      
      console.log(`Total conversations found: ${conversations?.length || 0}`);

      let conversationId = '';
      if (conversations && conversations.length > 0) {
        conversationId = conversations[0].id;
        console.log(`Found existing conversation: ${conversationId}`);
        
        // Update conversation with last message info
        await base44.asServiceRole.entities.WhatsappConversation.update(conversationId, {
          last_message_date: new Date().toISOString(),
          last_message_direction: 'incoming',
          last_message_preview: content.substring(0, 100),
          messages_count: (conversations[0].messages_count || 0) + 1,
          status: 'active'
        });
      } else {
        console.log('No existing conversation found, creating new one');
        // Create a new conversation for this incoming message
        const newConv = await base44.asServiceRole.entities.WhatsappConversation.create({
          candidate_phone: phoneLocal, // Use local format for consistency
          candidate_name: senderName,
          status: 'active',
          last_message_date: new Date().toISOString(),
          last_message_direction: 'incoming',
          last_message_preview: content.substring(0, 100),
          messages_count: 1
        });
        conversationId = newConv.id;
        conversations = [newConv];
        console.log(`Created new conversation: ${conversationId}`);
      }

      // Save the incoming message - use local phone format for consistency
      const savedMessage = await base44.asServiceRole.entities.WhatsappMessage.create({
        conversation_id: conversationId,
        candidate_phone: phoneLocal, // Use local format for consistency
        direction: 'incoming',
        content: content,
        message_id: messageId,
        sender_name: senderName,
        status: 'delivered',
        media_url: mediaUrl || undefined,
        media_type: mediaType || undefined
      });

      console.log(`=== SAVED INCOMING MESSAGE ===`);
      console.log(`Message ID: ${savedMessage.id}`);
      console.log(`Conversation ID: ${conversationId}`);
      console.log(`From: ${phoneLocal}`);
      console.log(`Content: ${content.substring(0, 50)}...`);

      // Trigger Rotem agent to respond automatically
      try {
        // Find or create a conversation for the agent
        let agentConversationId = '';
        
        // Check if there's an existing agent conversation for this phone
        const existingConvs = conversations && conversations.length > 0 ? conversations : [];
        if (existingConvs.length > 0 && existingConvs[0].agent_conversation_id) {
          agentConversationId = existingConvs[0].agent_conversation_id;
        }

        // Get conversation history for context
        const recentMessages = await base44.asServiceRole.entities.WhatsappMessage.filter({
          candidate_phone: phone
        });
        
        // Sort by date and get last few messages for context
        recentMessages.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
        const contextMessages = recentMessages.slice(-10);

        // Use the agent to generate a response
        let agentConversation;
        if (agentConversationId) {
          agentConversation = await base44.asServiceRole.agents.getConversation(agentConversationId);
        } else {
          // Create new agent conversation
          agentConversation = await base44.asServiceRole.agents.createConversation({
            agent_name: 'rotem_whatsapp',
            metadata: {
              candidate_phone: phone,
              candidate_name: senderName
            }
          });
          
          // Save agent conversation ID to WhatsApp conversation
          if (conversationId) {
            await base44.asServiceRole.entities.WhatsappConversation.update(conversationId, {
              agent_conversation_id: agentConversation.id
            });
          }
        }

        // Add the incoming message to agent conversation and get response
        const agentResponse = await base44.asServiceRole.agents.addMessage(agentConversation, {
          role: 'user',
          content: content
        });

        // Wait a moment for agent to process and respond
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Get the updated conversation to find agent's response
        const updatedConversation = await base44.asServiceRole.agents.getConversation(agentConversation.id);
        const messages = updatedConversation.messages || [];
        
        // Find the last assistant message
        const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
        
        if (lastAssistantMessage && lastAssistantMessage.content) {
          // Send the response via WhatsApp
          const instanceId = Deno.env.get('GREEN_API_INSTANCE_ID');
          const apiToken = Deno.env.get('GREEN_API_TOKEN');
          
          const sendUrl = `https://api.green-api.com/waInstance${instanceId}/sendMessage/${apiToken}`;
          const sendResponse = await fetch(sendUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chatId: `${phone}@c.us`,
              message: lastAssistantMessage.content
            })
          });
          
          const sendResult = await sendResponse.json();
          
          // Save the outgoing message
          await base44.asServiceRole.entities.WhatsappMessage.create({
            conversation_id: conversationId,
            candidate_phone: phone,
            direction: 'outgoing',
            content: lastAssistantMessage.content,
            message_id: sendResult.idMessage,
            sender_name: 'רותם',
            status: 'sent'
          });
          
          console.log(`Rotem responded to ${phone}: ${lastAssistantMessage.content.substring(0, 50)}...`);
        }
      } catch (agentError) {
        console.error('Error triggering Rotem agent:', agentError);
        // Don't fail the webhook if agent fails
      }

      return Response.json({ 
        status: 'success', 
        message: 'Message saved and Rotem notified',
        phone,
        conversationId
      });
    }

    // Handle outgoing message status updates
    if (typeWebhook === 'outgoingMessageStatus') {
      const status = body.status; // sent, delivered, read
      const messageId = body.idMessage;
      
      if (messageId && status) {
        const base44 = createClientFromRequest(req);
        
        // Find and update message status
        try {
          const messages = await base44.asServiceRole.entities.WhatsappMessage.filter({
            message_id: messageId
          });
          
          if (messages && messages.length > 0) {
            await base44.asServiceRole.entities.WhatsappMessage.update(messages[0].id, {
              status: status
            });
          }
        } catch (e) {
          console.log('Could not update message status:', e.message);
        }
      }
      
      return Response.json({ status: 'success', message: 'Status updated' });
    }

    // Other webhook types - just acknowledge
    return Response.json({ status: 'ok', typeWebhook });

  } catch (error) {
    console.error('Webhook error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});