// Static demo (REACT_APP_DEMO=1, see build-demo.mjs): no backend, data kept in the browser.
if (process.env.REACT_APP_API_BASE) { require('./remoteApi'); }
else if (process.env.REACT_APP_DEMO) { require('./demoShim'); }
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><App /></React.StrictMode>);
