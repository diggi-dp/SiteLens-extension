/// <reference types="vite/client" />
/// <reference types="chrome" />

interface ImportMetaEnv {
  // Feature flags
  readonly VITE_FEATURE_ELEMENT_INSPECTOR?: string;
  readonly VITE_FEATURE_COLOR_EXTRACTION?: string;
  readonly VITE_FEATURE_TYPOGRAPHY_ANALYSIS?: string;
  readonly VITE_FEATURE_FLOATING_WINDOW?: string;
  readonly VITE_FEATURE_SIDE_PANEL?: string;
  readonly VITE_FEATURE_ADVANCED_INSPECTOR?: string;
  readonly VITE_FEATURE_ASSET_GALLERY?: string;
  readonly VITE_FEATURE_GRADIENT_EXTRACTION?: string;
  readonly VITE_FEATURE_DOMAIN_INSIGHTS?: string;
  readonly VITE_FEATURE_STACK_DETECTION?: string;
  readonly VITE_FEATURE_MEASUREMENT_OVERLAY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
