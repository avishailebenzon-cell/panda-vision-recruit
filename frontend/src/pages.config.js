/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AccessLog from './pages/AccessLog';
import AgentSettings from './pages/AgentSettings';
import AgentsGuide from './pages/AgentsGuide';
import AlikPage from './pages/AlikPage';
import CandidateOnboarding from './pages/CandidateOnboarding';
import Candidates from './pages/Candidates';
import CommandCenter from './pages/CommandCenter';
import DanaManagement from './pages/DanaManagement';
import Dashboard from './pages/Dashboard';
import DganitPage from './pages/DganitPage';
import EitanManagement from './pages/EitanManagement';
import EladPage from './pages/EladPage';
import FeedbackReport from './pages/FeedbackReport';
import GcPage from './pages/GcPage';
import Help from './pages/Help';
import HilaManagement from './pages/HilaManagement';
import Home from './pages/Home';
import InbarManagement from './pages/InbarManagement';
import ItayPage from './pages/ItayPage';
import Jobs from './pages/Jobs';
import LiorPage from './pages/LiorPage';
import MainMenu from './pages/MainMenu';
import Management from './pages/Management';
import Matches from './pages/Matches';
import MeniPage from './pages/MeniPage';
import NaamaPage from './pages/NaamaPage';
import OfirPage from './pages/OfirPage';
import RamiPage from './pages/RamiPage';

import RotemPage from './pages/RotemPage';
import Search from './pages/Search';
import Unsubscribe from './pages/Unsubscribe';
import UserTasksCenter from './pages/UserTasksCenter';
import Chafshanim from './pages/Chafshanim';
import PipedriveSyncReport from './pages/PipedriveSyncReport';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AccessLog": AccessLog,
    "AgentSettings": AgentSettings,
    "AgentsGuide": AgentsGuide,
    "AlikPage": AlikPage,
    "CandidateOnboarding": CandidateOnboarding,
    "Candidates": Candidates,
    "CommandCenter": CommandCenter,
    "DanaManagement": DanaManagement,
    "Dashboard": Dashboard,
    "DganitPage": DganitPage,
    "EitanManagement": EitanManagement,
    "EladPage": EladPage,
    "FeedbackReport": FeedbackReport,
    "GcPage": GcPage,
    "Help": Help,
    "HilaManagement": HilaManagement,
    "Home": Home,
    "InbarManagement": InbarManagement,
    "ItayPage": ItayPage,
    "Jobs": Jobs,
    "LiorPage": LiorPage,
    "MainMenu": MainMenu,
    "Management": Management,
    "Matches": Matches,
    "MeniPage": MeniPage,
    "NaamaPage": NaamaPage,
    "OfirPage": OfirPage,
    "RamiPage": RamiPage,

    "RotemPage": RotemPage,
    "Search": Search,
    "Unsubscribe": Unsubscribe,
    "UserTasksCenter": UserTasksCenter,
    "Chafshanim": Chafshanim,
    "PipedriveSyncReport": PipedriveSyncReport,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};