import type { GradientInfo, GradientStop } from '../types';
import { parseColor, rgbToHex } from './colorUtils';

/**
 * Parse CSS gradient string into structured data
 */
export function parseGradient(gradientStr: string): GradientInfo | null {
  if (!gradientStr || gradientStr === 'none') return null;

  // Match gradient type
  const gradientMatch = gradientStr.match(/^(linear|radial|conic)-gradient\((.+)\)$/i);
  if (!gradientMatch) return null;

  const type = gradientMatch[1].toLowerCase() as GradientInfo['type'];
  const content = gradientMatch[2];

  // Extract direction for linear gradients
  let direction: string | undefined;
  let stopsStr = content;

  if (type === 'linear') {
    const dirMatch = content.match(/^(to\s+(?:top|bottom|left|right)(?:\s+(?:top|bottom|left|right))?|\d+deg)\s*,\s*/);
    if (dirMatch) {
      direction = dirMatch[1];
      stopsStr = content.substring(dirMatch[0].length);
    }
  }

  // Parse color stops
  const stops = parseGradientStops(stopsStr);

  return {
    type,
    raw: gradientStr,
    direction,
    stops,
    element: '',
    selector: '',
  };
}

function parseGradientStops(stopsStr: string): GradientStop[] {
  const stops: GradientStop[] = [];
  
  // Split by commas, but handle rgba() content
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  
  for (const char of stopsStr) {
    if (char === '(' ) depth++;
    if (char === ')') depth--;
    if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());

  for (const part of parts) {
    const colorMatch = part.match(/^(.+?)(?:\s+([\d.]+%|[\d.]+(?:px|em|rem)?))?\s*$/);
    if (colorMatch) {
      const colorStr = colorMatch[1].trim();
      const position = colorMatch[2] || '';
      const parsed = parseColor(colorStr);
      const hex = parsed ? rgbToHex(parsed.r, parsed.g, parsed.b, parsed.a) : colorStr;

      stops.push({
        color: colorStr,
        position,
        hex: hex.toUpperCase(),
      });
    }
  }

  return stops;
}

/**
 * Extract all gradients from a page's computed styles
 */
export function extractGradients(elements: HTMLElement[]): GradientInfo[] {
  const gradients: GradientInfo[] = [];
  const seen = new Set<string>();

  for (const el of elements) {
    const styles = window.getComputedStyle(el);
    const bgImage = styles.backgroundImage;

    if (bgImage && bgImage !== 'none') {
      // Can have multiple backgrounds
      const gradientMatches = bgImage.match(/(linear|radial|conic)-gradient\([^)]+(?:\([^)]*\))*[^)]*\)/gi);
      if (gradientMatches) {
        for (const g of gradientMatches) {
          if (!seen.has(g)) {
            seen.add(g);
            const parsed = parseGradient(g);
            if (parsed) {
              parsed.element = el.tagName.toLowerCase();
              parsed.selector = getSimpleSelector(el);
              gradients.push(parsed);
            }
          }
        }
      }
    }
  }

  return gradients;
}

function getSimpleSelector(el: HTMLElement): string {
  let selector = el.tagName.toLowerCase();
  if (el.id) selector += `#${el.id}`;
  if (el.classList.length > 0) {
    selector += `.${Array.from(el.classList).join('.')}`;
  }
  return selector;
}
