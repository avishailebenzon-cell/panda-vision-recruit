import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Client } from "@/entities/Client";
import { ContactPerson } from "@/entities/ContactPerson"; // Import new entity
import { sendCandidateToSingleClient } from "@/functions/sendCandidateToSingleClient";
import { Mail, MessageSquare, Loader2, Share2, CheckCircle, AlertCircle, Phone, Eye, ExternalLink, Wand2, Copy } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import ClientCvFormatterDialog from './ClientCvFormatterDialog';

// שמות משמעותיים לתבניות
const TEMPLATE_NAMES = {
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
};

// תבניות ברירת מחדל
const DEFAULT_TEMPLATES = {
    send_cv_email_template_1: `לכבוד {client_name},

הנדון: הצגת מועמד - {candidate_name}

אני מתכבד להציג בפניכם מועמד איכותי לתפקיד הפתוח אצלכם.

קורות החיים המלאים מצורפים למייל זה.

אשמח לתאם שיחת היכרות בהקדם.

בברכה,
{user_name}
צוות פנדה-טק`,

    send_cv_email_template_2: `היי {contact_name},

רציתי להציג לך מועמד שנראה לי מתאים מאוד למה שאתם מחפשים.

הכירו את {candidate_name}!

מצרף את קורות החיים המלאים - אשמח לשמוע מה דעתך!

תודה,
{user_name}
פנדה-טק`,

    send_cv_email_template_3: `שלום {client_name},

מועמד חדש: {candidate_name}

קו"ח מצורפים.

{user_name}
פנדה-טק`,

    send_cv_whatsapp_template_1: `היי {contact_name}! 👋

יש לי מועמד מעולה בשבילך! 🌟

👤 {candidate_name}

מצרף את קורות החיים 📎

מה דעתך? 🤔

{user_name}
פנדה-טק 🐼`,

    send_cv_whatsapp_template_2: `שלום {contact_name},

שולח לך קורות חיים של מועמד רלוונטי.

שם: {candidate_name}

קורות החיים מצורפים.

{user_name}
פנדה-טק`,

    send_cv_whatsapp_template_3: `{contact_name}, יש לי בשורות טובות! 🎉

מצאתי מועמד שנראה לי מושלם למה שאתם מחפשים!

🌟 הכירו את {candidate_name}!

אני ממש מתרגש מההתאמה הזו! 🚀
קורות החיים מצורפים - תעיף מבט ותגיד לי מה אתה חושב!

{user_name}
פנדה-טק 🐼`
};

