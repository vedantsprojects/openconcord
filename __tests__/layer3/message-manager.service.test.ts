import { MessageManagerService } from '../../src/layer3/message-manager.service';

// Mock Layer 2 modules
class MockUserRegistry implements UserRegistry {
  async getUser(userId: string): Promise<Map<string, any>> {
    return new Map<string, any>([
      ['u0001', new Map<string, any>([['name', 'Alice'], ['username', 'alice']])],
      ['u0002', new Map<string, any>([['name', 'Bob'], ['username', 'bob_the_builder']])],
    ]);
  }
  async getUserName(userId: string): Promise<string> {
    return userId === 'u0001' ? 'Alice' : 'Bob';
  }
}

class MockThreadRegistry implements ThreadRegistry {
  async getOrCreateThread(messageId: string): Promise<string> {
    return `thread-${messageId}`;
  }
}

class MockMessageRegistry implements MessageRegistry {
  private messages = new Map<string, Message>();
  private channels = new Map<string, string[]>();

  findMessages(query: string): Promise<Map<string, Message>> {
    return Promise.resolve(new Map());
  }
  getMessagesForChannel(channelId: string): Promise<Map<string, Message>> {
    return Promise.resolve(new Map());
  }
}

interface UserRegistry {
  getUser(userId: string): Promise<Map<string, any> | undefined>;
  getUserName(userId: string): Promise<string>;
}

interface ThreadRegistry {
  getOrCreateThread(messageId: string): Promise<string>;
}

interface MessageRegistry {
  findMessages(query: string): Promise<Map<string, Message>>;
  getMessagesForChannel(channelId: string): Promise<Map<string, Message>>;
}

describe('MessageManagerService', () => {
  it('should compose and format a plain text message', async () => {
    const messages = new Map<string, Message>([
      ['m001', new Message({ id: 'm001', channelId: 'c001', authorId: 'u0001', content: 'Hello, world!', timestamp: 1000000, timestampMs: 1000000 })],
    ]);
    const mockRegistry = new MockMessageRegistry();
    mockRegistry.messages = messages;
    mockRegistry.channels.set('c001', ['m001']);

    const messageManager = new MessageManagerService(
      new MockUserRegistry(),
      new MockThreadRegistry(),
      mockRegistry,
    );

    const result = await messageManager.formatMessage('u0001', 'c001', 'Hello, world!');
    expect(result).toBeDefined();
    expect(result.content).toContain('Hello, world!');
    expect(typeof result.id).toBe('string');
  });

  it('should format mentions in a message', async () => {
    const mockRegistry = new MockMessageRegistry();
    const messageManager = new MessageManagerService(
      new MockUserRegistry(),
      new MockThreadRegistry(),
      mockRegistry,
    );

    const result = await messageManager.formatMessage('u0001', 'c001', 'Hi @Alice and @Bob!');
    expect(result).toBeDefined();
    if (result.type === 'rich_text') {
      expect(result.content.size).toBeGreaterThan(0);
    }
  });

  it('should handle hashtags in messages', async () => {
    const mockRegistry = new MockMessageRegistry();
    const messageManager = new MessageManagerService(
      new MockUserRegistry(),
      new MockThreadRegistry(),
      mockRegistry,
    );

    const result = await messageManager.formatMessage('u0001', 'c001', 'Check out #reactjs and #javascript!');
    expect(result).toBeDefined();
    if (result.type === 'rich_text') {
      expect(result.content.size).toBeGreaterThan(0);
    }
  });

  it('should split a message that exceeds the maximum length', async () => {
    const longMessage = 'a'.repeat(5000);
    const mockRegistry = new MockMessageRegistry();
    const messageManager = new MessageManagerService(
      new MockUserRegistry(),
      new MockThreadRegistry(),
      mockRegistry,
    );

    const results = await messageManager.sendSplit('u0001', 'c001', longMessage);
    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(1);
  });

  it('should handle inline code blocks', async () => {
    const mockRegistry = new MockMessageRegistry();
    const messageManager = new MessageManagerService(
      new MockUserRegistry(),
      new MockThreadRegistry(),
      mockRegistry,
    );

    const result = await messageManager.formatMessage('u0001', 'c001', 'Use `const x = 42` for declarations');
    expect(result).toBeDefined();
  });

  it('should apply bold and italic formatting', async () => {
    const mockRegistry = new MockMessageRegistry();
    const messageManager = new MessageManagerService(
      new MockUserRegistry(),
      new MockThreadRegistry(),
      mockRegistry,
    );

    const result = await messageManager.formatMessage('u0001', 'c001', '**Bold** and *italic* text');
    expect(result).toBeDefined();
  });

  it('should generate a unique ephemeral ID for each message', async () => {
    const mockRegistry = new MockMessageRegistry();
    const messageManager = new MessageManagerService(
      new MockUserRegistry(),
      new MockThreadRegistry(),
      mockRegistry,
    );

    const msg1 = await messageManager.formatMessage('u0001', 'c001', 'Message 1');
    const msg2 = await messageManager.formatMessage('u0001', 'c001', 'Message 2');

    expect(msg1.id).not.toEqual(msg2.id);
    expect(msg1.id).toMatch(/^m[0-9]+-[a-f0-9]+$/);
  });

  it('should handle messages with attachments', async () => {
    const mockRegistry = new MockMessageRegistry();
    const messageManager = new MessageManagerService(
      new MockUserRegistry(),
      new MockThreadRegistry(),
      mockRegistry,
    );

    const result = await messageManager.formatMessage('u0001', 'c001', 'Check the attachment', {
      attachments: {
        '1': { filePath: '/path/to/file.txt', filename: 'file.txt', size: 1234 },
      },
    });
    expect(result).toBeDefined();
  });

  it('should handle empty messages gracefully', async () => {
    const mockRegistry = new MockMessageRegistry();
    const messageManager = new MessageManagerService(
      new MockUserRegistry(),
      new MockThreadRegistry(),
      mockRegistry,
    );

    const result = await messageManager.formatMessage('u0001', 'c001', '');
    expect(result).toBeDefined();
  });
});