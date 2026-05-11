import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, ChevronRight } from 'lucide-react';
import { Spinner, EmptyState } from './PandaCard';

export function PandaTable({
  columns = [],
  data = [],
  loading = false,
  groupBy = null,
  rowActions,
  emptyTitle = 'אין נתונים',
  emptyDesc = '',
}) {
  const [sort,      setSort]      = useState({ key: null, dir: 'asc' });
  const [search,    setSearch]    = useState('');
  const [collapsed, setCollapsed] = useState({});

  const toggleSort = (key) => {
    setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
  };

  const filtered = useMemo(() => {
    let rows = data;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        columns.some(c => String(c.accessor ? r[c.accessor] : '').toLowerCase().includes(q))
      );
    }
    if (sort.key) {
      rows = [...rows].sort((a, b) => {
        const av = a[sort.key] ?? '';
        const bv = b[sort.key] ?? '';
        const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
        return sort.dir === 'asc' ? cmp : -cmp;
      });
    }
    return rows;
  }, [data, search, sort, columns]);

  const grouped = useMemo(() => {
    if (!groupBy) return null;
    return filtered.reduce((acc, row) => {
      const key = row[groupBy] ?? 'ללא קבוצה';
      (acc[key] = acc[key] || []).push(row);
      return acc;
    }, {});
  }, [filtered, groupBy]);

  const SortIcon = ({ col }) => {
    if (sort.key !== col)  return <ChevronsUpDown size={12} className="opacity-30" />;
    if (sort.dir === 'asc') return <ChevronUp     size={12} className="text-brand-400" />;
    return                          <ChevronDown   size={12} className="text-brand-400" />;
  };

  const renderRow = (row, idx) => (
    <tr key={row.id ?? idx} className="table-row">
      {columns.map(col => (
        <td key={col.key} className="table-td">
          {col.render ? col.render(row) : (row[col.accessor] ?? '—')}
        </td>
      ))}
      {rowActions && (
        <td className="table-td w-10">
          {rowActions(row)}
        </td>
      )}
    </tr>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
        <input
          className="panda-input pl-8 text-xs"
          placeholder="חיפוש בטבלה..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-surface-700">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  className={`table-th ${col.sortable !== false ? 'cursor-pointer hover:text-white' : 'cursor-default'}`}
                  onClick={() => col.sortable !== false && toggleSort(col.accessor || col.key)}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {col.sortable !== false && <SortIcon col={col.accessor || col.key} />}
                  </span>
                </th>
              ))}
              {rowActions && <th className="table-th w-10"></th>}
            </tr>
          </thead>
          <tbody>
            {!grouped && filtered.length === 0 && (
              <tr>
                <td colSpan={columns.length + (rowActions ? 1 : 0)}>
                  <EmptyState title={emptyTitle} description={emptyDesc} />
                </td>
              </tr>
            )}
            {!grouped && filtered.map(renderRow)}
            {grouped && Object.entries(grouped).map(([group, rows]) => (
              <>
                <tr
                  key={`g-${group}`}
                  className="cursor-pointer bg-surface-900/60 hover:bg-surface-900 transition-colors"
                  onClick={() => setCollapsed(c => ({ ...c, [group]: !c[group] }))}
                >
                  <td
                    colSpan={columns.length + (rowActions ? 1 : 0)}
                    className="px-4 py-2.5 text-xs font-semibold text-surface-300 border-b border-surface-700"
                  >
                    <span className="flex items-center gap-2">
                      <ChevronRight
                        size={13}
                        className={`transition-transform ${collapsed[group] ? '' : 'rotate-90'}`}
                      />
                      {group}
                      <span className="text-surface-500 font-normal">({rows.length})</span>
                    </span>
                  </td>
                </tr>
                {!collapsed[group] && rows.map(renderRow)}
              </>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-surface-500 text-right">
        {filtered.length} מתוך {data.length} רשומות
      </p>
    </div>
  );
}
