import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { mobileApi } from "@/lib/mobile-api";

export default function MobileResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setBusy(true);
    try {
      const res = await mobileApi.createPassword(email.trim(), code.trim(), password);
      if (!res.status) { toast.error(res.message); return; }
      toast.success("Password updated. Please sign in.");
      navigate("/m/login", { replace: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-sidebar text-sidebar-foreground flex flex-col">
      <div className="flex-1 flex flex-col justify-center px-6 py-12">
        <div className="mx-auto w-full max-w-sm">
          <h1 className="text-2xl font-bold mb-2">Reset password</h1>
          <p className="text-sm text-sidebar-foreground/60 mb-6">Enter the code we sent + your new password.</p>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sidebar-foreground">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="bg-sidebar-accent border-sidebar-border text-sidebar-foreground" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code" className="text-sidebar-foreground">Reset code</Label>
              <Input id="code" inputMode="numeric" maxLength={6} required value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="bg-sidebar-accent border-sidebar-border text-sidebar-foreground tracking-[0.4em] text-center text-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sidebar-foreground">New password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="bg-sidebar-accent border-sidebar-border text-sidebar-foreground" />
            </div>
            <Button type="submit" disabled={busy} className="w-full h-12 text-base">
              {busy ? "Updating…" : "Update password"}
            </Button>
            <div className="text-center">
              <Link to="/m/login" className="text-sm text-primary hover:underline">Back to sign in</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
