// Browser-only stand-in for the Express/MongoDB backend, used by the static demo build.
// Collections, history and environments live in localStorage; requests go straight from
// the browser (so target APIs must allow CORS).
const BASE = 'http://localhost:5000/api';
const realFetch = window.fetch.bind(window);
const load = (k) => { try { return JSON.parse(localStorage.getItem('apiflux_' + k)) || []; } catch { return []; } };
const save = (k, v) => localStorage.setItem('apiflux_' + k, JSON.stringify(v));
const id = () => Math.random().toString(16).slice(2) + Date.now().toString(16);
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

async function proxy(b) {
  const { method = 'GET', url, headers = [], params = [], body, auth } = b;
  const start = Date.now();
  const h = {}; headers.filter(x => x.enabled && x.key).forEach(x => { h[x.key] = x.value; });
  let u;
  try { u = new URL(url); } catch { return json({ error: 'Invalid URL', status: null }, 400); }
  params.filter(x => x.enabled && x.key).forEach(x => u.searchParams.set(x.key, x.value));
  if (auth) {
    if (auth.type === 'bearer' && auth.token) h.Authorization = 'Bearer ' + auth.token;
    else if (auth.type === 'basic' && auth.username) h.Authorization = 'Basic ' + btoa(`${auth.username}:${auth.password || ''}`);
    else if (auth.type === 'api-key' && auth.key) { if (auth.addTo === 'header') h[auth.key] = auth.value; else u.searchParams.set(auth.key, auth.value); }
  }
  let data;
  const m = method.toUpperCase();
  if (body && body.type !== 'none' && ['POST', 'PUT', 'PATCH'].includes(m)) {
    if (body.type === 'json') h['Content-Type'] = 'application/json';
    else if (body.type === 'x-www-form-urlencoded') h['Content-Type'] = 'application/x-www-form-urlencoded';
    data = body.content;
  }
  let result, success = true;
  try {
    const r = await realFetch(u.toString(), { method: m, headers: h, body: data });
    const text = await r.text();
    let parsed = text; try { parsed = JSON.parse(text); } catch {}
    const rh = {}; r.headers.forEach((v, k) => { rh[k] = v; });
    result = { status: r.status, statusText: r.statusText || '', headers: rh, data: parsed, time: Date.now() - start, size: new TextEncoder().encode(text).length };
    success = r.status < 400;
  } catch (e) {
    success = false;
    result = { error: 'Request failed (the target server may block browser requests via CORS, or is unreachable): ' + e.message, status: null, time: Date.now() - start };
  }
  const hist = load('history');
  hist.unshift({ _id: id(), method: m, url: b.url, headers, params, body, auth, response: result, success, createdAt: new Date().toISOString() });
  save('history', hist.slice(0, 100));
  return json(result, result.error ? 500 : 200);
}

window.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  if (!url.startsWith(BASE)) return realFetch(input, init);
  const path = url.slice(BASE.length).split('?')[0].split('/').filter(Boolean);
  const m = (init.method || 'GET').toUpperCase();
  const body = init.body ? JSON.parse(init.body) : {};
  const [res, a, sub, c] = path;
  const now = new Date().toISOString();
  if (res === 'proxy') return proxy(body);
  if (res === 'history') {
    if (m === 'GET') return json(load('history'));
    if (a) { save('history', load('history').filter(x => x._id !== a)); return json({ message: 'ok' }); }
    save('history', []); return json({ message: 'History cleared' });
  }
  if (res === 'collections') {
    let list = load('collections');
    if (m === 'GET') return json(list);
    if (m === 'POST' && !a) { const n = { _id: id(), description: '', color: '#6366f1', requests: [], createdAt: now, ...body }; list.unshift(n); save('collections', list); return json(n, 201); }
    const col = list.find(x => x._id === a);
    if (!col) return json({ error: 'Not found' }, 404);
    if (m === 'DELETE' && !sub) { save('collections', list.filter(x => x._id !== a)); return json({ message: 'deleted' }); }
    if (m === 'PUT' && !sub) { Object.assign(col, body); save('collections', list); return json(col); }
    if (sub === 'requests') {
      if (m === 'POST') col.requests.push({ _id: id(), ...body });
      else if (m === 'DELETE') col.requests = col.requests.filter(x => x._id !== c);
      else if (m === 'PUT') col.requests = col.requests.map(x => x._id === c ? { ...x, ...body } : x);
      save('collections', list); return json(col, m === 'POST' ? 201 : 200);
    }
  }
  if (res === 'environments') {
    let list = load('environments');
    if (m === 'GET') return json(list);
    if (m === 'POST') { const n = { _id: id(), isActive: false, variables: [], ...body }; list.unshift(n); save('environments', list); return json(n, 201); }
    const env = list.find(x => x._id === a);
    if (!env) return json({ error: 'Not found' }, 404);
    if (m === 'DELETE') { save('environments', list.filter(x => x._id !== a)); return json({ message: 'deleted' }); }
    if (sub === 'activate') { list.forEach(x => { x.isActive = false; }); env.isActive = true; save('environments', list); return json(env); }
    if (m === 'PUT') { Object.assign(env, body); save('environments', list); return json(env); }
  }
  return json({ error: 'Unsupported' }, 404);
};
