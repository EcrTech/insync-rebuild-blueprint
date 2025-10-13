import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Database, Upload, Download, Plus, Search, Filter, Building2, Users, TrendingUp, Calendar } from "lucide-react";
import { AddEditRepositoryDialog } from "@/components/RedefineRepository/AddEditRepositoryDialog";
import { BulkImportDialog } from "@/components/RedefineRepository/BulkImportDialog";
import { RepositoryFilters } from "@/components/RedefineRepository/RepositoryFilters";
import { exportToCSV, ExportColumn } from "@/utils/exportUtils";
import { toast } from "sonner";
import { format } from "date-fns";

export default function RedefineDataRepository() {
  const { effectiveOrgId } = useOrgContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [filters, setFilters] = useState({
    industryType: "",
    state: "",
    zone: "",
    tier: "",
    jobLevel: "",
  });

  // Fetch repository data
  const { data: records, isLoading, refetch } = useQuery({
    queryKey: ["redefine-repository", effectiveOrgId, searchQuery, filters],
    queryFn: async () => {
      let query = supabase
        .from("redefine_data_repository")
        .select("*")
        .eq("org_id", effectiveOrgId!)
        .order("created_at", { ascending: false });

      if (searchQuery) {
        query = query.or(
          `name.ilike.%${searchQuery}%,company_name.ilike.%${searchQuery}%,official_email.ilike.%${searchQuery}%,designation.ilike.%${searchQuery}%,city.ilike.%${searchQuery}%`
        );
      }

      if (filters.industryType) {
        query = query.eq("industry_type", filters.industryType);
      }
      if (filters.state) {
        query = query.eq("state", filters.state);
      }
      if (filters.zone) {
        query = query.eq("zone", filters.zone);
      }
      if (filters.tier) {
        query = query.eq("tier", filters.tier);
      }
      if (filters.jobLevel) {
        query = query.eq("job_level", filters.jobLevel);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!effectiveOrgId,
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ["redefine-repository-stats", effectiveOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("redefine_data_repository")
        .select("company_name, industry_type, created_at")
        .eq("org_id", effectiveOrgId!);

      if (error) throw error;

      const uniqueCompanies = new Set(data.map(r => r.company_name).filter(Boolean)).size;
      const uniqueIndustries = new Set(data.map(r => r.industry_type).filter(Boolean)).size;
      const thisMonth = data.filter(r => {
        const created = new Date(r.created_at);
        const now = new Date();
        return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
      }).length;

      return {
        totalRecords: data.length,
        uniqueCompanies,
        uniqueIndustries,
        recordsThisMonth: thisMonth,
      };
    },
    enabled: !!effectiveOrgId,
  });

  const handleExport = () => {
    if (!records || records.length === 0) {
      toast.error("No data to export");
      return;
    }

    const columns: ExportColumn[] = [
      { key: "name", label: "Name" },
      { key: "designation", label: "Designation" },
      { key: "department", label: "Department" },
      { key: "job_level", label: "Job Level" },
      { key: "linkedin_url", label: "LinkedIn" },
      { key: "mobile_number", label: "Mobile Number" },
      { key: "mobile_2", label: "Mobile 2" },
      { key: "official_email", label: "Official Email" },
      { key: "personal_email", label: "Personal Email" },
      { key: "generic_email", label: "Generic Email" },
      { key: "industry_type", label: "Industry Type" },
      { key: "sub_industry", label: "Sub Industry" },
      { key: "company_name", label: "Company Name" },
      { key: "address", label: "Address" },
      { key: "location", label: "Location" },
      { key: "city", label: "City" },
      { key: "state", label: "State" },
      { key: "zone", label: "Zone" },
      { key: "tier", label: "Tier" },
      { key: "pincode", label: "Pincode" },
      { key: "website", label: "Website" },
      { key: "turnover", label: "Turnover" },
      { key: "employee_size", label: "Employee Size" },
      { key: "erp_name", label: "ERP Name" },
      { key: "erp_vendor", label: "ERP Vendor" },
    ];

    try {
      exportToCSV(records, columns, `redefine-repository-${format(new Date(), "yyyy-MM-dd")}`);
      toast.success("Data exported successfully");
    } catch (error) {
      toast.error("Failed to export data");
    }
  };

  const handleEdit = (record: any) => {
    setSelectedRecord(record);
    setShowAddDialog(true);
  };

  const handleCloseDialog = () => {
    setShowAddDialog(false);
    setSelectedRecord(null);
    refetch();
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Database className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Data Repository</h1>
            <p className="text-muted-foreground">Manage your professional contacts and company data</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowBulkImport(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Bulk Import
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Record
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Records</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalRecords || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Companies</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.uniqueCompanies || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Industries</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.uniqueIndustries || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.recordsThisMonth || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, company, email, designation, city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="mr-2 h-4 w-4" />
              Filters
            </Button>
          </div>
          {showFilters && (
            <RepositoryFilters
              filters={filters}
              onFiltersChange={setFilters}
            />
          )}
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : records && records.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.name}</TableCell>
                      <TableCell>{record.designation || "-"}</TableCell>
                      <TableCell>{record.company_name || "-"}</TableCell>
                      <TableCell>
                        {record.industry_type ? (
                          <Badge variant="secondary">{record.industry_type}</Badge>
                        ) : "-"}
                      </TableCell>
                      <TableCell>{record.city || record.location || "-"}</TableCell>
                      <TableCell>{record.mobile_number || "-"}</TableCell>
                      <TableCell>{record.official_email || "-"}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(record)}
                        >
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No records found. Add your first record or import from CSV.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <AddEditRepositoryDialog
        open={showAddDialog}
        onOpenChange={handleCloseDialog}
        record={selectedRecord}
        orgId={effectiveOrgId!}
      />

      <BulkImportDialog
        open={showBulkImport}
        onOpenChange={setShowBulkImport}
        orgId={effectiveOrgId!}
        onImportComplete={refetch}
      />
    </div>
  );
}
