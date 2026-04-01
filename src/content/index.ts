/// <reference types="chrome" />
/**
 * SiteLens Content Script
 * Injected into every page to handle:
 * - Floating panel (iframe) creation and management
 * - Element inspection with hover/click
 * - Style extraction, color/typography/asset collection
 */

import { 
  MessageType, 
  type ElementInfo, 
  type ColorInfo, 
  type TypographyHierarchy, 
  type FontInfo, 
  type AssetInfo,
  type ColorCategory,
  type BoxModel,
  type PseudoElementInfo,
  type AccessibilityInfo,
  type ExtensionMessage
} from '../shared/types';
import { updateMeasurement, clearMeasurement, cleanupMeasurement } from './overlay/MeasurementOverlay';
import { parseColor, rgbToHex, rgbToHsl, isValidColor, contrastRatio } from '../shared/utils/colorUtils';
import { detectFrontendStack } from './utils/detectStack';
import { isFeatureEnabled } from '../config/featureFlags';

// ==========================================
// State
// ==========================================

let isInspecting = false;
let panelVisible = false;

// DOM elements
let panelContainer: HTMLDivElement | null = null;
let panelIframe: HTMLIFrameElement | null = null;
let highlightOverlay: HTMLDivElement | null = null;
let selectedOverlay: HTMLDivElement | null = null;
let tooltip: HTMLDivElement | null = null;
let currentTarget: HTMLElement | null = null;
let selectedTarget: HTMLElement | null = null; // Track locked selection for measurement
let isAltPressed = false;
let lastMouseX = 0;
let lastMouseY = 0;

// Drag state
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let panelStartX = 0;
let panelStartY = 0;

// ==========================================
// Initialization
// ==========================================

function init() {
  setupMessageListeners();
  // Restore theme from chrome.storage.local so the header matches the user's choice
  try {
    chrome.storage.local.get(['sitelens-settings'], (result) => {
      const saved = ((result['sitelens-settings'] as Record<string, string>) || {})?.theme || 'light';
      applyFloatingTheme(saved);
    });
  } catch { /* ignore */ }
  console.log('SiteLens content script ready');
  startHydrationObserver();
}

// ==========================================
// Floating Panel
// ==========================================

function togglePanel() {
  if (panelVisible) {
    hidePanel();
  } else {
    showPanel();
  }
}

function showPanel() {
  if (panelContainer) {
    panelContainer.style.display = 'flex';
    requestAnimationFrame(() => {
      if (panelContainer) {
        panelContainer.style.opacity = '1';
        panelContainer.style.transform = 'scale(1) translateY(0)';
      }
    });
    panelVisible = true;
    return;
  }

  // Create container
  panelContainer = document.createElement('div');
  panelContainer.id = 'sitelens-panel';
  Object.assign(panelContainer.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    width: '380px',
    height: '560px',
    zIndex: '2147483645',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: '14px',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.08)',
    background: '#FFFFFF',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    opacity: '0',
    transform: 'scale(0.95) translateY(-8px)',
    transition: 'opacity 0.25s ease, transform 0.25s ease',
    minWidth: '320px',
    minHeight: '400px',
  });

  // --- Header (drag handle) ---
  const header = document.createElement('div');
  Object.assign(header.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    background: '#FFFFFF',
    cursor: 'grab',
    userSelect: 'none',
    borderBottom: '1px solid #EEEEEE',
    flexShrink: '0',
  });

  // Brand
  const brand = document.createElement('div');
  brand.style.cssText = 'display:flex;align-items:center;gap:8px;';

  const logo = document.createElement('div');
  Object.assign(logo.style, {
    width: '22px', height: '22px', borderRadius: '6px',
    background: 'linear-gradient(135deg, #E85D04, #F4845F)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '11px', fontWeight: '700', color: 'white',
  });
  logo.textContent = 'S';

  const title = document.createElement('span');
  Object.assign(title.style, {
    fontSize: '13px', fontWeight: '700', letterSpacing: '0.3px',
    background: 'linear-gradient(135deg, #E85D04, #F4845F)',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    color: '#E85D04',
  });
  title.textContent = 'SiteLens';

  brand.append(logo, title);

  // Controls — only Close button; Inspect/Sidebar live in the iframe's Header.tsx
  const controls = document.createElement('div');
  controls.style.cssText = 'display:flex;gap:4px;';

  const closeBtn = makeBtn('✕', 'Close Panel');
  closeBtn.addEventListener('click', hidePanel);

  controls.append(closeBtn);
  header.append(brand, controls);

  // Drag logic
  header.addEventListener('mousedown', (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    const rect = panelContainer!.getBoundingClientRect();
    panelStartX = rect.left;
    panelStartY = rect.top;
    header.style.cursor = 'grabbing';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e: MouseEvent) => {
    if (!isDragging || !panelContainer) return;
    panelContainer.style.left = `${panelStartX + e.clientX - dragStartX}px`;
    panelContainer.style.top = `${panelStartY + e.clientY - dragStartY}px`;
    panelContainer.style.right = 'auto';
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      if (header) header.style.cursor = 'grab';
    }
  });

  // --- Resize handle ---
  const resizeHandle = document.createElement('div');
  Object.assign(resizeHandle.style, {
    position: 'absolute', bottom: '0', right: '0',
    width: '18px', height: '18px', cursor: 'nwse-resize',
    background: 'transparent', zIndex: '10',
  });

  let isResizing = false;
  let resizeStartX = 0, resizeStartY = 0, startW = 0, startH = 0;

  resizeHandle.addEventListener('mousedown', (e: MouseEvent) => {
    isResizing = true;
    resizeStartX = e.clientX;
    resizeStartY = e.clientY;
    const rect = panelContainer!.getBoundingClientRect();
    startW = rect.width;
    startH = rect.height;
    e.preventDefault();
    e.stopPropagation();
  });

  document.addEventListener('mousemove', (e: MouseEvent) => {
    if (!isResizing || !panelContainer) return;
    const w = Math.max(320, startW + e.clientX - resizeStartX);
    const h = Math.max(400, startH + e.clientY - resizeStartY);
    panelContainer.style.width = `${w}px`;
    panelContainer.style.height = `${h}px`;
  });

  document.addEventListener('mouseup', () => { isResizing = false; });

  // --- Iframe ---
  panelIframe = document.createElement('iframe');
  panelIframe.src = chrome.runtime.getURL('index.html');
  Object.assign(panelIframe.style, {
    flex: '1', width: '100%', border: 'none', background: '#0D0D1A',
  });
  panelIframe.setAttribute('allow', 'clipboard-write');

  // Assemble
  panelContainer.append(header, panelIframe, resizeHandle);
  document.documentElement.appendChild(panelContainer);

  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (panelContainer) {
        panelContainer.style.opacity = '1';
        panelContainer.style.transform = 'scale(1) translateY(0)';
      }
    });
  });

  panelVisible = true;
}

