import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users,
  Bot,
  Mail,
  Search,
  Briefcase,
  Building,
  Send,
  CheckCircle,
  FileText,
  Database,
  ArrowRight,
  ArrowDown,
  Zap,
  Clock,
  Target,
  MessageSquare,
  Settings,
  Sparkles,
  Brain,
  Eye,
  AlertTriangle,
  Workflow
} from 'lucide-react';

const AGENTS = [
  {
    id: 'naama',
    name: 'נעמה',
    role: 'מאתרת התאמות',
    image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face',
    color: 'orange',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-300',
    textColor: 'text-orange-700',
    badgeColor: 'bg-orange-100 text-orange-800',
    description: 'סוכנת AI שמתמחה בחיפוש מועמדים מתאימים למשרות פתוחות',
    inputs: [
      { icon: Briefcase, text: 'משרות פעילות במערכת' },
      { icon: Users, text: 'מאגר המועמדים' },
      { icon: Database, text: 'דרישות המשרה והסיווג' }
    ],
    outputs: [
      { icon: Target, text: 'התאמות חדשות (Match)' },
      { icon: Sparkles, text: 'ציון התאמה (0-100)' },
      { icon: FileText, text: 'נימוקים להתאמה' }
    ],
    schedule: 'כל 5 שעות או לפי דרישה',
    automation: 'אוטומטי + ידני'
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
    description: 'סוכן AI שמחפש משרות מתאימות עבור מועמדים חדשים',
    inputs: [
      { icon: Users, text: 'מועמדים חדשים במערכת' },
      { icon: Briefcase, text: 'כל המשרות הפעילות' },
      { icon: FileText, text: 'כישורי המועמד וניסיונו' }
    ],
    outputs: [
      { icon: Target, text: 'התאמות חדשות (Match)' },
      { icon: Sparkles, text: 'ציון התאמה' },
      { icon: FileText, text: 'הסבר ההתאמה' }
    ],
    schedule: 'כל 5 שעות או לפי דרישה',
    automation: 'אוטומטי + ידני'
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
    description: 'סוכן אחראי על קליטת מיילים, סנכרון נתונים וניטור המערכת',
    inputs: [
      { icon: Mail, text: 'תיבת המייל jobs@pandatech' },
      { icon: FileText, text: 'קבצי קורות חיים (PDF/DOCX)' },
      { icon: Database, text: 'נתוני Pipedrive' }
    ],
    outputs: [
      { icon: Users, text: 'מועמדים חדשים במערכת' },
      { icon: Building, text: 'לקוחות מעודכנים' },
      { icon: Briefcase, text: 'משרות מסונכרנות' }
    ],
    schedule: 'סריקת מיילים - כל 5 דקות',
    automation: 'אוטומטי מלא'
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
    description: 'סוכנת שמכינה ושולחת מיילים שבועיים עם משרות פעילות לעובדים',
    inputs: [
      { icon: Briefcase, text: 'משרות פעילות' },
      { icon: Settings, text: 'הגדרות הפצה ובונוס' },
      { icon: Mail, text: 'רשימת תפוצה' }
    ],
    outputs: [
      { icon: FileText, text: 'טיוטת מייל (2 גרסאות)' },
      { icon: Send, text: 'מייל לעובדים' },
      { icon: Sparkles, text: 'קריאה לפעולה' }
    ],
    schedule: 'יום א\' בשבוע',
    automation: 'דורש אישור כרמית'
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
    description: 'סוכנת שאחראית על בקרת איכות ואישור תוכן לפני שליחה',
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
    automation: 'בקרה אנושית + AI'
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
    description: 'סוכן שבודק שלמות נתונים של אנשי קשר ומדווח על חוסרים',
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
    automation: 'אוטומטי'
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
    description: 'צ\'אטבוט AI שעוזר למשתמשים עם שאלות על המערכת והגיוס',
    inputs: [
      { icon: MessageSquare, text: 'שאלות המשתמש' },
      { icon: Database, text: 'מידע על המערכת' },
      { icon: Brain, text: 'הקשר השיחה' }
    ],
    outputs: [
      { icon: MessageSquare, text: 'תשובות מותאמות' },
      { icon: Sparkles, text: 'המלצות פעולה' },
      { icon: FileText, text: 'הסברים ומדריכים' }
    ],
    schedule: 'זמין תמיד',
    automation: 'אינטראקטיבי'
  }
];

