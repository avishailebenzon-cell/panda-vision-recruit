import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { task_id } = body;

    if (!task_id) {
      return Response.json({ error: 'task_id required' }, { status: 400 });
    }

    // Get the task
    const task = await base44.asServiceRole.entities.RotemTask.get(task_id);
    
    if (!task) {
      return Response.json({ error: 'Task not found' }, { status: 404 });
    }

    const instanceId = Deno.env.get('GREEN_API_INSTANCE_ID');
    const apiToken = Deno.env.get('GREEN_API_TOKEN');

    if (!instanceId || !apiToken) {
      return Response.json({ error: 'Green API not configured' }, { status: 500 });
    }

    // Clean phone number
    const originalPhone = task.candidate_phone;
    let cleanPhone = originalPhone.replace(/[^\d]/g, '');
    if (cleanPhone.startsWith('972')) cleanPhone = '0' + cleanPhone.substring(3);

    // Convert to Green API format
    let phoneForGreenApi = cleanPhone;
    if (cleanPhone.startsWith('0')) {
      phoneForGreenApi = '972' + cleanPhone.substring(1);
    }
    const chatId = `${phoneForGreenApi}@c.us`;

    const testMessage = `בדיקת מערכת - ${new Date().toLocaleTimeString('he-IL')}`;

    console.log('=== Phone Conversion Debug ===');
    console.log('Original:', originalPhone);
    console.log('Cleaned:', cleanPhone);
    console.log('Green API format:', phoneForGreenApi);
    console.log('Chat ID:', chatId);

    // Try to send
    const sendUrl = `https://api.green-api.com/waInstance${instanceId}/sendMessage/${apiToken}`;
    
    const sendResponse = await fetch(sendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: chatId,
        message: testMessage
      })
    });

    const sendResult = await sendResponse.json();

    return Response.json({
      debug: {
        original_phone: originalPhone,
        cleaned_phone: cleanPhone,
        green_api_phone: phoneForGreenApi,
        chat_id: chatId
      },
      green_api_response: sendResult,
      success: !!sendResult.idMessage,
      message_id: sendResult.idMessage || null
    });

  } catch (error) {
    console.error('Test error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});