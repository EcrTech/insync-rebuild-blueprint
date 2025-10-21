import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/common/LoadingState";
import { useNotification } from "@/hooks/useNotification";
import { Mail, Phone as PhoneIcon, Building, LayoutGrid, Table as TableIcon, Sparkles, Loader2, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";

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
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedContact, setDraggedContact] = useState<string | null>(null);
  const [scoringLeadId, setScoringLeadId] = useState<string | null>(null);
  const [selectedLeadScore, setSelectedLeadScore] = useState<any>(null);
  const [showScoreDialog, setShowScoreDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const notify = useNotification();
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // PERFORMANCE: Limit contacts to prevent loading thousands of records
      const [stagesRes, contactsRes] = await Promise.all([
        supabase
          .from("pipeline_stages")
          .select("*")
          .eq("is_active", true)
          .order("stage_order"),
        supabase
          .from("contacts")
          .select("id, first_name, last_name, email, phone, company, pipeline_stage_id, job_title, source, status, notes, website, address, city, state, country, created_at")
          .order("created_at", { ascending: false })
          .limit(500), // Limit to 500 most recent contacts
      ]);

      if (stagesRes.error) throw stagesRes.error;
      if (contactsRes.error) throw contactsRes.error;

      setStages(stagesRes.data || []);
      setContacts(contactsRes.data || []);
      setAllContacts(contactsRes.data || []);
    } catch (error: any) {
      notify.error("Error loading pipeline", error);
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

      notify.success("Contact moved", "Contact has been moved to new stage");
    } catch (error: any) {
      notify.error("Error", error);
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

  const handleScoreLead = async (contact: Contact) => {
    setScoringLeadId(contact.id);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-lead', {
        body: { contact }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setSelectedLeadScore(data);
      setShowScoreDialog(true);
      notify.success("Lead scored successfully", `Score: ${data.finalScore}/100 (${data.grade})`);
    } catch (error: any) {
      notify.error("Scoring failed", error);
    } finally {
      setScoringLeadId(null);
    }
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 85) return "bg-red-500 text-white";
    if (score >= 70) return "bg-orange-500 text-white";
    if (score >= 55) return "bg-yellow-500 text-white";
    if (score >= 40) return "bg-blue-500 text-white";
    if (score >= 25) return "bg-gray-500 text-white";
    return "bg-gray-300 text-gray-700";
  };

  const handleAiSearch = async () => {
    if (!searchQuery.trim()) {
      setContacts(allContacts);
      return;
    }

    setIsSearching(true);
    try {
      console.log('Starting AI search with query:', searchQuery);
      console.log('Total contacts to search:', allContacts.length);
      
      const { data, error } = await supabase.functions.invoke('analyze-lead', {
        body: { 
          searchQuery: searchQuery.trim(),
          contacts: allContacts
        }
      });

      console.log('AI search response:', { data, error });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      if (data.error) {
        console.error('Data error:', data.error);
        throw new Error(data.error);
      }

      // Filter contacts based on AI response
      const filteredContactIds = data.filteredContactIds || [];
      console.log('Filtered contact IDs:', filteredContactIds);
      
      const filtered = allContacts.filter(c => filteredContactIds.includes(c.id));
      console.log('Filtered contacts:', filtered.length);
      
      setContacts(filtered);
      
      notify.success("Search complete", `Found ${filtered.length} matching contacts`);
    } catch (error: any) {
      console.error('Search error:', error);
      notify.error("Search failed", error);
      setContacts(allContacts);
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setContacts(allContacts);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <LoadingState message="Loading pipeline..." />
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
          <Button onClick={() => navigate('/pipeline/advanced-search')} variant="outline">
            <Search className="h-4 w-4 mr-2" />
            Advanced Search
          </Button>
        </div>

        {/* AI Search Bar */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="Search contacts using AI (e.g., 'designation Manager, company in Mumbai, age 30-40')"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isSearching) {
                      handleAiSearch();
                    }
                  }}
                  disabled={isSearching}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Search by: designation, company, location (city/state/country), source, or combine criteria
                </p>
              </div>
              <Button 
                onClick={handleAiSearch}
                disabled={isSearching || !searchQuery.trim()}
              >
                {isSearching ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    AI Search
                  </>
                )}
              </Button>
              {searchQuery && (
                <Button 
                  variant="outline" 
                  onClick={handleClearSearch}
                  disabled={isSearching}
                >
                  Clear
                </Button>
              )}
            </div>
            
            {/* Active Filter Indicator */}
            {searchQuery && contacts.length !== allContacts.length && (
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="secondary" className="text-sm">
                  Showing {contacts.length} of {allContacts.length} contacts
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearSearch}
                  className="h-6 text-xs"
                >
                  Remove filter
                </Button>
              </div>
            )}
          </CardContent>
        </Card>


        <Tabs defaultValue="table" className="w-full">
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
                     className="cursor-move hover:shadow-md transition-shadow animate-fade-in"
                     onClick={() => navigate(`/contacts/${contact.id}`)}
                   >
                     <CardContent className="p-3">
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
                       className="cursor-move hover:shadow-md transition-shadow animate-fade-in"
                       onClick={() => navigate(`/contacts/${contact.id}`)}
                     >
                       <CardContent className="p-3">
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
                      <TableHead>AI Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map(contact => {
                      const stage = stages.find(s => s.id === contact.pipeline_stage_id);
                      return (
                        <TableRow
                          key={contact.id}
                          className="hover:bg-muted/50"
                        >
                          <TableCell 
                            className="font-medium cursor-pointer"
                            onClick={() => navigate(`/contacts/${contact.id}`)}
                          >
                            {contact.first_name} {contact.last_name}
                          </TableCell>
                          <TableCell onClick={() => navigate(`/contacts/${contact.id}`)} className="cursor-pointer">
                            {contact.company && (
                              <div className="flex items-center gap-1">
                                <Building className="h-3 w-3" />
                                {contact.company}
                              </div>
                            )}
                          </TableCell>
                          <TableCell onClick={() => navigate(`/contacts/${contact.id}`)} className="cursor-pointer">
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
                          <TableCell onClick={() => navigate(`/contacts/${contact.id}`)} className="cursor-pointer">
                            {stage ? (
                              <Badge style={{ backgroundColor: stage.color }}>
                                {stage.name}
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Unassigned</Badge>
                            )}
                          </TableCell>
                          <TableCell onClick={() => navigate(`/contacts/${contact.id}`)} className="cursor-pointer">
                            {stage ? `${stage.probability}%` : '-'}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleScoreLead(contact);
                              }}
                              disabled={scoringLeadId === contact.id}
                            >
                              {scoringLeadId === contact.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <Sparkles className="h-4 w-4 mr-1" />
                                  Score
                                </>
                              )}
                            </Button>
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

        {/* Lead Score Dialog */}
        <Dialog open={showScoreDialog} onOpenChange={setShowScoreDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="text-2xl">Indian SMB Lead Score Report</DialogTitle>
              <DialogDescription>AI-powered lead qualification analysis</DialogDescription>
            </DialogHeader>
            
            {selectedLeadScore && (
              <ScrollArea className="h-[calc(90vh-120px)] pr-4">
                <div className="space-y-6">
                  {/* Score Header */}
                  <div className="text-center border-2 border-primary rounded-lg p-6 bg-primary/5">
                    <div className="text-5xl font-bold mb-2">{selectedLeadScore.finalScore}/100</div>
                    <Badge className={`text-lg px-4 py-1 ${getScoreBadgeColor(selectedLeadScore.finalScore)}`}>
                      {selectedLeadScore.grade} Grade
                    </Badge>
                    <div className="text-xl font-semibold mt-2 text-muted-foreground">
                      {selectedLeadScore.temperature}
                    </div>
                  </div>

                  {/* Score Breakdown */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Score Breakdown</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="border rounded-lg p-4">
                        <div className="text-sm text-muted-foreground">Business Profile</div>
                        <div className="text-2xl font-bold">{selectedLeadScore.breakdown.businessProfile.total}/35</div>
                      </div>
                      <div className="border rounded-lg p-4">
                        <div className="text-sm text-muted-foreground">Financial Capability</div>
                        <div className="text-2xl font-bold">{selectedLeadScore.breakdown.financialCapability.total}/25</div>
                      </div>
                      <div className="border rounded-lg p-4">
                        <div className="text-sm text-muted-foreground">Engagement & Intent</div>
                        <div className="text-2xl font-bold">{selectedLeadScore.breakdown.engagementIntent.total}/25</div>
                      </div>
                      <div className="border rounded-lg p-4">
                        <div className="text-sm text-muted-foreground">Relationship Quality</div>
                        <div className="text-2xl font-bold">{selectedLeadScore.breakdown.relationshipQuality.total}/15</div>
                      </div>
                    </div>
                    {selectedLeadScore.modifiers !== 0 && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        Modifiers Applied: {selectedLeadScore.modifiers > 0 ? '+' : ''}{selectedLeadScore.modifiers} points
                      </div>
                    )}
                  </div>

                  {/* Strengths */}
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Key Strengths</h3>
                    <ul className="space-y-1">
                      {selectedLeadScore.strengths.map((strength: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-green-500 mt-0.5">✓</span>
                          <span>{strength}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Concerns */}
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Concerns</h3>
                    <ul className="space-y-1">
                      {selectedLeadScore.concerns.map((concern: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-amber-500 mt-0.5">⚠</span>
                          <span>{concern}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Business Context */}
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Business Context</h3>
                    <div className="space-y-2 text-sm">
                      <div><strong>Location:</strong> {selectedLeadScore.businessContext.locationAdvantage}</div>
                      <div><strong>Payment Capability:</strong> {selectedLeadScore.businessContext.paymentCapability}</div>
                      <div><strong>Decision Making:</strong> {selectedLeadScore.businessContext.decisionMaking}</div>
                      <div><strong>Trust Level:</strong> {selectedLeadScore.businessContext.trustLevel}</div>
                    </div>
                  </div>

                  {/* Recommended Action */}
                  <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-2">Recommended Action</h3>
                    <p>{selectedLeadScore.recommendedAction}</p>
                  </div>

                  {/* Best Approach */}
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Best Approach</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <strong>Preferred Contact:</strong> {selectedLeadScore.bestApproach.preferredContact}
                      </div>
                      <div>
                        <strong>Language:</strong> {selectedLeadScore.bestApproach.languagePreference}
                      </div>
                      <div>
                        <strong>Best Time:</strong> {selectedLeadScore.bestApproach.bestTime}
                      </div>
                      <div className="col-span-2">
                        <strong>Key Message:</strong> {selectedLeadScore.bestApproach.keyMessage}
                      </div>
                    </div>
                  </div>

                  {/* Relationship Strategy */}
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Relationship Building Strategy</h3>
                    <p className="text-sm">{selectedLeadScore.relationshipStrategy}</p>
                  </div>

                  {/* Pricing Strategy */}
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Pricing Strategy</h3>
                    <div className="space-y-2 text-sm">
                      <div><strong>Budget Range:</strong> {selectedLeadScore.pricingStrategy.budgetRange}</div>
                      <div><strong>Recommended Package:</strong> {selectedLeadScore.pricingStrategy.recommendedPackage}</div>
                      <div><strong>Payment Terms:</strong> {selectedLeadScore.pricingStrategy.paymentTerms}</div>
                      <div><strong>Incentives:</strong> {selectedLeadScore.pricingStrategy.incentives}</div>
                    </div>
                  </div>

                  {/* Conversion Metrics */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="border rounded-lg p-4">
                      <div className="text-sm text-muted-foreground">Conversion Probability</div>
                      <div className="text-2xl font-bold">{selectedLeadScore.conversionProbability}%</div>
                    </div>
                    <div className="border rounded-lg p-4">
                      <div className="text-sm text-muted-foreground">Expected Closure</div>
                      <div className="text-lg font-semibold">{selectedLeadScore.expectedClosureTime}</div>
                    </div>
                    <div className="border rounded-lg p-4">
                      <div className="text-sm text-muted-foreground">Effort Level</div>
                      <div className="text-lg font-semibold">{selectedLeadScore.effortLevel}</div>
                    </div>
                  </div>

                  {/* Next Follow Up */}
                  <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-2">Next Follow-Up</h3>
                    <div className="space-y-1 text-sm">
                      <div><strong>Date:</strong> {selectedLeadScore.nextFollowUp.date}</div>
                      <div><strong>Method:</strong> {selectedLeadScore.nextFollowUp.method}</div>
                      <div><strong>Purpose:</strong> {selectedLeadScore.nextFollowUp.purpose}</div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
