export const USER_TABS = ["overview", "votes", "delegations", "deposits"] as const;
export type UserTab = (typeof USER_TABS)[number];

export function userTab(value?: string | null): UserTab {
  return (USER_TABS as readonly string[]).includes(value ?? "") ? value as UserTab : "overview";
}
