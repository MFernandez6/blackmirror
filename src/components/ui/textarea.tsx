import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[96px] w-full min-w-0 rounded-xl border border-brand-white/10 bg-brand-navy/50 transition-colors focus-visible:border-brand-gold px-3 py-2 text-base text-brand-white placeholder:text-brand-slate/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-gold/50 disabled:cursor-not-allowed disabled:opacity-50 font-sans",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
