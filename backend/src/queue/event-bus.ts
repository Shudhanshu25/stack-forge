import { EventEmitter } from 'node:events';
import type { Redis } from 'ioredis';
import type { WsServerMessage } from '@stackforge/shared';

/** A progress or job-status event for one simulation, relayed to its WebSocket room. */
export type SimulationEvent = WsServerMessage & { simulationId: string };
export type EventHandler = (event: SimulationEvent) => void;

/** Carries events from the worker process to every API process. */
export interface EventBus {
  publish(event: SimulationEvent): Promise<void>;
  subscribe(handler: EventHandler): Promise<() => Promise<void>>;
}

export const EVENTS_CHANNEL = 'stackforge:simulation-events';

/** Redis pub/sub. Publishing and subscribing need separate connections. */
export class RedisEventBus implements EventBus {
  constructor(
    private readonly publisher: Redis,
    private readonly createSubscriber: () => Redis,
  ) {}

  /**
   * Best effort: progress relay must never fail a turn. Job status in MongoDB stays
   * authoritative, and the browser polls the job if it misses events.
   */
  async publish(event: SimulationEvent): Promise<void> {
    try {
      await this.publisher.publish(EVENTS_CHANNEL, JSON.stringify(event));
    } catch {
      // Redis unavailable: drop the event.
    }
  }

  async subscribe(handler: EventHandler): Promise<() => Promise<void>> {
    const subscriber = this.createSubscriber();
    subscriber.on('message', (_channel, message: string) => {
      try {
        handler(JSON.parse(message) as SimulationEvent);
      } catch {
        // A malformed message must not take down the subscriber.
      }
    });
    await subscriber.subscribe(EVENTS_CHANNEL);
    return async () => {
      await subscriber.quit();
    };
  }
}

/** Single-process bus for tests. */
export class MemoryEventBus implements EventBus {
  readonly published: SimulationEvent[] = [];
  private readonly emitter = new EventEmitter();

  async publish(event: SimulationEvent): Promise<void> {
    this.published.push(event);
    this.emitter.emit('event', event);
  }

  async subscribe(handler: EventHandler): Promise<() => Promise<void>> {
    this.emitter.on('event', handler);
    return async () => {
      this.emitter.off('event', handler);
    };
  }
}
