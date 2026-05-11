import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Edit, GitBranch, Trash2, AlertTriangle, GripVertical, ArrowUp, ArrowDown } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getStatusUsageCount } from '@/functions/getStatusUsageCount';
import { deleteAndReassignStatus } from '@/functions/deleteAndReassignStatus';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const ROLES = ["פנדה-טק", "לקוח", "מערכת"];
const ICONS = ["Circle", "Clock", "Send", "Phone", "FileText", "CheckCircle", "XCircle", "ThumbsUp", "DollarSign", "UserCheck", "Briefcase"];

export default function CandidateStatusManagement() {
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState(null);
  const [deleteState, setDeleteState] = useState({ 
      isOpen: false, 
      status: null, 
      targetStatusId: '', 
      usage: null, 
      isLoading: false 
  });

  const initialFormData = {
    status_number: '',
    status_name: '',
    status_description: '',
    who_can_view: [],
    who_can_update: [],
    is_active: true,
    next_possible_statuses: [],
    color: '#cccccc',
    icon: 'Circle'
  };
  const [formData, setFormData] = useState(initialFormData);
  const [isReordering, setIsReordering] = useState(false);
  const [reorderSaving, setReorderSaving] = useState(false);

  const loadStatuses = async () => {
    setLoading(true);
    try {
      const statusList = await base44.entities.CandidateStatus.list('status_number');
      setStatuses(statusList);
    } catch (error) {
      console.error("Error loading candidate statuses:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadStatuses();
  }, []);

  const handleOpenFormDialog = (status = null) => {
    if (status) {
      setEditingStatus(status);
      setFormData({
        status_number: status.status_number,
        status_name: status.status_name,
        status_description: status.status_description,
        who_can_view: status.who_can_view || [],
        who_can_update: status.who_can_update || [],
        is_active: status.is_active,
        next_possible_statuses: status.next_possible_statuses || [],
        color: status.color || '#cccccc',
        icon: status.icon || 'Circle'
      });
    } else {
      setEditingStatus(null);
      const maxStatusNum = statuses.reduce((max, s) => Math.max(max, s.status_number), 0);
      setFormData({...initialFormData, status_number: maxStatusNum + 1 });
    }
    setIsFormDialogOpen(true);
  };

  const handleOpenDeleteDialog = async (statusToDelete) => {
    setDeleteState({ ...deleteState, isLoading: true, status: statusToDelete, usage: null });
    try {
        const { data } = await getStatusUsageCount({ statusNumber: statusToDelete.status_number });
        if (data.success) {
            setDeleteState({ isOpen: true, status: statusToDelete, usage: data, isLoading: false, targetStatusId: '' });
        } else {
            throw new Error(data.error || 'Failed to get usage count');
        }
    } catch (error) {
        console.error("Error getting usage count:", error);
        alert("שגיאה בקבלת מידע על השימוש במצב.");
        setDeleteState({ isOpen: false, status: null, usage: null, isLoading: false });
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteState.status || !deleteState.targetStatusId) return;

    setDeleteState(prev => ({ ...prev, isLoading: true }));
    try {
        await deleteAndReassignStatus({
            statusToDeleteId: deleteState.status.id,
            newStatusId: deleteState.targetStatusId
        });
        alert(`המצב "${deleteState.status.status_name}" נמחק בהצלחה וכל הפריטים הועברו.`);
        setDeleteState({ isOpen: false, status: null, targetStatusId: '', usage: null, isLoading: false });
        loadStatuses();
    } catch (error) {
        console.error("Error deleting status:", error);
        alert("שגיאה במחיקת המצב: " + error.message);
        setDeleteState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleArrayChange = (field, value) => {
    setFormData(prev => {
      const currentValues = prev[field] || [];
      const newValues = currentValues.includes(value)
        ? currentValues.filter(v => v !== value)
        : [...currentValues, value];
      return { ...prev, [field]: newValues };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        status_number: Number(formData.status_number)
      };

      if (editingStatus) {
        await base44.entities.CandidateStatus.update(editingStatus.id, payload);
      } else {
        if (statuses.some(s => s.status_number === payload.status_number)) {
          alert("מספר מצב כבר קיים. אנא בחר מספר אחר.");
          return;
        }
        await base44.entities.CandidateStatus.create(payload);
      }
      setIsFormDialogOpen(false);
      loadStatuses();
    } catch (error) {
      console.error("Error saving status:", error);
      alert("שגיאה בשמירת המצב.");
    }
  };

  const handleToggleActive = async (status) => {
    try {
        await base44.entities.CandidateStatus.update(status.id, { is_active: !status.is_active });
        loadStatuses();
    } catch (error) {
        console.error("Error toggling status active state:", error);
        alert("שגיאה בעדכון סטטוס הפעילות.");
    }
  };
  
  const getStatusName = (statusNumber) => {
    const status = statuses.find(s => s.status_number === statusNumber);
    return status ? status.status_name : `לא ידוע (${statusNumber})`;
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    
    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;
    
    if (sourceIndex === destIndex) return;
    
    // Reorder local state
    const reorderedStatuses = Array.from(statuses);
    const [removed] = reorderedStatuses.splice(sourceIndex, 1);
    reorderedStatuses.splice(destIndex, 0, removed);
    
    setStatuses(reorderedStatuses);
  };

  const handleMoveStatus = (index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= statuses.length) return;
    
    const reorderedStatuses = Array.from(statuses);
    const [removed] = reorderedStatuses.splice(index, 1);
    reorderedStatuses.splice(newIndex, 0, removed);
    
    setStatuses(reorderedStatuses);
  };

  const handleSaveReorder = async () => {
    setReorderSaving(true);
    try {
      // Build mapping from old status_number to new status_number
      const oldToNewMapping = {};
      const updates = [];
      
      // Assign new sequential status numbers starting from 10 (with gaps of 10)
      statuses.forEach((status, index) => {
        const newStatusNumber = (index + 1) * 10;
        if (status.status_number !== newStatusNumber) {
          oldToNewMapping[status.status_number] = newStatusNumber;
          updates.push({ id: status.id, oldNumber: status.status_number, newNumber: newStatusNumber });
        }
      });
      
      if (updates.length === 0) {
        setIsReordering(false);
        setReorderSaving(false);
        return;
      }
      
      // Helper function to delay between API calls
      const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      
      // First, update all status records with new numbers
      // We need to use temporary numbers first to avoid conflicts
      const tempOffset = 100000;
      
      // Step 1: Update all to temporary numbers (with delays)
      for (const update of updates) {
        await base44.entities.CandidateStatus.update(update.id, { status_number: tempOffset + update.newNumber });
        await delay(200);
      }
      
      // Step 2: Update next_possible_statuses references in ALL statuses
      const allStatuses = await base44.entities.CandidateStatus.list();
      for (const status of allStatuses) {
        if (status.next_possible_statuses && status.next_possible_statuses.length > 0) {
          const updatedNextStatuses = status.next_possible_statuses.map(num => 
            oldToNewMapping[num] !== undefined ? oldToNewMapping[num] : num
          );
          const hasChanges = status.next_possible_statuses.some((num, i) => num !== updatedNextStatuses[i]);
          if (hasChanges) {
            await base44.entities.CandidateStatus.update(status.id, { next_possible_statuses: updatedNextStatuses });
            await delay(200);
          }
        }
      }
      
      // Step 3: Update final status numbers (remove temp offset)
      for (const update of updates) {
        await base44.entities.CandidateStatus.update(update.id, { status_number: update.newNumber });
        await delay(200);
      }
      
      // Step 4: Update Match records (only those that need updating, with batching)
      const allMatches = await base44.entities.Match.list();
      const matchesToUpdate = allMatches.filter(m => 
        m.status_number && oldToNewMapping[m.status_number] !== undefined
      );
      
      for (const match of matchesToUpdate) {
        await base44.entities.Match.update(match.id, { status_number: oldToNewMapping[match.status_number] });
        await delay(150);
      }
      
      // Step 5: Update Candidate records (only those that need updating)
      const allCandidates = await base44.entities.Candidate.list();
      const candidatesToUpdate = allCandidates.filter(c => 
        c.status_number && oldToNewMapping[c.status_number] !== undefined
      );
      
      for (const candidate of candidatesToUpdate) {
        await base44.entities.Candidate.update(candidate.id, { status_number: oldToNewMapping[candidate.status_number] });
        await delay(150);
      }
      
      await loadStatuses();
      setIsReordering(false);
      alert(`הסדר עודכן בהצלחה! עודכנו ${updates.length} מצבים, ${matchesToUpdate.length} התאמות ו-${candidatesToUpdate.length} מועמדים.`);
    } catch (error) {
      console.error("Error saving reorder:", error);
      alert("שגיאה בשמירת הסדר החדש: " + error.message);
      await loadStatuses();
    }
    setReorderSaving(false);
  };

  if (loading) {
    return <div className="flex justify-center items-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
                <CardTitle className="flex items-center gap-2">
                    <GitBranch className="w-6 h-6 text-indigo-600" />
                    ניהול מכונת מצבים למועמדים
                </CardTitle>
                <CardDescription className="mt-2">הגדר את שלבי הגיוס, המעברים ביניהם וההרשאות לכל שלב.</CardDescription>
            </div>
            <div className="flex gap-2">
              {isReordering ? (
                <>
                  <Button 
                    variant="outline" 
                    onClick={() => { setIsReordering(false); loadStatuses(); }}
                    disabled={reorderSaving}
                  >
                    ביטול
                  </Button>
                  <Button 
                    onClick={handleSaveReorder}
                    disabled={reorderSaving}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {reorderSaving ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : null}
                    שמור סדר חדש
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setIsReordering(true)}>
                    <GripVertical className="w-4 h-4 ml-2" />
                    שנה סדר
                  </Button>
                  <Button onClick={() => handleOpenFormDialog()}>
                    <Plus className="w-4 h-4 ml-2" />
                    הוסף מצב חדש
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isReordering && (
            <Alert className="mb-4">
              <GripVertical className="h-4 w-4" />
              <AlertDescription>
                השתמש בחצים או גרור כדי לשנות את סדר המצבים. מספרי המצבים יעודכנו אוטומטית בכל הטבלאות הרלוונטיות.
              </AlertDescription>
            </Alert>
          )}
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {isReordering && <TableHead className="w-20">סדר</TableHead>}
                  <TableHead>מספר</TableHead>
                  <TableHead>שם המצב</TableHead>
                  <TableHead>פעיל</TableHead>
                  <TableHead>הרשאת עדכון</TableHead>
                  <TableHead>מצבים הבאים</TableHead>
                  {!isReordering && <TableHead>פעולות</TableHead>}
                </TableRow>
              </TableHeader>
              {isReordering ? (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="statuses">
                    {(provided) => (
                      <TableBody ref={provided.innerRef} {...provided.droppableProps}>
                        {statuses.map((status, index) => (
                          <Draggable key={status.id} draggableId={status.id} index={index}>
                            {(provided, snapshot) => (
                              <TableRow 
                                ref={provided.innerRef} 
                                {...provided.draggableProps}
                                className={snapshot.isDragging ? 'bg-blue-50' : ''}
                              >
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <div {...provided.dragHandleProps} className="cursor-grab">
                                      <GripVertical className="w-4 h-4 text-gray-400" />
                                    </div>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-6 w-6"
                                      onClick={() => handleMoveStatus(index, 'up')}
                                      disabled={index === 0}
                                    >
                                      <ArrowUp className="w-3 h-3" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-6 w-6"
                                      onClick={() => handleMoveStatus(index, 'down')}
                                      disabled={index === statuses.length - 1}
                                    >
                                      <ArrowDown className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </TableCell>
                                <TableCell className="font-mono text-gray-400">
                                  {status.status_number} → {(index + 1) * 10}
                                </TableCell>
                                <TableCell>
                                  <Badge style={{ backgroundColor: `${status.color}20`, color: status.color, borderColor: status.color }} className="border">
                                    {status.status_name}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Switch
                                    checked={status.is_active}
                                    disabled
                                    aria-label="Toggle active status"
                                  />
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1">
                                    {(status.who_can_update || []).map(role => <Badge key={role} variant="secondary">{role}</Badge>)}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1">
                                    {(status.next_possible_statuses || []).map(num => (
                                      <Badge key={num} variant="outline">{getStatusName(num)}</Badge>
                                    ))}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </TableBody>
                    )}
                  </Droppable>
                </DragDropContext>
              ) : (
                <TableBody>
                  {statuses.map(status => (
                    <TableRow key={status.id}>
                      <TableCell className="font-mono">{status.status_number}</TableCell>
                      <TableCell>
                        <Badge style={{ backgroundColor: `${status.color}20`, color: status.color, borderColor: status.color }} className="border">
                          {status.status_name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={status.is_active}
                          onCheckedChange={() => handleToggleActive(status)}
                          aria-label="Toggle active status"
                        />
                      </TableCell>
                      <TableCell>
                          <div className="flex flex-wrap gap-1">
                              {(status.who_can_update || []).map(role => <Badge key={role} variant="secondary">{role}</Badge>)}
                          </div>
                      </TableCell>
                      <TableCell>
                          <div className="flex flex-wrap gap-1">
                              {(status.next_possible_statuses || []).map(num => (
                                  <Badge key={num} variant="outline">{getStatusName(num)}</Badge>
                              ))}
                          </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenFormDialog(status)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600" onClick={() => handleOpenDeleteDialog(status)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              )}
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
        {/* The form dialog content remains the same */}
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingStatus ? 'עריכת מצב' : 'הוספת מצב חדש'}</DialogTitle>
            <DialogDescription>
              {editingStatus ? `ערוך את פרטי המצב "${editingStatus.status_name}"` : "הגדר מצב חדש במערכת הגיוס."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="status_number">מספר מצב (חייב להיות ייחודי)</Label>
                    <Input
                    id="status_number"
                    type="number"
                    value={formData.status_number}
                    onChange={(e) => setFormData({ ...formData, status_number: e.target.value })}
                    required
                    disabled={!!editingStatus}
                    />
                </div>
                <div>
                    <Label htmlFor="status_name">שם המצב</Label>
                    <Input
                    id="status_name"
                    value={formData.status_name}
                    onChange={(e) => setFormData({ ...formData, status_name: e.target.value })}
                    required
                    />
                </div>
            </div>
            <div>
              <Label htmlFor="status_description">תיאור המצב</Label>
              <Textarea
                id="status_description"
                value={formData.status_description}
                onChange={(e) => setFormData({ ...formData, status_description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>מי יכול לצפות?</Label>
                    <div className="space-y-1">
                        {ROLES.map(role => (
                        <div key={role} className="flex items-center gap-2">
                            <Checkbox
                            id={`view-${role}`}
                            checked={(formData.who_can_view || []).includes(role)}
                            onCheckedChange={() => handleArrayChange('who_can_view', role)}
                            />
                            <Label htmlFor={`view-${role}`}>{role}</Label>
                        </div>
                        ))}
                    </div>
                </div>
                <div className="space-y-2">
                    <Label>מי יכול לעדכן?</Label>
                    <div className="space-y-1">
                        {ROLES.map(role => (
                        <div key={role} className="flex items-center gap-2">
                            <Checkbox
                            id={`update-${role}`}
                            checked={(formData.who_can_update || []).includes(role)}
                            onCheckedChange={() => handleArrayChange('who_can_update', role)}
                            />
                            <Label htmlFor={`update-${role}`}>{role}</Label>
                        </div>
                        ))}
                    </div>
                </div>
            </div>
            <div>
              <Label>מצבים הבאים האפשריים</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2 p-2 border rounded-md max-h-48 overflow-y-auto">
                {statuses.filter(s => s.is_active).map(status => (
                  <div key={status.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`next-${status.status_number}`}
                      checked={(formData.next_possible_statuses || []).includes(status.status_number)}
                      onCheckedChange={() => handleArrayChange('next_possible_statuses', status.status_number)}
                    />
                    <Label htmlFor={`next-${status.status_number}`}>{status.status_name}</Label>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div className="flex items-center gap-2">
                    <Switch
                        id="is_active"
                        checked={formData.is_active}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    />
                    <Label htmlFor="is_active">מצב פעיל</Label>
                </div>
                <div>
                    <Label htmlFor="color">צבע</Label>
                    <Input
                        id="color"
                        type="color"
                        value={formData.color}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                        className="w-full"
                    />
                </div>
            </div>
            <div>
                <Label htmlFor="icon">אייקון</Label>
                <Select
                    value={formData.icon}
                    onValueChange={(value) => setFormData({ ...formData, icon: value })}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="בחר אייקון" />
                    </SelectTrigger>
                    <SelectContent>
                        {ICONS.map(iconName => (
                            <SelectItem key={iconName} value={iconName}>{iconName}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsFormDialogOpen(false)}>
                ביטול
              </Button>
              <Button type="submit">{editingStatus ? 'שמור שינויים' : 'צור מצב'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteState.isOpen} onOpenChange={() => setDeleteState({isOpen: false, status: null, targetStatusId: '', usage: null, isLoading: false })}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>מחיקת המצב "{deleteState.status?.status_name}"</DialogTitle>
                <DialogDescription>
                    פעולה זו אינה הפיכה. לפני המחיקה יש לבחור מצב חדש אליו יועברו כל הפריטים המשויכים.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                        {deleteState.isLoading ? (
                            <div className="flex items-center"><Loader2 className="w-4 h-4 ml-2 animate-spin" /> טוען מידע על שימוש...</div>
                        ) : (
                            <div>
                                מצב זה משמש כעת ב:
                                <ul className="list-disc mr-5 mt-1">
                                    <li><b>{deleteState.usage?.matchesCount || 0}</b> התאמות</li>
                                    <li><b>{deleteState.usage?.candidatesCount || 0}</b> מועמדים</li>
                                </ul>
                            </div>
                        )}
                    </AlertDescription>
                </Alert>
                <div>
                    <Label htmlFor="target-status">העבר את כל הפריטים למצב:</Label>
                    <Select 
                        value={deleteState.targetStatusId} 
                        onValueChange={(value) => setDeleteState(prev => ({...prev, targetStatusId: value}))}
                    >
                        <SelectTrigger id="target-status">
                            <SelectValue placeholder="בחר מצב חלופי" />
                        </SelectTrigger>
                        <SelectContent>
                            {statuses
                                .filter(s => s.id !== deleteState.status?.id && s.is_active)
                                .map(s => (
                                    <SelectItem key={s.id} value={s.id}>
                                        {s.status_name}
                                    </SelectItem>
                                ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteState({isOpen: false, status: null, targetStatusId: '', usage: null, isLoading: false})}>
                    ביטול
                </Button>
                <Button 
                    variant="destructive"
                    onClick={handleConfirmDelete}
                    disabled={!deleteState.targetStatusId || deleteState.isLoading}
                >
                    {deleteState.isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'אשר מחיקה'}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}