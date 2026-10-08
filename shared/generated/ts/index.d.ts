/* eslint-disable */
/** Generated from shared/schemas by shared/scripts/generate.mjs. Do not edit by hand; run `npm run generate`. */

export type AdviceMode = 'EXPLAIN' | 'ANALYZE' | 'SCENARIO';
export type Industry =
  | 'SAAS'
  | 'ECOMMERCE'
  | 'FOOD_AND_BEVERAGE'
  | 'EDTECH'
  | 'HEALTHTECH'
  | 'FINTECH'
  | 'GAMING'
  | 'CONSUMER_APP';
export type BusinessModel =
  'SUBSCRIPTION' | 'TRANSACTIONAL' | 'FREEMIUM' | 'MARKETPLACE' | 'ADVERTISING';
/**
 * A rate or score in [0, 1].
 */
export type UnitInterval = number;
export type CustomerSegmentType =
  'PRICE_SENSITIVE' | 'PREMIUM' | 'LOYAL' | 'OCCASIONAL' | 'ENTERPRISE';
export type CompetitorArchetype = 'BUDGET' | 'PREMIUM' | 'AGGRESSIVE' | 'INNOVATIVE';
export type EventType =
  | 'viral_exposure'
  | 'positive_review'
  | 'influencer_mention'
  | 'supplier_discount'
  | 'unexpected_demand'
  | 'competitor_price_war'
  | 'supply_disruption'
  | 'bad_review'
  | 'economic_slowdown'
  | 'employee_turnover'
  | 'regulatory_cost'
  | 'market_trend'
  | 'seasonality'
  | 'new_technology'
  | 'customer_preference_shift'
  | 'state_startup_incentive'
  | 'state_regulatory_change'
  | 'local_festival_demand'
  | 'monsoon_disruption'
  | 'local_talent_war'
  | 'infrastructure_outage';
export type EventPolarity = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
/**
 * City tier, following the house rent allowance classification of cities (X = METRO, Y = TIER_2, Z = TIER_3).
 */
export type LocationTier = 'METRO' | 'TIER_2' | 'TIER_3';
/**
 * PRICING, MARKETING, HIRING and PRODUCT_QUALITY are implemented. The rest are reserved and rejected as not yet supported.
 */
export type DecisionType =
  | 'PRICING'
  | 'MARKETING'
  | 'HIRING'
  | 'PRODUCT_QUALITY'
  | 'FIRING'
  | 'R_AND_D'
  | 'EXPANSION'
  | 'COST_CUTTING'
  | 'FUNDING';
export type AgentMode = 'rules' | 'llm';
export type UserRole = 'USER' | 'ADMIN';
export type Difficulty = 'EASY' | 'NORMAL' | 'HARD';
/**
 * How a location profile was built: a listed city's own values, a state's values with tier defaults (any other city), or the neutral baseline (startups created before locations existed).
 */
export type LocationBasis = 'LISTED_CITY' | 'STATE_AND_TIER' | 'NEUTRAL';
export type SimulationStatus = 'ACTIVE' | 'BANKRUPT' | 'COMPLETED' | 'ARCHIVED';
export type JobStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
/**
 * Turn pipeline stages in order. Stages a milestone has not built yet are not emitted.
 */
export type PipelineStage =
  | 'PROCESSING_DECISION'
  | 'ANALYZING_CUSTOMERS'
  | 'ANALYZING_COMPETITORS'
  | 'APPLYING_MARKET_EVENT'
  | 'UPDATING_FINANCIAL_MODEL'
  | 'GENERATING_FORECAST'
  | 'AI_CEO_ANALYSIS'
  | 'COMPLETE';
/**
 * This interface was referenced by `HealthServicesResponse`'s JSON-Schema
 * via the `definition` "ServiceStatus".
 */
export type ServiceStatus = 'ok' | 'down';

export interface StackForgeContracts {
  AccountDeleteRequest?: AccountDeleteRequest;
  AdminStats?: AdminStats;
  AdviceRequest?: AdviceRequest;
  AdvisorRequest?: AdvisorRequest;
  AgentEffects?: AgentEffects;
  AIAdvice?: AIAdvice;
  ApiError?: ApiError;
  AuthOptions?: AuthOptions;
  AuthResponse?: AuthResponse;
  DataExport?: DataExport;
  DecisionPreview?: DecisionPreview;
  DecisionRejection?: DecisionRejection;
  DecisionResult?: DecisionResult;
  Decision?: Decision;
  DecisionsRequest?: DecisionsRequest;
  DifficultyModifiers?: DifficultyModifiers;
  DifficultyPresets?: DifficultyPresets;
  EngineAnalyticsRequest?: EngineAnalyticsRequest;
  EngineInfoResponse?: EngineInfoResponse;
  EnginePreviewRequest?: EnginePreviewRequest;
  EngineReplayRequest?: EngineReplayRequest;
  EngineReplayResponse?: EngineReplayResponse;
  EngineScenarioRequest?: EngineScenarioRequest;
  EngineStartRequest?: EngineStartRequest;
  EngineStartResponse?: EngineStartResponse;
  enumDecisionType?: DecisionType;
  enumSimulationStatus?: SimulationStatus;
  enumJobStatus?: JobStatus;
  enumEventType?: EventType;
  enumEventPolarity?: EventPolarity;
  enumIndustry?: Industry;
  enumBusinessModel?: BusinessModel;
  enumDifficulty?: Difficulty;
  enumUserRole?: UserRole;
  enumAgentMode?: AgentMode;
  enumCustomerSegmentType?: CustomerSegmentType;
  enumCompetitorArchetype?: CompetitorArchetype;
  enumAdviceMode?: AdviceMode;
  enumUnitInterval?: UnitInterval;
  enumPipelineStage?: PipelineStage;
  enumLocationTier?: LocationTier;
  enumLocationBasis?: LocationBasis;
  EstimatedEffect?: EstimatedEffect;
  EventCatalog?: EventCatalog;
  Forecast?: Forecast;
  HealthResponse?: HealthResponse;
  HealthServicesResponse?: HealthServicesResponse;
  IndustryTemplateListResponse?: IndustryTemplateListResponse;
  IndustryTemplate?: IndustryTemplate;
  LlmCall?: LlmCall;
  LlmUsageSummary?: LlmUsageSummary;
  LocationCatalog?: LocationCatalog;
  LocationProfileRequest?: LocationProfileRequest;
  LocationProfile?: LocationProfile1;
  Location?: Location;
  LoginRequest?: LoginRequest;
  MarketEvent?: MarketEvent;
  PasswordResetConfirmRequest?: PasswordResetConfirmRequest;
  PasswordResetRequest?: PasswordResetRequest;
  PasswordResetVerifyRequest?: PasswordResetVerifyRequest;
  PasswordResetVerifyResponse?: PasswordResetVerifyResponse;
  PipelineEvent?: PipelineEvent;
  PipelineTurnRequest?: PipelineTurnRequest;
  Product?: Product;
  RegisterRequest?: RegisterRequest;
  ScenarioBranchInput?: ScenarioBranchInput;
  ScenarioComparison?: ScenarioComparison;
  ScenarioRequest?: ScenarioRequest;
  SessionListResponse?: SessionListResponse;
  Session?: Session;
  SimulationAnalytics?: SimulationAnalytics;
  SimulationJob?: SimulationJob;
  SimulationListResponse?: SimulationListResponse;
  SimulationParameters?: SimulationParameters;
  SimulationStartRequest?: SimulationStartRequest;
  SimulationState?: SimulationState;
  SimulationTurn?: SimulationTurn;
  Simulation?: Simulation;
  StartupConfiguration?: StartupConfiguration;
  StartupCreateRequest?: StartupCreateRequest;
  StartupListResponse?: StartupListResponse;
  StartupProfile?: StartupProfile;
  StartupUpdateRequest?: StartupUpdateRequest;
  Startup?: Startup;
  TurnListResponse?: TurnListResponse;
  TurnSummary?: TurnSummary;
  User?: User;
  VerifyEmailRequest?: VerifyEmailRequest;
  WsClientMessage?: WsClientMessage;
  WsServerMessage?: WsServerMessage;
}
/**
 * Permanently delete the account and all its data. `password` is required when the account has one.
 */
