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
import { 
  Save, 
  Loader2, 
  Plus, 
  X, 
  MessageCircle,
  Shield,
  BookOpen,
  Clock,
  Sparkles,
  GraduationCap,
  User,
  Bot,
  Trash2,
  AlertTriangle,
  StopCircle
} from 'lucide-react';
import { toast } from 'sonner';
import AgentChatTab from './AgentChatTab';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

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

const SCENARIO_OPTIONS = [
  { value: 'greeting', label: 'פתיחת שיחה' },
  { value: 'candidate_details', label: 'בקשת פרטים מהמועמד' },
  { value: 'matching_job', label: 'מציאת משרה מתאימה' },
  { value: 'cv_request', label: 'בקשת קורות חיים' },
  { value: 'form_sending', label: 'שליחת טופס מועמד' },
  { value: 'no_match', label: 'אין התאמה' },
  { value: 'out_of_hours', label: 'מחוץ לשעות פעילות' },
  { value: 'irrelevant', label: 'הודעה לא רלוונטית' },
  { value: 'other', label: 'אחר' },
];

export default function ShacahrManagement() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [showStopDialog, setShowStopDialog] = useState(false);

  useEffect(() => {
    loadAgentConfig();
  }, []);

  const loadAgentConfig = async () => {
    setLoading(true);
    try {
      const { AgentConfig } = await import('@/entities/AgentConfig');
      const configs = await AgentConfig.filter({ agent_name: 'shacahr' });
      
      if (configs.length > 0) {
        setConfig(configs[0]);
      } else {
        // Create default config - copy from Rotem
        setConfig({
          agent_name: 'shacahr',
          display_name: 'שחר',
          role_description: 'גיוס מועמדים WhatsApp',
          personality: 'friendly',
          language_style: 'informal',
          use_emojis: true,
          emoji_frequency: 'minimal',
          greeting_message: '',
          allowed_topics: [],
          forbidden_topics: [],
          never_say: [],
          escalation_triggers: [],
          escalation_message: '',
          irrelevant_message_response: '',
          no_limits: false,
          max_messages_per_conversation: 10,
          max_daily_messages: 20,
          max_monthly_inquiries: 3,
          company_info: '',
          company_benefits: [],
          common_job_types: [],
          recruitment_process_steps: [],
          sample_conversations: [],
          max_message_length: 500,
          response_delay_seconds: 2,
          working_hours_start: '08:00',
          working_hours_end: '18:00',
          out_of_hours_message: '',
          custom_instructions: '',
          is_active: true,
          consider_previous_messages: true
          });
          }
          } catch (error) {
          console.error('Error loading agent config:', error);
          toast.error('שגיאה בטעינת הגדרות הסוכנת');
          }
          setLoading(false);
          };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { AgentConfig } = await import('@/entities/AgentConfig');
      
      if (config.id) {
        await AgentConfig.update(config.id, config);
      } else {
        const newConfig = await AgentConfig.create(config);
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

  const handleEmergencyStop = async () => {
    setStopping(true);
    try {
      const { WhatsappConversationShacahr } = await import('@/entities/WhatsappConversationShacahr');
      
      // Pause all active conversations
      const activeConvs = await WhatsappConversationShacahr.filter({ status: 'active' });
      
      for (const conv of activeConvs) {
        await WhatsappConversationShacahr.update(conv.id, { status: 'paused' });
      }
      
      // Also deactivate the agent
      if (config?.id) {
        const { AgentConfig } = await import('@/entities/AgentConfig');
        await AgentConfig.update(config.id, { is_active: false });
        updateConfig('is_active', false);
      }
      
      toast.success(`עצרתי ${activeConvs.length} שיחות פעילות והשבתתי את שחר`);
      setShowStopDialog(false);
    } catch (error) {
      console.error('Error stopping agent:', error);
      toast.error('שגיאה בעצירת השיחות');
    }
    setStopping(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-teal-50 to-cyan-50 border-teal-200">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img 
                src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=face" 
                alt="שחר" 
                className="w-16 h-16 rounded-full object-cover border-4 border-teal-200 shadow-lg"
              />
              <div>
                <CardTitle className="flex items-center gap-3">
                  <span>שחר - גיוס מועמדים WhatsApp</span>
                  <Badge className={config?.is_active ? 'bg-teal-100 text-teal-800' : 'bg-gray-100 text-gray-800'}>
                    {config?.is_active ? 'פעילה' : 'לא פעילה'}
                  </Badge>
                </CardTitle>
                <p className="text-sm text-gray-600">
                  סוכנת AI לגיוס מועמדים בוואטסאפ - בניית פרופיל והתאמת משרות
                </p>
              </div>
            </div>
            <Button
              variant="destructive"
              onClick={() => setShowStopDialog(true)}
              disabled={stopping}
              className="gap-2"
            >
              {stopping ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <StopCircle className="w-4 h-4" />
              )}
              עצירת חירום
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Emergency Stop Dialog */}
      <ConfirmDialog
        open={showStopDialog}
        onOpenChange={setShowStopDialog}
        onConfirm={handleEmergencyStop}
        title="עצירת חירום של שחר"
        message="פעולה זו תעצור את כל השיחות הפעילות של שחר ותשבית אותה לחלוטין. האם להמשיך?"
        confirmText="עצור עכשיו"
        cancelText="ביטול"
        variant="destructive"
      />

      {config && (
        <Tabs defaultValue="personality" className="w-full">
          <TabsList className="flex flex-wrap gap-1">
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
          <TabsContent value="personality">
            <Card>
              <CardHeader>
                <CardTitle>אישיות הסוכנת</CardTitle>
                <CardDescription>הגדירי את האופי וסגנון התקשורת של שחר</CardDescription>
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
                    placeholder="תארי את טון הדיבור הספציפי של שחר..."
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
                    placeholder="הודעה שתישלח למועמדים בפתיחת שיחה חדשה..."
                    rows={3}
                  />
                </div>

                <div>
                  <Label>תגובה להודעות לא רלוונטיות</Label>
                  <Textarea
                    value={config.irrelevant_message_response || ''}
                    onChange={(e) => updateConfig('irrelevant_message_response', e.target.value)}
                    placeholder="כיצד להגיב להודעות שלא קשורות לחיפוש עבודה..."
                    rows={2}
                  />
                </div>

                <div>
                  <Label>הודעה בהעברה לנציג</Label>
                  <Textarea
                    value={config.escalation_message || ''}
                    onChange={(e) => updateConfig('escalation_message', e.target.value)}
                    placeholder="הודעה שתישלח כשמעבירים לנציג אנושי..."
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
                    <Label>עיכוב תגובה (שניות)</Label>
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
                    placeholder="מידע כללי על פנדה-טק ששחר יכולה לשתף עם מועמדים..."
                    rows={3}
                  />
                </div>

                <div>
                  <Label>הנחיות מותאמות אישית</Label>
                  <Textarea
                    value={config.custom_instructions || ''}
                    onChange={(e) => updateConfig('custom_instructions', e.target.value)}
                    placeholder="הנחיות נוספות לשחר..."
                    rows={3}
                  />
                </div>

                <ArrayEditor
                  label="יתרונות העבודה דרך פנדה-טק"
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
              <CardContent className="space-y-6">
                <div className="border rounded-lg p-4 bg-blue-50">
                  <h4 className="font-medium text-sm text-blue-800 mb-3">מגבלות שימוש</h4>
                  
                  <div className="flex items-center gap-2 mb-4 p-3 bg-white rounded-lg border border-blue-200">
                    <Switch
                      checked={config.no_limits || false}
                      onCheckedChange={(v) => updateConfig('no_limits', v)}
                    />
                    <Label className="cursor-pointer">ללא מגבלות (שימוש בלתי מוגבל)</Label>
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
                  label="דברים ששחר לעולם לא תגיד"
                  items={config.never_say || []}
                  onAdd={(v) => addToArray('never_say', v)}
                  onRemove={(i) => removeFromArray('never_say', i)}
                />

                <ArrayEditor
                  label="טריגרים להעברה לנציג"
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
                <CardTitle>זמני פעילות</CardTitle>
                <CardDescription>הגדירי מתי שחר זמינה לענות למועמדים</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-4 p-3 bg-teal-50 rounded-lg border border-teal-200">
                  <Switch
                    checked={config.is_active}
                    onCheckedChange={(v) => updateConfig('is_active', v)}
                  />
                  <div>
                    <Label className="font-semibold">שחר פעילה</Label>
                    <p className="text-xs text-gray-600">כאשר כבוי, שחר לא תענה להודעות חדשות</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <Switch
                    checked={config.test_mode || false}
                    onCheckedChange={(v) => updateConfig('test_mode', v)}
                  />
                  <div>
                    <Label className="font-semibold">מצב בדיקות (Test Mode)</Label>
                    <p className="text-xs text-gray-600">מתעלם משעות עבודה ומגבלות - פועל 24/7</p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-teal-600" />
                    שעות מענה למועמדים
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>שעת התחלה</Label>
                      <Input
                        type="time"
                        value={config.working_hours_start || '08:00'}
                        onChange={(e) => updateConfig('working_hours_start', e.target.value)}
                      />
                      <p className="text-xs text-gray-500 mt-1">שחר תענה לפניות החל משעה זו</p>
                    </div>
                    <div>
                      <Label>שעת סיום</Label>
                      <Input
                        type="time"
                        value={config.working_hours_end || '18:00'}
                        onChange={(e) => updateConfig('working_hours_end', e.target.value)}
                      />
                      <p className="text-xs text-gray-500 mt-1">שחר תפסיק לענות לפניות אחרי שעה זו</p>
                    </div>
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

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-teal-600" />
                    התייחסות להודעות קודמות
                  </h4>
                  <div className="flex items-center gap-4 p-3 bg-teal-50 rounded-lg border border-teal-200">
                    <Switch
                      checked={config.consider_previous_messages !== false}
                      onCheckedChange={(v) => updateConfig('consider_previous_messages', v)}
                    />
                    <div>
                      <Label className="font-semibold">התייחס להודעות קודמות בשיחה</Label>
                      <p className="text-xs text-gray-600 mt-1">אם כבוי, שחר תענה בכל הודעה כאילו היא הודעה ראשונה ללא קשר לשיחה הקודמת</p>
                    </div>
                  </div>
                </div>
                </CardContent>
                </Card>
                </TabsContent>

          {/* Training Tab */}
          <TabsContent value="training">
            <AgentTrainingTab 
              config={config}
              onConfigUpdate={updateConfig}
              agentName="שחר"
              scenarioOptions={SCENARIO_OPTIONS}
            />
          </TabsContent>

          {/* Chat Tab */}
          <TabsContent value="chat">
            <AgentChatTab 
              agentId="shacahr_whatsapp"
              agentName="שחר"
            />
          </TabsContent>
        </Tabs>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2 bg-teal-600 hover:bg-teal-700">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          שמור הגדרות
        </Button>
      </div>
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
          placeholder="הוסיפי פריט..."
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

function AgentTrainingTab({ config, onConfigUpdate, agentName, scenarioOptions }) {
  const [trainingExamples, setTrainingExamples] = useState(config.sample_conversations || []);
  const [newExample, setNewExample] = useState({ user_message: '', agent_response: '', scenario: '' });
  const [isAdding, setIsAdding] = useState(false);

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
          אימון {agentName}
        </CardTitle>
        <CardDescription>
          הוסיפי דוגמאות לשיחות כדי לאמן את {agentName} להגיב בצורה מסוימת למצבים שונים
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
                        {scenarioOptions.find(s => s.value === example.scenario)?.label || example.scenario}
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
                    <Bot className="w-4 h-4 text-teal-500 mt-1 flex-shrink-0" />
                    <div className="bg-teal-100 rounded-lg p-2 text-sm flex-1 whitespace-pre-wrap">
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
          <div className="border-2 border-dashed border-teal-300 rounded-lg p-4 space-y-4 bg-teal-50">
            <h4 className="font-medium text-sm text-teal-700">הוספת דוגמה חדשה</h4>
            
            <div>
              <Label>סוג תרחיש</Label>
              <Select 
                value={newExample.scenario} 
                onValueChange={(v) => setNewExample({...newExample, scenario: v})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחרי סוג תרחיש..." />
                </SelectTrigger>
                <SelectContent>
                  {scenarioOptions.map(opt => (
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
                <Bot className="w-4 h-4 text-teal-500" />
                תגובת שחר
              </Label>
              <Textarea
                value={newExample.agent_response}
                onChange={(e) => setNewExample({...newExample, agent_response: e.target.value})}
                placeholder="איך שחר צריכה להגיב..."
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
                הוסיפי דוגמה
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setIsAdding(true)} className="w-full">
            <Plus className="w-4 h-4 ml-2" />
            הוסיפי דוגמת שיחה לאימון
          </Button>
        )}

        {/* Tips */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-medium text-sm text-yellow-800 mb-2">💡 טיפים לאימון יעיל</h4>
          <ul className="text-xs text-yellow-700 space-y-1 list-disc list-inside">
            <li>הוסיפי דוגמאות לשאלות על תחומי עיסוק שונים</li>
            <li>צרי דוגמאות למועמדים עם רקע מגוון</li>
            <li>כללי דוגמאות להצגת משרות בפורמט ברור</li>
            <li>הוסיפי תרחישים של מועמדים שלא מתאימים</li>
            <li>תרגלי תגובות להודעות לא רלוונטיות</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}