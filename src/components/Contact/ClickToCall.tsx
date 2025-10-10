import { useState, useEffect } from "react";
import { Phone, PhoneOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface ClickToCallProps {
  contactId: string;
  phoneNumber: string;
  contactName: string;
}

interface CallSession {
  id: string;
  status: string;
  exotel_call_sid: string;
  started_at: string;
}

interface Disposition {
  id: string;
  name: string;
  category: string;
}

interface SubDisposition {
  id: string;
  name: string;
  disposition_id: string;
}

export const ClickToCall = ({ contactId, phoneNumber, contactName }: ClickToCallProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [activeSession, setActiveSession] = useState<CallSession | null>(null);
  const [duration, setDuration] = useState(0);
  const [showDisposition, setShowDisposition] = useState(false);
  const [dispositions, setDispositions] = useState<Disposition[]>([]);
  const [subDispositions, setSubDispositions] = useState<SubDisposition[]>([]);
  const [selectedDisposition, setSelectedDisposition] = useState("");
  const [selectedSubDisposition, setSelectedSubDisposition] = useState("");
  const [notes, setNotes] = useState("");
  const [completedCallLogId, setCompletedCallLogId] = useState<string | null>(null);

  useEffect(() => {
    checkActiveSession();
    fetchDispositions();

    // Subscribe to call session changes
    const channel = supabase
      .channel('call-session-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agent_call_sessions'
        },
        (payload) => {
          if (payload.new && 'contact_id' in payload.new && payload.new.contact_id === contactId) {
            setActiveSession(payload.new as CallSession);
            if (payload.new.status === 'ended') {
              handleCallEnded();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [contactId]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeSession && activeSession.status !== 'ended') {
      interval = setInterval(() => {
        const elapsed = Math.floor(
          (new Date().getTime() - new Date(activeSession.started_at).getTime()) / 1000
        );
        setDuration(elapsed);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeSession]);

  const checkActiveSession = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('agent_call_sessions')
      .select('*')
      .eq('agent_id', user.id)
      .eq('contact_id', contactId)
      .neq('status', 'ended')
      .single();

    if (data) {
      setActiveSession(data);
    }
  };

  const fetchDispositions = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (!profile) return;

    const { data: dispData } = await supabase
      .from('call_dispositions')
      .select('*')
      .eq('org_id', profile.org_id)
      .eq('is_active', true)
      .order('name');

    const { data: subDispData } = await supabase
      .from('call_sub_dispositions')
      .select('*')
      .eq('org_id', profile.org_id)
      .eq('is_active', true)
      .order('name');

    if (dispData) setDispositions(dispData);
    if (subDispData) setSubDispositions(subDispData);
  };

  const handleCallEnded = async () => {
    // Get the completed call log
    const { data } = await supabase
      .from('call_logs')
      .select('id')
      .eq('exotel_call_sid', activeSession?.exotel_call_sid)
      .single();

    if (data) {
      setCompletedCallLogId(data.id);
      setShowDisposition(true);
    }
  };

  const makeCall = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('phone')
        .eq('id', user.id)
        .single();

      if (!profile?.phone) {
        toast({
          title: "Phone number required",
          description: "Please add your phone number in your profile settings",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('exotel-make-call', {
        body: {
          contactId,
          agentPhoneNumber: profile.phone,
        },
      });

      if (error) throw error;

      toast({
        title: "Call initiated",
        description: `Calling ${contactName}...`,
      });

      setActiveSession({
        id: data.callLog.id,
        status: 'initiating',
        exotel_call_sid: data.exotelCallSid,
        started_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error making call:', error);
      toast({
        title: "Call failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveDisposition = async () => {
    if (!completedCallLogId || !selectedDisposition) return;

    try {
      await supabase
        .from('call_logs')
        .update({
          disposition_id: selectedDisposition,
          sub_disposition_id: selectedSubDisposition || null,
          notes,
        })
        .eq('id', completedCallLogId);

      // Also update the linked activity if it exists
      const { data: callLog } = await supabase
        .from('call_logs')
        .select('activity_id')
        .eq('id', completedCallLogId)
        .single();

      if (callLog?.activity_id) {
        await supabase
          .from('contact_activities')
          .update({
            call_disposition_id: selectedDisposition,
            call_sub_disposition_id: selectedSubDisposition || null,
            description: notes ? `${notes}\n\nCall duration: ${duration} seconds` : `Call duration: ${duration} seconds`,
          })
          .eq('id', callLog.activity_id);
      }

      toast({
        title: "Disposition saved",
        description: "Call disposition has been recorded",
      });

      setShowDisposition(false);
      setActiveSession(null);
      setSelectedDisposition("");
      setSelectedSubDisposition("");
      setNotes("");
      setDuration(0);
    } catch (error) {
      console.error('Error saving disposition:', error);
      toast({
        title: "Error",
        description: "Failed to save disposition",
        variant: "destructive",
      });
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'initiating': return 'text-yellow-500';
      case 'ringing': return 'text-blue-500';
      case 'connected': return 'text-green-500';
      default: return 'text-muted-foreground';
    }
  };

  const filteredSubDispositions = subDispositions.filter(
    sd => sd.disposition_id === selectedDisposition
  );

  if (activeSession && activeSession.status !== 'ended') {
    return (
      <div className="flex items-center gap-2 p-2 border rounded-lg bg-accent/10">
        <div className={`flex items-center gap-2 ${getStatusColor(activeSession.status)}`}>
          <Phone className="h-4 w-4 animate-pulse" />
          <span className="text-sm font-medium capitalize">{activeSession.status}</span>
        </div>
        <span className="text-sm font-mono">{formatDuration(duration)}</span>
      </div>
    );
  }

  return (
    <>
      <Button
        size="icon"
        variant="default"
        onClick={makeCall}
        disabled={isLoading}
        title="Call"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Phone className="h-4 w-4" />
        )}
      </Button>

      <Dialog open={showDisposition} onOpenChange={setShowDisposition}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Call Disposition</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Call Duration</Label>
              <p className="text-sm text-muted-foreground">{formatDuration(duration)}</p>
            </div>

            <div>
              <Label>Disposition *</Label>
              <Select value={selectedDisposition} onValueChange={setSelectedDisposition}>
                <SelectTrigger>
                  <SelectValue placeholder="Select disposition" />
                </SelectTrigger>
                <SelectContent>
                  {dispositions.map(d => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {filteredSubDispositions.length > 0 && (
              <div>
                <Label>Sub-Disposition</Label>
                <Select value={selectedSubDisposition} onValueChange={setSelectedSubDisposition}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select sub-disposition" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredSubDispositions.map(sd => (
                      <SelectItem key={sd.id} value={sd.id}>
                        {sd.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about the call..."
                rows={3}
              />
            </div>

            <Button
              onClick={saveDisposition}
              disabled={!selectedDisposition}
              className="w-full"
            >
              Save Disposition
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
