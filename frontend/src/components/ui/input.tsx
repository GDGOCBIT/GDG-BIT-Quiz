import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-neutral-500 selection:bg-[#F9AB00] selection:text-black border-2 border-black h-12 w-full min-w-0 rounded-none bg-white px-4 py-2 text-base font-semibold shadow-[4px_4px_0px_0px_black] transition-all outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:border-black focus-visible:bg-[#FFFFE0] focus-visible:translate-x-[1px] focus-visible:translate-y-[1px]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
