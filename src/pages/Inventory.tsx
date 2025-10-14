import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, Package, Plus, Search, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOrgContext } from "@/hooks/useOrgContext";
import { AddEditInventoryDialog } from "@/components/Inventory/AddEditInventoryDialog";
import { BulkImportInventoryDialog } from "@/components/Inventory/BulkImportInventoryDialog";

export default function Inventory() {
  const { toast } = useToast();
  const { effectiveOrgId } = useOrgContext();
  const [search, setSearch] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showBulkImportDialog, setShowBulkImportDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const { data: inventory, isLoading, refetch } = useQuery({
    queryKey: ["inventory", effectiveOrgId, search],
    queryFn: async () => {
      let query = supabase
        .from("inventory_items")
        .select("*")
        .eq("org_id", effectiveOrgId)
        .order("created_at", { ascending: false });

      if (search) {
        query = query.or(`item_id_sku.ilike.%${search}%,item_name.ilike.%${search}%,brand.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!effectiveOrgId,
  });

  const { data: stats } = useQuery({
    queryKey: ["inventory-stats", effectiveOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("available_qty")
        .eq("org_id", effectiveOrgId);

      if (error) throw error;

      const totalItems = data.length;
      const totalQty = data.reduce((sum, item) => sum + (Number(item.available_qty) || 0), 0);
      const lowStock = data.filter(item => {
        const qty = Number(item.available_qty) || 0;
        return qty < 10; // Simple low stock threshold
      }).length;

      return { totalItems, totalQty, lowStock };
    },
    enabled: !!effectiveOrgId,
  });

  const handleExport = () => {
    if (!inventory || inventory.length === 0) {
      toast({
        title: "No data to export",
        variant: "destructive",
      });
      return;
    }

    const headers = Object.keys(inventory[0]).join(",");
    const rows = inventory.map(item => 
      Object.values(item).map(val => 
        typeof val === 'string' && val.includes(',') ? `"${val}"` : val
      ).join(",")
    );
    const csv = [headers, ...rows].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory_${new Date().toISOString()}.csv`;
    a.click();
  };

  const handleEdit = (item: any) => {
    setSelectedItem(item);
    setShowAddDialog(true);
  };

  const handleCloseDialog = () => {
    setShowAddDialog(false);
    setSelectedItem(null);
    refetch();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Inventory Management</h1>
            <p className="text-muted-foreground">Manage your Unbrako Fasteners inventory</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowBulkImportDialog(true)} variant="outline">
              <Upload className="mr-2 h-4 w-4" />
              Bulk Import
            </Button>
            <Button onClick={handleExport} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Items</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalItems || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Quantity</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalQty || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
              <Package className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats?.lowStock || 0}</div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by SKU, name, or brand..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Inventory Items</CardTitle>
            <CardDescription>
              {inventory?.length || 0} items in inventory
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Item Name</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Diameter</TableHead>
                    <TableHead>Length</TableHead>
                    <TableHead>Available Qty</TableHead>
                    <TableHead>UOM</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : inventory && inventory.length > 0 ? (
                    inventory.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.item_id_sku}</TableCell>
                        <TableCell>{item.item_name}</TableCell>
                        <TableCell>{item.brand}</TableCell>
                        <TableCell>{item.category}</TableCell>
                        <TableCell>{item.diameter_mm}</TableCell>
                        <TableCell>{item.length_mm}</TableCell>
                        <TableCell>
                          <span className={Number(item.available_qty) < 10 ? "text-destructive font-bold" : ""}>
                            {item.available_qty}
                          </span>
                        </TableCell>
                        <TableCell>{item.uom}</TableCell>
                        <TableCell>{item.storage_location || "-"}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center">
                        No inventory items found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <AddEditInventoryDialog
        open={showAddDialog}
        onOpenChange={handleCloseDialog}
        item={selectedItem}
        orgId={effectiveOrgId}
      />

      <BulkImportInventoryDialog
        open={showBulkImportDialog}
        onOpenChange={setShowBulkImportDialog}
        orgId={effectiveOrgId}
        onImportComplete={() => refetch()}
      />
    </DashboardLayout>
  );
}
