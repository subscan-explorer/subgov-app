"use client";

import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";

/** Native modal focus containment and Escape handling for governance forms. */
export function Modal({ children, titleId, onClose, busy = false, className }: {
  children: React.ReactNode;
  titleId: string;
  onClose: () => void;
  busy?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return <dialog ref={ref} aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
    className={cn("subgov-modal m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto overscroll-contain border-0 bg-transparent p-0 text-paper backdrop:bg-black/60 backdrop:backdrop-blur-[2px]", className)}>
    {children}
  </dialog>;
}
