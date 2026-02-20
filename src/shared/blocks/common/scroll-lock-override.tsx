"use client";

import { useLayoutEffect } from "react";

const LOCKED_STYLES: Array<[string, string]> = [
  ["margin-right", "0px"],
  ["padding-right", "0px"],
  ["overflow-y", "scroll"],
  ["position", "static"],
];

export function ScrollLockOverride() {
  useLayoutEffect(() => {
    if (typeof document === "undefined") return;

    const body = document.body;

    const apply = () => {
      if (body.hasAttribute("data-scroll-locked")) {
        for (const [key, value] of LOCKED_STYLES) {
          body.style.setProperty(key, value, "important");
        }
        body.style.setProperty("--removed-body-scroll-bar-size", "0px");
      } else {
        for (const [key] of LOCKED_STYLES) {
          body.style.removeProperty(key);
        }
        body.style.removeProperty("--removed-body-scroll-bar-size");
      }
    };

    apply();

    const observer = new MutationObserver(() => apply());
    observer.observe(body, {
      attributes: true,
      attributeFilter: ["data-scroll-locked"],
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
