import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get current date
    const now = new Date();
    const threeWeeksFromNow = new Date(now.getTime() + (21 * 24 * 60 * 60 * 1000)); // 21 days = 3 weeks
    
    // Get all approved and in-progress HR plans
    const plans = await base44.asServiceRole.entities.HRPlan.filter({
      status: { $in: ['approved', 'in_progress'] }
    });
    
    if (!plans || plans.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'אין תוכניות פעילות',
        remindersSent: 0 
      });
    }
    
    const remindersSent = [];
    
    // Check each plan for upcoming events
    for (const plan of plans) {
      // Get all expenses for this plan
      const expenses = await base44.asServiceRole.entities.HRPlanExpense.filter({
        plan_id: plan.id,
        status: { $in: ['planned', 'in_progress'] }
      });
      
      // Check if plan is ending soon - find last event date
      if (expenses.length > 0) {
        const eventDates = expenses
          .filter(e => e.event_date)
          .map(e => new Date(e.event_date))
          .sort((a, b) => b - a); // Sort descending
        
        if (eventDates.length > 0) {
          const lastEventDate = eventDates[0];
          const daysUntilPlanEnd = Math.floor((lastEventDate - now) / (1000 * 60 * 60 * 24));
          
          // Send reminder 30 days (1 month) before plan ends
          if (daysUntilPlanEnd >= 28 && daysUntilPlanEnd <= 32) {
            // Check if we already sent a reminder for this plan
            const planReminderSent = plan.plan_ending_reminder_sent_date && 
              new Date(plan.plan_ending_reminder_sent_date) > new Date(now.getTime() - (14 * 24 * 60 * 60 * 1000)); // Within last 14 days
            
            if (!planReminderSent) {
              await base44.asServiceRole.integrations.Core.SendEmail({
                to: 'inbar@pandatech.co.il',
                subject: `⚠️ תוכנית משא"ן ${plan.year} מסתיימת בקרוב - יש להכין תוכנית חדשה`,
                body: `
שלום,

התראה חשובה מענבר - מנהלת תכנון משא"ן:

📅 תוכנית משא"ן ${plan.year} מתקרבת לסיום:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• תאריך האירוע האחרון: ${lastEventDate.toLocaleDateString('he-IL', { 
  weekday: 'long', 
  year: 'numeric', 
  month: 'long', 
  day: 'numeric' 
})}
• ימים עד סיום התוכנית: ${daysUntilPlanEnd}
• כמות אירועים בתוכנית: ${expenses.length}
• תקציב כולל: ₪${plan.total_budget?.toLocaleString('he-IL') || 'לא הוגדר'}

⚠️ פעולות נדרשות:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ להתחיל לתכנן את תוכנית ${plan.year + 1}
✓ לבחון תקציב ולקבל אישורים
✓ לתאם אירועים וחגים לשנה הבאה
✓ לבדוק ספקים ולעדכן מחירים
✓ לעדכן את מספר העובדים הצפוי

💡 המלצה:
היכנסו לדף "ענבר - תוכנית משא"ן" ופתחו שיחה עם ענבר כדי להתחיל לתכנן את תוכנית ${plan.year + 1}.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
תזכורת אוטומטית - חודש לפני סיום התוכנית
PandaHRAI - מערכת ניהול משאבי אנוש
                `,
                from_name: 'ענבר - תזכורות משא"ן'
              });
              
              // Update plan to mark reminder as sent
              await base44.asServiceRole.entities.HRPlan.update(plan.id, {
                plan_ending_reminder_sent_date: now.toISOString()
              });
              
              remindersSent.push({
                type: 'plan_ending',
                plan_year: plan.year,
                last_event_date: lastEventDate.toISOString(),
                days_until_end: daysUntilPlanEnd
              });
            }
          }
        }
      }
      
      for (const expense of expenses) {
        if (!expense.event_date) continue;
        
        const eventDate = new Date(expense.event_date);
        
        // Check if event is exactly 3 weeks away (within 1 day margin)
        const daysUntilEvent = Math.floor((eventDate - now) / (1000 * 60 * 60 * 24));
        
        if (daysUntilEvent >= 20 && daysUntilEvent <= 22) {
          // Check if we already sent a reminder for this expense
          const alreadySent = expense.reminder_sent_date && 
            new Date(expense.reminder_sent_date) > new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)); // Within last 7 days
          
          if (!alreadySent) {
            // Send email reminder
            await base44.asServiceRole.integrations.Core.SendEmail({
              to: 'inbar@pandatech.co.il',
              subject: `תזכורת: ${expense.event_name} מתקרב - ${daysUntilEvent} ימים`,
              body: `
שלום,

תזכורת חשובה מענבר - מנהלת תכנון משא"ן:

📅 אירוע מתקרב:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• שם האירוע: ${expense.event_name}
• תאריך: ${new Date(expense.event_date).toLocaleDateString('he-IL', { 
  weekday: 'long', 
  year: 'numeric', 
  month: 'long', 
  day: 'numeric' 
})}
• ימים עד האירוע: ${daysUntilEvent}
• סוג: ${expense.expense_type === 'holiday' ? 'חג' : 
         expense.expense_type === 'special_event' ? 'אירוע מיוחד' : 
         expense.expense_type === 'forum' ? 'פורום' : 
         expense.expense_type === 'birthday' ? 'יום הולדת' : 
         expense.expense_type === 'orientation' ? 'יום קליטה' : 
         expense.expense_type === 'toast' ? 'הרמת כוסית' : 'אחר'}

💰 תקציב:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• תקציב מתוכנן: ₪${expense.planned_total_cost?.toLocaleString('he-IL')}
• לעובד: ₪${expense.planned_cost_per_employee?.toLocaleString('he-IL')}
• כמות עובדים: ${expense.employee_count || plan.employee_count}

${expense.supplier ? `🏪 ספק: ${expense.supplier}${expense.supplier_link ? `\nקישור: ${expense.supplier_link}` : ''}` : ''}

${expense.description ? `📝 פרטים נוספים:\n${expense.description}` : ''}

${expense.notes ? `💡 הערות:\n${expense.notes}` : ''}

⚠️ זהו הזמן להתחיל להיערך:
• לוודא זמינות ספק
• לאשר תקציב סופי
• לתאם לוגיסטיקה
• להכין תקשורת לעובדים

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
תוכנית משא"ן ${plan.year}
PandaHRAI - מערכת ניהול משאבי אנוש
              `,
              from_name: 'ענבר - תזכורות משא"ן'
            });
            
            // Update expense to mark reminder as sent
            await base44.asServiceRole.entities.HRPlanExpense.update(expense.id, {
              reminder_sent_date: now.toISOString()
            });
            
            remindersSent.push({
              event_name: expense.event_name,
              event_date: expense.event_date,
              days_until: daysUntilEvent
            });
          }
        }
      }
    }
    
    return Response.json({
      success: true,
      message: `נבדקו ${plans.length} תוכניות`,
      remindersSent: remindersSent.length,
      reminders: remindersSent
    });
    
  } catch (error) {
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});