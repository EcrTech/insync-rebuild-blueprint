import { ReactNode } from "react";
import logo from "@/assets/logo.png";
import backgroundImage from "@/assets/login-background-new.jpeg";

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div 
      className="min-h-screen flex items-center justify-center px-4 py-8 bg-cover bg-center bg-no-repeat"
      style={{ 
        backgroundImage: `url(${backgroundImage})`,
      }}
    >
      {/* Overlay for better readability */}
      <div className="absolute inset-0 bg-background/40 backdrop-blur-sm" />
      
      {/* Login Form */}
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="relative inline-block mx-auto mb-6">
            <img 
              src={logo} 
              alt="In-Sync Logo" 
              className="w-[168px] h-[168px] object-contain transition-all duration-500 hover:scale-105 relative z-10" 
              style={{ 
                filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.15)) brightness(1.05)',
              }} 
            />
            <div 
              className="absolute inset-0 -z-10 blur-xl opacity-20"
              style={{
                background: 'radial-gradient(circle, rgba(1,184,170,0.3) 0%, transparent 70%)',
                transform: 'scale(1.1) translateY(10px)',
              }}
            />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">{title}</h2>
          {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
        </div>
        
        <div className="bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-lg p-8">
          {children}
        </div>
        
        <p className="text-center text-sm text-muted-foreground mt-8">
          © 2025 In-Sync. All rights reserved.
        </p>
      </div>
    </div>
  );
}