// ==========================================
// Message Types for Chrome Extension Messaging
// ==========================================

export const MessageType = {
  // Panel
  TOGGLE_PANEL: 'TOGGLE_PANEL',

  // Inspection
  TOGGLE_INSPECTOR: 'TOGGLE_INSPECTOR',
  START_INSPECTION: 'START_INSPECTION',
  INSPECT_ELEMENT: 'INSPECT_ELEMENT',
  ELEMENT_SELECTED: 'ELEMENT_SELECTED',
  ELEMENT_HOVERED: 'ELEMENT_HOVERED',
  STOP_INSPECTION: 'STOP_INSPECTION',
  INSPECTION_STARTED: 'INSPECTION_STARTED',
  
  // Page Analysis
  GET_PAGE_COLORS: 'GET_PAGE_COLORS',
  GET_PAGE_TYPOGRAPHY: 'GET_PAGE_TYPOGRAPHY',
  GET_PAGE_ASSETS: 'GET_PAGE_ASSETS',
  GET_PAGE_GRADIENTS: 'GET_PAGE_GRADIENTS',
  GET_PAGE_OVERVIEW: 'GET_PAGE_OVERVIEW',
  
  // Results
  PAGE_COLORS_RESULT: 'PAGE_COLORS_RESULT',
  PAGE_TYPOGRAPHY_RESULT: 'PAGE_TYPOGRAPHY_RESULT',
  PAGE_ASSETS_RESULT: 'PAGE_ASSETS_RESULT',
  PAGE_GRADIENTS_RESULT: 'PAGE_GRADIENTS_RESULT',
  PAGE_OVERVIEW_RESULT: 'PAGE_OVERVIEW_RESULT',
  
  // Mode
  SET_MODE: 'SET_MODE',
  OPEN_SIDE_PANEL: 'OPEN_SIDE_PANEL',
  CLOSE_FLOATING_PANEL: 'CLOSE_FLOATING_PANEL',
  CLOSE_SIDE_PANEL: 'CLOSE_SIDE_PANEL',
  
  // Lifecycle
  REFRESH_PAGE_DATA: 'REFRESH_PAGE_DATA',
  CLEANUP: 'CLEANUP',

  // Status
  PING: 'PING',
  PONG: 'PONG',

  // Insights
  FETCH_URL: 'FETCH_URL',
  GET_ACTIVE_TAB_URL: 'GET_ACTIVE_TAB_URL',
  GET_PAGE_METADATA: 'GET_PAGE_METADATA',
  GET_DETAILED_PERF: 'GET_DETAILED_PERF',
} as const;

export type MessageType = (typeof MessageType)[keyof typeof MessageType];

export interface ExtensionMessage {
  type: MessageType;
  payload?: unknown;
}

// ==========================================
// CSS & Style Types
// ==========================================

export interface BoxModel {
  width: number;
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
  padding: { top: number; right: number; bottom: number; left: number };
  border: { top: number; right: number; bottom: number; left: number };
}

export interface ElementInfo {
  tagName: string;
  id: string;
  classList: string[];
  selector: string;
  boxModel: BoxModel;
  computedStyles: Record<string, string>;
  authoredStyles?: Record<string, string>;
  cssRules: CSSRuleInfo[];
  pseudoElements: PseudoElementInfo[];
  position: { x: number; y: number };
  dimensions: { width: number; height: number };
  accessibility: AccessibilityInfo;
  svgCode?: string;
}

export interface CSSRuleInfo {
  selector: string;
  properties: Record<string, string>;
  source: string;
  specificity: string;
}

export interface PseudoElementInfo {
  type: string; // ::before, ::after, etc.
  styles: Record<string, string>;
  content: string;
}

export interface AccessibilityInfo {
  role: string;
  ariaLabel: string;
  contrastRatio: number;
  wcagAA: boolean;
  wcagAAA: boolean;
  textColor: string;
  bgColor: string;
}

// ==========================================
// Color Types
// ==========================================

