import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Proxy function for the external super-agent to communicate with Pandi (pandi_assistant).
 * 
 * Usage from the super-agent:
 *   POST /superAgentPandiProxy
 *   Body: {
 *     "message": "מה ההיסטוריה של יוסי כהן?",
 *     "conversation_id": "optional-existing-conversation-id"
 *   }
 * 
 * Returns: {
 *     "reply": "...",
 *     "conversation_id": "..."
 * }
 */

const AGENT_NAME = 'pandi_assistant';
const POLL_INTERVAL_MS = 1500;
const MAX_WAIT_MS = 90000; // 90 seconds max

function getLastAssistantMessage(messages) {
  if (!messages || messages.length === 0) return null;
  return [...messages].reverse().find(m => m.role === 'assistant') || null;
}

function isAgentDoneStreaming(messages) {
  const last = getLastAssistantMessage(messages);
  if (!last) return false;
  // Check if the last assistant message is complete (not still streaming)
  // A message is "done" when it has content and is_streaming is not true
  return last.content && last.content.trim().length > 0 && !last.is_streaming;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const message = body.message || body.text || body.content || body.input || body.query || body.prompt;
    const conversation_id = body.conversation_id || body.conversationId || body.session_id || body.sessionId;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      console.log('Received body keys:', Object.keys(body));
      return Response.json({ error: 'message is required', received_keys: Object.keys(body) }, { status: 400 });
    }

    console.log(`Super-agent proxy request: "${message.substring(0, 100)}"${conversation_id ? `, conv=${conversation_id}` : ''}`);

    // Get or create conversation
    let conversation;
    if (conversation_id) {
      try {
        conversation = await base44.asServiceRole.agents.getConversation(conversation_id);
        console.log(`Reusing conversation: ${conversation_id}`);
      } catch (e) {
        console.warn(`Conversation ${conversation_id} not found, creating new`);
      }
    }

    if (!conversation) {
      conversation = await base44.asServiceRole.agents.createConversation({
        agent_name: AGENT_NAME,
        metadata: {
          name: 'Super-Agent Session',
          description: 'שיחה מהסופר-אג׳נט החיצוני'
        }
      });
      console.log(`Created new conversation: ${conversation.id}`);
    }

    const convId = conversation.id;

    // Send message
    await base44.asServiceRole.agents.addMessage(conversation, {
      role: 'user',
      content: message.trim()
    });

    // Poll until agent finishes responding
    const startTime = Date.now();
    let lastMessageCount = (conversation.messages || []).length;
    let reply = '';

    while (Date.now() - startTime < MAX_WAIT_MS) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

      const updated = await base44.asServiceRole.agents.getConversation(convId);
      const messages = updated.messages || [];

      // New messages appeared
      if (messages.length > lastMessageCount || isAgentDoneStreaming(messages)) {
        const lastAssistant = getLastAssistantMessage(messages);
        if (lastAssistant && lastAssistant.content && lastAssistant.content.trim().length > 0) {
          // If still streaming, wait more
          if (lastAssistant.is_streaming) {
            lastMessageCount = messages.length;
            continue;
          }
          reply = lastAssistant.content.trim();
          console.log(`Got reply after ${Date.now() - startTime}ms: "${reply.substring(0, 100)}..."`);
          break;
        }
        lastMessageCount = messages.length;
      }
    }

    if (!reply) {
      console.warn(`No reply received after ${MAX_WAIT_MS}ms`);
      return Response.json({
        reply: 'הסוכן לא הצליח לענות בזמן. נסה שוב.',
        conversation_id: convId
      });
    }

    return Response.json({ reply, conversation_id: convId });

  } catch (error) {
    console.error('superAgentPandiProxy error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});