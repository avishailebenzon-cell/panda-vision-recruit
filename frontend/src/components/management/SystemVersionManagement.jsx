import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, Plus, Save, Clock, ChevronDown, ChevronUp, Trash2, Bold, Italic, Underline, AlignRight, AlignLeft, AlignCenter, List, ListOrdered, Heading2, Code } from 'lucide-react';
import { toast } from 'sonner';

export default function SystemVersionManagement() {
  const [versions, setVersions] = useState([]);
  const [version, setVersion] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedVersions, setExpandedVersions] = useState({});

  useEffect(() => {
    loadVersions();
  }, []);

  const loadVersions = async () => {
    try {
      const all = await base44.entities.SystemVersion.list('-last_updated', 50);
      setVersions(all);
      if (all.length > 0) {
        setVersion(bumpVersion(all[0].version || '1.0.0'));
      } else {
        setVersion('1.0.0');
      }
    } catch (error) {
      console.error('Error loading versions:', error);
      toast.error('שגיאה בטעינת גרסאות המערכת');
    } finally {
      setLoading(false);
    }
  };

  const bumpVersion = (v) => {
    const parts = v.split('.');
    if (parts.length !== 3) return v;
    parts[2] = String(parseInt(parts[2]) + 1);
    return parts.join('.');
  };

  const incrementVersion = () => {
    setVersion(prev => bumpVersion(prev));
  };

  const handleSave = async () => {
    if (!version.trim()) {
      toast.error('יש להזין מספר גרסה');
      return;
    }
    // Check for duplicate version
    if (versions.some(v => v.version === version.trim())) {
      toast.error(`גרסה ${version.trim()} כבר קיימת`);
      return;
    }

    setSaving(true);
    try {
      const created = await base44.entities.SystemVersion.create({
        version: version.trim(),
        release_notes: releaseNotes.trim(),
        last_updated: new Date().toISOString()
      });
      toast.success(`גרסה ${version.trim()} נוצרה בהצלחה`);
      setReleaseNotes('');
      await loadVersions();
    } catch (error) {
      console.error('Error saving version:', error);
      toast.error('שגיאה בשמירת גרסת המערכת');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (v) => {
    if (!confirm(`למחוק את גרסה ${v.version}?`)) return;
    try {
      await base44.entities.SystemVersion.delete(v.id);
      toast.success('גרסה נמחקה');
      loadVersions();
    } catch (e) {
      toast.error('שגיאה במחיקה');
    }
  };

  const toggleExpand = (id) => {
    setExpandedVersions(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Create new version */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            פרסום גרסה חדשה
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-semibold">מספר גרסה</Label>
            <div className="flex gap-2">
              <Input
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="X.Y.Z"
                className="font-mono text-lg max-w-xs"
                disabled={saving}
              />
              <Button onClick={incrementVersion} variant="outline" className="gap-2" disabled={saving}>
                <Plus className="w-4 h-4" />
                הגדל גרסה
              </Button>
            </div>
            <p className="text-xs text-gray-500">פורמט: X.Y.Z (למשל: 2.1.0)</p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold">הערות שחרור (מה חדש בגרסה זו)</Label>
            {/* Formatting toolbar */}
            <div className="flex flex-wrap gap-1 p-2 bg-gray-50 border border-b-0 rounded-t-md">
              {[
                { icon: Bold, label: 'הדגשה', wrap: ['**', '**'] },
                { icon: Italic, label: 'נטוי', wrap: ['*', '*'] },
                { icon: Underline, label: 'קו תחתון', wrap: ['<u>', '</u>'] },
                { icon: Code, label: 'קוד', wrap: ['`', '`'] },
              ].map(({ icon: Icon, label, wrap }) => (
                <button
                  key={label}
                  type="button"
                  title={label}
                  disabled={saving}
                  className="p-1.5 rounded hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors"
                  onClick={() => {
                    const textarea = document.getElementById('release-notes-textarea');
                    if (!textarea) return;
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const selected = releaseNotes.substring(start, end);
                    const newText = releaseNotes.substring(0, start) + wrap[0] + selected + wrap[1] + releaseNotes.substring(end);
                    setReleaseNotes(newText);
                    setTimeout(() => {
                      textarea.focus();
                      textarea.setSelectionRange(start + wrap[0].length, end + wrap[0].length);
                    }, 0);
                  }}
                >
                  <Icon className="w-4 h-4" />
                </button>
              ))}
              <div className="w-px bg-gray-300 mx-1" />
              {[
                { icon: Heading2, label: 'כותרת', prefix: '## ' },
                { icon: List, label: 'רשימה', prefix: '- ' },
                { icon: ListOrdered, label: 'רשימה ממוספרת', prefix: '1. ' },
              ].map(({ icon: Icon, label, prefix }) => (
                <button
                  key={label}
                  type="button"
                  title={label}
                  disabled={saving}
                  className="p-1.5 rounded hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors"
                  onClick={() => {
                    const textarea = document.getElementById('release-notes-textarea');
                    if (!textarea) return;
                    const start = textarea.selectionStart;
                    const lineStart = releaseNotes.lastIndexOf('\n', start - 1) + 1;
                    const newText = releaseNotes.substring(0, lineStart) + prefix + releaseNotes.substring(lineStart);
                    setReleaseNotes(newText);
                    setTimeout(() => { textarea.focus(); textarea.setSelectionRange(start + prefix.length, start + prefix.length); }, 0);
                  }}
                >
                  <Icon className="w-4 h-4" />
                </button>
              ))}
              <div className="w-px bg-gray-300 mx-1" />
              {[
                { icon: AlignRight, label: 'יישור לימין', tag: 'right' },
                { icon: AlignCenter, label: 'מרכז', tag: 'center' },
                { icon: AlignLeft, label: 'יישור לשמאל', tag: 'left' },
              ].map(({ icon: Icon, label, tag }) => (
                <button
                  key={label}
                  type="button"
                  title={label}
                  disabled={saving}
                  className="p-1.5 rounded hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors"
                  onClick={() => {
                    const textarea = document.getElementById('release-notes-textarea');
                    if (!textarea) return;
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const selected = releaseNotes.substring(start, end);
                    const newText = releaseNotes.substring(0, start) + `<div align="${tag}">${selected}</div>` + releaseNotes.substring(end);
                    setReleaseNotes(newText);
                    setTimeout(() => { textarea.focus(); }, 0);
                  }}
                >
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
            <Textarea
              id="release-notes-textarea"
              value={releaseNotes}
              onChange={(e) => setReleaseNotes(e.target.value)}
              placeholder="תיאור החידושים והשינויים בגרסה זו. תומך ב-Markdown."
              className="min-h-[200px] font-sans rounded-t-none"
              disabled={saving}
            />
            <p className="text-xs text-gray-500">תומך ב-Markdown: **מודגש**, *נטוי*, `קוד`, כותרות (#), רשימות</p>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} className="bg-purple-600 hover:bg-purple-700 gap-2">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> שומר...</> : <><Save className="w-4 h-4" /> פרסם גרסה</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* All versions history */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-600" />
            היסטוריית גרסאות ({versions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {versions.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-6">אין גרסאות רשומות עדיין</p>
          ) : (
            <div className="space-y-2">
              {versions.map((v, idx) => (
                <div key={v.id} className={`border rounded-lg overflow-hidden ${idx === 0 ? 'border-purple-300 bg-purple-50' : 'border-gray-200 bg-white'}`}>
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Badge className={idx === 0 ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700'}>
                        v{v.version}
                      </Badge>
                      {idx === 0 && <Badge variant="outline" className="text-xs text-purple-600 border-purple-300">עדכנית</Badge>}
                      <span className="text-xs text-gray-500">
                        {v.last_updated ? new Date(v.last_updated).toLocaleString('he-IL') : new Date(v.created_date).toLocaleString('he-IL')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {v.release_notes && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleExpand(v.id)}>
                          {expandedVersions[v.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => handleDelete(v)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  {expandedVersions[v.id] && v.release_notes && (
                    <div className="px-4 pb-3 border-t border-gray-100 bg-white">
                      <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed mt-2">
                        {v.release_notes}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}