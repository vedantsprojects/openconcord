/**
 * IPC Bridge — Manages all communication between renderer and main processes.
 * Implements a typed message protocol with request/response, events, and pub/sub.
 * 
 * Protocol Design:
 * - All messages are typed with Zod validation
 * - Request/Response pairs use correlated RequestIDs
 * - Events are broadcast without waiting for response
 * - Pub/Sub allows decoupled communication via channels
 */

import type { ChannelRegistry } from "../components/modules/channels/types";
import type { UserRegistry } from "../components/modules/users/types";
import type { MessageRegistry } from "../components/modules/messages/types";
import type { ThreadRegistry } from "../components/modules/threads/types";
import { nanoid } from "nanoid";

/**
 * Core message types with strict typing
 */
export type RequestMessage<T = unknown> = {
  type: "request";
  requestID: string;
  name: string;
  payload: T;
};

export type ResponseMessage<T = unknown> = {
  type: "response";
  requestID: string;
  name: string;
  payload: T;
  error: ResponsePayload<"error"> | null;
};

export type ResponsePayload<T = unknown> = {
  code: number;
  data: T | null;
  message: string;
};

export type EventMessage<T = unknown> = {
  type: "event";
  requestID: string;
  name: string;
  payload: T;
};

export type PubMessage<T = unknown> = {
  type: "pub";
  name: string;
  payload: T;
};

export type UnsubscribeMessage = {
  type: "unsubscribe";
  requestID: string;
  name: string;
  channelID: string;
};

/**
 * All supported IPC commands
 */
export type RegisteredCommandNames =
  | "registerChannel"
  | "unregisterChannel"
  | "addMessage"
  | "unregisterMessages"
  | "setMessageState"
  | "removeMessage"
  | "registerThread"
  | "unregisterThread"
  | "updateChannelPresence"
  | "setUserPresence";

/**
 * Message registry interface
 */
export interface MessageRegistryInterface {
  addMessage(channelID: string, payload: unknown): void;
  removeMessage(channelID: string, payload: unknown): void;
  unregisterMessages(serverID: string | symbol): void;
}

/**
 * IPC Bridge — central message router
 */
export class IPCBridge {
  private listeners = new Map<string, Set<(data: unknown) => void>>();
  private publisher: (message: unknown) => void;
  private _requestListener: (data: RequestMessage) => void;
  private _requestIDGenerator: () => string;
  private logger: {
    info(msg: string, data?: Record<string, unknown>): void;
    warn(msg: string, data?: Record<string, unknown>): void;
    error(msg: string, data?: Record<string, unknown>): void;
    debug(msg: string, data?: Record<string, unknown>): void;
  };

  constructor(
    readonly serverID: string,
    readonly requestListener: (data: RequestMessage) => void | Promise<Record<string, unknown>>,
    readonly _requestIDGenerator: () => string,
    readonly publisher: (message: unknown) => void,
    readonly unsubscribe: (requestID: string) => void,
    logger: {
      info(msg: string, data?: Record<string, unknown>): void;
      warn(msg: string, data?: Record<string, unknown>): void;
      error(msg: string, data?: Record<string, unknown>): void;
      debug(msg: string, data?: Record<string, unknown>): void;
    }
  ) {
    this._requestListener = requestListener;
    this._requestIDGenerator = _requestIDGenerator;
    this.logger = logger;
    this.registerListener("registerChannel", this.onRegisterChannel.bind(this));
    this.registerListener("unregisterChannel", this.onUnregisterChannel.bind(this));
    this.registerListener("addMessage", this.onAddMessage.bind(this));
    this.registerListener("removeMessage", this.onRemoveMessage.bind(this));
    this.registerListener("setMessageState", this.onSetMessageState.bind(this));
    this.registerListener("registerThread", this.onRegisterThread.bind(this));
    this.registerListener("unregisterThread", this.onUnregisterThread.bind(this));
    this.registerListener("updateChannelPresence", this.onUpdateChannelPresence.bind(this));
    this.registerListener("setUserPresence", this.onSetUserPresence.bind(this));
  }

