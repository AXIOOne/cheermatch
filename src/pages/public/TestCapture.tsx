import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Loader2, Smartphone, PlayCircle, Send } from "lucide-react";

const APP_URL = "https://apps.apple.com/kg/app/varsity-virtual-compete/id6800264562";

function embed(url: string) {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return url;
}

export default function TestCapture() {
  const [video, setVideo] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | "new" | "already">(null);

  useEffect(() => {
    document.title = "Test Capture | Varsity Virtual";
    supabase.functions.invoke("request-test-registration", { body: { action: "info" } })
      .then(({ data }) => setVideo(data?.training_video_url ?? null));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const p = z.string().trim().email().max(255).safeParse(email);
    if (!p.success) return setError("Please enter a valid email address.");
    setBusy(true);
    const { data, error: fnErr } = await supabase.functions.invoke("request-test-registration", {
      body: { action: "request", email: p.data },
    });
    setBusy(false);
    if (data?.success) return setDone(data.already ? "already" : "new");
    let msg = data?.error as string | undefined;
    if (!msg && fnErr && "context" in fnErr) {
      try { msg = (await (fnErr as { context: Response }).context.json()).error; } catch { /* ignore */ }
    }
    setError(msg || "Something went wrong. Please try again.");
  };

  const step = (n: number, Icon: typeof Smartphone, title: string) => (
    <div className="flex items-center gap-3 mb-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">{n}</span>
      <Icon className="h-5 w-5 text-primary" />
      <h2 className="font-heading text-xl font-bold">{title}</h2>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/40 font-body">
      <div className="mx-auto max-w-2xl px-4 py-10 space-y-6">
        <header className="text-center">
          <h1 className="font-heading text-3xl font-bold text-primary">Varsity Virtual Test Capture</h1>
          <p className="text-muted-foreground mt-2">Get ready for competition by running a practice capture.</p>
        </header>

        <Card><CardContent className="pt-6">
          {step(1, Smartphone, "Download the iOS Capture App")}
          <p className="text-sm text-muted-foreground mb-4">Install the Varsity Virtual Compete app on the iPhone or iPad you'll record with.</p>
          <Button asChild><a href={APP_URL} target="_blank" rel="noreferrer">Download on the App Store</a></Button>
        </CardContent></Card>

        <Card><CardContent className="pt-6">
          {step(2, PlayCircle, "Watch the training video")}
          {video ? (
            <div className="aspect-video overflow-hidden rounded-lg bg-muted">
              <iframe src={embed(video)} title="Training video" className="h-full w-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
            </div>
          ) : (
            <div className="aspect-video rounded-lg bg-muted flex items-center justify-center text-muted-foreground">Training video coming soon</div>
          )}
        </CardContent></Card>

        <Card><CardContent className="pt-6">
          {step(3, Send, "Request a test submission")}
          {done ? (
            <div className="flex gap-3 rounded-lg border p-4">
              <CheckCircle2 className="h-6 w-6 text-primary shrink-0" />
              <div>
                <p className="font-semibold">{done === "already" ? "You're already set up!" : "Your test registration is ready!"}</p>
                <p className="text-sm text-muted-foreground">Open the Capture App, sign in, choose CheerMatch TEST Event, and record your test routine.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <p className="text-sm text-muted-foreground">Enter the email address your coach account was created with.</p>
              <Input type="email" placeholder="coach@example.com" value={email} maxLength={255} onChange={(e) => setEmail(e.target.value)} />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Request test</Button>
            </form>
          )}
        </CardContent></Card>

        <p className="text-center text-sm text-muted-foreground">
          Questions or need help? Contact <a className="text-primary underline" href="mailto:support@cheermatch.com">support@cheermatch.com</a>
        </p>
      </div>
    </div>
  );
}
