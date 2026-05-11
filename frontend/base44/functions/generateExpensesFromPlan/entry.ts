import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { plan_id } = await req.json();

    if (!plan_id) {
      return Response.json({ error: 'plan_id is required' }, { status: 400 });
    }

    // Get the plan
    const plan = await base44.entities.HRPlan.get(plan_id);
    
    if (!plan) {
      return Response.json({ error: 'Plan not found' }, { status: 404 });
    }

    // Check if expenses already exist for this plan
    const existingExpenses = await base44.asServiceRole.entities.HRPlanExpense.filter({ plan_id });
    
    if (existingExpenses.length > 0) {
      return Response.json({ 
        message: 'Expenses already exist for this plan',
        count: existingExpenses.length 
      });
    }

    const expensesToCreate = [];

    // Create expenses from holiday events
    if (plan.holiday_events && Array.isArray(plan.holiday_events)) {
      for (const event of plan.holiday_events) {
        expensesToCreate.push({
          plan_id: plan.id,
          plan_year: plan.year,
          expense_type: 'holiday',
          event_name: event.holiday_name || 'חג ללא שם',
          event_date: event.date,
          description: event.gift_options?.join(', ') || '',
          planned_cost_per_employee: event.estimated_cost_per_employee || 0,
          planned_total_cost: event.estimated_total_cost || 0,
          employee_count: plan.employee_count,
          status: event.status || 'planned',
          supplier_link: event.supplier_links?.[0] || '',
          notes: event.notes || ''
        });
      }
    }

    // Create expenses from fixed expenses
    if (plan.fixed_expenses) {
      if (plan.fixed_expenses.birthday_gifts) {
        expensesToCreate.push({
          plan_id: plan.id,
          plan_year: plan.year,
          expense_type: 'birthday',
          event_name: 'מתנות יום הולדת לעובדים',
          description: 'מתנה אישית פעם בשנה לכל עובד',
          planned_cost_per_employee: plan.fixed_expenses.birthday_gifts.cost_per_employee || 200,
          planned_total_cost: plan.fixed_expenses.birthday_gifts.total || 0,
          employee_count: plan.employee_count,
          status: 'planned'
        });
      }

      if (plan.fixed_expenses.passover_bonus) {
        expensesToCreate.push({
          plan_id: plan.id,
          plan_year: plan.year,
          expense_type: 'holiday',
          event_name: 'מתנת פסח - שי לחג',
          event_date: '01.04.' + plan.year,
          description: 'כרטיס מקס 1,000 שח לעובד',
          planned_cost_per_employee: plan.fixed_expenses.passover_bonus.cost_per_employee || 1000,
          planned_total_cost: plan.fixed_expenses.passover_bonus.total || 0,
          employee_count: plan.employee_count,
          status: 'planned'
        });
      }

      if (plan.fixed_expenses.orientation_days) {
        expensesToCreate.push({
          plan_id: plan.id,
          plan_year: plan.year,
          expense_type: 'orientation',
          event_name: 'ימי קליטה חודשיים',
          description: 'תקציב ברנץ ומתנות ממותגות',
          planned_cost_per_employee: 0,
          planned_total_cost: plan.fixed_expenses.orientation_days.annual_total || 50000,
          employee_count: plan.employee_count,
          status: 'planned',
          notes: 'אחת לחודש'
        });
      }

      if (plan.fixed_expenses.leadership_forums) {
        expensesToCreate.push({
          plan_id: plan.id,
          plan_year: plan.year,
          expense_type: 'forum',
          event_name: 'פורום מובילים',
          description: 'מפגשי פורום מובילים',
          planned_cost_per_employee: 0,
          planned_total_cost: plan.fixed_expenses.leadership_forums.estimated_total || 10000,
          employee_count: plan.employee_count,
          status: 'planned'
        });
      }

      if (plan.fixed_expenses.toast_events) {
        expensesToCreate.push({
          plan_id: plan.id,
          plan_year: plan.year,
          expense_type: 'toast',
          event_name: 'הרמת כוסית (x2)',
          description: 'ראש השנה ופסח',
          planned_cost_per_employee: 0,
          planned_total_cost: plan.fixed_expenses.toast_events.total || 6000,
          employee_count: plan.employee_count,
          status: 'planned',
          notes: plan.fixed_expenses.toast_events.notes || ''
        });
      }
    }

    // Bulk create expenses
    if (expensesToCreate.length > 0) {
      await base44.asServiceRole.entities.HRPlanExpense.bulkCreate(expensesToCreate);
    }

    return Response.json({ 
      success: true,
      message: 'Expenses created successfully',
      count: expensesToCreate.length
    });

  } catch (error) {
    console.error('Error generating expenses:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});