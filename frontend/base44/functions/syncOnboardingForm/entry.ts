import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  // Google Sheets integration disabled - not in use
  return Response.json({ disabled: true, message: 'אינטגרציה עם Google Sheets מושבתת' });
});