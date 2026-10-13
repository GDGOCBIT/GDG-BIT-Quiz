"use client";

import { useEffect, useState } from "react";
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
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { BoardList } from "@/components/play-client";
import { api, usePoll } from "@/lib/use-poll";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { GdgLogoBrackets } from "@/components/gdg-elements";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  DoorOpen,
  Download,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Maximize2,
  Play,
  Plus,
  SkipForward,
  Square,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

type Question = {
  id: string;
  position: number;
  text: string;
  options: string[];
  correctIndex: number;
  seconds: number;
};

type Quiz = {
  id: string;
  joinCode: string;
  title: string;
  description: string;
  status: "draft" | "lobby" | "active" | "ended";
  currentIndex: number;
};

type Live = {
  serverNow: number;
  participantCount: number;
  totalQuestions: number;
  current: {
    index: number;
    text: string;
    options: string[];
    seconds: number;
    deadline: number;
    answered: number;
    correctIndex: number;
  } | null;
  leaderboard: {
    rank: number;
    id: string;
    name: string;
    stream: string;
    score: number;
  }[];
  stats: { questionId: string; total: number; correct: number }[];
};

const STATUS_TONE = {
  draft: "neutral",
  lobby: "warning",
  active: "success",
  ended: "neutral",
} as const;

export function QuizAdmin({ quizId }: { quizId: string }) {
  const router = useRouter();
  const [tab, setTab] = useState("live");
  const [detailNonce, setDetailNonce] = useState(0);
  const [liveNonce, setLiveNonce] = useState(0);
  const [busy, setBusy] = useState<"open" | "start" | "next" | "end" | null>(
    null
  );
  const { data: detail } = usePoll<{
    quiz: Quiz;
    questions: Question[];
  }>(
    () =>
      api<{ quiz: Quiz; questions: Question[] }>(
        `/api/admin/quizzes/${quizId}`
      ),
    8000,
    true,
    detailNonce
  );
  const { data: live } = usePoll<Live>(
    () => api<Live>(`/api/admin/quizzes/${quizId}/live`),
    2000,
    true,
    liveNonce
  );

  if (!detail) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Spinner className="size-8" />
      </main>
    );
  }

  const { quiz, questions } = detail;
  const refresh = () => {
    setDetailNonce((n) => n + 1);
    setLiveNonce((n) => n + 1);
  };

  const control = async (action: "open" | "start" | "next" | "end") => {
    if (busy) return;
    if (action === "start" && !confirm("Start the quiz for everyone now?"))
      return;
    if (action === "end" && !confirm("End the quiz for everyone now?")) return;
    setBusy(action);
    try {
      await api(`/api/admin/quizzes/${quizId}/control`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      toast.success(
        action === "open"
          ? "Lobby is open — players can join!"
          : action === "start"
            ? "Quiz started!"
            : action === "next"
              ? "Next question"
              : "Quiz ended"
      );
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
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
              {
                id: "quizzes",
                label: "All quizzes",
                icon: LayoutDashboard,
                href: "/admin",
              },
            ],
          },
        ]}
        title={quiz.title}
        status={quiz.status[0].toUpperCase() + quiz.status.slice(1)}
        statusTone={STATUS_TONE[quiz.status]}
        headerActions={
          <>
            {quiz.status === "draft" && (
              <DashboardButton
                variant="primary"
                size="sm"
                disabled={busy !== null}
                onClick={() => control("open")}
              >
                {busy === "open" ? <Spinner /> : <DoorOpen />} Open lobby
              </DashboardButton>
            )}
            {(quiz.status === "draft" || quiz.status === "lobby") && (
              <DashboardButton
                variant="primary"
                size="sm"
                disabled={busy !== null}
                onClick={() => control("start")}
              >
                {busy === "start" ? <Spinner /> : <Play />} Start quiz
              </DashboardButton>
            )}
            {quiz.status === "active" && (
              <DashboardButton
                variant="primary"
                size="sm"
                disabled={busy !== null}
                onClick={() => control("next")}
              >
                {busy === "next" ? <Spinner /> : <SkipForward />} Next question
              </DashboardButton>
            )}
            {quiz.status === "active" && (
              <DashboardButton
                variant="secondary"
                size="sm"
                disabled={busy !== null}
                className="text-[var(--obsidian-dashboard-shell-danger)]"
                onClick={() => control("end")}
              >
                {busy === "end" ? <Spinner /> : <Square />} End
              </DashboardButton>
            )}
            <DashboardButton
              variant="ghost"
              size="icon"
              aria-label="Sign out"
              onClick={logout}
            >
              <LogOut />
            </DashboardButton>
          </>
        }
        tabs={[
          { value: "live", label: "Live board" },
          { value: "questions", label: `Questions (${questions.length})` },
          { value: "share", label: "Share" },
        ]}
        tab={tab}
        onTabChange={setTab}
        filters={
          <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--obsidian-dashboard-shell-border-strong)] px-2 py-1 font-mono text-xs">
            code {quiz.joinCode}
          </span>
        }
      >
        <div className="p-4">
          {tab === "live" && (
            <LiveBoard live={live} quiz={quiz} questionCount={questions.length} />
          )}
          {tab === "questions" && (
            <QuestionsPanel
              quizId={quizId}
              quizStatus={quiz.status}
              questions={questions}
              stats={live?.stats ?? []}
              onChanged={refresh}
            />
          )}
          {tab === "share" && <SharePanel joinCode={quiz.joinCode} />}
        </div>
      </DashboardShell>
    </div>
  );
}

