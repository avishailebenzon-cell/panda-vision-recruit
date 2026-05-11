import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


import {
  Users,
  Bot,
  Mail,
  Briefcase,
  Building,
  Send,
  CheckCircle,
  FileText,
  Database,
  ArrowRight,
  ArrowDown,
  Clock,
  Target,
  MessageSquare,
  Settings,
  Sparkles,
  Brain,
  Eye,
  AlertTriangle,
  HelpCircle,
  Play,
  Upload,
  BarChart3,
  Bell,
  Shield,
  Keyboard,
  Heart,
  Calendar,
  ArrowDownRight,
  GitBranch,
  History,
  Package,
  Loader2
} from 'lucide-react';

// Agent Configuration - Updated hierarchy structure
const AGENTS = [
  {
    id: 'yael',
    name: 'יעל',
    role: 'ציידת המועמדים',
    image: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=100&h=100&fit=crop&crop=face',
    color: 'green',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-300',
    textColor: 'text-green-700',
    badgeColor: 'bg-green-100 text-green-800',
    description: 'אחראית על קליטת מועמדים למערכת, ניהול מאגר המועמדים והפצת משרות לעובדים. יעל היא "השער" של המועמדים לחברה.',
    howToUse: 'דף המועמדים מציג את כל הפעילויות של יעל: דואר נכנס (קורות חיים חדשים), הילה (הפצת משרות), מאגר המועמדים וחיפוש.',
    subordinates: ['hila'],
    inputs: [
      { icon: Mail, text: 'קורות חיים מרביב' },
      { icon: Upload, text: 'העלאות ידניות' },
      { icon: Briefcase, text: 'משרות להפצה' }
    ],
    outputs: [
      { icon: Users, text: 'מועמדים במאגר' },
      { icon: Send, text: 'הפצת משרות (דרך הילה)' },
      { icon: Target, text: 'מועמדים לרכזי הגיוס' }
    ],
    schedule: 'תמיד פעילה',
    relatedScreens: ['מועמדים']
  },
  {
    id: 'hila',
    name: 'הילה',
    role: 'מפיצת משרות',
    image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face',
    color: 'pink',
    bgColor: 'bg-pink-50',
    borderColor: 'border-pink-300',
    textColor: 'text-pink-700',
    badgeColor: 'bg-pink-100 text-pink-800',
    description: 'קופירייטרית שמכינה ושולחת מיילים שבועיים עם משרות פעילות לעובדים. הילה עובדת תחת יעל ונותנת לה שירות הפצה.',
    howToUse: 'הילה נמצאת בתוך דף יעל (מועמדים) בטאב "הילה - הפצה". היא יוצרת טיוטות שכרמית מאשרת.',
    reportsTo: 'yael',
    inputs: [
      { icon: Briefcase, text: 'משרות פעילות מיעל' },
      { icon: Settings, text: 'הגדרות הפצה ובונוס' },
      { icon: Mail, text: 'רשימת תפוצה' }
    ],
    outputs: [
      { icon: FileText, text: 'טיוטת מייל (2 גרסאות)' },
      { icon: Send, text: 'מייל לעובדים' },
      { icon: Sparkles, text: 'קריאה לפעולה' }
    ],
    schedule: 'יום ה\' יוצרת טיוטה, יום א\' שולחת',
    relatedScreens: ['מועמדים (טאב הילה)']
  },
  {
    id: 'naama',
    name: 'נעמה',
    role: 'מאתרת מועמדים למשרות',
    image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face',
    color: 'orange',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-300',
    textColor: 'text-orange-700',
    badgeColor: 'bg-orange-100 text-orange-800',
    description: 'רכזת גיוס שעוברת על כל המשרות הפעילות ומחפשת מועמדים מתאימים מהמאגר. עובדת יחד עם רועי תחת צוות רכזי הגיוס.',
    howToUse: 'נעמה נמצאת בדף "רכזי גיוס". תצוגת "נעמה" מציגה התאמות לפי משרה - כל משרה והמועמדים המומלצים לה.',
    subordinates: ['rotem'],
    inputs: [
      { icon: Briefcase, text: 'משרות פעילות במערכת' },
      { icon: Users, text: 'מאגר המועמדים מיעל' },
      { icon: Database, text: 'דרישות המשרה והסיווג' }
    ],
    outputs: [
      { icon: Target, text: 'התאמות חדשות (Match)' },
      { icon: Sparkles, text: 'ציון התאמה (0-100)' },
      { icon: FileText, text: 'נימוקים להתאמה' }
    ],
    schedule: 'כל בוקר ב-07:30',
    relatedScreens: ['רכזי גיוס (טאב נעמה)']
  },
  {
    id: 'roee',
    name: 'רועי',
    role: 'מוצא משרות למועמדים',
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face',
    color: 'blue',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-300',
    textColor: 'text-blue-700',
    badgeColor: 'bg-blue-100 text-blue-800',
    description: 'רכז גיוס שעובר על כל המועמדים ומחפש להם משרות מתאימות. עובד יחד עם נעמה תחת צוות רכזי הגיוס.',
    howToUse: 'רועי נמצא בדף "רכזי גיוס". תצוגת "רועי" מציגה התאמות לפי מועמד - כל מועמד והמשרות המתאימות לו.',
    subordinates: ['rotem'],
    inputs: [
      { icon: Users, text: 'מועמדים חדשים מיעל' },
      { icon: Briefcase, text: 'כל המשרות הפעילות' },
      { icon: FileText, text: 'כישורי המועמד וניסיונו' }
    ],
    outputs: [
      { icon: Target, text: 'התאמות חדשות (Match)' },
      { icon: Sparkles, text: 'ציון התאמה' },
      { icon: FileText, text: 'הסבר ההתאמה' }
    ],
    schedule: 'כל ערב ב-17:30',
    relatedScreens: ['רכזי גיוס (טאב רועי)']
  },
  {
    id: 'rotem',
    name: 'טל',
    role: 'תקשורת מועמדים',
    image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop&crop=face',
    color: 'teal',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-300',
    textColor: 'text-teal-700',
    badgeColor: 'bg-teal-100 text-teal-800',
    description: 'אחראית על תקשורת וואטסאפ עם מועמדים. טל נותנת שירות לרכזי הגיוס (נעמה ורועי) ומטפלת בפניות מועמדים.',
    howToUse: 'טל נמצאת בדף "רכזי גיוס" בטאב "טל". ניתן לראות את כל השיחות עם מועמדים ולשוחח איתה על התנהגות.',
    reportsTo: 'naama_roee',
    inputs: [
      { icon: Users, text: 'מועמדים מנעמה ורועי' },
      { icon: Briefcase, text: 'פרטי משרות' },
      { icon: MessageSquare, text: 'הודעות וואטסאפ' }
    ],
    outputs: [
      { icon: MessageSquare, text: 'שיחות עם מועמדים' },
      { icon: FileText, text: 'איסוף פרטים' },
      { icon: CheckCircle, text: 'עדכון סטטוס' }
    ],
    schedule: 'זמינה 24/7',
    relatedScreens: ['רכזי גיוס (טאב נועה)']
  },
  {
    id: 'raviv',
    name: 'רביב',
    role: 'מנהל מערכת',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
    color: 'gray',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-300',
    textColor: 'text-gray-700',
    badgeColor: 'bg-gray-100 text-gray-800',
    description: 'מנהל המערכת הראשי. אחראי על קליטת מיילים, סנכרון Pipedrive, ניטור תקינות וכל ההגדרות. הוא "מאחורי הקלעים".',
    howToUse: 'רביב נמצא בדף "ניהול". שם ניתן להגדיר קליטת מיילים, Pipedrive, ניהול משתמשים ועוד.',
    subordinates: ['dana', 'elad', 'carmit'],
    inputs: [
      { icon: Mail, text: 'תיבת המייל jobs@pandatech' },
      { icon: Database, text: 'נתוני Pipedrive' },
      { icon: Settings, text: 'הגדרות מערכת' }
    ],
    outputs: [
      { icon: Users, text: 'מועמדים ליעל' },
      { icon: Building, text: 'לקוחות ומשרות' },
      { icon: AlertTriangle, text: 'התראות מערכת' }
    ],
    schedule: 'סריקת מיילים - רציף',
    relatedScreens: ['ניהול']
  },
  {
    id: 'dana',
    name: 'דנה',
    role: 'מנהלת משרות ב-Pipedrive',
    image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=face',
    color: 'violet',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-300',
    textColor: 'text-violet-700',
    badgeColor: 'bg-violet-100 text-violet-800',
    description: 'אחראית על הוספת משרות חדשות ל-Pipedrive. דנה עובדת תחת רביב ונותנת שירות לדף המשרות.',
    howToUse: 'דנה נמצאת בדף המשרות. לחצו על "שיחה עם דנה" כדי להוסיף משרה חדשה ל-Pipedrive.',
    reportsTo: 'raviv',
    inputs: [
      { icon: Briefcase, text: 'פרטי משרה חדשה' },
      { icon: Building, text: 'פרטי לקוח' },
      { icon: FileText, text: 'דרישות ותנאים' }
    ],
    outputs: [
      { icon: Database, text: 'דיל ב-Pipedrive' },
      { icon: Briefcase, text: 'משרה במערכת' },
      { icon: CheckCircle, text: 'אישור יצירה' }
    ],
    schedule: 'לפי דרישה',
    relatedScreens: ['משרות']
  },
  {
    id: 'elad',
    name: 'אלעד',
    role: 'בודק נתוני לקוחות',
    image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
    color: 'indigo',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-300',
    textColor: 'text-indigo-700',
    badgeColor: 'bg-indigo-100 text-indigo-800',
    description: 'בודק שלמות נתונים של אנשי קשר ומדווח על פרטים חסרים. אלעד עובד תחת רביב.',
    howToUse: 'אלעד נמצא בדף "ניהול" > "אלעד - לקוחות". שם ניתן להגדיר תדירות בדיקות ולראות דוחות.',
    reportsTo: 'raviv',
    inputs: [
      { icon: Building, text: 'רשימת לקוחות' },
      { icon: Users, text: 'אנשי קשר' },
      { icon: Database, text: 'שדות חובה' }
    ],
    outputs: [
      { icon: Mail, text: 'דוח חוסרים במייל' },
      { icon: AlertTriangle, text: 'רשימת פרטים חסרים' },
      { icon: FileText, text: 'סטטיסטיקות' }
    ],
    schedule: 'לפי הגדרה',
    relatedScreens: ['ניהול (טאב אלעד)']
  },
  {
    id: 'carmit',
    name: 'כרמית',
    role: 'מאשרת תוכן',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face',
    color: 'purple',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-300',
    textColor: 'text-purple-700',
    badgeColor: 'bg-purple-100 text-purple-800',
    description: 'אחראית על בקרת איכות ואישור תוכן. כרמית מאשרת טיוטות של הילה ובודקת שהמיילים מקצועיים.',
    howToUse: 'כרמית עובדת ברקע. כשהילה יוצרת טיוטה, כרמית בוחרת את הגרסה הטובה ומאשרת אותה.',
    reportsTo: 'raviv',
    inputs: [
      { icon: FileText, text: 'טיוטות מהילה' },
      { icon: Eye, text: 'בדיקת תוכן ואיכות' },
      { icon: AlertTriangle, text: 'כללי איכות' }
    ],
    outputs: [
      { icon: CheckCircle, text: 'אישור/דחייה' },
      { icon: FileText, text: 'הערות לתיקון' },
      { icon: Send, text: 'אישור לשליחה' }
    ],
    schedule: 'לפי דרישה',
    relatedScreens: ['פועלת ברקע']
  },
  {
    id: 'shiri',
    name: 'שירי',
    role: 'קשרי עובדים',
    image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop&crop=face',
    color: 'rose',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-300',
    textColor: 'text-rose-700',
    badgeColor: 'bg-rose-100 text-rose-800',
    description: 'אחראית על קשרי עובדים ופניות עובדים. שירי מנהלת את מערכת משאבי האנוש.',
    howToUse: 'שירי נמצאת בדף "קשרי עובדים" בתפריט משאבי אנוש.',
    inputs: [
      { icon: Users, text: 'פניות עובדים' },
      { icon: Heart, text: 'בקשות ותלונות' },
      { icon: FileText, text: 'מסמכים' }
    ],
    outputs: [
      { icon: MessageSquare, text: 'מענה לעובדים' },
      { icon: CheckCircle, text: 'טיפול בבקשות' },
      { icon: FileText, text: 'תיעוד' }
    ],
    schedule: 'זמינה בשעות העבודה',
    relatedScreens: ['קשרי עובדים']
  },
  {
    id: 'inbar',
    name: 'ענבר',
    role: 'תכנון משאבי אנוש',
    image: 'https://images.unsplash.com/photo-1551836022-deb4988cc6c0?w=100&h=100&fit=crop&crop=face',
    color: 'purple',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-300',
    textColor: 'text-purple-700',
    badgeColor: 'bg-purple-100 text-purple-800',
    description: 'אחראית על תכנון תקציב משאבי אנוש ומעקב הוצאות. ענבר מנהלת את תוכנית המשא"ן.',
    howToUse: 'ענבר נמצאת בדף "תוכנית משא"ן" בתפריט משאבי אנוש.',
    inputs: [
      { icon: Calendar, text: 'תכנון שנתי' },
      { icon: Users, text: 'מצבת עובדים' },
      { icon: Database, text: 'נתוני הוצאות' }
    ],
    outputs: [
      { icon: BarChart3, text: 'דוחות תקציב' },
      { icon: FileText, text: 'תחזיות' },
      { icon: AlertTriangle, text: 'התראות חריגה' }
    ],
    schedule: 'מעקב שוטף',
    relatedScreens: ['תוכנית משא"ן']
  },
  {
    id: 'pandi',
    name: 'פנדי',
    role: 'עוזר אישי',
    image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop&crop=face',
    color: 'green',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-300',
    textColor: 'text-green-700',
    badgeColor: 'bg-green-100 text-green-800',
    description: 'צ\'אטבוט AI שעוזר לכם עם כל שאלה על המערכת. זמין 24/7 בכל מסך.',
    howToUse: 'לחצו על בועת הצ\'אט בפינה השמאלית התחתונה בכל מסך ושאלו כל שאלה!',
    inputs: [
      { icon: MessageSquare, text: 'שאלות שלכם' },
      { icon: Database, text: 'מידע על המערכת' },
      { icon: Brain, text: 'הקשר השיחה' }
    ],
    outputs: [
      { icon: MessageSquare, text: 'תשובות מותאמות' },
      { icon: Sparkles, text: 'המלצות פעולה' },
      { icon: FileText, text: 'הסברים ומדריכים' }
    ],
    schedule: 'זמין תמיד',
    relatedScreens: ['כל המסכים']
  }
];

