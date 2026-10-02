import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md font-sans text-[10px] font-bold uppercase tracking-[0.2em] rounded-md transition-[color,background-color,border-color,filter] duration-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-gold/50 disabled:pointer-events-none disabled:opacity-40 border touch-manipulation",
  {
    variants: {
      variant: {
        default:
          "border-brand-gold/25 bg-brand-navy/90 text-brand-gold hover:bg-brand-gold hover:text-brand-navy",
        solid:
          "border-brand-gold bg-brand-gold text-brand-navy hover:brightness-110",
        amber:
          "border-brand-amber bg-brand-amber text-brand-navy hover:brightness-110",
        outline:
          "border-brand-white/15 bg-transparent text-brand-white/80 hover:border-brand-gold/40 hover:text-brand-gold",
        ghost:
          "border-transparent bg-transparent text-brand-slate hover:text-brand-gold",
        destructive:
          "border-denied/50 bg-denied-muted text-denied-soft hover:bg-denied/20",
        secondary:
          "border-brand-gold/15 bg-brand-navy/60 text-brand-white hover:border-brand-gold/40",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 px-3 text-[9px]",
        lg: "h-12 px-8",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
