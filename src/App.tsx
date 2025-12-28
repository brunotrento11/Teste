import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AccessibilityProvider } from "@/contexts/AccessibilityContext";
import Index from "./pages/Index";
import Consent from "./pages/Consent";
import Register from "./pages/Register";
import Verify from "./pages/Verify";
import Profiling from "./pages/Profiling";
import AddInvestments from "./pages/AddInvestments";
import ProfileResult from "./pages/ProfileResult";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import Login from "./pages/Login";
import Settings from "./pages/Settings";
import TestSearch from "./pages/TestSearch";
import AssetQualityValidation from "./pages/admin/AssetQualityValidation";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AccessibilityProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/consent" element={<Consent />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify" element={<Verify />} />
            <Route path="/profiling" element={<Profiling />} />
            <Route path="/add-investments" element={<AddInvestments />} />
            <Route path="/profile-result" element={<ProfileResult />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/login" element={<Login />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/test-search" element={<TestSearch />} />
            <Route path="/admin/asset-quality-validation" element={<AssetQualityValidation />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AccessibilityProvider>
  </QueryClientProvider>
);

export default App;
