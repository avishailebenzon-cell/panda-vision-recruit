import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Navigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
    Users, ShieldCheck, DatabaseZap, BookOpen, GitBranch, FileEdit, Mail, Smartphone, Inbox, Zap, Building, Settings, UserCheck, Activity, BrainCircuit, UserPen, ChevronDown, MessageCircle, Heart, Sparkles, Award, Presentation, HardDrive, AlertCircle, RefreshCw, RotateCcw, Search
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import ManagementTutorial, { useManagementTutorial, TutorialHelpButton } from "../components/tutorial/ManagementTutorial";
import { revalidateAllAgentMatches } from '@/functions/revalidateAllAgentMatches';
import { runAllAgentsFullScan } from '@/functions/runAllAgentsFullScan';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// Import management components
import UsersManagement from "../components/management/UsersManagement";
import EmailCvManagement from "../components/management/EmailCvManagement";
import MessageTemplates from "../components/management/MessageTemplates";
import AccessLogPage from "./AccessLog";
import CandidateStatusManagement from "../components/management/CandidateStatusManagement";
import SynonymManagement from "../components/management/SynonymManagement";
import ScanFailuresReport from "../components/management/ScanFailuresReport";

import EmailOutboxManagement from "../components/management/EmailOutboxManagement";
import WhatsAppOutboxTable from "../components/management/WhatsAppOutboxTable";
import DataCleanup from "../components/management/DataCleanup";
import MatchSettingsManagement from "../components/management/MatchSettingsManagement";
import PipedriveSync from "../components/management/PipedriveSync";

import RavivManagement from "../components/management/RavivManagement";
import RotemSettingsManagement from "../components/management/RotemSettingsManagement";
import EladManagement from "../components/management/EladManagement";
import SystemActivityLogView from "../components/management/SystemActivityLogView";
import AgentSettingsTab from "../components/management/AgentSettingsTab";
import EmailServiceManagement from "../components/management/EmailServiceManagement";
import EmailScannerControl from "../components/management/EmailScannerControl";


import MeniManagement from "../components/management/MeniManagement";
import EitanManagement from "../components/management/EitanManagement";
import CvEnhancementManager from "../components/management/CvEnhancementManager";
import ClientsManagement from "../components/management/ClientsManagement";
import PresentationMode from "../components/management/PresentationMode";
import CarmitManagement from "../components/management/CarmitManagement";
import APIKeyManagement from "../components/management/APIKeyManagement";

import BackupManagement from "../components/management/BackupManagement";
import CreditsUsageDashboard from "../components/management/CreditsUsageDashboard";
import ConversionLogManagement from "../components/management/ConversionLogManagement";
import SystemVersionManagement from "../components/management/SystemVersionManagement";
import InternalCandidatesRecovery from "../components/management/InternalCandidatesRecovery";
import CustomChafshanim from "../components/management/CustomChafshanim";
import DailyMatchesReportSettings from "../components/management/DailyMatchesReportSettings";


// Permissions objects remain here as they are central to this component's logic.
const defaultPermissionsByAppRole = {
    admin: {
        can_view_dashboard: true, can_view_jobs: true, can_manage_jobs: true,
        can_view_candidates: true, can_manage_candidates: true, can_view_candidates_map: true,
        can_view_search: true, can_view_clients: true, can_manage_clients: true,
        can_view_management: true, can_manage_users: true,
        can_view_matches: true, can_manage_match_status: true, can_delete_matches: true, receives_match_notifications: true,
        can_view_help: true,
        can_send_email_to_clients: true,
        can_send_whatsapp_to_clients: true,
        can_send_messages_to_employees: true,
        can_send_candidate_email_to_client: true,
        can_send_candidate_whatsapp_to_client: true,
        search_can_use_existing_job: true,
        search_can_use_freetext: true,
        search_can_find_jobs_for_candidate: true,
        search_can_use_level1_agent: true,
        search_can_use_job_finder_agent: true,
        search_can_see_advanced_filters: true,
        management_can_view_users: true,
        management_can_view_access_log: true,
        management_can_view_data_cleanup: true,
        management_can_edit_invitation_messages: true,
        management_can_view_synonyms: true,

        management_can_view_candidate_status: true,
        management_can_view_email_outbox: true,
        management_can_view_whatsapp_outbox: true,
        dashboard_can_view_stats_cards: true,
        dashboard_can_view_client_marked_candidates: true,
        dashboard_can_view_candidate_inbox: true,
        dashboard_can_view_job_inbox: true,
        dashboard_can_view_journey_timeline: true,
        dashboard_can_view_recent_activity: true,
        dashboard_can_view_weekly_stats: true,
        mainmenu_can_view_quick_search: true,
        mainmenu_can_view_dashboard_button: true,
        mainmenu_can_view_jobs_button: true,
        mainmenu_can_view_candidates_button: true,
        mainmenu_can_view_matches_button: true,
        mainmenu_can_view_clients_button: true,
        mainmenu_can_view_candidates_map_button: true,
        mainmenu_can_view_management_button: true,
        mainmenu_can_view_activity_section: true,
        mainmenu_can_view_quick_stats: true,
    },
    hr: {
        can_view_dashboard: true, can_view_jobs: true, can_manage_jobs: true,
        can_view_candidates: true, can_manage_candidates: true, can_view_candidates_map: true,
        can_view_search: true, can_view_clients: false, can_manage_clients: false,
        can_view_management: false, can_manage_users: false,
        can_view_matches: true, can_manage_match_status: false, can_delete_matches: false, receives_match_notifications: false,
        can_view_help: true,
        can_send_email_to_clients: true,
        can_send_whatsapp_to_clients: true,
        can_send_messages_to_employees: true,
        can_send_candidate_email_to_client: true,
        can_send_candidate_whatsapp_to_client: true,
        search_can_use_existing_job: true,
        search_can_use_freetext: true,
        search_can_find_jobs_for_candidate: true,
        search_can_use_level1_agent: true,
        search_can_use_job_finder_agent: true,
        search_can_see_advanced_filters: true,
        management_can_view_users: false,
        management_can_view_access_log: false,
        management_can_view_data_cleanup: false,
        management_can_edit_invitation_messages: false,
        management_can_view_synonyms: true,

        management_can_view_candidate_status: true,
        management_can_view_email_outbox: false,
        management_can_view_whatsapp_outbox: false,
        dashboard_can_view_stats_cards: true,
        dashboard_can_view_client_marked_candidates: true,
        dashboard_can_view_candidate_inbox: true,
        dashboard_can_view_job_inbox: true,
        dashboard_can_view_journey_timeline: true,
        dashboard_can_view_recent_activity: true,
        dashboard_can_view_weekly_stats: true,
        mainmenu_can_view_quick_search: true,
        mainmenu_can_view_dashboard_button: true,
        mainmenu_can_view_jobs_button: true,
        mainmenu_can_view_candidates_button: true,
        mainmenu_can_view_matches_button: true,
        mainmenu_can_view_clients_button: false,
        mainmenu_can_view_candidates_map_button: true,
        mainmenu_can_view_management_button: false,
        mainmenu_can_view_activity_section: true,
        mainmenu_can_view_quick_stats: true,
    },
    client: {
        can_view_dashboard: false, can_view_jobs: false, can_manage_jobs: false,
        can_view_candidates: false, can_manage_candidates: false, can_view_candidates_map: false,
        can_view_search: false, can_view_clients: false, can_manage_clients: false,
        can_view_management: false, can_manage_users: false,
        can_view_matches: false, can_manage_match_status: false, can_delete_matches: false, receives_match_notifications: false,
        can_view_help: true,
        can_send_email_to_clients: false,
        can_send_whatsapp_to_clients: false,
        can_send_messages_to_employees: false,
        can_send_candidate_email_to_client: false,
        can_send_candidate_whatsapp_to_client: false,
        search_can_use_existing_job: false,
        search_can_use_freetext: true,
        search_can_find_jobs_for_candidate: false,
        search_can_use_level1_agent: false,
        search_can_use_job_finder_agent: false,
        search_can_see_advanced_filters: false,
        management_can_view_users: false,
        management_can_view_access_log: false,
        management_can_view_data_cleanup: false,
        management_can_edit_invitation_messages: false,
        management_can_view_synonyms: false,

        management_can_view_candidate_status: false,
        management_can_view_email_outbox: false,
        management_can_view_whatsapp_outbox: false,
        dashboard_can_view_stats_cards: false,
        dashboard_can_view_client_marked_candidates: false,
        dashboard_can_view_candidate_inbox: false,
        dashboard_can_view_job_inbox: false,
        dashboard_can_view_journey_timeline: false,
        dashboard_can_view_recent_activity: false,
        dashboard_can_view_weekly_stats: false,
        mainmenu_can_view_quick_search: true,
        mainmenu_can_view_dashboard_button: false,
        mainmenu_can_view_jobs_button: false,
        mainmenu_can_view_candidates_button: false,
        mainmenu_can_view_matches_button: false,
        mainmenu_can_view_clients_button: false,
        mainmenu_can_view_candidates_map_button: false,
        mainmenu_can_view_management_button: false,
        mainmenu_can_view_activity_section: false,
        mainmenu_can_view_quick_stats: false,
    }
};

