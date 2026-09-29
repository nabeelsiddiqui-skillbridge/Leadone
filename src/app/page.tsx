import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bot, PhoneCall, CalendarClock, ShieldCheck, Phone } from "lucide-react";

const PRODUCT_NAME = "LeadOne";

const FEATURES = [
  {
    icon: Bot,
    title: "AI voice agents",
    description: "Give every campaign a natural-sounding agent with its own script, knowledge base, and objective.",
  },
  {
    icon: PhoneCall,
    title: "Real-time phone conversations",
    description: "Low-latency, interruptible calls over Twilio with live transcripts and barge-in.",
  },
  {
    icon: CalendarClock,
    title: "Automatic appointment booking",
    description: "Agents check real calendar availability and only confirm bookings the backend verifies.",
  },
  {
    icon: ShieldCheck,
    title: "Built for teams",
    description: "Multi-tenant workspaces, row-level isolation, and a super admin console to run the whole platform.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/80 px-6 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm">
            <Phone className="size-4" strokeWidth={2.5} />
          </span>
          <span className="text-lg font-semibold tracking-tight">{PRODUCT_NAME}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Get started</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              backgroundImage:
                "radial-gradient(circle at 50% 0%, color-mix(in oklch, var(--primary) 14%, transparent), transparent 55%)",
            }}
          />
          <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-6 py-24 text-center sm:py-32">
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
              AI outbound calling, built for real campaigns
            </span>
            <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              AI agents that call your leads, qualify them, and book the meeting.
            </h1>
            <p className="max-w-2xl text-lg text-muted-foreground text-balance">
              {PRODUCT_NAME} is an outbound calling platform for teams that want AI voice agents running real
              campaigns — not a demo. Build an agent, load a lead list, and let it dial.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/register">Create your account</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl grid-cols-1 gap-4 px-6 pb-24 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <Card key={feature.title} className="border-border/80 transition-shadow hover:shadow-md">
              <CardHeader>
                <span className="mb-1 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <feature.icon className="size-5" />
                </span>
                <CardTitle className="text-base">{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          ))}
        </section>
      </main>

      <footer className="border-t px-6 py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} {PRODUCT_NAME}. All rights reserved.
      </footer>
    </div>
  );
}
