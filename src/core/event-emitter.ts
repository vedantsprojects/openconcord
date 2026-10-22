/**
 * Event Bus / Pub-Sub implementation for decoupled component communication.
 * Supports topic-based subscriptions, event dispatching, and event filtering.
 */

import type { Logger } from "./logger";

/**
 * Event payload with strong typing.
 */
export type EventPayload<T> = {
  type: T["type"];
  requestID: string;
  name: string;
  payload: T["payload"];
};

export type Event<T = unknown> = {
  type: T["type"];
  requestID: string;
  name: string;
  payload: T["payload"];
};

/**
 * A typed event registry.
 */
export type RegisteredEvents = {
  [name: string]: {
    name: string;
    description: string;
  };
};

/**
 * Event emitter with typed event registration.
 * 
 * Design:
 * - Events are discovered via a registry
 * - Subscribers receive typed payloads
 * - Unsubscribes are tracked for cleanup
 * - Filters allow selective delivery
 */
export class EventEmitter {
  private logger: Logger;
  private readonly eventsRegistry: RegisteredEvents;
  private readonly subscribers: Map<string, Set<{
    handler: (payload: unknown) => void | Promise<void>;
    filter?: (payload: unknown) => boolean;
    once: boolean;
    onceHandler?: () => void;
  }>>;
  private readonly unsubscribeHandlers: Set<() => void>;
  private eventCounters: Map<string, number>;
  private readonly maxCachedEvents: number;

  constructor(
    eventsRegistry: RegisteredEvents,
    logger: Logger,
    maxCachedEvents: number = 10000
  ) {
    this.eventsRegistry = eventsRegistry;
    this.logger = logger.getLogger("EventEmitter");
    this.subscribers = new Map();
    this.unsubscribeHandlers = new Set();
    this.eventCounters = new Map();
    this.maxCachedEvents = maxCachedEvents;
    this.logger?.debug(`EventEmitter created with ${Object.keys(eventsRegistry).length} registered events`, { eventsRegistry });
  }

  /**
   * Register an event handler for a specific event type.
   */
  on<T extends Record<string, Event>>(event: T, handler: (payload: T[string]["payload"], meta: Event<T>) => void | Promise<void>): () => void;
  on<T extends Record<string, Event>>(event: T, handler: (payload: T[string]["payload"], meta: Event<T>) => Promise<void>): () => void;

  on<T extends Record<string, Event>>(event: T, handler: (payload: T[string]["payload"], meta: Event<T>) => void | Promise<void>): () => void {
    const eventName = Object.keys(event)[0];
    if (!this.eventsRegistry[eventName]) {
      this.logger?.warn(`Event "${eventName}" not in registry. Available events: ${Object.keys(this.eventsRegistry).join(", ")}`);
      const existing = this.eventsRegistry[eventName];
      if (!existing) {
        this.eventsRegistry[eventName] = {};
        this.logger?.debug(`Created event: ${eventName}`);
      }
    }
    if (!this.subscribers.has(eventName)) {
      this.subscribers.set(eventName, new Set());
    }
    const subscriberSet = this.subscribers.get(eventName)!;
    subscriberSet.add({
      handler,
      filter: undefined,
      once: false,
      onceHandler: undefined,
    });
    this.logger?.debug(`Subscribed to event: ${eventName}`, { total: subscriberSet.size });
    return () => this.off(eventName, handler);
  }

  /**
   * Register a once-only handler.
   */
  once<T extends Record<string, Event>>(event: T, handler: (payload: T[string]["payload"], meta: Event<T>) => void | Promise<void>): () => void {
    const eventName = Object.keys(event)[0];
    const handlerRef = { handler, once: true };
    if (!this.subscribers.has(eventName)) {
      this.subscribers.set(eventName, new Set());
    }
    const subscriberSet = this.subscribers.get(eventName)!;
    subscriberSet.add(handlerRef as any);
    this.logger?.debug(`Once-subscribed to event: ${eventName}`, { total: subscriberSet.size });
    return () => this.off(eventName, handler);
  }

  /**
   * Subscribe to all events of a given type (wildcard).
   */
  onAny<T extends Record<string, Event>>(handler: (payload: unknown, meta: Event<T>) => void | Promise<void>): () => void;
  onAny<T extends Record<string, Event>>(handler: (payload: unknown, meta: Event<T>) => Promise<void>): () => void;