// Hierarchy structure
const HIERARCHY = {
  title: 'מבנה הסוכנים והיחסים ביניהם',
  description: 'המערכת בנויה כך שכל סוכן נותן שירות לסוכנים אחרים. המיקום של כל סוכן בממשק משקף את ההירכיה והקשרים.',
  levels: [
    {
      name: 'מחלקת גיוס',
      color: 'blue',
      agents: [
        {
          id: 'yael',
          title: 'יעל - ציידת המועמדים',
          screen: 'מועמדים',
          subordinates: [
            { id: 'hila', title: 'הילה - הפצת משרות', note: 'טאב בתוך דף יעל' }
          ]
        },
        {
          id: 'matches',
          title: 'רכזי הגיוס',
          screen: 'רכזי גיוס',
          members: [
            { id: 'naama', title: 'נעמה - מועמדים למשרות' },
            { id: 'roee', title: 'רועי - משרות למועמדים' }
          ],
          subordinates: [
            { id: 'rotem', title: 'טל - תקשורת מועמדים', note: 'טאב בתוך דף רכזי גיוס' }
          ]
        },
        {
          id: 'dana',
          title: 'דנה - משרות ב-Pipedrive',
          screen: 'משרות',
          note: 'כפתור בדף המשרות'
        }
      ]
    },
    {
      name: 'ניהול מערכת',
      color: 'gray',
      agents: [
        {
          id: 'raviv',
          title: 'רביב - מנהל מערכת',
          screen: 'ניהול',
          subordinates: [
            { id: 'elad', title: 'אלעד - בודק לקוחות', note: 'טאב בניהול' },
            { id: 'carmit', title: 'כרמית - מאשרת תוכן', note: 'פועלת ברקע' }
          ]
        }
      ]
    },
    {
      name: 'משאבי אנוש',
      color: 'rose',
      agents: [
        { id: 'shiri', title: 'שירי - קשרי עובדים', screen: 'קשרי עובדים' },
        { id: 'inbar', title: 'ענבר - תכנון משא"ן', screen: 'תוכנית משא"ן' }
      ]
    }
  ]
};

