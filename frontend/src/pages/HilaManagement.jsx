import React from 'react';
import HilaManagementComponent from '@/components/management/HilaManagement';

export default function HilaManagementPage() {
  return (
    <div className="p-4 md:p-8 space-y-6 text-right" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <img 
          src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face" 
          alt="הילה" 
          className="w-16 h-16 rounded-full object-cover border-4 border-pink-200 shadow-lg"
        />
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">הילה - הפצת משרות</h1>
          <p className="text-gray-600">ניהול משרות, חבר מביא חבר, והפצת משרות למועמדים</p>
        </div>
      </div>

      <HilaManagementComponent />
    </div>
  );
}