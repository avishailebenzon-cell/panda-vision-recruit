import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const PIPEDRIVE_API_KEY = Deno.env.get('PIPEDRIVE_API_KEY');

async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;

      if ([429, 502, 503, 504].includes(response.status)) {
        const waitTime = attempt * 2000;
        console.log(`Pipedrive returned ${response.status}, retrying in ${waitTime/1000}s (attempt ${attempt}/${maxRetries})...`);
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
      }

      const errorText = await response.text();
      throw new Error(`Pipedrive API error (${response.status}): ${errorText.substring(0, 200)}`);
    } catch (fetchError) {
      if (attempt < maxRetries && (fetchError.message.includes('fetch') || fetchError.message.includes('network'))) {
        await new Promise(resolve => setTimeout(resolve, attempt * 2000));
        continue;
      }
      throw fetchError;
    }
  }
  throw new Error('Max retries reached');
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

    console.log('Starting Employee sync from Pipedrive (by contact_status = עובד חברה)...');

    // Find all Pipedrive organizations named "pandatech" (case-insensitive)
    let pandatechOrgIds = new Set();
    let orgStart = 0;
    const orgLimit = 100;
    let orgHasMore = true;

    while (orgHasMore) {
      const orgRes = await fetchWithRetry(
        `https://api.pipedrive.com/v1/organizations?start=${orgStart}&limit=${orgLimit}&api_token=${PIPEDRIVE_API_KEY}`
      );
      const orgData = await orgRes.json();
      if (!orgData.success) break;

      for (const org of (orgData.data || [])) {
        if (org.name && org.name.toLowerCase().includes('pandatech')) {
          pandatechOrgIds.add(String(org.id));
          console.log(`Found Pandatech org: "${org.name}" (id=${org.id})`);
        }
      }

      orgHasMore = orgData.additional_data?.pagination?.more_items_in_collection || false;
      orgStart += orgLimit;
    }

    console.log(`Found ${pandatechOrgIds.size} Pandatech organizations in Pipedrive`);

    // Fetch all persons from Pipedrive (paginated)
    let allPersons = [];
    let start = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const res = await fetchWithRetry(
        `https://api.pipedrive.com/v1/persons?start=${start}&limit=${limit}&api_token=${PIPEDRIVE_API_KEY}`
      );
      const data = await res.json();

      if (!data.success) break;

      const persons = data.data || [];
      allPersons = allPersons.concat(persons);

      hasMore = data.additional_data?.pagination?.more_items_in_collection || false;
      start += limit;

      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    console.log(`Fetched ${allPersons.length} total persons from Pipedrive`);

    // Filter only persons that belong to a Pandatech organization
    const employeePersons = allPersons.filter(person => {
      const orgId = person.org_id?.value ? String(person.org_id.value) : null;
      return orgId && pandatechOrgIds.has(orgId);
    });

    console.log(`Found ${employeePersons.length} employees (status = עובד חברה)`);

    // Get existing employees from DB
    const existingEmployees = await base44.asServiceRole.entities.Employee.list('-created_date', 1000);
    const employeesByPipedriveId = new Map(
      existingEmployees
        .filter(e => e.pipedrive_person_id)
        .map(e => [String(e.pipedrive_person_id), e])
    );
    const employeesByEmail = new Map(
      existingEmployees
        .filter(e => e.email)
        .map(e => [e.email.toLowerCase(), e])
    );

    let employeesCreated = 0;
    let employeesUpdated = 0;
    let employeesRemoved = 0;
    let failed = 0;

    // Build set of Pipedrive IDs that are currently employees
    const activeEmployeePipedriveIds = new Set(employeePersons.map(p => String(p.id)));

    // Remove employees that are no longer marked as "עובד חברה" in Pipedrive
    for (const existing of existingEmployees) {
      if (existing.pipedrive_person_id && !activeEmployeePipedriveIds.has(String(existing.pipedrive_person_id))) {
        try {
          await base44.asServiceRole.entities.Employee.delete(existing.id);
          employeesRemoved++;
          console.log(`Removed employee no longer in Pipedrive: ${existing.full_name}`);
        } catch (err) {
          console.error(`Error removing employee ${existing.full_name}:`, err.message);
        }
      }
    }

    for (const person of employeePersons) {
      try {
        const primaryEmail = (person.email || []).find(e => e.primary)?.value ||
                             (person.email || [])[0]?.value || null;
        const primaryPhone = (person.phone || []).find(e => e.primary)?.value ||
                             (person.phone || [])[0]?.value || null;

        // org_id.name contains the organization name in Pipedrive
        const orgName = person.org_id?.name || null;

        const employeeData = {
          full_name: person.name || '',
          email: primaryEmail,
          phone: primaryPhone,
          pipedrive_person_id: String(person.id),
          pipedrive_org_id: person.org_id?.value ? String(person.org_id.value) : null,
          department: orgName, // שם הארגון מ-Pipedrive = מחלקה
        };

        // Remove nulls/empty
        const cleanData = Object.fromEntries(
          Object.entries(employeeData).filter(([, v]) => v !== null && v !== undefined && v !== '')
        );

        const existingById = employeesByPipedriveId.get(String(person.id));
        const existingByEmail = primaryEmail ? employeesByEmail.get(primaryEmail.toLowerCase()) : null;
        const existing = existingById || existingByEmail;

        if (existing) {
          await base44.asServiceRole.entities.Employee.update(existing.id, cleanData);
          employeesUpdated++;
          console.log(`Updated employee: ${person.name}`);
        } else {
          await base44.asServiceRole.entities.Employee.create(cleanData);
          employeesCreated++;
          console.log(`Created employee: ${person.name}`);
        }

        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (err) {
        console.error(`Error syncing employee ${person.name}:`, err.message);
        failed++;
      }
    }

    const summary = {
      success: true,
      totalPersons: allPersons.length,
      employeesFound: employeePersons.length,
      employeesCreated,
      employeesUpdated,
      employeesRemoved,
      failed
    };

    console.log('Employee sync completed:', summary);

    try {
      await base44.asServiceRole.entities.SystemActivityLog.create({
        actor_type: 'system',
        actor_name: 'pipedrive',
        action_type: 'pipedrive_sync',
        action_description: `סינכרון עובדים: ${employeesCreated} חדשים, ${employeesUpdated} עודכנו`,
        status: 'success',
        details: JSON.stringify(summary)
      });
    } catch (logErr) {
      console.warn('Failed to log activity:', logErr.message);
    }

    return Response.json(summary);

  } catch (error) {
    console.error('Employee sync error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});