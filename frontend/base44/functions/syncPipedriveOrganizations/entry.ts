import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const PIPEDRIVE_API_KEY = Deno.env.get('PIPEDRIVE_API_KEY');

async function fetchPersonFields() {
    const url = `https://api.pipedrive.com/v1/personFields?api_token=${PIPEDRIVE_API_KEY}`;
    const response = await fetch(url);
    
    if (!response.ok) {
        throw new Error(`Pipedrive API error fetching person fields: ${response.status}`);
    }
    
    const data = await response.json();
    return data.success ? data.data : [];
}

async function fetchAllOrganizations() {
    const organizations = [];
    let start = 0;
    const limit = 500;
    let hasMore = true;
    let retryCount = 0;
    const maxRetries = 3;

    while (hasMore) {
        try {
            const url = `https://api.pipedrive.com/v1/organizations?api_token=${PIPEDRIVE_API_KEY}&start=${start}&limit=${limit}`;
            const response = await fetch(url);
            
            if (response.status === 429) {
                retryCount++;
                if (retryCount > maxRetries) {
                    throw new Error('Max retries reached for rate limiting');
                }
                console.log(`Rate limit hit, waiting 3 seconds before retry ${retryCount}/${maxRetries}...`);
                await new Promise(resolve => setTimeout(resolve, 3000));
                continue;
            }
            
            if (!response.ok) {
                throw new Error(`Pipedrive API error: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.success && data.data) {
                organizations.push(...data.data);
                hasMore = data.additional_data?.pagination?.more_items_in_collection || false;
                start += limit;
                retryCount = 0;
                
                if (hasMore) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } else {
                hasMore = false;
            }
        } catch (error) {
            if (retryCount < maxRetries) {
                retryCount++;
                await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
                throw error;
            }
        }
    }
    
    return organizations;
}

async function fetchAllPersons() {
    const persons = [];
    let start = 0;
    const limit = 500;
    let hasMore = true;
    let retryCount = 0;
    const maxRetries = 3;

    while (hasMore) {
        try {
            const url = `https://api.pipedrive.com/v1/persons?api_token=${PIPEDRIVE_API_KEY}&start=${start}&limit=${limit}`;
            const response = await fetch(url);
            
            if (response.status === 429) {
                retryCount++;
                if (retryCount > maxRetries) {
                    throw new Error('Max retries reached for rate limiting');
                }
                console.log(`Rate limit hit, waiting 3 seconds before retry ${retryCount}/${maxRetries}...`);
                await new Promise(resolve => setTimeout(resolve, 3000));
                continue;
            }
            
            if (!response.ok) {
                throw new Error(`Pipedrive API error fetching persons: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success && data.data) {
                persons.push(...data.data);
                hasMore = data.additional_data?.pagination?.more_items_in_collection || false;
                start += limit;
                retryCount = 0;
                
                if (hasMore) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } else {
                hasMore = false;
            }
        } catch (error) {
            if (retryCount < maxRetries) {
                retryCount++;
                await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
                throw error;
            }
        }
    }
    
    return persons;
}

function isValidClientPerson(person, statusFieldKey, validOptionIds) {
    if (statusFieldKey && person[statusFieldKey] !== null && person[statusFieldKey] !== undefined) {
        const statusValue = person[statusFieldKey];
        
        if (typeof statusValue === 'number' || !isNaN(Number(statusValue))) {
            const numValue = Number(statusValue);
            if (validOptionIds.includes(numValue)) {
                return { valid: true, statusId: numValue, field: statusFieldKey };
            }
        }
        
        if (typeof statusValue === 'string') {
            const strValue = statusValue.trim();
            if (strValue === 'לקוח' || strValue === 'לקוח פוטנציאלי' || strValue.includes('לקוח')) {
                return { valid: true, status: strValue, field: statusFieldKey };
            }
        }
    }
    
    return { valid: false };
}

function mapPipedriveStatusToContactStatus(person, statusFieldKey) {
    const statusValue = person[statusFieldKey];
    
    const optionIdToStatus = {
        34: 'לקוח',
        33: 'לקוח פוטנציאלי',
        35: 'מועמד',
        36: 'קבלן משנה',
        37: 'עובד לשעבר'
    };
    
    if (typeof statusValue === 'number' || !isNaN(Number(statusValue))) {
        return optionIdToStatus[Number(statusValue)] || null;
    }
    
    if (typeof statusValue === 'string') {
        const validStatuses = ['לקוח', 'לקוח פוטנציאלי', 'מועמד', 'קבלן משנה', 'עובד לשעבר'];
        const trimmed = statusValue.trim();
        if (validStatuses.includes(trimmed)) {
            return trimmed;
        }
    }
    
    return null;
}

function mapProfessionalFieldValue(fieldValue, fieldOptions) {
    if (!fieldValue) return null;
    
    if (typeof fieldValue === 'string' && fieldValue.includes(',')) {
        const ids = fieldValue.split(',').map(id => id.trim());
        const labels = ids
            .map(id => {
                const option = fieldOptions.find(opt => opt.id === Number(id));
                return option?.label;
            })
            .filter(Boolean);
        return labels.length > 0 ? labels.join(', ') : null;
    }
    
    if (typeof fieldValue === 'string' && isNaN(Number(fieldValue))) {
        return fieldValue;
    }
    
    if (typeof fieldValue === 'number' || !isNaN(Number(fieldValue))) {
        const option = fieldOptions.find(opt => opt.id === Number(fieldValue));
        return option?.label || null;
    }
    
    if (Array.isArray(fieldValue)) {
        const labels = fieldValue
            .map(id => {
                const option = fieldOptions.find(opt => opt.id === Number(id));
                return option?.label;
            })
            .filter(Boolean);
        return labels.length > 0 ? labels.join(', ') : null;
    }
    
    return null;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204 });
    }

    const startTime = Date.now();
    const BATCH_SIZE = 500; // Process 500 persons per batch

    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!PIPEDRIVE_API_KEY) {
            return Response.json({ error: 'PIPEDRIVE_API_KEY not configured' }, { status: 500 });
        }

        console.log('🚀 Starting Pipedrive continuous sync (לקוח/לקוח פוטנציאלי only)...');
        
        // Fetch person fields once
        const personFields = await fetchPersonFields();
        const statusFieldKey = 'ab0c233f11f664275203977ddd33194795e485b2';
        const professionalFieldData = personFields.find(f => f.name === 'תחום מקצועי');
        const professionalFieldKey = professionalFieldData?.key;
        const professionalFieldOptions = professionalFieldData?.options || [];
        
        const statusField = personFields.find(f => f.key === statusFieldKey);
        const validOptionIds = [];
        if (statusField?.options) {
            for (const opt of statusField.options) {
                if (opt.label === 'לקוח' || opt.label === 'לקוח פוטנציאלי') {
                    validOptionIds.push(opt.id);
                }
            }
        }
        if (validOptionIds.length === 0) {
            validOptionIds.push(34, 33);
        }
        
        // Fetch all persons once
        console.log('Fetching all persons from Pipedrive...');
        const allPersons = await fetchAllPersons();
        console.log(`Found ${allPersons.length} persons total`);
        
        // Fetch all organizations once
        const allOrganizations = await fetchAllOrganizations();
        
        // Get existing clients and contacts once
        const existingClients = await base44.asServiceRole.entities.Client.list();
        const existingContacts = await base44.asServiceRole.entities.ContactPerson.list();
        
        let totalClientsCreated = 0;
        let totalClientsUpdated = 0;
        let totalContactsCreated = 0;
        let totalContactsUpdated = 0;
        let currentIndex = 0;
        
        // Process all persons in batches
        while (currentIndex < allPersons.length) {
            console.log(`\n📦 Batch ${Math.floor(currentIndex / BATCH_SIZE) + 1}: Processing persons ${currentIndex} to ${Math.min(currentIndex + BATCH_SIZE, allPersons.length)} (out of ${allPersons.length})`);
            
            const personsToProcess = allPersons.slice(currentIndex, currentIndex + BATCH_SIZE);
            const validPersons = [];
            
            for (const person of personsToProcess) {
                const result = isValidClientPerson(person, statusFieldKey, validOptionIds);
                if (result.valid) {
                    validPersons.push(person);
                }
            }
            
            console.log(`Found ${validPersons.length} valid persons in this batch`);
            
            // Check if רן גרנות is in this batch
            const ranInBatch = personsToProcess.find(p => p.id === 459);
            if (ranInBatch) {
                console.log('🎯 רן גרנות IS in this batch!');
                const ranInValid = validPersons.find(p => p.id === 459);
                console.log(ranInValid ? '✅ רן גרנות validated as לקוח' : '❌ רן גרנות filtered out');
            }
            
            // Group valid persons by organization
            const personsByOrgId = {};
            const personsWithoutOrg = [];
            const orgIdsWithValidPersons = new Set();
            
            for (const person of validPersons) {
                const orgId = person.org_id?.value || person.org_id;
                if (orgId) {
                    orgIdsWithValidPersons.add(orgId);
                    if (!personsByOrgId[orgId]) {
                        personsByOrgId[orgId] = [];
                    }
                    personsByOrgId[orgId].push(person);
                } else {
                    personsWithoutOrg.push(person);
                }
            }
            
            const organizations = allOrganizations.filter(org => orgIdsWithValidPersons.has(org.id));
            
            // Process organizations
            for (const org of organizations) {
                const orgName = org.name?.trim();
                if (!orgName) continue;

                let existingClient = existingClients.find(c => 
                    c.pipedrive_org_id === org.id?.toString()
                ) || existingClients.find(c => 
                    c.name?.toLowerCase().trim() === orgName.toLowerCase()
                );

                let clientId;

                if (existingClient) {
                    const updateData = {};
                    
                    let orgEmail = null;
                    if (typeof org.cc_email === 'string' && org.cc_email) {
                        orgEmail = org.cc_email;
                    } else if (org.email && Array.isArray(org.email) && org.email[0]?.value) {
                        orgEmail = org.email[0].value;
                    }
                    
                    let orgPhone = null;
                    if (org.phone && Array.isArray(org.phone) && org.phone[0]?.value) {
                        orgPhone = org.phone[0].value;
                    }
                    
                    if (orgEmail && existingClient.email !== orgEmail) {
                        updateData.email = orgEmail;
                    }
                    if (orgPhone && existingClient.phone !== orgPhone) {
                        updateData.phone = orgPhone;
                    }
                    if (org.id && !existingClient.pipedrive_org_id) {
                        updateData.pipedrive_org_id = org.id.toString();
                    }

                    if (Object.keys(updateData).length > 0) {
                        await base44.asServiceRole.entities.Client.update(existingClient.id, updateData);
                        totalClientsUpdated++;
                        await new Promise(resolve => setTimeout(resolve, 300));
                    }
                    clientId = existingClient.id;
                } else {
                    let orgEmail = null;
                    if (typeof org.cc_email === 'string' && org.cc_email) {
                        orgEmail = org.cc_email;
                    } else if (org.email && Array.isArray(org.email) && org.email[0]?.value) {
                        orgEmail = org.email[0].value;
                    }
                    
                    let orgPhone = null;
                    if (org.phone && Array.isArray(org.phone) && org.phone[0]?.value) {
                        orgPhone = org.phone[0].value;
                    }
                    
                    const clientData = {
                        name: orgName,
                        pipedrive_org_id: org.id?.toString()
                    };
                    if (orgEmail) clientData.email = orgEmail;
                    if (orgPhone) clientData.phone = orgPhone;
                    
                    const newClient = await base44.asServiceRole.entities.Client.create(clientData);
                    clientId = newClient.id;
                    totalClientsCreated++;
                    existingClients.push({ ...newClient, ...clientData });
                }

                // Sync contact persons for this organization
                const orgPersons = personsByOrgId[org.id] || [];
                const clientExistingContacts = existingContacts.filter(c => c.client_id === clientId);

                for (const person of orgPersons) {
                    const personName = person.name?.trim();
                    if (!personName) continue;

                    if (personName.includes('רן גרנות') || personName.includes('גרנות')) {
                        console.log('🔍 Processing רן גרנות:');
                        if (professionalFieldKey) {
                            console.log(`  Raw value: ${person[professionalFieldKey]}`);
                            const mapped = mapProfessionalFieldValue(person[professionalFieldKey], professionalFieldOptions);
                            console.log(`  Mapped value: ${mapped}`);
                        }
                    }

                    let personEmail = null;
                    if (person.email && Array.isArray(person.email) && person.email[0]?.value) {
                        personEmail = person.email[0].value;
                    }
                    
                    let personPhone = null;
                    if (person.phone && Array.isArray(person.phone) && person.phone[0]?.value) {
                        personPhone = person.phone[0].value;
                    }

                    const existingByEmail = personEmail ? clientExistingContacts.find(c => 
                        c.email?.toLowerCase() === personEmail.toLowerCase()
                    ) : null;
                    const existingByName = clientExistingContacts.find(c => 
                        c.name?.toLowerCase().trim() === personName.toLowerCase()
                    );
                    const existingContact = existingByEmail || existingByName;

                    if (existingContact) {
                        const updateData = {};
                        const roleValue = typeof person.job_title === 'string' ? person.job_title : null;
                        const isManual = existingContact.source === 'manual';
                        
                        if (!isManual || !existingContact.email) {
                            if (personEmail && existingContact.email !== personEmail) {
                                updateData.email = personEmail;
                            }
                        }
                        
                        if (!isManual || !existingContact.phone) {
                            if (personPhone && existingContact.phone !== personPhone) {
                                updateData.phone = personPhone;
                            }
                        }
                        
                        if (!isManual || !existingContact.role) {
                            if (roleValue && existingContact.role !== roleValue) {
                                updateData.role = roleValue;
                            }
                        }
                        
                        // Always update professional field if exists in Pipedrive
                        if (professionalFieldKey && person[professionalFieldKey]) {
                            const professionalValue = mapProfessionalFieldValue(person[professionalFieldKey], professionalFieldOptions);
                            
                            if (professionalValue && 
                                (!existingContact.professional_field || 
                                 existingContact.professional_field.trim() === '' ||
                                 (!isManual && existingContact.professional_field !== professionalValue))) {
                                updateData.professional_field = professionalValue;
                            }
                        }
                        
                        const mappedStatus = mapPipedriveStatusToContactStatus(person, statusFieldKey);
                        if (mappedStatus && existingContact.contact_status !== mappedStatus) {
                            updateData.contact_status = mappedStatus;
                        }
                        
                        if (person.id && existingContact.pipedrive_person_id !== person.id.toString()) {
                            updateData.pipedrive_person_id = person.id?.toString();
                        }
                        
                        if (isManual && person.id) {
                            updateData.source = 'pipedrive';
                        }
                        
                        if (Object.keys(updateData).length > 0) {
                            await base44.asServiceRole.entities.ContactPerson.update(existingContact.id, updateData);
                            totalContactsUpdated++;
                            await new Promise(resolve => setTimeout(resolve, 300));
                        }
                    } else {
                        const roleValue = typeof person.job_title === 'string' ? person.job_title : undefined;
                        
                        const contactData = {
                            client_id: clientId,
                            name: personName,
                            is_primary: orgPersons.indexOf(person) === 0,
                            source: 'pipedrive',
                            pipedrive_person_id: person.id?.toString()
                        };
                        if (personEmail) contactData.email = personEmail;
                        if (personPhone) contactData.phone = personPhone;
                        if (roleValue) contactData.role = roleValue;
                        
                        if (professionalFieldKey && person[professionalFieldKey]) {
                            const professionalValue = mapProfessionalFieldValue(person[professionalFieldKey], professionalFieldOptions);
                            if (professionalValue) {
                                contactData.professional_field = professionalValue;
                            }
                        }
                        
                        const mappedStatus = mapPipedriveStatusToContactStatus(person, statusFieldKey);
                        if (mappedStatus) {
                            contactData.contact_status = mappedStatus;
                        }
                        
                        const newContact = await base44.asServiceRole.entities.ContactPerson.create(contactData);
                        existingContacts.push({ ...newContact, ...contactData });
                        totalContactsCreated++;
                        await new Promise(resolve => setTimeout(resolve, 300));
                    }
                }

                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            // Update progress
            currentIndex += BATCH_SIZE;
            const progressPercentage = Math.round((Math.min(currentIndex, allPersons.length) / allPersons.length) * 100);
            console.log(`📊 Progress: ${progressPercentage}% (${Math.min(currentIndex, allPersons.length)}/${allPersons.length})`);
        }
        
        // DELETE contacts that no longer have valid status in Pipedrive
        console.log('\n🗑️ Checking for contacts to delete...');
        let contactsDeleted = 0;
        
        // Get all person IDs from Pipedrive
        const allPipedrivePersonIds = new Set(allPersons.map(p => p.id?.toString()));
        
        // Get all contacts in our system that came from Pipedrive
        const pipedriveContacts = existingContacts.filter(c => c.pipedrive_person_id && c.source === 'pipedrive');
        console.log(`Found ${pipedriveContacts.length} contacts from Pipedrive in our system`);
        
        for (const contact of pipedriveContacts) {
            // Check if person still exists in Pipedrive
            if (!allPipedrivePersonIds.has(contact.pipedrive_person_id)) {
                console.log(`Deleting ${contact.name} - person deleted from Pipedrive`);
                await base44.asServiceRole.entities.ContactPerson.delete(contact.id);
                contactsDeleted++;
                await new Promise(resolve => setTimeout(resolve, 300));
                continue;
            }
            
            // Check if person still has valid status (לקוח or לקוח פוטנציאלי)
            const pipedrivePersonData = allPersons.find(p => p.id?.toString() === contact.pipedrive_person_id);
            if (pipedrivePersonData) {
                const result = isValidClientPerson(pipedrivePersonData, statusFieldKey, validOptionIds);
                if (!result.valid) {
                    console.log(`Deleting ${contact.name} - status changed in Pipedrive (no longer לקוח/לקוח פוטנציאלי)`);
                    await base44.asServiceRole.entities.ContactPerson.delete(contact.id);
                    contactsDeleted++;
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            }
        }
        
        console.log(`✅ Deleted ${contactsDeleted} contacts that are no longer valid`);
        
        const executionTime = Math.round((Date.now() - startTime) / 1000);
        const summary = {
            success: true,
            totalOrganizationsInPipedrive: allOrganizations.length,
            totalPersonsInPipedrive: allPersons.length,
            allPersonsProcessed: allPersons.length,
            clientsCreated: totalClientsCreated,
            clientsUpdated: totalClientsUpdated,
            contactsCreated: totalContactsCreated,
            contactsUpdated: totalContactsUpdated,
            contactsDeleted,
            executionTimeSeconds: executionTime,
            syncCompleted: true
        };

        // Save final sync status
        try {
            const existingStatus = await base44.asServiceRole.entities.PipedriveSyncStatus.filter({ sync_type: 'organizations' });
            const statusData = {
                sync_type: 'organizations',
                last_run_time: new Date().toISOString(),
                status: 'success',
                items_created: totalContactsCreated,
                items_updated: totalContactsUpdated,
                last_synced_person_index: allPersons.length,
                total_persons_to_sync: allPersons.length,
                sync_completed: true
            };
            
            if (existingStatus.length > 0) {
                await base44.asServiceRole.entities.PipedriveSyncStatus.update(existingStatus[0].id, statusData);
            } else {
                await base44.asServiceRole.entities.PipedriveSyncStatus.create(statusData);
            }
            
            console.log('✅ Sync completed! All persons processed.');
        } catch (statusError) {
            console.error('Error saving final status:', statusError);
        }

        // Log to SystemActivityLog
        try {
            await base44.asServiceRole.entities.SystemActivityLog.create({
                actor_type: 'system',
                actor_name: 'pipedrive',
                action_type: 'pipedrive_sync',
                action_description: `סנכרון לקוחות מ-Pipedrive: ${totalClientsCreated} נוצרו, ${totalClientsUpdated} עודכנו, ${totalContactsCreated} אנשי קשר נוספו, ${contactsDeleted || 0} נמחקו`,
                status: 'success',
                details: JSON.stringify(summary)
            });
        } catch (logErr) {
            console.warn('Failed to log activity:', logErr.message);
        }

        console.log('Final summary:', summary);

        // Also sync candidates that are marked pipedrive_synced=true
        // This ensures their notes and tasks are up to date in Pipedrive
        try {
            console.log('\n🔄 Syncing already-synced candidates...');
            const syncedCandidates = await base44.asServiceRole.entities.Candidate.filter({ pipedrive_synced: true });
            console.log(`Found ${syncedCandidates.length} previously synced candidates to update`);
            let candidatesSynced = 0;
            for (const candidate of syncedCandidates) {
                try {
                    await base44.asServiceRole.functions.invoke('syncCandidateToPipedrive', {
                        candidate_id: candidate.id
                    });
                    candidatesSynced++;
                    await new Promise(r => setTimeout(r, 500));
                } catch (e) {
                    console.warn(`Failed to sync candidate ${candidate.full_name}:`, e.message);
                }
            }
            summary.candidatesSynced = candidatesSynced;
            console.log(`✅ Synced ${candidatesSynced} candidates to Pipedrive`);
        } catch (candidateSyncErr) {
            console.warn('Failed to sync candidates:', candidateSyncErr.message);
        }

        return Response.json(summary);

    } catch (error) {
        console.error('Pipedrive sync error:', error);
        
        try {
            const base44 = createClientFromRequest(req);
            const existingStatus = await base44.asServiceRole.entities.PipedriveSyncStatus.filter({ sync_type: 'organizations' });
            const statusData = {
                sync_type: 'organizations',
                last_run_time: new Date().toISOString(),
                status: 'failed',
                error_message: error.message,
                sync_completed: false
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