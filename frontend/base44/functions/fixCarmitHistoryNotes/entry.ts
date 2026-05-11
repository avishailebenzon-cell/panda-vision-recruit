import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get all Carmit's notes
    const carmitNotes = await base44.entities.MatchNote.filter({
      user_name: 'כרמית (סוכן AI)'
    }, '-created_date', 1000);

    let updatedCount = 0;

    for (const note of carmitNotes) {
      const oldText = note.note_text;
      let newText = oldText;

      // Replace old text patterns
      newText = newText.replace(/העברתי לרותם \(במקום טל\)/g, 'העברתי לטל');
      newText = newText.replace(/העברתי לנועם \(במקום טל\)/g, 'העברתי לטל');

      // If text changed, update the note
      if (newText !== oldText) {
        try {
          await base44.entities.MatchNote.update(note.id, {
            note_text: newText
          });
          updatedCount++;
          console.log(`Updated note ${note.id}: Fixed old text patterns`);
        } catch (error) {
          console.error(`Failed to update note ${note.id}:`, error.message);
        }
      }
    }

    return Response.json({
      success: true,
      message: `Fixed ${updatedCount} notes with old text patterns`,
      updatedCount
    });

  } catch (error) {
    console.error('Error fixing Carmit history:', error);
    return Response.json({ 
      error: error.message,
      success: false
    }, { status: 500 });
  }
});