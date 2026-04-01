/// <reference types="chrome" />
import { MessageType } from '../shared/types';
import type { ExtensionMessage } from '../shared/types';
import { isFeatureEnabled } from '../config/featureFlags';

// ==========================================
// Per-Tab State Tracking
// ==========================================

type UIMode = 'none' | 'floating' | 'sidebar';

// Track which UI mode is active for each tab
const tabState = new Map<number, UIMode>();

function getTabMode(tabId: number): UIMode {
  return tabState.get(tabId) || 'none';
}

function setTabMode(tabId: number, mode: UIMode) {
  tabState.set(tabId, mode);
}

let activeTabId: number | null = null;

// ==========================================
// Side Panel Helpers
// ==========================================

/**
 * Disable the side panel for a specific tab, which closes it.
 */
async function disableSidePanelForTab(tabId: number): Promise<void> {
  try {
    await chrome.sidePanel.setOptions({ tabId, enabled: false });
  } catch {
    // Ignore — panel may already be closed or tab may not exist
  }
}

/**
 * Full cleanup when closing the side panel or turning off the extension for a tab.
 */
async function closeSidePanelForTab(tabId: number): Promise<void> {
  setTabMode(tabId, 'none');
  await disableSidePanelForTab(tabId);
  // Clean up content script state (overlays, inspection, etc.)
  try {
    await chrome.tabs.sendMessage(tabId, { type: MessageType.CLEANUP });
  } catch {
    // Content script may not be injected
  }
  await chrome.action.setBadgeText({ text: '', tabId });
}

// ==========================================
// Extension Icon Click → Toggle Extension
// ==========================================

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  activeTabId = tab.id;
  const tabId = tab.id;

  const currentMode = getTabMode(tabId);

  // If sidebar is open → close it and turn off
  if (currentMode === 'sidebar') {
    await closeSidePanelForTab(tabId);
    return;
  }

  // If floating panel is visible → close it (toggle off)
  if (currentMode === 'floating') {
    const ready = await ensureContentScript(tabId);
    if (!ready) return;
    try {
      await chrome.tabs.sendMessage(tabId, { type: MessageType.CLOSE_FLOATING_PANEL });
    } catch {
      /* ignore */
    }
    setTabMode(tabId, 'none');
    await chrome.action.setBadgeText({ text: '', tabId });
    return;
  }

  // Mode is 'none' → open floating panel
  const ready = await ensureContentScript(tabId);
  if (!ready) return;

  try {
    const resp = await chrome.tabs.sendMessage(tabId, { type: MessageType.TOGGLE_PANEL });
    if (resp?.panelVisible) {
      setTabMode(tabId, 'floating');
      await chrome.action.setBadgeText({ text: 'ON', tabId });
    } else {
      setTabMode(tabId, 'none');
      await chrome.action.setBadgeText({ text: '', tabId });
    }
    await chrome.action.setBadgeBackgroundColor({ color: '#7C5CFC', tabId });
  } catch {
    /* ignore */
  }
});

// ==========================================
// Content Script Injection
// ==========================================

async function ensureContentScript(tabId: number): Promise<boolean> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: MessageType.PING });
    return true;
  } catch {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
      await chrome.scripting.insertCSS({ target: { tabId }, files: ['content.css'] });
      await new Promise((r) => setTimeout(r, 150));
      return true;
    } catch {
      return false;
    }
  }
}

async function getActiveTabId(): Promise<number | null> {
  if (activeTabId) return activeTabId;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      activeTabId = tab.id;
      return tab.id;
    }
  } catch {
    /* ignore */
  }
  return null;
}

