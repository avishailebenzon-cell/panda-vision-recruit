import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204 });
    }

    try {
        const base44 = createClientFromRequest(req);
        
        // Get or create the counter record
        const counters = await base44.entities.MessageCounter.filter({ counter_type: 'outgoing_message' });
        
        let counter;
        let nextNumber;
        
        if (counters.length === 0) {
            // Create the first counter
            counter = await base44.entities.MessageCounter.create({
                counter_type: 'outgoing_message',
                last_number: 1
            });
            nextNumber = 1;
        } else {
            counter = counters[0];
            nextNumber = (counter.last_number || 0) + 1;
            
            // Update the counter
            await base44.entities.MessageCounter.update(counter.id, {
                last_number: nextNumber
            });
        }
        
        // Format the message number as MSG-XXXXX (5 digits with leading zeros)
        const messageNumber = `MSG-${String(nextNumber).padStart(5, '0')}`;
        
        return Response.json({ 
            success: true, 
            messageNumber,
            numericValue: nextNumber
        });
        
    } catch (error) {
        console.error('Error getting next message number:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});