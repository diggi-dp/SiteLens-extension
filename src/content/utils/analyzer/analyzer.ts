/**
 * Analyzer Engine — TypeScript port
 * Based on: https://github.com/dochne/analyzer (last open-source commit)
 *
 * Detects technologies using JSON fingerprint data.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AnalyzerPattern {
  value: string;
  regex: RegExp;
  confidence: number;
  version: string;
}

export interface WapTechnology {
  name: string;
  slug: string;
  categories: number[];
  website: string | null;
  // Detection patterns — after transform
  cookies: Record<string, AnalyzerPattern[]>;
  css: AnalyzerPattern[];
  dom: any;
  headers: Record<string, AnalyzerPattern[]>;
  html: AnalyzerPattern[];
  js: Record<string, AnalyzerPattern[]>;
  meta: Record<string, AnalyzerPattern[]>;
  scriptSrc: AnalyzerPattern[];
  scripts: AnalyzerPattern[];
  text: AnalyzerPattern[];
  url: AnalyzerPattern[];
  xhr: AnalyzerPattern[];
  // Relationships
  implies: { name: string; confidence: number; version: string }[];
  excludes: { name: string }[];
  requires: { name: string }[];
  requiresCategory: { id: string }[];
}

export interface WapCategory {
  id: number;
  name: string;
  slug: string;
}

export interface AnalyzerDetection {
  technology: WapTechnology;
  pattern: AnalyzerPattern & { type: string; value: string; match: string };
  version: string;
}

export interface AnalyzerResolved {
  name: string;
  slug: string;
  categories: WapCategory[];
  confidence: number;
  version: string;
  website: string | null;
}

export interface AnalyzeItems {
  url?: string;
  html?: string;
  text?: string;
  css?: string;
  scripts?: string;
  scriptSrc?: string[];
  meta?: Record<string, string[]>;
  headers?: Record<string, string[]>;
  cookies?: Record<string, string[]>;
  xhr?: string;
  js?: Record<string, any>;
  dom?: Record<string, Array<Record<string, string>>>;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function toArray(value: any): any[] {
  return Array.isArray(value) ? value : [value];
}

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/--+/g, '-').replace(/(?:^-|-$)/g, '');
}

// ── Engine ─────────────────────────────────────────────────────────────────────

export interface AnalyzerEngine {
  technologies: WapTechnology[];
  categories: WapCategory[];
  requires: { name: string; technologies: WapTechnology[] }[];
  categoryRequires: { categoryId: number; technologies: WapTechnology[] }[];
  getTechnology: (name: string) => WapTechnology | undefined;
  getCategory: (id: number) => WapCategory | undefined;
  parsePattern: (pattern: any, isRegex?: boolean) => AnalyzerPattern | Record<string, AnalyzerPattern>;
  transformPatterns: (patterns: any, caseSensitive?: boolean, isRegex?: boolean) => any;
  setCategories: (data: Record<string, { name: string }>) => void;
  setTechnologies: (data: Record<string, any>) => void;
  resolveVersion: (pattern: AnalyzerPattern, match: string) => string;
  resolveExcludes: (resolved: AnalyzerResolved[]) => void;
  resolveImplies: (resolved: AnalyzerResolved[]) => void;
  analyze: (items: AnalyzeItems, technologies?: WapTechnology[]) => AnalyzerDetection[];
  resolve: (detections: AnalyzerDetection[]) => AnalyzerResolved[];
  analyzeOneToOne: (technology: WapTechnology, type: string, value: string) => AnalyzerDetection[];
  analyzeOneToMany: (technology: WapTechnology, type: string, items?: string[]) => AnalyzerDetection[];
  analyzeManyToMany: (technology: WapTechnology, type: string, items?: Record<string, string[]>) => AnalyzerDetection[];
  analyzeDom: (technology: any, type: string, items?: Record<string, Array<Record<string, string>>>) => AnalyzerDetection[];
}

export const Analyzer: AnalyzerEngine = {
  technologies: [] as WapTechnology[],
  categories: [] as WapCategory[],
  requires: [] as { name: string; technologies: WapTechnology[] }[],
  categoryRequires: [] as { categoryId: number; technologies: WapTechnology[] }[],

  getTechnology(name: string): WapTechnology | undefined {
    return [
      ...Analyzer.technologies,
      ...Analyzer.requires.map((r: any) => r.technologies).flat(),
      ...Analyzer.categoryRequires.map((r: any) => r.technologies).flat(),
    ].find((t: any) => t.name === name);
  },

  getCategory(id: number): WapCategory | undefined {
    return Analyzer.categories.find((c: WapCategory) => c.id === id);
  },

  // ── Pattern parsing ──────────────────────────────────────────────────────

  parsePattern(pattern: any, isRegex = true): AnalyzerPattern | Record<string, AnalyzerPattern> {
    if (typeof pattern === 'object' && pattern !== null && !Array.isArray(pattern)) {
      return Object.keys(pattern).reduce((parsed: any, key) => {
        parsed[key] = Analyzer.parsePattern(pattern[key]);
        return parsed;
      }, {});
    }

    const { value, regex, confidence, version } = pattern
      .toString()
      .split('\\;')
      .reduce((attrs: any, attr: string, i: number) => {
        if (i) {
          const parts = attr.split(':');
          if (parts.length > 1) {
            const key = parts.shift()!;
            attrs[key] = parts.join(':');
          }
        } else {
          attrs.value = typeof pattern === 'number' ? pattern : attr;
          try {
            attrs.regex = new RegExp(
              isRegex
                ? attr
                    .replace(/\//g, '\\/')
                    .replace(/\\\+/g, '__escapedPlus__')
                    .replace(/\+/g, '{1,250}')
                    .replace(/\*/g, '{0,250}')
                    .replace(/__escapedPlus__/g, '\\+')
                : '',
              'i'
            );
          } catch {
            attrs.regex = new RegExp('', 'i');
          }
        }
        return attrs;
      }, {} as any);

    return {
      value: value || '',
      regex: regex || new RegExp('', 'i'),
      confidence: parseInt(confidence || '100', 10),
      version: version || '',
    };
  },

  transformPatterns(patterns: any, caseSensitive = false, isRegex = true): any {
    if (!patterns) return [];

    if (typeof patterns === 'string' || typeof patterns === 'number' || Array.isArray(patterns)) {
      patterns = { main: patterns };
    }

    const parsed: Record<string, any> = {};
    for (const key of Object.keys(patterns)) {
      const k = caseSensitive ? key : key.toLowerCase();
      parsed[k] = toArray(patterns[key]).map((p: any) => Analyzer.parsePattern(p, isRegex));
    }

    return 'main' in parsed ? parsed.main : parsed;
  },

  // ── Data initialization ──────────────────────────────────────────────────

  setCategories(data: Record<string, { name: string }>) {
    Analyzer.categories = Object.keys(data).map(id => ({
      id: parseInt(id, 10),
      slug: slugify(data[id].name),
      name: data[id].name,
    }));
  },

  setTechnologies(data: Record<string, any>) {
    const transform = Analyzer.transformPatterns;
    const requiresMap: Record<string, WapTechnology[]> = {};
    const catRequiresMap: Record<string, WapTechnology[]> = {};

    Analyzer.technologies = Object.keys(data).reduce((techs: WapTechnology[], name) => {
      const t = data[name];
      const tech: WapTechnology = {
        name,
        slug: slugify(name),
        categories: t.cats || [],
        website: t.website || null,
        cookies: transform(t.cookies),
        css: transform(t.css),
        dom: transform(
          typeof t.dom === 'string' || Array.isArray(t.dom)
            ? toArray(t.dom).reduce((d: any, sel: string) => ({ ...d, [sel]: { exists: '' } }), {})
            : t.dom,
          true,
          false
        ),
        headers: transform(t.headers),
        html: transform(t.html),
        js: transform(t.js, true),
        meta: transform(t.meta),
        scriptSrc: transform(t.scriptSrc),
        scripts: transform(t.scripts),
        text: transform(t.text),
        url: transform(t.url),
        xhr: transform(t.xhr),
        implies: transform(t.implies).map
          ? transform(t.implies).map((p: any) => ({ name: p.value, confidence: p.confidence, version: p.version || '' }))
          : [],
        excludes: transform(t.excludes).map
          ? transform(t.excludes).map((p: any) => ({ name: p.value }))
          : [],
        requires: transform(t.requires).map
          ? transform(t.requires).map((p: any) => ({ name: p.value }))
          : [],
        requiresCategory: transform(t.requiresCategory).map
          ? transform(t.requiresCategory).map((p: any) => ({ id: p.value }))
          : [],
      };
      techs.push(tech);
      return techs;
    }, []);

    // Build requires index
    Analyzer.technologies
      .filter((t: WapTechnology) => t.requires.length)
      .forEach((tech: WapTechnology) => {
        tech.requires.forEach(({ name }: { name: string }) => {
          requiresMap[name] = requiresMap[name] || [];
          requiresMap[name].push(tech);
        });
      });

    Analyzer.requires = Object.keys(requiresMap).map(name => ({
      name,
      technologies: requiresMap[name],
    }));

    // Build category requires index
    Analyzer.technologies
      .filter((t: WapTechnology) => t.requiresCategory.length)
      .forEach((tech: WapTechnology) => {
        tech.requiresCategory.forEach(({ id }: { id: string }) => {
          catRequiresMap[id] = catRequiresMap[id] || [];
          catRequiresMap[id].push(tech);
        });
      });

    Analyzer.categoryRequires = Object.keys(catRequiresMap).map(id => ({
      categoryId: parseInt(id, 10),
      technologies: catRequiresMap[id],
    }));

    // Main list only has techs without requires
    Analyzer.technologies = Analyzer.technologies.filter(
      (t: WapTechnology) => !t.requires.length && !t.requiresCategory.length
    );
  },

  // ── Version resolution ───────────────────────────────────────────────────

  resolveVersion(pattern: AnalyzerPattern, match: string): string {
    let resolved = pattern.version;
    if (!resolved) return '';

    const matches = pattern.regex.exec(match);
    if (matches) {
      matches.forEach((m, index) => {
        if (!m || String(m).length > 10) return;
        // Ternary operator
        const ternary = new RegExp(`\\\\${index}\\?([^:]+):(.*)$`).exec(resolved);
        if (ternary && ternary.length === 3) {
          resolved = resolved.replace(ternary[0], m ? ternary[1] : ternary[2]);
        }
        resolved = resolved.trim().replace(new RegExp(`\\\\${index}`, 'g'), m || '');
      });
      resolved = resolved.replace(/\\\d/g, '');
    }
    return resolved;
  },

  // ── Relationship resolution ──────────────────────────────────────────────

  resolveExcludes(resolved: AnalyzerResolved[]) {
    const toRemove = new Set<string>();
    resolved.forEach(r => {
      const tech = Analyzer.getTechnology(r.name);
      if (!tech) return;
      tech.excludes.forEach(({ name }: { name: string }) => toRemove.add(name));
    });
    for (let i = resolved.length - 1; i >= 0; i--) {
      if (toRemove.has(resolved[i].name)) resolved.splice(i, 1);
    }
  },

  resolveImplies(resolved: AnalyzerResolved[]) {
    let done = false;
    do {
      done = true;
      resolved.forEach(({ name: rName, confidence }) => {
        const tech = Analyzer.getTechnology(rName);
        if (!tech) return;
        tech.implies.forEach(({ name, confidence: _confidence, version }: { name: string, confidence: number, version: string }) => {
          const implied = Analyzer.getTechnology(name);
          if (!implied) return;
          if (resolved.findIndex(r => r.name === implied.name) === -1) {
            resolved.push({
              name: implied.name,
              slug: implied.slug,
              categories: implied.categories.map((id: number) => Analyzer.getCategory(id)).filter(Boolean) as WapCategory[],
              confidence: Math.min(confidence, _confidence),
              version: version || '',
              website: implied.website,
            });
            done = false;
          }
        });
      });
    } while (resolved.length && !done);
  },

  // ── Core analysis ────────────────────────────────────────────────────────

  analyze(items: AnalyzeItems, technologies = Analyzer.technologies): AnalyzerDetection[] {
    const oo = Analyzer.analyzeOneToOne;
    const om = Analyzer.analyzeOneToMany;
    const mm = Analyzer.analyzeManyToMany;
    const domAnalyzer = Analyzer.analyzeDom;

    const relations: Record<string, Function> = {
      cookies: mm,
      css: oo,
      headers: mm,
      html: oo,
      meta: mm,
      scriptSrc: om,
      scripts: oo,
      text: oo,
      url: oo,
      xhr: oo,
      js: mm,
      dom: domAnalyzer,
    };

    try {
      return technologies
        .map(technology =>
          Object.keys(relations)
            .map(type => {
              const value = (items as any)[type];
              if (!value) return [];
              return (relations[type] as any)(technology, type, value);
            })
            .flat()
        )
        .flat()
        .filter(Boolean);
    } catch {
      return [];
    }
  },

  resolve(detections: AnalyzerDetection[]): AnalyzerResolved[] {
    const resolved = detections.reduce((acc: AnalyzerResolved[], { technology, pattern, version: _version }) => {
      const existing = acc.find(r => r.name === technology.name);
      if (existing) {
        existing.confidence = Math.min(100, existing.confidence + pattern.confidence);
        if (_version && _version.length > (existing.version?.length ?? 0) && _version.length <= 15) {
          existing.version = _version;
        }
      } else {
        acc.push({
          name: technology.name,
          slug: technology.slug,
          categories: technology.categories
            .map((id: number) => Analyzer.getCategory(id))
            .filter(Boolean) as WapCategory[],
          confidence: pattern.confidence,
          version: _version || '',
          website: technology.website,
        });
      }
      return acc;
    }, []);

    Analyzer.resolveExcludes(resolved);
    Analyzer.resolveImplies(resolved);

    return resolved.sort((a, b) => b.confidence - a.confidence);
  },

  // ── Pattern matchers ─────────────────────────────────────────────────────

  analyzeOneToOne(technology: WapTechnology, type: string, value: string): AnalyzerDetection[] {
    const patterns = (technology as any)[type] as AnalyzerPattern[];
    if (!patterns || !Array.isArray(patterns)) return [];

    return patterns.reduce((techs: AnalyzerDetection[], pattern) => {
      try {
        const matches = pattern.regex.exec(value);
        if (matches) {
          techs.push({
            technology,
            pattern: { ...pattern, type, value, match: matches[0] },
            version: Analyzer.resolveVersion(pattern, value),
          });
        }
      } catch { /* ignore */ }
      return techs;
    }, []);
  },

  analyzeOneToMany(technology: WapTechnology, type: string, items: string[] = []): AnalyzerDetection[] {
    const patterns = (technology as any)[type] as AnalyzerPattern[];
    if (!patterns || !Array.isArray(patterns)) return [];

    return items.reduce((techs: AnalyzerDetection[], value) => {
      patterns.forEach(pattern => {
        try {
          const matches = pattern.regex.exec(value);
          if (matches) {
            techs.push({
              technology,
              pattern: { ...pattern, type, value, match: matches[0] },
              version: Analyzer.resolveVersion(pattern, value),
            });
          }
        } catch { /* ignore */ }
      });
      return techs;
    }, []);
  },

  analyzeManyToMany(technology: WapTechnology, type: string, items: Record<string, string[]> = {}): AnalyzerDetection[] {
    const techPatterns = (technology as any)[type];
    if (!techPatterns || typeof techPatterns !== 'object' || Array.isArray(techPatterns)) return [];

    return Object.keys(techPatterns).reduce((techs: AnalyzerDetection[], key) => {
      const patterns = techPatterns[key] || [];
      const values = items[key.toLowerCase()] || items[key] || [];

      patterns.forEach((pattern: AnalyzerPattern) => {
        (Array.isArray(values) ? values : [values]).forEach((value: string) => {
          try {
            const matches = pattern.regex.exec(value);
            if (matches) {
              techs.push({
                technology,
                pattern: { ...pattern, type, value, match: matches[0] },
                version: Analyzer.resolveVersion(pattern, value),
              });
            }
          } catch { /* ignore */ }
        });
      });
      return techs;
    }, []);
  },

  analyzeDom(technology: any, type: string, items: Record<string, Array<Record<string, string>>> = {}): AnalyzerDetection[] {
    const techPatterns = (technology as any)[type];
    if (!techPatterns || typeof techPatterns !== 'object' || Array.isArray(techPatterns)) return [];

    return Object.keys(techPatterns).reduce((techs: AnalyzerDetection[], selector) => {
      const rulesList = Array.isArray(techPatterns[selector]) ? techPatterns[selector] : [techPatterns[selector]];
      const matches = items[selector] || [];

      rulesList.forEach((rules: any) => {
        matches.forEach((nodeValues: Record<string, string>) => {
          Object.keys(rules).forEach(ruleType => {
            if (ruleType === 'attributes' || ruleType === 'properties') {
              Object.keys(rules[ruleType]).forEach(key => {
                const patterns = Array.isArray(rules[ruleType][key]) ? rules[ruleType][key] : [rules[ruleType][key]];
                const value = nodeValues[`${ruleType}.${key}`];
                if (value !== undefined) {
                  patterns.forEach((pattern: AnalyzerPattern) => {
                    try {
                      const match = pattern.regex.exec(value);
                      if (match) {
                        techs.push({ technology, pattern: { ...pattern, type, value, match: match[0] }, version: Analyzer.resolveVersion(pattern, value) });
                      }
                    } catch { /* ignore */ }
                  });
                }
              });
            } else {
              const patterns = Array.isArray(rules[ruleType]) ? rules[ruleType] : [rules[ruleType]];
              const value = nodeValues[ruleType === 'exists' ? '' : ruleType];
              if (value !== undefined) {
                patterns.forEach((pattern: AnalyzerPattern) => {
                  try {
                    const match = pattern.regex.exec(value);
                    if (match) {
                      techs.push({ technology, pattern: { ...pattern, type, value, match: match[0] }, version: Analyzer.resolveVersion(pattern, value) });
                    }
                  } catch { /* ignore */ }
                });
              }
            }
          });
        });
      });
      return techs;
    }, []);
  },
};
