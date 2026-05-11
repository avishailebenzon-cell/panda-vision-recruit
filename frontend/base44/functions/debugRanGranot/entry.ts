import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const PIPEDRIVE_API_KEY = Deno.env.get('PIPEDRIVE_API_KEY');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!PIPEDRIVE_API_KEY) {
      return Response.json({ error: 'PIPEDRIVE_API_KEY not configured' }, { status: 500 });
    }

    console.log('🔍 Searching for רן גרנות in Pipedrive...');
    
    // Get person ID 459 directly
    const personUrl = `https://api.pipedrive.com/v1/persons/459?api_token=${PIPEDRIVE_API_KEY}`;
    const personResponse = await fetch(personUrl);
    
    if (!personResponse.ok) {
      return Response.json({ error: `Failed to fetch person: ${personResponse.status}` }, { status: 500 });
    }
    
    const personData = await personResponse.json();
    console.log('📋 Full Pipedrive data for person 459:');
    console.log(JSON.stringify(personData, null, 2));
    
    // Get all person fields to understand structure
    const fieldsUrl = `https://api.pipedrive.com/v1/personFields?api_token=${PIPEDRIVE_API_KEY}`;
    const fieldsResponse = await fetch(fieldsUrl);
    const fieldsData = await fieldsResponse.json();
    
    const professionalField = fieldsData.data?.find(f => f.name === 'תחום מקצועי');
    const statusField = fieldsData.data?.find(f => f.key === 'ab0c233f11f664275203977ddd33194795e485b2');
    
    console.log('📊 Field configurations:');
    console.log('Professional field:', JSON.stringify(professionalField, null, 2));
    console.log('Status field:', JSON.stringify(statusField, null, 2));
    
    // Check current data in our system
    const contacts = await base44.asServiceRole.entities.ContactPerson.filter({ 
      pipedrive_person_id: '459' 
    });
    
    console.log('💾 Current data in our system:');
    console.log(JSON.stringify(contacts, null, 2));
    
    return Response.json({
      pipedrive_data: personData,
      professional_field_config: professionalField,
      status_field_config: statusField,
      our_system_data: contacts
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});