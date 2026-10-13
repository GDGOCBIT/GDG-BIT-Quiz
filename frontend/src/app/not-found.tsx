import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center p-6 text-center bg-[#F0F0F0]">
      <div className="max-w-md border-4 border-black bg-white p-8 shadow-[8px_8px_0px_0px_black]">
        <div className="mb-4 inline-block border-2 border-black bg-[#EA4335] px-3 py-1 font-mono text-xs font-black uppercase text-white shadow-[2px_2px_0px_0px_black]">
          404 NOT FOUND
        </div>
        <h1 className="font-heading text-4xl font-black uppercase tracking-tight text-[#121212]">
          PAGE NOT FOUND
        </h1>
        <p className="mt-3 text-sm font-medium text-neutral-700">
          The requested page does not exist or has been moved.
        </p>
        <div className="mt-6">
          <Link href="/">
            <Button
              variant="default"
              className="border-2 border-black font-black uppercase shadow-[4px_4px_0px_0px_black]"
            >
              <ArrowLeft className="size-4 mr-1 stroke-[3]" /> RETURN HOME
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
