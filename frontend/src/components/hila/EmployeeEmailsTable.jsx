import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Download, 
  Loader2, 
  RefreshCw, 
  Mail,
  User,
  CheckCircle,
  XCircle,
  Search
} from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { syncPipedriveEmployees } from '@/functions/syncPipedriveEmployees';

export default function EmployeeEmailsTable({ onEmailsLoaded, currentEmails }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncingEmployees, setSyncingEmployees] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    // Parse current emails and select them
    if (currentEmails) {
      const emailsArray = currentEmails.split(';').map(e => e.trim()).filter(Boolean);
      setSelectedEmails(new Set(emailsArray));
    }
  }, [currentEmails]);

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const employeesList = await base44.entities.Employee.filter({ status: 'פעיל' });
      setEmployees(employeesList);
      toast.success(`נטענו ${employeesList.length} עובדים פעילים`);
    } catch (e) {
      console.error('Error loading employees:', e);
      toast.error('שגיאה בטעינת העובדים');
    }
    setLoading(false);
  };

  const toggleEmail = (email) => {
    if (!email) return;
    
    setSelectedEmails(prev => {
      const newSet = new Set(prev);
      if (newSet.has(email)) {
        newSet.delete(email);
      } else {
        newSet.add(email);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    const filteredEmployeesWithEmail = filteredEmployees.filter(emp => emp.email);
    if (selectedEmails.size === filteredEmployeesWithEmail.length) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(filteredEmployeesWithEmail.map(emp => emp.email)));
    }
  };

  const applySelection = async () => {
    const emailsList = Array.from(selectedEmails).join('; ');
    onEmailsLoaded(emailsList);
    
    // Auto-save to database
    try {
      const { HilaSchedule } = await import('@/entities/HilaSchedule');
      const schedules = await HilaSchedule.list('-updated_date', 1);
      
      if (schedules && schedules.length > 0) {
        await HilaSchedule.update(schedules[0].id, {
          distribution_list_email: emailsList
        });
        toast.success(`${selectedEmails.size} כתובות מייל נשמרו בהצלחה`);
      } else {
        toast.warning(`${selectedEmails.size} כתובות מייל נבחרו - לחץ על "שמור הגדרות" לשמירה סופית`);
      }
    } catch (e) {
      console.error('Error auto-saving emails:', e);
      toast.warning(`${selectedEmails.size} כתובות מייל נבחרו - לחץ על "שמור הגדרות" לשמירה סופית`);
    }
  };

  const handleSyncEmployees = async () => {
    setSyncingEmployees(true);
    try {
      const response = await syncPipedriveEmployees({});
      if (response.data?.success) {
        const { employeesCreated = 0, employeesUpdated = 0 } = response.data;
        toast.success(`סנכרון הושלם: ${employeesCreated} עובדים חדשים, ${employeesUpdated} עודכנו`);
        await loadEmployees();
      } else {
        toast.error(response.data?.error || 'שגיאה בסנכרון עובדים');
      }
    } catch (err) {
      toast.error(err.message || 'שגיאה בסנכרון עובדים');
    }
    setSyncingEmployees(false);
  };

  const filteredEmployees = employees.filter(emp => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      emp.full_name?.toLowerCase().includes(term) ||
      emp.email?.toLowerCase().includes(term) ||
      emp.department?.toLowerCase().includes(term)
    );
  });

  const employeesWithEmail = filteredEmployees.filter(emp => emp.email);
  const employeesWithoutEmail = filteredEmployees.filter(emp => !emp.email);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="w-5 h-5 text-pink-600" />
            כתובות מייל של עובדי החברה
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncEmployees}
              disabled={syncingEmployees || loading}
              className="gap-2 bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
            >
              {syncingEmployees ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              סנכרן עם פייפדרייב
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={loadEmployees}
              disabled={loading}
              className="gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              רענן
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and Stats */}
        <div className="flex flex-col sm:flex-row justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="חיפוש עובד..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-9"
            />
          </div>
          <div className="flex gap-2 items-center">
            <Badge variant="outline" className="bg-blue-50">
              {employeesWithEmail.length} עם מייל
            </Badge>
            {employeesWithoutEmail.length > 0 && (
              <Badge variant="outline" className="bg-red-50 text-red-700">
                {employeesWithoutEmail.length} ללא מייל
              </Badge>
            )}
            <Badge className="bg-green-100 text-green-800">
              {selectedEmails.size} נבחרו
            </Badge>
          </div>
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedEmails.size === employeesWithEmail.length && employeesWithEmail.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>שם עובד</TableHead>
                <TableHead>מחלקה</TableHead>
                <TableHead>כתובת מייל</TableHead>
                <TableHead className="w-20">סטטוס</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    <User className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    לא נמצאו עובדים
                  </TableCell>
                </TableRow>
              ) : (
                filteredEmployees.map((emp) => (
                  <TableRow 
                    key={emp.id} 
                    className={`${selectedEmails.has(emp.email) ? 'bg-green-50' : ''} ${!emp.email ? 'opacity-50' : ''}`}
                  >
                    <TableCell>
                      {emp.email && (
                        <Checkbox
                          checked={selectedEmails.has(emp.email)}
                          onCheckedChange={() => toggleEmail(emp.email)}
                        />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{emp.full_name}</TableCell>
                    <TableCell className="text-sm text-gray-600">{emp.department || '-'}</TableCell>
                    <TableCell className="font-mono text-sm" dir="ltr">
                      {emp.email ? (
                        <div className="flex items-center gap-1">
                          <Mail className="w-3 h-3 text-blue-500" />
                          {emp.email}
                        </div>
                      ) : (
                        <span className="text-red-500 flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          חסר מייל
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {emp.email ? (
                        selectedEmails.has(emp.email) ? (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            נבחר
                          </Badge>
                        ) : (
                          <Badge variant="outline">זמין</Badge>
                        )
                      ) : (
                        <Badge className="bg-red-100 text-red-800">
                          <XCircle className="w-3 h-3 mr-1" />
                          לא זמין
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Apply Selection Button */}
        <div className="flex justify-end pt-2">
          <Button
            onClick={applySelection}
            disabled={selectedEmails.size === 0}
            className="bg-pink-600 hover:bg-pink-700 gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            החל בחירה ({selectedEmails.size} כתובות)
          </Button>
        </div>

        {/* Preview of selected emails */}
        {selectedEmails.size > 0 && (
          <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded border">
            <strong>רשימת תפוצה נוכחית:</strong>
            <div className="mt-1 font-mono" dir="ltr">
              {Array.from(selectedEmails).join('; ')}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}