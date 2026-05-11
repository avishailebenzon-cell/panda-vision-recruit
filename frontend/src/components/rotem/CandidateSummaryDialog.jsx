import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  GraduationCap,
  Shield,
  Calendar,
  FileText,
  ExternalLink,
  GitCommitHorizontal
} from 'lucide-react';
import CandidateTimelineDialog from '../candidates/CandidateTimelineDialog';

export default function CandidateSummaryDialog({ isOpen, onClose, candidate }) {
  const [showTimeline, setShowTimeline] = useState(false);

  const getClearanceColor = (clearance) => {
    if (!clearance || clearance === 'לא רלוונטי') return 'bg-gray-100 text-gray-700';
    if (clearance.includes('רמה 1')) return 'bg-red-100 text-red-700';
    if (clearance.includes('רמה 2')) return 'bg-orange-100 text-orange-700';
    if (clearance.includes('רמה 3')) return 'bg-yellow-100 text-yellow-700';
    return 'bg-blue-100 text-blue-700';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-green-600" />
            </div>
            {candidate?.full_name || `${candidate?.first_name || ''} ${candidate?.last_name || ''}` || 'מועמד'}
          </DialogTitle>
        </DialogHeader>

        {!candidate ? (
          <div className="py-8 text-center text-gray-500">
            לא נמצאו פרטי המועמד
          </div>
        ) : (
        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-4">
            {/* Contact Information */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm text-gray-700 mb-3">פרטי קשר</h3>
              
              {candidate.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-gray-500" />
                  <a href={`mailto:${candidate.email}`} className="text-blue-600 hover:underline">
                    {candidate.email}
                  </a>
                </div>
              )}
              
              {candidate.phone_primary && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-gray-500" />
                  <a href={`tel:${candidate.phone_primary}`} className="text-blue-600 hover:underline">
                    {candidate.phone_primary}
                  </a>
                </div>
              )}
              
              {candidate.city && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-gray-500" />
                  <span>{candidate.city}</span>
                </div>
              )}
            </div>

            {/* Skills Summary */}
            {candidate.skills_summary && (
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-semibold text-sm text-gray-700 mb-2 flex items-center gap-2">
                  <Briefcase className="w-4 h-4" />
                  סיכום כישורים
                </h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{candidate.skills_summary}</p>
              </div>
            )}

            {/* Professional Details */}
            <div className="grid grid-cols-2 gap-3">
              {candidate.years_experience && (
                <div className="bg-white border rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">שנות ניסיון</div>
                  <div className="font-semibold text-gray-900">{candidate.years_experience}</div>
                </div>
              )}
              
              {candidate.education_level && (
                <div className="bg-white border rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                    <GraduationCap className="w-3 h-3" />
                    השכלה
                  </div>
                  <div className="font-semibold text-gray-900 text-sm">{candidate.education_level}</div>
                </div>
              )}
              
              {candidate.security_clearance && candidate.security_clearance !== 'לא רלוונטי' && (
                <div className="bg-white border rounded-lg p-3 col-span-2">
                  <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    סיווג בטחוני
                  </div>
                  <Badge className={getClearanceColor(candidate.security_clearance)}>
                    {candidate.security_clearance}
                  </Badge>
                </div>
              )}
            </div>

            {/* Main Experience */}
            {candidate.main_experience && (
              <div className="bg-purple-50 rounded-lg p-4">
                <h3 className="font-semibold text-sm text-gray-700 mb-2">ניסיון מרכזי</h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{candidate.main_experience}</p>
              </div>
            )}

            {/* Languages & Tools */}
            <div className="flex flex-wrap gap-2">
              {candidate.detected_languages && candidate.detected_languages.length > 0 && 
                candidate.detected_languages.slice(0, 8).map((lang, idx) => (
                  <Badge key={idx} className="bg-indigo-100 text-indigo-800 text-xs">
                    {lang}
                  </Badge>
                ))
              }
              {candidate.detected_tools && candidate.detected_tools.length > 0 && 
                candidate.detected_tools.slice(0, 8).map((tool, idx) => (
                  <Badge key={idx} className="bg-green-100 text-green-800 text-xs">
                    {tool}
                  </Badge>
                ))
              }
            </div>

            {/* Resume Link and Timeline */}
            <div className="grid grid-cols-2 gap-2">
              {candidate.resume_file_url && (
                <Button 
                  variant="outline" 
                  className="gap-2"
                  onClick={() => window.open(candidate.resume_file_url, '_blank')}
                >
                  <FileText className="w-4 h-4" />
                  קורות חיים
                  <ExternalLink className="w-3 h-3" />
                </Button>
              )}
              <Button 
                variant="outline" 
                className="gap-2 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                onClick={() => setShowTimeline(true)}
              >
                <GitCommitHorizontal className="w-4 h-4" />
                ציר זמן
              </Button>
            </div>

            {/* Additional Info */}
            {candidate.created_date && (
              <div className="text-xs text-gray-500 flex items-center gap-2 pt-2 border-t">
                <Calendar className="w-3 h-3" />
                נוצר במערכת: {new Date(candidate.created_date).toLocaleDateString('he-IL')}
              </div>
            )}
          </div>
        </ScrollArea>
        )}
      </DialogContent>
      
      <CandidateTimelineDialog
        open={showTimeline}
        candidate={candidate}
        onClose={() => setShowTimeline(false)}
      />
    </Dialog>
  );
}