import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Trash2, Edit2, Save, X, Search, Shield, FileText, Briefcase, Info } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const COLOR_OPTIONS = [
  { value: 'blue', label: 'כחול', classes: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'green', label: 'ירוק', classes: 'bg-green-50 text-green-700 border-green-200' },
  { value: 'red', label: 'אדום', classes: 'bg-red-50 text-red-700 border-red-200' },
  { value: 'purple', label: 'סגול', classes: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'orange', label: 'כתום', classes: 'bg-orange-50 text-orange-700 border-orange-200' },
  { value: 'pink', label: 'ורוד', classes: 'bg-pink-50 text-pink-700 border-pink-200' },
  { value: 'teal', label: 'טורקיז', classes: 'bg-teal-50 text-teal-700 border-teal-200' },
  { value: 'yellow', label: 'צהוב', classes: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
];

const SEARCH_TYPE_OPTIONS = [
  { value: 'keywords_in_job_history', label: 'מילות מפתח בהיסטוריית עבודה', icon: Briefcase, desc: 'מחפש במקומות העבודה הקודמים של המועמד' },
  { value: 'keywords_in_full_text', label: 'מילות מפתח בכל הטקסט', icon: FileText, desc: 'מחפש בכל תוכן קורות החיים' },
  { value: 'exact_security_clearance', label: 'סיווג בטחוני מדויק', icon: Shield, desc: 'מחפש מועמדים עם סיווג בטחוני ספציפי' },
];

const FIELD_OPTIONS = [
  { value: 'job_companies', label: 'שמות חברות (job_1_company עד job_5_company)' },
  { value: 'job_descriptions', label: 'תיאורי תפקידים (job_1_description וכו\')' },
  { value: 'job_roles', label: 'תפקידים (job_1_role וכו\')' },
  { value: 'main_experience', label: 'ניסיון מרכזי (main_experience)' },
  { value: 'full_text', label: 'טקסט מלא של קורות החיים (full_text)' },
  { value: 'skills_summary', label: 'סיכום כישורים (skills_summary)' },
  { value: 'military_service', label: 'שירות צבאי (military_service)' },
  { value: 'education', label: 'השכלה (education)' },
];

const SECURITY_CLEARANCE_OPTIONS = [
  'רמה 1', 'רמה 2', 'רמה 3', 'סודי', 'סודי ביותר', 'שמור', 'סיווג נמוך'
];

const DEFAULT_FORM = {
  name: '',
  description: '',
  color_theme: 'blue',
  search_type: 'keywords_in_job_history',
  search_keywords: '',
  security_clearance_value: '',
  search_fields: ['job_companies'],
  is_active: true,
  min_keyword_length: 3,
};

export default function CustomChafshanim() {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadConfigs(); }, []);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.CustomChafshanConfig.list('-created_date');
      setConfigs(data || []);
    } catch (e) {
      toast.error('שגיאה בטעינת חפשנים');
    }
    setLoading(false);
  };

  const openCreate = () => {
    setEditingConfig(null);
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  };

  const openEdit = (config) => {
    setEditingConfig(config);
    setForm({
      name: config.name || '',
      description: config.description || '',
      color_theme: config.color_theme || 'blue',
      search_type: config.search_type || 'keywords_in_job_history',
      search_keywords: config.search_keywords || '',
      security_clearance_value: config.security_clearance_value || '',
      search_fields: config.search_fields || ['job_companies'],
      is_active: config.is_active !== false,
      min_keyword_length: config.min_keyword_length || 3,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('חובה להזין שם לחפשן'); return; }
    if (form.search_type !== 'exact_security_clearance' && !form.search_keywords.trim()) {
      toast.error('חובה להזין מילות מפתח'); return;
    }
    if (form.search_type === 'exact_security_clearance' && !form.security_clearance_value) {
      toast.error('חובה לבחור ערך סיווג בטחוני'); return;
    }

    setSaving(true);
    try {
      if (editingConfig) {
        await base44.entities.CustomChafshanConfig.update(editingConfig.id, form);
        toast.success('החפשן עודכן בהצלחה');
      } else {
        await base44.entities.CustomChafshanConfig.create(form);
        toast.success('החפשן נוצר בהצלחה! הוא יופיע במסך החפשנים ויורץ בסריקה הבאה.');
      }
      setDialogOpen(false);
      loadConfigs();
    } catch (e) {
      toast.error('שגיאה בשמירה: ' + e.message);
    }
    setSaving(false);
  };

  const handleDelete = async (config) => {
    if (!confirm(`למחוק את החפשן "${config.name}"?`)) return;
    try {
      await base44.entities.CustomChafshanConfig.delete(config.id);
      toast.success('החפשן נמחק');
      loadConfigs();
    } catch (e) {
      toast.error('שגיאה במחיקה');
    }
  };

  const handleToggleActive = async (config) => {
    try {
      await base44.entities.CustomChafshanConfig.update(config.id, { is_active: !config.is_active });
      loadConfigs();
    } catch (e) {
      toast.error('שגיאה בעדכון');
    }
  };

  const toggleField = (fieldValue) => {
    setForm(prev => ({
      ...prev,
      search_fields: prev.search_fields.includes(fieldValue)
        ? prev.search_fields.filter(f => f !== fieldValue)
        : [...prev.search_fields, fieldValue]
    }));
  };

  const getColorClasses = (theme) => COLOR_OPTIONS.find(c => c.value === theme)?.classes || COLOR_OPTIONS[0].classes;

  const getSearchTypeLabel = (type) => SEARCH_TYPE_OPTIONS.find(t => t.value === type)?.label || type;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Search className="w-5 h-5 text-cyan-600" />
            ניהול חפשנים מותאמים אישית
          </h2>
          <p className="text-sm text-gray-500 mt-1">הגדר חפשנים חדשים שיסרקו את כל מאגר קורות החיים לפי הכללים שתגדיר</p>
        </div>
        <Button onClick={openCreate} className="bg-cyan-600 hover:bg-cyan-700 gap-2">
          <Plus className="w-4 h-4" />
          חפשן חדש
        </Button>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700">
          <p className="font-semibold mb-1">איך זה עובד?</p>
          <ul className="space-y-1 text-xs">
            <li>• חפשן מותאם יופיע אוטומטית במסך "חפשנים" כטאב נפרד</li>
            <li>• בכל הרצה של החפשנים, החפשן המותאם יסרוק את כל מאגר המועמדים</li>
            <li>• מועמדים שנמצאו יתווספו לישות ChafshanResult ויהיו זמינים לסוכן אתגר</li>
            <li>• ניתן להגדיר חיפוש לפי מקום עבודה, סיווג בטחוני, שירות צבאי ועוד</li>
          </ul>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-8 text-gray-400">טוען...</div>
      ) : configs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="w-14 h-14 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">אין חפשנים מותאמים אישית</p>
            <p className="text-sm text-gray-400 mt-1">לחץ "חפשן חדש" כדי ליצור את הראשון</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {configs.map(config => {
            const colorClasses = getColorClasses(config.color_theme);
            const typeInfo = SEARCH_TYPE_OPTIONS.find(t => t.value === config.search_type);
            const TypeIcon = typeInfo?.icon || Search;
            return (
              <Card key={config.id} className={`border-2 ${config.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`px-3 py-1.5 rounded-lg border text-sm font-semibold ${colorClasses}`}>
                        {config.name}
                      </div>
                      <div className="flex-1">
                        {config.description && <p className="text-sm text-gray-600 mb-2">{config.description}</p>}
                        <div className="flex flex-wrap gap-2 text-xs">
                          <Badge variant="outline" className="gap-1">
                            <TypeIcon className="w-3 h-3" />
                            {typeInfo?.label || config.search_type}
                          </Badge>
                          {config.search_type === 'exact_security_clearance' ? (
                            <Badge className="bg-red-100 text-red-700 border-red-200">
                              <Shield className="w-3 h-3 ml-1" />
                              {config.security_clearance_value}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-gray-600 max-w-xs truncate">
                              🔑 {config.search_keywords}
                            </Badge>
                          )}
                          {(config.search_fields || []).map(f => (
                            <Badge key={f} variant="outline" className="text-xs text-gray-500">
                              {FIELD_OPTIONS.find(o => o.value === f)?.label?.split('(')[0]?.trim() || f}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Switch
                        checked={config.is_active !== false}
                        onCheckedChange={() => handleToggleActive(config)}
                        title={config.is_active ? 'פעיל - לחץ להשבית' : 'לא פעיל - לחץ להפעיל'}
                      />
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(config)}>
                        <Edit2 className="w-4 h-4 text-gray-500" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(config)}>
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingConfig ? `עריכת חפשן: ${editingConfig.name}` : 'יצירת חפשן חדש'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 mt-2">
            {/* Name + Description */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>שם החפשן *</Label>
                <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="לדוגמה: חפשן אלביט" />
              </div>
              <div className="space-y-1">
                <Label>תיאור קצר</Label>
                <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="לדוגמה: מועמדים שעבדו באלביט" />
              </div>
            </div>

            {/* Color */}
            <div className="space-y-2">
              <Label>ערכת צבעים</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, color_theme: c.value }))}
                    className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${c.classes} ${form.color_theme === c.value ? 'ring-2 ring-offset-1 ring-gray-600 shadow-md' : ''}`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Type */}
            <div className="space-y-2">
              <Label>סוג החיפוש *</Label>
              <div className="space-y-2">
                {SEARCH_TYPE_OPTIONS.map(t => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, search_type: t.value }))}
                      className={`w-full text-right p-3 rounded-lg border-2 transition-all flex items-start gap-3 ${form.search_type === t.value ? 'border-cyan-500 bg-cyan-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                    >
                      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${form.search_type === t.value ? 'text-cyan-600' : 'text-gray-400'}`} />
                      <div>
                        <p className={`font-semibold text-sm ${form.search_type === t.value ? 'text-cyan-800' : 'text-gray-700'}`}>{t.label}</p>
                        <p className="text-xs text-gray-500">{t.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Keywords OR Security Clearance */}
            {form.search_type === 'exact_security_clearance' ? (
              <div className="space-y-1">
                <Label>ערך סיווג בטחוני לחיפוש *</Label>
                <Select value={form.security_clearance_value} onValueChange={v => setForm(p => ({ ...p, security_clearance_value: v }))}>
                  <SelectTrigger><SelectValue placeholder="בחר סיווג..." /></SelectTrigger>
                  <SelectContent>
                    {SECURITY_CLEARANCE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1">
                <Label>מילות מפתח לחיפוש * <span className="text-gray-400 font-normal">(מופרדות בפסיק)</span></Label>
                <Input
                  value={form.search_keywords}
                  onChange={e => setForm(p => ({ ...p, search_keywords: e.target.value }))}
                  placeholder="לדוגמה: אלביט,elbit,IMI,תעש"
                  dir="rtl"
                />
                <p className="text-xs text-gray-400">כל אחת ממילות המפתח תחפש בשדות שנבחרו. המחרוזת לא תלויה רישיות.</p>
              </div>
            )}

            {/* Search Fields (only for non-clearance types) */}
            {form.search_type !== 'exact_security_clearance' && (
              <div className="space-y-2">
                <Label>שדות לחיפוש</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3 bg-gray-50">
                  {FIELD_OPTIONS.map(f => (
                    <label key={f.value} className="flex items-center gap-2 cursor-pointer hover:bg-white rounded p-1.5 transition-colors">
                      <input
                        type="checkbox"
                        checked={form.search_fields.includes(f.value)}
                        onChange={() => toggleField(f.value)}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-700">{f.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Active toggle */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-sm">פעיל</p>
                <p className="text-xs text-gray-500">חפשן לא פעיל לא יורץ בסריקות</p>
              </div>
              <Switch checked={form.is_active} onCheckedChange={v => setForm(p => ({ ...p, is_active: v }))} />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={saving} className="bg-cyan-600 hover:bg-cyan-700 gap-2">
                {saving ? <><Save className="w-4 h-4 animate-spin" />שומר...</> : <><Save className="w-4 h-4" />{editingConfig ? 'עדכן' : 'צור חפשן'}</>}
              </Button>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                <X className="w-4 h-4 ml-1" />ביטול
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}