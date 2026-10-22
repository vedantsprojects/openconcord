/**
 * Mock Messaging Service — Layer 3
 *
 * Implements the full messaging workflow end-to-end:
 * 1. Receive rendered HTML from the UI
 * 2. Normalize to Markdown
 * 3. Build rich-text wire format
 * 4. Cache results in InMemoryStore
 *
 * Uses mocked Layer 2 modules to avoid dependency on real IPC/IPC Bridge.
 */

import { MessageManagerService } from './message-manager.service';
import type { AppStore } from '../core/store';

// Mock Layer 2 implementations
import type { MessageRegistry, ChannelRegistry, UserRegistry } from '../core/app.module';

class InMemoryMockMessageRegistry implements MessageRegistry {
  store?: AppStore;
  private messages = new Map<string, any>();
  private channels = new Map<string, string[]>();

  findMessages(_: string) { return new Map(); }
  setMessages(_: Map<string, any>) { this.messages.clear(); }
  setChannelToMessages(channelId: string, msgs: Map<string, any>) {
    this.messages.set(channelId, new Map(msgs));
  }
  getMessagesForChannel(channelId: string) {
    return this.messages.get(channelId) || new Map();
  }
  updateMessage(_: string, _msg: any) {}
}

export class MockMessagingService {
  private readonly messageRegistry: InMemoryMockMessageRegistry;

  constructor(messageRegistry: InMemoryMockMessageRegistry) {
    this.messageRegistry = messageRegistry;
  }

  public setStore(store?: AppStore) {
    this.messageRegistry.store = store;
  }

  public getMessagesForChannel(channelId: string) {
    return this.messageRegistry.getMessagesForChannel(channelId);
  }

  public registerChannel(channelId: string, msgIds: string[]) {
    this.messageRegistry.channels.set(channelId, msgIds);
  }
}
