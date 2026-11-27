"use client";

import { Badge, Button, ModuleHeader, Panel, Textarea, TextButton } from "@/components/ui";
import { readableDiscussionError, useDiscussionSession } from "@/hooks/use-discussion-session";
import { useChain, useChainHref } from "@/hooks/use-chain-href";
import { sameAccount } from "@/lib/account-chain";
import { anchorComment, bodyParts, commentAnchor, quoteBody, threadComments } from "@/lib/comment-format";
import { discussionRequest, type DiscussionComment, type DiscussionPage, type DiscussionTarget } from "@/lib/discussion";
import { degovCapabilities, type DegovCapabilities } from "@/lib/discussion-capabilities";
import { formatBaseUnits, formatDate, shortAddr } from "@/lib/format";
import { voterTags, type VoterTag } from "@/lib/gov-actions";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Comment = DiscussionComment;

const commentsQuery = `
  query DiscussionComments($input: DiscussionCommentsInput!) {
    discussionComments(input: $input) {
      items { id targetId authorAddress replyToId body state ctime utime }
      pageInfo { endCursor hasNextPage }
    }
  }
`;
const createMutation = `mutation CreateDiscussionComment($input: CreateDiscussionCommentInput!) { createDiscussionComment(input: $input) { id } }`;
const updateMutation = `mutation UpdateDiscussionComment($input: UpdateDiscussionCommentInput!) { updateDiscussionComment(input: $input) { id body utime } }`;
const deleteMutation = `mutation DeleteDiscussionComment($input: DeleteDiscussionCommentInput!) { deleteDiscussionComment(input: $input) { id state } }`;

type Sort = "oldest" | "newest";
type Filter = "all" | "voters" | "Aye" | "Nay";

