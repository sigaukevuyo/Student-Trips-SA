import { supabase } from "./supabase";

type ActivityLogInput = {
  action: string;
  entityType: string;
  entityId?: string | null;
  entityLabel?: string | null;
  details?: Record<string, unknown>;
};

export async function logActivity({ action, entityType, entityId = null, entityLabel = null, details = {} }: ActivityLogInput) {
  if (!supabase) return;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    await supabase.from("activity_logs").insert({
      actor_id: user.id,
      actor_role: profile?.role ?? null,
      action,
      entity_type: entityType,
      entity_id: entityId,
      entity_label: entityLabel,
      details,
    });
  } catch {
    // Activity logging should never block the action that already succeeded.
  }
}
