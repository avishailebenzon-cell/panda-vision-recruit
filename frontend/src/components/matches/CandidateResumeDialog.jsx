import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Download, 
  User, 
  MapPin, 
  Mail, 
  Phone,
  Briefcase,
  GraduationCap,
  Shield,
  Languages,
  Wrench,
  Calendar,
  Loader2,
  Edit
} from "lucide-react";
import BlurredText from "../ui/BlurredText";
import CopyOnHover from "../ui/CopyOnHover";
import { base44 } from '@/api/base44Client';
import { Candidate } from "@/entities/Candidate";
import { Employee } from "@/entities/Employee";
import CandidateStatusSelector from "../candidates/CandidateStatusSelector";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default function CandidateResumeDialog({ isOpen, onClose, candidate, onCandidateUpdated }) {
  const [otherMatches, setOtherMatches] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [saving, setSaving] = useState(false);
  const [localCandidate, setLocalCandidate] = useState(null);

  useEffect(() => {
    if (candidate) setLocalCandidate(candidate);
  }, [candidate]);

  useEffect(() => {
    if (candidate && isOpen) {
      setFormData({
        first_name: candidate.first_name || "",
        last_name: candidate.last_name || "",
        email: candidate.email || "",
        phone_primary: candidate.phone_primary || "",
        phone_secondary: candidate.phone_secondary || "",
        address: candidate.address || "",
        city: candidate.city || "",
        education: candidate.education || "",
        skills_summary: candidate.skills_summary || "",
        security_clearance: candidate.security_clearance || "לא רלוונטי",
        status: candidate.status || "מועמד",
        status_number: candidate.status_number,
        referred_by_employee_name: candidate.referred_by_employee_name || "",
        referred_by_employee_id: candidate.referred_by_employee_id || "",
        cv_received_date: candidate.cv_received_date ? candidate.cv_received_date.split('T')[0] : "",
      });
    }
  }, [candidate, isOpen]);

  useEffect(() => {
    if (!candidate?.id || !isOpen) {
      setOtherMatches([]);
      return;
    }

    const loadOtherMatches = async () => {
      setLoadingMatches(true);
      try {
        // Get all matches for this candidate (without score filter first)
        const allMatches = await base44.entities.Match.filter({ 
          candidate_id: candidate.id
        }, '-match_score', 100);
        
        // Filter only high scoring matches and get unique jobs
        // Collect unique job IDs with high scores
        const uniqueJobs = new Map();
        allMatches.forEach(match => {
          if (match.match_score >= 70 && !uniqueJobs.has(match.job_id)) {
            uniqueJobs.set(match.job_id, {
              title: match.job_title,
              score: Math.round(match.match_score),
              job_id: match.job_id,
              job_code: match.job_code || null,
              client_name: match.client_name
            });
          }
        });

        // Fetch job codes for any jobs missing them
        const jobsWithoutCode = Array.from(uniqueJobs.values()).filter(j => !j.job_code && j.job_id);
        if (jobsWithoutCode.length > 0) {
          try {
            const jobIds = jobsWithoutCode.map(j => j.job_id);
            const jobDetails = await base44.entities.Job.filter({ id: { $in: jobIds } });
            jobDetails.forEach(job => {
              if (uniqueJobs.has(job.id)) {
                if (job.job_code) uniqueJobs.get(job.id).job_code = job.job_code;
                if (job.client_name) uniqueJobs.get(job.id).client_name = job.client_name;
              }
            });
          } catch (e) { /* ignore */ }
        }
        
        const jobsList = Array.from(uniqueJobs.values())
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);
        
        console.log(`Loaded ${jobsList.length} matching jobs for candidate ${candidate.id}`);
        setOtherMatches(jobsList);
      } catch (error) {
        console.error('Error loading other matches:', error);
        setOtherMatches([]);
      } finally {
        setLoadingMatches(false);
      }
    };

    loadOtherMatches();
  }, [candidate?.id, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    
    const loadEmployees = async () => {
      try {
        const employeesList = await Employee.filter({ status: 'פעיל' });
        setEmployees(employeesList);
      } catch (error) {
        console.error('Error loading employees:', error);
        setEmployees([]);
      } finally {
        setLoadingEmployees(false);
      }
    };
    loadEmployees();
  }, [isOpen]);

  const handleSaveCandidate = async () => {
    if (!formData.first_name || !formData.last_name) {
      alert("שם פרטי ושם משפחה הם שדות חובה");
      return;
    }

    setSaving(true);
    try {
      const dataToSave = {
        ...formData,
        cv_received_date: formData.cv_received_date ? new Date(formData.cv_received_date).toISOString() : null,
      };
      await Candidate.update(candidate.id, dataToSave);
      if (onCandidateUpdated) {
        onCandidateUpdated({ ...candidate, ...formData });
      }
      setEditMode(false);
      alert("המועמד עודכן בהצלחה");
    } catch (error) {
      console.error('Error updating candidate:', error);
      alert("שגיאה בעדכון המועמד");
    } finally {
      setSaving(false);
    }
  };

  if (!candidate) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] !fixed !right-0 !left-auto !translate-x-0" dir="rtl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <BlurredText><span className="text-xl">{candidate.full_name}</span></BlurredText>
                {candidate.candidate_number && (
                  <p className="text-sm text-gray-500 font-normal">מועמד #{candidate.candidate_number}</p>
                )}
              </div>
            </DialogTitle>
            <div className="flex gap-2">
              {!editMode && (
                <Button
                  variant="outline"
                  onClick={() => setEditMode(true)}
                  className="gap-2"
                >
                  <Edit className="w-4 h-4" />
                  ערוך
                </Button>
              )}
              {candidate.resume_file_url && (
                <Button
                  variant="outline"
                  onClick={() => window.open(candidate.resume_file_url, '_blank')}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  הורד קובץ
                </Button>
              )}
            </div>
          </div>
          
          {/* Other Job Matches */}
          {loadingMatches ? (
            <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>טוען משרות נוספות...</span>
            </div>
          ) : otherMatches.length > 0 && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs text-gray-500 mb-1.5">הותאם גם למשרות הבאות:</p>
              <div className="flex flex-wrap gap-1.5">
                {otherMatches.map((job, idx) => (
                  <Badge 
                    key={idx} 
                    variant="outline" 
                    className="text-xs bg-blue-50 text-blue-700 border-blue-200 py-1 gap-1"
                  >
                    {job.job_code && (
                      <span className="font-bold text-gray-700 bg-gray-100 rounded px-1">{job.job_code}</span>
                    )}
                    <span className="font-medium">{job.title}</span>
                    {job.client_name && <span className="text-gray-600">• {job.client_name}</span>}
                    <span className="text-blue-600 font-semibold">• {job.score}%</span>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6">
            {editMode && formData ? (
              /* Edit Mode Form */
              <div className="space-y-4 pb-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>שם פרטי *</Label>
                    <Input
                      value={formData.first_name}
                      onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                      placeholder="שם פרטי"
                    />
                  </div>
                  <div>
                    <Label>שם משפחה *</Label>
                    <Input
                      value={formData.last_name}
                      onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                      placeholder="שם משפחה"
                    />
                  </div>
                </div>

                <div>
                  <Label>אימייל</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="אימייל"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>טלפון ראשי</Label>
                    <Input
                      value={formData.phone_primary}
                      onChange={(e) => setFormData({...formData, phone_primary: e.target.value})}
                      placeholder="טלפון ראשי"
                    />
                  </div>
                  <div>
                    <Label>טלפון נוסף</Label>
                    <Input
                      value={formData.phone_secondary}
                      onChange={(e) => setFormData({...formData, phone_secondary: e.target.value})}
                      placeholder="טלפון נוסף"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>כתובת</Label>
                    <Input
                      value={formData.address}
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                      placeholder="כתובת"
                    />
                  </div>
                  <div>
                    <Label>עיר</Label>
                    <Input
                      value={formData.city}
                      onChange={(e) => setFormData({...formData, city: e.target.value})}
                      placeholder="עיר"
                    />
                  </div>
                </div>

                <div>
                  <Label>תארים ולימודים</Label>
                  <Input
                    value={formData.education}
                    onChange={(e) => setFormData({...formData, education: e.target.value})}
                    placeholder="תארים ולימודים"
                  />
                </div>

                <div>
                  <Label>תאריך הגעת קורות חיים</Label>
                  <Input
                    type="date"
                    value={formData.cv_received_date}
                    onChange={(e) => setFormData({...formData, cv_received_date: e.target.value})}
                  />
                </div>

                <div>
                  <Label>חבר מביא חבר</Label>
                  <Select 
                    value={formData.referred_by_employee_id || "none"} 
                    onValueChange={(value) => {
                      if (value === "none") {
                        setFormData({
                          ...formData, 
                          referred_by_employee_id: "",
                          referred_by_employee_name: "",
                          is_employee_referral: false
                        });
                      } else {
                        const employee = employees.find(e => e.id === value);
                        setFormData({
                          ...formData, 
                          referred_by_employee_id: value,
                          referred_by_employee_name: employee?.full_name || "",
                          is_employee_referral: true,
                          referral_date: new Date().toISOString(),
                          how_found_pandatech: ['חבר מביא חבר']
                        });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={loadingEmployees ? "טוען..." : "בחר עובד מפנה"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">אין - לא הופנה על ידי עובד</SelectItem>
                      {employees.map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.full_name} ({emp.department || emp.position || 'עובד'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>סיווג בטחוני</Label>
                  <Select 
                    value={formData.security_clearance} 
                    onValueChange={(value) => setFormData({...formData, security_clearance: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="בחר סיווג בטחוני" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="רמה 1">רמה 1</SelectItem>
                      <SelectItem value="רמה 2">רמה 2</SelectItem>
                      <SelectItem value="רמה 3">רמה 3</SelectItem>
                      <SelectItem value="סווג נמוך">סווג נמוך</SelectItem>
                      <SelectItem value="ללא סווג">ללא סווג</SelectItem>
                      <SelectItem value="לא רלוונטי">לא רלוונטי</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>סטטוס המועמד</Label>
                  <CandidateStatusSelector 
                    candidate={{ ...candidate, status: formData.status, status_number: formData.status_number }} 
                    onStatusChange={(updatedCandidate) => {
                      setFormData(prev => ({
                        ...prev,
                        status: updatedCandidate.status,
                        status_number: updatedCandidate.status_number
                      }));
                    }}
                  />
                </div>

                <div>
                  <Label>סיכום יכולות וכישורים</Label>
                  <Textarea
                    value={formData.skills_summary}
                    onChange={(e) => setFormData({...formData, skills_summary: e.target.value})}
                    rows={4}
                    placeholder="סיכום יכולות וכישורים"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setEditMode(false);
                      setFormData({
                        first_name: candidate.first_name || "",
                        last_name: candidate.last_name || "",
                        email: candidate.email || "",
                        phone_primary: candidate.phone_primary || "",
                        phone_secondary: candidate.phone_secondary || "",
                        address: candidate.address || "",
                        city: candidate.city || "",
                        education: candidate.education || "",
                        skills_summary: candidate.skills_summary || "",
                        security_clearance: candidate.security_clearance || "לא רלוונטי",
                        status: candidate.status || "מועמד",
                        status_number: candidate.status_number,
                        referred_by_employee_name: candidate.referred_by_employee_name || "",
                        referred_by_employee_id: candidate.referred_by_employee_id || "",
                        cv_received_date: candidate.cv_received_date ? candidate.cv_received_date.split('T')[0] : "",
                        });
                        }}
                        disabled={saving}
                  >
                    ביטול
                  </Button>
                  <Button 
                    onClick={handleSaveCandidate}
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin ml-2" />
                        שומר...
                      </>
                    ) : (
                      'שמור שינויים'
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              /* View Mode */
              <>
            {/* CV Received Date */}
            {candidate.cv_received_date && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <Calendar className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span className="text-sm text-amber-800">
                  <span className="font-medium">תאריך הגעת קורות חיים: </span>
                  {new Date(candidate.cv_received_date).toLocaleDateString('he-IL')}
                </span>
              </div>
            )}

            {/* Contact Info */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1">
                <CandidateStatusSelector
                  candidate={localCandidate || candidate}
                  onStatusChange={async (updatedCandidate) => {
                    setLocalCandidate(prev => ({ ...prev, ...updatedCandidate }));
                    try {
                      await Candidate.update(candidate.id, {
                        status: updatedCandidate.status,
                        status_number: updatedCandidate.status_number
                      });
                      if (onCandidateUpdated) onCandidateUpdated({ ...candidate, ...updatedCandidate });
                    } catch (e) {
                      console.error('Error updating status:', e);
                    }
                  }}
                />
              </div>
              {candidate.email && (
                <div className="flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <BlurredText>
                    <CopyOnHover value={candidate.email}>
                      <span className="text-sm">{candidate.email}</span>
                    </CopyOnHover>
                  </BlurredText>
                </div>
              )}
              {candidate.phone_primary && (
                <div className="flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <BlurredText>
                    <CopyOnHover value={candidate.phone_primary}>
                      <span className="text-sm">{candidate.phone_primary}</span>
                    </CopyOnHover>
                  </BlurredText>
                </div>
              )}
              {candidate.city && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <span className="text-sm">{candidate.city}</span>
                </div>
              )}
              {candidate.security_clearance && candidate.security_clearance !== 'לא רלוונטי' && (
                <div className="flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <Badge className="bg-red-100 text-red-800">{candidate.security_clearance}</Badge>
                </div>
              )}
            </div>

            {/* Skills Summary */}
            {candidate.skills_summary && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-blue-600" />
                  סיכום כישורים
                </h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{candidate.skills_summary}</p>
              </div>
            )}

            {/* Main Experience */}
            {candidate.main_experience && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-green-600" />
                  ניסיון מרכזי
                </h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{candidate.main_experience}</p>
              </div>
            )}

            {/* Work History */}
            {(candidate.job_1_company || candidate.job_2_company || candidate.job_3_company) && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-gray-600" />
                  היסטוריית עבודה
                </h3>
                <div className="space-y-3">
                  {candidate.job_1_company && (
                    <div className="border-r-4 border-blue-400 pr-3 bg-gray-50 p-3 rounded">
                      <p className="font-medium text-gray-900">{candidate.job_1_role || 'תפקיד'} - {candidate.job_1_company}</p>
                      {candidate.job_1_description && (
                        <p className="text-sm text-gray-600 mt-1">{candidate.job_1_description}</p>
                      )}
                      {candidate.job_1_end_date && (
                        <p className="text-xs text-gray-500 mt-1">עד: {candidate.job_1_end_date}</p>
                      )}
                    </div>
                  )}
                  {candidate.job_2_company && (
                    <div className="border-r-4 border-blue-300 pr-3 bg-gray-50 p-3 rounded">
                      <p className="font-medium text-gray-900">{candidate.job_2_role || 'תפקיד'} - {candidate.job_2_company}</p>
                      {candidate.job_2_description && (
                        <p className="text-sm text-gray-600 mt-1">{candidate.job_2_description}</p>
                      )}
                    </div>
                  )}
                  {candidate.job_3_company && (
                    <div className="border-r-4 border-blue-200 pr-3 bg-gray-50 p-3 rounded">
                      <p className="font-medium text-gray-900">{candidate.job_3_role || 'תפקיד'} - {candidate.job_3_company}</p>
                      {candidate.job_3_description && (
                        <p className="text-sm text-gray-600 mt-1">{candidate.job_3_description}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Education */}
            {(candidate.education_1 || candidate.education_2 || candidate.education_3 || candidate.education) && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-purple-600" />
                  השכלה
                </h3>
                <div className="space-y-2">
                  {candidate.education_1 && <p className="text-sm text-gray-700">• {candidate.education_1}</p>}
                  {candidate.education_2 && <p className="text-sm text-gray-700">• {candidate.education_2}</p>}
                  {candidate.education_3 && <p className="text-sm text-gray-700">• {candidate.education_3}</p>}
                  {candidate.education && (
                    <div className="bg-purple-50 p-3 rounded text-sm text-gray-700 whitespace-pre-wrap">
                      {candidate.education}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Languages */}
            {candidate.languages && (
              <div className="flex items-start gap-2">
                <Languages className="w-4 h-4 text-gray-600 mt-1" />
                <div>
                  <p className="font-semibold text-gray-900">שפות</p>
                  <p className="text-sm text-gray-700">{candidate.languages}</p>
                </div>
              </div>
            )}

            {/* Military Service */}
            {candidate.military_service && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-gray-600" />
                  שירות צבאי
                </h3>
                <p className="text-sm text-gray-700">{candidate.military_service}</p>
                {candidate.military_rank && (
                  <p className="text-xs text-gray-600 mt-1">דרגה: {candidate.military_rank}</p>
                )}
                {(candidate.military_recruitment_year || candidate.military_discharge_year) && (
                  <p className="text-xs text-gray-600">
                    {candidate.military_recruitment_year && `גיוס: ${candidate.military_recruitment_year}`}
                    {candidate.military_recruitment_year && candidate.military_discharge_year && ' | '}
                    {candidate.military_discharge_year && `שחרור: ${candidate.military_discharge_year}`}
                  </p>
                )}
              </div>
            )}

            {/* Additional Notes */}
            {candidate.additional_notes && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">הערות נוספות</h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{candidate.additional_notes}</p>
              </div>
            )}

            {/* Original File */}
            {candidate.resume_file_url && (
              <div className="border-t pt-4">
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => window.open(candidate.resume_file_url, '_blank')}
                >
                  <FileText className="w-4 h-4" />
                  פתח קובץ קורות חיים מקורי
                </Button>
              </div>
            )}
            </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}