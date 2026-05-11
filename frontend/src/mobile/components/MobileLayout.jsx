import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export default function MobileLayout({ children, currentPageName }) {
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleExitMobile = () => {
    localStorage.removeItem('forcedViewMode');
    window.location.href = '/Home';
  };

  const mobileMenuItems = [
    { name: "🏠 בית", path: "/MobileHome" },
    { name: "👑 כרמית", path: "/MobileDashboard" },
    { name: "💻 נעמה", path: "/MobileNaamaPage" },
    { name: "🔴 רמי", path: "/MobileRamiPage" },
    { name: "⚙️ אליק", path: "/MobileAlikPage" },
    { name: "💾 איתי", path: "/MobileItayPage" },
    { name: "🔧 ליאור", path: "/MobileLiorPage" },
    { name: "🛠️ אופיר", path: "/MobileOfirPage" },
    { name: "🧪 דגנית", path: "/MobileDganitPage" },
    { name: "💎 ג.סי", path: "/MobileGcPage" },
  ];

  const navigateTo = (path) => {
    navigate(path);
    setSheetOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <style>{`.b44-edit-badge { display: none !important; }`}</style>
      
      {/* Mobile Header */}
      <header className="bg-white border-b border-gray-200 p-3 sticky top-0 z-40 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          {/* Menu Button */}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64 p-0">
              <SheetHeader className="border-b p-4">
                <SheetTitle className="text-right">תפריט ניווט</SheetTitle>
              </SheetHeader>
              <nav className="mt-4 space-y-1 p-4">
                {mobileMenuItems.map(item => (
                  <Button
                    key={item.path}
                    variant="ghost"
                    className="w-full justify-start text-right text-base h-12"
                    onClick={() => navigateTo(item.path)}
                  >
                    {item.name}
                  </Button>
                ))}
                <div className="border-t my-4 pt-4">
                  <Button
                    variant="outline"
                    className="w-full justify-start text-right text-red-600 border-red-200 hover:bg-red-50 h-12"
                    onClick={handleExitMobile}
                  >
                    ← חזור לגרסה רגילה
                  </Button>
                </div>
              </nav>
            </SheetContent>
          </Sheet>

          {/* Title */}
          <div className="flex-1 text-center">
            <h1 className="text-lg font-bold text-gray-800">HRAI Mobile</h1>
          </div>

          {/* Spacer */}
          <div className="w-10" />
        </div>
      </header>

      {/* Main Content */}
      <main className="p-3 pb-20">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-2">
        <div className="flex justify-around gap-1">
          {mobileMenuItems.map(item => (
            <Button
              key={item.path}
              variant={currentPageName === item.path ? "default" : "ghost"}
              size="sm"
              className="flex-1 text-xs h-12"
              onClick={() => navigateTo(item.path)}
            >
              {item.name.split(' ')[0]}
            </Button>
          ))}
        </div>
      </nav>
    </div>
  );
}