const WORKFLOW_STEPS = [
  {
    id: 1,
    title: 'קליטת קורות חיים',
    agent: 'raviv',
    description: 'רביב סורק את תיבת המייל ומעבד קורות חיים',
    icon: Mail
  },
  {
    id: 2,
    title: 'יצירת מועמד',
    agent: 'raviv',
    description: 'המערכת מחלצת פרטים ויוצרת כרטיס מועמד',
    icon: Users
  },
  {
    id: 3,
    title: 'חיפוש התאמות',
    agent: 'naama',
    description: 'נעמה מחפשת משרות מתאימות למועמד',
    icon: Search
  },
  {
    id: 4,
    title: 'חיפוש הפוך',
    agent: 'roee',
    description: 'רועי מחפש מועמדים למשרות חדשות',
    icon: Target
  },
  {
    id: 5,
    title: 'הפצת משרות',
    agent: 'hila',
    description: 'הילה מכינה מייל שבועי עם משרות',
    icon: Send
  },
  {
    id: 6,
    title: 'אישור תוכן',
    agent: 'carmit',
    description: 'כרמית מאשרת את התוכן לפני שליחה',
    icon: CheckCircle
  }
];

export default function AgentsGuide() {
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [activeTab, setActiveTab] = useState('agents');

  const AgentCard = ({ agent, isSelected, onClick }) => (
    <Card 
      className={`cursor-pointer transition-all duration-300 hover:shadow-lg ${agent.bgColor} ${agent.borderColor} border-2 ${isSelected ? 'ring-2 ring-offset-2 ring-blue-500 scale-105' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <img 
            src={agent.image} 
            alt={agent.name}
            className="w-14 h-14 rounded-full object-cover border-3 border-white shadow-md"
          />
          <div className="flex-1">
            <h3 className={`font-bold text-lg ${agent.textColor}`}>{agent.name}</h3>
            <Badge className={agent.badgeColor}>{agent.role}</Badge>
          </div>
          <Bot className={`w-6 h-6 ${agent.textColor} opacity-50`} />
        </div>
        <p className="text-sm text-gray-600 mt-3 line-clamp-2">{agent.description}</p>
      </CardContent>
    </Card>
  );

  const AgentDetail = ({ agent }) => (
    <Card className={`${agent.bgColor} ${agent.borderColor} border-2`}>
      <CardHeader>
        <div className="flex items-center gap-4">
          <img 
            src={agent.image} 
            alt={agent.name}
            className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg"
          />
          <div>
            <CardTitle className={`text-2xl ${agent.textColor}`}>{agent.name}</CardTitle>
            <Badge className={`${agent.badgeColor} text-base px-3 py-1 mt-1`}>{agent.role}</Badge>
            <p className="text-gray-600 mt-2">{agent.description}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Inputs */}
          <div className="bg-white/70 rounded-xl p-4 shadow-sm">
            <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <ArrowRight className="w-5 h-5 text-green-600" />
              קלטים (Inputs)
            </h4>
            <ul className="space-y-2">
              {agent.inputs.map((input, i) => (
                <li key={i} className="flex items-center gap-2 text-gray-700">
                  <input.icon className="w-4 h-4 text-green-600" />
                  <span>{input.text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Outputs */}
          <div className="bg-white/70 rounded-xl p-4 shadow-sm">
            <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <ArrowDown className="w-5 h-5 text-blue-600" />
              פלטים (Outputs)
            </h4>
            <ul className="space-y-2">
              {agent.outputs.map((output, i) => (
                <li key={i} className="flex items-center gap-2 text-gray-700">
                  <output.icon className="w-4 h-4 text-blue-600" />
                  <span>{output.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Schedule & Automation */}
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2 bg-white/70 px-4 py-2 rounded-lg">
            <Clock className="w-5 h-5 text-amber-600" />
            <span className="text-sm"><strong>תזמון:</strong> {agent.schedule}</span>
          </div>
          <div className="flex items-center gap-2 bg-white/70 px-4 py-2 rounded-lg">
            <Zap className="w-5 h-5 text-purple-600" />
            <span className="text-sm"><strong>אוטומציה:</strong> {agent.automation}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const WorkflowDiagram = () => (
    <div className="space-y-4">
      {WORKFLOW_STEPS.map((step, index) => {
        const agent = AGENTS.find(a => a.id === step.agent);
        return (
          <div key={step.id} className="flex items-center gap-4">
            {/* Step number */}
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white flex items-center justify-center font-bold text-lg shadow-lg flex-shrink-0">
              {step.id}
            </div>
            
            {/* Connector line */}
            {index < WORKFLOW_STEPS.length - 1 && (
              <div className="absolute right-5 mt-14 w-0.5 h-8 bg-gradient-to-b from-blue-400 to-purple-400" style={{ marginRight: '14px' }} />
            )}

            {/* Step card */}
            <Card className={`flex-1 ${agent?.bgColor || 'bg-gray-50'} border ${agent?.borderColor || 'border-gray-200'}`}>
              <CardContent className="p-4 flex items-center gap-4">
                {agent && (
                  <img 
                    src={agent.image}
                    alt={agent.name}
                    className="w-12 h-12 rounded-full object-cover border-2 border-white shadow"
                  />
                )}
                <div className="flex-1">
                  <h4 className="font-bold text-gray-800">{step.title}</h4>
                  <p className="text-sm text-gray-600">{step.description}</p>
                </div>
                <step.icon className={`w-8 h-8 ${agent?.textColor || 'text-gray-500'} opacity-70`} />
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-4 md:p-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-3 bg-white px-6 py-3 rounded-full shadow-lg mb-4">
          <Bot className="w-8 h-8 text-blue-600" />
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            צוות הסוכנים של PandaRecruitAI
          </h1>
        </div>
        <p className="text-gray-600 max-w-2xl mx-auto">
          הכירו את צוות הסוכנים החכמים שעובדים יחד כדי לייעל את תהליך הגיוס
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="max-w-6xl mx-auto">
        <TabsList className="grid grid-cols-3 mb-6">
          <TabsTrigger value="agents" className="gap-2">
            <Users className="w-4 h-4" />
            הסוכנים
          </TabsTrigger>
          <TabsTrigger value="workflow" className="gap-2">
            <Workflow className="w-4 h-4" />
            תהליך העבודה
          </TabsTrigger>
          <TabsTrigger value="overview" className="gap-2">
            <Eye className="w-4 h-4" />
            סקירה כללית
          </TabsTrigger>
        </TabsList>

        {/* Agents Tab */}
        <TabsContent value="agents" className="space-y-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {AGENTS.map(agent => (
              <AgentCard 
                key={agent.id}
                agent={agent}
                isSelected={selectedAgent?.id === agent.id}
                onClick={() => setSelectedAgent(selectedAgent?.id === agent.id ? null : agent)}
              />
            ))}
          </div>

          {selectedAgent && (
            <div className="mt-6 animate-in slide-in-from-top duration-300">
              <AgentDetail agent={selectedAgent} />
            </div>
          )}
        </TabsContent>

        {/* Workflow Tab */}
        <TabsContent value="workflow">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Workflow className="w-6 h-6 text-blue-600" />
                תהליך הגיוס האוטומטי
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WorkflowDiagram />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="grid md:grid-cols-2 gap-6">
            {/* How it works */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-600" />
                  איך זה עובד?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold">קליטה אוטומטית</h4>
                    <p className="text-sm text-gray-600">רביב סורק מיילים וקולט קורות חיים באופן אוטומטי</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <Search className="w-4 h-4 text-orange-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold">התאמה חכמה</h4>
                    <p className="text-sm text-gray-600">נעמה ורועי מחפשים התאמות בין מועמדים למשרות</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center flex-shrink-0">
                    <Send className="w-4 h-4 text-pink-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold">הפצה ותקשורת</h4>
                    <p className="text-sm text-gray-600">הילה מפיצה משרות וכרמית מאשרת תוכן</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold">תמיכה אישית</h4>
                    <p className="text-sm text-gray-600">פנדי זמין לעזור עם כל שאלה על המערכת</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-600" />
                  יתרונות המערכת
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-xl">
                  <div className="text-3xl font-bold text-blue-700">24/7</div>
                  <div className="text-sm text-blue-600">עבודה רציפה ללא הפסקה</div>
                </div>
                <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-xl">
                  <div className="text-3xl font-bold text-green-700">7 סוכנים</div>
                  <div className="text-sm text-green-600">עובדים יחד בסנכרון מלא</div>
                </div>
                <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-xl">
                  <div className="text-3xl font-bold text-purple-700">100%</div>
                  <div className="text-sm text-purple-600">אוטומציה של תהליכים שגרתיים</div>
                </div>
                <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-4 rounded-xl">
                  <div className="text-3xl font-bold text-orange-700">AI</div>
                  <div className="text-sm text-orange-600">התאמות חכמות מבוססות בינה מלאכותית</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}