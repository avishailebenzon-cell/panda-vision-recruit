import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { candidate_id, force_reprocess } = await req.json();

    if (!candidate_id) {
      return Response.json({ error: 'Missing candidate_id' }, { status: 400 });
    }

    // Load candidate first to check if already enhanced
    const candidates = await base44.asServiceRole.entities.Candidate.filter({ id: candidate_id });
    if (!candidates || candidates.length === 0) {
      return Response.json({ error: 'Candidate not found' }, { status: 404 });
    }

    const candidate = candidates[0];

    // Check if already enhanced - prevent duplicate processing unless forced
    if (candidate.cv_enhancement_version > 0 && !force_reprocess) {
      return Response.json({
        success: true,
        skipped: true,
        message: 'המועמד כבר הושבח. השתמש ב-force_reprocess=true אם ברצונך להריץ שוב',
        candidate_id: candidate_id,
        existing_version: candidate.cv_enhancement_version,
        enhancement_date: candidate.cv_enhancement_date
      });
    }

    // Create log entry
    const log = await base44.asServiceRole.entities.CvEnhancementLog.create({
      candidate_id: candidate_id,
      status: 'processing',
      processing_start_time: new Date().toISOString()
    });

    try {

      // Update log with candidate name
      await base44.asServiceRole.entities.CvEnhancementLog.update(log.id, {
        candidate_name: candidate.full_name || `${candidate.first_name} ${candidate.last_name}`
      });

      // Build cv_text from multiple fields - load full PDF text if available
      let fullPdfText = '';
      if (candidate.resume_file_url) {
        try {
          const pdfResponse = await fetch(candidate.resume_file_url);
          const pdfBlob = await pdfResponse.blob();
          const pdfFile = new File([pdfBlob], 'temp.pdf');
          
          const extractResult = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
            file_url: candidate.resume_file_url,
            json_schema: {
              type: "object",
              properties: {
                full_text: { type: "string" }
              }
            }
          });
          
          if (extractResult.status === 'success' && extractResult.output?.full_text) {
            fullPdfText = extractResult.output.full_text;
            console.log(`Extracted full text from PDF (${fullPdfText.length} chars)`);
          }
        } catch (pdfError) {
          console.warn('Could not extract full PDF text:', pdfError.message);
        }
      }
      
      const cvText = [
        `שם: ${candidate.full_name || `${candidate.first_name} ${candidate.last_name}`}`,
        candidate.email ? `אימייל: ${candidate.email}` : '',
        candidate.phone_primary ? `טלפון: ${candidate.phone_primary}` : '',
        candidate.city ? `עיר: ${candidate.city}` : '',
        candidate.education ? `השכלה: ${candidate.education}` : '',
        candidate.education_1 ? `השכלה 1: ${candidate.education_1}` : '',
        candidate.education_2 ? `השכלה 2: ${candidate.education_2}` : '',
        candidate.education_3 ? `השכלה 3: ${candidate.education_3}` : '',
        candidate.military_service ? `שירות צבאי: ${candidate.military_service}` : '',
        candidate.security_clearance ? `סיווג: ${candidate.security_clearance}` : '',
        candidate.main_experience ? `ניסיון מרכזי: ${candidate.main_experience}` : '',
        candidate.skills_summary ? `סיכום כישורים: ${candidate.skills_summary}` : '',
        candidate.job_1_company ? `חברה 1: ${candidate.job_1_company}` : '',
        candidate.job_1_role ? `תפקיד 1: ${candidate.job_1_role}` : '',
        candidate.job_1_description ? `תיאור 1: ${candidate.job_1_description}` : '',
        candidate.job_2_company ? `חברה 2: ${candidate.job_2_company}` : '',
        candidate.job_2_role ? `תפקיד 2: ${candidate.job_2_role}` : '',
        candidate.job_2_description ? `תיאור 2: ${candidate.job_2_description}` : '',
        candidate.job_3_company ? `חברה 3: ${candidate.job_3_company}` : '',
        candidate.job_3_role ? `תפקיד 3: ${candidate.job_3_role}` : '',
        candidate.job_3_description ? `תיאור 3: ${candidate.job_3_description}` : '',
        candidate.job_4_company ? `חברה 4: ${candidate.job_4_company}` : '',
        candidate.job_4_role ? `תפקיד 4: ${candidate.job_4_role}` : '',
        candidate.job_4_description ? `תיאור 4: ${candidate.job_4_description}` : '',
        candidate.job_5_company ? `חברה 5: ${candidate.job_5_company}` : '',
        candidate.job_5_role ? `תפקיד 5: ${candidate.job_5_role}` : '',
        candidate.job_5_description ? `תיאור 5: ${candidate.job_5_description}` : '',
        fullPdfText ? `\n\nטקסט מלא מקורות החיים:\n${fullPdfText.substring(0, 6000)}` : '',
        candidate.full_text ? `\n\nטקסט מלא מקורי:\n${candidate.full_text}` : ''
      ].filter(line => line && line.trim() !== '').join('\n');

      if (!cvText || cvText.trim().length < 50) {
        throw new Error('אין מספיק מידע בקורות החיים לניתוח');
      }

      // Prepare existing tags
      const existingTags = {
        detected_skills: candidate.detected_skills || [],
        detected_languages: candidate.detected_languages || [],
        detected_tools: candidate.detected_tools || [],
        main_tech_tools: candidate.main_tech_tools || '',
        main_programming_languages: candidate.main_programming_languages || ''
      };

      // Call AI for deep analysis
      const prompt = `אתה מנתח קורות חיים מקצועי. קיבלת קורות חיים של מועמד למשרה בתחום ההייטק/הנדסה.

קורות החיים:
${cvText}

תגיות קיימות (אם יש):
${JSON.stringify(existingTags, null, 2)}

המשימה שלך:
נתח את קורות החיים בעומק והפק JSON מובנה עם המידע הבא:

1. main_discipline - הדיסיפלינה המקצועית המרכזית (תוכנה, אלקטרוניקה, IT, הנדסת מערכת, הנדסת מכונות וכו')
2. secondary_disciplines - דיסיפלינות משניות (מערך של מחרוזות)
3. overall_seniority_level - Junior | Intermediate | Senior | Expert
4. overall_years_of_experience - מספר שנות ניסיון כולל (מספר עשרוני)
5. core_skills - 5-15 כישורים מרכזיים עם פרטים (skill_name, category, years_of_experience, last_used_year, proficiency_level)
6. jobs_history - היסטוריית עבודה מפורטת (company_name, domain, role_title, dates, responsibilities, technologies)
7. security_clearance - מידע סיווג ביטחוני (has_clearance, clearance_level, issuer, last_known_valid_year)
8. languages - שפות עם רמות (language, level, evidence)
9. tools_and_technologies - כלים וטכנולוגיות (name, type, years_of_experience, is_core_for_candidate)
10. education_and_certifications - השכלה והסמכות (degree_or_course, institution, field_of_study, years)
11. recruitment_tags - משפחות משרות מומלצות ונקודות חוזקה
12. ui_summary_for_human - סיכום קצר לממשק (short_title + summary_bullets)

כללים קריטיים:
- אל תמציא מידע שלא בקורות החיים
- אם משהו לא ברור - רשום null או Unknown
- שנות ניסיון - חשב לפי תאריכים, אם אין - הערך טווח והמר למספר
- סיווג ביטחוני - זהה גם ביטויים עקיפים כמו "יחידה מסווגת", "יחידת מודיעין", וגם באנגלית "classified unit", "Security classification level 1/2/3", "top secret"
- core_skills - רק הכישורים המרכזיים והחשובים ביותר, לא רשימה אינסופית

החזר JSON תקני בלבד, ללא טקסט נוסף.`;

      const aiResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: prompt,
        response_json_schema: {
          type: "object",
          properties: {
            candidate_id: { type: "string" },
            main_discipline: { type: "string" },
            secondary_disciplines: { type: "array", items: { type: "string" } },
            overall_seniority_level: { type: "string", enum: ["Junior", "Intermediate", "Senior", "Expert"] },
            overall_years_of_experience: { type: "number" },
            core_skills: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  skill_name: { type: "string" },
                  category: { type: "string" },
                  years_of_experience: { type: ["number", "null"] },
                  last_used_year: { type: ["number", "null"] },
                  proficiency_level: { type: "string" }
                }
              }
            },
            jobs_history: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  company_name: { type: "string" },
                  domain: { type: "string" },
                  role_title: { type: "string" },
                  start_date: { type: ["string", "null"] },
                  end_date: { type: ["string", "null"] },
                  employment_type: { type: "string" },
                  main_responsibilities: { type: "array", items: { type: "string" } },
                  key_technologies: { type: "array", items: { type: "string" } },
                  security_domain_exposure: { type: "string" }
                }
              }
            },
            security_clearance: {
              type: "object",
              properties: {
                has_clearance: { type: ["boolean", "null"] },
                clearance_level: { type: ["string", "null"] },
                issuer: { type: ["string", "null"] },
                last_known_valid_year: { type: ["number", "null"] }
              }
            },
            languages: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  language: { type: "string" },
                  level: { type: "string" },
                  evidence: { type: "string" }
                }
              }
            },
            tools_and_technologies: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  type: { type: "string" },
                  years_of_experience: { type: ["number", "null"] },
                  is_core_for_candidate: { type: "boolean" }
                }
              }
            },
            education_and_certifications: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  degree_or_course: { type: "string" },
                  institution: { type: "string" },
                  field_of_study: { type: "string" },
                  start_year: { type: ["number", "null"] },
                  end_year: { type: ["number", "null"] },
                  is_completed: { type: ["boolean", "null"] }
                }
              }
            },
            recruitment_tags: {
              type: "object",
              properties: {
                recommended_job_families: { type: "array", items: { type: "string" } },
                key_value_propositions: { type: "array", items: { type: "string" } }
              }
            },
            ui_summary_for_human: {
              type: "object",
              properties: {
                short_title: { type: "string" },
                summary_bullets: { type: "array", items: { type: "string" } }
              }
            }
          }
        }
      });

      // Update candidate with enhanced data
      const enhancedData = {
        main_discipline: aiResponse.main_discipline || null,
        secondary_disciplines: aiResponse.secondary_disciplines || [],
        overall_seniority_level: aiResponse.overall_seniority_level || null,
        overall_years_of_experience: aiResponse.overall_years_of_experience || null,
        core_skills_structured: JSON.stringify(aiResponse.core_skills || []),
        jobs_history_structured: JSON.stringify(aiResponse.jobs_history || []),
        security_clearance_structured: JSON.stringify(aiResponse.security_clearance || {}),
        languages_structured: JSON.stringify(aiResponse.languages || []),
        tools_and_technologies_structured: JSON.stringify(aiResponse.tools_and_technologies || []),
        education_structured: JSON.stringify(aiResponse.education_and_certifications || []),
        recruitment_tags_structured: JSON.stringify(aiResponse.recruitment_tags || {}),
        ui_summary: JSON.stringify(aiResponse.ui_summary_for_human || {}),
        cv_enhancement_date: new Date().toISOString(),
        cv_enhancement_version: (candidate.cv_enhancement_version || 0) + 1
      };

      await base44.asServiceRole.entities.Candidate.update(candidate_id, enhancedData);

      // Update log as success
      await base44.asServiceRole.entities.CvEnhancementLog.update(log.id, {
        status: 'success',
        processing_end_time: new Date().toISOString(),
        enhanced_fields_count: Object.keys(enhancedData).length
      });

      return Response.json({
        success: true,
        candidate_id: candidate_id,
        enhanced_fields: Object.keys(enhancedData).length,
        ai_response: aiResponse
      });

    } catch (processingError) {
      // Update log as failed
      await base44.asServiceRole.entities.CvEnhancementLog.update(log.id, {
        status: 'failed',
        processing_end_time: new Date().toISOString(),
        error_message: processingError.message
      });

      return Response.json({ 
        success: false, 
        error: processingError.message 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error in enhanceCandidateCv:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});