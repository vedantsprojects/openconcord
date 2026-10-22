import { Message } from '../core/interface';
import type { MessageRegistry, UserRegistry, ThreadRegistry } from '../core/app.module';
import { v4 as uuid } from 'uuid';
import type * as fs from 'fs';

// Mock Layer 2 modules for unit testing
interface MockMessageRegistry {
  findMessages(query: string): Promise<Map<string, Message>>;
  getMessagesForChannel(channelId: string): Promise<Map<string, Message>>;
}

interface MockUserRegistry {
  getUser(userId: string): Promise<Map<string, any> | undefined>;
  getUserName(userId: string): Promise<string>;
}

interface MockThreadRegistry {
  getOrCreateThread(messageId: string): Promise<string>;
}

/**
 * Service to manage message lifecycle:
 * - compose, format, and send messages
 * - format with channel prefixes, rich text, inline code, bold/italics
 * - auto-generate ephemeral IDs
 */

/** Formatted message ready for wire. */
interface FormattedMessage {
  id: string;
  channelId: string;
  authorId: string;
  content: string | Map<string, string>; // plain or rich-text Map
  timestamp: number;
  timestampMs: number;
  type: MessageTypes;
  mentions: Map<string, UserMention>;
  attachments?: Map<string, { filePath: string; filename: string; size: number }>;
}

interface UserMention {
  userId: string;
  name: string;
}

type MentionType = 'mention' | 'hashtag' | 'username';

interface MessageFormatOptions {
  mentionIds?: string[];
  hashtags?: string[];
  inlines?: { [key: string]: string }[];
  bold?: string | string[];
  italics?: string | string[];
  attachments?: { [key: string]: { filePath: string; filename: string; size: number } };
  channelId?: string;
}

type MessageTypes = 'text' | 'rich_text' | 'embed' | 'reaction' | 'typing' | 'system';

class InMemoryUserStore {
  private users = new Map<string, Map<string, any>>();

  constructor() {
    this.users.set('u0001', new Map({
      id: 'u0001', name: 'alice', username: 'alice', display: 'Alice',
      avatar: 'https://cdn.openconcord.app/avatars/u/1', bot: false,
    }));
    this.users.set('u0002', new Map({
      id: 'u0002', name: 'bob', username: 'bob_the_builder', display: 'Bob',
      avatar: 'https://cdn.openconcord.app/avatars/u/2', bot: false,
    }));
  }

  get(userId: string): Map<string, any> | undefined {
    return this.users.get(userId);
  }

  getUserName(userId: string): string | undefined {
    return this.users.get(userId)?.get('username') || this.users.get(userId)?.get('name');
  }
}

class MockUserRegistryImpl implements MockUserRegistry {
  private store = new InMemoryUserStore();

  getUser(userId: string): Promise<Map<string, any> | undefined> {
    return Promise.resolve(this.store.get(userId));
  }

  getUserName(userId: string): Promise<string> {
    return Promise.resolve(this.store.getUserName(userId) || `User ${userId}`);
  }
}

class MockThreadRegistryImpl implements MockThreadRegistry {
  private threads = new Map<string, Map<string, unknown>>();
  private nextId = 0;

  getOrCreateThread(messageId: string): Promise<string> {
    const threadId = `thread-${messageId}-${this.nextId++}`;
    if (!this.threads.has(threadId)) {
      this.threads.set(threadId, new Map({ id: threadId, type: 'message' }));
    }
    return Promise.resolve(threadId);
  }
}

class MockMessageRegistryImpl implements MockMessageRegistry {
  private messages = new Map<string, Message>();
  private channels = new Map<string, string[]>();

  public addMessage(msg: Message): void {
    this.messages.set(msg.id, msg);
  }

  public addChannel(channelId: string, msgIds: string[]): void {
    this.channels.set(channelId, msgIds);
  }

  findMessages(query: string): Promise<Map<string, Message>> {
    const hits = new Map<string, Message>();
    for (const [id, msg] of this.messages) {
      if (query === '?' || msg.content.toLowerCase().includes(query) || msg.id.toLowerCase().includes(query)) {
        hits.set(id, msg);
      }
    }
    return Promise.resolve(hits.size > 0 ? hits : new Map());
  }

  getMessagesForChannel(channelId: string): Promise<Map<string, Message>> {
    const msgs = new Map<string, Message>();
    for (const msgId of this.channels.get(channelId) || []) {
      const msg = this.messages.get(msgId);
      if (msg) msgs.set(msgId, msg);
    }
    return Promise.resolve(msgs);
  }
}

/**
 * MessageManagerService
 *
 * Provides:
 * - Compose, enrich, and format messages
 * - Mentions, hashtags, inline code
 * - Rich-text formatting
 * - Attachments, ephemeral IDs
 */
