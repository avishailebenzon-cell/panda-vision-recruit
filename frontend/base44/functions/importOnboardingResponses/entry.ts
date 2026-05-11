import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { spreadsheetUrl } = await req.json();
        
        if (!spreadsheetUrl) {
            return Response.json({ error: 'spreadsheetUrl is required' }, { status: 400 });
        }

        console.log('Fetching spreadsheet data...');
        
        // Extract spreadsheet ID from URL
        const sheetIdMatch = spreadsheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (!sheetIdMatch) {
            return Response.json({ error: 'Invalid Google Sheets URL' }, { status: 400 });
        }
        
        const sheetId = sheetIdMatch[1];
        const csvExportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
        
        const response = await fetch(csvExportUrl);
        if (!response.ok) {
            return Response.json({ error: 'Failed to fetch spreadsheet' }, { status: 500 });
        }
        
        const csvText = await response.text();
        const lines = csvText.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        
        console.log(`Found ${lines.length - 1} responses in spreadsheet`);
        
        // Build a map of existing candidates by email and ID for fast lookup
        const candidatesByEmail = new Map();
        const candidatesByIdNumber = new Map();
        const candidatesByName = new Map();
        
        // Load existing candidates in smaller batches to avoid rate limits
        let skip = 0;
        const batchSize = 100;
        let hasMore = true;
        
        while (hasMore) {
            try {
                const batch = await base44.asServiceRole.entities.Candidate.list('-created_date', batchSize, skip);
                if (!batch || batch.length === 0) {
                    hasMore = false;
                    break;
                }
                
                batch.forEach(c => {
                    if (c.email) candidatesByEmail.set(c.email.toLowerCase(), c);
                    if (c.id_number) candidatesByIdNumber.set(c.id_number, c);
                    const name1 = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase().trim();
                    const name2 = `${c.last_name || ''} ${c.first_name || ''}`.toLowerCase().trim();
                    if (name1) candidatesByName.set(name1, c);
                    if (name2) candidatesByName.set(name2, c);
                });
                
                skip += batchSize;
                await new Promise(resolve => setTimeout(resolve, 300)); // Delay between batches
                
                if (batch.length < batchSize) hasMore = false;
            } catch (error) {
                console.error('Error loading candidate batch:', error);
                hasMore = false;
            }
        }
        
        console.log(`Loaded ${candidatesByEmail.size} candidates by email, ${candidatesByIdNumber.size} by ID`);
        
        const results = {
            processed: 0,
            updated: 0,
            created: 0,
            skipped: 0,
            skipped_details: [],
            errors: [],
            gaps: []
        };
        
        // Process each row (skip header)
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line.trim()) continue;
            
            try {
                // Parse CSV line (simple parsing, may need enhancement for complex cases)
                const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
                const row = {};
                headers.forEach((header, idx) => {
                    row[header] = values[idx] || '';
                });
                
                results.processed++;
                
                // Extract key fields
                const email = row['כתובת אימייל'] || '';
                const firstName = row['שם פרטי'] || '';
                const lastName = row['שם משפחה'] || '';
                const firstNameEnglish = row['שם פרטי באנגלית'] || '';
                const lastNameEnglish = row['שם משפחה באנגלית'] || '';
                const phone = row['טלפון נייד'] || '';
                const idNumber = row['מספר ת.ז'] || '';
                
                if (!firstName || !lastName) {
                    results.skipped++;
                    results.skipped_details.push({
                        row: i + 1,
                        reason: 'חסר שם פרטי או משפחה',
                        email: email || 'לא צוין',
                        firstName: firstName || 'חסר',
                        lastName: lastName || 'חסר',
                        phone: phone || 'לא צוין'
                    });
                    results.gaps.push({
                        row: i + 1,
                        reason: 'חסר שם פרטי או משפחה',
                        email: email || 'לא צוין'
                    });
                    continue;
                }
                
                const fullName = `${firstName} ${lastName}`;
                
                // Try to find existing candidate using maps
                let existingCandidate = null;
                
                // Try by email
                if (email) {
                    existingCandidate = candidatesByEmail.get(email.toLowerCase());
                }
                
                // Try by ID number
                if (!existingCandidate && idNumber) {
                    existingCandidate = candidatesByIdNumber.get(idNumber);
                }
                
                // Try by name combinations
                if (!existingCandidate) {
                    const name1 = fullName.toLowerCase().trim();
                    const name2 = `${lastName} ${firstName}`.toLowerCase().trim();
                    existingCandidate = candidatesByName.get(name1) || candidatesByName.get(name2);
                }
                
                // Prepare candidate data
                const candidateData = {
                    full_name: fullName,
                    first_name: firstName,
                    last_name: lastName,
                    email: email || undefined,
                    phone_primary: phone || undefined,
                    id_number: idNumber || undefined,
                    first_name_english: firstNameEnglish || undefined,
                    last_name_english: lastNameEnglish || undefined,
                    gender: row['מין'] || undefined,
                    date_of_birth: row['תאריך לידה'] || undefined,
                    immigration_date: row['תאריך עלייה'] || undefined,
                    immigration_country: row['ארץ עלייה'] || undefined,
                    phone_secondary: row['טלפון בבית'] || undefined,
                    address: row['כתובת (רחוב ומספר)'] || undefined,
                    city: row['עיר מגורים'] || undefined,
                    postal_code: row['מיקוד'] || undefined,
                    marital_status: row['סטטוס משפחתי'] || undefined,
                    languages: row['ידע בשפות (פרט/י שפות)'] || undefined,
                    has_drivers_license: row['בעל/ת רישיון נהיגה'] || undefined,
                    desired_field: row['תחום עיסוק מבוקש'] || undefined,
                    main_role_experience: row['מה התפקיד המרכזי שעבדת בו עד כה ובו צברת את מירב הניסיון שלך?'] || undefined,
                    salary_expectation: row['מה ציפיות השכר שלך ברוטו (מומלץ להיות ריאליים, לא תהיה השפעה על השכר המוצע בפועל)'] || undefined,
                    needs_leasing_car: row['האם ידרש לך רכב ליסינג? \ntשומת לב לכך שרכב הליסינג הינו על חשבון העובד כלומר שווי הרכב יורד על פי חוק משכר ברוטו.'] || undefined,
                    hobbies: row['מה התחביבים שלך? מה את/ה אוהב/ת לעשות בשעות הפנאי?'] || undefined,
                    needs_lunch_at_client: row['האם נדרשות ארוחות צהריים באתר לקוח?'] || undefined,
                    expected_start_date: row['מועד תחילת עבודה משוער/אפשרי'] || undefined,
                    security_clearance: row['סווג בטחוני מוערך'] || undefined,
                    security_clearance_authority: row['גורם שביצע את הסווג עבורך'] || undefined,
                    security_clearance_year: row['באיזו שנה בוצע הסווג הבטחוני בפעם האחרונה?'] || undefined,
                    job_1_company: row['שם מקום עבודה קודם 1'] || undefined,
                    job_1_end_date: row['מועד הסיום במקום עבודה 1'] || undefined,
                    job_1_end_reason: row['סיבת סיום עבודה 1'] || undefined,
                    job_2_company: row['שם מקום עבודה קודם 2'] || undefined,
                    job_2_end_date: row['מועד הסיום במקום עבודה 2'] || undefined,
                    job_2_end_reason: row['סיבת סיום עבודה מקום עבודה 2'] || undefined,
                    military_rank: row['דרגה בשרות חובה/קבע'] || undefined,
                    military_recruitment_year: row['שנת גיוס'] || undefined,
                    military_discharge_year: row['שנת שחרור'] || undefined,
                    military_service: row['מקצוע צבאי'] || undefined,
                    additional_notes: row['לסיום, אם יש לך נושא שחשוב שנדע או משהו ששכחת לציין, נשמח שתרשום אותו כאן. אם אין כזה, לרשום ״אין״'] || undefined,
                    onboarding_form_completed: true,
                    onboarding_form_date: row['חותמת זמן'] || new Date().toISOString()
                };
                
                // Remove undefined fields
                Object.keys(candidateData).forEach(key => {
                    if (candidateData[key] === undefined || candidateData[key] === '') {
                        delete candidateData[key];
                    }
                });
                
                if (existingCandidate) {
                    // Update existing candidate
                    try {
                        await base44.asServiceRole.entities.Candidate.update(
                            existingCandidate.id, 
                            candidateData
                        );
                        results.updated++;
                        console.log(`Updated: ${fullName}`);
                    } catch (updateError) {
                        console.error(`Failed to update ${fullName}:`, updateError.message);
                        results.errors.push({
                            row: i + 1,
                            error: `Failed to update: ${updateError.message}`
                        });
                    }
                } else {
                    // Create new candidate
                    try {
                        const newCandidate = await base44.asServiceRole.entities.Candidate.create(candidateData);
                        results.created++;
                        console.log(`Created: ${fullName}`);
                        
                        // Add to maps for subsequent lookups
                        if (email) candidatesByEmail.set(email.toLowerCase(), newCandidate);
                        if (idNumber) candidatesByIdNumber.set(idNumber, newCandidate);
                    } catch (createError) {
                        console.error(`Failed to create ${fullName}:`, createError.message);
                        results.errors.push({
                            row: i + 1,
                            error: `Failed to create: ${createError.message}`
                        });
                    }
                }
                
                // Delay to avoid rate limiting - increase frequency
                if (results.processed % 3 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                
            } catch (error) {
                console.error(`Error processing row ${i + 1}:`, error.message);
                results.errors.push({
                    row: i + 1,
                    error: error.message
                });
            }
        }
        
        console.log('Import completed:', results);
        
        // Log to SystemActivityLog
        await base44.asServiceRole.entities.SystemActivityLog.create({
            actor_type: 'user',
            actor_name: user.full_name,
            action_type: 'import_onboarding_responses',
            action_description: `ייבוא תשובות טופס מועמד: ${results.created} נוצרו, ${results.updated} עודכנו`,
            status: 'success',
            details: JSON.stringify(results)
        });
        
        return Response.json(results);
        
    } catch (error) {
        console.error('Import error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});