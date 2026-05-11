import { createClientFromRequest } from 'npm:@base44/sdk@0.7.0';

Deno.serve(async (req) => {
  try {
    console.log("parseResumeWithAI: Function started");
    
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      console.error("parseResumeWithAI: Unauthorized access");
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { fullText, fileName, fileUrl } = await req.json();
    
    if (!fullText) {
      console.error("parseResumeWithAI: Missing fullText parameter");
      return Response.json({ success: false, error: 'Missing fullText parameter' }, { status: 400 });
    }

    console.log(`parseResumeWithAI: Processing file: ${fileName}`);
    console.log(`parseResumeWithAI: Text length: ${fullText.length} characters`);

    // IMPROVED: Enhanced text quality check - more sophisticated analysis
    const textLength = fullText.trim().length;
    
    // Basic length check - too short is definitely bad
    if (textLength < 50) {
        console.error(`parseResumeWithAI: Text too short for ${fileName}. Length: ${textLength}`);
        return Response.json({ 
            success: false, 
            error: 'הטקסט שחולץ קצר מדי. ייתכן שהקובץ ריק או פגום.' 
        }, { status: 400 });
    }

    // Check for gibberish patterns - look for excessive special characters or repeated patterns
    const nonAlphanumericRatio = (fullText.match(/[^\u0590-\u05FF\u0020-\u007F\s\d]/g) || []).length / textLength;
    
    // Check for excessively short lines that might indicate parsing issues
    const lines = fullText.split('\n').filter(line => line.trim().length > 0);
    const veryShortLines = lines.filter(line => line.trim().length <= 2).length;
    const shortLineRatio = lines.length > 0 ? veryShortLines / lines.length : 0;

    // Check for presence of meaningful content
    const hasHebrewText = /[\u0590-\u05FF]/.test(fullText);
    const hasEnglishText = /[a-zA-Z]/.test(fullText);
    const hasNumbers = /\d/.test(fullText);
    const hasEmail = /@/.test(fullText);
    const hasPhone = /05\d{8}|0[2-9]\d{7}/.test(fullText);

    console.log(`parseResumeWithAI: Text analysis for ${fileName}:`);
    console.log(`- Length: ${textLength}`);
    console.log(`- Non-alphanumeric ratio: ${(nonAlphanumericRatio * 100).toFixed(1)}%`);
    console.log(`- Short line ratio: ${(shortLineRatio * 100).toFixed(1)}%`);
    console.log(`- Has Hebrew: ${hasHebrewText}, English: ${hasEnglishText}, Numbers: ${hasNumbers}`);
    console.log(`- Has email: ${hasEmail}, phone: ${hasPhone}`);

    // IMPROVED: More lenient quality criteria
    const qualityIssues = [];
    
    if (nonAlphanumericRatio > 0.3) {
        qualityIssues.push('יותר מדי תווים לא רגילים');
    }
    
    if (shortLineRatio > 0.5 && lines.length > 10) {
        qualityIssues.push('יותר מדי שורות קצרות');
    }
    
    if (!hasHebrewText && !hasEnglishText) {
        qualityIssues.push('אין טקסט במכירה או באנגלית');
    }
    
    // Only reject if multiple quality issues exist
    if (qualityIssues.length >= 2) {
        console.error(`parseResumeWithAI: Multiple quality issues detected for ${fileName}: ${qualityIssues.join(', ')}`);
        return Response.json({ 
            success: false, 
            error: `איכות הטקסט שחולץ לא מספקת (${qualityIssues.join(', ')}). ייתכן שהקובץ פגום או מוגן בסיסמה.` 
        }, { status: 400 });
    }

    // Create the prompt for AI analysis
    const prompt = `
נתח את קורות החיים הבאים וחלץ מידע בפורמט JSON.
אם אינך מוצא שם פרטי או שם משפחה, השתמש ב-null.

חשוב: בשדות skills_summary אל תכלול תכונות אישיות כמו "חרוץ", "אדיב", "מסור", "אמין", "יצירתי", "אחראי" וכו'.
התמקד רק בכישורים טכניים, מקצועיים וטכנולוגיים.

קורות חיים:
${fullText.substring(0, 8000)}

פרמט את הפלט כ-JSON עם השדות הבאים:
- first_name: שם פרטי (או null)
- last_name: שם משפחה (או null)  
- email: כתובת אימייל
- phone_primary: מספר טלפון ראשי
- address: כתובת מגורים
- education: השכלה ותארים
- skills_summary: סיכום כישורים טכניים ומקצועיים בלבד (עד 500 מילים), ללא תכונות אישיות
- security_clearance: רמת סיווג בטחוני ("רמה 1", "רמה 2", "רמה 3", "סווג נמוך", "ללא סווג", "לא רלוונטי")
`;

    console.log("parseResumeWithAI: Calling AI service");
    
    // Call the InvokeLLM integration
    const aiResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: prompt,
      response_json_schema: {
        type: "object",
        properties: {
          first_name: { type: ["string", "null"] },
          last_name: { type: ["string", "null"] },
          email: { type: ["string", "null"] },
          phone_primary: { type: ["string", "null"] },
          address: { type: ["string", "null"] },
          education: { type: ["string", "null"] },
          skills_summary: { type: ["string", "null"] },
          security_clearance: { 
            type: "string",
            enum: ["רמה 1", "רמה 2", "רמה 3", "סווג נמוך", "ללא סווג", "לא רלוונטי"],
            default: "לא רלוונטי"
          }
        }
      }
    });

    console.log("parseResumeWithAI: AI analysis completed");

    // IMPROVED: Better handling of missing names with more fallback options
    let firstName = aiResponse?.first_name?.trim();
    let lastName = aiResponse?.last_name?.trim();
    
    // If AI couldn't extract names, try to parse them from the text directly
    if (!firstName && !lastName) {
        // Look for common Hebrew name patterns
        const hebrewNamePatterns = [
            /שם[:：]\s*([^\n\r]+)/i,
            /^([א-ת]+\s+[א-ת]+)/m,
            /^([א-ת]+)\s+([א-ת]+)/m
        ];
        
        // Look for email-based names
        const emailMatch = fullText.match(/([a-zA-Z]+)[@.]/);
        
        for (const pattern of hebrewNamePatterns) {
            const match = fullText.match(pattern);
            if (match) {
                const fullName = match[1].trim();
                const nameParts = fullName.split(/\s+/);
                if (nameParts.length >= 2) {
                    firstName = nameParts[0];
                    lastName = nameParts.slice(1).join(' ');
                    break;
                }
            }
        }
        
        // If still no names found, use filename as last resort
        if (!firstName && !lastName) {
            const fileBaseName = fileName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
            
            // Try to extract name from filename
            const cleanFileName = fileBaseName
                .replace(/קורות חיים/gi, '')
                .replace(/קו\"?ח/gi, '')
                .replace(/cv/gi, '')
                .replace(/resume/gi, '')
                .replace(/\d+/g, '')
                .replace(/\s+/g, ' ')
                .trim();
                
            if (cleanFileName.length > 2) {
                const fileNameParts = cleanFileName.split(/\s+/);
                firstName = fileNameParts[0] || "(שם לא זוהה)";
                lastName = fileNameParts.slice(1).join(' ') || "(משפחה לא זוהה)";
            } else {
                firstName = "(שם לא זוהה)";
                lastName = "(משפחה לא זוהה)";
            }
        }
    } else if (!firstName) {
        firstName = "(שם פרטי לא זוהה)";
    } else if (!lastName) {
        lastName = "(שם משפחה לא זוהה)";
    }

    const candidateData = {
      first_name: firstName,
      last_name: lastName,
      email: aiResponse.email?.trim() || null,
      phone_primary: aiResponse.phone_primary?.trim() || null,
      address: aiResponse.address?.trim() || null,
      education: aiResponse.education?.trim() || null,
      skills_summary: aiResponse.skills_summary?.trim() || null,
      security_clearance: aiResponse.security_clearance || 'לא רלוונטי'
    };

    console.log(`parseResumeWithAI: Successfully parsed candidate: ${candidateData.first_name} ${candidateData.last_name}`);

    return Response.json({
      success: true,
      candidateData: candidateData,
      message: `Successfully parsed resume for ${candidateData.first_name} ${candidateData.last_name}`
    });

  } catch (error) {
    console.error("parseResumeWithAI: FATAL ERROR:", error);
    console.error("Error stack:", error.stack);
    
    return Response.json({ 
      success: false, 
      error: error.message || 'An unexpected server error occurred during AI parsing' 
    }, { status: 500 });
  }
});