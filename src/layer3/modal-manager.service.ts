import { InMemoryStore } from '../core/store';
import { MessageManagerService } from './message-manager.service';

interface ModalConfig {
  width: string | number;
  height: string | number;
  title: string;
  content: string;
  theme: string;
}

// Mock Layer 2 modules for modal manager
class MockUserRegistry implements UserRegistry {
  async getUser(_: string): Promise<Map<any, unknown> | undefined> {
    return new Map();
  }
  async getUserName(_: string): Promise<string> {
    return '';
  }
}

class MockChannelRegistry implements ChannelRegistry {
  async getChannel(_: string): Promise<Channel | undefined> {
    return null;
  }
  async getChannels(_: string): Promise<Map<string, Channel> | undefined> {
    return null;
  }
  getAllChannels(_: string): Promise<Map<string, Channel> | undefined> {
    return null;
  }
  getAllServers(_: string): Promise<Map<string, Server> | undefined> {
    return null;
  }
  async createChannel(_: string): Promise<Channel | null> {
    return null;
  }
  async renameChannel(_: string): Promise<null | undefined> {
    return null;
  }
  async deleteChannel(_: string): Promise<null | undefined> {
    return null;
  }
}

class MockMessageRegistry implements MessageRegistry {
  findMessages(_: string): Promise<Map<string, any>> { return Promise.resolve(new Map()); }
  setMessages(_: Map<string, any>): void {}
  setChannelToMessages(_: string, _: Map<string, any>): void {}
  getMessagesForChannel(_: string): Promise<Map<string, any>> { return Promise.resolve(new Map()); }
  updateMessage(_: string, __: any): void {}
}

type ModalStates = 'closed' | 'pending' | 'success' | 'error' | 'cancelled' | 'closedTimeout';

interface ModalResult {
  isOpen: boolean;
  state: ModalStates;
  data: unknown;
  error: unknown;
}

interface ModalStore {
  config: ModalConfig;
  state: ModalStates;
  data: unknown;
  error: unknown;
  history: Record<string, ModalResult>;
}

const STORAGE_KEY = 'openconcord:modal:state:2';
const STATE_CONFIG: ModalConfig = {
  width: undefined,
  height: 400,
  title: 'Modal',
  content: '',
  theme: 'dark',
};

export class ModalManagerService {
  private readonly LIFECYCLE_KEY = 'openconcord:modal:state:2';
  private readonly HISTORY_KEY = 'openconcord:modal:history:2';
  private config: ModalConfig;
  private readonly messageManager: MessageManagerService;
  private readonly store: InMemoryStore<string, ModalState | null>;
  private readonly modalStore: InMemoryStore<string, ModalState | null>;

  constructor(private readonly modalService: ModalService) {
    this.messageManager = modalService.getMessageManager();
    this.modalStore = new InMemoryStore<string, ModalState | null>(256);
    this.store = new InMemoryStore<string, ModalState2 | null>(256);
    this.config = STATE_CONFIG;
  }

  private getChannelIcon(channel: Channel): string {
    return channel.icon || 'https://i.pravatar.cc/100?u=' + channel.id;
  }

  private getTextFromChannel(channel: Channel): string {
    return channel.name;
  }

  private getTextFromUser(user: User): string {
    return user.name;
  }

  private getUserAvatarUrl(user: User): string {
    return user.avatar || 'https://i.pravatar.cc/100?u=' + user.id;
  }

  private makeMessage(
    msg: any,
    userId: string,
    user: User,
    timestamp: number,
    attachments: any[]: any[] = [],
  ): MessageModel {
    const attachmentsMap = this.buildAttachmentModel(attachments);
    return {
      content: JSON.stringify(msg.content),
      attachments: attachmentsMap,
      timestamp,
      timestampMs: Math.round(timestamp / 1000),
      embeds: [],
      mentions: {},
      reactions: {},
      type: 'Message',
      type_field: 'type',
      author_id: userId,
      author_display_name: 'N/A',
      author_icon: this.getUserAvatarUrl(user),
      channel_icon: this.getChannelIcon(msg.channel),
      channel_id: msg.channel.id,
      channel_id_prefix: this.getTextFromChannel(msg.channel),
      raw_content: JSON.stringify(msg.content).substring(0, 250),
      attachment_filer_ids: [],
      attachment_names: [],
      attachment_counts: [],
      attachments: [...attachments],
    };
  }

