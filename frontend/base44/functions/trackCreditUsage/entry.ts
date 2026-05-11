import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { action_type, credits_used, description, page_context, model_used } = await req.json();

  await base44.entities.CreditLog.create({
    user_id: user.id,
    user_name: user.full_name,
    user_email: user.email,
    action_type: action_type || 'unknown',
    model_used: model_used || null,
    credits_used: credits_used || 1,
    description: description || null,
    page_context: page_context || null,
  });

  return Response.json({ success: true });
});