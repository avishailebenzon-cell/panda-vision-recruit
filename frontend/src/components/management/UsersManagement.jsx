import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, UserPlus, Check, X, Shield, Settings, Mail, Clock, AlertTriangle } from 'lucide-react';
import { sendUserInvitation } from '@/functions/sendUserInvitation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import ConfirmDialog from '../ui/ConfirmDialog';

export default function UsersManagement({ currentUser, defaultPermissionsByAppRole }) {
  const [users, setUsers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, message: '', onConfirm: null });
  const [showPermissionsDialog, setShowPermissionsDialog] = useState(false);
  const [editingPermissions, setEditingPermissions] = useState(null);
  const [permissionsForm, setPermissionsForm] = useState({});
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [inviteForm, setInviteForm] = useState({
    full_name: '',
    email: '',
    app_role: 'hr',
    invitation_message: ''
  });
  const [sendingInvite, setSendingInvite] = useState(false);
  const [invitePermissions, setInvitePermissions] = useState({});
  const [showInvitePermissions, setShowInvitePermissions] = useState(false);
  const [editingInvitationPermissions, setEditingInvitationPermissions] = useState(null);
  const [invitationPermissionsForm, setInvitationPermissionsForm] = useState({});

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersList, clientsList, invitationsList] = await Promise.all([
        base44.entities.User.list(),
        base44.entities.Client.list(),
        base44.entities.UserInvitation.list('-created_date')
      ]);
      setUsers(usersList);
      setClients(clientsList);
      setInvitations(invitationsList);
    } catch (error) {
      console.error("Error loading users, clients or invitations:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApprove = (userToApprove) => {
    handleEditPermissions(userToApprove);
  };

  const handleReject = async (userToReject) => {
    setConfirmDialog({
      isOpen: true,
      message: `האם לדחות את המשתמש ${userToReject.full_name}?`,
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await base44.entities.User.update(userToReject.id, {
            ...userToReject,
            approval_status: 'rejected'
          });

          const invitation = invitations.find(inv => inv.email.toLowerCase() === userToReject.email.toLowerCase() && inv.invitation_status === 'sent');
          if (invitation) {
            await base44.entities.UserInvitation.update(invitation.id, { invitation_status: 'rejected' });
          }

          loadData();
        } catch (error) {
          console.error("Error rejecting user:", error);
          alert('שגיאה בדחיית המשתמש');
        } finally {
          setConfirmDialog({ isOpen: false });
        }
      }
    });
  };

  const handleEditPermissions = (user) => {
    const userWithDefaults = { ...defaultPermissionsByAppRole[user.app_role || 'hr'], ...user };
    setEditingPermissions(user);
    setPermissionsForm(userWithDefaults);
    setShowPermissionsDialog(true);
  };

  const handleSavePermissions = async () => {
    // Check if we're editing an invitation or a user
    if (editingInvitationPermissions) {
      await handleSaveInvitationPermissions();
      return;
    }

    if (!editingPermissions) return;

    try {
      const updatePayload = { ...permissionsForm };

      if (editingPermissions.approval_status === 'pending' || editingPermissions.approval_status === 'rejected') {
          updatePayload.approval_status = 'approved';
          updatePayload.approved_by = currentUser.id;
          updatePayload.approved_date = new Date().toISOString();
      }

      await base44.entities.User.update(editingPermissions.id, updatePayload);

      const invitation = invitations.find(inv => inv.email.toLowerCase() === editingPermissions.email.toLowerCase() && inv.invitation_status === 'sent');
      if (invitation) {
        await base44.entities.UserInvitation.update(invitation.id, {
          invitation_status: 'approved',
          user_id: editingPermissions.id,
          approved_date: new Date().toISOString()
        });
      }

      await loadData();
      setShowPermissionsDialog(false);
      setEditingPermissions(null);
      alert('הרשאות עודכנו בהצלחה');
    } catch (error) {
      console.error("Error updating permissions:", error);
      alert('שגיאה בעדכון ההרשאות');
    }
  };

  const handleInviteUser = async () => {
    if (!inviteForm.full_name.trim() || !inviteForm.email.trim()) {
      alert('אנא מלא את כל השדות החובה');
      return;
    }

    // Check if user already exists in the system before sending invitation
    const existingUser = users.find(user =>
      user.email.toLowerCase().trim() === inviteForm.email.toLowerCase().trim()
    );

    if (existingUser) {
      alert(`משתמש עם כתובת האימייל "${inviteForm.email}" כבר קיים במערכת.\n\nסטטוס: ${existingUser.approval_status === 'approved' ? 'מאושר' : existingUser.approval_status === 'pending' ? 'ממתין לאישור' : 'נדחה'}\n\nשם: ${existingUser.full_name}\nתפקיד: ${existingUser.app_role}`);
      return;
    }

    // Check if there's already an active invitation for this email
    let shouldResend = false;
    const existingInvitation = invitations.find(inv =>
      inv.email.toLowerCase().trim() === inviteForm.email.toLowerCase().trim() &&
      inv.invitation_status === 'sent'
    );

    if (existingInvitation) {
      if (window.confirm(`כבר קיימת הזמנה פעילה עבור כתובת האימייל "${inviteForm.email}".\n\nנשלחה על ידי: ${existingInvitation.invited_by_name}\nתאריך: ${new Date(existingInvitation.created_date).toLocaleDateString('he-IL')}\n\nהאם תרצה לשלוח את ההזמנה שוב?`)) {
        shouldResend = true;
      } else {
        return; // User cancelled
      }
    }

    setSendingInvite(true);
    try {
      await sendUserInvitation({
        full_name: inviteForm.full_name,
        email: inviteForm.email,
        app_role: inviteForm.app_role,
        invitation_message: inviteForm.invitation_message,
        predefined_permissions: showInvitePermissions ? invitePermissions : null,
        ...(shouldResend && { resend: true })
      });

      alert('הזמנה נשלחה בהצלחה!');
      setShowInviteDialog(false);
      setInviteForm({ full_name: '', email: '', app_role: 'hr', invitation_message: '' });
      setInvitePermissions({});
      setShowInvitePermissions(false);
      loadData();

    } catch (error) {
      console.error("Error inviting user:", error);

      let errorMessage = 'שגיאה בשליחת ההזמנה.';

      if (error.response?.data?.error) {
        const serverError = error.response.data.error;

        if (serverError.includes('User with this email already exists')) {
          errorMessage = `משתמש עם כתובת האימייל "${inviteForm.email}" כבר קיים במערכת.\n\nייתכן שהמשתמש נרשם לאחרונה או שיש טעות בכתובת האימייל.\n\nאנא רענן את הדף ובדוק ברשימת המשתמשים.`;
        } else if (serverError.includes('Active invitation already exists')) {
          errorMessage = `כבר קיימת הזמנה פעילה עבור כתובת האימייל "${inviteForm.email}".\n\nאנא בדוק ברשימת ההזמנות או חכה מעט ונסה שוב.`;
        } else if (serverError.includes('Failed to send email')) {
          errorMessage = 'שגיאה בשליחת המייל. בדוק את כתובת האימייל ונסה שוב.\n\nאם הבעיה חוזרת, פנה למנהל המערכת.';
        } else {
          errorMessage = `שגיאה: ${serverError}`;
        }
      } else if (error.message) {
        errorMessage = `שגיאה: ${error.message}`;
      }

      alert(errorMessage);
    } finally {
      setSendingInvite(false);
    }
  };

  const handleResendFromTable = async (invitation) => {
    setConfirmDialog({
      isOpen: true,
      message: `האם לשלוח שוב את ההזמנה עבור ${invitation.full_name} (${invitation.email})?`,
      variant: 'default',
      onConfirm: async () => {
        try {
          await sendUserInvitation({
            full_name: invitation.full_name,
            email: invitation.email,
            app_role: invitation.app_role,
            invitation_message: invitation.invitation_message,
            resend: true
          });
          alert('ההזמנה נשלחה שוב בהצלחה!');
          loadData();
        } catch (error) {
          console.error("Error resending from table:", error);
          let errorMessage = "שגיאה בשליחה מחדש.";
          if (error.response?.data?.error?.includes('User with this email already exists')) {
            errorMessage = 'משתמש עם כתובת אימייל זו כבר קיים במערכת.';
          } else if (error.response?.data?.error) {
            errorMessage = `שגיאה: ${error.response.data.error}`;
          }
          alert(errorMessage);
        } finally {
          setConfirmDialog({ isOpen: false });
        }
      }
    });
  };

  const getInvitationStatus = (invitation) => {
    const user = users.find(u => u.email.toLowerCase() === invitation.email.toLowerCase());

    if (user) {
      if (user.approval_status === 'approved') {
        return { status: 'approved', text: 'אושר ונרשם', variant: 'default' };
      } else if (user.approval_status === 'rejected') {
        return { status: 'rejected', text: 'נדחה', variant: 'destructive' };
      } else if (user.approval_status === 'pending') {
        return { status: 'registered', text: 'נרשם - ממתין לאישור', variant: 'secondary' };
      }
    }

    if (invitation.invitation_status === 'approved') {
      return { status: 'approved', text: 'אושר ונרשם (קיים משתמש)', variant: 'default' };
    } else if (invitation.invitation_status === 'rejected') {
      return { status: 'rejected', text: 'נדחה (בהזמנה)', variant: 'destructive' };
    }

    return { status: 'sent', text: 'נשלח - ממתין להרשמה', variant: 'outline' };
  };

  const handleCancelInvitation = async (invitation) => {
    setConfirmDialog({
      isOpen: true,
      message: `האם לבטל את ההזמנה עבור ${invitation.full_name} (${invitation.email})?`,
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await base44.entities.UserInvitation.delete(invitation.id);
          loadData();
          alert('ההזמנה בוטלה בהצלחה');
        } catch (error) {
          console.error("Error canceling invitation:", error);
          alert('שגיאה בביטול ההזמנה');
        } finally {
          setConfirmDialog({ isOpen: false });
        }
      }
    });
  };

  const handleEditInvitationPermissions = (invitation) => {
    const defaultPerms = defaultPermissionsByAppRole[invitation.app_role || 'hr'];
    const existingPerms = invitation.predefined_permissions || {};
    setEditingInvitationPermissions(invitation);
    setInvitationPermissionsForm({ ...defaultPerms, ...existingPerms, app_role: invitation.app_role });
    setShowPermissionsDialog(true);
  };

  const handleSaveInvitationPermissions = async () => {
    if (!editingInvitationPermissions) return;

    try {
      await base44.entities.UserInvitation.update(editingInvitationPermissions.id, {
        predefined_permissions: invitationPermissionsForm,
        app_role: invitationPermissionsForm.app_role
      });

      await loadData();
      setShowPermissionsDialog(false);
      setEditingInvitationPermissions(null);
      alert('הרשאות ההזמנה עודכנו - המשתמש יקבל אותן אוטומטית בכניסה');
    } catch (error) {
      console.error("Error updating invitation permissions:", error);
      alert('שגיאה בעדכון ההרשאות');
    }
  };

  const handleDeleteUser = async (user) => {
    setUserToDelete(user);
    setShowDeleteDialog(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      // Delete the user
      await base44.entities.User.delete(userToDelete.id);
      
      // Also delete any related invitations for this email
      const relatedInvitations = invitations.filter(inv => 
        inv.email.toLowerCase() === userToDelete.email.toLowerCase()
      );
      
      for (const invitation of relatedInvitations) {
        try {
          await base44.entities.UserInvitation.delete(invitation.id);
        } catch (error) {
          console.warn("Error deleting related invitation:", error);
        }
      }
      
      await loadData();
      setShowDeleteDialog(false);
      setUserToDelete(null);
      alert(`המשתמש ${userToDelete.full_name} נמחק בהצלחה`);
    } catch (error) {
      console.error("Error deleting user:", error);
      alert('שגיאה במחיקת המשתמש');
    }
  };

  const permissionCategories = [
    {
      title: "צפייה בדפים",
      permissions: [
        { key: 'can_view_dashboard', label: 'צפייה בדאשבורד (כרמית)' },
        { key: 'can_view_command_center', label: 'צפייה במרכז פיקוד' },
        { key: 'can_view_jobs', label: 'צפייה במשרות (נועה ודנה)' },
        { key: 'can_view_candidates', label: 'צפייה במועמדים (יעל)' },
        { key: 'can_view_candidates_map', label: 'צפייה במפת מועמדים' },
        { key: 'can_view_search', label: 'גישה לחיפוש' },
        { key: 'can_view_expert_search', label: 'גישה לחיפוש מתקדם' },
        { key: 'can_view_clients', label: 'צפייה בלקוחות' },
        { key: 'can_view_matches', label: 'צפייה בהתאמות וסוכנים' },
        { key: 'can_view_management', label: 'צפייה בניהול מערכת (רביב)' },
        { key: 'can_view_help', label: 'צפייה בעזרה' },
      ]
    },
    {
      title: "ניהול נתונים",
      permissions: [
        { key: 'can_manage_jobs', label: 'ניהול משרות' },
        { key: 'can_manage_candidates', label: 'ניהול מועמדים' },
        { key: 'can_manage_clients', label: 'ניהול לקוחות' },
        { key: 'can_manage_users', label: 'ניהול משתמשים' },
        { key: 'can_manage_match_status', label: 'ניהול סטטוס התאמות' },
        { key: 'can_delete_matches', label: 'מחיקת התאמות' },
      ]
    },
    {
      title: "שליחת הודעות",
      permissions: [
        { key: 'can_send_email_to_clients', label: 'שליחת מייל ללקוחות' },
        { key: 'can_send_whatsapp_to_clients', label: 'שליחת WhatsApp ללקוחות' },
        { key: 'can_send_messages_to_employees', label: 'שליחת הודעות לעובדים' },
        { key: 'can_send_candidate_email_to_client', label: 'שליחת קורות חיים במייל ללקוח' },
        { key: 'can_send_whatsapp_to_candidate', label: 'שליחת קורות חיים בWhatsApp למועמד' },
        { key: 'receives_match_notifications', label: 'קבלת התראות על התאמות חדשות' },
      ]
    },
    {
      title: "הרשאות חיפוש",
      permissions: [
        { key: 'search_can_use_existing_job', label: 'חיפוש למשרה קיימת' },
        { key: 'search_can_use_freetext', label: 'חיפוש חופשי' },
        { key: 'search_can_find_jobs_for_candidate', label: 'חיפוש משרות למועמד' },
        { key: 'search_can_use_level1_agent', label: 'שימוש בסוכן רמה 1' },
        { key: 'search_can_use_job_finder_agent', label: 'שימוש בסוכן איתור משרות' },
        { key: 'search_can_see_advanced_filters', label: 'צפייה במסננים מתקדמים' },
      ]
    },
    {
      title: "הרשאות ניהול",
      permissions: [
        { key: 'management_can_view_users', label: 'ניהול משתמשים' },
        { key: 'management_can_view_access_log', label: 'לוג גישה' },
        { key: 'management_can_view_data_cleanup', label: 'ניקוי נתונים' },
        { key: 'management_can_edit_invitation_messages', label: 'הודעות הזמנה' },
        { key: 'management_can_view_synonyms', label: 'מילים נרדפות' },
        { key: 'management_can_view_scheduler', label: 'משימות מתוזמנות' },
        { key: 'management_can_view_candidate_status', label: 'מכונת מצבים' },
        { key: 'management_can_view_email_outbox', label: 'תיבת מייל יוצא' },
        { key: 'management_can_view_whatsapp_outbox', label: 'תיבת WhatsApp יוצא' },
        { key: 'management_can_view_email_cv', label: 'קליטת מיילים' },
        { key: 'management_can_view_pipedrive', label: 'Pipedrive סנכרון' },
        { key: 'management_can_view_email_service', label: 'שירות מיילים' },
        { key: 'management_can_view_agent_settings', label: 'הגדרות סוכני WhatsApp' },
        { key: 'management_can_view_agent_names', label: 'כינויי סוכנים' },
        { key: 'management_can_view_raviv', label: 'רביב - ניטור מערכת' },
        { key: 'management_can_view_elad', label: 'אלעד - הגדרות שליחה' },
        { key: 'management_can_view_clients_contacts', label: 'ארגונים ואנשי קשר' },
        { key: 'management_can_view_match_settings', label: 'מחלקת גיוס' },
        { key: 'management_can_view_shiri', label: 'שירי - קשרי עובדים' },
        { key: 'management_can_view_meni', label: 'מני - מכירות אפקטיביות' },
        { key: 'management_can_view_eitan', label: 'איתן - איכות שירות' },
        { key: 'management_can_view_cv_enhancement', label: 'השבחת קורות חיים' },
        { key: 'management_can_view_activity_log', label: 'לוג פעולות' },
        { key: 'management_can_view_presentation_mode', label: 'מצב הדרכה' },
      ]
    },
    {
      title: "הרשאות דאשבורד",
      permissions: [
        { key: 'dashboard_can_view_stats_cards', label: 'צפייה בכרטיסי סטטיסטיקה' },
        { key: 'dashboard_can_view_client_marked_candidates', label: 'צפייה במועמדים מסומנים' },
        { key: 'dashboard_can_view_candidate_inbox', label: 'צפייה בדואר נכנס מועמדים' },
        { key: 'dashboard_can_view_job_inbox', label: 'צפייה בדואר נכנס משרות' },
        { key: 'dashboard_can_view_journey_timeline', label: 'צפייה במסע מועמדים' },
        { key: 'dashboard_can_view_recent_activity', label: 'צפייה בפעילות אחרונה' },
        { key: 'dashboard_can_view_weekly_stats', label: 'צפייה בסטטיסטיקות שבועיות' },
      ]
    },
    {
      title: "הרשאות מסך בית",
      permissions: [
        { key: 'mainmenu_can_view_quick_search', label: 'חיפוש מהיר' },
        { key: 'mainmenu_can_view_dashboard_button', label: 'כרמית - דאשבורד' },
        { key: 'mainmenu_can_view_jobs_button', label: 'נועה ודנה - משרות' },
        { key: 'mainmenu_can_view_candidates_button', label: 'יעל - מועמדים' },
        { key: 'mainmenu_can_view_matches_button', label: 'סוכני גיוס והתאמות' },
        { key: 'mainmenu_can_view_clients_button', label: 'לקוחות' },
        { key: 'mainmenu_can_view_candidates_map_button', label: 'מפת מועמדים' },
        { key: 'mainmenu_can_view_management_button', label: 'רביב - ניהול מערכת' },
        { key: 'mainmenu_can_view_activity_section', label: 'סקציית פעילות' },
        { key: 'mainmenu_can_view_quick_stats', label: 'סטטיסטיקות מהירות' },
      ]
    },
    {
      title: "גישה לסוכני גיוס",
      permissions: [
        { key: 'can_view_naama_page', label: 'נעמה - מומחית תוכנה' },
        { key: 'can_view_rami_page', label: 'רמי - מומחה רמה 1' },
        { key: 'can_view_alik_page', label: 'אליק - מומחה אלקטרוניקה' },
        { key: 'can_view_itay_page', label: 'איתי - מומחה IT' },
        { key: 'can_view_lior_page', label: 'ליאור - מומחה הנדסת מערכת' },
        { key: 'can_view_ofir_page', label: 'אופיר - מומחה הנדסת מכונות' },
        { key: 'can_view_gc_page', label: 'GC - סוכן כללי' },
      ]
    },
    {
      title: "גישה לסוכני לקוחות ואיכות",
      permissions: [
        { key: 'can_view_noam_page', label: 'נועה - קשרי מועמדים' },
        { key: 'can_view_elad_page', label: 'אלעד - שליחת מועמדים' },
        { key: 'can_view_meni_page', label: 'מני - מכירות אפקטיביות' },
        { key: 'can_view_eitan_page', label: 'איתן - בדיקות איכות' },
        { key: 'can_view_shacahr_page', label: 'שחר - תקשורת עם לקוח' },
        { key: 'can_view_noam_client_page', label: 'נועם - WhatsApp לקוחות' },
      ]
    },
    {
      title: "גישה לסוכני HR",
      permissions: [
        { key: 'can_view_shiri_page', label: 'שירי - קשרי עובדים' },
        { key: 'can_view_inbar_page', label: 'ענבר - תכנון משא"ן' },
        { key: 'can_view_hila_page', label: 'הילה - הפצת משרות' },
      ]
    }
  ];

  if (loading) {
    return <div className="flex justify-center items-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-6 h-6 text-blue-600" />
                ניהול משתמשים והרשאות
              </CardTitle>
            </div>
            <Button
              onClick={() => setShowInviteDialog(true)}
              className="bg-green-600 hover:bg-green-700"
            >
              <UserPlus className="w-4 h-4 ml-2" />
              הזמן משתמש חדש
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="users" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="users">משתמשים רשומים</TabsTrigger>
              <TabsTrigger value="invitations">הזמנות שנשלחו</TabsTrigger>
            </TabsList>

            <TabsContent value="users">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>שם</TableHead>
                      <TableHead>אימייל</TableHead>
                      <TableHead>תפקיד</TableHead>
                      <TableHead>סטטוס</TableHead>
                      <TableHead>פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map(user => (
                      <TableRow key={user.id}>
                        <TableCell>{user.full_name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant={
                            user.app_role === 'admin' ? 'destructive' :
                            user.app_role === 'hr' ? 'default' : 'secondary'
                          }>
                            {user.app_role === 'admin' ? 'מנהל מערכת' :
                             user.app_role === 'hr' ? 'צוות HR' : 'לקוח'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            user.approval_status === 'approved' ? 'default' :
                            user.approval_status === 'pending' ? 'secondary' : 'destructive'
                          }>
                            {user.approval_status === 'approved' ? 'מאושר' :
                             user.approval_status === 'pending' ? 'ממתין לאישור' : 'נדחה'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {user.approval_status === 'pending' && (
                              <>
                                <Button size="sm" onClick={() => handleApprove(user)}>
                                  <Check className="w-4 h-4 ml-1" /> אישור והרשאות
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => handleReject(user)}>
                                  <X className="w-4 h-4 ml-1" /> דחייה
                                </Button>
                              </>
                            )}
                            {(user.approval_status === 'approved' || user.approval_status === 'rejected') && (
                              <Button size="sm" variant="outline" onClick={() => handleEditPermissions(user)}>
                                <Settings className="w-4 h-4 ml-1" />
                                {user.approval_status === 'rejected' ? 'אישור מחדש והרשאות' : 'הרשאות'}
                              </Button>
                            )}
                            {/* Only show delete button for non-admin users, or if current user is admin */}
                            {(currentUser?.app_role === 'admin' && user.id !== currentUser.id) && (
                              <Button 
                                size="sm" 
                                variant="destructive" 
                                onClick={() => handleDeleteUser(user)}
                                title="מחק משתמש"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {users.length === 0 && (
                      <TableRow>
                        <TableCell colSpan="5" className="h-24 text-center">
                          אין משתמשים רשומים
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="invitations">
              {invitations.filter(inv => {
                const statusInfo = getInvitationStatus(inv);
                const daysSinceCreated = (Date.now() - new Date(inv.created_date).getTime()) / (1000 * 60 * 60 * 24);
                return statusInfo.status === 'sent' && daysSinceCreated > 3;
              }).length > 0 && (
                <Alert variant="destructive" className="mb-4">
                  <Clock className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between">
                    <span>
                      יש {invitations.filter(inv => {
                        const statusInfo = getInvitationStatus(inv);
                        const daysSinceCreated = (Date.now() - new Date(inv.created_date).getTime()) / (1000 * 60 * 60 * 24);
                        return statusInfo.status === 'sent' && daysSinceCreated > 3;
                      }).length} הזמנות שפג תוקפן (מעל 3 ימים)
                    </span>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        const expiredInvitations = invitations.filter(inv => {
                          const statusInfo = getInvitationStatus(inv);
                          const daysSinceCreated = (Date.now() - new Date(inv.created_date).getTime()) / (1000 * 60 * 60 * 24);
                          return statusInfo.status === 'sent' && daysSinceCreated > 3;
                        });
                        setConfirmDialog({
                          isOpen: true,
                          message: `האם למחוק ${expiredInvitations.length} הזמנות שפג תוקפן?`,
                          variant: 'destructive',
                          onConfirm: async () => {
                            try {
                              for (const inv of expiredInvitations) {
                                await base44.entities.UserInvitation.delete(inv.id);
                              }
                              loadData();
                              alert(`${expiredInvitations.length} הזמנות נמחקו בהצלחה`);
                            } catch (error) {
                              console.error("Error deleting expired invitations:", error);
                              alert('שגיאה במחיקת הזמנות');
                            } finally {
                              setConfirmDialog({ isOpen: false });
                            }
                          }
                        });
                      }}
                    >
                      <X className="w-4 h-4 ml-1" />
                      מחק הזמנות שפג תוקפן
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>שם</TableHead>
                      <TableHead>אימייל</TableHead>
                      <TableHead>תפקיד</TableHead>
                      <TableHead>נשלח על ידי</TableHead>
                      <TableHead>תאריך שליחה</TableHead>
                      <TableHead>סטטוס</TableHead>
                      <TableHead>פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.map(invitation => {
                      const statusInfo = getInvitationStatus(invitation);
                      const daysSinceCreated = (Date.now() - new Date(invitation.created_date).getTime()) / (1000 * 60 * 60 * 24);
                      const isExpired = statusInfo.status === 'sent' && daysSinceCreated > 3;
                      
                      return (
                        <TableRow key={invitation.id} className={isExpired ? 'bg-red-50' : ''}>
                          <TableCell>{invitation.full_name}</TableCell>
                          <TableCell>{invitation.email}</TableCell>
                          <TableCell>
                            <Badge variant={
                              invitation.app_role === 'admin' ? 'destructive' :
                              invitation.app_role === 'hr' ? 'default' : 'secondary'
                            }>
                              {invitation.app_role === 'admin' ? 'מנהל מערכת' :
                               invitation.app_role === 'hr' ? 'צוות HR' : 'לקוח'}
                            </Badge>
                          </TableCell>
                          <TableCell>{invitation.invited_by_name}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <span>{new Date(invitation.created_date).toLocaleDateString('he-IL')}</span>
                              {isExpired && (
                                <Badge variant="destructive" className="text-xs">
                                  <Clock className="w-3 h-3 ml-1" />
                                  פג תוקף
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusInfo.variant}>
                              {statusInfo.text}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {statusInfo.status === 'sent' && (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => handleEditInvitationPermissions(invitation)}
                                >
                                  <Settings className="w-4 h-4 ml-1" />
                                  הרשאות
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleResendFromTable(invitation)}
                                >
                                  <Mail className="w-4 h-4 ml-1" />
                                  שלח שוב
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleCancelInvitation(invitation)}
                                >
                                  <X className="w-4 h-4 ml-1" />
                                  בטל
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {invitations.length === 0 && (
                      <TableRow>
                        <TableCell colSpan="7" className="h-24 text-center">
                          אין הזמנות שנשלחו
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              הזמנת משתמש חדש למערכת
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="invite_name">שם מלא *</Label>
              <Input
                id="invite_name"
                value={inviteForm.full_name}
                onChange={(e) => setInviteForm(prev => ({ ...prev, full_name: e.target.value }))}
                placeholder="הזן שם מלא"
                required
              />
            </div>

            <div>
              <Label htmlFor="invite_email">כתובת אימייל *</Label>
              <Input
                id="invite_email"
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="הזן כתובת אימייל"
                required
              />
            </div>

            <div>
              <Label htmlFor="invite_role">תפקיד במערכת</Label>
              <Select
                value={inviteForm.app_role}
                onValueChange={(value) => setInviteForm(prev => ({ ...prev, app_role: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר תפקיד" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">מנהל מערכת</SelectItem>
                  <SelectItem value="hr">צוות HR</SelectItem>
                  <SelectItem value="client">לקוח</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="invitation_message">הודעה אישית (אופציונלי)</Label>
              <Textarea
                id="invitation_message"
                value={inviteForm.invitation_message}
                onChange={(e) => setInviteForm(prev => ({ ...prev, invitation_message: e.target.value }))}
                placeholder="הוסף הודעה אישית להזמנה (תוצג בתחילת המייל)..."
                rows={4}
              />
            </div>

            <div className="flex items-center space-x-2 border rounded-lg p-3 bg-blue-50">
              <Checkbox
                id="define_permissions_now"
                checked={showInvitePermissions}
                onCheckedChange={(checked) => {
                  setShowInvitePermissions(checked);
                  if (checked) {
                    // Initialize with default permissions for selected role
                    setInvitePermissions(defaultPermissionsByAppRole[inviteForm.app_role] || {});
                  }
                }}
              />
              <Label htmlFor="define_permissions_now" className="text-sm font-medium cursor-pointer">
                הגדר הרשאות עכשיו (המשתמש יאושר אוטומטית בכניסה ראשונה)
              </Label>
            </div>

            {showInvitePermissions && (
              <div className="border rounded-lg p-4 space-y-4 bg-gray-50">
                <p className="text-sm font-semibold text-blue-600">הגדרת הרשאות מותאמות:</p>
                <Tabs defaultValue={permissionCategories[0]?.title} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 gap-1">
                    {permissionCategories.slice(0, 4).map(category => (
                      <TabsTrigger
                        key={category.title}
                        value={category.title}
                        className="text-xs px-2 py-1"
                      >
                        {category.title}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {permissionCategories.slice(0, 4).map(category => (
                    <TabsContent key={category.title} value={category.title} className="mt-2 max-h-60 overflow-y-auto">
                      <div className="grid grid-cols-1 gap-2">
                        {category.permissions.map(permission => (
                          <div key={permission.key} className="flex items-center space-x-2">
                            <Checkbox
                              id={`invite_${permission.key}`}
                              checked={invitePermissions[permission.key] || false}
                              onCheckedChange={(checked) =>
                                setInvitePermissions(prev => ({ ...prev, [permission.key]: checked }))
                              }
                            />
                            <Label htmlFor={`invite_${permission.key}`} className="text-xs cursor-pointer">
                              {permission.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </div>
            )}

            <Alert>
              <AlertDescription className="text-sm">
                {showInvitePermissions ? (
                  <>
                    ✅ המשתמש יקבל את ההרשאות המוגדרות אוטומטית בכניסה ראשונה.
                    <br />
                    לא יהיה צורך לאשר אותו ידנית.
                  </>
                ) : (
                  <>
                    הודעת הזמנה תישלח לכתובת האימייל. לאחר שהמשתמש יירשם, תצטרך לאשר אותו ולהגדיר הרשאות.
                  </>
                )}
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteDialog(false)} disabled={sendingInvite}>
              ביטול
            </Button>
            <Button
              onClick={handleInviteUser}
              disabled={sendingInvite}
              className="bg-green-600 hover:bg-green-700"
            >
              {sendingInvite ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  שולח...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 ml-2" />
                  שלח הזמנה
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPermissionsDialog} onOpenChange={() => {
        setShowPermissionsDialog(false);
        setEditingPermissions(null);
        setEditingInvitationPermissions(null);
      }}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              {editingInvitationPermissions ? 
                `הגדרת הרשאות להזמנה - ${editingInvitationPermissions.full_name}` : 
                `עריכת הרשאות - ${editingPermissions?.full_name}`
              }
            </DialogTitle>
            {editingInvitationPermissions && (
              <Alert className="mt-2">
                <AlertDescription className="text-sm">
                  💡 ההרשאות יוגדרו מראש - המשתמש יקבל אותן אוטומטית כשיירשם (ללא צורך באישור ידני)
                </AlertDescription>
              </Alert>
            )}
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="app_role">תפקיד במערכת</Label>
                <Select
                  value={editingInvitationPermissions ? invitationPermissionsForm.app_role || 'hr' : permissionsForm.app_role || 'hr'}
                  onValueChange={(value) => {
                    if (editingInvitationPermissions) {
                      setInvitationPermissionsForm(prev => ({ ...prev, app_role: value }));
                    } else {
                      setPermissionsForm(prev => ({ ...prev, app_role: value }));
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="בחר תפקיד" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">מנהל מערכת</SelectItem>
                    <SelectItem value="hr">צוות HR</SelectItem>
                    <SelectItem value="client">לקוח</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Tabs defaultValue={permissionCategories[0]?.title} className="w-full">
              <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-1 p-1 h-auto overflow-visible">
                {permissionCategories.map(category => (
                  <TabsTrigger
                    key={category.title}
                    value={category.title}
                    className="text-xs px-2 py-2 whitespace-nowrap overflow-hidden text-ellipsis min-w-0 flex-shrink-0"
                  >
                    {category.title}
                  </TabsTrigger>
                ))}
              </TabsList>

              {permissionCategories.map(category => (
                <TabsContent key={category.title} value={category.title} className="mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {category.permissions.map(permission => (
                      <div key={permission.key} className="flex items-center space-x-2">
                        <Checkbox
                          id={editingInvitationPermissions ? `inv_${permission.key}` : permission.key}
                          checked={editingInvitationPermissions ? 
                            (invitationPermissionsForm[permission.key] || false) : 
                            (permissionsForm[permission.key] || false)
                          }
                          onCheckedChange={(checked) => {
                            if (editingInvitationPermissions) {
                              setInvitationPermissionsForm(prev => ({ ...prev, [permission.key]: checked }));
                            } else {
                              setPermissionsForm(prev => ({ ...prev, [permission.key]: checked }));
                            }
                          }}
                        />
                        <Label htmlFor={editingInvitationPermissions ? `inv_${permission.key}` : permission.key} className="text-sm">
                          {permission.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPermissionsDialog(false)}>
              ביטול
            </Button>
            <Button onClick={handleSavePermissions}>
              שמור הרשאות
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">
              מחיקת משתמש - {userToDelete?.full_name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>אזהרה: פעולה בלתי הפיכה!</strong>
                <br />
                מחיקת המשתמש תמחק:
                <ul className="list-disc mr-5 mt-2">
                  <li>את המשתמש מהמערכת לחלוטין</li>
                  <li>את כל ההזמנות הקשורות לאימייל זה</li>
                  <li>חלק מההיסטוריה הקשורה למשתמש</li>
                </ul>
              </AlertDescription>
            </Alert>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm">
                <strong>פרטי המשתמש למחיקה:</strong>
                <br />
                שם: {userToDelete?.full_name}
                <br />
                אימייל: {userToDelete?.email}
                <br />
                תפקיד: {userToDelete?.app_role === 'admin' ? 'מנהל מערכת' : userToDelete?.app_role === 'hr' ? 'צוות HR' : 'לקוח'}
                <br />
                סטטוס: {userToDelete?.approval_status === 'approved' ? 'מאושר' : userToDelete?.approval_status === 'pending' ? 'ממתין לאישור' : 'נדחה'}
              </p>
            </div>
            
            <p className="text-sm text-gray-600">
              לאחר המחיקה תוכל להזמין את האימייל הזה שוב כמשתמש חדש.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              ביטול
            </Button>
            <Button variant="destructive" onClick={confirmDeleteUser}>
              כן, מחק את המשתמש
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog {...confirmDialog} onClose={() => setConfirmDialog({ isOpen: false })} />
    </>
  );
}