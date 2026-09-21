import Link from "next/link";
import type { Metadata } from "next";

import { requireCurrentWorkspace } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, Phone, CalendarClock, Megaphone } from "lucide-react";

export const metadata: Metadata = { title: "Welcome" };

const steps = [
  { icon: Bot, title: "Create your first AI agent", description: "Give it a name, a voice, and a script.", href: "/agents/new" },
  { icon: Phone, title: "Connect a phone number", description: "Sync a Twilio number so your agent can call out.", href: "/phone-numbers" },
  { icon: CalendarClock, title: "Connect your calendar", description: "Let your agent book real appointments.", href: "/settings" },
  { icon: Megaphone, title: "Launch a campaign", description: "Upload leads and start calling.", href: "/campaigns/new" },
];

export default async function OnboardingPage() {
  const { workspace } = await requireCurrentWorkspace();

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold">Welcome to LeadOne, {workspace.name}</h1>
          <p className="mt-1 text-muted-foreground">
            Here&apos;s how to get your first AI calling campaign live.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {steps.map((step) => (
            <Card key={step.href}>
              <CardHeader>
                <step.icon className="size-6 text-primary" />
                <CardTitle className="text-base">{step.title}</CardTitle>
                <CardDescription>{step.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" size="sm">
                  <Link href={step.href}>Start</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Button asChild>
            <Link href="/dashboard">Skip to dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
