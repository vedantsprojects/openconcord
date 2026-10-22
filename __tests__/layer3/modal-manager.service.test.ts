/**
 * ModalManagerService Tests
 */

// Mock interfaces
interface UserRegistry {
  getUser(userId: string): Promise<Map<string, any> | undefined>;
  getUserName(userId: string): Promise<string>;
  getChannels(query: string): Promise<any>;
}

interface ThreadRegistry {
  getOrCreateThread(messageId: string): Promise<string>;
}

interface MessageRegistry {
  findMessages(query: string): Promise<Map<string, any>>;
  getMessagesForChannel(channelId: string): Promise<Map<string, any>>;
  setMessages(maps: Map<string, any>): void;
}

import { MessageManagerService } from '../../src/layer3/message-manager.service';
import { ModalServiceImplementation } from '../../src/layer3/modal.service';

class MockUserRegistry implements UserRegistry {
  async getUser(_: string): Promise<Map<string, any> | undefined> {
    return new Map([['name', 'Test User'], ['username', 'testuser']]);
  }
  async getUserName(_: string): Promise<string> {
    return 'test_user';
  }
  getChannels(_: string): Promise<any> {
    return Promise.resolve({});
  }
}

class MockThreadRegistry implements ThreadRegistry {
  async getOrCreateThread(_: string): Promise<string> {
    return 'thread-main';
  }
}

class MockMessageRegistry implements MessageRegistry {
  async findMessages(_: string): Promise<Map<string, any>> {
    return new Map();
  }
  async getMessagesForChannel(_: string): Promise<Map<string, any>> {
    return new Map();
  }
  setMessages(_: Map<string, any>): void {}
}

describe('ModalManagerService', () => {
  let messageManager: MessageManagerService;

  beforeEach(() => {
    messageManager = new MessageManagerService(
      new MockUserRegistry(),
      new MockThreadRegistry(),
      new MockMessageRegistry(),
    );
  });

  describe('formatMessage public API', () => {
    it('should format a plain text message', async () => {
      const result = await messageManager.formatMessage('u0001', 'c001', 'Hello world');
      expect(result).toBeDefined();
      expect(result.authorId).toBe('u0001');
    });

    it('should handle markdown-style bold', async () => {
      const result = await messageManager.formatMessage(
        'u0001',
        'c001',
        'This is **bold** text',
      );
      expect(result).toBeDefined();
    });

    it('should handle markdown-style italics', async () => {
      const result = await messageManager.formatMessage(
        'u0001',
        'c001',
        'This is *italic* text',
      );
      expect(result).toBeDefined();
    });
  });
});