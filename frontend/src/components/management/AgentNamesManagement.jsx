import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Save, 
  Loader2, 
  BrainCircuit,
  RotateCcw,
  User
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { DEFAULT_AGENTS, useAgentNames } from '../context/AgentNamesContext';

export default function AgentNamesManagement() {
  const { refreshAgentNames } = useAgentNames();
  const [configs, setConfigs] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const { AgentDisplayConfig } = await import('@/entities/AgentDisplayConfig');
      const existingConfigs = await AgentDisplayConfig.list();
      
      const configMap = {};
      
      // Initialize with defaults
      Object.keys(DEFAULT_AGENTS).forEach(agentId => {
        configMap[agentId] = {
          agent_id: agentId,
          display_name: DEFAULT_AGENTS[agentId].defaultName,
          role_title: DEFAULT_AGENTS[agentId].roleTitle,
          description: DEFAULT_AGENTS[agentId].description,
          avatar_url: DEFAULT_AGENTS[agentId].avatar,
          gender: DEFAULT_AGENTS[agentId].gender || 'female',
          isDefault: true
        };
      });
      
      // Override with saved configs
      existingConfigs.forEach(config => {
        if (configMap[config.agent_id]) {
          configMap[config.agent_id] = {
            ...configMap[config.agent_id],
            id: config.id,
            display_name: config.display_name || configMap[config.agent_id].display_name,
            role_title: config.role_title || configMap[config.agent_id].role_title,
            description: config.description || configMap[config.agent_id].description,
            avatar_url: config.avatar_url || configMap[config.agent_id].avatar_url,
            gender: config.gender || configMap[config.agent_id].gender,
            isDefault: false
          };
        }
      });

      setConfigs(configMap);
    } catch (error) {
      console.error('Error loading configs:', error);
      toast.error('שגיאה בטעינת ההגדרות');
    }
    setLoading(false);
  };

  const updateConfig = (agentId, field, value) => {
    setConfigs(prev => ({
      ...prev,
      [agentId]: {
        ...prev[agentId],
        [field]: value,
        isDefault: false
      }
    }));
  };

  const resetToDefault = (agentId) => {
    const defaultAgent = DEFAULT_AGENTS[agentId];
    setConfigs(prev => ({
      ...prev,
      [agentId]: {
        ...prev[agentId],
        display_name: defaultAgent.defaultName,
        role_title: defaultAgent.roleTitle,
        description: defaultAgent.description,
        avatar_url: defaultAgent.avatar,
        gender: defaultAgent.gender || 'female',
        isDefault: true
      }
    }));
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const { AgentDisplayConfig } = await import('@/entities/AgentDisplayConfig');
      
      for (const agentId of Object.keys(configs)) {
        const config = configs[agentId];
        const dataToSave = {
          agent_id: agentId,
          display_name: config.display_name,
          role_title: config.role_title,
          description: config.description,
          avatar_url: config.avatar_url,
          gender: config.gender
        };
        
        if (config.id) {
          await AgentDisplayConfig.update(config.id, dataToSave);
        } else {
          const newConfig = await AgentDisplayConfig.create(dataToSave);
          setConfigs(prev => ({
            ...prev,
            [agentId]: { ...prev[agentId], id: newConfig.id }
          }));
        }
      }
      
      refreshAgentNames();
      toast.success('שמות הסוכנים נשמרו בהצלחה');
    } catch (error) {
      console.error('Error saving configs:', error);
      toast.error('שגיאה בשמירת ההגדרות');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Group agents by category
  const recruitmentAgents = ['carmit', 'naama', 'roee', 'rotem', 'yael', 'noa', 'elad', 'hila', 'raviv'];
  const hrAgents = ['shiri', 'inbar'];

  const renderAgentCard = (agentId) => {
    const config = configs[agentId];
    const defaultAgent = DEFAULT_AGENTS[agentId];
    if (!config) return null;

    const isModified = config.display_name !== defaultAgent.defaultName || 
                       config.role_title !== defaultAgent.roleTitle;

    return (
      <Card key={agentId} className={`${isModified ? 'border-blue-300 bg-blue-50/30' : ''}`}>
        <CardContent className="pt-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-gray-200 flex-shrink-0">
              <img 
                src={config.avatar_url} 
                alt={config.display_name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {defaultAgent.defaultName}
                </Badge>
                {isModified && (
                  <Badge className="bg-blue-100 text-blue-700 text-xs">
                    שונה
                  </Badge>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-500">שם תצוגה</Label>
                  <Input
                    value={config.display_name}
                    onChange={(e) => updateConfig(agentId, 'display_name', e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">כותרת תפקיד</Label>
                  <Input
                    value={config.role_title}
                    onChange={(e) => updateConfig(agentId, 'role_title', e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-500">תיאור</Label>
                  <Input
                    value={config.description}
                    onChange={(e) => updateConfig(agentId, 'description', e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">מגדר (לשון פנייה)</Label>
                  <Select
                    value={config.gender || 'female'}
                    onValueChange={(value) => updateConfig(agentId, 'gender', value)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="female">נקבה</SelectItem>
                      <SelectItem value="male">זכר</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isModified && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetToDefault(agentId)}
                  className="text-xs h-7"
                >
                  <RotateCcw className="w-3 h-3 ml-1" />
                  איפוס לברירת מחדל
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            כינויי סוכנים
          </CardTitle>
          <CardDescription>
            התאם אישית את שמות הסוכנים כפי שיופיעו במערכת. השינויים ישפיעו על כל התצוגות.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* מחלקת גיוס */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-2">
          <BrainCircuit className="w-4 h-4" />
          מחלקת גיוס
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {recruitmentAgents.map(renderAgentCard)}
        </div>
      </div>

      {/* משאבי אנוש */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-2">
          <BrainCircuit className="w-4 h-4" />
          משאבי אנוש
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {hrAgents.map(renderAgentCard)}
        </div>
      </div>

      {/* Save Button */}
      <div className="sticky bottom-4 bg-gradient-to-t from-white via-white to-transparent pt-6 pb-2">
        <div className="flex justify-center">
          <Button 
            onClick={handleSaveAll} 
            disabled={saving} 
            size="lg"
            className="gap-2 shadow-xl bg-blue-600 hover:bg-blue-700 px-8"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            שמור את כל השינויים
          </Button>
        </div>
      </div>
    </div>
  );
}