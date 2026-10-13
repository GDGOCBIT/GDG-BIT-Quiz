import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { JoinQuizForm } from "@/components/join-quiz-form";
import { GdgHeaderLogo } from "@/components/gdg-elements";

export const metadata = { title: "Join Quiz Room" };

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return (
    <div className="relative min-h-dvh w-full overflow-hidden bg-[#F0F0F0] text-[#121212] flex flex-col justify-between">
      {/* Background Bauhaus architectural grid & shapes */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage: `
            linear-gradient(to right, #121212 1px, transparent 1px),
            linear-gradient(to bottom, #121212 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
        }}
      />
      <div className="pointer-events-none absolute -top-16 -right-16 size-64 rounded-full border-4 border-black bg-[#4285F4]/15" />
      <div className="pointer-events-none absolute bottom-12 -left-16 size-56 rotate-12 border-4 border-black bg-[#F9AB00]/15" />

      {/* Top Header */}
      <header className="relative z-10 w-full border-b-4 border-black bg-white px-4 sm:px-8 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 hover:opacity-90">
            <GdgHeaderLogo />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 border-2 border-black bg-white px-3 py-1.5 text-xs font-black uppercase tracking-wider text-black shadow-[2px_2px_0px_0px_black] hover:bg-[#F0F0F0] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
          >
            <ArrowLeft className="size-3.5 stroke-[3]" />
            CHANGE PIN
          </Link>
        </div>
      </header>

      {/* Main Form Center */}
      <main className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-4 py-8 sm:py-12">
        <JoinQuizForm code={code.toUpperCase()} />
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t-2 border-black bg-white py-3 text-center text-[11px] font-black uppercase tracking-widest text-neutral-600">
        GOOGLE DEVELOPER GROUPS ON CAMPUS · BIT CHAPTER
      </footer>
    </div>
  );
}
