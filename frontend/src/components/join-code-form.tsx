"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowRight } from "lucide-react";

export function JoinCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (clean.length !== 6) {
      setError("ENTER THE 6-CHARACTER QUIZ PIN");
      return;
    }
    router.push(`/join/${clean}`);
  };

  return (
    <form onSubmit={go} className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Input
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setError(null);
            }}
            placeholder="AB12CD"
            maxLength={6}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="h-14 w-full text-center font-mono text-xl font-black tracking-[0.35em] uppercase border-4 border-black bg-white shadow-[4px_4px_0px_0px_black]"
            aria-label="Quiz room PIN"
          />
        </div>
        <Button
          type="submit"
          variant="yellow"
          className="h-14 px-8 border-4 border-black font-black text-base shadow-[4px_4px_0px_0px_black] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
        >
          <span>ENTER ROOM</span>
          <ArrowRight className="size-5 ml-1 stroke-[3]" />
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="border-2 border-black bg-[#EA4335] text-white shadow-[4px_4px_0px_0px_black] rounded-none">
          <AlertDescription className="text-white font-bold uppercase text-xs tracking-wider">{error}</AlertDescription>
        </Alert>
      )}
    </form>
  );
}
