import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Code, Wrench, Award, Clock, GraduationCap, Shield } from 'lucide-react';

export default function CandidateTagsBadges({ candidate, showAll = false, maxTags = 5 }) {
  if (!candidate) return null;

  const languages = candidate.detected_languages || [];
  const tools = candidate.detected_tools || [];
  const skills = candidate.detected_skills || [];
  const yearsExp = candidate.years_experience;
  const educationLevel = candidate.education_level;
  const securityClearance = candidate.security_clearance;

  // Combine and limit tags
  const allTags = [];

  // Security clearance first if relevant
  if (securityClearance && securityClearance !== 'לא רלוונטי') {
    allTags.push({ type: 'security', value: securityClearance });
  }

  // Years of experience
  if (yearsExp && yearsExp > 0) {
    allTags.push({ type: 'experience', value: `${yearsExp} שנות ניסיון` });
  }

  // Education level
  if (educationLevel) {
    allTags.push({ type: 'education', value: educationLevel });
  }

  // Languages (limit to 3)
  languages.slice(0, 3).forEach(lang => {
    allTags.push({ type: 'language', value: lang });
  });

  // Tools (limit to 3)
  tools.slice(0, 3).forEach(tool => {
    allTags.push({ type: 'tool', value: tool });
  });

  // Skills (limit to 2)
  skills.slice(0, 2).forEach(skill => {
    allTags.push({ type: 'skill', value: skill });
  });

  const displayTags = showAll ? allTags : allTags.slice(0, maxTags);
  const remainingCount = allTags.length - displayTags.length;

  const getTagStyle = (type) => {
    switch (type) {
      case 'security':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'experience':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'education':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'language':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'tool':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'skill':
        return 'bg-cyan-100 text-cyan-800 border-cyan-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTagIcon = (type) => {
    switch (type) {
      case 'security':
        return <Shield className="w-3 h-3" />;
      case 'experience':
        return <Clock className="w-3 h-3" />;
      case 'education':
        return <GraduationCap className="w-3 h-3" />;
      case 'language':
        return <Code className="w-3 h-3" />;
      case 'tool':
        return <Wrench className="w-3 h-3" />;
      case 'skill':
        return <Award className="w-3 h-3" />;
      default:
        return null;
    }
  };

  if (displayTags.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {displayTags.map((tag, index) => (
        <Badge 
          key={`${tag.type}-${index}`} 
          variant="outline" 
          className={`text-xs flex items-center gap-1 ${getTagStyle(tag.type)}`}
        >
          {getTagIcon(tag.type)}
          {tag.value}
        </Badge>
      ))}
      {remainingCount > 0 && (
        <Badge variant="outline" className="text-xs bg-gray-50 text-gray-600">
          +{remainingCount}
        </Badge>
      )}
    </div>
  );
}