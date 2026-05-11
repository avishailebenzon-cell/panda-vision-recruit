import React, { useState, useEffect, useCallback } from 'react';
import { CandidateStatus } from '@/entities/CandidateStatus';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';

export default function StatusUpdateComponent({ 
  currentStatusNumber, 
  onStatusChange, 
  disabled = false,
  showCurrentStatus = true 
}) {
  const [allStatuses, setAllStatuses] = useState([]);
  const [allowedStatuses, setAllowedStatuses] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadStatusesAndRules = useCallback(async () => {
    setLoading(true);
    try {
      const statuses = await CandidateStatus.list('status_number');
      const activeStatuses = statuses.filter(s => s.is_active);
      setAllStatuses(activeStatuses);

      if (currentStatusNumber) {
        // Find current status and its allowed next statuses
        const currentStatus = activeStatuses.find(s => s.status_number === currentStatusNumber);
        if (currentStatus && currentStatus.next_possible_statuses) {
          const allowed = activeStatuses.filter(s => 
            currentStatus.next_possible_statuses.includes(s.status_number)
          );
          setAllowedStatuses(allowed);
        } else {
          // If no rules defined, allow all statuses (backward compatibility)
          setAllowedStatuses(activeStatuses);
        }
      } else {
        // If no current status, allow all statuses
        setAllowedStatuses(activeStatuses);
      }
    } catch (error) {
      console.error('Error loading status rules:', error);
      setAllowedStatuses([]);
    }
    setLoading(false);
  }, [currentStatusNumber]);

  useEffect(() => {
    loadStatusesAndRules();
  }, [loadStatusesAndRules]);

  const getCurrentStatusName = () => {
    const status = allStatuses.find(s => s.status_number === currentStatusNumber);
    return status ? status.status_name : 'לא ידוע';
  };

  const getStatusColor = (status) => {
    return status.color || '#cccccc';
  };

  if (loading) {
    return <div className="animate-pulse">טוען מצבים...</div>;
  }

  return (
    <div className="space-y-2">
      {showCurrentStatus && currentStatusNumber && (
        <div className="text-sm text-gray-600">
          מצב נוכחי: <Badge style={{ backgroundColor: `${getStatusColor(allStatuses.find(s => s.status_number === currentStatusNumber))}20`, color: getStatusColor(allStatuses.find(s => s.status_number === currentStatusNumber)) }}>
            {getCurrentStatusName()}
          </Badge>
        </div>
      )}
      
      {allowedStatuses.length > 0 ? (
        <Select onValueChange={onStatusChange} disabled={disabled}>
          <SelectTrigger>
            <SelectValue placeholder="בחר מצב חדש" />
          </SelectTrigger>
          <SelectContent>
            {allowedStatuses.map(status => (
              <SelectItem key={status.status_number} value={status.status_number.toString()}>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: status.color || '#cccccc' }}
                  />
                  {status.status_name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <div className="flex items-center gap-2 text-amber-600 text-sm">
          <AlertTriangle className="w-4 h-4" />
          אין מעברי מצב זמינים ממצב זה
        </div>
      )}

      {allowedStatuses.length === 0 && currentStatusNumber && (
        <div className="text-xs text-gray-500">
          כדי לאפשר מעברי מצב, עדכן את הגדרות המצב "{getCurrentStatusName()}" במסך ניהול המערכת
        </div>
      )}
    </div>
  );
}