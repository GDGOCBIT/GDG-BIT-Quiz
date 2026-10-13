"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { api, usePoll } from "@/lib/use-poll";
import { Button } from "@/components/ui/button";
import { GdgLogoBrackets } from "@/components/gdg-elements";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Crown,
  Trophy,
  XCircle,
  Zap,
} from "lucide-react";

export type BundleQuestion = {
  id: string;
  index: number;
  position: number;
  text: string;
  options: string[];
  seconds: number;
  correctIndex: number;
};

export type BundleAnswer = {
  questionId: string;
  choice: number;
  isCorrect: boolean;
  points: number;
  msTaken?: number;
};

export type PlayState = {
  serverNow: number;
  quizTitle: string;
  status: string;
  phase: "draft" | "lobby" | "active" | "ended";
  myScore: number;
  myName: string;
  myStream: string;
  participantCount?: number;
  totalQuestions?: number;
  myRank?: number;
  totalParticipants?: number;
  questions?: BundleQuestion[];
  myAnswers?: BundleAnswer[];
};

export type Leaderboard = {
  top10: {
    rank: number;
    id: string;
    name: string;
    stream: string;
    score: number;
    isMe: boolean;
  }[];
  myRank: number;
  myScore: number;
  totalParticipants: number;
};

const LETTERS = ["A", "B", "C", "D"];

function computeClientPoints(seconds: number, msTaken: number): number {
  const s = Math.max(1, Math.floor(seconds));
  const remaining = Math.max(0, s * 1000 - Math.max(0, msTaken));
  const bonus = Math.round((remaining / (s * 1000)) * 50);
  return 100 + bonus;
}

