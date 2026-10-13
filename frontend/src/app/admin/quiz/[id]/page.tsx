import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { QuizAdmin } from "@/components/quiz-admin";

export const metadata = { title: "Manage quiz" };
export const dynamic = "force-dynamic";

export default async function QuizAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin/login");
  const { id } = await params;
  return <QuizAdmin quizId={id} />;
}
