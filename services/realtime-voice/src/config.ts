import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.REALTIME_VOICE_PORT ?? 8080),
  supabaseUrl: required("SUPABASE_URL"),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  openaiApiKey: required("OPENAI_API_KEY"),
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? "",
  defaultRealtimeModel: process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime",
  defaultVoice: process.env.OPENAI_REALTIME_VOICE ?? "alloy",
} as const;
