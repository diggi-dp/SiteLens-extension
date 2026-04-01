/**
 * Measurement Overlay
 * Calculates and visualizes the distance between two DOM elements
 * (similar to Figma's Option/Alt hover measurement).
 */

let measurementContainer: HTMLDivElement | null = null;

export function ensureMeasurementOverlay() {
  if (measurementContainer) return;
  measurementContainer = document.createElement('div');
  measurementContainer.id = 'sitelens-measurement-overlay';
  measurementContainer.style.position = 'fixed';
  measurementContainer.style.top = '0';
  measurementContainer.style.left = '0';
  measurementContainer.style.width = '100vw';
  measurementContainer.style.height = '100vh';
  measurementContainer.style.pointerEvents = 'none';
  measurementContainer.style.zIndex = '9999998'; // Just below tooltip
  
  const style = document.createElement('style');
  style.textContent = `
    .sitelens-measure-line {
      position: absolute;
      background: #FF3366;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .sitelens-measure-line.horizontal {
      height: 1px;
    }
    .sitelens-measure-line.vertical {
      width: 1px;
    }
    .sitelens-measure-value {
      background: #FF3366;
      color: white;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 10px;
      font-weight: 600;
      padding: 1px 4px;
      border-radius: 2px;
      position: absolute;
      white-space: nowrap;
      pointer-events: none;
    }
  `;
  
  measurementContainer.appendChild(style);
  document.body.appendChild(measurementContainer);
}

export function updateMeasurement(targetRect: DOMRect, hoverRect: DOMRect) {
  if (!measurementContainer) ensureMeasurementOverlay();
  
  // Clear previous measurements
  const lines = measurementContainer!.querySelectorAll('.sitelens-measure-line, .sitelens-measure-value');
  lines.forEach(l => l.remove());
  
  // Draw top distance
  if (hoverRect.top < targetRect.top) {
    drawLine(
      targetRect.left + targetRect.width / 2,
      hoverRect.bottom,
      1,
      targetRect.top - hoverRect.bottom,
      'vertical',
      targetRect.top - hoverRect.bottom
    );
  } else if (hoverRect.top > targetRect.bottom) {
    drawLine(
      targetRect.left + targetRect.width / 2,
      targetRect.bottom,
      1,
      hoverRect.top - targetRect.bottom,
      'vertical',
      hoverRect.top - targetRect.bottom
    );
  }

  // Draw left distance
  if (hoverRect.left < targetRect.left) {
    drawLine(
      hoverRect.right,
      targetRect.top + targetRect.height / 2,
      targetRect.left - hoverRect.right,
      1,
      'horizontal',
      targetRect.left - hoverRect.right
    );
  } else if (hoverRect.left > targetRect.right) {
    drawLine(
      targetRect.right,
      targetRect.top + targetRect.height / 2,
      hoverRect.left - targetRect.right,
      1,
      'horizontal',
      hoverRect.left - targetRect.right
    );
  }
}

function drawLine(left: number, top: number, width: number, height: number, type: 'horizontal' | 'vertical', value: number) {
  if (value <= 0 || !measurementContainer) return;

  const line = document.createElement('div');
  line.className = `sitelens-measure-line ${type}`;
  line.style.left = `${left}px`;
  line.style.top = `${top}px`;
  line.style.width = `${width}px`;
  line.style.height = `${height}px`;

  const label = document.createElement('div');
  label.className = 'sitelens-measure-value';
  label.textContent = Math.round(value).toString();
  line.appendChild(label);
  measurementContainer.appendChild(line);

  // Use requestAnimationFrame to let the browser size the newly added label, then position it
  requestAnimationFrame(() => {
    const rect = label.getBoundingClientRect();
    if (type === 'horizontal') {
      label.style.top = '0';
      label.style.transform = 'translate(-50%, -50%)';
      
      let labelLeft = width / 2;
      const absoluteMidX = left + labelLeft;
      const minX = rect.width / 2 + 8;
      const maxX = window.innerWidth - rect.width / 2 - 8;
      
      if (absoluteMidX < minX) {
        labelLeft = minX - left;
      } else if (absoluteMidX > maxX) {
        labelLeft = maxX - left;
      }
      label.style.left = `${labelLeft}px`;
    } else {
      label.style.left = '0';
      label.style.transform = 'translate(-50%, -50%)';
      
      let labelTop = height / 2;
      const absoluteMidY = top + labelTop;
      const minY = rect.height / 2 + 8;
      const maxY = window.innerHeight - rect.height / 2 - 8;
      
      if (absoluteMidY < minY) {
        labelTop = minY - top;
      } else if (absoluteMidY > maxY) {
        labelTop = maxY - top;
      }
      label.style.top = `${labelTop}px`;
    }
  });
}

export function clearMeasurement() {
  if (measurementContainer) {
    const lines = measurementContainer.querySelectorAll('.sitelens-measure-line, .sitelens-measure-value');
    lines.forEach(l => l.remove());
  }
}

export function cleanupMeasurement() {
  if (measurementContainer) {
    measurementContainer.remove();
    measurementContainer = null;
  }
}
