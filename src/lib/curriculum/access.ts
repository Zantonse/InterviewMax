import { isAdminEmail } from "@/lib/admin/access";

// The job curriculum is in beta (Craig, Oct 18): only admins can open it. When it opens up, this
// is the one function to change.
export function canUseCurriculum(email: string | null | undefined): boolean {
  return isAdminEmail(email);
}
