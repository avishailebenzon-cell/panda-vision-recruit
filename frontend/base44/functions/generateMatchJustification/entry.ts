import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify user is authenticated
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { match_id, candidate_id, job_id, agent_type } = await req.json();

    if (!match_id || !candidate_id || !job_id) {
      return Response.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Guard: reject temp/placeholder IDs before any DB or LLM calls
    if (match_id === 'temp' || match_id === 'new' || match_id.startsWith('temp')) {
      return Response.json({ error: 'Invalid match_id - match not saved yet' }, { status: 400 });
    }

    // Fetch data
    const match = await base44.entities.Match.get(match_id);
    const candidate = await base44.entities.Candidate.get(candidate_id);
    const job = await base44.entities.Job.get(job_id);

    const agentConfigs = {
      naama: {
        name: 'נעמה',
        role: 'מומחית תוכנה',
        expertise: 'תוכנה, embedded, firmware, C++, Python, Java'
      },
      alik: {
        name: 'אליק',
        role: 'מומחה אלקטרוניקה',
        expertise: 'אלקטרוניקה, PCB, FPGA, אנלוגי/דיגיטלי'
      },
      itay: {
        name: 'איתי',
        role: 'מומחה IT',
        expertise: 'DevOps, Cloud, AWS, Azure, רשתות, אבטחת מידע'
      },
      lior: {
        name: 'ליאור',
        role: 'מומחה הנדסת מערכת',
        expertise: 'הנדסת מערכת, SRS, MBSE, DOORS'
      },
      ofir: {
        name: 'אופיר',
        role: 'מומחה הנדסת מכונות',
        expertise: 'הנדסת מכונות, SolidWorks, CATIA, תכנון מכני'
      },
      gc: {
        name: 'GC',
        role: 'סוכן כללי',
        expertise: 'משרות כלליות שלא סווגו לתחום ספציפי'
      },
      rami: {
        name: 'רמי',
        role: 'מומחה רמה 1',
        expertise: 'משרות סיווג רמה 1 בלבד'
      }
    };

    const agentConfig = agentConfigs[agent_type] || agentConfigs.gc;

    // Load feedback context for this agent
    let agentFeedbackText = '';
    try {
      const feedbackResp = await base44.asServiceRole.functions.invoke('getAgentFeedbackContext', { agent_name: agent_type });
      agentFeedbackText = feedbackResp?.data?.feedbackText || '';
    } catch (e) { /* ignore */ }

    const prompt = `אתה ${agentConfig.name} - ${agentConfig.role}.
תחום ההתמחות שלך: ${agentConfig.expertise}

המשימה שלך: לבדוק בקפידה האם המועמד מתאים למשרה ולהסביר למשתמש את הנימוק המפורט.

**פרטי המשרה:**
כותרת: ${job.title}
תיאור: ${job.description}
דרישות: ${job.requirements}
סיווג בטחוני נדרש: ${job.security_clearance || 'לא רלוונטי'}
מיקום: ${job.location || 'לא צוין'}

**פרטי המועמד:**
שם: ${candidate.first_name} ${candidate.last_name}
כישורים מרכזיים: ${candidate.skills_summary || 'לא צוין'}
ניסיון תעסוקתי: ${[candidate.job_1_description, candidate.job_2_description, candidate.job_3_description].filter(Boolean).join(' | ') || 'לא צוין'}
השכלה: ${candidate.education || 'לא צוין'}
סיווג בטחוני: ${candidate.security_clearance || 'לא רלוונטי'}
ניסיון צבאי: ${candidate.military_service || 'לא צוין'}
שפות: ${candidate.languages || 'לא צוין'}
עיר מגורים: ${candidate.city || 'לא צוין'}

**ציון ההתאמה המקורי שנתת:** ${match.match_score}%
**הסיבות המקוריות שציינת:** ${match.match_reasons || 'לא צוינו'}

${agentFeedbackText}

**הוראות:**
1. בדוק בקפידה את ההתאמה בין דרישות המשרה ליכולות המועמד
2. אם המועמד מתאים - הסבר בפירוט:
   - מה מתאים בדיוק (כישורים, ניסיון, השכלה)
   - למה הוא בחירה טובה למשרה זו
   - היבטים חזקים של המועמד
3. אם המועמד אינו מתאים (לדוגמה: חוסר בסיווג נדרש, חוסר בכישורים קריטיים, מיקום רחוק מדי) - הסבר בכנות למה הוא לא מתאים

חשוב: אל תנסה "למכור" מועמד שלא מתאים. היה אובייקטיבי ומקצועי.

כתוב את התשובה בעברית, בצורה ברורה ומובנת.`;

    const response = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: false
    });

    const justificationText = response;
    
    // Check if the agent concluded the candidate is not suitable
    const notSuitableIndicators = [
      'לא מתאים',
      'אינו מתאים',
      'אינה מתאימה',
      'לא מומלץ',
      'אינו עומד',
      'לא עומד',
      'חוסר ב'
    ];
    
    const isNotSuitable = notSuitableIndicators.some(indicator => 
      justificationText.includes(indicator)
    );

    return Response.json({
      justification: justificationText,
      isNotSuitable: isNotSuitable
    });

  } catch (error) {
    console.error('Error generating justification:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});