import { Core } from '../core.interface';

/**
 * Module interfaces for OpenConcord architecture.
 * Defines the contracts between Core Services (Layer 1) and modules (Layer 2).
 */
export interface ModuleRegistry<T> {
  register(name: string, instance: T): void;
  get(name: string): T | undefined;
  getAll(): T[];
  unregister(name: string): void;
  has(name: string): boolean;
}

export interface ChannelRegistry {
  // Channel types
  readonly channelTypes: readonly ('text' | 'voice' | 'notification' | 'private')[];

  // Channel models
  interface: {
    readonly id: string;
    readonly type: 'text' | 'voice' | 'notification' | 'private';
    readonly name: string;
    readonly parentId?: string;
    readonly guildId?: string;
    readonly createdAt: string;
    readonly topic?: string;
    readonly icon?: string;
    readonly position: number;
    readonly permissions: string;
    readonly rateLimitPerUser: number;
  };

  // Channel data
  data: {
    readonly id: string;
    readonly timestamp: string;
    readonly content?: string;
    readonly attachments?: Array<{ id: string; filename: string; size: number }>;
    readonly embeds?: Array<{ title?: string; url?: string; description?: string; fields?: Array<{ name: string; value: string }> }>;
  };

  // Channel message
  message: {
    readonly id: string;
    readonly createdAt: string;
    readonly content: string;
    readonly attachments?: unknown;
    readonly embeds?: unknown;
    readonly mentions?: unknown;
    readonly reactions?: unknown;
  };

  // Channel thread
  thread: {
    readonly id: string;
    readonly name: string;
    readonly parentId?: string;
    readonly createdAt: string;
    readonly archived?: boolean;
    readonly locked?: boolean;
    readonly guildId?: string;
    readonly channelId?: string;
    readonly parentId?: string;
  };

  // Channel list response
  list: Record<string, {
    readonly id: string;
    readonly name: string;
    readonly type: 'text' | 'voice' | 'notification' | 'private';
    readonly parentId?: string;
    readonly guildId?: string;
  }>;

  // Channel guild
  guild: {
    readonly id: string;
    readonly name: string;
    readonly permissions: string;
    readonly position: number;
  };

  // Channel join invite
  joinInvite: Record<string, Record<string, unknown>>;

  // Channel parent
  parent: {
    readonly id: string;
    readonly type: 'text' | 'voice' | 'news' | 'category';
  };

  // Channel parent query
  parentQuery: {
    readonly ids: readonly string[];
  };

  // Channel join invite query
  joinInviteQuery: {
    readonly ids: readonly string[];
  };

  // Channel query
  query: {
    readonly guild_id?: string;
    readonly channel_type?: string;
    readonly permissions?: string;
    readonly limit?: number;
    readonly type?: string;
    readonly cache?: boolean;
    readonly before?: string;
    readonly after?: string;
    readonly sort_order?: string;
    readonly message_reference?: unknown;
    readonly user_limit?: number;
    readonly privacy?: string;
  };

  // Channel query response
  queryResponse: {
    readonly channel_id: string;
    readonly name: string;
    readonly topic?: string;
    readonly last_message_id?: string;
    readonly bitrate?: number;
    readonly user_limit?: number;
    readonly rate_limit_per_user?: number;
    readonly position?: number;
    readonly permission_overwrites?: Record<string, unknown>;
    readonly nsid?: string;
    readonly rtc_region?: string;
    readonly video_quality_mode?: number;
    readonly message_count?: number;
    readonly pinned_count?: number;
    readonly parent_id?: string;
    readonly guild_id?: string;
    readonly last_pin_timestamp?: string;
    readonly guild_permissions?: string;
    readonly rtc_hearty?: boolean;
    readonly moderation_channel_id?: string;
    readonly manage_channels?: boolean;
    readonly manage_roles?: boolean;
    readonly manage_webhooks?: boolean;
    readonly manage_categories?: boolean;
    readonly manage_channels_and_groups?: boolean;
    readonly manage_guild?: boolean;
    readonly connect?: boolean;
    readonly speak?: boolean;
    readonly stream?: boolean;
    readonly use_embedded_voice?: boolean;
    readonly video_embedding_mode?: number;
    readonly auto_archive_duration?: number;
    readonly default_auto_archive_duration?: number;
    readonly ns_channel_type?: unknown;
  };

  // Channel sync
  sync: {
    readonly id: string;
    readonly type: string;
    readonly timestamp: string;
    readonly sync_includes: unknown;
    readonly updates: unknown;
    readonly op: string;
  };
}

