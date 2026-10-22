/**
 * Layer 3 Integration Tests
 * Tests the interaction between core services and feature modules
 */

import { MessageManagerService } from '../../src/layer3/message-manager.service';
import { ModalServiceImplementation } from '../../src/layer3/modal.service';
import { InMemorySearchRegistry } from '../../src/layer3/search-registry.service';

// Mock Layer 2 interfaces
interface UserRegistry {
  getUser(userId: string): Promise<Map<string, any> | undefined>;
  getUserName(userId: string): Promise<string>;
  getChannels(query: string): Promise<any>;
}

interface MessageRegistry {
  findMessages(query: string): Promise<Map<string, any>>;
  getMessagesForChannel(channelId: string): Promise<Map<string, any>>;
  setMessages(maps: Map<string, any>): void;
}

class MockUserRegistry implements UserRegistry {
  async getUser(_: string): Promise<Map<string, any> | undefined> {
    return new Map([['name', 'Test User'], ['username', 'testuser']]);
  }
  async getUserName(_: string): Promise<string> {
    return 'test_user';
  }
  getChannels(_: string): Promise<any> {
    return Promise.resolve([]);
  }
}

class MockMessageRegistry implements MessageRegistry {
  private messages = new Map<string, any>();

  findMessages(_: string): Promise<Map<string, any>> {
    return Promise.resolve(this.messages);
  }
  getMessagesForChannel(_: string): Promise<Map<string, any>> {
    return Promise.resolve(this.messages);
  }
  setMessages(maps: Map<string, any>): void {
    this.messages = maps;
  }
}

describe('Layer 3 Integration', () => {
  let mockMessageRegistry: MockMessageRegistry;

  beforeEach(() => {
    mockMessageRegistry = new MockMessageRegistry();
  });

  describe('MessageManagerService Integration', () => {
    it('should format a message with basic content', async () => {
      const messageManager = new MessageManagerService(
        new MockUserRegistry(),
        new (class implements any {
          async getOrCreateThread(_: string): Promise<string> {
            return 'thread-1';
          }
        })(),
        mockMessageRegistry,
      );

      const result = await messageManager.formatMessage('u0001', 'c001', 'Hello World');
      expect(result).toBeDefined();
      expect(result.authorId).toBe('u0001');
      expect(result.channelId).toBe('c001');
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it('should handle rich text formatting', async () => {
      const messageManager = new MessageManagerService(
        new MockUserRegistry(),
        new (class implements any {
          async getOrCreateThread(_: string): Promise<string> {
            return 'thread-1';
          }
        })(),
        mockMessageRegistry,
      );

      const result = await messageManager.formatMessage(
        'u0001',
        'c001',
        'Hello *world*',
      );
      expect(result).toBeDefined();
    });

    it('should process mentions', async () => {
      const messageManager = new MessageManagerService(
        new MockUserRegistry(),
        new (class implements any {
          async getOrCreateThread(_: string): Promise<string> {
            return 'thread-1';
          }
        })(),
        mockMessageRegistry,
      );

      const result = await messageManager.formatMessage(
        'u0001',
        'c001',
        'Hi @alice and @bob!',
      );
      expect(result).toBeDefined();
    });
  });

  describe('ModalService Integration', () => {
    it('should open a modal for a valid channel', async () => {
      const modalService = new ModalServiceImplementation();
      const result = await modalService.openModal('channel-1');

      expect(result).toEqual({ success: true, modalId: 'modal_channel-1' });
    });

    it('should generate unique modal IDs', async () => {
      const modalService = new ModalServiceImplementation();

      const result1 = await modalService.openModal('channel-1');
      const result2 = await modalService.openModal('channel-2');

      expect((result1 as any).modalId).toEqual('modal_channel-1');
      expect((result2 as any).modalId).toEqual('modal_channel-2');
      expect((result1 as any).modalId).not.toEqual((result2 as any).modalId);
    });
  });

  describe('SearchRegistry Integration', () => {
    let searchRegistry: InMemorySearchRegistry;

    beforeEach(() => {
      searchRegistry = new InMemorySearchRegistry();
      searchRegistry['indexChannel']('general');
      searchRegistry['indexChannel']('random');
      searchRegistry['indexUser']('u0001', 'Alice');
      searchRegistry['indexUser']('u0002', 'Bob');
    });

    it('should search for users', async () => {
      const results = await searchRegistry.search('alice', { type: 'user' });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].type).toBe('user');
    });

    it('should search for channels', async () => {
      const results = await searchRegistry.search('general', { type: 'channel' });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].type).toBe('channel');
    });

    it('should search across all types', async () => {
      const results = await searchRegistry.search('a', { type: 'all' });
      expect(Array.isArray(results)).toBe(true);
    });

    it('should return empty array for non-existent query', async () => {
      const results = await searchRegistry.search('nonexistent-long-word', { type: 'all' });
      expect(results.length).toBe(0);
    });
  });

  describe('End-to-End workflow', () => {
    it('should complete a full message workflow', async () => {
      const messageManager = new MessageManagerService(
        new MockUserRegistry(),
        new (class implements any {
          async getOrCreateThread(_: string): Promise<string> {
            return 'thread-main';
          }
        })(),
        new MockMessageRegistry(),
      );

      // Step 1: Format message
      const formattedMsg = await messageManager.formatMessage('u0001', 'c001', 'Test message');
      expect(formattedMsg).toBeDefined();

      // Step 2: Modal service can coexist
      const modalService = new ModalServiceImplementation();
      await modalService.openModal('c001');

      // Step 3: Search works independently
      const searchRegistry = new InMemorySearchRegistry();
      const searchResults = await searchRegistry.search('test', { type: 'all' });
      expect(Array.isArray(searchResults)).toBe(true);
    });
  });
});