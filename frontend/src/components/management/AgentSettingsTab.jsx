import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Save, 
  Loader2, 
  Plus, 
  X, 
  MessageCircle,
  Clock,
  Sparkles,
  User,
  Bot,
  Shield,
  BookOpen,
  GraduationCap,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import AgentChatTab from './AgentChatTab';
import { base44 } from '@/api/base44Client';

const AGENTS = [
  { id: 'rotem', name: 'טל', description: 'קשרי מועמדים ב-WhatsApp', color: 'teal', image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=60&h=60&fit=crop&crop=face' },
  { id: 'shacahr', name: 'שחר', description: 'גיוס מועמדים WhatsApp', color: 'cyan', image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=60&h=60&fit=crop&crop=face' },
  { id: 'shiri', name: 'שירי', description: 'קשרי עובדים ב-WhatsApp', color: 'rose', image: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=60&h=60&fit=crop&crop=face' },
  { id: 'hila', name: 'הילה', description: 'הפצת משרות לעובדים', color: 'pink', image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60&h=60&fit=crop&crop=face' },
];

const PERSONALITY_OPTIONS = [
  { value: 'friendly', label: 'ידידותי' },
  { value: 'professional', label: 'מקצועי' },
  { value: 'casual', label: 'קז\'ואלי' },
  { value: 'formal', label: 'פורמלי' },
];

const LANGUAGE_STYLE_OPTIONS = [
  { value: 'formal', label: 'פורמלי' },
  { value: 'informal', label: 'לא פורמלי' },
  { value: 'mixed', label: 'משולב' },
];

const EMOJI_FREQUENCY_OPTIONS = [
  { value: 'none', label: 'ללא' },
  { value: 'minimal', label: 'מינימלי' },
  { value: 'moderate', label: 'בינוני' },
  { value: 'frequent', label: 'תכוף' },
];

export default function AgentSettingsTab() {
  const [selectedAgent, setSelectedAgent] = useState('rotem');
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAgentConfig(selectedAgent);
  }, [selectedAgent]);

  const loadAgentConfig = async (agentName) => {
    setLoading(true);
    try {
      const configs = await base44.entities.AgentConfig.filter({ agent_name: agentName });
      
      if (configs.length > 0) {
        setConfig(configs[0]);
      } else {
        // Create default config
        const agent = AGENTS.find(a => a.id === agentName);
        setConfig({
          agent_name: agentName,
          display_name: agent?.name || agentName,
          role_description: agent?.description || '',
          personality: 'friendly',
          language_style: 'informal',
          tone_of_voice: '',
          use_emojis: true,
          emoji_frequency: 'minimal',
          greeting_message: '',
          allowed_topics: [],
          forbidden_topics: [],
          never_say: [],
          escalation_triggers: [],
          escalation_message: '',
          irrelevant_message_response: '',
          company_info: '',
          company_benefits: [],
          common_job_types: [],
          recruitment_process_steps: [],
          sample_conversations: [],
          max_message_length: 500,
          response_delay_seconds: 2,
          working_hours_start: '08:00',
          working_hours_end: '18:00',
          working_days: [0, 1, 2, 3, 4],
          respect_jewish_holidays: true,
          jewish_holidays_message: '',
          out_of_hours_message: '',
          custom_instructions: '',
          form_url: '',
          is_active: true,
          no_limits: false,
          max_messages_per_conversation: 10,
          max_daily_messages: 20,
          max_monthly_inquiries: 3
        });
      }
    } catch (error) {
      console.error('Error loading agent config:', error);
      toast.error('שגיאה בטעינת הגדרות הסוכן');
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (config.id) {
        await base44.entities.AgentConfig.update(config.id, config);
      } else {
        const newConfig = await base44.entities.AgentConfig.create(config);
        setConfig(newConfig);
      }
      
      toast.success('ההגדרות נשמרו בהצלחה');
    } catch (error) {
      console.error('Error saving agent config:', error);
      toast.error('שגיאה בשמירת ההגדרות');
    }
    setSaving(false);
  };

  const updateConfig = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const addToArray = (field, value) => {
    if (!value.trim()) return;
    updateConfig(field, [...(config[field] || []), value.trim()]);
  };

  const removeFromArray = (field, index) => {
    updateConfig(field, config[field].filter((_, i) => i !== index));
  };

  const currentAgent = AGENTS.find(a => a.id === selectedAgent);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Agent Selector */}
      <div className="flex gap-4 overflow-x-auto pb-2">
        {AGENTS.map(agent => (
          <button
            key={agent.id}
            onClick={() => setSelectedAgent(agent.id)}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all min-w-[220px] ${
              selectedAgent === agent.id 
                ? 'border-violet-500 bg-violet-50 shadow-lg' 
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <img src={agent.image} alt={agent.name} className="w-12 h-12 rounded-full object-cover" />
            <div className="text-right">
              <p className="font-bold">{agent.name}</p>
              <p className="text-xs text-gray-500">{agent.description}</p>
            </div>
          </button>
        ))}
      </div>

      {config && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <img src={currentAgent?.image} alt="" className="w-8 h-8 rounded-full" />
                הגדרות {config.display_name}
              </CardTitle>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Save className="w-4 h-4 ml-2" />}
                שמור
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="personality">
              <TabsList className="mb-6 flex-wrap h-auto gap-1">
                <TabsTrigger value="personality" className="gap-1">
                  <Sparkles className="w-4 h-4" />
                  אישיות
                </TabsTrigger>
                <TabsTrigger value="communication" className="gap-1">
                  <MessageCircle className="w-4 h-4" />
                  תקשורת
                </TabsTrigger>
                <TabsTrigger value="knowledge" className="gap-1">
                  <BookOpen className="w-4 h-4" />
                  ידע
                </TabsTrigger>
                <TabsTrigger value="restrictions" className="gap-1">
                  <Shield className="w-4 h-4" />
                  מגבלות
                </TabsTrigger>
                <TabsTrigger value="schedule" className="gap-1">
                  <Clock className="w-4 h-4" />
                  זמנים
                </TabsTrigger>
                <TabsTrigger value="training" className="gap-1">
                  <GraduationCap className="w-4 h-4" />
                  אימון
                </TabsTrigger>
                <TabsTrigger value="chat" className="gap-1">
                  <MessageCircle className="w-4 h-4" />
                  שיחת בדיקה
                </TabsTrigger>
              </TabsList>

              {/* Personality Tab */}
              <TabsContent value="personality" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>אישיות הסוכן</CardTitle>
                    <CardDescription>הגדר את האופי וסגנון התקשורת</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>שם תצוגה</Label>
                        <Input
                          value={config.display_name || ''}
                          onChange={(e) => updateConfig('display_name', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>תיאור התפקיד</Label>
                        <Input
                          value={config.role_description || ''}
                          onChange={(e) => updateConfig('role_description', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label>אופי</Label>
                        <Select value={config.personality} onValueChange={(v) => updateConfig('personality', v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PERSONALITY_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>סגנון שפה</Label>
                        <Select value={config.language_style} onValueChange={(v) => updateConfig('language_style', v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {LANGUAGE_STYLE_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>תדירות אימוג'י</Label>
                        <Select value={config.emoji_frequency} onValueChange={(v) => updateConfig('emoji_frequency', v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {EMOJI_FREQUENCY_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label>טון הדיבור</Label>
                      <Textarea
                        value={config.tone_of_voice || ''}
                        onChange={(e) => updateConfig('tone_of_voice', e.target.value)}
                        placeholder="תאר את טון הדיבור הספציפי..."
                        rows={2}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Communication Tab */}
              <TabsContent value="communication">
                <Card>
                  <CardHeader>
                    <CardTitle>הגדרות תקשורת</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>הודעת פתיחה</Label>
                      <Textarea
                        value={config.greeting_message || ''}
                        onChange={(e) => updateConfig('greeting_message', e.target.value)}
                        placeholder="הודעה שתישלח בפתיחת שיחה חדשה..."
                        rows={3}
                      />
                    </div>

                    <div>
                      <Label>תגובה להודעות לא רלוונטיות</Label>
                      <Textarea
                        value={config.irrelevant_message_response || ''}
                        onChange={(e) => updateConfig('irrelevant_message_response', e.target.value)}
                        placeholder="כיצד להגיב להודעות שלא קשורות לנושא..."
                        rows={2}
                      />
                    </div>

                    <div>
                      <Label>הודעה בהעברה לאדם</Label>
                      <Textarea
                        value={config.escalation_message || ''}
                        onChange={(e) => updateConfig('escalation_message', e.target.value)}
                        placeholder="הודעה שתישלח כשמעבירים לאדם אמיתי..."
                        rows={2}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>אורך הודעה מקסימלי</Label>
                        <Input
                          type="number"
                          value={config.max_message_length || 500}
                          onChange={(e) => updateConfig('max_message_length', parseInt(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label>השהייה לפני תגובה (שניות)</Label>
                        <Input
                          type="number"
                          value={config.response_delay_seconds || 2}
                          onChange={(e) => updateConfig('response_delay_seconds', parseInt(e.target.value))}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Knowledge Tab */}
              <TabsContent value="knowledge">
                <Card>
                  <CardHeader>
                    <CardTitle>בסיס ידע</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>מידע על החברה</Label>
                      <Textarea
                        value={config.company_info || ''}
                        onChange={(e) => updateConfig('company_info', e.target.value)}
                        placeholder="מידע כללי על החברה שהסוכן יכול לשתף..."
                        rows={3}
                      />
                    </div>

                    <div>
                      <Label>הנחיות מותאמות אישית</Label>
                      <Textarea
                        value={config.custom_instructions || ''}
                        onChange={(e) => updateConfig('custom_instructions', e.target.value)}
                        placeholder="הנחיות נוספות לסוכן..."
                        rows={10}
                      />
                    </div>

                    <ArrayEditor
                      label="יתרונות החברה"
                      items={config.company_benefits || []}
                      onAdd={(v) => addToArray('company_benefits', v)}
                      onRemove={(i) => removeFromArray('company_benefits', i)}
                    />

                    <ArrayEditor
                      label="סוגי משרות נפוצות"
                      items={config.common_job_types || []}
                      onAdd={(v) => addToArray('common_job_types', v)}
                      onRemove={(i) => removeFromArray('common_job_types', i)}
                    />

                    <ArrayEditor
                      label="שלבי תהליך הגיוס"
                      items={config.recruitment_process_steps || []}
                      onAdd={(v) => addToArray('recruitment_process_steps', v)}
                      onRemove={(i) => removeFromArray('recruitment_process_steps', i)}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Restrictions Tab */}
              <TabsContent value="restrictions">
                <Card>
                  <CardHeader>
                    <CardTitle>מגבלות והגנות</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ArrayEditor
                      label="נושאים מותרים"
                      items={config.allowed_topics || []}
                      onAdd={(v) => addToArray('allowed_topics', v)}
                      onRemove={(i) => removeFromArray('allowed_topics', i)}
                    />

                    <ArrayEditor
                      label="נושאים אסורים"
                      items={config.forbidden_topics || []}
                      onAdd={(v) => addToArray('forbidden_topics', v)}
                      onRemove={(i) => removeFromArray('forbidden_topics', i)}
                    />

                    <ArrayEditor
                      label="דברים שהסוכן לעולם לא יגיד"
                      items={config.never_say || []}
                      onAdd={(v) => addToArray('never_say', v)}
                      onRemove={(i) => removeFromArray('never_say', i)}
                    />

                    <ArrayEditor
                      label="טריגרים להעברה לאדם"
                      items={config.escalation_triggers || []}
                      onAdd={(v) => addToArray('escalation_triggers', v)}
                      onRemove={(i) => removeFromArray('escalation_triggers', i)}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Schedule Tab */}
              <TabsContent value="schedule">
                <Card>
                  <CardHeader>
                    <CardTitle>זמני פעילות ותזמון</CardTitle>
                    <CardDescription>הגדר מתי הסוכן יכול לפנות למועמדים באופן אוטומטי</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center gap-4 p-3 bg-teal-50 rounded-lg border border-teal-200">
                      <Switch
                        checked={config.is_active}
                        onCheckedChange={(v) => updateConfig('is_active', v)}
                      />
                      <div>
                        <Label className="font-semibold">הסוכן פעיל</Label>
                        <p className="text-xs text-gray-600">כאשר כבוי, הסוכן לא יענה להודעות חדשות</p>
                      </div>
                    </div>

                    {/* Limits Section - Only for Shacahr */}
                    {selectedAgent === 'shacahr' && (
                      <div className="border-t pt-4">
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <Shield className="w-4 h-4 text-orange-600" />
                          מגבלות שימוש
                        </h4>
                        
                        <div className="flex items-center gap-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200 mb-4">
                          <Switch
                            checked={config.no_limits || false}
                            onCheckedChange={(v) => updateConfig('no_limits', v)}
                          />
                          <div>
                            <Label className="font-semibold">ללא מגבלות</Label>
                            <p className="text-xs text-gray-600">שימוש בלתי מוגבל - כל המגבלות מושבתות</p>
                          </div>
                        </div>

                        {!config.no_limits && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <Label>הודעות בשיחה אחת</Label>
                              <Input
                                type="number"
                                value={config.max_messages_per_conversation || 10}
                                onChange={(e) => updateConfig('max_messages_per_conversation', parseInt(e.target.value))}
                                min="1"
                              />
                              <p className="text-xs text-gray-600 mt-1">מקסימום הודעות למשתמש בשיחה אחת</p>
                            </div>
                            <div>
                              <Label>הודעות יומיות</Label>
                              <Input
                                type="number"
                                value={config.max_daily_messages || 20}
                                onChange={(e) => updateConfig('max_daily_messages', parseInt(e.target.value))}
                                min="1"
                              />
                              <p className="text-xs text-gray-600 mt-1">מקסימום הודעות ליום למשתמש</p>
                            </div>
                            <div>
                              <Label>פניות חודשיות</Label>
                              <Input
                                type="number"
                                value={config.max_monthly_inquiries || 3}
                                onChange={(e) => updateConfig('max_monthly_inquiries', parseInt(e.target.value))}
                                min="1"
                              />
                              <p className="text-xs text-gray-600 mt-1">מקסימום פניות חדשות לחודש</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Working Hours */}
                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-green-600" />
                        שעות עבודה מותרות
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>שעת התחלה</Label>
                          <Input
                            type="time"
                            value={config.working_hours_start || '08:00'}
                            onChange={(e) => updateConfig('working_hours_start', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>שעת סיום</Label>
                          <Input
                            type="time"
                            value={config.working_hours_end || '18:00'}
                            onChange={(e) => updateConfig('working_hours_end', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Working Days */}
                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-600" />
                        ימים מותרים בשבוע
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { value: 0, label: 'ראשון' },
                          { value: 1, label: 'שני' },
                          { value: 2, label: 'שלישי' },
                          { value: 3, label: 'רביעי' },
                          { value: 4, label: 'חמישי' },
                          { value: 5, label: 'שישי' },
                          { value: 6, label: 'שבת' },
                        ].map(day => {
                          const isSelected = (config.working_days || [0, 1, 2, 3, 4]).includes(day.value);
                          return (
                            <button
                              key={day.value}
                              onClick={() => {
                                const currentDays = config.working_days || [0, 1, 2, 3, 4];
                                if (isSelected) {
                                  updateConfig('working_days', currentDays.filter(d => d !== day.value));
                                } else {
                                  updateConfig('working_days', [...currentDays, day.value].sort());
                                }
                              }}
                              className={`px-4 py-2 rounded-lg border-2 transition-all ${
                                isSelected
                                  ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                              }`}
                            >
                              {day.label}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        הסוכן יפנה למועמדים רק בימים המסומנים
                      </p>
                    </div>

                    {/* Jewish Holidays */}
                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        חגים ומועדים יהודיים
                      </h4>
                      <div className="space-y-4">
                        <div className="flex items-center gap-4 bg-purple-50 border border-purple-200 rounded-lg p-3">
                          <Switch
                            checked={config.respect_jewish_holidays !== false}
                            onCheckedChange={(v) => updateConfig('respect_jewish_holidays', v)}
                          />
                          <div className="flex-1">
                            <Label className="cursor-pointer">כיבוד חגים ומועדים</Label>
                            <p className="text-xs text-gray-500">הסוכן לא יפנה למועמדים בחגים ובמועדים יהודיים</p>
                          </div>
                        </div>
                        
                        {config.respect_jewish_holidays !== false && (
                          <div>
                            <Label>הודעה בחג/מועד (אופציונלי)</Label>
                            <Textarea
                              value={config.jewish_holidays_message || ''}
                              onChange={(e) => updateConfig('jewish_holidays_message', e.target.value)}
                              placeholder="הודעה שתישלח אם ינסו לפנות בחג... (השאר ריק לתגובה אוטומטית)"
                              rows={2}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              אם תשאיר ריק, הסוכן פשוט לא יפנה בחגים ולא ישלח הודעה
                            </p>
                          </div>
                        )}
                        
                        <Alert>
                          <AlertDescription className="text-xs">
                            <strong>חגים ומועדים שנכבדים:</strong> ראש השנה, יום כיפור, סוכות, שמיני עצרת, חנוכה, פורים, פסח, יום העצמאות, ל"ג בעומר, שבועות, תשעה באב, ט"ו באב
                          </AlertDescription>
                        </Alert>
                      </div>
                    </div>

                    <div>
                      <Label>הודעה מחוץ לשעות פעילות</Label>
                      <Textarea
                        value={config.out_of_hours_message || ''}
                        onChange={(e) => updateConfig('out_of_hours_message', e.target.value)}
                        placeholder="הודעה שתישלח מחוץ לשעות הפעילות..."
                        rows={2}
                      />
                    </div>

                    <div>
                      <Label>קישור לטופס</Label>
                      <Input
                        value={config.form_url || ''}
                        onChange={(e) => updateConfig('form_url', e.target.value)}
                        placeholder="https://forms.gle/..."
                        dir="ltr"
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Training Tab */}
              <TabsContent value="training">
                <AgentTrainingTab 
                  config={config}
                  onConfigUpdate={updateConfig}
                />
              </TabsContent>

              {/* Chat Tab */}
              <TabsContent value="chat">
                <AgentChatTab 
                  agentId={selectedAgent === 'rotem' ? 'rotem_whatsapp' : selectedAgent === 'shacahr' ? 'shacahr_whatsapp' : selectedAgent}
                  agentName={currentAgent?.name || selectedAgent}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ArrayEditor({ label, items, onAdd, onRemove }) {
  const [newItem, setNewItem] = useState('');

  const handleAdd = () => {
    onAdd(newItem);
    setNewItem('');
  };

  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-2 mt-1">
        <Input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="הוסף פריט..."
          onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
        />
        <Button type="button" variant="outline" size="icon" onClick={handleAdd}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {items.map((item, index) => (
          <Badge key={index} variant="secondary" className="gap-1">
            {item}
            <button onClick={() => onRemove(index)} className="hover:text-red-500">
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
      </div>
    </div>
  );
}

function AgentTrainingTab({ config, onConfigUpdate }) {
  const [trainingExamples, setTrainingExamples] = useState(config.sample_conversations || []);
  const [newExample, setNewExample] = useState({ user_message: '', agent_response: '', scenario: '' });
  const [isAdding, setIsAdding] = useState(false);

  const SCENARIO_OPTIONS = [
    { value: 'greeting', label: 'פתיחת שיחה' },
    { value: 'job_inquiry', label: 'שאלה על משרה' },
    { value: 'salary_question', label: 'שאלה על שכר' },
    { value: 'company_info', label: 'מידע על החברה' },
    { value: 'rejection', label: 'דחייה מנומסת' },
    { value: 'escalation', label: 'העברה לאדם' },
    { value: 'irrelevant', label: 'הודעה לא רלוונטית' },
    { value: 'followup', label: 'מעקב' },
    { value: 'form_request', label: 'בקשה למילוי טופס' },
    { value: 'other', label: 'אחר' },
  ];

  const handleAddExample = () => {
    if (!newExample.user_message.trim() || !newExample.agent_response.trim()) return;
    
    const updated = [...trainingExamples, { ...newExample, id: Date.now() }];
    setTrainingExamples(updated);
    onConfigUpdate('sample_conversations', updated);
    setNewExample({ user_message: '', agent_response: '', scenario: '' });
    setIsAdding(false);
  };

  const handleRemoveExample = (index) => {
    const updated = trainingExamples.filter((_, i) => i !== index);
    setTrainingExamples(updated);
    onConfigUpdate('sample_conversations', updated);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="w-5 h-5" />
          אימון הסוכן
        </CardTitle>
        <CardDescription>
          הוסף דוגמאות לשיחות כדי לאמן את הסוכן להגיב בצורה מסוימת למצבים שונים
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Existing Examples */}
        {trainingExamples.length > 0 && (
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-gray-700">דוגמאות קיימות ({trainingExamples.length})</h4>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {trainingExamples.map((example, index) => (
                <div key={example.id || index} className="border rounded-lg p-4 bg-gray-50 space-y-3">
                  <div className="flex justify-between items-start">
                    {example.scenario && (
                      <Badge variant="outline" className="text-xs">
                        {SCENARIO_OPTIONS.find(s => s.value === example.scenario)?.label || example.scenario}
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-red-500 hover:text-red-700"
                      onClick={() => handleRemoveExample(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <User className="w-4 h-4 text-blue-500 mt-1 flex-shrink-0" />
                    <div className="bg-blue-100 rounded-lg p-2 text-sm flex-1">
                      {example.user_message}
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <Bot className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                    <div className="bg-green-100 rounded-lg p-2 text-sm flex-1 whitespace-pre-wrap">
                      {example.agent_response}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add New Example */}
        {isAdding ? (
          <div className="border-2 border-dashed border-green-300 rounded-lg p-4 space-y-4 bg-green-50">
            <h4 className="font-medium text-sm text-green-700">הוספת דוגמה חדשה</h4>
            
            <div>
              <Label>סוג תרחיש</Label>
              <Select 
                value={newExample.scenario} 
                onValueChange={(v) => setNewExample({...newExample, scenario: v})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר סוג תרחיש..." />
                </SelectTrigger>
                <SelectContent>
                  {SCENARIO_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="flex items-center gap-2">
                <User className="w-4 h-4 text-blue-500" />
                הודעת המועמד
              </Label>
              <Textarea
                value={newExample.user_message}
                onChange={(e) => setNewExample({...newExample, user_message: e.target.value})}
                placeholder="מה המועמד אומר..."
                rows={2}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-green-500" />
                תגובת הסוכן
              </Label>
              <Textarea
                value={newExample.agent_response}
                onChange={(e) => setNewExample({...newExample, agent_response: e.target.value})}
                placeholder="איך הסוכן צריך להגיב..."
                rows={4}
                className="mt-1"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsAdding(false)}>
                ביטול
              </Button>
              <Button onClick={handleAddExample} disabled={!newExample.user_message || !newExample.agent_response}>
                <Plus className="w-4 h-4 ml-2" />
                הוסף דוגמה
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setIsAdding(true)} className="w-full">
            <Plus className="w-4 h-4 ml-2" />
            הוסף דוגמת שיחה לאימון
          </Button>
        )}

        {/* Tips */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-medium text-sm text-yellow-800 mb-2">💡 טיפים לאימון יעיל</h4>
          <ul className="text-xs text-yellow-700 space-y-1 list-disc list-inside">
            <li>הוסף דוגמאות למצבים מאתגרים שהסוכן נתקל בהם</li>
            <li>השתמש בשפה טבעית כמו שאנשים באמת מדברים</li>
            <li>כלול דוגמאות לתשובות שליליות ודחיות מנומסות</li>
            <li>הוסף תרחישים של שאלות על שכר ותנאים</li>
            <li>צור דוגמאות להודעות לא רלוונטיות והתמודדות איתן</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}