export default function SendCvToClientDialog({ isOpen, onClose, candidate, user }) {
    const [clients, setClients] = useState([]);
    const [contacts, setContacts] = useState([]); // State for all contacts
    const [filteredContacts, setFilteredContacts] = useState([]); // Contacts for selected client
    const [selectedClient, setSelectedClient] = useState('');
    const [selectedContactId, setSelectedContactId] = useState(''); // NEW: Selected contact ID
    const [deliveryMethod, setDeliveryMethod] = useState('email');
    const [templateType, setTemplateType] = useState(1);
    const [attachCv, setAttachCv] = useState(true);
    const [cvFormat, setCvFormat] = useState('regular'); // 'regular' or 'panda'
    const [message, setMessage] = useState('');
    const [editableMessage, setEditableMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [sendResult, setSendResult] = useState(null);
    const [showPandaPreview, setShowPandaPreview] = useState(false);
    const [ccEmail, setCcEmail] = useState('');

    const getTemplateKey = useCallback(() => {
        return `send_cv_${deliveryMethod}_template_${templateType}`;
    }, [deliveryMethod, templateType]);

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            Promise.all([
                Client.list(),
                ContactPerson.list() // Load all contacts
            ]).then(([clientList, contactList]) => {
                setClients(clientList);
                setContacts(contactList);
            }).catch(err => {
                console.error("Failed to load clients or contacts", err);
                setSendResult({ success: false, message: "שגיאה בטעינת לקוחות או אנשי קשר." });
            }).finally(() => setLoading(false));

            // Reset state on open
            setSendResult(null);
            setSelectedClient('');
            setSelectedContactId('');
            setFilteredContacts([]);
            setDeliveryMethod('email');
            setTemplateType(1);
            setCcEmail('');
        }
    }, [isOpen]);

    useEffect(() => {
        if (deliveryMethod && templateType) {
            const templateKey = getTemplateKey();
            // נסה קודם מהמשתמש, אחרת מתבנית ברירת מחדל
            const template = user?.[templateKey] || DEFAULT_TEMPLATES[templateKey] || '';
            setMessage(template);
            setEditableMessage(template);
        }
    }, [user, deliveryMethod, templateType, getTemplateKey]);

    // Filter contacts when a client is selected
    useEffect(() => {
        if (selectedClient && contacts.length > 0) {
            const clientContacts = contacts.filter(c => c.client_id === selectedClient);
            setFilteredContacts(clientContacts);
            // Auto-select primary contact if available, otherwise first contact
            const primaryContact = clientContacts.find(c => c.is_primary);
            setSelectedContactId(primaryContact?.id || (clientContacts[0]?.id || ''));
        } else {
            setFilteredContacts([]);
            setSelectedContactId('');
        }
    }, [selectedClient, contacts]);

    // Re-check delivery method validity when selectedContactId changes
    useEffect(() => {
        const currentContact = contacts.find(c => c.id === selectedContactId);
        if (currentContact) {
            if (deliveryMethod === 'email' && !currentContact.email) {
                if (currentContact.phone) {
                    setDeliveryMethod('whatsapp');
                }
            } else if (deliveryMethod === 'whatsapp' && !currentContact.phone) {
                if (currentContact.email) {
                    setDeliveryMethod('email');
                }
            }
        }
    }, [selectedContactId, deliveryMethod, contacts]);


    const renderPreview = useCallback(() => {
        const clientName = clients.find(c => c.id === selectedClient)?.name || '{שם_לקוח}';
        const contact = contacts.find(c => c.id === selectedContactId);
        const contactName = contact?.name || '{איש_קשר}';
        const candidateName = `${candidate?.first_name || ''} ${candidate?.last_name || ''}`.trim() || '{שם_מועמד}';
        const resumeUrl = candidate?.resume_file_url || '{קישור_לקוח}';
        const userName = user?.full_name || '{שם_משתמש}';

        return editableMessage
            .replace(/{client_name}/g, clientName)
            .replace(/{contact_name}/g, contactName) // Add new placeholder for contact person
            .replace(/{candidate_name}/g, candidateName)
            .replace(/{resume_url}/g, resumeUrl)
            .replace(/{user_name}/g, userName);
    }, [editableMessage, clients, contacts, selectedClient, selectedContactId, candidate, user]);

    const handleSend = async () => {
        if (!selectedClient || !selectedContactId) {
            alert('אנא בחר לקוח ואיש קשר.');
            return;
        }
        setSending(true);
        setSendResult(null);

        const targetContact = contacts.find(c => c.id === selectedContactId);
        if (!targetContact) {
            alert('איש קשר לא נמצא.');
            setSending(false);
            return;
        }

        try {
            const response = await sendCandidateToSingleClient({
                candidateId: candidate.id,
                clientId: selectedClient,
                contactId: selectedContactId, // NEW: send contact ID
                messageTemplate: renderPreview(),
                attachCv,
                cvFormat, // NEW: send CV format type
                deliveryMethod,
                ccEmail: ccEmail.trim() || null,
            });

            if (response.data?.success) {
                setSendResult({ success: true, message: 'ההודעה נשלחה בהצלחה!' });
            } else {
                throw new Error(response.data?.error || 'שגיאה לא ידועה');
            }
        } catch (error) {
            setSendResult({ success: false, message: `שגיאה בשליחה: ${error.message}` });
        } finally {
            setSending(false);
        }
    };

    const targetContact = contacts.find(c => c.id === selectedContactId);

    return (
        <>
        <ClientCvFormatterDialog
            isOpen={showPandaPreview}
            onClose={() => setShowPandaPreview(false)}
            candidate={candidate}
        />
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>שליחת קורות חיים ללקוח</DialogTitle>
                </DialogHeader>
                <div className="grid gap-6 py-4">
                    {loading ? (
                        <div className="flex justify-center items-center h-24">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                            <span className="ml-2 text-gray-500">טוען נתונים...</span>
                        </div>
                    ) : (
                        <>
                            {/* Client Selection */}
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="client" className="text-right font-semibold">
                                    לקוח
                                </Label>
                                <Select onValueChange={setSelectedClient} value={selectedClient} dir="rtl">
                                    <SelectTrigger className="col-span-3">
                                        <SelectValue placeholder="בחר לקוח" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {clients.map(client => (
                                            <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Client Contact Details */}
                            {selectedClient && (
                                <div className="bg-blue-50 p-3 rounded-lg grid grid-cols-2 gap-x-4 gap-y-2 text-sm border border-blue-200">
                                    <div className="flex items-center gap-2">
                                        <Mail className="w-4 h-4 text-blue-500" />
                                        <span className="font-medium text-gray-600">מייל לקוח:</span>
                                        <span className={clients.find(c => c.id === selectedClient)?.email ? "text-gray-800" : "text-orange-600 font-medium"}>
                                            {clients.find(c => c.id === selectedClient)?.email || 'יש להשלים'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Phone className="w-4 h-4 text-blue-500" />
                                        <span className="font-medium text-gray-600">טלפון לקוח:</span>
                                        <span className={clients.find(c => c.id === selectedClient)?.phone ? "text-gray-800" : "text-orange-600 font-medium"}>
                                            {clients.find(c => c.id === selectedClient)?.phone || 'יש להשלים'}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* NEW: Contact Person Selection */}
                            {selectedClient && (
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="contact" className="text-right font-semibold">
                                        איש קשר
                                    </Label>
                                    {filteredContacts.length > 0 ? (
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
                                    ) : (
                                        <div className="col-span-3 text-sm text-gray-500">לא נמצאו אנשי קשר עבור לקוח זה.</div>
                                    )}
                                </div>
                            )}

                            {/* Contact Details Display */}
                            {targetContact && (
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

                            {/* Delivery Method */}
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right font-semibold">
                                    שיטת שליחה
                                </Label>
                                <div className="col-span-3 flex items-center gap-4">
                                    <Button
                                        variant={deliveryMethod === 'email' ? 'default' : 'outline'}
                                        onClick={() => setDeliveryMethod('email')}
                                        size="sm"
                                        className="flex items-center gap-2"
                                        disabled={!targetContact?.email && !clients.find(c => c.id === selectedClient)?.email}
                                    >
                                        <Mail className="h-4 w-4" /> אימייל
                                    </Button>
                                    <Button
                                        variant={deliveryMethod === 'whatsapp' ? 'default' : 'outline'}
                                        onClick={() => setDeliveryMethod('whatsapp')}
                                        size="sm"
                                        className="flex items-center gap-2"
                                        disabled={!targetContact?.phone && !clients.find(c => c.id === selectedClient)?.phone}
                                    >
                                        <MessageSquare className="h-4 w-4" /> וואטסאפ
                                    </Button>
                                </div>
                            </div>

                            {/* בחירת תבנית עם שמות משמעותיים */}
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="templateType" className="text-right font-semibold">
                                    סגנון הודעה
                                </Label>
                                <Select onValueChange={value => setTemplateType(parseInt(value))} value={templateType.toString()} dir="rtl">
                                    <SelectTrigger className="col-span-3">
                                        <SelectValue placeholder="בחר סגנון הודעה" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(TEMPLATE_NAMES[deliveryMethod]).map(([key, name]) => (
                                            <SelectItem key={key} value={key}>{name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* צירוף קורות חיים */}
                            <div className="grid grid-cols-4 items-start gap-4">
                                <Label htmlFor="attachCv" className="text-right font-semibold pt-2">
                                    צרף קורות חיים
                                </Label>
                                <div className="col-span-3 space-y-3">
                                    <div className="flex items-center gap-4">
                                        <Checkbox
                                            id="attachCv"
                                            checked={attachCv}
                                            onCheckedChange={setAttachCv}
                                        />
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
                                                {cvFormat === 'panda' ? 'צפה בפורמט פנדה' : 'צפה בקורות החיים'}
                                                <ExternalLink className="w-3 h-3" />
                                            </Button>
                                        )}
                                        {attachCv && cvFormat === 'regular' && !candidate?.resume_file_url && (
                                            <span className="text-sm text-orange-600">⚠️ אין קובץ קורות חיים למועמד</span>
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

                            {/* העתק המייל (רק למייל) */}
                            {deliveryMethod === 'email' && (
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="ccEmail" className="text-right font-semibold">
                                        העתק (CC)
                                    </Label>
                                    <div className="col-span-3">
                                        <Input
                                            id="ccEmail"
                                            type="email"
                                            placeholder="email@example.com"
                                            value={ccEmail}
                                            onChange={(e) => setCcEmail(e.target.value)}
                                            className="text-sm"
                                        />
                                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                            <Copy className="w-3 h-3" />
                                            אופציונלי - שלח העתק לעובד בחברה
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* NEW: עריכת הודעה */}
                            <div className="grid grid-cols-1 gap-2">
                                <Label htmlFor="messageEdit" className="text-right font-semibold">
                                    עריכת ההודעה
                                </Label>
                                <Textarea
                                    id="messageEdit"
                                    value={editableMessage}
                                    onChange={(e) => setEditableMessage(e.target.value)}
                                    rows={8}
                                    className="text-sm"
                                    placeholder="ערוך את ההודעה לפי הצורך..."
                                />
                                <div className="text-xs text-gray-500 mt-1">
                                    משתנים זמינים: <code className="bg-gray-100 p-1 rounded">{'{client_name}'}</code>, <code className="bg-gray-100 p-1 rounded">{'{contact_name}'}</code>, <code className="bg-gray-100 p-1 rounded">{'{candidate_name}'}</code>, <code className="bg-gray-100 p-1 rounded">{'{resume_url}'}</code>, <code className="bg-gray-100 p-1 rounded">{'{user_name}'}</code>
                                </div>
                            </div>

                            {/* תצוגה מקדימה */}
                            <div className="grid grid-cols-1 gap-2">
                                <Label htmlFor="messagePreview" className="text-right font-semibold">
                                    תצוגה מקדימה
                                </Label>
                                <div className="p-3 border rounded-md bg-blue-50 text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">
                                    {renderPreview()}
                                </div>
                            </div>

                            {sendResult && (
                                <Alert variant={sendResult.success ? "default" : "destructive"}>
                                    {sendResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                                    <AlertDescription className="mr-2">
                                        {sendResult.message}
                                    </AlertDescription>
                                </Alert>
                            )}
                        </>
                    )}
                </div>
                <DialogFooter>
                    <Button onClick={onClose} variant="outline">סגור</Button>
                    <Button
                        onClick={handleSend}
                        disabled={!selectedClient || !selectedContactId || sending || loading}
                        className="bg-green-600 hover:bg-green-700 text-white"
                    >
                        {sending ? (
                            <>
                                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                                שולח...
                            </>
                        ) : (
                            <>
                                <Share2 className="ml-2 h-4 w-4" />
                                שלח קורות חיים
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    );
}