  /**
   * Register a listener for a specific event name
   */
  registerListener(
    name: string,
    listener: (data: unknown) => void | Promise<void>
  ): () => void {
    if (!this.listeners.has(name)) {
      this.listeners.set(name, new Set());
    }
    const set = this.listeners.get(name)!;
    set.add(listener);
    this.logger.debug(`Registered listener for "${name}"`, { total: set.size });
    return () => {
      set.delete(listener);
      this.logger.debug(`Unregistered listener for "${name}"`, { remaining: set.size });
    };
  }

  /**
   * Unregister all listeners for a specific event
   */
  unregisterListener(name: string): void {
    const set = this.listeners.get(name);
    if (set) {
      set.clear();
      this.listeners.delete(name);
      this.logger.debug(`All listeners unregistered for "${name}"`);
    }
  }

  /**
   * Handle an incoming request message
   */
  handle(request: RequestMessage): void {
    const { requestID, type, error, name, payload } = request;
    if (type === "request") {
      try {
        const response = this._requestListener(request).catch((e) => ({
          error: { code: 500, data: null, message: e.message || String(e) },
        }));
        this.publishResponse(requestID, name, response);
      } catch (error) {
        this.logger.error(`Unhandled IPC request: ${name}`, { requestID, error });
      }
    } else if (type === "response") {
      this.publishResponse(requestID, name, responseMessageToRaw({ ...request, name, error }));
    } else if (type === "event") {
      this.emit(request.name, request.payload);
    } else if (type === "pub") {
      this.publish(request.name, payload);
    } else if (type === "unsubscribe") {
      this.unsubscribe(requestID);
    }
  }

  /**
   * Publish a response message
   */
  publishResponse<T>(
    requestID: string,
    name: string,
    response: { error: ResponsePayload<T>; data: unknown }
  ): void {
    const { error, data } = response.error ? { error, data: null } : { error: null, data };
    const message: ResponseMessage = {
      type: "response",
      requestID,
      name,
      payload: data,
      error,
    };
    this.publisher(message);
    const handler = this._requestListener;
    this.handle({
      name,
      requestID,
      type: "event",
      payload: data,
      error: { code: 0, data: null, message: "" },
    });
  }

  /**
   * Publish an event message
   */
  publishEvent<T>(requestID: string, name: string, payload: T): void {
    const message: EventMessage = {
      type: "event",
      requestID,
      name,
      payload,
    };
    this.publisher(message);
  }

  /**
   * Publish a pub message
   */
  publish<T>(name: string, payload: T): void {
    const message: PubMessage = {
      type: "pub",
      name,
      payload,
    };
    this.publisher(message);
  }

  /**
   * Unsubscribe a listener from a channel
   */
  unsubscribe(channelID: string): void {
    const publisherChannel = this.publisher;
    publisherChannel({
      type: "unsubscribe",
      name: channelID,
      channelID: channelID,
      requestID: this._requestIDGenerator(),
    });
  }

  /**
   * Subscribe to a channel
   */
  subscribe(channelID: string): void {
    const publisherChannel = this.publisher;
    publisherChannel({
      type: "pub",
      name: channelID,
      payload: {
        registeredChannels: 1,
        channelIDs: [channelID],
      },
    });
  }

  /**
   * Handle incoming registerChannel request
   */
  private onRegisterChannel = (data: {
    channelIDs: { channelID: string; name: string }[];
    channels: { channelID: string; name: string }[];
  }): void => {
    const { channelIDs, channels } = data;
    this.logger.debug("Channels registered", { count: channelIDs.length });
    const eventPayload = {
      registeredChannels: channelIDs.length,
      channels: channels.map((c) => ({
        channelID: c.channelID,
        name: c.name,
        iconURL: c.iconURL,
        parentId: c.parentId,
      })),
    };
    this.publishEvent(
      "channelRegistry",
      "registerChannel",
      eventPayload as ChannelRegistry.RegisteredChannels
    );
  };

  /**
   * Handle incoming unregisterChannel request
   */
  private onUnregisterChannel = (data: {
    serverID: string | symbol;
    channelIDs: string[];
  }): void => {
    this.logger.debug("Channels unregistered", { serverID: data.serverID, count: data.channelIDs.length });
    const eventPayload = {
      unregisteredChannels: data.channelIDs.length,
      channelIDs: data.channelIDs,
      serverID: data.serverID,
    };
    this.publishEvent(
      "channelRegistry",
      "unregisterChannel",
      eventPayload as ChannelRegistry.UnregisteredChannels
    );
  };

