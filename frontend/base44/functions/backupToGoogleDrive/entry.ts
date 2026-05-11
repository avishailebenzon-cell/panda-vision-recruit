import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    console.log('Backup function started v2');
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      console.log('Access denied - not admin');
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { forceRun } = await req.json().catch(() => ({ forceRun: false }));
    console.log('Force run:', forceRun);

    // Get backup configuration
    console.log('Loading backup config...');
    const configs = await base44.asServiceRole.entities.BackupConfig.list();
    let config = configs[0];
    
    if (!config) {
      console.log('Creating default config');
      config = await base44.asServiceRole.entities.BackupConfig.create({
        is_enabled: true,
        backup_day: 0,
        backup_time: "02:00",
        last_backup_status: "never_run"
      });
    }
    console.log('Config loaded:', config.id);
    
    // Update status to in_progress immediately
    console.log('Updating status to in_progress');
    await base44.asServiceRole.entities.BackupConfig.update(config.id, {
      last_backup_status: 'in_progress'
    });
    
    // Return immediately - backup will run in background
    console.log('Starting background backup process');
    
    // Run backup in background (don't await)
    performBackup(base44, config, forceRun).catch(err => {
      console.error('Background backup failed:', err);
    });
    
    // Return success immediately
    return Response.json({
      success: true,
      message: 'הגיבוי החל ברקע - בדוק את הסטטוס בעוד מספר דקות',
      status: 'in_progress'
    });
    
  } catch (error) {
    console.error('BACKUP ERROR:', error.message);
    return Response.json({ 
      success: false,
      error: error.message
    }, { status: 500 });
  }
});
 
