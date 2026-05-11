import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { candidateIdToKeep, candidateIdToMerge, mergedData } = await req.json();

    if (!candidateIdToKeep || !candidateIdToMerge) {
      return Response.json({ error: 'Missing candidate IDs' }, { status: 400 });
    }

    if (candidateIdToKeep === candidateIdToMerge) {
      return Response.json({ error: 'Cannot merge a candidate with itself' }, { status: 400 });
    }

    // Get both candidates
    const candidateToKeep = await base44.entities.Candidate.filter({ id: candidateIdToKeep });
    const candidateToMerge = await base44.entities.Candidate.filter({ id: candidateIdToMerge });

    if (!candidateToKeep.length || !candidateToMerge.length) {
      return Response.json({ error: 'Candidate not found' }, { status: 404 });
    }

    const keepCandidate = candidateToKeep[0];
    const mergeCandidate = candidateToMerge[0];

    // Update the kept candidate with merged data
    await base44.asServiceRole.entities.Candidate.update(candidateIdToKeep, mergedData);

    console.log('Starting to transfer related entities...');
    
    const newCandidateName = `${mergedData.first_name} ${mergedData.last_name}`;
    
    // Update all related entities one by one
    let totalTransferred = 0;
    
    // 1. Update Matches
    const matches = await base44.asServiceRole.entities.Match.filter({ candidate_id: candidateIdToMerge });
    for (const match of matches) {
      await base44.asServiceRole.entities.Match.update(match.id, {
        candidate_id: candidateIdToKeep,
        candidate_name: newCandidateName
      });
    }
    totalTransferred += matches.length;
    
    // 2. Update RotemTasks
    const rotemTasks = await base44.asServiceRole.entities.RotemTask.filter({ candidate_id: candidateIdToMerge });
    for (const task of rotemTasks) {
      await base44.asServiceRole.entities.RotemTask.update(task.id, {
        candidate_id: candidateIdToKeep,
        candidate_name: newCandidateName,
        candidate_phone: mergedData.phone_primary || task.candidate_phone
      });
    }
    totalTransferred += rotemTasks.length;
    
    // 3. Update EmailOutbox
    const emailOutbox = await base44.asServiceRole.entities.EmailOutbox.filter({ candidate_id: candidateIdToMerge });
    for (const email of emailOutbox) {
      await base44.asServiceRole.entities.EmailOutbox.update(email.id, {
        candidate_id: candidateIdToKeep,
        candidate_name: newCandidateName
      });
    }
    totalTransferred += emailOutbox.length;
    
    // 4. Update WhatsappOutbox
    const whatsappOutbox = await base44.asServiceRole.entities.WhatsappOutbox.filter({ candidate_id: candidateIdToMerge });
    for (const whatsapp of whatsappOutbox) {
      await base44.asServiceRole.entities.WhatsappOutbox.update(whatsapp.id, {
        candidate_id: candidateIdToKeep,
        candidate_name: newCandidateName
      });
    }
    totalTransferred += whatsappOutbox.length;
    
    // 5. Update HilaCvInbox
    const hilaCvInbox = await base44.asServiceRole.entities.HilaCvInbox.filter({ candidate_id: candidateIdToMerge });
    for (const hilaEntry of hilaCvInbox) {
      await base44.asServiceRole.entities.HilaCvInbox.update(hilaEntry.id, {
        candidate_id: candidateIdToKeep,
        candidate_name: newCandidateName
      });
    }
    totalTransferred += hilaCvInbox.length;
    
    // 6. Update NewCandidateInbox
    const inboxEntries = await base44.asServiceRole.entities.NewCandidateInbox.filter({ candidate_id: candidateIdToMerge });
    for (const entry of inboxEntries) {
      await base44.asServiceRole.entities.NewCandidateInbox.update(entry.id, {
        candidate_id: candidateIdToKeep,
        candidate_name: newCandidateName
      });
    }
    totalTransferred += inboxEntries.length;
    
    // 7. Update EladTask
    const eladTasks = await base44.asServiceRole.entities.EladTask.filter({ candidate_id: candidateIdToMerge });
    for (const task of eladTasks) {
      await base44.asServiceRole.entities.EladTask.update(task.id, {
        candidate_id: candidateIdToKeep,
        candidate_name: newCandidateName
      });
    }
    totalTransferred += eladTasks.length;
    
    // 8. Update ScannedFileLog
    const scannedFiles = await base44.asServiceRole.entities.ScannedFileLog.filter({ candidate_id: candidateIdToMerge });
    for (const file of scannedFiles) {
      await base44.asServiceRole.entities.ScannedFileLog.update(file.id, {
        candidate_id: candidateIdToKeep,
        candidate_name: newCandidateName
      });
    }
    totalTransferred += scannedFiles.length;
    
    // 9. Update ClientCvRequest
    const cvRequests = await base44.asServiceRole.entities.ClientCvRequest.filter({ candidate_id: candidateIdToMerge });
    for (const request of cvRequests) {
      await base44.asServiceRole.entities.ClientCvRequest.update(request.id, {
        candidate_id: candidateIdToKeep,
        candidate_name: newCandidateName
      });
    }
    totalTransferred += cvRequests.length;

    // Log the merge activity
    await base44.asServiceRole.entities.SystemActivityLog.create({
      actor_type: 'user',
      actor_name: user.full_name,
      action_type: 'candidate_updated',
      action_description: `מיזג מועמד "${mergeCandidate.full_name}" (${candidateIdToMerge}) לתוך "${keepCandidate.full_name}" (${candidateIdToKeep})`,
      entity_type: 'Candidate',
      entity_id: candidateIdToKeep,
      entity_name: `${mergedData.first_name} ${mergedData.last_name}`,
      status: 'success',
      details: JSON.stringify({
        mergedFrom: candidateIdToMerge,
        mergedTo: candidateIdToKeep,
        totalRecordsTransferred: totalTransferred
      })
    });

    // Delete the merged candidate
    await base44.asServiceRole.entities.Candidate.delete(candidateIdToMerge);

    return Response.json({ 
      success: true,
      message: `המועמדים מוזגו בהצלחה. ${totalTransferred} רשומות הועברו למועמד המאוחד.`,
      mergedCandidateId: candidateIdToKeep,
      transferredRecords: totalTransferred
    });

  } catch (error) {
    console.error('Error merging candidates:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});