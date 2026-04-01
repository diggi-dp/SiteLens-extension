import type { ColorInfo } from '../types';
import { formatColor } from './colorUtils';

export type ExportFormat = 'json' | 'css-vars' | 'scss' | 'tailwind' | 'sketch' | 'figma' | 'ase' | 'clipboard';

/**
 * Export color palette in various formats
 */
export function exportColorPalette(colors: ColorInfo[], format: ExportFormat): string {
  switch (format) {
    case 'json':
      return exportAsJSON(colors);
    case 'css-vars':
      return exportAsCSSVars(colors);
    case 'scss':
      return exportAsSCSS(colors);
    case 'tailwind':
      return exportAsTailwind(colors);
    case 'sketch':
      return exportAsSketchPalette(colors);
    case 'figma':
      return exportAsFigmaTokens(colors);
    case 'ase':
      return exportAsASE(colors);
    case 'clipboard':
      return exportAsClipboard(colors);
    default:
      return exportAsJSON(colors);
  }
}

function exportAsJSON(colors: ColorInfo[]): string {
  return JSON.stringify(
    colors.map(c => ({
      hex: c.hex,
      rgb: `rgb(${c.rgb.r}, ${c.rgb.g}, ${c.rgb.b})`,
      hsl: `hsl(${c.hsl.h}, ${c.hsl.s}%, ${c.hsl.l}%)`,
      category: c.category,
      count: c.count,
    })),
    null,
    2
  );
}

function exportAsCSSVars(colors: ColorInfo[]): string {
  const lines = [':root {'];
  colors.forEach((c, i) => {
    const name = c.category !== 'other' ? `--color-${c.category}-${i + 1}` : `--color-${i + 1}`;
    lines.push(`  ${name}: ${c.hex};`);
  });
  lines.push('}');
  return lines.join('\n');
}

function exportAsSCSS(colors: ColorInfo[]): string {
  return colors
    .map((c, i) => {
      const name = c.category !== 'other' ? `$color-${c.category}-${i + 1}` : `$color-${i + 1}`;
      return `${name}: ${c.hex};`;
    })
    .join('\n');
}

function exportAsTailwind(colors: ColorInfo[]): string {
  const obj: Record<string, string> = {};
  colors.forEach((c, i) => {
    const key = c.category !== 'other' ? `${c.category}-${i + 1}` : `custom-${i + 1}`;
    obj[key] = c.hex;
  });
  return `module.exports = {\n  theme: {\n    extend: {\n      colors: ${JSON.stringify(obj, null, 8).replace(/^/gm, '      ').trim()}\n    }\n  }\n}`;
}

function exportAsSketchPalette(colors: ColorInfo[]): string {
  // Sketch palette format
  const palette = {
    compatibleVersion: '2.0',
    pluginVersion: '2.22',
    colors: colors.map(c => ({
      red: c.rgb.r / 255,
      green: c.rgb.g / 255,
      blue: c.rgb.b / 255,
      alpha: c.rgb.a,
    })),
  };
  return JSON.stringify(palette, null, 2);
}

function exportAsFigmaTokens(colors: ColorInfo[]): string {
  const tokens: Record<string, unknown> = {};
  colors.forEach((c, i) => {
    const key = c.category !== 'other' ? `${c.category}-${i + 1}` : `color-${i + 1}`;
    tokens[key] = {
      value: c.hex,
      type: 'color',
      description: `${c.category} color used ${c.count} time(s)`,
    };
  });
  return JSON.stringify({ colors: tokens }, null, 2);
}

function exportAsASE(colors: ColorInfo[]): string {
  // Adobe Swatch Exchange (simplified text representation)
  return colors
    .map(c => `${c.hex} (${formatColor(c, 'rgb')})`)
    .join('\n');
}

function exportAsClipboard(colors: ColorInfo[]): string {
  return colors.map(c => c.hex).join(', ');
}

/**
 * Export CSS of an element
 */
export function exportElementCSS(
  styles: Record<string, string>,
  selector: string,
  format: 'css' | 'tailwind' = 'css'
): string {
  if (format === 'tailwind') {
    return convertToTailwind(styles);
  }

  const lines = [`${selector} {`];
  for (const [prop, value] of Object.entries(styles)) {
    if (value && value !== 'initial' && value !== 'none') {
      lines.push(`  ${prop}: ${value};`);
    }
  }
  lines.push('}');
  return lines.join('\n');
}

/**
 * Basic CSS to Tailwind class converter
 */
function convertToTailwind(styles: Record<string, string>): string {
  const classes: string[] = [];
  const mapping: Record<string, (v: string) => string | null> = {
    'display': (v) => v === 'flex' ? 'flex' : v === 'grid' ? 'grid' : v === 'block' ? 'block' : v === 'inline' ? 'inline' : v === 'none' ? 'hidden' : null,
    'position': (v) => v === 'relative' ? 'relative' : v === 'absolute' ? 'absolute' : v === 'fixed' ? 'fixed' : v === 'sticky' ? 'sticky' : null,
    'flex-direction': (v) => v === 'column' ? 'flex-col' : v === 'row' ? 'flex-row' : null,
    'justify-content': (v) => v === 'center' ? 'justify-center' : v === 'space-between' ? 'justify-between' : v === 'flex-start' ? 'justify-start' : v === 'flex-end' ? 'justify-end' : null,
    'align-items': (v) => v === 'center' ? 'items-center' : v === 'flex-start' ? 'items-start' : v === 'flex-end' ? 'items-end' : v === 'stretch' ? 'items-stretch' : null,
    'text-align': (v) => v === 'center' ? 'text-center' : v === 'left' ? 'text-left' : v === 'right' ? 'text-right' : null,
    'font-weight': (v) => v === 'bold' || v === '700' ? 'font-bold' : v === '600' ? 'font-semibold' : v === '500' ? 'font-medium' : v === 'normal' || v === '400' ? 'font-normal' : null,
    'overflow': (v) => v === 'hidden' ? 'overflow-hidden' : v === 'auto' ? 'overflow-auto' : v === 'scroll' ? 'overflow-scroll' : null,
    'cursor': (v) => v === 'pointer' ? 'cursor-pointer' : null,
    'opacity': (v) => `opacity-${Math.round(parseFloat(v) * 100)}`,
    'border-radius': (v) => v === '9999px' || v === '50%' ? 'rounded-full' : v === '0px' ? 'rounded-none' : 'rounded',
  };

  for (const [prop, value] of Object.entries(styles)) {
    const converter = mapping[prop];
    if (converter) {
      const cls = converter(value);
      if (cls) classes.push(cls);
    }
  }

  return classes.join(' ');
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  }
}

/**
 * Get file extension for export format
 */
export function getExportExtension(format: ExportFormat): string {
  const extensions: Record<ExportFormat, string> = {
    json: '.json',
    'css-vars': '.css',
    scss: '.scss',
    tailwind: '.js',
    sketch: '.sketchpalette',
    figma: '.json',
    ase: '.txt',
    clipboard: '.txt',
  };
  return extensions[format] || '.txt';
}
