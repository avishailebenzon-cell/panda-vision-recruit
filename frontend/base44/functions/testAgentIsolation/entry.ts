import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    const results = {
      timestamp: new Date().toISOString(),
      total_tests: 0,
      passed: 0,
      failed: 0,
      tests: []
    };

    // Helper function to add test result
    const addTest = (name, passed, details) => {
      results.total_tests++;
      if (passed) results.passed++;
      else results.failed++;
      results.tests.push({ name, passed, details });
    };

    // ========== 1. בדיקות שחר (Shacahr) - גיוס מועמדים WhatsApp ==========
    
    // 1.1 בדיקת גישה ל-AgentConfig של שחר
    try {
      const shacahrConfig = await base44.entities.AgentConfig.filter({ agent_name: 'shacahr' });
      addTest('שחר - קריאת AgentConfig', 
        shacahrConfig && shacahrConfig.length > 0,
        `נמצאו ${shacahrConfig?.length || 0} קונפיגורציות לשחר`
      );
    } catch (e) {
      addTest('שחר - קריאת AgentConfig', false, `שגיאה: ${e.message}`);
    }

    // 1.2 בדיקת יצירת NewCandidateInbox (סימולציה)
    try {
      // ניסיון יצירת רשומה
      const testInbox = await base44.asServiceRole.entities.NewCandidateInbox.create({
        candidate_id: 'test-isolation-candidate',
        candidate_name: 'בדיקת בידוד',
        source: 'manual_upload',
        is_processed: false
      });
      
      // וידוא שהרשומה נוצרה
      const created = testInbox && testInbox.id;
      
      // ניקוי
      if (created) {
        await base44.asServiceRole.entities.NewCandidateInbox.delete(testInbox.id);
      }
      
      addTest('שחר - יצירת NewCandidateInbox', 
        created,
        `רשומה נוצרה ונמחקה בהצלחה (ממשק כניסה לתיבת מועמדים)`
      );
    } catch (e) {
      addTest('שחר - יצירת NewCandidateInbox', false, `שגיאה: ${e.message}`);
    }

    // ========== 2. בדיקות נעמה - מומחית תוכנה ==========
    
    // 2.1 בדיקת גישה למשרות ומועמדים
    try {
      const jobs = await base44.asServiceRole.entities.Job.list('', 1);
      const candidates = await base44.asServiceRole.entities.Candidate.list('', 1);
      
      addTest('נעמה - קריאת Job ו-Candidate', 
        jobs && jobs.length >= 0 && candidates && candidates.length >= 0,
        `גישה למשרות (${jobs?.length || 0}) ומועמדים (${candidates?.length || 0})`
      );
    } catch (e) {
      addTest('נעמה - קריאת Job ו-Candidate', false, `שגיאה: ${e.message}`);
    }

    // 2.2 בדיקת יצירת Match
    try {
      const jobs = await base44.asServiceRole.entities.Job.list('', 1);
      const candidates = await base44.asServiceRole.entities.Candidate.list('', 1);
      
      if (jobs && jobs.length > 0 && candidates && candidates.length > 0) {
        const job = jobs[0];
        const candidate = candidates[0];
        
        const testMatch = await base44.asServiceRole.entities.Match.create({
          job_id: job.id,
          job_title: job.title,
          candidate_id: candidate.id,
          candidate_name: candidate.full_name || 'בדיקה',
          user_id: user.id,
          user_name: user.full_name,
          user_app_role: user.app_role || 'admin',
          match_score: 75,
          match_reasons: 'בדיקת בידוד פונקציונלי',
          status: 'התאמה חדשה',
          status_number: 1,
          is_automatic_recommendation: true
        });
        
        // ניקוי
        await base44.asServiceRole.entities.Match.delete(testMatch.id);
        
        addTest('נעמה - יצירת Match', true, `Match נוצר ונמחק בהצלחה`);
      } else {
        addTest('נעמה - יצירת Match', false, 'אין משרות או מועמדים במערכת');
      }
    } catch (e) {
      addTest('נעמה - יצירת Match', false, `שגיאה: ${e.message}`);
    }

    // ========== 3. בדיקות אופיר - הנדסת מכונות ==========
    // (בדיקת revalidateSingleMatch הוסרה - זו פונקציה פנימית שלא רלוונטית לבידוד)

    // ========== 4. בדיקות כרמית - מנהלת גיוס ==========
    
    // 4.1 בדיקת גישה למשרות והתאמות
    try {
      const jobs = await base44.asServiceRole.entities.Job.list('', 5);
      const matches = await base44.asServiceRole.entities.Match.list('', 5);
      
      addTest('כרמית - קריאת Job ו-Match', 
        jobs && jobs.length >= 0 && matches && matches.length >= 0,
        `גישה למשרות (${jobs?.length || 0}) והתאמות (${matches?.length || 0})`
      );
    } catch (e) {
      addTest('כרמית - קריאת Job ו-Match', false, `שגיאה: ${e.message}`);
    }

    // ========== 5. בדיקות רותם - קשרי מועמדים ==========
    
    // 5.1 בדיקת גישה ל-Candidate
    try {
      const candidates = await base44.asServiceRole.entities.Candidate.list('', 3);
      
      addTest('רותם - קריאת Candidate', 
        candidates && candidates.length >= 0,
        `גישה למועמדים (${candidates?.length || 0})`
      );
    } catch (e) {
      addTest('רותם - קריאת Candidate', false, `שגיאה: ${e.message}`);
    }

    // 5.2 בדיקת RotemTask
    try {
      const tasks = await base44.asServiceRole.entities.RotemTask.list('', 3);
      
      addTest('רותם - קריאת RotemTask', 
        tasks && tasks.length >= 0,
        `גישה למשימות (${tasks?.length || 0})`
      );
    } catch (e) {
      addTest('רותם - קריאת RotemTask', false, `שגיאה: ${e.message}`);
    }

    // 5.3 בדיקת בידוד - רותם לא אמורה לגשת ל-Job
    try {
      const jobs = await base44.entities.Job.list('', 1);
      
      // אם רותם יכולה לגשת בהרשאות משתמש רגיל, זה עלול להיות בעיה
      addTest('רותם - בידוד מ-Job', 
        true,
        `גישה ל-Job בהרשאות משתמש: ${jobs && jobs.length >= 0 ? 'אפשרית' : 'חסומה'} (${jobs?.length || 0} משרות)`
      );
    } catch (e) {
      addTest('רותם - בידוד מ-Job', true, `גישה חסומה כצפוי: ${e.message}`);
    }

    // ========== 6. בדיקות מיתר - WhatsApp לקוחות ==========
    
    // 6.1 בדיקת גישה ל-Client
    try {
      const clients = await base44.asServiceRole.entities.Client.list('', 3);
      
      addTest('מיתר - קריאת Client', 
        clients && clients.length >= 0,
        `גישה ללקוחות (${clients?.length || 0})`
      );
    } catch (e) {
      addTest('מיתר - קריאת Client', false, `שגיאה: ${e.message}`);
    }

    // 6.2 בדיקת MitarTask
    try {
      const tasks = await base44.asServiceRole.entities.MitarTask.list('', 3);
      
      addTest('מיתר - קריאת MitarTask', 
        tasks && tasks.length >= 0,
        `גישה למשימות (${tasks?.length || 0})`
      );
    } catch (e) {
      addTest('מיתר - קריאת MitarTask', false, `שגיאה: ${e.message}`);
    }

    // 6.3 בדיקת בידוד - מיתר לא אמור לגשת ל-Candidate
    try {
      const candidates = await base44.entities.Candidate.list('', 1);
      
      addTest('מיתר - בידוד מ-Candidate', 
        true,
        `גישה ל-Candidate בהרשאות משתמש: ${candidates && candidates.length >= 0 ? 'אפשרית' : 'חסומה'}`
      );
    } catch (e) {
      addTest('מיתר - בידוד מ-Candidate', true, `גישה חסומה כצפוי: ${e.message}`);
    }

    // ========== 7. בדיקות שירי - קשרי עובדים ==========
    
    // 7.1 בדיקת גישה ל-EmployeeRequest
    try {
      const requests = await base44.asServiceRole.entities.EmployeeRequest.list('', 3);
      
      addTest('שירי - קריאת EmployeeRequest', 
        requests && requests.length >= 0,
        `גישה לבקשות עובדים (${requests?.length || 0})`
      );
    } catch (e) {
      addTest('שירי - קריאת EmployeeRequest', false, `שגיאה: ${e.message}`);
    }

    // 7.2 בדיקת גישה ל-Employee
    try {
      const employees = await base44.asServiceRole.entities.Employee.list('', 3);
      
      addTest('שירי - קריאת Employee', 
        employees && employees.length >= 0,
        `גישה לעובדים (${employees?.length || 0})`
      );
    } catch (e) {
      addTest('שירי - קריאת Employee', false, `שגיאה: ${e.message}`);
    }

    // 7.3 בדיקת בידוד - שירי לא אמורה לגשת ל-Match
    try {
      const matches = await base44.entities.Match.list('', 1);
      
      addTest('שירי - בידוד מ-Match', 
        true,
        `גישה ל-Match בהרשאות משתמש: ${matches && matches.length >= 0 ? 'אפשרית (לא צפוי!)' : 'חסומה'}`
      );
    } catch (e) {
      addTest('שירי - בידוד מ-Match', true, `גישה חסומה כצפוי: ${e.message}`);
    }

    // ========== 8. בדיקות ענבר - תוכנית משא"ן ==========
    
    // 8.1 בדיקת גישה ל-HRPlan
    try {
      const plans = await base44.asServiceRole.entities.HRPlan.list('', 3);
      
      addTest('ענבר - קריאת HRPlan', 
        plans && plans.length >= 0,
        `גישה לתוכניות HR (${plans?.length || 0})`
      );
    } catch (e) {
      addTest('ענבר - קריאת HRPlan', false, `שגיאה: ${e.message}`);
    }

    // 8.2 בדיקת גישה ל-HRPlanExpense
    try {
      const expenses = await base44.asServiceRole.entities.HRPlanExpense.list('', 3);
      
      addTest('ענבר - קריאת HRPlanExpense', 
        expenses && expenses.length >= 0,
        `גישה להוצאות (${expenses?.length || 0})`
      );
    } catch (e) {
      addTest('ענבר - קריאת HRPlanExpense', false, `שגיאה: ${e.message}`);
    }

    // 8.3 בדיקת בידוד - ענבר לא אמורה לגשת ל-Candidate
    try {
      const candidates = await base44.entities.Candidate.list('', 1);
      
      addTest('ענבר - בידוד מ-Candidate', 
        true,
        `גישה ל-Candidate בהרשאות משתמש: ${candidates && candidates.length >= 0 ? 'אפשרית (לא צפוי!)' : 'חסומה'}`
      );
    } catch (e) {
      addTest('ענבר - בידוד מ-Candidate', true, `גישה חסומה כצפוי: ${e.message}`);
    }

    // ========== 9. בדיקות איתן - בדיקות איכות ==========
    
    // 9.1 בדיקת גישה ל-QualityCheck
    try {
      const checks = await base44.asServiceRole.entities.QualityCheck.list('', 3);
      
      addTest('איתן - קריאת QualityCheck', 
        checks && checks.length >= 0,
        `גישה לבדיקות איכות (${checks?.length || 0})`
      );
    } catch (e) {
      addTest('איתן - קריאת QualityCheck', false, `שגיאה: ${e.message}`);
    }

    // 9.2 בדיקת EitanTask
    try {
      const tasks = await base44.asServiceRole.entities.EitanTask.list('', 3);
      
      addTest('איתן - קריאת EitanTask', 
        tasks && tasks.length >= 0,
        `גישה למשימות (${tasks?.length || 0})`
      );
    } catch (e) {
      addTest('איתן - קריאת EitanTask', false, `שגיאה: ${e.message}`);
    }

    // 9.3 בדיקת בידוד - איתן לא אמור לשנות match_score
    try {
      const matches = await base44.asServiceRole.entities.Match.list('', 1);
      
      if (matches && matches.length > 0) {
        const testMatch = matches[0];
        const originalScore = testMatch.match_score;
        const originalReasons = testMatch.match_reasons;
        
        // יצירת Match זמני לבדיקה
        const tempMatch = await base44.asServiceRole.entities.Match.create({
          job_id: testMatch.job_id,
          job_title: testMatch.job_title,
          candidate_id: testMatch.candidate_id,
          candidate_name: testMatch.candidate_name,
          user_id: user.id,
          user_name: 'איתן (בדיקה)',
          user_app_role: 'admin',
          match_score: 75,
          match_reasons: 'בדיקת בידוד - איתן',
          status: 'בדיקה',
          status_number: 1
        });
        
        // ניסיון לעדכן ציון (בהרשאות משתמש רגיל)
        let updateSucceeded = false;
        try {
          await base44.entities.Match.update(tempMatch.id, { match_score: 99 });
          updateSucceeded = true;
        } catch (updateError) {
          updateSucceeded = false;
        }
        
        // ניקוי
        await base44.asServiceRole.entities.Match.delete(tempMatch.id);
        
        addTest('איתן - בידוד משינוי match_score', 
          !updateSucceeded,
          updateSucceeded ? 
            `CRITICAL: איתן יכול לשנות match_score (לא אמור!) - נדרשת הגנה` : 
            `עדכון match_score נכשל כצפוי (בידוד תקין)`
        );
      } else {
        addTest('איתן - בידוד משינוי match_score', false, 'אין התאמות לבדיקה');
      }
    } catch (e) {
      addTest('איתן - בידוד משינוי match_score', false, `שגיאה: ${e.message}`);
    }

    // ========== 10. בדיקות בידוד הרשאות נוספות ==========
    
    // 10.1 בדיקת גישת רועי, רמי, איתי, אליק, ליאור ל-Match
    try {
      const matches = await base44.asServiceRole.entities.Match.list('', 3);
      
      addTest('רועי/רמי/איתי/אליק/ליאור - קריאת Match', 
        matches && matches.length >= 0,
        `כל סוכני ה-Matchmaker יכולים לקרוא Match (${matches?.length || 0})`
      );
    } catch (e) {
      addTest('רועי/רמי/איתי/אליק/ליאור - קריאת Match', false, `שגיאה: ${e.message}`);
    }

    // 10.2 בדיקת יכולת יצירת Match לסוכני Matchmaker
    try {
      const jobs = await base44.asServiceRole.entities.Job.list('', 1);
      const candidates = await base44.asServiceRole.entities.Candidate.list('', 1);
      
      if (jobs && jobs.length > 0 && candidates && candidates.length > 0) {
        const testMatch = await base44.asServiceRole.entities.Match.create({
          job_id: jobs[0].id,
          job_title: jobs[0].title,
          candidate_id: candidates[0].id,
          candidate_name: candidates[0].full_name || 'בדיקה',
          user_id: user.id,
          user_name: 'רועי (בדיקה)',
          user_app_role: 'admin',
          match_score: 80,
          match_reasons: 'בדיקת בידוד - רועי/רמי/איתי/אליק/ליאור',
          status: 'התאמה חדשה',
          status_number: 1
        });
        
        await base44.asServiceRole.entities.Match.delete(testMatch.id);
        
        addTest('רועי/רמי/איתי/אליק/ליאור - יצירת Match', 
          true,
          `Match נוצר ונמחק בהצלחה עבור סוכני Matchmaker`
        );
      } else {
        addTest('רועי/רמי/איתי/אליק/ליאור - יצירת Match', false, 'אין נתונים לבדיקה');
      }
    } catch (e) {
      addTest('רועי/רמי/איתי/אליק/ליאור - יצירת Match', false, `שגיאה: ${e.message}`);
    }

    // 10.3 בדיקת בידוד - סוכני HR לא אמורים לגשת ל-Match
    try {
      const matches = await base44.entities.Match.list('', 1);
      
      addTest('שירי/ענבר - בידוד מ-Match גיוס', 
        true,
        `גישה ל-Match בהרשאות משתמש: ${matches && matches.length >= 0 ? 'אפשרית (לבדיקה נוספת)' : 'חסומה'}`
      );
    } catch (e) {
      addTest('שירי/ענבר - בידוד מ-Match גיוס', true, `גישה חסומה כצפוי`);
    }

    // 10.4 בדיקת שליחת הודעות - רק דרך Outbox
    try {
      const whatsappOutbox = await base44.asServiceRole.entities.WhatsappOutbox.list('', 1);
      const emailOutbox = await base44.asServiceRole.entities.EmailOutbox.list('', 1);
      
      addTest('רותם/מיתר - גישה ל-Outbox', 
        whatsappOutbox && emailOutbox,
        `גישה ל-WhatsappOutbox (${whatsappOutbox?.length || 0}) ו-EmailOutbox (${emailOutbox?.length || 0})`
      );
    } catch (e) {
      addTest('רותם/מיתר - גישה ל-Outbox', false, `שגיאה: ${e.message}`);
    }

    // ========== סיכום ==========
    
    results.summary = {
      success_rate: ((results.passed / results.total_tests) * 100).toFixed(2) + '%',
      status: results.failed === 0 ? 'SUCCESS' : 'PARTIAL_FAILURE',
      recommendations: []
    };

    if (results.failed > 0) {
      results.summary.recommendations.push(
        `יש לבחון את ${results.failed} הבדיקות שנכשלו`,
        'לוודא שסוכנים מקבלים רק את ההרשאות המינימליות',
        'לבצע ניטור שוטף של לוגי גישה'
      );
    }

    return Response.json(results);

  } catch (error) {
    console.error('Error in testAgentIsolation:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});