export interface AccountDeleteRequest {
  confirm: 'DELETE MY ACCOUNT';
  password?: string;
}
/**
 * Platform metrics. Totals include the anonymous counts kept when an account is deleted; no per-user data.
 */
export interface AdminStats {
  users: number;
  startups: number;
  simulations: number;
  turnsPlayed: number;
  /**
   * Mean startedAt to completedAt of completed turn jobs.
   */
  averageTurnDurationMs: number | null;
  /**
   * LLM requests: llm-mode agent calls, per-turn AI CEO analyses that reached the LLM, and on-demand advisor questions.
   */
  aiRequests: number;
  /**
   * Turns that carry an available ML forecast.
   */
  mlPredictions: number;
  failedJobs: number;
  engineVersion: string | null;
  modelVersion: string | null;
  generatedAt: string;
}
/**
 * Ask the AI CEO about a turn. EXPLAIN answers a why-question, ANALYZE reviews the month, SCENARIO weighs a possible decision.
 */
export interface AdviceRequest {
  mode: AdviceMode;
  question?: string;
  /**
   * Turn to discuss; defaults to the latest.
   */
  turnNumber?: number;
}
/**
 * Node -> FastAPI: everything the advisor may cite. The forecast travels inside the turn record.
 */
export interface AdvisorRequest {
  mode: AdviceMode;
  question?: string;
  industry: Industry;
  businessModel: BusinessModel;
  turn: SimulationTurn;
  /**
   * @maxItems 6
   */
  history: TurnSummary[];
  startupProfile?: StartupProfile;
  /**
   * LLM tokens the user may still spend today (null: no daily limit). 0 means the daily quota is exhausted: no LLM call is made.
   */
  tokenAllowance?: number | null;
}
/**
 * An immutable turn record. Written once, never updated.
 */
export interface SimulationTurn {
  id?: string;
  simulationId?: string;
  turnNumber: number;
  stateBefore: SimulationState;
  decisions: Decision[];
  decisionResults?: DecisionResult[];
  /**
   * Events that started this turn.
   */
  events: MarketEvent[];
  agentEffects: AgentEffects;
  stateAfter: SimulationState;
  engineVersion: string;
  forecast?: Forecast;
  advice?: AIAdvice;
  createdAt?: string;
  /**
   * Each competitor's response this turn, including NONE.
   */
  competitorActions: CompetitorAction[];
  llmUsage?: TurnLlmUsage;
}
/**
 * The full state of a startup at the end of a turn. Produced only by the simulation engine. Money in paise.
 */
export interface SimulationState {
  turn: number;
  cash: number;
  revenue: number;
  expenses: Expenses;
  profit: number;
  customers: number;
  newCustomers: number;
  churnedCustomers: number;
  price: number;
  marketingBudget: number;
  employees: number;
  productQuality: UnitInterval;
  marketShare: UnitInterval;
  customerSatisfaction: UnitInterval;
  brandAwareness: UnitInterval;
  competitorPressure: UnitInterval;
  customerSegments: CustomerSegment[];
  competitors: Competitor[];
  activeEvents: ActiveEvent[];
}
/**
 * Costs for the turn in paise. total is the sum of the other fields, so cash change equals revenue minus total.
 *
 * This interface was referenced by `SimulationState`'s JSON-Schema
 * via the `definition` "Expenses".
 */
export interface Expenses {
  total: number;
  variable: number;
  fixed: number;
  marketing: number;
  employees: number;
  /**
   * One-off product quality investment this turn.
   */
  product: number;
}
/**
 * This interface was referenced by `SimulationState`'s JSON-Schema
 * via the `definition` "CustomerSegment".
 */
export interface CustomerSegment {
  type: CustomerSegmentType;
  population: number;
  customers: number;
  priceSensitivity: UnitInterval;
  qualitySensitivity: UnitInterval;
  brandLoyalty: UnitInterval;
  conversionRate: UnitInterval;
  churnProbability: UnitInterval;
}
/**
 * This interface was referenced by `SimulationState`'s JSON-Schema
 * via the `definition` "Competitor".
 */
export interface Competitor {
  id: string;
  name: string;
  archetype: CompetitorArchetype;
  pricingStrategy: 'UNDERCUT' | 'MATCH' | 'PREMIUM' | 'PENETRATION';
  price: number;
  marketingPower: UnitInterval;
  marketShare: UnitInterval;
  reactionTendency: UnitInterval;
  productQuality: UnitInterval;
  cashStrength: UnitInterval;
}
/**
 * This interface was referenced by `SimulationState`'s JSON-Schema
 * via the `definition` "ActiveEvent".
 */
export interface ActiveEvent {
  event: MarketEvent;
  startedTurn: number;
  remainingTurns: number;
}
/**
 * A data-driven market event definition. Effects are fractional modifiers (0.08 = +8%) applied while the event is active.
 */
