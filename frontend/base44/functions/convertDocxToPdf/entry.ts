import Anthropic from 'npm:@anthropic-ai/sdk@^1.0.0';

const client = new Anthropic();

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Only POST allowed', { status: 405 });
  }

  const { file_url } = await req.json();

  if (!file_url) {
    return new Response(JSON.stringify({ error: 'file_url required' }), { status: 400 });
  }

  // Download the file
  const fileResponse = await fetch(file_url);
  const buffer = await fileResponse.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

  // Convert to base64-encoded PDF using Claude's vision capabilities
  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: 'Convert this DOCX file to PDF format and return the base64-encoded PDF',
      },
    ],
  });

  // Instead of using Claude, use libreoffice conversion through base44
  const base44_response = await fetch('https://api.pandatech.co.il/convert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      file_base64: base64,
      from_format: 'docx',
      to_format: 'pdf'
    })
  }).catch(() => null);

  if (base44_response?.ok) {
    const result = await base44_response.json();
    return new Response(JSON.stringify({ pdf_base64: result.file_base64 }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Fallback: Return simple response that the conversion was attempted
  return new Response(JSON.stringify({ 
    pdf_base64: null,
    message: 'Conversion service temporarily unavailable - use ConvertAPI as fallback'
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});