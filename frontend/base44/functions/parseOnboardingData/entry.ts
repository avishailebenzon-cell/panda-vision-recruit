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
        
        // Enhanced CSV parsing function that handles commas and quotes properly
        const parseCSVLine = (line) => {
            const cells = [];
            let current = '';
            let inQuotes = false;
            
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                const nextChar = line[i + 1];
                
                if (char === '"') {
                    if (inQuotes && nextChar === '"') {
                        current += '"';
                        i++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (char === ',' && !inQuotes) {
                    cells.push(current);
                    current = '';
                } else {
                    current += char;
                }
            }
            cells.push(current);
            return cells;
        };
        
        const lines = csvText.split('\n').filter(line => line.trim());
        
        if (lines.length === 0) {
            return Response.json({ error: 'No data found in spreadsheet' }, { status: 400 });
        }
        
        const headers = parseCSVLine(lines[0]);
        console.log(`Found ${lines.length - 1} responses in spreadsheet`);
        console.log(`Headers found: ${headers.length} columns`);
        
        const parsedData = [];
        const skippedRows = [];
        
        // Parse each row (skip header)
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line.trim()) continue;
            
            try {
                const values = parseCSVLine(line);
                const row = {};
                headers.forEach((header, idx) => {
                    row[header] = (values[idx] || '').trim();
                });
                
                // Extract key fields
                const email = row['כתובת אימייל'] || '';
                const firstName = row['שם פרטי'] || '';
                const lastName = row['שם משפחה'] || '';
                const firstNameEnglish = row['שם פרטי באנגלית'] || '';
                const lastNameEnglish = row['שם משפחה באנגלית'] || '';
                const phone = row['טלפון נייד'] || '';
                const idNumber = row['מספר ת.ז'] || '';
                
                if (!firstName || !lastName) {
                    skippedRows.push({
                        rowNumber: i + 1,
                        reason: 'חסר שם פרטי או משפחה',
                        firstName: firstName || 'חסר',
                        lastName: lastName || 'חסר',
                        email: email || 'לא צוין',
                        phone: phone || 'לא צוין'
                    });
                    continue;
                }
                
                const candidateData = {
                    rowNumber: i + 1,
                    full_name: `${firstName} ${lastName}`,
                    first_name: firstName,
                    last_name: lastName,
                    email: email || '',
                    phone_primary: phone || '',
                    id_number: idNumber || '',
                    first_name_english: firstNameEnglish || '',
                    last_name_english: lastNameEnglish || '',
                    gender: row['מין'] || '',
                    date_of_birth: row['תאריך לידה'] || '',
                    immigration_date: row['תאריך עלייה'] || '',
                    immigration_country: row['ארץ עלייה'] || '',
                    phone_secondary: row['טלפון בבית'] || '',
                    address: row['כתובת (רחוב ומספר)'] || '',
                    city: row['עיר מגורים'] || '',
                    postal_code: row['מיקוד'] || '',
                    marital_status: row['סטטוס משפחתי'] || '',
                    languages: row['ידע בשפות (פרט/י שפות)'] || '',
                    has_drivers_license: row['בעל/ת רישיון נהיגה'] || '',
                    desired_field: row['תחום עיסוק מבוקש'] || '',
                    main_role_experience: row['מה התפקיד המרכזי שעבדת בו עד כה ובו צברת את מירב הניסיון שלך?'] || '',
                    salary_expectation: row['מה ציפיות השכר שלך ברוטו (מומלץ להיות ריאליים, לא תהיה השפעה על השכר המוצע בפועל)'] || '',
                    needs_leasing_car: row['האם ידרש לך רכב ליסינג? \ntשומת לב לכך שרכב הליסינג הינו על חשבון העובד כלומר שווי הרכב יורד על פי חוק משכר ברוטו.'] || '',
                    hobbies: row['מה התחביבים שלך? מה את/ה אוהב/ת לעשות בשעות הפנאי?'] || '',
                    needs_lunch_at_client: row['האם נדרשות ארוחות צהריים באתר לקוח?'] || '',
                    expected_start_date: row['מועד תחילת עבודה משוער/אפשרי'] || '',
                    security_clearance: row['סווג בטחוני מוערך'] || '',
                    security_clearance_authority: row['גורם שביצע את הסווג עבורך'] || '',
                    security_clearance_year: row['באיזו שנה בוצע הסווג הבטחוני בפעם האחרונה?'] || '',
                    job_1_company: row['שם מקום עבודה קודם 1'] || '',
                    job_1_end_date: row['מועד הסיום במקום עבודה 1'] || '',
                    job_1_end_reason: row['סיבת סיום עבודה 1'] || '',
                    job_2_company: row['שם מקום עבודה קודם 2'] || '',
                    job_2_end_date: row['מועד הסיום במקום עבודה 2'] || '',
                    job_2_end_reason: row['סיבת סיום עבודה מקום עבודה 2'] || '',
                    military_rank: row['דרגה בשרות חובה/קבע'] || '',
                    military_recruitment_year: row['שנת גיוס'] || '',
                    military_discharge_year: row['שנת שחרור'] || '',
                    military_service: row['מקצוע צבאי'] || '',
                    additional_notes: row['לסיום, אם יש לך נושא שחשוב שנדע או משהו ששכחת לציין, נשמח שתרשום אותו כאן. אם אין כזה, לרשום ״אין״'] || '',
                    onboarding_form_completed: true,
                    onboarding_form_date: row['חותמת זמן'] || new Date().toISOString()
                };
                
                parsedData.push(candidateData);
                
            } catch (error) {
                console.error(`Error parsing row ${i + 1}:`, error.message);
                skippedRows.push({
                    rowNumber: i + 1,
                    reason: `שגיאה בפענוח: ${error.message}`,
                    firstName: 'שגיאה',
                    lastName: 'שגיאה',
                    email: 'לא זמין',
                    phone: 'לא זמין'
                });
            }
        }
        
        console.log(`Parsed ${parsedData.length} candidates, skipped ${skippedRows.length}`);
        
        return Response.json({
            success: true,
            candidates: parsedData,
            skipped: skippedRows,
            totalRows: lines.length - 1
        });
        
    } catch (error) {
        console.error('Parse error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});