export function PlayClient() {
  const router = useRouter();
  const [nonce, setNonce] = useState(0);

  // Poll quiz bundle: fetches all questions & current status in one go
  const { data, error } = usePoll<PlayState>(
    () => api<PlayState>("/api/play/bundle"),
    2000,
    true,
    nonce
  );

  // Local state for self-paced progression
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [localAnswers, setLocalAnswers] = useState<
    Record<string, { choice: number; isCorrect: boolean; points: number }>
  >({});
  const [localScore, setLocalScore] = useState<number | null>(null);
  const [finishedQuizLocally, setFinishedQuizLocally] = useState(false);

  // Populate local answers from server on bundle load
  useEffect(() => {
    if (data?.myAnswers) {
      setLocalAnswers((prev) => {
        const next = { ...prev };
        for (const a of data.myAnswers || []) {
          if (!next[a.questionId]) {
            next[a.questionId] = {
              choice: a.choice,
              isCorrect: a.isCorrect,
              points: a.points,
            };
          }
        }
        return next;
      });
    }
  }, [data?.myAnswers]);

  // Sync score from server initially
  useEffect(() => {
    if (data?.myScore !== undefined && localScore === null) {
      setLocalScore(data.myScore);
    }
  }, [data?.myScore, localScore]);

  // Determine initial question index when active questions arrive
  useEffect(() => {
    if (data?.phase === "active" && data.questions && data.questions.length > 0 && currentIndex === null) {
      const answeredSet = new Set(data.myAnswers?.map((a) => a.questionId) ?? []);
      const firstUnanswered = data.questions.findIndex((q) => !answeredSet.has(q.id));
      if (firstUnanswered !== -1) {
        setCurrentIndex(firstUnanswered);
      } else {
        // All answered!
        setCurrentIndex(data.questions.length - 1);
        setFinishedQuizLocally(true);
      }
    }
  }, [data?.phase, data?.questions, data?.myAnswers, currentIndex]);

  useEffect(() => {
    if (error && /not joined/i.test(error)) router.replace("/");
  }, [error, router]);

  if (error && !data) {
    return (
      <Center>
        <Alert
          variant={/not joined/i.test(error) ? "default" : "destructive"}
          className="max-w-sm border-4 border-black shadow-[6px_6px_0px_0px_black] rounded-none bg-white p-6 font-bold"
        >
          <AlertDescription>
            {/not joined/i.test(error)
              ? "PLEASE JOIN A QUIZ FIRST."
              : "COULD NOT REACH QUIZ SERVER. RETRYING…"}
          </AlertDescription>
        </Alert>
      </Center>
    );
  }

  if (!data) {
    return (
      <Center>
        <div className="flex flex-col items-center gap-3">
          <Spinner className="size-8 text-[#4285F4]" />
          <span className="font-heading font-black uppercase text-xs">CONNECTING TO ROOM...</span>
        </div>
      </Center>
    );
  }

  if (data.phase === "draft") {
    return (
      <Center>
        <WaitingCard
          title={data.quizTitle}
          message="THE HOST IS CONFIGURING QUESTIONS. SESSION WILL COMMENCE ONCE LAUNCHED."
        />
      </Center>
    );
  }

  if (data.phase === "lobby") {
    return (
      <Center>
        <WaitingCard
          title={data.quizTitle}
          message="YOU ARE IN THE ROOM. AWAITING HOST TO START THE SHOWDOWN…"
          sub={`PLAYER: ${data.myName} (${data.myStream})`}
          count={data.participantCount}
          score={localScore ?? data.myScore}
        />
      </Center>
    );
  }

  const questions = data.questions ?? [];
  const total = questions.length;
  const isFinished = data.phase === "ended" || finishedQuizLocally;

  if (isFinished || total === 0) {
    return <FinalBoard me={data} currentScore={localScore ?? data.myScore} />;
  }

  const activeIndex = currentIndex ?? 0;
  const currentQ = questions[activeIndex];

  const handleAnswer = (choice: number, isCorrect: boolean, points: number, msTaken: number) => {
    if (!currentQ) return;
    setLocalAnswers((prev) => ({
      ...prev,
      [currentQ.id]: { choice, isCorrect, points },
    }));
    setLocalScore((prev) => (prev ?? data.myScore ?? 0) + points);

    // Asynchronously submit answer to server
    api<{ ok: boolean; points: number }>("/api/play/answer", {
      method: "POST",
      body: JSON.stringify({
        questionIndex: activeIndex,
        choice: Math.max(0, choice),
        msTaken,
      }),
    }).catch((err) => {
      console.warn("Answer sync warning:", err);
    });
  };

  const handleNext = () => {
    if (activeIndex + 1 < total) {
      setCurrentIndex(activeIndex + 1);
    } else {
      setFinishedQuizLocally(true);
      setNonce((n) => n + 1);
    }
  };

  const handlePrev = () => {
    if (activeIndex > 0) {
      setCurrentIndex(activeIndex - 1);
    }
  };

  const currentResult = currentQ ? localAnswers[currentQ.id] : null;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12 min-h-dvh flex flex-col justify-between">
      <div>
        {/* Bauhaus Header Pill Navigation */}
        <header className="mb-8 flex flex-wrap items-center justify-between gap-3 border-4 border-black bg-white p-4 shadow-[6px_6px_0px_0px_black]">
          <div className="flex items-center gap-2">
            <GdgLogoBrackets />
            <span className="max-w-[200px] truncate font-heading text-sm font-black uppercase">
              {data.quizTitle}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="yellow" className="font-mono text-xs font-black">
              Q{activeIndex + 1}/{total}
            </Badge>
            <Badge variant="green" className="gap-1 font-mono text-xs font-black">
              <Trophy className="size-3.5 stroke-[3]" /> {localScore ?? data.myScore} PTS
            </Badge>
          </div>
        </header>

        {currentQ ? (
          <WaygroundQuestionView
            key={currentQ.id}
            question={currentQ}
            questionNumber={activeIndex + 1}
            totalQuestions={total}
            existingAnswer={currentResult ?? null}
            hasNext={activeIndex + 1 < total}
            hasPrev={activeIndex > 0}
            onAnswer={handleAnswer}
            onNext={handleNext}
            onPrev={handlePrev}
          />
        ) : (
          <WaitingCard
            title={data.quizTitle}
            message="LOADING NEXT QUESTION..."
            score={localScore ?? data.myScore}
          />
        )}
      </div>

      <footer className="mt-12 text-center text-xs font-bold uppercase text-neutral-500">
        GOOGLE DEVELOPER GROUPS ON CAMPUS
      </footer>
    </main>
  );
}

/* ---------------- Wayground-Style Question View ---------------- */

