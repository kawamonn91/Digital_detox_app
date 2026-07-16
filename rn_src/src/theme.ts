/**
 * theme.ts
 * デザインシステム — カラー、フォント、半径定数
 */

export const COLORS = {
  bgPrimary: '#0a0a1a',
  bgSecondary: '#0f0f2e',
  bgCard: 'rgba(255,255,255,0.04)',
  bgCardHover: 'rgba(255,255,255,0.07)',
  glassBorder: 'rgba(255,255,255,0.08)',
  glassBorderHover: 'rgba(255,255,255,0.15)',

  purple400: '#a78bfa',
  purple500: '#8b5cf6',
  purple600: '#7c3aed',
  blue400: '#60a5fa',
  blue500: '#3b82f6',
  cyan400: '#22d3ee',
  green400: '#4ade80',
  green500: '#22c55e',
  red400: '#f87171',
  red500: '#ef4444',
  orange400: '#fb923c',
  yellow400: '#facc15',

  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#475569',
};

export const FONTS = {
  sans: 'Inter',           // 本体フォント（システムフォントでも可）
  grotesk: 'SpaceGrotesk', // 数値・タイトル用（プロジェクト初期化後にインストール）
};

export const RADIUS = {
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const SHADOWS = {
  purple: {
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  green: {
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  red: {
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
};
