import React, { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE = 'http://localhost:5000/api';

const METHOD_COLORS = {
  GET: '#10b981',
  POST: '#f59e0b',
  PUT: '#3b82f6',
  PATCH: '#8b5cf6',
  DELETE: '#ef4444',
  HEAD: '#6b7280',
  OPTIONS: '#ec4899'
};

const DEFAULT_REQUEST = {
  name: 'New Request',
  method: 'GET',
  url: '',
  headers: [{ key: '', value: '', enabled: true }],
  params: [{ key: '', value: '', enabled: true }],
  body: { type: 'none', content: '' },
  auth: { type: 'none', token: '', username: '', password: '', key: '', value: '', addTo: 'header' }
};

// ==================== COMPONENTS ====================

function MethodBadge({ method, size = 'sm' }) {
  const color = METHOD_COLORS[method] || '#6b7280';
  const fs = size === 'sm' ? '10px' : '12px';
  const px = size === 'sm' ? '6px' : '8px';
  return (
    <span style={{
      color, border: `1px solid ${color}`, borderRadius: '4px',
      padding: `2px ${px}`, fontSize: fs, fontWeight: 700,
      fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.05em',
      flexShrink: 0
    }}>{method}</span>
  );
}

function StatusBadge({ status }) {
  const color = status >= 500 ? '#ef4444' : status >= 400 ? '#f97316' : status >= 300 ? '#f59e0b' : status >= 200 ? '#10b981' : '#6b7280';
  return (
    <span style={{
      color, background: `${color}18`, border: `1px solid ${color}40`,
      borderRadius: '6px', padding: '2px 10px', fontSize: '13px', fontWeight: 700,
      fontFamily: 'JetBrains Mono, monospace'
    }}>{status}</span>
  );
}

function KeyValueEditor({ items, onChange, placeholder = 'Key' }) {
  const addItem = () => onChange([...items, { key: '', value: '', enabled: true }]);
  const updateItem = (i, field, val) => {
    const updated = items.map((item, idx) => idx === i ? { ...item, [field]: val } : item);
    onChange(updated);
  };
  const removeItem = (i) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="checkbox" checked={item.enabled}
            onChange={e => updateItem(i, 'enabled', e.target.checked)}
            style={{ cursor: 'pointer', accentColor: '#6366f1' }}
          />
          <input
            value={item.key} placeholder={placeholder}
            onChange={e => updateItem(i, 'key', e.target.value)}
            style={inputStyle}
          />
          <input
            value={item.value} placeholder="Value"
            onChange={e => updateItem(i, 'value', e.target.value)}
            style={inputStyle}
          />
          <button onClick={() => removeItem(i)} style={iconBtnStyle} title="Remove">✕</button>
        </div>
      ))}
      <button onClick={addItem} style={addRowBtnStyle}>+ Add {placeholder}</button>
    </div>
  );
}