export interface UserRegistry {
  // User model
  interface: {
    readonly id: string;
    readonly username: string;
    readonly discriminator: string;
    readonly token: string;
    readonly avatar?: string;
    readonly avatar_hash?: string;
    readonly banner?: string;
    readonly banner_hash?: string;
    readonly accent_color?: number;
    readonly locale?: string;
    readonly verified: boolean;
    readonly email?: string;
    readonly mfa_enabled: boolean;
    readonly bot?: boolean;
    readonly proxy?: boolean;
    readonly public_flags?: number;
  };

  // Me user
  me: {
    readonly avatar?: string;
    readonly discriminator: string;
    readonly id: string;
    readonly public_flags?: number;
    readonly premium_since?: string;
    readonly username: string;
    readonly flags: number;
    readonly banner?: string;
    readonly banner_hash?: string;
    readonly accent_color?: number;
    readonly locale?: string;
  };

  // Me user update
  meUpdate: {
    readonly avatar?: string;
    readonly banner?: string;
    readonly accent_color?: number;
    readonly locale?: string;
    readonly verification_level?: number;
    readonly email?: string;
    readonly confirmed?: boolean;
    readonly proxy: boolean;
    readonly banner_hash: string;
    readonly banner_color?: number;
    readonly banner_premium?: boolean;
    readonly guild_splash?: string;
    readonly guild_banner?: string;
    readonly guild_avatar?: string;
    readonly guild_banner_color?: number;
    readonly guild_banner_id?: string;
    readonly guild_banner_hash?: string;
    readonly user_flag?: number;
    readonly flags?: number;
    readonly verified?: boolean;
    readonly mfa_enabled?: boolean;
    readonly banner_hash_2?: string;
    readonly user_flags?: number;
    readonly name_tag?: string;
    readonly dms?: Array<{
      readonly id: string;
      readonly last_message_id: string;
      readonly status: number;
      readonly status_message?: string;
      readonly last_seen: string;
    }>;
  };

  // User list
  list: Record<string, Record<string, unknown>>;

  // User data
  data: {
    readonly id: string;
    readonly username: string;
    readonly global_name?: string;
    readonly avatar?: string;
    readonly discrim_min?: number;
  };

  // User guild
  guild: {
    readonly id: string;
    readonly name: string;
    readonly permissions: string;
    readonly avatar?: string;
    readonly avatar_hash?: string;
    readonly accent_color?: number;
    readonly banner?: string;
    readonly banner_hash?: string;
    readonly banner_color?: number;
    readonly public_flags?: number;
    readonly bot?: boolean;
    readonly user: {
      readonly id: string;
      readonly username: string;
      readonly discriminator: string;
      readonly avatar?: string;
      readonly accent_color?: number;
    };
    readonly house_briggs: boolean;
    readonly flags: number;
    readonly premium_since?: string;
    readonly verified: boolean;
    readonly locale?: string;
    readonly mfa_enabled: boolean;
    readonly email?: string;
    readonly banner_id?: string;
    readonly banner_color?: number;
  };

  // User query
  query: {
    readonly query: string;
    readonly guild_id?: string;
    readonly limit?: number;
    readonly count?: number;
    readonly cache?: boolean;
    readonly page?: string;
  };

  // User query response
  queryResponse: Array<{
    readonly id: string;
    readonly username: string;
    readonly global_name: string;
    readonly discriminator: string;
    readonly avatar?: string;
    readonly discriminator_min?: number;
    readonly accent_color?: number;
    readonly banner?: string;
    readonly banner_hash?: string;
    readonly banner_id?: string;
    readonly banner_color?: number;
    readonly banner_type?: number;
    readonly banner_hash_hash?: number;
    readonly banner_premium?: boolean;
    readonly house_briggs?: boolean;
    readonly flags?: number;
    readonly premium_since?: string;
    readonly verified?: boolean;
    readonly mfa_enabled?: boolean;
    readonly email?: string;
    readonly banner_hash_2?: string;
    readonly user_flags?: number;
    readonly name_tag?: string;
  }>;
}

