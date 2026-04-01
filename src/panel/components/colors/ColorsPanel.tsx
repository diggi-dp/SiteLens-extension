import { useState, useMemo } from 'react';
import { useInspectorStore } from '../../store/inspectorStore';
import { useSettingsStore } from '../../store/settingsStore';
import { formatColor } from '../../../shared/utils/colorUtils';
import { exportColorPalette, getExportExtension } from '../../../shared/utils/exportUtils';
import type { ExportFormat } from '../../../shared/utils/exportUtils';
import type { ColorInfo, ColorCategory } from '../../../shared/types';

type Category = 'all' | ColorCategory;

const CATEGORY_TABS: { id: Category; label: string; accent: string }[] = [
  { id: 'all', label: 'All', accent: 'var(--brand-primary)' },
  { id: 'text', label: 'Text', accent: '#6366F1' },
  { id: 'background', label: 'BG', accent: '#0EA5E9' },
  { id: 'border', label: 'Border', accent: '#9CA3AF' },
  { id: 'shadow', label: 'Shadow', accent: '#6B7280' },
];

const EXPORT_BUTTONS: { fmt: ExportFormat; label: string; title: string }[] = [
  { fmt: 'json', label: 'JSON', title: 'Export as JSON tokens' },
  { fmt: 'css-vars', label: 'CSS', title: 'Export as CSS custom properties' },
  { fmt: 'scss', label: 'SCSS', title: 'Export as SCSS variables' },
  { fmt: 'tailwind', label: 'Tailwind', title: 'Export as Tailwind config' },
  { fmt: 'figma', label: 'Figma', title: 'Export as Figma tokens JSON' },
  { fmt: 'sketch', label: 'Sketch', title: 'Export as Sketch palette' },
  { fmt: 'clipboard', label: 'Copy All', title: 'Copy all hex values to clipboard' },
];

