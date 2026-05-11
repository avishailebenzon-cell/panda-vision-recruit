import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, MessageSquare, Users, UserCheck, Loader2, Save, Building } from 'lucide-react';
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

export default function MessageTemplates({ currentUser }) {
  const [loadedStatuses, setLoadedStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userData, setUserData] = useState({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Load candidate statuses
        const statuses = await base44.entities.CandidateStatus.list('status_number');
        setLoadedStatuses(statuses);
        
        // Load user data for templates
        if (currentUser) {
          setUserData(currentUser);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
      setLoading(false);
    };

    loadData();
  }, [currentUser]);

  const handleTemplateChange = (key, value) => {
    setUserData(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSaveTemplates = async () => {
    setSaving(true);
    try {
      // Extract only template keys from userData
      const templateKeys = Object.keys(userData).filter(key => 
        key.includes('template') || key.includes('message') || key.includes('invitation') || key.includes('approval')
      );
      const templateData = {};
      templateKeys.forEach(key => {
        if (userData[key]) {
          templateData[key] = userData[key];
        }
      });
      
      await base44.auth.updateMe(templateData);
      toast.success('התבניות נשמרו בהצלחה');
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving templates:', error);
      toast.error('שגיאה בשמירת התבניות');
    }
    setSaving(false);
  };

  // Initialize template arrays
  const candidateTemplates = [];
  const clientTemplates = [];

  // Organize templates into 3 main categories
  const systemTemplates = [
    {
      title: "הזמנה ואישור משתמשים",
      templates: [
        { 
          key: 'invitation_message_hr', 
          label: 'הזמנת משתמש HR',
          defaultContent: `שלום,

הוזמנת להצטרף למערכת הגיוס של פנדה-טק כחלק מצוות ה-HR.

לחץ על הקישור הבא כדי להירשם למערכת:
{invitation_link}

בברכה,
צוות פנדה-טק`
        },
        { 
          key: 'invitation_message_client', 
          label: 'הזמנת לקוח',
          defaultContent: `שלום רב,

אנו שמחים להזמין אותך להצטרף למערכת הגיוס של פנדה-טק.

באמצעות המערכת תוכל לעקוב אחר תהליכי הגיוס, לצפות במועמדים רלוונטיים ולנהל את התקשורת איתנו בצורה נוחה ויעילה.

להרשמה לחץ על הקישור:
{invitation_link}

בברכה,
צוות פנדה-טק`
        },
        { 
          key: 'approval_message_hr', 
          label: 'אישור משתמש HR',
          defaultContent: `שלום {user_name},

שמחים לבשר לך שבקשתך לגישה למערכת פנדה-טק אושרה!

כעת תוכל להתחבר למערכת ולהתחיל לעבוד.

בהצלחה,
צוות פנדה-טק`
        },
        { 
          key: 'approval_message_client', 
          label: 'אישור לקוח',
          defaultContent: `שלום {user_name},

שמחים להודיע לך שהגישה שלך למערכת פנדה-טק אושרה.

כעת תוכל להתחבר ולצפות בסטטוס המועמדים שלך.

נשמח לעמוד לשירותך,
צוות פנדה-טק`
        },
      ]
    },
    {
      title: "הודעות לעובדי החברה",
      templates: [
        { 
          key: 'employee_job_whatsapp_template_1', 
          label: 'תבנית WhatsApp 1 (פורמלי)', 
          icon: <MessageSquare className="w-4 h-4 text-green-500" />,
          defaultContent: `שלום {employee_name},

להלן פרטי משרה חדשה שנפתחה:

משרה: {job_title}
לקוח: {client_name}
מיקום: {job_location}
סיווג ביטחוני: {security_clearance}

תיאור המשרה:
{job_description}

דרישות:
{job_requirements}

במידה ויש לך מועמדים מתאימים, אנא עדכן בהקדם.

בברכה,
פנדה-טק`
        },
        { 
          key: 'employee_job_whatsapp_template_2', 
          label: 'תבנית WhatsApp 2 (ידידותי)', 
          icon: <MessageSquare className="w-4 h-4 text-green-500" />,
          defaultContent: `היי {employee_name} 👋

יש לנו משרה חדשה שאולי תתאים למועמדים שלך!

🏢 {job_title} ב-{client_name}
📍 {job_location}
🔒 {security_clearance}

קצת על המשרה:
{job_description}

מה צריך:
{job_requirements}

יש לך מישהו בראש? תעדכן אותי 😊

תודה!
פנדה-טק`
        },
        { 
          key: 'employee_job_whatsapp_template_3', 
          label: 'תבנית WhatsApp 3 (יצירתי)', 
          icon: <MessageSquare className="w-4 h-4 text-green-500" />,
          defaultContent: `🔥 משרה חמה בדרך אליך {employee_name}!

✨ {job_title}
🏢 {client_name}
📍 {job_location}

💼 על מה מדובר:
{job_description}

🎯 מחפשים מישהו עם:
{job_requirements}

🔐 סיווג: {security_clearance}

יאללה, בוא נמצא את המועמד המושלם! 🚀

פנדה-טק 🐼`
        },
        { 
          key: 'employee_job_email_template_1', 
          label: 'תבנית מייל 1 (פורמלי)', 
          icon: <Mail className="w-4 h-4 text-blue-500" />,
          defaultContent: `שלום {employee_name},

אני מבקש להביא לידיעתך משרה חדשה שנפתחה לאחרונה.

פרטי המשרה:
━━━━━━━━━━━━━━━━━━━━━
תפקיד: {job_title}
חברה: {client_name}
מיקום: {job_location}
סיווג ביטחוני נדרש: {security_clearance}

תיאור התפקיד:
{job_description}

דרישות התפקיד:
{job_requirements}

אנא בדוק האם יש ברשותך מועמדים מתאימים לתפקיד זה ועדכן בהתאם.

בברכה,
צוות פנדה-טק`
        },
        { 
          key: 'employee_job_email_template_2', 
          label: 'תבנית מייל 2 (ידידותי)', 
          icon: <Mail className="w-4 h-4 text-blue-500" />,
          defaultContent: `היי {employee_name},

רציתי לשתף אותך במשרה מעניינת שנפתחה!

המשרה: {job_title}
אצל: {client_name}
איפה: {job_location}
סיווג: {security_clearance}

במה עוסק התפקיד:
{job_description}

מה מחפשים:
{job_requirements}

אם יש לך מישהו שיכול להתאים - אשמח לשמוע!

תודה,
פנדה-טק`
        },
        { 
          key: 'employee_job_email_template_3', 
          label: 'תבנית מייל 3 (יצירתי)', 
          icon: <Mail className="w-4 h-4 text-blue-500" />,
          defaultContent: `שלום {employee_name}! 🌟

משרה חדשה וחמה מחכה למועמד המושלם!

🎯 התפקיד: {job_title}
🏢 החברה: {client_name}
📍 המיקום: {job_location}
🔒 סיווג: {security_clearance}

מה הולכים לעשות שם:
{job_description}

מי שמתאים:
{job_requirements}

בוא נמצא ביחד את הכוכב הבא! ⭐

פנדה-טק 🐼`
        },
      ]
    }
  ];

  // Add client templates for sending CVs
  clientTemplates.push({
    title: "שליחת קורות חיים ללקוח",
    templates: [
        { 
          key: 'send_cv_whatsapp_template_1', 
          label: "תבנית WhatsApp (חברותי עם אמוג'יס)", 
          icon: <MessageSquare className="w-4 h-4 text-green-500" />,
          defaultContent: `היי {client_name}! 👋

יש לי מועמד מעולה בשבילך! 🌟

👤 {candidate_name}
📧 {candidate_email}
📱 {candidate_phone}
🔒 סיווג: {security_clearance}

💪 הכישורים שלו:
{skills_summary}

מצרף את קורות החיים 📎

מה דעתך? 🤔

פנדה-טק 🐼`
        },
        { 
          key: 'send_cv_whatsapp_template_2', 
          label: "תבנית WhatsApp (פשוט וישיר)", 
          icon: <MessageSquare className="w-4 h-4 text-green-500" />,
          defaultContent: `שלום {client_name},

שולח לך קורות חיים של מועמד רלוונטי.

שם: {candidate_name}
טלפון: {candidate_phone}
מייל: {candidate_email}
סיווג: {security_clearance}

רקע מקצועי:
{skills_summary}

קורות החיים מצורפים.

פנדה-טק`
        },
        { 
          key: 'send_cv_whatsapp_template_3', 
          label: "תבנית WhatsApp (נלהב ומעודד)", 
          icon: <MessageSquare className="w-4 h-4 text-green-500" />,
          defaultContent: `{client_name}, יש לי בשורות טובות! 🎉

מצאתי מועמד שנראה לי מושלם למה שאתם מחפשים!

🌟 הכירו את {candidate_name}!

📞 {candidate_phone}
✉️ {candidate_email}
🔐 {security_clearance}

ההתמחות שלו:
{skills_summary}

אני ממש מתרגש מההתאמה הזו! 🚀
קורות החיים מצורפים - תעיף מבט ותגיד לי מה אתה חושב!

פנדה-טק 🐼`
        },
        { 
          key: 'send_cv_email_template_1', 
          label: "תבנית מייל (פורמלי ומקצועי)", 
          icon: <Mail className="w-4 h-4 text-blue-500" />,
          defaultContent: `לכבוד {client_name},

הנדון: הצגת מועמד - {candidate_name}

אני מתכבד להציג בפניכם מועמד איכותי לתפקיד הפתוח אצלכם.

פרטי המועמד:
━━━━━━━━━━━━━━━━━━━━━
שם מלא: {candidate_name}
דואר אלקטרוני: {candidate_email}
טלפון: {candidate_phone}
סיווג ביטחוני: {security_clearance}

רקע מקצועי:
{skills_summary}

קורות החיים המלאים מצורפים למייל זה.

אשמח לתאם שיחת היכרות בהקדם.

בברכה,
צוות פנדה-טק`
        },
        { 
          key: 'send_cv_email_template_2', 
          label: "תבנית מייל (חברותי ואישי)", 
          icon: <Mail className="w-4 h-4 text-blue-500" />,
          defaultContent: `היי {client_name},

איך הולך? רציתי להציג לך מועמד שנראה לי מתאים מאוד למה שאתם מחפשים.

הכירו את {candidate_name}!

פרטים ליצירת קשר:
📧 {candidate_email}
📱 {candidate_phone}
🔒 סיווג: {security_clearance}

קצת על הרקע המקצועי:
{skills_summary}

מצרף את קורות החיים המלאים - אשמח לשמוע מה דעתך!

תודה,
פנדה-טק`
        },
        { 
          key: 'send_cv_email_template_3', 
          label: "תבנית מייל (קצר ולעניין)", 
          icon: <Mail className="w-4 h-4 text-blue-500" />,
          defaultContent: `שלום {client_name},

מועמד חדש: {candidate_name}
טלפון: {candidate_phone} | מייל: {candidate_email}
סיווג: {security_clearance}

התמחות: {skills_summary}

קו"ח מצורפים.

פנדה-טק`
        },
      ]
  });

  // הוספת קבוצות תבניות דינמיות למועמדים ולקוחות
  if (loadedStatuses.length > 0) {
    candidateTemplates.push({
      title: "הודעות מייל למועמדים לפי מצב בתהליך הגיוס",
      icon: <Users className="w-5 h-5 text-purple-600" />,
      templates: loadedStatuses.map(status => {
        // Generate appropriate content based on status name
        let statusContent = '';
        const statusName = status.status_name || '';
        
        if (statusName.includes('חדש') || statusName.includes('התקבל')) {
          statusContent = `תודה רבה על שליחת קורות החיים שלך למשרת {job_title} אצל {client_name}.

קורות החיים שלך התקבלו בהצלחה ונמצאים כעת בבדיקה ראשונית.

נחזור אליך בהקדם האפשרי עם עדכונים.`;
        } else if (statusName.includes('בבדיקה') || statusName.includes('בטיפול')) {
          statusContent = `קורות החיים שלך למשרת {job_title} אצל {client_name} נמצאים כעת בבדיקה מעמיקה.

אנחנו בוחנים את התאמתך לדרישות התפקיד ונעדכן אותך בהמשך התהליך.`;
        } else if (statusName.includes('ראיון') || statusName.includes('שיחה')) {
          statusContent = `שמחים לבשר לך שהלקוח {client_name} מעוניין לקדם אותך לשלב הבא בתהליך הגיוס למשרת {job_title}.

נחזור אליך בהקדם לתיאום ראיון/שיחת היכרות.`;
        } else if (statusName.includes('מועבר ללקוח') || statusName.includes('הועבר')) {
          statusContent = `שמחים לעדכן שקורות החיים שלך הועברו ללקוח {client_name} למשרת {job_title}.

נמתין לחזרה מהלקוח ונעדכן אותך בהמשך.`;
        } else if (statusName.includes('מאושר') || statusName.includes('מתאים')) {
          statusContent = `בשורות טובות! הלקוח {client_name} סימן אותך כמועמד מתאים למשרת {job_title}.

נחזור אליך בקרוב לגבי השלבים הבאים בתהליך.`;
        } else if (statusName.includes('לא מתאים') || statusName.includes('נדחה')) {
          statusContent = `לצערנו, לאחר בדיקה מעמיקה, הלקוח {client_name} החליט שלא להמשיך עם המועמדות שלך למשרת {job_title}.

אנחנו ממשיכים לחפש עבורך הזדמנויות מתאימות נוספות.`;
        } else if (statusName.includes('הצלחה') || statusName.includes('התקבל לעבודה')) {
          statusContent = `מזל טוב! 🎉

שמחים לבשר לך שהתקבלת למשרת {job_title} אצל {client_name}!

נשמח לשמוע איך מתנהל תהליך השילוב בארגון.`;
        } else {
          statusContent = `זהו עדכון בנוגע לתהליך הגיוס שלך למשרת {job_title} אצל {client_name}.

הסטטוס הנוכחי הוא: ${status.status_name}

נמשיך לעדכן אותך בהתפתחויות.`;
        }
        
        return {
          key: `candidate_status_${status.status_number}_email_template`,
          label: `תבנית מייל למועמד - ${status.status_name}`,
          icon: <Mail className="w-4 h-4 text-blue-500" />,
          statusName: status.status_name,
          statusNumber: status.status_number,
          defaultContent: `שלום {candidate_name},

${statusContent}

בברכה,
צוות הגיוס
פנדה-טק`
        };
      })
    });

    candidateTemplates.push({
      title: "הודעות WhatsApp למועמדים לפי מצב בתהליך הגיוס", 
      icon: <MessageSquare className="w-5 h-5 text-green-600" />,
      templates: loadedStatuses.map(status => {
        const statusName = status.status_name || '';
        let statusContent = '';
        
        // Use same content as email templates for consistency
        if (statusName.includes('חדש') || statusName.includes('התקבל')) {
          statusContent = `תודה רבה על שליחת קורות החיים שלך למשרת {job_title} אצל {client_name}.

קורות החיים שלך התקבלו בהצלחה ונמצאים כעת בבדיקה ראשונית.

נחזור אליך בהקדם האפשרי עם עדכונים.`;
        } else if (statusName.includes('בבדיקה') || statusName.includes('בטיפול')) {
          statusContent = `קורות החיים שלך למשרת {job_title} אצל {client_name} נמצאים כעת בבדיקה מעמיקה.

אנחנו בוחנים את התאמתך לדרישות התפקיד ונעדכן אותך בהמשך התהליך.`;
        } else if (statusName.includes('ראיון') || statusName.includes('שיחה')) {
          statusContent = `שמחים לבשר לך שהלקוח {client_name} מעוניין לקדם אותך לשלב הבא בתהליך הגיוס למשרת {job_title}.

נחזור אליך בהקדם לתיאום ראיון/שיחת היכרות.`;
        } else if (statusName.includes('מועבר ללקוח') || statusName.includes('הועבר')) {
          statusContent = `שמחים לעדכן שקורות החיים שלך הועברו ללקוח {client_name} למשרת {job_title}.

נמתין לחזרה מהלקוח ונעדכן אותך בהמשך.`;
        } else if (statusName.includes('מאושר') || statusName.includes('מתאים')) {
          statusContent = `בשורות טובות! הלקוח {client_name} סימן אותך כמועמד מתאים למשרת {job_title}.

נחזור אליך בקרוב לגבי השלבים הבאים בתהליך.`;
        } else if (statusName.includes('לא מתאים') || statusName.includes('נדחה')) {
          statusContent = `לצערנו, לאחר בדיקה מעמיקה, הלקוח {client_name} החליט שלא להמשיך עם המועמדות שלך למשרת {job_title}.

אנחנו ממשיכים לחפש עבורך הזדמנויות מתאימות נוספות.`;
        } else if (statusName.includes('הצלחה') || statusName.includes('התקבל לעבודה')) {
          statusContent = `מזל טוב! 🎉

שמחים לבשר לך שהתקבלת למשרת {job_title} אצל {client_name}!

נשמח לשמוע איך מתנהל תהליך השילוב בארגון.`;
        } else {
          statusContent = `זהו עדכון בנוגע לתהליך הגיוס שלך למשרת {job_title} אצל {client_name}.

הסטטוס הנוכחי הוא: ${status.status_name}

נמשיך לעדכן אותך בהתפתחויות.`;
        }
        
        return {
          key: `candidate_status_${status.status_number}_whatsapp_template`,
          label: `תבנית WhatsApp למועמד - ${status.status_name}`,
          icon: <MessageSquare className="w-4 h-4 text-green-500" />,
          statusName: status.status_name,
          statusNumber: status.status_number,
          defaultContent: `שלום {candidate_name},

${statusContent}

בברכה,
צוות הגיוס
פנדה-טק`
        };
      })
    });

    clientTemplates.push({
      title: "הודעות ללקוחות לפי מצב בתהליך הגיוס - מייל",
      icon: <UserCheck className="w-5 h-5 text-indigo-600" />,
      templates: loadedStatuses.map(status => {
        const statusName = status.status_name || '';
        let statusContent = '';
        
        if (statusName.includes('חדש') || statusName.includes('התקבל')) {
          statusContent = `קיבלנו מועמד חדש למשרת {job_title} שלכם.

המועמד {candidate_name} שלח את קורות החיים שלו והוא נמצא כעת בבדיקה ראשונית.

נעדכן אתכם לגבי המשך התהליך.`;
        } else if (statusName.includes('בבדיקה') || statusName.includes('בטיפול')) {
          statusContent = `המועמד {candidate_name} למשרת {job_title} נמצא כעת בבדיקה מעמיקה מצדנו.

אנו בוחנים את ההתאמה לדרישות התפקיד ונחזור אליכם בהמשך.`;
        } else if (statusName.includes('ראיון') || statusName.includes('שיחה')) {
          statusContent = `המועמד {candidate_name} למשרת {job_title} עבר בהצלחה את שלב הבדיקה הראשוני.

האם תרצו לתאם ראיון/שיחת היכרות עם המועמד?

אנא עדכנו אותנו לגבי זמינותכם.`;
        } else if (statusName.includes('מועבר ללקוח') || statusName.includes('הועבר')) {
          statusContent = `אנו מציגים בפניכם את המועמד {candidate_name} למשרת {job_title}.

קורות החיים מצורפים למייל זה.

נשמח לקבל חזרה מכם לגבי התאמת המועמד לדרישות שלכם.`;
        } else if (statusName.includes('מאושר') || statusName.includes('מתאים')) {
          statusContent = `תודה על האישור!

המועמד {candidate_name} סומן כמתאים למשרת {job_title}.

מהם השלבים הבאים? נשמח לקבל הנחיות להמשך התהליך.`;
        } else if (statusName.includes('לא מתאים') || statusName.includes('נדחה')) {
          statusContent = `תודה על העדכון לגבי המועמד {candidate_name} למשרת {job_title}.

המועמד סומן כלא מתאים וסגרנו את התהליך הזה.

נמשיך לחפש עבורכם מועמדים מתאימים יותר.`;
        } else if (statusName.includes('הצלחה') || statusName.includes('התקבל לעבודה')) {
          statusContent = `מזל טוב!

שמחים לשמוע שהמועמד {candidate_name} התקבל לעבודה במשרת {job_title} אצלכם.

תודה על האמון ונשמח לשתף פעולה גם בעתיד.`;
        } else if (statusName.includes('נסגר') || statusName.includes('הסתיים')) {
          statusContent = `תהליך הגיוס של המועמד {candidate_name} למשרת {job_title} הסתיים.

אם יש לכם צרכי גיוס נוספים, נשמח לסייע.`;
        } else {
          statusContent = `עדכון בנוגע למועמד {candidate_name} למשרת {job_title}.

הסטטוס הנוכחי: ${status.status_name}

נמשיך לעדכן אתכם לגבי התקדמות התהליך.`;
        }
        
        return {
          key: `client_status_${status.status_number}_email_template`,
          label: `תבנית מייל ללקוח - ${status.status_name}`,
          icon: <Mail className="w-4 h-4 text-blue-500" />,
          statusName: status.status_name,
          statusNumber: status.status_number,
          defaultContent: `שלום {client_name},

${statusContent}

בברכה,
צוות פנדה-טק`
        };
      })
    });

    clientTemplates.push({
      title: "הודעות ללקוחות לפי מצב בתהליך הגיוס - WhatsApp",
      icon: <MessageSquare className="w-5 h-5 text-green-600" />,
      templates: loadedStatuses.map(status => {
        const statusName = status.status_name || '';
        let statusContent = '';
        
        if (statusName.includes('חדש') || statusName.includes('התקבל')) {
          statusContent = `קיבלנו מועמד חדש למשרה שלכם: {candidate_name} 📝

נמצא בבדיקה ראשונית, נחזור אליכם בקרוב! ⏱️`;
        } else if (statusName.includes('בבדיקה') || statusName.includes('בטיפול')) {
          statusContent = `{candidate_name} נמצא בבדיקה מעמיקה למשרת {job_title} 🔍

נעדכן אתכם בהמשך!`;
        } else if (statusName.includes('ראיון') || statusName.includes('שיחה')) {
          statusContent = `{candidate_name} עבר את השלב הראשוני בהצלחה! ✅

מעוניינים לתאם ראיון? 📞`;
        } else if (statusName.includes('מועבר ללקוח') || statusName.includes('הועבר')) {
          statusContent = `שלחנו אליכם את קורות החיים של {candidate_name} למשרת {job_title} ✉️

נשמח לשמוע מה דעתכם! 🤔`;
        } else if (statusName.includes('מאושר') || statusName.includes('מתאים')) {
          statusContent = `תודה על האישור! 🎉

{candidate_name} סומן כמתאים.

מה השלבים הבאים? 🚀`;
        } else if (statusName.includes('לא מתאים') || statusName.includes('נדחה')) {
          statusContent = `קיבלנו - {candidate_name} לא התאים הפעם ✓

ממשיכים לחפש מועמדים מתאימים יותר! 💪`;
        } else if (statusName.includes('הצלחה') || statusName.includes('התקבל לעבודה')) {
          statusContent = `כל הכבוד! 🎊

{candidate_name} התקבל לעבודה אצלכם! 

מאחלים הצלחה משותפת! 🌟`;
        } else if (statusName.includes('נסגר') || statusName.includes('הסתיים')) {
          statusContent = `תהליך {candidate_name} למשרת {job_title} הסתיים ✓

יש צרכי גיוס נוספים? נשמח לסייע! 🤝`;
        } else {
          statusContent = `עדכון מהיר: {candidate_name} - "${status.status_name}" 📊

נמשיך לעדכן אתכם!`;
        }
        
        return {
          key: `client_status_${status.status_number}_whatsapp_template`,
          label: `תבנית WhatsApp ללקוח - ${status.status_name}`,
          icon: <MessageSquare className="w-4 h-4 text-green-500" />,
          statusName: status.status_name,
          statusNumber: status.status_number,
          defaultContent: `היי {client_name} 👋

${statusContent}

פנדה-טק 🐼`
        };
      })
    });
  }

  // הוספת בדיקת null לנתוני המשתמש
  if (!userData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-6 h-6 text-blue-600" />
            ניהול תבניות הודעות
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            {loading ? (
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            ) : (
              <div className="text-gray-500">טוען נתוני תבניות...</div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-6 h-6 text-blue-600" />
            ניהול תבניות הודעות
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderTemplateGroup = (templates) => (
    <Accordion type="multiple" defaultValue={templates.map((_, i) => `item-${i}`)}>
      {templates.map((group, index) => (
        <AccordionItem key={index} value={`item-${index}`}>
          <AccordionTrigger className="font-semibold">
            <div className="flex items-center gap-2">
              {group.icon}
              {group.title}
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-6">
              {group.templates.map(template => {
                const templateValue = userData[template.key] || template.defaultContent || '';
                const isWhatsApp = template.key.includes('whatsapp');
                const isEmail = template.key.includes('email');
                
                return (
                  <div key={template.key} className={`p-4 rounded-lg border-2 ${
                    isWhatsApp ? 'bg-green-50/50 border-green-200' : 
                    isEmail ? 'bg-blue-50/50 border-blue-200' : 
                    'bg-gray-50 border-gray-200'
                  }`}>
                    <Label htmlFor={template.key} className="flex items-center gap-2 mb-2">
                      <div className={`p-1.5 rounded-lg ${
                        isWhatsApp ? 'bg-green-100' : 
                        isEmail ? 'bg-blue-100' : 
                        'bg-gray-100'
                      }`}>
                        {template.icon}
                      </div>
                      <span className="font-semibold">{template.label}</span>
                      {template.statusName && (
                        <span className="text-xs text-gray-500 mr-auto">({template.statusName})</span>
                      )}
                      <div className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        isWhatsApp ? 'bg-green-600 text-white' : 
                        isEmail ? 'bg-blue-600 text-white' : 
                        'bg-gray-600 text-white'
                      }`}>
                        {isWhatsApp ? '💬 WhatsApp' : isEmail ? '📧 Email' : '📝 כללי'}
                      </div>
                    </Label>
                    <Textarea
                      id={template.key}
                      value={templateValue}
                      onChange={(e) => handleTemplateChange(template.key, e.target.value)}
                      rows={8}
                      className="mt-2 text-sm font-mono bg-white"
                      placeholder={template.defaultContent || `הזן תבנית עבור ${template.label}...`}
                    />
                    <div className="text-xs text-gray-500 mt-2">
                      {template.statusName ? (
                        <>משתנים זמינים: <code className="bg-gray-100 p-1 rounded">{`{candidate_name}`}</code>, <code className="bg-gray-100 p-1 rounded">{`{candidate_email}`}</code>, <code className="bg-gray-100 p-1 rounded">{`{candidate_phone}`}</code>, <code className="bg-gray-100 p-1 rounded">{`{job_title}`}</code>, <code className="bg-gray-100 p-1 rounded">{`{client_name}`}</code>, <code className="bg-gray-100 p-1 rounded">{`{status_name}`}</code>, <code className="bg-gray-100 p-1 rounded">{`{cv_received_date}`}</code>, <code className="bg-gray-100 p-1 rounded">{`{match_creation_date}`}</code></>
                      ) : (
                        template.key.includes('employee') ? (
                          <>משתנים זמינים: <code className="bg-gray-100 p-1 rounded">{`{employee_name}`}</code>, <code className="bg-gray-100 p-1 rounded">{`{job_title}`}</code>, <code className="bg-gray-100 p-1 rounded">{`{client_name}`}</code>, <code className="bg-gray-100 p-1 rounded">{`{job_location}`}</code>, <code className="bg-gray-100 p-1 rounded">{`{security_clearance}`}</code>, <code className="bg-gray-100 p-1 rounded">{`{job_description}`}</code>, <code className="bg-gray-100 p-1 rounded">{`{job_requirements}`}</code></>
                        ) : (
                          <>משתנים זמינים: <code className="bg-gray-100 p-1 rounded">{`{candidate_name}`}</code>, <code className="bg-gray-100 p-1 rounded">{`{candidate_email}`}</code>, <code className="bg-gray-100 p-1 rounded">{`{candidate_phone}`}</code>, <code className="bg-gray-100 p-1 rounded">{`{client_name}`}</code>, <code className="bg-gray-100 p-1 rounded">{`{security_clearance}`}</code>, <code className="bg-gray-100 p-1 rounded">{`{skills_summary}`}</code>, <code className="bg-gray-100 p-1 rounded">{`{cv_received_date}`}</code>, <code className="bg-gray-100 p-1 rounded">{`{match_creation_date}`}</code></>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="w-6 h-6 text-blue-600" />
            ניהול תבניות הודעות
          </div>
          {hasChanges && (
            <Button onClick={handleSaveTemplates} disabled={saving} className="bg-green-600 hover:bg-green-700">
              {saving ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Save className="w-4 h-4 ml-2" />}
              שמור שינויים
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="candidates" dir="rtl">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="candidates" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              הודעות למועמדים
            </TabsTrigger>
            <TabsTrigger value="clients" className="flex items-center gap-2">
              <Building className="w-4 h-4" />
              הודעות ללקוחות
            </TabsTrigger>
            <TabsTrigger value="system" className="flex items-center gap-2">
              <UserCheck className="w-4 h-4" />
              משתמשי מערכת
            </TabsTrigger>
          </TabsList>

          <TabsContent value="candidates">
            {renderTemplateGroup(candidateTemplates)}
          </TabsContent>

          <TabsContent value="clients">
            {renderTemplateGroup(clientTemplates)}
          </TabsContent>

          <TabsContent value="system">
            {renderTemplateGroup(systemTemplates)}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}