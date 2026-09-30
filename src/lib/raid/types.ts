export type Role = "owner" | "officer" | "member";
export type Currency = "diamond" | "idr";
export interface Guild {
  id: string;
  name: string;
  server: string;
  owner_id: string;
}
export interface Membership {
  username?: string;
  guild_id: string;
  user_id: string;
  role: Role;
}
export interface Character {
  id: string;
  guild_id: string;
  name: string;
  cp: number | null;
  is_officer: boolean;
  user_id: string | null;
  active: boolean;
}
export interface Tier {
  tier: number;
  min_cp: number;
  weight: number;
}
export interface RuleVersion {
  id: string;
  created_at: string;
  guild_tier_rules: Tier[];
}
export interface Raid {
  member_visible?: boolean;
  id: string;
  guild_id: string;
  name: string;
  raid_date: string;
  status: "draft" | "locked" | "final" | "superseded";
  version: number;
  rule_id: string | null;
  revision_of: string | null;
}
export interface Participant {
  character_id: string;
  name: string;
  cp: number | null;
  tier: number | null;
  weight: number | null;
  tie_order: number;
}
export interface Transaction {
  id: string;
  currency: Currency;
  kind: "income" | "deduction";
  amount: number;
  label: string;
  conversion_id: string | null;
}
export interface Allocation {
  id: string;
  character_id: string;
  currency: Currency;
  amount: number;
  rounding_bonus: number;
}
export interface Payment {
  allocation_id: string;
  paid: boolean;
  paid_at: string | null;
  recorded_by: string;
  reference: string;
}
export interface Invite {
  id: string;
  username: string;
  role: Role;
  expires_at: string;
  accepted_at: string | null;
  revoked: boolean;
}
export interface Audit {
  id: string;
  actor_id: string;
  action: string;
  entity_id: string;
  details: Record<string, unknown>;
  created_at: string;
}
export interface GuildData {
  guild: Guild;
  role: Role;
  characters: Character[];
  memberships: Membership[];
  rules: RuleVersion[];
  raids: Raid[];
  invites: Invite[];
  audit: Audit[];
}
export interface RaidData {
  participants: Participant[];
  transactions: Transaction[];
  allocations: Allocation[];
  payments: Payment[];
}
