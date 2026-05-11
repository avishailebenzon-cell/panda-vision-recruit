import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { fileId, confirmRestore } = await req.json();

    if (!confirmRestore) {
      return Response.json({ 
        error: 'חובה לאשר את פעולת השחזור - פעולה זו תדרוס את כל הנתונים הקיימים!' 
      }, { status: 400 });
    }

    if (!fileId) {
      return Response.json({ error: 'חסר מזהה קובץ גיבוי' }, { status: 400 });
    }

    // Get Google Drive access token
    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googledrive');

    if (!accessToken) {
      return Response.json({ error: 'Google Drive not connected' }, { status: 500 });
    }

    // Download backup file from Google Drive
    const downloadResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    );

    if (!downloadResponse.ok) {
      throw new Error(`Failed to download backup file: ${downloadResponse.statusText}`);
    }

    const backupData = await downloadResponse.json();

    // Validate backup structure
    if (!backupData.entities || typeof backupData.entities !== 'object') {
      throw new Error('קובץ הגיבוי לא תקין - חסר מבנה entities');
    }

    let restoredEntities = 0;
    let restoredRecords = 0;
    const errors = [];

    // Restore each entity
    for (const [entityName, records] of Object.entries(backupData.entities)) {
      if (!Array.isArray(records) || records.length === 0) {
        console.log(`Skipping ${entityName} - no records`);
        continue;
      }

      try {
        // Delete all existing records (DANGEROUS - only for restore)
        console.log(`Clearing ${entityName}...`);
        const existing = await base44.asServiceRole.entities[entityName].list('', 10000);
        for (const record of existing) {
          await base44.asServiceRole.entities[entityName].delete(record.id);
        }

        // Restore records
        console.log(`Restoring ${records.length} records to ${entityName}...`);
        for (const record of records) {
          // Remove system fields that shouldn't be restored
          const { id, created_date, updated_date, ...recordData } = record;
          await base44.asServiceRole.entities[entityName].create(recordData);
          restoredRecords++;
        }

        restoredEntities++;
        console.log(`✓ Restored ${entityName}: ${records.length} records`);

      } catch (err) {
        console.error(`Failed to restore ${entityName}:`, err.message);
        errors.push({ entity: entityName, error: err.message });
      }
    }

    // Log the restore operation
    await base44.asServiceRole.entities.SystemActivityLog.create({
      actor_type: 'user',
      actor_name: user.full_name,
      action_type: 'data_restored',
      action_description: `שוחזרו ${restoredRecords} רשומות מ-${restoredEntities} entities מגיבוי ${backupData.backup_date}`,
      status: errors.length > 0 ? 'partial_success' : 'success'
    });

    return Response.json({
      success: true,
      message: `שחזור הושלם`,
      backup_date: backupData.backup_date,
      restored_entities: restoredEntities,
      restored_records: restoredRecords,
      errors: errors.length > 0 ? errors : null
    });

  } catch (error) {
    console.error('Restore error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});