// ==========================================
// Message Routing
// ==========================================

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  // ---------------------------------------------------------------
  // OPEN_SIDE_PANEL: The actual sidePanel.open() call happens directly
  // in Header.tsx (extension page context) to preserve user gesture.
  // This handler only does state management: close floating panel,
  // update tab mode, and set badge.
  // ---------------------------------------------------------------
  if (message.type === MessageType.OPEN_SIDE_PANEL) {
    const tabId = sender.tab?.id || activeTabId;
    if (tabId) {
      // Close the floating panel
      chrome.tabs.sendMessage(tabId, { type: MessageType.CLOSE_FLOATING_PANEL }).catch(() => {});
      // Track state
      setTabMode(tabId, 'sidebar');
      chrome.action.setBadgeText({ text: 'ON', tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#7C5CFC', tabId });
    }
    sendResponse({ success: true });
    return true;
  }

  // ---------------------------------------------------------------
  // All other messages handled in async IIFE
  // ---------------------------------------------------------------
  const isFromContentScript = !!sender.tab?.id;

  (async () => {
    try {
      const tabId = sender.tab?.id || (await getActiveTabId());

      // Messages FROM the content script → forward to extension contexts
      if (isFromContentScript) {
        switch (message.type) {
          case MessageType.ELEMENT_SELECTED:
          case MessageType.ELEMENT_HOVERED:
          case MessageType.PAGE_COLORS_RESULT:
          case MessageType.PAGE_TYPOGRAPHY_RESULT:
          case MessageType.PAGE_ASSETS_RESULT:
          case MessageType.PAGE_GRADIENTS_RESULT:
          case MessageType.PAGE_OVERVIEW_RESULT:
          case MessageType.STOP_INSPECTION:
          case MessageType.INSPECTION_STARTED:
            try {
              await chrome.runtime.sendMessage(message);
            } catch {
              /* no listeners */
            }
            sendResponse({ success: true });
            return;
        }
      }

      // Messages FROM the panel/sidebar → forward to content script or handle
      switch (message.type) {
        case MessageType.TOGGLE_INSPECTOR:
        case MessageType.START_INSPECTION:
        case MessageType.STOP_INSPECTION:
        case MessageType.GET_PAGE_COLORS:
        case MessageType.GET_PAGE_TYPOGRAPHY:
        case MessageType.GET_PAGE_ASSETS:
        case MessageType.GET_PAGE_GRADIENTS:
        case MessageType.GET_PAGE_OVERVIEW:
        case MessageType.REFRESH_PAGE_DATA:
        case MessageType.CLOSE_FLOATING_PANEL:
        case MessageType.CLEANUP:
          if (tabId) {
            try {
              await chrome.tabs.sendMessage(tabId, message);
            } catch {
              /* ignore */
            }
          }
          sendResponse({ success: true });
          break;

        // Insights: forward to content script and return the response
        case MessageType.GET_PAGE_METADATA:
        case MessageType.GET_DETAILED_PERF:
          if (tabId) {
            try {
              const result = await chrome.tabs.sendMessage(tabId, message);
              sendResponse(result);
            } catch {
              sendResponse({ success: false, payload: null });
            }
          } else {
            sendResponse({ success: false, payload: null });
          }
          break;


        case MessageType.CLOSE_SIDE_PANEL:
          if (tabId) {
            await closeSidePanelForTab(tabId);
          }
          sendResponse({ success: true });
          break;

        case MessageType.PING:
          sendResponse({ type: MessageType.PONG });
          break;

        // ── Insights: background fetch proxy (bypasses CORS) ──────────────
        case MessageType.FETCH_URL: {
          if (!isFeatureEnabled('domainInsights')) {
            sendResponse({ ok: false, error: 'Domain insights feature disabled' });
            break;
          }
          const { url, options } = message.payload as { url: string; options?: RequestInit };
          try {
            // Add a standard User-Agent to avoid 403s from services like RDAP
            const headers: Record<string, string> = {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'application/json, text/plain, */*'
            };
            
            const fetchOptions: RequestInit = {
              ...(options || {}),
              headers: { ...headers, ...(options?.headers || {}) },
              signal: AbortSignal.timeout(8000),
              redirect: 'follow'
            };

            const resp = await fetch(url, fetchOptions);
            const contentType = resp.headers.get('content-type') || '';
            let data: unknown;
            
            // Collect response headers
            const respHeaders: Record<string, string> = {};
            resp.headers.forEach((v, k) => { respHeaders[k] = v; });
            
            if (contentType.includes('json')) {
              data = await resp.json();
            } else {
              data = await resp.text();
            }
            sendResponse({ ok: resp.ok, status: resp.status, data, headers: respHeaders });
          } catch (err: unknown) {
            sendResponse({ ok: false, error: (err as Error).message });
          }
          break;
        }

        // ── Insights: return active tab URL ──────────────────────────────
        case MessageType.GET_ACTIVE_TAB_URL: {
          try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            sendResponse({ url: tab?.url || '', title: tab?.title || '' });
          } catch {
            sendResponse({ url: '', title: '' });
          }
          break;
        }

        default:
          sendResponse({ success: false });
      }
    } catch {
      sendResponse({ success: false });
    }
  })();
  return true;
});

// ==========================================
// Tab Tracking & Navigation Detection
// ==========================================

chrome.tabs.onActivated.addListener(async (info) => {
  activeTabId = info.tabId;

  // Per-tab side panel management:
  // When switching to a tab WITH sidebar mode, ensure panel is enabled.
  // When switching to ANY other tab, disable the panel so it doesn't
  // bleed through from the global default_path in manifest.
  // This is safe because Header.tsx always calls setOptions({enabled:true})
  // immediately before sidePanel.open(), so this won't block future opens.
  const mode = getTabMode(info.tabId);
  if (mode === 'sidebar') {
    try {
      await chrome.sidePanel.setOptions({ tabId: info.tabId, path: 'sidepanel.html', enabled: true });
    } catch { /* ignore */ }
  } else {
    try {
      await chrome.sidePanel.setOptions({ tabId: info.tabId, enabled: false });
    } catch { /* ignore */ }
  }
});

chrome.tabs.onRemoved.addListener((id) => {
  if (id === activeTabId) activeTabId = null;
  tabState.delete(id);
});

// Detect page navigation → re-analyze if extension is active on this tab
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status === 'complete') {
    const mode = getTabMode(tabId);
    if (mode !== 'none') {
      try {
        await chrome.tabs.sendMessage(tabId, { type: MessageType.REFRESH_PAGE_DATA });
      } catch {
        /* content script not injected on this page */
      }
    }
  }
});

// Disable side panel by default (only open it explicitly per tab)
try {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
} catch {
  /* ignore */
}

console.log('SiteLens service worker ready');
