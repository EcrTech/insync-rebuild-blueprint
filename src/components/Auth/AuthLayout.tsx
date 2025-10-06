import { ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/20 to-primary/5 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-primary mb-2">In-Sync</h1>
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
  );
}