export interface MarketEvent {
  type: EventType;
  polarity: EventPolarity;
  title?: string;
  description?: string;
  probability: UnitInterval;
  /**
   * Turns.
   */
  duration: number;
  effects: MarketEventEffects;
  /**
   * Where the event can happen. Every list given must contain the startup's value; an event without conditions can happen anywhere. Startups without a location only get unconditional events.
   */
  conditions?: {
    /**
     * @minItems 1
     */
    states?: string[];
    /**
     * @minItems 1
     */
    tiers?: LocationTier[];
    /**
     * @minItems 1
     */
    cities?: string[];
  };
}
/**
 * demand, marketingCost, cac, churn, unitCost and fixedCosts are fractional multipliers (0.08 = +8%); brandAwareness, customerSatisfaction and productQuality are added to the score each active turn.
 */
export interface MarketEventEffects {
  demand?: number;
  marketingCost?: number;
  cac?: number;
  churn?: number;
  unitCost?: number;
  fixedCosts?: number;
  brandAwareness?: number;
  customerSatisfaction?: number;
  /**
   * Added to product quality each active turn.
   */
  productQuality?: number;
  /**
   * Fractional change to salary costs while active (0.1 = +10%).
   */
  salaries?: number;
}
/**
 * One founder decision for a turn. The meaning of value depends on type: PRICING = price in paise; MARKETING = monthly marketing budget in paise; HIRING = target employee headcount; PRODUCT_QUALITY = product investment in paise. Reserved types are rejected by the engine.
 */
export interface Decision {
  type: DecisionType;
  value: number;
}
/**
 * Outcome of validating and applying one decision, with the estimated direction and size of its effects.
 */
export interface DecisionResult {
  decision: Decision;
  status: 'ACCEPTED' | 'REJECTED';
  rejection?: DecisionRejection;
  effects: EstimatedEffect[];
}
export interface DecisionRejection {
  field: string;
  reason: string;
}
/**
 * Direction and rough size of a decision's effect on one metric, relative to keeping everything unchanged.
 */
export interface EstimatedEffect {
  metric: string;
  direction: 'UP' | 'DOWN' | 'FLAT';
  magnitude: 'NONE' | 'SMALL' | 'MEDIUM' | 'LARGE';
}
/**
 * Bounded modifiers from the customer and competitor agents, stored in the turn record so replay never calls an LLM.
 */
export interface AgentEffects {
  mode: AgentMode;
  customer: AgentOutput;
  competitor: AgentOutput;
}
/**
 * This interface was referenced by `AgentEffects`'s JSON-Schema
 * via the `definition` "AgentOutput".
 */
export interface AgentOutput {
  /**
   * rules_fallback means the LLM was attempted and rule-based effects were used instead.
   */
  source: 'rules' | 'llm' | 'rules_fallback';
  sentimentChange: number;
  demandModifier: number;
  competitorThreat: UnitInterval;
  reasoningSummary: string;
  fallbackReason?: string | null;
  /**
   * Served from the agent cache (same prompt version and input as an earlier call).
   */
  cached?: boolean;
}
/**
 * ML prediction for the next turn. Shown to the user and passed to the advisor; never fed back into simulation state.
 */
export interface Forecast {
  available: boolean;
  targetTurn: number;
  modelVersion?: string;
  trainingDatasetVersion?: string;
  /**
   * Paise.
   */
  revenue?: number;
  customers?: number;
  churnRate?: UnitInterval;
  unavailableReason?: string;
}
/**
 * AI CEO advisor output. May only cite figures present in its input. When available is false the other fields may be empty.
 */
export interface AIAdvice {
  available: boolean;
  mode: AdviceMode;
  question?: string;
  summary: string;
  positiveFactors: string[];
  negativeFactors: string[];
  keyRisk: string;
  keyOpportunity: string;
  recommendation: string;
  reasoning: string;
  confidence: UnitInterval;
  modelVersion?: string;
  unavailableReason?: string;
  /**
   * Advisor prompt version, e.g. advisor@v1.
   */
  promptVersion?: string;
  llmCalls?: LlmCall[];
}
/**
 * One LLM call (or cache hit) made while computing a turn or advice.
 */
export interface LlmCall {
  purpose: 'customer_agent' | 'competitor_agent' | 'advisor';
  model: string;
  /**
   * e.g. customer_agent@v1
   */
  promptVersion: string;
  promptTokens: number;
  completionTokens: number;
  /**
   * Served from the agent cache: no provider call, no tokens.
   */
  cached: boolean;
  /**
   * ok, or the failure kind (timeout, provider_error, invalid_output, ...).
   */
  outcome: string;
  latencyMs?: number;
}
/**
 * This interface was referenced by `SimulationTurn`'s JSON-Schema
 * via the `definition` "CompetitorAction".
 */
export interface CompetitorAction {
  competitorId: string;
  action: 'PRICE_CHANGE' | 'MARKETING_CHANGE' | 'PRODUCT_INVESTMENT' | 'NONE';
  /**
   * Relative price change, or absolute change in marketing power or product quality; 0 for NONE.
   */
  change: number;
  reason: string;
}
/**
 * Which prompts the turn used and what its LLM calls cost.
 *
 * This interface was referenced by `SimulationTurn`'s JSON-Schema
 * via the `definition` "TurnLlmUsage".
 */
export interface TurnLlmUsage {
  promptVersions: {
    customerAgent?: string;
    competitorAgent?: string;
    advisor?: string;
  };
  calls: LlmCall[];
  /**
   * The user's daily token quota was used up: agents ran on rules and the AI CEO was skipped.
   */
  dailyQuotaExhausted: boolean;
  /**
   * The per-turn token budget ran out before every LLM call was made.
   */
  turnBudgetExhausted: boolean;
}
/**
 * One past turn, condensed. Node sends the most recent few as the agents' bounded memory and the advisor's recent history.
 */
export interface TurnSummary {
  turnNumber: number;
  /**
   * @maxItems 9
   */
  decisions: Decision[];
  revenue: number;
  profit: number;
  cash: number;
  customers: number;
  newCustomers: number;
  churnedCustomers: number;
  customerSatisfaction: UnitInterval;
  marketShare: UnitInterval;
  /**
   * @maxItems 10
   */
  events: EventType[];
  /**
   * Reasoning summaries of the turn's agents, if any.
   */
  agentSummary?: string;
}
/**
 * User-written text about the startup that the agents and the advisor may read. It is untrusted: the prompts pass it as delimited data, never as instructions.
 */
export interface StartupProfile {
  name: string;
  productName: string;
  productDescription?: string;
}
/**
 * The single error shape returned by every API.
 */
