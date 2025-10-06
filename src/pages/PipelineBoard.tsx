import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Mail, Phone as PhoneIcon, Building, DollarSign, LayoutGrid, Table as TableIcon, Sparkles, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PipelineStage {
  id: string;
  name: string;
  color: string;
  stage_order: number;
  probability: number;
}

interface Contact {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  pipeline_stage_id: string | null;
  job_title?: string | null;
  source?: string | null;
  status?: string | null;
  notes?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
}

export default function PipelineBoard() {
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedContact, setDraggedContact] = useState<string | null>(null);
  const [analyzingLead, setAnalyzingLead] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Contact | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [showAnalysisDialog, setShowAnalysisDialog] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [stagesRes, contactsRes] = await Promise.all([
        supabase
          .from("pipeline_stages")
          .select("*")
          .eq("is_active", true)
          .order("stage_order"),
        supabase
          .from("contacts")
          .select("id, first_name, last_name, email, phone, company, pipeline_stage_id, job_title, source, status, notes, website, address, city, state, country")
          .order("created_at", { ascending: false }),
      ]);

      if (stagesRes.error) throw stagesRes.error;
      if (contactsRes.error) throw contactsRes.error;

      setStages(stagesRes.data || []);
      setContacts(contactsRes.data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error loading pipeline",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (contactId: string) => {
    setDraggedContact(contactId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (stageId: string) => {
    if (!draggedContact) return;

    try {
      const { error } = await supabase
        .from("contacts")
        .update({ pipeline_stage_id: stageId })
        .eq("id", draggedContact);

      if (error) throw error;

      // Update local state
      setContacts(prev =>
        prev.map(contact =>
          contact.id === draggedContact
            ? { ...contact, pipeline_stage_id: stageId }
            : contact
        )
      );

      toast({
        title: "Contact moved",
        description: "Contact has been moved to new stage",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setDraggedContact(null);
    }
  };

  const getContactsInStage = (stageId: string) => {
    return contacts.filter(contact => contact.pipeline_stage_id === stageId);
  };

  const getContactsWithoutStage = () => {
    return contacts.filter(contact => !contact.pipeline_stage_id);
  };

  const handleAnalyzeLead = async (contact: Contact) => {
    setSelectedLead(contact);
    setAnalyzingLead(true);
    setShowAnalysisDialog(true);
    setAiAnalysis(null);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-lead', {
        body: { leadData: contact }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setAiAnalysis(data.analysis);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Analysis failed",
        description: error.message,
      });
      setShowAnalysisDialog(false);
    } finally {
      setAnalyzingLead(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Pipeline Board</h1>
            <p className="text-muted-foreground">View and manage your sales pipeline</p>
          </div>
        </div>

        <Tabs defaultValue="board" className="w-full">
          <TabsList>
            <TabsTrigger value="board">
              <LayoutGrid className="h-4 w-4 mr-2" />
              Board View
            </TabsTrigger>
            <TabsTrigger value="table">
              <TableIcon className="h-4 w-4 mr-2" />
              Table View
            </TabsTrigger>
          </TabsList>

          <TabsContent value="board" className="mt-6">
            <div className="flex gap-4 overflow-x-auto pb-4">
          {/* Unassigned column */}
          <div
            className="flex-shrink-0 w-80"
            onDragOver={handleDragOver}
            onDrop={() => handleDrop("")}
          >
            <Card className="h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <span>Unassigned</span>
                  <Badge variant="secondary">{getContactsWithoutStage().length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[calc(100vh-250px)] overflow-y-auto">
                {getContactsWithoutStage().map(contact => (
                  <Card
                    key={contact.id}
                    draggable
                     onDragStart={() => handleDragStart(contact.id)}
                     className="cursor-move hover:shadow-md transition-shadow animate-fade-in group"
                   >
                     <CardContent className="p-3">
                       <div className="flex items-start justify-between">
                         <div 
                           className="flex-1 cursor-pointer"
                           onClick={() => navigate(`/contacts/${contact.id}`)}
                         >
                           <p className="font-medium text-sm">
                             {contact.first_name} {contact.last_name}
                           </p>
                           {contact.company && (
                             <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                               <Building className="h-3 w-3" />
                               {contact.company}
                             </div>
                           )}
                           <div className="flex gap-2 mt-2">
                             {contact.email && (
                               <Mail className="h-3 w-3 text-muted-foreground" />
                             )}
                             {contact.phone && (
                               <PhoneIcon className="h-3 w-3 text-muted-foreground" />
                             )}
                           </div>
                         </div>
                         <Button
                           size="sm"
                           variant="ghost"
                           className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0"
                           onClick={(e) => {
                             e.stopPropagation();
                             handleAnalyzeLead(contact);
                           }}
                         >
                           <Sparkles className="h-3 w-3" />
                         </Button>
                       </div>
                     </CardContent>
                   </Card>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Stage columns */}
          {stages.map(stage => (
            <div
              key={stage.id}
              className="flex-shrink-0 w-80"
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(stage.id)}
            >
              <Card className="h-full" style={{ borderTopColor: stage.color, borderTopWidth: 3 }}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    <span>{stage.name}</span>
                    <Badge variant="secondary">{getContactsInStage(stage.id).length}</Badge>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {stage.probability}% probability
                  </p>
                </CardHeader>
                <CardContent className="space-y-2 max-h-[calc(100vh-250px)] overflow-y-auto">
                  {getContactsInStage(stage.id).map(contact => (
                    <Card
                       key={contact.id}
                       draggable
                       onDragStart={() => handleDragStart(contact.id)}
                       className="cursor-move hover:shadow-md transition-shadow animate-fade-in group"
                     >
                       <CardContent className="p-3">
                         <div className="flex items-start justify-between">
                           <div 
                             className="flex-1 cursor-pointer"
                             onClick={() => navigate(`/contacts/${contact.id}`)}
                           >
                             <p className="font-medium text-sm">
                               {contact.first_name} {contact.last_name}
                             </p>
                             {contact.company && (
                               <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                 <Building className="h-3 w-3" />
                                 {contact.company}
                               </div>
                             )}
                             <div className="flex gap-2 mt-2">
                               {contact.email && (
                                 <Mail className="h-3 w-3 text-muted-foreground" />
                               )}
                               {contact.phone && (
                                 <PhoneIcon className="h-3 w-3 text-muted-foreground" />
                               )}
                             </div>
                           </div>
                           <Button
                             size="sm"
                             variant="ghost"
                             className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0"
                             onClick={(e) => {
                               e.stopPropagation();
                               handleAnalyzeLead(contact);
                             }}
                           >
                             <Sparkles className="h-3 w-3" />
                           </Button>
                         </div>
                       </CardContent>
                     </Card>
                  ))}
                </CardContent>
              </Card>
            </div>
            ))}
            </div>
          </TabsContent>

          <TabsContent value="table" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>All Pipeline Contacts</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Contact Info</TableHead>
                      <TableHead>Pipeline Stage</TableHead>
                      <TableHead>Probability</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map(contact => {
                      const stage = stages.find(s => s.id === contact.pipeline_stage_id);
                      return (
                        <TableRow
                          key={contact.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/contacts/${contact.id}`)}
                        >
                          <TableCell className="font-medium">
                            {contact.first_name} {contact.last_name}
                          </TableCell>
                          <TableCell>
                            {contact.company && (
                              <div className="flex items-center gap-1">
                                <Building className="h-3 w-3" />
                                {contact.company}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1 text-sm">
                              {contact.email && (
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {contact.email}
                                </span>
                              )}
                              {contact.phone && (
                                <span className="flex items-center gap-1">
                                  <PhoneIcon className="h-3 w-3" />
                                  {contact.phone}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {stage ? (
                              <Badge style={{ backgroundColor: stage.color }}>
                                {stage.name}
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Unassigned</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {stage ? `${stage.probability}%` : '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={showAnalysisDialog} onOpenChange={setShowAnalysisDialog}>
          <DialogContent className="max-w-3xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  AI Lead Analysis
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAnalysisDialog(false)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] pr-4">
              {analyzingLead ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                  <p className="text-muted-foreground">Analyzing lead with AI...</p>
                </div>
              ) : aiAnalysis ? (
                <div className="space-y-4">
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm font-medium mb-2">
                      Lead: {selectedLead?.first_name} {selectedLead?.last_name}
                      {selectedLead?.company && ` - ${selectedLead.company}`}
                    </p>
                  </div>
                  <pre className="whitespace-pre-wrap text-sm font-mono bg-muted/30 p-4 rounded-lg">
                    {aiAnalysis}
                  </pre>
                </div>
              ) : null}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
