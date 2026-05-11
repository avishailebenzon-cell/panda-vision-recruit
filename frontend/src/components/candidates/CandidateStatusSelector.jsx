import React, { useState, useEffect, useRef } from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Cache for statuses to avoid multiple API calls
let cachedStatuses = null;
let cachePromise = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 1 minute cache

const loadStatusesOnce = async () => {
  const now = Date.now();
  if (cachedStatuses && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedStatuses;
  }
  if (cachePromise) {
    return cachePromise;
  }
  cachePromise = base44.entities.CandidateStatus.filter({ is_active: true }, 'status_number')
    .then(statusList => {
      cachedStatuses = statusList;
      cacheTimestamp = Date.now();
      cachePromise = null;
      return statusList;
    })
    .catch(error => {
      cachePromise = null;
      throw error;
    });
  return cachePromise;
};

export default function CandidateStatusSelector({ candidate, onStatusChange, compact = false, statusesCache = null }) {
  const [statuses, setStatuses] = useState(statusesCache || cachedStatuses || []);
  const [loading, setLoading] = useState(!statusesCache && !cachedStatuses);
  const [updating, setUpdating] = useState(false);
  const [currentCandidate, setCurrentCandidate] = useState(candidate);
  const loadedRef = useRef(false);

  // Update local candidate state when prop changes
  useEffect(() => {
    setCurrentCandidate(candidate);
  }, [candidate.id, candidate.status, candidate.status_number]);

  useEffect(() => {
    if (statusesCache) {
      setStatuses(statusesCache);
      setLoading(false);
      return;
    }
    if (cachedStatuses && !loadedRef.current) {
      setStatuses(cachedStatuses);
      setLoading(false);
      return;
    }
    if (!loadedRef.current) {
      loadedRef.current = true;
      loadStatusesOnce()
        .then(statusList => {
          setStatuses(statusList);
          setLoading(false);
        })
        .catch(error => {
          console.error('Error loading statuses:', error);
          setLoading(false);
        });
    }
  }, [statusesCache]);

  const getCurrentStatus = () => {
    // Find status by status_number first, then by status name
    if (currentCandidate.status_number) {
      return statuses.find(s => s.status_number === currentCandidate.status_number);
    }
    // Fallback to matching by name
    return statuses.find(s => s.status_name === currentCandidate.status);
  };

  const handleStatusChange = async (newStatus) => {
    setUpdating(true);
    
    // Store original values for potential rollback
    const originalStatus = currentCandidate.status;
    const originalStatusNumber = currentCandidate.status_number;
    
    // Create updated candidate object
    const updatedCandidate = {
      ...currentCandidate,
      status: newStatus.status_name,
      status_number: newStatus.status_number
    };
    
    // Update local state immediately
    setCurrentCandidate(updatedCandidate);
    
    // Call parent's onStatusChange for external state update
    if (onStatusChange) {
      onStatusChange(updatedCandidate);
    }
    
    // Update server - if fails, revert
    try {
      await base44.entities.Candidate.update(candidate.id, {
        status: newStatus.status_name,
        status_number: newStatus.status_number
      });
    } catch (error) {
      console.error('Error updating status:', error);
      
      // Revert local state
      setCurrentCandidate({
        ...currentCandidate,
        status: originalStatus,
        status_number: originalStatusNumber
      });
      
      // Revert parent state
      if (onStatusChange) {
        onStatusChange({
          ...candidate,
          status: originalStatus,
          status_number: originalStatusNumber
        });
      }
      
      alert(`שגיאה בעדכון סטטוס: ${error.message || 'שגיאת רשת'}. אנא נסה שוב.`);
    } finally {
      setUpdating(false);
    }
  };

  const currentStatus = getCurrentStatus();
  const statusColor = currentStatus?.color || '#6B7280';
  const statusName = currentStatus?.status_name || currentCandidate.status || 'לא הוגדר';

  if (loading) {
    return <Badge variant="outline" className="animate-pulse">טוען...</Badge>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className="p-0 h-auto hover:bg-transparent"
          disabled={updating}
        >
          <Badge 
            style={{ 
              backgroundColor: `${statusColor}20`, 
              color: statusColor, 
              borderColor: statusColor 
            }} 
            className="border cursor-pointer flex items-center gap-1"
          >
            {updating ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <>
                {statusName}
                {!compact && <ChevronDown className="w-3 h-3" />}
              </>
            )}
          </Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
        {statuses.map(status => (
          <DropdownMenuItem
            key={status.id}
            onClick={() => handleStatusChange(status)}
            className="cursor-pointer"
          >
            <Badge 
              style={{ 
                backgroundColor: `${status.color}20`, 
                color: status.color, 
                borderColor: status.color 
              }} 
              className="border"
            >
              {status.status_name}
            </Badge>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}