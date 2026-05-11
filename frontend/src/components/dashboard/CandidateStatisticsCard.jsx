import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart3, Users, RefreshCw, Loader2, TrendingUp, PieChart, Grid3x3, BarChart } from 'lucide-react';
import { calculateCandidateStatistics } from '@/functions/calculateCandidateStatistics';
import { toast } from 'sonner';
import { BarChart as RechartsBarChart, Bar, PieChart as RechartsPieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function CandidateStatisticsCard() {
  const [calculating, setCalculating] = useState(false);
  const [viewMode, setViewMode] = useState('heatmap'); // 'heatmap', 'bars', 'pie'
  
  const { data: statistics, isLoading, refetch } = useQuery({
    queryKey: ['candidate-statistics'],
    queryFn: async () => {
      const stats = await base44.entities.CandidateStatistics.list();
      return stats.length > 0 ? stats[0] : null;
    },
    staleTime: 5 * 60 * 1000
  });

  const handleRecalculate = async () => {
    setCalculating(true);
    toast.loading('מחשב סטטיסטיקה...', { id: 'calc-stats' });
    try {
      await calculateCandidateStatistics({});
      await refetch();
      toast.success('הסטטיסטיקה עודכנה בהצלחה', { id: 'calc-stats' });
    } catch (error) {
      console.error('Error calculating statistics:', error);
      toast.error('שגיאה בחישוב הסטטיסטיקה', { id: 'calc-stats' });
    } finally {
      setCalculating(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500">טוען סטטיסטיקה...</p>
        </CardContent>
      </Card>
    );
  }

  if (!statistics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-600" />
            סטטיסטיקת מועמדים
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">אין עדיין נתוני סטטיסטיקה</p>
          <Button onClick={handleRecalculate} disabled={calculating} className="gap-2">
            {calculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            חשב סטטיסטיקה
          </Button>
        </CardContent>
      </Card>
    );
  }

  const byDiscipline = statistics.by_discipline || {};
  const byStatus = statistics.by_status || {};
  const bySeniority = statistics.by_seniority || {};
  
  // Discipline colors matching agents
  const disciplineColors = {
    'תוכנה': 'bg-blue-100 text-blue-800 border-blue-300',
    'אלקטרוניקה': 'bg-teal-100 text-teal-800 border-teal-300',
    'IT': 'bg-indigo-100 text-indigo-800 border-indigo-300',
    'הנדסת מערכת': 'bg-amber-100 text-amber-800 border-amber-300',
    'מכונות': 'bg-emerald-100 text-emerald-800 border-emerald-300',
    'QA': 'bg-violet-100 text-violet-800 border-violet-300',
    'כללי': 'bg-gray-100 text-gray-800 border-gray-300'
  };

  const disciplineChartColors = {
    'תוכנה': '#3B82F6',
    'אלקטרוניקה': '#14B8A6',
    'IT': '#6366F1',
    'הנדסת מערכת': '#F59E0B',
    'מכונות': '#10B981',
    'QA': '#8B5CF6',
    'כללי': '#6B7280'
  };

  // Prepare data for charts
  const disciplineChartData = Object.entries(byDiscipline)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value, color: disciplineChartColors[name] }));

  return (
    <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-600" />
            סטטיסטיקת מועמדים
          </CardTitle>
          <div className="flex gap-2">
            <div className="flex gap-1 border rounded-lg p-1">
              <Button 
                onClick={() => setViewMode('heatmap')} 
                variant={viewMode === 'heatmap' ? 'default' : 'ghost'}
                size="sm"
                className="gap-1 h-8"
              >
                <Grid3x3 className="w-3.5 h-3.5" />
              </Button>
              <Button 
                onClick={() => setViewMode('bars')} 
                variant={viewMode === 'bars' ? 'default' : 'ghost'}
                size="sm"
                className="gap-1 h-8"
              >
                <BarChart className="w-3.5 h-3.5" />
              </Button>
              <Button 
                onClick={() => setViewMode('pie')} 
                variant={viewMode === 'pie' ? 'default' : 'ghost'}
                size="sm"
                className="gap-1 h-8"
              >
                <PieChart className="w-3.5 h-3.5" />
              </Button>
            </div>
            <Button 
              onClick={handleRecalculate} 
              disabled={calculating}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              {calculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              עדכן
            </Button>
          </div>
        </div>
        {statistics.last_calculated && (
          <p className="text-xs text-gray-500">
            עודכן לאחרונה: {new Date(statistics.last_calculated).toLocaleDateString('he-IL', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Total */}
        <div className="flex items-center gap-3 p-4 bg-white rounded-lg border-2 border-purple-200">
          <Users className="w-10 h-10 text-purple-600" />
          <div>
            <p className="text-3xl font-bold text-gray-900">{statistics.total_candidates}</p>
            <p className="text-sm text-gray-600">סה"כ מועמדים במערכת</p>
          </div>
        </div>

        {/* By Discipline - Chart View */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-purple-600" />
            פילוח לפי דיסציפלינה
          </h3>
          
          {/* Heatmap View */}
          {viewMode === 'heatmap' && (
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(byDiscipline)
                .sort((a, b) => b[1] - a[1])
                .map(([discipline, count]) => (
                  <div
                    key={discipline}
                    className={`p-3 rounded-lg border ${disciplineColors[discipline] || 'bg-gray-100 text-gray-800'}`}
                  >
                    <p className="font-bold text-lg">{count}</p>
                    <p className="text-xs">{discipline}</p>
                    <p className="text-xs opacity-70">
                      {((count / statistics.total_candidates) * 100).toFixed(1)}%
                    </p>
                  </div>
                ))}
            </div>
          )}

          {/* Bar Chart View */}
          {viewMode === 'bars' && (
            <div className="bg-white rounded-lg p-4 border">
              <ResponsiveContainer width="100%" height={300}>
                <RechartsBarChart data={disciplineChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={100} />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white p-2 border rounded shadow-lg text-xs">
                            <p className="font-semibold">{data.name}</p>
                            <p className="text-gray-600">{data.value} מועמדים</p>
                            <p className="text-gray-500">{((data.value / statistics.total_candidates) * 100).toFixed(1)}%</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                    {disciplineChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </RechartsBarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Pie Chart View */}
          {viewMode === 'pie' && (
            <div className="bg-white rounded-lg p-4 border">
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPieChart>
                  <Pie
                    data={disciplineChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {disciplineChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white p-2 border rounded shadow-lg text-xs">
                            <p className="font-semibold">{data.name}</p>
                            <p className="text-gray-600">{data.value} מועמדים</p>
                            <p className="text-gray-500">{((data.value / statistics.total_candidates) * 100).toFixed(1)}%</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* By Seniority */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-2 text-sm">רמת ותק</h3>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(bySeniority)
              .filter(([_, count]) => count > 0)
              .map(([level, count]) => (
                <Badge key={level} variant="outline" className="text-xs">
                  {level}: {count}
                </Badge>
              ))}
          </div>
        </div>

        {/* By Status - Top 5 */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-2 text-sm">סטטוסים מרכזיים</h3>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(byStatus)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([status, count]) => (
                <Badge key={status} variant="outline" className="text-xs">
                  {status}: {count}
                </Badge>
              ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}