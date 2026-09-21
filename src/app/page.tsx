import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bot, PhoneCall, CalendarClock, ShieldCheck } from "lucide-react";

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
      <header className="flex h-16 items-center justify-between border-b px-6">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">
            L
          </span>
          <span className="text-lg font-semibold">{PRODUCT_NAME}</span>
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
        <section className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-6 py-24 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            AI agents that call your leads, qualify them, and book the meeting.
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            {PRODUCT_NAME} is an outbound calling platform for teams that want AI voice agents running real
            campaigns — not a demo. Build an agent, load a lead list, and let it dial.
          </p>
          <div className="flex gap-3">
            <Button asChild size="lg">
              <Link href="/register">Create your account</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl grid-cols-1 gap-4 px-6 pb-24 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <Card key={feature.title}>
              <CardHeader>
                <feature.icon className="size-6 text-primary" />
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
