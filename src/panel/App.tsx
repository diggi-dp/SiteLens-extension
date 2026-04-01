import { useEffect, useCallback } from 'react';
import { MemoryRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { MessageType, type ExtensionMessage } from '../shared/types';
import { useInspectorStore } from './store/inspectorStore';
import { useSettingsStore, persistRoute } from './store/settingsStore';
import FeatureGate from '../config/FeatureGate';
import { isFeatureEnabled } from '../config/featureFlags';
import Header from './components/layout/Header';
import InspectorSubTabs from './components/layout/InspectorSubTabs';
import BottomNavBar from './components/layout/BottomNavBar';
import OverviewPanel from './components/inspector/OverviewPanel';
import MotionPanel from './components/inspector/MotionPanel';
import ColorsPanel from './components/colors/ColorsPanel';
import TypographyPanel from './components/typography/TypographyPanel';
import AssetsPanel from './components/assets/AssetsPanel';
import GradientsPanel from './components/gradients/GradientsPanel';
import SpacingPanel from './components/inspector/SpacingPanel';
import InsightsPanel from './components/insights/InsightsPanel';

// Inspector sub-tabs appear only on inspector-mode routes
const INSPECTOR_ROUTES = ['/', '/overview', '/computed', '/layout-tab', '/motion', '/settings'];

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const store = useInspectorStore();
  const settings = useSettingsStore();

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : settings.theme
    );
  }, [settings.theme]);

  // Message listener
  useEffect(() => {
    const handleMessage = (message: ExtensionMessage) => {
      switch (message.type) {
        case MessageType.ELEMENT_SELECTED:
          store.setSelectedElement(message.payload as any);
          if (message.payload) {
            store.setActiveTab('overview');
            if (!location.pathname.startsWith('/overview') && location.pathname !== '/') {
              navigate('/overview');
            }
          }
          break;
        case MessageType.ELEMENT_HOVERED:
          store.setHoveredElement(message.payload as any);
          break;
        case MessageType.PAGE_COLORS_RESULT:
          store.setColors(message.payload as any);
          break;
        case MessageType.PAGE_TYPOGRAPHY_RESULT: {
          const data = message.payload as any;
          store.setFonts(data.fonts);
          store.setTypographyHierarchy(data.hierarchy);
          break;
        }
        case MessageType.PAGE_ASSETS_RESULT:
          store.setAssets(message.payload as any);
          break;
        case MessageType.PAGE_GRADIENTS_RESULT:
          store.setGradients(message.payload as any);
          break;
        case MessageType.PAGE_OVERVIEW_RESULT:
          store.setOverview(message.payload as any);
          store.setLoading(false);
          break;
        case MessageType.STOP_INSPECTION:
          store.setInspecting(false);
          break;
        case MessageType.INSPECTION_STARTED:
          store.setInspecting(true);
          break;
      }
    };

    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(handleMessage);
      return () => chrome.runtime.onMessage.removeListener(handleMessage);
    }
  }, [location.pathname]);

  // Track path changes for persistence
  useEffect(() => {
    persistRoute(location.pathname);
  }, [location.pathname]);

  const requestPageData = useCallback(() => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    store.setLoading(true);
    chrome.runtime.sendMessage({ type: MessageType.REFRESH_PAGE_DATA });
  }, []);

  useEffect(() => { requestPageData(); }, []);

  const isInspectorRoute = INSPECTOR_ROUTES.some(r => r === location.pathname);

  return (
    <div className="app">
      <Header onRefresh={requestPageData} />
      {isInspectorRoute && isFeatureEnabled('advancedInspector') && <InspectorSubTabs />}

      <div className="app-content">
        <Routes>
          {/* Inspector routes */}
          <Route path="/" element={<OverviewPanel />} />
          <Route path="/overview" element={<OverviewPanel />} />
          <Route path="/computed" element={<ComputedPlaceholder />} />
          <Route path="/layout-tab" element={
            <FeatureGate feature="advancedInspector" fallback={<FeatureDisabled name="Advanced Inspector" />}>
              <SpacingPanel />
            </FeatureGate>
          } />
          <Route path="/motion" element={
            <FeatureGate feature="advancedInspector" fallback={<FeatureDisabled name="Advanced Inspector" />}>
              <MotionPanel />
            </FeatureGate>
          } />
          <Route path="/settings" element={<SettingsPlaceholder />} />

          {/* Page analysis routes */}
          <Route path="/colors" element={<ColorsPanel />} />
          <Route path="/typography" element={<TypographyPanel />} />
          <Route path="/assets" element={
            <FeatureGate feature="assetGallery" fallback={<FeatureDisabled name="Asset Gallery" />}>
              <AssetsPanel />
            </FeatureGate>
          } />
          <Route path="/gradients" element={
            <FeatureGate feature="gradientExtraction" fallback={<FeatureDisabled name="Gradient Extraction" />}>
              <GradientsPanel />
            </FeatureGate>
          } />
          <Route path="/spacing" element={
            <FeatureGate feature="advancedInspector" fallback={<FeatureDisabled name="Advanced Inspector" />}>
              <SpacingPanel />
            </FeatureGate>
          } />
          <Route path="/insights" element={
            <FeatureGate feature="domainInsights" fallback={<FeatureDisabled name="Domain Insights" />}>
              <InsightsPanel />
            </FeatureGate>
          } />
        </Routes>
      </div>

      <BottomNavBar />
    </div>
  );
}

// Lightweight placeholder panels for sub-tabs not yet implemented
function ComputedPlaceholder() {
  const selectedElement = useInspectorStore((s) => s.selectedElement);
  
  if (!selectedElement) {
    return (
      <div className="empty-state animate-fade-in">
        <div className="empty-icon">◎</div>
        <div className="empty-title">No Element Selected</div>
        <div className="empty-desc">
          Click the inspect button, then click any element on the page to view its computed styles.
        </div>
      </div>
    );
  }
  
  return (
    <div className="animate-fade-in">
      <div className="card">
        <div className="card-header"><span className="card-title">Computed Styles</span></div>
        {Object.entries(selectedElement.computedStyles).map(([prop, val]) => (
          <div className="prop-row" key={prop}>
            <span className="prop-name">{prop}</span>
            <span className="prop-value">{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}



function SettingsPlaceholder() {
  const settings = useSettingsStore();
  return (
    <div className="animate-fade-in">
      <div className="card" style={{ marginBottom: 10 }}>
        <div className="card-header"><span className="card-title">Appearance</span></div>
        <div className="prop-row">
          <span className="prop-name">Theme</span>
          <button className="copy-btn" onClick={settings.toggleTheme}>
            {settings.theme === 'dark' ? '☀ Light' : '☾ Dark'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FeatureDisabled({ name }: { name: string }) {
  return (
    <div className="empty-state animate-fade-in">
      <div className="empty-icon">🔒</div>
      <div className="empty-title">{name}</div>
      <div className="empty-desc">
        This feature is currently disabled. Contact your administrator to enable it.
      </div>
    </div>
  );
}

export default function App({ initialRoute = '/overview' }: { initialRoute?: string }) {
  return (
    <MemoryRouter initialEntries={[initialRoute]}>
      <AppContent />
    </MemoryRouter>
  );
}
