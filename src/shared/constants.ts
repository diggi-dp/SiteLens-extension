export const EXTENSION_NAME = 'SiteLens';
export const EXTENSION_VERSION = '1.0.0';

// CSS Properties grouped by category
export const CSS_CATEGORIES = {
  layout: [
    'display', 'position', 'top', 'right', 'bottom', 'left',
    'float', 'clear', 'z-index', 'overflow', 'overflow-x', 'overflow-y',
    'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'align-content',
    'flex-grow', 'flex-shrink', 'flex-basis', 'order', 'gap',
    'grid-template-columns', 'grid-template-rows', 'grid-column', 'grid-row',
  ],
  sizing: [
    'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
    'box-sizing',
  ],
  spacing: [
    'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  ],
  typography: [
    'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant',
    'line-height', 'letter-spacing', 'word-spacing', 'text-align', 'text-decoration',
    'text-transform', 'text-indent', 'text-shadow', 'white-space', 'word-break',
    'word-wrap', 'color',
  ],
  background: [
    'background', 'background-color', 'background-image', 'background-position',
    'background-size', 'background-repeat', 'background-attachment', 'background-clip',
  ],
  border: [
    'border', 'border-width', 'border-style', 'border-color',
    'border-top', 'border-right', 'border-bottom', 'border-left',
    'border-radius', 'border-top-left-radius', 'border-top-right-radius',
    'border-bottom-right-radius', 'border-bottom-left-radius',
    'outline', 'outline-width', 'outline-style', 'outline-color', 'outline-offset',
  ],
  effects: [
    'opacity', 'box-shadow', 'filter', 'backdrop-filter', 'mix-blend-mode',
    'transform', 'transform-origin', 'perspective',
  ],
  animation: [
    'transition', 'transition-property', 'transition-duration',
    'transition-timing-function', 'transition-delay',
    'animation', 'animation-name', 'animation-duration',
    'animation-timing-function', 'animation-delay', 'animation-iteration-count',
    'animation-direction', 'animation-fill-mode',
  ],
} as const;

// Key CSS properties to always show in smart inspector
export const SMART_INSPECTOR_PROPS = [
  'display', 'position', 'width', 'height',
  'padding', 'margin',
  'background-color', 'color',
  'font-family', 'font-size', 'font-weight', 'line-height',
  'border', 'border-radius',
  'box-shadow', 'opacity',
  'flex-direction', 'justify-content', 'align-items', 'gap',
];

// Known design system signatures
export const DESIGN_SYSTEMS = [
  { name: 'Tailwind CSS', classPatterns: [/^(sm|md|lg|xl|2xl):/, /^(flex|grid|text|bg|border|rounded|shadow|p|m|w|h)-/] },
  { name: 'Bootstrap', classPatterns: [/^(col|row|container|btn|card|nav|modal|badge|alert)-/, /^d-(flex|grid|block|none)/] },
  { name: 'Material UI', classPatterns: [/^Mui/, /^MuiTypography/, /^css-[a-z0-9]+$/] },
  { name: 'Ant Design', classPatterns: [/^ant-/] },
  { name: 'Chakra UI', classPatterns: [/^chakra-/] },
  { name: 'Bulma', classPatterns: [/^(is-|has-|columns|column|section|hero|tile)/] },
] as const;

// Color format defaults
export const COLOR_FORMATS = ['hex', 'rgb', 'hsl'] as const;

// WCAG Contrast Ratios
export const WCAG = {
  AA_NORMAL: 4.5,
  AA_LARGE: 3,
  AAA_NORMAL: 7,
  AAA_LARGE: 4.5,
} as const;

// Tab navigation
export const TABS = [
  { id: 'overview', label: 'Overview', icon: '◎' },
  { id: 'colors', label: 'Colors', icon: '◆' },
  { id: 'typography', label: 'Typography', icon: 'Aa' },
  { id: 'assets', label: 'Assets', icon: '▣' },
  { id: 'spacing', label: 'Spacing', icon: '⊞' },
] as const;

// Keyboard shortcuts
export const SHORTCUTS = {
  TOGGLE_INSPECTOR: { key: 'i', modifier: 'Alt' },
  TOGGLE_THEME: { key: 't', modifier: 'Alt' },
  TOGGLE_SIDEBAR: { key: 's', modifier: 'Alt' },
  COPY_CSS: { key: 'c', modifier: 'Alt' },
  SEARCH: { key: 'k', modifier: 'Alt' },
  ESCAPE: { key: 'Escape' },
} as const;
