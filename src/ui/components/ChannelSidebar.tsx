import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSpringTransition, springEasing, useHoverAnimation } from '../animations';
import { Channel } from '../../core/interfaces/channel.interface';
import { Guild } from '../../core/interfaces/guild.interface';
import { useTheme } from '../theme-provider';

// Channel icon data using inline SVG for zero-dependency
const ChannelIcons: Record<string, { path: string; width: number; height: number }> = {
  hash: {
    path: '<path d="M10 5a5 5 0 100 10 5 5 0 000-10zM10 1v4M10 19v-4M5 10h4M19 10h-4", fill="none" stroke="currentColor" stroke-width="2"/>',
    width: 16,
    height: 16,
  },
  audio: {
    path: '<path d="M12 3v10h8.5a2.5 2.5 0 010 5H3v-4", fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    width: 16,
    height: 16,
  },
  bell: {
    path: '<path d="M10 7a2 2 0 100-4 2 2 0 000 4zM15 11v2a4 4 0 01-4 4V20h-4v-1a4 4 0 01-4-4V11", fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    width: 16,
    height: 16,
  },
  user: {
    path: '<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2", fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="7" r="4" fill="none" stroke="currentColor" stroke-width="2"/>',
    width: 16,
    height: 16,
  },
  folder: {
    path: '<path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z", fill="none" stroke="currentColor" stroke-width="2"/>',
    width: 16,
    height: 16,
  },
  pinned: {
    path: '<path d="M16 4l2 4h-4l-2-4-2 4h4l2-4", fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M14 20a2 2 0 100-4 2 2 0 000 4z", fill="none" stroke="currentColor" stroke-width="2"/>',
    width: 16,
    height: 16,
  },
};

const ChannelIcon = ({ name, size = 16, className = '' }: { name: keyof typeof ChannelIcons; size?: number; className?: string }) => {
  const Icon = ChannelIcons[name];
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className}>
      <path d={Icon.path} />
    </svg>
  );
};

interface ChannelSidebarProps {
  channels: Channel[];
  currentChannelId: string | null;
  onSelectChannel: (channelId: string, event: React.MouseEvent) => void;
  servers: Guild[];
  guildId: string;
  showServers: boolean;
  onToggleServers: () => void;
}

