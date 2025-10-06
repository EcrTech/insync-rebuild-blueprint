import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function PlatformAdminBanner() {
  const [impersonation, setImpersonation] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkImpersonation = () => {
      const data = sessionStorage.getItem("platform_admin_impersonation");
      if (data) {
        setImpersonation(JSON.parse(data));
      }
    };

    checkImpersonation();
    // Check every second in case it changes
    const interval = setInterval(checkImpersonation, 1000);
    return () => clearInterval(interval);
  }, []);

  const exitImpersonation = () => {
    sessionStorage.removeItem("platform_admin_impersonation");
    setImpersonation(null);
    navigate("/platform-admin");
  };

  if (!impersonation) return null;

  return (
    <Alert className="rounded-none border-x-0 border-t-0 bg-orange-500 text-white border-orange-600">
      <AlertCircle className="h-4 w-4 text-white" />
      <AlertDescription className="flex items-center justify-between">
        <span>
          <strong>Platform Admin Mode:</strong> You are accessing <strong>{impersonation.org_name}</strong>
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={exitImpersonation}
          className="text-white hover:text-white hover:bg-orange-600"
        >
          <X className="h-4 w-4 mr-2" />
          Exit Organization
        </Button>
      </AlertDescription>
    </Alert>
  );
}