function hidePanel() {
  if (!panelContainer) return;
  panelContainer.style.opacity = '0';
  panelContainer.style.transform = 'scale(0.95) translateY(-8px)';
  setTimeout(() => {
    if (panelContainer) panelContainer.style.display = 'none';
  }, 250);
  panelVisible = false;
  stopInspection();
}

function makeBtn(text: string, title: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.textContent = text;
  btn.title = title;
  Object.assign(btn.style, {
    width: '28px', height: '28px', borderRadius: '7px',
    background: 'transparent', border: 'none',
    color: '#555555', cursor: 'pointer',
    fontSize: '14px', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.15s ease',
  });
  btn.addEventListener('mouseenter', () => {
    if (!btn.dataset.active) {
      btn.style.background = 'rgba(0,0,0,0.06)';
      btn.style.color = '#111111';
    }
  });
  btn.addEventListener('mouseleave', () => {
    if (!btn.dataset.active) {
      btn.style.background = 'transparent';
      btn.style.color = '#555555';
    }
  });
  return btn;
}

// ==========================================
// Overlays (lazy created)
// ==========================================

function ensureOverlays() {
  if (highlightOverlay) return;

  highlightOverlay = document.createElement('div');
  highlightOverlay.className = 'sitelens-highlight-overlay';
  highlightOverlay.style.display = 'none';

  selectedOverlay = document.createElement('div');
  selectedOverlay.className = 'sitelens-selected-overlay';
  selectedOverlay.style.display = 'none';

  tooltip = document.createElement('div');
  tooltip.className = 'sitelens-tooltip';
  tooltip.style.display = 'none';

  document.documentElement.appendChild(highlightOverlay);
  document.documentElement.appendChild(selectedOverlay);
  document.documentElement.appendChild(tooltip);
}

// ==========================================
// Inspection Control
// ==========================================

function toggleInspection() {
  if (isInspecting) {
    stopInspection();
  } else {
    startInspection();
  }
}