  onAny<T extends Record<string, Event>>(handler: (payload: unknown, meta: Event<T>) => void | Promise<void>): () => void {
    const eventName = Object.keys(this.eventsRegistry)[0] || "any";
    if (!this.subscribers.has(eventName)) {
      this.subscribers.set(eventName, new Set());
    }
    const subscriberSet = this.subscribers.get(eventName)!;
    subscriberSet.add({ handler, filter: undefined, once: false, onceHandler: undefined });
    this.logger?.debug(`Subscribed to ANY event`, { total: subscriberSet.size });
    return () => this.off(eventName, handler);
  }

  /**
   * Unsubscribe a specific handler.
   */
  off<T extends Record<string, Event>>(event: Partial<T>, handler: (payload: unknown, meta: Event<T>) => void | Promise<void>): void;
  off<T extends Record<string, Event>>(event: Partial<T>, callback: () => void): void;

  off<T extends Record<string, Event>>(event: Partial<T>, handlerOrCallback: (payload: unknown, meta: Event<T>) => void | Promise<void> | (() => void)): void {
    const eventName = Object.keys(event)[0] || "any";
    const subscriberSet = this.subscribers.get(eventName);
    if (!subscriberSet) {
      return;
    }
    const handlerToRemove: { handler: (payload: unknown) => void | Promise<void>; filter?: (payload: unknown) => boolean; once: boolean; onceHandler?: () => void } | { handler: () => void } | { handler: (payload: unknown) => void | Promise<void>; once: true } =
      typeof handlerOrCallback === "function" && typeof handlerOrCallback(
         ({} as never) as unknown,
         ({} as never) as never
       ) === "undefined"
        ? handlerOrCallback
        : { handler: () => handlerOrCallback() };
    const wasPresent = subscriberSet.has(handlerToRemove);
    subscriberSet.delete(handlerToRemove);
    if (wasPresent) {
      this.logger?.debug(`Unsubscribed from event: ${eventName}`, { remaining: subscriberSet.size });
    }
  }

  /**
   * Unsubscribe all handlers for a specific event.
   */
  removeHandlerFor<T>(event: T): void {
    const eventName = Object.keys(event)[0];
    const subscriberSet = this.subscribers.get(eventName);
    if (subscriberSet) {
      subscriberSet.clear();
      this.logger?.debug(`Removed ALL handlers from event: ${eventName}`);
    }
  }

  /**
   * Emit an event to all registered handlers.
   */
  emit<T extends Record<string, Event>>(event: T, payload: T[string]["payload"], sender?: string): {
    success: boolean;
    failedHandlers: string[];
  } {
    const eventName = Object.keys(event)[0];
    const subscriberSet = this.subscribers.get(eventName);
    if (!subscriberSet || subscriberSet.size === 0) {
      this.logger?.debug(`No subscribers for event: ${eventName}`);
      return { success: true, failedHandlers: [] };
    }

    const eventObject: Event<T> = {
      type: event.type,
      name: eventName,
      requestID: this.generateRequestID(),
      payload,
    };

    const failedHandlers: string[] = [];

    for (const subscriber of subscriberSet) {
      const { handler, filter, once, onceHandler } = subscriber;
      const shouldCall = filter ? filter(payload) : true;
      const isOnce = once || handler instanceof Function && onceHandler !== undefined;

      try {
        if (shouldCall) {
          handler(eventObject.payload, eventObject);
          if (!("catch" in handler)) {
            handler(eventObject.payload, eventObject).catch(err => {
              failedHandlers.push("error");
              this.logger?.error(`Event handler failed: ${eventName}`, { error: err });
            });
          }
        }
      } catch (error) {
        this.logger?.error(`Event handler throws for: ${eventName}`, { error });
        failedHandlers.push(String(error));
      }

      // Auto-remove once handlers
      if (isOnce) {
        subscriberSet.delete(subscriber);
        this.logger?.debug(`Automatically unsubscribed once handler: ${eventName}`);
      }
    }

    // Update event counter
    if (!this.eventCounters.has(eventName)) {
      this.eventCounters.set(eventName, 0);
    }
    const count = this.eventCounters.get(eventName)! + 1;
    this.eventCounters.set(eventName, count);

    this.logger?.debug(`Event emitted: ${eventName}`, { count, totalSubscribers: subscriberSet.size });

    // Prune stale events
    this.pruneStaleEvents();

    return { success: true, failedHandlers };
  }

