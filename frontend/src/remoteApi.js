// Hosted mode (build with APIFLUX_API_BASE=https://your-backend/api): the app talks to the hosted
// backend in backend/hosted. There are no accounts: each browser gets a random id that scopes its data.
const LOCAL = 'http://localhost:5000/api';
const REMOTE = process.env.REACT_APP_API_BASE;
const realFetch = window.fetch.bind(window);
let vid = localStorage.getItem('apiflux_visitor');
if (!/^[a-f0-9]{32}$/.test(vid || '')) {
  vid = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
  localStorage.setItem('apiflux_visitor', vid);
}
window.fetch = (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  if (!url.startsWith(LOCAL)) return realFetch(input, init);
  return realFetch(REMOTE + url.slice(LOCAL.length), { ...init, headers: { ...(init.headers || {}), 'X-Visitor-Id': vid } });
};
window.addEventListener('DOMContentLoaded', () => {
  const n = document.createElement('div');
  n.textContent = 'Public demo on a free server. Collections, environments and history are stored there under a random id kept in this browser (not a login, anyone with that id could read it). Never enter real tokens, passwords or private API data. Requests to private or local addresses are blocked. The first request after idle can take about a minute.';
  n.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9;background:#0a0e1a;color:#64748b;font:11px sans-serif;padding:4px 8px;border-top:1px solid #1e2d4a;text-align:center';
  document.body.appendChild(n);
});
