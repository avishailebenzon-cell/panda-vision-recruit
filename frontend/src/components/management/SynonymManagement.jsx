import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus,
  Edit,
  Trash2,
  Search,
  BookOpen,
  Upload,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react';

export default function SynonymManagement() {
  const [synonyms, setSynonyms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingSynonym, setEditingSynonym] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [formData, setFormData] = useState({
    original_word: '',
    synonym_word: '',
    category: 'כללי',
    is_active: true,
    notes: ''
  });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [bulkImportData, setBulkImportData] = useState('');
  const [showBulkImport, setShowBulkImport] = useState(false);

  useEffect(() => {
    loadSynonyms();
  }, []);

  const loadSynonyms = async () => {
    setLoading(true);
    try {
      const synonymList = await base44.entities.SynonymMapping.list('-created_date');
      setSynonyms(synonymList);
    } catch (error) {
      console.error('Error loading synonyms:', error);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      original_word: '',
      synonym_word: '',
      category: 'כללי',
      is_active: true,
      notes: ''
    });
    setEditingSynonym(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.original_word.trim() || !formData.synonym_word.trim()) {
      alert('אנא מלא את כל השדות החובה');
      return;
    }

    try {
      if (editingSynonym) {
        await base44.entities.SynonymMapping.update(editingSynonym.id, formData);
      } else {
        await base44.entities.SynonymMapping.create(formData);
      }
      
      await loadSynonyms();
      setShowDialog(false);
      resetForm();
    } catch (error) {
      console.error('Error saving synonym:', error);
      alert('שגיאה בשמירת המילה הנרדפת');
    }
  };

  const handleEdit = (synonym) => {
    setEditingSynonym(synonym);
    setFormData({
      original_word: synonym.original_word,
      synonym_word: synonym.synonym_word,
      category: synonym.category,
      is_active: synonym.is_active,
      notes: synonym.notes || ''
    });
    setShowDialog(true);
  };

  const handleDelete = async (synonymId) => {
    try {
      await base44.entities.SynonymMapping.delete(synonymId);
      await loadSynonyms();
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting synonym:', error);
      alert('שגיאה במחיקת המילה הנרדפת');
    }
  };

  const handleBulkImport = async () => {
    if (!bulkImportData.trim()) return;

    const lines = bulkImportData.trim().split('\n');
    let successCount = 0;
    let errorCount = 0;

    for (const line of lines) {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length >= 2) {
        try {
          await base44.entities.SynonymMapping.create({
            original_word: parts[0],
            synonym_word: parts[1],
            category: parts[2] || 'כללי',
            is_active: true,
            notes: parts[3] || ''
          });
          successCount++;
        } catch (error) {
          errorCount++;
        }
      }
    }

    alert(`ייבוא הושלם: ${successCount} הצלחות, ${errorCount} שגיאות`);
    setBulkImportData('');
    setShowBulkImport(false);
    loadSynonyms();
  };

  const filteredSynonyms = synonyms.filter(synonym => {
    const matchesSearch = !searchTerm || 
      synonym.original_word.toLowerCase().includes(searchTerm.toLowerCase()) ||
      synonym.synonym_word.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || synonym.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && synonym.is_active) ||
      (statusFilter === 'inactive' && !synonym.is_active);

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const categoryColors = {
    'טכנולוגיה': 'bg-blue-100 text-blue-700',
    'תפקיד': 'bg-green-100 text-green-700',
    'כישור': 'bg-purple-100 text-purple-700',
    'השכלה': 'bg-orange-100 text-orange-700',
    'כללי': 'bg-gray-100 text-gray-700'
  };

  const categories = ['טכנולוגיה', 'תפקיד', 'כישור', 'השכלה', 'כללי'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-3">
                <BookOpen className="w-6 h-6 text-indigo-600" />
                ניהול מילים נרדפות לחיפוש
              </CardTitle>
              <p className="text-sm text-gray-600 mt-2">
                הגדר מילים נרדפות כדי לשפר את דיוק החיפושים במערכת
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowBulkImport(true)}
              >
                <Upload className="w-4 h-4 ml-2" />
                ייבוא כמותי
              </Button>
              <Button
                onClick={() => {
                  resetForm();
                  setShowDialog(true);
                }}
              >
                <Plus className="w-4 h-4 ml-2" />
                הוסף מילה נרדפת
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="text-lg font-semibold text-blue-700">{synonyms.length}</div>
              <div className="text-sm text-blue-600">סה״כ מילים נרדפות</div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="text-lg font-semibold text-green-700">
                {synonyms.filter(s => s.is_active).length}
              </div>
              <div className="text-sm text-green-600">פעילות</div>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg">
              <div className="text-lg font-semibold text-purple-700">
                {new Set(synonyms.map(s => s.category)).size}
              </div>
              <div className="text-sm text-purple-600">קטגוריות</div>
            </div>
            <div className="bg-orange-50 p-3 rounded-lg">
              <div className="text-lg font-semibold text-orange-700">
                {synonyms.reduce((sum, s) => sum + (s.usage_count || 0), 0)}
              </div>
              <div className="text-sm text-orange-600">שימושים כוללים</div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="חיפוש מילים נרדפות..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="סנן לפי קטגוריה" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הקטגוריות</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-32">
                <SelectValue placeholder="סטטוס" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">הכל</SelectItem>
                <SelectItem value="active">פעיל</SelectItem>
                <SelectItem value="inactive">לא פעיל</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Synonyms Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>מילה מקורית</TableHead>
                  <TableHead>מילה נרדפת</TableHead>
                  <TableHead>קטגוריה</TableHead>
                  <TableHead>סטטוס</TableHead>
                  <TableHead>שימושים</TableHead>
                  <TableHead>פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSynonyms.length > 0 ? (
                  filteredSynonyms.map((synonym) => (
                    <TableRow key={synonym.id}>
                      <TableCell className="font-medium">
                        {synonym.original_word}
                      </TableCell>
                      <TableCell>{synonym.synonym_word}</TableCell>
                      <TableCell>
                        <Badge className={categoryColors[synonym.category] || categoryColors['כללי']}>
                          {synonym.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {synonym.is_active ? (
                          <Badge className="bg-green-100 text-green-700">
                            <CheckCircle className="w-3 h-3 ml-1" />
                            פעיל
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-700">
                            <XCircle className="w-3 h-3 ml-1" />
                            לא פעיל
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{synonym.usage_count || 0}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(synonym)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteConfirm(synonym)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan="6" className="h-24 text-center">
                      {searchTerm || categoryFilter !== 'all' || statusFilter !== 'all' 
                        ? 'לא נמצאו תוצאות מתאימות לחיפוש'
                        : 'עדיין לא הוגדרו מילים נרדפות במערכת'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingSynonym ? 'עריכת מילה נרדפת' : 'הוספת מילה נרדפת'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="original_word">מילה מקורית *</Label>
              <Input
                id="original_word"
                value={formData.original_word}
                onChange={(e) => setFormData({...formData, original_word: e.target.value})}
                placeholder="המילה שתוחפש..."
                required
              />
            </div>
            <div>
              <Label htmlFor="synonym_word">מילה נרדפת *</Label>
              <Input
                id="synonym_word"
                value={formData.synonym_word}
                onChange={(e) => setFormData({...formData, synonym_word: e.target.value})}
                placeholder="המילה שהמערכת תבין ממנה..."
                required
              />
            </div>
            <div>
              <Label htmlFor="category">קטגוריה</Label>
              <Select value={formData.category} onValueChange={(value) => setFormData({...formData, category: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר קטגוריה" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({...formData, is_active: checked})}
              />
              <Label htmlFor="is_active">מילה נרדפת פעילה</Label>
            </div>
            <div>
              <Label htmlFor="notes">הערות</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="הערות נוספות..."
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                ביטול
              </Button>
              <Button type="submit">
                {editingSynonym ? 'עדכן' : 'הוסף'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>מחיקת מילה נרדפת</DialogTitle>
          </DialogHeader>
          <p>האם אתה בטוח שברצונך למחוק את המילה הנרדפת "{deleteConfirm?.original_word}" → "{deleteConfirm?.synonym_word}"?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              ביטול
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => handleDelete(deleteConfirm.id)}
            >
              מחק
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Import Dialog */}
      <Dialog open={showBulkImport} onOpenChange={setShowBulkImport}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>ייבוא כמותי של מילים נרדפות</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                הזן מילים נרדפות בפורמט: מילה_מקורית, מילה_נרדפת, קטגוריה, הערות (שורה אחת לכל מילה נרדפת)
              </AlertDescription>
            </Alert>
            <Textarea
              value={bulkImportData}
              onChange={(e) => setBulkImportData(e.target.value)}
              placeholder="javascript, JS, טכנולוגיה, שפת תכנות פופולרית&#10;react, ReactJS, טכנולוגיה&#10;מפתח, developer, תפקיד"
              rows={10}
              className="font-mono"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkImport(false)}>
              ביטול
            </Button>
            <Button onClick={handleBulkImport}>
              ייבא מילים נרדפות
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}