export const ChannelSidebar: React.FC<ChannelSidebarProps> = ({
  channels,
  currentChannelId,
  onSelectChannel,
  servers,
  guildId,
  showServers,
  onToggleServers,
}) => {
  const { theme } = useTheme();
  const [hoveredChannel, setHoveredChannel] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState(0);
  const [serverWidth, setServerWidth] = useState(180);

  const sidebarRef = useRef<HTMLDivElement>(null);

  // Hover animation state
  const [hoverOpacity, hoverScale, setHoverActive] = useHoverAnimation(
    hoveredChannel !== null,
    1.05,
    120
  );

  const handleSelect = useCallback(
    (channelId: string, event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      onSelectChannel(channelId);
    },
    [onSelectChannel]
  );

  const isTextChannel = (type: string) => type === 'text';
  const isVoiceChannel = (type: string) => type === 'voice';
  const isPrivateChannel = (type: string) => type === 'private';
  const isNotificationChannel = (type: string) => type === 'notification';
  const isCategory = (type: string) => type === 'category';

  const channelCategoryMap: Record<string, Channel[]> = {};
  Object.values(channels).forEach((channel) => {
    if (!channelCategoryMap[channel.categoryId]) {
      channelCategoryMap[channel.categoryId] = [];
    }
    channelCategoryMap[channel.categoryId].push(channel);
  });

  // Update server widths based on available space
  useEffect(() => {
    if (sidebarRef.current) {
      const sidebarWidth = sidebarRef.current.offsetWidth;
      const availableWidth = sidebarWidth - (showServers ? 64 : 56);
      const serverCount = servers.length;
      const minServerWidth = 60;

      let totalWidth = 0;
      for (let i = 0; i < serverCount; i++) {
        if (i === 0) {
          // First server takes remaining space minus 2px gap
          totalWidth += (availableWidth - 2) / serverCount;
        } else {
          totalWidth += minServerWidth;
        }
      }

      // Update individual server widths
      servers.forEach((server, index) => {
        if (index === 0) {
          setServerWidth(Math.max(36, (availableWidth - 2) / serverCount));
        } else {
          setServerWidth(minServerWidth);
        }
      });
    }
  }, [showServers, servers.length, availableWidth]);

  const getThemeColor = (key: string) => {
    const themeColors = {
      dark: {
        bg: '#2f3136',
        sidebarBg: '#202225',
        sectionHeaderBg: '#202225',
        sectionBorder: '#202225',
        channelBg: '#34373c',
        channelHoverBg: '#2c2f33',
        channelActiveBg: '#5865f2',
        channelIcon: '#b5bac1',
        categoryHeader: '#1f2225',
        channelText: '#8e9297',
        channelHoverText: '#dbdee1',
        channelActiveText: '#ffffff',
        userOnline: '#3ba55c',
        userIdle: '#faa61a',
        userDND: '#ed4245',
        userOffline: '#4f545c',
        userAFK: '#ff915d',
        inputPlaceholder: '#898da3',
        buttonBg: '#393c43',
        buttonHover: '#4f545c',
        addChannelBg: '#26272d',
        sectionBorder: '#202225',
      },
      light: {
        bg: '#fff',
        sidebarBg: '#fff',
        sectionHeaderBg: '#202225',
        sectionBorder: '#2c2f33',
        channelBg: '#36393f',
        channelHoverBg: '#34b3dd',
        channelActiveBg: '#34b3dd',
        channelIcon: '#7289da',
        categoryHeader: '#383a40',
        channelText: '#3f4147',
        channelHoverText: '#2e3238',
        channelActiveText: '#ffffff',
        userOnline: '#43b581',
        userIdle: '#faa61a',
        userDND: '#ea6c58',
        userOffline: '#f79334',
        userAFK: '#ff915d',
        inputPlaceholder: '#848e9c',
        buttonBg: '#23a7dd',
        buttonHover: '#1e93cc',
        addChannelBg: '#202225',
        sectionBorder: '#2c2f33',
      },
      black: {
        bg: '#1a1b1e',
        sidebarBg: '#2c2e32',
        sectionHeaderBg: '#25262b',
        sectionBorder: '#25262b',
        channelBg: '#2c2e32',
        channelHoverBg: '#25262b',
        channelActiveBg: '#374151',
        channelIcon: '#539be5',
        categoryHeader: '#2c2e32',
        channelText: '#9ca3af',
        channelHoverText: '#d1d5db',
        channelActiveText: '#ffffff',
        userOnline: '#1d9762',
        userIdle: '#fbcc5a',
        userDND: '#ea5858',
        userOffline: '#7289da',
        userAFK: '#ff915d',
        inputPlaceholder: '#6b7280',
        buttonBg: '#3f4247',
        buttonHover: '#44464d',
        addChannelBg: '#25262b',
        sectionBorder: '#25262b',
      },
    } as Record<string, Record<string, string>>;

    return themeColors[theme][key] || themeColors['dark'][key];
  };

  const currentThemeColors = getThemeColor(theme);

  // Handle resizing
  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setIsDragging(true);
    setDragStartPos(event.clientX - serverWidth);
  }, [serverWidth]);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (isDragging) {
      const newWidth = Math.max(60, event.clientX - dragStartPos);
      setServerWidth(newWidth);
    }
  }, [isDragging, dragStartPos]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Keyboard navigation for server list
  const [focusedServerIndex, setFocusedServerIndex] = useState(0);
  const serverRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const { key } = event;
      if (key === 'ArrowRight' && focusedServerIndex < servers.length - 1) {
        event.preventDefault();
        setFocusedServerIndex((prev) => prev + 1);
        const nextRef = serverRefs.current[focusedServerIndex + 1];
        nextRef?.focus();
      } else if (key === 'ArrowLeft' && focusedServerIndex > 0) {
        event.preventDefault();
        setFocusedServerIndex((prev) => prev - 1);
        const prevRef = serverRefs.current[focusedServerIndex - 1];
        prevRef?.focus();
      } else if (key === 'ArrowUp') {
        event.preventDefault();
      } else if (key === 'ArrowDown') {
        event.preventDefault();
      } else if (key === 'Home') {
        event.preventDefault();
        serverRefs.current[0]?.focus();
      } else if (key === 'End') {
        event.preventDefault();
        serverRefs.current[servers.length - 1]?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [focusedServerIndex, servers.length]);

  const handleFocus = useCallback((index: number) => {
    setFocusedServerIndex(index);
  }, []);

  const handleBlur = useCallback(() => {
    setFocusedServerIndex(-1);
  }, []);

  return (
    <aside
      ref={sidebarRef}
      className="flex flex-col h-full"
      style={{ background: currentThemeColors.bg }}
    >
      <div className="flex-1 flex max-h-full">
        {/* Servers Column */}
        <div
          className="flex flex-col items-center gap-2 px-2 pb-4 overflow-x-auto custom-scrollbar flex-shrink-0"
          style={{ maxWidth: '200px', width: '100%' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <div
            className="flex items-end gap-1 pb-3 relative group"
            style={{
              maxHeight: 'var(--max-channel-height, 480px)',
              overflowY: 'auto',
              overflowX: 'hidden',
            }}
            onScroll={(e) => {
              const el = e.currentTarget;
              const atBottom =
                Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) < 1;
              const atTop = el.scrollTop === 0;

              if (servers.length > 1 && !atBottom) {
                setFocusedServerIndex((foc) => Math.min(foc, servers.length - 1));
              }
              if (servers.length > 1 && atTop) {
                setFocusedServerIndex((foc) => Math.max(foc, 0));
              }
            }}
          >
            {servers.map((server, index) => {
              const isActive =
                server.id === guildId &&
                currentChannelId !== null &&
                isTextChannel(currentChannelId.replace('channels/', ''));
              const isActiveText =
                server.id === guildId &&
                currentChannelId !== null &&
                isTextChannel(currentChannelId.replace('channels/', ''));

              return (
                <div
                  ref={(el) => {
                    serverRefs.current[index] = el;
                    if (index === focusedServerIndex) {
                      el?.focus();
                    }
                  }}
                  key={server.id}
                  tabIndex={0}
                  className={`
                    relative flex flex-col items-center gap-1.5 rounded-md
                    cursor-pointer mx-0.5
                    transition-all duration-150
                    ${focusedServerIndex === index ? 'ring-2 ring-[#e91e63]' : ''}
                    ${index !== 0 ? 'mt-auto z-10' : ''}
                  `}
                  style={{
                    width: serverWidth + 'px',
                    minWidth: '180px',
                    maxWidth: '180px',
                    height: '46px',
                    marginTop: index !== 0 ? '1px' : '0',
                    filter: 'drop-shadow(2px -1px 2px #fcd535) drop-shadow(-2px -1px 2px #fcd535)',
                  }}
                  onFocus={() => handleFocus(index)}
                  onBlur={handleBlur}
                  onClick={() => {
                    if (showServers) {
                      // Hide the side panel when server is active
                      onToggleServers();
                      // Move focus to the first text channel of the server
                      const serverChannels = channels.filter(
                        (c: Channel) => c.guildId === server.id && c.type === 'text'
                      );
                      if (serverChannels.length > 0) {
                        onSelectChannel(serverChannels[0].id);
                      }
                    }
                  }}
                >
                  {/* Active indicator (small square in top-left) */}
                  {isActiveText && (
                    <div
                      className="absolute -top-0.5 -left-0.5 w-2 h-2 bg-[#eb459e] rounded-full pointer-events-none"
                      style={{
                        boxShadow:
                          '0 0 4px 2px rgba(235, 69, 158, 0.464), 0 0 6px 3px rgba(235, 69, 158, 0.392), 0 0 8px 5px rgba(235, 69, 158, 0.28)',
                      }}
                    />
                  )}

                  {/* Server Icon */}
                  <div
                    className={`
                      rounded-full flex items-center justify-center
                      transition-all duration-150
                      hover:scale-110
                    `}
                    style={{
                      width: '48px',
                      height: '48px',
                    }}
                  >
                    {isActiveText ? (
                      <div
                        onAnimationIteration={(e: React.AnimationEvent) => {
                          const time = e.animationName;
                          if (time !== undefined) {
                            // Animate the ring color
                            e.currentTarget.style.borderRadius =
                              e.animationName === 'animate-rotate'
                                ? '0%'
                                : e.animationName === 'animate-rotate-1'
                                  ? '12.5%'
                                  : e.animationName === 'animate-rotate-2'
                                    ? '25%'
                                    : e.animationName === 'animate-rotate-3'
                                      ? '37.5%'
                                      : e.animationName === 'animate-rotate-4'
                                        ? '50%'
                                        : e.animationName === 'animate-rotate-5'
                                          ? '62.5%'
                                          : e.animationName === 'animate-rotate-6'
                                            ? '75%'
                                            : e.animationName === 'animate-rotate-7'
                                              ? '87.5%'
                                              : '100%';
                          }
                        }}
                        onEnd={() => {
                          // Animate to full circle
                          e.currentTarget.style.borderRadius = '50%';
                        }}
                        className="animate-rotate"
                      >
                        {/* Inner rotating ring */}
                        <div
                          style={{
                            animation: 'rotate 4s infinite linear',
                            animationName: 'rotate',
                            animationTimingFunction: 'linear',
                            animationIterationCount: 'infinite',
                            transformOrigin: '50% 50%',
                          }}
                          className="absolute inset-0 rounded-full pointer-events-none"
                        />
                      </div>
                    ) : (
                      <div
                        style={{
                          animation: 'spin 0.5s ease-in-out infinite',
                          animationPlayState: 'paused',
                          animationDirection: 'normal',
                          animationIterationCount: 'infinite',
                          animationTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                        className="w-full h-full"
                      />
                    )}
                  </div>

                  {/* Server Sidebar */}
                  <div
                    className="absolute bottom-1 left-0 right-0 flex items-center px-1"
                    style={{ animation: 'none' }}
                  >
                    {showServers && (
                      <div className="flex w-full items-center gap-1">
                        <div
                          className="rounded-full hover:bg-[#35373c] transition-colors"
                          style={{
                            backgroundImage:
                              'linear-gradient(135deg, #5865F2, #4752c4)',
                            borderRadius: '4px',
                          }}
                        />
                        <div
                          className="w-[2px] h-4 flex-shrink-0"
                          style={{
                            background:
                              'linear-gradient(to bottom, transparent, #797979, transparent)',
                          }}
                        />
                        <div
                          className="flex-1 relative"
                          style={{
                            backgroundImage: 'linear-gradient(135deg, #5865F2, #4752C4)',
                            backgroundPosition: `${-serverWidth / 48}% 0`,
                            backgroundSize: `${serverWidth / 48 * 64}% 100%`,
                            height: '1rem', // 16px
                            top: '-0.1875rem', // -3px
                            zIndex: 2,
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Channels Column */}
        <div
          className="overflow-y-auto overflow-x-hidden flex flex-col px-3 pt-5 pb-2 custom-scrollbar"
          style={{
            width: 'calc(100% - 240px)',
            maxWidth: '480px',
          }}
        >
          <div
            className="h-full pb-2 overflow-y-auto custom-scrollbar relative z-[-1]"
            style={{ height: 'calc(100% - 64px)', overflowY: 'auto', overflowX: 'hidden' }}
          >
            {/* Header Row */}
            <div className="flex items-center justify-between py-1.5 pl-2 pr-4">
              <div className="flex gap-1 relative">
                {showServers && (
                  <button
                    aria-expanded={true}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        onToggleServers();
                      }
                    }}
                    className="relative p-0.5 transition-all duration-75 ease-linear cursor-pointer group"
                    style={{
                      width: showServers ? 64 : 0,
                      height: 32,
                      background: 'none',
                      border: 'none',
                      outline: 'none',
                      color: 'transparent',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: '-2px',
                        left: '0',
                        right: '0',
                        height: '3px',
                        background: 'linear-gradient(-90deg, rgba(88, 101, 242, 0), rgba(88, 101, 242, 1))',
                        borderRadius: '2px',
                        opacity: 0,
                        transition: 'all 0.75s ease',
                      }}
                    />
                  </button>
                )}

                <div
                  className="flex items-center gap-1 pr-2"
                  style={{
                    alignItems: 'center',
                    minHeight: 32,
                  }}
                >
                  <div className="relative">
                    <div
                      className="flex items-center justify-center p-0.5 rounded-md"
                      style={{
                        width: '18px',
                        height: '18px',
                        marginRight: '2px',
                        transition:
                          'border-width 0.75s ease 0.15s, background-color 0.14s ease 0.15s, transform 0.075s ease, box-shadow 0.08s ease-in-out',
                      }}
                    >
                      <div
                        className="flex items-center p-0.5 border rounded"
                        style={{
                          borderColor: 'transparent',
                          transition: 'border-width 0.75s ease 0s',
                        }}
                      />
                    </div>
                  </div>
                  <div
                    className="group flex items-center justify-center outline-none"
                    style={{
                      minWidth: 52,
                      height: 32,
                    }}
                  >
                    <span
                      className="transition-[font-size] duration-150 ease-in-out"
                      style={{
                        fontSize: '15px',
                        fontWeight: 500,
                        color: currentThemeColors.channelText,
                        opacity: 1,
                        transform: 'translateY(0)',
                      }}
                    >
                      CURRENT CHANNELS
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Channel List */}
            {channels !== undefined &&
              Object.values(channelCategoryMap).map((categoryChannels, catIndex) => (
                <React.Fragment key={catIndex}>
                  {catIndex > 0 && (
                    <div
                      className="my-2 h-[1px] transition-all duration-500"
                      style={{
                        background: currentThemeColors.sectionBorder,
                        visibility: 'visible',
                      }}
                    />
                  )}
                  <div
                    className="flex items-center overflow-hidden cursor-pointer pr-2 rounded-md"
                    style={{
                      padding: '4px 7px 4px 2px',
                      background: currentThemeColors.channelBg,
                      gap: '0px',
                    }}
                  >
                    <div
                      className="transition-colors duration-100"
                      style={{
                        color: currentThemeColors.channelIcon,
                        transition: 'color 0.15s ease-in-out',
                      }}
                    >
                      <ChannelIcon name="hash" size={16} />
                    </div>
                    <div
                      className="flex-1 font-semibold flex items-center flex-shrink-0 overflow-hidden"
                      style={{
                        color: currentThemeColors.categoryHeader,
                        fontSize: 15,
                      }}
                    >
                      <span
                        className="truncate"
                        style={{
                          transition: 'transform 0.15s ease-in-out, opacity 0.15s ease-in-out',
                        }}
                      >
                        {categoryChannels[0]?.categoryName || `Category #${catIndex}`}
                      </span>
                    </div>
                  </div>

                  {categoryChannels.map((channel) => {
                    const isActive =
                      currentChannelId && currentChannelId === channel.id;
                    const isChannelInCurrentServer = channel.guildId === guildId;
                    const [hoverOpacity, hoverScale, setHoverActive] =
                      useHoverAnimation(hoveredChannel === channel.id, 1.05, 120);

                    return (
                      <div
                        key={channel.id}
                        className="group relative flex items-center py-[3px] px-2"
                      >
                        <div
                          className={`
                            relative flex items-center text-sm font-normal
                            cursor-pointer transition-colors duration-150
                            hover:${currentThemeColors.channelHoverBg}
                            ${isActive ? '' : ''}
                          `}
                          style={{
                            color: isActive ? currentThemeColors.channelActiveText : currentThemeColors.channelText,
                            fontSize: '13px',
                            flexShrink: 0,
                            borderRadius: '2px',
                          }}
                          onClick={() => handleSelect(channel.id, {} as React.MouseEvent)}
                          onMouseEnter={() => setHoverActive(true)}
                          onMouseLeave={() => setHoverActive(false)}
                          style={{
                            display: 'flex',
                            width: '100%',
                            alignItem: 'center',
                            gap: '7px',
                            transition: 'transform 0.08s ease-in',
                            transform: hoverScale ? 'scale(1.04)' : 'scale(1)',
                          }}
                        >
                          {/* Channel Icon */}
                          <div
                            className="flex flex-shrink-0 items-center"
                            style={{
                              marginTop: '3px',
                              marginRight: '8px',
                              width: 20,
                              height: 20,
                              transitionDuration: '0.075s',
                            }}
                          >
                            <ChannelIcon name={channel.type === 'voice' ? 'audio' : 'hash'} size={16} />
                          </div>

                          {/* Channel Name */}
                          <div
                            className="truncate flex items-center flex-col"
                            style={{
                              minWidth: 0,
                              fontSize: 14,
                              marginRight: 0,
                              display: 'flex',
                              flexDirection: 'column',
                            }}
                          >
                            <div
                              className="relative truncate whitespace-nowrap"
                              style={{
                                color: isActive
                                  ? currentThemeColors.channelActiveText
                                  : currentThemeColors.channelText,
                                transition: 'opacity 0.075s linear',
                                opacity: 1,
                              }}
                            >
                              {isChannelInCurrentServer ? (
                                <span
                                  className="whitespace-nowrap text-ellipsis overflow-hidden"
                                  style={{ fontSize: 14 }}
                                >
                                  {channel.name}
                                </span>
                              ) : (
                                <span
                                  className="whitespace-nowrap text-ellipsis overflow-hidden"
                                  style={{ fontSize: 12 }}
                                >
                                  {channel.name}
                                </span>
                              )}
                            </div>
                            {showServers && channel.type === 'voice' && (
                              <span className="absolute left-0 bottom-[-1.5px] flex items-center">
                                <ChannelIcon name="audio" size={12} />
                              </span>
                            )}
                          </div>

                          {/* Active Background */}
                          {isActive && (
                            <div
                              className="absolute left-[-9px] top-0 bottom-0 w-[3px] rounded-r"
                              style={{
                                background: currentThemeColors.channelActiveBg,
                                left: '-8px',
                                  bottom: 3,
                                  top: 3,
                                  height: 'calc(100% - 6px)',
                                  borderRadius: '2px',
                                  zIndex: 1,
                              }}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
          </div>
        </div>
      </div>

      {/* User Panel */}
      <div
        className="flex items-center gap-2 p-2"
        style={{ background: currentThemeColors.sidebarBg }}
      >
        <div className="relative w-7 h-7 flex-shrink-0" style={{ height: 28 }}>
          <div style={{ height: '100%', width: '100%' }} className="rounded-full" />
        </div>

        {/* User Info */}
        <div className="flex-1 relative min-w-0">
          <div className="truncate">
            <div
              className="text-[12px] text-[#dbdee1] font-medium"
              style={{ color: currentThemeColors.channelText, fontSize: 12 }}
            >
              You
            </div>
          </div>
          <div
            className="flex items-center gap-1 truncate"
            style={{
              color: currentThemeColors.sectionBorder,
              fontSize: 11,
              opacity: 1,
            }}
          >
            <div
              className="w-[12px] h-[12px] flex-shrink-0 rounded-full"
              style={{
                background:
                  theme === 'dark'
                    ? 'linear-gradient(180deg, rgba(59, 165, 92, 0) 0%, #3ba55c 100%)'
                    : 'linear-gradient(180deg, rgba(106, 191, 123, 0.5) 0%, #43b581 100%)',
                transitionDuration: '0.08s',
              }}
            />
            <div
              className="truncate"
              style={{
                transition: 'transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                transform: 'translateX(0)',
              }}
            >
              <span
                className="block text-[11px]"
                style={{ color: currentThemeColors.sectionBorder, fontSize: 11 }}
              >
                Online
              </span>
            </div>
          </div>
        </div>

        {/* User Panel */}
        <div
          className="group w-[280px] flex-shrink-0 ml-auto cursor-pointer hidden md:flex"
        >
          <div className="rounded-md flex flex-col justify-center overflow-hidden px-2 py-1.5">
            <div className="flex flex-col truncate">
              <div
                className="outline-none"
                style={{
                  fontSize: 13,
                  color: currentThemeColors.channelText,
                  lineHeight: 16,
                  marginLeft: 0,
                }}
              >
                <span
                  className="truncate"
                  style={{ color: currentThemeColors.channelText, fontSize: 13 }}
                >
                  Your Name
                </span>
              </div>
              <div
                className="flex items-center gap-2 truncate"
                style={{
                  fontSize: 11,
                  color: currentThemeColors.inputPlaceholder,
                  lineHeight: 12,
                  marginTop: 0,
                }}
              >
                <span
                  className="truncate"
                  style={{ color: currentThemeColors.sectionBorder, fontSize: 11 }}
                >
                  Your name
                </span>
                <div
                  className="group relative overflow-hidden flex items-center p-0.5 w-2.5 h-[14px] rounded cursor-pointer transition-colors"
                  style={{
                    transition: 'background-color 0.1s ease-in-out',
                  }}
                >
                  <div
                    className="absolute left-0 top-0 bottom-0 w-[1px]"
                    style={{
                      background: 'linear-gradient(to bottom, transparent, #72767d, transparent)',
                      right: 0,
                      transition: 'opacity 0.1s ease-in-out',
                    }}
                  />
                </div>
                <div
                  className="w-[6px] h-[6px]"
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(59, 165, 92, 0) 0%, #3ba55c 100%)',
                    transitionDuration: '0.08s',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default ChannelSidebar;</parameter>
</function>
</tool_call>
<tool_call>
<function=write>
<parameter=path>
/Users/macos/Downloads/arambh-opencode-local-harness-v2/workspace/Discord/openconcord/src/ui/components/FocusHint.tsx