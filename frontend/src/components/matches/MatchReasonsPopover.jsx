import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Info, Shield, Code, GraduationCap, MapPin, Briefcase, Star, AlertTriangle, BadgeCheck } from 'lucide-react';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function MatchReasonsPopover({ matchScore, matchReasons, detailedAnalysis, betterMatch }) {
  const [betterMatchOpen, setBetterMatchOpen] = useState(false);
  if (!matchReasons && matchScore == null && !detailedAnalysis) {
    return <span className="text-gray-400 text-xs">לא זמין</span>;
  }

  let analysisData = null;
  try {
    if (detailedAnalysis) {
      analysisData = typeof detailedAnalysis === 'string' ? JSON.parse(detailedAnalysis) : detailedAnalysis;
    }
  } catch (e) {
    console.error("Failed to parse detailed analysis", e);
  }

  // Parse the reasons string to extract meaningful parts
  const parseReasons = (reasons) => {
    if (!reasons) return [];
    
    const parsed = [];
    
    // Extract match level
    const levelMatch = reasons.match(/\[(.*?)\]/);
    if (levelMatch) {
      parsed.push({ type: 'level', text: levelMatch[1], icon: Star });
    }
    
    // Split by | and categorize
    const parts = reasons.replace(/\[.*?\]/, '').split('|').map(p => p.trim()).filter(Boolean);
    
    parts.forEach(part => {
      if (part.includes('סיווג') || part.includes('בטחוני')) {
        parsed.push({ type: 'security', text: part, icon: Shield, color: 'text-red-600 bg-red-50' });
      } else if (part.includes('טכנולוג') || part.includes('התאמות טכנולוגיות')) {
        parsed.push({ type: 'tech', text: part, icon: Code, color: 'text-blue-600 bg-blue-50' });
      } else if (part.includes('השכלה') || part.includes('תואר')) {
        parsed.push({ type: 'education', text: part, icon: GraduationCap, color: 'text-purple-600 bg-purple-50' });
      } else if (part.includes('גיאוגרפ') || part.includes('מיקום')) {
        parsed.push({ type: 'location', text: part, icon: MapPin, color: 'text-green-600 bg-green-50' });
      } else if (part.includes('תפקיד') || part.includes('תחום') || part.includes('ניסיון')) {
        parsed.push({ type: 'role', text: part, icon: Briefcase, color: 'text-orange-600 bg-orange-50' });
      } else if (part.includes('צבא') || part.includes('ביטחון')) {
        parsed.push({ type: 'military', text: part, icon: Shield, color: 'text-amber-600 bg-amber-50' });
      } else if (part.trim()) {
        parsed.push({ type: 'other', text: part, icon: Info, color: 'text-gray-600 bg-gray-50' });
      }
    });
    
    return parsed;
  };

  const parsedReasons = parseReasons(matchReasons);
  const levelInfo = parsedReasons.find(r => r.type === 'level');
  const otherReasons = parsedReasons.filter(r => r.type !== 'level');

  // Check if all analysis items are a full match (all green V)
  const isFullMatch = analysisData && Array.isArray(analysisData) && analysisData.length > 0 &&
    analysisData.every(item => item.is_match === 'true' || item.is_match === true);

  // Get score color - GREEN ONLY if all requirements match (isFullMatch), otherwise ORANGE
  const getScoreColor = (score) => {
    // If full match (all green checkmarks) - show green background
    if (isFullMatch && score >= 80) return 'bg-green-100 text-green-800 border-green-300';
    
    // Otherwise - orange background for high scores (not perfect match)
    if (score >= 80) return 'bg-orange-100 text-orange-800 border-orange-300';
    if (score >= 60) return 'bg-blue-100 text-blue-800 border-blue-300';
    if (score >= 40) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-gray-100 text-gray-700 border-gray-300';
  };

  // Short preview for table cell
  const shortPreview = otherReasons.length > 0 
    ? otherReasons[0].text.substring(0, 25) + (otherReasons[0].text.length > 25 || otherReasons.length > 1 ? '...' : '')
    : 'לחץ לפרטים';

  return (
    <>
    {betterMatch && (
      <Dialog open={betterMatchOpen} onOpenChange={setBetterMatchOpen}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              התאמה טובה יותר קיימת
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm text-gray-700 space-y-2 pt-2">
            <p>יש התאמה טובה יותר למועמד זה:</p>
            <ul className="space-y-1 list-none">
              <li><span className="font-semibold">משרה:</span> {betterMatch.job_title}</li>
              <li><span className="font-semibold">מספר משרה:</span> {betterMatch.job_code || betterMatch.job_id}</li>
              <li><span className="font-semibold">סוכן:</span> {betterMatch.agent_name}</li>
              <li><span className="font-semibold">ציון:</span> {betterMatch.match_score}%</li>
            </ul>
          </div>
        </DialogContent>
      </Dialog>
    )}
    <div className="flex items-center gap-1">
      {betterMatch && (
        <button
          onClick={(e) => { e.stopPropagation(); setBetterMatchOpen(true); }}
          className="text-red-500 hover:text-red-700 flex-shrink-0"
          title="יש התאמה טובה יותר"
        >
          <AlertTriangle className="w-4 h-4" />
        </button>
      )}
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          className="h-auto p-1 flex items-center gap-1.5 hover:bg-gray-100 rounded-lg"
          title={shortPreview}
        >
          {matchScore != null && (
            <Badge className={`text-xs font-bold border ${getScoreColor(matchScore)}`}>
              {matchScore}%
            </Badge>
          )}
          {isFullMatch && (
            <span title="התאמה מלאה בכל דרישות המשרה">
              <BadgeCheck className="w-4 h-4 text-green-500 flex-shrink-0" />
            </span>
          )}
          <Info className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[500px] p-4" align="start">
        <div className="space-y-3">
          {/* Header with score */}
          <div className="flex items-center justify-between border-b pb-2">
            <h4 className="font-semibold text-sm">פירוט התאמה</h4>
            {matchScore != null && (
              <Badge className={`text-sm font-bold border ${getScoreColor(matchScore)}`}>
                ציון: {matchScore}%
              </Badge>
            )}
          </div>

          {/* Match level */}
          {levelInfo && (
            <div className="flex items-center gap-2 p-2 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200">
              <Star className="w-4 h-4 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800">רמת התאמה: {levelInfo.text}</span>
            </div>
          )}

          {/* Structured Analysis Table */}
          {analysisData && Array.isArray(analysisData) && analysisData.length > 0 ? (
            <ScrollArea className="h-64 rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px] text-right">דרישה</TableHead>
                    <TableHead className="text-right">התאמת המועמד</TableHead>
                    <TableHead className="w-[30px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analysisData.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-xs font-medium align-top">{item.requirement}</TableCell>
                      <TableCell className="text-xs text-gray-600 align-top">{item.candidate_qualification}</TableCell>
                      <TableCell className="align-top p-2">
                        {item.is_match === 'true' || item.is_match === true ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : item.is_match === 'partial' ? (
                          <AlertCircle className="w-4 h-4 text-yellow-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <>
              {/* Fallback to old detailed reasons display */}
              {otherReasons.length > 0 ? (
                <div className="space-y-2">
                  {otherReasons.map((reason, index) => {
                    const IconComponent = reason.icon;
                    return (
                      <div 
                        key={index} 
                        className={`flex items-start gap-2 p-2 rounded-lg ${reason.color || 'bg-gray-50'}`}
                      >
                        <IconComponent className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{reason.text}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-2">
                  אין פירוט נוסף זמין
                </p>
              )}
            </>
          )}

          {/* Raw reasons / Summary */}
          {matchReasons && (
            <div className="pt-2 border-t">
              <div className="bg-blue-50 p-2 rounded-lg text-xs text-blue-800 mb-2">
                <span className="font-bold">סיכום: </span>
                {matchReasons}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
    </div>
    </>
  );
}