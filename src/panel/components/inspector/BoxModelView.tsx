import type { BoxModel } from '../../../shared/types';

interface BoxModelViewProps {
  boxModel: BoxModel;
  dimensions: { width: number; height: number };
}

export default function BoxModelView({ boxModel, dimensions }: BoxModelViewProps) {
  const { margin, padding, border } = boxModel;

  return (
    <div className="box-model">
      <div className="box-model-container">
        {/* Margin */}
        <div className="box-margin" style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', top: 2, left: 6, fontSize: 9, fontWeight: 700, color: '#E65100', textTransform: 'uppercase', letterSpacing: 0.3 }}>margin</span>
          <span className="box-value box-value-top" style={{ color: '#E65100', top: 14, fontSize: 10 }}>{margin.top}</span>
          <span className="box-value box-value-right" style={{ color: '#E65100', fontSize: 10 }}>{margin.right}</span>
          <span className="box-value box-value-bottom" style={{ color: '#E65100', bottom: 6, fontSize: 10 }}>{margin.bottom}</span>
          <span className="box-value box-value-left" style={{ color: '#E65100', fontSize: 10 }}>{margin.left}</span>

          {/* Border area */}
          <div className="box-border-area" style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', top: 2, left: 6, fontSize: 9, fontWeight: 700, color: '#C44E03', textTransform: 'uppercase', letterSpacing: 0.3 }}>border</span>
            <span className="box-value box-value-top" style={{ color: '#C44E03', top: 14, fontSize: 10 }}>{border.top}</span>
            <span className="box-value box-value-right" style={{ color: '#C44E03', fontSize: 10 }}>{border.right}</span>
            <span className="box-value box-value-bottom" style={{ color: '#C44E03', bottom: 6, fontSize: 10 }}>{border.bottom}</span>
            <span className="box-value box-value-left" style={{ color: '#C44E03', fontSize: 10 }}>{border.left}</span>

            {/* Padding area */}
            <div className="box-padding" style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', top: 2, left: 6, fontSize: 9, fontWeight: 700, color: '#2E7D32', textTransform: 'uppercase', letterSpacing: 0.3 }}>padding</span>
              <span className="box-value box-value-top" style={{ color: '#2E7D32', top: 14, fontSize: 10 }}>{padding.top}</span>
              <span className="box-value box-value-right" style={{ color: '#2E7D32', fontSize: 10 }}>{padding.right}</span>
              <span className="box-value box-value-bottom" style={{ color: '#2E7D32', bottom: 6, fontSize: 10 }}>{padding.bottom}</span>
              <span className="box-value box-value-left" style={{ color: '#2E7D32', fontSize: 10 }}>{padding.left}</span>

              {/* Content */}
              <div className="box-content" style={{ marginTop: 10 }}>
                {dimensions.width} × {dimensions.height}
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="box-legend">
          <div className="box-legend-item">
            <div className="box-legend-dot" style={{ background: '#FFCC80' }} />
            margin
          </div>
          <div className="box-legend-item">
            <div className="box-legend-dot" style={{ background: '#FFA726' }} />
            border
          </div>
          <div className="box-legend-item">
            <div className="box-legend-dot" style={{ background: '#66BB6A' }} />
            padding
          </div>
          <div className="box-legend-item">
            <div className="box-legend-dot" style={{ background: '#42A5F5' }} />
            content
          </div>
        </div>
      </div>
    </div>
  );
}
