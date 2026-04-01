import { useLocation, useNavigate } from 'react-router-dom';
import { useSettingsStore } from '../../store/settingsStore';
import { useInspectorStore } from '../../store/inspectorStore';
import { MessageType } from '../../../shared/types';
import { isFeatureEnabled } from '../../../config/featureFlags';

interface HeaderProps {
  onRefresh: () => void;
}

const PAGE_TITLES: Record<string, string> = {
  '/colors': 'Color System',
  '/typography': 'Typography',
  '/assets': 'Assets',
  '/spacing': 'Layout & Spacing',
  '/gradients': 'Gradients',
  '/computed': 'Computed Styles',
  '/layout-tab': 'Layout',
  '/events': 'Timeline',
  '/settings': 'Settings',
};

// Routes where a back arrow makes sense (navigating away from inspector default)
const PAGE_ROUTES = ['/colors', '/typography', '/assets', '/spacing', '/gradients'];

export default function Header({ onRefresh }: HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const settings = useSettingsStore();
  const isInspecting = useInspectorStore((s) => s.isInspecting);

  const isPageRoute = PAGE_ROUTES.includes(location.pathname);

  const sendMsg = (type: MessageType) => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type });
    }
  };

  const openSidePanel = async () => {
    if (typeof chrome === 'undefined' || !chrome.sidePanel) return;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tab?.id;
      if (!tabId) return;
      await chrome.sidePanel.setOptions({ tabId, path: 'sidepanel.html', enabled: true });
      await chrome.sidePanel.open({ tabId });
      chrome.runtime.sendMessage({ type: MessageType.OPEN_SIDE_PANEL });
    } catch (e) {
      console.error('Failed to open sidebar:', e);
    }
  };

  const isSidebar = typeof window !== 'undefined' && window.location.pathname.includes('sidepanel');

  // Page screens (Colors, Typography, Assets, Spacing, Gradients): show back arrow + title + search
  if (isPageRoute) {
    const title = PAGE_TITLES[location.pathname] || 'SiteLens';
    return (
      <header className="header header-page-mode">
        <button className="header-back-btn" onClick={() => navigate('/overview')} title="Back to Inspector">
          <BackIcon />
        </button>
        <span className="header-page-title">{title}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            className="icon-btn"
            onClick={settings.toggleTheme}
            title="Toggle theme"
          >
            {settings.theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </header>
    );
  }

  // Inspector screen (overview, computed, layout-tab, events, settings):
  // Show ✕ SiteLens Inspector + action icons
  return (
    <header className="header header-inspector-mode">
      <div className="header-inspector-left">
        {isSidebar ? (
          <button
            className="icon-btn"
            onClick={() => sendMsg(MessageType.CLOSE_SIDE_PANEL)}
            title="Close sidebar"
          >
            <CloseIcon />
          </button>
        ) : (
          <div className="header-logo">S</div>
        )}
        <span className="header-inspector-title">SiteLens</span>
      </div>
      <div className="header-actions">
        <button className="icon-btn" onClick={onRefresh} title="Refresh page data">
          <RefreshIcon />
        </button>
        {!isSidebar && isFeatureEnabled('sidePanel') && (
          <button className="icon-btn" onClick={openSidePanel} title="Open in sidebar">
            <SidebarIcon />
          </button>
        )}
        <button
          className={`icon-btn icon-btn-inspect ${isInspecting ? 'active' : ''}`}
          onClick={() => sendMsg(MessageType.TOGGLE_INSPECTOR)}
          title={isInspecting ? 'Stop Inspecting' : 'Start Inspecting'}
        >
          <InspectTargetIcon active={isInspecting} />
        </button>
        <button
          className="icon-btn"
          onClick={settings.toggleTheme}
          title={`Switch to ${settings.theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {settings.theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>
    </header>
  );
}

// ── SVG Icons ────────────────────────────────────────────────────────────────

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7"/>
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M18 6L6 18M6 6l12 12"/>
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>
    </svg>
  );
}

function SidebarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <path d="M9 3v18"/>
    </svg>
  );
}

function InspectTargetIcon({ active }: { active: boolean }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={active ? 'white' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}
