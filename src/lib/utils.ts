import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Global rule: pressing the header logo always scrolls to the very top of the page. */
export function scrollToTop(behavior: ScrollBehavior = "smooth") {
  if (typeof window === "undefined") return;
  window.scrollTo({ top: 0, left: 0, behavior });
  const root = document.getElementById("app-scroll-root");
  if (root) root.scrollTo({ top: 0, left: 0, behavior });
}
