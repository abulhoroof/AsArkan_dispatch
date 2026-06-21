import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useUserRole } from "@/hooks/useUserRole";
import { useSubdomain } from "@/hooks/useSubdomain";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, XCircle, AlertTriangle, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface OrgMembership {
  organization_id: string;
  org_name: string;
  org_slug: string;
  role: string;
}

interface DataCounts {
  loads: number;
  drivers: number;
  notifications: number;
}

interface IsolationTest {
  name: string;
  passed: boolean;
  details: string;
}

export default function MultiOrgDiagnostics() {
  const { organizationId, organizationName, isLoading: orgLoading } = useOrganization();
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const subdomainInfo = useSubdomain();
  const navigate = useNavigate();

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [dataCounts, setDataCounts] = useState<DataCounts | null>(null);
  const [isolationTests, setIsolationTests] = useState<IsolationTest[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      navigate("/");
    }
  }, [isAdmin, roleLoading, navigate]);

  useEffect(() => {
    fetchUserInfo();
  }, []);

  useEffect(() => {
    if (userId && organizationId) {
      runDiagnostics();
    }
  }, [userId, organizationId]);

  const fetchUserInfo = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      setUserEmail(user.email || null);
    }
  };

  const runDiagnostics = async () => {
    if (!userId || !organizationId) return;
    setIsRunning(true);

    try {
      // 1. Fetch all org memberships for this user
      const { data: membershipData } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', userId);

      if (membershipData) {
        const orgsWithDetails: OrgMembership[] = [];
        
        for (const membership of membershipData) {
          // Get org details
          const { data: orgData } = await supabase
            .from('organizations')
            .select('name, slug')
            .eq('id', membership.organization_id)
            .single();

          // Get role for this org
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', userId)
            .eq('organization_id', membership.organization_id);

          const roles = roleData?.map(r => r.role).join(', ') || 'none';

          orgsWithDetails.push({
            organization_id: membership.organization_id,
            org_name: orgData?.name || 'Unknown',
            org_slug: orgData?.slug || 'unknown',
            role: roles,
          });
        }

        setMemberships(orgsWithDetails);
      }

      // 2. Fetch data counts for CURRENT org context
      const [loadsResult, driversResult, notificationsResult] = await Promise.all([
        supabase.from('loads').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
        supabase.from('drivers').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
        supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      ]);

      setDataCounts({
        loads: loadsResult.count || 0,
        drivers: driversResult.count || 0,
        notifications: notificationsResult.count || 0,
      });

      // 3. Run isolation tests
      const tests: IsolationTest[] = [];

      // Test 1: Verify subdomain matches org slug
      const currentOrg = membershipData?.find(m => m.organization_id === organizationId);
      const orgDetails = await supabase
        .from('organizations')
        .select('slug')
        .eq('id', organizationId)
        .single();

      const subdomainMatchesSlug = subdomainInfo.subdomain === orgDetails.data?.slug;
      tests.push({
        name: 'Subdomain matches organization slug',
        passed: subdomainMatchesSlug,
        details: `Subdomain: "${subdomainInfo.subdomain}" | Org slug: "${orgDetails.data?.slug}"`,
      });

      // Test 2: Verify user is member of current org
      const isMemberOfCurrentOrg = membershipData?.some(m => m.organization_id === organizationId) || false;
      tests.push({
        name: 'User is member of current organization',
        passed: isMemberOfCurrentOrg,
        details: `Organization ID: ${organizationId}`,
      });

      // Test 3: Verify is_admin_of_org returns correct value
      const { data: isAdminResult } = await supabase.rpc('is_admin_of_org', { org_id: organizationId });
      const { data: roleCheck } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('organization_id', organizationId)
        .eq('role', 'admin');

      const expectedAdmin = (roleCheck?.length || 0) > 0;
      tests.push({
        name: 'is_admin_of_org returns correct value',
        passed: isAdminResult === expectedAdmin,
        details: `RPC result: ${isAdminResult} | Expected: ${expectedAdmin}`,
      });

      // Test 4: Verify loads are only from current org
      const { data: loadOrgIds } = await supabase
        .from('loads')
        .select('organization_id')
        .limit(100);

      const allLoadsFromCurrentOrg = loadOrgIds?.every(l => l.organization_id === organizationId) ?? true;
      tests.push({
        name: 'All visible loads belong to current organization',
        passed: allLoadsFromCurrentOrg,
        details: `Checked ${loadOrgIds?.length || 0} loads`,
      });

      // Test 5: Verify drivers are only from current org
      const { data: driverOrgIds } = await supabase
        .from('drivers')
        .select('organization_id')
        .limit(100);

      const allDriversFromCurrentOrg = driverOrgIds?.every(d => d.organization_id === organizationId) ?? true;
      tests.push({
        name: 'All visible drivers belong to current organization',
        passed: allDriversFromCurrentOrg,
        details: `Checked ${driverOrgIds?.length || 0} drivers`,
      });

      // Test 6: Check if user has different roles in different orgs
      if (memberships.length > 1) {
        const rolesVary = new Set(memberships.map(m => m.role)).size > 1;
        tests.push({
          name: 'Multi-org role differentiation',
          passed: true, // Informational
          details: rolesVary 
            ? 'User has different roles across organizations - isolation is critical' 
            : 'User has same role in all organizations',
        });
      }

      setIsolationTests(tests);
    } catch (error) {
      console.error('Diagnostics error:', error);
    } finally {
      setIsRunning(false);
    }
  };

  if (orgLoading || roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const passedTests = isolationTests.filter(t => t.passed).length;
  const totalTests = isolationTests.length;

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Multi-Org Data Isolation Diagnostics</h1>
          <p className="text-muted-foreground">Verify data isolation for multi-organization users</p>
        </div>
      </div>

      {/* Current Context */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Current Context</CardTitle>
          <CardDescription>Your current session information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">User ID:</span>
              <p className="font-mono text-xs break-all">{userId}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Email:</span>
              <p>{userEmail}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Subdomain:</span>
              <p className="font-semibold">{subdomainInfo.subdomain || '(none)'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Current Organization:</span>
              <p className="font-semibold">{organizationName}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Organization ID:</span>
              <p className="font-mono text-xs break-all">{organizationId}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Admin Status:</span>
              <Badge variant={isAdmin ? "default" : "secondary"}>
                {isAdmin ? 'Admin' : 'Dispatcher'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Organization Memberships */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Organization Memberships</CardTitle>
          <CardDescription>
            All organizations this user belongs to ({memberships.length} total)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {memberships.length === 0 ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : (
            <div className="space-y-2">
              {memberships.map((m) => (
                <div
                  key={m.organization_id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    m.organization_id === organizationId
                      ? 'bg-primary/10 border-primary'
                      : 'bg-muted/50'
                  }`}
                >
                  <div>
                    <p className="font-medium">{m.org_name}</p>
                    <p className="text-sm text-muted-foreground">Slug: {m.org_slug}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{m.role}</Badge>
                    {m.organization_id === organizationId && (
                      <Badge variant="default">Current</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {memberships.length > 1 && (
            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-700">Multi-Organization User</p>
                <p className="text-yellow-600">
                  This user belongs to {memberships.length} organizations. Data isolation must be verified.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Counts */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Visible Data (Current Org Only)</CardTitle>
          <CardDescription>Data accessible in the current organization context</CardDescription>
        </CardHeader>
        <CardContent>
          {dataCounts ? (
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-3xl font-bold">{dataCounts.loads}</p>
                <p className="text-sm text-muted-foreground">Loads</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-3xl font-bold">{dataCounts.drivers}</p>
                <p className="text-sm text-muted-foreground">Drivers</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-3xl font-bold">{dataCounts.notifications}</p>
                <p className="text-sm text-muted-foreground">Notifications</p>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">Loading...</p>
          )}
        </CardContent>
      </Card>

      {/* Isolation Tests */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            Isolation Tests
            {!isRunning && totalTests > 0 && (
              <Badge variant={passedTests === totalTests ? "default" : "destructive"}>
                {passedTests}/{totalTests} Passed
              </Badge>
            )}
          </CardTitle>
          <CardDescription>Automated checks for data isolation integrity</CardDescription>
        </CardHeader>
        <CardContent>
          {isRunning ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              Running diagnostics...
            </div>
          ) : (
            <div className="space-y-3">
              {isolationTests.map((test, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    test.passed ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'
                  }`}
                >
                  {test.passed ? (
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  )}
                  <div>
                    <p className="font-medium">{test.name}</p>
                    <p className="text-sm text-muted-foreground">{test.details}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator className="my-6" />

      <p className="text-center text-sm text-muted-foreground">
        This diagnostic page is only accessible to organization admins.
      </p>
    </div>
  );
}
