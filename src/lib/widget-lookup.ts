import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Public widget routes have no Supabase session (the caller is an anonymous
 * website visitor), so every one of them starts here: resolve the widget by
 * its public_key (never the internal uuid — public_key is the only
 * identifier exposed to the embed script/iframe) using the service-role
 * client, and require status = 'active'. Returns null when the key doesn't
 * resolve to a live widget, which every route below treats as a 404.
 */
export async function getActiveWidgetByKey(key: string) {
  const supabase = createServiceRoleClient();
  const { data: widget } = await supabase
    .from("chat_widgets")
    .select("id, workspace_id, agent_id, name, primary_color, size, greeting_message, status, chat_enabled, voice_chat_enabled")
    .eq("public_key", key)
    .eq("status", "active")
    .maybeSingle();

  return { supabase, widget };
}