function JsonViewer({ data }) {
  const [collapsed, setCollapsed] = useState({});
  
  const formatValue = (val, path = '') => {
    if (val === null) return <span style={{ color: '#ef4444' }}>null</span>;
    if (val === undefined) return <span style={{ color: '#6b7280' }}>undefined</span>;
    if (typeof val === 'boolean') return <span style={{ color: '#f59e0b' }}>{String(val)}</span>;
    if (typeof val === 'number') return <span style={{ color: '#10b981' }}>{val}</span>;
    if (typeof val === 'string') return <span style={{ color: '#a78bfa' }}>"{val}"</span>;
    if (Array.isArray(val)) {
      const isCollapsed = collapsed[path];
      return (
        <span>
          <button onClick={() => setCollapsed(p => ({ ...p, [path]: !p[path] }))} style={collapseBtn}>
            {isCollapsed ? '▶' : '▼'}
          </button>
          {isCollapsed ? <span style={{ color: '#6b7280' }}>[{val.length} items]</span> : (
            <span>
              {'[\n'}
              {val.map((item, i) => (
                <div key={i} style={{ paddingLeft: '20px' }}>
                  {formatValue(item, `${path}[${i}]`)}
                  {i < val.length - 1 ? ',' : ''}
                </div>
              ))}
              {']'}
            </span>
          )}
        </span>
      );
    }
    if (typeof val === 'object') {
      const keys = Object.keys(val);
      const isCollapsed = collapsed[path];
      return (
        <span>
          <button onClick={() => setCollapsed(p => ({ ...p, [path]: !p[path] }))} style={collapseBtn}>
            {isCollapsed ? '▶' : '▼'}
          </button>
          {isCollapsed ? <span style={{ color: '#6b7280' }}>{`{${keys.length} keys}`}</span> : (
            <span>
              {'{\n'}
              {keys.map((k, i) => (
                <div key={k} style={{ paddingLeft: '20px' }}>
                  <span style={{ color: '#60a5fa' }}>"{k}"</span>
                  <span style={{ color: '#94a3b8' }}>: </span>
                  {formatValue(val[k], `${path}.${k}`)}
                  {i < keys.length - 1 ? ',' : ''}
                </div>
              ))}
              {'}'}
            </span>
          )}
        </span>
      );
    }
    return <span>{String(val)}</span>;
  };

  return (
    <pre style={{
      fontFamily: 'JetBrains Mono, monospace', fontSize: '12px',
      color: '#e2e8f0', margin: 0, whiteSpace: 'pre-wrap', lineHeight: '1.7'
    }}>
      {formatValue(data, 'root')}
    </pre>
  );
}

// ==================== MAIN APP ====================

