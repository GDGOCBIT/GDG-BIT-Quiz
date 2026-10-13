import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap text-sm font-bold uppercase tracking-wider transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none select-none border-2 border-black active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
  {
    variants: {
      variant: {
        default:
          "bg-[#4285F4] text-white shadow-[4px_4px_0px_0px_black] hover:bg-[#3367D6]",
        red:
          "bg-[#EA4335] text-white shadow-[4px_4px_0px_0px_black] hover:bg-[#D32F2F]",
        green:
          "bg-[#34A853] text-white shadow-[4px_4px_0px_0px_black] hover:bg-[#2D8E47]",
        yellow:
          "bg-[#F9AB00] text-black shadow-[4px_4px_0px_0px_black] hover:bg-[#E39D00]",
        destructive:
          "bg-[#EA4335] text-white shadow-[4px_4px_0px_0px_black] hover:bg-[#C5221F]",
        outline:
          "bg-white text-black shadow-[4px_4px_0px_0px_black] hover:bg-[#F0F0F0]",
        secondary:
          "bg-[#F0F0F0] text-black shadow-[4px_4px_0px_0px_black] hover:bg-[#E0E0E0]",
        ghost:
          "border-none text-black hover:bg-black/10 shadow-none active:translate-x-0 active:translate-y-0",
        link:
          "border-none text-[#4285F4] underline-offset-4 hover:underline shadow-none active:translate-x-0 active:translate-y-0",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 px-3.5 text-xs",
        lg: "h-14 px-8 text-base",
        icon: "size-11",
        "icon-sm": "size-9",
        "icon-lg": "size-14",
      },
      shape: {
        square: "rounded-none",
        pill: "rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      shape: "square",
    },
  }
);

function Button({
  className,
  variant,
  size,
  shape,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, shape, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
