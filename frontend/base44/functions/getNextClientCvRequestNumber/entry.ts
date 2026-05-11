import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get the most recent request with a request_number
    const recentRequests = await base44.asServiceRole.entities.ClientCvRequest.list('-created_date', 1);
    
    let nextNumber = 1;
    
    if (recentRequests && recentRequests.length > 0 && recentRequests[0].request_number) {
      const lastNumber = recentRequests[0].request_number;
      const match = lastNumber.match(/MC-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    
    const requestNumber = `MC-${String(nextNumber).padStart(4, '0')}`;
    
    return Response.json({
      requestNumber,
      nextNumber
    });
    
  } catch (error) {
    console.error('Error getting next request number:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});