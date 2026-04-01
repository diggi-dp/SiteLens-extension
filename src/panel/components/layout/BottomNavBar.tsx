import { useLocation, useNavigate } from 'react-router-dom';
import { isFeatureEnabled, type FeatureName } from '../../../config/featureFlags';

// One unified nav — all features always reachable from anywhere
const NAV_ITEMS: { id: string; label: string; route: string; icon: React.FC<{ active: boolean }>; feature?: FeatureName }[] = [
  { id: 'overview', label: 'Inspect', route: '/overview', icon: InspectIcon },
  { id: 'colors', label: 'Colors', route: '/colors', icon: ColorsIcon },
  { id: 'gradients', label: 'Gradients', route: '/gradients', icon: GradientsIcon, feature: 'gradientExtraction' },
  { id: 'typography', label: 'Type', route: '/typography', icon: TypeIcon },
  { id: 'assets', label: 'Assets', route: '/assets', icon: AssetsIcon, feature: 'assetGallery' },
  { id: 'insights', label: 'Insights', route: '/insights', icon: InsightsIcon, feature: 'domainInsights' },
];


export default function BottomNavBar() {
  const location = useLocation();
  const navigate = useNavigate();

  const visibleItems = NAV_ITEMS.filter(item => !item.feature || isFeatureEnabled(item.feature));

  return (
    <nav className="bottom-nav">
      {visibleItems.map((item) => {
        const isActive =
          location.pathname === item.route ||
          (item.route === '/overview' && (location.pathname === '/' || location.pathname === '/computed' || location.pathname === '/layout-tab' || location.pathname === '/events' || location.pathname === '/settings'));
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            className={`bottom-nav-item ${isActive ? 'active' : ''}`}
            onClick={() => navigate(item.route)}
          >
            <span className="bottom-nav-icon">
              <Icon active={isActive} />
            </span>
            <span className="bottom-nav-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ── Icons ────────────────────────────────────────────────────────────────────

function InspectIcon({ active }: { active: boolean }) {
  const c = active ? 'var(--brand-primary)' : 'currentColor';
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
    </svg>
  );
}

function ColorsIcon({ active }: { active: boolean }) {
  const c = active ? 'var(--brand-primary)' : 'currentColor';
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.85 0 3-1.34 3-2.5 0-.59-.23-1.12-.59-1.5-.35-.37-.57-.88-.57-1.43 0-1.1.9-2 2-2h1.69c3.1 0 5.47-2.57 5.47-5.47C22.5 5.87 17.74 2 12 2z"/>
      <circle cx="8" cy="12" r="1.5" fill={c} stroke="none"/>
      <circle cx="10" cy="7.5" r="1.5" fill={c} stroke="none"/>
      <circle cx="14.5" cy="7.5" r="1.5" fill={c} stroke="none"/>
    </svg>
  );
}

function GradientsIcon({ active }: { active: boolean }) {
  const c = active ? 'var(--brand-primary)' : 'currentColor';
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3"/>
      <path d="M3 8h18M3 16h18" strokeWidth="1.5" strokeOpacity="0.5"/>
    </svg>
  );
}

function TypeIcon({ active }: { active: boolean }) {
  const c = active ? 'var(--brand-primary)' : 'currentColor';
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7V4h16v3M9 20h6M12 4v16"/>
    </svg>
  );
}

function AssetsIcon({ active }: { active: boolean }) {
  const c = active ? 'var(--brand-primary)' : 'currentColor';
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="9" height="9" rx="1.5"/>
      <rect x="13" y="2" width="9" height="9" rx="1.5"/>
      <rect x="2" y="13" width="9" height="9" rx="1.5"/>
      <rect x="13" y="13" width="9" height="9" rx="1.5"/>
    </svg>
  );
}

function InsightsIcon({ active }: { active: boolean }) {
  const c = active ? 'var(--brand-primary)' : 'currentColor';
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
      <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  );
}
