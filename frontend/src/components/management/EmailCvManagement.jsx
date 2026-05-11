import React, { useState, useEffect } from 'react';
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Mail,
    CheckCircle2,
    Loader2,
    Play,
    Square,
    FileText,
    List,
    Calendar,
    Check,
    X,
    RefreshCw,
    Users,
    Clock,
    Code,
    Wrench,
    Search,
    Timer,
    TimerOff,
    LayoutGrid,
    TableIcon,
    User,
    Briefcase,
    Shield
} from 'lucide-react';
import { emailCvScanner } from '@/functions/emailCvScanner';
import { stopEmailScanner } from '@/functions/stopEmailScanner';
import { emailCvScannerReverse } from '@/functions/emailCvScannerReverse';
import { stopReverseScan } from '@/functions/stopReverseScan';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { base44 } from "@/api/base44Client";

export default function EmailCvManagement() {
    const [loading, setLoading] = useState(true);
    const [runLoading, setRunLoading] = useState(false);
    const [stopLoading, setStopLoading] = useState(false);
    const [scanStatus, setScanStatus] = useState(null);
    const [runLogs, setRunLogs] = useState([]);
    const [fileLogs, setFileLogs] = useState([]);
    const [logsLoading, setLogsLoading] = useState(true);
    const [fileLogsLoading, setFileLogsLoading] = useState(true);
    const [selectedLog, setSelectedLog] = useState(null);
    const [showLogDetailsDialog, setShowLogDetailsDialog] = useState(false);
    const [errorFiles, setErrorFiles] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [skillFilter, setSkillFilter] = useState('');
    const [autoScanEnabled, setAutoScanEnabled] = useState(false);
    const [autoScanInterval, setAutoScanInterval] = useState(null);
    const [autoScanMinutes, setAutoScanMinutes] = useState(5); // ברירת מחדל 5 דקות
    const [viewMode, setViewMode] = useState('table'); // 'table' or 'cards'
    const [reverseRunLoading, setReverseRunLoading] = useState(false);
    const [reverseStopLoading, setReverseStopLoading] = useState(false);
    const [editingClearanceId, setEditingClearanceId] = useState(null);

    const handleUpdateSecurityClearance = async (file, newValue) => {
        try {
            // Update ScannedFileLog
            await base44.entities.ScannedFileLog.update(file.id, { security_clearance: newValue });
            
            // Also update Candidate if exists
            if (file.candidate_id) {
                await base44.entities.Candidate.update(file.candidate_id, { security_clearance: newValue });
            }
            
            // Update local state
            setFileLogs(prev => prev.map(f => f.id === file.id ? { ...f, security_clearance: newValue } : f));
            setEditingClearanceId(null);
            toast.success(`סיווג עודכן: ${newValue}`);
        } catch (error) {
            console.error('Error updating clearance:', error);
            toast.error('שגיאה בעדכון הסיווג');
        }
    };

    useEffect(() => {
        loadData();
        // רענון כל 30 שניות - רענון מהיר יוצר rate limit
        const interval = setInterval(() => {
            loadData();
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    // Auto scan at configurable interval
    useEffect(() => {
        if (autoScanEnabled) {
            const runAutoScan = async () => {
                // Re-check current status before running
                try {
                    const statusList = await base44.entities.MailScanStatus.list();
                    const currentStatus = statusList?.[0];
                    if (currentStatus?.is_running) {
                        console.log('Auto-scan skipped - already running');
                        return;
                    }
                    console.log(`Auto-scan triggered (interval: ${autoScanMinutes} minutes)`);
                    emailCvScanner().catch(err => console.log('Auto-scan error (ignored):', err?.message || err));
                } catch (err) {
                    console.log('Auto-scan check error (ignored):', err?.message || err);
                }
            };
            
            // Run after a short delay to let the page load
            const initialTimeout = setTimeout(runAutoScan, 3000);
            
            // Then at the configured interval
            const intervalMs = autoScanMinutes * 60 * 1000;
            const interval = setInterval(runAutoScan, intervalMs);
            setAutoScanInterval(interval);
            
            return () => {
                clearTimeout(initialTimeout);
                clearInterval(interval);
                setAutoScanInterval(null);
            };
        } else {
            if (autoScanInterval) {
                clearInterval(autoScanInterval);
                setAutoScanInterval(null);
            }
        }
    }, [autoScanEnabled, autoScanMinutes]);

    const loadData = async (retryCount = 0) => {
        const maxRetries = 3;
        try {
            // טעינת סטטוס
            const statusList = await base44.entities.MailScanStatus.list();
            if (statusList?.length > 0) {
                setScanStatus(statusList[0]);
            }

            // טעינת לוגי ריצות
            const logs = await base44.entities.EmailScanLog.list('-created_date', 20);
            setRunLogs(logs);
            setLogsLoading(false);

            // טעינת לוגי קבצים - עם יותר רשומות ומיון לפי תאריך יצירה
            const files = await base44.entities.ScannedFileLog.list('-created_date', 500);
            console.log(`Loaded ${files.length} file logs`);
            setFileLogs(files);
            setFileLogsLoading(false);

        } catch (error) {
            console.error('Error loading data:', error?.message || error);
            
            // Retry on network errors
            if (retryCount < maxRetries && (error?.message?.includes('Network') || error?.message?.includes('timeout'))) {
                console.log(`Retrying load data (attempt ${retryCount + 1}/${maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
                return loadData(retryCount + 1);
            }
        }
        setLoading(false);
    };

    const runContinuousScan = async () => {
        try {
            console.log('Starting scan batch...');
            const response = await emailCvScanner();
            await loadData();

            // If there are more emails, continue automatically
            if (response?.data?.hasMoreEmails) {
                console.log('More emails available - continuing scan...');
                toast.info('ממשיך לסרוק מיילים נוספים...', { duration: 2000 });

                // Short delay then continue
                setTimeout(() => {
                    runContinuousScan();
                }, 1000);
            } else {
                console.log('No more emails to process');
                toast.success('סריקה הושלמה - אין מיילים נוספים');
                setRunLoading(false);
            }
        } catch (error) {
            console.log('Scan batch completed or error:', error?.message || error);
            
            // Check for forwarding error which usually means timeout but operation completed
            const isForwardingError = error?.message?.includes('Error forwarding request') || 
                                       error?.response?.data?.includes?.('Error forwarding request');
            
            await loadData();
            
            if (isForwardingError) {
                // This is usually a timeout but the scan might have completed
                console.log('Forwarding error detected - waiting before checking status...');
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
            
            // Check if we should continue (scan completed successfully but threw network timeout)
            try {
                const statusList = await base44.entities.MailScanStatus.list();
                const currentStatus = statusList?.[0];
                
                // If scan is not running (completed), try to continue with more emails
                if (currentStatus && !currentStatus.is_running) {
                    console.log('Scan finished, checking for more emails...');
                    setTimeout(() => {
                        runContinuousScan();
                    }, 2000);
                } else {
                    // Scan is still running or there was an actual error
                    setRunLoading(false);
                }
            } catch (statusError) {
                console.log('Error checking status:', statusError?.message);
                setRunLoading(false);
            }
        }
    };

    const handleRunScan = async () => {
        setRunLoading(true);
        try {
            toast.info('מתחיל סריקת מיילים רציפה...', { duration: 3000 });
            runContinuousScan();
        } catch (error) {
            console.error('Error:', error);
            toast.error('שגיאה', { description: error.message });
            setRunLoading(false);
        }
    };

    const handleStopScan = async () => {
        setStopLoading(true);
        try {
            const response = await stopEmailScanner();
            if (response.data.success) {
                toast.success('הסריקה נעצרה');
            }
            await loadData();
        } catch (error) {
            toast.error('שגיאה בעצירה', { description: error.message });
        }
        setStopLoading(false);
    };

    const runContinuousReverseScan = async (onComplete) => {
        try {
            console.log('Starting reverse scan batch...');
            const response = await emailCvScannerReverse();
            console.log('Reverse scan response:', response?.data);
            await loadData();

            // Continue if there are more emails OR if we processed some in this batch
            if (response?.data?.hasMoreEmails || 
                (response?.data?.stats?.emailsScanned > 0 && !response?.data?.foundExistingEmail)) {
                console.log('More emails available - continuing reverse scan...');
                toast.info('ממשיך לסרוק מיילים נוספים...', { duration: 2000 });
                setTimeout(() => {
                    runContinuousReverseScan(onComplete);
                }, 1000);
            } else {
                console.log('Reverse scan completed');
                toast.success('סריקה הפוכה הושלמה');
                setReverseRunLoading(false);
                if (onComplete) onComplete();
            }
        } catch (error) {
            console.log('Reverse scan error:', error?.message || error);
            
            // Check for forwarding error which usually means timeout but operation completed
            const isForwardingError = error?.message?.includes('Error forwarding request') || 
                                       error?.response?.data?.includes?.('Error forwarding request');
            
            await loadData();
            
            if (isForwardingError) {
                // This is usually a timeout but the scan might have completed
                console.log('Forwarding error detected - waiting before checking status...');
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
            
            // Check if we should continue (scan completed successfully but threw network timeout)
            try {
                const statusList = await base44.entities.MailScanStatus.list();
                const currentStatus = statusList?.[0];
                
                // If reverse scan is not running (completed), try to continue with more emails
                if (currentStatus && !currentStatus.is_reverse_running) {
                    console.log('Reverse scan finished, checking for more emails...');
                    setTimeout(() => {
                        runContinuousReverseScan(onComplete);
                    }, 2000);
                } else {
                    // Scan is still running or there was an actual error
                    setReverseRunLoading(false);
                    if (onComplete) onComplete();
                }
            } catch (statusError) {
                console.log('Error checking status:', statusError?.message);
                setReverseRunLoading(false);
                if (onComplete) onComplete();
            }
        }
    };

    const handleRunReverseScan = async () => {
        setReverseRunLoading(true);
        try {
            toast.info('מתחיל סריקה הפוכה (מהחדש לישן)...', { duration: 3000 });
            runContinuousReverseScan();
        } catch (error) {
            console.error('Error:', error);
            toast.error('שגיאה', { description: error.message });
            setReverseRunLoading(false);
        }
    };

    const handleStopReverseScan = async () => {
        setReverseStopLoading(true);
        try {
            const response = await stopReverseScan();
            if (response.data.success) {
                toast.success('הסריקה ההפוכה נעצרה');
            }
            await loadData();
        } catch (error) {
            toast.error('שגיאה בעצירה', { description: error.message });
        }
        setReverseStopLoading(false);
    };



    const handleViewLogDetails = (log) => {
        setSelectedLog(log);
        if (log.error_details) {
            try {
                setErrorFiles(JSON.parse(log.error_details));
            } catch {
                setErrorFiles([]);
            }
        } else {
            setErrorFiles([]);
        }
        setShowLogDetailsDialog(true);
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString('he-IL');
    };

    // סינון קבצים
    const filteredFiles = fileLogs.filter(file => {
        const matchesSearch = !searchTerm || 
            file.file_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            file.candidate_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            file.email_subject?.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesStatus = statusFilter === 'all' || file.processing_status === statusFilter;
        
        const matchesSkill = !skillFilter || 
            file.detected_skills?.some(s => s.toLowerCase().includes(skillFilter.toLowerCase())) ||
            file.detected_languages?.some(l => l.toLowerCase().includes(skillFilter.toLowerCase())) ||
            file.detected_tools?.some(t => t.toLowerCase().includes(skillFilter.toLowerCase()));

        return matchesSearch && matchesStatus && matchesSkill;
    });

    // חילוץ כל הכישורים הייחודיים
    const allSkills = [...new Set(fileLogs.flatMap(f => [
        ...(f.detected_skills || []),
        ...(f.detected_languages || []),
        ...(f.detected_tools || [])
    ]))].sort();

    if (loading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* כרטיס ראשי */}
            <Card className="border-2">
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Mail className="w-8 h-8 text-blue-600" />
                            <div>
                                <h2 className="text-2xl font-bold">קליטת קורות חיים ממייל</h2>
                                <p className="text-gray-600 text-sm">jobs@pandatech.co.il</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Badge className={`text-lg px-4 py-2 ${
                                scanStatus?.is_running
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-green-100 text-green-800'
                            }`}>
                                {scanStatus?.is_running ? (
                                    <><Loader2 className="w-5 h-5 ml-2 animate-spin" />סורק...</>
                                ) : (
                                    <><CheckCircle2 className="w-5 h-5 ml-2" />רגיל</>
                                )}
                            </Badge>
                            <Badge className={`text-lg px-4 py-2 ${
                                scanStatus?.is_reverse_running
                                    ? 'bg-purple-100 text-purple-800'
                                    : 'bg-gray-100 text-gray-600'
                            }`}>
                                {scanStatus?.is_reverse_running ? (
                                    <><Loader2 className="w-5 h-5 ml-2 animate-spin" />הפוך...</>
                                ) : (
                                    <>הפוך</>
                                )}
                            </Badge>
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-3 mb-6">
                        <Button
                            onClick={handleRunScan}
                            disabled={runLoading || scanStatus?.is_running}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            {runLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin ml-2" />
                            ) : (
                                <Play className="w-4 h-4 ml-2" />
                            )}
                            סריקה רגילה
                        </Button>
                        
                        {scanStatus?.is_running && (
                            <Button
                                onClick={handleStopScan}
                                disabled={stopLoading}
                                variant="destructive"
                            >
                                {stopLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin ml-2" />
                                ) : (
                                    <Square className="w-4 h-4 ml-2" />
                                )}
                                עצור רגילה
                            </Button>
                        )}

                        <Button
                            onClick={handleRunReverseScan}
                            disabled={reverseRunLoading || scanStatus?.is_reverse_running}
                            className="bg-purple-600 hover:bg-purple-700"
                        >
                            {reverseRunLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin ml-2" />
                            ) : (
                                <Play className="w-4 h-4 ml-2" />
                            )}
                            סריקה הפוכה (10 שנים)
                        </Button>
                        
                        {scanStatus?.is_reverse_running && (
                            <Button
                                onClick={handleStopReverseScan}
                                disabled={reverseStopLoading}
                                variant="destructive"
                            >
                                {reverseStopLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin ml-2" />
                                ) : (
                                    <Square className="w-4 h-4 ml-2" />
                                )}
                                עצור הפוכה
                            </Button>
                        )}

                        <Button onClick={loadData} variant="outline">
                            <RefreshCw className="w-4 h-4 ml-2" />
                            רענן
                        </Button>

                        <div className="flex items-center gap-2">
                            <Select 
                                value={autoScanMinutes.toString()} 
                                onValueChange={(val) => setAutoScanMinutes(parseInt(val))}
                                disabled={autoScanEnabled}
                            >
                                <SelectTrigger className="w-[100px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">1 דקה</SelectItem>
                                    <SelectItem value="2">2 דקות</SelectItem>
                                    <SelectItem value="5">5 דקות</SelectItem>
                                    <SelectItem value="10">10 דקות</SelectItem>
                                    <SelectItem value="15">15 דקות</SelectItem>
                                    <SelectItem value="30">30 דקות</SelectItem>
                                    <SelectItem value="60">60 דקות</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button
                                onClick={() => setAutoScanEnabled(!autoScanEnabled)}
                                variant={autoScanEnabled ? "default" : "outline"}
                                className={autoScanEnabled ? "bg-blue-600 hover:bg-blue-700" : ""}
                            >
                                {autoScanEnabled ? (
                                    <>
                                        <TimerOff className="w-4 h-4 ml-2" />
                                        עצור אוטומטי
                                    </>
                                ) : (
                                    <>
                                        <Timer className="w-4 h-4 ml-2" />
                                        הפעל אוטומטי
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>

                    {autoScanEnabled && (
                        <Alert className="bg-blue-50 border-blue-200">
                            <Timer className="w-4 h-4 text-blue-600" />
                            <AlertDescription className="text-blue-700">
                                סריקה אוטומטית פעילה - רצה כל {autoScanMinutes} דקות. השאר את הדף פתוח.
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>



            {/* לוג קבצים מפורט */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FileText className="w-6 h-6 text-indigo-600" />
                            לוג קבצים מפורט
                        </div>
                        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                            <Button
                                variant={viewMode === 'table' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setViewMode('table')}
                                className={viewMode === 'table' ? 'bg-white shadow-sm' : ''}
                            >
                                <TableIcon className="w-4 h-4 ml-1" />
                                טבלה
                            </Button>
                            <Button
                                variant={viewMode === 'cards' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setViewMode('cards')}
                                className={viewMode === 'cards' ? 'bg-white shadow-sm' : ''}
                            >
                                <LayoutGrid className="w-4 h-4 ml-1" />
                                כרטיסיות
                            </Button>
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {/* פילטרים */}
                    <div className="flex flex-wrap gap-3 mb-4">
                        <div className="flex-1 min-w-[200px]">
                            <div className="relative">
                                <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
                                <Input
                                    placeholder="חיפוש לפי שם קובץ, מועמד או נושא..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pr-10"
                                />
                            </div>
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="סטטוס" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">הכל</SelectItem>
                                <SelectItem value="success">הצלחה</SelectItem>
                                <SelectItem value="failed">נכשל</SelectItem>
                                <SelectItem value="skipped">דולג</SelectItem>
                                <SelectItem value="processing">בעיבוד</SelectItem>
                                <SelectItem value="permanently_failed">נכשל לצמיתות</SelectItem>
                            </SelectContent>
                        </Select>
                        <div className="min-w-[200px]">
                            <Input
                                placeholder="סנן לפי טכנולוגיה..."
                                value={skillFilter}
                                onChange={(e) => setSkillFilter(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="text-sm text-gray-500 mb-2">
                        מציג {filteredFiles.length} מתוך {fileLogs.length} קבצים
                    </div>

                    {viewMode === 'cards' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto">
                            {fileLogsLoading ? (
                                <div className="col-span-full flex justify-center py-8">
                                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                                </div>
                            ) : filteredFiles.length > 0 ? (
                                filteredFiles.map((file) => (
                                    <div 
                                        key={file.id} 
                                        className={`border rounded-lg p-4 transition-all hover:shadow-md ${
                                            file.security_clearance === 'רמה 1' 
                                                ? 'border-red-400 bg-red-50'
                                                : file.processing_status === 'failed'
                                                ? 'border-red-200 bg-red-50'
                                                : file.processing_status === 'success'
                                                ? 'border-green-200 bg-green-50'
                                                : 'border-yellow-200 bg-yellow-50'
                                        }`}
                                    >
                                        {/* Header with status */}
                                        <div className="flex items-start justify-between mb-3">
                                            <Badge className={
                                                file.processing_status === 'success' 
                                                    ? 'bg-green-100 text-green-800'
                                                    : file.processing_status === 'failed'
                                                    ? 'bg-red-100 text-red-800'
                                                    : 'bg-yellow-100 text-yellow-800'
                                            }>
                                                {file.processing_status === 'success' ? (
                                                    <Check className="w-3 h-3 ml-1" />
                                                ) : file.processing_status === 'failed' ? (
                                                    <X className="w-3 h-3 ml-1" />
                                                ) : (
                                                    <Loader2 className="w-3 h-3 ml-1 animate-spin" />
                                                )}
                                                {file.processing_status}
                                            </Badge>
                                            {file.security_clearance && file.security_clearance !== 'לא רלוונטי' && (
                                                <Badge className={
                                                    file.security_clearance === 'רמה 1' 
                                                        ? 'bg-red-600 text-white font-bold'
                                                        : file.security_clearance === 'רמה 2'
                                                        ? 'bg-orange-500 text-white'
                                                        : file.security_clearance === 'רמה 3'
                                                        ? 'bg-yellow-500 text-black'
                                                        : 'bg-gray-100 text-gray-700'
                                                }>
                                                    <Shield className="w-3 h-3 ml-1" />
                                                    {file.security_clearance}
                                                </Badge>
                                            )}
                                        </div>

                                        {/* Candidate name */}
                                        <div className="flex items-center gap-2 mb-2">
                                            <User className="w-4 h-4 text-gray-500" />
                                            <span className="font-semibold text-gray-900">
                                                {file.candidate_name || 'לא זוהה'}
                                            </span>
                                        </div>

                                        {/* File name */}
                                        <div className="flex items-center gap-2 mb-2">
                                            <FileText className="w-4 h-4 text-gray-400" />
                                            <span className="text-sm text-gray-600 truncate" title={file.file_name}>
                                                {file.file_name}
                                            </span>
                                        </div>

                                        {/* Date */}
                                        <div className="flex items-center gap-2 mb-3">
                                            <Calendar className="w-4 h-4 text-gray-400" />
                                            <span className="text-xs text-gray-500">
                                                {formatDate(file.email_date)}
                                            </span>
                                        </div>

                                        {/* Skills */}
                                        {(file.detected_skills?.length > 0 || file.detected_languages?.length > 0 || file.detected_tools?.length > 0) && (
                                            <div className="border-t pt-3 mt-2">
                                                <div className="flex flex-wrap gap-1">
                                                    {(file.detected_languages || []).slice(0, 3).map((lang, i) => (
                                                        <Badge key={`lang-${i}`} variant="outline" className="text-xs bg-purple-50">
                                                            <Code className="w-3 h-3 ml-1" />
                                                            {lang}
                                                        </Badge>
                                                    ))}
                                                    {(file.detected_tools || []).slice(0, 2).map((tool, i) => (
                                                        <Badge key={`tool-${i}`} variant="outline" className="text-xs bg-orange-50">
                                                            <Wrench className="w-3 h-3 ml-1" />
                                                            {tool}
                                                        </Badge>
                                                    ))}
                                                    {(file.detected_skills || []).slice(0, 2).map((skill, i) => (
                                                        <Badge key={`skill-${i}`} variant="outline" className="text-xs bg-blue-50">
                                                            {skill}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Experience & Processing time */}
                                        <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                                            {file.years_experience && (
                                                <span className="flex items-center gap-1">
                                                    <Briefcase className="w-3 h-3" />
                                                    {file.years_experience} שנים
                                                </span>
                                            )}
                                            {file.processing_time_ms && (
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {(file.processing_time_ms / 1000).toFixed(1)}s
                                                </span>
                                            )}
                                        </div>

                                        {/* Error message */}
                                        {file.error_message && (
                                            <div className="mt-2 p-2 bg-red-100 rounded text-xs text-red-700">
                                                {file.error_message}
                                            </div>
                                        )}
                                        </div>
                                        ))
                            ) : (
                                <div className="col-span-full text-center py-8 text-gray-500">
                                    לא נמצאו קבצים
                                </div>
                            )}
                        </div>
                    ) : (
                    <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                        <Table>
                            <TableHeader className="sticky top-0 bg-white">
                                <TableRow>
                                    <TableHead>תאריך</TableHead>
                                    <TableHead>סוג</TableHead>
                                    <TableHead>קובץ</TableHead>
                                    <TableHead>מועמד</TableHead>
                                    <TableHead>סטטוס</TableHead>
                                    <TableHead>טכנולוגיות</TableHead>
                                    <TableHead>שפות</TableHead>
                                    <TableHead>כלים</TableHead>
                                    <TableHead>ניסיון</TableHead>
                                    <TableHead>סיווג</TableHead>
                                    <TableHead>זמן עיבוד</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {fileLogsLoading ? (
                                    <TableRow>
                                        <TableCell colSpan="11" className="text-center py-8">
                                            <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                                        </TableCell>
                                    </TableRow>
                                ) : filteredFiles.length > 0 ? (
                                    filteredFiles.map((file) => (
                                        <TableRow key={file.id} className={
                                            file.security_clearance === 'רמה 1' 
                                                ? 'bg-red-100 border-r-4 border-red-600'
                                                : file.processing_status === 'failed' 
                                                ? 'bg-red-50' 
                                                : ''
                                        }>
                                            <TableCell className="text-xs whitespace-nowrap">
                                                {formatDate(file.email_date)}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={
                                                    file.scan_type === 'reverse'
                                                        ? 'bg-purple-50 text-purple-700 border-purple-300'
                                                        : 'bg-blue-50 text-blue-700 border-blue-300'
                                                }>
                                                    {file.scan_type === 'reverse' ? 'הפוך' : 'רגיל'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="max-w-[150px] truncate text-sm font-medium">
                                                    {file.file_name}
                                                </div>
                                                <div className="text-xs text-gray-500 truncate max-w-[150px]">
                                                    {file.email_subject}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {file.candidate_name || '-'}
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={
                                                    file.processing_status === 'success' 
                                                        ? 'bg-green-100 text-green-800'
                                                        : file.processing_status === 'failed'
                                                        ? 'bg-red-100 text-red-800'
                                                        : 'bg-yellow-100 text-yellow-800'
                                                }>
                                                    {file.processing_status === 'success' ? (
                                                        <Check className="w-3 h-3 ml-1" />
                                                    ) : file.processing_status === 'failed' ? (
                                                        <X className="w-3 h-3 ml-1" />
                                                    ) : (
                                                        <Loader2 className="w-3 h-3 ml-1 animate-spin" />
                                                    )}
                                                    {file.processing_status}
                                                </Badge>
                                                {file.error_message && (
                                                    <div className="text-xs text-red-600 mt-1 max-w-[120px] truncate" title={file.error_message}>
                                                        {file.error_message}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1 max-w-[150px]">
                                                    {(file.detected_skills || []).slice(0, 3).map((skill, i) => (
                                                        <Badge key={i} variant="outline" className="text-xs bg-blue-50">
                                                            {skill}
                                                        </Badge>
                                                    ))}
                                                    {(file.detected_skills?.length || 0) > 3 && (
                                                        <Badge variant="outline" className="text-xs">
                                                            +{file.detected_skills.length - 3}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1 max-w-[120px]">
                                                    {(file.detected_languages || []).slice(0, 2).map((lang, i) => (
                                                        <Badge key={i} variant="outline" className="text-xs bg-purple-50">
                                                            <Code className="w-3 h-3 ml-1" />
                                                            {lang}
                                                        </Badge>
                                                    ))}
                                                    {(file.detected_languages?.length || 0) > 2 && (
                                                        <Badge variant="outline" className="text-xs">
                                                            +{file.detected_languages.length - 2}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1 max-w-[120px]">
                                                    {(file.detected_tools || []).slice(0, 2).map((tool, i) => (
                                                        <Badge key={i} variant="outline" className="text-xs bg-orange-50">
                                                            <Wrench className="w-3 h-3 ml-1" />
                                                            {tool}
                                                        </Badge>
                                                    ))}
                                                    {(file.detected_tools?.length || 0) > 2 && (
                                                        <Badge variant="outline" className="text-xs">
                                                            +{file.detected_tools.length - 2}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {file.years_experience ? (
                                                    <Badge variant="outline" className="bg-green-50">
                                                        {file.years_experience} שנים
                                                    </Badge>
                                                ) : '-'}
                                            </TableCell>
                                            <TableCell>
                                                {editingClearanceId === file.id ? (
                                                    <Select
                                                        value={file.security_clearance || ''}
                                                        onValueChange={(val) => handleUpdateSecurityClearance(file, val)}
                                                        onOpenChange={(open) => { if (!open) setEditingClearanceId(null); }}
                                                    >
                                                        <SelectTrigger className="w-[130px] h-7 text-xs"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="רמה 1">רמה 1</SelectItem>
                                                            <SelectItem value="רמה 2">רמה 2</SelectItem>
                                                            <SelectItem value="רמה 3">רמה 3</SelectItem>
                                                            <SelectItem value="סודי ביותר">סודי ביותר</SelectItem>
                                                            <SelectItem value="סודי">סודי</SelectItem>
                                                            <SelectItem value="שמור">שמור</SelectItem>
                                                            <SelectItem value="סיווג נמוך">סיווג נמוך</SelectItem>
                                                            <SelectItem value="ללא סיווג">ללא סיווג</SelectItem>
                                                            <SelectItem value="לא רלוונטי">לא רלוונטי</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                ) : (
                                                    <div className="cursor-pointer" title="לחץ לעריכה" onClick={() => setEditingClearanceId(file.id)}>
                                                        {file.security_clearance ? (
                                                            <Badge className={`hover:ring-2 hover:ring-blue-400 ${
                                                                file.security_clearance === 'רמה 1'
                                                                    ? 'bg-red-600 text-white font-bold animate-pulse'
                                                                    : file.security_clearance === 'רמה 2'
                                                                    ? 'bg-orange-500 text-white'
                                                                    : file.security_clearance === 'רמה 3'
                                                                    ? 'bg-yellow-500 text-black'
                                                                    : 'bg-gray-100 text-gray-700'
                                                            }`}>{file.security_clearance}</Badge>
                                                        ) : (
                                                            <span className="text-gray-400 hover:text-blue-500 text-xs">+ הוסף</span>
                                                        )}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                                                              {file.processing_time_ms ? (
                                                                                                  <span className="text-xs text-gray-600">
                                                                                                      {(file.processing_time_ms / 1000).toFixed(1)}s
                                                                                                  </span>
                                                                                              ) : '-'}
                                                                                          </TableCell>
                                                                                      </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan="11" className="text-center py-8 text-gray-500">
                                            לא נמצאו קבצים
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    )}
                </CardContent>
            </Card>

            {/* היסטוריית ריצות */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <List className="w-6 h-6 text-gray-600" />
                        היסטוריית ריצות
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>תאריך</TableHead>
                                    <TableHead>סוג</TableHead>
                                    <TableHead>סטטוס</TableHead>
                                    <TableHead>מיילים</TableHead>
                                    <TableHead>קבצים</TableHead>
                                    <TableHead>נוצרו</TableHead>
                                    <TableHead>עודכנו</TableHead>
                                    <TableHead>שגיאות</TableHead>
                                    <TableHead>פעולות</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {logsLoading ? (
                                    <TableRow>
                                        <TableCell colSpan="9" className="text-center py-8">
                                            <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                                        </TableCell>
                                    </TableRow>
                                ) : runLogs.length > 0 ? (
                                    runLogs.map((log) => (
                                        <TableRow key={log.id}>
                                            <TableCell className="whitespace-nowrap">
                                                <Calendar className="w-4 h-4 inline ml-1" />
                                                {formatDate(log.start_time)}
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={
                                                    log.scan_type === 'reverse'
                                                        ? 'bg-purple-100 text-purple-800'
                                                        : 'bg-blue-100 text-blue-800'
                                                }>
                                                    {log.scan_type === 'reverse' ? 'הפוך' : 'רגיל'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={
                                                    log.status === 'Completed' 
                                                        ? 'bg-green-100 text-green-800' 
                                                        : log.status === 'Running'
                                                        ? 'bg-yellow-100 text-yellow-800'
                                                        : 'bg-red-100 text-red-800'
                                                }>
                                                    {log.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{log.emails_scanned || 0}</TableCell>
                                            <TableCell>{log.attachments_found || 0}</TableCell>
                                            <TableCell className="text-green-600 font-medium">
                                                {log.candidates_created || 0}
                                            </TableCell>
                                            <TableCell className="text-blue-600 font-medium">
                                                {log.candidates_updated || 0}
                                            </TableCell>
                                            <TableCell className={log.errors_count > 0 ? 'text-red-600 font-bold' : ''}>
                                                {log.errors_count || 0}
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleViewLogDetails(log)}
                                                >
                                                    <FileText className="w-4 h-4 ml-1" />
                                                    פרטים
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan="9" className="text-center py-8 text-gray-500">
                                            לא נמצאו ריצות
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* דיאלוג פרטי ריצה */}
            <Dialog open={showLogDetailsDialog} onOpenChange={setShowLogDetailsDialog}>
                <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            פרטי ריצה - {selectedLog && formatDate(selectedLog.start_time)}
                        </DialogTitle>
                    </DialogHeader>

                    {selectedLog && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-blue-50 p-3 rounded-lg text-center">
                                    <div className="text-2xl font-bold text-blue-700">
                                        {selectedLog.emails_scanned || 0}
                                    </div>
                                    <div className="text-sm text-blue-600">מיילים</div>
                                </div>
                                <div className="bg-purple-50 p-3 rounded-lg text-center">
                                    <div className="text-2xl font-bold text-purple-700">
                                        {selectedLog.attachments_found || 0}
                                    </div>
                                    <div className="text-sm text-purple-600">קבצים</div>
                                </div>
                                <div className="bg-green-50 p-3 rounded-lg text-center">
                                    <div className="text-2xl font-bold text-green-700">
                                        {selectedLog.candidates_created || 0}
                                    </div>
                                    <div className="text-sm text-green-600">נוצרו</div>
                                </div>
                                <div className="bg-red-50 p-3 rounded-lg text-center">
                                    <div className="text-2xl font-bold text-red-700">
                                        {selectedLog.errors_count || 0}
                                    </div>
                                    <div className="text-sm text-red-600">שגיאות</div>
                                </div>
                            </div>

                            {selectedLog.summary && (
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <h4 className="font-medium mb-2">סיכום:</h4>
                                    <pre className="text-sm whitespace-pre-wrap">{selectedLog.summary}</pre>
                                </div>
                            )}

                            {errorFiles.length > 0 && (
                                <div>
                                    <h4 className="font-medium mb-2 text-red-600">שגיאות:</h4>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>סוג</TableHead>
                                                <TableHead>פרטים</TableHead>
                                                <TableHead>שגיאה</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {errorFiles.map((err, i) => (
                                                <TableRow key={i}>
                                                    <TableCell>{err.type}</TableCell>
                                                    <TableCell className="text-xs">
                                                        {err.fileName || err.subject}
                                                    </TableCell>
                                                    <TableCell className="text-xs text-red-600">
                                                        {err.error}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        <Button onClick={() => setShowLogDetailsDialog(false)}>סגור</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}