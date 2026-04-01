import { useState, useMemo } from 'react';
import { useInspectorStore } from '../../store/inspectorStore';
import type { GradientInfo } from '../../../shared/types';

type GradientFilter = 'all' | 'linear' | 'radial' | 'conic';

const FILTER_TABS: { id: GradientFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'linear', label: 'Linear' },
  { id: 'radial', label: 'Radial' },
  { id: 'conic', label: 'Mesh' },
];

// Friendly names for gradients based on color stops
function getGradientName(_gradient: GradientInfo, index: number): string {
  const names = ['Ocean Breeze', 'Sunset Glow', 'Berry Punch', 'Forest Mist', 'Golden Hour', 'Cosmic Dust', 'Rose Quartz', 'Arctic Blue'];
  return names[index % names.length];
}

export default function GradientsPanel() {
  const gradients = useInspectorStore((s) => s.gradients);
  const [filter, setFilter] = useState<GradientFilter>('all');
  const [saved, setSaved] = useState<Set<number>>(new Set());

  const filtered = useMemo(() => {
    if (filter === 'all') return gradients;
    return gradients.filter(g => g.type.toLowerCase().includes(filter));
  }, [gradients, filter]);

  if (gradients.length === 0) {
    return (
      <div className="empty-state animate-fade-in">
        <div className="empty-icon" style={{ fontSize: 36, opacity: 0.3 }}>⬡</div>
        <div className="empty-title">No Gradients Found</div>
        <div className="empty-desc">Gradients used on the page will appear here once analyzed.</div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Sub-filter tabs */}
      <div className="gradient-filter-tabs">
        {FILTER_TABS.map(tab => (
          <button
            key={tab.id}
            className={`gradient-filter-tab ${filter === tab.id ? 'active' : ''}`}
            onClick={() => setFilter(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Gradient Cards */}
      {filtered.map((gradient, i) => (
        <GradientCard
          key={i}
          gradient={gradient}
          index={i}
          isSaved={saved.has(i)}
          onToggleSave={() => {
            const next = new Set(saved);
            next.has(i) ? next.delete(i) : next.add(i);
            setSaved(next);
          }}
        />
      ))}
    </div>
  );
}

function GradientCard({ gradient, index, isSaved, onToggleSave }: {
  gradient: GradientInfo;
  index: number;
  isSaved: boolean;
  onToggleSave: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard?.writeText(gradient.raw);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const name = getGradientName(gradient, index);

  return (
    <div className="gradient-card animate-fade-in" style={{ animationDelay: `${index * 0.05}s` }}>
      {/* Large gradient preview */}
      <div
        className="gradient-preview"
        style={{ background: gradient.raw }}
      />

      {/* Info section */}
      <div className="gradient-info">
        {/* Name row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div className="gradient-name">{name}</div>
          <button
            onClick={onToggleSave}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 18,
              color: isSaved ? 'var(--brand-danger)' : 'var(--text-tertiary)',
              padding: '2px 4px',
              transition: 'all 0.15s',
            }}
            title={isSaved ? 'Unsave' : 'Save'}
          >
            {isSaved ? '♥' : '♡'}
          </button>
        </div>

        {/* CSS value */}
        <div className="gradient-raw-text">
          {gradient.raw.length > 70
            ? gradient.raw.substring(0, 70) + '…'
            : gradient.raw}
        </div>

        {/* Color stops + copy button row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="gradient-stops">
            {gradient.stops.slice(0, 6).map((stop, si) => (
              <div
                key={si}
                className="gradient-stop-dot"
                title={stop.color}
                style={{ background: stop.color }}
              />
            ))}
          </div>
          <button className={`copy-btn ${copied ? 'copied' : ''}`} onClick={copy}>
            {copied ? '✓ Copied!' : '⎘ Copy CSS'}
          </button>
        </div>
      </div>
    </div>
  );
}
