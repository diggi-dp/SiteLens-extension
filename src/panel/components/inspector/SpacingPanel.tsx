import { useInspectorStore } from '../../store/inspectorStore';

export default function SpacingPanel() {
  const selectedElement = useInspectorStore((s) => s.selectedElement);

  if (!selectedElement) {
    return (
      <div className="empty-state animate-fade-in">
        <div className="empty-icon">⊞</div>
        <div className="empty-title">Select an Element</div>
        <div className="empty-desc">
          Inspect an element to view its spacing, layout, and positioning details.
        </div>
      </div>
    );
  }

  const { computedStyles, boxModel } = selectedElement;

  const layoutProps = [
    { label: 'Display', value: computedStyles['display'] },
    { label: 'Position', value: computedStyles['position'] },
    { label: 'Z-Index', value: computedStyles['z-index'] },
    { label: 'Overflow', value: computedStyles['overflow'] },
  ].filter(p => p.value);

  const flexProps = [
    { label: 'Direction', value: computedStyles['flex-direction'] },
    { label: 'Wrap', value: computedStyles['flex-wrap'] },
    { label: 'Justify', value: computedStyles['justify-content'] },
    { label: 'Align Items', value: computedStyles['align-items'] },
    { label: 'Gap', value: computedStyles['gap'] },
  ].filter(p => p.value);

  const gridProps = [
    { label: 'Columns', value: computedStyles['grid-template-columns'] },
    { label: 'Rows', value: computedStyles['grid-template-rows'] },
  ].filter(p => p.value);

  return (
    <div className="animate-fade-in">
      {/* Spacing Summary */}
      <div className="section">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Spacing</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            <SpacingItem label="Margin Top" value={boxModel.margin.top} color="var(--brand-warning)" />
            <SpacingItem label="Margin Right" value={boxModel.margin.right} color="var(--brand-warning)" />
            <SpacingItem label="Margin Bottom" value={boxModel.margin.bottom} color="var(--brand-warning)" />
            <SpacingItem label="Margin Left" value={boxModel.margin.left} color="var(--brand-warning)" />
            <SpacingItem label="Padding Top" value={boxModel.padding.top} color="var(--brand-accent)" />
            <SpacingItem label="Padding Right" value={boxModel.padding.right} color="var(--brand-accent)" />
            <SpacingItem label="Padding Bottom" value={boxModel.padding.bottom} color="var(--brand-accent)" />
            <SpacingItem label="Padding Left" value={boxModel.padding.left} color="var(--brand-accent)" />
          </div>
        </div>
      </div>

      {/* Layout */}
      {layoutProps.length > 0 && (
        <div className="section">
          <div className="card">
            <div className="card-header">
              <span className="card-title">Layout</span>
            </div>
            {layoutProps.map(({ label, value }) => (
              <div className="prop-row" key={label}>
                <span className="prop-name">{label}</span>
                <span className="prop-value">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Flexbox */}
      {flexProps.length > 0 && (
        <div className="section">
          <div className="card">
            <div className="card-header">
              <span className="card-title">Flexbox</span>
            </div>
            {flexProps.map(({ label, value }) => (
              <div className="prop-row" key={label}>
                <span className="prop-name">{label}</span>
                <span className="prop-value">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      {gridProps.length > 0 && (
        <div className="section">
          <div className="card">
            <div className="card-header">
              <span className="card-title">CSS Grid</span>
            </div>
            {gridProps.map(({ label, value }) => (
              <div className="prop-row" key={label}>
                <span className="prop-name">{label}</span>
                <span className="prop-value">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SpacingItem({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="prop-row">
      <span className="prop-name" style={{ fontSize: 10 }}>{label}</span>
      <span className="prop-value" style={{ color, fontWeight: 600 }}>{value}px</span>
    </div>
  );
}