function startInspection() {
  ensureOverlays();
  isInspecting = true;
  updateInspectButtonUI();
  document.body.classList.add('sitelens-inspecting');
  document.addEventListener('mousemove', handleMouseMove, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('keydown', handleKeyDown, true);
  document.addEventListener('keyup', handleKeyUp, true);
  window.addEventListener('scroll', handleScroll, true);
  sendMessage({ type: MessageType.INSPECTION_STARTED });
}

function stopInspection() {
  isInspecting = false;
  updateInspectButtonUI();
  document.body.classList.remove('sitelens-inspecting');
  if (highlightOverlay) highlightOverlay.style.display = 'none';
  if (tooltip) tooltip.style.display = 'none';
  document.removeEventListener('mousemove', handleMouseMove, true);
  document.removeEventListener('click', handleClick, true);
  // Do NOT remove keydown or currentTarget here, so keyboard traversal works after selection
}

function clearSelection() {
  document.removeEventListener('keydown', handleKeyDown, true);
  document.removeEventListener('keyup', handleKeyUp, true);
  currentTarget = null;
  selectedTarget = null;
  isAltPressed = false;
  clearMeasurement();
  window.removeEventListener('scroll', handleScroll, true);
  if (selectedOverlay) selectedOverlay.style.display = 'none';
}

function updateInspectButtonUI() {
  const btn = document.getElementById('sitelens-inspect-btn');
  if (btn) {
    btn.style.background = isInspecting ? 'rgba(124,92,252,0.3)' : 'transparent';
    btn.style.color = isInspecting ? '#7C5CFC' : '#A0A0CC';
    btn.dataset.active = isInspecting ? 'true' : '';
  }
}

// ==========================================
// Event Handlers
// ==========================================

function handleMouseMove(e: MouseEvent) {
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;

  // If we have a selected target and Alt is pressed, calculate distance to hover target
  if (selectedTarget && isAltPressed && isFeatureEnabled('measurementOverlay')) {
    const hoverEl = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;
    if (hoverEl && !isSiteLensElement(hoverEl) && hoverEl !== selectedTarget) {
      updateMeasurement(selectedTarget.getBoundingClientRect(), hoverEl.getBoundingClientRect());
      // We don't want to update the main highlight or tooltip while measuring
      return;
    } else {
      clearMeasurement();
    }
  }

  if (!isInspecting) return;
  const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;
  if (!target || isSiteLensElement(target)) return;
  if (target === currentTarget) return;
  currentTarget = target;
  updateHighlight(target);
  updateTooltip(target, e.clientX, e.clientY);
  sendMessage({ type: MessageType.ELEMENT_HOVERED, payload: extractBasicInfo(target) });
}

function handleClick(e: MouseEvent) {
  if (!isInspecting) return;
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;
  if (!target || isSiteLensElement(target)) return;
  updateSelectedOverlay(target);
  selectedTarget = target; // Lock selection for measurement
  const info = extractElementInfo(target);
  sendMessage({ type: MessageType.ELEMENT_SELECTED, payload: info });
  
  // Stop inspection to lock the selection visually
  stopInspection();
  sendMessage({ type: MessageType.STOP_INSPECTION });
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Alt' || e.key === 'Option') {
    isAltPressed = true;
    if (!isInspecting && selectedTarget && isFeatureEnabled('measurementOverlay')) {
      // Temporarily re-enable mousemove to track hover target for distance
      document.addEventListener('mousemove', handleMouseMove, true);
    }
  }

  // If we are currently typing in an input/textarea inside the extension panel, ignore
  if ((e.target as HTMLElement).closest('#sitelens-panel')) return;

  if (e.key === 'Escape') {
    stopInspection();
    clearSelection();
    sendMessage({ type: MessageType.STOP_INSPECTION });
    return;
  }

  // Element traversal (only if we have a currentTarget and are inspecting or have a selected element)
  if (currentTarget && (isInspecting || document.querySelector('.sitelens-selected-overlay'))) {
    // Determine the next element based on the key
    let nextEl: HTMLElement | null = null;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        nextEl = currentTarget.parentElement;
        break;
      case 'ArrowDown':
        e.preventDefault();
        nextEl = currentTarget.firstElementChild as HTMLElement;
        break;
      case 'ArrowLeft':
        e.preventDefault();
        nextEl = currentTarget.previousElementSibling as HTMLElement;
        break;
      case 'ArrowRight':
        e.preventDefault();
        nextEl = currentTarget.nextElementSibling as HTMLElement;
        break;
      case 'Tab':
        e.preventDefault();
        if (e.shiftKey) {
          nextEl = currentTarget.previousElementSibling as HTMLElement;
        } else {
          nextEl = currentTarget.nextElementSibling as HTMLElement;
        }
        break;
    }

    // If we found a valid sibling/parent/child, move to it
    if (nextEl && !isSiteLensElement(nextEl) && nextEl !== document.body && nextEl !== document.documentElement) {
      currentTarget = nextEl;
      selectedTarget = nextEl; // Update locked selection too
      
      if (isInspecting) {
        // Highlight mode
        updateHighlight(nextEl);
        // We do not have mouse coordinates for tooltip, so we can hide or update it based on element rect
        const rect = nextEl.getBoundingClientRect();
        updateTooltip(nextEl, rect.left + rect.width / 2, rect.top + rect.height / 2);
        sendMessage({ type: MessageType.ELEMENT_HOVERED, payload: extractBasicInfo(nextEl) });
      } else {
        // Selection mode
        updateSelectedOverlay(nextEl);
        const info = extractElementInfo(nextEl);
        sendMessage({ type: MessageType.ELEMENT_SELECTED, payload: info });
      }

      // Ensure the element is visible in the viewport
      nextEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}

function handleKeyUp(e: KeyboardEvent) {
  if (e.key === 'Alt' || e.key === 'Option') {
    isAltPressed = false;
    clearMeasurement();
    if (!isInspecting) {
      // Remove the temporary mousemove listener we added in keydown
      document.removeEventListener('mousemove', handleMouseMove, true);
    }
  }
}

function handleScroll() {
  if (selectedTarget && isAltPressed && isFeatureEnabled('measurementOverlay')) {
    const hoverEl = document.elementFromPoint(lastMouseX, lastMouseY) as HTMLElement;
    if (hoverEl && !isSiteLensElement(hoverEl) && hoverEl !== selectedTarget) {
      updateMeasurement(selectedTarget.getBoundingClientRect(), hoverEl.getBoundingClientRect());
    } else {
      clearMeasurement();
    }
  }
}

function isSiteLensElement(el: HTMLElement): boolean {
  return !!(
    el.id === 'sitelens-panel' ||
    el.closest('#sitelens-panel') ||
    el.classList?.contains('sitelens-highlight-overlay') ||
    el.classList?.contains('sitelens-selected-overlay') ||
    el.classList?.contains('sitelens-tooltip')
  );
}

// ==========================================
// Visual Overlays
// ==========================================

function updateHighlight(element: HTMLElement) {
  if (!highlightOverlay) return;
  const rect = element.getBoundingClientRect();
  highlightOverlay.style.display = 'block';
  highlightOverlay.style.left = `${rect.left}px`;
  highlightOverlay.style.top = `${rect.top}px`;
  highlightOverlay.style.width = `${rect.width}px`;
  highlightOverlay.style.height = `${rect.height}px`;
}

function updateSelectedOverlay(element: HTMLElement) {
  if (!selectedOverlay) return;
  const rect = element.getBoundingClientRect();
  selectedOverlay.style.display = 'block';
  selectedOverlay.style.left = `${rect.left}px`;
  selectedOverlay.style.top = `${rect.top}px`;
  selectedOverlay.style.width = `${rect.width}px`;
  selectedOverlay.style.height = `${rect.height}px`;
}

function updateTooltip(element: HTMLElement, mouseX: number, mouseY: number) {
  if (!tooltip) return;
  const rect = element.getBoundingClientRect();
  const tag = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : '';
  const classes = element.classList.length > 0
    ? `.${Array.from(element.classList).filter(c => !c.startsWith('sitelens-')).slice(0, 3).join('.')}`
    : '';
  const dims = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;

  tooltip.innerHTML = `
    <span class="sitelens-tooltip-tag">${tag}</span><span class="sitelens-tooltip-id">${id}</span><span class="sitelens-tooltip-class">${classes}</span>
    <span class="sitelens-tooltip-dims">${dims}</span>
  `;
  tooltip.style.display = 'block';

  const tooltipRect = tooltip.getBoundingClientRect();
  let x = mouseX + 12;
  let y = mouseY + 12;
  if (x + tooltipRect.width > window.innerWidth - 10) x = mouseX - tooltipRect.width - 12;
  if (y + tooltipRect.height > window.innerHeight - 10) y = mouseY - tooltipRect.height - 12;
  tooltip.style.left = `${Math.max(4, x)}px`;
  tooltip.style.top = `${Math.max(4, y)}px`;
}

// ── Theme helpers for the floating panel DOM ──────────────────────────────────

const THEME_LIGHT = {
  bg: '#FFFFFF',
  border: '#EEEEEE',
  text: '#1A1A1A',
  logoBg: '#E85D04',
  btnColor: '#555555',
  btnHoverBg: 'rgba(0,0,0,0.06)',
  btnHoverColor: '#111111',
};

const THEME_DARK = {
  bg: '#1A1A2E',
  border: 'rgba(255,255,255,0.06)',
  text: '#EAEAFF',
  logoBg: '#E85D04',
  btnColor: '#A0A0CC',
  btnHoverBg: 'rgba(255,255,255,0.08)',
  btnHoverColor: '#EAEAFF',
};

function applyFloatingTheme(theme: string) {
  if (!panelContainer) return;
  const t = theme === 'dark' ? THEME_DARK : THEME_LIGHT;

  // Panel container bg
  panelContainer.style.background = t.bg;

  // Header (first child of panelContainer)
  const header = panelContainer.firstElementChild as HTMLElement | null;
  if (header) {
    header.style.background = t.bg;
    header.style.borderBottom = `1px solid ${t.border}`;

    // Brand sub-container: first child of header
    const brand = header.firstElementChild as HTMLElement | null;
    if (brand) {
      // Logo: first child of brand
      // (background stays orange — already correct)
      const titleEl = brand.children[1] as HTMLElement | null;
      if (titleEl) {
        // titleEl retains its gradient, no need to override color
      }
    }

    // Controls: buttons (second child of header)
    const controls = header.lastElementChild as HTMLElement | null;
    if (controls) {
      Array.from(controls.querySelectorAll('button')).forEach((btn) => {
        const b = btn as HTMLElement;
        b.style.color = t.btnColor;
        // Re-wire hover events with new colours
        b.onmouseenter = () => { b.style.background = t.btnHoverBg; b.style.color = t.btnHoverColor; };
        b.onmouseleave = () => { b.style.background = 'transparent'; b.style.color = t.btnColor; };
      });
    }
  }
}

// ==========================================
// Message Handling
// ==========================================

function extractMetadata() {
  const metadata: Record<string, string> = {};
  
  // Standard tags
  metadata['title'] = document.title;
  const description = document.querySelector('meta[name="description"]');
  if (description) metadata['description'] = description.getAttribute('content') || '';
  
  // All meta tags (name and property)
  const metas = document.getElementsByTagName('meta');
  for (let i = 0; i < metas.length; i++) {
    const name = metas[i].getAttribute('name') || metas[i].getAttribute('property');
    const content = metas[i].getAttribute('content');
    if (name && content) {
      metadata[name] = content;
    }
    // http-equiv tags
    const httpEquiv = metas[i].getAttribute('http-equiv');
    if (httpEquiv && content) {
      metadata[httpEquiv] = content;
    }
    // charset
    const charset = metas[i].getAttribute('charset');
    if (charset) {
      metadata['charset'] = charset;
    }
  }
  
  // Canonical URL
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) metadata['canonical'] = canonical.getAttribute('href') || '';

  // Icons & Favicon
  const favicon = document.querySelector('link[rel="icon"]') || document.querySelector('link[rel="shortcut icon"]');
  if (favicon) {
    let href = favicon.getAttribute('href') || '';
    if (href && !href.startsWith('http')) {
      href = new URL(href, window.location.origin).href;
    }
    metadata['favicon'] = href;
  }
  
  // Apple touch icon
  const appleTouchIcon = document.querySelector('link[rel="apple-touch-icon"]');
  if (appleTouchIcon) {
    let href = appleTouchIcon.getAttribute('href') || '';
    if (href && !href.startsWith('http')) {
      href = new URL(href, window.location.origin).href;
    }
    metadata['apple-touch-icon'] = href;
  }

  // Language
  const htmlLang = document.documentElement.getAttribute('lang');
  if (htmlLang) metadata['lang'] = htmlLang;
  
  return metadata;
}

