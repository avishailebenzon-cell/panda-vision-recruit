import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { userId, permissions } = await req.json();
    
    // Update user with new permissions
    await base44.asServiceRole.entities.User.update(userId, permissions);
    
    return Response.json({ 
      success: true, 
      message: 'User permissions updated successfully' 
    });
  } catch (error) {
    console.error('Error updating user permissions:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});