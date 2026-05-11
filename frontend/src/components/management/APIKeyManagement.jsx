import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Copy, Trash2, Plus, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export default function APIKeyManagement() {
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyDescription, setNewKeyDescription] = useState('');
  const [visibleKeys, setVisibleKeys] = useState({});

  useEffect(() => {
    fetchAPIKeys();
  }, []);

  const fetchAPIKeys = async () => {
    try {
      const keys = await base44.entities.APIKey.list();
      setApiKeys(keys);
    } catch (error) {
      console.error('Error fetching API keys:', error);
      toast.error('שגיאה בטעינת API keys');
    } finally {
      setLoading(false);
    }
  };

  const generateRandomKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'sk_';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      toast.error('חייב להזין שם ל-API key');
      return;
    }

    try {
      const generatedKey = generateRandomKey();
      await base44.entities.APIKey.create({
        key_name: newKeyName,
        api_key: generatedKey,
        description: newKeyDescription,
        is_active: true
      });

      toast.success(`API key נוצר בהצלחה`);
      setNewKeyName('');
      setNewKeyDescription('');
      setShowForm(false);
      fetchAPIKeys();
    } catch (error) {
      console.error('Error creating API key:', error);
      toast.error('שגיאה ביצירת API key');
    }
  };

  const handleDeleteKey = async (id) => {
    if (confirm('האם אתה בטוח שברצונך למחוק את API key זה?')) {
      try {
        await base44.entities.APIKey.delete(id);
        toast.success('API key נמחק בהצלחה');
        fetchAPIKeys();
      } catch (error) {
        console.error('Error deleting API key:', error);
        toast.error('שגיאה במחיקת API key');
      }
    }
  };

  const handleToggleActive = async (id, currentStatus) => {
    try {
      await base44.entities.APIKey.update(id, {
        is_active: !currentStatus
      });
      toast.success('API key עודכן');
      fetchAPIKeys();
    } catch (error) {
      console.error('Error updating API key:', error);
      toast.error('שגיאה בעדכון API key');
    }
  };

  const handleCopyKey = (key) => {
    navigator.clipboard.writeText(key);
    toast.success('API key הועתק ללוח');
  };

  const toggleKeyVisibility = (id) => {
    setVisibleKeys(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  if (loading) {
    return <div className="text-center py-8">טוען...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">ניהול API Keys</h2>
          <p className="text-gray-600 mt-1">נהל את ה-API keys להתחברות מאפליקציות חיצוניות</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          יצור API Key חדש
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>יצור API Key חדש</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">שם ה-API Key</label>
              <Input
                placeholder="לדוגמה: External App - Job Sync"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">תיאור (אופציונלי)</label>
              <Input
                placeholder="לאיזה אפליקציה זה מיועד?"
                value={newKeyDescription}
                onChange={(e) => setNewKeyDescription(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreateKey}>צור</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>בטל</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {apiKeys.length === 0 ? (
          <Card>
            <CardContent className="pt-8">
              <p className="text-center text-gray-500">אין API keys עדיין</p>
            </CardContent>
          </Card>
        ) : (
          apiKeys.map(key => (
            <Card key={key.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold">{key.key_name}</h3>
                      <Badge variant={key.is_active ? 'default' : 'secondary'}>
                        {key.is_active ? 'פעיל' : 'לא פעיל'}
                      </Badge>
                    </div>
                    {key.description && (
                      <p className="text-sm text-gray-600 mb-3">{key.description}</p>
                    )}
                    
                    <div className="bg-gray-50 p-3 rounded-lg flex items-center gap-2 mb-3">
                      <code className="flex-1 text-sm font-mono">
                        {visibleKeys[key.id] ? key.api_key : '••••••••' + key.api_key.slice(-8)}
                      </code>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => toggleKeyVisibility(key.id)}
                        title={visibleKeys[key.id] ? 'הסתר' : 'הצג'}
                      >
                        {visibleKeys[key.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleCopyKey(key.api_key)}
                        title="העתק"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="text-xs text-gray-500">
                      {key.last_used ? (
                        <p>שימוש אחרון: {new Date(key.last_used).toLocaleString('he-IL')}</p>
                      ) : (
                        <p>לא בשימוש עדיין</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">פעיל:</span>
                      <Switch
                        checked={key.is_active}
                        onCheckedChange={() => handleToggleActive(key.id, key.is_active)}
                      />
                    </div>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => handleDeleteKey(key.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-lg">כיצד להשתמש</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><strong>End-point:</strong> <code className="bg-white p-1 rounded">/functions/getJobsViaAPI</code></p>
          <p><strong>Method:</strong> POST</p>
          <p><strong>Header:</strong> <code className="bg-white p-1 rounded">x-api-key: [YOUR_API_KEY]</code></p>
          <p className="text-gray-700">ה-API יחזיר JSON עם רשימת כל המשרות הפעילות במערכת</p>
        </CardContent>
      </Card>
    </div>
  );
}