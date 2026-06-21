import { useOrganizationContext } from "@/contexts/OrganizationContext";

export function useOrganization() {
    const { organization, isLoading } = useOrganizationContext();
    
    return { 
        organizationId: organization?.id || null, 
        organizationName: organization?.name || null, 
        isLoading 
    };
}