export class MessageManagerService {
  private static readonly MAX_MESSAGE_LENGTH = 4096;
  private static readonly MAX_EMBED_LENGTH = 4096;

  // Mock Layer 2 registry interfaces
  private readonly userRegistry: MockUserRegistry;
  private readonly threadRegistry: MockThreadRegistry;
  private readonly messageRegistry: MockMessageRegistry;

  constructor(
    userRegistry: MockUserRegistry,
    threadRegistry: MockThreadRegistry,
    messageRegistry: MockMessageRegistry,
  ) {
    this.userRegistry = userRegistry;
    this.threadRegistry = threadRegistry;
    this.messageRegistry = messageRegistry;
  }

  /** Compose and format a message with full formatting. */
  async formatMessage(
    userId: string,
    channelId: string,
    plainText: string,
    options: MessageFormatOptions = {},
  ): Promise<FormattedMessage> {
    return this._formatMessage(userId, channelId, plainText, options);
  }

  /**
   * Auto-split a message that exceeds MAX_MESSAGE_LENGTH into multiple messages.
   * Each line after the max-length line starts a new message.
   * Trailing punctuation and spaces are stripped from the last message.
   */
  async sendSplit(
    userId: string,
    channelId: string,
    plainText: string,
    options?: MessageFormatOptions,
  ): Promise<FormattedMessage[]> {
    const limit = this.MAX_MESSAGE_LENGTH;
    const lines = plainText.split(/\r?\n/);

    if (lines.length === 1 && plainText.length <= limit) {
      return await this._formatAndSend(userId, channelId, plainText, options);
    }

    const splitMessages: FormattedMessage[] = [];
    let currentChunk: string[] = [];
    let currentLength = 0;
    let lineNum = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      const len = trimmed.length;

      if (currentLength + len > limit) {
        // Emit current chunk
        const trimmedChunk = currentChunk.join('\n').trim();
        const formatted = await this._formatAndSend(userId, channelId, trimmedChunk, {});
        splitMessages.push(formatted);

        // Emit current line as new message
        const lineFormatted = await this._formatAndSend(userId, channelId, trimmed, {});
        splitMessages.push(lineFormatted);

        currentChunk = [];
        currentLength = 0;
      }

      currentChunk.push(trimmed);
      currentLength += len + 1;
      lineNum++;
    }

    // Emit any remaining lines
    if (currentChunk.length > 0) {
      const trimmedChunk = currentChunk.join('\n').trim();
      const formatted = await this._formatAndSend(userId, channelId, trimmedChunk, {});
      splitMessages.push(formatted);
    }

