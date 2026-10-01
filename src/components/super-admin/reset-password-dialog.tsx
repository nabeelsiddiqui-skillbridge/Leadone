"use client";

import { useState, useTransition } from "react";
import { KeyRound, Mail, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { sendPasswordResetEmailAction, setUserPasswordAction } from "@/app/super-admin/users/actions";

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  let out = "";
  for (let i = 0; i < 14; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function ResetPasswordDialog({ userId, email }: { userId: string; email: string | null }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSendEmail() {
    startTransition(async () => {
      const result = await sendPasswordResetEmailAction(userId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Reset email sent.");
      setOpen(false);
    });
  }

  function handleSetPassword() {
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    startTransition(async () => {
      const result = await setUserPasswordAction(userId, password);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Password updated.");
      setPassword("");
      setOpen(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setPassword("");
      }}
    >
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <KeyRound /> Reset Password
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>{email ?? "This user"}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="direct">
          <TabsList className="w-full">
            <TabsTrigger value="direct" className="flex-1">
              Set directly
            </TabsTrigger>
            <TabsTrigger value="email" className="flex-1">
              Email reset link
            </TabsTrigger>
          </TabsList>

          <TabsContent value="direct" className="flex flex-col gap-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Sets a new password immediately — no email required. Share it with the user yourself.
            </p>
            <div className="grid gap-2">
              <Label htmlFor="new-password">New password</Label>
              <div className="flex gap-2">
                <Input
                  id="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
                <Button type="button" variant="outline" size="icon" onClick={() => setPassword(generatePassword())}>
                  <RefreshCw />
                  <span className="sr-only">Generate password</span>
                </Button>
              </div>
            </div>
            <Button onClick={handleSetPassword} disabled={isPending || password.length < 8}>
              {isPending ? "Updating…" : "Update password"}
            </Button>
          </TabsContent>

          <TabsContent value="email" className="flex flex-col gap-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Sends {email ?? "the user"} the standard &quot;forgot password&quot; email with a link to set their
              own new password. Requires email delivery to be working for this workspace.
            </p>
            <Button onClick={handleSendEmail} disabled={isPending || !email}>
              <Mail /> {isPending ? "Sending…" : "Send reset email"}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