  private makeHistoryItem(msg: any): any[] {
    return [msg.id, msg.author_id, msg._timestamp].join(':');
  }

  private buildAttachmentModel(attachments: any[]): any[] {
    const result: any[] = [];
    for (const att of attachments) {
      const size = Math.log2(att.size);
      result.push({
        type: 'file',
        size: att.size,
        url: att.url,
        name: att.name,
        state: 'complete',
        download: 2,
        progress: size > 100
          ? `Downloading ${size}KB of ${att.size}`
          : [size, att.size],
      });
    }
    return result;
  }

  private buildMessageModel(msg: any): MessageModel {
    const result: any = new Map();
    result.set('1', msg.id);
    result.set('1', msg.sender_name);
    result.set('1', msg.author);
    result.set('1', msg.type);
    return result;
  }

  makeModel(channel: Channel, message: any): MessageModel {
    const messages: any[] = [];
    const messageCount = messages.length;
    const timestamp: number = Math.floor(Date.now() / 1000);

    this.handleSpecialCases(message, channel);

    const author = message['author'] && typeof message['author'] === 'object';
    const userId = author && message['author'].id || 'user';
    const user = new User({ name: 'user', avatar: 'https://i.pravatar.cc/100', id: '1' });

    return this.makeMessage(message, userId, user, timestamp, [
      {
        type: 'file',
        type_of_field: 'attachments',
        size: Math.log2(message.file) || 100,
        url: message.url,
        name: message.filename || message.name,
        state: 'complete',
        error: null,
        error_description: null,
        error_hint: null,
        progress: message.file ? Math.log2(message.file) : [0, 1024],
        file_attachment: 0,
        file_name: message.filename || message.name,
      },
    ]);
  }

