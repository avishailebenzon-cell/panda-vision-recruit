import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  Clock, 
  CheckCircle, 
  ArrowRight,
  TrendingUp,
  Users,
  Calendar
} from 'lucide-react';

export default function CandidateJourneyTimeline({ matches = [] }) {
  // Group matches by status for better visualization
  const statusGroups = matches.reduce((acc, match) => {
    const status = match.status || 'ללא מצב';
    if (!acc[status]) {
      acc[status] = [];
    }
    acc[status].push(match);
    return acc;
  }, {});

  const getStatusColor = (status) => {
    const statusLower = (status || '').toLowerCase();
    if (statusLower.includes('חדש') || statusLower.includes('ממתין')) {
      return 'bg-blue-100 text-blue-700 border-blue-200';
    }
    if (statusLower.includes('בטיפול') || statusLower.includes('ביצירת')) {
      return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    }
    if (statusLower.includes('מועסק') || statusLower.includes('חתום') || statusLower.includes('אושר')) {
      return 'bg-green-100 text-green-700 border-green-200';
    }
    if (statusLower.includes('נדחה') || statusLower.includes('נסגר')) {
      return 'bg-red-100 text-red-700 border-red-200';
    }
    return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const getStatusIcon = (status) => {
    const statusLower = (status || '').toLowerCase();
    if (statusLower.includes('מועסק') || statusLower.includes('חתום')) {
      return <CheckCircle className="w-4 h-4" />;
    }
    if (statusLower.includes('בטיפול') || statusLower.includes('ביצירת')) {
      return <Clock className="w-4 h-4" />;
    }
    return <User className="w-4 h-4" />;
  };

  if (matches.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            מסע מועמדים
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg mb-2">אין התאמות עדיין</p>
            <p className="text-gray-400 text-sm">ברגע שתיצור התאמות, תוכל לראות כאן את המסע שלהן</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="w-5 h-5 text-indigo-600" />
          מסע מועמדים
          <Badge variant="outline" className="mr-auto">
            {matches.length} התאמות
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {Object.entries(statusGroups).map(([status, statusMatches], index) => (
            <div key={status} className="relative">
              {index > 0 && (
                <div className="absolute -top-2 right-6 w-px h-4 bg-gray-200"></div>
              )}
              
              <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className={`p-2 rounded-lg border ${getStatusColor(status)} flex-shrink-0`}>
                  {getStatusIcon(status)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-900 truncate">{status}</h4>
                    <Badge variant="secondary" className="text-xs">
                      {statusMatches.length}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    {statusMatches.slice(0, 3).map((match, idx) => (
                      <div key={match.id} className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className="w-6 h-6 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-medium text-blue-700">
                              {match.candidate_name?.charAt(0) || 'M'}
                            </span>
                          </div>
                          <span className="text-sm text-gray-600 truncate">
                            {match.candidate_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                          <Calendar className="w-3 h-3" />
                          {new Date(match.created_date).toLocaleDateString('he-IL')}
                        </div>
                      </div>
                    ))}
                    
                    {statusMatches.length > 3 && (
                      <div className="text-xs text-gray-500 pt-1">
                        ועוד {statusMatches.length - 3} מועמדים...
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {index < Object.entries(statusGroups).length - 1 && (
                <div className="flex justify-center py-2">
                  <ArrowRight className="w-4 h-4 text-gray-300 rotate-90" />
                </div>
              )}
            </div>
          ))}
        </div>
        
        {Object.keys(statusGroups).length > 1 && (
          <div className="mt-6 pt-4 border-t">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {statusGroups['חדש – ממתין ליצירת קשר']?.length || 0}
                </div>
                <div className="text-xs text-gray-500">חדשים</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">
                  {Object.entries(statusGroups).filter(([status]) => 
                    status.includes('בטיפול') || status.includes('ממתין')
                  ).reduce((sum, [, matches]) => sum + matches.length, 0)}
                </div>
                <div className="text-xs text-gray-500">בטיפול</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {statusGroups['מועסק – פעיל']?.length || 0}
                </div>
                <div className="text-xs text-gray-500">מועסקים</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}