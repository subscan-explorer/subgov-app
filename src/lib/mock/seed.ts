import type { Comment, TimelineEvent } from "@/lib/types";

export const A = {
  alice: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9U1Ybyk4zwS",
  bob: "14E5nqKAp3oAJcmzgZhUD2erhwTEUYD4C5Z6TMnQTgts",
  charlie: "14Gjs1DD8gTz8CRuaMGz2vA51uW5x47BqCqz3sZr1RdW",
  dave: "16D2z5d8X4K2k1nP9sQ7wR6tY3uI0oP8aS5dF2gH1jK4",
  eve: "13UVJyLnbVp8tLZng4YzRXvBqyv1uTqg4SQe6Z4K8mN2",
  ferdie: "12xtA67fgA1F3pYnh5sYjdv8XQkqD2rKs7uP3wQ9vB6n",
  treasury: "13UVJyLnbVp9obR7cmJvSFkE9PqK3sD1nQ8wE2rT5yU7",
  polkadot: "15D2z8sK4mN6pQ1wR9tY5uI3oP7aS2dF8gH4jK6lM9",
  fellowship: "12xtA89fgB2G4qYnh6sYjdv9XQkqE3rKt8uP4wR0vC7o",
  luna: "14A2n5d9Y5L3k2nP0sQ8wR7tY4uI1oP9aS6dF3gH2jK5",
  orion: "13BVJyLnbVp0ocR8cmJwSFkF0PqK4sD2nQ9wE3rT6yU8",
  nova: "16E3z6e9X5L3k2nP0sQ8wR7tY4uI1oP9aS6dF3gH2jK5",
};

export const ID = {
  [A.alice]: "Alice",
  [A.bob]: "Bob",
  [A.charlie]: "ChaosDAO",
  [A.dave]: "OpenGov Watch",
  [A.eve]: "Eve Labs",
  [A.ferdie]: "Ferdie",
  [A.treasury]: "Treasury",
  [A.polkadot]: "Polkadot",
  [A.fellowship]: "Fellowship",
  [A.luna]: "Luna Vote",
  [A.orion]: "Orion",
  [A.nova]: "Nova Delegate",
};

function n(id: string, mod: number) {
  return [...id].reduce((a, c) => a + c.charCodeAt(0), 0) % mod;
}

export function comment(
  id: string,
  author: string,
  body: string,
  at: string,
  replies: Comment[] = [],
): Comment {
  return {
    id,
    author,
    identity: ID[author],
    body,
    at,
    thumbsUp: n(id, 12),
    thumbsDown: n(id + author, 3),
    replies,
  };
}

export function tl(
  id: string,
  title: string,
  at: string,
  block: number,
  detail?: string,
): TimelineEvent {
  return { id, title, at, block, detail };
}
