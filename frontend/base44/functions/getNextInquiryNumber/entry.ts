import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const recentInquiries = await base44.asServiceRole.entities.AgentInquiry.list('-created_date', 1);
    
    let nextNumber = 1;
    
    if (recentInquiries && recentInquiries.length > 0 && recentInquiries[0].inquiry_number) {
      const lastNumber = recentInquiries[0].inquiry_number;
      const match = lastNumber.match(/INQ-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    
    const inquiryNumber = `INQ-${String(nextNumber).padStart(5, '0')}`;
    
    return Response.json({
      inquiryNumber,
      nextNumber
    });
    
  } catch (error) {
    console.error('Error getting next inquiry number:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});