async function performBackup(base44, config, forceRun) {
  try {
    console.log('Background backup started');

    // Check if backup should run (unless forced)
    if (!forceRun) {
      if (!config.is_enabled) {
        console.log('Backup not enabled');
        await base44.asServiceRole.entities.BackupConfig.update(config.id, {
          last_backup_status: 'failed',
          last_backup_error: 'הגיבוי לא מופעל בהגדרות'
        });
        return;
      }

      const now = new Date();
      const currentDay = now.getDay();
      const currentHour = now.getHours();
      const [backupHour, backupMinute] = (config.backup_time || "02:00").split(':').map(Number);

      // Check if it's the right day and time (within a 1-hour window)
      if (currentDay !== config.backup_day) {
        console.log('Not the right day for backup');
        return;
      }

      if (Math.abs(currentHour - backupHour) > 1 && currentHour !== backupHour) {
        console.log('Not the right time for backup');
        return;
      }
    }

    // Get Google Drive access token
    console.log('Getting Google Drive access token...');
    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googledrive');

    if (!accessToken) {
      console.error('No Google Drive access token found');
      await base44.asServiceRole.entities.BackupConfig.update(config.id, {
        last_backup_status: 'failed',
        last_backup_error: 'לא נמצא טוקן גישה ל-Google Drive',
        last_backup_date: new Date().toISOString()
      });
      return Response.json({ 
        success: false,
        error: 'Google Drive not connected - Please reconnect in Management settings' 
      }, { status: 500 });
    }
    console.log('Access token obtained');

    // List of all entities to backup
    const entityNames = [
      'Candidate', 'Job', 'Client', 'Match', 'RotemTask', 'BackupConfig',
      'CandidateStatus', 'MatchNote', 'AccessLog', 'SearchLog', 'DropboxRunLog',
      'NewCandidateInbox', 'EmailOutbox', 'NewJobInbox', 'WhatsappOutbox',
      'DropboxCandidateLog', 'DropboxConfig', 'UserInvitation', 'CandidateInterview',
      'ContactPerson', 'DropboxFileRegistry', 'MailScanStatus', 'EmailScanLog',
      'ScannedFileLog', 'MessageCounter', 'AgentRunStatus', 'PipedriveSyncStatus',
      'PipedriveSyncSchedule', 'AgentSchedule', 'HilaSchedule', 'HilaDraft',
      'RavivLog', 'EladSchedule', 'SystemActivityLog', 'EmployeeRequest', 'Employee',
      'ShiriSchedule', 'HilaCvInbox', 'WhatsappConversation', 'AgentConfig',
      'HRPlan', 'HRPlanExpense', 'AgentDisplayConfig', 'EmailServiceConfig',
      'EmailLog', 'HQContact', 'ShiriTrainingData', 'WhatsappMessage', 'HilaRunLog',
      'RotemIncomingMessage', 'QualityCheck', 'EitanTask', 'EitanSchedule',
      'CarmitLearning', 'CarmitRotemLearning', 'CvEnhancementLog', 'HilaSettings',
      'HilaCampaign', 'HilaMailLog', 'CarmitAgentQuery', 'ConversationTask',
      'GeoCity', 'GeoFitResult', 'MitarTask', 'WhatsappConversationMitar',
      'WhatsappMessageMitar', 'EladTask', 'EladSettings', 'JobUpdateLog',
      'EitanSettings', 'MitarThinkingLog', 'RotemThinkingLog', 'ClientCvRequest',
      'CandidateLead', 'AgentInquiry', 'WhatsappConversationShacahr', 'WhatsappMessageShacahr',
      'SynonymMapping', 'HelpTopic'
    ];
    
    let totalRecords = 0;
    let filesCreated = 0;
    const backupData = {};

    // Collect data from all entities
    console.log(`Starting to backup ${entityNames.length} entities...`);
    for (const entityName of entityNames) {
      try {
        const records = await base44.asServiceRole.entities[entityName].list('', 10000);
        backupData[entityName] = Array.isArray(records) ? records : [];
        totalRecords += backupData[entityName].length;
        if (backupData[entityName].length > 0) {
          console.log(`✓ Backed up ${backupData[entityName].length} records from ${entityName}`);
        }
      } catch (err) {
        console.error(`✗ Failed to backup ${entityName}:`, err.message);
        backupData[entityName] = [];
      }
    }
    console.log(`Total records collected: ${totalRecords}`);

    // Create a single backup file with all data and metadata
    const backupPayload = {
      backup_date: new Date().toISOString(),
      app_name: "PandaHRAI",
      total_entities: entityNames.length,
      total_records: totalRecords,
      entities: backupData
    };

    const fileContent = JSON.stringify(backupPayload, null, 2);
    const fileName = `PandaHRAI_Backup_${new Date().toISOString().split('T')[0]}.json`;
    console.log(`Backup file created: ${fileName}, size: ${(fileContent.length / 1024 / 1024).toFixed(2)}MB`);

    // Upload to Google Drive
    const folderId = config.google_drive_folder_id;
    console.log('Folder ID:', folderId || 'Root folder');
    
    // First, try to find existing backup file and delete it
    if (folderId) {
      try {
        const searchResponse = await fetch(
          `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+name+contains+'PandaHRAI_Backup'&fields=files(id,name)`,
          {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          }
        );
        
        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          for (const file of searchData.files || []) {
            await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            console.log(`Deleted old backup: ${file.name}`);
          }
        }
      } catch (searchErr) {
        console.error('Error searching/deleting old backups:', searchErr.message);
      }
    }

    // Upload new backup file
    const metadata = {
      name: fileName,
      mimeType: 'application/json'
    };

    if (folderId) {
      metadata.parents = [folderId];
    }

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([fileContent], { type: 'application/json' }));

    console.log('Uploading to Google Drive...');
    const uploadResponse = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        body: form
      }
    );

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('Upload failed:', errorText);
      throw new Error(`Google Drive upload failed: ${errorText}`);
    }

    const uploadData = await uploadResponse.json();
    filesCreated = 1;
    console.log('Upload successful! File ID:', uploadData.id);

    // Update backup config with success
    console.log('Updating config with success status');
    await base44.asServiceRole.entities.BackupConfig.update(config.id, {
      last_backup_date: new Date().toISOString(),
      last_backup_status: 'success',
      last_backup_error: null,
      last_backup_file_count: filesCreated,
      last_backup_total_records: totalRecords
    });

    // Log to system activity
    await base44.asServiceRole.entities.SystemActivityLog.create({
      actor_type: 'system',
      actor_name: 'backup_system',
      action_type: 'backup_completed',
      action_description: `גיבוי הושלם בהצלחה: ${totalRecords} רשומות מ-${entityNames.length} entities`,
      status: 'success'
    });

    console.log('Backup completed successfully!');
    
  } catch (error) {
    console.error('BACKUP ERROR:', error.message);
    console.error('Stack:', error.stack);

    // Update status to failed
    try {
      const configs = await base44.asServiceRole.entities.BackupConfig.list();
      if (configs && configs[0]) {
        await base44.asServiceRole.entities.BackupConfig.update(configs[0].id, {
          last_backup_status: 'failed',
          last_backup_error: error.message,
          last_backup_date: new Date().toISOString()
        });
      }
    } catch (updateErr) {
      console.error('Failed to update error status:', updateErr.message);
    }
  }
}