export interface ApiError {
  error: ApiErrorBody;
}
export interface ApiErrorBody {
  /**
   * Stable machine-readable code, e.g. VALIDATION_ERROR, UNAUTHORIZED, TOKEN_EXPIRED, FORBIDDEN, NOT_FOUND, CONFLICT, RATE_LIMITED, PAYLOAD_TOO_LARGE, INTERNAL_ERROR.
   */
  code: string;
  message: string;
  details: unknown;
}
/**
 * Sign-in methods this deployment offers.
 */
export interface AuthOptions {
  /**
   * Whether Google sign-in is configured.
   */
  google: boolean;
}
/**
 * Returned by register, login and refresh. The refresh token travels only in an httpOnly cookie.
 */
export interface AuthResponse {
  user: User;
  accessToken: string;
  /**
   * Seconds.
   */
  accessTokenExpiresIn: number;
}
/**
 * Public view of a user. The password hash never leaves the backend.
 */
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
  /**
   * Whether the first-launch walkthrough was finished or dismissed.
   */
  onboardingCompleted: boolean;
  /**
   * Whether the email address was confirmed (verification link, password reset or Google). Unverified accounts cannot start simulations.
   */
  emailVerified: boolean;
  /**
   * False for accounts created with Google sign-in until a password is set through a reset.
   */
  hasPassword: boolean;
  /**
   * Whether Google sign-in is linked to the account.
   */
  googleLinked: boolean;
}
/**
 * Everything stored about a user, as downloaded from GET /account/export. Password hashes and token hashes are never included.
 */
export interface DataExport {
  exportedAt: string;
  user: User;
  startups: Startup[];
  simulations: Simulation[];
  turns: SimulationTurn[];
  advice: AdviceRecord[];
  sessions: Session[];
  llmUsage: LlmUsageRecord[];
}
export interface Startup {
  id: string;
  ownerId: string;
  name: string;
  product: Product;
  configuration: StartupConfiguration;
  createdAt: string;
  updatedAt: string;
  /**
   * Null for startups created before locations existed (they use the neutral profile).
   */
  location: Location | null;
}
export interface Product {
  name: string;
  description: string;
}
/**
 * Everything the engine needs to initialise a startup. Snapshotted from the industry template and difficulty presets when the startup is created or its economics are edited, so later template changes do not alter existing startups.
 */
export interface StartupConfiguration {
  industry: Industry;
  businessModel: BusinessModel;
  difficulty: Difficulty;
  /**
   * Paise.
   */
  initialCapital: number;
  /**
   * Paise per unit (per month for subscriptions).
   */
  initialPrice: number;
  /**
   * Number of potential customers in the addressable market.
   */
  marketSize: number;
  templateVersion: string;
  parameters: SimulationParameters;
  difficultyModifiers: DifficultyModifiers;
  eventsVersion: string;
  /**
   * Event catalog snapshotted from shared/templates/events.json.
   */
  events: MarketEvent[];
  locationProfile?: LocationProfile;
}
/**
 * Default economic parameters of an industry, consumed by the simulation engine. Money in paise; rates in [0, 1] and monthly unless stated.
 */
export interface SimulationParameters {
  /**
   * COGS as a share of revenue.
   */
  unitCostRate: number;
  /**
   * Paise per active customer per month (hosting, support, servicing).
   */
  variableCostPerCustomer: number;
  /**
   * Paise per order for shipping and fulfilment.
   */
  logisticsCostPerOrder: number;
  /**
   * Share of orders refunded.
   */
  returnRate: number;
  /**
   * Monthly inventory holding cost as a share of COGS.
   */
  inventoryHoldingRate: number;
  purchasesPerCustomerPerMonth: number;
  /**
   * Paise per month: rent, tools, overheads.
   */
  fixedCostsMonthly: number;
  salaryPerEmployeeMonthly: number;
  initialEmployees: number;
  baseChurnRate: UnitInterval;
  /**
   * Paise of marketing spend per acquired customer at reference conditions.
   */
  baseCac: number;
  baseConversionRate: UnitInterval;
  /**
   * Magnitude of demand response to price relative to referencePrice.
   */
  priceElasticity: number;
  /**
   * Typical market price in paise.
   */
  referencePrice: number;
  initialProductQuality: UnitInterval;
  initialBrandAwareness: UnitInterval;
  marketGrowthRateMonthly: number;
  /**
   * Twelve monthly demand multipliers, January first.
   *
   * @minItems 12
   * @maxItems 12
   */
  seasonality: number[];
  competitorIntensity: UnitInterval;
  eventProbabilityMultiplier: number;
  segmentMix: SegmentMix;
  /**
   * Customers one employee can serve before service quality suffers.
   */
  customersPerEmployee: number;
  /**
   * How local the industry's customers are: scales the demand-side location effects (purchasing power, local market size, competition). 0 or absent: none.
   */
  localDemandWeight?: number;
  /**
   * Cost per hire as a share of a monthly salary. Absent: the engine default (0.25). Set by location (talent availability).
   */
  recruitingCostSalaryShare?: number;
  /**
   * Most hires allowed in one turn. Absent: no limit. Set by location when talent is scarce.
   */
  maxHiresPerTurn?: number;
}
/**
 * Share of the addressable market in each customer segment. Weights sum to 1.
 */
export interface SegmentMix {
  priceSensitive: UnitInterval;
  premium: UnitInterval;
  loyal: UnitInterval;
  occasional: UnitInterval;
  enterprise: UnitInterval;
}
/**
 * Multipliers the engine applies to SimulationParameters for a difficulty level. 1.0 means unchanged.
 */
export interface DifficultyModifiers {
  cacMultiplier: number;
  churnMultiplier: number;
  conversionMultiplier: number;
  competitorIntensityMultiplier: number;
  eventProbabilityMultiplier: number;
  /**
   * Relative weight of negative events against positive ones.
   */
  negativeEventWeight: number;
}
/**
 * Resolved at creation. Absent (configurations from before Milestone 10) means the neutral profile.
 */
export interface LocationProfile {
  dataVersion: string;
  basis: LocationBasis;
  country: 'IN';
  state?: string | null;
  stateName?: string | null;
  city?: string | null;
  cityId?: string | null;
  tier?: LocationTier | null;
  indices: {
    salaryIndex: LocationIndex;
    operatingCostIndex: LocationIndex1;
    purchasingPower: LocationIndex2;
    localMarketSize: LocationIndex3;
    talentAvailability: LocationIndex4;
    competitionDensity: LocationIndex5;
    fundingAccess: LocationIndex6;
    infrastructure: LocationIndex7;
    regulatoryBurden: LocationIndex8;
  };
}
/**
 * Cost per employee.
 */
