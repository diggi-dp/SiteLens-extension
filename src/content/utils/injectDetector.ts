// Injected into the MAIN world to access window variables and intercept network
declare const window: any;

const CACHE = {
  windowKeys: [] as string[],
  scripts: [] as string[],
  resources: [] as string[]
};

function readWindowKeys() {
  try {
    CACHE.windowKeys = Object.keys(window);
  } catch (e) {
    // Ignore cross-origin errors
  }
}

// 1. Intercept fetch
const originalFetch = window.fetch;
if (originalFetch) {
  window.fetch = async function(...args: any[]) {
    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
      if (url && typeof url === 'string') {
        CACHE.resources.push(url);
      }
    } catch (e) {}
    return originalFetch.apply(this, args);
  };
}

// 2. Intercept XHR
const originalXhrOpen = window.XMLHttpRequest?.prototype?.open;
if (originalXhrOpen) {
  window.XMLHttpRequest.prototype.open = function(method: string, url: string, ...rest: any[]) {
    try {
      if (url && typeof url === 'string') {
        CACHE.resources.push(url);
      }
    } catch(e) {}
    return originalXhrOpen.call(this, method, url, ...rest);
  };
}

// 3. Intercept script injection
const originalCreateElement = document.createElement;
document.createElement = function(tagName: string, options?: ElementCreationOptions) {
  const el = originalCreateElement.call(document, tagName, options);
  if (tagName.toLowerCase() === 'script') {
    // Observe when src is set
    const originalSetAttribute = el.setAttribute;
    // @ts-ignore
    el.setAttribute = function(name: string, value: string) {
      if (name.toLowerCase() === 'src' && value) {
        CACHE.scripts.push(value);
      }
      return originalSetAttribute.call(this, name, value);
    };

    // Need to defineProperty to catch direct src assignments: script.src = '...'
    try {
      let srcValue = '';
      Object.defineProperty(el, 'src', {
        get() { return srcValue; },
        set(v) { 
          srcValue = v; 
          CACHE.scripts.push(v);
          originalSetAttribute.call(el, 'src', v);
        }
      });
    } catch(e) {}
  }
  return el;
};

// Listen for requests from the isolated world
window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window || !event.data || event.data.type !== 'SITELENS_DETECT_REQUEST') return;

  const queries = event.data.queries || [];
  const jsResults: Record<string, string[]> = {};
  
  queries.forEach((q: string) => {
    try {
      const parts = q.split('.');
      let val: any = window;
      for (const p of parts) {
        val = val[p];
        if (val === undefined || val === null) break;
      }
      if (val !== undefined && val !== null) {
        if (typeof val === 'string' || typeof val === 'number') {
           jsResults[q] = [String(val)];
        } else if (typeof val === 'boolean') {
           jsResults[q] = [val ? 'true' : 'false'];
        } else if (typeof val === 'object' || typeof val === 'function') {
           jsResults[q] = ['']; // Wappalyzer checks existence by evaluating to an empty string if object
        }
      }
    } catch { /* ignore */ }
  });

  readWindowKeys();

  // Extract framework specifics safely
  const specifics: Record<string, any> = {};
  
  try { specifics.reactHook = !!window.__REACT_DEVTOOLS_GLOBAL_HOOK__; } catch(e) {}
  try { specifics.vueHook = !!window.__VUE_DEVTOOLS_GLOBAL_HOOK__; } catch(e) {}
  try { specifics.vue = !!window.__VUE__ || !!window.Vue; } catch(e) {}
  try { specifics.ng = !!window.ng; } catch(e) {}
  try { specifics.svelte = !!window.__svelte; } catch(e) {}
  try { specifics.next = !!window.__NEXT_DATA__; } catch(e) {}
  try { specifics.nuxt = !!window.__NUXT__; } catch(e) {}
  try { specifics.remix = !!window.__remixContext; } catch(e) {}
  try { specifics.qwik = !!window.qwik; } catch(e) {}
  try { specifics.redux = !!window.__REDUX_DEVTOOLS_EXTENSION__; } catch(e) {}
  try { specifics.mobx = !!window.__MOBX_DEVTOOLS_GLOBAL_HOOK__; } catch(e) {}
  try { specifics.apollo = !!window.__APOLLO_CLIENT__; } catch(e) {}
  try { specifics.reactQuery = !!window.__REACT_QUERY_DEVTOOLS_GLOBAL_HOOK__; } catch(e) {}
  try { specifics.webpackChunk = !!window.webpackChunk || !!window.__webpack_require__; } catch(e) {}
  try { specifics.parcel = !!window.parcelRequire; } catch(e) {}
  try { specifics.turbopack = !!window.__turbopack_require__; } catch(e) {}
  try { specifics.ga = !!window.ga || !!window.gtag; } catch(e) {}
  try { specifics.segment = !!window.analytics; } catch(e) {}
  try { specifics.mixpanel = !!window.mixpanel; } catch(e) {}
  try { specifics.amplitude = !!window.amplitude; } catch(e) {}
  try { specifics.clerk = !!window.Clerk; } catch(e) {}
  try { specifics.supabase = !!window.supabase; } catch(e) {}

  window.postMessage({
    type: 'SITELENS_DETECT_RESPONSE',
    payload: {
      windowKeys: CACHE.windowKeys,
      interceptedScripts: CACHE.scripts,
      interceptedResources: CACHE.resources,
      specifics,
      jsResults
    }
  }, '*');
});

// Broadcast readiness
window.postMessage({ type: 'SITELENS_INJECTOR_READY' }, '*');
