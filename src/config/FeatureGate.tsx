import type { ReactNode } from 'react';
import { isFeatureEnabled, type FeatureName } from './featureFlags';

interface FeatureGateProps {
  /** The feature flag to check. */
  feature: FeatureName;
  /** Content rendered when the feature is enabled. */
  children: ReactNode;
  /** Optional fallback rendered when the feature is disabled. */
  fallback?: ReactNode;
}

/**
 * Conditionally render children based on a feature flag.
 *
 * @example
 *   <FeatureGate feature="domainInsights">
 *     <InsightsPanel />
 *   </FeatureGate>
 *
 *   <FeatureGate feature="advancedInspector" fallback={<LockedBanner />}>
 *     <MotionPanel />
 *   </FeatureGate>
 */
export default function FeatureGate({ feature, children, fallback = null }: FeatureGateProps) {
  return isFeatureEnabled(feature) ? <>{children}</> : <>{fallback}</>;
}
