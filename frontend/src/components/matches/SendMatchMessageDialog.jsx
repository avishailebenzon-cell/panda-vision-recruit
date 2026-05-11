import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, MessageSquare, Loader2, Phone, CheckCircle, AlertCircle, Wand2, Eye, ExternalLink, Share2 } from 'lucide-react';
import { Candidate } from '@/entities/Candidate';
import { Client } from '@/entities/Client';
import { ContactPerson } from '@/entities/ContactPerson';
import { Job } from '@/entities/Job';
import { User } from '@/entities/User';
import { sendCandidateToSingleClient } from '@/functions/sendCandidateToSingleClient';
import ClientCvFormatterDialog from '../candidates/ClientCvFormatterDialog';

// שמות משמעותיים לתבניות
const TEMPLATE_NAMES = {
    candidate: {
        email: {
            1: "פורמלי ומקצועי",
            2: "חברותי ואישי", 
            3: "קצר ולעניין"
        },
        whatsapp: {
            1: "חברותי עם אמוג'יס",
            2: "פשוט וישיר",
            3: "נלהב ומעודד"
        }
    },
    client: {
        email: {
            1: "פורמלי ומקצועי",
            2: "חברותי ואישי",
            3: "קצר ולעניין"
        },
        whatsapp: {
            1: "חברותי עם אמוג'יס",
            2: "פשוט וישיר",
            3: "נלהב ומעודד"
        }
    }
};

// תבניות ברירת מחדל למועמדים
const CANDIDATE_TEMPLATES = {
    email: {
        1: `שלום {candidate_name},

אני פונה אליך בנוגע למשרת {job_title} אצל {client_name}.

לאחר בחינת הפרופיל שלך, נראה שיש התאמה טובה לדרישות המשרה.

אשמח לשוחח איתך ולספר לך עוד על ההזדמנות.

בברכה,
{user_name}
צוות פנדה-טק`,

        2: `היי {candidate_name}!

רציתי לעדכן אותך לגבי המשרה ב{client_name}.

יש לנו משרת {job_title} שנראית לי מתאימה בול בשבילך!

מה דעתך? אשמח לדבר!

{user_name}
פנדה-טק`,

        3: `שלום {candidate_name},

עדכון בנוגע למשרת {job_title} ב{client_name}.

נשמח לשמוע ממך.

{user_name}
פנדה-טק`
    },
    whatsapp: {
        1: `היי {candidate_name}! 👋

יש לי משרה מעולה בשבילך! 🌟

📋 משרה: {job_title}
🏢 חברה: {client_name}

מה דעתך? 🤔

{user_name}
פנדה-טק 🐼`,

        2: `שלום {candidate_name},

עדכון לגבי משרת {job_title} ב{client_name}.

אשמח לשמוע ממך.

{user_name}
פנדה-טק`,

        3: `{candidate_name}, יש לי בשורות! 🎉

מצאתי משרה שנראית מושלמת בשבילך!

🌟 {job_title} ב{client_name}

אני ממש מתרגש מההתאמה! 🚀

{user_name}
פנדה-טק 🐼`
    }
};

