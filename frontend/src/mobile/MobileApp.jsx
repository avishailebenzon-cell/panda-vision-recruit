import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MobileLayout from './components/MobileLayout';
import MobileHome from './pages/MobileHome';
import MobileDashboard from './pages/MobileDashboard';
import MobileNaamaPage from './pages/MobileNaamaPage';
import MobileRamiPage from './pages/MobileRamiPage';
import MobileAlikPage from './pages/MobileAlikPage';
import MobileItayPage from './pages/MobileItayPage';
import MobileLiorPage from './pages/MobileLiorPage';
import MobileOfirPage from './pages/MobileOfirPage';
import MobileDganitPage from './pages/MobileDganitPage';
import MobileGcPage from './pages/MobileGcPage';

export default function MobileApp() {
  return (
    <Router>
      <Routes>
      <Route path="/" element={<Navigate to="/MobileHome" replace />} />
      <Route path="/MobileHome" element={<MobileLayout currentPageName="MobileHome"><MobileHome /></MobileLayout>} />
      <Route path="/MobileDashboard" element={<MobileLayout currentPageName="MobileDashboard"><MobileDashboard /></MobileLayout>} />
      <Route path="/MobileNaamaPage" element={<MobileLayout currentPageName="MobileNaamaPage"><MobileNaamaPage /></MobileLayout>} />
      <Route path="/MobileRamiPage" element={<MobileLayout currentPageName="MobileRamiPage"><MobileRamiPage /></MobileLayout>} />
      <Route path="/MobileAlikPage" element={<MobileLayout currentPageName="MobileAlikPage"><MobileAlikPage /></MobileLayout>} />
      <Route path="/MobileItayPage" element={<MobileLayout currentPageName="MobileItayPage"><MobileItayPage /></MobileLayout>} />
      <Route path="/MobileLiorPage" element={<MobileLayout currentPageName="MobileLiorPage"><MobileLiorPage /></MobileLayout>} />
      <Route path="/MobileOfirPage" element={<MobileLayout currentPageName="MobileOfirPage"><MobileOfirPage /></MobileLayout>} />
      <Route path="/MobileDganitPage" element={<MobileLayout currentPageName="MobileDganitPage"><MobileDganitPage /></MobileLayout>} />
      <Route path="/MobileGcPage" element={<MobileLayout currentPageName="MobileGcPage"><MobileGcPage /></MobileLayout>} />
      </Routes>
    </Router>
  );
}