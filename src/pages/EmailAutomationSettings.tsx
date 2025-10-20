import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BusinessHoursConfig } from "@/components/EmailAutomation/BusinessHoursConfig";
import { SuppressionListManager } from "@/components/EmailAutomation/SuppressionListManager";
import { Clock, Ban, Settings } from "lucide-react";

export default function EmailAutomationSettings() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8" />
        <div>
          <h1 className="text-3xl font-bold">Email Automation Settings</h1>
          <p className="text-muted-foreground">
            Configure advanced features for your email automation
          </p>
        </div>
      </div>

      <Tabs defaultValue="business-hours" className="space-y-6">
        <TabsList>
          <TabsTrigger value="business-hours">
            <Clock className="mr-2 h-4 w-4" />
            Business Hours
          </TabsTrigger>
          <TabsTrigger value="suppression">
            <Ban className="mr-2 h-4 w-4" />
            Suppression List
          </TabsTrigger>
        </TabsList>

        <TabsContent value="business-hours">
          <BusinessHoursConfig />
        </TabsContent>

        <TabsContent value="suppression">
          <SuppressionListManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
