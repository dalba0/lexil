import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  size?: "lg" | "md";
}

// The search input is the most opinionated piece of chrome in the app:
// large serif, no box, a single bottom hairline, accent-colored caret.
export const SearchInput = forwardRef<HTMLInputElement, Props>(
  ({ className, size = "lg", ...props }, ref) => (
    <div
      className={cn(
        "border-b border-border focus-within:border-ink/30 transition-colors duration-fast",
        className,
      )}
    >
      <input
        ref={ref}
        type="text"
        autoComplete="off"
        spellCheck={false}
        className={cn(
          "search-caret w-full bg-transparent font-serif text-ink placeholder:text-faint focus:outline-none",
          size === "lg" ? "h-14 text-[28px] leading-9" : "h-10 text-[18px] leading-6",
        )}
        {...props}
      />
    </div>
  ),
);
SearchInput.displayName = "SearchInput";
