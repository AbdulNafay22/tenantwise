import { useState } from "react";
import { MoonIcon, SunIcon } from "./icons";

type Theme = "light" | "dark";
const STORAGE_KEY = "tenantwise-theme";

function currentTheme(): Theme {
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Flips between light and dark. Until the user picks, the page follows the OS setting;
 * index.html re-applies a saved choice before first paint. */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // storage blocked (private mode) -- the choice just won't persist
    }
    setTheme(next);
  }

  const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  return (
    <button type="button" className="icon-button" onClick={toggle} aria-label={label} title={label}>
      {theme === "dark" ? <SunIcon size={18} /> : <MoonIcon size={18} />}
    </button>
  );
}
