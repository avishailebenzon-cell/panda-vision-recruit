import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Get backup configuration
    const configs = await base44.asServiceRole.entities.BackupConfig.list();
    const config = configs[0];

    if (!config || !config.google_drive_folder_id) {
      return Response.json({ 
        success: false, 
        message: 'לא הוגדרה תיקיית Google Drive לגיבויים' 
      });
    }

    // Get Google Drive access token
    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googledrive');

    if (!accessToken) {
      return Response.json({ error: 'Google Drive not connected' }, { status: 500 });
    }

    // List backup files in the folder
    const folderId = config.google_drive_folder_id;
    const searchResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+name+contains+'PandaHRAI_Backup'&fields=files(id,name,createdTime,modifiedTime,size,webViewLink)&orderBy=modifiedTime desc`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    );

    if (!searchResponse.ok) {
      throw new Error(`Failed to list backups: ${searchResponse.statusText}`);
    }

    const data = await searchResponse.json();
    const files = data.files || [];

    return Response.json({
      success: true,
      backups: files.map(f => ({
        id: f.id,
        name: f.name,
        created: f.createdTime,
        modified: f.modifiedTime,
        size: f.size,
        url: f.webViewLink
      }))
    });

  } catch (error) {
    console.error('List backups error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});