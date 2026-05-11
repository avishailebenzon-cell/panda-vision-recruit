import React, { useState, useEffect, useMemo } from "react"; // Added useMemo
import { Job } from "@/entities/Job";
import { Client } from "@/entities/Client";
import { UploadFile, ExtractDataFromUploadedFile } from "@/integrations/Core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Plus,
  FileText,
  Search,
  Edit,
  Trash2,
  Building,
  MapPin,
  CheckCircle,
  Pause,
  ExternalLink,
  AlertTriangle,
  Loader2,
  Briefcase,
  Eye,

  LayoutGrid,
  List,
  Send,
  CheckSquare,
  FilePlus,
  Calendar,
  Settings
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { motion, AnimatePresence } from "framer-motion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { exportJobsToGoogleDoc } from "@/functions/exportJobsToGoogleDoc";
import { User } from "@/entities/User"; // Import User entity
import { base44 } from "@/api/base44Client";

import DanaChatDialog from "../components/jobs/DanaChatDialog";
import AddSupplementDialog from "../components/jobs/AddSupplementDialog";
import BulkUpdateDialog from "../components/jobs/BulkUpdateDialog";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

// New: Table components
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";




// Map from assigned_agent value → { label, badgeClass }
const AGENT_BADGE_MAP = {
  'רמי (סוכן AI)':   { label: 'רמי',   cls: 'bg-red-100 text-red-700 border-red-200' },
  'אליק (סוכן AI)':  { label: 'אליק',  cls: 'bg-teal-100 text-teal-700 border-teal-200' },
  'איתי (סוכן AI)':  { label: 'איתי',  cls: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  'ליאור (סוכן AI)': { label: 'ליאור', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  'אופיר (סוכן AI)': { label: 'אופיר', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  'GC (סוכן AI)':    { label: 'GC',    cls: 'bg-gray-100 text-gray-700 border-gray-200' },
  'נעמה (סוכן AI)':  { label: 'נעמה',  cls: 'bg-orange-100 text-orange-700 border-orange-200' },
};

export default function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [securityClearanceFilter, setSecurityClearanceFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [pipelineFilter, setPipelineFilter] = useState("all");
  const [genericFilter, setGenericFilter] = useState("all");
  const [publishFilter, setPublishFilter] = useState("all");
  const [viewMode, setViewMode] = useState("table"); // "cards" or "table"
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, message: "", onConfirm: null });
  

  
  // Client data completion dialog state
  const [showClientDialog, setShowClientDialog] = useState(false);
  const [pendingClientData, setPendingClientData] = useState(null);
  const [clientCompletionData, setClientCompletionData] = useState({});
  const [dialogResolve, setDialogResolve] = useState(null); // To store resolve function for dialog promise



  
  // Bulk selection state
  const [selectedJobIds, setSelectedJobIds] = useState(new Set());
  
  // Dana chat dialog state
  const [showDanaDialog, setShowDanaDialog] = useState(false);
  
  // Add supplement dialog state
  const [showSupplementDialog, setShowSupplementDialog] = useState(false);
  const [selectedJobForSupplement, setSelectedJobForSupplement] = useState(null);
  
  // Bulk update dialog state
  const [showBulkUpdateDialog, setShowBulkUpdateDialog] = useState(false);

  useEffect(() => {
    loadData();
    
    // Check if we should open Dana dialog automatically
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('openDana') === 'true') {
      setShowDanaDialog(true);
      // Clean up the URL parameter
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [jobsList, clientsList] = await Promise.all([
        Job.list("-created_date"),
        Client.list()
      ]);
      setJobs(jobsList);
      setClients(clientsList);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setLoading(false);
  };







  const jobCounts = useMemo(() => {
    return {
      total: jobs.length,
      active: jobs.filter(j => j.status === 'פעילה').length,
      paused: jobs.filter(j => j.status === 'מושהית').length,
    };
  }, [jobs]);

  const handleClientDataCompletion = async (useDefaults = false) => {
    if (!pendingClientData) {
      if (dialogResolve) dialogResolve(null);
      return null;
    }

    let finalClientData;
    
    if (useDefaults) {
      finalClientData = {
        ...pendingClientData,
        email: pendingClientData.email || "office@pandatech.co.il",
        phone: pendingClientData.phone || "052-6665248",
        contact_person: pendingClientData.contact_person || "לא צוין"
      };
    } else {
      finalClientData = {
        ...pendingClientData,
        email: clientCompletionData.email || pendingClientData.email || "office@pandatech.co.il",
        phone: clientCompletionData.phone || pendingClientData.phone || "052-6665248",
        contact_person: clientCompletionData.contact_person || pendingClientData.contact_person || "לא צוין"
      };
    }

    let newClient = null;
    try {
      newClient = await Client.create(finalClientData);
      setClients(prev => [...prev, newClient]); // Update global clients list
      setUploadProgress(`נוצר לקוח חדש: ${newClient.name}. מעבד משרות...`);
    } catch (error) {
      console.error("Error creating client:", error);
      setUploadProgress("שגיאה ביצירת לקוח. המשך עיבוד משרות...");
    } finally {
      setShowClientDialog(false);
      setPendingClientData(null);
      setClientCompletionData({});
      if (dialogResolve) {
        dialogResolve(newClient); // Resolve the promise with the created client (or null if failed)
        setDialogResolve(null); // Clear the resolve function
      }
    }
    return newClient;
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setUploadProgress("שגיאה: ניתן להעלות קבצי PDF בלבד.");
      setTimeout(() => setUploadProgress(""), 5000);
      return;
    }

    setUploadingFile(true);
    setUploadProgress("מעלה קובץ...");

    try {
      // Upload the file
      const { file_url } = await UploadFile({ file });
      setUploadProgress("מחלץ מידע על משרות ולקוחות מהקובץ...");

      // Extract job and client data from PDF file
      const extractionResult = await ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "object",
          properties: {
            jobs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  requirements: { type: "string" },
                  location: { type: "string" },
                  company: { type: "string" },
                  factory_department: { type: "string" },
                  contact_person: { type: "string" },
                  contact_email: { type: "string" },
                  contact_phone: { type: "string" },
                  security_clearance: { type: "string" },
                  pipedrive_deal_url: { type: "string" }
                }
              }
            }
          }
        }
      });

      if (extractionResult.status === "success" && extractionResult.output?.jobs) {
        const extractedJobs = extractionResult.output.jobs;
        setUploadProgress(`נמצאו ${extractedJobs.length} משרות. מעבד לקוחות ושומר במערכת...`);

        let newClientsCount = 0;
        let newJobsCount = 0;
        // Create a mutable copy of clients for local additions during this batch
        // NOTE: This copy will not reflect global `clients` state updates by the dialog
        // so `existingClient` assignment will rely on dialog's return value for new clients.
        const currentClientsSnapshot = [...clients];

        // Process each job and handle client creation
        for (const jobData of extractedJobs) {
          let client_id = "";
          let client_name = jobData.company || "לא צוין";

          let existingClient = currentClientsSnapshot.find(c =>
            c.name.toLowerCase().trim() === (jobData.company || '').toLowerCase().trim()
          );
          
          if (jobData.company && !existingClient) {
            // Prepare client data
            const newClientData = {
              name: jobData.company,
              contact_person: jobData.contact_person || "",
              email: jobData.contact_email || "",
              phone: jobData.contact_phone || ""
            };

            // Check if critical data is missing (email or phone or contact person)
            const missingEmail = !newClientData.email;
            const missingPhone = !newClientData.phone;
            const missingContactPerson = !newClientData.contact_person;

            if (missingEmail || missingPhone || missingContactPerson) {
              // Show dialog for data completion
              setPendingClientData(newClientData);
              setClientCompletionData({
                email: newClientData.email,
                phone: newClientData.phone,
                contact_person: newClientData.contact_person
              });
              setShowClientDialog(true);

              // Create a promise to wait for user input from the dialog
              const clientPromise = new Promise((resolve) => {
                setDialogResolve(() => resolve); // Store the resolve function
              });

              // Wait for the dialog to be handled and promise to resolve
              const createdClientFromDialog = await clientPromise; 
              
              if (createdClientFromDialog) {
                existingClient = createdClientFromDialog;
                newClientsCount++;
                // Add to local clients snapshot for subsequent jobs in this batch
                currentClientsSnapshot.push(createdClientFromDialog); 
              } else {
                // If dialog was dismissed or client creation failed, skip this client
                console.warn(`Skipping client creation for ${jobData.company} due to user dismissal or error.`);
              }
            } else {
              // Create client directly if all data is available from PDF
              try {
                existingClient = await Client.create(newClientData);
                newClientsCount++;
                currentClientsSnapshot.push(existingClient); // Add to local clients snapshot
                setUploadProgress(`נוצר לקוח חדש: ${jobData.company}. מעבד משרות...`);
              } catch (error) {
                console.error(`Error creating client for company "${jobData.company}":`, error);
                existingClient = null; // Mark as null if creation failed
              }
            }
          }

          if (existingClient) {
            client_id = existingClient.id;
            client_name = existingClient.name;
          }

          // Create the job
          try {
            // Generate job code for new jobs
            const allJobs = await Job.list(); // Re-fetch to get most up-to-date codes
            const existingCodes = allJobs
              .map(job => job.job_code)
              .filter(code => code && code.startsWith('pan-'))
              .map(code => parseInt(code.replace('pan-', '')))
              .filter(num => !isNaN(num)); // Ensure we only get valid numbers
            
            const nextNumber = existingCodes.length > 0 ? Math.max(...existingCodes) + 1 : 1;
            const jobCode = `pan-${nextNumber.toString().padStart(3, '0')}`;

            await Job.create({
              title: jobData.title || "משרה ללא כותרת",
              description: jobData.description || "",
              requirements: jobData.requirements || "",
              location: jobData.location || "",
              client_id,
              client_name,
              factory_department: jobData.factory_department || "",
              contact_person: jobData.contact_person || "",
              security_clearance: jobData.security_clearance || "",
              status: "פעילה", // Default status for new jobs
              pipedrive_deal_url: jobData.pipedrive_deal_url || "",
              job_code: jobCode // Assign the newly generated job code
            });
            newJobsCount++;
          } catch (error) {
            console.error(`Error creating job "${jobData.title}" for client "${jobData.company}":`, error);
          }
        }

        // Reload data to show new clients and jobs
        await loadData();
        
        const successMessage = `הושלם! נוספו ${newJobsCount} משרות${newClientsCount > 0 ? ` ו-${newClientsCount} לקוחות חדשים` : ''}`;
        setUploadProgress(successMessage);
        setTimeout(() => setUploadProgress(""), 4000);
      } else {
        setUploadProgress("שגיאה: לא ניתן לחלץ מידע על משרות מהקובץ");
      }

    } catch (error) {
      console.error("Error uploading jobs file:", error);
      setUploadProgress("שגיאה בהעלאת הקובץ");
    }

    setUploadingFile(false);
    setTimeout(() => setUploadProgress(""), 5000);
  };

  const handleSubmit = async (formData) => {
    // Close form immediately for better UX
    setShowForm(false);
    setEditingJob(null);
    
    try {
      if (editingJob) {
        // Detect changed fields
        const changedFields = [];
        const importantFields = ['title', 'description', 'requirements', 'location', 'security_clearance', 'dana_supplement'];
        
        importantFields.forEach(field => {
          if (formData[field] !== editingJob[field]) {
            changedFields.push(field);
          }
        });

        await Job.update(editingJob.id, formData);
        
        // Log job update if important fields changed
        if (changedFields.length > 0) {
          try {
            const currentUser = await base44.auth.me();
            const fieldNames = {
              'title': 'כותרת',
              'description': 'תיאור',
              'requirements': 'דרישות',
              'location': 'מיקום',
              'security_clearance': 'סיווג בטחוני',
              'dana_supplement': 'תוספת דנה'
            };
            
            const changeSummary = changedFields.map(f => fieldNames[f] || f).join(', ');
            
            await base44.entities.JobUpdateLog.create({
              job_id: editingJob.id,
              job_title: formData.title,
              job_code: formData.job_code,
              changed_fields: changedFields,
              change_summary: `עודכנו השדות: ${changeSummary}`,
              updated_by_user_id: currentUser.id,
              updated_by_user_name: currentUser.full_name,
              agents_notified: [],
              notification_status: 'pending'
            });
          } catch (logError) {
            console.error('Failed to log job update:', logError);
          }
        }
        
        // Update job in Pipedrive if it has a deal ID
        if (editingJob.pipedrive_deal_id) {
          try {
            const result = await base44.functions.invoke('updateJobInPipedrive', { jobId: editingJob.id });
            if (result.data?.success) {
              console.log('Job updated in Pipedrive successfully');
            } else {
              console.warn('Failed to update in Pipedrive:', result.data?.error);
            }
          } catch (syncError) {
            console.error('Failed to update in Pipedrive:', syncError);
          }
        }
      } else {
        // For new jobs, generate job code automatically
        const allJobs = await Job.list();
        const existingCodes = allJobs
          .map(job => job.job_code)
          .filter(code => code && code.startsWith('pan-'))
          .map(code => parseInt(code.replace('pan-', '')))
          .filter(num => !isNaN(num));
        
        const nextNumber = existingCodes.length > 0 ? Math.max(...existingCodes) + 1 : 1;
        const jobCode = `pan-${nextNumber.toString().padStart(3, '0')}`;
        
        await Job.create({
          ...formData,
          job_code: jobCode
        });
        
        // Trigger Pipedrive sync after manual job creation (skip generic jobs)
        if (!formData.is_generic_job) {
          try {
            await base44.functions.invoke('syncPipedriveJobs', {});
            console.log('Pipedrive sync triggered after job creation');
          } catch (syncError) {
            console.error('Failed to sync to Pipedrive:', syncError);
          }
        }
      }
      loadData(); // Re-fetch all data to include any newly created clients
    } catch (error) {
      console.error("Error saving job:", error);
    }
  };

  const deleteJobWithMatches = async (jobId) => {
    // Delete all matches for this job first
    try {
      const matches = await base44.entities.Match.filter({ job_id: jobId });
      if (matches.length > 0) {
        await Promise.all(matches.map(m => base44.entities.Match.delete(m.id)));
      }
    } catch (error) {
      console.error("Error deleting matches for job:", error);
    }
    await Job.delete(jobId);
  };

  const handleDelete = async (jobId) => {
    setConfirmDialog({
      isOpen: true,
      message: "האם אתה בטוח שברצונך למחוק את המשרה? כל ההתאמות של המשרה ימחקו גם כן. פעולה זו אינה ניתנת לביטול.",
      onConfirm: async () => {
        try {
          await deleteJobWithMatches(jobId);
          loadData();
        } catch (error) {
          console.error("Error deleting job:", error);
        } finally {
          setConfirmDialog({ isOpen: false, message: "", onConfirm: null });
        }
      }
    });
  };

  const handleBulkDelete = async () => {
    if (selectedJobIds.size === 0) return;
    
    setConfirmDialog({
      isOpen: true,
      message: `האם אתה בטוח שברצונך למחוק ${selectedJobIds.size} משרות? כל ההתאמות של המשרות ימחקו גם כן. פעולה זו אינה ניתנת לביטול.`,
      onConfirm: async () => {
        try {
          const idsToDelete = Array.from(selectedJobIds);
          for (let i = 0; i < idsToDelete.length; i++) {
            await deleteJobWithMatches(idsToDelete[i]);
            if (i < idsToDelete.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 300));
            }
          }
          setSelectedJobIds(new Set());
          loadData();
        } catch (error) {
          console.error("Error bulk deleting jobs:", error);
        } finally {
          setConfirmDialog({ isOpen: false, message: "", onConfirm: null });
        }
      }
    });
  };

  const toggleJobSelection = (jobId) => {
    setSelectedJobIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(jobId)) {
        newSet.delete(jobId);
      } else {
        newSet.add(jobId);
      }
      return newSet;
    });
  };

  const toggleSelectAllJobs = () => {
    if (selectedJobIds.size === filteredJobs.length) {
      setSelectedJobIds(new Set());
    } else {
      setSelectedJobIds(new Set(filteredJobs.map(j => j.id)));
    }
  };

  const handleExportToGoogleDoc = async () => {
    try {
      const response = await exportJobsToGoogleDoc();

      // Check for success and existence of data
      if (!response.data || !response.data.success) {
        throw new Error(response.data?.error || 'Failed to generate document.');
      }
      
      const { fileData, fileName } = response.data;

      // Decode the Base64 string to a byte array
      const byteCharacters = atob(fileData);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);

      // Create a Blob from the byte array
      const blob = new Blob([byteArray], { 
        type: 'text/html' 
      });
      
      // Create a download link and trigger the download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || `משרות_לפרסום.html`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up by revoking the object URL
      window.URL.revokeObjectURL(url);
      a.remove();
      
    } catch (error) {
      console.error('Error exporting jobs:', error);
      alert('שגיאה בהפקת המסמך. נסה שוב מאוחר יותר.');
    }
  };



  // Handle adding supplement to job
  const handleAddSupplement = (job) => {
    setSelectedJobForSupplement(job);
    setShowSupplementDialog(true);
  };

  // Get unique locations and clients for filters
  const uniqueLocations = useMemo(() => {
    const locations = jobs.map(j => j.location).filter(Boolean);
    return [...new Set(locations)].sort();
  }, [jobs]);

  const uniqueClients = useMemo(() => {
    const clientNames = jobs.map(j => j.client_name).filter(Boolean);
    return [...new Set(clientNames)].sort();
  }, [jobs]);

  const uniqueSecurityClearances = useMemo(() => {
    const clearances = jobs.map(j => j.security_clearance).filter(Boolean);
    return [...new Set(clearances)].sort();
  }, [jobs]);

  const uniquePipelines = useMemo(() => {
    const pipelines = jobs.map(j => j.pipeline).filter(Boolean);
    return [...new Set(pipelines)].sort();
  }, [jobs]);

  const priorityColors = {
    "עדיפות גיוס 1": "bg-red-100 text-red-800 border-red-300",
    "עדיפות גיוס 2": "bg-yellow-100 text-yellow-800 border-yellow-300",
    "עדיפות גיוס 3": "bg-orange-100 text-orange-800 border-orange-300",
    "עדיפות גיוס 4": "bg-green-100 text-green-800 border-green-300",
    "עדיפות גיוס 5": "bg-gray-100 text-gray-700 border-gray-300"
  };

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = !searchTerm ||
      job.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.factory_department?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      job.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||   
      job.security_clearance?.toLowerCase().includes(searchTerm.toLowerCase()); 

    const matchesStatus = statusFilter === "all" || job.status === statusFilter;
    const matchesLocation = locationFilter === "all" || job.location === locationFilter;
    const matchesClient = clientFilter === "all" || job.client_name === clientFilter;
    const matchesSource = sourceFilter === "all" || 
      (sourceFilter === "manual" && (job.source === "manual" || !job.pipedrive_deal_id)) ||
      (sourceFilter === "pipedrive" && (job.source === "pipedrive" || job.pipedrive_deal_id));
    const matchesSecurityClearance = securityClearanceFilter === "all" || job.security_clearance === securityClearanceFilter;
    const matchesPriority = priorityFilter === "all" || job.recruitment_priority === priorityFilter;
    const matchesPipeline = pipelineFilter === "all" || job.pipeline === pipelineFilter;
    const matchesGeneric = genericFilter === "all" || 
      (genericFilter === "generic" && job.is_generic_job) ||
      (genericFilter === "non_generic" && !job.is_generic_job);

    const matchesPublish = publishFilter === "all" ||
      (publishFilter === "publish" && !job.do_not_publish) ||
      (publishFilter === "no_publish" && job.do_not_publish);

    return matchesSearch && matchesStatus && matchesLocation && matchesClient && matchesSource && matchesSecurityClearance && matchesPriority && matchesPipeline && matchesGeneric && matchesPublish;
  });

  const statusColors = {
    "פעילה": "bg-green-100 text-green-800",
    "סגורה": "bg-gray-100 text-gray-800",
    "מושהית": "bg-yellow-100 text-yellow-800"
  };

  const statusIcons = {
    "פעילה": CheckCircle,
    "סגורה": Trash2,
    "מושהית": Pause
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-start space-y-4 md:space-y-0">
        <div className="flex items-center gap-4">
          <img 
            src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop&crop=face" 
            alt="נועה" 
            className="w-16 h-16 rounded-full object-cover border-4 border-green-200 shadow-lg"
          />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">נועה - משרות</h1>
            <p className="text-sm md:text-base text-gray-600">סוכנת AI חכמה לפרסום משרות באתר החברה, הפצה לאתרי דרושים והעברה להילה לשליחה לעובדים</p>
          </div>
        </div>
      </div>
      
      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-3 justify-end">
          <Button
            variant="outline"
            onClick={() => setShowDanaDialog(true)}
            className="w-full sm:w-auto border-blue-500 text-blue-600 hover:bg-blue-50"
          >
            <Briefcase className="w-4 h-4 ml-2" />
            דנה-הוספת משרה
          </Button>
          <Button
            variant="outline"
            onClick={handleExportToGoogleDoc}
            className="w-full sm:w-auto border-green-500 text-green-600 hover:bg-green-50"
          >
            <FileText className="w-4 h-4 ml-2" />
            הפקת משרות לפרסום באתרי דרושים
          </Button>
          <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
            <Plus className="w-4 h-4 ml-2" />
            הוספת משרה
          </Button>
        </div>
      
      {/* Job stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">סה"כ משרות</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{jobCounts.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">משרות פעילות</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{jobCounts.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">משרות מושהות</CardTitle>
            <Pause className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{jobCounts.paused}</div>
          </CardContent>
        </Card>
         <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">משרות סגורות</CardTitle>
            <Trash2 className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{jobs.length - jobCounts.active - jobCounts.paused}</div>
          </CardContent>
        </Card>
      </div>

      {uploadProgress && (
        <Alert>
          <AlertDescription>{uploadProgress}</AlertDescription>
        </Alert>
      )}

      {/* Bulk Actions Bar */}
      {selectedJobIds.size > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="font-semibold text-blue-800">{selectedJobIds.size} משרות נבחרו</div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="default"
                onClick={() => setShowBulkUpdateDialog(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Settings className="w-4 h-4 ml-2" />
                עדכון מרובה
              </Button>
              <Button
                variant="destructive"
                onClick={handleBulkDelete}
              >
                <Trash2 className="w-4 h-4 ml-2" />
                מחק נבחרות
              </Button>
              <Button
                variant="outline"
                onClick={() => setSelectedJobIds(new Set())}
                className="bg-white"
              >
                בטל בחירה
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="חיפוש משרות..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10"
            />
          </div>
          
          {/* View Mode Toggle */}
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === "cards" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("cards")}
              className="rounded-l-none"
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("table")}
              className="rounded-r-none"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Filter Row */}
        <div className="flex flex-wrap gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="סטטוס" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הסטטוסים</SelectItem>
              <SelectItem value="פעילה">פעילה</SelectItem>
              <SelectItem value="סגורה">סגורה</SelectItem>
              <SelectItem value="מושהית">מושהית</SelectItem>
            </SelectContent>
          </Select>

          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="מיקום" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל המיקומים</SelectItem>
              {uniqueLocations.map(location => (
                <SelectItem key={location} value={location}>{location}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="ארגון" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הארגונים</SelectItem>
              {uniqueClients.map(client => (
                <SelectItem key={client} value={client}>{client}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="מקור" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל המקורות</SelectItem>
              <SelectItem value="manual">הזנה ידנית</SelectItem>
              <SelectItem value="pipedrive">סינכרון Pipedrive</SelectItem>
            </SelectContent>
          </Select>

          <Select value={securityClearanceFilter} onValueChange={setSecurityClearanceFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="סיווג בטחוני" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הסיווגים</SelectItem>
              {uniqueSecurityClearances.map(clearance => (
                <SelectItem key={clearance} value={clearance}>{clearance}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="עדיפות גיוס" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל העדיפויות</SelectItem>
              <SelectItem value="עדיפות גיוס 1">עדיפות גיוס 1</SelectItem>
              <SelectItem value="עדיפות גיוס 2">עדיפות גיוס 2</SelectItem>
              <SelectItem value="עדיפות גיוס 3">עדיפות גיוס 3</SelectItem>
              <SelectItem value="עדיפות גיוס 4">עדיפות גיוס 4</SelectItem>
              <SelectItem value="עדיפות גיוס 5">עדיפות גיוס 5</SelectItem>
            </SelectContent>
          </Select>

          {uniquePipelines.length > 0 && (
            <Select value={pipelineFilter} onValueChange={setPipelineFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="פייפליין" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הפייפליינים</SelectItem>
                {uniquePipelines.map(pipeline => (
                  <SelectItem key={pipeline} value={pipeline}>{pipeline}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={genericFilter} onValueChange={setGenericFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="סוג משרה" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל המשרות</SelectItem>
              <SelectItem value="generic">משרות גנריות</SelectItem>
              <SelectItem value="non_generic">משרות רגילות</SelectItem>
            </SelectContent>
          </Select>

          <Select value={publishFilter} onValueChange={setPublishFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="פרסום" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל המשרות</SelectItem>
              <SelectItem value="publish">לפרסום בלבד</SelectItem>
              <SelectItem value="no_publish">לא לפרסום</SelectItem>
            </SelectContent>
          </Select>

          {/* Clear Filters */}
          {(statusFilter !== "all" || locationFilter !== "all" || clientFilter !== "all" || sourceFilter !== "all" || securityClearanceFilter !== "all" || priorityFilter !== "all" || pipelineFilter !== "all" || genericFilter !== "all" || publishFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStatusFilter("all");
                setLocationFilter("all");
                setClientFilter("all");
                setSourceFilter("all");
                setSecurityClearanceFilter("all");
                setPriorityFilter("all");
                setPipelineFilter("all");
                setGenericFilter("all");
                setPublishFilter("all");
              }}
              className="text-gray-500"
            >
              נקה סינון
            </Button>
          )}
        </div>
      </div>

      {/* Jobs List - Cards View */}
      {viewMode === "cards" && (
        <div className="grid gap-4">
          <AnimatePresence>
            {filteredJobs.map((job) => {
              const StatusIcon = statusIcons[job.status];
              return (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  id={`job-${job.id}`}
                >
                  <Card className={`hover:shadow-lg transition-shadow ${selectedJobIds.has(job.id) ? 'ring-2 ring-blue-400 bg-blue-50' : ''}`}>
                    <CardHeader>
                      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start space-y-4 lg:space-y-0">
                        <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Checkbox
                            checked={selectedJobIds.has(job.id)}
                            onCheckedChange={() => toggleJobSelection(job.id)}
                          />
                          <CardTitle className="text-lg md:text-xl">{job.title}</CardTitle>
                          {job.status === 'פעילה' && job.assigned_agent && AGENT_BADGE_MAP[job.assigned_agent] && (
                            <Badge variant="outline" className={`text-xs h-6 shrink-0 ${AGENT_BADGE_MAP[job.assigned_agent].cls}`}>
                              {AGENT_BADGE_MAP[job.assigned_agent].label}
                            </Badge>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 md:gap-4 mt-2 text-xs md:text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Building className="w-3 h-3 md:w-4 md:h-4" />
                            <span className="truncate">{job.client_name}</span>
                          </div>
                          {job.factory_department && (
                            <div className="flex items-center gap-1">
                              <Building className="w-3 h-3 md:w-4 md:h-4" />
                              <span className="truncate">{job.factory_department}</span>
                            </div>
                          )}
                          {job.location && (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 md:w-4 md:h-4" />
                              <span className="truncate">{job.location}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 md:w-4 md:h-4" />
                            <span className="truncate">נפתח: {new Date(job.created_date).toLocaleDateString('he-IL')}</span>
                          </div>
                        </div>

                        {job.contact_person && (
                          <div className="text-xs md:text-sm text-gray-500 mt-1">
                            איש קשר: {job.contact_person}
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2 mt-2">
                          {job.pipedrive_deal_id && (
                            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 font-mono text-xs h-6">
                              תפקיד {job.pipedrive_deal_id}
                            </Badge>
                          )}
                          {job.is_generic_job && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-mono text-xs h-6">
                              משרה גנרית
                            </Badge>
                          )}
                          <Badge variant="outline" className={`h-6 ${job.source === 'pipedrive' || job.pipedrive_deal_id ? 'bg-orange-50 text-orange-700 border-orange-200 text-xs' : 'bg-gray-50 text-gray-600 border-gray-200 text-xs'}`}>
                            {job.source === 'pipedrive' || job.pipedrive_deal_id ? 'Pipedrive' : 'ידני'}
                          </Badge>
                          <Badge className={`h-6 ${statusColors[job.status]}`}>
                            <StatusIcon className="w-3 h-3 ml-1" />
                            {job.status}
                          </Badge>
                          {job.recruitment_priority && (
                            <Badge className={`${priorityColors[job.recruitment_priority]} font-bold text-xs h-6 border-2`}>
                              {job.recruitment_priority}
                            </Badge>
                          )}
                          {job.security_clearance && (
                            <Badge variant="outline" className="text-xs h-6">
                              סווג: {job.security_clearance}
                            </Badge>
                          )}
                          {job.deadline && (
                            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs h-6">
                              <Calendar className="w-3 h-3 ml-1" />
                              דד-ליין: {new Date(job.deadline).toLocaleDateString('he-IL')}
                            </Badge>
                          )}
                          {job.do_not_publish && (
                            <Badge className="bg-red-100 text-red-800 text-xs h-6">
                              <Eye className="w-3 h-3 ml-1" />
                              לא לפרסום
                            </Badge>
                          )}
                        </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {job.pipedrive_deal_url && (
                              <Button variant="ghost" size="icon" asChild>
                                  <a href={job.pipedrive_deal_url} target="_blank" rel="noopener noreferrer" title="פתח דיל ב-Pipedrive">
                                      <ExternalLink className="w-4 h-4 text-blue-600" />
                                  </a>
                              </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingJob(job);
                              setShowForm(true);
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleAddSupplement(job)}
                            title="הוסף תוספת הגדרות (דנה)"
                            className="text-purple-600 hover:text-purple-700"
                          >
                            <FilePlus className="w-4 h-4" />
                          </Button>
                          

                          
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(job.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm md:text-base text-gray-600 mb-3">{job.description}</p>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <h4 className="font-semibold text-xs md:text-sm mb-2">דרישות המשרה:</h4>
                        <p className="text-xs md:text-sm text-gray-600">{job.requirements}</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Jobs List - Table View */}
      {viewMode === "table" && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedJobIds.size === filteredJobs.length && filteredJobs.length > 0}
                        onCheckedChange={toggleSelectAllJobs}
                      />
                    </TableHead>
                    <TableHead>תפקיד</TableHead>
                    <TableHead>כותרת</TableHead>
                    <TableHead>לקוח</TableHead>
                    <TableHead>איש קשר</TableHead>
                    <TableHead>נפתח ב</TableHead>
                    <TableHead>מיקום</TableHead>
                    <TableHead>עדיפות</TableHead>
                    <TableHead>סיווג בטחוני</TableHead>
                    <TableHead>דד-ליין</TableHead>
                    <TableHead>מקור</TableHead>
                    <TableHead>סטטוס</TableHead>
                    <TableHead>פרסום</TableHead>
                    <TableHead>פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredJobs.map((job) => {
                    const StatusIcon = statusIcons[job.status];
                    return (
                      <TableRow key={job.id} id={`job-${job.id}`} className={`hover:bg-gray-50 cursor-pointer ${selectedJobIds.has(job.id) ? 'bg-blue-50' : ''}`} onClick={() => { setEditingJob(job); setShowForm(true); }}>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                         <Checkbox
                           checked={selectedJobIds.has(job.id)}
                           onCheckedChange={() => toggleJobSelection(job.id)}
                         />
                        </TableCell>
                        <TableCell>
                          {job.pipedrive_deal_id ? (
                            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 font-mono text-xs">
                              {job.pipedrive_deal_id}
                            </Badge>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium max-w-[200px]">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="truncate" title={job.title}>{job.title}</div>
                            {job.status === 'פעילה' && job.assigned_agent && AGENT_BADGE_MAP[job.assigned_agent] && (
                              <Badge variant="outline" className={`text-xs h-5 shrink-0 ${AGENT_BADGE_MAP[job.assigned_agent].cls}`}>
                                {AGENT_BADGE_MAP[job.assigned_agent].label}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Building className="w-3 h-3 text-gray-400" />
                            <span className="truncate max-w-[120px]">{job.client_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {job.contact_person ? (
                            <span className="text-sm truncate max-w-[100px]">{job.contact_person}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-gray-600">{new Date(job.created_date).toLocaleDateString('he-IL')}</span>
                        </TableCell>
                        <TableCell>
                          {job.location ? (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-gray-400" />
                              <span className="truncate max-w-[100px]">{job.location}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {job.recruitment_priority ? (
                            <Badge className={`${priorityColors[job.recruitment_priority]} font-bold text-xs border-2`}>
                              {job.recruitment_priority}
                            </Badge>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {job.security_clearance ? (
                            <Badge variant="outline" className="text-xs">
                              {job.security_clearance}
                            </Badge>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {job.deadline ? (
                            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs">
                              <Calendar className="w-3 h-3 ml-1" />
                              {new Date(job.deadline).toLocaleDateString('he-IL')}
                            </Badge>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={job.source === 'pipedrive' || job.pipedrive_deal_id ? 'bg-orange-50 text-orange-700 border-orange-200 text-xs' : 'bg-gray-50 text-gray-600 border-gray-200 text-xs'}>
                            {job.source === 'pipedrive' || job.pipedrive_deal_id ? 'Pipedrive' : 'ידני'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[job.status]}>
                            <StatusIcon className="w-3 h-3 ml-1" />
                            {job.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {job.do_not_publish ? (
                            <Badge className="bg-red-100 text-red-800 text-xs">
                              <Eye className="w-3 h-3 ml-1" />
                              לא לפרסום
                            </Badge>
                          ) : (
                            <Badge className="bg-green-100 text-green-800 text-xs">
                              <CheckSquare className="w-3 h-3 ml-1" />
                              כן
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                           <div className="flex items-center gap-1">
                             {job.pipedrive_deal_url && (
                              <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                <a href={job.pipedrive_deal_url} target="_blank" rel="noopener noreferrer" title="פתח דיל ב-Pipedrive">
                                  <ExternalLink className="w-4 h-4 text-blue-600" />
                                </a>
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setEditingJob(job);
                                setShowForm(true);
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-purple-600 hover:text-purple-700"
                              onClick={() => handleAddSupplement(job)}
                              title="הוסף תוספת הגדרות (דנה)"
                            >
                              <FilePlus className="w-4 h-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-700"
                              onClick={() => handleDelete(job.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {filteredJobs.length === 0 && !loading && (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">לא נמצאו משרות</p>
        </div>
      )}

      {/* Client Data Completion Dialog */}
      <Dialog open={showClientDialog} onOpenChange={(open) => {
        // Prevent closing the dialog by clicking outside or pressing ESC
        if (!open && dialogResolve) {
          // If dialog is closed by user without action, resolve with null
          dialogResolve(null);
          setDialogResolve(null);
          setShowClientDialog(false);
          setPendingClientData(null);
          setClientCompletionData({});
        }
      }}>
        <DialogContent className="max-w-[95vw] md:max-w-md mx-4" onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-yellow-600" />
              <DialogTitle>השלמת פרטי לקוח</DialogTitle>
            </div>
          </DialogHeader>
          
          {pendingClientData && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                נמצא לקוח חדש: <strong>{pendingClientData.name}</strong>
                <br />
                אנא השלם את הפרטים החסרים או המשך עם ערכי ברירת מחדל.
              </p>
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="client-contact" className="text-sm">איש קשר</Label>
                  <Input
                    id="client-contact"
                    placeholder="שם איש הקשר"
                    value={clientCompletionData.contact_person || ""}
                    onChange={(e) => setClientCompletionData({
                      ...clientCompletionData,
                      contact_person: e.target.value
                    })}
                    className="text-sm mt-1"
                  />
                </div>
                
                <div>
                  <Label htmlFor="client-email" className="text-sm">אימייל</Label>
                  <Input
                    id="client-email"
                    placeholder="office@pandatech.co.il (ברירת מחדל)"
                    value={clientCompletionData.email || ""}
                    onChange={(e) => setClientCompletionData({
                      ...clientCompletionData,
                      email: e.target.value
                    })}
                    className="text-sm mt-1"
                  />
                </div>
                
                <div>
                  <Label htmlFor="client-phone" className="text-sm">טלפון</Label>
                  <Input
                    id="client-phone"
                    placeholder="052-6665248 (ברירת מחדל)"
                    value={clientCompletionData.phone || ""}
                    onChange={(e) => setClientCompletionData({
                      ...clientCompletionData,
                      phone: e.target.value
                    })}
                    className="text-sm mt-1"
                  />
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter className="flex flex-col sm:flex-row gap-3">
            <Button 
              variant="outline" 
              onClick={() => handleClientDataCompletion(true)}
              className="w-full sm:w-auto"
            >
              המשך עם ברירת מחדל
            </Button>
            <Button 
              onClick={() => handleClientDataCompletion(false)}
              className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
            >
              שמור פרטים
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Job Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-[95vw] md:max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
          <DialogHeader>
            <DialogTitle>{editingJob ? "עריכת משרה" : "הוספת משרה חדשה"}</DialogTitle>
          </DialogHeader>
          <JobForm
            job={editingJob}
            clients={clients}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingJob(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, message: "", onConfirm: null })}
        onConfirm={confirmDialog.onConfirm}
        title="מחיקת משרה"
        message={confirmDialog.message}
        confirmText="מחק משרה"
        cancelText="ביטול"
        variant="destructive"
      />



      {/* Dana Chat Dialog */}
      <DanaChatDialog
        isOpen={showDanaDialog}
        onClose={() => setShowDanaDialog(false)}
        onSuccess={loadData}
      />

      {/* Add Supplement Dialog */}
      {showSupplementDialog && selectedJobForSupplement && (
        <AddSupplementDialog
          isOpen={showSupplementDialog}
          onClose={() => {
            setShowSupplementDialog(false);
            setSelectedJobForSupplement(null);
          }}
          job={selectedJobForSupplement}
          onSuccess={loadData}
        />
      )}

      {/* Bulk Update Dialog */}
      <BulkUpdateDialog
        isOpen={showBulkUpdateDialog}
        onClose={() => setShowBulkUpdateDialog(false)}
        selectedJobIds={selectedJobIds}
        onSuccess={() => {
          setSelectedJobIds(new Set());
          loadData();
        }}
      />
    </div>
  );
}

function JobForm({ job, clients, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    requirements: "",
    location: "",
    client_id: "",
    client_name: "",
    factory_department: "", // New field
    contact_person: "",     // New field
    security_clearance: "", // New field
    recruitment_priority: "עדיפות גיוס 5",
    status: "פעילה",
    pipedrive_deal_url: "", // New field
    do_not_publish: false,
    is_generic_job: false,
    deadline: "",
    pipeline: "",
    stage: "",
    ...job
  });

  // New state for client creation
  const [showNewClientDialog, setShowNewClientDialog] = useState(false);
  const [newClientData, setNewClientData] = useState({
    name: "",
    contact_person: "",
    email: "",
    phone: ""
  });
  const [creatingClient, setCreatingClient] = useState(false);
  const [localClients, setLocalClients] = useState(clients);

  // Update local clients when props change
  useEffect(() => {
    setLocalClients(clients);
  }, [clients]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title || !formData.description || !formData.requirements) {
      alert("אנא מלא את כל השדות הנדרשים");
      return;
    }
    onSubmit(formData);
  };

  const handleClientChange = (clientId) => {
    if (clientId === "add_new_client") {
      setNewClientData({ // Reset new client form data
        name: "",
        contact_person: "",
        email: "",
        phone: ""
      });
      setShowNewClientDialog(true);
      return;
    }
    
    const selectedClient = localClients.find(c => c.id === clientId);
    setFormData({
      ...formData,
      client_id: clientId,
      client_name: selectedClient?.name || ""
    });
  };

  const handleCreateNewClient = async (e) => {
    e.preventDefault();
    
    if (!newClientData.name || !newClientData.contact_person || !newClientData.email) {
      alert("אנא מלא את כל השדות הנדרשים ללקוח");
      return;
    }

    setCreatingClient(true);
    try {
      const newClient = await Client.create(newClientData);
      
      // Update local clients list
      const updatedClients = [...localClients, newClient];
      setLocalClients(updatedClients);
      
      // Select the new client in the form
      setFormData({
        ...formData,
        client_id: newClient.id,
        client_name: newClient.name
      });
      
      // Sync the new client to Pipedrive as organization
      try {
        await base44.functions.invoke('syncContactsToPipedrive', {});
        console.log('New client synced to Pipedrive as organization');
      } catch (syncError) {
        console.error('Failed to sync client to Pipedrive:', syncError);
      }
      
      // Reset new client form and close dialog
      setNewClientData({
        name: "",
        contact_person: "",
        email: "",
        phone: ""
      });
      setShowNewClientDialog(false);
      
      alert("הלקוח נוצר בהצלחה ונבחר למשרה!");
      
    } catch (error) {
      console.error("Error creating client:", error);
      alert("שגיאה ביצירת הלקוח");
    }
    setCreatingClient(false);
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label className="text-sm font-medium">כותרת המשרה *</Label>
          <Input
            placeholder="כותרת המשרה"
            value={formData.title}
            onChange={(e) => setFormData({...formData, title: e.target.value})}
            required
            className="text-sm md:text-base mt-1"
          />
        </div>

        <div>
          <Label className="text-sm font-medium">לקוח *</Label>
          <Select value={formData.client_id} onValueChange={handleClientChange}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="בחר לקוח" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="add_new_client" className="font-semibold text-blue-600">
              + הוסף לקוח חדש
            </SelectItem>
            {localClients.map(client => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        </div>

        <div>
          <Label className="text-sm font-medium">מפעל / מחלקה</Label>
          <Input
          placeholder="שם המפעל/מחלקה"
          value={formData.factory_department}
          onChange={(e) => setFormData({...formData, factory_department: e.target.value})}
          className="text-sm md:text-base mt-1"
        />
        </div>

        <div>
          <Label className="text-sm font-medium">איש קשר</Label>
          <Input
          placeholder="שם איש הקשר"
          value={formData.contact_person}
          onChange={(e) => setFormData({...formData, contact_person: e.target.value})}
          className="text-sm md:text-base mt-1"
        />
        </div>

        <div>
          <Label className="text-sm font-medium">סיווג בטחוני</Label>
          <Select value={formData.security_clearance} onValueChange={(value) => setFormData({...formData, security_clearance: value})}>
          <SelectTrigger>
            <SelectValue placeholder="סיווג בטחוני" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="רמה 1">רמה 1</SelectItem>
            <SelectItem value="רמה 2">רמה 2</SelectItem>
            <SelectItem value="רמה 3">רמה 3</SelectItem>
            <SelectItem value="סווג נמוך">סווג נמוך</SelectItem>
            <SelectItem value="ללא סווג">ללא סווג</SelectItem>
          </SelectContent>
        </Select>
        </div>

        <div>
          <Label className="text-sm font-medium">עדיפות גיוס</Label>
          <Select value={formData.recruitment_priority} onValueChange={(value) => setFormData({...formData, recruitment_priority: value})}>
          <SelectTrigger>
            <SelectValue placeholder="עדיפות גיוס" />
          </SelectTrigger>
          <SelectContent className="mt-1">
            <SelectItem value="עדיפות גיוס 1">עדיפות גיוס 1 (גבוהה ביותר)</SelectItem>
            <SelectItem value="עדיפות גיוס 2">עדיפות גיוס 2</SelectItem>
            <SelectItem value="עדיפות גיוס 3">עדיפות גיוס 3 (ברירת מחדל)</SelectItem>
            <SelectItem value="עדיפות גיוס 4">עדיפות גיוס 4</SelectItem>
            <SelectItem value="עדיפות גיוס 5">עדיפות גיוס 5 (נמוכה ביותר)</SelectItem>
          </SelectContent>
        </Select>
        </div>

        <div>
          <Label className="text-sm font-medium">מיקום המשרה</Label>
          <Input
          placeholder="עיר / אזור"
          value={formData.location}
          onChange={(e) => setFormData({...formData, location: e.target.value})}
          className="text-sm md:text-base mt-1"
        />
        </div>

        <div>
          <Label className="text-sm font-medium">קישור לדיל בפייפדרייב</Label>
          <Input
          placeholder="https://..."
          type="url"
          value={formData.pipedrive_deal_url || ''}
          onChange={(e) => setFormData({...formData, pipedrive_deal_url: e.target.value})}
          className="text-sm md:text-base mt-1"
        />
        </div>

        <div>
          <Label className="text-sm font-medium">פייפליין</Label>
          <Input
          placeholder="שם הפייפליין"
          value={formData.pipeline || ''}
          onChange={(e) => setFormData({...formData, pipeline: e.target.value})}
          className="text-sm md:text-base mt-1"
        />
        </div>

        <div>
          <Label className="text-sm font-medium">שלב בפייפליין</Label>
          <Input
          placeholder="שלב נוכחי"
          value={formData.stage || ''}
          onChange={(e) => setFormData({...formData, stage: e.target.value})}
          className="text-sm md:text-base mt-1"
        />
        </div>

        <div>
          <Label htmlFor="deadline" className="text-sm">מועד אחרון לסיום הגיוס</Label>
          <Input
            id="deadline"
            type="date"
            value={formData.deadline || ''}
            onChange={(e) => setFormData({...formData, deadline: e.target.value})}
            className="text-sm md:text-base mt-1"
          />
        </div>

        <div>
          <Label className="text-sm font-medium">תיאור המשרה *</Label>
          <Textarea
          placeholder="תיאור המשרה"
          value={formData.description}
          onChange={(e) => setFormData({...formData, description: e.target.value})}
          rows={3}
          required
          className="text-sm md:text-base mt-1"
        />
        </div>

        <div>
          <Label className="text-sm font-medium">דרישות המשרה *</Label>
          <Textarea
          placeholder="דרישות המשרה"
          value={formData.requirements}
          onChange={(e) => setFormData({...formData, requirements: e.target.value})}
          rows={3}
          required
          className="text-sm md:text-base mt-1"
        />
        </div>

        <div>
          <Label className="text-sm font-medium">סטטוס המשרה</Label>
          <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
          <SelectTrigger>
            <SelectValue placeholder="סטטוס המשרה" />
          </SelectTrigger>
          <SelectContent className="mt-1">
            <SelectItem value="פעילה">פעילה</SelectItem>
            <SelectItem value="סגורה">סגורה</SelectItem>
            <SelectItem value="מושהית">מושהית</SelectItem>
          </SelectContent>
        </Select>
        </div>

        <div className="flex items-center space-x-2 space-x-reverse p-4 bg-red-50 rounded-lg border border-red-200">
          <Checkbox
            id="do_not_publish"
            checked={formData.do_not_publish || false}
            onCheckedChange={(checked) => setFormData({...formData, do_not_publish: checked})}
          />
          <Label htmlFor="do_not_publish" className="text-sm font-medium cursor-pointer flex items-center gap-2">
            <Eye className="w-4 h-4 text-red-600" />
            לא לפרסום (המשרה לא תופיע בהפצות ודוחות)
          </Label>
        </div>

        <div className="flex items-center space-x-2 space-x-reverse p-4 bg-blue-50 rounded-lg border border-blue-200">
          <Checkbox
            id="is_generic_job"
            checked={formData.is_generic_job || false}
            onCheckedChange={(checked) => setFormData({...formData, is_generic_job: checked})}
          />
          <Label htmlFor="is_generic_job" className="text-sm font-medium cursor-pointer flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-blue-600" />
            משרה גנרית (לא מסונכרנת עם Pipedrive, מופנית לסוכן)
          </Label>
        </div>
        
        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} className="w-full sm:w-auto">
            ביטול
          </Button>
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
            {job ? "עדכן משרה" : "צור משרה"}
          </Button>
        </div>
      </form>

      {/* New Client Creation Dialog */}
      <Dialog open={showNewClientDialog} onOpenChange={setShowNewClientDialog}>
        <DialogContent className="max-w-[95vw] md:max-w-md mx-4">
          <DialogHeader>
            <DialogTitle>הוספת לקוח חדש</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.stopPropagation();
            handleCreateNewClient(e);
          }} className="space-y-4">
            <Input
              placeholder="שם החברה *"
              value={newClientData.name}
              onChange={(e) => setNewClientData({...newClientData, name: e.target.value})}
              required
              className="text-sm md:text-base"
            />
            <Input
              placeholder="איש קשר *"
              value={newClientData.contact_person}
              onChange={(e) => setNewClientData({...newClientData, contact_person: e.target.value})}
              required
              className="text-sm md:text-base"
            />
            <Input
              placeholder="אימייל *"
              type="email"
              value={newClientData.email}
              onChange={(e) => setNewClientData({...newClientData, email: e.target.value})}
              required
              className="text-sm md:text-base"
            />
            <Input
              placeholder="טלפון"
              value={newClientData.phone}
              onChange={(e) => setNewClientData({...newClientData, phone: e.target.value})}
              className="text-sm md:text-base"
            />
            <DialogFooter className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowNewClientDialog(false)}
                className="w-full sm:w-auto"
              >
                ביטול
              </Button>
              <Button 
                type="submit" 
                disabled={creatingClient}
                className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
              >
                {creatingClient ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    יוצר לקוח...
                  </>
                ) : (
                  "צור לקוח"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}