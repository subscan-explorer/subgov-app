export type DataState<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "empty"; data: [] }
  | { status: "error"; message: string }
  | { status: "coming-soon"; reason: string };

export const comingSoon = (reason: string): DataState<never> => ({ status: "coming-soon", reason });
