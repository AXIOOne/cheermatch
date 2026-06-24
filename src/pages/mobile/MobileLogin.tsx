import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { mobileApi } from "@/lib/mobile-api";
import { useMobileAuth } from "@/hooks/useMobileAuth";
import logoWhite from "@/assets/logo-white.png.asset.json";

export default function MobileLogin() {
  const navigate = useNavigate();
  const { setUser } = useMobileAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await mobileApi.login(email.trim(), password);
      if (!res.status) {
        toast.error(res.message || "Login failed");
        return;
      }
      setUser(res.data);
      navigate("/m", { replace: true });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-sidebar text-sidebar-foreground flex flex-col">
      <div className="flex-1 flex flex-col justify-center px-6 py-12">
        <div className="mx-auto w-full max-w-sm">
          <div className="text-center mb-8">
            <img src={logoWhite.url} alt="Logo" className="mx-auto w-full max-w-[280px] h-auto mb-4 object-contain" />
            <h1 className="text-2xl font-bold">Routine Submission Application</h1>
            <p className="text-sm text-sidebar-foreground/60 mt-1">Capture and submit your team's performance</p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sidebar-foreground">Email</Label>
              <Input id="email" type="email" autoComplete="email" required
                value={email} onChange={(e) => setEmail(e.target.value)}
                className="bg-sidebar-accent border-sidebar-border text-sidebar-foreground" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sidebar-foreground">Password</Label>
              <Input id="password" type="password" autoComplete="current-password" required
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="bg-sidebar-accent border-sidebar-border text-sidebar-foreground" />
            </div>
            <Button type="submit" disabled={busy} className="w-full h-12 text-base">
              {busy ? "Signing in…" : "Sign in"}
            </Button>
            <div className="text-center">
              <Link to="/m/forgot-password" className="text-sm text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
