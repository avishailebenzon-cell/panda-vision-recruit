import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const PIPEDRIVE_API_KEY = Deno.env.get('PIPEDRIVE_API_KEY');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const res = await fetch(`https://api.pipedrive.com/v1/activityTypes?api_token=${PIPEDRIVE_API_KEY}`);
    const data = await res.json();

    if (!data.success) {
      return Response.json({ error: 'Pipedrive API error', details: data }, { status: 500 });
    }

    const types = data.data.map(t => ({
      id: t.id,
      key: t.key_string,
      name: t.name,
      icon_key: t.icon_key,
      active: t.active_flag,
      is_custom: t.is_custom_flag
    }));

    return Response.json({ success: true, activity_types: types });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});