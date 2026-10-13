"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { GdgLogoBrackets } from "@/components/gdg-elements";
import { Lock, ArrowRight, ArrowLeft } from "lucide-react";
import { api } from "@/lib/use-poll";
import Link from "next/link";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[#F0F0F0] px-4 py-12">
      <Card className="w-full max-w-md border-4 border-black bg-white shadow-[8px_8px_0px_0px_black]">
        <div className="h-3 w-full bg-[#EA4335] border-b-2 border-black" />

        <CardHeader className="items-center text-center pb-2">
          <div className="flex size-14 items-center justify-center border-2 border-black bg-[#F9AB00] text-black shadow-[3px_3px_0px_0px_black] mb-2">
            <Lock className="size-7 stroke-[3]" />
          </div>
          <div className="flex items-center gap-2 mb-1">
            <CardTitle className="font-heading text-3xl font-black uppercase tracking-tight">
              HOST CONSOLE
            </CardTitle>
            <GdgLogoBrackets />
          </div>
          <CardDescription className="text-xs font-bold uppercase tracking-wider text-neutral-600">
            GOOGLE DEVELOPER GROUPS ON CAMPUS
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          <form onSubmit={submit} className="flex flex-col gap-5">
            <div>
              <label htmlFor="admin-pwd" className="block font-heading text-xs font-black uppercase tracking-wider text-neutral-800 mb-2">
                ADMIN MASTER PASSWORD
              </label>
              <Input
                id="admin-pwd"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                autoComplete="current-password"
                aria-label="Admin password"
                className="border-2 border-black h-12 text-lg font-bold shadow-[3px_3px_0px_0px_black]"
              />
            </div>

            {error && (
              <Alert variant="destructive" className="border-2 border-black bg-[#EA4335] text-white shadow-[4px_4px_0px_0px_black] rounded-none">
                <AlertDescription className="text-white font-black uppercase text-xs tracking-wider">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              variant="default"
              disabled={loading || !password}
              className="h-14 text-base font-black border-2 border-black shadow-[4px_4px_0px_0px_black]"
            >
              {loading ? <Spinner className="size-5 mr-2" /> : null}
              {loading ? "AUTHENTICATING..." : "ENTER HOST DASHBOARD"}
              {!loading && <ArrowRight className="size-5 ml-1 stroke-[3]" />}
            </Button>

            <div className="pt-2 text-center">
              <Link href="/" className="inline-flex items-center gap-1 text-xs font-black uppercase text-neutral-600 hover:text-black hover:underline">
                <ArrowLeft className="size-3.5 stroke-[3]" />
                BACK TO PARTICIPANT JOIN SCREEN
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
