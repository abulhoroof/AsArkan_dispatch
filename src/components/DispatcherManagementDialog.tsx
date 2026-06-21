import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, ShieldAlert, Trash2, Loader2, Key, Copy, Check, AlertTriangle } from "lucide-react";
import { useOrganization } from "@/hooks/useOrganization";

interface Dispatcher {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'dispatcher';
  loadCount: number;
}

export function DispatcherManagementDialog() {
  const { organizationId } = useOrganization();
  const [open, setOpen] = useState(false);
  const [dispatchers, setDispatchers] = useState<Dispatcher[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Delete confirmation state - two-level validation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<Dispatcher | null>(null);
  const [reassignToUserId, setReassignToUserId] = useState<string>("");
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [emailConfirmation, setEmailConfirmation] = useState("");
  const [hasAcknowledged, setHasAcknowledged] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [isCountingDown, setIsCountingDown] = useState(false);

  // Reset password state
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [userToReset, setUserToReset] = useState<Dispatcher | null>(null);
  const [resetAction, setResetAction] = useState<"set_password" | "send_email">("set_password");
  const [newPassword, setNewPassword] = useState("");
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const fetchDispatchers = async () => {
    if (!organizationId) return;
    
    setIsLoading(true);
    try {
      // Get all dispatchers
      const { data: dispatcherData, error: dispatcherError } = await (supabase.rpc as any)('get_all_dispatchers', {
        p_org_id: organizationId
      });
      if (dispatcherError) throw dispatcherError;

      // Get load counts per user for this org
      const { data: loadCounts, error: loadCountError } = await supabase
        .from('loads')
        .select('user_id')
        .eq('organization_id', organizationId);
      if (loadCountError) throw loadCountError;

      // Count loads per user
      const loadCountMap: Record<string, number> = {};
      loadCounts?.forEach(load => {
        loadCountMap[load.user_id] = (loadCountMap[load.user_id] || 0) + 1;
      });

      const dispatcherList: Dispatcher[] = (dispatcherData || []).map((d: any) => ({
        id: d.id,
        email: d.email,
        name: d.name,
        role: (d.role as 'admin' | 'dispatcher') || 'dispatcher',
        loadCount: loadCountMap[d.id] || 0,
      }));

      setDispatchers(dispatcherList);
    } catch (error: any) {
      toast.error("Failed to load dispatchers: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchDispatchers();
    }
  }, [open]);

  const handlePromoteToAdmin = async (userId: string) => {
    setProcessingId(userId);
    try {
      const dispatcher = dispatchers.find(d => d.id === userId);

      if (dispatcher?.role === 'admin') {
        // Demote to dispatcher (server-side)
        const { data, error } = await supabase.functions.invoke('update-user-role', {
          body: { userId, role: 'dispatcher', organizationId },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        toast.success("User demoted to dispatcher");
      } else {
        // Promote to admin (server-side)
        const { data, error } = await supabase.functions.invoke('update-user-role', {
          body: { userId, role: 'admin', organizationId },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        toast.success("User promoted to admin");
      }

      await fetchDispatchers();
    } catch (error: any) {
      toast.error("Failed to update role: " + (error?.message || 'Unknown error'));
    } finally {
      setProcessingId(null);
    }
  };

  // Countdown timer effect for step 2
  useEffect(() => {
    if (hasAcknowledged && deleteStep === 2) {
      setCountdown(5);
      setIsCountingDown(true);
      const interval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            setIsCountingDown(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setCountdown(5);
      setIsCountingDown(false);
    }
  }, [hasAcknowledged, deleteStep]);

  const handleDeleteClick = (dispatcher: Dispatcher) => {
    setUserToDelete(dispatcher);
    setReassignToUserId("");
    setDeleteStep(1);
    setEmailConfirmation("");
    setHasAcknowledged(false);
    setCountdown(5);
    setIsCountingDown(false);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteDialogClose = (open: boolean) => {
    if (!open) {
      setDeleteStep(1);
      setEmailConfirmation("");
      setHasAcknowledged(false);
      setCountdown(5);
      setIsCountingDown(false);
      setUserToDelete(null);
      setReassignToUserId("");
    }
    setDeleteConfirmOpen(open);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) {
      setDeleteConfirmOpen(false);
      return;
    }

    setProcessingId(userToDelete.id);

    try {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: {
          userId: userToDelete.id,
          reassignToUserId: reassignToUserId || null,
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`User "${userToDelete.name}" deleted successfully`);
      await fetchDispatchers();
    } catch (error: any) {
      toast.error("Failed to delete user: " + error.message);
    } finally {
      setProcessingId(null);
      setUserToDelete(null);
      setDeleteConfirmOpen(false);
    }
  };

  const handleResetPasswordClick = (dispatcher: Dispatcher) => {
    setUserToReset(dispatcher);
    setResetAction("set_password");
    setNewPassword("");
    setGeneratedLink(null);
    setLinkCopied(false);
    setResetPasswordOpen(true);
  };

  const handleResetPassword = async () => {
    if (!userToReset) return;

    if (resetAction === "set_password" && (!newPassword || newPassword.length < 6)) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setIsResettingPassword(true);

    try {
      const { data, error } = await supabase.functions.invoke('reset-user-password', {
        body: {
          userId: userToReset.id,
          action: resetAction,
          newPassword: resetAction === "set_password" ? newPassword : undefined,
          redirectUrl: `${window.location.origin}/set-password`,
          organizationId: organizationId,
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (resetAction === "set_password") {
        toast.success(`Password updated for ${userToReset.name}`);
        setResetPasswordOpen(false);
      } else {
        // Show the generated link
        setGeneratedLink(data.resetLink);
        toast.success("Reset link generated");
      }
    } catch (error: any) {
      toast.error("Failed to reset password: " + error.message);
    } finally {
      setIsResettingPassword(false);
    }
  };

  const copyLinkToClipboard = async () => {
    if (generatedLink) {
      await navigator.clipboard.writeText(generatedLink);
      setLinkCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  // Get current user to prevent self-actions
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id || null);
    });
  }, []);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Shield className="h-4 w-4" />
            Permissions
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Permissions
            </DialogTitle>
            <DialogDescription>
              Manage user roles, promote dispatchers to admin, or delete users and reassign their loads.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {dispatchers.map((dispatcher) => (
                <div
                  key={dispatcher.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {dispatcher.name}
                        {dispatcher.role === 'admin' && (
                          <Badge variant="default" className="text-xs">
                            <Shield className="h-3 w-3 mr-1" />
                            Admin
                          </Badge>
                        )}
                        {dispatcher.id === currentUserId && (
                          <Badge variant="outline" className="text-xs">You</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {dispatcher.email} · {dispatcher.loadCount} loads
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {dispatcher.id !== currentUserId && (
                      <>
                        <Button
                          variant={dispatcher.role === 'admin' ? 'destructive' : 'outline'}
                          size="sm"
                          onClick={() => handlePromoteToAdmin(dispatcher.id)}
                          disabled={processingId === dispatcher.id}
                        >
                          {processingId === dispatcher.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : dispatcher.role === 'admin' ? (
                            <>
                              <ShieldAlert className="h-4 w-4 mr-1" />
                              Demote
                            </>
                          ) : (
                            <>
                              <Shield className="h-4 w-4 mr-1" />
                              Promote
                            </>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleResetPasswordClick(dispatcher)}
                          disabled={processingId === dispatcher.id}
                          title="Reset Password"
                        >
                          <Key className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(dispatcher)}
                          disabled={processingId === dispatcher.id}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={handleDeleteDialogClose}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete User - Step {deleteStep} of 2
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                {/* Admin warning banner */}
                {userToDelete?.role === 'admin' && (
                  <div className="bg-destructive/10 border border-destructive/30 text-destructive p-3 rounded-lg flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 flex-shrink-0" />
                    <span className="font-medium">Warning: This user is an ADMIN</span>
                  </div>
                )}

                {deleteStep === 1 ? (
                  <>
                    <p>
                      You are about to delete <strong>{userToDelete?.name}</strong> ({userToDelete?.email}).
                    </p>

                    {userToDelete && userToDelete.loadCount > 0 && (
                      <div className="bg-muted p-3 rounded-lg">
                        <p className="font-medium mb-2">
                          This user has {userToDelete.loadCount} loads. What would you like to do?
                        </p>
                        <Select value={reassignToUserId || "delete_all"} onValueChange={(v) => setReassignToUserId(v === "delete_all" ? "" : v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Delete all loads (default)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="delete_all">Delete all loads</SelectItem>
                            {dispatchers
                              .filter(d => d.id !== userToDelete.id)
                              .map(d => (
                                <SelectItem key={d.id} value={d.id}>
                                  Reassign to {d.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="email-confirm">Type the user's email to confirm:</Label>
                      <p className="text-sm font-mono bg-muted px-2 py-1 rounded select-all">
                        {userToDelete?.email}
                      </p>
                      <Input
                        id="email-confirm"
                        type="email"
                        placeholder="Type email here..."
                        value={emailConfirmation}
                        onChange={(e) => setEmailConfirmation(e.target.value)}
                        onPaste={(e) => e.preventDefault()}
                        autoComplete="off"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <p>
                      Final confirmation for deleting <strong>{userToDelete?.name}</strong>.
                    </p>

                    <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                      <Checkbox
                        id="acknowledge"
                        checked={hasAcknowledged}
                        onCheckedChange={(checked) => setHasAcknowledged(checked === true)}
                      />
                      <Label htmlFor="acknowledge" className="text-sm leading-relaxed cursor-pointer">
                        I understand this action is <strong>permanent</strong> and <strong>cannot be undone</strong>.
                        {userToDelete?.role === 'admin' && (
                          <span className="text-destructive"> I am deleting an admin user.</span>
                        )}
                      </Label>
                    </div>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {deleteStep === 1 ? (
              <>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <Button
                  onClick={() => setDeleteStep(2)}
                  disabled={emailConfirmation.toLowerCase() !== userToDelete?.email.toLowerCase()}
                >
                  Continue →
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setDeleteStep(1)}>
                  ← Back
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteConfirm}
                  disabled={!hasAcknowledged || isCountingDown || processingId !== null}
                >
                  {processingId ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />Deleting...</>
                  ) : isCountingDown ? (
                    `Delete User (${countdown}s)`
                  ) : (
                    'Delete User'
                  )}
                </Button>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetPasswordOpen} onOpenChange={setResetPasswordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Reset Password
            </DialogTitle>
            <DialogDescription>
              Reset password for <strong>{userToReset?.name}</strong> ({userToReset?.email})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reset Method</Label>
              <Select 
                value={resetAction} 
                onValueChange={(v) => {
                  setResetAction(v as "set_password" | "send_email");
                  setGeneratedLink(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="set_password">Set new password directly</SelectItem>
                  <SelectItem value="send_email">Generate reset link</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {resetAction === "set_password" && (
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="Enter new password (min 6 characters)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
            )}

            {resetAction === "send_email" && generatedLink && (
              <div className="space-y-2">
                <Label>Reset Link</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={generatedLink}
                    className="text-xs"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyLinkToClipboard}
                  >
                    {linkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Share this link with the user. It will expire after use.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setResetPasswordOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleResetPassword}
                disabled={isResettingPassword || (resetAction === "set_password" && newPassword.length < 6)}
              >
                {isResettingPassword ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {resetAction === "set_password" ? "Set Password" : "Generate Link"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}