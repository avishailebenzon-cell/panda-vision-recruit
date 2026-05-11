import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Building, 
  MapPin, 
  User, 
  Calendar, 
  Shield, 
  Briefcase,
  FileText,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function JobDetailsDialog({ job, open, onClose }) {
  if (!job) return null;

  const formatDate = (dateString) => {
    if (!dateString) return 'לא צוין';
    return new Date(dateString).toLocaleDateString('he-IL', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      timeZone: 'Asia/Jerusalem'
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-blue-600" />
            {job.title}
          </DialogTitle>
          <Badge variant="outline" className="w-fit font-mono mt-2">
            {job.job_code}
          </Badge>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-700">
                  <Building className="w-4 h-4" />
                  <span className="font-medium">לקוח:</span>
                  <span>{job.client_name || 'לא צוין'}</span>
                </div>
                
                <div className="flex items-center gap-2 text-gray-700">
                  <MapPin className="w-4 h-4" />
                  <span className="font-medium">מיקום:</span>
                  <span>{job.location || 'לא צוין'}</span>
                </div>
                
                <div className="flex items-center gap-2 text-gray-700">
                  <User className="w-4 h-4" />
                  <span className="font-medium">איש קשר:</span>
                  <span>{job.contact_person || 'לא צוין'}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-700">
                  <Calendar className="w-4 h-4" />
                  <span className="font-medium">נפתח:</span>
                  <span>{formatDate(job.created_date)}</span>
                </div>
                
                {job.deadline && (
                  <div className="flex items-center gap-2 text-gray-700">
                    <Calendar className="w-4 h-4 text-red-500" />
                    <span className="font-medium">דדליין:</span>
                    <span className="text-red-600 font-semibold">{formatDate(job.deadline)}</span>
                  </div>
                )}
                
                {job.security_clearance && (
                  <div className="flex items-center gap-2 text-gray-700">
                    <Shield className="w-4 h-4" />
                    <span className="font-medium">סיווג:</span>
                    <Badge variant="outline">{job.security_clearance}</Badge>
                  </div>
                )}
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <span className="font-medium text-gray-700">סטטוס:</span>
              <Badge className={
                job.status === 'פעילה' 
                  ? 'bg-green-100 text-green-800' 
                  : job.status === 'סגורה' 
                  ? 'bg-red-100 text-red-800' 
                  : 'bg-gray-100 text-gray-800'
              }>
                {job.status || 'לא צוין'}
              </Badge>
              
              {job.assigned_agent_name && (
                <>
                  <span className="mr-4 font-medium text-gray-700">סוכן מוקצה:</span>
                  <Badge variant="outline">{job.assigned_agent_name}</Badge>
                </>
              )}
            </div>

            {/* Dana Supplement */}
            {job.dana_supplement && (
              <div className="space-y-2">
                <div className="font-medium text-gray-700 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  תוספת מדנה:
                </div>
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 text-sm whitespace-pre-wrap">
                  {job.dana_supplement}
                </div>
              </div>
            )}

            {/* Description */}
            <div className="space-y-2">
              <div className="font-medium text-gray-700">תיאור המשרה:</div>
              <div className="bg-gray-50 p-4 rounded-lg border text-sm whitespace-pre-wrap">
                {job.description || 'אין תיאור'}
              </div>
            </div>

            {/* Requirements */}
            <div className="space-y-2">
              <div className="font-medium text-gray-700">דרישות:</div>
              <div className="bg-gray-50 p-4 rounded-lg border text-sm whitespace-pre-wrap">
                {job.requirements || 'אין דרישות'}
              </div>
            </div>

            {/* Pipedrive Link */}
            {job.pipedrive_deal_url && (
              <div className="pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(job.pipedrive_deal_url, '_blank')}
                  className="gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  פתח ב-Pipedrive
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}