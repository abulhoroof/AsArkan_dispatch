import { useState, useEffect } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Pencil, Loader2 } from "lucide-react";
import { useOrganization } from "@/hooks/useOrganization";

interface Dispatcher {
  id: string;
  email: string;
  name: string;
}

interface ReassignDriverDialogProps {
  driverId: string;
  driverName: string;
  currentDispatcherEmail: string | null;
  currentDispatcherId: string | null;
  onReassigned: () => void;
}

export function ReassignDriverDialog({
  driverId,
  driverName,
  currentDispatcherEmail,
  currentDispatcherId,
  onReassigned,
}: ReassignDriverDialogProps) {
  const { organizationId } = useOrganization();
  const [open, setOpen] = useState(false);
  const [dispatchers, setDispatchers] = useState<Dispatcher[]>([]);
  const [selectedDispatcherId, setSelectedDispatcherId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeLoadCount, setActiveLoadCount] = useState(0);

  useEffect(() => {
    if (open && organizationId) {
      fetchDispatchers();
      fetchActiveLoadCount();
    }
  }, [open, organizationId]);

  const fetchDispatchers = async () => {
    if (!organizationId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await (supabase.rpc as any)('get_all_dispatchers', {
        p_org_id: organizationId
      });
      if (error) throw error;
      setDispatchers(data || []);
      setSelectedDispatcherId(currentDispatcherId || "");
    } catch (error: any) {
      toast.error("Failed to load dispatchers: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchActiveLoadCount = async () => {
    try {
      const today = new Date();
      
      const { data, error } = await supabase
        .from('loads')
        .select('id, delivery_date')
        .eq('driver_id', driverId)
        .eq('is_archived', false)
        .eq('organization_id', organizationId);
      
      if (error) throw error;
      
      const ongoingLoads = (data || []).filter(load => {
        if (!load.delivery_date) return true;
        try {
          const deliveryDate = new Date(load.delivery_date);
          return deliveryDate >= today;
        } catch {
          return true;
        }
      });
      
      setActiveLoadCount(ongoingLoads.length);
    } catch (error) {
      console.error("Failed to fetch active load count:", error);
    }
  };

  const handleReassign = async () => {
    if (!selectedDispatcherId || selectedDispatcherId === currentDispatcherId) {
      setOpen(false);
      return;
    }

    setIsSaving(true);
    try {
      // Update driver assignment - driver moves immediately
      const { error } = await supabase
        .from('drivers')
        .update({
          assigned_dispatcher_id: selectedDispatcherId,
          assigned_at: new Date().toISOString(),
        })
        .eq('id', driverId);

      if (error) throw error;

      // Loads are NOT transferred - they stay with original dispatcher (Sunset Transfer)

      const newDispatcher = dispatchers.find(d => d.id === selectedDispatcherId);
      const oldDispatcher = dispatchers.find(d => d.id === currentDispatcherId);

      // Get current user for reassigned_by
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      // Log reassignment to history (loads_transferred always 0 with Sunset Transfer)
      const { error: historyError } = await supabase
        .from('driver_reassignment_history')
        .insert({
          driver_id: driverId,
          driver_name: driverName,
          from_dispatcher_id: currentDispatcherId,
          from_dispatcher_email: oldDispatcher?.email || currentDispatcherEmail || null,
          to_dispatcher_id: selectedDispatcherId,
          to_dispatcher_email: newDispatcher?.email || '',
          reassigned_by: currentUser?.id,
          loads_transferred: 0,
          notes: activeLoadCount > 0 ? `Driver has ${activeLoadCount} active load(s) completing with previous dispatcher` : null,
        });

      if (historyError) {
        console.error("Failed to log reassignment history:", historyError);
      }

      // Notification to new dispatcher - inform about sunset loads
      const newDispatcherMessage = activeLoadCount > 0
        ? `${driverName} has been assigned to you. Note: They are completing ${activeLoadCount} load(s) for ${oldDispatcher?.name || 'previous dispatcher'} before becoming fully available.`
        : `${driverName} has been assigned to you${oldDispatcher ? ` from ${oldDispatcher.name}` : ''}.`;

      await supabase
        .from('notifications')
        .insert({
          user_id: selectedDispatcherId,
          title: 'Driver Assigned',
          message: newDispatcherMessage,
          type: 'driver_assigned',
          metadata: { driver_id: driverId, driver_name: driverName, active_loads_with_previous: activeLoadCount }
        });

      // Notification to old dispatcher - inform they keep the loads
      if (currentDispatcherId) {
        const oldDispatcherMessage = activeLoadCount > 0
          ? `${driverName} has been reassigned to ${newDispatcher?.name || 'another dispatcher'}. You will continue managing their ${activeLoadCount} current load(s) until completion.`
          : `${driverName} has been reassigned to ${newDispatcher?.name || 'another dispatcher'}.`;

        await supabase
          .from('notifications')
          .insert({
            user_id: currentDispatcherId,
            title: 'Driver Reassigned',
            message: oldDispatcherMessage,
            type: 'driver_reassigned',
            metadata: { driver_id: driverId, driver_name: driverName, loads_remaining: activeLoadCount }
          });
      }

      // Send email notifications
      supabase.functions.invoke('send-reassignment-email', {
        body: {
          driverName,
          newDispatcherId: selectedDispatcherId,
          oldDispatcherId: currentDispatcherId,
          newDispatcherName: newDispatcher?.name || 'Dispatcher',
          oldDispatcherName: oldDispatcher?.name || null,
          loadsTransferred: 0,
          activeLoadsRemaining: activeLoadCount,
          organizationId,
        }
      }).then(({ error: emailError }) => {
        if (emailError) {
          console.error("Failed to send email notifications:", emailError);
        } else {
          console.log("Email notifications sent successfully");
        }
      });

      // Updated toast message for Sunset Transfer
      const toastMessage = activeLoadCount > 0
        ? `${driverName} reassigned to ${newDispatcher?.name || 'new dispatcher'}. Current loads will complete with you.`
        : `${driverName} reassigned to ${newDispatcher?.name || 'new dispatcher'}.`;
      
      toast.success(toastMessage);
      setOpen(false);
      onReassigned();
    } catch (error: any) {
      toast.error("Failed to reassign driver: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const displayName = currentDispatcherEmail 
    ? currentDispatcherEmail.split('@')[0] 
    : 'Unassigned';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto p-1 gap-1 text-muted-foreground hover:text-foreground group"
        >
          <span>{displayName}</span>
          <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="space-y-3">
          <div className="text-sm font-medium">Reassign {driverName}</div>
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <Select
                value={selectedDispatcherId}
                onValueChange={setSelectedDispatcherId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select dispatcher" />
                </SelectTrigger>
                <SelectContent>
                  {dispatchers.map((dispatcher) => (
                    <SelectItem key={dispatcher.id} value={dispatcher.id}>
                      {dispatcher.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleReassign}
                  disabled={isSaving || !selectedDispatcherId || selectedDispatcherId === currentDispatcherId}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Reassign"
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