    return splitMessages;
  }

  /** Internal: format text and send to registry. */
  private async _formatAndSend(
    userId: string,
    channelId: string,
    text: string,
    options: MessageFormatOptions,
  ): Promise<FormattedMessage> {
    return this._formatMessage(userId, channelId, text, options);
  }

  /**
   * Format text with mentions, hashtags, inlines, bold/italics.
   * Produces a Map<string, string> for rich-text wire format.
   */
  private async _formatMessage(
    userId: string,
    channelId: string,
    text: string,
    options: MessageFormatOptions,
  ): Promise<FormattedMessage> {
    // Build mentions
    const mentions = new Map<string, UserMention>();
    const mentionRegex = /\B@(\w+)(?:(?:#|-|\d+))?\b/g;
    let match: RegExpExecArray | null;

    while ((match = mentionRegex.exec(text))) {
      const name = match[1];
      const uId = `u${String((parseInt(name.replace(/\D/g, ''), 10) || 1)) + 400}`;
      const userResult = await this.userRegistry.getUser(uId);
      const user = userResult as any;

      if (user) {
        mentions.set(uId, { userId: uId, name: user.get('name') || user.get('username') });
      }
    }

    // Tag hashtags: inline formatting
    if (options.hashtags) {
      for (const tag of options.hashtags) {
        const regex = new RegExp(`\\B#${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');

        text = text.replace(regex, (full) => {
          const hasHash = full.startsWith('#');
          const tagPart = hasHash ? full.substring(1) : full;
          const color = '#36bcfc';
          const highlight = `{"hashtag": { "content": "${tagPart || ''}", "color": ${color}, "italic": true, "underline": true }}`;
          return hasHash ? (full[0] as unknown as string) + highlight : highlight;
        });
      }
    }

    const inlineKeys = new Map<string, string>();

    // Inline code blocks (markdown-style)
    const codeInlineRegex = /\`\`\`([^`]+)\`\`\`/g;
    let codeMatch: RegExpExecArray | null;

    while ((codeMatch = codeInlineRegex.exec(text))) {
      const inner = codeMatch[1]; // inner markdown code
      // Simple: convert backticks to inline code
      text = text.replace(`\`${inner}\``, `{"inline_code": { "content": "${inner}" }}`);
      const placeholder = `__INLINE_CODE_${inlineKeys.size}__`;
      inlineKeys.set(placeholder, `{"inline_code": { "content": "${inner}" }}`);

      text = text.replace(`__INLINE_CODE_${inlineKeys.size - 1}__`, placeholder);
    }

    // Apply monospace bold to internal placeholder
    for (const [key, val] of inlineKeys) {
      text = text.replace(val, `monospace {${val}}`);
    }

    // Remove monospace wrapping from text
    text = text.replace(/monospace \{(.+?)\}/g, '$1');

    // Apply internal formatting
    text = text.replace(/\*\*(.*?)\*\*/g, 'bold {"bold": {"content": "$1"}}');
    text = text.replace(/\*(.*?)\*/g, 'italics {"italics": {"content": "$1"}}');
    text = text.replace(/~~(.*?)~~/g, 'strikethrough {"strikethrough": {"content": "$1"}}');
    text = text.replace(/`(.+?)`/g, 'italic {"italic": {"content": "$1"}}');

    // Apply mentions
    for (const [userId, user] of mentions) {
      const prefix = '@' + user.name;
      const placeholder = `__MENTION_${user.userId}__`;
      const mentionHtml = `{"embed": {"author": { "name": "${user.name}" }, "color": "#f58c76"}}`;
      text = text.replace(new RegExp(`\\B${user.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), placeholder + mentionHtml);
    }

    // Auto-generate ephemeral ID
    const id = uuid().substring(0, 8);

    // Build JSON-stringified rich-text
    const richTextContent = JSON.stringify({ rich_text: text }) + `{"author_id": "${id}"}`;

    const msgContent = options.attachments && Object.keys(options.attachments).length > 0
      ? JSON.stringify({ attachments: Object.keys(options.attachments).map((k) => ({
          name: options.attachments[k].filename,
          attributes: {
            type: 'document',
            size: options.attachments[k].size,
            url: 'data:image/svg+xml;charset=utf-8;base64,PHN2ZyB3aWR0aD0iMjUiIGhlaWdodD0iMjUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIHN0cm9rZT0iI2ZmZiIHN0cm9rZS13aWR0aD0iMSIvPjwvc3ZnPg==',
          },
        }))})
      : richTextContent;

    // Build the message model
    const model = this._buildModel({
      formatType: 'Message',
      content: msgContent,
      channelId,
      channelIdField: 'channel_id',
      authorId: userId,
      channelIcon: options.channelIcon,
      channelIdPrefix: options.channelIdPrefix,
      timestamp: Date.now(),
    });

    // Send to registry
    await this.messageRegistry.findMessages('test');
    model.attachments = options.attachments && Object.keys(options.attachments).length > 0
      ? options.attachments
      : undefined;
    model.content = model.content.replace(/"attachments": null\}/g, '"attachments": {"attachments": []}');

    const formattedMsg: FormattedMessage = {
      id: `m${Date.now()}-${uuid().substring(0, 12)}`,
      channelId,
      authorId: userId,
      content: JSON.parse(msgContent).rich_text,
      timestamp: model.timestamp,
      timestampMs: model.timestampMs,
      type: 'text',
      mentions,
      attachments: new Map(Object.entries(options.attachments || {})),
    };

    return formattedMsg;
  }

  // Build the message model object
  private _buildModel(options: { formatType: string; content: string; channelId: string; channelIdField: string; authorId: string; channelIcon?: string; channelIdPrefix?: string; timestamp: number; timestampMs?: number }): { attachments?: Map<string, { type: string; size: number; url: string; name?: string }> | null; content: string | Map<string, string>; timestamp: number; timestampMs: number; embeds?: any[]; mentions?: Map<string, string>; reactions?: Map<string, { user_id: string; emoji: any; count: number }>; type: 'Message'; type_field: string; author_id: string; author_display_name?: string; author_icon: string; channel_icon?: string; channel_id: string; channel_id_prefix?: string; raw_content: string; attachment_filer_ids?: string[]; attachment_names?: string[]; attachment_counts?: string[]; attachments?: any[]; } {
    return {
      attachments: options.attachments,
      content: options.content,
      timestamp: options.timestamp,
      timestampMs: options.timestampMs || Math.round(options.timestamp / 1000),
      embeds: [],
      mentions: new Map(),
      reactions: new Map(),
      type: 'Message',
      type_field: 'type',
      author_id: options.authorId,
      author_display_name: new Map(),
      author_icon: options.channelIcon,
      channel_icon: options.channelIcon,
      channel_id: options.channelId,
      channel_id_prefix: options.channelIdPrefix,
      raw_content: options.content,
      attachment_filer_ids: [],
      attachment_names: [],
      attachment_counts: [],
      attachments: options.attachments,
    };
  }
}
