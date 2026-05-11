import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  UserCheck,
  ChevronDown,
  ChevronUp,
  Building,
  Phone,
  Mail,
  Briefcase,
  FileText,
  MessageSquare,
  Bot,
  Calendar,
  TrendingUp,
  Activity,
  Target,
  Shield
} from 'lucide-react';
import MatchReasonsPopover from './MatchReasonsPopover';

export default function MeniTab({ 
  matches, 
  candidates, 
  onOpenNotes,
  agentStatus 
}) {
  const [expandedCandidates, setExpandedCandidates] = useState({});

  // Filter only Meni's creative matches (matches without job_id, created by meni)
  const meniMatches = useMemo(() => {
    return matches.filter(m => 
      m.user_name === 'מני - סוכן יצירתי' ||
      (m.match_reasons?.includes('איש קשר:') && m.is_automatic_recommendation)
    );
  }, [matches]);

  // Group by candidate
  const matchesByCandidate = useMemo(() => {
    const grouped = {};
    
    meniMatches.forEach(match => {
      const candidateKey = match.candidate_id || 'no-candidate';
      if (!grouped[candidateKey]) {
        grouped[candidateKey] = {
          candidate_id: match.candidate_id,
          candidate_name: match.candidate_name,
          matches: []
        };
      }
      grouped[candidateKey].matches.push(match);
    });
    
    return Object.values(grouped).sort((a, b) => b.matches.length - a.matches.length);
  }, [meniMatches]);

  const toggleCandidateExpand = (candidateId) => {
    setExpandedCandidates(prev => ({
      ...prev,
      [candidateId]: !prev[candidateId]
    }));
  };

  // Parse contact info from match_reasons
  const parseContactInfo = (matchReasons) => {
    if (!matchReasons) return {};
    
    const contactMatch = matchReasons.match(/איש קשר: (.+)/);
    const orgMatch = matchReasons.match(/ארגון: (.+)/);
    const fieldMatch = matchReasons.match(/תחום: (.+)/);
    
    return {
      contactName: contactMatch?.[1]?.split('\n')[0]?.trim(),
      organization: orgMatch?.[1]?.split('\n')[0]?.trim(),
      field: fieldMatch?.[1]?.split('\n')[0]?.trim()
    };
  };

  const getCandidateDetails = (candidateId) => {
    return candidates.find(c => c.id === candidateId);
  };

  // Stats for Meni
  const meniStats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const todayCount = meniMatches.filter(m => new Date(m.created_date) >= todayStart).length;
    const weekCount = meniMatches.filter(m => new Date(m.created_date) >= weekAgo).length;
    const monthCount = meniMatches.filter(m => new Date(m.created_date) >= monthAgo).length;
    
    return { todayCount, weekCount, monthCount };
  }, [meniMatches]);

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-4">
            <img 
              src="https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=80&h=80&fit=crop&crop=face" 
              alt="מני" 
              className="w-16 h-16 rounded-full object-cover border-4 border-purple-200 shadow-lg"
            />
            <div className="flex-1">
              <CardTitle className="flex items-center gap-3">
                <span>מני - התאמות יצירתיות</span>
                <Badge className="bg-purple-100 text-purple-800">
                  {matchesByCandidate.length} מועמדים
                </Badge>
              </CardTitle>
              <p className="text-sm text-gray-600">
                מני מאתר אנשי קשר רלוונטיים עבור מועמדי רמה 1 על פי התחום המקצועי
              </p>
              
              {/* Stats for Meni's matches */}
              <div className="mt-3 flex gap-3">
                <Badge className="bg-green-100 text-green-800 text-xs">
                  <TrendingUp className="w-3 h-3 ml-1" />
                  היום: {meniStats.todayCount}
                </Badge>
                <Badge className="bg-blue-100 text-blue-800 text-xs">
                  <Activity className="w-3 h-3 ml-1" />
                  שבוע: {meniStats.weekCount}
                </Badge>
                <Badge className="bg-purple-100 text-purple-800 text-xs">
                  <Calendar className="w-3 h-3 ml-1" />
                  חודש: {meniStats.monthCount}
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {matchesByCandidate.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bot className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">אין המלצות יצירתיות להצגה</p>
            <p className="text-xs text-gray-400 mt-2">מני מחפש אנשי קשר רלוונטיים למועמדי רמה 1</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {matchesByCandidate.map(candidateGroup => {
            const isExpanded = expandedCandidates[candidateGroup.candidate_id] === true;
            const candidateDetails = getCandidateDetails(candidateGroup.candidate_id);

            return (
              <Card key={candidateGroup.candidate_id} className="overflow-hidden">
                <Collapsible open={isExpanded} onOpenChange={() => toggleCandidateExpand(candidateGroup.candidate_id)}>
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                            <UserCheck className="w-5 h-5 text-purple-600" />
                          </div>
                          <div className="text-right">
                            <CardTitle className="text-lg flex items-center gap-2">
                              {candidateGroup.candidate_name}
                              <Badge className="bg-red-100 text-red-800 text-xs">
                                <Shield className="w-3 h-3 ml-1" />
                                רמה 1
                              </Badge>
                              {candidateDetails?.resume_file_url && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-green-600 hover:bg-green-50"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(candidateDetails.resume_file_url, '_blank');
                                  }}
                                  title="צפה בקורות חיים"
                                >
                                  <FileText className="w-4 h-4" />
                                </Button>
                              )}
                            </CardTitle>
                            <div className="flex gap-2 mt-1">
                              <Badge className="bg-purple-100 text-purple-800">
                                {candidateGroup.matches.length} אנשי קשר רלוונטיים
                              </Badge>
                            </div>
                            {candidateDetails?.main_discipline && (
                              <p className="text-xs text-gray-600 mt-1">
                                תחום: {candidateDetails.main_discipline}
                              </p>
                            )}
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-gray-500" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-500" />
                        )}
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>איש קשר</TableHead>
                            <TableHead>ארגון</TableHead>
                            <TableHead>תחום מקצועי</TableHead>
                            <TableHead>התאמה</TableHead>
                            <TableHead>תאריך</TableHead>
                            <TableHead>פעולות</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {candidateGroup.matches.map(match => {
                            const contactInfo = parseContactInfo(match.match_reasons);
                            
                            return (
                              <TableRow key={match.id} className={!match.is_read ? 'bg-purple-50' : ''}>
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                      <UserCheck className="w-4 h-4 text-blue-600" />
                                    </div>
                                    <div>
                                      <div>{contactInfo.contactName || 'לא זמין'}</div>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Building className="w-4 h-4 text-gray-500" />
                                    {contactInfo.organization || 'לא זמין'}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Briefcase className="w-4 h-4 text-purple-500" />
                                    <span className="text-sm">{contactInfo.field || 'לא זמין'}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <MatchReasonsPopover 
                                    matchScore={match.match_score} 
                                    matchReasons={match.match_reasons} 
                                  />
                                </TableCell>
                                <TableCell className="text-sm">
                                  {new Date(match.created_date).toLocaleDateString('he-IL')}
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => onOpenNotes(match)}
                                      className="h-8 w-8"
                                      title="הערות"
                                    >
                                      <MessageSquare className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}