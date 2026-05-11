import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function HeatmapDisplay({ matches }) {

  const getScoreColor = (score) => {
    if (score >= 80) return 'border-green-500 bg-green-50';
    if (score >= 60) return 'border-yellow-500 bg-yellow-50';
    if (score > 0) return 'border-red-500 bg-red-50';
    return 'border-gray-300 bg-gray-50';
  };

  const getScoreTextColor = (score) => {
    if (score >= 80) return 'text-green-700';
    if (score >= 60) return 'text-yellow-700';
    if (score > 0) return 'text-red-700';
    return 'text-gray-600';
  }

  if (!matches || matches.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500">
        לא נמצאו התאמות משמעותיות.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {matches.sort((a, b) => b.match_score - a.match_score).map(match => (
        <Card key={match.job_id} className={`border-2 ${getScoreColor(match.match_score)}`}>
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <CardTitle className="text-base">{match.job_title}</CardTitle>
              <Badge className={`${getScoreColor(match.match_score)} ${getScoreTextColor(match.match_score)}`}>
                {match.match_score}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="text-xs space-y-2">
            <div>
              <h4 className="font-semibold text-gray-700">התאמה גיאוגרפית:</h4>
              <p className="text-gray-600">{match.location_match_summary}</p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-700">התאמת סיווג:</h4>
              <p className="text-gray-600">{match.clearance_match_summary}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}