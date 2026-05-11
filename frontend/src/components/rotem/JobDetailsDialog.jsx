import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Briefcase, 
  Building, 
  MapPin, 
  Shield, 
  User, 
  FileText,
  Calendar,
  AlertCircle
} from "lucide-react";

export default function JobDetailsDialog({ isOpen, onClose, job }) {
  const getClearanceColor = (clearance) => {
    if (!clearance) return "bg-gray-100 text-gray-800";
    if (clearance.includes("רמה 1")) return "bg-red-100 text-red-800";
    if (clearance.includes("רמה 2")) return "bg-orange-100 text-orange-800";
    if (clearance.includes("רמה 3")) return "bg-yellow-100 text-yellow-800";
    return "bg-gray-100 text-gray-800";
  };

  const getStatusColor = (status) => {
    if (status === "פעילה") return "bg-green-100 text-green-800";
    if (status === "סגורה") return "bg-red-100 text-red-800";
    return "bg-gray-100 text-gray-800";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-blue-600" />
            </div>
            {job?.title || 'משרה'}
          </DialogTitle>
        </DialogHeader>

        {!job ? (
          <div className="py-8 text-center text-gray-500">
            לא נמצאו פרטי המשרה
          </div>
        ) : (
          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-4">
              {/* Basic Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    מידע בסיסי
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {job.job_code && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-500">קוד משרה:</span>
                      <Badge variant="outline">{job.job_code}</Badge>
                    </div>
                  )}
                  
                  {job.client_name && (
                    <div className="flex items-center gap-2">
                      <Building className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-500">לקוח:</span>
                      <span className="text-sm">{job.client_name}</span>
                    </div>
                  )}
                  
                  {job.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-500">מיקום:</span>
                      <span className="text-sm">{job.location}</span>
                    </div>
                  )}
                  
                  {job.contact_person && (
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-500">איש קשר:</span>
                      <span className="text-sm">{job.contact_person}</span>
                    </div>
                  )}
                  
                  {job.security_clearance && (
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-500">סיווג:</span>
                      <Badge className={getClearanceColor(job.security_clearance)}>
                        {job.security_clearance}
                      </Badge>
                    </div>
                  )}
                  
                  {job.status && (
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-500">סטטוס:</span>
                      <Badge className={getStatusColor(job.status)}>
                        {job.status}
                      </Badge>
                    </div>
                  )}

                  {job.created_date && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-500">תאריך יצירה:</span>
                      <span className="text-sm">
                        {new Date(job.created_date).toLocaleDateString('he-IL')}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Description */}
              {job.description && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      תיאור המשרה
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {job.description}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Requirements */}
              {job.requirements && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      דרישות
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {job.requirements}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Dana Supplement */}
              {job.dana_supplement && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      השלמות מדנה
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {job.dana_supplement}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Factory Department */}
              {job.factory_department && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">מפעל/מחלקה</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-700">{job.factory_department}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}