function getDetailedPerformance() {
  const perf: any = {};
  const navigation: any = window.performance.getEntriesByType('navigation')[0] || {};
  
  if (navigation) {
    perf.ttfb = navigation.responseStart - navigation.requestStart;
    perf.dnsLookup = navigation.domainLookupEnd - navigation.domainLookupStart;
    perf.tcpConnect = navigation.connectEnd - navigation.connectStart;
    perf.domContentLoad = navigation.domContentLoadedEventEnd - (navigation.startTime || 0);
    perf.fullLoad = navigation.loadEventEnd - (navigation.startTime || 0);
    perf.transferSize = navigation.transferSize;
    perf.encodedBodySize = navigation.encodedBodySize;
    perf.decodedBodySize = navigation.decodedBodySize;
  }
  
  // Resource summary
  const resources = window.performance.getEntriesByType('resource');
  perf.resourceCount = resources.length;
  perf.scriptCount = resources.filter((r: any) => r.initiatorType === 'script').length;
  perf.cssCount = resources.filter((r: any) => r.initiatorType === 'link' || r.initiatorType === 'css').length;
  perf.imageCount = resources.filter((r: any) => r.initiatorType === 'img' || (r as any).initiatorType === 'image').length;
  
  return perf;
}


function setupMessageListeners() {
  chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
    try {
      switch (message.type) {
        case MessageType.TOGGLE_PANEL:
          if (!isFeatureEnabled('floatingWindow')) {
            sendResponse({ success: false, error: 'Floating window feature disabled' });
            break;
          }
          togglePanel();
          sendResponse({ success: true, panelVisible });
          break;

        case MessageType.TOGGLE_INSPECTOR:
        case MessageType.START_INSPECTION:
          toggleInspection();
          sendResponse({ success: true, isInspecting });
          break;

        case MessageType.STOP_INSPECTION:
          stopInspection();
          clearSelection();
          sendMessage({ type: MessageType.ELEMENT_SELECTED, payload: null });
          sendResponse({ success: true });
          break;

        case MessageType.GET_PAGE_COLORS:
          sendMessage({ type: MessageType.PAGE_COLORS_RESULT, payload: collectPageColors() });
          sendResponse({ success: true });
          break;

        case MessageType.GET_PAGE_TYPOGRAPHY:
          sendMessage({ type: MessageType.PAGE_TYPOGRAPHY_RESULT, payload: collectPageTypography() });
          sendResponse({ success: true });
          break;

        case MessageType.GET_PAGE_ASSETS:
          sendMessage({ type: MessageType.PAGE_ASSETS_RESULT, payload: collectPageAssets() });
          sendResponse({ success: true });
          break;

        case MessageType.GET_PAGE_GRADIENTS:
          sendMessage({ type: MessageType.PAGE_GRADIENTS_RESULT, payload: collectPageGradients() });
          sendResponse({ success: true });
          break;

        case MessageType.GET_PAGE_OVERVIEW:
          collectPageOverview().then(payload => {
            sendMessage({ type: MessageType.PAGE_OVERVIEW_RESULT, payload });
            sendResponse({ success: true });
          });
          return true; // keep alive for async

        case MessageType.REFRESH_PAGE_DATA:
          clearSelection();
          sendMessage({ type: MessageType.ELEMENT_SELECTED, payload: null });
          collectPageOverview().then(payload => {
            sendMessage({ type: MessageType.PAGE_OVERVIEW_RESULT, payload });
          });
          if (isFeatureEnabled('colorExtraction')) {
            sendMessage({ type: MessageType.PAGE_COLORS_RESULT, payload: collectPageColors() });
          }
          if (isFeatureEnabled('typographyAnalysis')) {
            sendMessage({ type: MessageType.PAGE_TYPOGRAPHY_RESULT, payload: collectPageTypography() });
          }
          if (isFeatureEnabled('assetGallery')) {
            sendMessage({ type: MessageType.PAGE_ASSETS_RESULT, payload: collectPageAssets() });
          }
          if (isFeatureEnabled('gradientExtraction')) {
            sendMessage({ type: MessageType.PAGE_GRADIENTS_RESULT, payload: collectPageGradients() });
          }
          sendResponse({ success: true });
          break;

        case MessageType.CLOSE_FLOATING_PANEL:
          if (isFeatureEnabled('floatingWindow')) {
            hidePanel();
            stopInspection();
            clearSelection();
          }
          sendResponse({ success: true });
          break;

        // Theme change from the React iframe — update floating header DOM immediately
        case '__THEME_CHANGED__' as MessageType: {
          const theme = (message as any).theme || 'light';
          applyFloatingTheme(theme);
          sendResponse({ success: true });
          break;
        }

        case MessageType.CLEANUP:
          hidePanel();
          stopInspection();
          clearSelection();
          cleanup();
          sendResponse({ success: true });
          break;



        case MessageType.GET_PAGE_METADATA:
          sendResponse({ success: true, payload: extractMetadata() });
          break;

        case MessageType.GET_DETAILED_PERF:
          sendResponse({ success: true, payload: getDetailedPerformance() });
          break;

        case MessageType.PING:
          sendResponse({ type: MessageType.PONG, panelVisible });
          break;

        default:
          sendResponse({ success: false });
      }
    } catch (err) {
      console.error('SiteLens content error:', err);
      sendResponse({ success: false, error: String(err) });
    }
    return true;
  });
}

