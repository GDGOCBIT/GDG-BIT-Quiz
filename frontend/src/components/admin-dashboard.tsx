"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DashboardButton,
  DashboardShell,
} from "@/components/block/dashboard-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { api, usePoll } from "@/lib/use-poll";
import {
  ArrowRight,
  ClipboardList,
  HelpCircle,
  LogOut,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

type QuizRow = {
  id: string;
  title: string;
  description: string;
  status: string;
  joinCode: string;
  createdAt: string;
  questionCount: number;
  participantCount: number;
};


export function AdminDashboard() {
  const router = useRouter();
  const [nonce, setNonce] = useState(0);
  const { data, error } = usePoll<{ quizzes: QuizRow[] }>(
    () => api<{ quizzes: QuizRow[] }>("/api/admin/quizzes"),
    5000,
    true,
    nonce
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    try {
      const { quiz } = await api<{ quiz: { id: string } }>("/api/admin/quizzes", {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), description: description.trim() }),
      });
      toast.success("Quiz created");
      router.push(`/admin/quiz/${quiz.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create quiz");
      setCreating(false);
    }
  };

  const remove = async (id: string, t: string) => {
    if (!confirm(`Delete "${t}"? This removes its questions, players and scores.`))
      return;
    try {
      await api(`/api/admin/quizzes/${id}`, { method: "DELETE" });
      toast.success("Quiz deleted");
      setNonce((n) => n + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const logout = async () => {
    try {
      await api("/api/admin/logout", { method: "POST" });
      router.push("/admin/login");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign out failed");
    }
  };

  return (
    <div className="h-dvh">
      <DashboardShell
        brand={{ name: "QuizLive", description: "Host console" }}
        navigation={[
          {
            id: "main",
            items: [
              { id: "quizzes", label: "Quizzes", icon: ClipboardList },
            ],
          },
        ]}
        defaultActiveItemId="quizzes"
        title="Quiz competitions"
        headerActions={
          <DashboardButton variant="ghost" size="sm" onClick={logout}>
            <LogOut /> Sign out
          </DashboardButton>
        }
      >
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">New quiz</CardTitle>
              <CardDescription>
                You&apos;ll add questions on the next screen.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={create} className="flex flex-col gap-3 sm:flex-row">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="title" className="sr-only">
                    Title
                  </Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Quiz title — e.g. GDG Tech Quiz 2026"
                    maxLength={120}
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <Label htmlFor="desc" className="sr-only">
                    Description
                  </Label>
                  <Input
                    id="desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional description"
                    maxLength={300}
                  />
                </div>
                <Button
                  type="submit"
                  variant="default"
                  disabled={creating || !title.trim()}
                  className="h-10 px-5 font-heading font-black uppercase border-2 border-black shadow-[3px_3px_0px_0px_black]"
                >
                  {creating ? <Spinner /> : <Plus className="stroke-[3]" />}
                  Create
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            {data === null && !error && (
              <div className="flex flex-col gap-3">
                {[0, 1].map((i) => (
                  <Skeleton key={i} className="h-24 w-full border-4 border-black" />
                ))}
              </div>
            )}
            {error && data === null && (
              <p className="py-10 text-center font-heading font-black text-destructive uppercase">
                Couldn&apos;t load quizzes ({error}). Retrying…
              </p>
            )}
            {data !== null && data.quizzes.length === 0 && (
              <Empty className="border-4 border-black bg-white p-8 shadow-[6px_6px_0px_0px_black]">
                <EmptyHeader>
                  <EmptyMedia variant="icon" className="border-2 border-black bg-[#F0F0F0] text-black">
                    <ClipboardList className="stroke-[3]" />
                  </EmptyMedia>
                  <EmptyTitle className="font-heading font-black uppercase">No quizzes yet</EmptyTitle>
                  <EmptyDescription className="font-medium">
                    Create your first one above to launch live competitions.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
            {(data?.quizzes ?? []).map((q) => (
              <Card key={q.id} className="border-4 border-black bg-white shadow-[6px_6px_0px_0px_black] transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[8px_8px_0px_0px_black]">
                <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => router.push(`/admin/quiz/${q.id}`)}
                        className="truncate text-left font-heading text-lg font-black uppercase hover:text-[#4285F4] hover:underline"
                      >
                        {q.title}
                      </button>
                      <Badge
                        variant={q.status === "active" ? "green" : q.status === "lobby" ? "yellow" : "outline"}
                        className="border-2 border-black font-mono text-[10px] font-black uppercase"
                      >
                        {q.status}
                      </Badge>
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs font-bold text-neutral-600">
                      <span className="flex items-center gap-1">
                        <HelpCircle className="size-3.5 stroke-[2.5]" /> {q.questionCount}{" "}
                        QUESTIONS
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="size-3.5 stroke-[2.5]" /> {q.participantCount} JOINED
                      </span>
                      <span className="border border-black bg-[#F0F0F0] px-1.5 py-0.5 text-black">
                        PIN {q.joinCode}
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Delete quiz"
                      className="size-9 border-2 border-black shadow-[2px_2px_0px_0px_black] hover:bg-[#EA4335] hover:text-white"
                      onClick={() => remove(q.id, q.title)}
                    >
                      <Trash2 className="size-4 stroke-[2.5]" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 px-3.5 border-2 border-black font-heading font-black uppercase shadow-[3px_3px_0px_0px_black] hover:bg-[#F9AB00]"
                      onClick={() => router.push(`/admin/quiz/${q.id}`)}
                    >
                      MANAGE <ArrowRight className="size-4 ml-1 stroke-[3]" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardShell>
    </div>
  );
}
