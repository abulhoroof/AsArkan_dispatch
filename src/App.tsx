import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import { ViewModeProvider } from "@/contexts/ViewModeContext";
import { ActingAsProvider } from "@/contexts/ActingAsContext";
import { ActingAsBanner } from "@/components/ActingAsBanner";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ChatButton } from "@/components/DispatchChat";

// Lazy load pages for code splitting
const Login = lazy(() => import("./pages/Login"));
const SetPassword = lazy(() => import("./pages/SetPassword"));
const Index = lazy(() => import("./pages/Index"));
const Trucks = lazy(() => import("./pages/Trucks"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ImportZipCodes = lazy(() => import("./pages/ImportZipCodes"));
const AdminAnalytics = lazy(() => import("./pages/AdminAnalytics"));
const MultiOrgDiagnostics = lazy(() => import("./pages/MultiOrgDiagnostics"));
const DriverTransactions = lazy(() => import("./pages/DriverTransactions"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <OrganizationProvider>
          <SettingsProvider>
            <ViewModeProvider>
              <ActingAsProvider>
              <ActingAsBanner />
              <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/set-password" element={<SetPassword />} />
                <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                <Route path="/trucks" element={<ProtectedRoute><Trucks /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/analytics" element={<ProtectedRoute><AdminAnalytics /></ProtectedRoute>} />
                <Route path="/import-zip-codes" element={<ProtectedRoute><ImportZipCodes /></ProtectedRoute>} />
                <Route path="/diagnostics" element={<ProtectedRoute><MultiOrgDiagnostics /></ProtectedRoute>} />
                <Route path="/transactions" element={<ProtectedRoute><DriverTransactions /></ProtectedRoute>} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              <ChatButton />
              </Suspense>
              </ActingAsProvider>
            </ViewModeProvider>
          </SettingsProvider>
        </OrganizationProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
