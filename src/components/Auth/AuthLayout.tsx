import { ReactNode } from "react";
import logo from "@/assets/logo.png";
import teamHustle from "@/assets/team-hustle.png";

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex">
      {/* Left Side - Image and Caption */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/10 via-muted/20 to-accent/10 flex-col items-center justify-center p-12">
        <div className="max-w-xl text-center space-y-8">
          <h1 className="text-4xl font-bold text-foreground leading-tight">
            Level up your hustle! Call, connect, and conquer with the CRM that's got all the vibes!
          </h1>
          <img 
            src={teamHustle} 
            alt="Team collaboration" 
            className="w-full max-w-lg mx-auto object-contain"
          />
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-background px-4 py-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <img src={logo} alt="In-Sync Logo" className="h-24 mx-auto mb-6 object-contain" />
            <h2 className="text-2xl font-bold text-foreground mb-2">{title}</h2>
            {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
          </div>
          
          <div className="bg-card border border-border rounded-lg shadow-lg p-8">
            {children}
          </div>
          
          <p className="text-center text-sm text-muted-foreground mt-8">
            © 2025 In-Sync. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}