"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const dark = mounted ? resolvedTheme === "dark" : true;

  useEffect(() => {
    if (!mounted) return;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", dark ? "#09090b" : "#fafafa");
  }, [dark, mounted]);

  return (
    <Button
      type="button"
      size="icon"
      variant="outline"
      data-testid="theme-toggle"
      aria-label={dark ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن"}
      title={dark ? "الوضع الفاتح" : "الوضع الداكن"}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
