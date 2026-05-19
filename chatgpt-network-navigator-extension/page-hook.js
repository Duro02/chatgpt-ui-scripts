(function () {
  'use strict';

  if (window.__cgptNetworkNavigatorHooked) return;
  window.__cgptNetworkNavigatorHooked = true;

  function postPayload(url, payload) {
    try {
      window.postMessage({
        source: 'cgpt-network-navigator',
        type: 'conversation-response',
        url,
        payload
      }, '*');
    } catch (_) {}
  }

  function maybeParseConversation(url, text) {
    if (!/\/backend-api\/conversation\//.test(url)) return;
    if (!text || text.length < 20) return;
    try {
      postPayload(url, JSON.parse(text));
    } catch (_) {
      // Some responses are streamed or not JSON; ignore them.
    }
  }

  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);
    try {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || response.url;
      if (/\/backend-api\/conversation\//.test(url || '')) {
        response.clone().text().then(text => maybeParseConversation(url, text)).catch(() => {});
      }
    } catch (_) {}
    return response;
  };

  const OriginalXHR = window.XMLHttpRequest;
  window.XMLHttpRequest = function () {
    const xhr = new OriginalXHR();
    let requestUrl = '';
    const open = xhr.open;
    xhr.open = function (method, url, ...rest) {
      requestUrl = String(url || '');
      return open.call(this, method, url, ...rest);
    };
    xhr.addEventListener('load', function () {
      try {
        if (/\/backend-api\/conversation\//.test(requestUrl) && typeof xhr.responseText === 'string') {
          maybeParseConversation(requestUrl, xhr.responseText);
        }
      } catch (_) {}
    });
    return xhr;
  };
})();
