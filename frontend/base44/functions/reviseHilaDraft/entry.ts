import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { draftId, revisionNotes } = await req.json();

    if (!draftId || !revisionNotes) {
      return Response.json({ error: 'חסרים פרטים נדרשים' }, { status: 400 });
    }

    // Get the draft
    const drafts = await base44.entities.HilaDraft.filter({ id: draftId });
    if (drafts.length === 0) {
      return Response.json({ error: 'טיוטה לא נמצאה' }, { status: 404 });
    }
    const draft = drafts[0];

    // Get Hila settings for manager email
    const schedules = await base44.entities.HilaSchedule.list('-updated_date', 1);
    const settings = schedules.length > 0 ? schedules[0] : null;

    // Update draft status to needs_revision
    await base44.entities.HilaDraft.update(draftId, {
      status: 'needs_revision',
      revision_notes: revisionNotes,
      revision_count: (draft.revision_count || 0) + 1
    });

    // Get past revision notes to learn from
    let pastLearnings = '';
    try {
      const allDrafts = await base44.entities.HilaDraft.filter({ status: { $in: ['approved', 'sent'] } }, '-created_date', 10);
      const draftsWithNotes = allDrafts.filter(d => d.revision_notes && d.revision_count > 0);
      if (draftsWithNotes.length > 0) {
        pastLearnings = `\n\nלמידה מהערות קודמות של כרמית (שימי לב לא לחזור על אותן טעויות):\n${draftsWithNotes.slice(0, 5).map(d => `- ${d.revision_notes}`).join('\n')}`;
      }
    } catch (e) {
      console.log('Could not load past learnings');
    }

    // Use LLM to revise the draft based on Carmit's notes
    const revisionPrompt = `אתה הילה, קופירייטרית בחברת גיוס. כרמית המנהלת שלך העבירה הערות על המייל השבועי שהכנת.

המייל המקורי:
נושא: ${draft.subject}
תוכן: ${draft.body}

הערות כרמית לתיקון:
${revisionNotes}
${pastLearnings}

הנחיות חשובות:
1. תקני את המייל בהתאם להערות של כרמית
2. וודאי שאין מידע פנימי או סודי שלא אמור לצאת לעובדים
3. וודאי שיש אזכור של תוכנית "חבר מביא חבר" והבונוס
4. וודאי שהטקסט מנוסח בצורה מקצועית והולמת
5. וודאי שאין שגיאות כתיב או מילים לא קשורות
6. למדי מההערות הקודמות ואל תחזרי על אותן טעויות

החזירי JSON עם:
{
  "subject": "נושא המייל המתוקן",
  "body": "תוכן המייל המתוקן",
  "changes_made": "רשימת השינויים שביצעת",
  "lessons_learned": "מה למדת מההערות לפעמים הבאות"
}`;

    const llmResponse = await base44.integrations.Core.InvokeLLM({
      prompt: revisionPrompt,
      response_json_schema: {
        type: "object",
        properties: {
          subject: { type: "string" },
          body: { type: "string" },
          changes_made: { type: "string" },
          lessons_learned: { type: "string" }
        },
        required: ["subject", "body", "changes_made", "lessons_learned"]
      }
    });

    // Create new revised draft
    const revisedDraft = await base44.entities.HilaDraft.create({
      subject: llmResponse.subject,
      body: llmResponse.body,
      jobs_count: draft.jobs_count,
      status: 'pending_approval',
      revision_count: (draft.revision_count || 0) + 1,
      scheduled_send_time: draft.scheduled_send_time
    });

    // Notify Carmit about the revision
    if (settings?.manager_email) {
      await base44.integrations.Core.SendEmail({
        to: settings.manager_email,
        subject: `[תיקון מוכן] הילה תיקנה את המייל - סבב ${revisedDraft.revision_count}`,
        body: `שלום כרמית,

הילה תיקנה את המייל בהתאם להערות שלך.

📝 הערות שקיבלתי ממך:
${revisionNotes}

✅ שינויים שביצעתי:
${llmResponse.changes_made}

📚 מה למדתי לפעמים הבאות:
${llmResponse.lessons_learned}

📧 המייל המתוקן:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
נושא: ${llmResponse.subject}

${llmResponse.body}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

אנא בדקי את המייל המתוקן ואשרי אותו במערכת.
לאחר אישורך, המייל יופץ לעובדים ביום ובשעה שהוגדרו.

בברכה,
הילה`,
        from_name: 'הילה - PandaRecruitAI'
      });
    }

    return Response.json({ 
      success: true, 
      revisedDraftId: revisedDraft.id,
      changesMade: llmResponse.changes_made
    });

  } catch (error) {
    console.error('Error revising Hila draft:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});