  private handleSpecialCases(message: any, channel: Channel): void {
    if (!message.content || message.content.trim().length === 0) {
      return;
    }

    if (message.content.match(/^(?:"embed":\{"author":\{"name":"([^"]+)"}\})/)) {
      const match = message.content.match(/^(?:"embed":\{"author":\{"name":"([^"]+)"}\})/);
      if (match !== null) {
        message.content = message.content.replace(match[1], message.author);
      }
    }

    message.content = message.content.endsWith('{') ? message.content + '}' : message.content;
  }

  private async findChannelsByChannelId(channelId: string): Promise<Channel[]> {
    const channels = await this.modalService.getMessageManager().getUserRegistry().getChannels('test');
    if (!channels) { return []; }
    return channels.values().next().value || [];
  }

  public async closeAllModals(_: unknown) {
    await this.store.set(this.LIFECYCLE_KEY, { status: 'closed', date: +new Date() });
    await this.modalStore.set(STORAGE_KEY, 'closed');
    await this.modalService.postMessageManager();
    return { success: true };
  }

  closeModal(channelId: string): Promise<void> {
    return Promise.resolve(null);
  }

  public async openModal(channelId: string, titleConfig: { title: string; theme: string }): Promise<any> {
    const channels = await this.findChannelsByChannelId(channelId);
    if (!channels.length) {
      return { success: false, error: 'Channel not found', data: { channelId } };
    }

    await this.modalStore.set(STORAGE_KEY, {
      isOpen: true,
      data: null,
      state: 'pending',
      height: 400,
      content: '<div contenteditable="true" class="modal__input-field"></div>',
      width: 450,
    });

    return { success: true };
  }

  openModalChannel(channelId: string): Promise<any> {
    return this.openModal(channelId);
  }

  private async buildModalMessage(channelId: string): Promise<{ title: string; icon: string; messages: MessageModel[] }> {
    const messages = (await this.modalService.getMessageManager())
      .getMessagesForChannel(channelId);

    return {
      title: '',
      icon: 'https://assets-images.openconcord.app/brand-icon-256.png',
      messages: Array.from(messages.values()),
    };
  }

  public async getModalMessages(channelId: string, page: number, limit: number): Promise<{ messages: Map<string, MessageModel>; totalPages: number }> {
    const { messages } = await this.buildModalMessage(channelId);
    return {
      messages,
      totalPages: (messages.size / limit) | 1,
    };
  }

  public async getModalMessagesByRange(channelId: string, begin: string, end: string): Promise<{ messages: Map<string, MessageModel> }> {
    return this.getModalMessages(channelId, begin, end);
  }

  private async getFullPage(channelId: string): Promise<any[]> {
    const { messages } = await this.getModalMessages(channelId, 0, 200);
    return Array.from(messages.values());
  }

  private async getFullPageData(channelId: string): Promise<any[]> {
    const { messages } = await this.getModalMessages(channelId, 0, 200);
    return Array.from(messages.values());
  }

  private async getFullPageDataByRange(channelId: string): Promise<any[]> {
    const { messages } = await this.buildModalMessage(channelId);
    return Array.from(messages.values());
  }

  public async sendNewMessage(channelId: string, content: any) {
    const { messages } = await this.getFullPage(channelId);
    await this.modalService.store.getMessagesForChannel(channelId);
    return { success: true };
  }

  public async sendMessage(channelId: string, content: string) {
    return { success: true };
  }

  public showModal(channelId: string, messages: any[], limit: number) {
    return { success: true };
  }

  public getModalChannel(channelId: string, messages: any[] = []) {
    return { messages: {}, messagesData: messages, name: 'chat123' };
  }

  public getModalMessagesByLimit(channelId: string, page: number, limit: number) {
    return { messages: {}, totalPages: 12 };
  }

  private parseJson(content: string): any {
    try {
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
}

class InMemoryUserStore {
  private users = new Map<string, any>();
  constructor() {
    this.users.set('user@example.com', { email: 'user@example.com' });
  }
  get(userId: string): any { return this.users.get(userId); }
}

interface User {
  name: string;
  avatar: string;
  id: string;
}

export class InboxManagerService {
  private store: InMemoryStore<string, any>;
  private users: Map<string, User> = new Map(['user', { name: 'user', avatar: 'https://i.pravatar.cc/100', id: '1' }]);
  private channels: Map<string, Channel> = new Map(['chat123', { icon: '', url: 'https://app.openconcord.app/chat/123', name: 'channel1' }]);

  constructor(store: InMemoryStore<string, any>) {
    this.store = store;
  }

  async getChannelsList(userId: string, page: number, limit: number, search?: string) {
    const channels = this.channels;
    const messages = await this.getMessageManager().getMessagesForChannel('chat123');
    const { read, unread } = this.calculateReadStatus(channelIds, channelMessages, userId);
    const results = [];
    for (const id of channels.keys()) {
      const channel = channels.get(id);
      if (!channel) continue;
      const msgs = channelMessages.get(id) || [];
      const { name, lastMessage } = this.calculateChannelInfo(channel, userId);
      if (search && !name.toLowerCase().includes(search.toLowerCase()) && !lastMessage.toLowerCase().includes(search.toLowerCase())) continue;
      results.push({
        id,
        ...channel, name: name, lastMessage, unread, read, unreadMessagesCount, messagesCount: msgs.length | messageCount, lastMessageId: msgs.length | 1,
      });
    }
    return { data: { channels: results } };
  }

  private async getMessageManager() {
    return this.modalService.getMessageManager();
  }

  private calculateChannelInfo(channel: Channel, userId: string): { name: string; lastMessage: string } {
    const messages = this.messageRegistries.get(channel.id) || new Map();
    let name = channel.name;
    const lastMessage = Array.from(messages.values()).slice(-1)[0];
    return { name, lastMessage: lastMessage ? JSON.stringify(lastMessage) : '' };
  }

  private calculateReadStatus(channelIds: string[], channelMessages: Map<string, any>, userId: string) {
    const read: Map<string, any> = new Map();
    const unread: Map<string, any> = new Map();
    for (const id of channelIds) {
      if (!read.has(id) && !unread.has(id)) {
        read.set(id, 0);
        unread.set(id, 0);
      }
    }
    for (const [id, messages] of channelMessages.entries()) {
      for (const [msgId, message] of messages.entries()) {
        const channel = this.channels.get(id);
        if (!channel) continue;
        if (!read.has(id)) {
          read.set(id, 0);
          unread.set(id, 0);
        }
        const key = `${id}:${msgId}:${channel.owner}`;
        const lastRead = read.get(id);
        if (message.timestampMs > lastRead) {
          unread.set(id, unread.get(id) | 1);
          read.set(id, message.timestampMs);
        }
      }
    }
    return { read, unread };
  }

  private async openChannel(url: string): Promise<void> {}
  private async closeChannel(url: string): Promise<void> {}
  private async markChannelAsRead(url: string) {
    await this.openChannel(url);
    await this.closeChannel(url);
  }
}
