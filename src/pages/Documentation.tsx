import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BookOpen, 
  Database, 
  Code, 
  FileText, 
  Workflow,
  Shield,
  Zap
} from "lucide-react";

const Documentation = () => {
  const [activeSection, setActiveSection] = useState("overview");

  const sections = [
    { id: "overview", label: "System Overview", icon: BookOpen },
    { id: "architecture", label: "Architecture", icon: Workflow },
    { id: "database", label: "Database Schema", icon: Database },
    { id: "api", label: "API Reference", icon: Code },
    { id: "authentication", label: "Authentication", icon: Shield },
    { id: "integrations", label: "Integrations", icon: Zap },
    { id: "deployment", label: "Deployment", icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container py-6">
          <h1 className="text-3xl font-bold">Technical Documentation</h1>
          <p className="text-muted-foreground mt-2">
            Complete technical reference for the CRM system
          </p>
        </div>
      </div>

      <div className="container py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar Navigation */}
          <Card className="col-span-3 p-4 h-fit sticky top-6">
            <nav className="space-y-1">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      activeSection === section.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {section.label}
                  </button>
                );
              })}
            </nav>
          </Card>

          {/* Main Content */}
          <div className="col-span-9">
            <ScrollArea className="h-[calc(100vh-200px)]">
              {activeSection === "overview" && <SystemOverview />}
              {activeSection === "architecture" && <Architecture />}
              {activeSection === "database" && <DatabaseSchema />}
              {activeSection === "api" && <ApiReference />}
              {activeSection === "authentication" && <Authentication />}
              {activeSection === "integrations" && <Integrations />}
              {activeSection === "deployment" && <Deployment />}
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  );
};

const SystemOverview = () => (
  <div className="space-y-8">
    <div>
      <h2 className="text-2xl font-bold mb-4">System Overview</h2>
      <p className="text-muted-foreground mb-6">
        A comprehensive multi-tenant CRM platform built with React, TypeScript, and Supabase,
        designed for sales teams to manage contacts, communications, and campaigns.
      </p>
    </div>

    <Card className="p-6">
      <h3 className="text-xl font-semibold mb-4">Tech Stack</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="font-medium mb-2">Frontend</h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>• React 18.3</li>
            <li>• TypeScript</li>
            <li>• Vite</li>
            <li>• Tailwind CSS</li>
            <li>• shadcn/ui components</li>
            <li>• TanStack Query (React Query)</li>
            <li>• React Router v6</li>
          </ul>
        </div>
        <div>
          <h4 className="font-medium mb-2">Backend</h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>• Supabase (PostgreSQL)</li>
            <li>• Row Level Security (RLS)</li>
            <li>• Edge Functions (Deno)</li>
            <li>• Supabase Auth</li>
            <li>• Supabase Storage</li>
            <li>• Realtime subscriptions</li>
          </ul>
        </div>
      </div>
    </Card>

    <Card className="p-6">
      <h3 className="text-xl font-semibold mb-4">Core Modules</h3>
      <div className="space-y-4">
        {[
          {
            title: "Contact Management",
            desc: "Comprehensive contact database with custom fields, activities, and pipeline stages. Supports email/phone management, assignment, and filtering.",
            lines: "~3,500 LOC"
          },
          {
            title: "Communication Hub",
            desc: "Unified inbox for WhatsApp and Email communications. Template-based messaging with variable substitution.",
            lines: "~2,800 LOC"
          },
          {
            title: "Calling System",
            desc: "Exotel integration for outbound/inbound calling, call logging, recording, and dispositions with sub-dispositions.",
            lines: "~2,200 LOC"
          },
          {
            title: "Campaign Management",
            desc: "Bulk email and WhatsApp campaigns with recipient management, analytics, and AI-powered insights.",
            lines: "~3,100 LOC"
          },
          {
            title: "Forms & Connectors",
            desc: "Dynamic form builder with webhook integrations (IndiaMART, generic webhooks) and rate limiting.",
            lines: "~1,900 LOC"
          },
          {
            title: "User Management",
            desc: "Multi-tenant organization structure with role-based access control, teams, designations, and reporting hierarchy.",
            lines: "~2,400 LOC"
          },
          {
            title: "Analytics & Reports",
            desc: "Campaign performance tracking, call analytics, and AI-generated insights with trend visualization.",
            lines: "~1,600 LOC"
          }
        ].map((module) => (
          <div key={module.title} className="border-l-2 border-primary pl-4">
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-medium">{module.title}</h4>
              <span className="text-xs text-muted-foreground">{module.lines}</span>
            </div>
            <p className="text-sm text-muted-foreground">{module.desc}</p>
          </div>
        ))}
      </div>
    </Card>

    <Card className="p-6">
      <h3 className="text-xl font-semibold mb-4">Key Features</h3>
      <div className="grid grid-cols-2 gap-3">
        {[
          "Multi-tenant architecture",
          "Role-based access control",
          "Real-time data sync",
          "Custom field system",
          "Pipeline management",
          "Email campaigns",
          "WhatsApp campaigns",
          "Click-to-call (Exotel)",
          "Call recording & dispositions",
          "Template builder",
          "Webhook integrations",
          "AI-powered insights",
          "Activity timeline",
          "Advanced search & filters",
          "Export functionality",
          "Platform admin controls"
        ].map((feature) => (
          <div key={feature} className="flex items-center gap-2 text-sm">
            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
            {feature}
          </div>
        ))}
      </div>
    </Card>

    <Card className="p-6 bg-muted/50">
      <h3 className="text-xl font-semibold mb-4">Statistics</h3>
      <div className="grid grid-cols-4 gap-4 text-center">
        <div>
          <div className="text-3xl font-bold text-primary">~36.5K</div>
          <div className="text-sm text-muted-foreground">Lines of Code</div>
        </div>
        <div>
          <div className="text-3xl font-bold text-primary">150+</div>
          <div className="text-sm text-muted-foreground">Components</div>
        </div>
        <div>
          <div className="text-3xl font-bold text-primary">50+</div>
          <div className="text-sm text-muted-foreground">Database Tables</div>
        </div>
        <div>
          <div className="text-3xl font-bold text-primary">15+</div>
          <div className="text-sm text-muted-foreground">Edge Functions</div>
        </div>
      </div>
    </Card>
  </div>
);

const Architecture = () => (
  <div className="space-y-6">
    <h2 className="text-2xl font-bold">Architecture</h2>
    <p className="text-muted-foreground">Coming soon...</p>
  </div>
);

const DatabaseSchema = () => (
  <div className="space-y-6">
    <h2 className="text-2xl font-bold">Database Schema</h2>
    <p className="text-muted-foreground">Coming soon...</p>
  </div>
);

const ApiReference = () => (
  <div className="space-y-6">
    <h2 className="text-2xl font-bold">API Reference</h2>
    <p className="text-muted-foreground">Coming soon...</p>
  </div>
);

const Authentication = () => (
  <div className="space-y-6">
    <h2 className="text-2xl font-bold">Authentication</h2>
    <p className="text-muted-foreground">Coming soon...</p>
  </div>
);

const Integrations = () => (
  <div className="space-y-6">
    <h2 className="text-2xl font-bold">Integrations</h2>
    <p className="text-muted-foreground">Coming soon...</p>
  </div>
);

const Deployment = () => (
  <div className="space-y-6">
    <h2 className="text-2xl font-bold">Deployment</h2>
    <p className="text-muted-foreground">Coming soon...</p>
  </div>
);

export default Documentation;