// Quick start guide - Updated
const QUICK_START_STEPS = [
  {
    step: 1,
    title: 'רביב קולט קורות חיים',
    description: 'שלחו מיילים עם קורות חיים ל-jobs@pandatech.co.il. רביב סורק ומעביר ליעל.',
    agent: 'raviv',
    icon: Mail
  },
  {
    step: 2,
    title: 'יעל מקבלת את המועמדים',
    description: 'המועמדים מופיעים בדואר הנכנס של יעל. בדקו, סננו והעבירו לטיפול.',
    agent: 'yael',
    icon: Users
  },
  {
    step: 3,
    title: 'נעמה ורועי מוצאים התאמות',
    description: 'נעמה מחפשת מועמדים למשרות, רועי מחפש משרות למועמדים. התוצאות ברכזי הגיוס.',
    agent: 'naama',
    icon: Target
  },
  {
    step: 4,
    title: 'טל מתקשרת עם מועמדים',
    description: 'טל שולחת הודעות וואטסאפ למועמדים מתאימים ומטפלת בתשובות.',
    agent: 'rotem',
    icon: MessageSquare
  },
  {
    step: 5,
    title: 'הילה מפיצה משרות',
    description: 'בכל יום ראשון, הילה שולחת מייל משרות לעובדים (אחרי אישור כרמית).',
    agent: 'hila',
    icon: Send
  }
];

