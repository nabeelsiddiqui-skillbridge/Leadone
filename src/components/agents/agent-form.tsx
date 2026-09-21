"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { createAgentAction, updateAgentAction, type AgentFormValues } from "@/app/(app)/agents/actions";

const REALTIME_VOICES = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "sage",
  "shimmer",
  "verse",
] as const;

const formSchema = z
  .object({
    name: z.string().trim().min(1, "Agent name is required").max(200),
    company_name: z.string().trim().max(200),
    agent_role: z.string().trim().max(200),
    primary_objective: z.string().trim().max(1000),
    language: z.string().trim().min(1, "Language is required").max(20),
    accent: z.string().trim().max(100),
    voice: z.string().trim().min(1, "Voice is required"),
    opening_greeting: z.string().trim().max(2000),
    system_prompt: z.string().trim().max(8000),
    conversation_instructions: z.string().trim().max(8000),
    qualification_questions: z.array(
      z.object({ value: z.string().trim().min(1, "Question cannot be empty").max(500) })
    ),
    objection_handling: z.string().trim().max(8000),
    closing_instructions: z.string().trim().max(4000),
    voicemail_message: z.string().trim().max(2000),
    response_length: z.enum(["concise", "balanced", "detailed"]),
    creativity: z.number().min(0, "Minimum is 0.00").max(1, "Maximum is 1.00"),
    interruptions_enabled: z.boolean(),
    appointment_booking_enabled: z.boolean(),
    call_transfer_enabled: z.boolean(),
    transfer_phone_number: z.string().trim().max(30),
    max_call_duration_seconds: z
      .number()
      .int()
      .min(30, "Minimum is 30 seconds")
      .max(3600, "Maximum is 3600 seconds"),
    silence_timeout_seconds: z
      .number()
      .int()
      .min(1, "Minimum is 1 second")
      .max(120, "Maximum is 120 seconds"),
    end_call_rules: z.string().trim().max(4000),
    knowledge_base_ids: z.array(z.string()),
  })
  .superRefine((data, ctx) => {
    if (data.call_transfer_enabled && data.transfer_phone_number.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A transfer phone number is required when call transfer is enabled.",
        path: ["transfer_phone_number"],
      });
    }
  });

type FormValues = z.infer<typeof formSchema>;

const DEFAULT_VALUES: FormValues = {
  name: "",
  company_name: "",
  agent_role: "",
  primary_objective: "",
  language: "en-US",
  accent: "",
  voice: "alloy",
  opening_greeting: "",
  system_prompt: "",
  conversation_instructions: "",
  qualification_questions: [],
  objection_handling: "",
  closing_instructions: "",
  voicemail_message: "",
  response_length: "concise",
  creativity: 0.3,
  interruptions_enabled: true,
  appointment_booking_enabled: false,
  call_transfer_enabled: false,
  transfer_phone_number: "",
  max_call_duration_seconds: 900,
  silence_timeout_seconds: 10,
  end_call_rules: "",
  knowledge_base_ids: [],
};

export interface KnowledgeBaseOption {
  id: string;
  name: string;
}

export interface AgentFormProps {
  mode: "create" | "edit";
  agentId?: string;
  defaultValues?: Partial<FormValues>;
  knowledgeBases: KnowledgeBaseOption[];
}

function toActionValues(values: FormValues): AgentFormValues {
  return {
    ...values,
    qualification_questions: values.qualification_questions
      .map((q) => q.value.trim())
      .filter((q) => q.length > 0),
  };
}

