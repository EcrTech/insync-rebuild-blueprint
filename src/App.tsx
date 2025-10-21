import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import TechAdmin from "./pages/TechAdmin";
import ReportBuilder from "./pages/ReportBuilder";
import SavedReports from "./pages/SavedReports";
import PipelineStages from "./pages/PipelineStages";
import CallDispositions from "./pages/CallDispositions";
import Users from "./pages/Users";
import Teams from "./pages/Teams";
import Contacts from "./pages/Contacts";
import ContactDetail from "./pages/ContactDetail";
import PipelineBoard from "./pages/PipelineBoard";
import PipelineAdvancedSearch from "./pages/PipelineAdvancedSearch";
import Reports from "./pages/Reports";
import ApprovalMatrix from "./pages/ApprovalMatrix";
import Designations from "./pages/Designations";
import OrgChart from "./pages/OrgChart";
import CustomFields from "./pages/CustomFields";
import Forms from "./pages/Forms";
import Connectors from "./pages/Connectors";
import CallingDashboard from "./pages/CallingDashboard";
import CallLogs from "./pages/CallLogs";
import ExotelSettings from "./pages/ExotelSettings";
import PublicForm from "./pages/PublicForm";
import PlatformAdmin from "./pages/PlatformAdmin";
import WhatsAppSettings from "./pages/WhatsAppSettings";
import Templates from "./pages/Templates";
import TemplateBuilder from "./pages/TemplateBuilder";
import WhatsAppDashboard from "./pages/WhatsAppDashboard";
import BulkWhatsAppSender from "./pages/BulkWhatsAppSender";
import EmailSettings from "./pages/EmailSettings";
import WhatsAppCampaigns from "./pages/WhatsAppCampaigns";
import WhatsAppCampaignDetail from "./pages/WhatsAppCampaignDetail";
import QueueStatus from "./pages/QueueStatus";
import Communications from "./pages/Communications";
import BulkEmailSender from "./pages/BulkEmailSender";
import EmailCampaigns from "./pages/EmailCampaigns";
import EmailCampaignDetail from "./pages/EmailCampaignDetail";
import EmailAutomations from "./pages/EmailAutomations";
import EmailAutomationSettings from "./pages/EmailAutomationSettings";
import CampaignOverview from "./pages/Campaigns/CampaignOverview";
import AIInsightsDashboard from "./pages/Campaigns/AIInsightsDashboard";
import Documentation from "./pages/Documentation";
import RedefineDataRepository from "./pages/RedefineDataRepository";
import Subscriptions from "./pages/Subscriptions";
import CommunicationSettings from "./pages/CommunicationSettings";
import Inventory from "./pages/Inventory";
import ApiKeys from "./pages/ApiKeys";
import GoogleCalendarCallback from "./pages/GoogleCalendarCallback";
import ProtectedRoute from "./components/Auth/ProtectedRoute";

const App = () => (
  <TooltipProvider>
    <Toaster />
    <Sonner />
    <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/form/:formId" element={<PublicForm />} />
          <Route path="/google-calendar-callback" element={<GoogleCalendarCallback />} />
          
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
          
          <Route path="/pipeline/advanced-search" element={
            <ProtectedRoute>
              <PipelineAdvancedSearch />
            </ProtectedRoute>
          } />
          
          <Route path="/reports" element={
            <ProtectedRoute>
              <Reports />
            </ProtectedRoute>
          } />
          
          <Route path="/calling-dashboard" element={
            <ProtectedRoute>
              <CallingDashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/call-logs" element={
            <ProtectedRoute>
              <CallLogs />
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
          
          <Route path="/admin/forms" element={
            <ProtectedRoute requiredRole="admin">
              <Forms />
            </ProtectedRoute>
          } />
          
          <Route path="/admin/connectors" element={
            <ProtectedRoute requiredRole="admin">
              <Connectors />
            </ProtectedRoute>
          } />
          
          <Route path="/admin/api-keys" element={
            <ProtectedRoute requiredRole="admin">
              <ApiKeys />
            </ProtectedRoute>
          } />
          
          <Route path="/org-chart" element={
            <ProtectedRoute>
              <OrgChart />
            </ProtectedRoute>
          } />
          
          <Route path="/platform-admin" element={
            <ProtectedRoute>
              <PlatformAdmin />
            </ProtectedRoute>
          } />
          
          <Route path="/admin/communication-settings" element={
            <ProtectedRoute requiredRole="admin">
              <CommunicationSettings />
            </ProtectedRoute>
          } />
          
          <Route path="/whatsapp-settings" element={
            <ProtectedRoute requiredRole="admin">
              <WhatsAppSettings />
            </ProtectedRoute>
          } />
          
          <Route path="/templates" element={
            <ProtectedRoute>
              <Templates />
            </ProtectedRoute>
          } />
          
          <Route path="/templates/create" element={
            <ProtectedRoute>
              <TemplateBuilder />
            </ProtectedRoute>
          } />
          
          <Route path="/whatsapp-messages" element={
            <ProtectedRoute>
              <WhatsAppDashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/whatsapp/bulk-send" element={
            <ProtectedRoute>
              <BulkWhatsAppSender />
            </ProtectedRoute>
          } />
          
          <Route path="/whatsapp/campaigns" element={
            <ProtectedRoute>
              <WhatsAppCampaigns />
            </ProtectedRoute>
          } />
          
          <Route path="/whatsapp/campaigns/:id" element={
            <ProtectedRoute>
              <WhatsAppCampaignDetail />
            </ProtectedRoute>
          } />
          
          <Route path="/queue-status" element={
            <ProtectedRoute>
              <QueueStatus />
            </ProtectedRoute>
          } />
          
          <Route path="/communications" element={
            <ProtectedRoute>
              <Communications />
            </ProtectedRoute>
          } />
          
          <Route path="/bulk-email" element={
            <ProtectedRoute>
              <BulkEmailSender />
            </ProtectedRoute>
          } />
          
          <Route path="/email-campaigns" element={
            <ProtectedRoute>
              <EmailCampaigns />
            </ProtectedRoute>
          } />
          
          <Route path="/email-campaigns/:id" element={
            <ProtectedRoute>
              <EmailCampaignDetail />
            </ProtectedRoute>
          } />
          
          <Route path="/email-automations" element={
            <ProtectedRoute requiredRole="admin">
              <EmailAutomations />
            </ProtectedRoute>
          } />
          
          <Route path="/email-automations/settings" element={
            <ProtectedRoute requiredRole="admin">
              <EmailAutomationSettings />
            </ProtectedRoute>
          } />
          
          <Route path="/campaigns/overview" element={
            <ProtectedRoute>
              <CampaignOverview />
            </ProtectedRoute>
          } />
          
          <Route path="/campaigns/insights" element={
            <ProtectedRoute>
              <AIInsightsDashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/documentation" element={
            <ProtectedRoute>
              <Documentation />
            </ProtectedRoute>
          } />
          
          <Route path="/redefine-repository" element={
            <ProtectedRoute>
              <RedefineDataRepository />
            </ProtectedRoute>
          } />
          
          <Route path="/inventory" element={
            <ProtectedRoute>
              <Inventory />
            </ProtectedRoute>
          } />
          
          <Route path="/reports/builder" element={
            <ProtectedRoute>
              <ReportBuilder />
            </ProtectedRoute>
          } />
          
          <Route path="/reports/saved" element={
            <ProtectedRoute>
              <SavedReports />
            </ProtectedRoute>
          } />
          
          <Route path="/platform-admin/subscriptions" element={
            <ProtectedRoute>
              <Subscriptions />
            </ProtectedRoute>
          } />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
);

export default App;
