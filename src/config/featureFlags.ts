// ============================================
// SiteLens Feature Flag System
// Central typed configuration for feature gating
// ============================================

// ── Feature Names ────────────────────────────────────────────────────────────

/** All supported feature flag names — enforced at the type level. */
export type FeatureName =
  // Core (always‑on by default)
  | 'elementInspector'
  | 'colorExtraction'
  | 'typographyAnalysis'
  // Advanced
  | 'floatingWindow'
  | 'sidePanel'
  | 'advancedInspector'
  | 'assetGallery'
  | 'gradientExtraction'
  | 'domainInsights'
  | 'stackDetection'
  | 'measurementOverlay';

// ── Feature Categories ───────────────────────────────────────────────────────

export type FeatureCategory = 'core' | 'advanced' | 'experimental';

// ── Feature Registry ─────────────────────────────────────────────────────────

interface FeatureDefinition {
  /** Environment variable name (VITE_FEATURE_*) */
  envVar: string;
  /** Default value when env var is missing */
  defaultValue: boolean;
  /** Category grouping */
  category: FeatureCategory;
  /** Human‑readable description */
  description: string;
}

/**
 * Single source of truth for every feature flag.
 * Add new features here — the rest of the system picks them up automatically.
 */
export const FEATURE_REGISTRY: Record<FeatureName, FeatureDefinition> = {
  // ── Core ──────────────────────────────────────────────────────────────────
  elementInspector: {
    envVar: 'VITE_FEATURE_ELEMENT_INSPECTOR',
    defaultValue: true,
    category: 'core',
    description: 'Basic element selection and overview',
  },
  colorExtraction: {
    envVar: 'VITE_FEATURE_COLOR_EXTRACTION',
    defaultValue: true,
    category: 'core',
    description: 'Page color palette extraction',
  },
  typographyAnalysis: {
    envVar: 'VITE_FEATURE_TYPOGRAPHY_ANALYSIS',
    defaultValue: true,
    category: 'core',
    description: 'Font family and typography analysis',
  },

  // ── Advanced ──────────────────────────────────────────────────────────────
  floatingWindow: {
    envVar: 'VITE_FEATURE_FLOATING_WINDOW',
    defaultValue: true,
    category: 'core',
    description: 'Draggable/resizable floating panel iframe',
  },
  sidePanel: {
    envVar: 'VITE_FEATURE_SIDE_PANEL',
    defaultValue: true,
    category: 'advanced',
    description: 'Chrome Side Panel mode',
  },
  advancedInspector: {
    envVar: 'VITE_FEATURE_ADVANCED_INSPECTOR',
    defaultValue: true,
    category: 'advanced',
    description: 'Box model, motion, spacing, CSS preview panels',
  },
  assetGallery: {
    envVar: 'VITE_FEATURE_ASSET_GALLERY',
    defaultValue: true,
    category: 'advanced',
    description: 'Asset discovery and batch download',
  },
  gradientExtraction: {
    envVar: 'VITE_FEATURE_GRADIENT_EXTRACTION',
    defaultValue: true,
    category: 'advanced',
    description: 'CSS gradient extraction and preview',
  },
  domainInsights: {
    envVar: 'VITE_FEATURE_DOMAIN_INSIGHTS',
    defaultValue: true,
    category: 'advanced',
    description: 'DNS, WHOIS, SSL, performance, SEO analysis',
  },
  stackDetection: {
    envVar: 'VITE_FEATURE_STACK_DETECTION',
    defaultValue: true,
    category: 'advanced',
    description: 'Frontend technology stack detection',
  },
  measurementOverlay: {
    envVar: 'VITE_FEATURE_MEASUREMENT_OVERLAY',
    defaultValue: true,
    category: 'advanced',
    description: 'Alt+hover distance measurement between elements',
  },
} as const;

// ── Resolve Flags ────────────────────────────────────────────────────────────

/**
 * Read an env var at build time.
 * Vite replaces `import.meta.env.VITE_*` at compile time for panel/background.
 * For the content script (IIFE), values are injected via `define` in vite.config.ts.
 */
function readEnvFlag(envVar: string, defaultValue: boolean): boolean {
  try {
    // `import.meta.env` is available in Vite builds (panel, background).
    // For content script, Vite `define` pre-substitutes the value before this runs.
    const raw = (import.meta as any).env?.[envVar];
    if (raw === undefined || raw === null) return defaultValue;
    if (typeof raw === 'boolean') return raw;
    if (typeof raw === 'string') return raw.toLowerCase() !== 'false' && raw !== '0';
    return defaultValue;
  } catch {
    return defaultValue;
  }
}

/** Resolved boolean map of every feature flag — evaluated once at module load. */
export const featureFlags: Readonly<Record<FeatureName, boolean>> = (() => {
  const flags = {} as Record<FeatureName, boolean>;
  for (const [name, def] of Object.entries(FEATURE_REGISTRY)) {
    flags[name as FeatureName] = readEnvFlag(def.envVar, def.defaultValue);
  }
  return Object.freeze(flags);
})();

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Check if a feature is enabled.
 *
 * @param name  Typed feature name (autocompleted).
 * @param _user RESERVED — future user/permissions object. Currently ignored.
 *              When a permission system is added, this function will combine
 *              the env‑flag value with the user's role/permissions.
 *
 * @example
 *   if (isFeatureEnabled('domainInsights')) { … }
 */
export function isFeatureEnabled(name: FeatureName, _user?: unknown): boolean {
  // Future: if (_user) return featureFlags[name] && userHasPermission(_user, name);
  return featureFlags[name] ?? false;
}

/** Return all feature names that are currently enabled. */
export function getEnabledFeatures(): FeatureName[] {
  return (Object.keys(featureFlags) as FeatureName[]).filter(n => featureFlags[n]);
}

/** Return feature names filtered by category. */
export function getFeaturesByCategory(category: FeatureCategory): FeatureName[] {
  return (Object.entries(FEATURE_REGISTRY) as [FeatureName, FeatureDefinition][])
    .filter(([, def]) => def.category === category)
    .map(([name]) => name);
}
