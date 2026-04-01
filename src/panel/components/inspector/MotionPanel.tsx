import { useInspectorStore } from '../../store/inspectorStore';

// CSS properties that relate to motion / animations / transforms
const TRANSITION_PROPS = [
  'transition',
  'transition-property',
  'transition-duration',
  'transition-timing-function',
  'transition-delay',
];

const ANIMATION_PROPS = [
  'animation',
  'animation-name',
  'animation-duration',
  'animation-timing-function',
  'animation-delay',
  'animation-iteration-count',
  'animation-direction',
  'animation-fill-mode',
  'animation-play-state',
];

const TRANSFORM_PROPS = [
  'transform',
  'transform-origin',
  'transform-style',
  'perspective',
  'perspective-origin',
  'backface-visibility',
  'will-change',
];

function hasValue(v: string) {
  return v && v !== 'none' && v !== 'normal' && v !== 'auto' && v !== '0s' && v !== 'initial';
}

export default function MotionPanel() {
  const selectedElement = useInspectorStore((s) => s.selectedElement);

  if (!selectedElement) {
    return (
      <div className="empty-state animate-fade-in">
        <div className="empty-icon" style={{ fontSize: 32 }}>⟳</div>
        <div className="empty-title">Select an Element</div>
        <div className="empty-desc">Inspect an element to see its transitions, animations, and transforms.</div>
      </div>
    );
  }

  const styles = selectedElement.computedStyles;

  const transitions = TRANSITION_PROPS.map(p => ({ prop: p, value: styles[p] })).filter(r => hasValue(r.value));
  const animations = ANIMATION_PROPS.map(p => ({ prop: p, value: styles[p] })).filter(r => hasValue(r.value));
  const transforms = TRANSFORM_PROPS.map(p => ({ prop: p, value: styles[p] })).filter(r => hasValue(r.value));

  const hasAny = transitions.length > 0 || animations.length > 0 || transforms.length > 0;

  if (!hasAny) {
    return (
      <div className="empty-state animate-fade-in">
        <div className="empty-icon" style={{ fontSize: 28, opacity: 0.3 }}>⟳</div>
        <div className="empty-title">No Motion Properties</div>
        <div className="empty-desc">This element has no transitions, animations, or transforms applied.</div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Transitions */}
      {transitions.length > 0 && (
        <div className="card" style={{ marginBottom: 10 }}>
          <div className="card-header">
            <span className="card-title">Transitions</span>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', background: 'var(--bg-hover)', borderRadius: 'var(--radius-full)', padding: '2px 8px' }}>
              {transitions.length}
            </span>
          </div>
          {transitions.map(({ prop, value }) => (
            <div className="prop-row" key={prop} onClick={() => navigator.clipboard?.writeText(`${prop}: ${value};`)}>
              <span className="prop-name">{prop}</span>
              <span className="prop-value css-interactive" title="Click to copy"
                style={{ maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Animations */}
      {animations.length > 0 && (
        <div className="card" style={{ marginBottom: 10 }}>
          <div className="card-header">
            <span className="card-title">Animations</span>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', background: 'var(--bg-hover)', borderRadius: 'var(--radius-full)', padding: '2px 8px' }}>
              {animations.length}
            </span>
          </div>
          {animations.map(({ prop, value }) => (
            <div className="prop-row" key={prop} onClick={() => navigator.clipboard?.writeText(`${prop}: ${value};`)}>
              <span className="prop-name">{prop}</span>
              <span className="prop-value css-interactive" title="Click to copy"
                style={{ maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {value}
              </span>
            </div>
          ))}
          {/* Playback visualization hint */}
          {animations.find(r => r.prop === 'animation-name') && (
            <div style={{
              margin: '8px 0 4px',
              padding: '8px 10px',
              background: 'var(--bg-hover)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 11,
              color: 'var(--text-tertiary)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <span style={{ fontSize: 16 }}>▶</span>
              Animation is active — open DevTools &gt; Animations to see the timeline.
            </div>
          )}
        </div>
      )}

      {/* Transforms */}
      {transforms.length > 0 && (
        <div className="card" style={{ marginBottom: 10 }}>
          <div className="card-header">
            <span className="card-title">Transforms</span>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', background: 'var(--bg-hover)', borderRadius: 'var(--radius-full)', padding: '2px 8px' }}>
              {transforms.length}
            </span>
          </div>
          {transforms.map(({ prop, value }) => (
            <div className="prop-row" key={prop} onClick={() => navigator.clipboard?.writeText(`${prop}: ${value};`)}>
              <span className="prop-name">{prop}</span>
              <span className="prop-value css-interactive" title="Click to copy"
                style={{ maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
