export type NavItem = { href: string; label: string; tag?: string; exact?: boolean };
export type NavGroup = { label: string; items: NavItem[] };

// Daily workspace — live surfaces only.
export const nav: NavGroup[] = [
  { label: "Workspace", items: [
    { href: "/", label: "Overview" },
  ] },
  { label: "Governance", items: [
    { href: "/referenda/", label: "Referenda" }, { href: "/referenda/tracks/", label: "Tracks" },
    { href: "/votes/", label: "Votes" }, { href: "/referenda/statistics/", label: "Statistics" },
    { href: "/referenda/whales/", label: "Whales" }, { href: "/preimages/", label: "Preimages" },
    { href: "/whitelist/", label: "Whitelist" }, { href: "/delegation/", label: "Delegation" },
    { href: "/calendar/", label: "Calendar" },
  ] },
  { label: "Treasury", items: [
    { href: "/treasury/", label: "Overview", exact: true }, { href: "/treasury/spends/", label: "Spends" }, { href: "/treasury/bounties/", label: "Bounties" },
    { href: "/treasury/child-bounties/", label: "Child bounties" }, { href: "/treasury/multiasset-bounties/", label: "Multi-asset" },
  ] },
  { label: "Fellowship", items: [
    { href: "/fellowship/", label: "Overview", exact: true }, { href: "/fellowship/referenda/", label: "Referenda" }, { href: "/fellowship/tracks/", label: "Tracks" },
  ] },
  { label: "Personal", items: [
    { href: "/account/", label: "Account", exact: true }, { href: "/account/votes/", label: "My votes" },
    { href: "/account/deposits/", label: "My deposits" }, { href: "/delegation/mine/", label: "My delegations" },
    { href: "/settings/", label: "Settings" },
  ] },
];