export interface LocationIndex {
  /**
   * Relative to the national baseline (1.0).
   */
  value: number;
  /**
   * True when no published figure exists and the value is a reasoned estimate.
   */
  isEstimate: boolean;
  source: string;
}
/**
 * Rent and fixed overheads.
 */
export interface LocationIndex1 {
  /**
   * Relative to the national baseline (1.0).
   */
  value: number;
  /**
   * True when no published figure exists and the value is a reasoned estimate.
   */
  isEstimate: boolean;
  source: string;
}
/**
 * How much local customers can spend; higher means less price sensitive.
 */
export interface LocationIndex2 {
  /**
   * Relative to the national baseline (1.0).
   */
  value: number;
  /**
   * True when no published figure exists and the value is a reasoned estimate.
   */
  isEstimate: boolean;
  source: string;
}
/**
 * Addressable customers nearby.
 */
export interface LocationIndex3 {
  /**
   * Relative to the national baseline (1.0).
   */
  value: number;
  /**
   * True when no published figure exists and the value is a reasoned estimate.
   */
  isEstimate: boolean;
  source: string;
}
/**
 * How easily and quickly hires are made.
 */
export interface LocationIndex4 {
  /**
   * Relative to the national baseline (1.0).
   */
  value: number;
  /**
   * True when no published figure exists and the value is a reasoned estimate.
   */
  isEstimate: boolean;
  source: string;
}
/**
 * Strength and number of local competitors.
 */
export interface LocationIndex5 {
  /**
   * Relative to the national baseline (1.0).
   */
  value: number;
  /**
   * True when no published figure exists and the value is a reasoned estimate.
   */
  isEstimate: boolean;
  source: string;
}
/**
 * Reserved for the funding decision; stored, unused until that decision exists.
 */
export interface LocationIndex6 {
  /**
   * Relative to the national baseline (1.0).
   */
  value: number;
  /**
   * True when no published figure exists and the value is a reasoned estimate.
   */
  isEstimate: boolean;
  source: string;
}
/**
 * Logistics and connectivity quality.
 */
export interface LocationIndex7 {
  /**
   * Relative to the national baseline (1.0).
   */
  value: number;
  /**
   * True when no published figure exists and the value is a reasoned estimate.
   */
  isEstimate: boolean;
  source: string;
}
/**
 * State-level compliance cost.
 */
export interface LocationIndex8 {
  /**
   * Relative to the national baseline (1.0).
   */
  value: number;
  /**
   * True when no published figure exists and the value is a reasoned estimate.
   */
  isEstimate: boolean;
  source: string;
}
/**
 * This interface was referenced by `LocationProfile`'s JSON-Schema
 * via the `definition` "LocationIndex".
 *
 * This interface was referenced by `LocationProfile1`'s JSON-Schema
 * via the `definition` "LocationIndex".
 */
export interface LocationIndex9 {
  /**
   * Relative to the national baseline (1.0).
   */
  value: number;
  /**
   * True when no published figure exists and the value is a reasoned estimate.
   */
  isEstimate: boolean;
  source: string;
}
/**
 * Where a startup is based. Set at creation; it cannot change once a simulation has started.
 */
export interface Location {
  /**
   * Only India for now; the field lets other countries be added later.
   */
  country: 'IN';
  /**
   * ISO 3166-2:IN state or union territory code, e.g. KA.
   */
  state: string;
  /**
   * City name: a listed city's name, or any other city the founder typed.
   */
  city: string;
  /**
   * The listed city's id, or null for any other city (profile from state and tier).
   */
  cityId?: string | null;
  tier: LocationTier;
}
/**
 * A simulation of one startup. The configuration is snapshotted when it starts. currentState is the stateAfter of the latest turn, or the initial state before turn 1.
 */
export interface Simulation {
  id: string;
  ownerId: string;
  startupId: string;
  /**
   * Seed for every random draw in the simulation. Stays within JavaScript's safe integer range.
   */
  seed: number;
  agentMode: AgentMode;
  status: SimulationStatus;
  /**
   * Engine version that created the initial state.
   */
  engineVersion: string;
  currentTurn: number;
  configuration: StartupConfiguration;
  currentState: SimulationState;
  activeJobId: string | null;
  createdAt: string;
  updatedAt: string;
  startupName: string;
  productName: string;
}
/**
 * An on-demand AI CEO question and its answer.
 *
 * This interface was referenced by `DataExport`'s JSON-Schema
 * via the `definition` "AdviceRecord".
 */
export interface AdviceRecord {
  simulationId: string;
  turnNumber: number;
  mode: AdviceMode;
  question: string | null;
  advice: AIAdvice;
  createdAt: string;
}
/**
 * An active sign-in (one refresh-token family).
 */
export interface Session {
  /**
   * Session id (the refresh-token family).
   */
  id: string;
  /**
   * Browser and operating system from the User-Agent, e.g. "Chrome on Windows".
   */
  device: string;
  signedInAt: string;
  /**
   * When the session last refreshed its access token.
   */
  lastUsedAt: string;
  /**
   * Whether this is the session making the request.
   */
  current: boolean;
}
/**
 * One LLM call made for the user.
 *
 * This interface was referenced by `DataExport`'s JSON-Schema
 * via the `definition` "LlmUsageRecord".
 */
export interface LlmUsageRecord {
  simulationId: string | null;
  turnNumber: number | null;
  purpose: string;
  model: string;
  promptVersion: string;
  promptTokens: number;
  completionTokens: number;
  cached: boolean;
  outcome: string;
  createdAt: string;
}
/**
 * A simulation estimate of a set of decisions: the direction and rough size of each effect, never exact figures. Nothing is recorded.
 */
export interface DecisionPreview {
  turnNumber: number;
  label: 'Simulation estimate';
  /**
   * Each decision on its own against keeping everything unchanged.
   */
  decisionResults: DecisionResult[];
  /**
   * All accepted decisions together.
   */
  combinedEffects: EstimatedEffect[];
}
/**
 * Body of preview and turn requests.
 */
export interface DecisionsRequest {
  /**
   * @maxItems 9
   */
  decisions: Decision[];
}
/**
 * Shape of shared/templates/difficulty.json.
 */