export interface MessageRegistry {
  // Message model
  interface: {
    readonly id: string;
    readonly content: string;
    readonly type: 'default' | 'reply' | 'mention' | 'mention_role' | 'mention_everyone' | 'system' | 'channel_mention' | 'user_mention';
    readonly timestamp: string;
    readonly attachments?: Array<{ id: string; title: string; description: string; url: string; proxy_url: string; size: number; width: number; height: number; filename: string; webhook_id: string }> | null;
    readonly embeds?: Array<{ title?: string; type: string; description?: string; url?: string; timestamp?: string; color?: number; footer?: { text?: string; icon_url?: string; proxy_icon_url?: string; icon_emoji?: string } | null; image?: { url: string; proxy_url: string; height: number; width: number; title?: string } | null; thumbnail?: { url: string; proxy_url: string; height: number; width: number } | null; author?: { name?: string; url?: string; icon_url?: string; proxy_icon_url?: string; icon_emoji?: string } | null; fields?: null; image_width?: number; image_height?: number }[] | null; fields?: Array<{ name: string; value: string; inline?: boolean }> | null;
    readonly roles?: readonly string[] | null;
    readonly members?: Array<{ metadata?: { user_id: string; voice?: { id: string; user_id: string; guild_id: string; member_ref: string; joined_at?: string } } }> | null;
    readonly pings: { readonly @unknown: unknown } | null;
    readonly channel_id: string;
    readonly author: { readonly id: string; discriminator?: string; username: string; avatar?: string; bot?: boolean | null; system?: boolean | null; accent_color?: number | null; banner?: string | null; banner_hash?: string | null; locale?: string | null; webhook_id?: string | null };
  };

  // Message data
  data: {
    readonly id: string;
    readonly timestamp: string;
    readonly content: string;
    readonly attachments?: Array<{ id: number; filename: string; size: number }>;
    readonly embeds?: Array<{ title?: string; url?: string; description?: string; fields?: Array<{ name: string; value: string }> }>;
    readonly mentions?: {
      readonly id: string;
      readonly username: string;
      readonly type: string;
      readonly discriminator?: string;
      readonly avatar?: string;
    }[];
    readonly reactions?: Array<{
      readonly count: number;
      readonly emoji: {
        readonly id?: string;
        readonly name: string;
        readonly animated?: boolean;
        readonly role_id?: string;
        readonly user?: {
          readonly id: string;
          readonly username: string;
          readonly discriminator?: number;
          readonly avatar?: string;
        };
      };
    }>;
  };

  // Message metadata
  metadata: {
    readonly id: string;
    readonly url: string;
    readonly created_at: string;
    readonly edited_timestamp: string;
    readonly is_sticky: boolean;
    readonly attachments: Array<{
      readonly id: string;
      readonly media_type: string;
      readonly name: string;
      readonly size: string;
      readonly proxy_id: string;
      readonly content_type: string;
    }>;
  };

  // Message guild
  guild: {
    readonly user_id: string;
    readonly server_id: string;
    readonly channel_id: string;
    readonly server_id_2: string;
    readonly server_id_3: string;
    readonly server_id_4: string;
    readonly server_id_5: string;
    readonly content: string;
    readonly created_at: string;
    readonly pinned: boolean;
    readonly timestamp: string;
    readonly message_reference: {
      readonly message_id: string;
      readonly channel_id: string;
      readonly guild_id: string;
    };
    readonly role_ids?: string[];
    readonly member_ids?: string[];
    readonly reaction_ids?: string[];
    readonly content_type: string;
    readonly source_user_id?: string;
    readonly channel_group: string;
    readonly is_sticky: boolean;
    readonly attachments: unknown;
    readonly embeds: unknown;
    readonly reactions: unknown;
  };

  // Message edit data
  edit: {
    readonly message: {
      readonly id: string;
      readonly content: string;
      readonly type: string;
      readonly channel_id: string;
      readonly guild_id?: string;
      readonly timestamp: string;
      readonly timestamp_unix: number;
      readonly attachments: unknown;
      readonly embeds: unknown;
      readonly roles: string[];
      readonly mentions: Array<{
        readonly id: string;
        readonly discriminator?: string;
        readonly username?: string;
        readonly avatar?: string;
        readonly type?: string;
        readonly tag?: string;
        readonly bot?: boolean;
        readonly system?: boolean;
        readonly accent_color?: number;
        readonly banner?: string;
        readonly banner_hash?: string;
        readonly locale?: string;
        readonly proxy?: boolean;
        readonly bot_id?: string;
        readonly member_count?: number;
      }>;
    };
  };

