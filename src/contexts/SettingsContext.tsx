import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrganizationContext } from "./OrganizationContext";
import { ContractProfilesMap, PayLogicType } from "@/config/contractProfiles";

export interface FormulaConfig {
  driverPayPercentage: number; // Percentage of Load $ (e.g., 96 for 96%)
}

export interface DriverProfile {
  id: string;
  name: string;
  phone: string;
  contractType: string;
  truckNumber: string;
  trailerNumber: string;
}

export interface DropdownOption {
  value: string;
  label: string;
}

export interface DropdownConfig {
  status: DropdownOption[];
  invoiced: DropdownOption[];
  contractTypes: DropdownOption[];
  trailerTypes: DropdownOption[];
}

interface SettingsContextType {
  formulaConfig: FormulaConfig;
  dropdownConfig: DropdownConfig;
  driverProfiles: DriverProfile[];
  contractProfiles: ContractProfilesMap;
  isLoading: boolean;
  updateFormulaConfig: (config: Partial<FormulaConfig>) => void;
  updateDropdownConfig: (field: keyof DropdownConfig, options: DropdownOption[]) => Promise<void>;
  updateDriverProfile: (id: string, profile: Partial<DriverProfile>) => void;
  deleteDriverProfile: (id: string) => void;
  updateContractProfile: (contractType: string, payLogic: PayLogicType, rate: number) => Promise<void>;
  addContractType: (name: string, payLogic?: PayLogicType, rate?: number) => Promise<void>;
  deleteContractType: (name: string) => Promise<void>;
}

