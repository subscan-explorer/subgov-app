"use client";

import type { CallNode } from "@/lib/call-tree";
import { useState } from "react";

/** Recursive, collapsible view of a decoded call. */
export function CallTreeView({ node, depth = 0 }: { node: CallNode; depth?: number }) {
  const [open, setOpen] = useState(depth < 3);
  const nested = node.args.some((arg) => arg.calls?.length);
  return (
    <div className={depth ? "mt-2 border-l border-line pl-4" : ""}>
      <button type="button" className="flex items-center gap-2 text-left text-sm" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span className="num w-3 text-mute" aria-hidden="true">{open ? "▾" : "▸"}</span>
        <span className="num font-semibold text-paper">{node.section}.{node.method}</span>
        {!open && nested ? <span className="text-xs text-mute">nested calls</span> : null}
      </button>
      {open ? (
        <div className="ml-5">
          {node.docs ? <p className="mt-1 text-xs leading-5 text-mute">{node.docs}</p> : null}
          <dl className="mt-2 flex flex-col gap-2">
            {node.args.map((arg, index) => (
              <div key={`${arg.name}-${index}`} className="min-w-0 text-xs">
                <dt className="text-mute"><span className="text-paper">{arg.name}</span>{arg.type ? <span className="num ml-1.5">{arg.type}</span> : null}</dt>
                <dd className="min-w-0">
                  {arg.calls ? arg.calls.map((child, childIndex) => <CallTreeView key={childIndex} node={child} depth={depth + 1} />) : (
                    <pre className="num mt-1 max-h-60 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-panel-2 px-3 py-2 text-[11px] leading-5">{arg.value}</pre>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </div>
  );
}
