/**
 * Search Registry — Layer 3
 *
 * Wraps the SearchRegistration interface and exposes search functionality to feature modules.
 * Implements typed search over messages, channels, servers, and users.
 */

import { SearchRegistration } from '../core/app.module';
import { v4 as uuid } from 'uuid';

type SearchType = 'message' | 'channel' | 'server' | 'user' | 'hashtag' | 'all';

interface SearchResult {
  id: string;
  type: SearchType;
  data: unknown;
  score: number;
}

export interface SearchRegistryService {
  search(query: string, options: { type?: SearchType; limit?: number; channelIds?: string[] }): Promise<SearchResult[]>;
  indexChannel(channelId: string): Promise<void>;
  indexServer(serverId: string): Promise<void>;
  indexMessage(messageId: string, content: string, channelId: string): Promise<void>;
  indexUser(userId: string, name: string): Promise<void>;
  removeIndex(channelId: string): Promise<void>;
  rebuildIndex(): Promise<void>;
}

/**
 * In-memory search index with prefix and full-text matching.
 */
export class InMemorySearchRegistry implements SearchRegistryService {
  private readonly channels = new Map<string, SearchChannel>();
  private readonly servers = new Map<string, SearchServer>();
  private readonly messages = new Map<string, SearchMessage>();
  private readonly users = new Map<string, SearchUser>();

  private readonly defaultLimit = 20;

  async search(
    query: string,
    options: { type?: SearchType; limit?: number; channelIds?: string[] },
  ): Promise<SearchResult[]> {
    const { type = 'all', limit = this.defaultLimit, channelIds } = options;
    const lowerQuery = query.toLowerCase();
    const results: SearchResult[] = [];

    // Match channels
    if (type === 'all' || type === 'channel') {
      for (const [id, data] of this.channels) {
        if (channelIds && !channelIds.includes(id)) continue;
        let score: number;
        if (id.toLowerCase().includes(lowerQuery)) {
          // Exact match: high score
          if (id.toLowerCase() === lowerQuery) score = 1.0;
          else if (id.toLowerCase().startsWith(lowerQuery + '*')) score = 0.8;
          else score = 0.5;
        } else {
          score = this.fuzzyScore(data.name || id, lowerQuery);
        }
        if (score > 0) {
          results.push({
            id,
            type: 'channel',
            data: { ...data, icon: data.icon || 'https://cdn.openconcord.app/avatars/u/1', position: 2 },
            score,
          });
        }
      }
    }

    // Match servers
    if (type === 'all' || type === 'server') {
      for (const [id, data] of this.servers) {
        let score: number;
        if (id.toLowerCase().includes(lowerQuery)) {
          if (id.toLowerCase() === lowerQuery) score = 1.0;
          else if (id.toLowerCase().startsWith(lowerQuery + '*')) score = 0.8;
          else score = 0.5;
        } else {
          score = this.fuzzyScore(data.name || id, lowerQuery);
        }
        if (score > 0) {
          results.push({
            id,
            type: 'server',
            data: { id, name: data.name, icon: data.icon || 'https://cdn.openconcord.app/avatars/u/1', position: 1 },
            score,
          });
        }
      }
    }

    // Match messages
    if (type === 'all' || type === 'message') {
      for (const [id, data] of this.messages) {
        const lowerContent = data.content.toLowerCase();
        if (lowerContent.includes(lowerQuery)) {
          // Exact match gets higher score
          let score = 0.5;
          if (lowerContent === lowerQuery) score = 1.0;
          else if (lowerContent.startsWith(lowerQuery)) score = 0.7;
          else if (lowerContent.endsWith(lowerQuery)) score = 0.6;
          results.push({ id, type: 'message', data, score });
        }
      }
    }

    // Match users
    if (type === 'all' || type === 'user') {
      for (const [id, data] of this.users) {
        let score = this.fuzzyScore(data.name || id, lowerQuery);
        if (score > 0) {
          results.push({
            id,
            type: 'user',
            data: { id, name: data.name, avatar: data.avatar },
            score,
          });
        }
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  private async indexChannel(channelData: unknown): Promise<void> {}
  private async indexServer(serverData: unknown): Promise<void> {}
  private async indexMessage(messageId: string, content: string, channelId: string): Promise<void> {}
  private async indexUser(userId: string, name: string): Promise<void> {}
  async removeIndex(channelId: string): Promise<void> {}
  async rebuildIndex(): Promise<void> {}

  private fuzzyScore(haystack: string, needle: string): number {
    const index = haystack.indexOf(needle);
    if (index === -1) return 0;
    return (100 - Math.min(haystack.length - index, 100 - needle.length)) / 100;
  }

  async close(_: void): Promise<void> {
    return Promise.resolve();
  }
}