export interface DifficultyPresets {
  EASY: DifficultyModifiers;
  NORMAL: DifficultyModifiers;
  HARD: DifficultyModifiers;
}
export interface EngineAnalyticsRequest {
  initialState: SimulationState;
  records: SimulationTurn[];
  seed: number;
  configuration: StartupConfiguration;
  /**
   * Engine version the simulation was created with; it is computed by that version. Defaults to the current version.
   */
  engineVersion?: string;
}
export interface EngineInfoResponse {
  engineVersion: string;
  modelVersion: string | null;
  trainingDatasetVersion: string | null;
  llmConfigured: boolean;
  agentModel: string;
  advisorModel: string;
}
export interface EnginePreviewRequest {
  state: SimulationState;
  /**
   * @maxItems 9
   */
  decisions: Decision[];
  configuration: StartupConfiguration;
  /**
   * Seed for every random draw in the simulation. Stays within JavaScript's safe integer range.
   */
  seed: number;
  turnNumber: number;
  /**
   * Engine version the simulation was created with; it is computed by that version. Defaults to the current version.
   */
  engineVersion?: string;
}
export interface EngineReplayRequest {
  initialState: SimulationState;
  records: SimulationTurn[];
  /**
   * Seed for every random draw in the simulation. Stays within JavaScript's safe integer range.
   */
  seed: number;
  configuration: StartupConfiguration;
  /**
   * Engine version the simulation was created with; it is computed by that version. Defaults to the current version.
   */
  engineVersion?: string;
}
export interface EngineReplayResponse {
  records: SimulationTurn[];
  /**
   * Turn numbers whose recomputed stateAfter differs from the stored one.
   */
  mismatches: number[];
}
export interface EngineScenarioRequest {
  state: SimulationState;
  configuration: StartupConfiguration;
  seed: number;
  horizon: number;
  /**
   * @minItems 2
   * @maxItems 2
   */
  branches: ScenarioBranchInput[];
  /**
   * Engine version the simulation was created with; it is computed by that version. Defaults to the current version.
   */
  engineVersion?: string;
}
export interface ScenarioBranchInput {
  label?: string;
  /**
   * @maxItems 9
   */
  decisions: Decision[];
}
export interface EngineStartRequest {
  configuration: StartupConfiguration;
  /**
   * Seed for every random draw in the simulation. Stays within JavaScript's safe integer range.
   */
  seed: number;
}
export interface EngineStartResponse {
  state: SimulationState;
  engineVersion: string;
}
/**
 * Shape of shared/templates/events.json.
 */
export interface EventCatalog {
  eventsVersion: string;
  /**
   * @minItems 1
   */
  events: MarketEvent[];
}
export interface HealthResponse {
  status: 'ok';
}
export interface HealthServicesResponse {
  api: ServiceStatus;
  mongodb: ServiceStatus;
  redis: ServiceStatus;
  simulationEngine: ServiceStatus;
}
export interface IndustryTemplateListResponse {
  templates: IndustryTemplate[];
}
/**
 * A data file in shared/templates/industries describing one industry's default economics.
 */
export interface IndustryTemplate {
  industry: Industry;
  templateVersion: string;
  displayName: string;
  description: string;
  defaults: IndustryDefaults;
  parameters: SimulationParameters;
}
/**
 * Values the creation wizard pre-fills. Money in paise.
 */
export interface IndustryDefaults {
  businessModel: BusinessModel;
  initialCapital: number;
  initialPrice: number;
  marketSize: number;
}
/**
 * The user's LLM token use today (UTC) against the daily quota.
 */
export interface LlmUsageSummary {
  usedToday: number;
  dailyQuota: number;
  remaining: number;
  /**
   * Turns run in rules mode and the AI CEO is unavailable until the reset.
   */
  exhausted: boolean;
  resetsAt: string;
}
/**
 * States, their listed cities and the tiers, for choosing a startup's location.
 */
export interface LocationCatalog {
  dataVersion: string;
  country: 'IN';
  tiers: {
    tier: LocationTier;
    label: string;
    description: string;
  }[];
  states: {
    /**
     * ISO 3166-2:IN state or union territory code, e.g. KA.
     */
    code: string;
    name: string;
    cities: {
      /**
       * Id of a listed city, e.g. bengaluru.
       */
      id: string;
      name: string;
      tier: LocationTier;
    }[];
  }[];
}
/**
 * Resolve a location profile: a listed city by its id, or any other city by state and tier.
 */
export interface LocationProfileRequest {
  /**
   * ISO 3166-2:IN state or union territory code, e.g. KA.
   */
  state: string;
  cityId?: string | null;
  /**
   * Name of an unlisted city (with tier).
   */
  city?: string;
  tier?: LocationTier;
}
/**
 * The resolved location indices the engine uses, each relative to a national baseline of 1.0, with its source and whether it is an estimate. Snapshotted into the startup configuration.
 */
export interface LocationProfile1 {
  dataVersion: string;
  basis: LocationBasis;
  country: 'IN';
  state?: string | null;
  stateName?: string | null;
  city?: string | null;
  cityId?: string | null;
  tier?: LocationTier | null;
  indices: {
    salaryIndex: LocationIndex;
    operatingCostIndex: LocationIndex1;
    purchasingPower: LocationIndex2;
    localMarketSize: LocationIndex3;
    talentAvailability: LocationIndex4;
    competitionDensity: LocationIndex5;
    fundingAccess: LocationIndex6;
    infrastructure: LocationIndex7;
    regulatoryBurden: LocationIndex8;
  };
}
export interface LoginRequest {
  email: string;
  password: string;
}
/**
 * Set a new password with the reset token returned by POST /auth/password-reset/verify. The token works once and expires shortly. Signs out every session.
 */
export interface PasswordResetConfirmRequest {
  token: string;
  password: string;
}
/**
 * Ask for a password reset code. If the email has an account, a 6-digit code is emailed (valid for a few minutes; a new request replaces the previous code). Always answered with 202, whether or not the email has an account.
 */
export interface PasswordResetRequest {
  email: string;
}
/**
 * Check the 6-digit code emailed by POST /auth/password-reset. A wrong, used or expired code (or an email without an account) gets the same 400 INVALID_CODE; five wrong tries end the code.
 */
export interface PasswordResetVerifyRequest {
  email: string;
  /**
   * The six digits from the email.
   */
  code: string;
}
/**
 * The code was right: a single-use token for POST /auth/password-reset/confirm.
 */
export interface PasswordResetVerifyResponse {
  resetToken: string;
  expiresInSeconds: number;
}
/**
 * One line of the NDJSON stream returned by POST /pipeline/turn: stage events as each stage completes, then exactly one result or error.
 */
export interface PipelineEvent {
  type: 'stage' | 'result' | 'error';
  stage?: PipelineStage;
  progress?: number;
  record?: SimulationTurn;
  error?: PipelineError;
}
/**
 * This interface was referenced by `PipelineEvent`'s JSON-Schema
 * via the `definition` "PipelineError".
 */
