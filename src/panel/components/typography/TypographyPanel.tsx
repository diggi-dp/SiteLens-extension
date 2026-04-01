import { useState } from 'react';
import { useInspectorStore } from '../../store/inspectorStore';
import type { FontInfo } from '../../../shared/types';

const SAMPLE_TEXTS: Record<string, string> = {
  'sans-serif': 'The quick brown fox jumps over the lazy dog.',
  'serif': 'Design is intelligence made visible.',
  'monospace': 'function styleLens() { return true; }',
};

function getSampleText(_category: string, family: string): string {
  const mono = family.toLowerCase().includes('mono') || family.toLowerCase().includes('code') || family.toLowerCase().includes('jetbrains');
  if (mono) return SAMPLE_TEXTS['monospace'];
  const serif = family.toLowerCase().includes('serif') || family.toLowerCase().includes('georgia') || family.toLowerCase().includes('times');
  if (serif) return 'Design is intelligence made visible.';
  return SAMPLE_TEXTS['sans-serif'];
}

type FontSource = 'all' | 'google' | 'system' | 'custom';

export default function TypographyPanel() {
  const fonts = useInspectorStore((s) => s.fonts);
  const hierarchy = useInspectorStore((s) => s.typographyHierarchy);
  const [activeTab, setActiveTab] = useState<'families' | 'pairings' | 'sizes'>('families');
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<FontSource>('all');

  if (fonts.length === 0) {
    return (
      <div className="empty-state animate-fade-in">
        <div className="empty-icon">Aa</div>
        <div className="empty-title">No Typography Found</div>
        <div className="empty-desc">
          Typography information will appear here once the page is analyzed.
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Sub-tabs */}
      <div className="inspector-sub-tabs" style={{ padding: '0 2px', marginBottom: 4, background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-subtle)' }}>
        {(['families', 'pairings', 'sizes'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`inspector-sub-tab ${activeTab === tab ? 'active' : ''}`}
          >
            {tab === 'families' ? 'Font Families' : tab === 'pairings' ? 'Pairings' : 'Sizes'}
          </button>
        ))}
      </div>

      {/* Search pill (shown on families tab) */}
      {activeTab === 'families' && (
        <>
          <div className="search-pill">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Search fonts..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {/* Filter pills */}
          <div className="filter-pill-row">
            <button className={`filter-pill ${sourceFilter === 'all' ? 'active' : ''}`} onClick={() => setSourceFilter('all')}>
              All ▾
            </button>
            <button className={`filter-pill ${sourceFilter === 'google' ? 'active' : ''}`} onClick={() => setSourceFilter('google')}>
              Google Fonts ▾
            </button>
            <button className={`filter-pill ${sourceFilter === 'custom' ? 'active' : ''}`} onClick={() => setSourceFilter('custom')}>
              Custom ▾
            </button>
          </div>
        </>
      )}

      {activeTab === 'families' && (
        <div>
          {fonts
            .filter(f => search === '' || f.family.toLowerCase().includes(search.toLowerCase()))
            .filter(f => sourceFilter === 'all' || f.source === sourceFilter)
            .map((font, i) => (
              <FontCard key={font.family} font={font} index={i} />
            ))}
        </div>
      )}

      {activeTab === 'pairings' && (
        <PairingsView fonts={fonts} />
      )}

      {activeTab === 'sizes' && (
        <SizesView hierarchy={hierarchy} />
      )}
    </div>
  );
}

function FontCard({ font, index }: { font: FontInfo; index: number }) {
  const sampleText = getSampleText('', font.family);

  const sourceClass = font.source === 'google' ? 'source-google'
    : font.source === 'system' ? 'source-system'
    : 'source-custom';

  const sourceLabel = font.source === 'google' ? 'Google Fonts'
    : font.source === 'system' ? 'System'
    : 'Custom';

  return (
    <div className={`font-card animate-fade-in stagger-${Math.min(index, 5)}`}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <div className="font-name">{font.family}</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
            {font.source === 'google' ? 'Sans Serif' : font.source === 'system' ? 'System Font' : 'Custom Upload'} •{' '}
            {font.variants.length > 0 ? font.variants[0]?.size || '16px' : '—'}
          </div>
        </div>
        <span className={`font-tag ${sourceClass}`}>{sourceLabel}</span>
      </div>

      {/* 400 regular preview */}
      <div className="font-weight-label">400 Regular</div>
      <div className="font-preview weight-400" style={{ fontFamily: font.family }}>
        {sampleText}
      </div>

      {/* 700 bold preview */}
      <div className="font-weight-label">700 Bold</div>
      <div className="font-preview weight-700" style={{ fontFamily: font.family }}>
        {sampleText}
      </div>

      <div className="font-meta">
        <div style={{ display: 'flex', gap: 5 }}>
          {font.variants.slice(0, 3).map((v, i) => (
            <span className="font-tag" key={i}>{v.weight} {v.style}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function PairingsView({ fonts }: { fonts: FontInfo[] }) {
  if (fonts.length < 2) {
    return (
      <div className="empty-state">
        <div className="empty-icon">✦</div>
        <div className="empty-title">Not Enough Fonts</div>
        <div className="empty-desc">Need at least 2 fonts for pairing suggestions.</div>
      </div>
    );
  }
  const pairs = [];
  for (let i = 0; i < Math.min(fonts.length - 1, 3); i++) {
    pairs.push([fonts[i], fonts[i + 1]]);
  }
  return (
    <div>
      {pairs.map(([a, b], i) => (
        <div key={i} className="font-card">
          <div style={{ fontFamily: a.family, fontSize: 20, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>
            Heading: {a.family}
          </div>
          <div style={{ fontFamily: b.family, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Body: {b.family} — The quick brown fox jumps over the lazy dog.
          </div>
        </div>
      ))}
    </div>
  );
}

function SizesView({ hierarchy }: { hierarchy: any[] }) {
  if (hierarchy.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">Tt</div>
        <div className="empty-title">No Size Data</div>
        <div className="empty-desc">Analyze the page to see font size hierarchy.</div>
      </div>
    );
  }
  return (
    <div>
      {hierarchy.map((item, i) => (
        <div key={i} className="font-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{
              background: 'rgba(232,93,4,0.08)',
              color: 'var(--brand-primary)',
              fontWeight: 700,
              fontSize: 10,
              padding: '2px 6px',
              borderRadius: 4,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
            }}>{item.level}</span>
            <span className="font-tag">{item.fontFamily}</span>
            <span className="font-tag">{item.fontSize}</span>
            <span className="font-tag">w{item.fontWeight}</span>
          </div>
          <div style={{
            fontFamily: item.fontFamily,
            fontSize: Math.min(parseInt(item.fontSize), 28) + 'px',
            fontWeight: item.fontWeight,
            color: 'var(--text-primary)',
            lineHeight: 1.3,
          }}>
            Sample Text Preview
          </div>
        </div>
      ))}
    </div>
  );
}
