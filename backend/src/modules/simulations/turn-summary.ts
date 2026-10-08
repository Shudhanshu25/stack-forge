import mongoose from 'mongoose';
import type { SimulationTurn, TurnSummary } from '@stackforge/shared';
import { TurnModel } from './turn.model.js';

/** Turns kept as agent memory and advisor history. */
export const MEMORY_TURNS = 5;

/** Condenses a turn record for the agents' bounded memory and the advisor's recent history. */
export function toTurnSummary(record: SimulationTurn): TurnSummary {
  const s = record.stateAfter;
  const notes = [record.agentEffects.customer, record.agentEffects.competitor]
    .filter((a) => a.source === 'llm')
    .map((a) => a.reasoningSummary)
    .join(' ');
  return {
    turnNumber: record.turnNumber,
    decisions: record.decisions,
    revenue: s.revenue,
    profit: s.profit,
    cash: s.cash,
    customers: s.customers,
    newCustomers: s.newCustomers,
    churnedCustomers: s.churnedCustomers,
    customerSatisfaction: s.customerSatisfaction,
    marketShare: s.marketShare,
    events: record.events.slice(0, 10).map((e) => e.type),
    ...(notes ? { agentSummary: notes.slice(0, 600) } : {}),
  };
}

/** Summaries of the turns before `beforeTurn` (exclusive), oldest first. */
export async function recentSummaries(
  simulationId: unknown,
  beforeTurn: number,
  limit = MEMORY_TURNS,
): Promise<TurnSummary[]> {
  const docs = await TurnModel.find({
    simulationId,
    turnNumber: mongoose.trusted({ $lt: beforeTurn }),
  })
    .sort({ turnNumber: -1 })
    .limit(limit)
    .select({ record: 1 })
    .lean();
  return docs.reverse().map((d) => toTurnSummary(d.record as SimulationTurn));
}
