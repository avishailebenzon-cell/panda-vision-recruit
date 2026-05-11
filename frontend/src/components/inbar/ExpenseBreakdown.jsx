import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
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
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  DollarSign,
  Edit,
  Save,
  X,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  Loader2,
  Calculator,
  MessageCircle,
  Bot,
  Send
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

export default function ExpenseBreakdown({ plan }) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editDialog, setEditDialog] = useState({ isOpen: false, expense: null });
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({});
  
  // Inbar chat dialog states
  const [chatDialog, setChatDialog] = useState({ isOpen: false, expense: null, type: 'expense' }); // type: 'expense' or 'total'
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatConversation, setChatConversation] = useState(null);

  useEffect(() => {
    if (plan?.id) {
      loadExpenses();
    }
  }, [plan?.id]);

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const allExpenses = await base44.entities.HRPlanExpense.filter({ plan_id: plan.id });
      setExpenses(allExpenses);
    } catch (error) {
      console.error('Error loading expenses:', error);
    }
    setLoading(false);
  };

  const openEditDialog = (expense) => {
    setFormData({
      actual_cost_per_employee: expense.actual_cost_per_employee || '',
      actual_total_cost: expense.actual_total_cost || '',
      employee_count: expense.employee_count || plan.employee_count,
      status: expense.status || 'planned',
      notes: expense.notes || ''
    });
    setEditDialog({ isOpen: true, expense });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const actualCostPerEmployee = parseFloat(formData.actual_cost_per_employee) || 0;
      const employeeCount = parseInt(formData.employee_count) || 0;
      const actualTotal = parseFloat(formData.actual_total_cost) || (actualCostPerEmployee * employeeCount);
      
      const variance = actualTotal - editDialog.expense.planned_total_cost;
      const variancePercentage = editDialog.expense.planned_total_cost > 0 
        ? parseFloat(((variance / editDialog.expense.planned_total_cost) * 100).toFixed(2))
        : 0;

      await base44.entities.HRPlanExpense.update(editDialog.expense.id, {
        actual_cost_per_employee: actualCostPerEmployee,
        actual_total_cost: actualTotal,
        employee_count: employeeCount,
        status: formData.status,
        notes: formData.notes || '',
        variance,
        variance_percentage: variancePercentage
      });

      // Update plan's actual_cost
      const newPlanActualCost = expenses.reduce((sum, exp) => {
        if (exp.id === editDialog.expense.id) {
          return sum + actualTotal;
        }
        return sum + (exp.actual_total_cost || 0);
      }, 0);

      await base44.entities.HRPlan.update(plan.id, {
        actual_cost: newPlanActualCost
      });

      toast.success('העלות עודכנה בהצלחה');
      setEditDialog({ isOpen: false, expense: null });
      await loadExpenses();
    } catch (error) {
      console.error('Error saving expense:', error);
      toast.error('שגיאה בעדכון העלות');
    }
    setSaving(false);
  };

  const getTotalPlanned = () => {
    return expenses.reduce((sum, exp) => sum + (exp.planned_total_cost || 0), 0);
  };

  const getTotalActual = () => {
    return expenses.reduce((sum, exp) => sum + (exp.actual_total_cost || 0), 0);
  };

  const getTotalVariance = () => {
    return getTotalActual() - getTotalPlanned();
  };

  const getCostPerEmployee = () => {
    const employeeCount = plan?.employee_count || 45;
    return employeeCount > 0 ? Math.round(getTotalPlanned() / employeeCount) : 0;
  };

  const getActualCostPerEmployee = () => {
    const employeeCount = plan?.employee_count || 45;
    return employeeCount > 0 ? Math.round(getTotalActual() / employeeCount) : 0;
  };

  // Open chat dialog for a specific expense or total budget
  const openChatDialog = async (expense = null, type = 'expense') => {
    setChatDialog({ isOpen: true, expense, type });
    setChatMessages([]);
    setChatConversation(null);
    
    try {
      // Create a new conversation for this context
      const contextName = type === 'total' 
        ? `תקציב כולל - ${plan.year}` 
        : `${expense?.event_name} - ${plan.year}`;
      
      const conversation = await base44.agents.createConversation({
        agent_name: "inbar_hr_planner",
        metadata: {
          name: contextName,
          type: type === 'total' ? 'budget_discussion' : 'expense_discussion',
          plan_id: plan.id,
          expense_id: expense?.id || null
        }
      });
      
      setChatConversation(conversation);
      
      base44.agents.subscribeToConversation(conversation.id, (data) => {
        setChatMessages(data.messages || []);
      });

      // Send initial context message
      let contextMessage = '';
      if (type === 'total') {
        contextMessage = `אני רוצה לדבר על התקציב הכולל של תוכנית משא"ן ${plan.year}.
        
פרטי התקציב:
- תקציב מתוכנן: ₪${getTotalPlanned().toLocaleString()}
- בוצע בפועל: ₪${getTotalActual().toLocaleString()}
- עלות לעובד (מתוכנן): ₪${getCostPerEmployee().toLocaleString()}
- מספר עובדים: ${plan.employee_count || 45}

בבקשה עזרי לי לחשוב על דרכים לייעל את התקציב או להציע שינויים.`;
      } else {
        contextMessage = `אני רוצה לדבר על השורה "${expense.event_name}" בתוכנית משא"ן ${plan.year}.

פרטי השורה:
- סוג: ${expense.expense_type}
- תאריך: ${expense.event_date || 'לא נקבע'}
- עלות מתוכננת: ₪${expense.planned_total_cost.toLocaleString()}
- עלות לעובד: ₪${expense.planned_cost_per_employee || 0}
${expense.actual_total_cost ? `- עלות בפועל: ₪${expense.actual_total_cost.toLocaleString()}` : ''}

בבקשה עזרי לי לחשוב על רעיונות, אפשרויות או שינויים לשורה הזו.`;
      }

      await base44.agents.addMessage(conversation, {
        role: "user",
        content: contextMessage
      });
      
    } catch (e) {
      console.error('Error starting chat:', e);
      toast.error('שגיאה בפתיחת השיחה');
    }
  };

  const handleSendChatMessage = async () => {
    if (!chatInput.trim() || chatLoading || !chatConversation) return;
    
    setChatLoading(true);
    const messageText = chatInput;
    setChatInput('');

    try {
      await base44.agents.addMessage(chatConversation, {
        role: "user",
        content: messageText
      });
    } catch (e) {
      console.error('Error sending message:', e);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'סליחה, משהו השתבש. נסי שוב.'
      }]);
    }
    setChatLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-purple-600" />
            פירוט חישוב עלויות - {plan.year}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card className="bg-blue-50">
              <CardContent className="p-4">
                <div className="text-sm text-gray-600 mb-1">תקציב מתוכנן</div>
                <div className="text-2xl font-bold text-blue-600">
                  ₪{getTotalPlanned().toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  ₪{getCostPerEmployee().toLocaleString()} לעובד
                </div>
              </CardContent>
            </Card>
            <Card className="bg-green-50">
              <CardContent className="p-4">
                <div className="text-sm text-gray-600 mb-1">בוצע בפועל</div>
                <div className="text-2xl font-bold text-green-600">
                  ₪{getTotalActual().toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  ₪{getActualCostPerEmployee().toLocaleString()} לעובד
                </div>
              </CardContent>
            </Card>
            <Card className={getTotalVariance() >= 0 ? 'bg-red-50' : 'bg-emerald-50'}>
              <CardContent className="p-4">
                <div className="text-sm text-gray-600 mb-1">הפרש</div>
                <div className={`text-2xl font-bold flex items-center gap-2 ${
                  getTotalVariance() >= 0 ? 'text-red-600' : 'text-emerald-600'
                }`}>
                  {getTotalVariance() >= 0 ? (
                    <TrendingUp className="w-5 h-5" />
                  ) : (
                    <TrendingDown className="w-5 h-5" />
                  )}
                  ₪{Math.abs(getTotalVariance()).toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-purple-50 cursor-pointer hover:bg-purple-100 transition-colors" onClick={() => openChatDialog(null, 'total')}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600 mb-1">עלות לעובד (מתוכנן)</div>
                    <div className="text-2xl font-bold text-purple-600">
                      ₪{getCostPerEmployee().toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {plan?.employee_count || 45} עובדים
                    </div>
                  </div>
                  <MessageCircle className="w-5 h-5 text-purple-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chat with Inbar about total budget */}
          <div className="mb-4">
            <Button
              variant="outline"
              onClick={() => openChatDialog(null, 'total')}
              className="border-purple-300 text-purple-600 hover:bg-purple-50"
            >
              <MessageCircle className="w-4 h-4 ml-2" />
              שיחה עם ענבר על התקציב הכולל
            </Button>
          </div>

          {/* Expenses Table */}
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>אירוע</TableHead>
                  <TableHead>תאריך</TableHead>
                  <TableHead>סוג</TableHead>
                  <TableHead>מתוכנן</TableHead>
                  <TableHead>בפועל</TableHead>
                  <TableHead>הפרש</TableHead>
                  <TableHead>סטטוס</TableHead>
                  <TableHead>פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => {
                  const variance = (expense.actual_total_cost || 0) - expense.planned_total_cost;
                  const hasActual = expense.actual_total_cost > 0;
                  
                  return (
                    <TableRow key={expense.id} className={hasActual ? 'bg-green-50' : ''}>
                      <TableCell className="font-medium">{expense.event_name}</TableCell>
                      <TableCell className="text-sm">{expense.event_date}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {expense.expense_type === 'holiday' ? 'חג' :
                           expense.expense_type === 'birthday' ? 'יום הולדת' :
                           expense.expense_type === 'orientation' ? 'קליטה' :
                           expense.expense_type === 'forum' ? 'פורום' :
                           expense.expense_type === 'toast' ? 'הרמת כוסית' :
                           expense.expense_type === 'special_event' ? 'אירוע מיוחד' : 'אחר'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">₪{expense.planned_total_cost.toLocaleString()}</div>
                          {expense.planned_cost_per_employee > 0 && (
                            <div className="text-xs text-gray-500">
                              (₪{expense.planned_cost_per_employee}/עובד)
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {hasActual ? (
                          <div className="text-sm">
                            <div className="font-medium text-green-700">
                              ₪{expense.actual_total_cost.toLocaleString()}
                            </div>
                            {expense.actual_cost_per_employee > 0 && (
                              <div className="text-xs text-gray-500">
                                (₪{expense.actual_cost_per_employee}/עובד)
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {hasActual ? (
                          <div className={`text-sm font-medium flex items-center gap-1 ${
                            variance > 0 ? 'text-red-600' : variance < 0 ? 'text-emerald-600' : 'text-gray-600'
                          }`}>
                            {variance > 0 && <TrendingUp className="w-3 h-3" />}
                            {variance < 0 && <TrendingDown className="w-3 h-3" />}
                            ₪{Math.abs(variance).toLocaleString()}
                            {expense.variance_percentage && (
                              <span className="text-xs">({expense.variance_percentage}%)</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            expense.status === 'completed' ? 'bg-green-100 text-green-800' :
                            expense.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                            expense.status === 'cancelled' ? 'bg-gray-100 text-gray-800' :
                            'bg-yellow-100 text-yellow-800'
                          }
                        >
                          {expense.status === 'completed' && <CheckCircle className="w-3 h-3 ml-1" />}
                          {expense.status === 'completed' ? 'בוצע' :
                           expense.status === 'in_progress' ? 'בתהליך' :
                           expense.status === 'cancelled' ? 'בוטל' : 'מתוכנן'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openChatDialog(expense, 'expense')}
                            className="h-8 w-8 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                            title="שיחה עם ענבר על שורה זו"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(expense)}
                            className="h-8 w-8"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {expenses.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <DollarSign className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>אין הוצאות רשומות עבור תוכנית זו</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialog.isOpen} onOpenChange={(open) => !open && setEditDialog({ isOpen: false, expense: null })}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>עדכון עלות בפועל - {editDialog.expense?.event_name}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">עלות מתוכננת כוללת</Label>
                <div className="text-lg font-bold text-gray-900 mt-1">
                  ₪{editDialog.expense?.planned_total_cost.toLocaleString()}
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">עלות מתוכננת לעובד</Label>
                <div className="text-lg font-bold text-gray-900 mt-1">
                  ₪{editDialog.expense?.planned_cost_per_employee || 0}
                </div>
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <div>
                <Label htmlFor="employee_count">כמות עובדים בפועל</Label>
                <Input
                  id="employee_count"
                  type="number"
                  value={formData.employee_count || ''}
                  onChange={(e) => setFormData({ ...formData, employee_count: parseInt(e.target.value) || 0 })}
                  placeholder="45"
                />
              </div>

              <div>
                <Label htmlFor="actual_cost_per_employee">עלות בפועל לעובד (₪)</Label>
                <Input
                  id="actual_cost_per_employee"
                  type="number"
                  value={formData.actual_cost_per_employee || ''}
                  onChange={(e) => setFormData({ ...formData, actual_cost_per_employee: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>

              <div>
                <Label htmlFor="actual_total_cost">עלות בפועל כוללת (₪)</Label>
                <Input
                  id="actual_total_cost"
                  type="number"
                  value={formData.actual_total_cost || ''}
                  onChange={(e) => setFormData({ ...formData, actual_total_cost: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                />
                {formData.actual_cost_per_employee > 0 && formData.employee_count > 0 && (
                  <div className="text-xs text-gray-500 mt-1">
                    חישוב אוטומטי: ₪{(formData.actual_cost_per_employee * formData.employee_count).toLocaleString()}
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="status">סטטוס</Label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full border rounded-md p-2"
                >
                  <option value="planned">מתוכנן</option>
                  <option value="in_progress">בתהליך</option>
                  <option value="completed">בוצע</option>
                  <option value="cancelled">בוטל</option>
                </select>
              </div>

              <div>
                <Label htmlFor="notes">הערות</Label>
                <Input
                  id="notes"
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="הערות על הביצוע..."
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialog({ isOpen: false, expense: null })}
              disabled={saving}
            >
              <X className="w-4 h-4 ml-2" />
              ביטול
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 ml-2" />
              )}
              שמור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chat with Inbar Dialog */}
      <Dialog open={chatDialog.isOpen} onOpenChange={(open) => !open && setChatDialog({ isOpen: false, expense: null, type: 'expense' })}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden" dir="rtl">
          <DialogHeader className="bg-gradient-to-r from-purple-50 to-pink-50 -mx-6 -mt-6 px-6 pt-6 pb-4 border-b border-purple-100">
            <div className="flex items-center gap-3">
              <img 
                src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=60&h=60&fit=crop&crop=face" 
                alt="ענבר" 
                className="w-12 h-12 rounded-full object-cover border-2 border-purple-200"
              />
              <div>
                <DialogTitle className="text-lg">
                  {chatDialog.type === 'total' 
                    ? `שיחה עם ענבר - תקציב כולל ${plan.year}`
                    : `שיחה עם ענבר - ${chatDialog.expense?.event_name}`
                  }
                </DialogTitle>
                <p className="text-xs text-gray-600">
                  {chatDialog.type === 'total' 
                    ? 'רעיונות לייעול התקציב, שינויים בעלויות'
                    : 'רעיונות, מחשבות ושינויים על שורה זו'
                  }
                </p>
              </div>
            </div>
          </DialogHeader>

          {/* Chat Messages */}
          <div className="h-80 overflow-y-auto p-4 space-y-3 bg-gray-50 -mx-6">
            {chatMessages.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <Bot className="w-12 h-12 mx-auto mb-3 text-purple-300" />
                <p className="text-sm">ענבר מכינה תשובה...</p>
                <Loader2 className="w-5 h-5 animate-spin mx-auto mt-2 text-purple-400" />
              </div>
            ) : (
              chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'} px-4`}>
                  <div className={`max-w-[80%] rounded-xl px-4 py-2 ${
                    msg.role === 'user' 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-white border border-gray-200 text-gray-800'
                  }`}>
                    {msg.role === 'user' ? (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <ReactMarkdown className="text-sm prose prose-sm max-w-none">
                        {msg.content}
                      </ReactMarkdown>
                    )}
                  </div>
                </div>
              ))
            )}
            {chatLoading && (
              <div className="flex justify-end px-4">
                <div className="bg-white border border-gray-200 rounded-xl px-4 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                </div>
              </div>
            )}
          </div>
          
          {/* Chat Input */}
          <div className="pt-3 border-t flex gap-2 -mx-6 px-6">
            <Textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="שאל את ענבר על התקציב, רעיונות לייעול, שינויים..."
              className="resize-none min-h-[44px] max-h-24"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendChatMessage();
                }
              }}
            />
            <Button 
              onClick={handleSendChatMessage} 
              disabled={chatLoading || !chatInput.trim()}
              className="bg-purple-600 hover:bg-purple-700 px-3"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2 pt-2 -mx-6 px-6">
            {chatDialog.type === 'total' ? (
              <>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-xs"
                  onClick={() => setChatInput('איך אפשר להוריד את העלות הכוללת ב-10%?')}
                >
                  🔻 להוריד 10%
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-xs"
                  onClick={() => setChatInput('מה העלויות הכי גבוהות שאפשר לצמצם?')}
                >
                  📊 עלויות גבוהות
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-xs"
                  onClick={() => setChatInput('איך להגדיל את התקציב לאירועים יותר משמעותיים?')}
                >
                  📈 להגדיל תקציב
                </Button>
              </>
            ) : (
              <>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-xs"
                  onClick={() => setChatInput('תני לי רעיונות אחרים לאירוע הזה')}
                >
                  💡 רעיונות
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-xs"
                  onClick={() => setChatInput('איך להוזיל את העלות של האירוע הזה?')}
                >
                  🔻 להוזיל
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-xs"
                  onClick={() => setChatInput('מה החלופות לאירוע הזה?')}
                >
                  🔄 חלופות
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}