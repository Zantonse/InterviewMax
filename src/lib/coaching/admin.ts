import "server-only";
import type { Admin } from "@/lib/admin/data";
import type { Guideline } from "./guidelines";

// The admin panel's side of the coaching guidelines. Every call takes the Admin that
// requireAdmin() returned; the table has row-level security on with no policies, so only the
// secret-key client the admin panel uses can read or change it.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function listGuidelines(admin: Admin): Promise<Guideline[]> {
  const { data, error } = await admin.supabase
    .from("coaching_guidelines")
    .select("id, title, body, position, updated_by, updated_at")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Couldn't load the coaching guidelines: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    title: r.title as string,
    body: r.body as string,
    position: r.position as number,
    updatedBy: (r.updated_by as string | null) ?? null,
    updatedAt: r.updated_at as string,
  }));
}

export async function updateGuideline(
  admin: Admin,
  id: string,
  values: { title: string; body: string },
): Promise<void> {
  if (!UUID_RE.test(id)) throw new Error("That section wasn't found.");
  const { error } = await admin.supabase
    .from("coaching_guidelines")
    .update({
      ...values,
      updated_by: admin.email,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(`Couldn't save that section: ${error.message}`);
}

// Adds a section at the end.
export async function addGuideline(
  admin: Admin,
  values: { title: string; body: string },
): Promise<void> {
  const { data, error: readError } = await admin.supabase
    .from("coaching_guidelines")
    .select("position")
    .order("position", { ascending: false })
    .limit(1);
  if (readError) throw new Error(`Couldn't add that section: ${readError.message}`);
  const position = ((data?.[0]?.position as number | undefined) ?? 0) + 1;
  const { error } = await admin.supabase
    .from("coaching_guidelines")
    .insert({ ...values, position, updated_by: admin.email });
  if (error) throw new Error(`Couldn't add that section: ${error.message}`);
}

export async function deleteGuideline(admin: Admin, id: string): Promise<void> {
  if (!UUID_RE.test(id)) throw new Error("That section wasn't found.");
  const { error } = await admin.supabase.from("coaching_guidelines").delete().eq("id", id);
  if (error) throw new Error(`Couldn't delete that section: ${error.message}`);
}
