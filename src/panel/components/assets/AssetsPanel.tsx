import { useState, useMemo } from 'react';
import { useInspectorStore } from '../../store/inspectorStore';
import type { AssetInfo } from '../../../shared/types';

type AssetFilter = 'all' | 'image' | 'svg' | 'icon' | 'background';

export default function AssetsPanel() {
  const assets = useInspectorStore((s) => s.assets);
  const [filter, setFilter] = useState<AssetFilter>('all');
  const [selectedAsset, setSelectedAsset] = useState<AssetInfo | null>(null);

  const filteredAssets = useMemo(() => {
    if (filter === 'all') return assets;
    return assets.filter(a => a.type === filter);
  }, [assets, filter]);


  if (assets.length === 0) {
    return (
      <div className="empty-state animate-fade-in">
        <div className="empty-icon">▣</div>
        <div className="empty-title">No Assets Found</div>
        <div className="empty-desc">
          Images, icons, SVGs, and other assets from the page will appear here.
        </div>
      </div>
    );
  }

  if (selectedAsset) {
    return (
      <div className="animate-fade-in">
        <button className="btn btn-ghost" onClick={() => setSelectedAsset(null)} style={{ marginBottom: 12 }}>
          ← Back to gallery
        </button>
        <AssetDetail asset={selectedAsset} />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Sub-filter tabs matching reference */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 14, borderBottom: '1px solid var(--border-subtle)' }}>
        {([{ id: 'all', label: 'All Assets' }, { id: 'image', label: 'Images' }, { id: 'svg', label: 'SVGs' }] as const).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setFilter(id as AssetFilter)}
            style={{
              padding: '8px 14px',
              background: 'none',
              border: 'none',
              borderBottom: filter === id ? '2px solid var(--brand-primary)' : '2px solid transparent',
              color: filter === id ? 'var(--brand-primary)' : 'var(--text-tertiary)',
              fontFamily: 'var(--font-sans)',
              fontSize: 13,
              fontWeight: filter === id ? 600 : 500,
              cursor: 'pointer',
              marginBottom: -1,
              transition: 'all 0.12s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Asset Grid */}
      <div className="asset-grid">
        {filteredAssets.map((asset, i) => (
          <div
            key={i}
            className={`asset-card animate-fade-in stagger-${Math.min(i, 5)}`}
            onClick={() => setSelectedAsset(asset)}
          >
            <AssetPreview asset={asset} className="asset-image" />
            <div className="asset-info">
              <div className="asset-format">{asset.format}</div>
              {asset.dimensions.width > 0 && (
                <div className="asset-dims">{asset.dimensions.width}×{asset.dimensions.height}</div>
              )}
            </div>
            <button
              className="asset-download"
              onClick={(e) => { e.stopPropagation(); handleDownload(asset); }}
              title="Download"
            >
              ↓
            </button>
          </div>
        ))}
      </div>

      {/* Export All CTA (matching reference screenshot) */}
      <button className="btn-cta" onClick={() => handleBatchDownload(filteredAssets)}>
        ⬇ Export All Assets ({filteredAssets.length})
      </button>
    </div>
  );
}

function AssetDetail({ asset }: { asset: AssetInfo }) {
  return (
    <div>
      {/* Preview */}
      <div className="card" style={{ marginBottom: 8, textAlign: 'center', padding: 16 }}>
        <AssetPreview asset={asset} style={{ maxWidth: '100%', maxHeight: 250 }} />
      </div>

      {/* Info */}
      <div className="card" style={{ marginBottom: 8 }}>
        <div className="card-header">
          <span className="card-title">Details</span>
        </div>
        <div className="prop-row">
          <span className="prop-name">Type</span>
          <span className="prop-value">{asset.type}</span>
        </div>
        <div className="prop-row">
          <span className="prop-name">Format</span>
          <span className="prop-value">{asset.format}</span>
        </div>
        {asset.dimensions.width > 0 && (
          <div className="prop-row">
            <span className="prop-name">Dimensions</span>
            <span className="prop-value">{asset.dimensions.width} × {asset.dimensions.height}</span>
          </div>
        )}
        {asset.alt && (
          <div className="prop-row">
            <span className="prop-name">Alt</span>
            <span className="prop-value">{asset.alt}</span>
          </div>
        )}
        <div className="prop-row">
          <span className="prop-name">Element</span>
          <span className="prop-value">{asset.element}</span>
        </div>
        <div className="prop-row">
          <span className="prop-name">URL</span>
          <span className="prop-value" title={asset.url}>
            {asset.url.length > 40 ? '…' + asset.url.slice(-35) : asset.url}
          </span>
        </div>
      </div>

      {/* Download */}
      <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => handleDownload(asset)}>
        ↓ Download Asset
      </button>
    </div>
  );
}

// ── Asset Preview (handles SVG URLs, data URIs, and regular images) ──────────

function AssetPreview({ asset, className, style }: {
  asset: AssetInfo;
  className?: string;
  style?: React.CSSProperties;
}) {
  const baseStyle: React.CSSProperties = {
    objectFit: 'contain',
    ...style,
  };

  // SVG or image with a real URL → browser renders it fine in <img>
  if (asset.url && asset.url.trim() && asset.url !== '#') {
    return (
      <img
        className={className}
        src={asset.url}
        alt={asset.alt || 'SVG'}
        loading="lazy"
        style={baseStyle}
        onError={(e) => {
          // If img fails (e.g. cross-origin inline SVG), show a generic vector icon
          const el = e.currentTarget;
          el.style.display = 'none';
          const fallback = el.nextElementSibling as HTMLElement | null;
          if (fallback) fallback.style.display = 'flex';
        }}
      />
    );
  }

  // Fallback for truly inline / empty-URL SVGs
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-hover)',
        ...style,
      }}
    >
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5">
        <rect x="2" y="3" width="20" height="18" rx="3"/>
        <path d="M7 8h10M7 12h6M7 16h8"/>
      </svg>
    </div>
  );
}


function handleDownload(asset: AssetInfo) {
  const a = document.createElement('a');
  a.href = asset.url;
  a.download = getFilename(asset);
  a.target = '_blank';
  a.click();
}

async function handleBatchDownload(assets: AssetInfo[]) {
  try {
    const { default: JSZip } = await import('jszip');
    const { saveAs } = await import('file-saver');
    const zip = new JSZip();

    const fetchPromises = assets.map(async (asset, i) => {
      try {
        const response = await fetch(asset.url);
        const blob = await response.blob();
        zip.file(getFilename(asset, i), blob);
      } catch {
        // Skip failed assets
      }
    });

    await Promise.allSettled(fetchPromises);
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    saveAs(zipBlob, 'sitelens-assets.zip');
  } catch (err) {
    console.error('Failed to create zip:', err);
    // Fallback: download individually
    assets.forEach(a => handleDownload(a));
  }
}

function getFilename(asset: AssetInfo, index?: number): string {
  const urlParts = asset.url.split('/');
  const lastPart = urlParts[urlParts.length - 1]?.split('?')[0];
  if (lastPart && lastPart.includes('.')) return lastPart;
  const ext = asset.format.toLowerCase();
  const prefix = index !== undefined ? `asset-${index + 1}` : 'asset';
  return `${prefix}.${ext === 'unknown' ? 'png' : ext}`;
}