export interface ColorInfo {
  hex: string;
  rgb: { r: number; g: number; b: number; a: number };
  hsl: { h: number; s: number; l: number; a: number };
  count: number;
  category: ColorCategory;
  instances: ColorInstance[];
  cssVariable?: string;
}

export type ColorCategory = 'text' | 'background' | 'border' | 'shadow' | 'gradient' | 'other';

export interface ColorInstance {
  element: string;
  selector: string;
  property: string;
  value: string;
}

export interface GradientInfo {
  type: 'linear' | 'radial' | 'conic';
  raw: string;
  direction?: string;
  stops: GradientStop[];
  element: string;
  selector: string;
}

export interface GradientStop {
  color: string;
  position: string;
  hex: string;
}

// ==========================================
// Typography Types
// ==========================================

export interface FontInfo {
  family: string;
  variants: FontVariant[];
  count: number;
  source: 'google' | 'system' | 'custom' | 'unknown';
  instances: FontInstance[];
}

export interface FontVariant {
  weight: string;
  style: string;
  size: string;
  lineHeight: string;
  letterSpacing: string;
  color: string;
  count: number;
}

export interface FontInstance {
  element: string;
  selector: string;
  text: string;
  size: string;
  weight: string;
  lineHeight: string;
  letterSpacing: string;
  color: string;
  tagName: string;
}

export interface TypographyHierarchy {
  level: string; // h1, h2, h3, p, span, etc.
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  color: string;
  count: number;
}

// ==========================================
// Asset Types
// ==========================================

export interface AssetInfo {
  type: 'image' | 'svg' | 'icon' | 'video' | 'background';
  url: string;
  alt: string;
  dimensions: { width: number; height: number };
  fileSize?: number;
  format: string;
  element: string;
  selector: string;
}

// ==========================================
// Animation Types
// ==========================================

export interface AnimationInfo {
  name: string;
  duration: string;
  timingFunction: string;
  delay: string;
  iterationCount: string;
  direction: string;
  fillMode: string;
  keyframes?: KeyframeInfo[];
  element: string;
  selector: string;
}

export interface TransitionInfo {
  property: string;
  duration: string;
  timingFunction: string;
  delay: string;
  element: string;
  selector: string;
}

export interface KeyframeInfo {
  offset: string;
  properties: Record<string, string>;
}

// ==========================================
// Layout Types
// ==========================================

export interface LayoutInfo {
  display: string;
  flexbox?: FlexboxInfo;
  grid?: GridInfo;
  position: string;
  zIndex: string;
  overflow: string;
}

export interface FlexboxInfo {
  direction: string;
  wrap: string;
  justifyContent: string;
  alignItems: string;
  gap: string;
}

export interface GridInfo {
  columns: string;
  rows: string;
  gap: string;
  areas: string;
}

// ==========================================
// CSS Variable Types
// ==========================================

export interface CSSVariableInfo {
  name: string;
  value: string;
  resolvedValue: string;
  scope: string;
  usageCount: number;
  category: 'color' | 'spacing' | 'typography' | 'other';
}

// ==========================================
// Design System Detection
// ==========================================

export type Category = string;

export interface Detection {
  name: string;
  category: Category;
  confidence: number;
  evidence: string[];
  version?: string;
  website?: string;
}


// ==========================================
// Page Overview Types
// ==========================================

export interface PageOverview {
  url: string;
  title: string;
  colorCount: number;
  fontCount: number;
  assetCount: number;
  gradientCount: number;
  cssVariableCount: number;
  stack: Detection[];
}

// ==========================================
// Settings Types
// ==========================================

export type ThemeMode = 'dark' | 'light' | 'system';
export type InteractionMode = 'floating' | 'sidebar';

export interface Settings {
  theme: ThemeMode;
  mode: InteractionMode;
  showBoxModel: boolean;
  showGridOverlay: boolean;
  showAccessibility: boolean;
  colorFormat: 'hex' | 'rgb' | 'hsl';
  keyboardShortcutsEnabled: boolean;
}