const defaultDropdownConfig: DropdownConfig = {
  status: [
    { value: "In transit", label: "In transit" },
    { value: "Covered", label: "Covered" },
    { value: "Broke Down", label: "Broke Down" },
    { value: "Empty_34hr_reset", label: "Empty 34hr reset" },
    { value: "Searching_for_load", label: "Searching for load" },
  ],
  invoiced: [
    { value: "Invoiced", label: "Invoiced" },
    { value: "Not Invoiced", label: "Not Invoiced" },
    { value: "Missing BOL", label: "Missing BOL" },
  ],
  contractTypes: [
    { value: "LP GOLD", label: "LP GOLD" },
    { value: "LP PLATINUM", label: "LP PLATINUM" },
    { value: "LP STANDARD", label: "LP STANDARD" },
    { value: "CD GOLD", label: "CD GOLD" },
    { value: "CD PLATINUM", label: "CD PLATINUM" },
    { value: "OWNER OP.", label: "OWNER OP." },
    { value: "D.F.O", label: "D.F.O" },
    { value: "TRAINING", label: "TRAINING" },
    { value: "CD C.P.M.", label: "CD C.P.M." },
    { value: "RENT", label: "RENT" },
    { value: "LP G.NEW", label: "LP G.NEW" },
    { value: "LP P.NEW", label: "LP P.NEW" },
  ],
  trailerTypes: [
    { value: "Flatbed", label: "Flatbed" },
    { value: "Step Deck", label: "Step Deck" },
    { value: "Dry Van", label: "Dry Van" },
    { value: "Reefer", label: "Reefer" },
    { value: "Conestoga", label: "Conestoga" },
    { value: "RGN", label: "RGN" },
    { value: "Lowboy", label: "Lowboy" },
  ],
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const { organization, isLoading: orgLoading } = useOrganizationContext();
  const [formulaConfig, setFormulaConfig] = useState<FormulaConfig>({
    driverPayPercentage: 96,
  });
  const [dropdownConfig, setDropdownConfig] = useState<DropdownConfig>(defaultDropdownConfig);
  const [driverProfiles, setDriverProfiles] = useState<DriverProfile[]>([]);
  const [contractProfiles, setContractProfiles] = useState<ContractProfilesMap>({});
  const [isLoading, setIsLoading] = useState(true);

  // Fetch settings when organization is loaded
  useEffect(() => {
    const fetchSettingsFromDb = async () => {
      // Wait for organization to be determined
      if (orgLoading) return;
      
      // If no organization, use defaults
      if (!organization) {
        setIsLoading(false);
        return;
      }

      try {
        console.log('Fetching settings for organization:', organization.id, organization.name);

        // Fetch organization settings
        const { data: settings, error } = await supabase
          .from('organization_settings')
          .select('setting_key, setting_value')
          .eq('organization_id', organization.id);

        console.log('Fetched organization settings:', settings);

        if (error) {
          console.error('Error fetching settings:', error);
          setIsLoading(false);
          return;
        }

        // Apply settings from database, merging with defaults
        if (settings && settings.length > 0) {
          const newConfig = { ...defaultDropdownConfig };
          
          settings.forEach((setting) => {
            const key = setting.setting_key.replace('dropdown_', '') as keyof DropdownConfig;
            console.log('Processing setting:', setting.setting_key, '-> key:', key, 'value:', setting.setting_value);
            if (key in newConfig && Array.isArray(setting.setting_value)) {
              // Cast through unknown to handle Json type
              newConfig[key] = setting.setting_value as unknown as DropdownOption[];
            }
            
            // Handle formula config
            if (setting.setting_key === 'formula_driverPayPercentage') {
              setFormulaConfig(prev => ({
                ...prev,
                driverPayPercentage: setting.setting_value as unknown as number
              }));
            }

            // Handle contract profiles — saved value is the single source of truth.
            // If admin removed all contract types, no auto-calc should apply.
            if (setting.setting_key === 'contract_profiles') {
              const savedProfiles = (setting.setting_value || {}) as unknown as Record<string, { payLogic: PayLogicType; rate: number }>;
              const next: ContractProfilesMap = {};
              Object.entries(savedProfiles).forEach(([key, value]) => {
                next[key] = {
                  contractType: key,
                  defaultPayLogic: value.payLogic,
                  defaultRate: value.rate,
                };
              });
              setContractProfiles(next);
            }
          });

          console.log('Final newConfig after DB merge:', newConfig);
          setDropdownConfig(newConfig);
        } else {
          console.log('No settings found in DB, using defaults');
          setDropdownConfig(defaultDropdownConfig);
        }
      } catch (error) {
        console.error('Error in fetchSettingsFromDb:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettingsFromDb();
  }, [organization, orgLoading]);

  // Reset to defaults on sign out
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setDropdownConfig(defaultDropdownConfig);
        setFormulaConfig({ driverPayPercentage: 96 });
        setContractProfiles({});
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const updateFormulaConfig = useCallback(async (config: Partial<FormulaConfig>) => {
    setFormulaConfig((prev) => ({ ...prev, ...config }));

    // Save to database if we have an organization
    if (organization && config.driverPayPercentage !== undefined) {
      const { error } = await supabase
        .from('organization_settings')
        .upsert({
          organization_id: organization.id,
          setting_key: 'formula_driverPayPercentage',
          setting_value: config.driverPayPercentage,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'organization_id,setting_key'
        });

      if (error) {
        console.error('Error saving formula config:', error);
        toast.error('Failed to save formula settings');
      }
    }
  }, [organization]);

  const updateDropdownConfig = useCallback(async (field: keyof DropdownConfig, options: DropdownOption[]) => {
    // Update local state immediately for responsive UI
    setDropdownConfig((prev) => ({ ...prev, [field]: options }));

    // Save to database if we have an organization
    if (organization) {
      console.log('Saving dropdown config to DB:', field, options, 'org:', organization.id);
      // Use from() with type override to handle Json type compatibility
      const { error } = await (supabase
        .from('organization_settings') as any)
        .upsert({
          organization_id: organization.id,
          setting_key: `dropdown_${field}`,
          setting_value: options,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'organization_id,setting_key'
        });

      if (error) {
        console.error('Error saving dropdown config:', error);
        toast.error('Failed to save settings');
        return;
      }
      
      console.log('Successfully saved dropdown config');
    } else {
      console.warn('No organization available, settings not saved to DB');
    }
  }, [organization]);

  const updateDriverProfile = (id: string, profile: Partial<DriverProfile>) => {
    setDriverProfiles((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...profile } : p))
    );
  };

  const deleteDriverProfile = (id: string) => {
    setDriverProfiles((prev) => prev.filter((p) => p.id !== id));
  };

  const saveContractProfilesToDb = useCallback(async (profiles: ContractProfilesMap) => {
    if (!organization) return;
    
    const profilesForStorage: Record<string, { payLogic: PayLogicType; rate: number }> = {};
    Object.entries(profiles).forEach(([key, value]) => {
      profilesForStorage[key] = {
        payLogic: value.defaultPayLogic,
        rate: value.defaultRate,
      };
    });

    const { error } = await (supabase
      .from('organization_settings') as any)
      .upsert({
        organization_id: organization.id,
        setting_key: 'contract_profiles',
        setting_value: profilesForStorage,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'organization_id,setting_key'
      });

    if (error) {
      console.error('Error saving contract profiles:', error);
      throw error;
    }
  }, [organization]);

  const updateContractProfile = useCallback(async (contractType: string, payLogic: PayLogicType, rate: number) => {
    const updatedProfiles = {
      ...contractProfiles,
      [contractType]: {
        contractType,
        defaultPayLogic: payLogic,
        defaultRate: rate,
      },
    };
    
    setContractProfiles(updatedProfiles);

    try {
      await saveContractProfilesToDb(updatedProfiles);
      toast.success('Contract rate updated');
    } catch {
      toast.error('Failed to save contract rate');
    }
  }, [contractProfiles, saveContractProfilesToDb]);

  const addContractType = useCallback(async (name: string, payLogic: PayLogicType = 'PERCENTAGE', rate: number = 100) => {
    if (!name.trim()) {
      toast.error('Contract type name cannot be empty');
      return;
    }

    // Check if already exists
    if (dropdownConfig.contractTypes.some(ct => ct.value === name)) {
      toast.error('Contract type already exists');
      return;
    }

    // 1. Add to dropdown config
    const updatedTypes = [...dropdownConfig.contractTypes, { value: name, label: name }];
    await updateDropdownConfig('contractTypes', updatedTypes);

    // 2. Add to contract profiles
    const updatedProfiles = {
      ...contractProfiles,
      [name]: {
        contractType: name,
        defaultPayLogic: payLogic,
        defaultRate: rate,
      },
    };
    setContractProfiles(updatedProfiles);

    try {
      await saveContractProfilesToDb(updatedProfiles);
      toast.success('Contract type added');
    } catch {
      toast.error('Failed to save contract type');
    }
  }, [dropdownConfig.contractTypes, contractProfiles, updateDropdownConfig, saveContractProfilesToDb]);

  const deleteContractType = useCallback(async (name: string) => {
    // 1. Remove from dropdown config
    const updatedTypes = dropdownConfig.contractTypes.filter(ct => ct.value !== name);
    await updateDropdownConfig('contractTypes', updatedTypes);

    // 2. Remove from contract profiles
    const { [name]: _, ...remainingProfiles } = contractProfiles;
    setContractProfiles(remainingProfiles);

    try {
      await saveContractProfilesToDb(remainingProfiles);
      toast.success('Contract type deleted');
    } catch {
      toast.error('Failed to delete contract type');
    }
  }, [dropdownConfig.contractTypes, contractProfiles, updateDropdownConfig, saveContractProfilesToDb]);
  return (
    <SettingsContext.Provider
      value={{
        formulaConfig,
        dropdownConfig,
        driverProfiles,
        contractProfiles,
        isLoading: isLoading || orgLoading,
        updateFormulaConfig,
        updateDropdownConfig,
        updateDriverProfile,
        deleteDriverProfile,
        updateContractProfile,
        addContractType,
        deleteContractType,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return context;
};
