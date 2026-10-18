import { isAdminEmail } from "@/lib/admin/access";

// PromotionMax is in beta (Craig, Oct 18): everyone sees the switch marked Beta, and only admins can
// use it. When it opens up, this is the one function to change.
export function canUsePromotion(email: string | null | undefined): boolean {
  return isAdminEmail(email);
}