/* ---------------- Live board ---------------- */

function LiveBoard({
  live,
  quiz,
  questionCount,
}: {
  live?: Live | null;
  quiz: Quiz;
  questionCount: number;
}) {
  const deadline = live?.current?.deadline;
  const serverNow = live?.serverNow;
  const [offset, setOffset] = useState(0);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (serverNow) setOffset(serverNow - Date.now());
  }, [serverNow]);

  useEffect(() => {
    if (!deadline) return;
    setRemaining(deadline - (Date.now() + offset));
    const t = setInterval(() => {
      setRemaining(deadline - (Date.now() + offset));
    }, 100);
    return () => clearInterval(t);
  }, [deadline, offset]);

  if (quiz.status === "draft") {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Open the lobby and start the quiz to see the live board.
        </CardContent>
      </Card>
    );
  }

  const secondsLeft = live?.current
    ? Math.max(0, Math.ceil(remaining / 1000))
    : 0;
  const totalMs = Math.max(1, (live?.current?.seconds ?? 1) * 1000);
  const answeredPct =
    live && live.participantCount > 0 && live.current
      ? Math.min(100, (live.current.answered / live.participantCount) * 100)
      : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            Now playing
            <span className="flex items-center gap-1 text-sm font-normal text-muted-foreground">
              <Users className="size-3.5" /> {live?.participantCount ?? 0}
            </span>
          </CardTitle>
          <CardDescription>
            {quiz.status === "lobby"
              ? "Players are joining — hit “Start quiz” when ready."
              : quiz.status === "active"
                ? `Question ${(live?.current?.index ?? quiz.currentIndex) + 1} of ${questionCount}`
                : "Quiz ended."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {!live ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-2 w-full" />
            </div>
          ) : quiz.status === "active" && live.current ? (
            <>
              <div className="flex items-center gap-4">
                <span
                  className={cn(
                    "text-4xl font-bold tabular-nums",
                    secondsLeft <= 5 && "text-destructive"
                  )}
                >
                  {secondsLeft}s
                </span>
                <p className="flex-1 text-sm font-medium">{live.current.text}</p>
              </div>
              <Progress
                value={(Math.max(0, remaining) / totalMs) * 100}
                aria-label="Time left"
                className="h-1.5"
              />
              <div>
                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                  <span>Answers in</span>
                  <span>
                    {live.current.answered} / {live.participantCount}
                  </span>
                </div>
                <Progress value={answeredPct} aria-label="Answers in" />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {quiz.status === "ended"
                ? "Final results are on the right."
                : "Waiting to start…"}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle className="text-base">Leaderboard</CardTitle>
          <CardDescription>Updates every few seconds</CardDescription>
        </CardHeader>
        <CardContent>
          <BoardList
            rows={(live?.leaderboard ?? []).map((r) => ({
              rank: r.rank,
              name: r.name,
              stream: r.stream,
              score: r.score,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- Questions ---------------- */

function QuestionsPanel({
  quizId,
  quizStatus,
  questions,
  stats,
  onChanged,
}: {
  quizId: string;
  quizStatus: Quiz["status"];
  questions: Question[];
  stats: Live["stats"];
  onChanged: () => void;
}) {
  const [text, setText] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [seconds, setSeconds] = useState("20");
  const [saving, setSaving] = useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const opts = options.map((o) => o.trim()).filter(Boolean);
    if (!text.trim() || opts.length < 2) {
      toast.error("Write the question and at least 2 options");
      return;
    }
    if (correctIndex >= opts.length) {
      toast.error("Mark the correct answer");
      return;
    }
    setSaving(true);
    try {
      await api(`/api/admin/quizzes/${quizId}/questions`, {
        method: "POST",
        body: JSON.stringify({
          text: text.trim(),
          options: opts,
          correctIndex,
          seconds: Number(seconds),
        }),
      });
      setText("");
      setOptions(["", "", "", ""]);
      setCorrectIndex(0);
      toast.success("Question added");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add");
    } finally {
      setSaving(false);
    }
  };

  const removeQuestion = async (id: string) => {
    try {
      await api(`/api/admin/questions/${id}`, { method: "DELETE" });
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const move = async (id: string, dir: "up" | "down") => {
    try {
      await api(`/api/admin/questions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ move: dir }),
      });
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Move failed");
    }
  };

  const locked = quizStatus !== "draft";

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {locked ? "Quiz opened — editing locked" : "Add a question"}
          </CardTitle>
          <CardDescription>
            2–4 options, pick the correct one, and choose the timer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={add} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="qtext">Question</Label>
              <Input
                id="qtext"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Which language runs in a browser?"
                maxLength={500}
                disabled={locked}
              />
            </div>
            <RadioGroup
              value={String(correctIndex)}
              onValueChange={(v) => setCorrectIndex(Number(v))}
              className="flex flex-col gap-2"
              disabled={locked}
            >
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <RadioGroupItem value={String(i)} id={`opt-${i}`} />
                  <Input
                    value={opt}
                    onChange={(e) => {
                      const next = [...options];
                      next[i] = e.target.value;
                      setOptions(next);
                    }}
                    placeholder={`Option ${String.fromCharCode(65 + i)}${i < 2 ? " (required)" : " (optional)"}`}
                    maxLength={200}
                    disabled={locked}
                  />
                </div>
              ))}
            </RadioGroup>
            <p className="-mt-2 text-xs text-muted-foreground">
              Select the radio next to the correct option.
            </p>
            <div className="flex items-end gap-3">
              <div className="flex flex-col gap-2">
                <Label>Timer</Label>
                <Select
                  value={seconds}
                  onValueChange={(v) => v && setSeconds(v)}
                  disabled={locked}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 seconds</SelectItem>
                    <SelectItem value="20">20 seconds</SelectItem>
                    <SelectItem value="30">30 seconds</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="submit"
                variant="default"
                disabled={saving || locked}
                className="ml-auto h-10 px-5 font-heading font-black uppercase border-2 border-black shadow-[3px_3px_0px_0px_black]"
              >
                {saving ? <Spinner /> : <Plus className="stroke-[3]" />}
                Add question
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading font-black uppercase">
            Questions ({questions.length})
          </CardTitle>
          <CardDescription>Played sequentially from first to last.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {questions.length === 0 && (
            <p className="py-6 text-center text-sm font-bold uppercase text-muted-foreground">
              No questions yet.
            </p>
          )}
          {questions.map((q, i) => {
            const stat = stats.find((s) => s.questionId === q.id);
            return (
              <div key={q.id} className="border-2 border-black bg-white p-3 shadow-[3px_3px_0px_0px_black]">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center border border-black bg-[#4285F4] text-white text-xs font-black">
                    {i + 1}
                  </span>
                  <p className="min-w-0 flex-1 font-heading text-sm font-bold uppercase">{q.text}</p>
                  <div className="flex shrink-0 gap-1.5">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-7 border-2 border-black shadow-[1px_1px_0px_0px_black] hover:bg-[#F9AB00]"
                      aria-label="Move up"
                      disabled={locked || i === 0}
                      onClick={() => move(q.id, "up")}
                    >
                      <ArrowUp className="size-3.5 stroke-[2.5]" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-7 border-2 border-black shadow-[1px_1px_0px_0px_black] hover:bg-[#F9AB00]"
                      aria-label="Move down"
                      disabled={locked || i === questions.length - 1}
                      onClick={() => move(q.id, "down")}
                    >
                      <ArrowDown className="size-3.5 stroke-[2.5]" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-7 border-2 border-black shadow-[1px_1px_0px_0px_black] hover:bg-[#EA4335] hover:text-white"
                      aria-label="Delete question"
                      disabled={locked}
                      onClick={() => removeQuestion(q.id)}
                    >
                      <Trash2 className="size-3.5 stroke-[2.5]" />
                    </Button>
                  </div>
                </div>
                <ul className="mt-2 space-y-1 pl-8">
                  {q.options.map((opt, j) => (
                    <li
                      key={j}
                      className={cn(
                        "flex items-center gap-1.5 text-xs",
                        j === q.correctIndex
                          ? "font-medium text-emerald-400"
                          : "text-muted-foreground"
                      )}
                    >
                      {j === q.correctIndex && <Check className="size-3" />}
                      {opt}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 pl-8 text-xs text-muted-foreground">
                  {q.seconds}s
                  {stat
                    ? ` · ${stat.correct}/${stat.total} got it right`
                    : ""}
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- Share ---------------- */

function SharePanel({ joinCode }: { joinCode: string }) {
  const [qr, setQr] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);
  const [origin, setOrigin] = useState("");
  const [customOrigin, setCustomOrigin] = useState("");
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  const [isProjectorMode, setIsProjectorMode] = useState(false);

  useEffect(() => {
    const locOrigin = window.location.origin;
    setOrigin(locOrigin);
    setCustomOrigin(locOrigin);
  }, []);

  const activeOrigin = customOrigin.trim() || origin;
  const joinUrl = `${activeOrigin}/join/${joinCode}`;

  useEffect(() => {
    if (!activeOrigin) return;
    let cancelled = false;
    import("qrcode")
      .then((QR) =>
        QR.toDataURL(joinUrl, {
          width: 600,
          margin: 2,
          color: { dark: "#121212", light: "#ffffff" },
          errorCorrectionLevel: "M",
        })
      )
      .then((dataUrl) => {
        if (!cancelled) setQr(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [joinCode, activeOrigin, joinUrl]);

  // Escape key closes Projector Mode
  useEffect(() => {
    if (!isProjectorMode) return;
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setIsProjectorMode(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isProjectorMode]);

  const copy = async (what: "link" | "code") => {
    try {
      await navigator.clipboard.writeText(what === "link" ? joinUrl : joinCode);
      setCopied(what);
      toast.success(what === "link" ? "Link copied" : "PIN code copied");
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Couldn't copy — select it manually");
    }
  };

  const downloadQr = () => {
    if (!qr) return;
    const a = document.createElement("a");
    a.href = qr;
    a.download = `gdg-quiz-${joinCode}-qr.png`;
    a.click();
    toast.success("QR code downloaded!");
  };

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Join Link & PIN Code Card */}
        <Card className="border-4 border-black bg-white shadow-[6px_6px_0px_0px_black]">
          <CardHeader>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="yellow" className="border-2 border-black font-mono font-black text-[10px]">
                PARTICIPANT ACCESS
              </Badge>
            </div>
            <CardTitle className="font-heading text-xl font-black uppercase tracking-tight">
              Join Link & Code
            </CardTitle>
            <CardDescription className="font-medium">
              Attendees enter the 6-character PIN code on their mobile browsers.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {/* Direct Join Link */}
            <div className="flex flex-col gap-1.5">
              <Label className="font-heading font-black text-xs uppercase text-neutral-700">
                Direct Mobile Join Link
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={origin ? joinUrl : "Loading link…"}
                  className="font-mono text-xs border-2 border-black bg-[#F0F0F0]"
                />
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Copy link"
                  disabled={!origin}
                  className="size-10 shrink-0 border-2 border-black shadow-[2px_2px_0px_0px_black] hover:bg-[#F9AB00]"
                  onClick={() => copy("link")}
                >
                  {copied === "link" ? (
                    <Check className="text-[#34A853] stroke-[3]" />
                  ) : (
                    <Copy className="stroke-[2.5]" />
                  )}
                </Button>
                <a href={joinUrl} target="_blank" rel="noopener noreferrer">
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Open in new tab"
                    className="size-10 shrink-0 border-2 border-black shadow-[2px_2px_0px_0px_black] hover:bg-[#4285F4] hover:text-white"
                  >
                    <ExternalLink className="stroke-[2.5]" />
                  </Button>
                </a>
              </div>
            </div>

            {/* PIN Code Box */}
            <div className="flex flex-col gap-1.5">
              <Label className="font-heading font-black text-xs uppercase text-neutral-700">
                Room Join PIN
              </Label>
              <div className="flex items-center gap-2">
                <div className="flex h-12 flex-1 items-center justify-center border-4 border-black bg-[#F9AB00] font-mono text-2xl font-black tracking-[0.35em] shadow-[4px_4px_0px_0px_black]">
                  {joinCode}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Copy code"
                  className="size-12 shrink-0 border-2 border-black shadow-[2px_2px_0px_0px_black] hover:bg-[#F9AB00]"
                  onClick={() => copy("code")}
                >
                  {copied === "code" ? (
                    <Check className="text-[#34A853] stroke-[3]" />
                  ) : (
                    <Copy className="stroke-[2.5]" />
                  )}
                </Button>
              </div>
            </div>

            {/* Host Base URL Override (for LAN IP or Production Domain) */}
            <div className="mt-2 pt-4 border-t-2 border-black flex flex-col gap-1.5">
              <Label htmlFor="base-url" className="text-xs font-bold uppercase text-neutral-600">
                Domain / LAN IP (Updates QR Code automatically)
              </Label>
              <Input
                id="base-url"
                value={customOrigin}
                onChange={(e) => setCustomOrigin(e.target.value)}
                placeholder="e.g. http://192.168.1.10:3000 or https://gdg-quiz.app"
                className="font-mono text-xs border-2 border-black"
              />
            </div>
          </CardContent>
        </Card>

        {/* Scan to Join Card */}
        <Card className="border-4 border-black bg-white shadow-[6px_6px_0px_0px_black] flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Badge variant="green" className="border-2 border-black font-mono font-black text-[10px]">
                STAGE READY
              </Badge>
              <GdgLogoBrackets />
            </div>
            <CardTitle className="font-heading text-xl font-black uppercase tracking-tight">
              Scan to Join
            </CardTitle>
            <CardDescription className="font-medium">
              Project this in the auditorium or download for event posters.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-5 pb-6">
            <div className="relative border-4 border-black bg-white p-3 shadow-[6px_6px_0px_0px_black]">
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qr}
                  alt={`QR code to join quiz ${joinCode}`}
                  className="size-52 sm:size-60 bg-white"
                />
              ) : qrError ? (
                <div className="flex size-52 sm:size-60 flex-col items-center justify-center gap-2 p-4 text-center">
                  <p className="text-xs font-bold uppercase text-destructive">
                    Could not render QR code
                  </p>
                </div>
              ) : (
                <div className="flex size-52 sm:size-60 items-center justify-center">
                  <Spinner className="size-8 text-[#4285F4]" />
                </div>
              )}
            </div>

            <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                variant="default"
                onClick={() => setIsProjectorMode(true)}
                className="w-full sm:w-auto h-11 px-5 border-2 border-black font-black uppercase shadow-[3px_3px_0px_0px_black]"
              >
                <Maximize2 className="size-4 mr-1.5 stroke-[3]" />
                PROJECTOR MODE
              </Button>
              <Button
                variant="outline"
                disabled={!qr}
                onClick={downloadQr}
                className="w-full sm:w-auto h-11 px-5 border-2 border-black font-black uppercase shadow-[3px_3px_0px_0px_black] hover:bg-[#F9AB00]"
              >
                <Download className="size-4 mr-1.5 stroke-[3]" />
                DOWNLOAD QR
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fullscreen Projector Mode Modal */}
      {isProjectorMode && (
        <div className="fixed inset-0 z-50 flex flex-col justify-between bg-[#F0F0F0] p-6 sm:p-12 overflow-y-auto">
          {/* Top Bar */}
          <div className="flex items-center justify-between border-b-4 border-black pb-4">
            <div className="flex items-center gap-3">
              <GdgLogoBrackets />
              <span className="font-heading text-xl sm:text-2xl font-black uppercase tracking-tight text-[#121212]">
                GOOGLE DEVELOPER GROUPS ON CAMPUS
              </span>
            </div>
            <Button
              variant="outline"
              onClick={() => setIsProjectorMode(false)}
              className="h-11 px-4 border-2 border-black font-black uppercase shadow-[3px_3px_0px_0px_black] bg-white hover:bg-[#EA4335] hover:text-white"
            >
              EXIT <X className="size-4 ml-1 stroke-[3]" />
            </Button>
          </div>

          {/* Main Stage Display */}
          <div className="my-auto py-8">
            <div className="mx-auto max-w-xl border-4 border-black bg-white p-8 sm:p-12 text-center shadow-[12px_12px_0px_0px_black]">
              <div className="inline-block border-2 border-black bg-[#4285F4] px-4 py-1 font-heading text-xs font-black uppercase text-white shadow-[3px_3px_0px_0px_black] mb-6">
                JOIN LIVE COMPETITION
              </div>

              <h1 className="font-heading text-3xl sm:text-5xl font-black uppercase tracking-tight text-[#121212] mb-6">
                SCAN TO ENTER
              </h1>

              {qr && (
                <div className="mx-auto inline-block border-4 border-black bg-white p-4 shadow-[8px_8px_0px_0px_black] mb-6">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qr}
                    alt={`QR code ${joinCode}`}
                    className="size-64 sm:size-80"
                  />
                </div>
              )}

              <div className="mb-4">
                <span className="block text-xs font-bold uppercase text-neutral-600 mb-1">
                  ROOM PIN CODE
                </span>
                <div className="inline-block border-4 border-black bg-[#F9AB00] px-8 py-2 font-mono text-4xl sm:text-5xl font-black tracking-[0.3em] shadow-[6px_6px_0px_0px_black]">
                  {joinCode}
                </div>
              </div>

              <p className="font-mono text-sm sm:text-base font-bold uppercase text-neutral-800 mt-6">
                Visit <span className="underline font-black">{activeOrigin}</span> or scan with phone camera
              </p>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="text-center font-mono text-xs font-bold uppercase text-neutral-500 pt-4 border-t-2 border-black">
            PRESS ESC OR CLICK EXIT TO RETURN TO HOST CONSOLE
          </div>
        </div>
      )}
    </>
  );
}
