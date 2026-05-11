import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Loader2 } from 'lucide-react';
import { CandidateStatus } from '@/entities/CandidateStatus';

export default function BulkStatusSelector({ onStatusChange, disabled }) {
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStatuses = async () => {
      try {
        const statusList = await CandidateStatus.filter({ is_active: true }, 'status_number');
        setStatuses(statusList);
      } catch (error) {
        console.error('Error loading statuses:', error);
      }
      setLoading(false);
    };
    loadStatuses();
  }, []);

  if (loading) {
    return <Button size="sm" variant="outline" disabled><Loader2 className="w-4 h-4 animate-spin" /></Button>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled} className="border-purple-300 text-purple-600">
          {disabled ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : null}
          שנה סטטוס
          <ChevronDown className="w-4 h-4 mr-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
        {statuses.map(status => (
          <DropdownMenuItem
            key={status.id}
            onClick={() => onStatusChange(status)}
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