  // Reply response
  reply: {
    readonly id: string;
    readonly timestamp: string;
    readonly channel_id: string;
    readonly guild_id: string;
    readonly type: string;
    readonly message_reference: {
      readonly message_id: string;
      readonly channel_id: string;
      readonly guild_id: string;
    };
    readonly content: string;
    readonly mentions: Array<{
      readonly id: string;
      readonly discriminator?: string;
      readonly username?: string;
      readonly avatar?: string;
      readonly type?: string;
      readonly tag?: string;
      readonly bot?: boolean;
      readonly system?: boolean;
      readonly accent_color?: number;
      readonly banner?: string;
      readonly banner_hash?: string;
      readonly locale?: string;
      readonly proxy?: boolean;
      readonly bot_id?: string;
      readonly member_count?: number;
    }>;
    readonly attachments: unknown;
    readonly embeds: unknown;
    readonly roles: Array<{ id: string; name: string; color: number }>;
    readonly member_ids: string[];
    readonly reaction_ids: string[];
    readonly content_type: string;
  };

  // Message query
  query: {
    readonly channel_id?: string;
    readonly guild_id?: string;
    readonly limit?: number;
    readonly before?: string;
    readonly after?: string;
    readonly sort_order?: string;
    readonly around?: string;
  };

  // Message query response
  queryResponse: Array<{
    readonly type: string;
    readonly id: string;
    readonly thread_id: string;
    readonly channel_id: string;
    readonly guild_id: string;
    readonly content: string;
    readonly nonce: string;
    readonly embeds: unknown;
    readonly attachments: unknown;
    readonly roles: string[];
    readonly mentions: Array<{
      readonly id: string;
      readonly discriminator?: string;
      readonly username?: string;
      readonly avatar?: string;
      readonly type?: string;
      readonly tag?: string;
      readonly bot?: boolean;
      readonly system?: boolean;
      readonly accent_color?: number;
      readonly banner?: string;
      readonly banner_hash?: string;
      readonly locale?: string;
      readonly proxy?: boolean;
      readonly bot_id?: string;
      readonly member_count?: number;
    }>;
    readonly reactions: unknown;
    readonly pinned: boolean;
    readonly ttd: string;
    readonly webhook_id: string;
    readonly timestamp: string;
    readonly timestamp_unix: number;
    readonly edited_timestamp: string;
    readonly edited_timestamp_unix: number;
    readonly parent_message_id: string;
    readonly message_reference: {
      readonly message_id: string;
      readonly channel_id: string;
      readonly guild_id: string;
    };
  }>;

  // Message delete
  delete: {
    readonly id: string;
    readonly channel_id: string;
    readonly guild_id: string;
    readonly timestamp: string;
  };
}

export interface ThreadRegistry {
  // Thread model
  interface: {
    readonly id: string;
    readonly name: string;
    readonly parentId?: string;
    readonly createdAt: string;
    readonly archived?: boolean;
    readonly locked?: boolean;
    readonly guildId?: string;
    readonly channelId?: string;
    readonly parentId?: string;
  };

  // Thread data
  data: {
    readonly id: string;
    readonly name: string;
    readonly parentId: string;
    readonly createdAt: string;
    readonly archivedAt?: string;
    readonly lockedAt?: string;
    readonly topic?: string;
    readonly icon?: string;
    readonly guildId?: string;
    readonly channelId?: string;
    readonly parentId?: string;
  };

  // Thread parent
  parent: {
    readonly id: string;
    readonly parentId: string;
    readonly guildId: string;
    readonly channelId: string;
    readonly type: string;
    readonly topic: string;
    readonly autoArchiveDuration: number;
    readonly rateLimitPerUser: number;
    readonly readonly: boolean;
    readonly nsid: string;
    readonly rtcRegion: string;
    readonly videoQualityMode: number;
    readonly autoArchiveDuration: number;
    readonly defaultAutoArchiveDuration: number;
    readonly nsChannelType: unknown;
    readonly moderationChannelId: string;
    readonly manageChannels: boolean;
    readonly manageRoles: boolean;
    readonly manageWebhooks: boolean;
    readonly manageCategories: boolean;
    readonly manageChannelsAndGroups: boolean;
    readonly manageGuild: boolean;
    readonly connect: boolean;
    readonly speak: boolean;
    readonly stream: boolean;
    readonly useEmbeddedVoice: boolean;
    readonly videoEmbeddingMode: number;
  };

  // Thread parent by ID
  parentBy: {
    readonly id: string;
    readonly parentId: string;
    readonly guildId: string;
    readonly channelId: string;
    readonly type: string;
    readonly topic: string;
  };

  // Thread query
  query: {
    readonly guild_id?: string;
    readonly channel_id?: string;
    readonly limit?: number;
    readonly before?: string;
    readonly after?: string;
    readonly sort_order?: string;
    readonly archived?: boolean;
    readonly locked?: boolean;
    readonly archived_before?: string;
    readonly archived_after?: string;
    readonly locked_before?: string;
    readonly locked_after?: string;
    readonly public_limit?: number;
    readonly hidden_limit?: number;
  };