export function CommentThread({
  target,
  initialError,
  referendumIndex,
  emptyText = "No comments yet. Add the first public note for this referendum.",
  description = "Posted on SubGov and signed with your account — no transaction is sent.",
}: {
  target: DiscussionTarget | null;
  initialError?: string;
  /** Shows each commenter's vote on this referendum and enables voter filters (#110). */
  referendumIndex?: number;
  emptyText?: string;
  description?: string;
}) {
  const chain = useChain();
  const chainHref = useChainHref();
  const session = useDiscussionSession();
  const { account, canSign, walletSource, token } = session;
  const [capabilities, setCapabilities] = useState<DegovCapabilities | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [pageInfo, setPageInfo] = useState<DiscussionPage["pageInfo"] | null>(null);
  const [draft, setDraft] = useState("");
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const [loading, setLoading] = useState(Boolean(target));
  const [loadingMore, setLoadingMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [sort, setSort] = useState<Sort>("oldest");
  const [filter, setFilter] = useState<Filter>("all");
  const [tags, setTags] = useState<Record<string, VoterTag>>({});
  const [highlight, setHighlight] = useState<string | null>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const activeTargetId = useRef(target?.id ?? null);
  activeTargetId.current = target?.id ?? null;

  useEffect(() => { degovCapabilities().then(setCapabilities); }, []);

  const loadComments = useCallback(async (nextTarget: DiscussionTarget, after?: string, append = false, signal?: AbortSignal) => {
    const data = await discussionRequest<{ discussionComments: DiscussionPage & { items: Comment[] } }>(commentsQuery, {
      input: { targetId: nextTarget.id, first: 50, ...(after ? { after } : {}) },
    }, { signal, ...(token ? { token } : {}) });
    if (activeTargetId.current !== nextTarget.id) return;
    setComments((current) => append ? [...current, ...data.discussionComments.items] : data.discussionComments.items);
    setPageInfo(data.discussionComments.pageInfo);
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();
    setPageInfo(null);
    setReplyToId(null);
    setEditing(null);
    setError(initialError ? readableDiscussionError(initialError) : null);
    if (!target) {
      setComments([]);
      setLoading(false);
      return () => controller.abort();
    }
    setLoading(true);
    loadComments(target, undefined, false, controller.signal)
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(readableDiscussionError(cause));
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [initialError, loadComments, target]);

  // Voter tags for commenters (#110).
  const authors = useMemo(() => [...new Set(comments.map((comment) => comment.authorAddress))].sort().join(","), [comments]);
  useEffect(() => {
    if (referendumIndex == null || !authors) return;
    let cancelled = false;
    voterTags(chain.id, referendumIndex, authors.split(",")).then((next) => { if (!cancelled) setTags(next); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [authors, chain.id, referendumIndex]);

  // Comment anchors (#109): scroll to `#comment-<id>` once the comment is loaded.
  useEffect(() => {
    const id = anchorComment(window.location.hash);
    if (!id || !comments.some((comment) => comment.id === id)) return;
    setHighlight(id);
    document.getElementById(commentAnchor(id))?.scrollIntoView({ block: "center" });
  }, [comments]);

  const run = async (work: () => Promise<unknown>, reload = true) => {
    if (!target) return;
    setSubmitting(true);
    setError(null);
    try {
      await work();
      if (reload && activeTargetId.current === target.id) await loadComments(target);
    } catch (cause) {
      setError(readableDiscussionError(cause));
    } finally {
      setSubmitting(false);
    }
  };

  const submit = () => {
    const body = draft.trim();
    if (!target || !body || submitting) return;
    return run(async () => {
      await session.signed(createMutation, { input: { targetId: target.id, body, ...(replyToId ? { replyToId } : {}) } });
      setDraft("");
      setReplyToId(null);
    });
  };
  const saveEdit = () => editing && editing.body.trim() ? run(async () => {
    await session.signed(updateMutation, { input: { commentId: editing.id, body: editing.body.trim() } });
    setEditing(null);
  }) : undefined;
  const remove = (id: string) => {
    if (!window.confirm("Delete this comment? Replies stay visible.")) return;
    return run(() => session.signed(deleteMutation, { input: { commentId: id } }));
  };

  const focusComposer = (text: string, replyId?: string) => {
    if (replyId) setReplyToId(replyId);
    setDraft((current) => `${current}${current && !current.endsWith("\n") ? "\n" : ""}${text}`);
    requestAnimationFrame(() => composer.current?.focus());
  };
  const copyLink = (id: string) => {
    const url = `${window.location.origin}${window.location.pathname}${window.location.search}#${commentAnchor(id)}`;
    void navigator.clipboard?.writeText(url);
    window.history.replaceState(null, "", `#${commentAnchor(id)}`);
    setHighlight(id);
  };

  const visible = useMemo(() => {
    const keep = (comment: Comment) => {
      if (filter === "all") return true;
      const tag = tags[comment.authorAddress];
      return filter === "voters" ? Boolean(tag) : tag?.side === filter;
    };
    const threads = threadComments(comments, sort === "newest" ? "newest" : "oldest");
    return threads.filter((thread) => keep(thread.comment) || thread.replies.some(keep));
  }, [comments, filter, sort, tags]);

  const replyTo = comments.find((comment) => comment.id === replyToId);
  const canEdit = Boolean(capabilities?.editComments);
  const hasTags = Object.keys(tags).length > 0;

  const renderComment = (comment: Comment, nested: boolean) => {
    const mine = Boolean(account && sameAccount(comment.authorAddress, account));
    const tag = tags[comment.authorAddress];
    const active = comment.state === "ACTIVE";
    return (
      <article key={comment.id} id={commentAnchor(comment.id)}
        className={`scroll-mt-24 py-4 ${nested ? "ml-4 border-l border-line pl-4 sm:ml-6" : ""} ${highlight === comment.id ? "rounded bg-panel-2/60" : ""}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-mute">
          <span className="flex flex-wrap items-center gap-2">
            <Link className="num text-paper hover:underline" href={chainHref(`/user/${encodeURIComponent(comment.authorAddress)}/`)} title={comment.authorAddress}>{shortAddr(comment.authorAddress)}</Link>
            {tag ? <Badge tone={tag.side === "Aye" ? "good" : tag.side === "Nay" ? "bad" : "muted"}>Voted {tag.side}{tag.side !== "Abstain" && tag.side !== "Split" && tag.amount ? ` · ${formatBaseUnits(tag.amount, chain.decimals) ?? ""} ${chain.symbol}` : ""}</Badge> : null}
            {mine ? <Badge>You</Badge> : null}
          </span>
          <a href={`#${commentAnchor(comment.id)}`} onClick={(event) => { event.preventDefault(); copyLink(comment.id); }} className="hover:text-paper" title="Copy link to this comment">
            <time dateTime={comment.ctime}>{formatDate(comment.ctime)}</time>{comment.utime && comment.utime !== comment.ctime && active ? " · edited" : ""}
          </a>
        </div>
        {editing?.id === comment.id ? (
          <div className="mt-2 flex flex-col gap-2">
            <label className="sr-only" htmlFor={`edit-${comment.id}`}>Edit comment</label>
            <Textarea id={`edit-${comment.id}`} value={editing.body} maxLength={10_000} onChange={(event) => setEditing({ id: comment.id, body: event.target.value })} />
            <div className="flex gap-2">
              <Button type="button" size="sm" disabled={!canSign || submitting || !editing.body.trim()} onClick={saveEdit}>{submitting ? "Saving…" : "Save"}</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="mt-2 break-words text-sm leading-6">
            {!active ? <span className="italic text-mute">Comment deleted</span> : bodyParts(comment.body ?? "").map((part, index) => part.kind === "quote"
              ? <blockquote key={index} className="my-1 whitespace-pre-wrap border-l-2 border-line-2 pl-3 text-mute">{part.text}</blockquote>
              : part.kind === "mention"
                ? <Link key={index} className="text-link" href={chainHref(`/user/${encodeURIComponent(part.address)}/`)} title={part.address}>@{shortAddr(part.address)}</Link>
                : <span key={index} className="whitespace-pre-wrap">{part.text}</span>)}
          </div>
        )}
        {active && editing?.id !== comment.id ? (
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
            {target?.status === "ACTIVE" ? (
              <>
                <TextButton onClick={() => { setReplyToId(comment.id); requestAnimationFrame(() => composer.current?.focus()); }}>Reply</TextButton>
                <TextButton tone="neutral" onClick={() => focusComposer(quoteBody(comment.body ?? "", comment.authorAddress), comment.id)}>Quote</TextButton>
                {!mine ? <TextButton tone="neutral" onClick={() => focusComposer(`@${comment.authorAddress} `)}>Mention</TextButton> : null}
                {mine && canEdit ? <TextButton tone="neutral" disabled={!canSign || submitting} onClick={() => setEditing({ id: comment.id, body: comment.body ?? "" })}>Edit</TextButton> : null}
                {mine && canEdit ? <TextButton tone="danger" disabled={!canSign || submitting} onClick={() => remove(comment.id)}>Delete</TextButton> : null}
              </>
            ) : null}
            <TextButton tone="neutral" onClick={() => copyLink(comment.id)}>Copy link</TextButton>
          </div>
        ) : null}
      </article>
    );
  };

  return (
    <Panel padding="content" aria-busy={loading}>
      <ModuleHeader title="Community comments" meta={<div className="flex flex-wrap items-center gap-2">
        {!loading && target ? <span>{comments.length}{pageInfo?.hasNextPage ? "+" : ""} {comments.length === 1 && !pageInfo?.hasNextPage ? "comment" : "comments"}</span> : null}
        {target ? target.status === "LOCKED" ? <Badge tone="warn">Locked</Badge> : <Badge tone="live">On-chain identity</Badge> : <Badge tone={loading ? "muted" : "warn"}>{loading ? "Connecting" : "Setup required"}</Badge>}
      </div>} />

      <p className="-mt-2 mb-4 text-xs leading-5 text-mute">{description}</p>
      {loading ? <p className="mt-4 text-sm text-mute">Opening discussion…</p> : null}
      {!loading && error && !target ? <p className="mt-4 text-sm text-nay" role="alert">{error}</p> : null}

      {!loading && target ? (
        <>
          {comments.length > 1 || hasTags ? (
            <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-mute">
              <span className="flex items-center gap-2">Sort
                {(["oldest", "newest"] as Sort[]).map((value) => (
                  <TextButton key={value} tone={sort === value ? "link" : "neutral"} aria-pressed={sort === value} onClick={() => setSort(value)}>{value === "oldest" ? "Oldest" : "Newest"}</TextButton>
                ))}
              </span>
              {hasTags ? (
                <span className="flex items-center gap-2">Show
                  {(["all", "voters", "Aye", "Nay"] as Filter[]).map((value) => (
                    <TextButton key={value} tone={filter === value ? "link" : "neutral"} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === "all" ? "All" : value === "voters" ? "Voters" : `${value} voters`}</TextButton>
                  ))}
                </span>
              ) : null}
            </div>
          ) : null}
          <div className="divide-y divide-line">
            {visible.length ? visible.map((thread) => (
              <div key={thread.comment.id}>
                {renderComment(thread.comment, false)}
                {thread.replies.map((reply) => renderComment(reply, true))}
              </div>
            )) : <p className="py-5 text-sm text-mute">{comments.length ? "No comments match this filter." : emptyText}</p>}
          </div>

          {pageInfo?.hasNextPage ? (
            <Button className="mt-3" variant="ghost" type="button" disabled={loadingMore} onClick={async () => {
              if (!pageInfo.endCursor) return;
              setLoadingMore(true);
              try { await loadComments(target, pageInfo.endCursor, true); } catch (cause) { setError(readableDiscussionError(cause)); } finally { setLoadingMore(false); }
            }}>
              {loadingMore ? "Loading…" : "Load more comments"}
            </Button>
          ) : null}

          {target.status === "ACTIVE" ? (
            <div className="mt-5 flex flex-col gap-3">
              {replyTo ? (
                <div className="flex items-center justify-between gap-3 text-xs text-mute">
                  <span>Replying to {shortAddr(replyTo.authorAddress)}</span>
                  <TextButton type="button" onClick={() => setReplyToId(null)}>Cancel reply</TextButton>
                </div>
              ) : null}
              <label className="sr-only" htmlFor="discussion-comment">Comment</label>
              <Textarea
                ref={composer}
                id="discussion-comment"
                name="comment"
                autoComplete="off"
                maxLength={10_000}
                value={draft}
                placeholder={canSign ? "Add context, evidence, or a question… Mention someone with @address, quote with >." : walletSource === "wallet-connect" ? "Use a browser extension wallet to comment" : "Connect a wallet to comment"}
                disabled={!canSign || submitting}
                onChange={(event) => setDraft(event.target.value)}
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-mute">
                  {walletSource === "wallet-connect"
                    ? "WalletConnect comment signing is not supported for this network yet."
                    : account ? `Posting as ${shortAddr(account)}` : "Comments use a signed Substrate identity; no transaction is sent."}
                </p>
                <Button type="button" disabled={!canSign || !draft.trim() || submitting} onClick={submit}>
                  {submitting ? "Signing…" : token ? "Post comment" : "Sign & post"}
                </Button>
              </div>
            </div>
          ) : <p className="mt-4 text-sm text-mute">This discussion is read-only.</p>}

          {error ? <p className="mt-3 text-sm text-nay" role="alert">{error}</p> : null}
        </>
      ) : null}
    </Panel>
  );
}
