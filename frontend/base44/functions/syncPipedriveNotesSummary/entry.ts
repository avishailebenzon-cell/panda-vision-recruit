import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Syncs the last 3 Pipedrive notes for all candidates that have a pipedrive_person_id.
// Runs monthly (1st of each month at 07:00).

const PIPEDRIVE_API_KEY = Deno.env.get('PIPEDRIVE_API_KEY');

async function getLastThreeNotes(personId) {
  const url = `https://api.pipedrive.com/v1/notes?person_id=${personId}&start=0&limit=3&sort=add_time+DESC&api_token=${PIPEDRIVE_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Pipedrive notes API error: ${res.status}`);
  const data = await res.json();
  return data.success ? (data.data || []) : [];
}

function formatNotesSummary(notes, candidateName) {
  if (!notes || notes.length === 0) {
    return null; // No notes - don't update
  }

  const lines = [`=== ${notes.length} notes אחרונים מ-Pipedrive עבור ${candidateName} ===\n`];

  notes.forEach((note, idx) => {
    const date = new Date(note.add_time).toLocaleDateString('he-IL', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
    lines.push(`[${idx + 1}] ${date} - ${note.user?.name || 'לא ידוע'}`);
    lines.push(note.content || '(ללא תוכן)');
    lines.push('─'.repeat(50));
    lines.push('');
  });

  return lines.join('\n');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    if (!PIPEDRIVE_API_KEY) {
      return Response.json({ error: 'PIPEDRIVE_API_KEY not configured' }, { status: 500 });
    }

    console.log('=== Starting monthly Pipedrive notes summary sync ===');

    // Fetch all candidates that have a pipedrive_person_id
    const allCandidates = await base44.asServiceRole.entities.Candidate.list('-created_date', 5000);
    const candidates = allCandidates.filter(c => c.pipedrive_person_id && c.pipedrive_person_id.trim() !== '');

    console.log(`Found ${candidates.length} candidates with Pipedrive person ID out of ${allCandidates.length} total`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const candidate of candidates) {
      try {
        const notes = await getLastThreeNotes(candidate.pipedrive_person_id);
        const summary = formatNotesSummary(notes, candidate.full_name || `${candidate.first_name} ${candidate.last_name}`);

        if (summary) {
          await base44.asServiceRole.entities.Candidate.update(candidate.id, {
            pipedrive_notes_summary: summary
          });
          updated++;
          console.log(`Updated notes summary for: ${candidate.full_name} (${notes.length} notes)`);
        } else {
          skipped++;
          console.log(`Skipped (no notes): ${candidate.full_name}`);
        }

        // Small delay to avoid Pipedrive rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (err) {
        errors++;
        console.error(`Error processing candidate ${candidate.full_name}:`, err.message);
      }
    }

    const summary = { total: candidates.length, updated, skipped, errors };
    console.log('=== Sync complete ===', summary);

    try {
      await base44.asServiceRole.entities.SystemActivityLog.create({
        actor_type: 'system',
        actor_name: 'scheduler',
        action_type: 'pipedrive_sync',
        action_description: `סיכום notes מ-Pipedrive: ${updated} עודכנו, ${skipped} ללא notes, ${errors} שגיאות`,
        status: errors > 0 ? 'failed' : 'success',
        details: JSON.stringify(summary)
      });
    } catch (logErr) {
      console.warn('Failed to log activity:', logErr.message);
    }

    return Response.json({ success: true, ...summary });

  } catch (error) {
    console.error('Fatal error in syncPipedriveNotesSummary:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});