export default function App() {
  const [activeTab, setActiveTab] = useState('main'); // main, history, environments
  const [collections, setCollections] = useState([]);
  const [history, setHistory] = useState([]);
  const [environments, setEnvironments] = useState([]);
  const [activeEnv, setActiveEnv] = useState(null);
  const [currentRequest, setCurrentRequest] = useState({ ...DEFAULT_REQUEST });
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [requestTab, setRequestTab] = useState('params'); // params, headers, body, auth
  const [responseTab, setResponseTab] = useState('body'); // body, headers, info
  const [sidebarSection, setSidebarSection] = useState('collections'); // collections, history
  const [expandedCollections, setExpandedCollections] = useState({});
  const [newCollectionModal, setNewCollectionModal] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [saveToCollectionModal, setSaveToCollectionModal] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState('');
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Load data
  useEffect(() => {
    fetchCollections();
    fetchHistory();
    fetchEnvironments();
  }, []);

  const fetchCollections = async () => {
    try {
      const res = await fetch(`${API_BASE}/collections`);
      const data = await res.json();
      setCollections(Array.isArray(data) ? data : []);
    } catch {}
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_BASE}/history`);
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch {}
  };

  const fetchEnvironments = async () => {
    try {
      const res = await fetch(`${API_BASE}/environments`);
      const data = await res.json();
      setEnvironments(Array.isArray(data) ? data : []);
      const active = data.find(e => e.isActive);
      if (active) setActiveEnv(active);
    } catch {}
  };

  // Replace env variables in URL
  const resolveVariables = (text) => {
    if (!activeEnv) return text;
    let resolved = text;
    activeEnv.variables.filter(v => v.enabled).forEach(v => {
      resolved = resolved.replace(new RegExp(`{{${v.key}}}`, 'g'), v.value);
    });
    return resolved;
  };

  const sendRequest = async () => {
    if (!currentRequest.url) return showToast('Please enter a URL', 'error');
    setLoading(true);
    setResponse(null);

    try {
      const resolvedUrl = resolveVariables(currentRequest.url);
      const res = await fetch(`${API_BASE}/proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...currentRequest, url: resolvedUrl })
      });
      const raw = await res.json();
      const data = raw.response ? {
      ...raw.response,
      time: raw.response.responseTime || raw.response.time,
      error: raw.success === false ? raw.error : undefined
      } : raw;
      setResponse(data);
      if (!data.error) showToast(`${data.status} ${data.statusText} · ${data.time}ms`, data.status < 400 ? 'success' : 'error');
      else showToast(data.error, 'error');
      fetchHistory();
    } catch (err) {
      showToast('Network error: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const createCollection = async () => {
    if (!newCollectionName.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/collections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCollectionName, color: '#6366f1' })
      });
      const data = await res.json();
      setCollections(prev => [data, ...prev]);
      setNewCollectionModal(false);
      setNewCollectionName('');
      showToast('Collection created!');
    } catch { showToast('Failed to create collection', 'error'); }
  };

  const saveRequest = async () => {
    if (!selectedCollectionId) return showToast('Select a collection', 'error');
    try {
      await fetch(`${API_BASE}/collections/${selectedCollectionId}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentRequest)
      });
      fetchCollections();
      setSaveToCollectionModal(false);
      showToast('Request saved!');
    } catch { showToast('Failed to save request', 'error'); }
  };

  const deleteCollection = async (id, e) => {
    e.stopPropagation();
    await fetch(`${API_BASE}/collections/${id}`, { method: 'DELETE' });
    setCollections(prev => prev.filter(c => c._id !== id));
    showToast('Collection deleted');
  };

  const deleteRequest = async (collId, reqId, e) => {
    e.stopPropagation();
    await fetch(`${API_BASE}/collections/${collId}/requests/${reqId}`, { method: 'DELETE' });
    fetchCollections();
  };

  const clearHistory = async () => {
    await fetch(`${API_BASE}/history`, { method: 'DELETE' });
    setHistory([]);
    showToast('History cleared');
  };

  const loadFromHistory = (item) => {
    setCurrentRequest({
      name: 'From History',
      method: item.method || 'GET',
      url: item.url || '',
      headers: item.headers || [{ key: '', value: '', enabled: true }],
      params: item.params || [{ key: '', value: '', enabled: true }],
      body: item.body || { type: 'none', content: '' },
      auth: item.auth || { type: 'none' }
    });
    setSidebarSection('collections');
    showToast('Request loaded from history');
  };

  const loadCollectionRequest = (req) => {
    setCurrentRequest({
      name: req.name || 'Request',
      method: req.method || 'GET',
      url: req.url || '',
      headers: req.headers?.length ? req.headers : [{ key: '', value: '', enabled: true }],
      params: req.params?.length ? req.params : [{ key: '', value: '', enabled: true }],
      body: req.body || { type: 'none', content: '' },
      auth: req.auth || { type: 'none' }
    });
    showToast(`Loaded: ${req.name}`);
  };

  const formatBytes = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString();
  };

  // Render response body
  const renderResponseBody = () => {
    if (!response) return null;
    if (response.error) return (
      <div style={{ color: '#ef4444', fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', padding: '16px' }}>
        ⚠ Error: {response.error}
      </div>
    );

    const contentType = response.headers?.['content-type'] || '';
    const isJson = contentType.includes('application/json') || typeof response.data === 'object';

    if (isJson && typeof response.data === 'object') {
      return (
        <div style={{ padding: '16px', overflow: 'auto' }}>
          <JsonViewer data={response.data} />
        </div>
      );
    }

    return (
      <pre style={{
        padding: '16px', margin: 0, color: '#e2e8f0',
        fontFamily: 'JetBrains Mono, monospace', fontSize: '12px',
        whiteSpace: 'pre-wrap', overflow: 'auto'
      }}>
        {typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2)}
      </pre>
    );
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0a0e1a', color: '#e2e8f0', fontFamily: 'Inter, sans-serif', overflow: 'hidden' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999,
          background: toast.type === 'success' ? '#0d2b1e' : '#2b0d0d',
          border: `1px solid ${toast.type === 'success' ? '#10b98140' : '#ef444440'}`,
          color: toast.type === 'success' ? '#10b981' : '#ef4444',
          padding: '12px 20px', borderRadius: '8px', fontSize: '13px',
          fontWeight: 500, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          animation: 'slideIn 0.2s ease'
        }}>
          {toast.type === 'success' ? '✓' : '✕'} {toast.msg}
        </div>
      )}

      {/* SIDEBAR */}
      <div style={{ width: '280px', background: '#0d1222', borderRight: '1px solid #1e2d4a', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        {/* Logo */}
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid #1e2d4a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '16px'
            }}>⚡</div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.02em' }}>APIFlux</div>
              <div style={{ fontSize: '10px', color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase' }}>REST Client</div>
            </div>
          </div>
        </div>

        {/* Sidebar Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #1e2d4a' }}>
          {['collections', 'history'].map(s => (
            <button key={s} onClick={() => setSidebarSection(s)} style={{
              flex: 1, padding: '10px', background: 'none', border: 'none',
              color: sidebarSection === s ? '#6366f1' : '#475569',
              borderBottom: sidebarSection === s ? '2px solid #6366f1' : '2px solid transparent',
              cursor: 'pointer', fontSize: '11px', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.06em', transition: 'all 0.15s'
            }}>{s}</button>
          ))}
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
          {sidebarSection === 'collections' ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 4px', marginBottom: '4px' }}>
                <span style={{ fontSize: '11px', color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Collections</span>
                <button onClick={() => setNewCollectionModal(true)} style={{
                  background: '#6366f120', border: '1px solid #6366f140', color: '#6366f1',
                  borderRadius: '5px', padding: '3px 8px', cursor: 'pointer', fontSize: '11px', fontWeight: 600
                }}>+ New</button>
              </div>
              {collections.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 16px', color: '#334155' }}>
                  <div style={{ fontSize: '28px', marginBottom: '8px' }}>📁</div>
                  <div style={{ fontSize: '12px' }}>No collections yet</div>
                  <div style={{ fontSize: '11px', marginTop: '4px', color: '#1e2d4a' }}>Create one to organize your requests</div>
                </div>
              ) : collections.map(col => (
                <div key={col._id}>
                  <div
                    onClick={() => setExpandedCollections(p => ({ ...p, [col._id]: !p[col._id] }))}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px', padding: '8px',
                      borderRadius: '6px', cursor: 'pointer', marginBottom: '2px',
                      background: expandedCollections[col._id] ? '#1e2d4a40' : 'transparent',
                      ':hover': { background: '#1e2d4a40' }
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#1e2d4a60'}
                    onMouseLeave={e => e.currentTarget.style.background = expandedCollections[col._id] ? '#1e2d4a40' : 'transparent'}
                  >
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: col.color || '#6366f1', flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: '12px', fontWeight: 500, color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {expandedCollections[col._id] ? '▾' : '▸'} {col.name}
                    </span>
                    <span style={{ fontSize: '10px', color: '#334155' }}>{col.requests?.length || 0}</span>
                    <button onClick={(e) => deleteCollection(col._id, e)} style={{ ...iconBtnStyle, fontSize: '10px', opacity: 0.5 }}>✕</button>
                  </div>
                  {expandedCollections[col._id] && col.requests?.map(req => (
                    <div
                      key={req._id}
                      onClick={() => loadCollectionRequest(req)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px 6px 24px',
                        borderRadius: '5px', cursor: 'pointer', marginBottom: '1px'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#1e2d4a60'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <MethodBadge method={req.method} />
                      <span style={{ flex: 1, fontSize: '11px', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.name}</span>
                      <button onClick={(e) => deleteRequest(col._id, req._id, e)} style={{ ...iconBtnStyle, fontSize: '10px', opacity: 0.4 }}>✕</button>
                    </div>
                  ))}
                </div>
              ))}
            </>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 4px', marginBottom: '4px' }}>
                <span style={{ fontSize: '11px', color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Recent</span>
                {history.length > 0 && (
                  <button onClick={clearHistory} style={{ background: '#ef444420', border: '1px solid #ef444440', color: '#ef4444', borderRadius: '5px', padding: '3px 8px', cursor: 'pointer', fontSize: '11px' }}>Clear</button>
                )}
              </div>
              {history.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 16px', color: '#334155' }}>
                  <div style={{ fontSize: '28px', marginBottom: '8px' }}>🕐</div>
                  <div style={{ fontSize: '12px' }}>No history yet</div>
                </div>
              ) : history.map(item => (
                <div
                  key={item._id}
                  onClick={() => loadFromHistory(item)}
                  style={{
                    padding: '8px', borderRadius: '6px', cursor: 'pointer', marginBottom: '2px',
                    borderLeft: `2px solid ${item.success ? '#10b981' : '#ef4444'}40`
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#1e2d4a60'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                    <MethodBadge method={item.method} />
                    <span style={{ fontSize: '10px', color: '#475569' }}>{formatDate(item.createdAt)}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.url}</div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Bottom env selector */}
        <div style={{ padding: '12px', borderTop: '1px solid #1e2d4a', background: '#0a0e1a' }}>
          <div style={{ fontSize: '10px', color: '#334155', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Environment</div>
          <select
            value={activeEnv?._id || ''}
            onChange={e => {
              const env = environments.find(env => env._id === e.target.value);
              setActiveEnv(env || null);
            }}
            style={{ ...selectStyle, width: '100%' }}
          >
            <option value="">No Environment</option>
            {environments.map(env => (
              <option key={env._id} value={env._id}>{env.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* MAIN PANEL */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top Bar */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e2d4a', display: 'flex', alignItems: 'center', gap: '12px', background: '#0d1222' }}>
          <select
            value={currentRequest.method}
            onChange={e => setCurrentRequest(p => ({ ...p, method: e.target.value }))}
            style={{
              ...selectStyle, width: '110px', color: METHOD_COLORS[currentRequest.method],
              fontWeight: 700, fontSize: '13px', fontFamily: 'JetBrains Mono, monospace'
            }}
          >
            {Object.keys(METHOD_COLORS).map(m => (
              <option key={m} value={m} style={{ color: METHOD_COLORS[m] }}>{m}</option>
            ))}
          </select>

          <input
            value={currentRequest.url}
            onChange={e => setCurrentRequest(p => ({ ...p, url: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && sendRequest()}
            placeholder="https://api.example.com/endpoint"
            style={{
              ...inputStyle, flex: 1, fontSize: '14px', padding: '9px 14px',
              fontFamily: 'JetBrains Mono, monospace'
            }}
          />

          <button
            onClick={sendRequest}
            disabled={loading}
            style={{
              padding: '9px 24px', background: loading ? '#334155' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#fff', border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px',
              boxShadow: loading ? 'none' : '0 4px 12px rgba(99, 102, 241, 0.4)', transition: 'all 0.2s'
            }}
          >
            {loading ? (
              <>
                <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>↻</span>
                Sending...
              </>
            ) : '▶ Send'}
          </button>

          <button
            onClick={() => setSaveToCollectionModal(true)}
            style={{
              padding: '9px 16px', background: '#1e2d4a', color: '#94a3b8',
              border: '1px solid #2d3f5a', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600
            }}
          >
            💾 Save
          </button>
        </div>

        {/* Request name */}
        <div style={{ padding: '8px 20px', borderBottom: '1px solid #1e2d4a10', display: 'flex', alignItems: 'center', gap: '8px', background: '#0a0e1a' }}>
          <input
            value={currentRequest.name}
            onChange={e => setCurrentRequest(p => ({ ...p, name: e.target.value }))}
            style={{ background: 'none', border: 'none', color: '#475569', fontSize: '12px', outline: 'none', fontWeight: 500 }}
            placeholder="Request name..."
          />
        </div>

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Request Config */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #1e2d4a', overflow: 'hidden' }}>
            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #1e2d4a', padding: '0 20px', background: '#0d1222' }}>
              {['params', 'headers', 'body', 'auth'].map(t => (
                <button key={t} onClick={() => setRequestTab(t)} style={{
                  padding: '10px 16px', background: 'none', border: 'none',
                  color: requestTab === t ? '#6366f1' : '#475569',
                  borderBottom: requestTab === t ? '2px solid #6366f1' : '2px solid transparent',
                  cursor: 'pointer', fontSize: '12px', fontWeight: 600, textTransform: 'capitalize',
                  letterSpacing: '0.02em', transition: 'color 0.15s'
                }}>
                  {t}
                  {t === 'params' && currentRequest.params?.filter(p => p.key).length > 0 && (
                    <span style={{ marginLeft: '6px', background: '#6366f1', color: '#fff', borderRadius: '10px', padding: '1px 6px', fontSize: '10px' }}>
                      {currentRequest.params.filter(p => p.key).length}
                    </span>
                  )}
                  {t === 'headers' && currentRequest.headers?.filter(h => h.key).length > 0 && (
                    <span style={{ marginLeft: '6px', background: '#6366f1', color: '#fff', borderRadius: '10px', padding: '1px 6px', fontSize: '10px' }}>
                      {currentRequest.headers.filter(h => h.key).length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
              {requestTab === 'params' && (
                <KeyValueEditor
                  items={currentRequest.params || []}
                  onChange={params => setCurrentRequest(p => ({ ...p, params }))}
                  placeholder="Parameter"
                />
              )}
              {requestTab === 'headers' && (
                <KeyValueEditor
                  items={currentRequest.headers || []}
                  onChange={headers => setCurrentRequest(p => ({ ...p, headers }))}
                  placeholder="Header"
                />
              )}
              {requestTab === 'body' && (
                <div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    {['none', 'json', 'raw', 'x-www-form-urlencoded'].map(type => (
                      <button
                        key={type}
                        onClick={() => setCurrentRequest(p => ({ ...p, body: { ...p.body, type } }))}
                        style={{
                          padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 600,
                          background: currentRequest.body?.type === type ? '#6366f120' : 'transparent',
                          border: `1px solid ${currentRequest.body?.type === type ? '#6366f1' : '#2d3f5a'}`,
                          color: currentRequest.body?.type === type ? '#6366f1' : '#475569'
                        }}
                      >{type}</button>
                    ))}
                  </div>
                  {currentRequest.body?.type !== 'none' && (
                    <textarea
                      value={currentRequest.body?.content || ''}
                      onChange={e => setCurrentRequest(p => ({ ...p, body: { ...p.body, content: e.target.value } }))}
                      placeholder={currentRequest.body?.type === 'json' ? '{\n  "key": "value"\n}' : 'Request body...'}
                      style={{
                        width: '100%', minHeight: '200px', background: '#060912', border: '1px solid #1e2d4a',
                        borderRadius: '8px', color: '#e2e8f0', padding: '12px', fontSize: '13px',
                        fontFamily: 'JetBrains Mono, monospace', resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                        lineHeight: '1.6'
                      }}
                    />
                  )}
                </div>
              )}
              {requestTab === 'auth' && (
                <div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    {['none', 'bearer', 'basic', 'api-key'].map(type => (
                      <button
                        key={type}
                        onClick={() => setCurrentRequest(p => ({ ...p, auth: { ...p.auth, type } }))}
                        style={{
                          padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 600,
                          background: currentRequest.auth?.type === type ? '#6366f120' : 'transparent',
                          border: `1px solid ${currentRequest.auth?.type === type ? '#6366f1' : '#2d3f5a'}`,
                          color: currentRequest.auth?.type === type ? '#6366f1' : '#475569'
                        }}
                      >{type}</button>
                    ))}
                  </div>
                  {currentRequest.auth?.type === 'bearer' && (
                    <div>
                      <label style={labelStyle}>Token</label>
                      <input
                        value={currentRequest.auth?.token || ''}
                        onChange={e => setCurrentRequest(p => ({ ...p, auth: { ...p.auth, token: e.target.value } }))}
                        placeholder="Bearer token..."
                        style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
                      />
                    </div>
                  )}
                  {currentRequest.auth?.type === 'basic' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div>
                        <label style={labelStyle}>Username</label>
                        <input value={currentRequest.auth?.username || ''} onChange={e => setCurrentRequest(p => ({ ...p, auth: { ...p.auth, username: e.target.value } }))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={labelStyle}>Password</label>
                        <input type="password" value={currentRequest.auth?.password || ''} onChange={e => setCurrentRequest(p => ({ ...p, auth: { ...p.auth, password: e.target.value } }))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
                      </div>
                    </div>
                  )}
                  {currentRequest.auth?.type === 'api-key' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div>
                        <label style={labelStyle}>Key Name</label>
                        <input value={currentRequest.auth?.key || ''} onChange={e => setCurrentRequest(p => ({ ...p, auth: { ...p.auth, key: e.target.value } }))} placeholder="X-API-Key" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={labelStyle}>Key Value</label>
                        <input value={currentRequest.auth?.value || ''} onChange={e => setCurrentRequest(p => ({ ...p, auth: { ...p.auth, value: e.target.value } }))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={labelStyle}>Add To</label>
                        <select value={currentRequest.auth?.addTo || 'header'} onChange={e => setCurrentRequest(p => ({ ...p, auth: { ...p.auth, addTo: e.target.value } }))} style={{ ...selectStyle, width: '100%' }}>
                          <option value="header">Header</option>
                          <option value="query">Query Param</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Response Panel */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Response Header */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #1e2d4a', display: 'flex', alignItems: 'center', gap: '12px', background: '#0d1222' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Response</span>
              {response && !response.error && (
                <>
                  <StatusBadge status={response.status} />
                  <span style={{ color: '#475569', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace' }}>{response.time}ms</span>
                  <span style={{ color: '#475569', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace' }}>{formatBytes(response.size || 0)}</span>
                </>
              )}
            </div>

            {/* Response Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #1e2d4a', padding: '0 20px', background: '#0d1222' }}>
              {['body', 'headers', 'info'].map(t => (
                <button key={t} onClick={() => setResponseTab(t)} style={{
                  padding: '10px 16px', background: 'none', border: 'none',
                  color: responseTab === t ? '#6366f1' : '#475569',
                  borderBottom: responseTab === t ? '2px solid #6366f1' : '2px solid transparent',
                  cursor: 'pointer', fontSize: '12px', fontWeight: 600, textTransform: 'capitalize', letterSpacing: '0.02em'
                }}>{t}</button>
              ))}
            </div>

            {/* Response Content */}
            <div style={{ flex: 1, overflow: 'auto', background: '#060912' }}>
              {!response && !loading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#1e2d4a' }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚡</div>
                  <div style={{ fontSize: '14px', color: '#334155' }}>Send a request to see the response</div>
                  <div style={{ fontSize: '12px', color: '#1e2d4a', marginTop: '6px' }}>Press Enter or click Send</div>
                </div>
              )}
              {loading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <div style={{ fontSize: '32px', animation: 'pulse 1.5s ease-in-out infinite' }}>⏳</div>
                  <div style={{ fontSize: '13px', color: '#475569', marginTop: '12px' }}>Sending request...</div>
                </div>
              )}
              {response && responseTab === 'body' && renderResponseBody()}
              {response && responseTab === 'headers' && (
                <div style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {Object.entries(response.headers || {}).map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', gap: '12px', padding: '8px 12px', background: '#0d1222', borderRadius: '6px', border: '1px solid #1e2d4a' }}>
                        <span style={{ color: '#60a5fa', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', fontWeight: 500, minWidth: '200px' }}>{k}</span>
                        <span style={{ color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {response && responseTab === 'info' && (
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[
                    ['Status', response.status ? <StatusBadge status={response.status} /> : 'Error'],
                    ['Status Text', response.statusText || '-'],
                    ['Response Time', `${response.time}ms`],
                    ['Response Size', formatBytes(response.size || 0)],
                    ['Method', currentRequest.method],
                    ['URL', currentRequest.url],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: 'flex', gap: '16px', padding: '10px 14px', background: '#0d1222', borderRadius: '6px', border: '1px solid #1e2d4a', alignItems: 'center' }}>
                      <span style={{ color: '#475569', fontSize: '12px', fontWeight: 600, minWidth: '140px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                      <span style={{ color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>{typeof val === 'string' ? val : val}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* New Collection Modal */}
      {newCollectionModal && (
        <div style={modalOverlay} onClick={() => setNewCollectionModal(false)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', color: '#f1f5f9' }}>New Collection</div>
            <input
              autoFocus
              value={newCollectionName}
              onChange={e => setNewCollectionName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createCollection()}
              placeholder="Collection name..."
              style={{ ...inputStyle, width: '100%', marginBottom: '16px', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setNewCollectionModal(false)} style={cancelBtnStyle}>Cancel</button>
              <button onClick={createCollection} style={primaryBtnStyle}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Save to Collection Modal */}
      {saveToCollectionModal && (
        <div style={modalOverlay} onClick={() => setSaveToCollectionModal(false)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', color: '#f1f5f9' }}>Save Request</div>
            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Request Name</label>
              <input value={currentRequest.name} onChange={e => setCurrentRequest(p => ({ ...p, name: e.target.value }))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Collection</label>
              <select value={selectedCollectionId} onChange={e => setSelectedCollectionId(e.target.value)} style={{ ...selectStyle, width: '100%' }}>
                <option value="">Select a collection...</option>
                {collections.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setSaveToCollectionModal(false)} style={cancelBtnStyle}>Cancel</button>
              <button onClick={saveRequest} style={primaryBtnStyle}>Save</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500;600;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e2d4a; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #2d3f5a; }
        @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}

// ==================== STYLES ====================

const inputStyle = {
  background: '#0d1222', border: '1px solid #1e2d4a', borderRadius: '7px',
  color: '#e2e8f0', padding: '8px 12px', fontSize: '13px', outline: 'none',
  transition: 'border-color 0.15s', fontFamily: 'inherit'
};

const selectStyle = {
  background: '#0d1222', border: '1px solid #1e2d4a', borderRadius: '7px',
  color: '#e2e8f0', padding: '8px 12px', fontSize: '13px', outline: 'none',
  cursor: 'pointer', fontFamily: 'inherit'
};

const iconBtnStyle = {
  background: 'none', border: 'none', color: '#475569', cursor: 'pointer',
  padding: '2px 5px', borderRadius: '4px', fontSize: '12px',
  transition: 'color 0.15s, background 0.15s'
};

const addRowBtnStyle = {
  background: 'none', border: '1px dashed #1e2d4a', color: '#334155',
  borderRadius: '6px', padding: '6px 12px', cursor: 'pointer',
  fontSize: '11px', fontWeight: 600, width: '100%', marginTop: '4px',
  transition: 'all 0.15s'
};

const labelStyle = {
  display: 'block', fontSize: '11px', color: '#475569', fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px'
};

const modalOverlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  backdropFilter: 'blur(4px)'
};

const modalBox = {
  background: '#0d1222', border: '1px solid #1e2d4a', borderRadius: '12px',
  padding: '24px', width: '400px', boxShadow: '0 24px 80px rgba(0,0,0,0.6)'
};

const primaryBtnStyle = {
  padding: '9px 20px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
  color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer',
  fontWeight: 700, fontSize: '13px', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)'
};

const cancelBtnStyle = {
  padding: '9px 20px', background: '#1e2d4a', color: '#94a3b8',
  border: '1px solid #2d3f5a', borderRadius: '8px', cursor: 'pointer',
  fontWeight: 600, fontSize: '13px'
};

const collapseBtn = {
  background: 'none', border: 'none', color: '#475569', cursor: 'pointer',
  padding: '0 4px', fontSize: '10px', fontFamily: 'JetBrains Mono, monospace'
};
