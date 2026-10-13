import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center border-2 border-black px-2.5 py-1 text-xs font-black uppercase tracking-wider w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1.5 [&>svg]:pointer-events-none select-none shadow-[2px_2px_0px_0px_black]",
  {
    variants: {
      variant: {
        default:
          "bg-[#4285F4] text-white",
        red:
          "bg-[#EA4335] text-white",
        green:
          "bg-[#34A853] text-white",
        yellow:
          "bg-[#F9AB00] text-black",
        secondary:
          "bg-white text-black",
        destructive:
          "bg-[#EA4335] text-white",
        outline:
          "bg-white text-black",
      },
      shape: {
        square: "rounded-none",
        pill: "rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      shape: "square",
    },
  }
)

function Badge({
  className,
  variant,
  shape,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, shape }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