// תבניות ברירת מחדל ללקוחות
const CLIENT_TEMPLATES = {
    email: {
        1: `לכבוד {client_name},

הנדון: הצגת מועמד - {candidate_name}

אני מתכבד להציג בפניכם מועמד איכותי לתפקיד {job_title}.

קורות החיים המלאים מצורפים למייל זה.

אשמח לתאם שיחת היכרות בהקדם.

בברכה,
{user_name}
צוות פנדה-טק`,

        2: `היי {contact_name},

רציתי להציג לך מועמד שנראה לי מתאים מאוד למה שאתם מחפשים.

הכירו את {candidate_name}!

מצרף את קורות החיים המלאים - אשמח לשמוע מה דעתך!

תודה,
{user_name}
פנדה-טק`,

        3: `שלום {client_name},

מועמד חדש: {candidate_name}
משרה: {job_title}

קו"ח מצורפים.

{user_name}
פנדה-טק`
    },
    whatsapp: {
        1: `היי {contact_name}! 👋

יש לי מועמד מעולה בשבילך! 🌟

👤 {candidate_name}
📋 למשרת: {job_title}

מצרף את קורות החיים 📎

מה דעתך? 🤔

{user_name}
פנדה-טק 🐼`,

        2: `שלום {contact_name},

שולח לך קורות חיים של מועמד רלוונטי.

שם: {candidate_name}
משרה: {job_title}

קורות החיים מצורפים.

{user_name}
פנדה-טק`,

        3: `{contact_name}, יש לי בשורות טובות! 🎉

מצאתי מועמד שנראה לי מושלם למה שאתם מחפשים!

🌟 הכירו את {candidate_name}!

אני ממש מתרגש מההתאמה! 🚀
קורות החיים מצורפים - תעיף מבט ותגיד לי מה אתה חושב!

{user_name}
פנדה-טק 🐼`
    }
};

