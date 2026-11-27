import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";

const pnpm = new URL("../node_modules/.pnpm/", import.meta.url);
const jitiPackage = (await readdir(pnpm)).find((name) => name.startsWith("jiti@"));
const { createJiti } = await import(new URL(`${jitiPackage}/node_modules/jiti/lib/jiti.mjs`, pnpm));
const jiti = createJiti(import.meta.url, { alias: { "@": new URL("../src", import.meta.url).pathname } });

const format = await jiti.import("../src/lib/comment-format.ts");
const alice = "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5";
const comments = [
  { id: "a", replyToId: null, ctime: "2026-01-01T00:00:00Z" },
  { id: "b", replyToId: "a", ctime: "2026-01-02T00:00:00Z" },
  { id: "c", replyToId: null, ctime: "2026-01-03T00:00:00Z" },
  { id: "d", replyToId: "b", ctime: "2026-01-04T00:00:00Z" },
  { id: "e", replyToId: "gone", ctime: "2026-01-05T00:00:00Z" },
];
const oldest = format.threadComments(comments);
assert.deepEqual(oldest.map((t) => t.comment.id), ["a", "c", "e"]);
assert.deepEqual(oldest[0].replies.map((c) => c.id), ["b", "d"]);
assert.deepEqual(format.threadComments(comments, "newest").map((t) => t.comment.id), ["e", "c", "a"]);
assert.equal(format.quoteBody("hi\nthere", alice), `> @${alice} wrote:\n> hi\n> there\n\n`);
assert.deepEqual(format.mentionsIn(`thanks @${alice} and @${alice}`), [alice]);
assert.deepEqual(format.bodyParts(`> quoted\nhey @${alice}!`), [
  { kind: "quote", text: "quoted" }, { kind: "text", text: "hey " }, { kind: "mention", address: alice }, { kind: "text", text: "!" },
]);
assert.equal(format.anchorComment("#comment-xyz"), "xyz");
assert.equal(format.anchorComment("#votes"), null);

const caps = await jiti.import("../src/lib/discussion-capabilities.ts");
assert.equal(caps.capabilitiesFromSchema(["updateDiscussionComment", "deleteDiscussionComment"]).editComments, true);
assert.equal(caps.capabilitiesFromSchema(["updateDiscussionComment"]).editComments, false);
assert.equal(caps.capabilitiesFromSchema([]).editComments, false);
console.log("comment helpers and editing capabilities ok");
