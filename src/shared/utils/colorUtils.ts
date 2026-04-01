import type { ColorInfo } from '../types';

/**
 * Parse a CSS color string to RGB values
 */
export function parseColor(color: string): { r: number; g: number; b: number; a: number } | null {
  if (!color || color === 'transparent' || color === 'inherit' || color === 'initial' || color === 'currentcolor') {
    return null;
  }

  // Handle hex colors
  const hexMatch = color.match(/^#([0-9a-f]{3,8})$/i);
  if (hexMatch) {
    return hexToRgb(hexMatch[1]);
  }

  // Handle rgb/rgba colors (legacy comma syntax)
  const rgbMatch = color.match(/rgba?\(\s*([\d.%]+)\s*,\s*([\d.%]+)\s*,\s*([\d.%]+)\s*(?:,\s*([\d.%]+)\s*)?\)/i);
  if (rgbMatch) {
    const parseComponent = (v: string, max: number) => v.endsWith('%') ? (parseFloat(v) / 100) * max : parseFloat(v);
    return {
      r: Math.round(parseComponent(rgbMatch[1], 255)),
      g: Math.round(parseComponent(rgbMatch[2], 255)),
      b: Math.round(parseComponent(rgbMatch[3], 255)),
      a: rgbMatch[4] !== undefined ? (rgbMatch[4].endsWith('%') ? parseFloat(rgbMatch[4]) / 100 : parseFloat(rgbMatch[4])) : 1,
    };
  }

  // Handle hsl/hsla colors (legacy comma syntax)
  const hslMatch = color.match(/hsla?\(\s*([\d.]+)(?:deg|grad|rad|turn)?\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.%]+)\s*)?\)/i);
  if (hslMatch) {
    const h = parseFloat(hslMatch[1]);
    const s = parseFloat(hslMatch[2]) / 100;
    const l = parseFloat(hslMatch[3]) / 100;
    const a = hslMatch[4] !== undefined ? (hslMatch[4].endsWith('%') ? parseFloat(hslMatch[4]) / 100 : parseFloat(hslMatch[4])) : 1;
    return hslToRgb(h, s, l, a);
  }

  // Handle modern functional notation (space-separated, optional slash for alpha)
  // Support both rgb() and hsl()
  const modernMatch = color.match(/(rgba?|hsla?)\(\s*([\d.%]+(?:deg|grad|rad|turn)?)\s+([\d.%]+)\s+([\d.%]+)\s*(?:\/\s*([\d.%]+)\s*)?\)/i);
  if (modernMatch) {
    const type = modernMatch[1].toLowerCase();
    const v1 = modernMatch[2];
    const v2 = modernMatch[3];
    const v3 = modernMatch[4];
    const alphaStr = modernMatch[5];
    const a = alphaStr ? (alphaStr.endsWith('%') ? parseFloat(alphaStr) / 100 : parseFloat(alphaStr)) : 1;

    if (type.startsWith('rgb')) {
      const parseComponent = (v: string, max: number) => v.endsWith('%') ? (parseFloat(v) / 100) * max : parseFloat(v);
      return {
        r: Math.round(parseComponent(v1, 255)),
        g: Math.round(parseComponent(v2, 255)),
        b: Math.round(parseComponent(v3, 255)),
        a
      };
    } else {
      const h = parseFloat(v1);
      const s = parseFloat(v2.replace('%', '')) / 100;
      const l = parseFloat(v3.replace('%', '')) / 100;
      return hslToRgb(h, s, l, a);
    }
  }

  // Basic named colors
  const named: Record<string, string> = { black: '#000000', white: '#ffffff', red: '#ff0000', green: '#00ff00', blue: '#0000ff' };
  if (named[color.toLowerCase()]) return parseColor(named[color.toLowerCase()]);

  return null;
}

function hslToRgb(h: number, s: number, l: number, a: number): { r: number; g: number; b: number; a: number } {
  let r, g, b;
  const hu = ((h % 360) + 360) % 360 / 360;

  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue2rgb = (t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    r = hue2rgb(hu + 1/3);
    g = hue2rgb(hu);
    b = hue2rgb(hu - 1/3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
    a
  };
}

function hexToRgb(hex: string): { r: number; g: number; b: number; a: number } {
  let fullHex = hex;
  if (hex.length === 3) {
    fullHex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  } else if (hex.length === 4) {
    fullHex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
  }

  const r = parseInt(fullHex.substring(0, 2), 16);
  const g = parseInt(fullHex.substring(2, 4), 16);
  const b = parseInt(fullHex.substring(4, 6), 16);
  const a = fullHex.length === 8 ? parseInt(fullHex.substring(6, 8), 16) / 255 : 1;

  return { r, g, b, a };
}

/**
 * Convert RGB to Hex
 */
export function rgbToHex(r: number, g: number, b: number, a?: number): string {
  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  if (a !== undefined && a < 1) {
    return hex + toHex(Math.round(a * 255));
  }
  return hex;
}

/**
 * Convert RGB to HSL
 */
export function rgbToHsl(r: number, g: number, b: number, a: number = 1): { h: number; s: number; l: number; a: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
    a,
  };
}

/**
 * Format color to display string
 */
export function formatColor(color: ColorInfo, format: 'hex' | 'rgb' | 'hsl'): string {
  switch (format) {
    case 'hex':
      return color.hex;
    case 'rgb':
      if (color.rgb.a < 1) {
        return `rgba(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b}, ${color.rgb.a})`;
      }
      return `rgb(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b})`;
    case 'hsl':
      if (color.hsl.a < 1) {
        return `hsla(${color.hsl.h}, ${color.hsl.s}%, ${color.hsl.l}%, ${color.hsl.a})`;
      }
      return `hsl(${color.hsl.h}, ${color.hsl.s}%, ${color.hsl.l}%)`;
    default:
      return color.hex;
  }
}

/**
 * Calculate relative luminance
 */
export function relativeLuminance(r: number, g: number, b: number): number {
  const sRGB = [r / 255, g / 255, b / 255].map(c =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
}

/**
 * Calculate contrast ratio between two colors
 */
export function contrastRatio(
  fg: { r: number; g: number; b: number },
  bg: { r: number; g: number; b: number }
): number {
  const lum1 = relativeLuminance(fg.r, fg.g, fg.b);
  const lum2 = relativeLuminance(bg.r, bg.g, bg.b);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if a color string is meaningful (not transparent/inherit)
 */
export function isValidColor(color: string): boolean {
  if (!color) return false;
  const ignored = ['transparent', 'inherit', 'initial', 'unset', 'currentcolor', 'none', ''];
  return !ignored.includes(color.toLowerCase().trim());
}

/**
 * Create a ColorInfo object from a CSS color string
 */
export function createColorInfo(colorStr: string, category: ColorInfo['category'] = 'other'): ColorInfo | null {
  const parsed = parseColor(colorStr);
  if (!parsed) return null;

  const hex = rgbToHex(parsed.r, parsed.g, parsed.b, parsed.a);
  const hsl = rgbToHsl(parsed.r, parsed.g, parsed.b, parsed.a);

  return {
    hex: hex.toUpperCase(),
    rgb: parsed,
    hsl,
    count: 1,
    category,
    instances: [],
  };
}

/**
 * Get contrasting text color (black or white) for a background
 */
export function getContrastTextColor(hex: string): string {
  const rgb = parseColor(hex);
  if (!rgb) return '#000000';
  const lum = relativeLuminance(rgb.r, rgb.g, rgb.b);
  return lum > 0.179 ? '#000000' : '#FFFFFF';
}
