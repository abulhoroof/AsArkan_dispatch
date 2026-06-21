import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Archive } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";

interface Driver {
  id: string;
  driver_name: string;
  truck_number: number | null;
  contract_type: string;
}

export const DangerZone = () => {
  const { organizationId } = useOrganization();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState<string | null>(null);

  const fetchDrivers = async () => {
    if (!organizationId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("drivers")
      .select("id, driver_name, truck_number, contract_type")
      .eq("is_deleted", false)
      .eq("organization_id", organizationId)
      .order("driver_name");

    if (error) {
      console.error("Error fetching drivers:", error);
      toast.error("Failed to load drivers");
    } else {
      setDrivers(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDrivers();
  }, [organizationId]);

  const handleArchiveDriver = async (driver: Driver) => {
    setArchiving(driver.id);
    try {
      // Archive the driver
      const { error: driverError } = await supabase
        .from("drivers")
        .update({ is_deleted: true })
        .eq("id", driver.id)
        .eq("organization_id", organizationId);

      if (driverError) throw driverError;

      // Archive all loads for this driver
      const { error: loadsError } = await supabase
        .from("loads")
        .update({ is_deleted: true })
        .eq("driver_id", driver.id)
        .eq("organization_id", organizationId);

      if (loadsError) throw loadsError;

      // Also delete the driver status
      const { error: statusError } = await supabase
        .from("driver_statuses")
        .delete()
        .eq("driver_id", driver.id)
        .eq("organization_id", organizationId);

      if (statusError) {
        console.warn("Could not delete driver status:", statusError);
      }

      toast.success(`${driver.driver_name} has been archived`);
      fetchDrivers();
    } catch (error: any) {
      console.error("Error archiving driver:", error);
      toast.error(`Failed to archive driver: ${error.message}`);
    } finally {
      setArchiving(null);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Archive drivers and their loads. This action hides them from the system.
        Recovery requires direct database access.
      </p>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading drivers...</p>
      ) : drivers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active drivers to archive.</p>
      ) : (
        <div className="space-y-2">
          {drivers.map((driver) => (
            <div
              key={driver.id}
              className="flex items-center justify-between p-3 border border-destructive/20 rounded-lg bg-destructive/5"
            >
              <div className="flex-1">
                <p className="text-sm font-medium">{driver.driver_name}</p>
                <p className="text-xs text-muted-foreground">
                  Truck #{driver.truck_number || "N/A"} • {driver.contract_type}
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={archiving === driver.id}
                  >
                    <Archive className="h-4 w-4 mr-1" />
                    {archiving === driver.id ? "Archiving..." : "Archive"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Archive {driver.driver_name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will hide the driver and ALL their loads from the system.
                      <br /><br />
                      <strong className="text-destructive">
                        This action can only be undone by running SQL queries directly in the database.
                      </strong>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleArchiveDriver(driver)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Yes, Archive Driver
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground mt-4">
        To restore an archived driver, run: <code className="bg-muted px-1 py-0.5 rounded">UPDATE drivers SET is_deleted = false WHERE id = 'driver-id';</code>
      </p>
    </div>
  );
};