export interface PipelineError {
  code: string;
  message: string;
  details?: unknown;
}
export interface PipelineTurnRequest {
  state: SimulationState;
  /**
   * @maxItems 9
   */
  decisions: Decision[];
  configuration: StartupConfiguration;
  /**
   * Seed for every random draw in the simulation. Stays within JavaScript's safe integer range.
   */
  seed: number;
  turnNumber: number;
  agentMode: AgentMode;
  /**
   * Recent turns of this simulation, oldest first (bounded agent memory).
   *
   * @maxItems 6
   */
  memory?: TurnSummary[];
  /**
   * Engine version the simulation was created with; it is computed by that version. Defaults to the current version.
   */
  engineVersion?: string;
  startupProfile?: StartupProfile;
  /**
   * LLM tokens the user may still spend today (null: no daily limit). 0 means the daily quota is exhausted: no LLM call is made.
   */
  tokenAllowance?: number | null;
}
/**
 * Password strength (10+ characters with lower case, upper case and a digit) is checked by the auth service so the error names the missing rule.
 */
export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}
/**
 * Two branches run from the same state with the same seed and rules agents, so the decisions are the only difference. Never stored.
 */
export interface ScenarioComparison {
  startTurn: number;
  horizon: number;
  label: 'Simulation estimate';
  agentMode: 'rules';
  /**
   * @minItems 2
   * @maxItems 2
   */
  branches: ScenarioBranchResult[];
  /**
   * Empty when either branch was rejected. Differences only; no recommendation.
   */
  differences: ScenarioDifference[];
}
/**
 * This interface was referenced by `ScenarioComparison`'s JSON-Schema
 * via the `definition` "ScenarioBranchResult".
 */
export interface ScenarioBranchResult {
  label: string;
  decisions: Decision[];
  rejections: DecisionRejection[];
  bankruptAtTurn: number | null;
  turns: ScenarioTurn[];
  totals: ScenarioTotals | null;
}
/**
 * This interface was referenced by `ScenarioComparison`'s JSON-Schema
 * via the `definition` "ScenarioTurn".
 */
export interface ScenarioTurn {
  turn: number;
  revenue: number;
  profit: number;
  customers: number;
  churnRate: number;
  cash: number;
}
/**
 * This interface was referenced by `ScenarioComparison`'s JSON-Schema
 * via the `definition` "ScenarioTotals".
 */
export interface ScenarioTotals {
  revenue: number;
  profit: number;
  endCash: number;
  endCustomers: number;
  averageChurnRate: number;
}
/**
 * This interface was referenced by `ScenarioComparison`'s JSON-Schema
 * via the `definition` "ScenarioDifference".
 */
export interface ScenarioDifference {
  metric: 'revenue' | 'profit' | 'endCash' | 'endCustomers' | 'averageChurnRate';
  baseline: number;
  alternative: number;
  /**
   * alternative minus baseline
   */
  difference: number;
}
/**
 * Compare two decision sets from the current state over 1-6 turns.
 */
export interface ScenarioRequest {
  horizon: number;
  baseline: ScenarioBranchInput;
  alternative: ScenarioBranchInput;
}
/**
 * Active sessions, most recently used first.
 */
export interface SessionListResponse {
  sessions: Session[];
}
/**
 * Everything the dashboard and analytics views show, computed by the simulation service from stored turn records. Money in paise.
 */
export interface SimulationAnalytics {
  currentTurn: number;
  kpis: Kpis;
  market: MarketSnapshot;
  /**
   * One entry per turn, starting at turn 0.
   */
  series: TurnMetrics[];
  segments: SegmentPoint[];
  competitors: CompetitorPoint[];
  forecasts: ForecastPoint[];
  forecastAccuracy: ForecastAccuracy;
  decisions: DecisionAnalysis[];
  location?: LocationImpact;
}
export interface Kpis {
  cash: Kpi;
  revenue: Kpi;
  profit: Kpi;
  customers: Kpi;
  churnRate: Kpi;
  marketShare: Kpi;
}
/**
 * A headline figure with its value one turn earlier (null at turn 0).
 *
 * This interface was referenced by `SimulationAnalytics`'s JSON-Schema
 * via the `definition` "Kpi".
 */
export interface Kpi {
  value: number;
  previous: number | null;
  change: number | null;
}
/**
 * This interface was referenced by `SimulationAnalytics`'s JSON-Schema
 * via the `definition` "MarketSnapshot".
 */
export interface MarketSnapshot {
  customerSentiment: number;
  sentimentChange: number | null;
  competitorPressure: number;
  pressureChange: number | null;
  demandIndex: number;
  /**
   * Demand index the next turn starts with (seasonality and events still active).
   */
  demandIndexNext: number;
  activeEvents: ActiveEventSummary[];
}
export interface ActiveEventSummary {
  type: EventType;
  title: string;
  polarity: EventPolarity;
  turnsLeft: number;
}
/**
 * This interface was referenced by `SimulationAnalytics`'s JSON-Schema
 * via the `definition` "TurnMetrics".
 */
export interface TurnMetrics {
  turn: number;
  revenue: number;
  expensesTotal: number;
  variableCosts: number;
  fixedCosts: number;
  marketingCosts: number;
  employeeCosts: number;
  productCosts: number;
  profit: number;
  cash: number;
  customers: number;
  newCustomers: number;
  churnedCustomers: number;
  churnRate: number;
  marketShare: number;
  customerSatisfaction: number;
  competitorPressure: number;
  brandAwareness: number;
  productQuality: number;
  price: number;
  marketingBudget: number;
  employees: number;
  /**
   * (revenue - variable costs) / revenue; null without revenue.
   */
  grossMargin: number | null;
  /**
   * Paise lost this turn (0 when profitable).
   */
  burnRate: number;
  /**
   * cash / burnRate; null when not burning cash.
   */
  runwayMonths: number | null;
  /**
   * Marketing spend / new customers, paise; null without new customers.
   */
  cac: number | null;
  /**
   * ARPU x gross margin / churn rate, paise; null when undefined.
   */
  ltv: number | null;
  /**
   * Revenue per customer this turn, paise; null without customers.
   */
  arpu: number | null;
  /**
   * Seasonality x active event demand effects during the turn (1 = normal).
   */
  demandIndex: number;
}
/**
 * This interface was referenced by `SimulationAnalytics`'s JSON-Schema
 * via the `definition` "SegmentPoint".
 */
