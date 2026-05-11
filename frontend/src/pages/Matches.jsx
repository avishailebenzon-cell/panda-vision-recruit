import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Circle, Code, Cpu, Settings, Wrench, Monitor, Zap, Archive } from 'lucide-react';

export default function MatchesPage() {
  const agents = [
    {
      name: 'נעמה',
      title: 'מומחית תוכנה',
      description: 'התאמות למשרות תוכנה ופיתוח',
      path: createPageUrl('NaamaPage'),
      color: 'orange',
      icon: Code,
      image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop&crop=face'
    },
    {
      name: 'רועי',
      title: 'מומחה משרות',
      description: 'חיפוש משרות מתאימות למועמדים',
      path: createPageUrl('RoeePage'),
      color: 'blue',
      icon: Circle,
      image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=face'
    },
    {
      name: 'רמי',
      title: 'מומחה רמה 1',
      description: 'התאמות למשרות בסיווג רמה 1',
      path: createPageUrl('RamiPage'),
      color: 'red',
      icon: Zap,
      image: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=80&h=80&fit=crop&crop=face'
    },
    {
      name: 'אליק',
      title: 'מומחה אלקטרוניקה',
      description: 'התאמות למשרות אלקטרוניקה וחומרה',
      path: createPageUrl('AlikPage'),
      color: 'teal',
      icon: Cpu,
      image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&crop=face'
    },
    {
      name: 'איתי',
      title: 'מומחה IT',
      description: 'התאמות למשרות IT ותשתיות',
      path: createPageUrl('ItayPage'),
      color: 'indigo',
      icon: Monitor,
      image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=80&h=80&fit=crop&crop=face'
    },
    {
      name: 'ליאור',
      title: 'מומחה הנדסת מערכת',
      description: 'התאמות למשרות הנדסת מערכת',
      path: createPageUrl('LiorPage'),
      color: 'amber',
      icon: Settings,
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=face'
    },
    {
      name: 'אופיר',
      title: 'מומחה הנדסת מכונות',
      description: 'התאמות למשרות הנדסת מכונות',
      path: createPageUrl('OfirPage'),
      color: 'emerald',
      icon: Wrench,
      image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=face'
    },
    {
      name: 'GC',
      title: 'סוכן כללי',
      description: 'Garbage Collector - משרות לא מסווגות',
      path: createPageUrl('GcPage'),
      color: 'gray',
      icon: Archive,
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=face'
    }
  ];

  const colorClasses = {
    orange: {
      gradient: 'from-orange-50 to-amber-50',
      border: 'border-orange-200',
      hover: 'hover:border-orange-400',
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-600'
    },
    blue: {
      gradient: 'from-blue-50 to-cyan-50',
      border: 'border-blue-200',
      hover: 'hover:border-blue-400',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600'
    },
    red: {
      gradient: 'from-red-50 to-pink-50',
      border: 'border-red-200',
      hover: 'hover:border-red-400',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600'
    },
    teal: {
      gradient: 'from-teal-50 to-cyan-50',
      border: 'border-teal-200',
      hover: 'hover:border-teal-400',
      iconBg: 'bg-teal-100',
      iconColor: 'text-teal-600'
    },
    indigo: {
      gradient: 'from-indigo-50 to-purple-50',
      border: 'border-indigo-200',
      hover: 'hover:border-indigo-400',
      iconBg: 'bg-indigo-100',
      iconColor: 'text-indigo-600'
    },
    amber: {
      gradient: 'from-amber-50 to-yellow-50',
      border: 'border-amber-200',
      hover: 'hover:border-amber-400',
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600'
    },
    emerald: {
      gradient: 'from-emerald-50 to-green-50',
      border: 'border-emerald-200',
      hover: 'hover:border-emerald-400',
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600'
    },
    gray: {
      gradient: 'from-gray-50 to-slate-50',
      border: 'border-gray-300',
      hover: 'hover:border-gray-400',
      iconBg: 'bg-gray-100',
      iconColor: 'text-gray-600'
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">חדר הגייסות</h1>
        <p className="text-gray-600">בחר את הסוכן המתאים לצפייה בהתאמות</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map(agent => {
          const Icon = agent.icon;
          const colors = colorClasses[agent.color];
          
          return (
            <Link key={agent.name} to={agent.path}>
              <Card className={`bg-gradient-to-r ${colors.gradient} ${colors.border} ${colors.hover} transition-all cursor-pointer hover:shadow-lg`}>
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <img 
                      src={agent.image}
                      alt={agent.name}
                      className={`w-16 h-16 rounded-full object-cover border-4 ${colors.border} shadow-lg`}
                    />
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {agent.name}
                        <div className={`w-8 h-8 ${colors.iconBg} rounded-lg flex items-center justify-center`}>
                          <Icon className={`w-4 h-4 ${colors.iconColor}`} />
                        </div>
                      </CardTitle>
                      <p className="text-sm font-semibold text-gray-700 mt-1">
                        {agent.title}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">
                    {agent.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}