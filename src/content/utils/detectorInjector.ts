let injectState: 'uninjected' | 'injecting' | 'injected' = 'uninjected';
let injectPromise: Promise<void> | null = null;

export function injectDetectorScript(jsQueries: string[] = []): Promise<any> {
  return new Promise(async (resolve) => {
    if (injectState === 'uninjected') {
      injectState = 'injecting';
      injectPromise = new Promise(res => {
        const triggerListener = (event: MessageEvent) => {
          if (event.source !== window || !event.data || event.data.type !== 'SITELENS_INJECTOR_READY') return;
          window.removeEventListener('message', triggerListener);
          injectState = 'injected';
          res();
        };
        window.addEventListener('message', triggerListener);
        
        try {
          const script = document.createElement('script');
          script.src = chrome.runtime.getURL('assets/injectDetector.js');
          script.onload = () => script.remove();
          (document.head || document.documentElement).appendChild(script);
        } catch (e) {
          // Ignore
        }
        
        setTimeout(() => {
          window.removeEventListener('message', triggerListener);
          injectState = 'injected';
          res();
        }, 500);
      });
    }

    if (injectState === 'injecting' && injectPromise) {
      await injectPromise;
    }

    const listener = (event: MessageEvent) => {
      if (event.source !== window || !event.data || event.data.type !== 'SITELENS_DETECT_RESPONSE') return;
      window.removeEventListener('message', listener);
      resolve(event.data.payload);
    };
    window.addEventListener('message', listener);
    window.postMessage({ type: 'SITELENS_DETECT_REQUEST', queries: jsQueries }, '*');
    
    setTimeout(() => {
      window.removeEventListener('message', listener);
      resolve(null);
    }, 500);
  });
}
