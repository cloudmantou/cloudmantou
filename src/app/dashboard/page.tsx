import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";

export default async function DashboardPage() {
  const session = await auth();

  if (!session) {
    redirect("/login?callbackUrl=/");
  }

  if (!isAdminRole(session.user?.role)) {
    redirect("/");
  }

  redirect("/admin");
}