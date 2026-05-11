import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { createPageUrl } from "@/utils";
import { Navigate } from "react-router-dom";
import { Users } from "lucide-react";

const GoogleIcon = (props) => (
  <svg viewBox="0 0 48 48" {...props} className="w-5 h-5 ml-3">
    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path>
    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path>
    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.222,0-9.657-3.356-11.303-8H6.306C9.656,39.663,16.318,44,24,44z"></path>
    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C39.999,35.588,44,30.168,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
  </svg>
);

export default function Home() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [systemVersion, setSystemVersion] = useState(null);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        
        sessionStorage.removeItem('requested_role');
      } catch (error) {
        console.log("Not logged in");
      }
      setLoading(false);
    };
    checkUser();
  }, []);

  useEffect(() => {
    const loadSystemVersion = async () => {
      try {
        const versions = await base44.entities.SystemVersion.list();
        if (versions.length > 0) {
          setSystemVersion(versions[0].version);
        }
      } catch (error) {
        console.log("Failed to load system version");
      }
    };
    loadSystemVersion();
  }, []);

  const handleLogin = async () => {
    await base44.auth.redirectToLogin();
  };

  const handleLogout = async () => {
    await base44.auth.logout();
    setUser(null);
    setAuthError("");
  };

  if (loading) {
    return <div className="h-screen w-screen flex items-center justify-center"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div></div>;
  }
  
  if (user) {
    return <Navigate to={createPageUrl("MainMenu")} />;
  }

  // Login page
  return (
    <div className="min-h-screen relative flex items-center justify-center p-6 overflow-hidden" dir="rtl">
      {/* Video Background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      >
        <source src="https://www.dropbox.com/scl/fi/tfzfuajxkoqr71j67w3pa/.mp4?rlkey=naegchq3g1tqsnpsx4cdotpad&st=3da23awe&dl=1" type="video/mp4" />
      </video>
      
      {/* Dark overlay for better text readability */}
      <div className="absolute inset-0 bg-black/40"></div>
      
      <div className="max-w-md w-full text-center relative z-10">
        <div className="mx-auto w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg">
          <Users className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-4xl font-bold text-white mb-2 drop-shadow-lg">PandaRecruitAI</h1>
        <p className="text-lg text-white/90 mb-3 drop-shadow">מערכת גיוס חכמה</p>
        <p className="text-sm text-white/70 mb-8 drop-shadow">By Pandatech</p>
        
        <div className="space-y-6 bg-white/95 backdrop-blur-sm p-8 rounded-lg shadow-xl border">
          <p className="text-lg text-gray-700 font-semibold">התחברות למערכת</p>
          <Button onClick={handleLogin} size="lg" className="w-full text-lg bg-white hover:bg-gray-50 border-gray-300 border text-gray-700">
            <GoogleIcon />
            התחברות באמצעות Google
          </Button>
          <p className="text-xs text-gray-500">
            אפשרויות התחברות נוספות יהיו זמינות בקרוב.
          </p>
        </div>
        
        <p className="text-sm text-white/80 mt-12 drop-shadow">
          רמת הגישה שלך תיקבע לפי ההרשאות שהוגדרו במערכת.
        </p>
        
        {systemVersion && (
          <p className="text-xs text-white/60 mt-4 drop-shadow">
            גרסה: {systemVersion}
          </p>
        )}
      </div>
    </div>
  );
}