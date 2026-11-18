import type React from "react";

export function handleCardPointerMove(e: React.PointerEvent<HTMLElement>) {
  const rect = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--px", `${e.clientX - rect.left}px`);
  e.currentTarget.style.setProperty("--py", `${e.clientY - rect.top}px`);
}
