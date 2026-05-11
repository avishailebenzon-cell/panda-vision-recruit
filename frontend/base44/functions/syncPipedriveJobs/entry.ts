import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const PIPEDRIVE_API_KEY = Deno.env.get('PIPEDRIVE_API_KEY');

async function fetchDealFields() {
    const url = `https://api.pipedrive.com/v1/dealFields?api_token=${PIPEDRIVE_API_KEY}`;
    const response = await fetch(url);
    
    if (!response.ok) {
        throw new Error(`Pipedrive API error fetching deal fields: ${response.status}`);
    }
    
    const data = await response.json();
    return data.success ? data.data : [];
}

async function fetchOpenDeals(includeAllFields = true) {
    const deals = [];
    let start = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
        const url = `https://api.pipedrive.com/v1/deals?api_token=${PIPEDRIVE_API_KEY}&status=open&start=${start}&limit=${limit}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Pipedrive API error fetching deals: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.data) {
            deals.push(...data.data);
            hasMore = data.additional_data?.pagination?.more_items_in_collection || false;
            start += limit;
            console.log(`Fetched ${deals.length} open deals so far...`);
        } else {
            hasMore = false;
        }
    }
    
    return deals;
}

async function fetchAllDealsWithStatus(status) {
    const deals = [];
    let start = 0;
    const limit = 500;
    let hasMore = true;

    while (hasMore) {
        const url = `https://api.pipedrive.com/v1/deals?api_token=${PIPEDRIVE_API_KEY}&status=${status}&start=${start}&limit=${limit}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Pipedrive API error fetching ${status} deals: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.data) {
            deals.push(...data.data);
            hasMore = data.additional_data?.pagination?.more_items_in_collection || false;
            start += limit;
        } else {
            hasMore = false;
        }
    }
    
    return deals;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204 });
    }

    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!PIPEDRIVE_API_KEY) {
            return Response.json({ error: 'PIPEDRIVE_API_KEY not configured' }, { status: 500 });
        }

        console.log('Starting Pipedrive Jobs sync...');
        
        // Fetch deal fields to find custom field keys
        console.log('Fetching deal fields from Pipedrive...');
        const dealFields = await fetchDealFields();
        console.log(`Found ${dealFields.length} deal fields`);
        
        // Find the custom field keys by name
        const fieldMapping = {};
        const targetFields = ['Job Title', 'job description', 'job qualifications', 'Job Location', 'jobs security clearance', 'deadline', 'עדיפות'];
        
        for (const field of dealFields) {
            const fieldNameLower = field.name?.toLowerCase().trim();
            
            if (fieldNameLower === 'job title') {
                fieldMapping.jobTitle = field.key;
            } else if (fieldNameLower === 'job description') {
                fieldMapping.jobDescription = field.key;
            } else if (fieldNameLower === 'job qualifications') {
                fieldMapping.jobQualifications = field.key;
            } else if (fieldNameLower === 'job location') {
                fieldMapping.jobLocation = field.key;
            } else if (fieldNameLower === 'jobs security clearance' || fieldNameLower === 'job security clearance') {
                fieldMapping.securityClearance = field.key;
            } else if (fieldNameLower === 'deadline' || fieldNameLower === 'dead line') {
                fieldMapping.deadline = field.key;
            } else if (fieldNameLower === 'עדיפות') {
                fieldMapping.priority = field.key;
            }
        }
        
        console.log('Field mapping found:', fieldMapping);
        
        if (!fieldMapping.jobTitle) {
            // Try to find with partial match
            for (const field of dealFields) {
                if (field.name?.toLowerCase().includes('job') && field.name?.toLowerCase().includes('title')) {
                    fieldMapping.jobTitle = field.key;
                    console.log(`Found job title field with partial match: ${field.name} = ${field.key}`);
                    break;
                }
            }
        }
        
        // Log all custom fields for debugging
        const customFields = dealFields.filter(f => f.edit_flag === true || f.key?.length > 20);
        console.log('Custom deal fields:', customFields.map(f => ({ key: f.key, name: f.name })));
        
        // Debug Label field options
        const labelField = dealFields.find(f => f.name?.toLowerCase() === 'label');
        if (labelField) {
            console.log('Label field details:', {
                key: labelField.key,
                name: labelField.name,
                field_type: labelField.field_type,
                options: labelField.options
            });
        }
        
        // Fetch all open deals
        console.log('Fetching open deals from Pipedrive...');
        const allDeals = await fetchOpenDeals();
        console.log(`Found ${allDeals.length} open deals total`);

        // Also fetch won, lost, and deleted deals to mark closed jobs
        console.log('Fetching closed deals (won/lost/deleted) from Pipedrive...');
        const wonDeals = await fetchAllDealsWithStatus('won');
        const lostDeals = await fetchAllDealsWithStatus('lost');
        const deletedDeals = await fetchAllDealsWithStatus('deleted');
        const closedDealIds = new Set([
            ...wonDeals.map(d => String(d.id)),
            ...lostDeals.map(d => String(d.id)),
            ...deletedDeals.map(d => String(d.id))
        ]);
        console.log(`Found ${closedDealIds.size} closed deals (${wonDeals.length} won, ${lostDeals.length} lost, ${deletedDeals.length} deleted)`);
        
        // Filter deals that have a Job Title
        const jobDeals = allDeals.filter(deal => {
            if (!fieldMapping.jobTitle) return false;
            const jobTitle = deal[fieldMapping.jobTitle];
            return jobTitle && String(jobTitle).trim().length > 0;
        });
        
        console.log(`Found ${jobDeals.length} deals with Job Title`);
        
        // Build set of valid deal IDs (deals that have job title)
        const validDealIds = new Set(jobDeals.map(d => String(d.id)));
        
        // Also add deals that are open but have NO job title (their job fields were cleared)
        const dealsWithClearedJobFields = allDeals.filter(deal => {
            if (!fieldMapping.jobTitle) return false;
            const jobTitle = deal[fieldMapping.jobTitle];
            return !jobTitle || String(jobTitle).trim().length === 0;
        });
        const clearedDealIds = new Set(dealsWithClearedJobFields.map(d => String(d.id)));
        console.log(`Found ${clearedDealIds.size} open deals with cleared job fields`);
        
        // Get existing jobs and clients
        const existingJobs = await base44.asServiceRole.entities.Job.list();
        const existingClients = await base44.asServiceRole.entities.Client.list();
        
        console.log(`Existing in system: ${existingJobs.length} jobs, ${existingClients.length} clients`);
        
        let jobsCreated = 0;
        let jobsUpdated = 0;
        let jobsSkipped = 0;
        let jobsClosed = 0;

        // First, mark existing jobs as closed if their deal is closed in Pipedrive OR job fields were cleared
        // AND delete all matches for closed jobs
        for (const existingJob of existingJobs) {
            if (existingJob.pipedrive_deal_id) {
                const shouldClose = closedDealIds.has(existingJob.pipedrive_deal_id) || 
                                    clearedDealIds.has(existingJob.pipedrive_deal_id);
                if (shouldClose && existingJob.status === 'פעילה') {
                    await base44.asServiceRole.entities.Job.update(existingJob.id, { status: 'סגורה' });
                    jobsClosed++;
                    const reason = closedDealIds.has(existingJob.pipedrive_deal_id) 
                        ? 'deal closed in Pipedrive' 
                        : 'job fields cleared in Pipedrive';
                    console.log(`Marked job "${existingJob.title}" as closed (${reason})`);
                    
                    // Delete all matches for this closed job
                    try {
                        const jobMatches = await base44.asServiceRole.entities.Match.filter({ job_id: existingJob.id });
                        for (const match of jobMatches) {
                            await base44.asServiceRole.entities.Match.delete(match.id);
                        }
                        if (jobMatches.length > 0) {
                            console.log(`Deleted ${jobMatches.length} matches for closed job "${existingJob.title}"`);
                        }
                    } catch (matchDeleteErr) {
                        console.error(`Error deleting matches for job ${existingJob.id}:`, matchDeleteErr);
                    }
                }
            }
        }

        // Map security clearance values
        const mapSecurityClearance = (value) => {
            if (!value) return null;
            const strValue = String(value).trim().toLowerCase();
            
            if (strValue.includes('רמה 1') || strValue.includes('level 1') || strValue === '1') return 'רמה 1';
            if (strValue.includes('רמה 2') || strValue.includes('level 2') || strValue === '2') return 'רמה 2';
            if (strValue.includes('רמה 3') || strValue.includes('level 3') || strValue === '3') return 'רמה 3';
            if (strValue.includes('נמוך') || strValue.includes('low')) return 'סווג נמוך';
            if (strValue.includes('ללא') || strValue.includes('none') || strValue.includes('no')) return 'ללא סווג';
            
            return null;
        };

        // Build priority options mapping from field definition
        const priorityField = dealFields.find(f => f.name?.trim() === 'עדיפות');
        const priorityOptionsMap = {};
        if (priorityField?.options) {
            for (const option of priorityField.options) {
                if (option.label && option.id !== undefined) {
                    priorityOptionsMap[option.id] = option.label;
                }
            }
            console.log('Priority field options mapping:', priorityOptionsMap);
        }
        
        // Map recruitment priority from Pipedrive עדיפות field
        const mapRecruitmentPriority = (priorityValue) => {
            if (!priorityValue) return null;
            
            // If priorityValue is a number/ID, map it to the option text
            let priorityText = priorityValue;
            if (priorityOptionsMap[priorityValue]) {
                priorityText = priorityOptionsMap[priorityValue];
            }
            
            const strValue = String(priorityText).trim();
            
            // Return exact value match
            if (strValue === 'עדיפות גיוס 1') return 'עדיפות גיוס 1';
            if (strValue === 'עדיפות גיוס 2') return 'עדיפות גיוס 2';
            if (strValue === 'עדיפות גיוס 3') return 'עדיפות גיוס 3';
            if (strValue === 'עדיפות גיוס 4') return 'עדיפות גיוס 4';
            if (strValue === 'עדיפות גיוס 5') return 'עדיפות גיוס 5';
            
            return null;
        };

        // Debug priority field in first 5 deals
        console.log('🔍 Priority field check:');
        for (let i = 0; i < Math.min(5, jobDeals.length); i++) {
            const deal = jobDeals[i];
            const jobTitle = deal[fieldMapping.jobTitle];
            const priorityRaw = fieldMapping.priority ? deal[fieldMapping.priority] : null;
            const mappedPriority = mapRecruitmentPriority(priorityRaw);
            console.log(`Deal "${jobTitle}": priority field=${priorityRaw}, mapped to: ${mappedPriority}`);
        }
        
        // Process each job deal
        let debugCount = 0;
        for (const deal of jobDeals) {
            const dealId = String(deal.id);
            const jobTitle = deal[fieldMapping.jobTitle];
            
            if (!jobTitle) {
                jobsSkipped++;
                continue;
            }
            
            // Get values from custom fields
            const jobDescription = fieldMapping.jobDescription ? deal[fieldMapping.jobDescription] : null;
            const jobQualifications = fieldMapping.jobQualifications ? deal[fieldMapping.jobQualifications] : null;
            const jobLocation = fieldMapping.jobLocation ? deal[fieldMapping.jobLocation] : null;
            const securityClearanceRaw = fieldMapping.securityClearance ? deal[fieldMapping.securityClearance] : null;
            const securityClearance = mapSecurityClearance(securityClearanceRaw);
            const deadline = fieldMapping.deadline ? deal[fieldMapping.deadline] : null;
            // Get priority from custom עדיפות field
            const priorityRaw = fieldMapping.priority ? deal[fieldMapping.priority] : null;
            const recruitmentPriority = mapRecruitmentPriority(priorityRaw);
            
            // Get organization info
            const orgName = deal.org_name || deal.organization?.name || null;
            const orgId = deal.org_id?.value || deal.org_id || null;
            
            // Get contact person
            const personName = deal.person_name || deal.person_id?.name || null;
            
            // Find matching client in our system
            let clientId = null;
            if (orgId) {
                const matchingClient = existingClients.find(c => c.pipedrive_org_id === String(orgId));
                if (matchingClient) {
                    clientId = matchingClient.id;
                }
            }
            if (!clientId && orgName) {
                const matchingClient = existingClients.find(c => 
                    c.name?.toLowerCase().trim() === orgName.toLowerCase().trim()
                );
                if (matchingClient) {
                    clientId = matchingClient.id;
                }
            }
            
            // Check if job already exists by pipedrive_deal_id
            const existingJob = existingJobs.find(j => j.pipedrive_deal_id === dealId);
            
            // Build Pipedrive deal URL
            const pipedriveUrl = `https://pandatech.pipedrive.com/deal/${deal.id}`;
            
            // Get pipeline and stage names
            const pipelineName = deal.pipeline_id ? String(deal.pipeline_id) : '';
            const stageName = deal.stage_id ? String(deal.stage_id) : '';
            
            const jobData = {
                title: String(jobTitle).trim(),
                description: jobDescription ? String(jobDescription).trim() : '',
                requirements: jobQualifications ? String(jobQualifications).trim() : '',
                location: jobLocation ? String(jobLocation).trim() : '',
                client_name: orgName || '',
                contact_person: personName || '',
                pipedrive_deal_id: dealId,
                pipedrive_deal_url: pipedriveUrl,
                pipeline: pipelineName,
                stage: stageName,
                status: 'פעילה',
                recruitment_priority: recruitmentPriority || 'עדיפות גיוס 5'
            };
            
            if (clientId) {
                jobData.client_id = clientId;
            }
            
            if (securityClearance) {
                jobData.security_clearance = securityClearance;
            }
            
            if (deadline) {
                jobData.deadline = String(deadline).trim();
            }

            if (existingJob) {
                // Update existing job
                const updateData = {};
                
                if (jobData.title && existingJob.title !== jobData.title) {
                    updateData.title = jobData.title;
                }
                if (jobData.description && existingJob.description !== jobData.description) {
                    updateData.description = jobData.description;
                }
                if (jobData.requirements && existingJob.requirements !== jobData.requirements) {
                    updateData.requirements = jobData.requirements;
                }
                if (jobData.location && existingJob.location !== jobData.location) {
                    updateData.location = jobData.location;
                }
                if (jobData.client_name && existingJob.client_name !== jobData.client_name) {
                    updateData.client_name = jobData.client_name;
                }
                if (jobData.contact_person && existingJob.contact_person !== jobData.contact_person) {
                    updateData.contact_person = jobData.contact_person;
                }
                if (jobData.security_clearance && existingJob.security_clearance !== jobData.security_clearance) {
                    updateData.security_clearance = jobData.security_clearance;
                }
                if (clientId && existingJob.client_id !== clientId) {
                    updateData.client_id = clientId;
                }
                if (!existingJob.pipedrive_deal_url) {
                    updateData.pipedrive_deal_url = pipedriveUrl;
                }
                if (deadline && existingJob.deadline !== String(deadline).trim()) {
                    updateData.deadline = String(deadline).trim();
                }
                // ALWAYS update recruitment_priority from Pipedrive
                if (existingJob.recruitment_priority !== recruitmentPriority) {
                    updateData.recruitment_priority = recruitmentPriority;
                }
                
                // Always update pipeline and stage from Pipedrive
                const pipelineName = deal.pipeline_id ? String(deal.pipeline_id) : '';
                const stageName = deal.stage_id ? String(deal.stage_id) : '';
                if (existingJob.pipeline !== pipelineName) {
                    updateData.pipeline = pipelineName;
                }
                if (existingJob.stage !== stageName) {
                    updateData.stage = stageName;
                }
                
                if (Object.keys(updateData).length > 0) {
                    console.log(`🔄 Updating job "${jobTitle}":`, updateData);
                    await base44.asServiceRole.entities.Job.update(existingJob.id, updateData);
                    jobsUpdated++;
                    
                    // Create JobUpdateLog to notify relevant agent
                    try {
                        const changedFields = Object.keys(updateData);
                        const changeSummary = changedFields.map(field => {
                            if (field === 'title') return 'כותרת';
                            if (field === 'description') return 'תיאור';
                            if (field === 'requirements') return 'דרישות';
                            if (field === 'location') return 'מיקום';
                            if (field === 'security_clearance') return 'סיווג';
                            return field;
                        }).join(', ');
                        
                        await base44.asServiceRole.entities.JobUpdateLog.create({
                            job_id: existingJob.id,
                            job_title: jobTitle,
                            job_code: existingJob.job_code || dealId,
                            changed_fields: changedFields,
                            change_summary: `שינויים: ${changeSummary}`,
                            updated_by_user_id: 'pipedrive',
                            updated_by_user_name: 'Pipedrive Sync',
                            is_processed: false
                        });
                        
                        console.log(`📝 Created job update log for "${jobTitle}" - fields changed: ${changeSummary}`);
                    } catch (logErr) {
                        console.error(`Failed to create JobUpdateLog for job ${existingJob.id}:`, logErr);
                    }
                } else {
                    jobsSkipped++;
                }
            } else {
                // Create new job - need to ensure required fields
                if (!jobData.client_id) {
                    // Create a placeholder client if needed
                    if (orgName) {
                        const newClient = await base44.asServiceRole.entities.Client.create({
                            name: orgName,
                            pipedrive_org_id: orgId ? String(orgId) : undefined
                        });
                        jobData.client_id = newClient.id;
                        existingClients.push(newClient);
                    } else {
                        // Skip jobs without organization
                        console.log(`Skipping job "${jobTitle}" - no organization`);
                        jobsSkipped++;
                        continue;
                    }
                }
                
                // Ensure required fields have values
                if (!jobData.description) jobData.description = 'לא צוין';
                if (!jobData.requirements) jobData.requirements = 'לא צוין';
                
                // Use Pipedrive Deal ID as job code
                jobData.job_code = dealId;

                // Mark as high priority for Naama
                jobData.naama_priority = true;
                
                const newJob = await base44.asServiceRole.entities.Job.create(jobData);
                jobsCreated++;

                // Create inbox entry for new job
                await base44.asServiceRole.entities.NewJobInbox.create({
                    job_id: newJob.id,
                    job_title: newJob.title,
                    job_code: newJob.job_code,
                    client_name: newJob.client_name,
                    location: newJob.location,
                    security_clearance: newJob.security_clearance,
                    source: 'dropbox_auto',
                    is_viewed: false
                });
                
                console.log(`🔴 NEW JOB PRIORITY: "${newJob.title}" marked for Naama's immediate attention`);
            }

            // Small delay to avoid rate limiting
            if ((jobsCreated + jobsUpdated) % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        // ====================
        // REVERSE SYNC: Create Pipedrive deals for manual jobs
        // ====================
        console.log('Starting reverse sync: creating Pipedrive deals for manual jobs...');
        
        let manualJobsProcessed = 0;
        let manualJobsSynced = 0;
        let manualJobsFailed = 0;
        
        // Find manual jobs that haven't been synced to Pipedrive yet
        // IMPORTANT: Skip jobs that already have pipedrive_deal_id (they came FROM Pipedrive)
        const manualJobsToSync = existingJobs.filter(job => 
            job.source === 'manual' && 
            !job.synced_to_pipedrive && 
            !job.pipedrive_deal_id && 
            job.status === 'פעילה' &&
            !job.is_generic_job  // Skip generic jobs - they stay local only
        );
        
        console.log(`Found ${manualJobsToSync.length} manual jobs to sync to Pipedrive`);
        
        // Get pipelines to map pipeline names to IDs
        const pipelinesRes = await fetch(`https://api.pipedrive.com/v1/pipelines?api_token=${PIPEDRIVE_API_KEY}`);
        const pipelinesData = await pipelinesRes.json();
        const pipelines = pipelinesData.success ? pipelinesData.data : [];
        
        // Map pipeline names to IDs
        const pipelineMapping = {
            'גיוס מגזר רפאל': pipelines.find(p => p.name?.includes('רפאל'))?.id,
            'גיוס מגזר תע״א': pipelines.find(p => p.name?.includes('תע״א'))?.id,
            'גיוס מגזר ממשלה': pipelines.find(p => p.name?.includes('ממשלה'))?.id,
            'גיוס מגזר אזרחי': pipelines.find(p => p.name?.includes('אזרחי'))?.id
        };
        
        // Default pipeline if mapping fails
        const defaultPipelineId = pipelines[0]?.id;
        
        // Get all contact persons to sync with jobs
        const allContacts = await base44.asServiceRole.entities.ContactPerson.list();
        
        for (const job of manualJobsToSync) {
            manualJobsProcessed++;
            
            try {
                // Determine pipeline ID
                let pipelineId = pipelineMapping[job.pipeline] || defaultPipelineId;
                
                // Get stages for the pipeline
                const stagesRes = await fetch(`https://api.pipedrive.com/v1/stages?pipeline_id=${pipelineId}&api_token=${PIPEDRIVE_API_KEY}`);
                const stagesData = await stagesRes.json();
                const stages = stagesData.success ? stagesData.data : [];
                
                // Find the "נוצר קשר עם הלקוח" stage or use first stage
                let stageId = stages.find(s => s.name?.includes('נוצר קשר') || s.name?.includes('קשר'))?.id || stages[0]?.id;
                
                // Step 1: Find or create organization in Pipedrive
                let orgId = null;
                if (job.client_name) {
                    const matchingClient = existingClients.find(c => c.id === job.client_id);
                    if (matchingClient?.pipedrive_org_id) {
                        orgId = matchingClient.pipedrive_org_id;
                    } else {
                        // Search for org in Pipedrive
                        const orgSearchRes = await fetch(`https://api.pipedrive.com/v1/organizations/search?term=${encodeURIComponent(job.client_name)}&api_token=${PIPEDRIVE_API_KEY}`);
                        const orgSearchData = await orgSearchRes.json();
                        
                        if (orgSearchData.data?.items?.length > 0) {
                            orgId = orgSearchData.data.items[0].item.id;
                        } else {
                            // Create new organization
                            console.log(`Creating organization in Pipedrive: ${job.client_name}`);
                            const createOrgRes = await fetch(`https://api.pipedrive.com/v1/organizations?api_token=${PIPEDRIVE_API_KEY}`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ name: job.client_name })
                            });
                            const createOrgData = await createOrgRes.json();
                            if (createOrgData.success) {
                                orgId = createOrgData.data.id;
                                // Update client with Pipedrive org ID
                                if (matchingClient) {
                                    await base44.asServiceRole.entities.Client.update(matchingClient.id, {
                                        pipedrive_org_id: String(orgId)
                                    });
                                }
                                console.log(`Organization created in Pipedrive with ID: ${orgId}`);
                            }
                        }
                    }
                }
                
                // Step 2: Find or create contact person in Pipedrive (if job has contact_person)
                let personId = null;
                if (job.contact_person && orgId) {
                    // Find the contact in our system
                    const matchingContact = allContacts.find(c => 
                        c.client_id === job.client_id && 
                        c.name?.toLowerCase().trim() === job.contact_person?.toLowerCase().trim()
                    );
                    
                    if (matchingContact) {
                        // Check if contact already has pipedrive_person_id
                        if (matchingContact.pipedrive_person_id) {
                            personId = matchingContact.pipedrive_person_id;
                            console.log(`Contact person already synced: ${job.contact_person} (ID: ${personId})`);
                        } else {
                            // Search for person in Pipedrive
                            const personSearchRes = await fetch(`https://api.pipedrive.com/v1/persons/search?term=${encodeURIComponent(job.contact_person)}&org_id=${orgId}&api_token=${PIPEDRIVE_API_KEY}`);
                            const personSearchData = await personSearchRes.json();
                            
                            if (personSearchData.data?.items?.length > 0) {
                                personId = personSearchData.data.items[0].item.id;
                                // Update contact with Pipedrive person ID
                                await base44.asServiceRole.entities.ContactPerson.update(matchingContact.id, {
                                    pipedrive_person_id: String(personId)
                                });
                                console.log(`Contact person found in Pipedrive: ${job.contact_person} (ID: ${personId})`);
                            } else {
                                // Create new contact person in Pipedrive
                                console.log(`Creating contact person in Pipedrive: ${job.contact_person}`);
                                const createPersonData = {
                                    name: job.contact_person,
                                    org_id: orgId
                                };
                                
                                // Add email and phone if available
                                if (matchingContact.email) {
                                    createPersonData.email = [{ value: matchingContact.email, primary: true }];
                                }
                                if (matchingContact.phone) {
                                    createPersonData.phone = [{ value: matchingContact.phone, primary: true }];
                                }
                                
                                const createPersonRes = await fetch(`https://api.pipedrive.com/v1/persons?api_token=${PIPEDRIVE_API_KEY}`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(createPersonData)
                                });
                                const createPersonResult = await createPersonRes.json();
                                
                                if (createPersonResult.success) {
                                    personId = createPersonResult.data.id;
                                    // Update contact with Pipedrive person ID
                                    await base44.asServiceRole.entities.ContactPerson.update(matchingContact.id, {
                                        pipedrive_person_id: String(personId),
                                        source: 'pipedrive'
                                    });
                                    console.log(`Contact person created in Pipedrive with ID: ${personId}`);
                                }
                            }
                        }
                    }
                }
                
                // Step 3: Build deal data with org and person
                const dealData = {
                    title: `${job.job_code || 'JOB'} - ${job.title}`,
                    pipeline_id: pipelineId,
                    stage_id: stageId,
                    org_id: orgId,
                    person_id: personId
                };
                
                // Add custom job fields
                if (fieldMapping.jobTitle) {
                    dealData[fieldMapping.jobTitle] = job.title;
                }
                if (fieldMapping.jobDescription && job.description) {
                    dealData[fieldMapping.jobDescription] = job.description;
                }
                if (fieldMapping.jobQualifications && job.requirements) {
                    dealData[fieldMapping.jobQualifications] = job.requirements;
                }
                if (fieldMapping.jobLocation && job.location) {
                    dealData[fieldMapping.jobLocation] = job.location;
                }
                if (fieldMapping.securityClearance && job.security_clearance) {
                    dealData[fieldMapping.securityClearance] = job.security_clearance;
                }
                
                // Create deal in Pipedrive
                const createDealRes = await fetch(`https://api.pipedrive.com/v1/deals?api_token=${PIPEDRIVE_API_KEY}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dealData)
                });
                const createDealResult = await createDealRes.json();
                
                if (createDealResult.success) {
                    const newDealId = String(createDealResult.data.id);
                    const newDealUrl = `https://pandatech.pipedrive.com/deal/${newDealId}`;
                    
                    // Update job in our system
                    await base44.asServiceRole.entities.Job.update(job.id, {
                        job_code: newDealId,
                        pipedrive_deal_id: newDealId,
                        pipedrive_deal_url: newDealUrl,
                        source: 'pipedrive',
                        synced_to_pipedrive: true
                    });
                    
                    // Create inbox entry for newly synced manual job
                    await base44.asServiceRole.entities.NewJobInbox.create({
                        job_id: job.id,
                        job_title: job.title,
                        job_code: newDealId,
                        client_name: job.client_name,
                        location: job.location,
                        security_clearance: job.security_clearance,
                        source: 'manual_create',
                        is_viewed: false
                    });
                    
                    manualJobsSynced++;
                    console.log(`Created Pipedrive deal for job "${job.title}", Deal ID: ${newDealId}`);
                } else {
                    manualJobsFailed++;
                    console.error(`Failed to create deal for job "${job.title}":`, createDealResult);
                }
                
                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (jobError) {
                manualJobsFailed++;
                console.error(`Error syncing manual job "${job.title}" to Pipedrive:`, jobError);
            }
        }
        
        console.log(`Reverse sync completed: ${manualJobsSynced} jobs synced to Pipedrive, ${manualJobsFailed} failed`);

        const summary = {
            success: true,
            totalOpenDeals: allDeals.length,
            dealsWithJobTitle: jobDeals.length,
            jobsCreated,
            jobsUpdated,
            jobsSkipped,
            jobsClosed,
            manualJobsProcessed,
            manualJobsSynced,
            manualJobsFailed,
            fieldMapping
        };

        // Save sync status
        try {
            const existingStatus = await base44.asServiceRole.entities.PipedriveSyncStatus.filter({ sync_type: 'jobs' });
            const statusData = {
                sync_type: 'jobs',
                last_run_time: new Date().toISOString(),
                status: 'success',
                items_created: jobsCreated,
                items_updated: jobsUpdated
            };
            if (existingStatus.length > 0) {
                await base44.asServiceRole.entities.PipedriveSyncStatus.update(existingStatus[0].id, statusData);
            } else {
                await base44.asServiceRole.entities.PipedriveSyncStatus.create(statusData);
            }
        } catch (statusError) {
            console.error('Error saving sync status:', statusError);
        }

        console.log('Jobs sync completed:', summary);

        // Log to SystemActivityLog
        try {
            await base44.asServiceRole.entities.SystemActivityLog.create({
                actor_type: 'system',
                actor_name: 'pipedrive',
                action_type: 'pipedrive_sync',
                action_description: `סנכרון משרות: ${jobsCreated} נוצרו, ${jobsUpdated} עודכנו, ${jobsClosed} נסגרו | סינכרון הפוך: ${manualJobsSynced} משרות ידניות הועלו ל-Pipedrive`,
                status: 'success',
                details: JSON.stringify(summary)
            });
        } catch (logErr) {
            console.warn('Failed to log activity:', logErr.message);
        }

        // ===========================
        // AUTO-ASSIGN: Run Carmit agent to distribute updated/new jobs to recruitment agents
        // ===========================
        if (jobsCreated > 0 || jobsUpdated > 0) {
            console.log(`🤖 Triggering Carmit agent to assign ${jobsCreated + jobsUpdated} new/updated jobs to recruitment agents...`);
            try {
                await base44.asServiceRole.functions.invoke('runCarmitAgent', {});
                console.log('✅ Carmit agent triggered successfully for job assignment');
                summary.carmit_assignment_triggered = true;
            } catch (carmitErr) {
                console.error('⚠️ Failed to trigger Carmit agent for job assignment:', carmitErr.message);
                summary.carmit_assignment_triggered = false;
                summary.carmit_assignment_error = carmitErr.message;
            }
        } else {
            console.log('No new or updated jobs — skipping Carmit assignment trigger');
            summary.carmit_assignment_triggered = false;
        }

        return Response.json(summary);

    } catch (error) {
        console.error('Pipedrive jobs sync error:', error);
        
        // Save failed sync status
        try {
            const base44 = createClientFromRequest(req);
            const existingStatus = await base44.asServiceRole.entities.PipedriveSyncStatus.filter({ sync_type: 'jobs' });
            const statusData = {
                sync_type: 'jobs',
                last_run_time: new Date().toISOString(),
                status: 'failed',
                error_message: error.message
            };
            if (existingStatus.length > 0) {
                await base44.asServiceRole.entities.PipedriveSyncStatus.update(existingStatus[0].id, statusData);
            } else {
                await base44.asServiceRole.entities.PipedriveSyncStatus.create(statusData);
            }
        } catch (statusError) {
            console.error('Error saving failed sync status:', statusError);
        }
        
        return Response.json({ error: error.message }, { status: 500 });
    }
});