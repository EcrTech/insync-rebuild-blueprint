import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, DollarSign, Users, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function PlatformAdminSubscriptions() {
  const { toast } = useToast();
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [overrideUntil, setOverrideUntil] = useState("");

  const { data: subscriptions, isLoading, refetch } = useQuery({
    queryKey: ["platform-admin-subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_subscriptions")
        .select(`
          *,
          organizations!inner(id, name, slug)
        `)
        .order("subscription_status", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const { data: invoices } = useQuery({
    queryKey: ["platform-admin-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_invoices")
        .select(`
          *,
          organizations!inner(name)
        `)
        .in("payment_status", ["pending", "overdue"])
        .order("due_date", { ascending: true })
        .limit(10);
      
      if (error) throw error;
      return data;
    },
  });

  const handleOverrideSubscription = async () => {
    if (!selectedOrg || !overrideUntil) return;

    try {
      const { error } = await supabase
        .from("organization_subscriptions")
        .update({
          suspension_override_until: overrideUntil,
          subscription_status: "active",
        })
        .eq("org_id", selectedOrg);

      if (error) throw error;

      toast({
        title: "Override applied",
        description: "Subscription status has been temporarily overridden",
      });

      setSelectedOrg(null);
      setOverrideUntil("");
      refetch();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      suspended_grace: "secondary",
      suspended_readonly: "destructive",
      suspended_locked: "destructive",
      cancelled: "outline",
    };
    return <Badge variant={variants[status] || "default"}>{status.replace(/_/g, " ")}</Badge>;
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Subscription Management</h1>
        <p className="text-muted-foreground">Platform admin view of all organization subscriptions</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Organizations</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subscriptions?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {subscriptions?.filter(s => s.subscription_status === "active").length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suspended</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {subscriptions?.filter(s => s.subscription_status?.startsWith("suspended")).length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Invoices</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {invoices?.filter(i => i.payment_status === "overdue").length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Subscriptions</CardTitle>
          <CardDescription>Manage organization subscriptions and overrides</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {subscriptions?.map((sub: any) => (
              <div
                key={sub.org_id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="space-y-1">
                  <p className="font-medium">{sub.organizations.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Users: {sub.user_count} | Monthly: ₹{sub.monthly_subscription_amount} | Wallet: ₹{sub.wallet_balance}
                  </p>
                  {sub.suspension_override_until && (
                    <p className="text-xs text-amber-600">
                      Override until: {sub.suspension_override_until}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(sub.subscription_status)}
                  {sub.subscription_status !== "active" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedOrg(sub.org_id)}
                    >
                      Override
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending & Overdue Invoices</CardTitle>
          <CardDescription>Recent invoices requiring attention</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {invoices?.map((invoice: any) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="space-y-1">
                  <p className="font-medium">{invoice.organizations.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {invoice.invoice_number} | Due: {invoice.due_date}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Created {formatDistanceToNow(new Date(invoice.invoice_date), { addSuffix: true })}
                  </p>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-xl font-bold">₹{invoice.total_amount}</p>
                  <Badge
                    variant={invoice.payment_status === "overdue" ? "destructive" : "secondary"}
                  >
                    {invoice.payment_status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedOrg} onOpenChange={() => setSelectedOrg(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override Subscription Status</DialogTitle>
            <DialogDescription>
              Temporarily override the subscription status until a specific date
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="override-date">Override Until</Label>
              <Input
                id="override-date"
                type="date"
                value={overrideUntil}
                onChange={(e) => setOverrideUntil(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedOrg(null)}>
              Cancel
            </Button>
            <Button onClick={handleOverrideSubscription} disabled={!overrideUntil}>
              Apply Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}