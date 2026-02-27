# ⚡ APIFlux — Full Stack REST API Testing Tool

A professional, feature-rich API testing tool built for developers. Think Postman, but built by you.

---

## 🎯 Project Overview

**APIFlux** is a full-stack REST API client that allows developers to craft, send, and analyze HTTP requests — with persistent collections, request history, environment variables, and multi-auth support.

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Custom CSS-in-JS |
| **Backend** | Node.js, Express.js |
| **Database** | MongoDB with Mongoose ODM |
| **HTTP Proxy** | Axios (server-side request forwarding) |
| **Fonts** | JetBrains Mono, Inter (Google Fonts) |

---

## ✨ Features

### Core
- 🚀 **Send HTTP Requests** — GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
- 📋 **Query Params** — Add/enable/disable key-value params
- 📨 **Request Headers** — Full header customization
- 📦 **Request Body** — JSON, raw, x-www-form-urlencoded

### Authentication
- 🔑 **Bearer Token** — Authorization header injection
- 👤 **Basic Auth** — Base64 encoded username/password
- 🗝️ **API Key** — Add to header or query param

### Organization
- 📁 **Collections** — Group and save requests
- 🕐 **Request History** — Auto-saved with timestamps
- 🌍 **Environment Variables** — Use `{{variable}}` in URLs

### Response Viewer
- 🎨 **Interactive JSON Viewer** — Collapsible tree with syntax highlighting
- 📊 **Response Headers** — Full header inspection
- ℹ️ **Request Info** — Status, time, size, method, URL

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- MongoDB (local or Atlas)
- npm

### 1. Clone & Setup Backend

```bash
cd backend
npm install
# Create .env file:
echo "PORT=5000\nMONGO_URI=mongodb://localhost:27017/apitester" > .env
npm run dev
```

### 2. Setup Frontend

```bash
cd frontend
npm install
npm start
```

### 3. Open in browser
```
http://localhost:3000
```

---

## 📁 Project Structure

```
api-tester/
├── backend/
│   ├── models/
│   │   ├── Collection.js       # Collection + nested Request schema
│   │   ├── History.js          # Request history schema
│   │   └── Environment.js      # Environment variables schema
│   ├── routes/
│   │   ├── collections.js      # CRUD for collections & requests
│   │   ├── proxy.js            # HTTP proxy (sends actual requests)
│   │   ├── history.js          # History management
│   │   └── environments.js     # Environment CRUD + activation
│   ├── server.js               # Express app entry point
│   └── .env                    # Config (PORT, MONGO_URI)
│
└── frontend/
    └── src/
        ├── App.js              # Main application (all-in-one component)
        └── index.js            # React DOM entry
```

---

## 🔌 API Endpoints

### Collections
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/collections` | Get all collections |
| POST | `/api/collections` | Create new collection |
| PUT | `/api/collections/:id` | Update collection |
| DELETE | `/api/collections/:id` | Delete collection |
| POST | `/api/collections/:id/requests` | Add request to collection |
| PUT | `/api/collections/:id/requests/:reqId` | Update request |
| DELETE | `/api/collections/:id/requests/:reqId` | Delete request |

### Proxy
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/proxy` | Forward HTTP request to any URL |

**Proxy Request Body:**
```json
{
  "method": "GET",
  "url": "https://api.example.com/data",
  "headers": [{ "key": "Accept", "value": "application/json", "enabled": true }],
  "params": [],
  "body": { "type": "none", "content": "" },
  "auth": { "type": "bearer", "token": "your-token" }
}
```

### History
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/history` | Get last 100 requests |
| DELETE | `/api/history` | Clear all history |
| DELETE | `/api/history/:id` | Delete single entry |

### Environments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/environments` | Get all environments |
| POST | `/api/environments` | Create environment |
| PUT | `/api/environments/:id` | Update environment |
| PUT | `/api/environments/:id/activate` | Set as active environment |
| DELETE | `/api/environments/:id` | Delete environment |

---

## 🧠 Key Architectural Decisions

### Server-Side Proxy
All HTTP requests go through the backend proxy (`/api/proxy`) rather than directly from the browser. This solves **CORS issues** — your backend handles the actual request, then forwards the response to the frontend.

### Nested Document Schema
Requests are embedded **within** Collection documents in MongoDB (nested arrays). This is an intentional denormalization for performance — fetching a collection fetches all its requests in one query.

### Environment Variable Resolution
`{{variable}}` syntax is resolved on the **frontend** before sending to the proxy, keeping variable substitution logic client-side and clean.

---

## 🎨 UI Design

- **Dark theme** with a deep navy/slate palette
- **JetBrains Mono** for all URLs, code, and response data
- **Color-coded HTTP methods** — each method has a unique color
- **Status badges** — green (2xx), orange (3xx/4xx), red (5xx)
- **Collapsible JSON tree** — interactive response viewer

---

## 🔮 Future Enhancements

- [ ] WebSocket support
- [ ] Request chaining / pre-request scripts
- [ ] Export/import collections (Postman format)
- [ ] GraphQL support
- [ ] Team collaboration with user auth
- [ ] Response diff/compare tool
- [ ] Request code generation (curl, fetch, axios)

---

## 🎤 Interview Talking Points

1. **Full-stack architecture** — React frontend, Express REST API, MongoDB persistence
2. **Proxy pattern** — Why server-side proxying solves real CORS problems
3. **Mongoose schema design** — Embedded documents vs. references tradeoffs
4. **State management** — Complex multi-panel UI state using React hooks only
5. **Auth handling** — Three auth strategies with clean abstraction
6. **Environment variables** — Template variable resolution system

---

## 📝 License

MIT — Built as a portfolio project.