export default function Management() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const { isOpen: isTutorialOpen, startTutorial, closeTutorial, hasCompletedTutorial } = useManagementTutorial();
    const [revalidatingAgents, setRevalidatingAgents] = useState({});
    const [runningFullScan, setRunningFullScan] = useState(false);
    const [activeCategory, setActiveCategory] = useState(null);
    
    // Get tab from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const initialTab = urlParams.get('tab') || 'email_cv';
    
    // Show tutorial for first-time users
    useEffect(() => {
        if (user && !loading && !hasCompletedTutorial()) {
            // Small delay to let the page render first
            const timer = setTimeout(() => {
                startTutorial();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [user, loading]);

    const runFullScanAllAgents = async () => {
        setRunningFullScan(true);
        toast.loading('מריץ סריקה מלאה של כל הסוכנים על כל בסיס הנתונים - זה יכול לקחת עד 30 דקות...', { id: 'full-scan' });

        try {
            const result = await runAllAgentsFullScan({});
            
            if (result.data?.success) {
                toast.success(
                    `סריקה מלאה הושלמה! ${result.data.totalMatches} התאמות חדשות נוצרו על ידי ${result.data.successfulAgents} סוכנים`,
                    { id: 'full-scan', duration: 8000 }
                );
            } else {
                toast.error(`שגיאה: ${result.data?.error || 'לא ידוע'}`, { id: 'full-scan' });
            }
        } catch (error) {
            toast.error(`שגיאה בסריקה: ${error.message}`, { id: 'full-scan' });
        }

        setRunningFullScan(false);
    };

    const handleSubcategorySelect = (tab) => {
        setActiveCategory(null);
        // Trigger tab change by manipulating the Tabs component
        setTimeout(() => {
            const triggerElement = document.querySelector(`[value="${tab}"]`);
            if (triggerElement) triggerElement.click();
        }, 0);
    };

    const renderSubcategoryButtons = () => {
        if (activeCategory === 'agents' && user?.role === 'admin') {
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Button onClick={() => handleSubcategorySelect('agent_settings')} variant="outline" className="justify-start h-auto py-3 px-4 text-base">
                  <BrainCircuit className="w-5 h-5 ml-2" />
                  הגדרות סוכני WhatsApp
                </Button>
                <Button onClick={() => handleSubcategorySelect('raviv')} variant="outline" className="justify-start h-auto py-3 px-4 text-base">
                  <Settings className="w-5 h-5 ml-2" />
                  רביב - ניטור מערכת
                </Button>
                <Button onClick={() => handleSubcategorySelect('rotem')} variant="outline" className="justify-start h-auto py-3 px-4 text-base">
                  <MessageCircle className="w-5 h-5 ml-2" />
                  טל - מודל עבודה
                </Button>
                <Button onClick={() => handleSubcategorySelect('elad')} variant="outline" className="justify-start h-auto py-3 px-4 text-base">
                  <UserCheck className="w-5 h-5 ml-2" />
                  אלעד - הגדרות שליחה
                </Button>
                <Button onClick={() => handleSubcategorySelect('clients')} variant="outline" className="justify-start h-auto py-3 px-4 text-base">
                  <Building className="w-5 h-5 ml-2" />
                  ארגונים ואנשי קשר
                </Button>
                <Button onClick={() => handleSubcategorySelect('match_settings')} variant="outline" className="justify-start h-auto py-3 px-4 text-base">
                  <Zap className="w-5 h-5 ml-2" />
                  מחלקת גיוס
                </Button>

                <Button onClick={() => handleSubcategorySelect('meni')} variant="outline" className="justify-start h-auto py-3 px-4 text-base">
                  <Sparkles className="w-5 h-5 ml-2" />
                  מני-מכירות אפקטיביות
                </Button>
                <Button onClick={() => handleSubcategorySelect('eitan')} variant="outline" className="justify-start h-auto py-3 px-4 text-base">
                  <Award className="w-5 h-5 ml-2" />
                  איתן-איכות שירות
                </Button>
                <Button onClick={() => handleSubcategorySelect('carmit')} variant="outline" className="justify-start h-auto py-3 px-4 text-base">
                  <Mail className="w-5 h-5 ml-2" />
                  כרמית-סיכום יומי
                </Button>
                <Button onClick={() => handleSubcategorySelect('presentation')} variant="outline" className="justify-start h-auto py-3 px-4 text-base">
                  <Presentation className="w-5 h-5 ml-2" />
                  מצב הצגה
                </Button>
              </div>
            );
        }
        if (activeCategory === 'external' && user?.role === 'admin') {
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Button onClick={() => handleSubcategorySelect('email_cv')} variant="outline" className="justify-start h-auto py-3 px-4 text-base">
                  <Inbox className="w-5 h-5 ml-2" />
                  קליטת מיילים
                </Button>
                <Button onClick={() => handleSubcategorySelect('pipedrive')} variant="outline" className="justify-start h-auto py-3 px-4 text-base">
                  <Building className="w-5 h-5 ml-2" />
                  Pipedrive
                </Button>
                <Button onClick={() => handleSubcategorySelect('email_service')} variant="outline" className="justify-start h-auto py-3 px-4 text-base">
                  <Mail className="w-5 h-5 ml-2" />
                  דואר יוצא
                </Button>
                <Button onClick={() => handleSubcategorySelect('scan_failures_external')} variant="outline" className="justify-start h-auto py-3 px-4 text-base">
                  <AlertCircle className="w-5 h-5 ml-2" />
                  קבצים שנכשלו בסריקה
                </Button>
                <Button onClick={() => handleSubcategorySelect('conversion_log')} variant="outline" className="justify-start h-auto py-3 px-4 text-base">
                  <RefreshCw className="w-5 h-5 ml-2" />
                  המרות ConvertAPI
                </Button>
              </div>
            );
        }
        if (activeCategory === 'config') {
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {user?.management_can_view_users && (
                  <Button onClick={() => handleSubcategorySelect('users')} variant="outline" className="justify-start h-auto py-3 px-4 text-base">
                    <Users className="w-5 h-5 ml-2" />
                    משתמשים
                  </Button>
                )}
                {user?.management_can_view_candidate_status && (
                  <Button onClick={() => handleSubcategorySelect('candidate-status')} variant="outline" className="justify-start h-auto py-3 px-4 text-base">
                    <GitBranch className="w-5 h-5 ml-2" />
                    מכונת מצבים
                  </Button>
                )}
                {user?.management_can_view_synonyms && (
                  <Button onClick={() => handleSubcategorySelect('synonyms')} variant="outline" className="justify-start h-auto py-3 px-4 text-base">
                    <BookOpen className="w-5 h-5 ml-2" />
                    מילים נרדפות
                  </Button>
                )}
                {user?.management_can_edit_invitation_messages && (
                  <Button onClick={() => handleSubcategorySelect('message_templates')} variant="outline" className="justify-start h-auto py-3 px-4 text-base">
                    <FileEdit className="w-5 h-5 ml-2" />
                    הודעות
                  </Button>
                )}
                {user?.role === 'admin' && (
                  <Button onClick={() => handleSubcategorySelect('system_version')} variant="outline" className="justify-start h-auto py-3 px-4 text-base">
                    <Sparkles className="w-5 h-5 ml-2" />
                    גרסת המערכת
                  </Button>
                )}
              </div>
            );
        }
        if (activeCategory === 'logs') {
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {user?.management_can_view_access_log && (
                  <Button onClick={() => handleSubcategorySelect('access_log')} variant="outline" className="justify-start h-auto py-3 px-4 text-base">
                    <ShieldCheck className="w-5 h-5 ml-2" />
                    לוג גישה
                  </Button>
                )}
                {user?.role === 'admin' && (
                  <Button onClick={() => handleSubcategorySelect('activity_log')} variant="outline" className="justify-start h-auto py-3 px-4 text-base">
                    <Activity className="w-5 h-5 ml-2" />
                    לוג פעולות
                  </Button>
                )}
                {user?.management_can_view_whatsapp_outbox && (
                  <Button onClick={() => handleSubcategorySelect('whatsapp_outbox')} variant="outline" className="justify-start h-auto py-3 px-4 text-base">
                    <Smartphone className="w-5 h-5 ml-2" />
                    תיבת וואטסאפ
                  </Button>
                )}
                {user?.management_can_view_data_cleanup && (
                  <Button onClick={() => handleSubcategorySelect('data_cleanup')} variant="outline" className="justify-start h-auto py-3 px-4 text-base">
                    <DatabaseZap className="w-5 h-5 ml-2" />
                    ניקוי נתונים
                  </Button>
                )}
                {user?.role === 'admin' && (
                  <Button onClick={() => handleSubcategorySelect('cv_enhancement')} variant="outline" className="justify-start h-auto py-3 px-4 text-base">
                    <Sparkles className="w-5 h-5 ml-2" />
                    השבחת קורות חיים
                  </Button>
                )}
                {user?.role === 'admin' && (
                  <Button onClick={() => handleSubcategorySelect('backup')} variant="outline" className="justify-start h-auto py-3 px-4 text-base">
                    <HardDrive className="w-5 h-5 ml-2" />
                    גיבוי ושחזור
                  </Button>
                )}
                {user?.role === 'admin' && (
                  <Button onClick={() => handleSubcategorySelect('scan_failures')} variant="outline" className="justify-start h-auto py-3 px-4 text-base">
                    <AlertCircle className="w-5 h-5 ml-2" />
                    קבצים שנכשלו בסריקה
                  </Button>
                )}
                {user?.role === 'admin' && (
                  <Button 
                    onClick={runFullScanAllAgents}
                    disabled={runningFullScan}
                    className="justify-start h-auto py-3 px-4 text-base bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    {runningFullScan ? (
                      <><Loader2 className="w-5 h-5 ml-2 animate-spin" /> סורק...</>
                    ) : (
                      <><RefreshCw className="w-5 h-5 ml-2" /> סריקה מלאה - כל בסיס הנתונים</>
                    )}
                  </Button>
                )}
                {user?.role === 'admin' && (
                  <Button 
                    onClick={revalidateAllAgents}
                    disabled={Object.values(revalidatingAgents).some(v => v)}
                    className="justify-start h-auto py-3 px-4 text-base bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    {Object.values(revalidatingAgents).some(v => v) ? (
                      <><Loader2 className="w-5 h-5 ml-2 animate-spin" /> מעבד...</>
                    ) : (
                      <><RefreshCw className="w-5 h-5 ml-2" /> עדכון התאמות קיימות</>
                    )}
                  </Button>
                )}
                {hasCompletedTutorial && (
                  <Button onClick={startTutorial} variant="outline" className="justify-start h-auto py-3 px-4 text-base border-blue-300 text-blue-700">
                    <BookOpen className="w-5 h-5 ml-2" />
                    מדריך המערכת
                  </Button>
                )}
              </div>
            );
        }
        return null;
    };

    const revalidateAllAgents = async () => {
        const agents = ['naama', 'alik', 'itay', 'lior', 'ofir', 'gc', 'rami'];
        const agentNames = {
            naama: 'נעמה',
            alik: 'אליק', 
            itay: 'איתי',
            lior: 'ליאור',
            ofir: 'אופיר',
            gc: 'GC',
            rami: 'רמי'
        };

        toast.info('מתחיל בדיקה מחודשת של התאמות קיימות - זה יכול לקחת כמה דקות...');

        for (const agent of agents) {
            setRevalidatingAgents(prev => ({ ...prev, [agent]: true }));
            
            try {
                toast.loading(`מעבד את ${agentNames[agent]}...`, { id: agent });
                
                const result = await revalidateAllAgentMatches({ agent_name: agent });
                
                if (result.data?.success) {
                    toast.success(
                        `${agentNames[agent]}: ${result.data.processed} נבדקו, ${result.data.updated} עודכנו, ${result.data.deleted} נמחקו`,
                        { id: agent, duration: 5000 }
                    );
                } else {
                    toast.error(`${agentNames[agent]}: ${result.data?.error || 'שגיאה'}`, { id: agent });
                }
            } catch (error) {
                toast.error(`${agentNames[agent]}: ${error.message}`, { id: agent });
            }
            
            setRevalidatingAgents(prev => ({ ...prev, [agent]: false }));
            
            // Delay between agents to avoid overload
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        toast.success('בדיקה מחודשת הושלמה לכל הסוכנים!');
    };

    const loadData = async (retries = 3) => {
        setLoading(true);
        try {
            const me = await base44.auth.me();
            const userWithPermissions = {
                ...me,
                ...(defaultPermissionsByAppRole[me.app_role] || {})
            };
            setUser(userWithPermissions);
        } catch (error) {
            console.error("Failed to load user data:", error);
            if (retries > 0 && error.message?.includes('Network')) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                return loadData(retries - 1);
            }
        }
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    if (loading) {
        return (
            <div className="h-full w-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!user || (!user.can_view_management && user.role !== 'admin')) {
        return <Navigate to={createPageUrl("Dashboard")} />;
    }

    return (
        <div className="p-4 md:p-8 space-y-8">
            {/* Tutorial */}
            <ManagementTutorial isOpen={isTutorialOpen} onClose={closeTutorial} />
            
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                    <img 
                      src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face" 
                      alt="רביב" 
                      className="w-16 h-16 rounded-full object-cover border-4 border-gray-200 shadow-lg"
                    />
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">רביב - ניהול מערכת</h1>
                        <p className="text-gray-600">מנהל המערכת, אחראי על קליטת מיילים למערכת, ממשק עם פייפדרייב, אוטומציות, הגדרות מערכת, נהלים ושיטות הגיוס</p>
                    </div>
                </div>
                <TutorialHelpButton onClick={startTutorial} />
            </div>

            <Tabs defaultValue={initialTab} className="w-full">
                {/* Desktop View - Grouped Sections */}
                <div className="hidden md:block space-y-4" data-tutorial="management-tabs">
                    {/* סוכנים */}
                    {user?.role === 'admin' && (
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4" data-tutorial="agent-settings">
                            <h3 className="text-sm font-semibold text-purple-800 mb-3 flex items-center gap-2">
                                <BrainCircuit className="w-4 h-4" />
                                סוכנים
                            </h3>
                            <TabsList className="flex flex-wrap gap-2 h-auto bg-transparent p-0">
                                <TabsTrigger value="agent_settings" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white border border-purple-300 shadow-sm px-4 py-2 bg-white" dir="rtl">
                                    <BrainCircuit className="w-4 h-4 ml-2" />
                                    הגדרות סוכני WhatsApp
                                </TabsTrigger>
                                <TabsTrigger value="raviv" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white border border-purple-300 shadow-sm px-4 py-2 bg-white">
                                    <Settings className="w-4 h-4 ml-2" />
                                    רביב - ניטור מערכת
                                </TabsTrigger>
                                <TabsTrigger value="rotem" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white border border-purple-300 shadow-sm px-4 py-2 bg-white">
                                    <MessageCircle className="w-4 h-4 ml-2" />
                                    טל - מודל עבודה
                                </TabsTrigger>
                                <TabsTrigger value="elad" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white border border-purple-300 shadow-sm px-4 py-2 bg-white">
                                    <UserCheck className="w-4 h-4 ml-2" />
                                    אלעד - הגדרות שליחה
                                </TabsTrigger>
                                <TabsTrigger value="clients" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white border border-purple-300 shadow-sm px-4 py-2 bg-white">
                                    <Building className="w-4 h-4 ml-2" />
                                    ארגונים ואנשי קשר
                                </TabsTrigger>
                                <TabsTrigger value="match_settings" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white border border-purple-300 shadow-sm px-4 py-2 bg-white">
                                                                          <Zap className="w-4 h-4 ml-2" />
                                                                          מחלקת גיוס
                                                                      </TabsTrigger>
                                <TabsTrigger value="custom_chafshanim" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white border border-purple-300 shadow-sm px-4 py-2 bg-white">
                                    <Search className="w-4 h-4 ml-2" />
                                    חפשנים מותאמים
                                </TabsTrigger>



                                <TabsTrigger value="meni" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white border border-purple-300 shadow-sm px-4 py-2 bg-white">
                                    <Sparkles className="w-4 h-4 ml-2" />
                                    מני-מכירות אפקטיביות
                                </TabsTrigger>
                                <TabsTrigger value="eitan" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white border border-purple-300 shadow-sm px-4 py-2 bg-white">
                                   <Award className="w-4 h-4 ml-2" />
                                   איתן-איכות שירות
                                </TabsTrigger>
                                <TabsTrigger value="carmit" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white border border-purple-300 shadow-sm px-4 py-2 bg-white">
                                  <Mail className="w-4 h-4 ml-2" />
                                  כרמית-סיכום יומי
                                </TabsTrigger>
                                <TabsTrigger value="daily_matches_report" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white border border-purple-300 shadow-sm px-4 py-2 bg-white">
                                  <Mail className="w-4 h-4 ml-2" />
                                  דוח התאמות יומי
                                </TabsTrigger>
                                <TabsTrigger value="presentation" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white border border-purple-300 shadow-sm px-4 py-2 bg-white">
                                   <Presentation className="w-4 h-4 ml-2" />
                                   מצב הצגה
                                </TabsTrigger>

                                </TabsList>
                                </div>
                                )}

                                {/* ממשקים חיצוניים */}
                    {user?.role === 'admin' && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <h3 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
                                <Inbox className="w-4 h-4" />
                                ממשקים חיצוניים
                            </h3>
                            <TabsList className="flex flex-wrap gap-2 h-auto bg-transparent p-0">
                                 <TabsTrigger value="email_cv" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white border border-blue-300 shadow-sm px-4 py-2 bg-white">
                                     <Inbox className="w-4 h-4 ml-2" />
                                     קליטת מיילים
                                 </TabsTrigger>
                                 <TabsTrigger value="pipedrive" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white border border-blue-300 shadow-sm px-4 py-2 bg-white" data-tutorial="pipedrive-sync">
                                     <Building className="w-4 h-4 ml-2" />
                                     Pipedrive
                                 </TabsTrigger>
                                 <TabsTrigger value="email_service" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white border border-blue-300 shadow-sm px-4 py-2 bg-white" data-tutorial="email-service">
                                     <Mail className="w-4 h-4 ml-2" />
                                     דואר יוצא
                                 </TabsTrigger>
                                 {user?.role === 'admin' && (
                                     <TabsTrigger value="scan_failures_external" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white border border-blue-300 shadow-sm px-4 py-2 bg-white">
                                         <AlertCircle className="w-4 h-4 ml-2" />
                                         קבצים שנכשלו בסריקה
                                     </TabsTrigger>
                                 )}
                                 {user?.role === 'admin' && (
                                     <TabsTrigger value="conversion_log" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white border border-blue-300 shadow-sm px-4 py-2 bg-white">
                                         <RefreshCw className="w-4 h-4 ml-2" />
                                         המרות ConvertAPI
                                     </TabsTrigger>
                                 )}
                                 </TabsList>
                            </div>
                    )}

                    {/* קונפיגורציה */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
                            <Settings className="w-4 h-4" />
                            קונפיגורציה
                        </h3>
                        <TabsList className="flex flex-wrap gap-2 h-auto bg-transparent p-0">
                            {user?.management_can_view_users && (
                                <TabsTrigger value="users" className="data-[state=active]:bg-green-600 data-[state=active]:text-white border border-green-300 shadow-sm px-4 py-2 bg-white">
                                    <Users className="w-4 h-4 ml-2" />
                                    משתמשים
                                </TabsTrigger>
                            )}
                            {user?.management_can_view_candidate_status && (
                                <TabsTrigger value="candidate-status" className="data-[state=active]:bg-green-600 data-[state=active]:text-white border border-green-300 shadow-sm px-4 py-2 bg-white">
                                    <GitBranch className="w-4 h-4 ml-2" />
                                    מכונת מצבים
                                </TabsTrigger>
                            )}
                            {user?.management_can_view_synonyms && (
                                <TabsTrigger value="synonyms" className="data-[state=active]:bg-green-600 data-[state=active]:text-white border border-green-300 shadow-sm px-4 py-2 bg-white">
                                    <BookOpen className="w-4 h-4 ml-2" />
                                    מילים נרדפות
                                </TabsTrigger>
                            )}
                            {user?.management_can_edit_invitation_messages && (
                                <TabsTrigger value="message_templates" className="data-[state=active]:bg-green-600 data-[state=active]:text-white border border-green-300 shadow-sm px-4 py-2 bg-white">
                                    <FileEdit className="w-4 h-4 ml-2" />
                                    הודעות
                                </TabsTrigger>
                            )}
                            {user?.role === 'admin' && (
                                <TabsTrigger value="system_version" className="data-[state=active]:bg-green-600 data-[state=active]:text-white border border-green-300 shadow-sm px-4 py-2 bg-white">
                                    <Sparkles className="w-4 h-4 ml-2" />
                                    גרסת המערכת
                                </TabsTrigger>
                            )}
                            {user?.role === 'admin' && (
                                 <TabsTrigger value="api_keys" className="data-[state=active]:bg-green-600 data-[state=active]:text-white border border-green-300 shadow-sm px-4 py-2 bg-white">
                                     <Settings className="w-4 h-4 ml-2" />
                                     API Keys
                                 </TabsTrigger>
                             )}
                            {user?.role === 'admin' && (
                                 <TabsTrigger value="credits_usage" className="data-[state=active]:bg-green-600 data-[state=active]:text-white border border-green-300 shadow-sm px-4 py-2 bg-white">
                                     <Zap className="w-4 h-4 ml-2" />
                                     קרדיטים
                                 </TabsTrigger>
                             )}
                            {user?.role === 'admin' && (
                                 <TabsTrigger value="tutorial_settings" className="data-[state=active]:bg-green-600 data-[state=active]:text-white border border-green-300 shadow-sm px-4 py-2 bg-white">
                                     <BookOpen className="w-4 h-4 ml-2" />
                                     הגדרות עזרה
                                 </TabsTrigger>
                             )}
                             </TabsList>
                             </div>

                    {/* לוגים ותחזוקה */}
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-orange-800 mb-3 flex items-center gap-2">
                            <Activity className="w-4 h-4" />
                            לוגים ותחזוקה
                        </h3>
                        <TabsList className="flex flex-wrap gap-2 h-auto bg-transparent p-0">
                            {user?.management_can_view_access_log && (
                                <TabsTrigger value="access_log" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white border border-orange-300 shadow-sm px-4 py-2 bg-white">
                                    <ShieldCheck className="w-4 h-4 ml-2" />
                                    לוג גישה
                                </TabsTrigger>
                            )}
                            {user?.role === 'admin' && (
                                <TabsTrigger value="activity_log" className="data-[state=active]:bg-orange-600 data-[state-active]:text-white border border-orange-300 shadow-sm px-4 py-2 bg-white" data-tutorial="activity-log">
                                    <Activity className="w-4 h-4 ml-2" />
                                    לוג פעולות
                                </TabsTrigger>
                            )}
                            {user?.management_can_view_whatsapp_outbox && (
                                <TabsTrigger value="whatsapp_outbox" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white border border-orange-300 shadow-sm px-4 py-2 bg-white">
                                    <Smartphone className="w-4 h-4 ml-2" />
                                    תיבת וואטסאפ
                                </TabsTrigger>
                            )}
                            {user?.management_can_view_data_cleanup && (
                                <TabsTrigger value="data_cleanup" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white border border-orange-300 shadow-sm px-4 py-2 bg-white">
                                    <DatabaseZap className="w-4 h-4 ml-2" />
                                    ניקוי נתונים
                                </TabsTrigger>
                            )}
                            {user?.role === 'admin' && (
                                <TabsTrigger value="cv_enhancement" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white border border-orange-300 shadow-sm px-4 py-2 bg-white">
                                    <Sparkles className="w-4 h-4 ml-2" />
                                    השבחת קורות חיים
                                </TabsTrigger>
                            )}
                            {user?.role === 'admin' && (
                                <TabsTrigger value="backup" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white border border-orange-300 shadow-sm px-4 py-2 bg-white">
                                    <HardDrive className="w-4 h-4 ml-2" />
                                    גיבוי ושחזור
                                </TabsTrigger>
                            )}
                            {(user?.can_view_management || user?.role === 'admin') && (
                                <TabsTrigger value="internal_recovery" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white border border-orange-300 shadow-sm px-4 py-2 bg-white">
                                    <RotateCcw className="w-4 h-4 ml-2" />
                                    שחזור מועמדים פנימיים
                                </TabsTrigger>
                            )}
                        </TabsList>
                    </div>
                </div>

                {/* Mobile View - Collapsible Sections */}
                <div className="md:hidden space-y-3">
                    {/* סוכנים */}
                    {user?.role === 'admin' && (
                        <Collapsible defaultOpen className="bg-purple-50 border border-purple-200 rounded-lg">
                            <CollapsibleTrigger className="w-full p-3 flex items-center justify-between text-purple-800 font-semibold text-sm">
                                <div className="flex items-center gap-2">
                                    <BrainCircuit className="w-4 h-4" />
                                    סוכנים
                                </div>
                                <ChevronDown className="w-4 h-4" />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="px-3 pb-3">
                                <TabsList className="flex flex-col w-full h-auto bg-transparent p-0 gap-2">
                                    <TabsTrigger value="agent_settings" className="w-full justify-start data-[state=active]:bg-purple-600 data-[state=active]:text-white border border-purple-300 shadow-sm px-4 py-3 rounded-lg bg-white" dir="rtl">
                                        <BrainCircuit className="w-5 h-5 ml-3" />
                                        הגדרות סוכני WhatsApp
                                    </TabsTrigger>
                                    <TabsTrigger value="raviv" className="w-full justify-start data-[state=active]:bg-purple-600 data-[state=active]:text-white border border-purple-300 shadow-sm px-4 py-3 rounded-lg bg-white">
                                        <Settings className="w-5 h-5 ml-3" />
                                        רביב - ניטור מערכת
                                    </TabsTrigger>
                                    <TabsTrigger value="rotem" className="w-full justify-start data-[state=active]:bg-purple-600 data-[state=active]:text-white border border-purple-300 shadow-sm px-4 py-3 rounded-lg bg-white">
                                        <MessageCircle className="w-5 h-5 ml-3" />
                                        טל - מודל עבודה
                                    </TabsTrigger>
                                    <TabsTrigger value="elad" className="w-full justify-start data-[state=active]:bg-purple-600 data-[state=active]:text-white border border-purple-300 shadow-sm px-4 py-3 rounded-lg bg-white">
                                        <UserCheck className="w-5 h-5 ml-3" />
                                        אלעד - הגדרות שליחה
                                    </TabsTrigger>
                                    <TabsTrigger value="clients" className="w-full justify-start data-[state=active]:bg-purple-600 data-[state=active]:text-white border border-purple-300 shadow-sm px-4 py-3 rounded-lg bg-white">
                                        <Building className="w-5 h-5 ml-3" />
                                        ארגונים ואנשי קשר
                                    </TabsTrigger>
                                    <TabsTrigger value="match_settings" className="w-full justify-start data-[state=active]:bg-purple-600 data-[state=active]:text-white border border-purple-300 shadow-sm px-4 py-3 rounded-lg bg-white">
                                                                                   <Zap className="w-5 h-5 ml-3" />
                                                                                   מחלקת גיוס
                                                                               </TabsTrigger>
                                    <TabsTrigger value="custom_chafshanim" className="w-full justify-start data-[state=active]:bg-purple-600 data-[state=active]:text-white border border-purple-300 shadow-sm px-4 py-3 rounded-lg bg-white">
                                        <Search className="w-5 h-5 ml-3" />
                                        חפשנים מותאמים
                                    </TabsTrigger>



                                    <TabsTrigger value="meni" className="w-full justify-start data-[state=active]:bg-purple-600 data-[state=active]:text-white border border-purple-300 shadow-sm px-4 py-3 rounded-lg bg-white">
                                        <Sparkles className="w-5 h-5 ml-3" />
                                        מני-מכירות אפקטיביות
                                    </TabsTrigger>
                                    <TabsTrigger value="eitan" className="w-full justify-start data-[state=active]:bg-purple-600 data-[state=active]:text-white border border-purple-300 shadow-sm px-4 py-3 rounded-lg bg-white">
                                       <Award className="w-5 h-5 ml-3" />
                                       איתן-איכות שירות
                                    </TabsTrigger>
                                    <TabsTrigger value="carmit" className="w-full justify-start data-[state=active]:bg-purple-600 data-[state=active]:text-white border border-purple-300 shadow-sm px-4 py-3 rounded-lg bg-white">
                                       <Mail className="w-5 h-5 ml-3" />
                                       כרמית-סיכום יומי
                                     </TabsTrigger>
                                     <TabsTrigger value="daily_matches_report" className="w-full justify-start data-[state=active]:bg-purple-600 data-[state=active]:text-white border border-purple-300 shadow-sm px-4 py-3 rounded-lg bg-white">
                                       <Mail className="w-5 h-5 ml-3" />
                                       דוח התאמות יומי
                                     </TabsTrigger>
                                    <TabsTrigger value="presentation" className="w-full justify-start data-[state=active]:bg-purple-600 data-[state=active]:text-white border border-purple-300 shadow-sm px-4 py-3 rounded-lg bg-white">
                                       <Presentation className="w-5 h-5 ml-3" />
                                       מצב הצגה
                                    </TabsTrigger>

                                    </TabsList>
                                    </CollapsibleContent>
                                    </Collapsible>
                                    )}

                                    {/* ממשקים חיצוניים */}
                                    {user?.role === 'admin' && (
                        <Collapsible className="bg-blue-50 border border-blue-200 rounded-lg">
                            <CollapsibleTrigger className="w-full p-3 flex items-center justify-between text-blue-800 font-semibold text-sm">
                                <div className="flex items-center gap-2">
                                    <Inbox className="w-4 h-4" />
                                    ממשקים חיצוניים
                                </div>
                                <ChevronDown className="w-4 h-4" />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="px-3 pb-3">
                                <TabsList className="flex flex-col w-full h-auto bg-transparent p-0 gap-2">
                                     <TabsTrigger value="email_cv" className="w-full justify-start data-[state=active]:bg-blue-600 data-[state=active]:text-white border border-blue-300 shadow-sm px-4 py-3 rounded-lg bg-white">
                                         <Inbox className="w-5 h-5 ml-3" />
                                         קליטת מיילים
                                     </TabsTrigger>
                                     <TabsTrigger value="pipedrive" className="w-full justify-start data-[state=active]:bg-blue-600 data-[state=active]:text-white border border-blue-300 shadow-sm px-4 py-3 rounded-lg bg-white">
                                         <Building className="w-5 h-5 ml-3" />
                                         Pipedrive
                                     </TabsTrigger>
                                     <TabsTrigger value="email_service" className="w-full justify-start data-[state=active]:bg-blue-600 data-[state=active]:text-white border border-blue-300 shadow-sm px-4 py-3 rounded-lg bg-white">
                                         <Mail className="w-5 h-5 ml-3" />
                                         דואר יוצא
                                     </TabsTrigger>
                                     {user?.role === 'admin' && (
                                         <TabsTrigger value="scan_failures_external" className="w-full justify-start data-[state=active]:bg-blue-600 data-[state=active]:text-white border border-blue-300 shadow-sm px-4 py-3 rounded-lg bg-white">
                                             <AlertCircle className="w-5 h-5 ml-3" />
                                             קבצים שנכשלו בסריקה
                                         </TabsTrigger>
                                     )}
                                     {user?.role === 'admin' && (
                                         <TabsTrigger value="conversion_log" className="w-full justify-start data-[state=active]:bg-blue-600 data-[state=active]:text-white border border-blue-300 shadow-sm px-4 py-3 rounded-lg bg-white">
                                             <RefreshCw className="w-5 h-5 ml-3" />
                                             המרות ConvertAPI
                                         </TabsTrigger>
                                     )}
                                 </TabsList>
                            </CollapsibleContent>
                        </Collapsible>
                    )}

                    {/* קונפיגורציה */}
                    <Collapsible className="bg-green-50 border border-green-200 rounded-lg">
                        <CollapsibleTrigger className="w-full p-3 flex items-center justify-between text-green-800 font-semibold text-sm">
                            <div className="flex items-center gap-2">
                                <Settings className="w-4 h-4" />
                                קונפיגורציה
                            </div>
                            <ChevronDown className="w-4 h-4" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="px-3 pb-3">
                            <TabsList className="flex flex-col w-full h-auto bg-transparent p-0 gap-2">
                                {user?.management_can_view_users && (
                                    <TabsTrigger value="users" className="w-full justify-start data-[state=active]:bg-green-600 data-[state=active]:text-white border border-green-300 shadow-sm px-4 py-3 rounded-lg bg-white">
                                        <Users className="w-5 h-5 ml-3" />
                                        משתמשים
                                    </TabsTrigger>
                                )}
                                {user?.management_can_view_candidate_status && (
                                    <TabsTrigger value="candidate-status" className="w-full justify-start data-[state=active]:bg-green-600 data-[state=active]:text-white border border-green-300 shadow-sm px-4 py-3 rounded-lg bg-white">
                                        <GitBranch className="w-5 h-5 ml-3" />
                                        מכונת מצבים
                                    </TabsTrigger>
                                )}
                                {user?.management_can_view_synonyms && (
                                    <TabsTrigger value="synonyms" className="w-full justify-start data-[state=active]:bg-green-600 data-[state=active]:text-white border border-green-300 shadow-sm px-4 py-3 rounded-lg bg-white">
                                        <BookOpen className="w-5 h-5 ml-3" />
                                        מילים נרדפות
                                    </TabsTrigger>
                                )}
                                {user?.management_can_edit_invitation_messages && (
                                    <TabsTrigger value="message_templates" className="w-full justify-start data-[state=active]:bg-green-600 data-[state=active]:text-white border border-green-300 shadow-sm px-4 py-3 rounded-lg bg-white">
                                        <FileEdit className="w-5 h-5 ml-3" />
                                        הודעות
                                    </TabsTrigger>
                                )}
                                {user?.role === 'admin' && (
                                    <TabsTrigger value="system_version" className="w-full justify-start data-[state=active]:bg-green-600 data-[state=active]:text-white border border-green-300 shadow-sm px-4 py-3 rounded-lg bg-white">
                                        <Sparkles className="w-5 h-5 ml-3" />
                                        גרסת המערכת
                                    </TabsTrigger>
                                )}
                                {user?.role === 'admin' && (
                                    <TabsTrigger value="api_keys" className="w-full justify-start data-[state=active]:bg-green-600 data-[state=active]:text-white border border-green-300 shadow-sm px-4 py-3 rounded-lg bg-white">
                                        <Settings className="w-5 h-5 ml-3" />
                                        API Keys
                                    </TabsTrigger>
                                )}
                                {user?.role === 'admin' && (
                                    <TabsTrigger value="tutorial_settings" className="w-full justify-start data-[state=active]:bg-green-600 data-[state=active]:text-white border border-green-300 shadow-sm px-4 py-3 rounded-lg bg-white">
                                        <BookOpen className="w-5 h-5 ml-3" />
                                        הגדרות עזרה
                                    </TabsTrigger>
                                )}
                                </TabsList>
                                </CollapsibleContent>
                                </Collapsible>

                    {/* לוגים ותחזוקה */}
                    <Collapsible className="bg-orange-50 border border-orange-200 rounded-lg">
                        <CollapsibleTrigger className="w-full p-3 flex items-center justify-between text-orange-800 font-semibold text-sm">
                            <div className="flex items-center gap-2">
                                <Activity className="w-4 h-4" />
                                לוגים ותחזוקה
                            </div>
                            <ChevronDown className="w-4 h-4" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="px-3 pb-3">
                            <TabsList className="flex flex-col w-full h-auto bg-transparent p-0 gap-2">
                                {user?.management_can_view_access_log && (
                                    <TabsTrigger value="access_log" className="w-full justify-start data-[state=active]:bg-orange-600 data-[state=active]:text-white border border-orange-300 shadow-sm px-4 py-3 rounded-lg bg-white">
                                        <ShieldCheck className="w-5 h-5 ml-3" />
                                        לוג גישה
                                    </TabsTrigger>
                                )}
                                {user?.role === 'admin' && (
                                    <TabsTrigger value="activity_log" className="w-full justify-start data-[state=active]:bg-orange-600 data-[state=active]:text-white border border-orange-300 shadow-sm px-4 py-3 rounded-lg bg-white">
                                        <Activity className="w-5 h-5 ml-3" />
                                        לוג פעולות
                                    </TabsTrigger>
                                )}
                                {user?.management_can_view_whatsapp_outbox && (
                                    <TabsTrigger value="whatsapp_outbox" className="w-full justify-start data-[state=active]:bg-orange-600 data-[state=active]:text-white border border-orange-300 shadow-sm px-4 py-3 rounded-lg bg-white">
                                        <Smartphone className="w-5 h-5 ml-3" />
                                        תיבת וואטסאפ
                                    </TabsTrigger>
                                )}
                                {user?.management_can_view_data_cleanup && (
                                    <TabsTrigger value="data_cleanup" className="w-full justify-start data-[state=active]:bg-orange-600 data-[state=active]:text-white border border-orange-300 shadow-sm px-4 py-3 rounded-lg bg-white">
                                        <DatabaseZap className="w-5 h-5 ml-3" />
                                        ניקוי נתונים
                                    </TabsTrigger>
                                )}
                                {user?.role === 'admin' && (
                                    <TabsTrigger value="cv_enhancement" className="w-full justify-start data-[state=active]:bg-orange-600 data-[state=active]:text-white border border-orange-300 shadow-sm px-4 py-3 rounded-lg bg-white">
                                        <Sparkles className="w-5 h-5 ml-3" />
                                        השבחת קורות חיים
                                    </TabsTrigger>
                                )}
                                {user?.role === 'admin' && (
                                    <TabsTrigger value="backup" className="w-full justify-start data-[state=active]:bg-orange-600 data-[state=active]:text-white border border-orange-300 shadow-sm px-4 py-3 rounded-lg bg-white">
                                        <HardDrive className="w-5 h-5 ml-3" />
                                        גיבוי ושחזור
                                    </TabsTrigger>
                                )}
                                {user?.role === 'admin' && (
                                    <TabsTrigger value="scan_failures" className="w-full justify-start data-[state=active]:bg-orange-600 data-[state-active]:text-white border border-orange-300 shadow-sm px-4 py-3 rounded-lg bg-white">
                                        <AlertCircle className="w-5 h-5 ml-3" />
                                        קבצים שנכשלו בסריקה
                                    </TabsTrigger>
                                )}
                                {(user?.can_view_management || user?.role === 'admin') && (
                                    <TabsTrigger value="internal_recovery" className="w-full justify-start data-[state=active]:bg-orange-600 data-[state=active]:text-white border border-orange-300 shadow-sm px-4 py-3 rounded-lg bg-white">
                                        <RotateCcw className="w-5 h-5 ml-3" />
                                        שחזור מועמדים פנימיים
                                    </TabsTrigger>
                                )}
                                </TabsList>
                                </CollapsibleContent>
                                </Collapsible>
                </div>

                {user?.management_can_view_users && (
                    <TabsContent value="users">
                        <UsersManagement currentUser={user} defaultPermissionsByAppRole={defaultPermissionsByAppRole} />
                    </TabsContent>
                )}


                
                {user?.management_can_view_synonyms && (
                    <TabsContent value="synonyms">
                        <SynonymManagement />
                    </TabsContent>
                )}

                {user?.management_can_view_candidate_status && (
                    <TabsContent value="candidate-status">
                        <CandidateStatusManagement />
                    </TabsContent>
                )}

                {user?.management_can_view_access_log && (
                    <TabsContent value="access_log">
                        <AccessLogPage />
                    </TabsContent>
                )}

                {user?.role === 'admin' && (
                    <TabsContent value="email_cv">
                        <div className="space-y-6">
                            <EmailScannerControl />
                            <EmailCvManagement />
                        </div>
                    </TabsContent>
                )}

                {user?.management_can_view_data_cleanup && (
                    <TabsContent value="data_cleanup">
                        <DataCleanup currentUser={user} />
                    </TabsContent>
                )}

                {user?.management_can_edit_invitation_messages && (
                    <TabsContent value="message_templates">
                        <MessageTemplates currentUser={user} />
                    </TabsContent>
                )}

                {user?.management_can_view_whatsapp_outbox && (
                    <TabsContent value="whatsapp_outbox">
                        <WhatsAppOutboxTable />
                    </TabsContent>
                )}

                {(user?.role === 'admin' || user?.can_view_management) && (
                    <TabsContent value="match_settings">
                        <MatchSettingsManagement />
                    </TabsContent>
                )}

                {user?.role === 'admin' && (
                    <TabsContent value="pipedrive">
                        <PipedriveSync />
                    </TabsContent>
                )}

                {user?.role === 'admin' && (
                    <TabsContent value="email_service">
                        <EmailServiceManagement />
                    </TabsContent>
                )}

                {user?.role === 'admin' && (
                    <TabsContent value="scan_failures_external">
                        <ScanFailuresReport />
                    </TabsContent>
                )}



                {user?.role === 'admin' && (
                    <TabsContent value="raviv">
                      <RavivManagement />
                    </TabsContent>
                )}

                {user?.role === 'admin' && (
                    <TabsContent value="rotem">
                      <RotemSettingsManagement />
                    </TabsContent>
                )}

                {user?.role === 'admin' && (
                    <TabsContent value="elad">
                        <EladManagement />
                    </TabsContent>
                )}

                {user?.role === 'admin' && (
                    <TabsContent value="activity_log">
                        <SystemActivityLogView />
                    </TabsContent>
                )}

                {user?.role === 'admin' && (
                    <TabsContent value="agent_settings">
                        <AgentSettingsTab />
                    </TabsContent>
                )}





                {user?.role === 'admin' && (
                    <TabsContent value="meni">
                        <MeniManagement />
                    </TabsContent>
                )}

                {user?.role === 'admin' && (
                    <TabsContent value="eitan">
                        <EitanManagement />
                    </TabsContent>
                )}

                {user?.role === 'admin' && (
                    <TabsContent value="carmit">
                        <CarmitManagement />
                    </TabsContent>
                )}

                {user?.role === 'admin' && (
                    <TabsContent value="daily_matches_report">
                        <DailyMatchesReportSettings />
                    </TabsContent>
                )}

                {user?.role === 'admin' && (
                    <TabsContent value="cv_enhancement">
                        <CvEnhancementManager />
                    </TabsContent>
                )}

                {user?.role === 'admin' && (
                    <TabsContent value="clients">
                        <ClientsManagement />
                    </TabsContent>
                )}

                {user?.role === 'admin' && (
                    <TabsContent value="presentation">
                        <PresentationMode />
                    </TabsContent>
                )}

                {user?.role === 'admin' && (
                    <TabsContent value="backup">
                        <BackupManagement />
                    </TabsContent>
                )}

                {user?.role === 'admin' && (
                    <TabsContent value="scan_failures">
                        <ScanFailuresReport />
                    </TabsContent>
                )}

                {user?.role === 'admin' && (
                    <TabsContent value="conversion_log">
                        <ConversionLogManagement />
                    </TabsContent>
                )}

                {user?.role === 'admin' && (
                    <TabsContent value="system_version">
                        <SystemVersionManagement />
                    </TabsContent>
                )}

                {user?.role === 'admin' && (
                    <TabsContent value="api_keys">
                        <APIKeyManagement />
                    </TabsContent>
                )}

                {user?.role === 'admin' && (
                    <TabsContent value="credits_usage">
                        <CreditsUsageDashboard currentUser={user} isAdminView={true} />
                    </TabsContent>
                )}

                {user?.role === 'admin' && (
                     <TabsContent value="tutorial_settings">
                         <TutorialSettingsManagement />
                     </TabsContent>
                 )}

                {user?.role === 'admin' && (
                    <TabsContent value="custom_chafshanim">
                        <CustomChafshanim />
                    </TabsContent>
                )}

                {(user?.can_view_management || user?.role === 'admin') && (
                     <TabsContent value="internal_recovery">
                         <InternalCandidatesRecovery />
                     </TabsContent>
                 )}

                </Tabs>
            </div>
        );
        }

function TutorialSettingsManagement() {
     const [tutorialsEnabled, setTutorialsEnabled] = useState(true);
     const [loading, setLoading] = useState(true);
     const [saving, setSaving] = useState(false);

     useEffect(() => {
         loadTutorialSettings();
     }, []);

     const loadTutorialSettings = async () => {
         try {
             const settings = localStorage.getItem('tutorials_enabled');
             setTutorialsEnabled(settings !== 'false');
         } catch (error) {
             console.error('Error loading tutorial settings:', error);
         } finally {
             setLoading(false);
         }
     };

     const handleToggleTutorials = async (enabled) => {
         setSaving(true);
         try {
             localStorage.setItem('tutorials_enabled', String(enabled));
             setTutorialsEnabled(enabled);
             toast.success(enabled ? 'מסכי העזרה הופעלו' : 'מסכי העזרה הושביתו');
         } catch (error) {
             console.error('Error saving tutorial settings:', error);
             toast.error('שגיאה בשמירת ההגדרות');
         } finally {
             setSaving(false);
         }
     };

     if (loading) {
         return <div className="flex items-center justify-center p-8"><Loader2 className="w-8 h-8 animate-spin" /></div>;
     }

     return (
         <div className="space-y-6">
             <Card>
                 <CardHeader>
                     <CardTitle className="flex items-center gap-2">
                         <BookOpen className="w-5 h-5" />
                         הגדרות מסכי העזרה
                     </CardTitle>
                 </CardHeader>
                 <CardContent className="space-y-4">
                     <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
                         <div>
                             <Label className="text-base font-semibold">הצג מסכי עזרה אוטומטיים</Label>
                             <p className="text-sm text-gray-600 mt-1">
                                 כאשר מופעל, מסכי עזרה יופיעו באופן אוטומטי בעת כניסה לדפים חדשים לראשונה
                             </p>
                         </div>
                         <Switch
                             checked={tutorialsEnabled}
                             onCheckedChange={handleToggleTutorials}
                             disabled={saving}
                         />
                     </div>

                     <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-700">
                         <strong>מצב נוכחי:</strong> מסכי העזרה {tutorialsEnabled ? '✅ מופעלים' : '❌ משביתים'}
                         <p className="mt-2 text-xs text-gray-600">
                             ניתן להציג מסכי עזרה בכל עת על ידי לחיצה על כפתור "עזרה" בכל דף
                         </p>
                     </div>
                 </CardContent>
             </Card>
         </div>
     );
}