import { useState, useEffect } from "react";
import { useSettings, DropdownConfig } from "@/contexts/SettingsContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X, Trash2, AlertTriangle, ChevronDown, DollarSign, Percent, Lock } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { APP_VERSION, APP_NAME } from "@/config/version";
import { AppFooter } from "@/components/AppFooter";
import { DispatcherManagementDialog } from "@/components/DispatcherManagementDialog";
import { DangerZone } from "@/components/DangerZone";
import { useUserRole } from "@/hooks/useUserRole";
import { SpreadsheetHeader } from "@/components/SpreadsheetHeader";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PayLogicType } from "@/config/contractProfiles";
import { formatRate } from "@/utils/settlementCalculations";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Extracted as a separate component to avoid hooks issues
const DropdownEditor = ({
  title,
  description,
  field,
  dropdownConfig,
  updateDropdownConfig,
}: {
  title: string;
  description: string;
  field: keyof DropdownConfig;
  dropdownConfig: DropdownConfig;
  updateDropdownConfig: (field: keyof DropdownConfig, options: { value: string; label: string }[]) => void;
}) => {
  const [options, setOptions] = useState(dropdownConfig[field]);
  const [newOption, setNewOption] = useState("");

  // Sync local state when dropdownConfig changes (e.g., after loading from DB)
  useEffect(() => {
    setOptions(dropdownConfig[field]);
  }, [dropdownConfig, field]);

  const addOption = () => {
    if (!newOption.trim()) {
      toast.error("Option cannot be empty");
      return;
    }
    const updated = [...options, { value: newOption, label: newOption }];
    setOptions(updated);
    updateDropdownConfig(field, updated);
    setNewOption("");
    toast.success("Option added");
  };

  const removeOption = (index: number) => {
    const updated = options.filter((_, i) => i !== index);
    setOptions(updated);
    updateDropdownConfig(field, updated);
    toast.success("Option removed");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {options.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input value={option.label} disabled className="flex-1" />
              <Button
                variant="destructive"
                size="icon"
                onClick={() => removeOption(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="New option"
            value={newOption}
            onChange={(e) => setNewOption(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && addOption()}
          />
          <Button onClick={addOption} size="icon">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// Unified Contract Type Editor Component
const ContractTypeEditor = ({
  contractProfiles,
  dropdownConfig,
  updateContractProfile,
  addContractType,
  deleteContractType,
}: {
  contractProfiles: ReturnType<typeof useSettings>['contractProfiles'];
  dropdownConfig: DropdownConfig;
  updateContractProfile: (contractType: string, payLogic: PayLogicType, rate: number) => Promise<void>;
  addContractType: (name: string, payLogic?: PayLogicType, rate?: number) => Promise<void>;
  deleteContractType: (name: string) => Promise<void>;
}) => {
  const [editingRates, setEditingRates] = useState<Record<string, string>>({});
  const [newTypeName, setNewTypeName] = useState("");

  const handleRateChange = (contractType: string, value: string) => {
    setEditingRates(prev => ({ ...prev, [contractType]: value }));
  };

  const handleRateBlur = async (contractType: string) => {
    const newRate = parseFloat(editingRates[contractType]);
    if (isNaN(newRate)) return;
    
    const profile = contractProfiles[contractType];
    if (profile && newRate !== profile.defaultRate) {
      await updateContractProfile(contractType, profile.defaultPayLogic, newRate);
    }
    setEditingRates(prev => {
      const { [contractType]: _, ...rest } = prev;
      return rest;
    });
  };

  const handlePayLogicChange = async (contractType: string, newPayLogic: PayLogicType) => {
    const profile = contractProfiles[contractType];
    if (profile) {
      // Set a sensible default rate when switching
      const newRate = newPayLogic === 'PERCENTAGE' ? 88 : 0.65;
      await updateContractProfile(contractType, newPayLogic, newRate);
    }
  };

  const handleAddContractType = async () => {
    if (!newTypeName.trim()) {
      toast.error("Contract type name cannot be empty");
      return;
    }
    await addContractType(newTypeName.trim().toUpperCase());
    setNewTypeName("");
  };

  // Get contract types from dropdown config
  const contractTypes = dropdownConfig.contractTypes.map(ct => ct.value);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Contract Types
        </CardTitle>
        <CardDescription>
          Configure contract types and their default pay rates. These rates auto-fill driver pay when creating new loads.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {contractTypes.map((contractType) => {
            const profile = contractProfiles[contractType] || {
              contractType,
              defaultPayLogic: 'PERCENTAGE' as PayLogicType,
              defaultRate: 88,
            };
            
            const isEditing = contractType in editingRates;
            const displayRate = isEditing ? editingRates[contractType] : profile.defaultRate.toString();

            return (
              <div
                key={contractType}
                className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30"
              >
                {/* Contract Type Name */}
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-sm">{contractType}</span>
                </div>

                {/* Pay Logic Selector */}
                <Select
                  value={profile.defaultPayLogic}
                  onValueChange={(v) => handlePayLogicChange(contractType, v as PayLogicType)}
                >
                  <SelectTrigger className="w-32 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENTAGE">
                      <div className="flex items-center gap-1">
                        <Percent className="h-3 w-3" />
                        Percentage
                      </div>
                    </SelectItem>
                    <SelectItem value="MILEAGE">
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        Per Mile
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>

                {/* Rate Input */}
                <div className="flex items-center gap-1">
                  {profile.defaultPayLogic === 'MILEAGE' && (
                    <span className="text-muted-foreground text-sm">$</span>
                  )}
                  <Input
                    type="number"
                    value={displayRate}
                    onChange={(e) => handleRateChange(contractType, e.target.value)}
                    onBlur={() => handleRateBlur(contractType)}
                    className="w-20 h-8 text-sm"
                    step={profile.defaultPayLogic === 'PERCENTAGE' ? 1 : 0.01}
                    min={0}
                    max={profile.defaultPayLogic === 'PERCENTAGE' ? 100 : 10}
                  />
                  {profile.defaultPayLogic === 'PERCENTAGE' ? (
                    <span className="text-muted-foreground text-sm">%</span>
                  ) : (
                    <span className="text-muted-foreground text-sm">/mi</span>
                  )}
                </div>

                {/* Preview Badge */}
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-xs whitespace-nowrap",
                    profile.defaultPayLogic === 'PERCENTAGE'
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                      : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                  )}
                >
                  {formatRate(profile.defaultPayLogic, profile.defaultRate)}
                </Badge>

                {/* Delete Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteContractType(contractType)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>

        {/* Add New Contract Type */}
        <div className="flex gap-2 pt-2 border-t">
          <Input
            placeholder="New contract type name"
            value={newTypeName}
            onChange={(e) => setNewTypeName(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleAddContractType()}
            className="flex-1"
          />
          <Button onClick={handleAddContractType} size="icon">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const ChangePasswordCard = () => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setIsSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setIsSubmitting(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password updated successfully");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          Change Password
        </CardTitle>
        <CardDescription>Update your account password</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-w-md">
        <div className="space-y-2">
          <label className="text-sm font-medium">New Password</label>
          <Input
            type="password"
            placeholder="Enter new password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Confirm Password</label>
          <Input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleChangePassword()}
          />
        </div>
        <Button onClick={handleChangePassword} disabled={isSubmitting || !newPassword}>
          {isSubmitting ? "Updating..." : "Update Password"}
        </Button>
      </CardContent>
    </Card>
  );
};

const Settings = () => {
  const { 
    dropdownConfig, 
    driverProfiles,
    contractProfiles,
    updateDropdownConfig,
    deleteDriverProfile,
    updateContractProfile,
    addContractType,
    deleteContractType,
    isLoading: settingsLoading
  } = useSettings();
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const navigate = useNavigate();
  const { isAdmin, isLoading: roleLoading } = useUserRole();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email ?? undefined);
    });
  }, []);

  // Redirect non-admins to home page
  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      toast.error("Access denied: Admin privileges required");
      navigate("/");
    }
  }, [isAdmin, roleLoading, navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const handleDeleteDriver = (id: string) => {
    deleteDriverProfile(id);
    toast.success("Driver profile deleted");
  };

  // Show loading while checking role or fetching settings
  if (roleLoading || settingsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Don't render if not admin (redirect will happen)
  if (!isAdmin) {
    return null;
  }


  return (
    <div className="min-h-screen bg-background">
      <SpreadsheetHeader
        onAddRow={() => {}}
        onOpenAddDialog={() => {}}
        totalLoads={0}
        assignedDrivers={0}
        totalRevenue="$0.00"
        totalMiles={0}
        onSignOut={handleSignOut}
        currentTab="settings"
        onNavigate={(path) => navigate(path)}
        userEmail={userEmail}
        isAdmin={isAdmin}
        showKPIs={false}
      />

      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Settings</h2>
          <p className="text-muted-foreground">Configure formulas and dropdown options for your spreadsheet</p>
        </div>

        {/* Permissions - Admin Only */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Permissions</CardTitle>
              <CardDescription>
                Manage user roles and permissions for dispatchers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DispatcherManagementDialog />
            </CardContent>
          </Card>
        )}

        {/* Change Password */}
        <ChangePasswordCard />

        {/* Unified Contract Types Editor - Admin Only */}
        {isAdmin && (
          <ContractTypeEditor
            contractProfiles={contractProfiles}
            dropdownConfig={dropdownConfig}
            updateContractProfile={updateContractProfile}
            addContractType={addContractType}
            deleteContractType={deleteContractType}
          />
        )}

        {/* Driver Profiles */}
        {driverProfiles.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Driver Profiles</h2>
            <p className="text-muted-foreground">
              Saved driver profiles from your loads
            </p>
            <Card>
              <CardHeader>
                <CardTitle>Saved Driver Profiles</CardTitle>
                <CardDescription>
                  {driverProfiles.length} profile{driverProfiles.length !== 1 ? 's' : ''} saved
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {driverProfiles.map((profile) => (
                    <div
                      key={profile.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-2 flex-1">
                        <div>
                          <p className="text-sm font-medium">{profile.name}</p>
                          <p className="text-xs text-muted-foreground">{profile.phone || "No phone"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Contract</p>
                          <p className="text-sm">{profile.contractType}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Truck #</p>
                          <p className="text-sm">{profile.truckNumber || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Trailer #</p>
                          <p className="text-sm">{profile.trailerNumber || "—"}</p>
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDeleteDriver(profile.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Dropdown Configurations */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Dropdown Options</h2>
          
          <DropdownEditor
            title="Status Options"
            description="Configure available options for the Status column"
            field="status"
            dropdownConfig={dropdownConfig}
            updateDropdownConfig={updateDropdownConfig}
          />

          <DropdownEditor
            title="Invoiced Options"
            description="Configure available options for the Invoiced column"
            field="invoiced"
            dropdownConfig={dropdownConfig}
            updateDropdownConfig={updateDropdownConfig}
          />

          <DropdownEditor
            title="Trailer Type Options"
            description="Configure available trailer types for loads"
            field="trailerTypes"
            dropdownConfig={dropdownConfig}
            updateDropdownConfig={updateDropdownConfig}
          />
        </div>

        {/* Danger Zone - Admin Only */}
        {isAdmin && (
          <Collapsible>
            <Card className="border-destructive/50">
              <CardHeader className="pb-3">
                <CollapsibleTrigger className="flex items-center justify-between w-full text-left group">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    <div>
                      <CardTitle className="text-destructive">Danger Zone</CardTitle>
                      <CardDescription>Irreversible actions - expand to access</CardDescription>
                    </div>
                  </div>
                  <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <DangerZone />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}
        {/* App Version */}
        <Card>
          <CardHeader>
            <CardTitle>About</CardTitle>
            <CardDescription>Application information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Application:</span>
                <span className="text-sm font-medium">{APP_NAME}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Version:</span>
                <span className="text-sm font-mono font-medium">v{APP_VERSION}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <AppFooter />
    </div>
  );
};

export default Settings;
