import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, FileText, Briefcase, Shield, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function JobMatchAnalysisDialog({ isOpen, onClose, jobMatch, candidate, job }) {
  const [detailedAnalysis, setDetailedAnalysis] = useState(null);
  const [geoData, setGeoData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && jobMatch && candidate && job) {
      generateDetailedAnalysis();
    }
  }, [isOpen, jobMatch, candidate, job]);

  const generateDetailedAnalysis = async () => {
    setLoading(true);
    try {
      // Calculate geo distance if applicable
      if (candidate.geo_latitude && candidate.geo_longitude && job.geo_latitude && job.geo_longitude) {
        const distance = calculateDistance(
          candidate.geo_latitude,
          candidate.geo_longitude,
          job.geo_latitude,
          job.geo_longitude
        );
        setGeoData({
          distance: distance,
          candidateCity: candidate.city || "לא צוין",
          jobLocation: job.location || "לא צוין",
          threshold: job.geo_threshold_km || 70,
          isWithinThreshold: distance <= (job.geo_threshold_km || 70)
        });
      }

      // Create detailed analysis structure
      const analysis = {
        jobRequirements: (job.requirements || "").split("\n").filter(r => r.trim()),
        jobDescription: (job.description || "").split("\n").filter(d => d.trim()),
        candidateExperience: candidate.main_experience || "לא צוין",
        candidateSkills: candidate.skills_summary || "לא צוין",
        candidateEducation: candidate.education || "לא צוין",
        candidateSecurityClearance: candidate.security_clearance || "לא צוין",
        jobSecurityClearance: job.security_clearance || "לא צוין",
        securityMatch: assessSecurityClearance(candidate.security_clearance, job.security_clearance),
        geoMatch: geoData?.isWithinThreshold || null,
        baseScoreWithoutGeo: job.base_score_without_geo,
        baseScoreWithGeo: job.base_score_with_geo
      };

      setDetailedAnalysis(analysis);
    } catch (error) {
      console.error("Error generating analysis:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  };

  const assessSecurityClearance = (candidateClearance, jobClearance) => {
    const clearanceHierarchy = {
      "ללא סווג": 0,
      "סווג נמוך": 1,
      "רמה 3": 2,
      "רמה 2": 3,
      "רמה 1": 4
    };

    const candidateLevel = clearanceHierarchy[candidateClearance] || -1;
    const jobLevel = clearanceHierarchy[jobClearance] || -1;

    if (!jobClearance) return { match: true, reason: "אין דרישה לסיווג בטחוני" };
    if (candidateLevel >= jobLevel) return { match: true, reason: `מתאים - יש סיווג ${candidateClearance}` };
    return { match: false, reason: `חסר - דרוש ${jobClearance}, יש ${candidateClearance || "ללא סווג"}` };
  };

  if (!isOpen || !jobMatch || !candidate || !job) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">ניתוח מפורט - {job.title}</DialogTitle>
          <DialogDescription>
            ניתוח סעיף מול סעיף להתאמת {candidate.first_name} {candidate.last_name} למשרה
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-gray-500">מעבד נתונים...</p>
          </div>
        ) : detailedAnalysis ? (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">סקירה</TabsTrigger>
              <TabsTrigger value="security">סיווג בטחוני</TabsTrigger>
              <TabsTrigger value="geography">גיאוגרפיה</TabsTrigger>
              <TabsTrigger value="details">פרטים</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">סקירת התאמה</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h4 className="font-semibold text-blue-900 mb-2">ציון התאמה כללי</h4>
                      <p className="text-3xl font-bold text-blue-600">{jobMatch.match_score}%</p>
                    </div>
                    {detailedAnalysis.baseScoreWithoutGeo && (
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-gray-900 mb-2">ציון בסיס (ללא גיאוגרפיה)</h4>
                        <p className="text-3xl font-bold text-gray-600">{detailedAnalysis.baseScoreWithoutGeo}</p>
                      </div>
                    )}
                    {detailedAnalysis.baseScoreWithGeo && (
                      <div className="bg-green-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-green-900 mb-2">ציון בסיס (עם גיאוגרפיה)</h4>
                        <p className="text-3xl font-bold text-green-600">{detailedAnalysis.baseScoreWithGeo}</p>
                      </div>
                    )}
                  </div>

                  {jobMatch.match_reasons && (
                    <div className="bg-white border border-gray-200 p-4 rounded-lg">
                      <h4 className="font-semibold text-gray-900 mb-2">סיבות התאמה</h4>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{jobMatch.match_reasons}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Security Clearance Tab */}
            <TabsContent value="security" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    בדיקת סיווג בטחוני
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">סיווג המועמד</p>
                      <p className="text-lg font-semibold text-blue-900">
                        {detailedAnalysis.candidateSecurityClearance}
                      </p>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">סיווג נדרש</p>
                      <p className="text-lg font-semibold text-purple-900">
                        {detailedAnalysis.jobSecurityClearance}
                      </p>
                    </div>
                  </div>

                  <div className={`p-4 rounded-lg flex items-start gap-3 ${
                    detailedAnalysis.securityMatch.match
                      ? "bg-green-50 border border-green-200"
                      : "bg-red-50 border border-red-200"
                  }`}>
                    {detailedAnalysis.securityMatch.match ? (
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-1" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-1" />
                    )}
                    <div>
                      <p className={`font-semibold ${
                        detailedAnalysis.securityMatch.match
                          ? "text-green-900"
                          : "text-red-900"
                      }`}>
                        {detailedAnalysis.securityMatch.reason}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Geography Tab */}
            <TabsContent value="geography" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    התאמה גיאוגרפית
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {geoData ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600 mb-1">עיר המועמד</p>
                          <p className="text-lg font-semibold text-blue-900">
                            {geoData.candidateCity}
                          </p>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600 mb-1">מיקום המשרה</p>
                          <p className="text-lg font-semibold text-purple-900">
                            {geoData.jobLocation}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600 mb-1">מרחק מחושב</p>
                          <p className="text-2xl font-bold text-gray-900">
                            {geoData.distance} ק"מ
                          </p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600 mb-1">סף מרחק מותר</p>
                          <p className="text-2xl font-bold text-gray-900">
                            {geoData.threshold} ק"מ
                          </p>
                        </div>
                      </div>

                      <div className={`p-4 rounded-lg flex items-start gap-3 ${
                        geoData.isWithinThreshold
                          ? "bg-green-50 border border-green-200"
                          : "bg-orange-50 border border-orange-200"
                      }`}>
                        {geoData.isWithinThreshold ? (
                          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-1" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-1" />
                        )}
                        <div>
                          <p className={`font-semibold ${
                            geoData.isWithinThreshold
                              ? "text-green-900"
                              : "text-orange-900"
                          }`}>
                            {geoData.isWithinThreshold
                              ? "מועמד נמצא בתחום מרחק מתאים"
                              : "מועמד מחוץ לתחום המרחק המותר"}
                          </p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-gray-500 text-center py-4">אין נתוני גיאוגרפיה זמינים</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Details Tab */}
            <TabsContent value="details" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="w-5 h-5" />
                    פרטי המשרה והמועמד
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Candidate CV */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      פרטי המועמד
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-gray-500 uppercase mb-1">ניסיון עיקרי</p>
                        <p className="text-sm text-gray-700">{detailedAnalysis.candidateExperience}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase mb-1">כישורים</p>
                        <p className="text-sm text-gray-700">{detailedAnalysis.candidateSkills}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase mb-1">השכלה</p>
                        <p className="text-sm text-gray-700">{detailedAnalysis.candidateEducation}</p>
                      </div>
                    </div>
                  </div>

                  {/* Job Description */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Briefcase className="w-4 h-4" />
                      דרישות המשרה
                    </h4>
                    <div className="space-y-2">
                      {detailedAnalysis.jobRequirements.length > 0 ? (
                        detailedAnalysis.jobRequirements.map((req, idx) => (
                          <div key={idx} className="flex gap-2 text-sm text-gray-700">
                            <span className="text-blue-600">•</span>
                            <span>{req}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-600">{job.requirements}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : null}

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>
            סגור
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}