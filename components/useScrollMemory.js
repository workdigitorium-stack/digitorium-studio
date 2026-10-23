"use client";
/* Going back lands where you were. Every screen's scroll position is kept
   for the tab's session; Back (the app's button, the browser's, or an
   iPhone swipe) puts it back once the screen has loaded enough to reach it.
   Also counts how deep in the Studio this tab is, so the top bar's back
   button knows whether "back" stays inside the Studio. */
import { useEffect, useRef } from "react";

const KEY = "studio:scroll";
const DEPTH = "studio:depth";

function read(k, fallback) {
  try {
    return JSON.parse(sessionStorage.getItem(k)) ?? fallback;
  } catch (e) {
    return fallback;
  }
}
function write(k, v) {
  try {
    sessionStorage.setItem(k, JSON.stringify(v));
  } catch (e) {
    /* private mode: just forget */
  }
}
const here = () => window.location.pathname + window.location.search;

export function canGoBack() {
  return typeof window !== "undefined" && read(DEPTH, 0) > 0;
}

export default function useScrollMemory(path) {
  const restoring = useRef(false);
  const popped = useRef(false);
  const first = useRef(true);

  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    const saved = read(KEY, {});
    let raf = 0;
    const onScroll = () => {
      if (restoring.current || raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        saved[here()] = Math.round(window.scrollY);
        write(KEY, saved);
      });
    };

    let stop = () => {};
    const onPop = () => {
      popped.current = true;
      stop();
      const target = saved[here()] || 0;
      restoring.current = true;
      const until = Date.now() + 2500;
      let id = 0;
      const giveUp = () => {
        restoring.current = false;
        cancelAnimationFrame(id);
        window.removeEventListener("touchstart", giveUp);
        window.removeEventListener("wheel", giveUp);
      };
      stop = giveUp;
      window.addEventListener("touchstart", giveUp, { passive: true });
      window.addEventListener("wheel", giveUp, { passive: true });
      /* the screen may still be loading its list: keep trying until it is tall enough */
      const tick = () => {
        const room = document.documentElement.scrollHeight - window.innerHeight;
        if (room >= target - 2 || Date.now() > until) {
          window.scrollTo(0, Math.min(target, room));
          return giveUp();
        }
        id = requestAnimationFrame(tick);
      };
      id = requestAnimationFrame(tick);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("popstate", onPop);
    return () => {
      stop();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const d = read(DEPTH, 0);
    write(DEPTH, popped.current ? Math.max(0, d - 1) : d + 1);
    popped.current = false;
  }, [path]);
}
