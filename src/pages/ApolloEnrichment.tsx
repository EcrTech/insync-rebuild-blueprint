import { useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOrgData } from "@/hooks/useOrgData";
import { useContactEnrichment } from "@/hooks/useContactEnrichment";
import { LoadingState } from "@/components/common/LoadingState";
import { DataTable, Column } from "@/components/common/DataTable";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, RefreshCw, Search } from "lucide-react";
import { exportToCSV, ExportColumn } from "@/utils/exportUtils";
import { toast } from "sonner";

interface Contact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  enrichment_status: string | null;
  enrichment_credits_used: number | null;
  last_enriched_at: string | null;
}

interface EnrichmentLog {
  id: string;
  status: string;
  fields_enriched: number;
  credits_used: number;
  enriched_at: string;
  error_message: string | null;
  contacts: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
}

export default function ApolloEnrichment() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const { enriching, bulkEnrichContacts } = useContactEnrichment();

  const { data: contacts, isLoading, refetch } = useOrgData<Contact>("contacts", {
    select: "id, first_name, last_name, email, phone, enrichment_status, enrichment_credits_used, last_enriched_at",
    orderBy: { column: "created_at", ascending: false }
  });

  const { data: enrichmentLogs } = useOrgData<EnrichmentLog>("contact_enrichment_logs", {
    select: "*, contacts(first_name, last_name, email)",
    orderBy: { column: "enriched_at", ascending: false }
  });

  const filteredContacts = contacts?.filter(contact => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      contact.first_name?.toLowerCase().includes(term) ||
      contact.last_name?.toLowerCase().includes(term) ||
      contact.email?.toLowerCase().includes(term)
    );
  });

  const handleSelectContact = (contactId: string) => {
    setSelectedContacts(prev =>
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleSelectAll = () => {
    if (selectedContacts.length === filteredContacts?.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(filteredContacts?.map(c => c.id) || []);
    }
  };

  const handleBulkEnrich = async () => {
    if (selectedContacts.length === 0) {
      toast.error("Please select contacts to enrich");
      return;
    }

    const result = await bulkEnrichContacts(selectedContacts);
    if (result.success) {
      setSelectedContacts([]);
      refetch();
    }
  };

  const handleExport = () => {
    if (!filteredContacts || filteredContacts.length === 0) {
      toast.error("No contacts to export");
      return;
    }

    const columns: ExportColumn[] = [
      { key: "first_name", label: "First Name" },
      { key: "last_name", label: "Last Name" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "enrichment_status", label: "Status" },
      { key: "enrichment_credits_used", label: "Credits Used" },
      { key: "last_enriched_at", label: "Last Enriched" }
    ];

    exportToCSV(filteredContacts, columns, "apollo-enrichment-contacts");
    toast.success("Contacts exported successfully");
  };

  const contactColumns: Column<Contact>[] = [
    {
      header: "",
      accessor: (contact) => (
        <Checkbox
          checked={selectedContacts.includes(contact.id)}
          onCheckedChange={() => handleSelectContact(contact.id)}
        />
      ),
      className: "w-12"
    },
    {
      header: "Name",
      accessor: (contact) => `${contact.first_name || ""} ${contact.last_name || ""}`.trim() || "N/A"
    },
    {
      header: "Email",
      accessor: "email"
    },
    {
      header: "Status",
      accessor: (contact) => {
        const status = contact.enrichment_status;
        if (!status) return <Badge variant="secondary">Not Enriched</Badge>;
        if (status === "enriched") return <Badge variant="default">Enriched</Badge>;
        if (status === "failed") return <Badge variant="destructive">Failed</Badge>;
        return <Badge variant="outline">{status}</Badge>;
      }
    },
    {
      header: "Credits Used",
      accessor: (contact) => contact.enrichment_credits_used || 0
    }
  ];

  const logColumns: Column<EnrichmentLog>[] = [
    {
      header: "Contact",
      accessor: (log) => {
        const contact = log.contacts;
        if (!contact) return "Unknown";
        return `${contact.first_name || ""} ${contact.last_name || ""}`.trim() || contact.email;
      }
    },
    {
      header: "Status",
      accessor: (log) => {
        if (log.status === "success") return <Badge variant="default">Success</Badge>;
        if (log.status === "failed") return <Badge variant="destructive">Failed</Badge>;
        return <Badge variant="outline">{log.status}</Badge>;
      }
    },
    {
      header: "Fields Enriched",
      accessor: "fields_enriched"
    },
    {
      header: "Credits",
      accessor: "credits_used"
    },
    {
      header: "Date",
      accessor: (log) => new Date(log.enriched_at).toLocaleString()
    },
    {
      header: "Error",
      accessor: (log) => log.error_message ? (
        <span className="text-sm text-destructive">{log.error_message}</span>
      ) : "—"
    }
  ];

  if (isLoading) {
    return (
      <DashboardLayout>
        <LoadingState message="Loading enrichment data..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Apollo Data Enrichment</h1>
          <p className="text-muted-foreground">
            Enrich contact data with professional information from Apollo.io
          </p>
        </div>

        {/* Bulk Actions Card */}
        <Card>
          <CardHeader>
            <CardTitle>Bulk Enrichment</CardTitle>
            <CardDescription>
              Select contacts to enrich with Apollo data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search contacts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button
                onClick={handleBulkEnrich}
                disabled={selectedContacts.length === 0 || enriching}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Enrich Selected ({selectedContacts.length})
              </Button>
              <Button variant="outline" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 px-2">
                <Checkbox
                  checked={selectedContacts.length === filteredContacts?.length && filteredContacts.length > 0}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm text-muted-foreground">Select All</span>
              </div>
              <DataTable
                data={filteredContacts || []}
                columns={contactColumns}
                isLoading={false}
              />
            </div>
          </CardContent>
        </Card>

        {/* Enrichment History */}
        <Card>
          <CardHeader>
            <CardTitle>Enrichment History</CardTitle>
            <CardDescription>
              Recent enrichment operations and their results
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              data={enrichmentLogs || []}
              columns={logColumns}
              isLoading={false}
              emptyMessage="No enrichment history yet"
            />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
