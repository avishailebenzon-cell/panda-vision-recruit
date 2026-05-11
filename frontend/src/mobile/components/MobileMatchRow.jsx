import React from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, Clock } from "lucide-react";

export default function MobileMatchRow({ match, onClick }) {
  const getScoreColor = (score) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-orange-500";
  };

  const getStatusIcon = () => {
    if (match.status?.includes('מוצלח')) return <CheckCircle className="w-3 h-3 text-green-600" />;
    if (match.status?.includes('נדחה')) return <AlertCircle className="w-3 h-3 text-red-600" />;
    return <Clock className="w-3 h-3 text-blue-600" />;
  };

  return (
    <div
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-lg p-3 active:bg-gray-50 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        {/* Left: Match Details */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="font-semibold text-sm text-gray-900 truncate">
            {match.candidate_name}
          </div>
          <div className="text-xs text-gray-600 truncate">
            {match.job_title}
          </div>
          <div className="flex items-center gap-1">
            {getStatusIcon()}
            <span className="text-xs text-gray-500">{match.status || 'ממתין'}</span>
          </div>
        </div>

        {/* Right: Match Score */}
        <div className="flex-shrink-0 flex flex-col items-center gap-1">
          <div className={`w-12 h-12 rounded-full ${getScoreColor(match.match_score)} flex items-center justify-center shadow-lg`}>
            <span className="text-white font-bold text-sm">{Math.round(match.match_score || 0)}%</span>
          </div>
          {!match.is_read && (
            <Badge className="bg-blue-500 text-white text-[10px] px-1.5 py-0">חדש</Badge>
          )}
        </div>
      </div>
    </div>
  );
}