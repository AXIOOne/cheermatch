import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Admin imports
import { AdminLayout } from "./components/layout/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import Events from "./pages/admin/Events";
import ScoringTemplates from "./pages/admin/ScoringTemplates";
import Divisions from "./pages/admin/Divisions";
import Teams from "./pages/admin/Teams";
import Judges from "./pages/admin/Judges";
import Settings from "./pages/admin/Settings";
import ReviewRequests from "./pages/admin/ReviewRequests";
import UserRoles from "./pages/admin/UserRoles";
import Submissions from "./pages/admin/Submissions";
import EventRegistrations from "./pages/admin/EventRegistrations";
import EventScoring from "./pages/admin/EventScoring";
import EventResults from "./pages/admin/EventResults";
import EventParticipants from "./pages/admin/EventParticipants";
import EventReports from "./pages/admin/EventReports";
import EventsSummary from "./pages/admin/EventsSummary";
import Rubrics from "./pages/admin/Rubrics";
import SubmissionScoresheet from "./pages/admin/SubmissionScoresheet";

// Judge imports
import { JudgeLayout } from "./components/layout/JudgeLayout";
import JudgeDashboard from "./pages/judge/Dashboard";
import ScoringQueue from "./pages/judge/ScoringQueue";
import ScorePerformance from "./pages/judge/ScorePerformance";
import ScoreHistory from "./pages/judge/ScoreHistory";

// Public review
import ScoreReview from "./pages/review/ScoreReview";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            
            {/* Admin Routes */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="events" element={<Events />} />
              <Route path="events/summary" element={<EventsSummary />} />
              <Route path="events/:eventId/registrations" element={<EventRegistrations />} />
              <Route path="events/:eventId/scoring" element={<EventScoring />} />
              <Route path="events/:eventId/results" element={<EventResults />} />
              <Route path="events/:eventId/participants" element={<EventParticipants />} />
              <Route path="events/:eventId/reports" element={<EventReports />} />
              <Route path="scoring" element={<ScoringTemplates />} />
              <Route path="rubrics" element={<Rubrics />} />
              <Route path="divisions" element={<Divisions />} />
              <Route path="teams" element={<Teams />} />
              <Route path="submissions" element={<Submissions />} />
              <Route path="judges" element={<Judges />} />
              <Route path="reviews" element={<ReviewRequests />} />
              <Route path="roles" element={<UserRoles />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            
            {/* Judge Routes */}
            <Route path="/judge" element={<JudgeLayout />}>
              <Route index element={<JudgeDashboard />} />
              <Route path="queue" element={<ScoringQueue />} />
              <Route path="score/:submissionId" element={<ScorePerformance />} />
              <Route path="history" element={<ScoreHistory />} />
            </Route>
            
            {/* Public Review Route (no auth required) */}
            <Route path="/review/:token" element={<ScoreReview />} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
