import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[96px] w-full min-w-0 rounded-md border border-brand-white/15 bg-brand-navy-deep/50 px-3 py-2 text-base text-brand-white placeholder:text-brand-slate/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-gold/50 disabled:cursor-not-allowed disabled:opacity-50 font-sans",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