export default function SendMatchMessageDialog({ isOpen, onClose, match, type, user, onSendSuccess }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [sending, setSending] = useState(false);
    const [sendResult, setSendResult] = useState(null);
    
    // Method and template selection
    const [method, setMethod] = useState('');
    const [templateType, setTemplateType] = useState(1);
    const [subject, setSubject] = useState('');
    const [editableMessage, setEditableMessage] = useState('');

    // Data
    const [candidate, setCandidate] = useState(null);
    const [client, setClient] = useState(null);
    const [job, setJob] = useState(null);
    const [contacts, setContacts] = useState([]);
    const [filteredContacts, setFilteredContacts] = useState([]);
    const [selectedContactId, setSelectedContactId] = useState('');
    const [currentUser, setCurrentUser] = useState(null);

    // CV attachment options (for client messages)
    const [attachCv, setAttachCv] = useState(true);
    const [cvFormat, setCvFormat] = useState('regular');
    const [showPandaPreview, setShowPandaPreview] = useState(false);

    const loadData = useCallback(async () => {
        if (!match) return;
        setLoading(true);
        setError('');
        try {
            const [candidateData, jobData, userData, allContacts] = await Promise.all([
                Candidate.get(match.candidate_id),
                match.job_id ? Job.get(match.job_id) : Promise.resolve(null),
                User.me(),
                ContactPerson.list()
            ]);

            setCandidate(candidateData);
            setJob(jobData);
            setCurrentUser(userData);
            setContacts(allContacts);

            if (jobData && jobData.client_id) {
                const clientData = await Client.get(jobData.client_id);
                setClient(clientData);
                
                // Filter contacts for this client
                const clientContacts = allContacts.filter(c => c.client_id === jobData.client_id);
                setFilteredContacts(clientContacts);
                
                // Auto-select primary contact
                const primaryContact = clientContacts.find(c => c.is_primary);
                setSelectedContactId(primaryContact?.id || (clientContacts[0]?.id || ''));
            }
        } catch (err) {
            console.error("Error loading message dialog data:", err);
            setError("שגיאה בטעינת נתונים.");
        }
        setLoading(false);
    }, [match]);
    
    useEffect(() => {
        if (isOpen) {
            loadData();
        } else {
            // Reset state on close
            setMethod('');
            setEditableMessage('');
            setSubject('');
            setError('');
            setSendResult(null);
            setTemplateType(1);
            setAttachCv(true);
            setCvFormat('regular');
        }
    }, [isOpen, loadData]);

    // Update message when method or template changes
    useEffect(() => {
        if (!method || !type) return;
        
        const templates = type === 'candidate' ? CANDIDATE_TEMPLATES : CLIENT_TEMPLATES;
        const template = templates[method]?.[templateType] || '';
        setEditableMessage(template);
        
        if (method === 'email') {
            const defaultSubject = type === 'candidate' 
                ? `הזדמנות תעסוקה - ${job?.title || 'משרה חדשה'}`
                : `הצגת מועמד - ${candidate?.first_name} ${candidate?.last_name} - ${job?.title || 'משרה'}`;
            setSubject(defaultSubject);
        }
    }, [method, templateType, type, job, candidate]);

    const renderPreview = useCallback(() => {
        const candidateName = `${candidate?.first_name || ''} ${candidate?.last_name || ''}`.trim() || '{שם_מועמד}';
        const clientName = client?.name || job?.client_name || '{שם_לקוח}';
        const contact = contacts.find(c => c.id === selectedContactId);
        const contactName = contact?.name || clientName;
        const jobTitle = job?.title || match?.job_title || '{כותרת_משרה}';
        const userName = currentUser?.full_name || user?.full_name || '{שם_משתמש}';

        return editableMessage
            .replace(/{candidate_name}/g, candidateName)
            .replace(/{client_name}/g, clientName)
            .replace(/{contact_name}/g, contactName)
            .replace(/{job_title}/g, jobTitle)
            .replace(/{user_name}/g, userName);
    }, [editableMessage, candidate, client, job, match, contacts, selectedContactId, currentUser, user]);

    const handleSend = async () => {
        if (!editableMessage.trim()) {
            setError('תוכן ההודעה לא יכול להיות ריק.');
            return;
        }
        if (method === 'email' && !subject.trim()) {
            setError('נושא המייל לא יכול להיות ריק.');
            return;
        }

        setSending(true);
        setError('');
        setSendResult(null);

        try {
            let targetEmail, targetPhone;
            
            if (type === 'candidate') {
                targetEmail = candidate?.email;
                targetPhone = candidate?.phone_primary;
            } else {
                const contact = contacts.find(c => c.id === selectedContactId);
                targetEmail = contact?.email || client?.email;
                targetPhone = contact?.phone || client?.phone;
            }

            if (method === 'email' && !targetEmail) {
                throw new Error(`לא נמצאה כתובת מייל עבור ${type === 'candidate' ? 'המועמד' : 'הלקוח'}.`);
            }

            if (method === 'whatsapp' && !targetPhone) {
                throw new Error(`לא נמצא מספר טלפון עבור ${type === 'candidate' ? 'המועמד' : 'הלקוח'}.`);
            }

            const response = await sendCandidateToSingleClient({
                candidateId: candidate?.id || '',
                clientId: client?.id || '',
                contactId: selectedContactId || '',
                jobId: job?.id || '',
                matchId: match.id,
                deliveryMethod: method,
                messageTemplate: renderPreview(),
                subject: method === 'email' ? subject : undefined,
                targetType: type,
                targetEmail,
                targetPhone,
                attachCv: type === 'client' ? attachCv : false,
                cvFormat: type === 'client' ? cvFormat : undefined
            });

            if (response.data?.success) {
                setSendResult({ success: true, message: 'ההודעה נשלחה בהצלחה!' });
                setTimeout(() => {
                    if (onSendSuccess) onSendSuccess();
                    onClose();
                }, 1500);
            } else {
                throw new Error(response.data?.error || 'שגיאה לא ידועה');
            }

        } catch (err) {
            console.error("Error sending message:", err);
            setSendResult({ success: false, message: err.message || 'אירעה שגיאה בשליחה.' });
        }
        setSending(false);
    };

    const canSendEmail = type === 'candidate' || (type === 'client' && user?.can_send_email_to_clients);
    const canSendWhatsApp = type === 'candidate' || (type === 'client' && user?.can_send_whatsapp_to_clients);
    const targetContact = contacts.find(c => c.id === selectedContactId);

    if (loading) {
        return (
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="max-w-2xl">
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                        <span className="mr-2">טוען נתונים...</span>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <>
            <ClientCvFormatterDialog
                isOpen={showPandaPreview}
                onClose={() => setShowPandaPreview(false)}
                candidate={candidate}
            />
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            שליחת הודעה {type === 'candidate' ? 'למועמד' : 'ללקוח'}: {type === 'candidate' ? match?.candidate_name : (client?.name || job?.client_name)}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        {!method ? (
                            <div className="space-y-4">
                                <Label>בחר שיטת שליחה:</Label>
                                <div className="flex gap-4">
                                    {canSendEmail && (
                                        <Button onClick={() => setMethod('email')} variant="outline" className="flex-1 h-24 flex-col">
                                            <Mail className="w-10 h-10 mb-2 text-blue-500" />
                                            <span className="font-medium">מייל</span>
                                        </Button>
                                    )}
                                    {canSendWhatsApp && (
                                        <Button onClick={() => setMethod('whatsapp')} variant="outline" className="flex-1 h-24 flex-col">
                                            <MessageSquare className="w-10 h-10 mb-2 text-green-500" />
                                            <span className="font-medium">WhatsApp</span>
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Method indicator */}
                                <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg">
                                    {method === 'email' ? <Mail className="w-4 h-4 text-blue-500" /> : <MessageSquare className="w-4 h-4 text-green-500" />}
                                    <span>שליחה ב{method === 'email' ? 'מייל' : 'WhatsApp'}</span>
                                    <Button variant="link" size="sm" onClick={() => setMethod('')} className="text-blue-500 mr-auto">
                                        שנה
                                    </Button>
                                </div>

                                {/* Contact selection for client messages */}
                                {type === 'client' && filteredContacts.length > 0 && (
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label className="text-right font-semibold">איש קשר</Label>
                                        <Select onValueChange={setSelectedContactId} value={selectedContactId} dir="rtl">
                                            <SelectTrigger className="col-span-3">
                                                <SelectValue placeholder="בחר איש קשר" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {filteredContacts.map(contact => (
                                                    <SelectItem key={contact.id} value={contact.id}>
                                                        {contact.name} {contact.is_primary ? '(ראשי)' : ''}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {/* Contact details */}
                                {type === 'client' && targetContact && (
                                    <div className="bg-gray-50 p-3 rounded-lg grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                        <div className="flex items-center gap-2">
                                            <Mail className="w-4 h-4 text-gray-500" />
                                            <span className="text-gray-700">{targetContact.email || 'מייל לא צוין'}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Phone className="w-4 h-4 text-gray-500" />
                                            <span className="text-gray-700">{targetContact.phone || 'טלפון לא צוין'}</span>
                                        </div>
                                    </div>
                                )}

                                {/* Candidate contact info */}
                                {type === 'candidate' && candidate && (
                                    <div className="bg-blue-50 p-3 rounded-lg grid grid-cols-2 gap-x-4 gap-y-2 text-sm border border-blue-200">
                                        <div className="flex items-center gap-2">
                                            <Mail className="w-4 h-4 text-blue-500" />
                                            <span className={candidate.email ? "text-gray-800" : "text-orange-600"}>
                                                {candidate.email || 'מייל לא צוין'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Phone className="w-4 h-4 text-blue-500" />
                                            <span className={candidate.phone_primary ? "text-gray-800" : "text-orange-600"}>
                                                {candidate.phone_primary || 'טלפון לא צוין'}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Template selection */}
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label className="text-right font-semibold">סגנון הודעה</Label>
                                    <Select onValueChange={value => setTemplateType(parseInt(value))} value={templateType.toString()} dir="rtl">
                                        <SelectTrigger className="col-span-3">
                                            <SelectValue placeholder="בחר סגנון הודעה" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(TEMPLATE_NAMES[type]?.[method] || {}).map(([key, name]) => (
                                                <SelectItem key={key} value={key}>{name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* CV attachment options (client only) */}
                                {type === 'client' && (
                                    <div className="grid grid-cols-4 items-start gap-4">
                                        <Label className="text-right font-semibold pt-2">צרף קורות חיים</Label>
                                        <div className="col-span-3 space-y-3">
                                            <div className="flex items-center gap-4">
                                                <Checkbox
                                                    id="attachCv"
                                                    checked={attachCv}
                                                    onCheckedChange={setAttachCv}
                                                />
                                                <Label htmlFor="attachCv" className="cursor-pointer">צרף קובץ קורות חיים</Label>
                                                {attachCv && (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            if (cvFormat === 'panda') {
                                                                setShowPandaPreview(true);
                                                            } else if (candidate?.resume_file_url) {
                                                                window.open(candidate.resume_file_url, '_blank');
                                                            }
                                                        }}
                                                        disabled={cvFormat === 'regular' && !candidate?.resume_file_url}
                                                        className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
                                                    >
                                                        {cvFormat === 'panda' ? <Wand2 className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                        צפה
                                                        <ExternalLink className="w-3 h-3" />
                                                    </Button>
                                                )}
                                            </div>
                                            
                                            {attachCv && (
                                                <div className="bg-gray-50 p-3 rounded-lg border">
                                                    <Label className="text-sm font-medium mb-2 block">פורמט קורות חיים:</Label>
                                                    <RadioGroup value={cvFormat} onValueChange={setCvFormat} className="flex gap-4">
                                                        <div className="flex items-center gap-2">
                                                            <RadioGroupItem value="regular" id="format-regular" />
                                                            <Label htmlFor="format-regular" className="cursor-pointer text-sm">
                                                                רגיל (קובץ מקורי)
                                                            </Label>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <RadioGroupItem value="panda" id="format-panda" />
                                                            <Label htmlFor="format-panda" className="cursor-pointer text-sm flex items-center gap-1">
                                                                <Wand2 className="w-3 h-3 text-blue-600" />
                                                                פורמט פנדה (ללא פרטי קשר + לוגו)
                                                            </Label>
                                                        </div>
                                                    </RadioGroup>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Email subject */}
                                {method === 'email' && (
                                    <div>
                                        <Label htmlFor="subject" className="font-semibold">נושא המייל</Label>
                                        <Input
                                            id="subject"
                                            value={subject}
                                            onChange={(e) => setSubject(e.target.value)}
                                            placeholder="נושא ההודעה"
                                            className="mt-1"
                                        />
                                    </div>
                                )}

                                {/* Message editor */}
                                <div>
                                    <Label htmlFor="message" className="font-semibold">עריכת ההודעה</Label>
                                    <Textarea
                                        id="message"
                                        value={editableMessage}
                                        onChange={(e) => setEditableMessage(e.target.value)}
                                        rows={8}
                                        placeholder="כתוב את ההודעה כאן..."
                                        className="mt-1"
                                    />
                                    <div className="text-xs text-gray-500 mt-1">
                                        משתנים זמינים: <code className="bg-gray-100 p-1 rounded">{`{candidate_name}`}</code>, <code className="bg-gray-100 p-1 rounded">{`{job_title}`}</code>, <code className="bg-gray-100 p-1 rounded">{`{client_name}`}</code>, <code className="bg-gray-100 p-1 rounded">{`{contact_name}`}</code>, <code className="bg-gray-100 p-1 rounded">{`{user_name}`}</code>
                                    </div>
                                </div>

                                {/* Preview */}
                                <div>
                                    <Label className="font-semibold">תצוגה מקדימה</Label>
                                    <div className="p-3 border rounded-md bg-blue-50 text-sm whitespace-pre-wrap max-h-32 overflow-y-auto mt-1">
                                        {renderPreview()}
                                    </div>
                                </div>

                                {/* Error/Success messages */}
                                {error && (
                                    <Alert variant="destructive">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertDescription className="mr-2">{error}</AlertDescription>
                                    </Alert>
                                )}

                                {sendResult && (
                                    <Alert variant={sendResult.success ? "default" : "destructive"}>
                                        {sendResult.success ? <CheckCircle className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4" />}
                                        <AlertDescription className="mr-2">{sendResult.message}</AlertDescription>
                                    </Alert>
                                )}
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={onClose}>ביטול</Button>
                        {method && (
                            <Button 
                                onClick={handleSend} 
                                disabled={sending || loading}
                                className="bg-green-600 hover:bg-green-700 text-white"
                            >
                                {sending ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        שולח...
                                    </>
                                ) : (
                                    <>
                                        <Share2 className="w-4 h-4 mr-2" />
                                        שלח הודעה
                                    </>
                                )}
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}