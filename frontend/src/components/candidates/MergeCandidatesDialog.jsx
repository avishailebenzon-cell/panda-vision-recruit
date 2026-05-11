import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, AlertTriangle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function MergeCandidatesDialog({ isOpen, onClose, candidates, onMergeSuccess }) {
  const [merging, setMerging] = useState(false);
  const [candidateToKeep, setCandidateToKeep] = useState(null);

  if (!candidates || candidates.length !== 2) {
    return null;
  }

  const [candidate1, candidate2] = candidates;

  const handleMerge = async () => {
    if (!candidateToKeep) {
      alert('אנא בחר איזה מועמד לשמור');
      return;
    }

    setMerging(true);
    try {
      const candidateIdToKeep = candidateToKeep;
      const candidateIdToMerge = candidateToKeep === candidate1.id ? candidate2.id : candidate1.id;
      const keepData = candidateToKeep === candidate1.id ? candidate1 : candidate2;
      const mergeData = candidateToKeep === candidate1.id ? candidate2 : candidate1;

      // Build merged data - prefer non-empty values
      const mergedData = {
        first_name: keepData.first_name || mergeData.first_name,
        last_name: keepData.last_name || mergeData.last_name,
        first_name_english: keepData.first_name_english || mergeData.first_name_english,
        last_name_english: keepData.last_name_english || mergeData.last_name_english,
        id_number: keepData.id_number || mergeData.id_number,
        email: keepData.email || mergeData.email,
        phone_primary: keepData.phone_primary || mergeData.phone_primary,
        phone_secondary: keepData.phone_secondary || mergeData.phone_secondary,
        address: keepData.address || mergeData.address,
        city: keepData.city || mergeData.city,
        postal_code: keepData.postal_code || mergeData.postal_code,
        date_of_birth: keepData.date_of_birth || mergeData.date_of_birth,
        gender: keepData.gender || mergeData.gender,
        marital_status: keepData.marital_status || mergeData.marital_status,
        languages: keepData.languages || mergeData.languages,
        has_drivers_license: keepData.has_drivers_license || mergeData.has_drivers_license,
        security_clearance: keepData.security_clearance || mergeData.security_clearance,
        security_clearance_authority: keepData.security_clearance_authority || mergeData.security_clearance_authority,
        security_clearance_year: keepData.security_clearance_year || mergeData.security_clearance_year,
        profile_image_url: keepData.profile_image_url || mergeData.profile_image_url,
        resume_file_url: keepData.resume_file_url || mergeData.resume_file_url,
        education: keepData.education || mergeData.education,
        education_level: keepData.education_level || mergeData.education_level,
        main_experience: keepData.main_experience || mergeData.main_experience,
        main_tech_tools: keepData.main_tech_tools || mergeData.main_tech_tools,
        main_programming_languages: keepData.main_programming_languages || mergeData.main_programming_languages,
        skills_summary: keepData.skills_summary || mergeData.skills_summary,
        years_experience: keepData.years_experience || mergeData.years_experience,
        main_discipline: keepData.main_discipline || mergeData.main_discipline,
        military_rank: keepData.military_rank || mergeData.military_rank,
        military_service: keepData.military_service || mergeData.military_service,
        
        // Combine text fields
        full_text: [keepData.full_text, mergeData.full_text].filter(t => t).join('\n\n--- מועמד ממוזג ---\n\n'),
        additional_notes: [keepData.additional_notes, mergeData.additional_notes].filter(t => t).join('\n\n'),
        
        // Combine arrays
        detected_skills: Array.from(new Set([...(keepData.detected_skills || []), ...(mergeData.detected_skills || [])])),
        detected_languages: Array.from(new Set([...(keepData.detected_languages || []), ...(mergeData.detected_languages || [])])),
        detected_tools: Array.from(new Set([...(keepData.detected_tools || []), ...(mergeData.detected_tools || [])])),
        
        // Prefer primary candidate's referral info, but keep if secondary has it
        is_employee_referral: keepData.is_employee_referral || mergeData.is_employee_referral,
        referred_by_employee_name: keepData.referred_by_employee_name || mergeData.referred_by_employee_name,
        referred_by_employee_id: keepData.referred_by_employee_id || mergeData.referred_by_employee_id,
        referral_date: keepData.referral_date || mergeData.referral_date,
        
        // Keep status from primary candidate
        status: keepData.status,
        status_number: keepData.status_number
      };

      const { mergeCandidates } = await import('@/functions/mergeCandidates');
      const response = await mergeCandidates({ candidateIdToKeep, candidateIdToMerge, mergedData });

      if (response.data.success) {
        onMergeSuccess();
        onClose();
      } else {
        throw new Error(response.data.error || 'המיזוג נכשל');
      }
    } catch (error) {
      console.error('Error merging candidates:', error);
      alert('שגיאה במיזוג המועמדים: ' + error.message);
    } finally {
      setMerging(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            מיזוג מועמדים
          </DialogTitle>
          <DialogDescription>
            בחר איזה מועמד לשמור. השדות ממשני המועמדים ימוזגו למועמד הנבחר.
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            המיזוג יעביר את כל ההתאמות, המשימות וההודעות מהמועמד הנמחק למועמד הנשמר
          </AlertDescription>
        </Alert>

        <RadioGroup value={candidateToKeep} onValueChange={setCandidateToKeep}>
          <ScrollArea className="max-h-[50vh] pr-4">
            <div className="space-y-4">
              {/* Candidate 1 */}
              <div className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-3">
                  <RadioGroupItem value={candidate1.id} id={candidate1.id} className="mt-1" />
                  <Label htmlFor={candidate1.id} className="flex-1 cursor-pointer">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg">{candidate1.first_name} {candidate1.last_name}</span>
                        {candidate1.candidate_number && (
                          <Badge variant="outline" className="text-xs">
                            #{candidate1.candidate_number}
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                        {candidate1.email && <div>📧 {candidate1.email}</div>}
                        {candidate1.phone_primary && <div>📱 {candidate1.phone_primary}</div>}
                        {candidate1.city && <div>📍 {candidate1.city}</div>}
                        {candidate1.security_clearance && candidate1.security_clearance !== 'לא רלוונטי' && (
                          <div>🔒 {candidate1.security_clearance}</div>
                        )}
                        {candidate1.years_experience && <div>💼 {candidate1.years_experience} שנות ניסיון</div>}
                        {candidate1.main_discipline && <div>🎯 {candidate1.main_discipline}</div>}
                      </div>
                      {candidate1.skills_summary && (
                        <div className="text-xs text-gray-500 mt-2 line-clamp-2">
                          {candidate1.skills_summary}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className={candidate1.status === 'מועמד' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}>
                          {candidate1.status || 'מועמד'}
                        </Badge>
                        <span className="text-xs text-gray-400">
                          נוצר: {new Date(candidate1.created_date).toLocaleDateString('he-IL')}
                        </span>
                      </div>
                    </div>
                  </Label>
                </div>
              </div>

              {/* Candidate 2 */}
              <div className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-3">
                  <RadioGroupItem value={candidate2.id} id={candidate2.id} className="mt-1" />
                  <Label htmlFor={candidate2.id} className="flex-1 cursor-pointer">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg">{candidate2.first_name} {candidate2.last_name}</span>
                        {candidate2.candidate_number && (
                          <Badge variant="outline" className="text-xs">
                            #{candidate2.candidate_number}
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                        {candidate2.email && <div>📧 {candidate2.email}</div>}
                        {candidate2.phone_primary && <div>📱 {candidate2.phone_primary}</div>}
                        {candidate2.city && <div>📍 {candidate2.city}</div>}
                        {candidate2.security_clearance && candidate2.security_clearance !== 'לא רלוונטי' && (
                          <div>🔒 {candidate2.security_clearance}</div>
                        )}
                        {candidate2.years_experience && <div>💼 {candidate2.years_experience} שנות ניסיון</div>}
                        {candidate2.main_discipline && <div>🎯 {candidate2.main_discipline}</div>}
                      </div>
                      {candidate2.skills_summary && (
                        <div className="text-xs text-gray-500 mt-2 line-clamp-2">
                          {candidate2.skills_summary}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className={candidate2.status === 'מועמד' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}>
                          {candidate2.status || 'מועמד'}
                        </Badge>
                        <span className="text-xs text-gray-400">
                          נוצר: {new Date(candidate2.created_date).toLocaleDateString('he-IL')}
                        </span>
                      </div>
                    </div>
                  </Label>
                </div>
              </div>
            </div>
          </ScrollArea>
        </RadioGroup>

        {candidateToKeep && (
          <Alert className="bg-blue-50 border-blue-200">
            <CheckCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription>
              המועמד <strong>{candidateToKeep === candidate1.id ? `${candidate1.first_name} ${candidate1.last_name}` : `${candidate2.first_name} ${candidate2.last_name}`}</strong> יישמר,
              והמועמד השני יימחק. כל ההתאמות, המשימות וההודעות ימוזגו למועמד הנבחר.
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={merging}>
            ביטול
          </Button>
          <Button 
            onClick={handleMerge} 
            disabled={!candidateToKeep || merging}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {merging ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin ml-2" />
                ממזג...
              </>
            ) : (
              <>
                <Users className="w-4 h-4 ml-2" />
                מזג מועמדים
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}