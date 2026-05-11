
import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Candidate } from "@/entities/Candidate";
import { User } from "@/entities/User";
import { sendJobToEmployees } from "@/functions/sendJobToEmployees";
import { Mail, MessageSquare, Loader2, Users, CheckCircle, AlertCircle, User as UserIcon } from 'lucide-react';

export default function SendJobToEmployeesDialog({ 
    isOpen, 
    onClose, 
    job 
}) {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [selectedEmployees, setSelectedEmployees] = useState([]);
    const [deliveryMethod, setDeliveryMethod] = useState('whatsapp');
    const [templateType, setTemplateType] = useState(1);
    const [customMessage, setCustomMessage] = useState('');
    const [useCustomTemplate, setUseCustomTemplate] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [sendResults, setSendResults] = useState(null);
    const [activeTab, setActiveTab] = useState('recipients'); // NEW: Track active tab

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [employeesList, user] = await Promise.all([
                Candidate.filter({ status: "עובד חברה" }),
                User.me()
            ]);
            
            setEmployees(employeesList.filter(cand => cand.can_receive_job_notifications !== false));
            setCurrentUser(user);
            
            // Load default template
            const templateKey = `employee_job_${deliveryMethod}_template_${templateType}`;
            setCustomMessage(user[templateKey] || '');
            
        } catch (error) {
            console.error('Error loading data:', error);
        }
        setLoading(false);
    }, [deliveryMethod, templateType]);

    useEffect(() => {
        if (isOpen) {
            loadData();
            // Reset tab to recipients when dialog opens
            setActiveTab('recipients');
        }
    }, [isOpen, loadData]);

    useEffect(() => {
        if (currentUser && deliveryMethod && templateType) {
            const templateKey = `employee_job_${deliveryMethod}_template_${templateType}`;
            setCustomMessage(currentUser[templateKey] || '');
        }
    }, [currentUser, deliveryMethod, templateType]);

    const handleEmployeeSelection = (employeeId) => {
        setSelectedEmployees(prev => {
            if (employeeId === 'all') {
                return prev.includes('all') ? [] : ['all'];
            } else {
                const newSelection = prev.filter(id => id !== 'all');
                if (newSelection.includes(employeeId)) {
                    return newSelection.filter(id => id !== employeeId);
                } else {
                    return [...newSelection, employeeId];
                }
            }
        });
    };

    const handleSend = async () => {
        if (selectedEmployees.length === 0) {
            alert('אנא בחר לפחות עובד אחד');
            return;
        }

        setSending(true);
        setSendResults(null);

        try {
            const response = await sendJobToEmployees({
                jobId: job.id,
                employeeIds: selectedEmployees,
                deliveryMethod: deliveryMethod,
                messageTemplate: useCustomTemplate ? customMessage : null,
                templateType: templateType
            });

            if (response.data && response.data.success) {
                setSendResults(response.data);
            } else {
                throw new Error(response.data?.error || 'שגיאה בשליחה');
            }

        } catch (error) {
            console.error('Error sending job:', error);
            setSendResults({
                success: false,
                error: error.message || 'שגיאה בשליחה'
            });
        }

        setSending(false);
    };

    const getPreviewMessage = () => {
        if (!customMessage || !currentUser) return '';
        
        return customMessage
            .replace(/{employee_name}/g, 'שם העובד')
            .replace(/{job_title}/g, job.title)
            .replace(/{client_name}/g, job.client_name || 'לא צוין')
            .replace(/{job_location}/g, job.location || 'לא צוין')
            .replace(/{security_clearance}/g, job.security_clearance || 'לא צוין')
            .replace(/{job_description}/g, job.description || 'אין תיאור זמין')
            .replace(/{job_requirements}/g, job.requirements || 'אין דרישות זמינות');
    };

    if (loading) {
        return (
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="max-w-2xl">
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin" />
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if(!open) { setSendResults(null); onClose(); } }}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-600" />
                        שליחת משרה לעובדי החברה
                    </DialogTitle>
                    <p className="text-sm text-gray-600">
                        משרה: {job.title} - {job.client_name}
                    </p>
                </DialogHeader>

                {sendResults ? (
                    <div className="space-y-4">
                        <Alert className={sendResults.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                            <div className="flex items-center gap-2">
                                {sendResults.success ? 
                                    <CheckCircle className="w-4 h-4 text-green-600" /> :
                                    <AlertCircle className="w-4 h-4 text-red-600" />
                                }
                                <AlertDescription className={sendResults.success ? 'text-green-700' : 'text-red-700'}>
                                    {sendResults.success ? 
                                        `נשלח בהצלחה ל-${sendResults.successCount} מתוך ${sendResults.totalEmployees} עובדים` :
                                        sendResults.error
                                    }
                                </AlertDescription>
                            </div>
                        </Alert>

                        {sendResults.success && sendResults.results && (
                            <div className="space-y-2">
                                <h4 className="font-semibold">תוצאות שליחה:</h4>
                                <div className="max-h-40 overflow-y-auto space-y-1">
                                    {sendResults.results.map((result, index) => (
                                        <div key={index} className="flex items-center justify-between text-sm p-2 rounded border">
                                            <span className="flex items-center gap-2">
                                                <UserIcon className="w-4 h-4" />
                                                {result.employee}
                                            </span>
                                            <Badge className={result.status === 'success' ? 
                                                'bg-green-100 text-green-800' : 
                                                'bg-red-100 text-red-800'
                                            }>
                                                {result.status === 'success' ? '✅ נשלח' : '❌ נכשל'}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <DialogFooter>
                            <Button onClick={() => { setSendResults(null); onClose(); }} variant="outline">
                                סגור
                            </Button>
                        </DialogFooter>
                    </div>
                ) : (
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="recipients">בחירת נמענים</TabsTrigger>
                            <TabsTrigger value="delivery">אמצעי שליחה</TabsTrigger>
                            <TabsTrigger value="message">תוכן ההודעה</TabsTrigger>
                        </TabsList>

                        <TabsContent value="recipients" className="space-y-4 mt-6">
                            <div>
                                <Label>בחר עובדים לשליחה:</Label>
                                <div className="space-y-2 mt-2 max-h-60 overflow-y-auto">
                                    <div className="flex items-center space-x-2 space-x-reverse p-2 rounded border bg-blue-50">
                                        <input
                                            type="checkbox"
                                            id="select-all"
                                            checked={selectedEmployees.includes('all')}
                                            onChange={() => handleEmployeeSelection('all')}
                                            className="rounded"
                                        />
                                        <Label htmlFor="select-all" className="font-semibold text-blue-800">
                                            כל העובדים ({employees.length})
                                        </Label>
                                    </div>
                                    
                                    {employees.map((employee) => (
                                        <div key={employee.id} className="flex items-center space-x-2 space-x-reverse p-2 rounded border">
                                            <input
                                                type="checkbox"
                                                id={employee.id}
                                                checked={selectedEmployees.includes(employee.id)}
                                                onChange={() => handleEmployeeSelection(employee.id)}
                                                className="rounded"
                                                disabled={selectedEmployees.includes('all')}
                                            />
                                            <Label htmlFor={employee.id} className="flex-1">
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{employee.first_name} {employee.last_name}</span>
                                                    <span className="text-sm text-gray-500">
                                                        {employee.position || "תפקיד לא הוגדר"} • {employee.department || "מחלקה לא הוגדרה"}
                                                    </span>
                                                </div>
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="delivery" className="space-y-4 mt-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>אמצעי שליחה:</Label>
                                    <div className="flex gap-2 mt-2">
                                        <Button
                                            variant={deliveryMethod === 'whatsapp' ? 'default' : 'outline'}
                                            onClick={() => setDeliveryMethod('whatsapp')}
                                            className="flex-1"
                                        >
                                            <MessageSquare className="w-4 h-4 mr-2" />
                                            WhatsApp
                                        </Button>
                                        <Button
                                            variant={deliveryMethod === 'email' ? 'default' : 'outline'}
                                            onClick={() => setDeliveryMethod('email')}
                                            className="flex-1"
                                        >
                                            <Mail className="w-4 h-4 mr-2" />
                                            מייל
                                        </Button>
                                    </div>
                                </div>

                                <div>
                                    <Label>סוג תבנית:</Label>
                                    <Select value={templateType.toString()} onValueChange={(val) => setTemplateType(parseInt(val))}>
                                        <SelectTrigger className="mt-2">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="1">תבנית 1 - פורמלית</SelectItem>
                                            <SelectItem value="2">תבנית 2 - ידידותית</SelectItem>
                                            <SelectItem value="3">תבנית 3 - יצירתית</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="message" className="space-y-4 mt-6">
                            <div className="flex items-center space-x-2 space-x-reverse">
                                <input
                                    type="checkbox"
                                    id="use-custom"
                                    checked={useCustomTemplate}
                                    onChange={(e) => setUseCustomTemplate(e.target.checked)}
                                    className="rounded"
                                />
                                <Label htmlFor="use-custom">עריכת תוכן ההודעה</Label>
                            </div>

                            {useCustomTemplate ? (
                                <div>
                                    <Label>תוכן ההודעה המותאמת:</Label>
                                    <Textarea
                                        value={customMessage}
                                        onChange={(e) => setCustomMessage(e.target.value)}
                                        rows={8}
                                        className="mt-2 font-mono text-sm"
                                        placeholder="הקלד את תוכן ההודעה כאן..."
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        💡 משתנים זמינים: {'{employee_name}'}, {'{job_title}'}, {'{client_name}'}, {'{job_location}'}, {'{security_clearance}'}, {'{job_description}'}, {'{job_requirements}'}
                                    </p>
                                </div>
                            ) : (
                                <div>
                                    <Label>תצוגה מקדימה של ההודעה:</Label>
                                    <div className="mt-2 p-4 bg-gray-50 rounded-lg border max-h-60 overflow-y-auto">
                                        <pre className="whitespace-pre-wrap text-sm text-gray-700">
                                            {getPreviewMessage()}
                                        </pre>
                                    </div>
                                </div>
                            )}
                        </TabsContent>

                        <DialogFooter className="mt-6">
                            <Button onClick={onClose} variant="outline">
                                ביטול
                            </Button>
                            <Button 
                                onClick={handleSend} 
                                disabled={sending || selectedEmployees.length === 0}
                                className="bg-green-600 hover:bg-green-700"
                            >
                                {sending ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        שולח...
                                    </>
                                ) : (
                                    <>
                                        {deliveryMethod === 'whatsapp' ? 
                                            <MessageSquare className="w-4 h-4 mr-2" /> :
                                            <Mail className="w-4 h-4 mr-2" />
                                        }
                                        שלח ל-{selectedEmployees.includes('all') ? employees.length : selectedEmployees.length} עובדים
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </Tabs>
                )}
            </DialogContent>
        </Dialog>
    );
}
