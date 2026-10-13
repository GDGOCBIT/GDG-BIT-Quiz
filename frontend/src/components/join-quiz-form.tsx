"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { GdgLogoBrackets } from "@/components/gdg-elements";
import { Users, ArrowRight, ArrowLeft } from "lucide-react";
import { api } from "@/lib/use-poll";
import { cn } from "@/lib/utils";

type QuizInfo = {
  quiz: { title: string; description: string; status: string };
  participantCount: number;
};

const STREAMS = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "AIML", "Other"];

export function JoinQuizForm({ code }: { code: string }) {
  const router = useRouter();
  const [info, setInfo] = useState<QuizInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [stream, setStream] = useState("");
  const [joining, setJoining] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    setNotFound(false);
    api<QuizInfo>(`/api/quiz/${code}`)
      .then((d) => !cancelled && setInfo(d))
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof Error && /not found/i.test(e.message)) {
          setNotFound(true);
        } else {
          setLoadError(e instanceof Error ? e.message : "Connection error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [code, retryNonce]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("PLEASE ENTER YOUR FULL NAME");
      return;
    }
    if (!stream.trim()) {
      setError("PLEASE SELECT OR ENTER YOUR BRANCH / STREAM");
      return;
    }
    setJoining(true);
    setError(null);
    try {
      await api("/api/join", {
        method: "POST",
        body: JSON.stringify({ code, name: name.trim(), stream: stream.trim() }),
      });
      router.push("/play");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join room");
      setJoining(false);
    }
  };

  if (notFound) {
    return (
      <Card className="w-full text-center border-4 border-black bg-white shadow-[8px_8px_0px_0px_black] p-6 sm:p-8">
        <CardHeader>
          <div className="mx-auto mb-3 flex size-16 items-center justify-center border-2 border-black bg-[#EA4335] text-white shadow-[4px_4px_0px_0px_black]">
            <span className="font-heading font-black text-3xl">!</span>
          </div>
          <CardTitle className="text-3xl font-black uppercase tracking-tight">ROOM NOT FOUND</CardTitle>
          <CardDescription className="text-sm font-bold text-neutral-700 mt-2">
            No active quiz session was found with room PIN:
            <div className="mt-3">
              <span className="font-mono text-2xl font-black bg-[#F9AB00] text-black px-4 py-1.5 border-2 border-black shadow-[3px_3px_0px_0px_black]">
                {code}
              </span>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent className="mt-6 flex flex-col gap-3">
          <Button
            variant="default"
            className="w-full h-12 border-2 border-black font-black uppercase text-sm shadow-[4px_4px_0px_0px_black]"
            onClick={() => router.push("/")}
          >
            <ArrowLeft className="size-4 mr-2 stroke-[3]" />
            RETURN TO HOME & RETRY
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loadError && !info) {
    return (
      <Card className="w-full text-center border-4 border-black bg-white shadow-[8px_8px_0px_0px_black] p-6 sm:p-8">
        <CardHeader>
          <CardTitle className="text-2xl font-black uppercase">SERVER UNREACHABLE</CardTitle>
          <CardDescription className="font-bold text-neutral-700">{loadError}</CardDescription>
        </CardHeader>
        <CardContent className="mt-4">
          <Button
            variant="yellow"
            className="w-full h-12 border-2 border-black font-black uppercase shadow-[4px_4px_0px_0px_black]"
            onClick={() => setRetryNonce((n) => n + 1)}
          >
            RECONNECT
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!info) {
    return (
      <div className="flex flex-col items-center gap-4 bg-white border-4 border-black p-8 shadow-[8px_8px_0px_0px_black]">
        <Spinner className="size-10 text-[#4285F4]" />
        <span className="font-heading font-black uppercase tracking-wider text-sm">
          CONNECTING TO ROOM {code}...
        </span>
      </div>
    );
  }

  const initials = name.trim()
    ? name
        .trim()
        .split(/\s+/)
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "GDG";

  return (
    <Card className="w-full border-4 border-black bg-white shadow-[8px_8px_0px_0px_black] overflow-hidden">
      {/* 4-Color Google Primary Bauhaus Banner Stripe */}
      <div className="grid grid-cols-4 h-3.5 w-full border-b-2 border-black">
        <div className="bg-[#4285F4]" />
        <div className="bg-[#EA4335]" />
        <div className="bg-[#F9AB00]" />
        <div className="bg-[#34A853]" />
      </div>

      <CardHeader className="items-center text-center pb-2 pt-6">
        <div className="flex items-center gap-2 mb-2">
          <GdgLogoBrackets />
          <span className="font-mono text-xs font-black uppercase tracking-widest bg-[#F9AB00] px-2.5 py-0.5 border-2 border-black shadow-[2px_2px_0px_0px_black]">
            ROOM PIN: {code}
          </span>
        </div>

        <CardTitle className="font-heading text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#121212] px-2">
          {info.quiz.title}
        </CardTitle>
        {info.quiz.description && (
          <CardDescription className="text-xs sm:text-sm font-semibold text-neutral-600 max-w-sm mt-1">
            {info.quiz.description}
          </CardDescription>
        )}

        <div className="mt-3 inline-flex items-center gap-2 border-2 border-black bg-[#F0F0F0] px-3 py-1 text-xs font-black uppercase shadow-[2px_2px_0px_0px_black]">
          <span className="size-2 rounded-full bg-[#34A853] animate-pulse" />
          <Users className="size-3.5 text-[#4285F4] stroke-[2.5]" />
          <span>{info.participantCount} ATTENDEES IN LOBBY</span>
        </div>
      </CardHeader>

      <form onSubmit={submit}>
        <CardContent className="flex flex-col gap-5 pt-4">
          {/* Avatar Preview + Name Input */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="name" className="font-heading text-xs font-black uppercase tracking-wider text-neutral-800">
              YOUR FULL NAME
            </Label>
            <div className="flex items-center gap-3">
              <div
                className="flex size-12 shrink-0 items-center justify-center border-2 border-black bg-[#F9AB00] text-black font-heading font-black text-base shadow-[3px_3px_0px_0px_black] uppercase"
                title="Your player badge"
              >
                {initials}
              </div>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex Rivera"
                maxLength={40}
                autoFocus
                autoComplete="name"
                className="border-2 border-black h-12 text-base font-bold shadow-[3px_3px_0px_0px_black] flex-1"
              />
            </div>
          </div>

          {/* Branch / Stream with Quick Pills */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="stream" className="font-heading text-xs font-black uppercase tracking-wider text-neutral-800">
                DEPARTMENT / BRANCH
              </Label>
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                TAP TO QUICK-SELECT
              </span>
            </div>

            {/* Quick Pills */}
            <div className="flex flex-wrap gap-1.5 pb-1">
              {STREAMS.map((s) => {
                const isSelected = stream.toUpperCase() === s.toUpperCase();
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStream(s)}
                    className={cn(
                      "px-2.5 py-1 text-xs font-black uppercase border-2 border-black transition-all",
                      isSelected
                        ? "bg-[#4285F4] text-white shadow-[2px_2px_0px_0px_black] translate-x-0.5 translate-y-0.5"
                        : "bg-white text-black hover:bg-[#F0F0F0] shadow-[2px_2px_0px_0px_black]"
                    )}
                  >
                    {s}
                  </button>
                );
              })}
            </div>

            <Input
              id="stream"
              value={stream}
              onChange={(e) => setStream(e.target.value)}
              placeholder="Or type custom department..."
              maxLength={40}
              className="border-2 border-black h-11 text-sm font-bold uppercase shadow-[3px_3px_0px_0px_black]"
            />
          </div>

          {error && (
            <Alert variant="destructive" className="border-2 border-black bg-[#EA4335] text-white shadow-[4px_4px_0px_0px_black] rounded-none">
              <AlertDescription className="text-white font-black uppercase text-xs tracking-wider">
                {error}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>

        <CardFooter className="flex-col gap-3 pt-2 pb-6">
          <Button
            type="submit"
            variant="green"
            disabled={joining}
            className="w-full h-14 text-base font-black uppercase border-2 border-black shadow-[4px_4px_0px_0px_black] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
          >
            {joining ? (
              <>
                <Spinner className="size-5 mr-2" />
                ENTERING ROOM...
              </>
            ) : (
              <>
                ENTER THE SHOWDOWN
                <ArrowRight className="size-5 ml-1.5 stroke-[3]" />
              </>
            )}
          </Button>

          <p className="text-center text-[11px] font-bold uppercase tracking-wider text-neutral-600">
            {info.quiz.status === "lobby"
              ? "● LOBBY IS LIVE — COMPETE IMMEDIATELY UPON START"
              : info.quiz.status === "active"
                ? "● QUIZ IN PROGRESS — ANSWER AT YOUR OWN SPEED"
                : "● GET READY FOR SPEED SCORING"}
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
