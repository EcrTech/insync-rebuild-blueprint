import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useOrgContext } from "@/hooks/useOrgContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Plus, RefreshCw, Eye, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function WhatsAppCampaigns() {
  const navigate = useNavigate();
  const { effectiveOrgId } = useOrgContext();
  const { toast } = useToast();
  
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (effectiveOrgId) {
      fetchCampaigns();
      
      // Subscribe to realtime updates
      const channel = supabase
        .channel('campaigns-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'whatsapp_bulk_campaigns',
            filter: `org_id=eq.${effectiveOrgId}`,
          },
          () => {
            fetchCampaigns();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [effectiveOrgId]);

  const fetchCampaigns = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("whatsapp_bulk_campaigns")
      .select("*")
      .eq("org_id", effectiveOrgId)
      .order("created_at", { ascending: false });
    
    setCampaigns(data || []);
    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      draft: { variant: "secondary", label: "Draft" },
      processing: { variant: "default", label: "Processing" },
      completed: { variant: "default", label: "Completed" },
      failed: { variant: "destructive", label: "Failed" },
      cancelled: { variant: "outline", label: "Cancelled" },
    };
    
    const config = variants[status] || variants.draft;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleDelete = async (campaignId: string) => {
    if (!confirm("Are you sure you want to delete this campaign?")) return;

    const { error } = await supabase
      .from("whatsapp_bulk_campaigns")
      .delete()
      .eq("id", campaignId);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Campaign deleted",
      });
      fetchCampaigns();
    }
  };

  const getProgress = (campaign: any) => {
    if (campaign.total_recipients === 0) return 0;
    return ((campaign.sent_count + campaign.failed_count) / campaign.total_recipients) * 100;
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">WhatsApp Campaigns</h1>
          <p className="text-muted-foreground">Manage your bulk WhatsApp campaigns</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchCampaigns}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => navigate("/whatsapp/bulk-send")}>
            <Plus className="mr-2 h-4 w-4" />
            New Campaign
          </Button>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead>Failed</TableHead>
              <TableHead>Pending</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center">Loading...</TableCell>
              </TableRow>
            ) : campaigns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center">
                  No campaigns yet. Create your first one!
                </TableCell>
              </TableRow>
            ) : (
              campaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell className="font-medium">{campaign.name}</TableCell>
                  <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Progress value={getProgress(campaign)} className="h-2" />
                      <span className="text-xs text-muted-foreground">
                        {Math.round(getProgress(campaign))}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-green-600">{campaign.sent_count}</TableCell>
                  <TableCell className="text-red-600">{campaign.failed_count}</TableCell>
                  <TableCell className="text-yellow-600">{campaign.pending_count}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(campaign.created_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/whatsapp/campaigns/${campaign.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(campaign.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
