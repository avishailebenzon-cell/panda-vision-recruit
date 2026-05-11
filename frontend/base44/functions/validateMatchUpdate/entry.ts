import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * פונקציית הגנה על עדכון Match - מונעת משינוי שדות קריטיים על ידי משתמשים לא מורשים
 * נועדה להיקרא מ-entity automation על Match update
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { event, data, old_data } = await req.json();
    
    // שדות קריטיים שרק סוכני Matchmaker רשאים לעדכן
    const protectedFields = [
      'match_score',
      'match_reasons', 
      'detailed_analysis',
      'geo_status',
      'geo_distance_km'
    ];
    
    // רשימת סוכני Matchmaker מורשים (על בסיס user_name או app_role)
    const authorizedMatchmakers = [
      'נעמה',
      'רועי', 
      'רמי',
      'אליק',
      'איתי',
      'ליאור',
      'אופיר',
      'GC',
      'כרמית' // כרמית יכולה גם לעדכן
    ];
    
    // Admin תמיד מורשה
    if (user.role === 'admin') {
      return Response.json({ 
        status: 'allowed',
        reason: 'Admin user - full permissions'
      });
    }
    
    // בדיקה אם המשתמש הוא סוכן Matchmaker מורשה
    const isAuthorizedMatchmaker = authorizedMatchmakers.some(name => 
      user.full_name?.includes(name)
    );
    
    // בדיקה אם יש שינוי בשדה קריטי
    const hasProtectedFieldChange = protectedFields.some(field => {
      return data && old_data && data[field] !== old_data[field];
    });
    
    if (hasProtectedFieldChange && !isAuthorizedMatchmaker) {
      // חזרה למצב הקודם
      await base44.asServiceRole.entities.Match.update(data.id, {
        match_score: old_data.match_score,
        match_reasons: old_data.match_reasons,
        detailed_analysis: old_data.detailed_analysis,
        geo_status: old_data.geo_status,
        geo_distance_km: old_data.geo_distance_km
      });
      
      return Response.json({ 
        status: 'blocked',
        reason: `משתמש ${user.full_name} אינו מורשה לעדכן שדות קריטיים ב-Match`,
        reverted: true
      });
    }
    
    return Response.json({ 
      status: 'allowed',
      reason: isAuthorizedMatchmaker ? 'Authorized matchmaker' : 'No protected fields changed'
    });

  } catch (error) {
    console.error('Error in validateMatchUpdate:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});