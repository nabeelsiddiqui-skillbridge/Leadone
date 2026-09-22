// This service's config.ts eagerly reads required env vars at module load
// time (src/config.ts), since it's meant to fail fast on boot in a real
// deployment rather than fail mysteriously mid-call. Unit tests that import
// anything transitively pulling in db.ts/config.ts (e.g. the tools, which
// import ../db.js) need placeholder values present before that import runs
// - none of these tests make real network calls, so dummy values are fine.
process.env.SUPABASE_URL ??= "https://placeholder.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "placeholder-service-role-key";
process.env.OPENAI_API_KEY ??= "sk-placeholder";