export interface SegmentPoint {
  turn: number;
  segment: CustomerSegmentType;
  customers: number;
  population: number;
  churnProbability: number;
  conversionRate: number;
}
/**
 * This interface was referenced by `SimulationAnalytics`'s JSON-Schema
 * via the `definition` "CompetitorPoint".
 */
export interface CompetitorPoint {
  turn: number;
  id: string;
  name: string;
  archetype: CompetitorArchetype;
  price: number;
  marketShare: number;
  productQuality: number;
  marketingPower: number;
}
/**
 * This interface was referenced by `SimulationAnalytics`'s JSON-Schema
 * via the `definition` "ForecastPoint".
 */
export interface ForecastPoint {
  targetTurn: number;
  modelVersion: string | null;
  predicted: ForecastValues;
  /**
   * Null until the target turn is played.
   */
  actual: ForecastValues | null;
  revenueErrorPercent: number | null;
  customersErrorPercent: number | null;
  churnRateError: number | null;
}
/**
 * This interface was referenced by `SimulationAnalytics`'s JSON-Schema
 * via the `definition` "ForecastValues".
 */
export interface ForecastValues {
  revenue: number;
  customers: number;
  churnRate: number;
}
/**
 * This interface was referenced by `SimulationAnalytics`'s JSON-Schema
 * via the `definition` "ForecastAccuracy".
 */
export interface ForecastAccuracy {
  pairs: number;
  revenueMape: number | null;
  customersMape: number | null;
  churnRateMae: number | null;
}
/**
 * This interface was referenced by `SimulationAnalytics`'s JSON-Schema
 * via the `definition` "DecisionAnalysis".
 */
export interface DecisionAnalysis {
  turn: number;
  decisions: PreviewedDecision[];
  /**
   * All decisions together against changing nothing, as the preview estimated.
   */
  combinedPreview: EstimatedEffect[];
  /**
   * How each metric actually moved over the turn (stateBefore to stateAfter).
   */
  actual: EstimatedEffect[];
  /**
   * Share of metrics the preview expected to move whose actual movement went the same way.
   */
  directionAgreement: number | null;
}
export interface PreviewedDecision {
  decision: Decision;
  previewed: EstimatedEffect[];
}
/**
 * How much of the cost base and demand the location accounts for, against the neutral baseline (every index 1.0).
 *
 * This interface was referenced by `SimulationAnalytics`'s JSON-Schema
 * via the `definition` "LocationImpact".
 */
export interface LocationImpact {
  profile: LocationProfile1;
  localDemandWeight: number;
  /**
   * Latest turn, per cost line: the amount and what it would be at the national baseline (paise).
   */
  costs: {
    key: 'salaries' | 'recruiting' | 'fixed' | 'compliance' | 'logistics';
    label: string;
    /**
     * Multiplier the location applies to this line.
     */
    factor: number;
    actual: number;
    baseline: number;
  }[];
  /**
   * Latest turn's total expenses (paise).
   */
  monthlyCostBase: number;
  /**
   * Latest turn's expenses minus what they would be at the baseline (negative: the location saves money).
   */
  monthlyLocationCost: number;
  demand: {
    key: 'marketSize' | 'priceElasticity' | 'competition' | 'maxHires';
    label: string;
    /**
     * Multiplier after local demand weighting (1.0 = no effect).
     */
    factor: number;
  }[];
}
/**
 * A queued turn. Only one job per simulation can be QUEUED or RUNNING at a time.
 */
export interface SimulationJob {
  jobId: string;
  simulationId: string;
  turnNumber: number;
  status: JobStatus;
  progress: number;
  stage: PipelineStage | null;
  startedAt: string | null;
  completedAt: string | null;
  error: JobError | null;
  createdAt: string;
}
/**
 * This interface was referenced by `SimulationJob`'s JSON-Schema
 * via the `definition` "JobError".
 */
export interface JobError {
  code: string;
  message: string;
  details?: unknown;
}
export interface SimulationListResponse {
  simulations: Simulation[];
}
/**
 * Both fields are optional; the seed is random when omitted.
 */
export interface SimulationStartRequest {
  /**
   * Seed for every random draw in the simulation. Stays within JavaScript's safe integer range.
   */
  seed?: number;
  agentMode?: AgentMode;
}
/**
 * The creation wizard's fields. Money in paise.
 */
export interface StartupCreateRequest {
  name: string;
  industry: Industry;
  businessModel: BusinessModel;
  /**
   * Paise; between 1 lakh and 1,000 crore rupees.
   */
  initialCapital: number;
  product: Product;
  /**
   * Paise; at least 1 rupee.
   */
  initialPrice: number;
  marketSize: number;
  difficulty: Difficulty;
  location: Location;
}
export interface StartupListResponse {
  startups: Startup[];
}
/**
 * Partial update. Changing industry, businessModel or difficulty re-snapshots the template parameters.
 */
export interface StartupUpdateRequest {
  name?: string;
  industry?: Industry;
  businessModel?: BusinessModel;
  /**
   * Paise; between 1 lakh and 1,000 crore rupees.
   */
  initialCapital?: number;
  product?: Product;
  /**
   * Paise; at least 1 rupee.
   */
  initialPrice?: number;
  marketSize?: number;
  difficulty?: Difficulty;
  location?: Location1;
}
/**
 * Where a startup is based. Set at creation; it cannot change once a simulation has started.
 */
export interface Location1 {
  /**
   * Only India for now; the field lets other countries be added later.
   */
  country: 'IN';
  /**
   * ISO 3166-2:IN state or union territory code, e.g. KA.
   */
  state: string;
  /**
   * City name: a listed city's name, or any other city the founder typed.
   */
  city: string;
  /**
   * The listed city's id, or null for any other city (profile from state and tier).
   */
  cityId?: string | null;
  tier: LocationTier;
}
export interface TurnListResponse {
  turns: SimulationTurn[];
}
/**
 * The token from the verification link.
 */
export interface VerifyEmailRequest {
  token: string;
}
/**
 * Messages the browser sends on /api/v1/ws. The first must be auth with an access token.
 */
export interface WsClientMessage {
  type: 'auth' | 'subscribe' | 'unsubscribe' | 'ping';
  token?: string;
  simulationId?: string;
}
/**
 * Messages the API sends on /api/v1/ws: stage progress and job status changes for subscribed simulations.
 */
export interface WsServerMessage {
  type: 'ready' | 'subscribed' | 'unsubscribed' | 'stage' | 'job' | 'error' | 'pong';
  simulationId?: string;
  jobId?: string;
  turnNumber?: number;
  stage?: PipelineStage;
  progress?: number;
  job?: SimulationJob;
  error?: WsError;
}
export interface WsError {
  code: string;
  message: string;
}
