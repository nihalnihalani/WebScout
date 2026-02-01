"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle({ showLabel = true }: { showLabel?: boolean }) {
    const { theme, setTheme } = useTheme();

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            className={`w-full flex items-center gap-3 px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 transition-all group ${!showLabel ? "justify-center" : "justify-start"}`}
        >
            <div className="relative w-4 h-4 flex items-center justify-center shrink-0">
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-amber-500" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-blue-400" />
            </div>
            {showLabel && (
                <span className="text-sm font-medium truncate">
                    {theme === "light" ? "Light Mode" : "Dark Mode"}
                </span>
            )}
            <span className="sr-only">Toggle theme</span>
        </Button>
    );
}