  /**
   * Handle incoming addMessage request
   */
  private onAddMessage = (data: {
    messageID: string;
    channelID: string;
    senderName: string;
    content: string;
  }): void => {
    this.logger.debug("Message added", { messageID: data.messageID, channelID: data.channelID });
    const eventPayload = {
      messageID: data.messageID,
      channelID: data.channelID,
      senderName: data.senderName,
      content: data.content,
    };
    this.publishEvent(
      "messageRegistry",
      "addMessage",
      eventPayload as MessageRegistry.AddMessageParams
    );
  };

  /**
   * Handle incoming removeMessage request
   */
  private onRemoveMessage = (data: {
    messageID: string;
    channelID: string;
  }): void => {
    this.logger.debug("Message removed", { messageID: data.messageID, channelID: data.channelID });
    const eventPayload = {
      messageID: data.messageID,
      channelID: data.channelID,
    };
    this.publishEvent(
      "messageRegistry",
      "removeMessage",
      eventPayload as MessageRegistry.RemoveMessageParams
    );
  };

  /**
   * Handle incoming registerThread request
   */
  private onRegisterThread = (data: {
    serverID: string | symbol;
  }): void => {
    this.logger.debug("Thread registered", { serverID: data.serverID });
    this.publishEvent(
      "threadRegistry",
      "registerThread",
      { serverID: data.serverID } as ThreadRegistry.RegisteredThreads
    );
  };

  /**
   * Handle incoming unregisterThread request
   */
  private onUnregisterThread = (data: {
    serverID: string | symbol;
    threadIDs: string[];
  }): void => {
    this.logger.debug("Threads unregistered", { serverID: data.serverID, count: data.threadIDs.length });
    this.publishEvent(
      "threadRegistry",
      "unregisterThread",
      { serverID: data.serverID, threadIDs: data.threadIDs } as ThreadRegistry.UnregisteredThreads
    );
  };

  /**
   * Handle incoming setMessageState request
   */
  private onSetMessageState = (data: {
    messageID: string;
    channelID: string;
    state: { messageID: string; state: string }[];
  }): void => {
    this.logger.debug("Message state updated", { count: data.state.length });
    this.publishEvent(
      "messageRegistry",
      "setMessagesState",
      data.state as MessageRegistry.UpdateMessageStateParams
    );
  };

  /**
   * Handle incoming updateChannelPresence request
   */
  private onUpdateChannelPresence = (data: {
    channelID: string;
    serverID: string | symbol;
    requestMessageID: string;
    members: { id: string; presence: { status: string } }[];
  }): void => {
    this.logger.debug("Channel presence updated", { channelID: data.channelID });
    this.publishEvent(
      "presenceEventBus",
      "updateChannelPresence",
      data as { channelID: string; members: unknown; serverID: unknown }
    );
  };

  /**
   * Handle incoming setUserPresence request
   */
  private onSetUserPresence = (data: {
    userPresence: { id: string; serverID: string | symbol; status: string }[];
  }): void => {
    this.logger.debug("User presence updated", { count: data.userPresence.length });
    this.publishEvent(
      "presenceEventBus",
      "setUsersPresence",
      data.userPresence as { id: string; serverID: string | symbol; status: string }[]
    );
  };

  /**
   * Emit an event to all registered listeners
   */
  private emit<T>(name: string, payload: T): void {
    const handlers = this.listeners.get(name);
    const listeners = handlers ? [...handlers] : [];
    if (handlers) {
      this.listeners.delete(name);
    }
    for (const handler of listeners) {
      try {
        handler(payload);
      } catch (error) {
        this.logger.error(`Event listener error for "${name}":`, { error });
      }
    }
    this.listeners.set(name, new Set());
  }
}

/**
 * Response message converter
 */
function responseMessageToRaw(message: ResponseMessage): {
  name: string;
  requestID: string;
  type: "response";
  error: ResponsePayload;
  data: unknown;
} {
  return {
    name: message.name,
    requestID: message.requestID,
    type: message.type,
    error: message.error!,
    data: message.payload,
  };
}
