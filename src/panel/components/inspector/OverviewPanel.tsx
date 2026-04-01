import type { ReactNode } from 'react';
import { useState } from 'react';
import { useInspectorStore } from '../../store/inspectorStore';
import { useSettingsStore } from '../../store/settingsStore';
import BoxModelView from './BoxModelView';
import CSSPreview from './CSSPreview';
import { isFeatureEnabled } from '../../../config/featureFlags';

export default function OverviewPanel() {
  const selectedElement = useInspectorStore((s) => s.selectedElement);
  const overview = useInspectorStore((s) => s.overview);
  const showBoxModel = useSettingsStore((s) => s.showBoxModel);
  const isLoading = useInspectorStore((s) => s.isLoading);

  if (isLoading) {
    return (
      <div className="empty-state animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <div className="spinner" style={{ width: 28, height: 28, border: '3px solid var(--border-subtle)', borderTopColor: 'var(--brand-primary)', borderRadius: '50%' }}></div>
        <div className="empty-title" style={{ marginTop: 0 }}>Detecting Tech Stack...</div>
      </div>
    );
  }

  if (!selectedElement && !overview) {
    return (
      <div className="empty-state animate-fade-in">
        <div className="empty-icon">◎</div>
        <div className="empty-title">No Element Selected</div>
        <div className="empty-desc">
          Click the inspect button, then click any element on the page to view its design properties.
        </div>
      </div>
    );
  }

  if (!selectedElement && overview) {
    return (
      <div className="animate-fade-in">
        <div style={{ marginBottom: 12 }}>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Page Overview</span>
            </div>
            <div className="inspector-grid" style={{ gap: '12px 8px' }}>
              {[
                { label: 'Title', value: overview.title },
                { label: 'Colors', value: overview.colorCount },
                { label: 'Fonts', value: overview.fontCount },
                { label: 'Gradients', value: overview.gradientCount },
                { label: 'Assets', value: overview.assetCount },
                { label: 'CSS Vars', value: overview.cssVariableCount },
              ].map(({ label, value }) => (
                <div className="inspector-grid-item" key={label}>
                  <div className="inspector-grid-label">{label}</div>
                  <div className="inspector-grid-value"
                    style={{ fontSize: 13, fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>
            {isFeatureEnabled('stackDetection') && overview.stack && overview.stack.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7, color: 'var(--text-tertiary)', marginBottom: 8 }}>
                  Tech Stack
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {overview.stack.slice(0, 8).map((tech, i) => (
                    <div key={i} style={{
                      padding: '8px 10px',
                      background: 'var(--bg-hover)',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      border: '1px solid var(--border-subtle)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span style={{
                          fontSize: 9,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: 'rgba(232,93,4,0.08)',
                          color: 'var(--brand-primary)',
                          flexShrink: 0,
                        }}>
                          {tech.category}
                        </span>
                        {tech.website ? (
                          <a href={tech.website} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            title={tech.website}
                          >{tech.name}</a>
                        ) : (
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tech.name}</span>
                        )}
                        {tech.version && (
                          <span style={{
                            fontSize: 10,
                            fontWeight: 600,
                            padding: '1px 5px',
                            borderRadius: 4,
                            background: 'rgba(59,130,246,0.10)',
                            color: 'rgba(59,130,246,0.9)',
                            fontFamily: 'var(--font-mono)',
                            flexShrink: 0,
                          }}>
                            v{tech.version}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        <div style={{
                          width: 40, height: 4, borderRadius: 2, background: 'var(--border-default)', overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${tech.confidence}%`,
                            height: '100%',
                            background: tech.confidence > 75 ? 'var(--brand-success)' : tech.confidence > 50 ? 'var(--brand-warning)' : 'var(--text-tertiary)'
                          }} />
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{Math.round(tech.confidence)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!selectedElement) return null;

  const { tagName, id, classList, selector, computedStyles, authoredStyles, dimensions, accessibility, pseudoElements } = selectedElement;
  const stylesToRender = authoredStyles || computedStyles;

  return (
    <div className="animate-fade-in">

      {/* Element Tag Strip */}
      <div className="element-tag-strip">
        <div style={{ marginBottom: 3 }}>
          <span className="element-tag-name">{tagName}</span>
          {id && <span className="element-class-name"> #{id}</span>}
          {classList.map((cls, i) => (
            <span key={i} className="element-class-name"> .{cls}</span>
          ))}
        </div>
        <div className="element-tag-html">
          {`<${tagName} class="${classList.join(' ')}">`}
        </div>
      </div>

      {/* Box Model */}
      {showBoxModel && (
        <div style={{ marginBottom: 12 }}>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Box Model</span>
            </div>
            <BoxModelView boxModel={selectedElement.boxModel} dimensions={dimensions} />
          </div>
        </div>
      )}

      {/* Layout & Sizing */}
      <div style={{ marginBottom: 12 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Layout &amp; Sizing</span>
          </div>
          <div className="inspector-grid">
            <div className="inspector-grid-item">
              <div className="inspector-grid-label">Display</div>
              <div className="inspector-grid-value">{computedStyles['display'] || '—'}</div>
            </div>
            <div className="inspector-grid-item">
              <div className="inspector-grid-label">Position</div>
              <div className="inspector-grid-value">{computedStyles['position'] || '—'}</div>
            </div>
            <div className="inspector-grid-item">
              <div className="inspector-grid-label">Z-Index</div>
              <div className="inspector-grid-value">{computedStyles['z-index'] || 'auto'}</div>
            </div>
            <div className="inspector-grid-item">
              <div className="inspector-grid-label">Opacity</div>
              <div className="inspector-grid-value">{computedStyles['opacity'] || '1.0'}</div>
            </div>
            {dimensions.width > 0 && (
              <div className="inspector-grid-item">
                <div className="inspector-grid-label">Width</div>
                <div className="inspector-grid-value">{dimensions.width}px</div>
              </div>
            )}
            {dimensions.height > 0 && (
              <div className="inspector-grid-item">
                <div className="inspector-grid-label">Height</div>
                <div className="inspector-grid-value">{dimensions.height}px</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Authored Styles */}
      <div style={{ marginBottom: 12 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Authored Styles</span>
            <span className="source-badge">styles.css</span>
          </div>
          {Object.entries(stylesToRender)
            .filter(([prop, v]) => v && !['width', 'height', 'display', 'position', 'z-index', 'opacity', 'top', 'right', 'bottom', 'left', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'gap', 'grid-template-columns', 'grid-template-rows'].includes(prop))
            .slice(0, 18)
            .map(([prop, value]) => (
              <AuthoredStyleRow key={prop} prop={prop} value={value} computedValue={computedStyles[prop]} />
            ))}
        </div>
      </div>

      {/* Pseudo Elements */}
      {pseudoElements.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Pseudo Elements</span>
            </div>
            {pseudoElements.map((pseudo, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--brand-primary)', marginBottom: 4, fontWeight: 600 }}>
                  {pseudo.type}
                </div>
                {Object.entries(pseudo.styles).map(([p, v]) => (
                  <AuthoredStyleRow key={p} prop={p} value={v as string} />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accessibility */}
      {accessibility && accessibility.contrastRatio > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Accessibility</span>
            </div>
            <div className={`contrast-card ${!accessibility.wcagAA ? 'fail' : ''}`}>
              <div className="contrast-check-icon">
                {accessibility.wcagAA ? '✓' : '✗'}
              </div>
              <div className="contrast-details-text">
                <div className="contrast-ratio-value" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  Contrast Ratio: {accessibility.contrastRatio}:1
                  <span className={`contrast-badge ${accessibility.wcagAAA ? 'pass' : accessibility.wcagAA ? 'pass' : 'fail'}`}>
                    {accessibility.wcagAAA ? 'AAA' : accessibility.wcagAA ? 'AA' : 'Fail'}
                  </span>
                </div>
                <div className="contrast-description">
                  {accessibility.wcagAAA
                    ? 'Meets WCAG enhanced accessibility standards.'
                    : accessibility.wcagAA
                    ? 'Meets WCAG minimum accessibility standards.'
                    : 'Does not meet WCAG accessibility standards.'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SVG Asset */}
      {selectedElement.svgCode && (
        <div style={{ marginBottom: 12 }}>
          <div className="card">
            <div className="card-header">
              <span className="card-title">SVG Asset</span>
              <button className="copy-btn" onClick={() => navigator.clipboard?.writeText(selectedElement.svgCode!)}>
                Copy Code
              </button>
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--text-tertiary)',
              whiteSpace: 'pre-wrap',
              maxHeight: 80,
              overflow: 'hidden',
              lineHeight: 1.5,
            }}>
              {selectedElement.svgCode}
            </div>
          </div>
        </div>
      )}

      {/* CSS Preview */}
      <CSSPreview styles={computedStyles} selector={selector} />

    </div>
  );
}

function AuthoredStyleRow({ prop, value, computedValue }: { prop: string; value: string; computedValue?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div
      className="prop-row"
      onClick={copy}
      style={{ cursor: 'pointer', transition: 'background 0.12s' }}
      title="Click to copy"
    >
      <span className="prop-name">{prop}</span>
      <span className={`prop-value ${copied ? '' : 'css-interactive'}`} style={{ color: copied ? 'var(--brand-success)' : undefined }}>
        {copied ? 'Copied!' : renderValue(value, computedValue)}
      </span>
    </div>
  );
}

function renderValue(value: string, computedValue?: string): ReactNode {
  // Gradient preview
  if (value.includes('gradient')) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} title={value}>
        <div style={{
          width: 14, height: 14, minWidth: 14, borderRadius: 3,
          background: computedValue || value,
          border: '1px solid var(--border-default)',
          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)'
        }} />
        <span>{value.length > 25 ? value.substring(0, 25) + '…' : value}</span>
      </div>
    );
  }

  // CSS variable badge
  if (value.startsWith('var(')) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {computedValue && isColor(computedValue) && (
          <div style={{
            width: 10, height: 10, borderRadius: 2,
            background: computedValue,
            border: '1px solid var(--border-default)',
            flexShrink: 0
          }} />
        )}
        <span className="param-badge">{value}</span>
      </div>
    );
  }

  // Color value with swatch
  if (isColor(value)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <div style={{
          width: 12, height: 12, borderRadius: 2,
          background: value,
          border: '1px solid var(--border-default)',
          flexShrink: 0
        }} />
        <span>{value}</span>
      </div>
    );
  }

  if (value.length > 32) return <span title={value}>{value.substring(0, 32) + '…'}</span>;
  return value;
}

function isColor(value: string): boolean {
  return value.startsWith('#') || value.startsWith('rgb') || value.startsWith('hsl') || /^[a-z]+$/.test(value) && CSS.supports('color', value);
}