  // Thread query response
  queryResponse: {
    readonly id: string;
    readonly name: string;
    readonly parentId: string;
    readonly createdAt: string;
    readonly archivedAt: string;
    readonly lockedAt: string;
    readonly topic: string;
    readonly icon: string;
    readonly guildId: string;
    readonly channelId: string;
    readonly parentId: string;
    readonly pinnedCount: number;
    readonly archivedTimestamp: string;
    readonly autoArchiveDuration: number;
    readonly locked: boolean;
    readonly archived: boolean;
    readonly lockedAt: string;
    readonly topic: string;
    readonly icon: string;
    readonly guildId: string;
    readonly channelId: string;
    readonly parentId: string;
    readonly ownerId: string;
    readonly rateLimitPerUser: number;
    readonly nsid: string;
    readonly rtcRegion: string;
    readonly videoQualityMode: number;
    readonly autoArchiveDuration: number;
    readonly defaultAutoArchiveDuration: number;
    readonly moderationChannelId: string;
    readonly manageChannels: boolean;
    readonly manageRoles: boolean;
    readonly manageWebhooks: boolean;
    readonly manageCategories: boolean;
    readonly manageChannelsAndGroups: boolean;
    readonly manageGuild: boolean;
    readonly connect: boolean;
    readonly speak: boolean;
    readonly stream: boolean;
    readonly useEmbeddedVoice: boolean;
    readonly videoEmbeddingMode: number;
  };
}

export interface ServerDiscovery {
  // Server model
  interface: {
    readonly id: string;
    readonly name: string;
    readonly icon?: string;
    readonly status: string;
    readonly online_count: number;
    readonly owner: Record<string, unknown>;
    readonly features: Record<string, unknown>;
    readonly channels?: Array<{
      readonly id: string;
      readonly name: string;
      readonly type: string;
      readonly icon?: string;
      readonly status: string;
      readonly last_read?: string;
    }>;
    readonly guilds?: unknown[];
    readonly house_briggs?: boolean;
    readonly flags?: number;
    readonly public_flags?: number;
    readonly house?: unknown;
  };

  // Server data
  data: Array<{
    readonly id: string;
    readonly name: string;
    readonly icon: string;
    readonly status: string;
    readonly online_count: number;
    readonly owner: Record<string, unknown>;
    readonly features: Record<string, unknown>;
    readonly channels: unknown[];
    readonly guilds: unknown[];
    readonly house_briggs?: boolean;
    readonly flags?: number;
    readonly public_flags?: number;
    readonly house?: unknown;
  }>;

  // Server query
  query: {
    readonly query: string;
    readonly limit?: number;
    readonly cache?: boolean;
    readonly page?: string;
  };

  // Server query response
  queryResponse: Array<{
    readonly id: string;
    readonly name: string;
    readonly icon: string;
    readonly status: string;
    readonly online_count: number;
    readonly owner: Record<string, unknown>;
    readonly features: Record<string, unknown>;
    readonly channels: unknown[];
    readonly guilds: unknown[];
    readonly house_briggs?: boolean;
    readonly flags?: number;
    readonly public_flags?: number;
    readonly house?: unknown;
  }>;

  // Server list
  list: {
    readonly id: string;
    readonly name: string;
    readonly icon: string;
    readonly status: string;
    readonly online_count: number;
    readonly owner: Record<string, unknown>;
    readonly features: Record<string, unknown>;
    readonly channels: unknown[];
    readonly guilds: unknown[];
    readonly house_briggs?: boolean;
    readonly flags?: number;
    readonly public_flags?: number;
    readonly house?: unknown;
  };
}

export interface NotificationRegistry {
  // Notification model
  interface: {
    readonly id: string;
    readonly type: string;
    readonly content: string;
    readonly timestamp: string;
    readonly read: boolean;
    readonly channel_id?: string;
    readonly server_id?: string;
    readonly guild_id?: string;
  };

  // Notification data
  data: {
    readonly id: string;
    readonly type: string;
    readonly content: string;
    readonly timestamp: string;
    readonly read: boolean;
    readonly channel_id?: string;
    readonly server_id?: string;
    readonly guild_id?: string;
  };
}

export interface SearchRegistry {
  search: Record<string, {
    readonly type: string;
    readonly id: string;
    readonly timestamp: string;
    readonly message: string;
    readonly results: Array<{
      readonly id: string;
      readonly type: string;
      readonly name: string;
      readonly icon?: string;
    }>;
  }>;
}