export function AgentForm({ mode, agentId, defaultValues, knowledgeBases }: AgentFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState("basics");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { ...DEFAULT_VALUES, ...defaultValues },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "qualification_questions",
  });

  const callTransferEnabled = useWatch({
    control: form.control,
    name: "call_transfer_enabled",
  });

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const actionValues = toActionValues(values);
      const result =
        mode === "create"
          ? await createAgentAction(actionValues)
          : await updateAgentAction(agentId!, actionValues);

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      if (mode === "edit") {
        toast.success("Agent updated.");
        router.refresh();
      }
      // On create, createAgentAction redirects to the new agent's page itself.
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="basics">Basics</TabsTrigger>
            <TabsTrigger value="conversation">Conversation</TabsTrigger>
            <TabsTrigger value="behavior">Behavior</TabsTrigger>
            <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
          </TabsList>

          <TabsContent value="basics">
            <Card>
              <CardHeader>
                <CardTitle>Basics</CardTitle>
                <CardDescription>Who this agent is and how it introduces itself.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Agent name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Ava — Outbound SDR" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="company_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company name</FormLabel>
                      <FormControl>
                        <Input placeholder="The company the agent represents" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="agent_role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agent role</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Sales development rep" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="primary_objective"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Primary objective</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Qualify the lead and book a demo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="language"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Language</FormLabel>
                      <FormControl>
                        <Input placeholder="en-US" {...field} />
                      </FormControl>
                      <FormDescription>A BCP-47 language tag, e.g. en-US, es-MX.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="accent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Accent</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Neutral American" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="voice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Voice</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a voice" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {REALTIME_VOICES.map((voice) => (
                            <SelectItem key={voice} value={voice}>
                              {voice}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>An OpenAI Realtime API voice name.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="conversation">
            <Card>
              <CardHeader>
                <CardTitle>Conversation</CardTitle>
                <CardDescription>
                  How the agent opens, qualifies, handles objections, and closes a call.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <FormField
                  control={form.control}
                  name="opening_greeting"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Opening greeting</FormLabel>
                      <FormControl>
                        <Textarea rows={2} placeholder="Hi, this is Ava calling from…" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="system_prompt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>System prompt</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={6}
                          placeholder="The core instructions that define this agent's behavior."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="conversation_instructions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Conversation instructions</FormLabel>
                      <FormControl>
                        <Textarea rows={4} placeholder="Tone, pacing, and style guidance." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-2">
                  <FormLabel>Qualification questions</FormLabel>
                  <div className="flex flex-col gap-2">
                    {fields.map((field, index) => (
                      <div key={field.id} className="flex items-center gap-2">
                        <FormField
                          control={form.control}
                          name={`qualification_questions.${index}.value`}
                          render={({ field: questionField }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <Input placeholder={`Question ${index + 1}`} {...questionField} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(index)}
                          aria-label="Remove question"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit"
                    onClick={() => append({ value: "" })}
                  >
                    <Plus className="size-4" />
                    Add question
                  </Button>
                </div>

                <FormField
                  control={form.control}
                  name="objection_handling"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Objection handling</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={4}
                          placeholder="How the agent should respond to common objections."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="closing_instructions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Closing instructions</FormLabel>
                      <FormControl>
                        <Textarea rows={3} placeholder="How the agent should wrap up the call." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="voicemail_message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Voicemail message</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={3}
                          placeholder="What the agent should say if it reaches voicemail."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="response_length"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Response length</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="concise">Concise</SelectItem>
                            <SelectItem value="balanced">Balanced</SelectItem>
                            <SelectItem value="detailed">Detailed</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="creativity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Creativity</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            max={1}
                            step={0.05}
                            {...field}
                            onChange={(e) => field.onChange(e.target.valueAsNumber)}
                          />
                        </FormControl>
                        <FormDescription>0.00 (focused) to 1.00 (creative).</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="behavior">
            <Card>
              <CardHeader>
                <CardTitle>Behavior</CardTitle>
                <CardDescription>Call handling, transfers, and timing rules.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6">
                <FormField
                  control={form.control}
                  name="interruptions_enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Interruptions enabled</FormLabel>
                        <FormDescription>Let the caller talk over the agent.</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="appointment_booking_enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Appointment booking enabled</FormLabel>
                        <FormDescription>Allow the agent to schedule appointments.</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="call_transfer_enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Call transfer enabled</FormLabel>
                        <FormDescription>Allow the agent to transfer to a human.</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                {callTransferEnabled && (
                  <FormField
                    control={form.control}
                    name="transfer_phone_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Transfer phone number</FormLabel>
                        <FormControl>
                          <Input type="tel" placeholder="+15551234567" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="max_call_duration_seconds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max call duration (seconds)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={30}
                            max={3600}
                            {...field}
                            onChange={(e) => field.onChange(e.target.valueAsNumber)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="silence_timeout_seconds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Silence timeout (seconds)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={120}
                            {...field}
                            onChange={(e) => field.onChange(e.target.valueAsNumber)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="end_call_rules"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End call rules</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={3}
                          placeholder="Conditions under which the agent should end the call."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="knowledge">
            <Card>
              <CardHeader>
                <CardTitle>Knowledge</CardTitle>
                <CardDescription>
                  Knowledge bases the agent can draw on to answer questions during a call.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {knowledgeBases.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No knowledge bases yet — build one at /knowledge-base.
                  </p>
                ) : (
                  <FormField
                    control={form.control}
                    name="knowledge_base_ids"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex flex-col gap-3">
                          {knowledgeBases.map((kb) => {
                            const checked = field.value.includes(kb.id);
                            return (
                              <div key={kb.id} className="flex items-center gap-2">
                                <Checkbox
                                  id={`kb-${kb.id}`}
                                  checked={checked}
                                  onCheckedChange={(value) => {
                                    if (value) {
                                      field.onChange([...field.value, kb.id]);
                                    } else {
                                      field.onChange(field.value.filter((id) => id !== kb.id));
                                    }
                                  }}
                                />
                                <label htmlFor={`kb-${kb.id}`} className="text-sm">
                                  {kb.name}
                                </label>
                              </div>
                            );
                          })}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending
              ? mode === "create"
                ? "Creating…"
                : "Saving…"
              : mode === "create"
                ? "Create agent"
                : "Save changes"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push("/agents")}>
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
