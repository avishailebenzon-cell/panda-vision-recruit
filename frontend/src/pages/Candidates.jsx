import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Candidate } from "@/entities/Candidate";
import { User } from "@/entities/User";
import { NewCandidateInbox } from "@/entities/NewCandidateInbox";
import { Client } from "@/entities/Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  Search,
  Edit,
  Trash2,
  FileText,
  Mail,
  Phone,
  MapPin,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Upload,
  Send,
  Smartphone,
  Eye,
  Clock,
  Share2,
  BrainCircuit,
  LayoutGrid,
  TableIcon,
  Calculator,
  MessageCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Briefcase,
  GitMerge
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import BackgroundFileUpload from "../components/candidates/BackgroundFileUpload";
import {
  Dialog as UploadDialog,
  DialogContent as UploadDialogContent,
  DialogHeader as UploadDialogHeader,
  DialogTitle as UploadDialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { sendCandidateToClients } from "@/functions/sendCandidateToClients";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import SendCvToClientDialog from "../components/candidates/SendCvToClientDialog";
import { searchCandidates } from "@/functions/searchCandidates";
import { getMatchCountsForCandidates } from "@/functions/getMatchCountsForCandidates";
import InterviewQuestionsDialog from "../components/candidates/InterviewQuestionsDialog";
import ClientCvFormatterDialog from "../components/candidates/ClientCvFormatterDialog";
import { checkDuplicateCandidates } from "@/functions/checkDuplicateCandidates";
import DuplicateCheckDialog from "../components/candidates/DuplicateCheckDialog"; // Changed from DuplicateCheckDialog.jsx
import { MobileTabs, MobileTabsButtons, MobileTabButton, MobileTabsContent } from "@/components/ui/mobile-tabs";
import CandidateStatusSelector from "../components/candidates/CandidateStatusSelector";
import CandidateSearch from "../components/candidates/CandidateSearch";
import { Job } from "@/entities/Job";
import BulkStatusSelector from "../components/candidates/BulkStatusSelector";
import CandidateTagsBadges from "../components/candidates/CandidateTagsBadges";
import CandidateWhatsappHistory from "../components/candidates/CandidateWhatsappHistory";
import CandidateCommunicationHistory from "../components/candidates/CandidateCommunicationHistory";
import { base44 } from '@/api/base44Client';
import { ScrollArea } from "@/components/ui/scroll-area";
import MergeCandidatesDialog from "../components/candidates/MergeCandidatesDialog";
import CandidateForm from "../components/candidates/CandidateFormDialog";
import { CandidateActionsDropdown, InboxCandidateActionsDropdown } from "../components/candidates/CandidateActionsDropdown";
// Mock user hook and navigation function for a self-contained functional file
// In a real application, these would come from your authentication context or routing library.
const useUser = () => {
  // Simulating a logged-in user with permissions and template
  const [user, setUser] = useState({
    id: 'user-123',
    role: 'admin',
    can_view_candidates: true,
    can_send_email_to_clients: true, // Existing email send permission
    can_send_whatsapp_to_clients: true, // Existing WhatsApp send permission
    can_send_candidate_email_to_client: true, // NEW: Added permission for sending candidate via email
    can_send_candidate_whatsapp_to_client: true, // NEW: Added permission for sending candidate via WhatsApp
    new_candidate_message_template: "שלום {client_name},\n\nרצינו לעדכן אותך שנקלט למערכת שלנו מועמד חדש שעשוי להתאים לדרישות שלך.\n\nפרטי המועמד:\n- שם: {candidate_name}\n- אימייל: {candidate_email}\n- טלפון: {candidate_phone}\n- סיווג בטחוני: {security_clearance}\n- תחומי התמחות: {skills_summary}\n\nקורות החיים המלאים מצורפים להודעה זו.\n\nנשמח לקבל החלטה או להתייעץ איתך בנוגע למועמד זה.\n\nבברכה,\nצוות פנדה-טק",
    whatsapp_client_message_template: "שלום {client_name},\n\nרצינו לעדכן על מועמד חדש: *{candidate_name}*.\n\nפרטי המועמד:\n- *שם*: {candidate_name}\n- *אימייל*: {candidate_email}\n- *טלפון*: {candidate_phone}\n- *סיווג בטחוני*: {security_clearance}\n- *תחומי התמחות*: {skills_summary}\n\nקורות חיים מלאים נשלחו למייל שלך. נשמח לקבל החלטה או להתייעץ איתך בנוגע למועמד זה.\n\nבברכה,\nצוות פנדה-טק", // NEW: Added WhatsApp template
    dropbox_url_1: 'https://www.dropbox.com/sh/test1', // Example URL for testing
    dropbox_url_2: '',
    dropbox_url_3: ''
  });
  // You might have useEffect here to load actual user data from an API
  return user;
};

const Navigate = ({ to }) => {
  // Simple mock for React Router's Navigate component
  useEffect(() => {
    console.log(`Navigating to: ${to}`);
    // In a real app, you'd use history.push or similar
  }, [to]);
  return null; // Does not render anything
};

const createPageUrl = (pageName) => {
  // Simple mock for a function that creates page URLs
  switch (pageName) {
    case "Home": return "/";
    default: return `/${pageName.toLowerCase()}`;
  }
};


export default function CandidatesPage() { // Changed from Candidates to CandidatesPage
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, message: "", onConfirm: null });
  
  // States for the new Dropbox flow (removed states related to manual detection and processing)
  const [detectionError, setDetectionError] = useState("");
  
  // NEW: States for inbox and client sending
  const [inboxCandidates, setInboxCandidates] = useState([]);
  const [loadingInbox, setLoadingInbox] = useState(true); // NEW: loading state for inbox
  const [clients, setClients] = useState([]);
  const [sendDialog, setSendDialog] = useState({
      isOpen: false,
      candidate: null,
      selectedClients: [],
      messageTemplate: ''
  });
  const [sendingEmail, setSendingEmail] = useState(false);
  const [whatsappSendDialog, setWhatsappSendDialog] = useState({
      isOpen: false,
      candidate: null,
      messageTemplate: ''
  });
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false); // NEW
  const [sendCvDialogState, setSendCvDialogState] = useState({ isOpen: false, candidate: null }); // NEW
  const [interviewDialogState, setInterviewDialogState] = useState({ isOpen: false, candidate: null });
  const [clientCvDialogState, setClientCvDialogState] = useState({ isOpen: false, candidate: null }); // NEW STATE

  // NEW: State for duplicate checking in manual form
  const [duplicateDialog, setDuplicateDialog] = useState({
    isOpen: false,
    candidateData: null,
    duplicates: [],
    pendingSubmit: null
  });
  const [inboxSearchTerm, setInboxSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("inbox"); // 'database' or 'inbox' - default to inbox
  const [viewMode, setViewMode] = useState("table"); // 'cards' or 'table' - default to table
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedInboxIds, setSelectedInboxIds] = useState([]);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState([]);
  const [inboxViewMode, setInboxViewMode] = useState("table"); // 'cards' or 'table'
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [inboxSecurityFilter, setInboxSecurityFilter] = useState("all");
  const [jobs, setJobs] = useState([]);
  const [currentUserData, setCurrentUserData] = useState(null);
  const [whatsappHistoryDialog, setWhatsappHistoryDialog] = useState({ isOpen: false, candidate: null });
  const [communicationHistoryDialog, setCommunicationHistoryDialog] = useState({ isOpen: false, candidate: null });
  const [sortField, setSortField] = useState(null); // 'name' or 'date'
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'
  const [securityFilter, setSecurityFilter] = useState("all");
  const [databaseStatusFilter, setDatabaseStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("created_date");
  const [candidateJobsDialog, setCandidateJobsDialog] = useState({ isOpen: false, candidate: null, matches: [], loading: false });
  const [mergeDialog, setMergeDialog] = useState({ isOpen: false, candidates: [] });
  const [matchCountMap, setMatchCountMap] = useState({}); // candidateId → match count

  // NEW: Get current user (mocked for this file)
  const user = useUser();

  // Enhanced retry function for network operations - wrapped in useCallback for stability
  const retryNetworkOperation = useCallback(async (operation, maxRetries = 3, baseDelay = 1000) => {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        console.warn(`Network operation attempt ${attempt + 1}/${maxRetries + 1} failed:`, error.message, error.response?.status);
        
        // Check if we should retry
        const isNetworkError = error.message?.includes('Network Error') || 
                              error.message?.includes('too_many_connections') ||
                              (error.response && [500, 502, 503, 504].includes(error.response.status));
        
        if (!isNetworkError || attempt === maxRetries) {
          throw error;
        }
        
        // Calculate delay with exponential backoff
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }, []); // Empty dependency array because it doesn't depend on any changing state or props

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    try {
      // Only load minimal data - search will be done via backend
      const candidatesList = await retryNetworkOperation(async () => {
        return await Candidate.list("-created_date", 100);
      });
      setCandidates(candidatesList);
      setDetectionError("");
    } catch (error) {
      console.error("Error loading candidates:", error);
      setDetectionError("שגיאה בטעינת רשימת המועמדים. ייתכן שיש עומס על הרשת. נסה לרענן את הדף.");
    } finally {
      setLoading(false); // Always reset loading — prevent page from being stuck on spinner
    }
  }, [retryNetworkOperation]);

  // Search via backend with client-side fallback
  const performBackendSearch = useCallback(async (searchTerm, securityFilter, statusFilter) => {
    try {
      const response = await searchCandidates({
        searchTerm,
        securityFilter,
        statusFilter,
        sortBy: sortBy,
        limit: 5000
      });

      // Handle both possible response shapes from base44 function invocation
      const data = response?.data ?? response;
      if (data?.success && Array.isArray(data.candidates)) {
        return data.candidates;
      }
      // Backend returned but without expected structure — fall through to client-side
    } catch (error) {
      console.error("Backend search error — falling back to client-side filter:", error);
    }

    // Client-side fallback: filter from already-loaded candidates
    // (works only on the currently loaded page of ~100 candidates)
    const normalizedSearch = (searchTerm || "").toLowerCase().trim();
    const searchWords = normalizedSearch.split(/\s+/).filter(w => w.length > 0);

    return candidates.filter(c => {
      const matchesSecurity = securityFilter === "all" || c.security_clearance === securityFilter;
      const matchesStatus   = statusFilter   === "all" || c.status             === statusFilter;
      if (!matchesSecurity || !matchesStatus) return false;

      if (searchWords.length === 0) return true;

      const text = [
        c.first_name, c.last_name, c.first_name_english, c.last_name_english,
        c.email, c.phone_primary, c.phone_secondary,
        c.city, c.skills_summary, c.security_clearance, c.id_number
      ].filter(Boolean).join(' ').toLowerCase();

      return searchWords.every(word => text.includes(word));
    });
  }, [sortBy, candidates]);

  // NEW: Separate function to load inbox candidates
  const loadInboxCandidates = useCallback(async () => {
    setLoadingInbox(true);
    try {
      // 1. Fetch unprocessed inbox entries with a limit
      const inboxEntries = await retryNetworkOperation(() => NewCandidateInbox.filter({ is_processed: false }, "-created_date", 100));

      // 2. Extract candidate IDs
      const candidateIds = inboxEntries.map(entry => entry.candidate_id).filter(Boolean);

      if (candidateIds.length > 0) {
        // 3. Fetch candidate details for these IDs
        // FIX: Instead of fetching all candidates, try to filter by IDs if possible.
        // As a fallback, we fetch a larger number of recent candidates to find the inbox ones.
        const allRecentCandidates = await retryNetworkOperation(() => Candidate.list("-created_date", 1000));
        const inboxCandidateData = allRecentCandidates.filter(c => candidateIds.includes(c.id));

        // 4. Combine inbox data (like created_date) with candidate data
        const combinedCandidates = inboxCandidateData.map(candidate => {
          const inboxEntry = inboxEntries.find(entry => entry.candidate_id === candidate.id);
          return {
            ...candidate,
            inbox_created_date: inboxEntry?.created_date || candidate.created_date,
            inbox_id: inboxEntry?.id, // Store inbox ID for actions
          };
        }).sort((a, b) => new Date(b.inbox_created_date) - new Date(a.inbox_created_date));

        setInboxCandidates(combinedCandidates);
      } else {
        setInboxCandidates([]);
      }
    } catch (error) {
      console.error("Error loading inbox candidates:", error);
      setInboxCandidates([]);
      // Don't show error - just silently fail and show empty inbox
    } finally {
      setLoadingInbox(false); // Always reset loading — prevent inbox from being stuck on spinner
    }
  }, [retryNetworkOperation]);

  const loadClients = useCallback(async () => {
    try {
        const clientList = await retryNetworkOperation(async () => {
          // FIX: Limit to 200 clients
          return await Client.list(null, 200);
        });
        setClients(clientList);
    } catch (error) {
        console.error('Error loading clients:', error);
    }
  }, [retryNetworkOperation]);

  const loadJobs = useCallback(async () => {
    try {
        const jobsList = await retryNetworkOperation(async () => {
          return await Job.list("-created_date", 500);
        });
        setJobs(jobsList);
    } catch (error) {
        console.error('Error loading jobs:', error);
    }
  }, [retryNetworkOperation]);

  const loadCurrentUserData = useCallback(async () => {
    try {
        const userData = await User.me();
        setCurrentUserData(userData);
    } catch (error) {
        console.error('Error loading current user:', error);
    }
  }, []);

  // Load match counts for the currently displayed candidates via backend function.
  // Uses asServiceRole on the server so it bypasses base44's client-side pagination cap.
  // Called automatically whenever the candidates list changes (see useEffect below).
  const loadMatchCounts = useCallback(async (candidatesList) => {
    if (!candidatesList || candidatesList.length === 0) return;
    try {
      const candidateIds = candidatesList.map(c => c.id);
      const response = await getMatchCountsForCandidates({ candidate_ids: candidateIds });
      const data = response?.data ?? response;
      if (data?.counts) {
        setMatchCountMap(data.counts);
      }
    } catch (err) {
      console.log('Match count background load failed (non-critical):', err.message);
    }
  }, []);

  useEffect(() => {
    const loadAllData = async () => {
        setLoading(true);
        setLoadingInbox(true);
        await Promise.all([
            loadCandidates(),
            loadInboxCandidates(),
            loadClients(),
            loadJobs(),
            loadCurrentUserData()
        ]);
        setLoading(false);
        setLoadingInbox(false);
    };
    loadAllData();
  }, [loadCandidates, loadInboxCandidates, loadClients, loadJobs, loadCurrentUserData]);

  // When candidates list updates (initial load or after CRUD), load their match counts.
  // This runs in the background — doesn't block the page render.
  useEffect(() => {
    if (candidates.length > 0) {
      loadMatchCounts(candidates);
    }
  }, [candidates, loadMatchCounts]);

  // NEW: Function to actually create the candidate (extracted from handleSubmit)
  const createNewCandidate = async (formData) => {
    await retryNetworkOperation(async () => {
      return await Candidate.create(formData);
    });
    loadCandidates();
    loadInboxCandidates();
    setShowForm(false);
    setEditingCandidate(null);
    setDetectionError("");
  };

  const handleSubmit = async (formData) => {
    try {
      if (editingCandidate) {
        // For editing, proceed directly without duplicate check
        await retryNetworkOperation(async () => {
          return await Candidate.update(editingCandidate.id, formData);
        });
        loadCandidates();
        loadInboxCandidates();
        setShowForm(false);
        setEditingCandidate(null);
        setDetectionError("");
      } else {
        // For new candidates, check for duplicates first
        console.log("Checking for duplicates before creating new candidate...");
        
        const duplicateCheck = await retryNetworkOperation(() => checkDuplicateCandidates({
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email || null, // Pass null if empty string
          phone_primary: formData.phone_primary || null // Pass null if empty string
        }));

        if (duplicateCheck.data?.hasDuplicates && duplicateCheck.data.duplicates.length > 0) {
          // Show duplicate dialog
          setDuplicateDialog({
            isOpen: true,
            candidateData: formData,
            duplicates: duplicateCheck.data.duplicates,
            pendingSubmit: formData
          });
          return; // Don't proceed with creation yet
        }

        // No duplicates found, proceed with creation
        await createNewCandidate(formData);
      }
    } catch (error) {
      console.error("Error saving candidate:", error);
      setDetectionError("שגיאה בשמירת המועמד. נסה שוב.");
    }
  };

  // NEW: Handle duplicate dialog actions
  const handleDuplicateDialogProceed = async () => {
    if (duplicateDialog.pendingSubmit) {
      // Close the form dialog first, then create the candidate
      setShowForm(false);
      await createNewCandidate(duplicateDialog.pendingSubmit);
    }
    setDuplicateDialog({
      isOpen: false,
      candidateData: null,
      duplicates: [],
      pendingSubmit: null
    });
  };

  const handleDuplicateDialogCancel = () => {
    setDuplicateDialog({
      isOpen: false,
      candidateData: null,
      duplicates: [],
      pendingSubmit: null
    });
    // Keep the form open so user can modify the data or cancel
  };

  const handleDelete = async (candidateId) => {
    setConfirmDialog({
      isOpen: true,
      message: "האם אתה בטוח שברצונך למחוק את המועמד? פעולה זו תמחק גם את כל ההתאמות שלו אצל כל הסוכנים ואינה ניתנת לביטול.",
      onConfirm: async () => {
        try {
          const { base44 } = await import('@/api/base44Client');
          const response = await base44.functions.invoke('deleteCandidateWithMatches', {
            candidate_id: candidateId
          });
          
          if (response.data.success) {
            loadCandidates();
            loadInboxCandidates();
            setDetectionError("");
          }
        } catch (error) {
          console.error("Error deleting candidate:", error);
          setDetectionError("שגיאה במחיקת המועמד. נסה שוב.");
        } finally {
          setConfirmDialog({ isOpen: false, message: "", onConfirm: null });
        }
      }
    });
  };

  const handleOpenSendCvDialog = (candidate) => {
    setSendCvDialogState({ isOpen: true, candidate });
  };

  const handleOpenInterviewDialog = (candidate) => {
    setInterviewDialogState({ isOpen: true, candidate });
  };

  const handleOpenClientCvDialog = (candidate) => {
    setClientCvDialogState({ isOpen: true, candidate });
  };

  const openOfferSystem = () => {
    window.open('https://panda-offer-35379ea3.base44.app', '_blank');
  };

  const handleShowCandidateJobs = async (candidate) => {
    // Show dialog immediately with loading state
    setCandidateJobsDialog({ 
      isOpen: true, 
      candidate, 
      matches: null, // null indicates loading
      loading: true
    });

    try {
      // Fetch matches for this candidate (simple filter — no complex operators)
      const allMatches = await base44.entities.Match.filter({
        candidate_id: candidate.id
      }, '-match_score', 100);

      // Fetch jobs map (reuse already-loaded jobs if available)
      const jobsMap = new Map(jobs.map(j => [j.id, j]));

      // Deduplicate by job_id - keep highest match_score per job
      const dedupeMap = new Map();
      for (const m of allMatches.map(m => ({ ...m, job_code: jobsMap.get(m.job_id)?.job_code, job_title: m.job_title || jobsMap.get(m.job_id)?.title, client_name: jobsMap.get(m.job_id)?.client_name })).filter(m => m.job_code || m.job_title)) {
        if (!dedupeMap.has(m.job_id) || (m.match_score || 0) > (dedupeMap.get(m.job_id)?.match_score || 0)) dedupeMap.set(m.job_id, m);
      }
      const matchesWithJobDetails = Array.from(dedupeMap.values()).sort((a, b) => (b.match_score || 0) - (a.match_score || 0));

      // Update match count cache so the briefcase icon shows correctly
      setMatchCountMap(prev => ({
        ...prev,
        [candidate.id]: matchesWithJobDetails.length
      }));

      setCandidateJobsDialog(prev => ({
        ...prev,
        matches: matchesWithJobDetails,
        loading: false
      }));
    } catch (error) {
      console.error('Error loading candidate jobs:', error);
      setCandidateJobsDialog(prev => ({
        ...prev,
        matches: [],
        loading: false,
        error: 'שגיאה בטעינת משרות'
      }));
    }
  };

  // NEW: Mark candidate as read
  const handleCandidateRead = async (candidateId) => {
        try {
          await retryNetworkOperation(async () => {
            return await Candidate.update(candidateId, { is_read: true });
          });
          // Refresh candidates list to update inbox
          loadCandidates();
          loadInboxCandidates(); // Also refresh the inbox specific view
        } catch (error) {
          console.error("Error marking candidate as read:", error);
          setDetectionError("שגיאה בסימון מועמד כנקרא. נסה שוב.");
        }
      };

      // Bulk actions for inbox
      const handleSelectAll = (checked) => {
        if (checked) {
          setSelectedInboxIds(filteredInboxCandidates.map(c => c.id));
        } else {
          setSelectedInboxIds([]);
        }
      };

      const handleSelectOne = (candidateId, checked) => {
        if (checked) {
          setSelectedInboxIds(prev => [...prev, candidateId]);
        } else {
          setSelectedInboxIds(prev => prev.filter(id => id !== candidateId));
        }
      };

      const handleBulkReadStatus = async (markAsRead) => {
        if (selectedInboxIds.length === 0) return;
        setBulkUpdating(true);
        try {
          await Promise.all(selectedInboxIds.map(id => 
            retryNetworkOperation(() => Candidate.update(id, { is_read: markAsRead }))
          ));
          setSelectedInboxIds([]);
          loadCandidates();
          loadInboxCandidates();
        } catch (error) {
          console.error("Error bulk updating read status:", error);
          setDetectionError("שגיאה בעדכון מצב קריאה. נסה שוב.");
        }
        setBulkUpdating(false);
      };

      const handleBulkStatusChange = async (newStatus) => {
            if (selectedInboxIds.length === 0) return;
            setBulkUpdating(true);
            try {
              await Promise.all(selectedInboxIds.map(id => 
                retryNetworkOperation(() => Candidate.update(id, { 
                  status: newStatus.status_name, 
                  status_number: newStatus.status_number 
                }))
              ));
              setSelectedInboxIds([]);
              loadCandidates();
              loadInboxCandidates();
            } catch (error) {
              console.error("Error bulk updating status:", error);
              setDetectionError("שגיאה בעדכון סטטוס. נסה שוב.");
            }
            setBulkUpdating(false);
          };

          // Bulk actions for candidates database
          const handleSelectAllCandidates = (checked) => {
            if (checked) {
              setSelectedCandidateIds(filteredCandidates.map(c => c.id));
            } else {
              setSelectedCandidateIds([]);
            }
          };

          const handleSelectOneCandidate = (candidateId, checked) => {
            if (checked) {
              setSelectedCandidateIds(prev => [...prev, candidateId]);
            } else {
              setSelectedCandidateIds(prev => prev.filter(id => id !== candidateId));
            }
          };

          const handleBulkCandidateStatusChange = async (newStatus) => {
            if (selectedCandidateIds.length === 0) return;
            setBulkUpdating(true);
            try {
              await Promise.all(selectedCandidateIds.map(id => 
                retryNetworkOperation(() => Candidate.update(id, { 
                  status: newStatus.status_name, 
                  status_number: newStatus.status_number 
                }))
              ));
              setSelectedCandidateIds([]);
              loadCandidates();
            } catch (error) {
              console.error("Error bulk updating candidate status:", error);
              setDetectionError("שגיאה בעדכון סטטוס. נסה שוב.");
            }
            setBulkUpdating(false);
          };

  // NEW: Handlers for inbox actions (now operating on Candidate objects)
  const handleSendToClients = (inboxCandidate) => {
    const currentUser = user; // Use the user object from state/context
    const defaultTemplate = currentUser?.new_candidate_message_template || 
        "שלום {client_name},\n\nרצינו לעדכן אותך שנקלט למערכת שלנו מועמד חדש שעשוי להתאים לדרישות שלך.\n\nפרטי המועמד:\n- שם: {candidate_name}\n- אימייל: {candidate_email}\n- טלפון: {candidate_phone}\n- סיווג בטחוני: {security_clearance}\n- תחומי התמחות: {skills_summary}\n\nקורות החיים המלאים מצורפים להודעה זו.\n\nנשמח לקבל החלטה או להתייעץ איתך בנוגע למועמד זה.\n\nבברכה,\nצוות פנדה-טק";
    
    setSendDialog({
        isOpen: true,
        candidate: inboxCandidate, // inboxCandidate is now a Candidate object
        selectedClients: [],
        messageTemplate: defaultTemplate
    });
  };

  // Handler for WhatsApp to CANDIDATE (not client)
  const handleSendWhatsappToCandidate = (candidate) => {
    if (!candidate.phone_primary) {
      alert('למועמד זה אין מספר טלפון');
      return;
    }
    
    const defaultTemplate = user?.whatsapp_candidate_message_template || 
        `שלום {candidate_name} 👋

אני פונה אליך מטעם *פנדה-טק*.

קיבלנו את קורות החיים שלך ונשמח לשוחח איתך על הזדמנויות תעסוקה שעשויות להתאים לך.

האם יהיה לך נוח לקבוע שיחה קצרה?

בברכה,
צוות פנדה-טק 🐼`;
    
    setWhatsappSendDialog({
        isOpen: true,
        candidate: candidate,
        messageTemplate: defaultTemplate
    });
  };

  const executeSendToClients = async () => {
    if (!sendDialog.candidate || sendDialog.selectedClients.length === 0) {
        alert('אנא בחר לפחות לקוח אחד לשליחה.');
        return;
    }

    setSendingEmail(true);
    try {
        const response = await retryNetworkOperation(async () => {
          return await sendCandidateToClients({
              candidateId: sendDialog.candidate.id, // Changed from candidate_id to id
              clientIds: sendDialog.selectedClients,
              messageTemplate: sendDialog.messageTemplate
          });
        });

        if (response.data.success) {
            alert(`המייל נשלח בהצלחה ל-${response.data.successCount} מתוך ${response.data.totalClients} לקוחות.`);
            
            // Mark the item in NewCandidateInbox as processed
            if(sendDialog.candidate.inbox_id) {
              await retryNetworkOperation(async () => {
                return await NewCandidateInbox.update(sendDialog.candidate.inbox_id, {
                    is_processed: true,
                    processed_date: new Date().toISOString()
                });
              });
            }
            
            // Refresh inbox specific view
            await loadInboxCandidates();
            
            setSendDialog({ isOpen: false, candidate: null, selectedClients: [], messageTemplate: '' });
        } else {
            throw new Error(response.data.error || 'שליחת המייל נכשלה');
        }
    } catch (error) {
        console.error('Error sending emails:', error);
        alert('שגיאה בשליחת המייל: ' + (error.response?.data?.error || error.message));
    } finally {
        setSendingEmail(false);
    }
  };

  // Execute WhatsApp sending to CANDIDATE
  const executeSendWhatsappToCandidate = async () => {
    if (!whatsappSendDialog.candidate || !whatsappSendDialog.candidate.phone_primary) {
        alert('למועמד זה אין מספר טלפון.');
        return;
    }

    setSendingWhatsapp(true);
    try {
        // Replace template variables
        const message = whatsappSendDialog.messageTemplate
            .replace(/{candidate_name}/g, `${whatsappSendDialog.candidate.first_name} ${whatsappSendDialog.candidate.last_name}`)
            .replace(/{candidate_email}/g, whatsappSendDialog.candidate.email || 'לא צוין')
            .replace(/{candidate_phone}/g, whatsappSendDialog.candidate.phone_primary || 'לא צוין');

        // Format phone number for WhatsApp
        let phone = whatsappSendDialog.candidate.phone_primary.replace(/[-\s]/g, '');
        if (phone.startsWith('0')) {
            phone = '972' + phone.substring(1);
        }
        if (!phone.startsWith('972')) {
            phone = '972' + phone;
        }

        // Log to WhatsappOutbox before opening WhatsApp
        try {
            const { WhatsappOutbox } = await import('@/entities/WhatsappOutbox');
            const currentUser = await User.me();
            await WhatsappOutbox.create({
                candidate_id: whatsappSendDialog.candidate.id,
                candidate_name: `${whatsappSendDialog.candidate.first_name} ${whatsappSendDialog.candidate.last_name}`,
                recipient_phone: phone,
                recipient_name: `${whatsappSendDialog.candidate.first_name} ${whatsappSendDialog.candidate.last_name}`,
                message_content: message,
                sent_by_user_id: currentUser.id,
                sent_by_user_name: currentUser.full_name,
                status: 'sent',
                is_test_mode: false
            });
        } catch (logError) {
            console.error('Failed to log WhatsApp message:', logError);
            // Don't fail if logging fails
        }

        // Open WhatsApp with pre-filled message
        const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');

        setWhatsappSendDialog({ isOpen: false, candidate: null, messageTemplate: '' });
    } catch (error) {
        console.error('Error opening WhatsApp:', error);
        alert('שגיאה בפתיחת WhatsApp: ' + error.message);
    } finally {
        setSendingWhatsapp(false);
    }
  };

  const openResumeFile = (fileUrl) => {
    if (fileUrl) {
        window.open(fileUrl, '_blank');
    } else {
        alert('קובץ קורות החיים לא זמין.');
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // New state for search results
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Perform search when filters or search term change
  useEffect(() => {
    const doSearch = async () => {
      if (!searchTerm && securityFilter === "all" && databaseStatusFilter === "all") {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        const results = await performBackendSearch(searchTerm, securityFilter, databaseStatusFilter);
        setSearchResults(Array.isArray(results) ? results : []);
      } catch (error) {
        console.error("Search error:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    // Show searching indicator immediately, debounce the actual request
    if (searchTerm || securityFilter !== "all" || databaseStatusFilter !== "all") {
      setIsSearching(true);
    }
    const debounce = setTimeout(doSearch, 300);
    return () => clearTimeout(debounce);
  }, [searchTerm, securityFilter, databaseStatusFilter, performBackendSearch]);

  const dataToFilter = searchTerm || securityFilter !== "all" || databaseStatusFilter !== "all" ? searchResults : candidates;
  const filteredCandidates = (Array.isArray(dataToFilter) ? dataToFilter : []).sort((a, b) => {
      if (sortBy === 'security_clearance') {
        const clearanceOrder = {
          'רמה 1': 1, 'רמה 2': 2, 'רמה 3': 3, 'סודי ביותר': 4, 'סודי': 5,
          'שמור': 6, 'סווג נמוך': 7, 'ללא סווג': 8, 'לא רלוונטי': 9, 'לא ידוע/ת': 10
        };
        return (clearanceOrder[a.security_clearance] || 99) - (clearanceOrder[b.security_clearance] || 99);
      } else if (sortBy === 'status') {
        return (a.status || 'לא צוין').localeCompare(b.status || 'לא צוין', 'he');
      } else if (sortField === 'name') {
        const comparison = `${a.first_name} ${a.last_name}`.trim().localeCompare(`${b.first_name} ${b.last_name}`.trim(), 'he');
        return sortDirection === 'asc' ? comparison : -comparison;
      } else if (sortField === 'date') {
        const dateA = a.source_email_date ? new Date(a.source_email_date).getTime() : 0;
        const dateB = b.source_email_date ? new Date(b.source_email_date).getTime() : 0;
        const comparison = dateA - dateB;
        return sortDirection === 'asc' ? comparison : -comparison;
      } else {
        return new Date(b.created_date) - new Date(a.created_date);
      }
    });

  const filteredInboxCandidates = inboxCandidates.filter(c => {
    if (!inboxSearchTerm) {
      // No search term - only apply security filter
      const matchesSecurity = inboxSecurityFilter === "all" || c.security_clearance === inboxSecurityFilter;
      return matchesSecurity;
    }

    // Flexible search - normalize and search across all fields
    const normalizedSearch = inboxSearchTerm.toLowerCase().trim();
    const searchWords = normalizedSearch.split(/\s+/);
    
    const candidateText = [
      c.first_name,
      c.last_name,
      c.first_name_english,
      c.last_name_english,
      c.email,
      c.phone_primary,
      c.phone_secondary,
      c.city,
      c.skills_summary,
      c.security_clearance,
      c.id_number
    ].filter(Boolean).join(' ').toLowerCase();

    const matchesSearch = searchWords.every(word => candidateText.includes(word));
    const matchesSecurity = inboxSecurityFilter === "all" || c.security_clearance === inboxSecurityFilter;
    
    return matchesSearch && matchesSecurity;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case "מועמד":
        return "bg-blue-100 text-blue-800";
      case "עובד חברה":
        return "bg-green-100 text-green-800";
      case "לא מעוניין":
        return "bg-red-100 text-red-800";
      case "לא רלוונטי יותר":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Initial loading check
  if (loading) { 
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // User authentication and permissions check
  if (!user) {
    return <Navigate to={createPageUrl("Home")} />; // Redirect if no user
  }

  if (!user.can_view_candidates) {
    return (
        <div className="text-center py-8">
            <h2 className="text-xl font-semibold mb-2">גישה מוגבלת</h2>
            <p className="text-gray-600">אין לך הרשאה לצפות במועמדים.</p>
        </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div className="flex items-center gap-4">
          <img 
            src="https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop&crop=face" 
            alt="יעל" 
            className="w-16 h-16 rounded-full object-cover border-4 border-green-200 shadow-lg"
          />
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">יעל - ציידת המועמדים</h1>
              <Badge variant="secondary" className="text-sm sm:text-base">{candidates.length} מועמדים</Badge>
            </div>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">ציידת המועמדים, אחראית להביא מועמדים לחברה</p>
          </div>
        </div>
      </div>
      


      {detectionError && (
        <Alert variant="destructive">
          <AlertDescription className="text-red-700 whitespace-pre-line">{detectionError}</AlertDescription>
        </Alert>
      )}

      {/* Add refresh button when there's an error on candidate list or inbox */}
      {detectionError && (detectionError.includes("טעינת") && (
        <div className="flex justify-center">
          <Button onClick={() => { loadCandidates(); loadInboxCandidates(); }} variant="outline">
            <RefreshCw className="w-4 h-4 ml-2" />
            רענן נתונים
          </Button>
        </div>
      ))}

      {/* Mobile Navigation */}
      <MobileTabs value={activeTab} onValueChange={setActiveTab}>
        <MobileTabsButtons>
          <MobileTabButton value="inbox" icon={Mail} label="דואר נכנס" count={inboxCandidates.filter(c => !c.is_read).length} color="blue" />
          <MobileTabButton value="database" icon={Users} label="מאגר מועמדים" count={candidates.length} color="green" />
          <MobileTabButton value="search" icon={Search} label="חיפוש" color="purple" />
          <MobileTabButton value="upload" icon={Upload} label="העלאה ידנית" color="orange" />
        </MobileTabsButtons>

        {/* Upload Tab Content */}
        <MobileTabsContent tabValue="upload">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-orange-600" />
                העלאת קורות חיים ידנית
              </CardTitle>
            </CardHeader>
            <CardContent>
              <BackgroundFileUpload onUploadComplete={() => setActiveTab("inbox")} />
            </CardContent>
          </Card>
        </MobileTabsContent>

        {/* Search Tab Content */}
        <MobileTabsContent tabValue="search">
          <CandidateSearch 
            jobs={jobs} 
            candidates={candidates} 
            currentUser={currentUserData}
          />
        </MobileTabsContent>

        {/* Database Tab Content */}
        <MobileTabsContent tabValue="database">
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="חיפוש מועמדים לפי שם, אימייל, כישורים או סיווג בטחוני..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
            
            <div className="flex flex-wrap gap-3">
              <Select value={securityFilter} onValueChange={setSecurityFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="סינון לפי סיווג" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל הסיווגים</SelectItem>
                  <SelectItem value="רמה 1">רמה 1</SelectItem>
                  <SelectItem value="רמה 2">רמה 2</SelectItem>
                  <SelectItem value="רמה 3">רמה 3</SelectItem>
                  <SelectItem value="סודי ביותר">סודי ביותר</SelectItem>
                  <SelectItem value="סודי">סודי</SelectItem>
                  <SelectItem value="שמור">שמור</SelectItem>
                  <SelectItem value="סווג נמוך">סווג נמוך</SelectItem>
                  <SelectItem value="ללא סווג">ללא סווג</SelectItem>
                  <SelectItem value="לא רלוונטי">לא רלוונטי</SelectItem>
                  <SelectItem value="לא ידוע/ת">לא ידוע/ת</SelectItem>
                </SelectContent>
              </Select>

              <Select value={databaseStatusFilter} onValueChange={setDatabaseStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="סינון לפי סטטוס" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל הסטטוסים</SelectItem>
                  <SelectItem value="מועמד">מועמד</SelectItem>
                  <SelectItem value="עובד חברה">עובד חברה</SelectItem>
                  <SelectItem value="לא מעוניין">לא מעוניין</SelectItem>
                  <SelectItem value="לא רלוונטי יותר">לא רלוונטי יותר</SelectItem>
                  <SelectItem value="לא מתאים - נסגר">לא מתאים - נסגר</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="מיון לפי" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_date">תאריך הוספה (חדש לישן)</SelectItem>
                  <SelectItem value="security_clearance">סיווג בטחוני</SelectItem>
                  <SelectItem value="status">סטטוס</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card>
            <CardHeader>
                                <div className="flex justify-between items-center">
                                  <CardTitle className="flex items-center gap-2">
                                    מאגר המועמדים
                                    {isSearching ? (
                                      <span className="flex items-center gap-1 text-sm font-normal text-blue-600">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        מחפש...
                                      </span>
                                    ) : (
                                      <span className="text-sm font-normal text-gray-500">
                                        ({filteredCandidates.length} מועמדים)
                                      </span>
                                    )}
                                  </CardTitle>
                                  <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                                    <Button
                                      variant={viewMode === 'cards' ? 'default' : 'ghost'}
                                      size="sm"
                                      onClick={() => setViewMode('cards')}
                                      className={viewMode === 'cards' ? 'bg-white shadow-sm' : ''}
                                    >
                                      <LayoutGrid className="w-4 h-4 ml-1" />
                                      כרטיסיות
                                    </Button>
                                    <Button
                                      variant={viewMode === 'table' ? 'default' : 'ghost'}
                                      size="sm"
                                      onClick={() => setViewMode('table')}
                                      className={viewMode === 'table' ? 'bg-white shadow-sm' : ''}
                                    >
                                      <TableIcon className="w-4 h-4 ml-1" />
                                      טבלה
                                    </Button>
                                  </div>
                                </div>
                                {/* Bulk Actions for Candidates */}
                                {selectedCandidateIds.length > 0 && (
                                  <div className="flex flex-wrap items-center gap-2 mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                    <span className="text-sm font-medium text-blue-800">
                                      נבחרו {selectedCandidateIds.length} מועמדים:
                                    </span>
                                    {selectedCandidateIds.length === 2 && (
                                      <Button 
                                        size="sm" 
                                        onClick={() => {
                                          const selectedCands = filteredCandidates.filter(c => selectedCandidateIds.includes(c.id));
                                          setMergeDialog({ isOpen: true, candidates: selectedCands });
                                        }}
                                        className="bg-purple-600 hover:bg-purple-700"
                                      >
                                        <GitMerge className="w-4 h-4 ml-1" />
                                        מיזוג
                                      </Button>
                                    )}
                                    <BulkStatusSelector 
                                      onStatusChange={handleBulkCandidateStatusChange} 
                                      disabled={bulkUpdating}
                                    />
                                    <Button 
                                      size="sm" 
                                      variant="ghost" 
                                      onClick={() => setSelectedCandidateIds([])}
                                      className="text-gray-500"
                                    >
                                      בטל בחירה
                                    </Button>
                                  </div>
                                )}
                              </CardHeader>
            <CardContent>
              {isSearching ? (
                /* Loading overlay while search/filter is running */
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  <p className="text-gray-500 text-sm">טוען תוצאות...</p>
                </div>
              ) : viewMode === 'table' ? (
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                                                <TableRow>
                                                  <TableHead className="w-10">
                                                    <Checkbox
                                                      checked={selectedCandidateIds.length === filteredCandidates.length && filteredCandidates.length > 0}
                                                      onCheckedChange={handleSelectAllCandidates}
                                                    />
                                                  </TableHead>
                                                  <TableHead>תמונה</TableHead>
                                                  <TableHead>
                                                    <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      onClick={() => handleSort('date')}
                                                      className="h-8 px-2 flex items-center gap-1"
                                                    >
                                                      תאריך קליטה
                                                      {sortField === 'date' ? (
                                                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                                      ) : (
                                                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                                                      )}
                                                    </Button>
                                                  </TableHead>
                                                  <TableHead>
                                                    <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      onClick={() => handleSort('name')}
                                                      className="h-8 px-2 flex items-center gap-1"
                                                    >
                                                      שם מועמד
                                                      {sortField === 'name' ? (
                                                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                                      ) : (
                                                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                                                      )}
                                                    </Button>
                                                  </TableHead>
                                                  <TableHead>טלפון</TableHead>
                                                  <TableHead>חבר מביא חבר</TableHead>
                                                  <TableHead>סיווג</TableHead>
                                                  <TableHead>סטטוס</TableHead>
                                                  <TableHead>פעולות</TableHead>
                                                </TableRow>
                                              </TableHeader>
                                              <TableBody>
                                                {filteredCandidates.map((candidate) => (
                                                  <TableRow key={candidate.id} className={`hover:bg-gray-50 ${selectedCandidateIds.includes(candidate.id) ? 'bg-blue-100' : ''}`}>
                                                    <TableCell className="w-10">
                                                      <Checkbox
                                                        checked={selectedCandidateIds.includes(candidate.id)}
                                                        onCheckedChange={(checked) => handleSelectOneCandidate(candidate.id, checked)}
                                                      />
                                                    </TableCell>
                                                    <TableCell className="w-16">
                                                      <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-gray-200 flex-shrink-0">
                                                        {candidate.profile_image_url ? (
                                                          <img src={candidate.profile_image_url} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                                                            <Users className="w-5 h-5 text-gray-400" />
                                                          </div>
                                                        )}
                                                      </div>
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                      {candidate.cv_received_date ? (
                                                        <>
                                                          {new Date(candidate.cv_received_date).toLocaleDateString('he-IL')}
                                                          <br />
                                                          <span className="text-gray-500 text-xs">
                                                            {new Date(candidate.cv_received_date).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                                          </span>
                                                        </>
                                                      ) : candidate.source_email_date ? (
                                                        <>
                                                          {new Date(candidate.source_email_date).toLocaleDateString('he-IL')}
                                                          <br />
                                                          <span className="text-gray-500 text-xs">
                                                            {new Date(candidate.source_email_date).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                                          </span>
                                                        </>
                                                      ) : '-'}
                                                    </TableCell>
                                                    <TableCell>
                                                      <div className="font-medium">
                                                        {candidate.first_name} {candidate.last_name}
                                                      </div>
                                                      {candidate.email && (
                                                        <div className="text-xs text-gray-500">{candidate.email}</div>
                                                      )}
                                                      {candidate.security_clearance === 'רמה 1' && (
                                                        <Badge className="bg-red-100 text-red-800 text-xs mt-1">
                                                          רמה 1 - בעדיפות גבוהה
                                                        </Badge>
                                                      )}
                                                    </TableCell>
                                                    <TableCell>{candidate.phone_primary || 'לא צוין'}</TableCell>
                                                    <TableCell>
                                                      {candidate.referred_by_employee_name ? (
                                                        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
                                                          {candidate.referred_by_employee_name}
                                                        </Badge>
                                                      ) : '-'}
                                                    </TableCell>
                                                    <TableCell>
                                                      <Select 
                                                        value={candidate.security_clearance || 'לא רלוונטי'} 
                                                        onValueChange={async (value) => {
                                                          setCandidates(prev => prev.map(c => c.id === candidate.id ? {...c, security_clearance: value} : c));
                                                          Candidate.update(candidate.id, { security_clearance: value }).catch(console.error);
                                                        }}
                                                      >
                                                        <SelectTrigger className="w-32 h-8 text-xs">
                                                          <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                          <SelectItem value="רמה 1">רמה 1</SelectItem>
                                                          <SelectItem value="רמה 2">רמה 2</SelectItem>
                                                          <SelectItem value="רמה 3">רמה 3</SelectItem>
                                                          <SelectItem value="סווג נמוך">סווג נמוך</SelectItem>
                                                          <SelectItem value="ללא סווג">ללא סווג</SelectItem>
                                                          <SelectItem value="לא רלוונטי">לא רלוונטי</SelectItem>
                                                        </SelectContent>
                                                      </Select>
                                                    </TableCell>
                                                    <TableCell>
                                                      <CandidateStatusSelector 
                                                        candidate={candidate} 
                                                        onStatusChange={(updatedCandidate) => {
                                                          setCandidates(prev => prev.map(c => 
                                                            c.id === updatedCandidate.id ? {...c, ...updatedCandidate} : c
                                                          ));
                                                        }}
                                                      />
                                                    </TableCell>
                                                    <TableCell>
                                                      <CandidateActionsDropdown
                                                        candidate={candidate}
                                                        matchCount={matchCountMap[candidate.id] || 0}
                                                        user={user}
                                                        onShowJobs={handleShowCandidateJobs}
                                                        onOpenResume={(url) => window.open(url, '_blank')}
                                                        onOpenInterview={handleOpenInterviewDialog}
                                                        onOpenClientCv={handleOpenClientCvDialog}
                                                        onOpenSendCv={handleOpenSendCvDialog}
                                                        onOpenOfferSystem={openOfferSystem}
                                                        onEdit={(c) => { setEditingCandidate(c); setShowForm(true); }}
                                                        onCommunicationHistory={(c) => setCommunicationHistoryDialog({ isOpen: true, candidate: c })}
                                                        onDelete={handleDelete}
                                                      />
                                                    </TableCell>
                                                  </TableRow>
                                                ))}
                                                {filteredCandidates.length === 0 && !isSearching && (
                                                    <TableRow>
                                                      <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                                                        {(searchTerm || securityFilter !== "all" || databaseStatusFilter !== "all")
                                                          ? "לא נמצאו מועמדים התואמים את הסינון הנוכחי"
                                                          : "אין מועמדים במאגר עדיין"}
                                                      </TableCell>
                                                    </TableRow>
                                                  )}
                    </TableBody>
                  </Table>
                </div>
              ) : (
              <div className="grid gap-4">
                <AnimatePresence>
                  {filteredCandidates.map((candidate) => (
                    <motion.div
                      key={candidate.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                    >
                      <Card className="hover:shadow-lg transition-shadow">
                        <CardHeader>
                          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                            <div className="flex items-start gap-4">
                              {/* Profile Image */}
                              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-gray-200 flex-shrink-0">
                                {candidate.profile_image_url ? (
                                  <img
                                    src={candidate.profile_image_url}
                                    alt={`${candidate.first_name} ${candidate.last_name}`}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-16 bg-gray-100 flex items-center justify-center">
                                    <Users className="w-8 h-8 text-gray-400" />
                                  </div>
                                )}
                              </div>
                              
                              {/* Candidate Info */}
                              <div>
                                <CardTitle className="text-xl">{candidate.first_name} {candidate.last_name}</CardTitle>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-sm text-gray-600">
                                  {candidate.email && (
                                    <div className="flex items-center gap-1">
                                      <Mail className="w-4 h-4" />
                                      <a href={`mailto:${candidate.email}`} className="text-blue-600 hover:underline">
                                        {candidate.email}
                                      </a>
                                    </div>
                                  )}
                                  {candidate.phone_primary && (
                                    <div className="flex items-center gap-1">
                                      <Phone className="w-4 h-4" />
                                      <a href={`tel:${candidate.phone_primary}`} className="text-blue-600 hover:underline">
                                        {candidate.phone_primary}
                                      </a>
                                    </div>
                                  )}
                                  {candidate.address && (
                                    <div className="flex items-center gap-1">
                                      <MapPin className="w-4 h-4" />
                                      <span>{candidate.address}</span>
                                    </div>
                                  )}
                                  {(candidate.cv_received_date || candidate.source_email_date) && (
                                    <div className="flex items-center gap-1">
                                      <Clock className="w-4 h-4" />
                                      <span>הגיע: {new Date(candidate.cv_received_date || candidate.source_email_date).toLocaleDateString('he-IL')}</span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-2 mt-3">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500">סווג:</span>
                                    <Select 
                                      value={candidate.security_clearance || 'לא רלוונטי'} 
                                      onValueChange={async (value) => {
                                        // Optimistic update - update UI immediately
                                        setCandidates(prev => prev.map(c => c.id === candidate.id ? {...c, security_clearance: value} : c));
                                        // Then update server in background
                                        Candidate.update(candidate.id, { security_clearance: value }).catch(console.error);
                                      }}
                                    >
                                      <SelectTrigger className="w-32 h-7 text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="רמה 1">רמה 1</SelectItem>
                                        <SelectItem value="רמה 2">רמה 2</SelectItem>
                                        <SelectItem value="רמה 3">רמה 3</SelectItem>
                                        <SelectItem value="סווג נמוך">סווג נמוך</SelectItem>
                                        <SelectItem value="ללא סווג">ללא סווג</SelectItem>
                                        <SelectItem value="לא רלוונטי">לא רלוונטי</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <CandidateStatusSelector 
                                    candidate={candidate} 
                                    onStatusChange={(updatedCandidate) => {
                                      // Optimistic update - update local state immediately
                                      setCandidates(prev => prev.map(c => 
                                        c.id === updatedCandidate.id ? {...c, ...updatedCandidate} : c
                                      ));
                                    }}
                                  />
                                </div>
                                <CandidateTagsBadges candidate={candidate} maxTags={6} />
                              </div>
                            </div>
                            <div className="flex items-center justify-end">
                               <CandidateActionsDropdown
                                 candidate={candidate}
                                 matchCount={matchCountMap[candidate.id] || 0}
                                 user={user}
                                 onShowJobs={handleShowCandidateJobs}
                                 onOpenResume={(url) => window.open(url, '_blank')}
                                 onOpenInterview={handleOpenInterviewDialog}
                                 onOpenClientCv={handleOpenClientCvDialog}
                                 onOpenSendCv={handleOpenSendCvDialog}
                                 onOpenOfferSystem={openOfferSystem}
                                 onEdit={(c) => { setEditingCandidate(c); setShowForm(true); }}
                                 onCommunicationHistory={(c) => setCommunicationHistoryDialog({ isOpen: true, candidate: c })}
                                 onDelete={handleDelete}
                               />
                             </div>
                          </div>
                        </CardHeader>
                        {(candidate.education || candidate.skills_summary) && (
                          <CardContent>
                            {candidate.education && (
                              <div className="mb-3">
                                <h4 className="font-semibold text-sm mb-1">השכלה:</h4>
                                <p className="text-sm text-gray-600">{candidate.education}</p>
                              </div>
                            )}
                            {candidate.skills_summary && (
                              <div>
                                <h4 className="font-semibold text-sm mb-1">כישורים וניסיון:</h4>
                                <p className="text-sm text-gray-600">{candidate.skills_summary}</p>
                              </div>
                            )}
                          </CardContent>
                        )}
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {filteredCandidates.length === 0 && !isSearching && (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">
                      {(searchTerm || securityFilter !== "all" || databaseStatusFilter !== "all")
                        ? "לא נמצאו מועמדים התואמים את הסינון הנוכחי"
                        : "אין מועמדים במאגר עדיין"}
                    </p>
                  </div>
                )}
              </div>
              )}
            </CardContent>
          </Card>
        </MobileTabsContent>

        {/* Inbox Tab Content */}
        <MobileTabsContent tabValue="inbox">
          <Card>
        <CardHeader>
                        <div className="flex justify-between items-center">
                          <CardTitle className="flex items-center gap-3">
                            <Mail className="w-6 h-6 text-blue-600" />
                            דואר נכנס - מועמדים חדשים
                            {inboxCandidates.filter(c => !c.is_read).length > 0 && (
                              <Badge className="bg-red-500 text-white">
                                {inboxCandidates.filter(c => !c.is_read).length}
                              </Badge>
                            )}
                          </CardTitle>
                          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                            <Button
                              variant={inboxViewMode === 'cards' ? 'default' : 'ghost'}
                              size="sm"
                              onClick={() => setInboxViewMode('cards')}
                              className={inboxViewMode === 'cards' ? 'bg-white shadow-sm' : ''}
                            >
                              <LayoutGrid className="w-4 h-4 ml-1" />
                              כרטיסיות
                            </Button>
                            <Button
                              variant={inboxViewMode === 'table' ? 'default' : 'ghost'}
                              size="sm"
                              onClick={() => setInboxViewMode('table')}
                              className={inboxViewMode === 'table' ? 'bg-white shadow-sm' : ''}
                            >
                              <TableIcon className="w-4 h-4 ml-1" />
                              טבלה
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600">
                          מועמדים חדשים שהועלו למערכת וממתינים לטיפול
                        </p>
                        {inboxCandidates.length > 3 && (
                          <div className="space-y-3 mt-3">
                            <div className="relative">
                              <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
                              <Input
                                placeholder="חיפוש בדואר נכנס לפי שם, אימייל, טלפון או סיווג..."
                                value={inboxSearchTerm}
                                onChange={(e) => setInboxSearchTerm(e.target.value)}
                                className="pr-10"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">סינון לפי סיווג:</label>
                              <Select value={inboxSecurityFilter} onValueChange={setInboxSecurityFilter}>
                                <SelectTrigger className="w-40 h-9">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">הכל</SelectItem>
                                  <SelectItem value="רמה 1">רמה 1</SelectItem>
                                  <SelectItem value="רמה 2">רמה 2</SelectItem>
                                  <SelectItem value="רמה 3">רמה 3</SelectItem>
                                  <SelectItem value="סווג נמוך">סווג נמוך</SelectItem>
                                  <SelectItem value="ללא סווג">ללא סווג</SelectItem>
                                  <SelectItem value="לא רלוונטי">לא רלוונטי</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )}
                        {/* Bulk Actions */}
                        {selectedInboxIds.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2 mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <span className="text-sm font-medium text-blue-800">
                              נבחרו {selectedInboxIds.length} מועמדים:
                            </span>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => handleBulkReadStatus(true)}
                              disabled={bulkUpdating}
                              className="text-green-600 border-green-300"
                            >
                              {bulkUpdating ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <CheckCircle2 className="w-4 h-4 ml-1" />}
                              סמן כנקרא
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => handleBulkReadStatus(false)}
                              disabled={bulkUpdating}
                              className="text-blue-600 border-blue-300"
                            >
                              {bulkUpdating ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Clock className="w-4 h-4 ml-1" />}
                              סמן כחדש
                            </Button>
                            <BulkStatusSelector 
                              onStatusChange={handleBulkStatusChange} 
                              disabled={bulkUpdating}
                            />
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => setSelectedInboxIds([])}
                              className="text-gray-500"
                            >
                              בטל בחירה
                            </Button>
                          </div>
                        )}
                      </CardHeader>
        <CardContent>
          {loadingInbox ? (
            <div className="text-center py-8 text-gray-500">
              <Loader2 className="w-8 h-8 mx-auto text-gray-400 animate-spin mb-4" />
              <p>טוען דואר נכנס...</p>
            </div>
          ) : inboxCandidates.length > 0 ? (
            <>
              {inboxSearchTerm && (
                <div className="text-sm text-gray-500 mb-2">
                  מציג {filteredInboxCandidates.length} מתוך {inboxCandidates.length} מועמדים
                </div>
              )}
              
              {inboxViewMode === 'table' ? (
              /* Table View */
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                                            <TableRow>
                                              <TableHead className="w-10">
                                                <Checkbox
                                                  checked={selectedInboxIds.length === filteredInboxCandidates.length && filteredInboxCandidates.length > 0}
                                                  onCheckedChange={handleSelectAll}
                                                />
                                              </TableHead>
                                              <TableHead>תמונה</TableHead>
                                              <TableHead>תאריך הגעת קו"ח</TableHead>
                                              <TableHead>שם מועמד</TableHead>
                                              <TableHead>טלפון</TableHead>
                                              <TableHead>חבר מביא חבר</TableHead>
                                              <TableHead>סיווג</TableHead>
                                              <TableHead>סטטוס</TableHead>
                                              <TableHead>מצב קריאה</TableHead>
                                              <TableHead>פעולות</TableHead>
                                            </TableRow>
                                          </TableHeader>
                  <TableBody>
                    {filteredInboxCandidates.map((candidate) => (
                      <TableRow 
                                                    key={candidate.id}
                                                    className={`
                                                      ${candidate.security_clearance === 'רמה 1' ? 'bg-red-50 border-red-200' : 'hover:bg-gray-50'}
                                                      ${!candidate.is_read ? 'font-semibold bg-blue-50' : 'opacity-75'}
                                                      ${selectedInboxIds.includes(candidate.id) ? 'bg-blue-100' : ''}
                                                    `}
                                                  >
                                                    <TableCell className="w-10">
                                                      <Checkbox
                                                        checked={selectedInboxIds.includes(candidate.id)}
                                                        onCheckedChange={(checked) => handleSelectOne(candidate.id, checked)}
                                                      />
                                                    </TableCell>
                                                    <TableCell className="w-16">
                          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-gray-200 flex-shrink-0">
                            {candidate.profile_image_url ? (
                              <img
                                src={candidate.profile_image_url}
                                alt={`${candidate.first_name} ${candidate.last_name}`}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                                <Users className="w-5 h-5 text-gray-400" />
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {candidate.cv_received_date ? (
                            <>
                              {new Date(candidate.cv_received_date).toLocaleDateString('he-IL')}
                              <br />
                              <span className="text-gray-500 text-xs">
                                {new Date(candidate.cv_received_date).toLocaleTimeString('he-IL', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </>
                          ) : (
                            <>
                              {new Date(candidate.inbox_created_date).toLocaleDateString('he-IL')}
                              <br />
                              <span className="text-gray-500 text-xs">
                                {new Date(candidate.inbox_created_date).toLocaleTimeString('he-IL', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {candidate.first_name} {candidate.last_name}
                          </div>
                          {candidate.email && (
                            <div className="text-xs text-gray-500">{candidate.email}</div>
                          )}
                          {candidate.security_clearance === 'רמה 1' && (
                            <Badge className="bg-red-100 text-red-800 text-xs mt-1">
                              רמה 1 - בעדיפות גבוהה
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{candidate.phone_primary || 'לא צוין'}</TableCell>
                        <TableCell>
                            {candidate.referred_by_employee_name ? (
                              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
                                {candidate.referred_by_employee_name}
                              </Badge>
                            ) : '-'}
                        </TableCell>
                        <TableCell>
                          <Select 
                            value={candidate.security_clearance || 'לא רלוונטי'} 
                            onValueChange={async (value) => {
                              // Optimistic update - update UI immediately
                              setInboxCandidates(prev => prev.map(c => c.id === candidate.id ? {...c, security_clearance: value} : c));
                              // Then update server in background
                              Candidate.update(candidate.id, { security_clearance: value }).catch(console.error);
                            }}
                          >
                            <SelectTrigger className="w-32 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="רמה 1">רמה 1</SelectItem>
                              <SelectItem value="רמה 2">רמה 2</SelectItem>
                              <SelectItem value="רמה 3">רמה 3</SelectItem>
                              <SelectItem value="סווג נמוך">סווג נמוך</SelectItem>
                              <SelectItem value="ללא סווג">ללא סווג</SelectItem>
                              <SelectItem value="לא רלוונטי">לא רלוונטי</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <CandidateStatusSelector 
                            candidate={candidate} 
                            onStatusChange={(updatedCandidate) => {
                              // Optimistic update - update local state immediately
                              setInboxCandidates(prev => prev.map(c => 
                                c.id === updatedCandidate.id ? {...c, ...updatedCandidate} : c
                              ));
                              setCandidates(prev => prev.map(c => 
                                c.id === updatedCandidate.id ? {...c, ...updatedCandidate} : c
                              ));
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {candidate.is_read ? (
                              <Badge variant="outline" className="text-green-600 border-green-600">
                                <CheckCircle2 className="w-3 h-3 ml-1" />
                                נקרא
                              </Badge>
                            ) : (
                              <Badge className="bg-blue-500 text-white">
                                <Clock className="w-3 h-3 ml-1" />
                                חדש
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                           <InboxCandidateActionsDropdown
                             candidate={candidate}
                             user={user}
                             onOpenResume={openResumeFile}
                             onOpenInterview={handleOpenInterviewDialog}
                             onOpenClientCv={handleOpenClientCvDialog}
                             onOpenOfferSystem={openOfferSystem}
                             onSendToClients={handleSendToClients}
                             onSendWhatsapp={handleSendWhatsappToCandidate}
                             onMarkAsRead={handleCandidateRead}
                           />
                         </TableCell>
                      </TableRow>
                    ))}
                    {filteredInboxCandidates.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                          לא נמצאו מועמדים בדואר הנכנס
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              ) : (
              /* Cards View */
              <div className="grid gap-4">
                <AnimatePresence>
                {filteredInboxCandidates.map((candidate) => (
                  <motion.div
                    key={candidate.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                  >
                  <Card className={`
                    ${candidate.security_clearance === 'רמה 1' ? 'bg-red-50 border-red-200' : 'bg-white'}
                    ${!candidate.is_read ? 'border-blue-300' : ''}
                  `}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={selectedInboxIds.includes(candidate.id)}
                            onCheckedChange={(checked) => handleSelectOne(candidate.id, checked)}
                          />
                          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-gray-200 flex-shrink-0">
                            {candidate.profile_image_url ? (
                              <img
                                src={candidate.profile_image_url}
                                alt={`${candidate.first_name} ${candidate.last_name}`}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                                <Users className="w-6 h-6 text-gray-400" />
                              </div>
                            )}
                          </div>
                          <div>
                            <CardTitle className="text-lg">{candidate.first_name} {candidate.last_name}</CardTitle>
                            <p className="text-xs text-gray-500">{candidate.email}</p>
                          </div>
                        </div>
                        {candidate.is_read ? (
                          <Badge variant="outline" className="text-green-600 border-green-600 text-xs">
                            <CheckCircle2 className="w-3 h-3 ml-1" />
                            נקרא
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-500 text-white text-xs">
                            <Clock className="w-3 h-3 ml-1" />
                            חדש
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">תאריך הגעה:</span>
                        <span className="font-medium">
                          {candidate.cv_received_date 
                            ? new Date(candidate.cv_received_date).toLocaleString('he-IL')
                            : new Date(candidate.inbox_created_date).toLocaleString('he-IL')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">טלפון:</span>
                        <span className="font-medium">{candidate.phone_primary || 'לא צוין'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">סיווג:</span>
                        <Select 
                          value={candidate.security_clearance || 'לא רלוונטי'} 
                          onValueChange={async (value) => {
                            // Optimistic update - update UI immediately
                            setInboxCandidates(prev => prev.map(c => c.id === candidate.id ? {...c, security_clearance: value} : c));
                            // Then update server in background
                            Candidate.update(candidate.id, { security_clearance: value }).catch(console.error);
                          }}
                        >
                          <SelectTrigger className="w-32 h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="רמה 1">רמה 1</SelectItem>
                            <SelectItem value="רמה 2">רמה 2</SelectItem>
                            <SelectItem value="רמה 3">רמה 3</SelectItem>
                            <SelectItem value="סווג נמוך">סווג נמוך</SelectItem>
                            <SelectItem value="ללא סווג">ללא סווג</SelectItem>
                            <SelectItem value="לא רלוונטי">לא רלוונטי</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">סטטוס:</span>
                        <CandidateStatusSelector 
                          candidate={candidate} 
                          onStatusChange={(updatedCandidate) => {
                            // Optimistic update - update local state immediately
                            setInboxCandidates(prev => prev.map(c => 
                              c.id === updatedCandidate.id ? {...c, ...updatedCandidate} : c
                            ));
                            setCandidates(prev => prev.map(c => 
                              c.id === updatedCandidate.id ? {...c, ...updatedCandidate} : c
                            ));
                          }}
                        />
                      </div>
                    </CardContent>
                    <div className="p-4 border-t flex justify-end">
                      <InboxCandidateActionsDropdown
                        candidate={candidate}
                        user={user}
                        onOpenResume={openResumeFile}
                        onOpenInterview={handleOpenInterviewDialog}
                        onOpenClientCv={handleOpenClientCvDialog}
                        onOpenOfferSystem={openOfferSystem}
                        onSendToClients={handleSendToClients}
                        onSendWhatsapp={handleSendWhatsappToCandidate}
                        onMarkAsRead={handleCandidateRead}
                      />
                    </div>
                  </Card>
                  </motion.div>
                ))}
                </AnimatePresence>
                {filteredInboxCandidates.length === 0 && (
                  <div className="text-center py-12">
                    <Mail className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">לא נמצאו מועמדים בדואר הנכנס</p>
                  </div>
                )}
              </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Mail className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <p>אין מועמדים חדשים בדואר הנכנס</p>
            </div>
          )}
        </CardContent>
      </Card>
        </MobileTabsContent>
      </MobileTabs>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCandidate ? "עריכת מועמד" : "הוספת מועמד ידנית"}</DialogTitle>
          </DialogHeader>
          <CandidateForm
            candidate={editingCandidate}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingCandidate(null);
            }}
          />
        </DialogContent>
      </Dialog>
      
      {/* NEW: Send CV to Client Dialog */}
      {sendCvDialogState.isOpen && (
          <SendCvToClientDialog
              isOpen={sendCvDialogState.isOpen}
              onClose={() => setSendCvDialogState({ isOpen: false, candidate: null })}
              candidate={sendCvDialogState.candidate}
              user={user}
              clients={clients}
              onSendSuccess={loadCandidates}
          />
      )}

      {/* NEW: Interview Questions Dialog */}
      {interviewDialogState.isOpen && (
        <InterviewQuestionsDialog
          isOpen={interviewDialogState.isOpen}
          onClose={() => setInterviewDialogState({ isOpen: false, candidate: null })}
          candidate={interviewDialogState.candidate}
        />
      )}

      {/* NEW: Client CV Formatter Dialog */}
      {clientCvDialogState.isOpen && (
        <ClientCvFormatterDialog
          isOpen={clientCvDialogState.isOpen}
          onClose={() => setClientCvDialogState({ isOpen: false, candidate: null })}
          candidate={clientCvDialogState.candidate}
        />
      )}

      {/* NEW: Send to Clients Dialog (original email one) */}
      <Dialog open={sendDialog.isOpen} onOpenChange={(open) => !open && setSendDialog({ isOpen: false, candidate: null, selectedClients: [], messageTemplate: '' })}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
              <DialogHeader>
                  <DialogTitle>שליחת מועמד ללקוחות</DialogTitle>
                  {sendDialog.candidate && (
                      <DialogDescription>
                          שליחת פרטי המועמד "{sendDialog.candidate.first_name} {sendDialog.candidate.last_name}" ללקוחות שנבחרו
                      </DialogDescription>
                  )}
              </DialogHeader>

              <div className="space-y-6">
                  {/* Client Selection */}
                  <div>
                      <Label className="text-base font-semibold">בחר לקוחות לשליחה:</Label>
                      <div className="mt-3 space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                          {clients.length > 0 ? (
                            clients.map((client) => (
                                <div key={client.id} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={client.id}
                                        checked={sendDialog.selectedClients.includes(client.id)}
                                        onCheckedChange={(checked) => {
                                            setSendDialog(prev => ({
                                                ...prev,
                                                selectedClients: checked
                                                    ? [...prev.selectedClients, client.id]
                                                    : prev.selectedClients.filter(id => id !== client.id)
                                            }));
                                        }}
                                        className="ml-2"
                                    />
                                    <Label htmlFor={client.id} className="text-sm mr-2">
                                        <span className="font-medium">{client.name}</span>
                                        <br />
                                        <span className="text-gray-500 text-xs">{client.email}</span>
                                    </Label>
                                </div>
                            ))
                          ) : (
                            <p className="text-center text-gray-500 py-4">אין לקוחות זמינים</p>
                          )}
                      </div>
                      {sendDialog.selectedClients.length > 0 && (
                          <p className="text-sm text-gray-600 mt-2">
                              נבחרו {sendDialog.selectedClients.length} לקוחות
                          </p>
                      )}
                  </div>

                  {/* Message Template */}
                  <div>
                      <Label htmlFor="message-template" className="text-base font-semibold">
                          תבנית ההודעה:
                      </Label>
                      <Textarea
                          id="message-template"
                          value={sendDialog.messageTemplate}
                          onChange={(e) => setSendDialog(prev => ({ ...prev, messageTemplate: e.target.value }))}
                          rows={10}
                          className="mt-2"
                          placeholder="הקלד כאן את תבנית ההודעה..."
                      />
                      <div className="text-xs text-gray-500 mt-2">
                          משתנים זמינים: <code className="bg-gray-100 p-1 rounded">{'client_name'}</code>, <code className="bg-gray-100 p-1 rounded">{'candidate_name'}</code>, <code className="bg-gray-100 p-1 rounded">{'candidate_email'}</code>, <code className="bg-gray-100 p-1 rounded">{'candidate_phone'}</code>, <code className="bg-gray-100 p-1 rounded">{'security_clearance'}</code>, <code className="bg-gray-100 p-1 rounded">{'skills_summary'}</code>
                      </div>
                  </div>
              </div>

              <DialogFooter className="flex justify-end gap-3 pt-4">
                  <Button 
                      variant="outline" 
                      onClick={() => setSendDialog({ isOpen: false, candidate: null, selectedClients: [], messageTemplate: '' })}
                      disabled={sendingEmail}
                  >
                      ביטול
                  </Button>
                  <Button 
                      onClick={executeSendToClients}
                      disabled={sendDialog.selectedClients.length === 0 || sendingEmail}
                      className="bg-blue-600 hover:bg-blue-700"
                  >
                      {sendingEmail ? (
                          <>
                              <Loader2 className="w-4 h-4 animate-spin ml-2" />
                              שולח...
                          </>
                      ) : (
                          <>
                              <Send className="w-4 h-4 ml-2" />
                              שלח ל-{sendDialog.selectedClients.length} לקוחות
                          </>
                      )}
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      {/* Send WhatsApp to CANDIDATE Dialog */}
      <Dialog open={whatsappSendDialog.isOpen} onOpenChange={(open) => !open && setWhatsappSendDialog({ isOpen: false, candidate: null, messageTemplate: '' })}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
              <DialogHeader>
                  <DialogTitle>שליחת WhatsApp למועמד</DialogTitle>
                  {whatsappSendDialog.candidate && (
                      <DialogDescription>
                          שליחת הודעה ל-{whatsappSendDialog.candidate.first_name} {whatsappSendDialog.candidate.last_name} ({whatsappSendDialog.candidate.phone_primary})
                      </DialogDescription>
                  )}
              </DialogHeader>

              <div className="space-y-6">
                  {/* Message Template */}
                  <div>
                      <Label htmlFor="whatsapp-candidate-message" className="text-base font-semibold">
                          תוכן ההודעה:
                      </Label>
                      <Textarea
                          id="whatsapp-candidate-message"
                          value={whatsappSendDialog.messageTemplate}
                          onChange={(e) => setWhatsappSendDialog(prev => ({ ...prev, messageTemplate: e.target.value }))}
                          rows={10}
                          className="mt-2"
                          placeholder="הקלד כאן את ההודעה למועמד..."
                      />
                      <div className="text-xs text-gray-500 mt-2">
                           משתנים זמינים: <code className="bg-gray-100 p-1 rounded">{'{candidate_name}'}</code>, <code className="bg-gray-100 p-1 rounded">{'{candidate_email}'}</code>, <code className="bg-gray-100 p-1 rounded">{'{candidate_phone}'}</code>
                      </div>
                  </div>
              </div>

              <DialogFooter className="flex justify-end gap-3 pt-4">
                  <Button 
                      variant="outline" 
                      onClick={() => setWhatsappSendDialog({ isOpen: false, candidate: null, messageTemplate: '' })}
                      disabled={sendingWhatsapp}
                  >
                      ביטול
                  </Button>
                  <Button 
                      onClick={executeSendWhatsappToCandidate}
                      disabled={sendingWhatsapp}
                      className="bg-green-600 hover:bg-green-700"
                  >
                      {sendingWhatsapp ? (
                          <>
                              <Loader2 className="w-4 h-4 animate-spin ml-2" />
                              פותח WhatsApp...
                          </>
                      ) : (
                          <>
                              <Smartphone className="w-4 h-4 ml-2" />
                              פתח WhatsApp ושלח
                          </>
                      )}
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, message: "", onConfirm: null })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        variant={confirmDialog.onConfirm === handleDelete ? "destructive" : "default"}
      />

      {/* Upload Dialog */}
      <UploadDialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <UploadDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <UploadDialogHeader>
            <UploadDialogTitle>העלאת קורות חיים ברקע</UploadDialogTitle>
          </UploadDialogHeader>
          <BackgroundFileUpload onUploadComplete={() => setShowUploadDialog(false)} />
        </UploadDialogContent>
      </UploadDialog>

      {/* NEW: Duplicate Check Dialog for manual form */}
      <DuplicateCheckDialog
        isOpen={duplicateDialog.isOpen}
        onClose={handleDuplicateDialogCancel}
        duplicates={duplicateDialog.duplicates}
        candidateName={duplicateDialog.candidateData ? `${duplicateDialog.candidateData.first_name} ${duplicateDialog.candidateData.last_name}` : ''}
        onProceed={handleDuplicateDialogProceed}
        onCancel={handleDuplicateDialogCancel}
      />

      {/* WhatsApp History Dialog */}
      <CandidateWhatsappHistory
        isOpen={whatsappHistoryDialog.isOpen}
        onClose={() => setWhatsappHistoryDialog({ isOpen: false, candidate: null })}
        candidate={whatsappHistoryDialog.candidate}
      />

      {/* Communication History Dialog */}
      <CandidateCommunicationHistory
        candidateId={communicationHistoryDialog.candidate?.id}
        candidateName={communicationHistoryDialog.candidate ? `${communicationHistoryDialog.candidate.first_name} ${communicationHistoryDialog.candidate.last_name}` : ''}
        open={communicationHistoryDialog.isOpen}
        onClose={() => setCommunicationHistoryDialog({ isOpen: false, candidate: null })}
      />

      {/* Candidate Jobs Dialog */}
      <Dialog open={candidateJobsDialog.isOpen} onOpenChange={(open) => !open && setCandidateJobsDialog({ isOpen: false, candidate: null, matches: [], loading: false })}>
        <DialogContent className="max-w-3xl max-h-[80vh]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-blue-600" />
              משרות שהמועמד הותאם אליהן (80%+)
            </DialogTitle>
            {candidateJobsDialog.candidate && (
              <DialogDescription>
                {candidateJobsDialog.candidate.first_name} {candidateJobsDialog.candidate.last_name}
                {!candidateJobsDialog.loading && candidateJobsDialog.matches && ` - ${candidateJobsDialog.matches.length} משרות`}
              </DialogDescription>
            )}
          </DialogHeader>
          
          {candidateJobsDialog.loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : candidateJobsDialog.error ? (
            <div className="text-center py-8 text-red-500">
              <p>{candidateJobsDialog.error}</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-2 pr-4">
                {candidateJobsDialog.matches && candidateJobsDialog.matches.length > 0 ? (
                  candidateJobsDialog.matches.map((match) => (
                    <div key={match.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900">{match.job_title}</span>
                            <Badge className="bg-blue-100 text-blue-800">
                              {match.match_score}% התאמה
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-600 mt-2 flex flex-wrap gap-x-4 gap-y-1">
                            {match.job_code && (
                              <span className="flex items-center gap-1">
                                <span className="font-medium">קוד:</span> {match.job_code}
                              </span>
                            )}
                            {match.client_name && (
                              <span className="flex items-center gap-1">
                                <span className="font-medium">לקוח:</span> {match.client_name}
                              </span>
                            )}
                            {match.user_name && (
                              <span className="flex items-center gap-1">
                                <span className="font-medium">סוכן:</span> {match.user_name}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <span className="font-medium">נוצרה:</span> {new Date(match.created_date).toLocaleDateString('he-IL')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <Briefcase className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                    <p className="text-lg font-medium">לא נמצאו התאמות</p>
                    <p className="text-sm mt-1">אין למועמד זה התאמות משרות עם ציון 80% ומעלה</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Merge Candidates Dialog */}
      <MergeCandidatesDialog
        isOpen={mergeDialog.isOpen}
        onClose={() => {
          setMergeDialog({ isOpen: false, candidates: [] });
          setSelectedCandidateIds([]);
        }}
        candidates={mergeDialog.candidates}
        onMergeSuccess={() => {
          loadCandidates();
          setSelectedCandidateIds([]);
        }}
      />
    </div>
  );
}