import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Zap, Users, Calendar, TrendingUp, RefreshCw } from 'lucide-react';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, subWeeks, subMonths, parseISO, isWithinInterval } from 'date-fns';

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];

export default function CreditsUsageDashboard({ currentUser, isAdminView = false }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('week'); // 'week' | 'month'
  const [allUsers, setAllUsers] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load last 3 months of logs
      const threeMonthsAgo = subMonths(new Date(), 3);
      let allLogs;

      if (isAdminView && currentUser?.role === 'admin') {
        allLogs = await base44.entities.CreditLog.list('-created_date', 2000);
        // Load all users for names
        const users = await base44.entities.User.list();
        setAllUsers(users);
      } else {
        allLogs = await base44.entities.CreditLog.filter({ user_id: currentUser.id }, '-created_date', 2000);
      }

      // Filter to last 3 months
      const filtered = allLogs.filter(log => {
        const logDate = parseISO(log.created_date);
        return logDate >= threeMonthsAgo;
      });

      setLogs(filtered);
    } catch (error) {
      console.error('Error loading credit logs:', error);
    }
    setLoading(false);
  };

  // Build weekly chart data (last 8 weeks)
  const buildWeeklyData = () => {
    const weeks = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(new Date(), i), { weekStartsOn: 0 });
      const weekEnd = endOfWeek(subWeeks(new Date(), i), { weekStartsOn: 0 });
      weeks.push({ start: weekStart, end: weekEnd, label: format(weekStart, 'dd/MM') });
    }

    if (isAdminView && currentUser?.role === 'admin') {
      // Group by user per week
      const userColors = {};
      const userNames = {};
      logs.forEach(log => {
        if (!userColors[log.user_id]) {
          const idx = Object.keys(userColors).length;
          userColors[log.user_id] = COLORS[idx % COLORS.length];
          userNames[log.user_id] = log.user_name || log.user_email || log.user_id;
        }
      });

      return {
        data: weeks.map(week => {
          const entry = { week: week.label };
          const weekLogs = logs.filter(log =>
            isWithinInterval(parseISO(log.created_date), { start: week.start, end: week.end })
          );
          Object.keys(userColors).forEach(uid => {
            const userWeekLogs = weekLogs.filter(l => l.user_id === uid);
            entry[userNames[uid]] = userWeekLogs.reduce((s, l) => s + (l.credits_used || 1), 0);
          });
          return entry;
        }),
        keys: Object.values(userNames),
        colors: Object.values(userColors),
      };
    } else {
      return {
        data: weeks.map(week => {
          const weekLogs = logs.filter(log =>
            isWithinInterval(parseISO(log.created_date), { start: week.start, end: week.end })
          );
          return {
            week: week.label,
            קרדיטים: weekLogs.reduce((s, l) => s + (l.credits_used || 1), 0),
          };
        }),
        keys: ['קרדיטים'],
        colors: ['#6366f1'],
      };
    }
  };

  // Build monthly chart data (last 4 months)
  const buildMonthlyData = () => {
    const months = [];
    for (let i = 3; i >= 0; i--) {
      const mStart = startOfMonth(subMonths(new Date(), i));
      const mEnd = endOfMonth(subMonths(new Date(), i));
      months.push({ start: mStart, end: mEnd, label: format(mStart, 'MM/yy') });
    }

    if (isAdminView && currentUser?.role === 'admin') {
      const userColors = {};
      const userNames = {};
      logs.forEach(log => {
        if (!userColors[log.user_id]) {
          const idx = Object.keys(userColors).length;
          userColors[log.user_id] = COLORS[idx % COLORS.length];
          userNames[log.user_id] = log.user_name || log.user_email || log.user_id;
        }
      });

      return {
        data: months.map(month => {
          const entry = { month: month.label };
          const monthLogs = logs.filter(log =>
            isWithinInterval(parseISO(log.created_date), { start: month.start, end: month.end })
          );
          Object.keys(userColors).forEach(uid => {
            const userMonthLogs = monthLogs.filter(l => l.user_id === uid);
            entry[userNames[uid]] = userMonthLogs.reduce((s, l) => s + (l.credits_used || 1), 0);
          });
          return entry;
        }),
        keys: Object.values(userNames),
        colors: Object.values(userColors),
      };
    } else {
      return {
        data: months.map(month => {
          const monthLogs = logs.filter(log =>
            isWithinInterval(parseISO(log.created_date), { start: month.start, end: month.end })
          );
          return {
            month: month.label,
            קרדיטים: monthLogs.reduce((s, l) => s + (l.credits_used || 1), 0),
          };
        }),
        keys: ['קרדיטים'],
        colors: ['#6366f1'],
      };
    }
  };

  // Stats per user (admin view)
  const buildUserStats = () => {
    const stats = {};
    logs.forEach(log => {
      const uid = log.user_id;
      if (!stats[uid]) {
        stats[uid] = {
          user_id: uid,
          user_name: log.user_name || log.user_email || uid,
          user_email: log.user_email,
          total: 0,
          thisWeek: 0,
          thisMonth: 0,
          actionBreakdown: {},
        };
      }
      stats[uid].total += (log.credits_used || 1);

      const logDate = parseISO(log.created_date);
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 0 });
      const monthStart = startOfMonth(new Date());
      if (logDate >= weekStart) stats[uid].thisWeek += (log.credits_used || 1);
      if (logDate >= monthStart) stats[uid].thisMonth += (log.credits_used || 1);

      const action = log.action_type || 'unknown';
      stats[uid].actionBreakdown[action] = (stats[uid].actionBreakdown[action] || 0) + (log.credits_used || 1);
    });

    return Object.values(stats).sort((a, b) => b.total - a.total);
  };

  const chartData = viewMode === 'week' ? buildWeeklyData() : buildMonthlyData();
  const xKey = viewMode === 'week' ? 'week' : 'month';

  // My own stats (personal view)
  const myThisWeek = logs.filter(l => {
    const logDate = parseISO(l.created_date);
    return logDate >= startOfWeek(new Date(), { weekStartsOn: 0 });
  }).reduce((s, l) => s + (l.credits_used || 1), 0);

  const myThisMonth = logs.filter(l => {
    const logDate = parseISO(l.created_date);
    return logDate >= startOfMonth(new Date());
  }).reduce((s, l) => s + (l.credits_used || 1), 0);

  const myTotal = logs.reduce((s, l) => s + (l.credits_used || 1), 0);

  const userStats = isAdminView && currentUser?.role === 'admin' ? buildUserStats() : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Zap className="w-6 h-6 text-indigo-600" />
          <h2 className="text-xl font-bold text-gray-900">
            {isAdminView && currentUser?.role === 'admin' ? 'צריכת קרדיטים - כל המשתמשים' : 'צריכת הקרדיטים שלי'}
          </h2>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          רענן
        </Button>
      </div>

      {/* Summary cards */}
      {!isAdminView && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-gray-500 mb-1">השבוע</p>
              <p className="text-2xl font-bold text-indigo-600">{myThisWeek}</p>
              <p className="text-xs text-gray-400">קרדיטים</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-gray-500 mb-1">החודש</p>
              <p className="text-2xl font-bold text-purple-600">{myThisMonth}</p>
              <p className="text-xs text-gray-400">קרדיטים</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-gray-500 mb-1">סה"כ (3 חודשים)</p>
              <p className="text-2xl font-bold text-gray-700">{myTotal}</p>
              <p className="text-xs text-gray-400">קרדיטים</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              {viewMode === 'week' ? 'לפי שבוע (8 שבועות אחרונים)' : 'לפי חודש (4 חודשים אחרונים)'}
            </CardTitle>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={viewMode === 'week' ? 'default' : 'outline'}
                onClick={() => setViewMode('week')}
                className="text-xs h-7"
              >
                שבועי
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'month' ? 'default' : 'outline'}
                onClick={() => setViewMode('month')}
                className="text-xs h-7"
              >
                חודשי
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Zap className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">אין נתוני קרדיטים עדיין</p>
              <p className="text-xs mt-1">הנתונים יופיעו כאן לאחר שימוש בפונקציות AI</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData.data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(val) => [`${val} קרדיטים`, '']} />
                {chartData.keys.length > 1 && <Legend />}
                {chartData.keys.map((key, i) => (
                  <Bar key={key} dataKey={key} fill={chartData.colors[i]} radius={[3, 3, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Admin: per-user breakdown table */}
      {isAdminView && currentUser?.role === 'admin' && userStats.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" />
              סיכום לפי משתמש
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-gray-500 text-xs">
                    <th className="text-right py-2 pr-2 font-medium">משתמש</th>
                    <th className="text-center py-2 font-medium">השבוע</th>
                    <th className="text-center py-2 font-medium">החודש</th>
                    <th className="text-center py-2 font-medium">סה"כ (3 חודשים)</th>
                    <th className="text-right py-2 font-medium hidden lg:table-cell">פירוט פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {userStats.map((stat, i) => (
                    <tr key={stat.user_id} className={`border-b ${i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                      <td className="py-2.5 pr-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                            style={{ backgroundColor: COLORS[i % COLORS.length] }}>
                            {(stat.user_name || '?')[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{stat.user_name}</p>
                            <p className="text-xs text-gray-400">{stat.user_email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 text-center">
                        <span className={`font-bold ${stat.thisWeek > 0 ? 'text-indigo-600' : 'text-gray-300'}`}>
                          {stat.thisWeek}
                        </span>
                      </td>
                      <td className="py-2.5 text-center">
                        <span className={`font-bold ${stat.thisMonth > 0 ? 'text-purple-600' : 'text-gray-300'}`}>
                          {stat.thisMonth}
                        </span>
                      </td>
                      <td className="py-2.5 text-center">
                        <span className="font-bold text-gray-700">{stat.total}</span>
                      </td>
                      <td className="py-2.5 hidden lg:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(stat.actionBreakdown).slice(0, 4).map(([action, count]) => (
                            <Badge key={action} variant="outline" className="text-xs px-1.5 py-0">
                              {action}: {count}
                            </Badge>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}