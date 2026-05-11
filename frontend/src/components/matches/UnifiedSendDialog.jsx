import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { Loader2, Mail, MessageCircle, Send, ArrowRight, Building, User } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';

export default function UnifiedSendDialog({ 
  isOpen, 
  onClose, 
  match, 
  candidate, 
  job, 
  agentName = 'סוכן',
  onMatchRemoved,
  clientSummaryLetter = ''
}) {
  const [step, setStep] = useState(1); // 1=יעד, 2=ערוץ תקשורת, 3=סוג הודעה, 4=תצוגה מקדימה, 5=עריכה ושליחה
  const [targetType, setTargetType] = useState(null); // 'internal', 'candidate', 'client'
  const [communicationMethod, setCommunicationMethod] = useState(null); // 'email', 'whatsapp'
  const [selectedTemplate, setSelectedTemplate] = useState(null); // Template object
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [contactPerson, setContactPerson] = useState(null); // for client contact
  
  // Email fields
  const [recipientEmail, setRecipientEmail] = useState('');
  const [ccEmail, setCcEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [markAsContacted, setMarkAsContacted] = useState(false);
  const [attachCv, setAttachCv] = useState(false);

  const DEFAULT_CC = 'jobs@pandatech.co.il';

  // Reset on open/close
  React.useEffect(() => {
    if (isOpen) {
      setStep(1);
      setTargetType(null);
      setSelectedTemplate(null);
      setCommunicationMethod(null);
      setRecipientEmail('');
      setCcEmail(DEFAULT_CC);
      setSubject('');
      setBody('');
      setMarkAsContacted(false);
      setAttachCv(false);
      setSending(false);
      setContactPerson(null);
    }
  }, [isOpen]);

  // Load templates for selected communication method
  const loadTemplatesForMethod = async () => {
    if (!targetType || targetType === 'internal') return;
    
    setLoadingTemplates(true);
    try {
      const currentUser = await base44.auth.me();
      const statuses = await base44.entities.CandidateStatus.list('status_number');
      
      const availableTemplates = [];
      
      statuses.forEach(status => {
        if (targetType === 'candidate') {
          const key = `candidate_status_${status.status_number}_${communicationMethod}_template`;
          availableTemplates.push({
            key,
            label: status.status_name,
            statusName: status.status_name,
            statusNumber: status.status_number,
            method: communicationMethod,
            content: currentUser[key] || (communicationMethod === 'email' 
              ? `שלום {candidate_name},\n\nעדכון לגבי ${status.status_name}...\n\nבברכה,\nצוות פנדה-טק`
              : `היי {candidate_name} 👋\n\nעדכון: ${status.status_name}\n\nפנדה-טק 🐼`)
          });
        } else if (targetType === 'client') {
          const key = `client_status_${status.status_number}_${communicationMethod}_template`;
          availableTemplates.push({
            key,
            label: status.status_name,
            statusName: status.status_name,
            statusNumber: status.status_number,
            method: communicationMethod,
            content: currentUser[key] || (communicationMethod === 'email'
              ? `שלום {client_name},\n\nעדכון לגבי ${status.status_name}...\n\nבברכה,\nצוות פנדה-טק`
              : `היי {client_name} 👋\n\nעדכון: ${status.status_name}\n\nפנדה-טק 🐼`)
          });
        }
      });
      
      setTemplates(availableTemplates);
    } catch (error) {
      console.error('Error loading templates:', error);
      toast.error('שגיאה בטעינת תבניות');
    }
    setLoadingTemplates(false);
  };

  // Step 1: Select target type
  const handleSelectTarget = (type) => {
    setTargetType(type);
    
    // Auto-advance for internal (no channel selection)
    if (type === 'internal') {
      setCommunicationMethod('email');
      setStep(5);
      const jobCode = job?.job_code || '';
      setSubject(`הודעה לגבי המועמד ${match?.candidate_name || ''} למשרה ${match?.job_title || ''}`);
      setBody(`היי,\n\nרציתי לעדכן שהמועמד ${match?.candidate_name || ''} מתאים למשרה ${match?.job_title || ''} ${jobCode ? `#${jobCode}` : ''} לאחר בדיקה ידנית.`);
    } else {
      setStep(2); // Go to channel selection
    }
  };

  // Step 2: Select communication channel
  const handleSelectChannel = async (method) => {
    setCommunicationMethod(method);
    setStep(3); // Go to template selection
  };

  // Load templates when step 3 is reached
  React.useEffect(() => {
    if (step === 3 && communicationMethod) {
      loadTemplatesForMethod();
    }
  }, [step, communicationMethod]);

  // Step 3: Select template by status
  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template);
    setStep(4); // Go to preview
  };

  // Step 4: Preview confirmed, apply template
  const applyTemplate = async () => {
    if (!selectedTemplate) return;

    // Fetch contact person for client to get email + first name
    let resolvedContactEmail = '';
    let resolvedContactFirstName = '';
    if (targetType === 'client' && job?.client_id) {
      try {
        const contacts = await base44.entities.ContactPerson.filter({ client_id: job.client_id });
        if (contacts && contacts.length > 0) {
          const cp = contacts[0];
          setContactPerson(cp);
          resolvedContactEmail = cp.email || '';
          resolvedContactFirstName = cp.first_name || cp.name || job?.client_name || '';
        } else {
          resolvedContactFirstName = job?.client_name || '';
        }
      } catch (e) {
        resolvedContactFirstName = job?.client_name || '';
      }
    }

    // Candidate name
    const candidateFirstName = candidate?.first_name || (candidate?.full_name || match?.candidate_name || '').split(' ')[0] || '';
    const candidateFullName = candidate?.full_name || match?.candidate_name || '';

    // Format dates
    const cvReceivedDate = candidate?.cv_received_date
      ? new Date(candidate.cv_received_date).toLocaleDateString('he-IL')
      : match?.created_date
        ? new Date(match.created_date).toLocaleDateString('he-IL')
        : '';
    const matchCreationDate = match?.created_date
      ? new Date(match.created_date).toLocaleDateString('he-IL')
      : '';

    // Replace placeholders
    let content = selectedTemplate.content;
    const replacements = {
      '{candidate_name}': candidateFullName || candidateFirstName,
      '{candidate_email}': candidate?.email || '',
      '{candidate_phone}': candidate?.phone_primary || match?.candidate_phone || '',
      '{job_title}': match?.job_title || job?.title || '',
      '{client_name}': resolvedContactFirstName || job?.client_name || '',
      '{security_clearance}': candidate?.security_clearance || job?.security_clearance || '',
      '{skills_summary}': candidate?.skills_summary || candidate?.main_experience || '',
      '{status_name}': selectedTemplate.statusName || '',
      '{cv_received_date}': cvReceivedDate,
      '{match_creation_date}': matchCreationDate
    };
    
    Object.keys(replacements).forEach(placeholder => {
      content = content.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), replacements[placeholder]);
    });

    if (communicationMethod === 'email') {
      let toEmail = '';
      if (targetType === 'candidate') {
        toEmail = candidate?.email || '';
      } else if (targetType === 'client') {
        toEmail = resolvedContactEmail || job?.contact_person_email || '';
      }

      // Prepend greeting if not already starting with שלום
      const greeting = targetType === 'candidate'
        ? `שלום ${candidateFirstName},\n\n`
        : `שלום ${resolvedContactFirstName || job?.client_name || ''},\n\n`;

      if (!content.startsWith('שלום')) {
        content = greeting + content;
      }

      setRecipientEmail(toEmail);
      setCcEmail(DEFAULT_CC);
      if (targetType === 'client') setAttachCv(!!candidate?.resume_file_url);
      setSubject(`עדכון - ${match?.job_title || ''}`);
      // Append client summary letter if available and sending to client
      const finalBody = (targetType === 'client' && clientSummaryLetter)
        ? `${content}\n\n---\n${clientSummaryLetter}`
        : content;
      setBody(finalBody);
    } else {
      setBody(content);
    }
    
    setStep(5); // Go to final edit and send
  };

  const handleSend = async () => {
    if (communicationMethod === 'email') {
      if (!recipientEmail || !recipientEmail.includes('@')) {
        toast.error('נא להזין כתובת מייל תקינה');
        return;
      }

      setSending(true);
      try {
        // Build cc list from ccEmail field (semicolon separated)
        const ccList = ccEmail
          .split(';')
          .map(e => e.trim())
          .filter(e => e.includes('@'));

        // Attach CV if requested and available
        const cvUrl = candidate?.resume_file_url;
        const attachments = attachCv && cvUrl ? [{ url: cvUrl, filename: candidate?.original_filename || 'cv.pdf' }] : undefined;

        // Send via Resend
        await base44.functions.invoke('sendEmailViaResend', {
          to: recipientEmail,
          cc: ccList.length > 0 ? ccList : undefined,
          subject: subject,
          body: body,
          from_name: `${agentName} - פנדה-טק`,
          attachments: attachments
        });
        
        // Log to EmailLog
        const currentUser = await base44.auth.me();
        await base44.entities.EmailLog.create({
          to: recipientEmail,
          subject: subject,
          status: 'sent',
          sent_by_user_id: currentUser.id,
          sent_by_user_name: currentUser.full_name,
          source: 'manual',
          related_entity_type: 'Match',
          related_entity_id: match?.id
        });
        
        // If sending to candidate, add to Rotem tasks
        if (targetType === 'candidate' && match?.candidate_id) {
          try {
            await base44.entities.RotemTask.create({
              job_id: match.job_id,
              job_title: match.job_title,
              candidate_id: match.candidate_id,
              candidate_name: match.candidate_name,
              candidate_phone: candidate?.phone_primary || '',
              status: 'בתהליך',
              source: agentName.toLowerCase(),
              match_id: match.id,
              match_score: match.match_score,
              match_reasons: match.match_reasons,
              notes: `הודעת מייל נשלחה מ${agentName} בתאריך ${new Date().toLocaleDateString('he-IL')}\n\nנושא: ${subject}\n\nתוכן: ${body.substring(0, 500)}...`,
              last_outgoing_message_date: new Date().toISOString()
            });
          } catch (e) {
            console.error('Failed to add to Rotem tasks:', e);
            // Don't fail the whole operation if logging fails
          }
        }
        
        // If sending to client, add to Elad tasks
        if (targetType === 'client' && match?.candidate_id) {
          try {
            await base44.entities.EladTask.create({
              job_id: match.job_id,
              job_title: match.job_title,
              client_id: job?.client_id || '',
              client_company_name: job?.client_name || '',
              client_email: recipientEmail,
              candidate_id: match.candidate_id,
              candidate_full_name: match.candidate_name,
              candidate_cv_file_url: candidate?.resume_file_url || '',
              match_id: match.id,
              status: 'נשלח',
              email_subject_snapshot: subject,
              email_body_snapshot: body,
              sent_at: new Date().toISOString(),
              notes: `הודעת מייל ללקוח נשלחה מ${agentName} בתאריך ${new Date().toLocaleDateString('he-IL')}`
            });
          } catch (e) {
            console.error('Failed to add to Elad tasks:', e);
            // Don't fail the whole operation if logging fails
          }
        }
        
        // If internal send - mark match as handled
        if (targetType === 'internal' && match?.id) {
          try {
            await base44.entities.Match.update(match.id, {
              is_manually_handled: true,
              manually_handled_date: new Date().toISOString()
            });
          } catch (e) {
            console.error('Failed to mark match as handled:', e);
          }
        }
        
        // Always remove match after sending (both internal and external)
        if (onMatchRemoved) {
          onMatchRemoved(match.id);
        }
        
        // If marked as contacted, update candidate status
        if (markAsContacted && match?.candidate_id) {
          await base44.entities.Candidate.update(match.candidate_id, {
            status: 'ביצירת קשר'
          });
        }
        
        toast.success(`המייל נשלח בהצלחה ל-${recipientEmail}${targetType === 'internal' ? ' והוסר מהרשימה' : ''}`);
        onClose();
      } catch (error) {
        console.error('Error sending email:', error);
        toast.error('שגיאה בשליחת המייל');
      } finally {
        setSending(false);
      }
    } else if (communicationMethod === 'whatsapp') {
      let phone = '';
      
      if (targetType === 'candidate') {
        // Try match task candidate_phone first (set by RotemPage), then candidate entity
        phone = match?.candidate_phone || candidate?.phone_primary;
        if (!phone) {
          toast.error('למועמד אין מספר טלפון');
          return;
        }
      } else if (targetType === 'client') {
        phone = job?.contact_person_phone;
        if (!phone) {
          toast.error('אין מספר טלפון ללקוח');
          return;
        }
      }

      // Format phone number - remove +, -, and spaces
      phone = phone.replace(/[+\-\s]/g, '');
      if (phone.startsWith('0')) {
        phone = '972' + phone.substring(1);
      }
      if (!phone.startsWith('972')) {
        phone = '972' + phone;
      }

      setSending(true);
      try {
        // Send via Green API (Tal's instance) for candidate messages
        if (targetType === 'candidate') {
          const sendResponse = await base44.functions.invoke('sendWhatsappViaGreenApi', {
            phone: phone,
            message: body
          });

          if (!sendResponse?.data?.success) {
            throw new Error(sendResponse?.data?.error || 'שליחה נכשלה');
          }

          // Log to WhatsappMessage entity for conversation history
          const candidatePhone = phone;
          await base44.entities.WhatsappMessage.create({
            match_id: match?.id || '',
            candidate_id: match?.candidate_id || candidate?.id || '',
            candidate_name: match?.candidate_name || candidate?.full_name || '',
            job_id: match?.job_id || '',
            job_title: match?.job_title || '',
            candidate_phone: candidatePhone,
            phone_number: candidatePhone,
            content: body,
            direction: 'outgoing',
            status: 'sent',
            sender_name: 'טל',
            green_api_message_id: sendResponse?.data?.message_id || ''
          });

          toast.success('ההודעה נשלחה בהצלחה דרך WhatsApp (טל)');
        } else {
          // For client - open wa.me as before
          const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(body)}`;
          window.open(whatsappUrl, '_blank');
          toast.success('WhatsApp נפתח בהצלחה');
        }

        // If sending to candidate, add to Rotem tasks
        if (targetType === 'candidate' && match?.candidate_id) {
          try {
            await base44.entities.RotemTask.create({
              job_id: match.job_id,
              job_title: match.job_title,
              candidate_id: match.candidate_id,
              candidate_name: match.candidate_name,
              candidate_phone: match?.candidate_phone || candidate?.phone_primary || '',
              status: 'בתהליך',
              source: agentName.toLowerCase(),
              match_id: match.id,
              match_score: match.match_score,
              match_reasons: match.match_reasons,
              notes: `הודעת WhatsApp נשלחה מ${agentName} בתאריך ${new Date().toLocaleDateString('he-IL')}\n\nתוכן: ${body.substring(0, 500)}...`,
              last_outgoing_message_date: new Date().toISOString()
            });
          } catch (e) {
            console.error('Failed to add to Rotem tasks:', e);
          }
        }
        
        // If sending to client, add to Elad tasks
        if (targetType === 'client' && match?.candidate_id) {
          try {
            await base44.entities.EladTask.create({
              job_id: match.job_id,
              job_title: match.job_title,
              client_id: job?.client_id || '',
              client_company_name: job?.client_name || '',
              client_email: job?.contact_person_email || '',
              candidate_id: match.candidate_id,
              candidate_full_name: match.candidate_name,
              candidate_cv_file_url: candidate?.resume_file_url || '',
              match_id: match.id,
              status: 'נשלח',
              email_subject_snapshot: 'הודעת WhatsApp',
              email_body_snapshot: body,
              sent_at: new Date().toISOString(),
              notes: `הודעת WhatsApp ללקוח נשלחה מ${agentName} בתאריך ${new Date().toLocaleDateString('he-IL')}`
            });
          } catch (e) {
            console.error('Failed to add to Elad tasks:', e);
          }
        }

        // If internal send - mark match as handled
        if (targetType === 'internal' && match?.id) {
          try {
            await base44.entities.Match.update(match.id, {
              is_manually_handled: true,
              manually_handled_date: new Date().toISOString()
            });
          } catch (e) {
            console.error('Failed to mark match as handled:', e);
          }
        }
        
        // Always remove match after sending
        if (onMatchRemoved) {
          onMatchRemoved(match.id);
        }

        // If marked as contacted, update candidate status
        if (markAsContacted && match?.candidate_id) {
          await base44.entities.Candidate.update(match.candidate_id, {
            status: 'ביצירת קשר'
          });
        }

        onClose();
      } catch (error) {
        console.error('Error sending WhatsApp:', error);
        toast.error('שגיאה בשליחת ההודעה: ' + (error.message || ''));
      } finally {
        setSending(false);
      }
    }
  };

  const handleBack = () => {
    if (step === 5 && targetType === 'internal') {
      setStep(1);
      setTargetType(null);
      setCommunicationMethod(null);
      setBody('');
      setSubject('');
    } else if (step === 5) {
      setStep(4);
      setBody('');
      setSubject('');
    } else if (step === 4) {
      setStep(3);
      setSelectedTemplate(null);
    } else if (step === 3) {
      setStep(2);
      setTemplates([]);
    } else if (step === 2) {
      setStep(1);
      setTargetType(null);
      setCommunicationMethod(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-600" />
            שליחת הודעה
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Step 1: Select Target Type */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">לאן תרצה לשלוח הודעה?</p>
              <div className="grid gap-3">
                <Card 
                  className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-blue-400"
                  onClick={() => handleSelectTarget('internal')}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <Building className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">שליחה פנימית</h3>
                      <p className="text-xs text-gray-500">עדכון למשרד על התאמה</p>
                    </div>
                  </CardContent>
                </Card>

                <Card 
                  className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-green-400"
                  onClick={() => handleSelectTarget('candidate')}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">שליחה למועמד</h3>
                      <p className="text-xs text-gray-500">יצירת קשר עם {match?.candidate_name}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card 
                  className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-purple-400"
                  onClick={() => handleSelectTarget('client')}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <Building className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">שליחה ללקוח</h3>
                      <p className="text-xs text-gray-500">המלצה על מועמד ללקוח</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Step 2: Select Communication Channel */}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">איך תרצה לשלוח?</p>
              <div className="grid gap-3">
                <Card 
                  className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-blue-400"
                  onClick={() => handleSelectChannel('email')}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <Mail className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">שליחה במייל</h3>
                      <p className="text-xs text-gray-500">שליחת הודעה באמצעות מייל</p>
                    </div>
                  </CardContent>
                </Card>

                <Card 
                  className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-green-400"
                  onClick={() => handleSelectChannel('whatsapp')}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <MessageCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">שליחה ב-WhatsApp</h3>
                      <p className="text-xs text-gray-500">שליחת הודעה באמצעות WhatsApp</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Step 3: Select Template by Status */}
          {step === 3 && (
            <div className="space-y-3">
              <Label className="text-sm text-gray-700 font-medium">בחר סוג הודעה לפי סטטוס המועמד:</Label>
              {loadingTemplates ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : (
                <>
                  <Select 
                    value={selectedTemplate?.key || ''} 
                    onValueChange={(value) => {
                      const template = templates.find(t => t.key === value);
                      if (template) {
                        handleSelectTemplate(template);
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="בחר סטטוס מהרשימה..." />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template, idx) => (
                        <SelectItem key={idx} value={template.key}>
                          {template.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {templates.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">
                      לא נמצאו תבניות הודעה. אנא הגדר מצבי מועמד במערכת.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Step 4: Preview Template */}
          {step === 4 && selectedTemplate && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">תצוגה מקדימה של ההודעה:</p>
              <div className="bg-gray-50 border rounded-lg p-4 max-h-[300px] overflow-y-auto">
                <pre className="text-sm whitespace-pre-wrap">{
                  (() => {
                    const candidateFullName = candidate?.full_name || match?.candidate_name || '[שם מועמד]';
                    const clientFirstName = contactPerson?.first_name || contactPerson?.name || job?.client_name || '[שם לקוח]';
                    const cvDate = candidate?.cv_received_date
                      ? new Date(candidate.cv_received_date).toLocaleDateString('he-IL')
                      : match?.created_date ? new Date(match.created_date).toLocaleDateString('he-IL') : '[תאריך]';
                    const matchDate = match?.created_date ? new Date(match.created_date).toLocaleDateString('he-IL') : '[תאריך]';
                    return selectedTemplate.content
                      .replace(/{candidate_name}/g, candidateFullName)
                      .replace(/{candidate_email}/g, candidate?.email || '[מייל מועמד]')
                      .replace(/{candidate_phone}/g, candidate?.phone_primary || match?.candidate_phone || '[טלפון מועמד]')
                      .replace(/{job_title}/g, match?.job_title || job?.title || '[שם משרה]')
                      .replace(/{client_name}/g, clientFirstName)
                      .replace(/{security_clearance}/g, candidate?.security_clearance || job?.security_clearance || '[סיווג]')
                      .replace(/{skills_summary}/g, candidate?.skills_summary || candidate?.main_experience || '[כישורים]')
                      .replace(/{status_name}/g, selectedTemplate.statusName || '')
                      .replace(/{cv_received_date}/g, cvDate)
                      .replace(/{match_creation_date}/g, matchDate);
                  })()
                }</pre>
              </div>
              <Button onClick={applyTemplate} className="w-full bg-blue-600 hover:bg-blue-700">
                <ArrowRight className="w-4 h-4 ml-2" />
                המשך לעריכה
              </Button>
            </div>
          )}

          {/* Step 5: Edit and Send */}
          {step === 5 && (
            <div className="space-y-4">
              {communicationMethod === 'email' && (
                <>
                  <div>
                    <Label>כתובת מייל נמען</Label>
                    <Input
                      type="email"
                      placeholder="example@email.com"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label className="flex items-center gap-1">
                      העתק (CC)
                      <span className="text-xs text-gray-400 font-normal">- הפרד מיילים בנקודה-פסיק</span>
                    </Label>
                    <Input
                      placeholder="email1@example.com; email2@example.com"
                      value={ccEmail}
                      onChange={(e) => setCcEmail(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label>נושא המייל</Label>
                    <Input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label>תוכן המייל</Label>
                    <Textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      className="mt-1 min-h-[120px]"
                    />
                  </div>
                </>
              )}

              {communicationMethod === 'whatsapp' && (
                <div>
                  <Label>תוכן ההודעה</Label>
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="mt-1 min-h-[120px]"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {targetType === 'candidate' 
                      ? `ישלח ל: ${candidate?.phone_primary || 'אין טלפון'}`
                      : `ישלח ל: ${job?.contact_person_phone || 'אין טלפון'}`
                    }
                  </p>
                </div>
              )}

              {targetType === 'client' && communicationMethod === 'email' && (
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                  <Checkbox
                    id="attach-cv"
                    checked={attachCv}
                    onCheckedChange={setAttachCv}
                    disabled={!candidate?.resume_file_url}
                  />
                  <Label 
                    htmlFor="attach-cv" 
                    className="text-sm font-medium cursor-pointer"
                  >
                    {candidate?.resume_file_url 
                      ? `צרף קורות חיים (${candidate?.original_filename || 'cv.pdf'})`
                      : 'לא נמצא קובץ קורות חיים'}
                  </Label>
                </div>
              )}

              {targetType !== 'internal' && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <Checkbox
                    id="mark-contacted"
                    checked={markAsContacted}
                    onCheckedChange={setMarkAsContacted}
                  />
                  <Label 
                    htmlFor="mark-contacted" 
                    className="text-sm font-medium cursor-pointer"
                  >
                    סמן גם מועמד כ"ביצירת קשר"
                  </Label>
                </div>
              )}

              <div className="text-xs text-gray-500 bg-yellow-50 p-2 rounded border border-yellow-200">
                ⚠️ לאחר שליחת ההודעה, ההתאמה תוסר אוטומטית מהרשימה
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 justify-between pt-2">
            {step > 1 && (
              <Button variant="outline" onClick={handleBack} disabled={sending}>
                חזור
              </Button>
            )}
            <div className="flex gap-2 mr-auto">
              <Button variant="outline" onClick={onClose} disabled={sending}>
                ביטול
              </Button>
              {step === 5 && (
                <Button onClick={handleSend} disabled={sending} className="bg-blue-600 hover:bg-blue-700">
                  {sending ? (
                    <>
                      <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                      שולח...
                    </>
                  ) : (
                    <>
                      {communicationMethod === 'email' ? (
                        <Mail className="w-4 h-4 ml-2" />
                      ) : (
                        <MessageCircle className="w-4 h-4 ml-2" />
                      )}
                      שלח
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}