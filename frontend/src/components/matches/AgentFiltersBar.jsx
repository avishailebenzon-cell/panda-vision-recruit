import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem
} from '@/components/ui/dropdown-menu';
import {
  Filter,
  Settings,
  RefreshCw,
  Database,
  BadgeCheck,
  Target,
  Calendar,
  Loader2,
  ChevronDown,
  ClipboardList
} from 'lucide-react';

export default function AgentFiltersBar({
  // Agent info
  agentColor = 'blue',
  agentName = '',
  isRunning = false,
  onRun,
  
  // Filter states
  matchScoreFilter = '80+',
  onMatchScoreChange,
  priorityFilter = 'all',
  onPriorityChange,
  handledFilter = 'all',
  onHandledChange,
  showFullMatchOnly = false,
  onToggleFullMatch,
  showBestFitOnly = false,
  onToggleBestFit,
  showRecentCvsOnly = false,
  onToggleRecentCvs,
  showAllMatches = false,
  onToggleShowAll,
  
  // Counts
  filteredCount = 0,
  totalCount = 0,
  
  // Actions
  onRefresh,
  onRevalidate,
  isRevalidating = false,
  
  // Optional features
  showRecentCvsFilter = false,
  showFocusButton = false,
  onFocus,
  isFocused = false,
  onCancelFocus,
  showWithTasksOnly = false,
  onToggleWithTasks
}) {
  const scoreOptions = [
    { value: 'all', label: 'הכל' },
    { value: '50+', label: '50%+' },
    { value: '70+', label: '70%+' },
    { value: '80+', label: '80%+' },
    { value: '90+', label: '90%+' }
  ];

  const priorityOptions = [
    { value: 'all', label: 'כל העדיפויות' },
    { value: 'high', label: 'עדיפות 1' }
  ];

  const handledOptions = [
    { value: 'all', label: 'הכל' },
    { value: 'unhandled', label: 'לא טופלו' },
    { value: 'handled', label: 'טופלו' }
  ];

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {/* Filters Dropdown - Score, Priority, Handled */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm"
            className={`gap-2 border-${agentColor}-300 text-${agentColor}-700 hover:bg-${agentColor}-50`}
          >
            <Filter className="w-4 h-4" />
            <span>מסננים</span>
            <ChevronDown className="w-3 h-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>ציון התאמה</DropdownMenuLabel>
          {scoreOptions.map(opt => (
            <DropdownMenuItem
              key={opt.value}
              onClick={() => onMatchScoreChange(opt.value)}
              className={matchScoreFilter === opt.value ? `bg-${agentColor}-50 font-semibold` : ''}
            >
              {matchScoreFilter === opt.value && '✓ '}
              {opt.label}
            </DropdownMenuItem>
          ))}
          
          <DropdownMenuSeparator />
          <DropdownMenuLabel>עדיפות משרה</DropdownMenuLabel>
          {priorityOptions.map(opt => (
            <DropdownMenuItem
              key={opt.value}
              onClick={() => onPriorityChange(opt.value)}
              className={priorityFilter === opt.value ? `bg-${agentColor}-50 font-semibold` : ''}
            >
              {priorityFilter === opt.value && '✓ '}
              {opt.label}
            </DropdownMenuItem>
          ))}
          
          <DropdownMenuSeparator />
          <DropdownMenuLabel>סטטוס טיפול</DropdownMenuLabel>
          {handledOptions.map(opt => (
            <DropdownMenuItem
              key={opt.value}
              onClick={() => onHandledChange(opt.value)}
              className={handledFilter === opt.value ? `bg-${agentColor}-50 font-semibold` : ''}
            >
              {handledFilter === opt.value && '✓ '}
              {opt.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Options Dropdown - Checkboxes & Show All */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm"
            className={`gap-2 border-${agentColor}-200 text-${agentColor}-600 hover:bg-${agentColor}-50`}
          >
            <Settings className="w-4 h-4" />
            <span>אפשרויות</span>
            <ChevronDown className="w-3 h-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuCheckboxItem
            checked={showFullMatchOnly}
            onCheckedChange={onToggleFullMatch}
          >
            <BadgeCheck className="w-4 h-4 ml-2 text-green-600" />
            התאמה מלאה בלבד
          </DropdownMenuCheckboxItem>
          
          <DropdownMenuCheckboxItem
            checked={showBestFitOnly}
            onCheckedChange={onToggleBestFit}
          >
            <Target className="w-4 h-4 ml-2 text-blue-600" />
            Best Fit בלבד
          </DropdownMenuCheckboxItem>
          
          {showRecentCvsFilter && (
            <DropdownMenuCheckboxItem
              checked={showRecentCvsOnly}
              onCheckedChange={onToggleRecentCvs}
            >
              <Calendar className="w-4 h-4 ml-2 text-teal-600" />
              קו"ח 10 ימים אחרונים
            </DropdownMenuCheckboxItem>
          )}
          
          {onToggleWithTasks && (
            <DropdownMenuCheckboxItem
              checked={showWithTasksOnly}
              onCheckedChange={onToggleWithTasks}
            >
              <ClipboardList className="w-4 h-4 ml-2 text-orange-600" />
              יש משימות בלבד
            </DropdownMenuCheckboxItem>
          )}
          
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onToggleShowAll?.()}>
            <Database className="w-4 h-4 ml-2 text-purple-600" />
            {showAllMatches ? 'הסתר מוסרים' : 'הצג הכל'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Actions Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm"
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>פעולות</span>
            <ChevronDown className="w-3 h-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem onClick={onRefresh}>
            <RefreshCw className="w-4 h-4 ml-2" />
            רענן נתונים
          </DropdownMenuItem>
          
          {onRevalidate && (
            <DropdownMenuItem onClick={onRevalidate} disabled={isRevalidating}>
              {isRevalidating ? (
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 ml-2 text-blue-600" />
              )}
              בדוק מחדש (10)
            </DropdownMenuItem>
          )}
          
          {showFocusButton && (
            <>
              <DropdownMenuSeparator />
              {isFocused ? (
                <DropdownMenuItem onClick={onCancelFocus}>
                  <Target className="w-4 h-4 ml-2 text-red-600" />
                  בטל מיקוד
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={onFocus}>
                  <Target className="w-4 h-4 ml-2" />
                  הגדר מיקוד
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Active Filters Summary */}
      <div className="flex flex-col gap-1 mr-auto">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            מוצגים: {filteredCount}
          </Badge>
          {showAllMatches && totalCount !== filteredCount && (
            <Badge variant="outline" className="text-xs text-purple-600">
              מתוך: {totalCount}
            </Badge>
          )}
        </div>
        
        {/* Active Filters Text */}
        <div className="text-xs text-gray-600">
          {(() => {
            const filters = [];
            
            if (matchScoreFilter !== 'all') {
              const scoreLabel = scoreOptions.find(o => o.value === matchScoreFilter)?.label || matchScoreFilter;
              filters.push(`ציון ${scoreLabel}`);
            }
            if (priorityFilter === 'high') {
              filters.push('עדיפות 1 בלבד');
            }
            if (handledFilter === 'unhandled') {
              filters.push('לא טופלו');
            } else if (handledFilter === 'handled') {
              filters.push('טופלו');
            }
            if (showFullMatchOnly) {
              filters.push('התאמה מלאה');
            }
            if (showBestFitOnly) {
              filters.push('Best Fit');
            }
            if (showRecentCvsOnly) {
              filters.push('קו"ח 10 ימים');
            }
            if (showWithTasksOnly) {
              filters.push('יש משימות');
            }
            if (showAllMatches) {
              filters.push('כולל מוסרים');
            }
            
            return filters.length > 0 
              ? `מסננים פעילים: ${filters.join(' • ')}` 
              : 'ללא מסננים מיוחדים';
          })()}
        </div>
      </div>
    </div>
  );
}