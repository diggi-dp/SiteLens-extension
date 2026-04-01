import { useLocation, useNavigate } from 'react-router-dom';

const INSPECTOR_TABS = [
  { id: 'overview', label: 'Overview', route: '/overview' },
  { id: 'computed', label: 'Computed', route: '/computed' },
  { id: 'layout-tab', label: 'Layout', route: '/layout-tab' },
  { id: 'motion', label: 'Motion', route: '/motion' },
];

export default function InspectorSubTabs() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="inspector-sub-tabs">
      {INSPECTOR_TABS.map((tab) => {
        const isActive = location.pathname === tab.route ||
          (tab.route === '/overview' && location.pathname === '/');
        return (
          <button
            key={tab.id}
            className={`inspector-sub-tab ${isActive ? 'active' : ''}`}
            onClick={() => navigate(tab.route)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
