import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Calendar,
  Gift,
  DollarSign,
  Sparkles,
  FileText,
  Loader2,
  CheckCircle,
  TrendingUp,
  Users,
  MessageSquare,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import ExpenseBreakdown from '../components/inbar/ExpenseBreakdown';

export default function InbarManagement() {
  const currentYear = new Date().getFullYear();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [activePlan, setActivePlan] = useState(null);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [sending, setSending] = useState(false);

  // Get plan for selected year
  const planForSelectedYear = plans.find(p => p.year === selectedYear);

  useEffect(() => {
    loadPlans();
    initConversation();
  }, []);

  const loadPlans = async () => {
    try {
      const allPlans = await base44.entities.HRPlan.list('-year');
      setPlans(allPlans);
      
      // Find plan for the selected year, or default to current year's plan
      const planForYear = allPlans.find(p => p.year === selectedYear);
      if (planForYear) {
        setActivePlan(planForYear);
        await ensureExpensesExist(planForYear.id);
      } else if (allPlans.length > 0) {
        // If no plan for selected year, try to find one for current year
        const currentYearPlan = allPlans.find(p => p.year === currentYear);
        if (currentYearPlan) {
          setSelectedYear(currentYear);
          setActivePlan(currentYearPlan);
          await ensureExpensesExist(currentYearPlan.id);
        } else {
          // Otherwise, use the first available plan
          setSelectedYear(allPlans[0].year);
          setActivePlan(allPlans[0]);
          await ensureExpensesExist(allPlans[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading plans:', error);
    }
    setLoading(false);
  };

  const ensureExpensesExist = async (planId) => {
    try {
      const { generateExpensesFromPlan } = await import('@/functions/generateExpensesFromPlan');
      await generateExpensesFromPlan({ plan_id: planId });
    } catch (error) {
      // Silently fail - expenses might already exist
      console.log('Expenses generation skipped or failed:', error.message);
    }
  };

  const initConversation = async () => {
    try {
      const conversations = await base44.agents.listConversations({ agent_name: 'inbar_hr_planner' });
      
      if (conversations && conversations.length > 0) {
        // Get full conversation with messages
        const fullConv = await base44.agents.getConversation(conversations[0].id);
        setConversationId(fullConv.id);
        setMessages(fullConv.messages || []);
      } else {
        const newConv = await base44.agents.createConversation({
          agent_name: 'inbar_hr_planner',
          metadata: { name: 'תוכנית משא"ן שנתית' }
        });
        setConversationId(newConv.id);
        setMessages(newConv.messages || []);
      }
    } catch (error) {
      console.error('Error initializing conversation:', error);
    }
  };

  useEffect(() => {
    if (!conversationId) return;

    const unsubscribe = base44.agents.subscribeToConversation(conversationId, (data) => {
      setMessages(data.messages || []);
    });

    return () => unsubscribe();
  }, [conversationId]);

  const sendMessage = async () => {
    if (!userInput.trim() || !conversationId) return;

    setSending(true);
    try {
      const conversation = await base44.agents.getConversation(conversationId);
      await base44.agents.addMessage(conversation, {
        role: 'user',
        content: userInput
      });
      setUserInput('');
      await loadPlans();
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('שגיאה בשליחת הודעה');
    }
    setSending(false);
  };

  const createNewPlan = async (year) => {
    setSending(true);
    const prompt = `צרי תוכנית משא"ן שנתית מלאה לשנת ${year}. כללי:\n1. מפי את כל החגים העבריים בשנה\n2. הציעי 2-3 רעיונות למתנות לכל חג רלוונטי\n3. חפשי מחירים באינטרנט\n4. כללי הוצאות קבועות: מתנות הולדת (200 ₪/עובד), מתנת פסח (1,000 ₪/עובד), ימי קליטה, פורום מובילים\n5. צרי רשומת HRPlan במערכת עם כל הפרטים`;
    
    setUserInput(prompt);
    setTimeout(() => sendMessage(), 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-12 h-12 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-8" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <img 
            src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop&crop=face" 
            alt="ענבר" 
            className="w-16 h-16 rounded-full object-cover border-4 border-purple-200 shadow-lg"
          />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">ענבר - תוכנית משא"ן שנתית</h1>
            <p className="text-gray-600">מנהלת תוכנית משאבי אנוש, מתכננת חגים ותשורות לעובדים</p>
          </div>
        </div>

        {/* Year Selector */}
        <div className="flex items-center gap-2 bg-white border rounded-lg p-2 shadow-sm">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              const newYear = selectedYear - 1;
              setSelectedYear(newYear);
              const plan = plans.find(p => p.year === newYear);
              if (plan) {
                setActivePlan(plan);
                ensureExpensesExist(plan.id);
              } else {
                setActivePlan(null);
              }
            }}
            className="h-8 w-8"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          
          <div className="flex gap-1">
            {[currentYear - 1, currentYear, currentYear + 1].map((year) => (
              <Button
                key={year}
                variant={selectedYear === year ? "default" : "ghost"}
                size="sm"
                onClick={() => {
                  setSelectedYear(year);
                  const plan = plans.find(p => p.year === year);
                  if (plan) {
                    setActivePlan(plan);
                    ensureExpensesExist(plan.id);
                  } else {
                    setActivePlan(null);
                  }
                }}
                className={`min-w-[70px] ${
                  selectedYear === year 
                    ? 'bg-purple-600 hover:bg-purple-700' 
                    : ''
                }`}
              >
                {year}
              </Button>
            ))}
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              const newYear = selectedYear + 1;
              setSelectedYear(newYear);
              const plan = plans.find(p => p.year === newYear);
              if (plan) {
                setActivePlan(plan);
                ensureExpensesExist(plan.id);
              } else {
                setActivePlan(null);
              }
            }}
            className="h-8 w-8"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* No Plan Alert */}
      {!planForSelectedYear && !loading && (
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="py-6">
            <div className="flex items-center gap-4">
              <AlertCircle className="w-10 h-10 text-yellow-600" />
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-800">אין תוכנית פעילה לשנת {selectedYear}</h3>
                <p className="text-sm text-yellow-700 mt-1">
                  לא נמצאה תוכנית משא"ן לשנה זו. ניתן ליצור תוכנית חדשה דרך הטאב "שיחה עם ענבר".
                </p>
              </div>
              <Button 
                onClick={() => createNewPlan(selectedYear)}
                className="bg-yellow-600 hover:bg-yellow-700"
              >
                <Sparkles className="w-4 h-4 ml-2" />
                צור תוכנית
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="plans" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="plans">
            <FileText className="w-4 h-4 ml-2" />
            תוכניות קיימות
          </TabsTrigger>
          <TabsTrigger value="expenses">
            <DollarSign className="w-4 h-4 ml-2" />
            פירוט עלויות
          </TabsTrigger>
          <TabsTrigger value="chat">
            <MessageSquare className="w-4 h-4 ml-2" />
            שיחה עם ענבר
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                צ'אט עם ענבר - בניית תוכנית משא"ן
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Quick Actions */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => createNewPlan(new Date().getFullYear() + 1)}
                    className="flex items-center gap-2"
                  >
                    <Calendar className="w-4 h-4" />
                    צרי תוכנית ל-{new Date().getFullYear() + 1}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setUserInput('הצג לי סיכום של התוכנית האחרונה')}
                  >
                    <FileText className="w-4 h-4 ml-2" />
                    סכם תוכנית
                  </Button>
                  <Button
                    variant="outline"
                    onClick={loadPlans}
                  >
                    <RefreshCw className="w-4 h-4 ml-2" />
                    רענן
                  </Button>
                </div>

                {/* Messages */}
                <div className="border rounded-lg p-4 bg-gray-50 max-h-96 overflow-y-auto space-y-3">
                  {messages.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>התחילי שיחה עם ענבר לבניית תוכנית משא"ן</p>
                    </div>
                  ) : (
                    messages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg ${
                          msg.role === 'user'
                            ? 'bg-blue-100 mr-auto max-w-[80%]'
                            : 'bg-white ml-auto max-w-[80%] border'
                        }`}
                      >
                        <div className="text-sm font-medium mb-1">
                          {msg.role === 'user' ? 'את' : 'ענבר'}
                        </div>
                        <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                      </div>
                    ))
                  )}
                </div>

                {/* Input */}
                <div className="flex gap-2">
                  <Input
                    placeholder="לדוגמה: צרי תוכנית ל-2026 עם תקציב מקסימלי של 150,000 ₪"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    disabled={sending}
                  />
                  <Button onClick={sendMessage} disabled={sending || !userInput.trim()}>
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'שלח'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses" className="space-y-4">
          {planForSelectedYear ? (
            <ExpenseBreakdown plan={planForSelectedYear} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <AlertCircle className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
                <p className="text-gray-600 font-medium mb-2">אין תוכנית לשנת {selectedYear}</p>
                <p className="text-gray-500 text-sm mb-4">צרי תוכנית חדשה דרך הטאב "שיחה עם ענבר"</p>
                <Button onClick={() => createNewPlan(selectedYear)} variant="outline">
                  <Sparkles className="w-4 h-4 ml-2" />
                  צור תוכנית ל-{selectedYear}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="plans" className="space-y-4">
          {!planForSelectedYear ? (
            <Card>
              <CardContent className="py-12 text-center">
                <AlertCircle className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
                <p className="text-gray-600 font-medium mb-2">אין תוכנית לשנת {selectedYear}</p>
                <p className="text-gray-500 text-sm mb-4">לא נמצאה תוכנית משא"ן פעילה לשנה שנבחרה</p>
                <Button onClick={() => createNewPlan(selectedYear)}>
                  <Sparkles className="w-4 h-4 ml-2" />
                  צור תוכנית ל-{selectedYear}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {plans.filter(p => p.year === selectedYear).map((plan) => (
                <Card 
                  key={plan.id} 
                  className={`overflow-hidden cursor-pointer transition-all ${
                    activePlan?.id === plan.id ? 'ring-2 ring-purple-400' : ''
                  }`}
                  onClick={() => setActivePlan(plan)}
                >
                  <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Calendar className="w-5 h-5" />
                          תוכנית משא"ן {plan.year}
                        </CardTitle>
                        <div className="flex gap-2 mt-2">
                          <Badge
                            className={
                              plan.status === 'approved'
                                ? 'bg-green-100 text-green-800'
                                : plan.status === 'pending_approval'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                            }
                          >
                            {plan.status === 'approved' && <CheckCircle className="w-3 h-3 ml-1" />}
                            {plan.status === 'draft' ? 'טיוטה' : plan.status === 'pending_approval' ? 'ממתין לאישור' : 'מאושר'}
                          </Badge>
                          {plan.created_by_agent && (
                            <Badge className="bg-purple-100 text-purple-800">
                              <Sparkles className="w-3 h-3 ml-1" />
                              נוצר על ידי ענבר
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-left">
                        <div className="text-sm text-gray-600">תקציב כולל</div>
                        <div className="text-2xl font-bold text-purple-600">
                          ₪{(plan.total_budget || 0).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <Users className="w-5 h-5 mx-auto mb-1 text-blue-600" />
                        <div className="text-sm text-gray-600">עובדים</div>
                        <div className="font-bold">{plan.employee_count || 45}</div>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <Gift className="w-5 h-5 mx-auto mb-1 text-green-600" />
                        <div className="text-sm text-gray-600">אירועים</div>
                        <div className="font-bold">{plan.holiday_events?.length || 0}</div>
                      </div>
                      <div className="text-center p-3 bg-orange-50 rounded-lg">
                        <DollarSign className="w-5 h-5 mx-auto mb-1 text-orange-600" />
                        <div className="text-sm text-gray-600">תקציב מקס'</div>
                        <div className="font-bold">
                          {plan.max_budget_limit ? `₪${plan.max_budget_limit.toLocaleString()}` : 'ללא הגבלה'}
                        </div>
                      </div>
                      <div className="text-center p-3 bg-purple-50 rounded-lg">
                        <TrendingUp className="w-5 h-5 mx-auto mb-1 text-purple-600" />
                        <div className="text-sm text-gray-600">בפועל</div>
                        <div className="font-bold">₪{(plan.actual_cost || 0).toLocaleString()}</div>
                      </div>
                    </div>

                    {/* Holiday Events */}
                    {plan.holiday_events && plan.holiday_events.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <Gift className="w-4 h-4 text-purple-600" />
                          חגים ואירועים ({plan.holiday_events.length})
                        </h4>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {plan.holiday_events.map((event, idx) => (
                            <div key={idx} className="p-3 bg-white border rounded-lg">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <div className="font-medium">{event.holiday_name}</div>
                                  <div className="text-xs text-gray-500">{event.date}</div>
                                </div>
                                <Badge variant="outline">
                                  ₪{(event.estimated_total_cost || 0).toLocaleString()}
                                </Badge>
                              </div>
                              {event.gift_options && event.gift_options.length > 0 && (
                                <div className="text-sm text-gray-600 mt-2">
                                  <strong>רעיונות:</strong> {event.gift_options.slice(0, 2).join(', ')}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Fixed Expenses */}
                    {plan.fixed_expenses && (
                      <div>
                        <h4 className="font-semibold mb-3">הוצאות קבועות</h4>
                        <div className="grid gap-2 text-sm">
                          {plan.fixed_expenses.birthday_gifts && (
                            <div className="flex justify-between p-2 bg-gray-50 rounded">
                              <span>מתנות יום הולדת</span>
                              <span className="font-medium">₪{plan.fixed_expenses.birthday_gifts.total?.toLocaleString()}</span>
                            </div>
                          )}
                          {plan.fixed_expenses.passover_bonus && (
                            <div className="flex justify-between p-2 bg-gray-50 rounded">
                              <span>מתנת פסח</span>
                              <span className="font-medium">₪{plan.fixed_expenses.passover_bonus.total?.toLocaleString()}</span>
                            </div>
                          )}
                          {plan.fixed_expenses.orientation_days && (
                            <div className="flex justify-between p-2 bg-gray-50 rounded">
                              <span>ימי קליטה (חודשי)</span>
                              <span className="font-medium">₪{(plan.fixed_expenses.orientation_days.estimated_monthly * 12)?.toLocaleString()}</span>
                            </div>
                          )}
                          {plan.fixed_expenses.toast_events && (
                            <div className="flex justify-between p-2 bg-gray-50 rounded">
                              <span>הרמת כוסית (x2)</span>
                              <span className="font-medium">₪{plan.fixed_expenses.toast_events.total?.toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {plan.notes && (
                      <div className="text-sm text-gray-600 p-3 bg-blue-50 rounded-lg border-r-4 border-blue-400">
                        <strong>הערות:</strong> {plan.notes}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}