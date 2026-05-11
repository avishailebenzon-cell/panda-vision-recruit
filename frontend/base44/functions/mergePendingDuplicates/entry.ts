import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { pendingId, action } = await req.json();

    if (!pendingId || !action) {
      return Response.json({ error: 'Missing pendingId or action' }, { status: 400 });
    }

    // Get the pending duplicate
    const pending = await base44.asServiceRole.entities.PendingDuplicateMerge.get(pendingId);

    if (!pending) {
      return Response.json({ error: 'Pending duplicate not found' }, { status: 404 });
    }

    // FIX: Check status inside data object (not top-level)
    if (pending.data?.status !== 'pending') {
      return Response.json({ error: 'Duplicate already processed' }, { status: 400 });
    }

    // FIX: Update status inside data object, not top-level
    await base44.asServiceRole.entities.PendingDuplicateMerge.update(pendingId, {
      data: {
        ...pending.data,
        status: action === 'approve' ? 'approved' : 'rejected'
      },
      reviewed_by: user.email,
      reviewed_date: new Date().toISOString()
    });

    // If approved, merge the candidates
    if (action === 'approve') {
      const candidateIds = pending.data.candidate_ids;

      // FIX: Use filter instead of get for consistent data access
      const candidates = (await Promise.all(
        candidateIds.map(id => base44.asServiceRole.entities.Candidate.filter({ id }))
      )).map(arr => arr[0]).filter(Boolean);

      if (candidates.length < 2) {
        return Response.json({ error: 'Could not find enough candidates to merge' }, { status: 404 });
      }

      // FIX: Count fields directly on candidate object (not candidate.data)
      let primary = candidates[0];
      for (const candidate of candidates) {
        const currentFields = Object.values(candidate).filter(v => v !== null && v !== undefined && v !== '').length;
        const primaryFields = Object.values(primary).filter(v => v !== null && v !== undefined && v !== '').length;
        if (currentFields > primaryFields) {
          primary = candidate;
        }
      }

      // FIX: Merge data from all candidates directly (not candidate.data)
      const mergedData = { ...primary };
      // Remove system fields that shouldn't be copied
      delete mergedData.id;
      delete mergedData.created_date;
      delete mergedData.updated_date;

      for (const candidate of candidates) {
        if (candidate.id === primary.id) continue;
        for (const [key, value] of Object.entries(candidate)) {
          if (['id', 'created_date', 'updated_date'].includes(key)) continue;
          if (value && !mergedData[key]) {
            mergedData[key] = value;
          }
        }
      }

      // Update primary candidate with merged data
      await base44.asServiceRole.entities.Candidate.update(primary.id, mergedData);

      const newCandidateName = `${mergedData.first_name || ''} ${mergedData.last_name || ''}`.trim() || primary.full_name;
      let totalTransferred = 0;

      // FIX: Transfer all related records before deleting duplicates
      for (const candidate of candidates) {
        if (candidate.id === primary.id) continue;
        const dupId = candidate.id;

        // 1. Transfer Matches
        const matches = await base44.asServiceRole.entities.Match.filter({ candidate_id: dupId });
        for (const match of matches) {
          await base44.asServiceRole.entities.Match.update(match.id, {
            candidate_id: primary.id,
            candidate_name: newCandidateName
          });
        }
        totalTransferred += matches.length;

        // 2. Transfer RotemTasks
        const rotemTasks = await base44.asServiceRole.entities.RotemTask.filter({ candidate_id: dupId });
        for (const task of rotemTasks) {
          await base44.asServiceRole.entities.RotemTask.update(task.id, {
            candidate_id: primary.id,
            candidate_name: newCandidateName,
            candidate_phone: mergedData.phone_primary || task.candidate_phone
          });
        }
        totalTransferred += rotemTasks.length;

        // 3. Transfer EmailOutbox
        const emailOutbox = await base44.asServiceRole.entities.EmailOutbox.filter({ candidate_id: dupId });
        for (const email of emailOutbox) {
          await base44.asServiceRole.entities.EmailOutbox.update(email.id, {
            candidate_id: primary.id,
            candidate_name: newCandidateName
          });
        }
        totalTransferred += emailOutbox.length;

        // 4. Transfer WhatsappOutbox
        const whatsappOutbox = await base44.asServiceRole.entities.WhatsappOutbox.filter({ candidate_id: dupId });
        for (const whatsapp of whatsappOutbox) {
          await base44.asServiceRole.entities.WhatsappOutbox.update(whatsapp.id, {
            candidate_id: primary.id,
            candidate_name: newCandidateName
          });
        }
        totalTransferred += whatsappOutbox.length;

        // 5. Transfer HilaCvInbox
        const hilaCvInbox = await base44.asServiceRole.entities.HilaCvInbox.filter({ candidate_id: dupId });
        for (const entry of hilaCvInbox) {
          await base44.asServiceRole.entities.HilaCvInbox.update(entry.id, {
            candidate_id: primary.id,
            candidate_name: newCandidateName
          });
        }
        totalTransferred += hilaCvInbox.length;

        // 6. Transfer NewCandidateInbox
        const inboxEntries = await base44.asServiceRole.entities.NewCandidateInbox.filter({ candidate_id: dupId });
        for (const entry of inboxEntries) {
          await base44.asServiceRole.entities.NewCandidateInbox.update(entry.id, {
            candidate_id: primary.id,
            candidate_name: newCandidateName
          });
        }
        totalTransferred += inboxEntries.length;

        // 7. Transfer EladTask
        const eladTasks = await base44.asServiceRole.entities.EladTask.filter({ candidate_id: dupId });
        for (const task of eladTasks) {
          await base44.asServiceRole.entities.EladTask.update(task.id, {
            candidate_id: primary.id,
            candidate_name: newCandidateName
          });
        }
        totalTransferred += eladTasks.length;

        // 8. Transfer ScannedFileLog
        const scannedFiles = await base44.asServiceRole.entities.ScannedFileLog.filter({ candidate_id: dupId });
        for (const file of scannedFiles) {
          await base44.asServiceRole.entities.ScannedFileLog.update(file.id, {
            candidate_id: primary.id,
            candidate_name: newCandidateName
          });
        }
        totalTransferred += scannedFiles.length;

        // 9. Transfer ClientCvRequest
        const cvRequests = await base44.asServiceRole.entities.ClientCvRequest.filter({ candidate_id: dupId });
        for (const request of cvRequests) {
          await base44.asServiceRole.entities.ClientCvRequest.update(request.id, {
            candidate_id: primary.id,
            candidate_name: newCandidateName
          });
        }
        totalTransferred += cvRequests.length;

        // Now delete the duplicate candidate
        await base44.asServiceRole.entities.Candidate.delete(dupId);
        console.log(`✓ Deleted duplicate candidate ${dupId}, transferred ${totalTransferred} records`);
      }

      // Log the merge activity
      const deletedNames = candidates
        .filter(c => c.id !== primary.id)
        .map(c => c.full_name || `${c.first_name} ${c.last_name}`)
        .join(', ');

      await base44.asServiceRole.entities.SystemActivityLog.create({
        actor_type: 'user',
        actor_name: user.full_name || user.email,
        action_type: 'candidate_updated',
        action_description: `מיזג כפילויות "${deletedNames}" לתוך "${newCandidateName}" (${primary.id})`,
        entity_type: 'Candidate',
        entity_id: primary.id,
        entity_name: newCandidateName,
        status: 'success',
        details: JSON.stringify({
          mergedFrom: candidates.filter(c => c.id !== primary.id).map(c => c.id),
          mergedTo: primary.id,
          totalRecordsTransferred: totalTransferred
        })
      });

      return Response.json({
        success: true,
        message: `מוזגו ${candidates.length} מועמדים לתוך "${newCandidateName}". ${totalTransferred} רשומות הועברו.`,
        primaryId: primary.id,
        deletedCount: candidates.length - 1,
        totalTransferred
      });
    }

    return Response.json({
      success: true,
      message: 'הכפילות נדחתה',
      action: 'rejected'
    });

  } catch (error) {
    console.error('Error in mergePendingDuplicates:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
