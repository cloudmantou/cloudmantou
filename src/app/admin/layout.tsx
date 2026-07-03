import { AdminShell } from "@/components/layout/AdminShell";
import "@/styles/aura-admin.css";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}