function WaygroundQuestionView({
  question,
  questionNumber,
  totalQuestions,
  existingAnswer,
  hasNext,
  hasPrev,
  onAnswer,
  onNext,
  onPrev,
}: {
  question: BundleQuestion;
  questionNumber: number;
  totalQuestions: number;
  existingAnswer: { choice: number; isCorrect: boolean; points: number } | null;
  hasNext: boolean;
  hasPrev: boolean;
  onAnswer: (choice: number, isCorrect: boolean, points: number, msTaken: number) => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  const [openedAt] = useState(() => Date.now());
  const [remainingMs, setRemainingMs] = useState(question.seconds * 1000);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(
    existingAnswer ? existingAnswer.choice : null
  );
  const [timedOut, setTimedOut] = useState(false);
  const [autoAdvanceTimer, setAutoAdvanceTimer] = useState<number | null>(null);
  const autoAdvanceRef = useRef<NodeJS.Timeout | null>(null);

  const totalMs = question.seconds * 1000;
  const isLocked = selectedChoice !== null || timedOut || existingAnswer !== null;

  const startAutoAdvance = useCallback(() => {
    setAutoAdvanceTimer(1.4);
    const start = Date.now();
    const countInterval = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      const rem = Math.max(0, 1.4 - elapsed);
      setAutoAdvanceTimer(Number(rem.toFixed(1)));
      if (rem <= 0) {
        clearInterval(countInterval);
      }
    }, 100);

    autoAdvanceRef.current = setTimeout(() => {
      clearInterval(countInterval);
      onNext();
    }, 1400);
  }, [onNext]);

  // Countdown timer for this question
  useEffect(() => {
    if (isLocked) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - openedAt;
      const left = Math.max(0, totalMs - elapsed);
      setRemainingMs(left);

      if (left <= 0) {
        clearInterval(interval);
        setTimedOut(true);
        // Record 0 points timed out
        onAnswer(-1, false, 0, totalMs);
        startAutoAdvance();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [openedAt, totalMs, isLocked, onAnswer, startAutoAdvance]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    };
  }, []);

  const handlePick = (choiceIndex: number) => {
    if (isLocked) return;
    const msTaken = Math.min(totalMs, Date.now() - openedAt);
    const isCorrect = choiceIndex === question.correctIndex;
    const points = isCorrect ? computeClientPoints(question.seconds, msTaken) : 0;

    setSelectedChoice(choiceIndex);
    onAnswer(choiceIndex, isCorrect, points, msTaken);
    startAutoAdvance();
  };

  const handleManualNext = () => {
    if (autoAdvanceRef.current) {
      clearTimeout(autoAdvanceRef.current);
    }
    onNext();
  };

  const secondsLeft = Math.ceil(remainingMs / 1000);
  const timePct = Math.max(0, Math.min(100, (remainingMs / totalMs) * 100));

  const timerColor =
    secondsLeft <= 5
      ? "bg-[#EA4335] text-white animate-pulse"
      : secondsLeft <= 10
        ? "bg-[#F9AB00] text-black"
        : "bg-white text-black";

  // Result info
  const answerInfo = existingAnswer ?? (selectedChoice !== null ? {
    choice: selectedChoice,
    isCorrect: selectedChoice === question.correctIndex,
    points: selectedChoice === question.correctIndex ? computeClientPoints(question.seconds, totalMs - remainingMs) : 0,
  } : null);

  return (
    <div className="flex flex-col gap-6">
      {/* Bauhaus Question Top Bar */}
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="border-2 border-black font-mono font-black text-xs uppercase">
          QUESTION {questionNumber} OF {totalQuestions}
        </Badge>

        <div className="flex items-center gap-3">
          {timedOut && (
            <Badge variant="red" className="border-2 border-black font-black uppercase">
              TIME EXPIRED
            </Badge>
          )}

          <div
            className={cn(
              "flex size-14 items-center justify-center border-4 border-black font-mono text-2xl font-black shadow-[4px_4px_0px_0px_black] transition-colors",
              timerColor
            )}
          >
            {secondsLeft}s
          </div>
        </div>
      </div>

      {/* Question Prompt Container */}
      <div className="border-4 border-black bg-white p-6 sm:p-8 shadow-[8px_8px_0px_0px_black] relative">
        <div className="absolute -top-3 left-6 bg-[#4285F4] text-white text-[10px] font-black uppercase px-2.5 py-0.5 border-2 border-black shadow-[2px_2px_0px_0px_black]">
          QUESTION #{questionNumber}
        </div>
        <h2 className="font-heading text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#121212] leading-snug">
          {question.text}
        </h2>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-3 border-2 border-black bg-white p-0.5">
        <div
          className={cn(
            "h-full transition-all duration-100",
            secondsLeft <= 5
              ? "bg-[#EA4335]"
              : secondsLeft <= 10
                ? "bg-[#F9AB00]"
                : "bg-[#4285F4]"
          )}
          style={{ width: `${isLocked ? 100 : timePct}%` }}
        />
      </div>

      {/* Options Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {question.options.map((opt, i) => {
          const isSelected = selectedChoice === i || existingAnswer?.choice === i;
          const isCorrectAnswer = isLocked && question.correctIndex === i;
          const isWrongSelection = isSelected && !isCorrectAnswer;

          let btnBg = "bg-white hover:bg-[#F9AB00] hover:translate-x-[2px] hover:translate-y-[2px]";
          let letterBg = "bg-[#121212] text-white";

          if (isCorrectAnswer) {
            btnBg = "bg-[#34A853] text-white shadow-[4px_4px_0px_0px_black]";
            letterBg = "bg-white text-[#34A853]";
          } else if (isWrongSelection) {
            btnBg = "bg-[#EA4335] text-white shadow-[4px_4px_0px_0px_black]";
            letterBg = "bg-white text-[#EA4335]";
          }

          const dimmed = isLocked && !isCorrectAnswer && !isWrongSelection;

          return (
            <button
              key={i}
              type="button"
              onClick={() => handlePick(i)}
              disabled={isLocked}
              className={cn(
                "group flex items-center gap-4 border-4 border-black p-5 text-left transition-all select-none cursor-pointer",
                "shadow-[6px_6px_0px_0px_black] active:translate-x-[2px] active:translate-y-[2px] disabled:cursor-default",
                btnBg,
                dimmed && "opacity-45"
              )}
            >
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center border-2 border-black font-heading text-lg font-black transition-colors",
                  letterBg
                )}
              >
                {isCorrectAnswer ? (
                  <CheckCircle2 className="size-6 stroke-[3]" />
                ) : isWrongSelection ? (
                  <XCircle className="size-6 stroke-[3]" />
                ) : (
                  LETTERS[i]
                )}
              </span>

              <span className="min-w-0 flex-1 font-heading text-base font-bold uppercase leading-snug">
                {opt}
              </span>

              {isCorrectAnswer && isSelected && answerInfo && (
                <span className="shrink-0 border-2 border-black bg-white px-2.5 py-1 text-xs font-black text-[#34A853] shadow-[2px_2px_0px_0px_black]">
                  +{answerInfo.points} PTS
                </span>
              )}
              {isWrongSelection && (
                <span className="shrink-0 border-2 border-black bg-white px-2.5 py-1 text-xs font-black text-[#EA4335] shadow-[2px_2px_0px_0px_black]">
                  YOUR PICK
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Auto-Advance Banner & Control Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t-2 border-black">
        <Button
          variant="outline"
          onClick={onPrev}
          disabled={!hasPrev}
          className="w-full sm:w-auto h-12 border-2 border-black font-black uppercase"
        >
          <ArrowLeft className="size-4 mr-1 stroke-[3]" /> PREVIOUS
        </Button>

        {isLocked ? (
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {autoAdvanceTimer !== null && (
              <span className="font-mono text-xs font-black uppercase text-neutral-600 hidden sm:inline-block">
                NEXT IN {autoAdvanceTimer}s
              </span>
            )}
            <Button
              variant="default"
              onClick={handleManualNext}
              className="w-full sm:w-auto h-12 border-2 border-black font-black uppercase bg-[#4285F4] hover:bg-[#3367D6] text-white shadow-[4px_4px_0px_0px_black]"
            >
              {hasNext ? "NEXT QUESTION" : "FINISH QUIZ"} <ArrowRight className="size-4 ml-1 stroke-[3]" />
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            onClick={onNext}
            disabled={!hasNext}
            className="w-full sm:w-auto h-12 border-2 border-black font-black uppercase opacity-60"
          >
            SKIP QUESTION <ArrowRight className="size-4 ml-1 stroke-[3]" />
          </Button>
        )}
      </div>
    </div>
  );
}

/* ---------------- Final Board ---------------- */

function FinalBoard({ me, currentScore }: { me: PlayState; currentScore: number }) {
  const { data } = usePoll<Leaderboard>(
    () => api<Leaderboard>("/api/play/leaderboard"),
    3000
  );

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-12">
      <div className="mb-8 border-4 border-black bg-[#F9AB00] p-8 text-center shadow-[8px_8px_0px_0px_black] relative">
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#EA4335] text-white text-[11px] font-black uppercase px-3 py-0.5 border-2 border-black shadow-[2px_2px_0px_0px_black]">
          QUIZ COMPLETED
        </div>
        <div className="mx-auto mb-3 flex size-16 items-center justify-center border-4 border-black bg-white shadow-[4px_4px_0px_0px_black]">
          <Trophy className="size-9 stroke-[3] text-black" />
        </div>
        <h1 className="font-heading text-4xl sm:text-5xl font-black uppercase tracking-tight">
          SHOWDOWN FINISHED!
        </h1>
        <p className="mt-3 font-heading text-lg font-black uppercase text-neutral-900">
          FINISHED #{data?.myRank ?? me.myRank ?? "—"} OF {data?.totalParticipants ?? me.totalParticipants ?? "—"}
        </p>
        <div className="mt-3 inline-block border-4 border-black bg-white px-6 py-2 font-mono text-2xl font-black shadow-[4px_4px_0px_0px_black]">
          {data?.myScore ?? currentScore} POINTS
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between border-2 border-black bg-white px-4 py-2 font-heading text-xs font-black uppercase shadow-[3px_3px_0px_0px_black]">
        <span>LIVE LEADERBOARD</span>
        <span className="flex items-center gap-1 font-mono text-neutral-600">
          <Clock className="size-3.5" /> UPDATING
        </span>
      </div>

      <BoardList
        rows={data?.top10 ?? []}
        emptyHint="Standings updating in real time…"
      />
    </main>
  );
}

/* ---------------- Waiting Card ---------------- */

function WaitingCard({
  title,
  message,
  sub,
  count,
  score,
}: {
  title: string;
  message: string;
  sub?: string;
  count?: number;
  score?: number;
}) {
  return (
    <Card className="w-full max-w-md border-4 border-black p-8 text-center shadow-[8px_8px_0px_0px_black]">
      <CardContent className="flex flex-col items-center gap-4 p-0">
        <div className="flex size-14 items-center justify-center border-2 border-black bg-[#4285F4] text-white shadow-[4px_4px_0px_0px_black]">
          <Zap className="size-7 stroke-[3]" />
        </div>
        <h1 className="font-heading text-2xl sm:text-3xl font-black uppercase tracking-tight">{title}</h1>
        <p className="text-sm font-bold uppercase text-neutral-700">{message}</p>
        {sub && <p className="font-mono text-xs font-black uppercase bg-[#F0F0F0] px-3 py-1 border border-black">{sub}</p>}
        <Spinner className="size-6 text-[#4285F4]" />
        <div className="flex gap-2 mt-2">
          {typeof count === "number" && (
            <Badge variant="yellow" className="border border-black font-black">
              {count} PLAYERS IN ROOM
            </Badge>
          )}
          {typeof score === "number" && (
            <Badge variant="green" className="border border-black font-black">
              {score} PTS
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function BoardList({
  rows,
  emptyHint = "No scores yet.",
}: {
  rows: {
    rank: number;
    name: string;
    stream: string;
    score: number;
    isMe?: boolean;
  }[];
  emptyHint?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="border-4 border-black bg-white p-8 text-center font-heading font-black uppercase text-sm shadow-[6px_6px_0px_0px_black]">
        {emptyHint}
      </div>
    );
  }
  return (
    <ol className="flex flex-col gap-3">
      {rows.map((r) => (
        <li
          key={`${r.rank}-${r.name}`}
          className={cn(
            "flex items-center gap-4 border-4 border-black bg-white px-5 py-3.5 shadow-[4px_4px_0px_0px_black]",
            r.isMe && "border-[#4285F4] bg-[#E8F0FE]"
          )}
        >
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center border-2 border-black font-mono font-black text-base shadow-[2px_2px_0px_0px_black]",
              r.rank === 1
                ? "bg-[#F9AB00] text-black"
                : r.rank === 2
                  ? "bg-[#4285F4] text-white"
                  : r.rank === 3
                    ? "bg-[#EA4335] text-white"
                    : "bg-[#F0F0F0] text-black"
            )}
          >
            {r.rank === 1 ? <Crown className="size-5 stroke-[3]" /> : r.rank}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-heading text-base font-black uppercase">
              {r.name}
              {r.isMe && (
                <span className="ml-2 border border-black bg-[#4285F4] px-1.5 py-0.5 text-[10px] font-black text-white">
                  YOU
                </span>
              )}
            </p>
            <p className="truncate text-xs font-bold uppercase text-neutral-600">{r.stream}</p>
          </div>
          <span className="font-mono text-lg font-black">{r.score}</span>
        </li>
      ))}
    </ol>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      {children}
    </main>
  );
}
