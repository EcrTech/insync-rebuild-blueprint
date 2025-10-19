import { ReactNode } from "react";
import logo from "@/assets/logo.png";
import backgroundImage from "@/assets/login-background.jpeg";

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
              className="w-[168px] h-[168px] object-contain transition-all duration-500 hover:scale-110 relative z-10" 
              style={{ 
                filter: 'drop-shadow(0 25px 50px rgba(0,0,0,0.4)) drop-shadow(0 15px 30px rgba(0,0,0,0.3)) drop-shadow(0 8px 16px rgba(0,0,0,0.25)) brightness(1.1) contrast(1.15)',
                transform: 'perspective(1200px) rotateX(8deg) translateZ(40px)',
              }} 
            />
            <div 
              className="absolute inset-0 -z-10 blur-2xl opacity-50"
              style={{
                background: 'radial-gradient(circle, rgba(1,184,170,0.4) 0%, transparent 70%)',
                transform: 'scale(1.2) translateY(20px)',
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