function sendMessage(message: ExtensionMessage) {
  try { chrome.runtime.sendMessage(message); } catch { /* ignore */ }
}

// ==========================================
// Element Info Extraction
// ==========================================

function extractBasicInfo(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  return {
    tagName: element.tagName.toLowerCase(),
    id: element.id,
    classList: Array.from(element.classList).filter(c => !c.startsWith('sitelens-')),
    dimensions: { width: Math.round(rect.width), height: Math.round(rect.height) },
    position: { x: Math.round(rect.left), y: Math.round(rect.top) },
  };
}

function extractElementInfo(element: HTMLElement): ElementInfo {
  const styles = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  const computed = extractComputedStyles(styles);
  const authored = getAuthoredStyles(element);

  // Merge: Computed provides the baseline, authored overrides with exact native strings (Hex, HSL, Vars)
  const finalStyles: Record<string, string> = {};
  for (const [prop, val] of Object.entries(computed)) {
    finalStyles[prop] = authored[prop] || val;
  }

  let svgCode: string | undefined;
  if (element.tagName.toLowerCase() === 'svg') {
    svgCode = element.outerHTML;
  } else {
    const containedSvg = element.querySelector('svg');
    if (containedSvg) svgCode = containedSvg.outerHTML;
  }

  return {
    tagName: element.tagName.toLowerCase(),
    id: element.id,
    classList: Array.from(element.classList).filter(c => !c.startsWith('sitelens-')),
    selector: buildSelector(element),
    boxModel: extractBoxModel(element, styles),
    computedStyles: computed,
    authoredStyles: finalStyles,
    cssRules: [],
    pseudoElements: extractPseudoElements(element),
    position: { x: Math.round(rect.left), y: Math.round(rect.top) },
    dimensions: { width: Math.round(rect.width), height: Math.round(rect.height) },
    accessibility: extractAccessibility(element, styles),
    svgCode,
  };
}

function getAuthoredStyles(element: HTMLElement): Record<string, string> {
  const authored: Record<string, string> = {};
  
  for (let i = 0; i < document.styleSheets.length; i++) {
    try {
      const sheet = document.styleSheets[i];
      if (!sheet.cssRules) continue;
      
      for (let j = 0; j < sheet.cssRules.length; j++) {
        const rule = sheet.cssRules[j] as CSSStyleRule;
        // Ignore pseudo-elements here as they are handled in extractPseudoElements
        if (rule.selectorText && !rule.selectorText.includes('::')) {
          try {
            if (element.matches(rule.selectorText)) {
              // Parse cssText to avoid getter normalizations and preserve vars/hex
              const cssText = rule.cssText || '';
              const match = cssText.match(/{\s*([^}]+)\s*}/);
              if (match) {
                const declarations = match[1].split(';');
                for (const decl of declarations) {
                  const [prop, ...valParts] = decl.split(':');
                  if (prop && valParts.length) {
                    const p = prop.trim();
                    const v = valParts.join(':').trim();
                    if (v) authored[p] = v;
                  }
                }
              }
            }
          } catch { /* complex selector match fail */ }
        }
      }
    } catch { /* cross-origin */ }
  }
  
  // Inline styles override all (extracted via attribute to preserve raw text)
  const inline = element.getAttribute('style');
  if (inline) {
    const declarations = inline.split(';');
    for (const decl of declarations) {
      const [prop, ...valParts] = decl.split(':');
      if (prop && valParts.length) {
        authored[prop.trim()] = valParts.join(':').trim();
      }
    }
  }

  return authored;
}

function extractBoxModel(element: HTMLElement, styles: CSSStyleDeclaration): BoxModel {
  const rect = element.getBoundingClientRect();
  return {
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    margin: {
      top: parseFloat(styles.marginTop) || 0,
      right: parseFloat(styles.marginRight) || 0,
      bottom: parseFloat(styles.marginBottom) || 0,
      left: parseFloat(styles.marginLeft) || 0,
    },
    padding: {
      top: parseFloat(styles.paddingTop) || 0,
      right: parseFloat(styles.paddingRight) || 0,
      bottom: parseFloat(styles.paddingBottom) || 0,
      left: parseFloat(styles.paddingLeft) || 0,
    },
    border: {
      top: parseFloat(styles.borderTopWidth) || 0,
      right: parseFloat(styles.borderRightWidth) || 0,
      bottom: parseFloat(styles.borderBottomWidth) || 0,
      left: parseFloat(styles.borderLeftWidth) || 0,
    },
  };
}

