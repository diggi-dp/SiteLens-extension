import { create } from 'zustand';
import type { ElementInfo, ColorInfo, FontInfo, TypographyHierarchy, AssetInfo, GradientInfo, PageOverview, CSSVariableInfo } from '../../shared/types';

interface InspectorState {
  // Inspector state
  isInspecting: boolean;
  selectedElement: ElementInfo | null;
  hoveredElement: { tagName: string; id: string; classList: string[]; dimensions: { width: number; height: number } } | null;
  
  // Page data
  colors: ColorInfo[];
  fonts: FontInfo[];
  typographyHierarchy: TypographyHierarchy[];
  assets: AssetInfo[];
  gradients: GradientInfo[];
  overview: PageOverview | null;
  cssVariables: CSSVariableInfo[];
  
  // UI state
  activeTab: string;
  isLoading: boolean;
  colorFormat: 'hex' | 'rgb' | 'hsl';
  searchQuery: string;
  pinnedElements: ElementInfo[];
  inspectionHistory: ElementInfo[];

  // Actions
  setInspecting: (active: boolean) => void;
  setSelectedElement: (element: ElementInfo | null) => void;
  setHoveredElement: (el: InspectorState['hoveredElement']) => void;
  setColors: (colors: ColorInfo[]) => void;
  setFonts: (fonts: FontInfo[]) => void;
  setTypographyHierarchy: (hierarchy: TypographyHierarchy[]) => void;
  setAssets: (assets: AssetInfo[]) => void;
  setGradients: (gradients: GradientInfo[]) => void;
  setOverview: (overview: PageOverview) => void;
  setCSSVariables: (vars: CSSVariableInfo[]) => void;
  setActiveTab: (tab: string) => void;
  setLoading: (loading: boolean) => void;
  setColorFormat: (format: 'hex' | 'rgb' | 'hsl') => void;
  setSearchQuery: (query: string) => void;
  pinElement: (element: ElementInfo) => void;
  unpinElement: (selector: string) => void;
  addToHistory: (element: ElementInfo) => void;
  clearAll: () => void;
}

export const useInspectorStore = create<InspectorState>((set) => ({
  isInspecting: false,
  selectedElement: null,
  hoveredElement: null,
  colors: [],
  fonts: [],
  typographyHierarchy: [],
  assets: [],
  gradients: [],
  overview: null,
  cssVariables: [],
  activeTab: 'overview',
  isLoading: false,
  colorFormat: 'hex',
  searchQuery: '',
  pinnedElements: [],
  inspectionHistory: [],

  setInspecting: (active) => set({ isInspecting: active }),
  setSelectedElement: (element) =>
    set((state) => {
      if (element) {
        const history = [element, ...state.inspectionHistory.filter(e => e.selector !== element.selector)].slice(0, 20);
        return { selectedElement: element, inspectionHistory: history };
      }
      return { selectedElement: element };
    }),
  setHoveredElement: (el) => set({ hoveredElement: el }),
  setColors: (colors) => set({ colors }),
  setFonts: (fonts) => set({ fonts }),
  setTypographyHierarchy: (hierarchy) => set({ typographyHierarchy: hierarchy }),
  setAssets: (assets) => set({ assets }),
  setGradients: (gradients) => set({ gradients }),
  setOverview: (overview) => set({ overview }),
  setCSSVariables: (vars) => set({ cssVariables: vars }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setLoading: (loading) => set({ isLoading: loading }),
  setColorFormat: (format) => set({ colorFormat: format }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  pinElement: (element) =>
    set((state) => ({
      pinnedElements: [...state.pinnedElements.filter(e => e.selector !== element.selector), element],
    })),
  unpinElement: (selector) =>
    set((state) => ({
      pinnedElements: state.pinnedElements.filter(e => e.selector !== selector),
    })),
  addToHistory: (element) =>
    set((state) => ({
      inspectionHistory: [element, ...state.inspectionHistory.filter(e => e.selector !== element.selector)].slice(0, 20),
    })),
  clearAll: () =>
    set({
      selectedElement: null,
      hoveredElement: null,
      colors: [],
      fonts: [],
      typographyHierarchy: [],
      assets: [],
      gradients: [],
      overview: null,
      cssVariables: [],
    }),
}));
