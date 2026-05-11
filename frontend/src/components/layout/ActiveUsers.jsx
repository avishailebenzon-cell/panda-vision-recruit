import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Users } from 'lucide-react';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger 
} from "@/components/ui/tooltip";

export default function ActiveUsers() {
  const [activeUsers, setActiveUsers] = useState([]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const fetchActiveUsers = async () => {
      try {
        // Get all users and filter by recent activity (last 30 minutes)
        const allUsers = await base44.entities.User.list('-created_date', 1000);
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        
        const active = allUsers.filter(user => {
          const lastActivityDate = user.last_activity_date ? new Date(user.last_activity_date) : null;
          return lastActivityDate && lastActivityDate > thirtyMinutesAgo;
        });
        
        setActiveUsers(active);
        setCount(active.length);
      } catch (error) {
        console.log('Error fetching active users:', error?.message);
      }
    };

    fetchActiveUsers();
    
    // Refresh every minute
    const interval = setInterval(fetchActiveUsers, 60000);
    
    return () => clearInterval(interval);
  }, []);

  // Subscribe to user updates
  useEffect(() => {
    const unsubscribe = base44.entities.User.subscribe((event) => {
      if (event.type === 'update') {
        setActiveUsers(prev => {
          const updated = prev.map(u => u.id === event.id ? event.data : u);
          const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
          const filtered = updated.filter(u => {
            const lastActivityDate = u.last_activity_date ? new Date(u.last_activity_date) : null;
            return lastActivityDate && lastActivityDate > thirtyMinutesAgo;
          });
          setCount(filtered.length);
          return filtered;
        });
      }
    });

    return unsubscribe;
  }, []);

  if (count === 0) return null;

  const usersList = activeUsers.slice(0, 5);
  const hasMore = activeUsers.length > 5;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg cursor-pointer hover:bg-green-100 transition-colors">
            <Users className="w-4 h-4 text-green-600" />
            <span className="text-xs font-semibold text-green-700">{count} פעיל</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-2">
            <p className="font-semibold text-sm">משתמשים מחוברים כעת:</p>
            <div className="space-y-1">
              {usersList.map((user) => (
                <div key={user.id} className="text-xs">
                  <span className="font-medium">{user.full_name}</span>
                  <span className="text-gray-400"> ({user.email})</span>
                </div>
              ))}
              {hasMore && (
                <div className="text-xs text-gray-400">
                  ו-{activeUsers.length - 5} נוספים...
                </div>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}