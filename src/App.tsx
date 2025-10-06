import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import Dashboard from "./pages/Dashboard";
import TechAdmin from "./pages/TechAdmin";
import PipelineStages from "./pages/PipelineStages";
import CallDispositions from "./pages/CallDispositions";
import Users from "./pages/Users";
import Teams from "./pages/Teams";
import Contacts from "./pages/Contacts";
import ContactDetail from "./pages/ContactDetail";
import PipelineBoard from "./pages/PipelineBoard";
import Reports from "./pages/Reports";
import ApprovalMatrix from "./pages/ApprovalMatrix";
import Designations from "./pages/Designations";
import OrgChart from "./pages/OrgChart";
import CustomFields from "./pages/CustomFields";
import ProtectedRoute from "./components/Auth/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/contacts" element={
            <ProtectedRoute>
              <Contacts />
            </ProtectedRoute>
          } />
          
          <Route path="/contacts/:id" element={
            <ProtectedRoute>
              <ContactDetail />
            </ProtectedRoute>
          } />
          
          <Route path="/pipeline" element={
            <ProtectedRoute>
              <PipelineBoard />
            </ProtectedRoute>
          } />
          
          <Route path="/reports" element={
            <ProtectedRoute>
              <Reports />
            </ProtectedRoute>
          } />
          
          <Route path="/users" element={
            <ProtectedRoute requiredRole="admin">
              <Users />
            </ProtectedRoute>
          } />
          
          <Route path="/teams" element={
            <ProtectedRoute requiredRole="admin">
              <Teams />
            </ProtectedRoute>
          } />
          
          <Route path="/admin" element={
            <ProtectedRoute requiredRole="admin">
              <TechAdmin />
            </ProtectedRoute>
          } />
          
          <Route path="/admin/pipeline-stages" element={
            <ProtectedRoute requiredRole="admin">
              <PipelineStages />
            </ProtectedRoute>
          } />
          
          <Route path="/admin/call-dispositions" element={
            <ProtectedRoute requiredRole="admin">
              <CallDispositions />
            </ProtectedRoute>
          } />
          
          <Route path="/admin/approval-matrix" element={
            <ProtectedRoute requiredRole="admin">
              <ApprovalMatrix />
            </ProtectedRoute>
          } />
          
          <Route path="/admin/designations" element={
            <ProtectedRoute requiredRole="admin">
              <Designations />
            </ProtectedRoute>
          } />
          
          <Route path="/admin/custom-fields" element={
            <ProtectedRoute requiredRole="admin">
              <CustomFields />
            </ProtectedRoute>
          } />
          
          <Route path="/org-chart" element={
            <ProtectedRoute>
              <OrgChart />
            </ProtectedRoute>
          } />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
