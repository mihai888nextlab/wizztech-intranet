import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useIsClient } from "@/hooks/use-is-client";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useIsClient();

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className={className}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {/* Placeholder until the resolved theme is known, to keep hydration clean. */}
      {mounted ? (
        isDark ? (
          <Moon className="size-[18px]" />
        ) : (
          <Sun className="size-[18px]" />
        )
      ) : (
        <span className="size-[18px]" />
      )}
    </Button>
  );
}
