import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, Mail, Phone as PhoneIcon, Building, MapPin, Calendar,
  Edit, Plus, MessageSquare, PhoneCall, Video, FileText
} from "lucide-react";
import { ActivityTimeline } from "@/components/Contact/ActivityTimeline";
import { LogActivityDialog } from "@/components/Contact/LogActivityDialog";
import { EditContactDialog } from "@/components/Contact/EditContactDialog";

interface Contact {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  job_title: string | null;
  status: string;
  source: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  website: string | null;
  notes: string | null;
  created_at: string;
  pipeline_stages: { name: string } | null;
  profiles: { first_name: string; last_name: string } | null;
}

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLogActivityOpen, setIsLogActivityOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [activityType, setActivityType] = useState<string>("note");

  useEffect(() => {
    if (id) {
      fetchContact();
    }
  }, [id]);

  const fetchContact = async () => {
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select(`
          *,
          pipeline_stages (name),
          assigned_profile:profiles!assigned_to (first_name, last_name)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      
      // Transform the data to match our interface
      const transformedData = {
        ...data,
        profiles: data.assigned_profile
      };
      delete (transformedData as any).assigned_profile;
      
      setContact(transformedData as Contact);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error loading contact",
        description: error.message,
      });
      navigate("/contacts");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: "bg-blue-500",
      contacted: "bg-yellow-500",
      qualified: "bg-green-500",
      converted: "bg-purple-500",
      lost: "bg-red-500",
    };
    return colors[status] || "bg-gray-500";
  };

  const handleActivityLogged = () => {
    // Refresh the activity timeline
    setIsLogActivityOpen(false);
  };

  const handleContactUpdated = () => {
    fetchContact();
    setIsEditOpen(false);
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

  if (!contact) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/contacts")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">
                {contact.first_name} {contact.last_name}
              </h1>
              {contact.job_title && contact.company && (
                <p className="text-muted-foreground">
                  {contact.job_title} at {contact.company}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsEditOpen(true)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button onClick={() => { setActivityType("note"); setIsLogActivityOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Log Activity
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Badge className={getStatusColor(contact.status)}>
                  {contact.status}
                </Badge>
                {contact.pipeline_stages && (
                  <Badge variant="outline" className="ml-2">
                    {contact.pipeline_stages.name}
                  </Badge>
                )}
              </div>

              {contact.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${contact.email}`} className="text-sm hover:underline">
                    {contact.email}
                  </a>
                </div>
              )}

              {contact.phone && (
                <div className="flex items-center gap-2">
                  <PhoneIcon className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${contact.phone}`} className="text-sm hover:underline">
                    {contact.phone}
                  </a>
                </div>
              )}

              {contact.company && (
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{contact.company}</span>
                </div>
              )}

              {(contact.city || contact.state || contact.country) && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {[contact.city, contact.state, contact.country].filter(Boolean).join(", ")}
                  </span>
                </div>
              )}

              {contact.profiles && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-1">Assigned to</p>
                  <p className="text-sm font-medium">
                    {contact.profiles.first_name} {contact.profiles.last_name}
                  </p>
                </div>
              )}

              {contact.source && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-1">Source</p>
                  <p className="text-sm font-medium">{contact.source}</p>
                </div>
              )}

              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-1">Created</p>
                <p className="text-sm">{new Date(contact.created_at).toLocaleDateString()}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Activities & Notes</CardTitle>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => { setActivityType("call"); setIsLogActivityOpen(true); }}
                  >
                    <PhoneCall className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => { setActivityType("email"); setIsLogActivityOpen(true); }}
                  >
                    <Mail className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => { setActivityType("meeting"); setIsLogActivityOpen(true); }}
                  >
                    <Video className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => { setActivityType("note"); setIsLogActivityOpen(true); }}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="timeline">
                <TabsList>
                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                  <TabsTrigger value="notes">Notes</TabsTrigger>
                </TabsList>
                <TabsContent value="timeline" className="space-y-4">
                  <ActivityTimeline contactId={id!} />
                </TabsContent>
                <TabsContent value="notes">
                  {contact.notes ? (
                    <div className="prose prose-sm max-w-none">
                      <p className="whitespace-pre-wrap">{contact.notes}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No notes yet</p>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      <LogActivityDialog
        open={isLogActivityOpen}
        onOpenChange={setIsLogActivityOpen}
        contactId={id!}
        defaultActivityType={activityType}
        onActivityLogged={handleActivityLogged}
      />

      <EditContactDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        contact={contact}
        onContactUpdated={handleContactUpdated}
      />
    </DashboardLayout>
  );
}
