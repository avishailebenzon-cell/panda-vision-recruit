import React, { useState, useRef, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Search, SlidersHorizontal, X, User, Briefcase, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const ENTITY_TYPES = [
  { key: 'candidate', label: 'מועמד', icon: User, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-300' },
  { key: 'job', label: 'משרה', icon: Briefcase, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-300' },
  { key: 'task', label: 'משימה', icon: ClipboardList, color: 'text-green-600', bg: 'bg-green-50 border-green-300' },
];

export default function GlobalSearchBar({ onOpenCandidate }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [activeFilter, setActiveFilter] = useState(null); // null = all, 'candidate'|'job'|'task'
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const debounceRef = useRef(null);

  const searchAll = useCallback(async (q, filter) => {
    if (!q || q.trim().length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }
    setLoading(true);
    const lower = q.toLowerCase();
    try {
      const fetches = [];

      if (!filter || filter === 'candidate') {
        fetches.push(
          base44.entities.Candidate.filter({ search_index_name: { $regex: lower } }, '-created_date', 10)
            .then(res => res.map(c => ({ type: 'candidate', id: c.id, label: c.full_name || `${c.first_name} ${c.last_name}`, sub: c.main_discipline || c.city || '', raw: c })))
            .catch(() => [])
        );
      }

      if (!filter || filter === 'job') {
        fetches.push(
          base44.entities.Job.filter({ status: 'פעילה' }, '-created_date', 200)
            .then(res => res
              .filter(j => j.title?.toLowerCase().includes(lower) || j.job_code?.toLowerCase().includes(lower))
              .slice(0, 10)
              .map(j => ({ type: 'job', id: j.id, label: j.title, sub: j.client_name || j.location || '', raw: j }))
            )
            .catch(() => [])
        );
      }

      if (!filter || filter === 'task') {
        fetches.push(
          base44.entities.RotemTask.filter({}, '-created_date', 200)
            .then(res => res
              .filter(t =>
                t.candidate_name?.toLowerCase().includes(lower) ||
                t.job_title?.toLowerCase().includes(lower)
              )
              .slice(0, 10)
              .map(t => ({ type: 'task', id: t.id, label: t.candidate_name || '', sub: t.job_title || '', raw: t }))
            )
            .catch(() => [])
        );
      }

      const allResults = (await Promise.all(fetches)).flat();
      setResults(allResults);
      setShowResults(true);
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      searchAll(query, activeFilter);
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [query, activeFilter, searchAll]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowResults(false);
        setShowFilterPanel(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelectItem = (item) => {
    setShowResults(false);
    setQuery('');
    if (item.type === 'candidate') {
      if (onOpenCandidate) {
        onOpenCandidate(item.raw);
      } else {
        navigate(`${createPageUrl('Candidates')}?candidate_id=${item.id}`);
      }
    } else if (item.type === 'job') {
      navigate(`${createPageUrl('Jobs')}?job_id=${item.id}`);
    } else if (item.type === 'task') {
      navigate(`${createPageUrl('RotemPage')}?task_id=${item.id}`);
    }
  };

  const handleSelectFilter = (key) => {
    setActiveFilter(key === activeFilter ? null : key);
    setShowFilterPanel(false);
    if (query.trim().length >= 2) {
      searchAll(query, key === activeFilter ? null : key);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
    inputRef.current?.focus();
  };

  const typeConfig = {
    candidate: { label: 'מועמד', color: 'text-orange-600', badgeBg: 'bg-orange-100 text-orange-700', icon: User },
    job: { label: 'משרה', color: 'text-blue-600', badgeBg: 'bg-blue-100 text-blue-700', icon: Briefcase },
    task: { label: 'משימה', color: 'text-green-600', badgeBg: 'bg-green-100 text-green-700', icon: ClipboardList },
  };

  const activeFilterConfig = activeFilter ? ENTITY_TYPES.find(t => t.key === activeFilter) : null;

  return (
    <div ref={containerRef} className="relative flex items-center gap-1" style={{ width: '280px' }}>
      {/* Search icon (right) */}
      <div className="relative flex items-center flex-1">
        <Search className="absolute right-2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          placeholder={activeFilterConfig ? `חפש ${activeFilterConfig.label}...` : 'חפש מועמד, משרה, משימה...'}
          className="w-full h-8 pr-8 pl-7 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:bg-white transition-all"
          dir="rtl"
        />
        {query && (
          <button onClick={clearSearch} className="absolute left-1 p-0.5 hover:bg-gray-200 rounded">
            <X className="w-3 h-3 text-gray-400" />
          </button>
        )}
        {loading && (
          <div className="absolute left-1 w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {/* Filter button (left) */}
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          className={`h-8 w-8 relative ${activeFilter ? 'text-blue-600' : 'text-gray-500'}`}
          onClick={() => { setShowFilterPanel(p => !p); setShowResults(false); }}
          title="סנן לפי סוג"
        >
          <SlidersHorizontal className="w-4 h-4" />
          {activeFilter && (
            <span className="absolute top-0 right-0 w-2 h-2 bg-blue-500 rounded-full" />
          )}
        </Button>

        {/* Filter Panel */}
        {showFilterPanel && (
          <div className="absolute left-0 top-10 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-3 w-40" dir="rtl">
            <p className="text-xs font-semibold text-gray-500 mb-2 px-1">סנן לפי</p>
            {ENTITY_TYPES.map(type => {
              const Icon = type.icon;
              const isActive = activeFilter === type.key;
              return (
                <button
                  key={type.key}
                  onClick={() => handleSelectFilter(type.key)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-all mb-1 ${
                    isActive ? `${type.bg} border font-semibold ${type.color}` : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? type.color : 'text-gray-400'}`} />
                  {type.label}
                  {isActive && <X className="w-3 h-3 mr-auto opacity-50" />}
                </button>
              );
            })}
            {activeFilter && (
              <button
                onClick={() => { setActiveFilter(null); setShowFilterPanel(false); }}
                className="w-full text-xs text-center text-gray-400 hover:text-gray-600 mt-1 py-1"
              >
                נקה סינון
              </button>
            )}
          </div>
        )}
      </div>

      {/* Results Dropdown */}
      {showResults && results.length > 0 && (
        <div
          className="absolute top-10 right-0 z-50 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden"
          style={{ width: '320px', maxHeight: '360px', overflowY: 'auto' }}
          dir="rtl"
        >
          {results.map((item, idx) => {
            const cfg = typeConfig[item.type];
            const Icon = cfg.icon;
            return (
              <button
                key={`${item.type}-${item.id}`}
                onClick={() => handleSelectItem(item)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-right border-b border-gray-50 last:border-0 transition-colors"
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.badgeBg}`}>
                  <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{item.label}</p>
                  {item.sub && <p className="text-xs text-gray-400 truncate">{item.sub}</p>}
                </div>
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${cfg.badgeBg}`}>
                  {cfg.label}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {showResults && results.length === 0 && !loading && query.trim().length >= 2 && (
        <div
          className="absolute top-10 right-0 z-50 bg-white border border-gray-200 rounded-xl shadow-xl px-4 py-6 text-center"
          style={{ width: '280px' }}
          dir="rtl"
        >
          <Search className="w-8 h-8 text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400">לא נמצאו תוצאות</p>
        </div>
      )}
    </div>
  );
}