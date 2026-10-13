"use client";

import Link from "next/link";
import { JoinCodeForm } from "@/components/join-code-form";
import { GdgLogoBrackets } from "@/components/gdg-elements";
import {
  QrCode,
  Trophy,
  Timer,
  Zap,
  ArrowRight,
  Sparkles,
  Radio,
  Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="relative min-h-dvh flex flex-col bg-[#F0F0F0] text-[#121212] selection:bg-[#F9AB00] selection:text-[#121212]">
      {/* Bauhaus Top Navigation Bar */}
      <header className="sticky top-0 z-50 border-b-4 border-black bg-white">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-8">
          <Link href="/" className="group flex items-center gap-3">
            {/* Bauhaus Geometric Icon */}
            <div className="flex size-11 items-center justify-center border-2 border-black bg-[#4285F4] shadow-[3px_3px_0px_0px_black] transition-transform group-hover:-translate-y-0.5">
              <Zap className="size-6 text-white stroke-[3]" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-heading text-2xl font-black uppercase tracking-tighter text-[#121212]">
                  QUIZ<span className="text-[#EA4335]">LIVE</span>
                </span>
                <GdgLogoBrackets />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-600">
                Google Developer Groups On Campus
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3 sm:gap-4">
            <Badge variant="green" className="hidden sm:inline-flex border-2 border-black">
              <span className="mr-1 size-2 rounded-full bg-white animate-pulse" />
              LIVE ENGINE
            </Badge>
            <Link href="/admin">
              <Button
                variant="outline"
                size="sm"
                className="border-2 border-black font-black uppercase tracking-wider shadow-[3px_3px_0px_0px_black]"
              >
                HOST CONSOLE
                <ArrowRight className="size-4 ml-1 stroke-[3]" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section: Asymmetric Constructivist Poster Layout */}
      <main className="flex-1">
        <section className="border-b-4 border-black bg-white">
          <div className="mx-auto max-w-4xl p-6 sm:p-12 lg:py-20 flex flex-col items-center text-center">
            <div className="inline-flex items-center gap-2 border-2 border-black bg-[#F9AB00] px-3.5 py-1 text-xs font-black uppercase tracking-widest shadow-[3px_3px_0px_0px_black] mb-6">
              <Sparkles className="size-3.5 text-black" />
              <span>ON CAMPUS REAL-TIME QUIZ</span>
            </div>

            <h1 className="font-heading text-5xl sm:text-7xl lg:text-8xl font-black uppercase tracking-tighter leading-[0.9] text-[#121212]">
              ANSWER <span className="bg-[#4285F4] text-white px-2 inline-block -rotate-1 border-2 border-black shadow-[4px_4px_0px_0px_black]">FAST.</span>
              <br />
              WIN <span className="text-[#EA4335]">TOGETHER.</span>
            </h1>

            <p className="mt-6 max-w-2xl text-base sm:text-lg font-medium leading-relaxed text-neutral-800">
              Built for GDG Hackathons, tech workshops, and college showdowns.
              Self-paced questions load sequentially with instant timer feedback and live scoreboards. Finish each question before the clock runs out to earn speed bonuses.
            </p>

            {/* Join Box (Embedded Constructivist Block) */}
            <div className="mt-10 w-full max-w-lg border-4 border-black bg-[#F0F0F0] p-6 sm:p-8 shadow-[8px_8px_0px_0px_black] text-left relative">
              <div className="absolute -top-3 right-4 bg-[#EA4335] text-white text-[11px] font-black uppercase tracking-widest px-2.5 py-0.5 border-2 border-black shadow-[2px_2px_0px_0px_black]">
                PARTICIPANT ACCESS
              </div>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-heading text-lg font-black uppercase tracking-tight">JOIN A LIVE ROOM</h2>
                  <p className="text-xs font-semibold text-neutral-600">Enter the 6-character PIN code displayed by the host</p>
                </div>
                <Radio className="size-5 text-[#34A853] animate-pulse stroke-[3]" />
              </div>
              <JoinCodeForm />
            </div>
          </div>
        </section>

        {/* Stats Section: Yellow Color-Block with Thick Dividers */}
        <section className="border-b-4 border-black bg-[#F9AB00] text-black">
          <div className="mx-auto max-w-7xl grid grid-cols-2 md:grid-cols-4 divide-y-4 md:divide-y-0 md:divide-x-4 divide-black">
            {[
              { num: "0ms", label: "QUESTION LAG", sub: "Preloaded bundle" },
              { num: "150", label: "MAX POINTS", sub: "Speed bonus scaled" },
              { num: "100+", label: "CONCURRENT PLAYERS", sub: "Per isolate" },
              { num: "100%", label: "GDG BRAND COMPLIANT", sub: "Colors & elements" },
            ].map((stat, i) => (
              <div key={i} className="p-6 sm:p-8 flex flex-col justify-center">
                <span className="font-heading text-4xl sm:text-5xl font-black tracking-tight">{stat.num}</span>
                <span className="font-heading text-sm font-black uppercase tracking-wider mt-1">{stat.label}</span>
                <span className="text-xs font-bold text-neutral-800">{stat.sub}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Features Section: Constructivist Grid */}
        <section className="py-16 sm:py-24 px-4 sm:px-8 border-b-4 border-black bg-[#F0F0F0]">
          <div className="mx-auto max-w-7xl">
            <div className="mb-12">
              <span className="inline-block bg-black text-white text-xs font-black uppercase tracking-widest px-3 py-1 mb-3">
                SYSTEM ARCHITECTURE
              </span>
              <h2 className="font-heading text-4xl sm:text-6xl font-black uppercase tracking-tight text-[#121212]">
                ENGINEERED FOR THE STAGE.
              </h2>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              {[
                {
                  color: "#4285F4",
                  badge: "WAYGROUND-STYLE",
                  badgeVariant: "default",
                  title: "SELF-PACED FLOW",
                  desc: "Answer each question and seamlessly advance to the next on your phone before the timer expires. No waiting for the host to click Next.",
                  icon: QrCode,
                },
                {
                  color: "#34A853",
                  badge: "SPEED SCORING",
                  badgeVariant: "green",
                  title: "CLIENT COMPUTATION",
                  desc: "Score and remaining countdown are calculated on device for zero-latency feedback. 100 base points + up to 50 speed bonus points.",
                  icon: Timer,
                },
                {
                  color: "#EA4335",
                  badge: "WEBSOCKETS",
                  badgeVariant: "red",
                  title: "LIVE LEADERBOARDS",
                  desc: "Scores sync seamlessly via WebSocket streams. Standings update across player screens and host projector without polling.",
                  icon: Trophy,
                },
              ].map((card, i) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.title}
                    className="border-4 border-black bg-white p-8 shadow-[8px_8px_0px_0px_black] relative flex flex-col justify-between"
                  >
                    {/* Bauhaus Corner Accent */}
                    <div
                      className="absolute top-4 right-4 size-5 border-2 border-black"
                      style={{ backgroundColor: card.color }}
                    />

                    <div>
                      <div className="flex items-center gap-2 mb-6">
                        <div
                          className="flex size-12 items-center justify-center border-2 border-black text-white shadow-[3px_3px_0px_0px_black]"
                          style={{ backgroundColor: card.color }}
                        >
                          <Icon className="size-6 stroke-[3]" />
                        </div>
                      </div>

                      <h3 className="font-heading text-2xl font-black uppercase tracking-tight">
                        {card.title}
                      </h3>
                      <p className="mt-3 text-sm font-medium leading-relaxed text-neutral-700">
                        {card.desc}
                      </p>
                    </div>

                    <div className="mt-8 pt-4 border-t-2 border-black flex items-center justify-between text-xs font-black uppercase">
                      <span style={{ color: card.color }}>● FEATURE 0{i + 1}</span>
                      <span className="text-neutral-500">GDG READY</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* How It Works: 4-Step Constructivist Walkthrough */}
        <section className="py-16 sm:py-20 px-4 sm:px-8 border-b-4 border-black bg-white">
          <div className="mx-auto max-w-7xl">
            <h2 className="font-heading text-3xl sm:text-5xl font-black uppercase tracking-tight mb-12">
              HOW IT WORKS AT EVENTS
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { step: "01", title: "CREATE QUIZ", desc: "Host imports questions with timers (10s, 20s, or 30s) and generates room PIN." },
                { step: "02", title: "SCAN & JOIN", desc: "Attendees scan the QR code or enter the 6-character PIN on their mobile browser." },
                { step: "03", title: "RACE THE CLOCK", desc: "Answer one by one before the timer expires to rack up maximum speed bonus." },
                { step: "04", title: "PODIUM REVEAL", desc: "Instant podium ceremony on projector with live score ties resolution." },
              ].map((s, idx) => (
                <div key={s.step} className="border-4 border-black p-6 bg-[#F0F0F0] shadow-[6px_6px_0px_0px_black] flex flex-col justify-between">
                  <div>
                    <div className="size-12 bg-black text-white flex items-center justify-center font-heading font-black text-xl mb-4 border-2 border-black shadow-[3px_3px_0px_0px_#F9AB00]">
                      {s.step}
                    </div>
                    <h3 className="font-heading text-xl font-black uppercase tracking-tight">{s.title}</h3>
                    <p className="mt-2 text-xs font-semibold text-neutral-700 leading-normal">{s.desc}</p>
                  </div>
                  <div className="mt-6 flex items-center gap-1.5 text-[11px] font-black uppercase text-neutral-500">
                    <Check className="size-3.5 text-[#34A853] stroke-[3]" />
                    <span>STEP {idx + 1}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Bauhaus Footer: Stark Black Color Block */}
      <footer className="border-t-4 border-black bg-[#121212] text-white py-12 px-4 sm:px-8">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center sm:items-start gap-1">
            <div className="flex items-center gap-2">
              <span className="font-heading text-xl font-black uppercase tracking-tighter">
                QUIZLIVE <span className="text-[#EA4335]">ON CAMPUS</span>
              </span>
              <GdgLogoBrackets />
            </div>
            <p className="text-xs font-medium text-neutral-400">
              Form follows function. Built for Google Developer Groups On Campus events.
            </p>
          </div>

          <div className="flex items-center gap-6 text-xs font-black uppercase tracking-wider">
            <Link href="/admin/login" className="hover:text-[#F9AB00] transition-colors underline-offset-4 hover:underline">
              ADMIN LOGIN
            </Link>
            <span className="text-neutral-600">/</span>
            <Link href="/admin" className="hover:text-[#4285F4] transition-colors underline-offset-4 hover:underline">
              HOST CONSOLE
            </Link>
            <span className="text-neutral-600">/</span>
            <span className="text-[#34A853]">WEBSOCKET ACTIVE</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
