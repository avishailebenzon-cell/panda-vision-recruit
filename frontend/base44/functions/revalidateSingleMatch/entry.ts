import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
      const base44 = createClientFromRequest(req);
      const user = await base44.auth.me();

      // אם אין משתמש, זו קריאת מערכת/automation - המשך בכל מקרה
      if (!user) {
          console.log('System call to revalidateSingleMatch - proceeding without user context');
      }

      const { match_id } = await req.json();

    if (!match_id) {
      return Response.json({ error: 'match_id is required' }, { status: 400 });
    }

    // Get the match
    const matches = await base44.entities.Match.filter({ id: match_id });
    if (!matches || matches.length === 0) {
      return Response.json({ error: 'Match not found' }, { status: 404 });
    }

    const match = matches[0];
    const agentName = match.user_name;

    // Determine agent type from user_name
    let agentType = null;
    let minScore = 90;
    if (agentName.includes('נעמה')) agentType = 'naama';
    else if (agentName.includes('רועי')) agentType = 'roee';
    else if (agentName.includes('רמי')) agentType = 'rami';
    else if (agentName.includes('אליק')) agentType = 'alik';
    else if (agentName.includes('איתי')) agentType = 'itay';
    else if (agentName.includes('ליאור')) agentType = 'lior';
    else if (agentName.includes('אופיר')) agentType = 'ofir';
    else if (agentName.includes('GC')) { agentType = 'gc'; minScore = 70; }

    if (!agentType) {
      return Response.json({ error: 'Unknown agent type' }, { status: 400 });
    }

    // Get job and candidate
    const job = await base44.entities.Job.filter({ id: match.job_id });
    const candidate = await base44.entities.Candidate.filter({ id: match.candidate_id });

    if (!job || job.length === 0 || !candidate || candidate.length === 0) {
      return Response.json({ error: 'Job or candidate not found' }, { status: 404 });
    }

    const jobData = job[0];
    const candidateData = candidate[0];

    // Build prompt based on agent type
    const agentPrompts = {
      naama: `אתה נעמה, סוכנת גיוס מומחית תוכנה של חברת פנדה-טק. דבר תמיד בלשון נקבה.

כללים לא סחירים:
1) תוכנה בלבד - Embedded/Backend/Frontend/Full Stack/Mobile/Data. אלקטרוניקה/IT לא בתחום
2) לא ממציאה נתונים - אם אין הוכחה בקו"ח → "לא מוכח" = חסר
3) **HARD GATE - סיווג בטחוני**: אם המשרה דורשת סיווג ספציפי, המועמד חייב להחזיק אותו או גבוה ממנו. אם לא → match_score ≤69 + ציין "Hard Gate: סיווג בטחוני נכשל" ב-detailed_analysis
4) Hard Gates נוספים - אם דרישת מינימום לא מתקיימת → match_score ≤69 + ציין מה נכשל
5) Core Skills - הגדר 3-6 כישורי ליבה. "לא מוכח" = חסר
6) כלל מחמיר: חסרים 2 כישורי ליבה → max 75 וברירת מחדל <70. חובה לציין אילו חסרים
7) חסר 1 כישור ליבה → max 85
8) ציון 90+ נדיר - רק אם 0 חוסרי Core + כל Hard Gates + הוכחות חזקות
9) סף הצגה: 70+ בלבד
10) מרחק >100 ק"מ → Hard Gate (69 ומטה)
11) Hands-on - מועמדים ניהוליים בעיקרם ללא עשייה → הורד משמעותית`,

      rami: `אתה רמי, סוכן גיוס מומחה בסיווג ביטחוני - רמה 1 ומעלה של חברת פנדה-טק. דבר תמיד בלשון זכר.

כללים לא סחירים:
1) רק משרות סיווג (רמה 1/2/3/סודי/סודי ביותר). משרות ללא סיווג → לא בתחום
2) לא ממציא נתונים - אם אין הוכחה בקו"ח → "לא מוכח" = חסר
3) **HARD GATE - סיווג בטחוני**: המועמד חייב להחזיק סיווג שווה או גבוה מהנדרש. זהו Hard Gate מוחלט ראשון ועיקרי - חוסר בסיווג → match_score ≤69 + ציין "Hard Gate: סיווג בטחוני נכשל" ב-detailed_analysis
4) Hard Gates נוספים - אם דרישת מינימום לא מתקיימת → match_score ≤69 + ציין מה נכשל
5) Core Skills - הגדר 3-6 כישורי ליבה. "לא מוכח" = חסר
6) כלל מחמיר: חסרים 2 כישורי ליבה → max 75 וברירת מחדל <70
7) חסר 1 כישור ליבה → max 85
8) ציון 90+ נדיר - רק אם 0 חוסרי Core + כל Hard Gates + מוכח סיווג תקף
9) סף הצגה: 70+ בלבד
10) מרחק >100 ק"מ → Hard Gate (69 ומטה)
11) Hands-on - מועמדים ניהוליים בעיקרם ללא עשייה → הורד משמעותית`,

      alik: `אתה אליק, סוכן גיוס מומחה באלקטרוניקה של חברת פנדה-טק. דבר תמיד בלשון זכר.

כללים לא סחירים:
1) אלקטרוניקה בלבד - חומרה/FPGA/צבד/בדיקות חומרה. תוכנה טהורה לא בתחום
2) לא ממציא נתונים - אם אין הוכחה בקו"ח → "לא מוכח" = חסר
3) **HARD GATE - סיווג בטחוני**: אם המשרה דורשת סיווג ספציפי, המועמד חייב להחזיק אותו או גבוה ממנו. אם לא → match_score ≤69 + ציין "Hard Gate: סיווג בטחוני נכשל" ב-detailed_analysis
4) Hard Gates נוספים - אם דרישת מינימום לא מתקיימת → match_score ≤69 + ציין מה נכשל
5) Core Skills - הגדר 3-6 כישורי ליבה. "לא מוכח" = חסר
6) כלל מחמיר: חסרים 2 כישורי ליבה → max 75 וברירת מחדל <70
7) חסר 1 כישור ליבה → max 85
8) ציון 90+ נדיר - רק אם 0 חוסרי Core + כל Hard Gates + כישורי ליבה מוכחים
9) סף הצגה: 70+ בלבד
10) מרחק >100 ק"מ → Hard Gate (69 ומטה)
11) Hands-on - מועמדים ניהוליים בעיקרם ללא עשייה → הורד משמעותית`,

      itay: `אתה איתי, סוכן גיוס מומחה IT של חברת פנדה-טק. דבר תמיד בלשון זכר.

כללים לא סחירים:
1) IT בלבד - System/Network/Cloud/SecOps/DBA/Helpdesk/NOC. תוכנה/אלקטרוניקה לא בתחום
2) לא ממציא נתונים - אם אין הוכחה בקו"ח → "לא מוכח" = חסר
3) **HARD GATE - סיווג בטחוני**: אם המשרה דורשת סיווג ספציפי, המועמד חייב להחזיק אותו או גבוה ממנו. אם לא → match_score ≤69
4) Hard Gates נוספים - אם דרישת מינימום לא מתקיימת → match_score ≤69
5) Core Skills - הגדר 3-6 כישורי ליבה. "לא מוכח" = חסר
6) כלל מחמיר: חסרים 2 כישורי ליבה → max 75 וברירת מחדל <70
7) חסר 1 כישור ליבה → max 85
8) ציון 90+ נדיר - רק אם 0 חוסרי Core + כל Hard Gates
9) סף הצגה: 70+ בלבד
10) מרחק >100 ק"מ → Hard Gate (69 ומטה)`,

      lior: `אתה ליאור, סוכן גיוס מומחה בהנדסת מערכת של חברת פנדה-טק. דבר תמיד בלשון זכר.

כללים לא סחירים:
1) הנדסת מערכת בלבד - System Engineering/Integration/Requirements/Modeling
2) לא ממציא נתונים - אם אין הוכחה בקו"ח → "לא מוכח" = חסר
3) **HARD GATE - סיווג בטחוני**: אם המשרה דורשת סיווג ספציפי, המועמד חייב להחזיק אותו או גבוה ממנו. אם לא → match_score ≤69
4) Hard Gates נוספים - אם דרישת מינימום לא מתקיימת → match_score ≤69
5) Core Skills - הגדר 3-6 כישורי ליבה. "לא מוכח" = חסר
6) כלל מחמיר: חסרים 2 כישורי ליבה → max 75 וברירת מחדל <70
7) חסר 1 כישור ליבה → max 85
8) ציון 90+ נדיר - רק אם 0 חוסרי Core + כל Hard Gates
9) סף הצגה: 70+ בלבד
10) מרחק >100 ק"מ → Hard Gate (69 ומטה)`,

      ofir: `אתה אופיר, סוכן גיוס מומחה לתחום הנדסת מכונות של חברת פנדה-טק. דבר תמיד בלשון זכר.

כללים לא סחירים:
1) הנדסת מכונות בלבד - תכן מכני/CAD/FEA/CFD/DFM/Medical Devices
2) לא ממציא נתונים - אם אין הוכחה בקו"ח → "לא מוכח" = חסר
3) **HARD GATE - סיווג בטחוני**: אם המשרה דורשת סיווג ספציפי, המועמד חייב להחזיק אותו או גבוה ממנו. אם לא → match_score ≤69
4) Hard Gates נוספים - אם דרישת מינימום לא מתקיימת → match_score ≤69
5) Core Skills - הגדר 3-6 כישורי ליבה. "לא מוכח" = חסר
6) כלל מחמיר: חסרים 2 כישורי ליבה → max 75 וברירת מחדל <70
7) חסר 1 כישור ליבה → max 85
8) ציון 90+ נדיר - רק אם 0 חוסרי Core + כל Hard Gates
9) סף הצגה: 70+ בלבד
10) מרחק >100 ק"מ → Hard Gate (69 ומטה)`,

      gc: `אתה GC (Garbage Collector), סוכן כללי ומנוסה. התבקשת למצוא מועמדים למשרה שלא סווגה לסוכן מקצועי ספציפי.

עבור המועמד, עליך לספק ניתוח מעמיק ומפורט המשווה בין דרישות המשרה לבין נתוני המועמד.

הוראות:
1. בדוק התאמה לדרישות המשרה.
2. החזר התאמה רק אם הציון 70 ומעלה.
3. חובה לספק detailed_analysis מלא.
4. ב-match_reasons תן סיכום קצר וקולע. כתוב בלשון זכר.`
    };

    const candidateText = `${candidateData.first_name || ''} ${candidateData.last_name || ''}
   סיווג: ${candidateData.security_clearance || 'לא צוין'}
   עיר: ${candidateData.city || 'לא צוין'}
   ניסיון: ${candidateData.main_experience || 'לא צוין'}
   השכלה: ${candidateData.education || 'לא צוין'}
   כישורים: ${candidateData.skills_summary || 'לא צוין'}
   שפות: ${candidateData.languages || 'לא צוין'}
   כלים: ${candidateData.main_tech_tools || 'לא צוין'}`;

    const prompt = `${agentPrompts[agentType]}

פרטי המשרה:
כותרת: ${jobData.title}
מיקום: ${jobData.location || 'לא צוין'}
תיאור: ${jobData.description || 'לא צוין'}
דרישות: ${jobData.requirements || 'לא צוין'}
${jobData.dana_supplement ? 'הגדרות נוספות: ' + jobData.dana_supplement : ''}
סיווג בטחוני נדרש: ${jobData.security_clearance || 'לא צוין'}

המועמד:
${candidateText}

עקרון ראיות: טכנולוגיה/כישור "קיימים" רק עם ניסיון מוכח בתפקיד/פרויקט. לא נחשב: skills list, אזכור יחיד, "היכרות".

קו"ח ישנים (>3 שנים): הורד 10-15 נקודות + הוסף "⚠️ קורות חיים מ-[שנה]".

הוראות פלט:
1. נתח משרה: Hard Gates, Core Skills (3-6), Secondary
2. בדוק מועמד: Hard Gates? Core מוכחים? כלים ספציפיים מוכחים?
3. החזר התאמה רק אם ${minScore}+
4. detailed_analysis מלא: requirement, candidate_qualification, is_match
5. match_reasons: **חובה סיכום מפורט ומלא של ההתאמה - לפחות 3-4 משפטים**. כלול:
   - Hard Gates (עמידה/אי-עמידה)
   - Core Skills (מוכח היכן/חלקי/חסר + דוגמאות ספציפיות מהקו"ח)
   - טכנולוגיות וכלים (פרט איפה השתמש בהם)
   - שנות ניסיון ותפקידים רלוונטיים
   - פערים משמעותיים או נקודות חוזק
   דוגמה לסיכום טוב: "המועמד בעל 8 שנות ניסיון בתכן מכני ב-SolidWorks בחברות מובילות. מוכח שימוש ב-FEA וניסיון בתכן מתקנים לייצור. חסר ניסיון מוכח ב-DFM אך יש רקע בפרויקטי אב-טיפוס. סיווג בטחוני רמה 1 תקף."

החזר את ההתאמה אם מתאים, או null אם לא מתאים.`;

    const llmResponse = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          match_score: { type: "number" },
          match_reasons: { type: "string" },
          detailed_analysis: {
            type: "array",
            items: {
              type: "object",
              properties: {
                requirement: { type: "string" },
                candidate_qualification: { type: "string" },
                is_match: { type: "string", enum: ["true", "false", "partial"] }
              },
              required: ["requirement", "candidate_qualification", "is_match"]
            }
          },
          is_match: { type: "boolean" }
        },
        required: ["match_score", "match_reasons", "is_match"]
      }
    });

    // Security clearance Hard Gate post-processing
    // Always inject an explicit security clearance check into detailed_analysis
    const clearanceLevels = { 'רמה 1': 4, 'רמה 2': 3, 'רמה 3': 2, 'סודי ביותר': 5, 'סודי': 4, 'שמור': 3, 'סיווג נמוך': 1, 'ללא סיווג': 0, 'לא ידוע/ת': -1 };
    if (jobData.security_clearance && jobData.security_clearance !== 'ללא סיווג') {
      const jobLevel = clearanceLevels[jobData.security_clearance] ?? 0;
      const candidateLevel = clearanceLevels[candidateData.security_clearance] ?? -1;
      const clearanceMet = candidateLevel >= jobLevel && candidateLevel >= 0;

      // Inject into detailed_analysis
      if (!llmResponse.detailed_analysis) llmResponse.detailed_analysis = [];
      const clearanceEntry = {
        requirement: `סיווג בטחוני נדרש: ${jobData.security_clearance} [Hard Gate]`,
        candidate_qualification: candidateData.security_clearance ? `סיווג המועמד: ${candidateData.security_clearance}` : 'סיווג בטחוני לא צוין',
        is_match: clearanceMet ? 'true' : 'false'
      };
      // Remove any existing clearance entry and put ours first
      llmResponse.detailed_analysis = [
        clearanceEntry,
        ...llmResponse.detailed_analysis.filter(e => !e.requirement?.includes('סיווג בטחוני'))
      ];

      // Force cap score if clearance not met
      if (!clearanceMet) {
        if (llmResponse.match_score > 69) {
          llmResponse.match_score = 69;
        }
        llmResponse.is_match = false;
        llmResponse.match_reasons = `❌ Hard Gate נכשל: סיווג בטחוני. המשרה דורשת ${jobData.security_clearance} והמועמד ${candidateData.security_clearance ? 'בעל סיווג ' + candidateData.security_clearance : 'ללא סיווג מוכח'}.\n\n${llmResponse.match_reasons || ''}`;
      }
    }

    // If not a match or score too low, delete the match
    if (!llmResponse.is_match || llmResponse.match_score < minScore) {
      await base44.entities.Match.delete(match_id);
      return Response.json({ 
        action: 'deleted',
        message: `ההתאמה לא עומדת יותר בקריטריונים (ציון: ${llmResponse.match_score})`,
        match_score: llmResponse.match_score
      });
    }

    // GeoFit check
    let geoFitResult = null;
    try {
      const geoResponse = await base44.functions.invoke('calculateGeoFit', {
        candidate_id: candidateData.id,
        job_id: jobData.id
      });
      geoFitResult = geoResponse.data?.result;
    } catch (geoErr) {
      console.log('GeoFit failed:', geoErr.message);
    }

    // If geo rejected, delete match
    if (geoFitResult && (geoFitResult.geo_status === 'REJECTED' || geoFitResult.geo_status === 'NEEDS_REVIEW')) {
      await base44.entities.Match.delete(match_id);
      return Response.json({ 
        action: 'deleted',
        message: 'ההתאמה נדחתה מסיבה גיאוגרפית',
        geo_status: geoFitResult.geo_status
      });
    }

    // Build geo display text
    let geoDisplayText = '';
    if (geoFitResult) {
      if (geoFitResult.geo_status === 'APPROVED') {
        geoDisplayText = `\n\n📍 התאמה גיאוגרפית: אושר | מרחק: ${geoFitResult.distance_km} ק"מ | סף: ${geoFitResult.threshold_km} ק"מ`;
      } else if (geoFitResult.geo_status === 'UNKNOWN_ALLOWED') {
        geoDisplayText = `\n\n📍 התאמה גיאוגרפית: לא נבדקה (חסר נתון מיקום)`;
      }
    }

    // Update match with new data
    const finalMatchReasons = (llmResponse.match_reasons || 'התאמה אוטומטית') + geoDisplayText;

    await base44.entities.Match.update(match_id, {
      match_score: llmResponse.match_score,
      match_reasons: finalMatchReasons,
      detailed_analysis: llmResponse.detailed_analysis ? JSON.stringify(llmResponse.detailed_analysis) : null,
      geo_status: geoFitResult?.geo_status,
      geo_distance_km: geoFitResult?.distance_km
    });

    return Response.json({ 
      action: 'updated',
      message: `ההתאמה עודכנה בהצלחה (ציון חדש: ${llmResponse.match_score})`,
      match_score: llmResponse.match_score,
      match_reasons: finalMatchReasons
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});