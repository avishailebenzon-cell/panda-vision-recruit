import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Bot, 
  Save, 
  Loader2, 
  MessageCircle, 
  Clock, 
  AlertTriangle,
  Plus,
  X,
  User,
  Settings,
  Sparkles,
  Building,
  Briefcase,
  ListChecks,
  MessageSquare,
  Ban,
  ArrowRight,
  Info
} from 'lucide-react';
import { toast } from 'sonner';

const AGENTS = [
  { id: 'rotem', name: 'רותם', role: 'רכזת גיוס - תקשורת מועמדים', image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=60&h=60&fit=crop&crop=face', color: 'teal' },
  { id: 'shiri', name: 'שירי', role: 'קשרי עובדים', image: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=60&h=60&fit=crop&crop=face', color: 'rose' },
  { id: 'hila', name: 'הילה', role: 'הפצת משרות', image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60&h=60&fit=crop&crop=face', color: 'pink' }
];

const PERSONALITY_OPTIONS = [
  { value: 'friendly', label: 'ידידותי וחם' },
  { value: 'professional', label: 'מקצועי' },
  { value: 'casual', label: 'קליל ולא פורמלי' },
  { value: 'formal', label: 'פורמלי ורשמי' }
];

const LANGUAGE_OPTIONS = [
  { value: 'formal', label: 'שפה גבוהה ורשמית' },
  { value: 'informal', label: 'שפה יומיומית' },
  { value: 'mixed', label: 'משולב' }
];

const EMOJI_OPTIONS = [
  { value: 'none', label: 'ללא אימוג\'ים' },
  { value: 'minimal', label: 'מעט (1-2 בהודעה)' },
  { value: 'moderate', label: 'בינוני' },
  { value: 'frequent', label: 'הרבה' }
];

const DEFAULT_FORBIDDEN_TOPICS = [
  'פרטי שכר ספציפיים',
  'הבטחות העסקה',
  'לשון הרע על מתחרים',
  'מידע סודי על לקוחות',
  'פרטים אישיים של עובדים אחרים'
];

const DEFAULT_NEVER_SAY = [
  'אני מבטיח/ה לך שתתקבל',
  'השכר יהיה...',
  'אני יכול/ה להבטיח',
  'זה בטוח שתקבל את המשרה'
];

const DEFAULT_ESCALATION_TRIGGERS = [
  'תלונה',
  'כעס',
  'אני רוצה לדבר עם מנהל',
  'בעיה משפטית',
  'הטרדה',
  'אפליה'
];

export default function AgentSettings() {
  const [selectedAgent, setSelectedAgent] = useState('rotem');
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Input states for array fields
  const [newTopic, setNewTopic] = useState('');
  const [newForbidden, setNewForbidden] = useState('');
  const [newNeverSay, setNewNeverSay] = useState('');
  const [newTrigger, setNewTrigger] = useState('');
  const [newBenefit, setNewBenefit] = useState('');
  const [newJobType, setNewJobType] = useState('');
  const [newStep, setNewStep] = useState('');
  
  // Scenario editing
  const [newScenario, setNewScenario] = useState({ name: '', trigger: '', response: '' });

  useEffect(() => {
    loadConfig(selectedAgent);
  }, [selectedAgent]);

  const loadConfig = async (agentId) => {
    setLoading(true);
    try {
      const { AgentConfig } = await import('@/entities/AgentConfig');
      const configs = await AgentConfig.filter({ agent_name: agentId });
      
      if (configs.length > 0) {
        setConfig(configs[0]);
      } else {
        const agent = AGENTS.find(a => a.id === agentId);
        setConfig({
          agent_name: agentId,
          display_name: agent?.name || agentId,
          role_description: agent?.role || '',
          personality: 'friendly',
          language_style: 'informal',
          tone_of_voice: '',
          use_emojis: true,
          emoji_frequency: 'minimal',
          greeting_message: '',
          allowed_topics: [],
          forbidden_topics: [...DEFAULT_FORBIDDEN_TOPICS],
          never_say: [...DEFAULT_NEVER_SAY],
          escalation_triggers: [...DEFAULT_ESCALATION_TRIGGERS],
          escalation_message: 'אעביר אותך לנציג אנושי שיוכל לעזור לך טוב יותר. מישהו מהצוות ייצור איתך קשר בהקדם.',
          irrelevant_message_response: 'אני כאן כדי לעזור לך בנושאי גיוס ומשרות. יש משהו ספציפי שאוכל לסייע בו?',
          company_info: '',
          company_benefits: [],
          common_job_types: [],
          recruitment_process_steps: [],
          scenario_scripts: [],
          sample_conversations: [],
          max_message_length: 500,
          response_delay_seconds: 2,
          working_hours_start: '08:00',
          working_hours_end: '18:00',
          out_of_hours_message: '',
          custom_instructions: '',
          form_url: '',
          is_active: true
        });
      }
    } catch (e) {
      console.error('Error loading config:', e);
      toast.error('שגיאה בטעינת ההגדרות');
    }
    setLoading(false);
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const { AgentConfig } = await import('@/entities/AgentConfig');
      
      if (config.id) {
        await AgentConfig.update(config.id, config);
      } else {
        const created = await AgentConfig.create(config);
        setConfig({ ...config, id: created.id });
      }
      toast.success('ההגדרות נשמרו בהצלחה');
    } catch (e) {
      console.error('Error saving config:', e);
      toast.error('שגיאה בשמירת ההגדרות');
    }
    setSaving(false);
  };

  const addToArray = (field, value, setter) => {
    if (value.trim()) {
      setConfig({
        ...config,
        [field]: [...(config[field] || []), value.trim()]
      });
      setter('');
    }
  };

  const removeFromArray = (field, index) => {
    setConfig({
      ...config,
      [field]: config[field].filter((_, i) => i !== index)
    });
  };

  const addScenario = () => {
    if (newScenario.name && newScenario.trigger && newScenario.response) {
      setConfig({
        ...config,
        scenario_scripts: [...(config.scenario_scripts || []), { ...newScenario }]
      });
      setNewScenario({ name: '', trigger: '', response: '' });
    }
  };

  const removeScenario = (index) => {
    setConfig({
      ...config,
      scenario_scripts: config.scenario_scripts.filter((_, i) => i !== index)
    });
  };

  const currentAgent = AGENTS.find(a => a.id === selectedAgent);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
          <Bot className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">הגדרות סוכני AI</h1>
          <p className="text-gray-600">הגדר את אופי השיחה, הגבלות, ידע ותסריטים</p>
        </div>
      </div>

      {/* Agent Selector */}
      <div className="flex gap-4 overflow-x-auto pb-2">
        {AGENTS.map(agent => (
          <button
            key={agent.id}
            onClick={() => setSelectedAgent(agent.id)}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all min-w-[200px] ${
              selectedAgent === agent.id 
                ? 'border-violet-500 bg-violet-50 shadow-lg' 
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <img src={agent.image} alt={agent.name} className="w-12 h-12 rounded-full object-cover" />
            <div className="text-right">
              <p className="font-bold">{agent.name}</p>
              <p className="text-xs text-gray-500">{agent.role}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Settings Form */}
      {config && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <img src={currentAgent?.image} alt="" className="w-8 h-8 rounded-full" />
                הגדרות {config.display_name}
              </CardTitle>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label>פעיל</Label>
                  <Switch
                    checked={config.is_active}
                    onCheckedChange={(checked) => setConfig({ ...config, is_active: checked })}
                  />
                </div>
                <Button onClick={saveConfig} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Save className="w-4 h-4 ml-2" />}
                  שמור
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="personality">
              <TabsList className="mb-6 flex-wrap h-auto gap-1">
                <TabsTrigger value="personality" className="gap-1">
                  <Sparkles className="w-4 h-4" />
                  אופי ושפה
                </TabsTrigger>
                <TabsTrigger value="restrictions" className="gap-1">
                  <Ban className="w-4 h-4" />
                  הגבלות
                </TabsTrigger>
                <TabsTrigger value="knowledge" className="gap-1">
                  <Building className="w-4 h-4" />
                  ידע וחברה
                </TabsTrigger>
                <TabsTrigger value="scenarios" className="gap-1">
                  <ListChecks className="w-4 h-4" />
                  תסריטים
                </TabsTrigger>
                <TabsTrigger value="examples" className="gap-1">
                  <MessageSquare className="w-4 h-4" />
                  דוגמאות
                </TabsTrigger>
                <TabsTrigger value="messages" className="gap-1">
                  <MessageCircle className="w-4 h-4" />
                  הודעות
                </TabsTrigger>
                <TabsTrigger value="advanced" className="gap-1">
                  <Settings className="w-4 h-4" />
                  מתקדם
                </TabsTrigger>
              </TabsList>

              {/* Personality Tab */}
              <TabsContent value="personality" className="space-y-6">
                <Alert className="bg-violet-50 border-violet-200">
                  <Sparkles className="w-4 h-4 text-violet-600" />
                  <AlertDescription>
                    הגדר את האופי והטון של הסוכן - איך הוא מדבר ומתקשר עם אנשים
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>שם הסוכן</Label>
                    <Input
                      value={config.display_name || ''}
                      onChange={(e) => setConfig({ ...config, display_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>תיאור התפקיד</Label>
                    <Input
                      value={config.role_description || ''}
                      onChange={(e) => setConfig({ ...config, role_description: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label>אופי הסוכן</Label>
                    <Select
                      value={config.personality}
                      onValueChange={(value) => setConfig({ ...config, personality: value })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PERSONALITY_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>סגנון שפה</Label>
                    <Select
                      value={config.language_style}
                      onValueChange={(value) => setConfig({ ...config, language_style: value })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {LANGUAGE_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>שימוש באימוג'ים</Label>
                    <Select
                      value={config.emoji_frequency}
                      onValueChange={(value) => setConfig({ ...config, emoji_frequency: value })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EMOJI_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>טון דיבור ספציפי</Label>
                  <Textarea
                    value={config.tone_of_voice || ''}
                    onChange={(e) => setConfig({ ...config, tone_of_voice: e.target.value })}
                    placeholder="לדוגמה: חם ומקבל, תמיד מעודד, משתמש בשמות פרטיים, מביע אמפתיה..."
                    rows={3}
                  />
                </div>

                {/* Allowed Topics */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-green-600" />
                    נושאים שהסוכן מדבר עליהם
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={newTopic}
                      onChange={(e) => setNewTopic(e.target.value)}
                      placeholder="הוסף נושא..."
                      onKeyPress={(e) => e.key === 'Enter' && addToArray('allowed_topics', newTopic, setNewTopic)}
                    />
                    <Button variant="outline" onClick={() => addToArray('allowed_topics', newTopic, setNewTopic)}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(config.allowed_topics || []).map((topic, idx) => (
                      <Badge key={idx} className="bg-green-100 text-green-800 gap-1 pl-1">
                        {topic}
                        <button onClick={() => removeFromArray('allowed_topics', idx)}>
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* Restrictions Tab */}
              <TabsContent value="restrictions" className="space-y-6">
                <Alert className="bg-red-50 border-red-200">
                  <Ban className="w-4 h-4 text-red-600" />
                  <AlertDescription>
                    הגדר גבולות ברורים - על מה הסוכן לא ידבר ומתי יעביר לאדם אמיתי
                  </AlertDescription>
                </Alert>

                {/* Forbidden Topics */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    נושאים אסורים לדיון
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={newForbidden}
                      onChange={(e) => setNewForbidden(e.target.value)}
                      placeholder="הוסף נושא אסור..."
                      onKeyPress={(e) => e.key === 'Enter' && addToArray('forbidden_topics', newForbidden, setNewForbidden)}
                    />
                    <Button variant="outline" onClick={() => addToArray('forbidden_topics', newForbidden, setNewForbidden)}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(config.forbidden_topics || []).map((topic, idx) => (
                      <Badge key={idx} variant="destructive" className="gap-1 pl-1">
                        {topic}
                        <button onClick={() => removeFromArray('forbidden_topics', idx)}>
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Never Say */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Ban className="w-4 h-4 text-orange-600" />
                    דברים שהסוכן לעולם לא יגיד
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={newNeverSay}
                      onChange={(e) => setNewNeverSay(e.target.value)}
                      placeholder="הוסף משפט אסור..."
                      onKeyPress={(e) => e.key === 'Enter' && addToArray('never_say', newNeverSay, setNewNeverSay)}
                    />
                    <Button variant="outline" onClick={() => addToArray('never_say', newNeverSay, setNewNeverSay)}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(config.never_say || []).map((item, idx) => (
                      <Badge key={idx} className="bg-orange-100 text-orange-800 gap-1 pl-1">
                        "{item}"
                        <button onClick={() => removeFromArray('never_say', idx)}>
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Escalation Triggers */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <User className="w-4 h-4 text-purple-600" />
                    מילים/מצבים להעברה לנציג אנושי
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={newTrigger}
                      onChange={(e) => setNewTrigger(e.target.value)}
                      placeholder="הוסף טריגר..."
                      onKeyPress={(e) => e.key === 'Enter' && addToArray('escalation_triggers', newTrigger, setNewTrigger)}
                    />
                    <Button variant="outline" onClick={() => addToArray('escalation_triggers', newTrigger, setNewTrigger)}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(config.escalation_triggers || []).map((trigger, idx) => (
                      <Badge key={idx} className="bg-purple-100 text-purple-800 gap-1 pl-1">
                        {trigger}
                        <button onClick={() => removeFromArray('escalation_triggers', idx)}>
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>הודעה בעת העברה לנציג אנושי</Label>
                  <Textarea
                    value={config.escalation_message || ''}
                    onChange={(e) => setConfig({ ...config, escalation_message: e.target.value })}
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label>תגובה להודעות לא רלוונטיות</Label>
                  <Textarea
                    value={config.irrelevant_message_response || ''}
                    onChange={(e) => setConfig({ ...config, irrelevant_message_response: e.target.value })}
                    placeholder="אני כאן כדי לעזור לך בנושאי גיוס ומשרות. יש משהו ספציפי שאוכל לסייע בו?"
                    rows={2}
                  />
                </div>
              </TabsContent>

              {/* Knowledge Tab */}
              <TabsContent value="knowledge" className="space-y-6">
                <Alert className="bg-blue-50 border-blue-200">
                  <Building className="w-4 h-4 text-blue-600" />
                  <AlertDescription>
                    הוסף ידע על החברה, סוגי משרות ותהליך הגיוס שהסוכן יוכל לשתף
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label>מידע על החברה</Label>
                  <Textarea
                    value={config.company_info || ''}
                    onChange={(e) => setConfig({ ...config, company_info: e.target.value })}
                    placeholder="פנדה-טק היא חברת השמה מובילה בתחום ההייטק והביטחון. אנחנו עובדים עם החברות הגדולות במשק..."
                    rows={4}
                  />
                </div>

                {/* Company Benefits */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-green-600" />
                    יתרונות החברה לעובדים
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={newBenefit}
                      onChange={(e) => setNewBenefit(e.target.value)}
                      placeholder="הוסף יתרון..."
                      onKeyPress={(e) => e.key === 'Enter' && addToArray('company_benefits', newBenefit, setNewBenefit)}
                    />
                    <Button variant="outline" onClick={() => addToArray('company_benefits', newBenefit, setNewBenefit)}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(config.company_benefits || []).map((benefit, idx) => (
                      <Badge key={idx} className="bg-green-100 text-green-800 gap-1 pl-1">
                        {benefit}
                        <button onClick={() => removeFromArray('company_benefits', idx)}>
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Common Job Types */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-blue-600" />
                    סוגי משרות נפוצות
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={newJobType}
                      onChange={(e) => setNewJobType(e.target.value)}
                      placeholder="הוסף סוג משרה..."
                      onKeyPress={(e) => e.key === 'Enter' && addToArray('common_job_types', newJobType, setNewJobType)}
                    />
                    <Button variant="outline" onClick={() => addToArray('common_job_types', newJobType, setNewJobType)}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(config.common_job_types || []).map((type, idx) => (
                      <Badge key={idx} className="bg-blue-100 text-blue-800 gap-1 pl-1">
                        {type}
                        <button onClick={() => removeFromArray('common_job_types', idx)}>
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Recruitment Process */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <ListChecks className="w-4 h-4 text-purple-600" />
                    שלבי תהליך הגיוס
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={newStep}
                      onChange={(e) => setNewStep(e.target.value)}
                      placeholder="הוסף שלב בתהליך..."
                      onKeyPress={(e) => e.key === 'Enter' && addToArray('recruitment_process_steps', newStep, setNewStep)}
                    />
                    <Button variant="outline" onClick={() => addToArray('recruitment_process_steps', newStep, setNewStep)}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {(config.recruitment_process_steps || []).map((step, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg">
                        <span className="w-6 h-6 rounded-full bg-purple-200 text-purple-800 flex items-center justify-center text-sm font-bold">
                          {idx + 1}
                        </span>
                        <span className="flex-1">{step}</span>
                        <button onClick={() => removeFromArray('recruitment_process_steps', idx)}>
                          <X className="w-4 h-4 text-gray-400 hover:text-red-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* Scenarios Tab */}
              <TabsContent value="scenarios" className="space-y-6">
                <Alert className="bg-amber-50 border-amber-200">
                  <ListChecks className="w-4 h-4 text-amber-600" />
                  <AlertDescription>
                    הגדר תסריטים מוכנים למצבים שונים - הסוכן ידע בדיוק איך להגיב
                  </AlertDescription>
                </Alert>

                {/* Add New Scenario */}
                <Card className="bg-gray-50">
                  <CardContent className="pt-4 space-y-4">
                    <h4 className="font-medium">הוסף תסריט חדש</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>שם התסריט</Label>
                        <Input
                          value={newScenario.name}
                          onChange={(e) => setNewScenario({ ...newScenario, name: e.target.value })}
                          placeholder="לדוגמה: שאלה על שכר"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>טריגר (מתי להפעיל)</Label>
                        <Input
                          value={newScenario.trigger}
                          onChange={(e) => setNewScenario({ ...newScenario, trigger: e.target.value })}
                          placeholder="כמה משלמים, מה השכר"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>&nbsp;</Label>
                        <Button onClick={addScenario} className="w-full">
                          <Plus className="w-4 h-4 ml-2" />
                          הוסף תסריט
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>תגובה</Label>
                      <Textarea
                        value={newScenario.response}
                        onChange={(e) => setNewScenario({ ...newScenario, response: e.target.value })}
                        placeholder="התגובה שהסוכן ייתן כשמזהה את הטריגר..."
                        rows={3}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Existing Scenarios */}
                <div className="space-y-4">
                  {(config.scenario_scripts || []).map((scenario, idx) => (
                    <Card key={idx} className="border-r-4 border-r-amber-400">
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-bold text-lg">{scenario.name}</h4>
                            <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                              <ArrowRight className="w-4 h-4" />
                              טריגר: <Badge variant="outline">{scenario.trigger}</Badge>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => removeScenario(idx)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg text-sm">
                          {scenario.response}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {(config.scenario_scripts || []).length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <ListChecks className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>אין תסריטים מוגדרים</p>
                      <p className="text-sm">הוסף תסריטים כדי שהסוכן ידע איך להגיב למצבים שונים</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Examples Tab */}
              <TabsContent value="examples" className="space-y-6">
                <Alert className="bg-green-50 border-green-200">
                  <MessageSquare className="w-4 h-4 text-green-600" />
                  <AlertDescription>
                    הוסף דוגמאות לשיחות טובות - הסוכן ילמד מהן את הטון והסגנון הרצוי
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label>דוגמאות לשיחות</Label>
                  <Textarea
                    value={(config.sample_conversations || []).join('\n\n---\n\n')}
                    onChange={(e) => setConfig({ 
                      ...config, 
                      sample_conversations: e.target.value.split('\n\n---\n\n').filter(s => s.trim()) 
                    })}
                    placeholder={`מועמד: היי, אני מחפש עבודה בתחום הפיתוח
רותם: היי! 👋 שמח לשמוע! יש לנו כמה משרות מעולות בתחום. ספר לי קצת על עצמך - מה הניסיון שלך?
מועמד: יש לי 5 שנות ניסיון ב-Python
רותם: מצוין! עם 5 שנות ניסיון יש לך פוטנציאל מעולה. יש לנו כמה משרות שיכולות להתאים. תוכל לשלוח לי קורות חיים?

---

מועמד: כמה משלמים?
רותם: השכר תלוי בניסיון ובמשרה הספציפית. בוא נבדוק קודם מה מתאים לך ואז נוכל לדבר על התנאים. מה התחום שלך?`}
                    rows={15}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500">
                    הפרד בין דוגמאות עם --- (שלושה מקפים בשורה נפרדת)
                  </p>
                </div>

                {/* Preview */}
                {(config.sample_conversations || []).length > 0 && (
                  <div className="space-y-4">
                    <h4 className="font-medium">תצוגה מקדימה ({config.sample_conversations.length} דוגמאות)</h4>
                    {config.sample_conversations.slice(0, 3).map((conv, idx) => (
                      <Card key={idx} className="bg-green-50 border-green-200">
                        <CardContent className="pt-4">
                          <Badge className="mb-2 bg-green-100 text-green-800">דוגמה {idx + 1}</Badge>
                          <pre className="whitespace-pre-wrap text-sm font-sans">{conv}</pre>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Messages Tab */}
              <TabsContent value="messages" className="space-y-6">
                <div className="space-y-2">
                  <Label>הודעת פתיחה</Label>
                  <Textarea
                    value={config.greeting_message || ''}
                    onChange={(e) => setConfig({ ...config, greeting_message: e.target.value })}
                    placeholder="היי! 👋 אני רותם מפנדה-טק. אשמח לעזור לך למצוא את המשרה המושלמת. מה התחום שלך?"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>קישור לטופס</Label>
                    <Input
                      value={config.form_url || ''}
                      onChange={(e) => setConfig({ ...config, form_url: e.target.value })}
                      placeholder="https://forms.gle/..."
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>אורך מקסימלי להודעה (תווים)</Label>
                    <Input
                      type="number"
                      value={config.max_message_length || 500}
                      onChange={(e) => setConfig({ ...config, max_message_length: parseInt(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      שעת התחלת עבודה
                    </Label>
                    <Input
                      type="time"
                      value={config.working_hours_start || '08:00'}
                      onChange={(e) => setConfig({ ...config, working_hours_start: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      שעת סיום עבודה
                    </Label>
                    <Input
                      type="time"
                      value={config.working_hours_end || '18:00'}
                      onChange={(e) => setConfig({ ...config, working_hours_end: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>השהייה לפני תגובה (שניות)</Label>
                    <Input
                      type="number"
                      value={config.response_delay_seconds || 2}
                      onChange={(e) => setConfig({ ...config, response_delay_seconds: parseInt(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>הודעה מחוץ לשעות הפעילות</Label>
                  <Textarea
                    value={config.out_of_hours_message || ''}
                    onChange={(e) => setConfig({ ...config, out_of_hours_message: e.target.value })}
                    placeholder="היי! 🌙 אנחנו לא זמינים כרגע, אבל נחזור אליך מחר בבוקר. בינתיים, תוכל לשלוח לנו קורות חיים!"
                    rows={2}
                  />
                </div>
              </TabsContent>

              {/* Advanced Tab */}
              <TabsContent value="advanced" className="space-y-6">
                <Alert className="bg-gray-100 border-gray-300">
                  <Info className="w-4 h-4 text-gray-600" />
                  <AlertDescription>
                    הנחיות מתקדמות לשליטה מלאה בהתנהגות הסוכן
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label>הנחיות מותאמות אישית</Label>
                  <Textarea
                    value={config.custom_instructions || ''}
                    onChange={(e) => setConfig({ ...config, custom_instructions: e.target.value })}
                    placeholder={`הנחיות ספציפיות לסוכן:

1. תמיד תשאל שאלות פתוחות
2. אל תדחף למכירה - תן למועמד להוביל
3. אם מישהו שואל על שכר, הסבר שזה תלוי במשרה ובניסיון
4. תמיד תסיים עם שאלה או הזמנה לפעולה
5. אם המועמד מתעניין, בקש קורות חיים
...`}
                    rows={10}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500">
                    כאן תוכל להוסיף הנחיות מפורטות ומותאמות אישית לסוכן
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}