export default function ColorsPanel() {
  const colors = useInspectorStore((s) => s.colors);
  const colorFormat = useSettingsStore((s) => s.colorFormat);
  const setColorFormat = useSettingsStore((s) => s.setColorFormat);
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [selectedColor, setSelectedColor] = useState<ColorInfo | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [justCopied, setJustCopied] = useState<string | null>(null);

  const filteredColors = useMemo(() => {
    if (activeCategory === 'all') return colors;
    return colors.filter(c => c.category === activeCategory);
  }, [colors, activeCategory]);

  // Category counts for tabs
  const counts = useMemo(() => {
    const map: Partial<Record<Category, number>> = { all: colors.length };
    colors.forEach(c => {
      map[c.category] = (map[c.category] || 0) + 1;
    });
    return map;
  }, [colors]);

  if (colors.length === 0) {
    return (
      <div className="empty-state animate-fade-in">
        <div className="empty-icon">◆</div>
        <div className="empty-title">No Colors Found</div>
        <div className="empty-desc">Colors from the page will appear here once analyzed.</div>
      </div>
    );
  }

  if (selectedColor) {
    return (
      <div className="animate-fade-in">
        <button onClick={() => setSelectedColor(null)} className="back-btn">
          ← Back to palette
        </button>
        <ColorDetail color={selectedColor} format={colorFormat} onFormatChange={setColorFormat} />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Top controls row */}
      <div className="colors-toolbar">
        {/* Format toggle */}
        <div className="format-toggle">
          {(['hex', 'rgb', 'hsl'] as const).map(fmt => (
            <button
              key={fmt}
              className={`format-btn ${colorFormat === fmt ? 'active' : ''}`}
              onClick={() => setColorFormat(fmt)}
            >
              {fmt.toUpperCase()}
            </button>
          ))}
        </div>
        <button
          className={`export-toggle-btn ${showExport ? 'active' : ''}`}
          onClick={() => setShowExport(v => !v)}
        >
          ⬇ Export
        </button>
      </div>

      {/* Export panel */}
      {showExport && (
        <div className="card animate-scale-in export-card">
          <div className="card-header">
            <span className="card-title">Export Color Palette</span>
            <button onClick={() => setShowExport(false)} className="icon-btn" style={{ fontSize: 18, lineHeight: 1 }}>×</button>
          </div>
          <div className="export-grid">
            {EXPORT_BUTTONS.map(({ fmt, label, title }) => (
              <button
                key={fmt}
                title={title}
                className={`export-btn ${justCopied === fmt ? 'copied' : ''}`}
                onClick={() => {
                  handleExport(filteredColors, fmt, activeCategory);
                  if (fmt === 'clipboard') {
                    setJustCopied(fmt);
                    setTimeout(() => setJustCopied(null), 1500);
                  }
                }}
              >
                {justCopied === fmt ? '✓ Copied' : (fmt === 'clipboard' ? '📋 ' : '⬇ ') + label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Category filter tabs */}
      <div className="color-category-tabs">
        {CATEGORY_TABS.filter(t => t.id === 'all' || (counts[t.id] ?? 0) > 0).map(tab => (
          <button
            key={tab.id}
            className={`color-cat-tab ${activeCategory === tab.id ? 'active' : ''}`}
            onClick={() => setActiveCategory(tab.id)}
            style={activeCategory === tab.id ? { borderBottomColor: tab.accent, color: tab.accent } : {}}
          >
            {tab.label}
            <span className="color-cat-count">{counts[tab.id] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Color grid */}
      <ColorGrid
        colors={filteredColors}
        format={colorFormat}
        onSelect={setSelectedColor}
      />
    </div>
  );
}

// ── Color Grid (replaces separate section + header) ──────────────────────────

function ColorGrid({ colors, format, onSelect }: {
  colors: ColorInfo[];
  format: 'hex' | 'rgb' | 'hsl';
  onSelect: (c: ColorInfo) => void;
}) {
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  const copyColor = (color: ColorInfo, e: React.MouseEvent) => {
    e.stopPropagation();
    const text = formatColor(color, format);
    navigator.clipboard?.writeText(text);
    setCopiedHex(color.hex);
    setTimeout(() => setCopiedHex(null), 1200);
  };

  if (colors.length === 0) {
    return (
      <div className="empty-state" style={{ padding: '32px 16px' }}>
        <div className="empty-icon" style={{ fontSize: 22 }}>◌</div>
        <div className="empty-title" style={{ fontSize: 14 }}>No colors in this category</div>
      </div>
    );
  }

  return (
    <div className="color-grid-panel">
      {colors.map((color, i) => (
        <div
          key={color.hex + i}
          className="color-tile"
          onClick={() => onSelect(color)}
          title={`Click to inspect — ${color.hex}`}
        >
          <div
            className="color-tile-swatch"
            style={{ background: color.hex }}
            onClick={e => copyColor(color, e)}
            title="Click to copy"
          />
          <div className="color-tile-info">
            <div className="color-tile-value">
              {copiedHex === color.hex ? '✓ Copied!' : formatColor(color, format)}
            </div>
            <div className="color-tile-meta">
              <span className="color-tile-category">{color.category}</span>
              {color.count > 0 && <span>{color.count}×</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Color Detail View ────────────────────────────────────────────────────────

function ColorDetail({ color, format, onFormatChange }: {
  color: ColorInfo;
  format: 'hex' | 'rgb' | 'hsl';
  onFormatChange: (f: 'hex' | 'rgb' | 'hsl') => void;
}) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copy = (text: string, field: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1200);
  };

  const hexVal = color.hex.toUpperCase();
  const rgbVal = `rgb(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b})`;
  const hslVal = `hsl(${color.hsl.h}, ${color.hsl.s}%, ${color.hsl.l}%)`;

  return (
    <div>
      {/* Large swatch */}
      <div style={{
        height: 130,
        background: color.hex,
        borderRadius: 'var(--radius-md)',
        marginBottom: 14,
        boxShadow: 'var(--shadow-md)',
      }} />

      {/* Format toggle */}
      <div className="format-toggle" style={{ marginBottom: 12 }}>
        {(['hex', 'rgb', 'hsl'] as const).map(fmt => (
          <button key={fmt} className={`format-btn ${format === fmt ? 'active' : ''}`} onClick={() => onFormatChange(fmt)}>
            {fmt.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 10 }}>
        <div className="prop-row" onClick={() => copy(hexVal, 'hex')} style={{ cursor: 'pointer' }}>
          <span className="prop-name">HEX</span>
          <span className="prop-value css-interactive">{copiedField === 'hex' ? '✓ Copied' : hexVal}</span>
        </div>
        <div className="prop-row" onClick={() => copy(rgbVal, 'rgb')} style={{ cursor: 'pointer' }}>
          <span className="prop-name">RGB</span>
          <span className="prop-value css-interactive">{copiedField === 'rgb' ? '✓ Copied' : rgbVal}</span>
        </div>
        <div className="prop-row" onClick={() => copy(hslVal, 'hsl')} style={{ cursor: 'pointer' }}>
          <span className="prop-name">HSL</span>
          <span className="prop-value css-interactive">{copiedField === 'hsl' ? '✓ Copied' : hslVal}</span>
        </div>
        <div className="prop-row">
          <span className="prop-name">Category</span>
          <span className="prop-value">{color.category}</span>
        </div>
        <div className="prop-row">
          <span className="prop-name">Usages</span>
          <span className="prop-value">{color.count}×</span>
        </div>
      </div>

      {/* Export the single color */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          className="copy-btn"
          style={{ flex: 1, justifyContent: 'center' }}
          onClick={() => copy(hexVal, 'export-hex')}
        >
          {copiedField === 'export-hex' ? '✓' : '⎘'} Copy HEX
        </button>
        <button
          className="copy-btn"
          style={{ flex: 1, justifyContent: 'center' }}
          onClick={() => copy(`color: ${hexVal};`, 'export-css')}
        >
          {copiedField === 'export-css' ? '✓' : '⎘'} Copy CSS
        </button>
      </div>
    </div>
  );
}

// ── Export Handler ────────────────────────────────────────────────────────────

function handleExport(colors: ColorInfo[], format: ExportFormat, category: string) {
  const content = exportColorPalette(colors, format);

  if (format === 'clipboard') {
    navigator.clipboard?.writeText(content);
    return;
  }

  const ext = getExportExtension(format).replace('.', '');
  const catSlug = category === 'all' ? '' : `-${category}`;
  const filename = `sitelens-colors${catSlug}.${ext}`;

  const mimeMap: Partial<Record<ExportFormat, string>> = {
    json: 'application/json',
    figma: 'application/json',
    'css-vars': 'text/css',
    scss: 'text/plain',
    tailwind: 'text/javascript',
    sketch: 'application/json',
    ase: 'text/plain',
  };
  const mime = mimeMap[format] || 'text/plain';
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
