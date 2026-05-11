import React, { useState, useEffect } from "react";
import { getGoldMatches } from "@/functions/getGoldMatches";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Star, TrendingUp, TrendingDown, Award, MapPin, Lock, User, Briefcase,
  Calendar, ChevronDown, ChevronUp, RefreshCw, Filter, Eye, EyeOff
} from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";

const STORAGE_KEY = "gold_matches_seen";

const AGENT_COLORS = {
  'נעמה (סוכן AI)': 'bg-orange-100 text-orange-700',
  'רמי (סוכן AI)': 'bg-red-100 text-red-700',
  'אליק (סוכן AI)': 'bg-teal-100 text-teal-700',
  'איתי (סוכן AI)': 'bg-indigo-100 text-indigo-700',
  'ליאור (סוכן AI)': 'bg-amber-100 text-amber-700',
  'אופיר (סוכן AI)': 'bg-emerald-100 text-emerald-700',
  'GC (סוכן AI)': 'bg-gray-100 text-gray-700',
  'דגנית (סוכן AI)': 'bg-violet-100 text-violet-700',
};

function getSeenIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function markAsSeen(id) {
  const seen = getSeenIds();
  seen.add(id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen]));
}

function ScoreBadge({ score }) {
  const color = score >= 95 ? 'bg-yellow-400 text-yellow-900' :
    score >= 90 ? 'bg-green-500 text-white' : 'bg-blue-500 text-white';
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-bold ${color}`}>
      <Star className="w-3.5 h-3.5" />
      {score}%
    </span>
  );
}

function StatCard({ title, value, sub, IconComp, color }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          <IconComp className="w-6 h-6" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500">{title}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function GoldMatchCard({ match, onMarkSeen }) {
  const [expanded, setExpanded] = useState(false);
  const agentColor = AGENT_COLORS[match.user_name] || 'bg-purple-100 text-purple-700';

  return (
    <Card className="border border-yellow-200 hover:border-yellow-400 hover:shadow-md transition-all duration-200 bg-gradient-to-br from-white to-yellow-50/30">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Header Row */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <ScoreBadge score={match.match_score} />
              <Badge className={`text-xs ${agentColor} border-0`}>
                {match.user_name || 'סוכן לא ידוע'}
              </Badge>
              {match.geo_status === 'APPROVED' && (
                <Badge className="bg-green-100 text-green-700 border-0 text-xs gap-1">
                  <MapPin className="w-3 h-3" />
                  {match.geo_distance_km ? `${match.geo_distance_km} ק"מ` : 'גיאו: אושר'}
                </Badge>
              )}
              <Badge className="bg-yellow-100 text-yellow-800 border-0 text-xs gap-1">
                <Lock className="w-3 h-3" />
                {match.candidate_clearance || '—'}
              </Badge>
              {match.match_number && (
                <span className="text-xs text-gray-400">#{match.match_number}</span>
              )}
            </div>

            {/* Candidate & Job */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <div className="flex items-start gap-2">
                <User className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{match.candidate_name}</p>
                  {match.candidate_city && <p className="text-xs text-gray-400">{match.candidate_city}</p>}
                  <p className="text-xs text-gray-400">סיווג: {match.candidate_clearance || '—'}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Briefcase className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{match.job_title || '—'}</p>
                  {match.job_client_name && <p className="text-xs text-gray-400">{match.job_client_name}</p>}
                  {match.job_location && <p className="text-xs text-gray-400">{match.job_location}</p>}
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                אותר: {match.created_date ? format(new Date(match.created_date), 'dd/MM/yyyy HH:mm', { locale: he }) : '—'}
              </span>
              {match.carmit_reviewed_date && (
                <span className="flex items-center gap-1">
                  <Award className="w-3 h-3 text-yellow-500" />
                  אישור כרמית: {format(new Date(match.carmit_reviewed_date), 'dd/MM/yyyy HH:mm', { locale: he })}
                </span>
              )}
            </div>

            {/* Expandable reasons */}
            {match.match_reasons && (
              <div className="mt-3">
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {expanded ? 'הסתר נימוק' : 'הצג נימוק'}
                </button>
                {expanded && (
                  <div className="mt-2 p-3 bg-white rounded-lg border border-yellow-100 text-xs text-gray-600 whitespace-pre-line leading-relaxed">
                    {match.match_reasons}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mark as seen button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onMarkSeen(match.id)}
            className="flex-shrink-0 text-gray-400 hover:text-gray-700 hover:bg-gray-100 gap-1.5 text-xs"
            title="סמן כנראה - לא יופיע שוב"
          >
            <Eye className="w-4 h-4" />
            <span className="hidden sm:inline">נראה</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function GoldMatchesReport() {
  const [matches, setMatches] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [minScore, setMinScore] = useState(85);
  const [agentFilter, setAgentFilter] = useState("all");
  const [clearanceFilter, setClearanceFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [showSeen, setShowSeen] = useState(false);
  const [seenIds, setSeenIds] = useState(getSeenIds());

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getGoldMatches({ min_score: minScore, limit: 300, date_from: dateFrom || null });
      const data = res.data || res;
      setMatches(data.gold_matches || []);
      setStats(data.stats || {});
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleMarkSeen = (id) => {
    markAsSeen(id);
    setSeenIds(getSeenIds());
  };

  const handleClearSeen = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSeenIds(new Set());
  };

  const allAgents = [...new Set(matches.map(m => m.user_name).filter(Boolean))];

  const filtered = matches.filter(m => {
    if (agentFilter !== "all" && m.user_name !== agentFilter) return false;
    if (clearanceFilter === "level1" && m.candidate_clearance !== 'רמה 1') return false;
    if (!showSeen && seenIds.has(m.id)) return false;
    return true;
  });

  const seenCount = matches.filter(m => seenIds.has(m.id)).length;

  const weekTrend = stats.this_week > stats.prev_week ? 'up' :
    stats.this_week < stats.prev_week ? 'down' : 'same';

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center shadow">
            <Award className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">דו"ח התאמות הזהב</h1>
            <p className="text-sm text-gray-500">התאמות איכותיות שאושרו ע"י כרמית עם סיווג בטחוני תואם</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {seenCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSeen(!showSeen)}
              className="gap-1.5 text-gray-500 text-xs"
            >
              {showSeen ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showSeen ? `הסתר ${seenCount} שנראו` : `הצג ${seenCount} שנראו`}
            </Button>
          )}
          {seenCount > 0 && showSeen && (
            <Button variant="ghost" size="sm" onClick={handleClearSeen} className="text-xs text-red-500 hover:text-red-700">
              אפס סימונים
            </Button>
          )}
          <Button onClick={fetchData} variant="outline" size="sm" disabled={loading} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            רענן
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard title="סה״כ התאמות זהב" value={matches.length} IconComp={Award} color="bg-yellow-100 text-yellow-600" />
        <StatCard
          title="השבוע"
          value={stats.this_week ?? 0}
          sub={weekTrend === 'up' ? `▲ ${stats.this_week - stats.prev_week} לעומת שבוע שעבר` :
            weekTrend === 'down' ? `▼ ${stats.prev_week - stats.this_week} לעומת שבוע שעבר` : 'זהה לשבוע שעבר'}
          IconComp={weekTrend === 'down' ? TrendingDown : TrendingUp}
          color={weekTrend === 'up' ? 'bg-green-100 text-green-600' : weekTrend === 'down' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}
        />
        <StatCard title="ציון ממוצע" value={stats.avg_score ? `${stats.avg_score}%` : '—'} IconComp={Star} color="bg-blue-100 text-blue-600" />
        <StatCard title="מוצגים כעת" value={filtered.length} IconComp={Filter} color="bg-purple-100 text-purple-600" />
      </div>

      {/* Agent breakdown */}
      {stats.by_agent && Object.keys(stats.by_agent).length > 0 && (
        <Card className="mb-6 border-0 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm text-gray-600">פירוט לפי סוכן</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.by_agent).map(([agent, count]) => (
                <span key={agent} className={`px-3 py-1 rounded-full text-xs font-medium ${AGENT_COLORS[agent] || 'bg-gray-100 text-gray-700'}`}>
                  {agent}: {count}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card className="mb-5 border-0 shadow-sm">
        <CardContent className="p-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">ציון מינימלי</label>
            <div className="flex items-center gap-2">
              <Input type="number" value={minScore} min={70} max={100}
                onChange={e => setMinScore(Number(e.target.value))}
                className="w-20 h-8 text-sm" />
              <span className="text-xs text-gray-400">%</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">סיווג בטחוני</label>
            <Select value={clearanceFilter} onValueChange={setClearanceFilter}>
              <SelectTrigger className="w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסיווגים</SelectItem>
                <SelectItem value="level1">רמה 1 בלבד</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">סוכן</label>
            <Select value={agentFilter} onValueChange={setAgentFilter}>
              <SelectTrigger className="w-44 h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסוכנים</SelectItem>
                {allAgents.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">מתאריך</label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36 h-8 text-sm" />
          </div>
          <Button onClick={fetchData} size="sm" className="h-8 gap-2">
            <Filter className="w-3.5 h-3.5" />
            החל פילטרים
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-yellow-500"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Award className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">
            {seenCount > 0 && !showSeen ? 'כל ההתאמות סומנו כנראו' : 'לא נמצאו התאמות זהב'}
          </p>
          <p className="text-sm mt-1">
            {seenCount > 0 && !showSeen
              ? <button onClick={() => setShowSeen(true)} className="text-blue-500 underline">לחץ להצגת ההתאמות שנראו</button>
              : 'נסה להוריד את ציון המינימום או לשנות את הפילטרים'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(match => (
            <GoldMatchCard
              key={match.id}
              match={match}
              onMarkSeen={handleMarkSeen}
            />
          ))}
        </div>
      )}
    </div>
  );
}