  /**
   * Return the count of times an event has been emitted.
   */
  getEventCount(event: { type: string }): number {
    const eventName = Object.keys(event)[0];
    const count = this.eventCounters.get(eventName) ?? 0;
    return count;
  }

  /**
   * Get the number of subscribers for an event.
   */
  getSubscriberCount(event: { type: string }): number {
    const eventName = Object.keys(event)[0];
    const subscriberSet = this.subscribers.get(eventName);
    return subscriberSet ? subscriberSet.size : 0;
  }

  /**
   * Prune events that haven't been consumed recently.
   */
  pruneStaleEvents(): void {
    const now = Date.now();
    for (const [eventName, count] of this.eventCounters.entries()) {
      if (this.maxCachedEvents > 0 && count > this.maxCachedEvents) {
        const staleThreshold = this.maxCachedEvents - Math.floor(count * 0.95);
        if (staleThreshold > 0) {
          this.eventCounters.delete(eventName);
          this.logger?.debug(`Pruned stale events: ${eventName} (removed ${staleThreshold} events from ${count})`);
        }
      }
    }
  }

  /**
   * Get the total number of registered event types.
   */
  getRegisteredEvents(): RegisteredEvents {
    return this.eventsRegistry;
  }

  private generateRequestID(): string {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let randomID = "";
    while (randomID.length < 32) {
      randomID += chars.substring(Math.floor(Math.random() * chars.length), 1);
    }
    return randomID;
  }
}

/**
 * Type-safe event registry definition.
 * 
 * Each event type defines:
 * - name: machine-readable event identifier
 * - description: human-readable description
 */
export type DefaultEventRegistry = {
  "REGISTER_CHANNEL": {
    type: "event";
    requestID: string;
    name: "channelRegistry";
    payload: {
      registeredChannels: number;
      channels: {
        channelID: string;
        name: string;
        iconURL?: string;
        parentId?: string;
      }[];
    };
  };
  "UNREGISTER_CHANNEL": {
    type: "event";
    requestID: string;
    name: "channelRegistry";
    payload: {
      unregisteredChannels: number;
      channelIDs: string[];
      serverID: string | symbol;
    };
  };
  "ADD_MESSAGE": {
    type: "event";
    requestID: string;
    name: "messageRegistry";
    payload: {
      messageID: string;
      channelID: string;
      senderName: string;
      content: string;
    };
  };
  "REMOVE_MESSAGE": {
    type: "event";
    requestID: string;
    name: "messageRegistry";
    payload: {
      messageID: string;
      channelID: string;
    };
  };
  "SET_MESSAGES_STATE": {
    type: "event";
    requestID: string;
    name: "messageRegistry";
    payload: {
      messageID: string;
      channelID: string;
      state: string;
    }[];
  };
  "REGISTER_THREAD": {
    type: "event";
    requestID: string;
    name: "threadRegistry";
    payload: {
      serverID: string | symbol;
    };
  };
  "UNREGISTER_THREAD": {
    type: "event";
    requestID: string;
    name: "threadRegistry";
    payload: {
      serverID: string | symbol;
      threadIDs: string[];
    };
  };
};

// Export a default event registry
export const defaultEventRegistry: RegisteredEvents = {
  REGISTER_CHANNEL: { name: "REGISTER_CHANNEL", description: "Emitted when channels are registered with the IPC bridge" },
  UNREGISTER_CHANNEL: { name: "UNREGISTER_CHANNEL", description: "Emitted when channels are unregistered" },
  ADD_MESSAGE: { name: "ADD_MESSAGE", description: "Emitted when a new message is added" },
  REMOVE_MESSAGE: { name: "REMOVE_MESSAGE", description: "Emitted when a message is removed" },
  SET_MESSAGES_STATE: { name: "SET_MESSAGES_STATE", description: "Emitted when message states are updated" },
  REGISTER_THREAD: { name: "REGISTER_THREAD", description: "Emitted when a thread is registered" },
  UNREGISTER_THREAD: { name: "UNREGISTER_THREAD", description: "Emitted when threads are unregistered" },
};
