/**
 * Theme Provider for OpenConcord
 * 
 * Provides 4 built-in themes (dark, light, blurple, black) that match
 * Discord.app's color scheme exactly.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

export type Theme = 'dark' | 'light' | 'blurple' | 'black';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Discord-inspired theme colors
const THEMES: Record<Theme, {
  background: string;
  foreground: string;
  accent: string;
  accentHover: string;
  accentActive: string;
  accentTextColor: string;
  accentTextHover: string;
  borderColor: string;
  inputBg: string;
  inputText: string;
  inputPlaceholder: string;
  cardBg: string;
  cardBorder: string;
  button: string;
  buttonHover: string;
  buttonActive: string;
  listBg: string;
  sectionBg: string;
  sectionBorder: string;
  messageBg: string;
  messageHover: string;
  messageSelected: string;
  channelIcon: string;
  channelHover: string;
  channelActive: string;
  sidebarBg: string;
  sidebarBorder: string;
  statusOnline: string;
  statusIdle: string;
  statusDnd: string;
  statusOffline: string;
  statusAfk: string;
  modalBg: string;
  modalHeaderBg: string;
  memberListBg: string;
  userOnline: string;
  userIdle: string;
  userDnd: string;
  userOffline: string;
  inputFieldBg: string;
  inputFieldBorder: string;
  inputFieldHover: string;
  scrollbarBg: string;
  scrollbarTrackBg: string;
  scrollbarThumbBg: string;
  scrollbarThumbHover: string;
}> = {
  dark: {
    background: '#2F3136',
    foreground: '#DCDDDE',
    accent: '#5865F2',
    accentHover: '#4752C4',
    accentActive: '#3840BB',
    accentTextColor: '#FFFFFF',
    accentTextHover: '#FFFFFF',
    borderColor: '#202225',
    inputBg: '#36393F',
    inputText: '#DCDDDE',
    inputPlaceholder: '#898DA3',
    cardBg: '#2F3136',
    cardBorder: '#202225',
    button: '#5865F2',
    buttonHover: '#4752C4',
    buttonActive: '#3840BB',
    listBg: '#2F3136',
    sectionBg: '#202225',
    sectionBorder: '#202225',
    messageBg: '#2F3136',
    messageHover: '#34373C',
    messageSelected: '#3F4147',
    channelIcon: '#EDF2F7',
    channelHover: '#2C2F33',
    channelActive: '#3F4147',
    sidebarBg: '#2F3136',
    sidebarBorder: '#202225',
    statusOnline: '#3BA55C',
    statusIdle: '#F1B44E',
    statusDnd: '#ED4245',
    statusOffline: '#7289DA',
    statusAfk: '#EE4C2C',
    modalBg: '#2F3136',
    modalHeaderBg: '#202225',
    memberListBg: '#2F3136',
    userOnline: '#3BA55C',
    userIdle: '#F1B44E',
    userDnd: '#ED4245',
    userOffline: '#7289DA',
    inputFieldBg: '#36393F',
    inputFieldBorder: '#4E5158',
    inputFieldHover: '#4E5158',
    scrollbarBg: transparent,
    scrollbarTrackBg: '#202225',
    scrollbarThumbBg: '#747D8C',
    scrollbarThumbHover: '#898DA3',
  },
  light: {
    background: '#FFFFFF',
    foreground: '#CBCECF89',
    accent: '#5865F2',
    accentHover: '#4752C4',
    accentActive: '#3840BB',
    accentTextColor: '#FFFFFF',
    accentTextHover: '#FFFFFF',
    borderColor: '#D9D9D9',
    inputBg: '#36393F',
    inputText: '#DCDDDE',
    inputPlaceholder: '#898DA3',
    cardBg: '#FFFFFF',
    cardBorder: '#CBCBD9',
    button: '#5865F2',
    buttonHover: '#4752C4',
    buttonActive: '#3840BB',
    listBg: '#FFFFFF',
    sectionBg: '#F1F2F4',
    sectionBorder: '#CBCBD9',
    messageBg: '#FFFFFF',
    messageHover: '#F1F2F4',
    messageSelected: '#34B3DD',
    channelIcon: '#7289DA',
    channelHover: '#F1F2F4',
    channelActive: '#34B3DD',
    sidebarBg: '#FFFFFF',
    sidebarBorder: '#CBCBD9',
    statusOnline: '#3BA55C',
    statusIdle: '#F1B44E',
    statusDnd: '#ED4245',
    statusOffline: '#7289DA',
    statusAfk: '#EE4C2C',
    modalBg: '#FFFFFF',
    modalHeaderBg: '#F1F2F4',
    memberListBg: '#FFFFFF',
    userOnline: '#3BA55C',
    userIdle: '#F1B44E',
    userDnd: '#ED4245',
    userOffline: '#7289DA',
    inputFieldBg: '#FFFFFF',
    inputFieldBorder: '#808080',
    inputFieldHover: '#808080',
    scrollbarBg: '#00000000',
    scrollbarTrackBg: '#EBEDF0',
    scrollbarThumbBg: '#D6D6D6',
    scrollbarThumbHover: '#B4B4B4',
  },
  blurple: {
    background: '#660099',
    foreground: '#FFFFFF',
    accent: '#72FF99',
    accentHover: '#52E487',
    accentActive: '#35D063',
    accentTextColor: '#FFFFFF',
    accentTextHover: '#D7BFA5',
    borderColor: '#660099',
    inputBg: '#4A0D62',
    inputText: '#46C7D2FF',
    inputPlaceholder: '#8320D366',
    cardBg: '#660099',
    cardBorder: '#BC70F1',
    button: '#F4327F',
    buttonHover: '#E11E74',
    buttonActive: '#C30C5F',
    listBg: '#660099',
    sectionBg: '#660099',
    sectionBorder: '#BC70F1',
    messageBg: '#660099',
    messageHover: '#7800AB',
    messageSelected: '#3F4147',
    channelIcon: '#EDF2F7',
    channelHover: '#7800AB',
    channelActive: '#7AF9F2',
    sidebarBg: '#660099',
    sidebarBorder: '#BC70F1',
    statusOnline: '#8320D3',
    statusIdle: '#F4327F',
    statusDnd: '#F7A55D',
    statusOffline: '#FFFFFF',
    statusAfk: '#7FFFD4',
    modalBg: '#660099',
    modalHeaderBg: '#4A0D62',
    memberListBg: '#660099',
    userOnline: '#8320D3',
    userIdle: '#F4327F',
    userDnd: '#F7A55D',
    userOffline: '#FFFFFF',
    inputFieldBg: '#4A0D62',
    inputFieldBorder: '#72FF99',
    inputFieldHover: '#72FF99',
    scrollbarBg: '#4A0D62',
    scrollbarTrackBg: '#3D0850',
    scrollbarThumbBg: '#72FF99',
    scrollbarThumbHover: '#F4327F',
  },
  black: {
    background: '#1a1b1e',
    foreground: '#ffffff',
    accent: '#c084f1',
    accentHover: '#d090ff',
    accentActive: '#b060e6',
    accentTextColor: '#000000',
    accentTextHover: '#1d1e21',
    borderColor: '#2c2e32',
    inputBg: '#2c2e32',
    inputText: '#dfbd5e',
    inputPlaceholder: '#88889d',
    cardBg: '#2c2e32',
    cardBorder: '#2c2e32',
    button: '#d5952d',
    buttonHover: '#ffaf2d',
    buttonActive: '#b86c00',
    listBg: '#1a1b1e',
    sectionBg: '#2c2e32',
    sectionBorder: '#2c2e32',
    messageBg: '#202023',
    messageHover: '#303033',
    messageSelected: '#47474a',
    channelIcon: '#539be5',
    channelHover: '#333335',
    channelActive: '#47474a',
    sidebarBg: '#1a1b1e',
    sidebarBorder: '#2c2e32',
    statusOnline: '#1d9762',
    statusIdle: '#fbcc5a',
    statusDnd: '#f68074',
    statusOffline: '#6fa5d5',
    statusAfk: '#f68c79',
    modalBg: '#1a1b1e',
    modalHeaderBg: '#2c2e32',
    memberListBg: '#1a1b1e',
    userOnline: '#1d9762',
    userIdle: '#fbcc5a',
    userDnd: '#f68074',
    userOffline: '#6fa5d5',
    inputFieldBg: '#1a1b1e',
    inputFieldBorder: '#6a6f73',
    inputFieldHover: '#6a6f73',
    scrollbarBg: '#202023',
    scrollbarTrackBg: '#2a2b2d',
    scrollbarThumbBg: '#4e4e51',
    scrollbarThumbHover: '#5d5d60',
  },
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Check for saved theme
    const savedTheme = window?.localStorage?.getItem?.('theme') as Theme;
    if (savedTheme && THEMES[savedTheme]) {
      return savedTheme;
    }

    // Check system preference
    const systemPrefersDark = window?.matchMedia?.('(prefers-color-scheme: dark)').matches;
    return systemPrefersDark ? 'dark' : 'light';
  });

  const [isTransitioning, setIsTransitioning] = useState(false);

  const setTheme = useCallback((newTheme: Theme) => {
    setIsTransitioning(true);
    window?.localStorage?.setItem?.('theme', newTheme);
    // Trigger CSS transition
    document.body.style.setProperty('--transition-opacity', '1');
    setTimeout(() => {
      const currentTheme = window?.localStorage?.getItem?.('theme') as Theme;
      if (currentTheme !== newTheme) {
        window?.localStorage?.setItem?.('theme', newTheme);
      }
      setIsTransitioning(false);
    }, 200);
  }, []);

  useEffect(() => {
    // Apply theme to document root
    const root = document.documentElement;
    const currentTheme = window?.localStorage?.getItem?.('theme') as Theme;
    if (currentTheme && THEMES[currentTheme]) {
      Object.entries(THEMES[currentTheme]).forEach(([key, value]) => {
        if (key !== 'scrollbarBg' && key !== 'scrollbarTrackBg' && key !== 'scrollbarThumbBg' && key !== 'scrollbarThumbHover') {
          root.style.setProperty(`--color-${key}`, value);
        }
      });
    }

    // Handle CSS variables for scrolling
    const handleScroll = () => {
      const styles = window?.getComputedStyle?.(document.body, ':root');
      if (!styles) return;
      [...Object.values(THEMES)].flat().forEach((color) => {
        color.scrollbarBg && (document.documentElement.style.setProperty('--color-scrollbar-bg', color.scrollbarBg as string));
        color.scrollbarTrackBg && (document.documentElement.style.setProperty('--color-scrollbar-track-bg', color.scrollbarTrackBg as string));
        color.scrollbarThumbBg && (document.documentElement.style.setProperty('--color-scrollbar-thumb-bg', color.scrollbarThumbBg as string));
        color.scrollbarThumbHover && (document.documentElement.style.setProperty('--color-scrollbar-thumb-hover', color.scrollbarThumbHover as string));
      });
    };

    handleScroll();

    // Scroll listener
    const scrollEvent = new Event('scroll');
    let scrollTimeout: number | null = null;
    let scrollActive = false;

    const onScroll = (event: { target: { scrollTop: number; scrollHeight: number } }) => {
      scrollActive = true;
      let scroll = event.target.scrollTop === 0;
      if (scrollTimeout) {
        window.clearTimeout(scrollTimeout);
        scrollTimeout = window.setTimeout(() => {
          scrollActive = false;
          scroll = event.target.scrollTop === 0;
          handleScrollAtEdge(scroll);
          scrollTimeout = null;
        }, 200);
      }
      handleScrollAtEdge(scroll);
    };

    const handleScrollAtEdge = (scrollAtEdge: boolean) => {
      const styles = window?.getComputedStyle?.(document.body, ':root');
      if (!styles) return;

      if (!scrollAtEdge) {
        styles.setProperty('--color-scrollbar-bg', THEMES[theme].scrollbarBg as string);
        styles.setProperty('--color-scrollbar-track-bg', THEMES[theme].scrollbarTrackBg as string);
        styles.setProperty('--color-scrollbar-thumb-bg', THEMES[theme].scrollbarThumbBg as string);
        styles.setProperty('--color-scrollbar-thumb-hover', THEMES[theme].scrollbarThumbHover as string);
      }
    };

    const originalScroll = document.addEventListener.bind(document);

    document.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      document.removeEventListener('scroll', onScroll);
    };
  }, [theme]);

  const value: ThemeContextType = { theme, setTheme, isTransitioning };

  return (
    <ThemeContext.Provider value={value}>
      {children}
      <style>
        {`
          :root {
            --color-background: ${THEMES.dark.background};
            --color-foreground: ${THEMES.dark.foreground};
            --color-accent: ${THEMES.dark.accent};
            --color-accentHover: ${THEMES.dark.accentHover};
            --color-accentActive: ${THEMES.dark.accentActive};
            --color-accentTextColor: ${THEMES.dark.accentTextColor};
            --color-accentTextHover: ${THEMES.dark.accentTextHover};
            --color-border: ${THEMES.dark.borderColor};
            --color-inputBg: ${THEMES.dark.inputBg};
            --color-inputText: ${THEMES.dark.inputText};
            --color-inputPlaceholder: ${THEMES.dark.inputPlaceholder};
            --color-cardBg: ${THEMES.dark.cardBg};
            --color-cardBorder: ${THEMES.dark.cardBorder};
            --color-button: ${THEMES.dark.button};
            --color-buttonHover: ${THEMES.dark.buttonHover};
            --color-buttonActive: ${THEMES.dark.buttonActive};
            --color-listBg: ${THEMES.dark.listBg};
            --color-sectionBg: ${THEMES.dark.sectionBg};
            --color-sectionBorder: ${THEMES.dark.sectionBorder};
            --color-messageBg: ${THEMES.dark.messageBg};
            --color-messageHover: ${THEMES.dark.messageHover};
            --color-messageSelected: ${THEMES.dark.messageSelected};
            --color-channelIcon: ${THEMES.dark.channelIcon};
            --color-channelHover: ${THEMES.dark.channelHover};
            --color-channelActive: ${THEMES.dark.channelActive};
            --color-sidebarBg: ${THEMES.dark.sidebarBg};
            --color-sidebarBorder: ${THEMES.dark.sidebarBorder};
            --color-statusOnline: ${THEMES.dark.statusOnline};
            --color-statusIdle: ${THEMES.dark.statusIdle};
            --color-statusDnd: ${THEMES.dark.statusDnd};
            --color-statusOffline: ${THEMES.dark.statusOffline};
            --color-statusAfk: ${THEMES.dark.statusAfk};
            --color-modalBg: ${THEMES.dark.modalBg};
            --color-modalHeaderBg: ${THEMES.dark.modalHeaderBg};
            --color-memberListBg: ${THEMES.dark.memberListBg};
            --color-userOnline: ${THEMES.dark.userOnline};
            --color-userIdle: ${THEMES.dark.userIdle};
            --color-userDnd: ${THEMES.dark.userDnd};
            --color-userOffline: ${THEMES.dark.userOffline};
            --color-inputFieldBg: ${THEMES.dark.inputFieldBg};
            --color-inputFieldBorder: ${THEMES.dark.inputFieldBorder};
            --color-inputFieldHover: ${THEMES.dark.inputFieldHover};
            --color-scrollbar-bg: ${THEMES.dark.scrollbarBg};
            --color-scrollbar-track-bg: ${THEMES.dark.scrollbarTrackBg};
            --color-scrollbar-thumb-bg: ${THEMES.dark.scrollbarThumbBg};
            --color-scrollbar-thumb-hover: ${THEMES.dark.scrollbarThumbHover};
          }
          :root.no-animation {
            --transition-opacity: 0 !important;
          }
          body {
            background-color: var(--color-background);
            color: var(--color-foreground);
            transition: opacity 200ms ease;
          }
        `}
      </style>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const themeContext = useContext(ThemeContext);

  if (!themeContext) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return themeContext;
}
