import { redirect } from "next/navigation";
import { localizeOfficialPath } from "@/i18n/official";
import { getRequestLocale } from "@/i18n/server";

export default async function StorePage() {
  const locale = await getRequestLocale();
  redirect(localizeOfficialPath("/blog", locale));
}
