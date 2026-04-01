import type { Detection } from '../../shared/types';
import { injectDetectorScript } from './detectorInjector';
import { Analyzer, type AnalyzeItems } from './analyzer/analyzer';
import categoriesData from './analyzer/categories.json';
import technologiesData from './analyzer/technologies.json';

// ── Initialize Analyzer on first import ──────────────────────────────────────

let initialized = false;

function ensureInit() {
  if (initialized) return;
  initialized = true;
  Analyzer.setCategories(categoriesData as any);
  Analyzer.setTechnologies(technologiesData as any);
}

// ── Collect page signals into Analyzer-compatible items ──────────────────────

let requiredJsPaths: string[] | null = null;
let requiredDomRules: { selector: string; rules: any }[] | null = null;

function buildRequiredLists() {
  if (requiredJsPaths) return;
  requiredJsPaths = [];
  requiredDomRules = [];
  const jsSet = new Set<string>();
  
  for (const tech of Analyzer.technologies) {
    if (tech.js) {
      Object.keys(tech.js).forEach(k => jsSet.add(k));
    }
    if (tech.dom) {
      Object.keys(tech.dom).forEach(sel => {
        requiredDomRules!.push({ selector: sel, rules: tech.dom[sel] });
      });
    }
  }
  requiredJsPaths = Array.from(jsSet);
}

async function collectItems(): Promise<AnalyzeItems> {
  ensureInit();
  buildRequiredLists();

  // 1. Inject main-world script for JS variable access + intercepted data
  let injectedData: any = null;
  try {
    injectedData = await injectDetectorScript(requiredJsPaths!);
  } catch { /* ignore */ }

  const js = injectedData?.jsResults || {};

  const dom: Record<string, Array<Record<string, string>>> = {};
  requiredDomRules!.forEach(({ selector, rules }) => {
    try {
      const nodes = Array.from(document.querySelectorAll(selector));
      if (!nodes.length) return;
      const rulesList = Array.isArray(rules) ? rules : [rules];
      
      const extracted = nodes.map(node => {
        const vals: Record<string, string> = {};
        rulesList.forEach((rule: any) => {
          Object.keys(rule).forEach(ruleType => {
            if (ruleType === 'exists') vals[''] = '';
            else if (ruleType === 'text') vals['text'] = node.textContent?.trim() || '';
            else if (ruleType === 'attributes') {
              Object.keys(rule.attributes).forEach(attr => {
                 vals[`attributes.${attr}`] = (node as Element).getAttribute(attr) || '';
              });
            } else if (ruleType === 'properties') {
              Object.keys(rule.properties).forEach(prop => {
                 vals[`properties.${prop}`] = (node as any)[prop]?.toString() || '';
              });
            }
          });
        });
        return vals;
      });
      if (extracted.length) dom[selector] = extracted;
    } catch { /* ignore invalid selectors */ }
  });

  const injectedScripts = injectedData?.interceptedScripts || [];

  // 2. Collect script src attributes
  const domScripts = Array.from(document.querySelectorAll('script[src]'))
    .map(s => (s as HTMLScriptElement).src || '');
  const scriptSrc = Array.from(new Set([...domScripts, ...injectedScripts]));

  // 3. Collect inline script content
  const inlineScripts = Array.from(document.querySelectorAll('script:not([src])'))
    .map(s => s.textContent || '')
    .join('\n');

  // 4. Meta tags → { name: [content] }
  const meta: Record<string, string[]> = {};
  document.querySelectorAll('meta').forEach(m => {
    const name = (m.getAttribute('name') || m.getAttribute('property') || '').toLowerCase();
    const content = m.getAttribute('content') || '';
    if (name) {
      if (!meta[name]) meta[name] = [];
      meta[name].push(content);
    }
  });

  // 5. Cookies → { name: [value] }
  const cookies: Record<string, string[]> = {};
  try {
    document.cookie.split(';').forEach(c => {
      const [name, ...rest] = c.trim().split('=');
      if (name) {
        cookies[name.trim().toLowerCase()] = [rest.join('=') || ''];
      }
    });
  } catch { /* ignore */ }

  // 6. HTML content
  const html = document.documentElement.outerHTML || '';

  // 7. CSS — collect all stylesheet text-content (inline styles)
  let css = '';
  try {
    const styleSheets = Array.from(document.querySelectorAll('style'));
    css = styleSheets.map(s => s.textContent || '').join('\n');
  } catch { /* ignore */ }

  // 8. URL
  const url = window.location.href;

  // 9. Text content (visible text for body)
  let text = '';
  try {
    text = document.body?.innerText?.substring(0, 50000) || '';
  } catch { /* ignore */ }

  return {
    url,
    html,
    text,
    css,
    scripts: inlineScripts,
    scriptSrc,
    meta,
    headers: {}, // Not accessible from content script — service worker can provide these
    cookies,
    xhr: '', // Would need intercepting to populate
    js,
    dom,
  };
}

