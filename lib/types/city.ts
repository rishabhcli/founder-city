export const DISTRICT_IDS = [
  "soma",
  "fidi",
  "mission",
  "hayes",
  "dogpatch",
  "mission-bay",
  "north-beach",
  "sunset-richmond",
  "berkeley",
] as const;

export const RESOURCE_KEYS = [
  "capital",
  "talent",
  "compute",
  "permits",
  "vibe",
  "localBusiness",
  "congestion",
  "rentPressure",
] as const;

export const FOUNDER_NEEDS = [
  "capital",
  "talent",
  "compute",
  "permits",
  "vibe",
  "localBusiness",
] as const;

export const DEPARTMENT_IDS = [
  "permits",
  "transit",
  "capital",
  "community",
] as const;

export const INTERVENTION_TYPES = [
  "transit_connector",
  "capital_grant",
  "culture_festival",
  "permit_fast_lane",
] as const;

export const FOUNDER_STATUSES = [
  "active",
  "pivoted",
  "stalled",
  "relocating",
  "dead",
  "breakout",
] as const;

export type DistrictId = (typeof DISTRICT_IDS)[number];
export type ResourceKey = (typeof RESOURCE_KEYS)[number];
export type FounderNeed = (typeof FOUNDER_NEEDS)[number];
export type DepartmentId = (typeof DEPARTMENT_IDS)[number];
export type InterventionType = (typeof INTERVENTION_TYPES)[number];
export type FounderStatus = (typeof FOUNDER_STATUSES)[number];

export type RecommendationType =
  | "watchlist"
  | "reroute"
  | "grant"
  | "festival"
  | "fast-track";

export type RoomStatus = "lobby" | "active" | "paused" | "ended";
export type RunStatus = "active" | "paused" | "ended";

export interface Point {
  x: number;
  y: number;
}

export type ResourceVector = Record<ResourceKey, number>;
export type FounderResourceProgress = Record<FounderNeed, number>;

export interface DistrictState {
  id: DistrictId;
  label: string;
  color: string;
  position: Point;
  tags: string[];
  halo: string;
  stats: ResourceVector;
}

export interface CityEdge {
  id: string;
  from: DistrictId;
  to: DistrictId;
  baseDistance: number;
  lineColor: string;
}

export interface FounderAgentState {
  id: string;
  name: string;
  avatarHue: string;
  pitch: string;
  temperament: string;
  burnRate: number;
  pivotTolerance: number;
  origin: DistrictId;
  currentDistrict: DistrictId;
  targetDistrict: DistrictId;
  route: DistrictId[];
  routeIndex: number;
  routeProgress: number;
  status: FounderStatus;
  companyType: string;
  needs: FounderNeed[];
  resourceProgress: FounderResourceProgress;
  memory: string[];
  speechBubble: string;
  runway: number;
  influencedBy: DistrictId[];
  lastDecisionAt: number;
}

export interface ManagerAgentState {
  id: string;
  name: string;
  department: DepartmentId;
  speechBubble: string;
  targetDistrict: DistrictId;
  recommendationType: RecommendationType;
  impact: number;
  lastDecisionAt: number;
}

export interface Intervention {
  id: string;
  type: InterventionType;
  label: string;
  description: string;
  targetDistrict: DistrictId;
  intensity: number;
  effect: Partial<ResourceVector>;
}

export interface VoteOption {
  id: string;
  label: string;
  description: string;
  intervention: Intervention;
}

export interface VoteRound {
  id: string;
  prompt: string;
  options: VoteOption[];
  opensAt: number;
  closesAt: number;
  resolvedOptionId: string | null;
  tallies: Record<string, number>;
}

export interface EventCard {
  id: string;
  title: string;
  eventType:
    | "permit-freeze"
    | "muni-disruption"
    | "founder-dinner"
    | "demo-week"
    | "cloud-credit-frenzy"
    | "rent-shock";
  description: string;
  tickerCopy: string;
  affectedDistricts: DistrictId[];
  effect: Partial<ResourceVector>;
  triggeredAt: number;
}

export interface ScoreState {
  startupSurvival: number;
  commuteHealth: number;
  localBusiness: number;
  vibeIndex: number;
  neighborhoodBalance: number;
}

export interface SimDelta {
  tick: number;
  elapsedMs: number;
  remainingMs: number;
  headline: string;
  score: ScoreState;
  founders: FounderAgentState[];
  districts: Record<DistrictId, DistrictState>;
  activeVoteRound: VoteRound | null;
  eventLog: EventCard[];
}

export interface RunSummary {
  headline: string;
  dek: string;
  cityPersonality: string;
  districtOutcomes: string[];
  founderOutcomes: string[];
  notableInterventions: string[];
  score: ScoreState;
}

export interface CityState {
  roomId: string;
  runId: string;
  seed: string;
  demoSeed: string;
  status: RoomStatus;
  tick: number;
  elapsedMs: number;
  remainingMs: number;
  headline: string;
  ticker: string[];
  audienceCount: number;
  nextVoteAt: number;
  nextAgentTickAt: number;
  nextEventAt: number;
  districts: Record<DistrictId, DistrictState>;
  edges: CityEdge[];
  founders: FounderAgentState[];
  managers: ManagerAgentState[];
  score: ScoreState;
  interventions: Intervention[];
  activeVoteRound: VoteRound | null;
  resolvedVotes: VoteRound[];
  eventDeck: EventCard[];
  eventLog: EventCard[];
  summary: RunSummary | null;
}

export interface RoomRecord {
  id: string;
  name: string;
  stackTeamId: string | null;
  hostUserId: string;
  inviteCode: string;
  status: RoomStatus;
  activeRunId: string | null;
  createdAt: string;
}

export interface RunRecord {
  id: string;
  roomId: string;
  seed: string;
  status: RunStatus;
  startedAt: string;
  endedAt: string | null;
  finalScores: ScoreState | null;
}

export interface RunCheckpointRecord {
  id: string;
  runId: string;
  tick: number;
  state: CityState;
  createdAt: string;
}

export interface ActionRecord {
  id: string;
  runId: string;
  actorType: "host" | "audience" | "founder" | "manager" | "system";
  actorId: string;
  actionType: string;
  payload: Record<string, unknown>;
  tick: number;
  createdAt: string;
}

export interface VoteRecord {
  id: string;
  voteRoundId: string;
  voterKey: string;
  optionId: string;
  createdAt: string;
}

export interface AgentMemoryRecord {
  runId: string;
  agentId: string;
  memory: string[];
  updatedAt: string;
}

export interface AgentEventRecord {
  id: string;
  runId: string;
  eventType: string;
  payload: Record<string, unknown>;
  triggeredAt: string;
}

export interface FounderDecision {
  action: "reroute" | "pivot" | "stall" | "relocate" | "breakout";
  targetDistrict: DistrictId;
  priority: number;
  speechBubble: string;
  reason: string;
}

export interface ManagerDecision {
  department: DepartmentId;
  recommendationType: RecommendationType;
  targetDistrict: DistrictId;
  impact: number;
  speechBubble: string;
  reason: string;
}

export interface PulseEventDecision {
  headline: string;
  eventType: EventCard["eventType"];
  affectedDistricts: DistrictId[];
  effectVector: Partial<ResourceVector>;
  tickerCopy: string;
}
