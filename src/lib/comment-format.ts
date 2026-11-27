/** Pure helpers for discussion comments (#109): threads, quotes, mentions and anchors. */

export type ThreadComment = { id: string; replyToId: string | null; ctime: string };

/** Top-level comments in order, each with its (recursively flattened) replies; orphans become top-level. */
export function threadComments<T extends ThreadComment>(comments: T[], order: "oldest" | "newest" = "oldest") {
  const ids = new Set(comments.map((comment) => comment.id));
  const byParent = new Map<string, T[]>();
  const roots: T[] = [];
  for (const comment of comments) {
    if (comment.replyToId && ids.has(comment.replyToId) && comment.replyToId !== comment.id) byParent.set(comment.replyToId, [...(byParent.get(comment.replyToId) ?? []), comment]);
    else roots.push(comment);
  }
  const time = (comment: T) => Date.parse(comment.ctime) || 0;
  roots.sort((a, b) => (order === "oldest" ? time(a) - time(b) : time(b) - time(a)));
  const repliesOf = (id: string, seen = new Set<string>()): T[] => {
    if (seen.has(id)) return [];
    seen.add(id);
    return (byParent.get(id) ?? []).sort((a, b) => time(a) - time(b)).flatMap((reply) => [reply, ...repliesOf(reply.id, seen)]);
  };
  return roots.map((root) => ({ comment: root, replies: repliesOf(root.id) }));
}

/** Markdown quote block for replying with context. */
export function quoteBody(body: string, author: string) {
  const lines = body.trim().split("\n").slice(0, 8).map((line) => `> ${line}`);
  return `> @${author} wrote:\n${lines.join("\n")}\n\n`;
}

const SS58 = /@([1-9A-HJ-NP-Za-km-z]{46,48})\b/g;

/** Addresses mentioned as `@<ss58>` in a comment body, de-duplicated in order. */
export function mentionsIn(body: string) {
  return [...new Set([...body.matchAll(SS58)].map((match) => match[1]))];
}

export type BodyPart = { kind: "text"; text: string } | { kind: "mention"; address: string } | { kind: "quote"; text: string };

/** Splits a comment body into quote blocks, plain text and `@address` mentions for rendering. */
export function bodyParts(body: string): BodyPart[] {
  const parts: BodyPart[] = [];
  const lines = body.split("\n");
  let quote: string[] = [];
  let text: string[] = [];
  const flushQuote = () => { if (quote.length) parts.push({ kind: "quote", text: quote.join("\n") }); quote = []; };
  const flushText = () => {
    if (!text.length) return;
    const value = text.join("\n");
    let last = 0;
    for (const match of value.matchAll(SS58)) {
      if (match.index! > last) parts.push({ kind: "text", text: value.slice(last, match.index) });
      parts.push({ kind: "mention", address: match[1] });
      last = match.index! + match[0].length;
    }
    if (last < value.length) parts.push({ kind: "text", text: value.slice(last) });
    text = [];
  };
  for (const line of lines) {
    if (line.startsWith(">")) { flushText(); quote.push(line.replace(/^>\s?/, "")); }
    else { flushQuote(); text.push(line); }
  }
  flushQuote();
  flushText();
  return parts;
}

export const commentAnchor = (id: string) => `comment-${id}`;
export const anchorComment = (hash: string) => (hash.startsWith("#comment-") ? hash.slice("#comment-".length) : null);
