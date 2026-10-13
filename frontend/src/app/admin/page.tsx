import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { AdminDashboard } from "@/components/admin-dashboard";

export const metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  return <AdminDashboard />;
}
