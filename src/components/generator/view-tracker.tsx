"use client";

import { useEffect } from "react";
import { trackGeneratorViewed } from "@/server/actions/track";

// Module scope, so React's development double-invocation of effects logs one view.
let tracked = false;

/** Logs `generator_viewed` once per page load, from the browser so link prefetches do not count. */
export function GeneratorViewTracker() {
  useEffect(() => {
    if (tracked) return;
    tracked = true;
    void trackGeneratorViewed();
  }, []);

  return null;
}