function extractComputedStyles(styles: CSSStyleDeclaration): Record<string, string> {
  const result: Record<string, string> = {};
  const props = [
    'display', 'position', 'top', 'right', 'bottom', 'left',
    'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
    'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'background-color', 'background-image', 'background-size',
    'color', 'font-family', 'font-size', 'font-weight', 'font-style',
    'line-height', 'letter-spacing', 'text-align', 'text-decoration', 'text-transform',
    'border-width', 'border-style', 'border-color', 'border-radius',
    'box-shadow', 'text-shadow', 'opacity', 'overflow',
    'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'gap',
    'grid-template-columns', 'grid-template-rows',
    'z-index', 'transform', 'transition', 'animation',
    'cursor', 'backdrop-filter', 'filter',
  ];
  for (const prop of props) {
    const value = styles.getPropertyValue(prop);
    if (value && value !== '' && value !== 'none' && value !== 'normal' && value !== 'auto'
        && value !== '0px' && value !== 'rgba(0, 0, 0, 0)' && value !== 'start') {
      result[prop] = value;
    }
  }
  return result;
}

function extractPseudoElements(element: HTMLElement): PseudoElementInfo[] {
  const pseudos: PseudoElementInfo[] = [];
  for (const pseudo of ['::before', '::after']) {
    const styles = window.getComputedStyle(element, pseudo);
    const content = styles.getPropertyValue('content');
    if (content && content !== 'none' && content !== 'normal') {
      const pStyles: Record<string, string> = {};
      for (const prop of ['content', 'display', 'position', 'width', 'height', 'background-color', 'color', 'font-size', 'border-radius']) {
        const val = styles.getPropertyValue(prop);
        if (val && val !== 'none' && val !== 'auto') pStyles[prop] = val;
      }
      pseudos.push({ type: pseudo, styles: pStyles, content: content.replace(/^["']|["']$/g, '') });
    }
  }
  return pseudos;
}

function extractAccessibility(element: HTMLElement, styles: CSSStyleDeclaration): AccessibilityInfo {
  const textColor = styles.color;
  const bgColor = findBackgroundColor(element);
  const fgRgb = parseColor(textColor);
  const bgRgb = parseColor(bgColor);
  let ratio = 0;
  if (fgRgb && bgRgb) ratio = contrastRatio(fgRgb, bgRgb);
  return {
    role: element.getAttribute('role') || element.tagName.toLowerCase(),
    ariaLabel: element.getAttribute('aria-label') || '',
    contrastRatio: Math.round(ratio * 100) / 100,
    wcagAA: ratio >= 4.5,
    wcagAAA: ratio >= 7,
    textColor,
    bgColor,
  };
}

function findBackgroundColor(element: HTMLElement): string {
  let el: HTMLElement | null = element;
  while (el) {
    const bg = window.getComputedStyle(el).backgroundColor;
    if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
    el = el.parentElement;
  }
  return 'rgb(255, 255, 255)';
}

function buildSelector(element: HTMLElement): string {
  const parts: string[] = [];
  let el: HTMLElement | null = element;
  let depth = 0;
  while (el && el !== document.body && depth < 4) {
    let part = el.tagName.toLowerCase();
    if (el.id) { parts.unshift(part + `#${el.id}`); break; }
    const classes = Array.from(el.classList).filter(c => !c.startsWith('sitelens-')).slice(0, 2);
    if (classes.length > 0) part += `.${classes.join('.')}`;
    parts.unshift(part);
    el = el.parentElement;
    depth++;
  }
  return parts.join(' > ');
}

// ==========================================
// Page Analysis: Colors
// ==========================================

function collectPageColors(): ColorInfo[] {
  const colorMap = new Map<string, ColorInfo>();
  document.querySelectorAll('*').forEach((el) => {
    const htmlEl = el as HTMLElement;
    if (isSiteLensElement(htmlEl)) return;
    const styles = window.getComputedStyle(htmlEl);
    const selector = buildSelector(htmlEl);
    const tag = htmlEl.tagName.toLowerCase();
    addColor(colorMap, styles.color, 'text', tag, selector, 'color');
    addColor(colorMap, styles.backgroundColor, 'background', tag, selector, 'background-color');
    addColor(colorMap, styles.borderTopColor, 'border', tag, selector, 'border-color');
    const boxShadow = styles.boxShadow;
    if (boxShadow && boxShadow !== 'none') {
      const matches = boxShadow.match(/rgba?\([^)]+\)|#[0-9a-f]{3,8}/gi);
      if (matches) matches.forEach(c => addColor(colorMap, c, 'shadow', tag, selector, 'box-shadow'));
    }
  });
  return Array.from(colorMap.values()).sort((a, b) => b.count - a.count);
}

function addColor(map: Map<string, ColorInfo>, color: string, category: ColorCategory, element: string, selector: string, property: string) {
  if (!isValidColor(color)) return;
  const parsed = parseColor(color);
  if (!parsed) return;
  const hex = rgbToHex(parsed.r, parsed.g, parsed.b, parsed.a).toUpperCase();
  const hsl = rgbToHsl(parsed.r, parsed.g, parsed.b, parsed.a);
  if (map.has(hex)) {
    const existing = map.get(hex)!;
    existing.count++;
    if (existing.instances.length < 10) existing.instances.push({ element, selector, property, value: color });
  } else {
    map.set(hex, { hex, rgb: parsed, hsl, count: 1, category, instances: [{ element, selector, property, value: color }] });
  }
}

// ==========================================
// Page Analysis: Typography
// ==========================================

function collectPageTypography(): { fonts: FontInfo[]; hierarchy: TypographyHierarchy[] } {
  const fontMap = new Map<string, FontInfo>();
  const hierarchyMap = new Map<string, TypographyHierarchy>();

  document.querySelectorAll('*').forEach((el) => {
    const htmlEl = el as HTMLElement;
    if (isSiteLensElement(htmlEl)) return;
    if (!(htmlEl.childNodes.length > 0 && Array.from(htmlEl.childNodes).some(n => n.nodeType === Node.TEXT_NODE && n.textContent?.trim()))) return;

    const styles = window.getComputedStyle(htmlEl);
    const fontFamily = styles.fontFamily.split(',')[0].trim().replace(/["']/g, '');
    const fontSize = styles.fontSize;
    const fontWeight = styles.fontWeight;
    const fontStyle = styles.fontStyle;
    const lineHeight = styles.lineHeight;
    const letterSpacing = styles.letterSpacing;
    const color = styles.color;
    const tag = htmlEl.tagName.toLowerCase();
    const selector = buildSelector(htmlEl);
    const text = (htmlEl.textContent || '').trim().substring(0, 60);

    if (!fontMap.has(fontFamily)) {
      fontMap.set(fontFamily, { family: fontFamily, variants: [], count: 0, source: detectFontSource(fontFamily), instances: [] });
    }
    const font = fontMap.get(fontFamily)!;
    font.count++;

    let variant = font.variants.find(v => v.weight === fontWeight && v.style === fontStyle && v.size === fontSize && v.lineHeight === lineHeight);
    if (!variant) {
      variant = { weight: fontWeight, style: fontStyle, size: fontSize, lineHeight, letterSpacing, color, count: 0 };
      font.variants.push(variant);
    }
    variant.count++;

    if (font.instances.length < 20) {
      font.instances.push({ element: tag, selector, text, size: fontSize, weight: fontWeight, lineHeight, letterSpacing, color, tagName: tag });
    }

    const level = getTypographyLevel(tag);
    const hKey = `${level}-${fontFamily}-${fontSize}-${fontWeight}`;
    if (!hierarchyMap.has(hKey)) {
      hierarchyMap.set(hKey, { level, fontFamily, fontSize, fontWeight, lineHeight, color, count: 0 });
    }
    hierarchyMap.get(hKey)!.count++;
  });

  const order = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'a', 'li', 'other'];
  return {
    fonts: Array.from(fontMap.values()).sort((a, b) => b.count - a.count),
    hierarchy: Array.from(hierarchyMap.values()).sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level)),
  };
}

function detectFontSource(family: string): FontInfo['source'] {
  const system = ['arial','helvetica','times new roman','times','courier new','courier','verdana','georgia','system-ui','-apple-system','blinkmacsystemfont','segoe ui','roboto','sans-serif','serif','monospace'];
  if (system.includes(family.toLowerCase())) return 'system';
  const links = document.querySelectorAll('link[href*="fonts.googleapis.com"]');
  for (const link of links) {
    if ((link as HTMLLinkElement).href.includes(family.replace(/\s+/g, '+'))) return 'google';
  }
  return 'custom';
}

function getTypographyLevel(tag: string): string {
  if (['h1','h2','h3','h4','h5','h6'].includes(tag)) return tag;
  if (['p','a','span','li'].includes(tag)) return tag;
  return 'other';
}

// ==========================================
// Page Analysis: Assets
// ==========================================

function collectPageAssets(): AssetInfo[] {
  const assets: AssetInfo[] = [];
  const seen = new Set<string>();

  document.querySelectorAll('img').forEach(img => {
    if (img.src && !seen.has(img.src) && !isSiteLensElement(img)) {
      seen.add(img.src);
      assets.push({ type: 'image', url: img.src, alt: img.alt || '', dimensions: { width: img.naturalWidth || img.width, height: img.naturalHeight || img.height }, format: getImageFormat(img.src), element: 'img', selector: buildSelector(img) });
    }
  });

  document.querySelectorAll('svg').forEach(svg => {
    if (isSiteLensElement(svg as any)) return;
    const str = new XMLSerializer().serializeToString(svg);
    const url = URL.createObjectURL(new Blob([str], { type: 'image/svg+xml' }));
    const rect = svg.getBoundingClientRect();
    assets.push({ type: 'svg', url, alt: svg.getAttribute('aria-label') || '', dimensions: { width: Math.round(rect.width), height: Math.round(rect.height) }, format: 'SVG', element: 'svg', selector: buildSelector(svg as any) });
  });

  document.querySelectorAll('*').forEach(el => {
    const htmlEl = el as HTMLElement;
    if (isSiteLensElement(htmlEl)) return;
    const bgImage = window.getComputedStyle(htmlEl).backgroundImage;
    if (bgImage && bgImage !== 'none') {
      const match = bgImage.match(/url\(["']?([^"')]+)["']?\)/);
      if (match && !seen.has(match[1])) {
        seen.add(match[1]);
        const rect = htmlEl.getBoundingClientRect();
        assets.push({ type: 'background', url: match[1], alt: '', dimensions: { width: Math.round(rect.width), height: Math.round(rect.height) }, format: getImageFormat(match[1]), element: htmlEl.tagName.toLowerCase(), selector: buildSelector(htmlEl) });
      }
    }
  });

  document.querySelectorAll('link[rel*="icon"]').forEach(link => {
    const href = (link as HTMLLinkElement).href;
    if (href && !seen.has(href)) {
      seen.add(href);
      assets.push({ type: 'icon', url: href, alt: 'favicon', dimensions: { width: 32, height: 32 }, format: getImageFormat(href), element: 'link', selector: 'link[rel="icon"]' });
    }
  });

  return assets;
}

function getImageFormat(url: string): string {
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
  if (!ext) return 'unknown';
  const fmts: Record<string, string> = { jpg: 'JPEG', jpeg: 'JPEG', png: 'PNG', gif: 'GIF', webp: 'WebP', svg: 'SVG', avif: 'AVIF', ico: 'ICO' };
  return fmts[ext] || ext.toUpperCase();
}

// ==========================================
// Page Analysis: Gradients
// ==========================================

function collectPageGradients(): any[] {
  const gradients: any[] = [];
  const seen = new Set<string>();

  const extractFromText = (text: string, sourceElement: string, sourceSelector: string) => {
    const regex = /(linear|radial|conic)-gradient\(/gi;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const start = match.index;
      let depth = 0;
      let i = start + match[0].length - 1; // Points exactly to the first '('
      let foundEnd = false;
      
      for (; i < text.length; i++) {
        if (text[i] === '(') depth++;
        else if (text[i] === ')') depth--;

        if (depth === 0) {
          foundEnd = true;
          break;
        }
      }

      if (foundEnd) {
        const raw = text.substring(start, i + 1);
        regex.lastIndex = i + 1; // Fast-forward execution
        if (!seen.has(raw)) {
          seen.add(raw);
          const type = raw.toLowerCase().startsWith('linear') ? 'linear' 
                     : raw.toLowerCase().startsWith('radial') ? 'radial' : 'conic';
          gradients.push({ type, raw, stops: parseGradientStops(raw), element: sourceElement, selector: sourceSelector });
        }
      }
    }
  };

  // 1. Scan all stylesheets to find every authored gradient (even hidden ones)
  for (let i = 0; i < document.styleSheets.length; i++) {
    try {
      const sheet = document.styleSheets[i];
      if (!sheet.cssRules) continue;
      for (let j = 0; j < sheet.cssRules.length; j++) {
        const rule = sheet.cssRules[j] as CSSStyleRule;
        if (rule.cssText && rule.cssText.includes('gradient')) {
          extractFromText(rule.cssText, 'stylesheet', rule.selectorText || 'unknown');
        }
      }
    } catch { /* cross-origin */ }
  }

  // 2. Scan computed and inline styles as fallback
  document.querySelectorAll('*').forEach(el => {
    const htmlEl = el as HTMLElement;
    if (isSiteLensElement(htmlEl)) return;
    
    const inline = htmlEl.getAttribute('style');
    if (inline && inline.includes('gradient')) {
      extractFromText(inline, htmlEl.tagName.toLowerCase(), buildSelector(htmlEl));
    }

    const bgImage = window.getComputedStyle(htmlEl).backgroundImage;
    if (bgImage && bgImage !== 'none' && bgImage.includes('gradient')) {
      extractFromText(bgImage, htmlEl.tagName.toLowerCase(), buildSelector(htmlEl));
    }
  });

  return gradients;
}

function parseGradientStops(gradient: string): any[] {
  const inner = gradient.match(/gradient\((.+)\)$/i);
  if (!inner) return [];
  const stops: any[] = [];
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of inner[1]) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(current.trim()); current = ''; }
    else current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  const start = parts[0]?.match(/^(to\s+|[\d.]+deg|circle|ellipse|at\s+)/i) ? 1 : 0;
  for (let i = start; i < parts.length; i++) {
    const m = parts[i].trim().match(/^(.*?)(?:\s+([\d.]+%))?$/);
    if (m) {
      const color = m[1].trim();
      const position = m[2] || '';
      const rgb = parseColor(color);
      const hex = rgb ? rgbToHex(rgb.r, rgb.g, rgb.b, rgb.a).toUpperCase() : color;
      stops.push({ color, position, hex });
    }
  }
  return stops;
}

// ==========================================
// Page Analysis: Overview & CSS Variables
// ==========================================

async function collectPageOverview() {
  return {
    url: window.location.href,
    title: document.title,
    colorCount: collectPageColors().length,
    fontCount: collectPageTypography().fonts.length,
    assetCount: collectPageAssets().length,
    gradientCount: collectPageGradients().length,
    cssVariableCount: collectPageVariables().length,
    stack: isFeatureEnabled('stackDetection') ? await detectFrontendStack() : [],
  };
}

function collectPageVariables(): any[] {
  const vars: any[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < document.styleSheets.length; i++) {
    try {
      const sheet = document.styleSheets[i];
      if (!sheet.cssRules) continue;
      for (let j = 0; j < sheet.cssRules.length; j++) {
        const rule = sheet.cssRules[j] as any;
        if (!rule.style) continue;
        for (let k = 0; k < rule.style.length; k++) {
          const name = rule.style[k];
          if (name.startsWith('--') && !seen.has(name)) {
            seen.add(name);
            const value = rule.style.getPropertyValue(name).trim();
            vars.push({ name, value, resolvedValue: value, scope: rule.selectorText || ':root', usageCount: 1, category: categorizeVar(name, value) });
          }
        }
      }
    } catch { /* cross-origin */ }
  }
  return vars;
}

function categorizeVar(name: string, value: string): string {
  const n = name.toLowerCase();
  if (n.includes('color') || n.includes('bg') || n.includes('text')) return 'color';
  if (n.includes('space') || n.includes('gap') || n.includes('margin') || n.includes('padding')) return 'spacing';
  if (n.includes('font') || n.includes('size') || n.includes('weight')) return 'typography';
  if (parseColor(value)) return 'color';
  return 'other';
}


// ==========================================
// Cleanup (extension disable / full removal)
// ==========================================

function cleanup() {
  stopInspection();
  if (panelContainer) {
    panelContainer.remove();
    panelContainer = null;
    panelIframe = null;
  }
  if (highlightOverlay) { highlightOverlay.remove(); highlightOverlay = null; }
  if (selectedOverlay) { selectedOverlay.remove(); selectedOverlay = null; }
  if (tooltip) { tooltip.remove(); tooltip = null; }
  cleanupMeasurement();
  window.removeEventListener('scroll', handleScroll, true);
  panelVisible = false;
  isInspecting = false;
  stopHydrationObserver();
  (window as any).__sitelens_initialized = false;
}

// ==========================================
// Hydration Monitoring
// ==========================================

let hydrationObserver: MutationObserver | null = null;
let hydrationTimeout: any = null;

function startHydrationObserver() {
  if (hydrationObserver) return;
  
  // 1. Initial delayed checks for lazy-loaded scripts
  setTimeout(triggerStackUpdate, 2000);
  setTimeout(triggerStackUpdate, 5000);

  // 2. Continuous DOM mutation tracking
  hydrationObserver = new MutationObserver(() => {
    // Debounce the update
    if (hydrationTimeout) clearTimeout(hydrationTimeout);
    hydrationTimeout = setTimeout(() => {
      triggerStackUpdate();
    }, 1500); // Wait 1.5s after DOM settles
  });

  hydrationObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true, // Some frameworks attach data-* after render
    attributeFilter: ['class', 'id', 'data-reactroot', 'data-v-app', 'ng-version', 'data-hk', 'q:container']
  });
}

function stopHydrationObserver() {
  if (hydrationObserver) {
    hydrationObserver.disconnect();
    hydrationObserver = null;
  }
  if (hydrationTimeout) {
    clearTimeout(hydrationTimeout);
    hydrationTimeout = null;
  }
}

function triggerStackUpdate() {
  // We only care about pushing overview updates if the panel could be open
  collectPageOverview().then(payload => {
    sendMessage({ type: MessageType.PAGE_OVERVIEW_RESULT, payload });
  });
}

// ==========================================
// Init Guard
// ==========================================

if (!(window as any).__sitelens_initialized) {
  (window as any).__sitelens_initialized = true;
  init();
}


