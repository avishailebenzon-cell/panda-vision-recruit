import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      deal_name,
      pipeline_id,
      stage_id,
      person_name,
      person_email,
      person_phone,
      org_name,
      job_title,
      job_description,
      job_qualifications,
      job_location,
      security_clearance,
      job_id
    } = body;

    const PIPEDRIVE_API_KEY = Deno.env.get('PIPEDRIVE_API_KEY');
    if (!PIPEDRIVE_API_KEY) {
      return Response.json({ error: 'Pipedrive API key not configured' }, { status: 500 });
    }

    const PIPEDRIVE_BASE_URL = 'https://api.pipedrive.com/v1';

    // Step 1: Find or create organization
    let orgId = null;
    if (org_name) {
      // Search for existing organization
      const orgSearchRes = await fetch(
        `${PIPEDRIVE_BASE_URL}/organizations/search?term=${encodeURIComponent(org_name)}&api_token=${PIPEDRIVE_API_KEY}`
      );
      const orgSearchData = await orgSearchRes.json();
      
      if (orgSearchData.data?.items?.length > 0) {
        orgId = orgSearchData.data.items[0].item.id;
      } else {
        // Create new organization
        const createOrgRes = await fetch(
          `${PIPEDRIVE_BASE_URL}/organizations?api_token=${PIPEDRIVE_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: org_name })
          }
        );
        const createOrgData = await createOrgRes.json();
        if (createOrgData.success) {
          orgId = createOrgData.data.id;
        }
      }
    }

    // Step 2: Find or create person
    let personId = null;
    let createdNewPerson = false;
    
    if (person_name) {
      // Check if contact person exists in our system and needs to be created in Pipedrive
      let shouldCreateInPipedrive = false;
      let contactPerson = null;
      
      if (job_id) {
        // Get the job to find contact person details
        const jobs = await base44.asServiceRole.entities.Job.filter({ id: job_id });
        if (jobs.length > 0) {
          const job = jobs[0];
          
          // Find contact person in our system
          const contacts = await base44.asServiceRole.entities.ContactPerson.filter({
            name: person_name,
            client_id: job.client_id
          });
          
          if (contacts.length > 0) {
            contactPerson = contacts[0];
            // Check if this is a manual contact created today (same day as job update)
            const contactDate = new Date(contactPerson.updated_date || contactPerson.created_date);
            const jobDate = new Date(job.updated_date);
            const isSameDay = contactDate.toDateString() === jobDate.toDateString();
            
            if (contactPerson.source === 'manual' && !contactPerson.pipedrive_person_id && isSameDay) {
              shouldCreateInPipedrive = true;
            }
          }
        }
      }
      
      // Search for existing person in Pipedrive
      const personSearchRes = await fetch(
        `${PIPEDRIVE_BASE_URL}/persons/search?term=${encodeURIComponent(person_name)}&api_token=${PIPEDRIVE_API_KEY}`
      );
      const personSearchData = await personSearchRes.json();
      
      if (personSearchData.data?.items?.length > 0 && !shouldCreateInPipedrive) {
        personId = personSearchData.data.items[0].item.id;
      } else {
        // Create new person in Pipedrive
        const personPayload = { 
          name: person_name,
          org_id: orgId
        };
        
        // Add email and phone if available
        if (person_email) {
          personPayload.email = [{ value: person_email, primary: true }];
        } else if (contactPerson?.email) {
          personPayload.email = [{ value: contactPerson.email, primary: true }];
        }
        
        if (person_phone) {
          personPayload.phone = [{ value: person_phone, primary: true }];
        } else if (contactPerson?.phone) {
          personPayload.phone = [{ value: contactPerson.phone, primary: true }];
        }
        
        const createPersonRes = await fetch(
          `${PIPEDRIVE_BASE_URL}/persons?api_token=${PIPEDRIVE_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(personPayload)
          }
        );
        const createPersonData = await createPersonRes.json();
        if (createPersonData.success) {
          personId = createPersonData.data.id;
          createdNewPerson = true;
          
          // Update the contact person in our system with Pipedrive ID
          if (contactPerson) {
            await base44.asServiceRole.entities.ContactPerson.update(contactPerson.id, {
              pipedrive_person_id: personId.toString()
            });
          }
        }
      }
    }

    // Step 3: Get pipelines and stages if not provided
    let finalPipelineId = pipeline_id;
    let finalStageId = stage_id;
    
    if (!finalPipelineId || !finalStageId) {
      const pipelinesRes = await fetch(
        `${PIPEDRIVE_BASE_URL}/pipelines?api_token=${PIPEDRIVE_API_KEY}`
      );
      const pipelinesData = await pipelinesRes.json();
      
      if (pipelinesData.data?.length > 0) {
        // Use first pipeline if not specified
        finalPipelineId = finalPipelineId || pipelinesData.data[0].id;
        
        // Get stages for the pipeline
        const stagesRes = await fetch(
          `${PIPEDRIVE_BASE_URL}/stages?pipeline_id=${finalPipelineId}&api_token=${PIPEDRIVE_API_KEY}`
        );
        const stagesData = await stagesRes.json();
        
        if (stagesData.data?.length > 0) {
          // Use first stage (new deals always start at first stage)
          finalStageId = stagesData.data[0].id;
        }
      }
    }

    // Step 4: Get custom fields mapping
    const dealFieldsRes = await fetch(
      `${PIPEDRIVE_BASE_URL}/dealFields?api_token=${PIPEDRIVE_API_KEY}`
    );
    const dealFieldsData = await dealFieldsRes.json();
    
    // Find custom field keys
    const customFields = {};
    if (dealFieldsData.data) {
      for (const field of dealFieldsData.data) {
        const fieldName = field.name.toLowerCase();
        if (fieldName.includes('job title') || fieldName.includes('שם משרה')) {
          customFields.job_title = field.key;
        } else if (fieldName.includes('job description') || fieldName.includes('תיאור משרה') || fieldName.includes('תאור משרה')) {
          customFields.job_description = field.key;
        } else if (fieldName.includes('qualification') || fieldName.includes('דרישות')) {
          customFields.job_qualifications = field.key;
        } else if (fieldName.includes('location') || fieldName.includes('מיקום')) {
          customFields.job_location = field.key;
        } else if (fieldName.includes('security') || fieldName.includes('סיווג') || fieldName.includes('ביטחוני')) {
          customFields.security_clearance = field.key;
        }
      }
    }

    // Step 5: Create the deal
    const dealData = {
      title: deal_name || `משרה חדשה - ${job_title || org_name}`,
      pipeline_id: finalPipelineId,
      stage_id: finalStageId,
      org_id: orgId,
      person_id: personId
    };

    // Add custom fields if found
    if (customFields.job_title && job_title) {
      dealData[customFields.job_title] = job_title;
    }
    if (customFields.job_description && job_description) {
      dealData[customFields.job_description] = job_description;
    }
    if (customFields.job_qualifications && job_qualifications) {
      dealData[customFields.job_qualifications] = job_qualifications;
    }
    if (customFields.job_location && job_location) {
      dealData[customFields.job_location] = job_location;
    }
    if (customFields.security_clearance && security_clearance) {
      dealData[customFields.security_clearance] = security_clearance;
    }

    const createDealRes = await fetch(
      `${PIPEDRIVE_BASE_URL}/deals?api_token=${PIPEDRIVE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dealData)
      }
    );
    const createDealData = await createDealRes.json();

    if (!createDealData.success) {
      return Response.json({ 
        error: 'Failed to create deal in Pipedrive',
        details: createDealData 
      }, { status: 400 });
    }

    // Step 6: Add a note with full job details
    const noteContent = `
📋 פרטי משרה חדשה

🏢 ארגון: ${org_name || 'לא צוין'}
👤 איש קשר: ${person_name || 'לא צוין'}
📧 אימייל: ${person_email || 'לא צוין'}
📞 טלפון: ${person_phone || 'לא צוין'}

💼 שם המשרה: ${job_title || 'לא צוין'}

📝 תיאור המשרה:
${job_description || 'לא צוין'}

✅ דרישות התפקיד:
${job_qualifications || 'לא צוין'}

📍 מיקום: ${job_location || 'לא צוין'}
🔒 סיווג ביטחוני: ${security_clearance || 'לא צוין'}

---
נוצר אוטומטית על ידי דנה - סוכנת AI
${new Date().toLocaleString('he-IL')}
    `.trim();

    await fetch(
      `${PIPEDRIVE_BASE_URL}/notes?api_token=${PIPEDRIVE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deal_id: createDealData.data.id,
          content: noteContent
        })
      }
    );

    return Response.json({
      success: true,
      deal_id: createDealData.data.id,
      person_id: personId,
      created_new_person: createdNewPerson,
      deal_url: `https://pandatech.pipedrive.com/deal/${createDealData.data.id}`,
      message: `הדיל "${deal_name || job_title}" נוצר בהצלחה בפייפדרייב!${createdNewPerson ? ' (כולל איש קשר חדש)' : ''}`
    });

  } catch (error) {
    console.error('Error creating Pipedrive deal:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});