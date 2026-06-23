import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { mobileApi } from "@/lib/mobile-api";

export default function MobileForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await mobileApi.forgotPassword(email.trim());
      toast.success(res.message);
      navigate(`/m/reset-password?email=${encodeURIComponent(email.trim())}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-sidebar text-sidebar-foreground flex flex-col">
      <div className="flex-1 flex flex-col justify-center px-6 py-12">
        <div className="mx-auto w-full max-w-sm">
          <h1 className="text-2xl font-bold mb-2">Forgot password</h1>
          <p className="text-sm text-sidebar-foreground/60 mb-6">We'll email you a 6-digit reset code.</p>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sidebar-foreground">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="bg-sidebar-accent border-sidebar-border text-sidebar-foreground" />
            </div>
            <Button type="submit" disabled={busy} className="w-full h-12 text-base">
              {busy ? "Sending…" : "Send reset code"}
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