// ── Map Analyzer category to SiteLens category string ────────────────────────

function mapCategory(categories: { id: number; name: string }[]): string {
  if (!categories.length) return 'misc';

  // Map Analyzer category IDs to SiteLens category strings
  const catMap: Record<number, string> = {
    1: 'cms',           // CMS
    6: 'ecommerce',     // Ecommerce
    10: 'analytics',    // Analytics
    12: 'framework',    // JavaScript frameworks
    18: 'framework',    // Web frameworks
    22: 'server',       // Web servers
    23: 'caching',      // Caching
    25: 'graphics',     // JavaScript graphics
    26: 'framework',    // Mobile frameworks
    27: 'language',     // Programming languages
    31: 'cdn',          // CDN
    32: 'marketing',    // Marketing automation
    36: 'advertising',  // Advertising
    41: 'payment',      // Payment processors
    42: 'tag-manager',  // Tag managers
    47: 'development',  // Development
    56: 'ui-library',   // UI frameworks
    57: 'meta-framework', // Static site generator
    59: 'library',      // JavaScript libraries
    62: 'hosting',      // PaaS
    63: 'hosting',      // IaaS
    66: 'ui-library',   // UI frameworks (duplicate id)
    67: 'privacy',      // Cookie compliance
    68: 'accessibility', // Accessibility
    70: 'performance',  // Performance
    71: 'observability', // Observability
    72: 'seo',          // SEO
    78: 'analytics',    // RUM
    83: 'testing',      // A/B Testing
    85: 'forms',        // Form builders
    87: 'live-chat',    // Live chat
    88: 'hosting',      // Hosting
    89: 'privacy',      // Consent management
    91: 'auth',         // Authentication
    92: 'auth',         // Social login
    95: 'analytics',    // Customer data platform
    106: 'page-builder', // Page builders
    108: 'chatbot',     // Chatbots
    109: 'cms',         // Headless CMS
  };

  // Return first matching mapped category
  for (const cat of categories) {
    if (catMap[cat.id]) return catMap[cat.id];
  }

  // Fall back to the first category name, slugified
  return categories[0].name.toLowerCase().replace(/\s+/g, '-');
}

// ── Main detection entry point ─────────────────────────────────────────────────

export async function detectFrontendStack(): Promise<Detection[]> {
  ensureInit();

  const items = await collectItems();
  const detections = Analyzer.analyze(items);
  const resolved = Analyzer.resolve(detections);

  return resolved
    .map(r => ({
      name: r.name,
      category: mapCategory(r.categories) as any,
      confidence: Math.min(100, r.confidence),
      evidence: r.categories.map(c => c.name),
      version: r.version || undefined,
      website: r.website || undefined,
    }))
    .filter(d => d.confidence >= 10) // Filter out very low confidence
    .sort((a, b) => b.confidence - a.confidence);
}