export default function HelpPage() {
  const [activeTab, setActiveTab] = useState('hierarchy');
  const [versions, setVersions] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  useEffect(() => {
    const loadVersions = async () => {
      setLoadingVersions(true);
      try {
        const versionsList = await base44.entities.SystemVersion.list('-created_date');
        setVersions(versionsList);
      } catch (error) {
        console.error('Error loading versions:', error);
      }
      setLoadingVersions(false);
    };

    loadVersions();
  }, []);

  const AgentMiniCard = ({ agent, onClick }) => (
    <div 
      className={`cursor-pointer p-3 rounded-xl ${agent.bgColor} ${agent.borderColor} border-2 hover:shadow-md transition-all`}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <img 
          src={agent.image} 
          alt={agent.name}
          className="w-12 h-12 rounded-full object-cover border-2 border-white shadow"
        />
        <div>
          <h4 className={`font-bold ${agent.textColor}`}>{agent.name}</h4>
          <Badge className={agent.badgeColor}>{agent.role}</Badge>
        </div>
      </div>
    </div>
  );

  const AgentDetailCard = ({ agent }) => (
    <Card className={`${agent.bgColor} ${agent.borderColor} border-2`}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-4">
          <img 
            src={agent.image} 
            alt={agent.name}
            className="w-16 h-16 rounded-full object-cover border-3 border-white shadow-lg"
          />
          <div>
            <CardTitle className={`text-xl ${agent.textColor}`}>{agent.name}</CardTitle>
            <Badge className={`${agent.badgeColor} mt-1`}>{agent.role}</Badge>
            {agent.reportsTo && (
              <p className="text-xs text-gray-500 mt-1">
                נותן/ת שירות ל: {agent.reportsTo === 'naama_roee' ? 'נעמה ורועי' : 
                  AGENTS.find(a => a.id === agent.reportsTo)?.name}
              </p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-gray-700">{agent.description}</p>
        
        <div className="bg-white/60 rounded-lg p-3">
          <h5 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
            <Play className="w-4 h-4" />
            איפה למצוא?
          </h5>
          <p className="text-sm text-gray-600">{agent.howToUse}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/60 rounded-lg p-3">
            <h5 className="font-semibold text-gray-800 mb-2 text-sm flex items-center gap-1">
              <ArrowRight className="w-3 h-3 text-green-600" />
              קלטים
            </h5>
            <ul className="text-xs space-y-1">
              {agent.inputs.map((input, i) => (
                <li key={i} className="flex items-center gap-1 text-gray-600">
                  <input.icon className="w-3 h-3 text-green-600" />
                  {input.text}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-white/60 rounded-lg p-3">
            <h5 className="font-semibold text-gray-800 mb-2 text-sm flex items-center gap-1">
              <ArrowDown className="w-3 h-3 text-blue-600" />
              פלטים
            </h5>
            <ul className="text-xs space-y-1">
              {agent.outputs.map((output, i) => (
                <li key={i} className="flex items-center gap-1 text-gray-600">
                  <output.icon className="w-3 h-3 text-blue-600" />
                  {output.text}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1 bg-white/60 px-2 py-1 rounded">
            <Clock className="w-3 h-3 text-amber-600" />
            {agent.schedule}
          </div>
          <div className="flex items-center gap-1 bg-white/60 px-2 py-1 rounded">
            <Eye className="w-3 h-3 text-purple-600" />
            {agent.relatedScreens.join(', ')}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-4 md:p-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-3 bg-white px-6 py-3 rounded-full shadow-lg mb-4">
          <HelpCircle className="w-8 h-8 text-blue-600" />
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            מדריך HRAI
          </h1>
        </div>
        <p className="text-gray-600 max-w-2xl mx-auto">
          הכירו את צוות הסוכנים החכמים ואת המבנה ההירכי שלהם
        </p>
      </div>

      <div className="max-w-6xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-5 mb-6">
            <TabsTrigger value="hierarchy" className="gap-2">
              <GitBranch className="w-4 h-4" />
              מבנה המערכת
            </TabsTrigger>
            <TabsTrigger value="quickstart" className="gap-2">
              <Play className="w-4 h-4" />
              התחלה מהירה
            </TabsTrigger>
            <TabsTrigger value="agents" className="gap-2">
              <Bot className="w-4 h-4" />
              הסוכנים
            </TabsTrigger>
            <TabsTrigger value="versions" className="gap-2">
              <History className="w-4 h-4" />
              גרסאות
            </TabsTrigger>
            <TabsTrigger value="tips" className="gap-2">
              <Sparkles className="w-4 h-4" />
              טיפים
            </TabsTrigger>
          </TabsList>

          {/* Hierarchy Tab */}
          <TabsContent value="hierarchy" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="w-5 h-5 text-blue-600" />
                  {HIERARCHY.title}
                </CardTitle>
                <p className="text-gray-600 text-sm">{HIERARCHY.description}</p>
              </CardHeader>
              <CardContent className="space-y-8">
                {HIERARCHY.levels.map((level, levelIndex) => (
                  <div key={levelIndex} className={`p-4 rounded-xl bg-${level.color}-50 border border-${level.color}-200`}>
                    <h3 className={`font-bold text-lg mb-4 text-${level.color}-800 flex items-center gap-2`}>
                      {level.name === 'מחלקת גיוס' && <Briefcase className="w-5 h-5" />}
                      {level.name === 'ניהול מערכת' && <Settings className="w-5 h-5" />}
                      {level.name === 'משאבי אנוש' && <Heart className="w-5 h-5" />}
                      {level.name}
                    </h3>
                    
                    <div className="space-y-4">
                      {level.agents.map((item, itemIndex) => {
                        const agent = AGENTS.find(a => a.id === item.id);
                        
                        return (
                          <div key={itemIndex} className="bg-white rounded-lg p-4 shadow-sm">
                            {item.members ? (
                              // Group (like נעמה ורועי)
                              <div>
                                <div className="flex items-center gap-3 mb-3">
                                  <div className="flex -space-x-2">
                                    {item.members.map(member => {
                                      const memberAgent = AGENTS.find(a => a.id === member.id);
                                      return memberAgent && (
                                        <img 
                                          key={member.id}
                                          src={memberAgent.image}
                                          alt={memberAgent.name}
                                          className="w-10 h-10 rounded-full border-2 border-white shadow"
                                        />
                                      );
                                    })}
                                  </div>
                                  <div>
                                    <h4 className="font-semibold">{item.title}</h4>
                                    <Badge variant="outline">מסך: {item.screen}</Badge>
                                  </div>
                                </div>
                                <div className="text-sm text-gray-600 space-y-1 mr-6">
                                  {item.members.map(member => (
                                    <div key={member.id} className="flex items-center gap-2">
                                      <ArrowRight className="w-3 h-3 text-gray-400" />
                                      {member.title}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : agent ? (
                              // Single agent
                              <div className="flex items-center gap-3">
                                <img 
                                  src={agent.image}
                                  alt={agent.name}
                                  className="w-12 h-12 rounded-full border-2 border-white shadow"
                                />
                                <div>
                                  <h4 className="font-semibold">{item.title}</h4>
                                  <Badge variant="outline">מסך: {item.screen}</Badge>
                                  {item.note && <span className="text-xs text-gray-500 mr-2">({item.note})</span>}
                                </div>
                              </div>
                            ) : (
                              <div className="font-semibold">{item.title}</div>
                            )}
                            
                            {/* Subordinates */}
                            {item.subordinates && item.subordinates.length > 0 && (
                              <div className="mt-3 mr-8 pt-3 border-t border-gray-100">
                                <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                                  <ArrowDownRight className="w-3 h-3" />
                                  נותנים שירות:
                                </p>
                                <div className="space-y-2">
                                  {item.subordinates.map(sub => {
                                    const subAgent = AGENTS.find(a => a.id === sub.id);
                                    return (
                                      <div key={sub.id} className="flex items-center gap-2 text-sm">
                                        {subAgent && (
                                          <img 
                                            src={subAgent.image}
                                            alt={subAgent.name}
                                            className="w-8 h-8 rounded-full border border-gray-200"
                                          />
                                        )}
                                        <span>{sub.title}</span>
                                        {sub.note && <span className="text-xs text-gray-400">({sub.note})</span>}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* פנדי */}
                <div className="p-4 rounded-xl bg-green-50 border border-green-200">
                  <div className="flex items-center gap-3">
                    <img 
                      src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=60&h=60&fit=crop&crop=face"
                      alt="פנדי"
                      className="w-12 h-12 rounded-full border-2 border-white shadow"
                    />
                    <div>
                      <h4 className="font-semibold text-green-800">פנדי - עוזר אישי</h4>
                      <p className="text-sm text-green-600">זמין בכל מסך - לחצו על בועת הצ'אט בפינה השמאלית</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Quick Start Tab */}
          <TabsContent value="quickstart" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Play className="w-5 h-5 text-green-600" />
                  איך המערכת עובדת? 5 צעדים פשוטים
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {QUICK_START_STEPS.map((step, index) => {
                    const agent = AGENTS.find(a => a.id === step.agent);
                    return (
                      <div key={step.step} className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white flex items-center justify-center font-bold text-lg shadow flex-shrink-0">
                          {step.step}
                        </div>
                        <div className={`flex-1 p-4 rounded-xl ${agent ? agent.bgColor : 'bg-gray-50'} border ${agent ? agent.borderColor : 'border-gray-200'}`}>
                          <div className="flex items-center gap-3 mb-2">
                            {agent && (
                              <img 
                                src={agent.image}
                                alt={agent.name}
                                className="w-8 h-8 rounded-full object-cover border-2 border-white shadow"
                              />
                            )}
                            <h4 className="font-bold text-gray-800">{step.title}</h4>
                            <step.icon className={`w-5 h-5 ${agent ? agent.textColor : 'text-gray-500'} mr-auto`} />
                          </div>
                          <p className="text-sm text-gray-600">{step.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Agents Tab */}
          <TabsContent value="agents" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              {AGENTS.map(agent => (
                <AgentDetailCard key={agent.id} agent={agent} />
              ))}
            </div>
          </TabsContent>

          {/* Versions Tab */}
          <TabsContent value="versions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5 text-purple-600" />
                  היסטוריית גרסאות
                </CardTitle>
                <p className="text-gray-600 text-sm">תיעוד כל השינויים והשדרוגים במערכת</p>
              </CardHeader>
              <CardContent>
                {loadingVersions ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                  </div>
                ) : versions.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">אין גרסאות קודמות</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {versions.map((version, index) => (
                      <div 
                        key={version.id}
                        className={`p-4 rounded-xl border-2 ${
                          index === 0 
                            ? 'bg-gradient-to-r from-purple-50 to-blue-50 border-purple-300' 
                            : 'bg-white border-gray-200'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-full ${
                            index === 0 ? 'bg-purple-600' : 'bg-gray-400'
                          } text-white flex items-center justify-center font-bold flex-shrink-0`}>
                            {index === 0 ? <Sparkles className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-bold text-lg text-gray-900">גרסה {version.version}</h4>
                              {index === 0 && (
                                <Badge className="bg-purple-600 text-white">גרסה עדכנית</Badge>
                              )}
                              <span className="text-xs text-gray-500 mr-auto">
                                {new Date(version.created_date).toLocaleDateString('he-IL', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                            <div className="prose prose-sm max-w-none">
                              <div className="text-gray-700 whitespace-pre-wrap">{version.release_notes}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tips Tab */}
          <TabsContent value="tips">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Keyboard className="w-5 h-5 text-blue-600" />
                    קיצורי מקלדת
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span>פתיחת עזרה</span>
                    <kbd className="px-2 py-1 bg-gray-200 rounded text-sm font-mono">F1</kbd>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Bell className="w-5 h-5 text-amber-600" />
                    התראות וחיווי
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-sm">משימות דורשות טיפול</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <span className="text-sm">פריטים חדשים ממתינים</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-sm">סוכן פעיל/סריקה בריצה</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <MessageSquare className="w-5 h-5 text-green-600" />
                    צריכים עזרה?
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                    <img 
                      src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=50&h=50&fit=crop&crop=face"
                      alt="פנדי"
                      className="w-12 h-12 rounded-full border-2 border-white shadow"
                    />
                    <div>
                      <h4 className="font-semibold text-green-800">פנדי זמין לעזור!</h4>
                      <p className="text-sm text-green-600">לחצו על בועת הצ'אט בפינה השמאלית</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Shield className="w-5 h-5 text-purple-600" />
                    אבטחה וסיווג
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-gray-600">
                  <p>• המערכת מזהה אוטומטית רמת סיווג מקורות חיים</p>
                  <p>• ניתן לסנן מועמדים ומשרות לפי רמת סיווג</p>
                  <p>• התאמות מתחשבות ברמת הסיווג הנדרשת</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}