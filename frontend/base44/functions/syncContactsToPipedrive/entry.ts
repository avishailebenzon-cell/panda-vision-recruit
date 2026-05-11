import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const PIPEDRIVE_API_KEY = Deno.env.get('PIPEDRIVE_API_KEY');

// Helper to retry failed API calls (502, 503, 504)
async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // Success - return immediately
      if (response.ok) {
        return response;
      }
      
      // Check for transient server errors
      if (response.status === 502 || response.status === 503 || response.status === 504 || response.status === 429) {
        const waitTime = attempt * 2000; // 2s, 4s, 6s
        console.log(`Pipedrive returned ${response.status}, retrying in ${waitTime/1000}s (attempt ${attempt}/${maxRetries})...`);
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
      }
      
      // Other errors - throw immediately
      const errorText = await response.text();
      throw new Error(`Pipedrive API error (${response.status}): ${errorText.substring(0, 200)}`);
      
    } catch (fetchError) {
      // Network errors
      if (attempt < maxRetries && (fetchError.message.includes('fetch') || fetchError.message.includes('network'))) {
        const waitTime = attempt * 2000;
        console.log(`Network error, retrying in ${waitTime/1000}s (attempt ${attempt}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      throw fetchError;
    }
  }
  
  throw new Error('Max retries reached');
}

async function fetchPersonFields() {
  const url = `https://api.pipedrive.com/v1/personFields?api_token=${PIPEDRIVE_API_KEY}`;
  const response = await fetchWithRetry(url);
  const data = await response.json();
  return data.success ? data.data : [];
}

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

    console.log('Starting ContactPerson to Pipedrive sync...');
    
    // Fetch person fields to find job title field
    console.log('Fetching person fields from Pipedrive...');
    const personFields = await fetchPersonFields();
    console.log(`Found ${personFields.length} person fields`);
    
    // Find the job title field key
    let jobTitleFieldKey = null;
    for (const field of personFields) {
      const fieldNameLower = field.name?.toLowerCase().trim();
      if (fieldNameLower === 'job title' || fieldNameLower === 'title' || fieldNameLower.includes('תפקיד')) {
        jobTitleFieldKey = field.key;
        console.log(`Found job title field: ${field.name} = ${field.key}`);
        break;
      }
    }
    
    if (!jobTitleFieldKey) {
      console.log('Warning: Could not find job title field in Pipedrive');
    }

    // Find contacts that don't have pipedrive_person_id yet and were created manually
    const contactsToSync = await base44.asServiceRole.entities.ContactPerson.filter({
      source: 'manual',
      pipedrive_person_id: null
    });

    console.log(`Found ${contactsToSync.length} contacts to sync to Pipedrive`);

    let synced = 0;
    let failed = 0;
    const syncResults = [];

    for (const contact of contactsToSync) {
      try {
        // Get the client/organization
        const client = await base44.asServiceRole.entities.Client.get(contact.client_id);
        
        if (!client) {
          console.log(`Skipping contact "${contact.name}" - client not found`);
          failed++;
          continue;
        }

        // Find or create organization in Pipedrive
        let orgId = null;
        
        if (client.pipedrive_org_id) {
          orgId = client.pipedrive_org_id;
          console.log(`Using existing Pipedrive org ID: ${orgId} for ${client.name}`);
        } else {
          // Search for org in Pipedrive (with retry)
          const orgSearchRes = await fetchWithRetry(
            `https://api.pipedrive.com/v1/organizations/search?term=${encodeURIComponent(client.name)}&api_token=${PIPEDRIVE_API_KEY}`
          );
          const orgSearchData = await orgSearchRes.json();

          if (orgSearchData.data?.items?.length > 0) {
            orgId = orgSearchData.data.items[0].item.id;
            // Update client with Pipedrive org ID
            await base44.asServiceRole.entities.Client.update(client.id, {
              pipedrive_org_id: String(orgId)
            });
            console.log(`Found org in Pipedrive: ${client.name} (ID: ${orgId})`);
          } else {
            // Create new organization in Pipedrive (with retry)
            const createOrgRes = await fetchWithRetry(
              `https://api.pipedrive.com/v1/organizations?api_token=${PIPEDRIVE_API_KEY}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: client.name })
              }
            );
            const createOrgData = await createOrgRes.json();

            if (createOrgData.success) {
              orgId = createOrgData.data.id;
              // Update client with new Pipedrive org ID
              await base44.asServiceRole.entities.Client.update(client.id, {
                pipedrive_org_id: String(orgId)
              });
              console.log(`Created org in Pipedrive: ${client.name} (ID: ${orgId})`);
            }
          }
        }

        if (!orgId) {
          console.log(`Failed to get org ID for contact "${contact.name}"`);
          failed++;
          continue;
        }

        // Search for person in Pipedrive (with retry)
        const personSearchRes = await fetchWithRetry(
          `https://api.pipedrive.com/v1/persons/search?term=${encodeURIComponent(contact.name)}&org_id=${orgId}&api_token=${PIPEDRIVE_API_KEY}`
        );
        const personSearchData = await personSearchRes.json();

        let personId = null;

        if (personSearchData.data?.items?.length > 0) {
          // Person already exists
          personId = personSearchData.data.items[0].item.id;
          console.log(`Contact already exists in Pipedrive: ${contact.name} (ID: ${personId})`);
        } else {
          // Create new person in Pipedrive
          const createPersonData = {
            name: contact.name,
            org_id: orgId
          };

          if (contact.email) {
            createPersonData.email = [{ value: contact.email, primary: true }];
          }
          if (contact.phone) {
            createPersonData.phone = [{ value: contact.phone, primary: true }];
          }
          
          // Add job title/role if available
          if (contact.role && jobTitleFieldKey) {
            createPersonData[jobTitleFieldKey] = contact.role;
            console.log(`Adding job title: ${contact.role}`);
          }

          const createPersonRes = await fetchWithRetry(
            `https://api.pipedrive.com/v1/persons?api_token=${PIPEDRIVE_API_KEY}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(createPersonData)
            }
          );
          const createPersonResult = await createPersonRes.json();

          if (createPersonResult.success) {
            personId = createPersonResult.data.id;
            console.log(`Created contact in Pipedrive: ${contact.name} (ID: ${personId})`);
          }
        }

        if (personId) {
          // Update contact with Pipedrive person ID
          await base44.asServiceRole.entities.ContactPerson.update(contact.id, {
            pipedrive_person_id: String(personId),
            source: 'pipedrive'
          });
          synced++;
          syncResults.push({
            name: contact.name,
            client: client.name,
            pipedrive_person_id: personId
          });
        } else {
          failed++;
        }

        // Rate limiting delay
        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (error) {
        console.error(`Error syncing contact "${contact.name}":`, error);
        failed++;
      }
    }

    const summary = {
      success: true,
      contactsFound: contactsToSync.length,
      synced,
      failed,
      syncResults
    };

    console.log('Contact sync completed:', summary);

    // Log activity
    try {
      await base44.asServiceRole.entities.SystemActivityLog.create({
        actor_type: 'system',
        actor_name: 'pipedrive',
        action_type: 'pipedrive_sync',
        action_description: `סינכרון אנשי קשר: ${synced} הועלו ל-Pipedrive`,
        status: 'success',
        details: JSON.stringify(summary)
      });
    } catch (logErr) {
      console.warn('Failed to log activity:', logErr.message);
    }

    return Response.json(summary);

  } catch (error) {
    console.error('Contact sync error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});