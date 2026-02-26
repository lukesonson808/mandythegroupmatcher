/**
 * Mandy the Group Matchmaker Server
 * 
 * Server for Mandy the Group Matchmaker agent only.
 */

// Load environment variables from .env file (only if present)
try {
  const fs = require('fs');
  const path = require('path');
  const envPath = path.join(__dirname, '.env');
  const envLocalPath = path.join(__dirname, '.env.local');
  const hasEnvFile = fs.existsSync(envPath) || fs.existsSync(envLocalPath);

  if (hasEnvFile) {
    try {
      require('@dotenvx/dotenvx').config();
    } catch (error) {
      // Fallback to dotenv if @dotenvx/dotenvx not available
      try {
        require('dotenv').config();
      } catch (e) {
        console.warn('⚠️  No dotenv package found - using system environment variables only');
      }
    }
  }
} catch (e) {
  // Ignore env-file detection errors and rely on process.env
}

// Load configuration
const config = require('./config');
const express = require('express');
const bodyParser = require('body-parser');

// Core architecture
const AgentRegistry = require('./core/AgentRegistry');

// Admin dashboard (simple Basic Auth)
const ADMIN_USER = process.env.MANDY_ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.MANDY_ADMIN_PASSWORD || 'a1zapped!';

// Optional: protect inbound integration endpoints with a shared secret (recommended in prod)
// - /api/groups/receive expects: Authorization: Bearer <token> OR X-Ingest-Token: <token>
const INGEST_TOKEN = process.env.MANDY_INGEST_TOKEN || '';
// - /webhook/mandy expects: X-Webhook-Secret: <secret>
const WEBHOOK_SECRET = process.env.MANDY_WEBHOOK_SECRET || '';

// Lightweight rate limiting for protected routes (best-effort; per-process memory)
function rateLimit({ windowMs, max, keyFn }) {
  const buckets = new Map(); // key -> { count, resetAt }
  const window = Math.max(1000, windowMs || 60_000);
  const limit = Math.max(1, max || 60);
  const kfn = keyFn || ((req) => req.ip || 'unknown');

  return (req, res, next) => {
    const key = kfn(req);
    const now = Date.now();
    const b = buckets.get(key);
    if (!b || now >= b.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + window });
      return next();
    }
    b.count += 1;
    if (b.count > limit) {
      const retryAfter = Math.ceil((b.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'Too many requests', retryAfterSeconds: retryAfter });
    }
    return next();
  };
}

function requireIngestToken(req, res, next) {
  if (!INGEST_TOKEN) return next(); // not enforced unless configured
  const auth = req.headers.authorization || '';
  const headerToken = req.headers['x-ingest-token'];
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice('bearer '.length) : '';
  const token = (typeof headerToken === 'string' ? headerToken : '') || bearer;

  if (!token || token !== INGEST_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Missing/invalid ingest token' });
  }
  return next();
}

function requireWebhookSecret(req, res, next) {
  if (!WEBHOOK_SECRET) return next(); // not enforced unless configured
  const secret = req.headers['x-webhook-secret'];
  if (typeof secret !== 'string' || secret !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Missing/invalid webhook secret' });
  }
  return next();
}

function requireAdminAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Mandy Admin", charset="UTF-8"');
      return res.status(401).send('Authentication required');
    }

    const encoded = auth.slice('Basic '.length);
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const idx = decoded.indexOf(':');
    const user = idx >= 0 ? decoded.slice(0, idx) : '';
    const pass = idx >= 0 ? decoded.slice(idx + 1) : '';

    if (user !== ADMIN_USER || pass !== ADMIN_PASSWORD) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Mandy Admin", charset="UTF-8"');
      return res.status(401).send('Invalid credentials');
    }

    return next();
  } catch (e) {
    return res.status(401).send('Authentication error');
  }
}

// Mandy agent and webhook
const mandyAgent = require('./agents/mandy-agent');
const mandyWebhookHandler = require('./webhooks/mandy-webhook');

// Initialize agent registry
const agentRegistry = new AgentRegistry();
agentRegistry.register('mandy', mandyAgent, mandyWebhookHandler);

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`📥 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    config: {
      hasClaudeApiKey: !!config.claude.apiKey && !config.claude.apiKey.includes('your_'),
      hasA1ZapApiKey: !!config.a1zap.apiKey && !config.a1zap.apiKey.includes('your_')
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Meet Other Harvard Blocking Groups</title>
    <meta name="description" content="Blocking season is better when meeting people actually feels easy. Create your group profile and get matched." />
    <style>
      :root {
        --bg1: #5b0f1f;
        --bg2: #861428;
        --accent: #ffdde3;
        --btn: #ffffff;
        --btnText: #7a1024;
        --muted: rgba(255,255,255,.78);
        --text: rgba(255,255,255,.94);
        --shadow: 0 18px 50px rgba(0,0,0,.35);
        --border: rgba(255,255,255,.18);
        --sans: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
      }
      html, body { height: 100%; }
      body {
        margin: 0;
        font-family: var(--sans);
        color: var(--text);
        background:
          radial-gradient(1400px 800px at 20% 10%, rgba(255,255,255,.10), transparent 55%),
          radial-gradient(900px 700px at 85% 30%, rgba(0,0,0,.22), transparent 60%),
          radial-gradient(3px 3px at 25% 35%, rgba(255,255,255,.10), transparent 60%),
          radial-gradient(3px 3px at 60% 55%, rgba(255,255,255,.10), transparent 60%),
          radial-gradient(3px 3px at 78% 42%, rgba(255,255,255,.10), transparent 60%),
          linear-gradient(135deg, var(--bg1), var(--bg2));
      }
      .wrap { max-width: 980px; margin: 0 auto; padding: 64px 18px 72px; }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border: 1px solid rgba(255,255,255,.20);
        background: rgba(0,0,0,.18);
        padding: 8px 12px;
        border-radius: 999px;
        font-size: 12px;
        color: rgba(255,255,255,.86);
        letter-spacing: .2px;
      }
      .hero { margin-top: 34px; text-align: center; }
      h1 {
        margin: 0;
        font-size: clamp(34px, 5vw, 54px);
        line-height: 1.05;
        letter-spacing: -0.4px;
      }
      h1 .accent { color: var(--accent); }
      .subtitle {
        margin: 16px auto 0;
        max-width: 720px;
        font-size: 14px;
        line-height: 1.5;
        color: var(--muted);
      }
      .ctaRow { margin-top: 26px; display: flex; justify-content: center; }
      .cta {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 14px 18px;
        border-radius: 999px;
        background: var(--btn);
        color: var(--btnText);
        text-decoration: none;
        font-weight: 800;
        border: 1px solid rgba(255,255,255,.28);
        box-shadow: var(--shadow);
        transition: transform .06s ease, filter .12s ease;
      }
      .cta:hover { filter: brightness(1.02); }
      .cta:active { transform: translateY(1px); }
      .note {
        margin-top: 10px;
        font-size: 12px;
        color: rgba(255,255,255,.78);
      }
      .panel {
        margin: 28px auto 0;
        max-width: 760px;
        border: 1px solid var(--border);
        background: rgba(0,0,0,.16);
        border-radius: 16px;
        padding: 14px 14px;
        color: rgba(255,255,255,.86);
        font-size: 13px;
        box-shadow: 0 12px 30px rgba(0,0,0,.22);
      }
      .panelTitle { font-weight: 800; margin-bottom: 6px; }
      .panelBody { color: rgba(255,255,255,.76); line-height: 1.45; }
      footer {
        margin-top: 40px;
        text-align: center;
        color: rgba(255,255,255,.55);
        font-size: 12px;
      }
      footer a { color: rgba(255,255,255,.78); }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="badge">♡ Make Blocking Season Social</div>

      <div class="hero">
        <h1>Meet Other Harvard<br /><span class="accent">Blocking</span> Groups</h1>
        <p class="subtitle">
          Blocking season is better when meeting people actually feels easy. Mandy helps your group get discovered,
          start group chats, and turn intros into real hangouts.
        </p>

        <div class="ctaRow">
          <a class="cta" href="https://www.a1zap.com/harvard/mandy/join">Join Now →</a>
        </div>
        <div class="note">We’ll cover your first meetup activity!</div>

        <div class="panel">
          <div class="panelTitle">Early access for Harvard undergrads is live.</div>
          <div class="panelBody">
            Create your group profile now to get first access to matching rounds and curated intros.
          </div>
        </div>
      </div>

      <footer>
        Admin? Go to <a href="/admin">/admin</a>.
      </footer>
    </div>
  </body>
</html>`);
});

// Admin dashboard (Basic Auth)
app.get('/admin', requireAdminAuth, (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Mandy Admin Dashboard</title>
    <style>
      :root {
        --bg: #0b1020;
        --panel: rgba(255,255,255,.06);
        --panel2: rgba(255,255,255,.10);
        --text: rgba(255,255,255,.92);
        --muted: rgba(255,255,255,.72);
        --accent: #A51C30;
        --good: #22c55e;
        --bad: #ef4444;
        --border: rgba(255,255,255,.14);
        --shadow: 0 10px 30px rgba(0,0,0,.35);
        --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        --sans: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
      }
      html, body { height: 100%; }
      body {
        margin: 0;
        background: radial-gradient(1200px 600px at 20% 10%, rgba(165,28,48,.35), transparent 60%),
                    radial-gradient(900px 500px at 85% 15%, rgba(56,189,248,.20), transparent 55%),
                    var(--bg);
        color: var(--text);
        font-family: var(--sans);
      }
      .wrap { max-width: 1100px; margin: 0 auto; padding: 28px 18px 60px; }
      header { display: flex; gap: 14px; align-items: baseline; justify-content: space-between; flex-wrap: wrap; }
      h1 { margin: 0; font-size: 22px; letter-spacing: .2px; }
      .sub { color: var(--muted); font-size: 13px; }
      .grid { display: grid; grid-template-columns: 1fr; gap: 14px; margin-top: 16px; }
      @media (min-width: 980px) { .grid { grid-template-columns: 1.05fr .95fr; } }
      .card {
        background: linear-gradient(180deg, var(--panel), rgba(255,255,255,.035));
        border: 1px solid var(--border);
        border-radius: 14px;
        box-shadow: var(--shadow);
        overflow: hidden;
      }
      .card h2 {
        margin: 0;
        padding: 12px 14px;
        border-bottom: 1px solid var(--border);
        font-size: 14px;
        letter-spacing: .2px;
        color: rgba(255,255,255,.88);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .content { padding: 14px; }
      .row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
      button, .btnlink {
        appearance: none;
        border: 1px solid rgba(255,255,255,.18);
        background: rgba(255,255,255,.08);
        color: var(--text);
        padding: 10px 12px;
        border-radius: 10px;
        font-weight: 600;
        font-size: 13px;
        cursor: pointer;
        transition: transform .05s ease, background .15s ease, border-color .15s ease;
        text-decoration: none;
        display: inline-flex;
        gap: 8px;
        align-items: center;
      }
      button:hover, .btnlink:hover { background: rgba(255,255,255,.12); border-color: rgba(255,255,255,.26); }
      button:active, .btnlink:active { transform: translateY(1px); }
      button.primary { background: rgba(165,28,48,.28); border-color: rgba(165,28,48,.55); }
      button.primary:hover { background: rgba(165,28,48,.34); }
      button.danger { background: rgba(239,68,68,.18); border-color: rgba(239,68,68,.40); }
      input {
        border: 1px solid rgba(255,255,255,.18);
        background: rgba(0,0,0,.25);
        color: var(--text);
        padding: 10px 11px;
        border-radius: 10px;
        font-size: 13px;
        outline: none;
        min-width: 220px;
      }
      input::placeholder { color: rgba(255,255,255,.45); }
      .pill {
        font-size: 12px;
        padding: 4px 10px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,.16);
        background: rgba(0,0,0,.18);
        color: var(--muted);
      }
      table { width: 100%; border-collapse: collapse; }
      th, td { text-align: left; padding: 10px 10px; border-bottom: 1px solid rgba(255,255,255,.10); vertical-align: top; }
      th { font-size: 12px; color: rgba(255,255,255,.80); font-weight: 700; }
      td { font-size: 13px; color: rgba(255,255,255,.88); }
      .mono { font-family: var(--mono); font-size: 12px; color: rgba(255,255,255,.82); }
      .muted { color: var(--muted); }
      .right { text-align: right; }
      details { border: 1px solid rgba(255,255,255,.12); background: rgba(0,0,0,.18); border-radius: 12px; padding: 10px 12px; }
      details > summary { cursor: pointer; font-weight: 700; font-size: 12px; color: rgba(255,255,255,.84); }
      pre {
        margin: 10px 0 0;
        white-space: pre-wrap;
        word-break: break-word;
        font-family: var(--mono);
        font-size: 12px;
        background: rgba(0,0,0,.20);
        border: 1px solid rgba(255,255,255,.10);
        padding: 10px 10px;
        border-radius: 10px;
        max-height: 280px;
        overflow: auto;
      }
      .status { font-family: var(--mono); font-size: 12px; color: var(--muted); }
      .ok { color: var(--good); }
      .err { color: var(--bad); }
      .sep { height: 1px; background: rgba(255,255,255,.12); margin: 12px 0; }
      .k { color: rgba(255,255,255,.70); font-weight: 700; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <header>
        <div>
          <h1>Mandy Admin Dashboard</h1>
          <div class="sub">Simple ops UI for groups + matching endpoints.</div>
        </div>
        <div class="row">
          <span class="pill" id="envPill">env: unknown</span>
          <span class="pill" id="countsPill">groups: ? • matches: ?</span>
        </div>
      </header>

      <div class="grid">
        <section class="card">
          <h2>
            <span>Groups (DB)</span>
            <span class="row">
              <button id="refreshBtn">Refresh</button>
              <a class="btnlink" href="/api/groups" target="_blank" rel="noreferrer">Open /api/groups</a>
            </span>
          </h2>
          <div class="content">
            <div class="status" id="groupsStatus">Loading…</div>
            <div class="sep"></div>
            <div style="overflow:auto">
              <table>
                <thead>
                  <tr>
                    <th>Group</th>
                    <th>Email</th>
                    <th class="right">Size</th>
                    <th>Created</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody id="groupsTbody"></tbody>
              </table>
            </div>
          </div>
        </section>

        <section class="card">
          <h2>
            <span>Matching / Ops</span>
            <span class="row">
              <a class="btnlink" href="/api/matches" target="_blank" rel="noreferrer">Open /api/matches</a>
              <a class="btnlink" href="/health" target="_blank" rel="noreferrer">Open /health</a>
            </span>
          </h2>
          <div class="content">
            <div class="row">
              <button class="primary" id="runMatchBtn">Run /api/match</button>
              <button class="danger" id="resetAllBtn">DELETE /api/reset-all</button>
            </div>

            <div class="sep"></div>

            <div class="row">
              <input id="chatIdInput" placeholder="chatId (for reset/sync/poll)" />
              <button id="resetChatBtn">DELETE /api/reset/:chatId</button>
            </div>
            <div class="row" style="margin-top:10px">
              <button id="syncMiniBtn">POST /api/sync-mini-app-data/:chatId</button>
              <button id="pollMiniBtn">POST /api/poll-mini-apps/:chatId</button>
            </div>

            <div class="sep"></div>

            <details open>
              <summary>Last endpoint response</summary>
              <pre id="lastResponsePre">{}</pre>
            </details>
          </div>
        </section>
      </div>
    </div>

    <script>
      const $ = (id) => document.getElementById(id);

      function fmtDate(iso) {
        if (!iso) return '';
        try {
          const d = new Date(iso);
          return isNaN(d.getTime()) ? String(iso) : d.toLocaleString();
        } catch {
          return String(iso);
        }
      }

      function escapeHtml(s) {
        return String(s ?? '').replace(/[&<>"']/g, (c) => ({
          '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
      }

      async function callJson(url, opts) {
        const res = await fetch(url, opts);
        const text = await res.text();
        let data = null;
        try { data = JSON.parse(text); } catch { data = { raw: text }; }
        return { ok: res.ok, status: res.status, data };
      }

      function setLastResponse(title, payload) {
        $('lastResponsePre').textContent = JSON.stringify({ title, ...payload }, null, 2);
      }

      async function loadStats() {
        const r = await callJson('/admin/api/stats');
        if (r.ok && r.data) {
          $('envPill').textContent = 'env: ' + (r.data.env || 'unknown');
          $('countsPill').textContent = 'groups: ' + (r.data.totalGroups ?? '?') + ' • matches: ' + (r.data.totalMatches ?? '?');
        }
      }

      function deriveSize(group) {
        const ans = group && group.answers ? (group.answers.question2 || group.answers.q2) : null;
        return group.groupSize || group.size || ans || '';
      }

      function deriveEmail(group) {
        return group.email || group.contactEmail || group.contact_email || '';
      }

      function deriveName(group) {
        return group.groupName || group.name || group.group_name || (group.answers && (group.answers.question1 || group.answers.q1)) || 'Unknown';
      }

      async function loadGroups() {
        $('groupsStatus').textContent = 'Loading…';
        $('groupsStatus').className = 'status';

        const r = await callJson('/admin/api/groups');
        if (!r.ok) {
          $('groupsStatus').textContent = 'Failed to load groups (' + r.status + ')';
          $('groupsStatus').className = 'status err';
          setLastResponse('GET /admin/api/groups', r);
          return;
        }

        const groups = Array.isArray(r.data.groups) ? r.data.groups : [];
        $('groupsStatus').textContent = 'Loaded ' + groups.length + ' groups.';
        $('groupsStatus').className = 'status ok';

        const tbody = $('groupsTbody');
        tbody.innerHTML = '';

        for (const g of groups) {
          const name = deriveName(g);
          const email = deriveEmail(g);
          const size = deriveSize(g);
          const createdAt = g.createdAt || g.updatedAt || '';
          const json = JSON.stringify(g, null, 2);

          const tr = document.createElement('tr');
          tr.innerHTML = \`
            <td><div class="k">\${escapeHtml(name)}</div><div class="mono muted">\${escapeHtml(g.id || '')}</div></td>
            <td class="mono">\${escapeHtml(email)}</td>
            <td class="right mono">\${escapeHtml(size)}</td>
            <td class="mono">\${escapeHtml(fmtDate(createdAt))}</td>
            <td>
              <details>
                <summary>JSON</summary>
                <pre>\${escapeHtml(json)}</pre>
              </details>
            </td>
          \`;
          tbody.appendChild(tr);
        }

        await loadStats();
      }

      async function runEndpoint(title, url, opts) {
        setLastResponse(title, { pending: true, url });
        const r = await callJson(url, opts);
        setLastResponse(title, { url, ...r });
        await loadStats();
        return r;
      }

      $('refreshBtn').addEventListener('click', loadGroups);
      $('runMatchBtn').addEventListener('click', async () => {
        await runEndpoint('POST /api/match', '/api/match', { method: 'POST' });
        await loadGroups();
      });
      $('resetAllBtn').addEventListener('click', async () => {
        if (!confirm('This will clear ALL interview states. Continue?')) return;
        await runEndpoint('DELETE /api/reset-all', '/api/reset-all', { method: 'DELETE' });
      });
      $('resetChatBtn').addEventListener('click', async () => {
        const chatId = $('chatIdInput').value.trim();
        if (!chatId) return setLastResponse('DELETE /api/reset/:chatId', { error: 'Missing chatId' });
        await runEndpoint('DELETE /api/reset/:chatId', '/api/reset/' + encodeURIComponent(chatId), { method: 'DELETE' });
      });
      $('syncMiniBtn').addEventListener('click', async () => {
        const chatId = $('chatIdInput').value.trim();
        if (!chatId) return setLastResponse('POST /api/sync-mini-app-data/:chatId', { error: 'Missing chatId' });
        await runEndpoint('POST /api/sync-mini-app-data/:chatId', '/api/sync-mini-app-data/' + encodeURIComponent(chatId), { method: 'POST' });
      });
      $('pollMiniBtn').addEventListener('click', async () => {
        const chatId = $('chatIdInput').value.trim();
        if (!chatId) return setLastResponse('POST /api/poll-mini-apps/:chatId', { error: 'Missing chatId' });
        await runEndpoint('POST /api/poll-mini-apps/:chatId', '/api/poll-mini-apps/' + encodeURIComponent(chatId), { method: 'POST' });
      });

      loadStats().then(loadGroups);
    </script>
  </body>
</html>`);
});

app.get('/admin/api/groups', requireAdminAuth, (req, res) => {
  const groupProfileStorage = require('./services/group-profile-storage');
  const groups = groupProfileStorage.getAllProfiles();
  res.json({ success: true, groups });
});

app.get('/admin/api/stats', requireAdminAuth, (req, res) => {
  const groupProfileStorage = require('./services/group-profile-storage');
  const totalGroups = groupProfileStorage.getAllProfiles().length;
  const totalMatches = groupProfileStorage.getAllMatches().length;
  res.json({
    success: true,
    env: process.env.NODE_ENV || (process.env.PORT ? 'production' : 'development'),
    totalGroups,
    totalMatches
  });
});

// Mandy the Group Matchmaker webhook endpoint
app.post('/webhook/mandy', requireWebhookSecret, mandyWebhookHandler);

// Matching endpoint - run matching algorithm and save results (POST or GET)
const handleMatchRequest = async (req, res) => {
  try {
    console.log('💕 Matching endpoint called');
    
    const groupMatching = require('./services/group-matching');
    const groupProfileStorage = require('./services/group-profile-storage');
    const emailService = require('./services/email-service');
    const fs = require('fs');
    const path = require('path');
    
    const allProfiles = groupProfileStorage.getAllProfiles();
    
    if (allProfiles.length < 2) {
      return res.status(400).json({
        error: 'Not enough groups',
        message: 'Need at least 2 groups to perform matching',
        groupsCount: allProfiles.length
      });
    }
    
    // Clear existing matches for fresh matching event
    const matchesData = { matches: [] };
    fs.writeFileSync(path.join(__dirname, 'data', 'matches.json'), JSON.stringify(matchesData, null, 2));
    
    // Find best overall match
    const bestMatch = await groupMatching.findBestMatch();
    
    if (bestMatch) {
      const group1Name = bestMatch.group1.groupName || bestMatch.group1.name || bestMatch.group1.group_name || bestMatch.group1.answers?.question1 || bestMatch.group1.answers?.q1 || 'Unknown Group 1';
      const group2Name = bestMatch.group2.groupName || bestMatch.group2.name || bestMatch.group2.group_name || bestMatch.group2.answers?.question1 || bestMatch.group2.answers?.q1 || 'Unknown Group 2';

      const matchRecord = {
        group1Name: group1Name,
        group2Name: group2Name,
        group1Id: bestMatch.group1.id,
        group2Id: bestMatch.group2.id,
        compatibility: bestMatch.compatibility,
        matchedAt: new Date().toISOString(),
        isBestMatch: true
      };
      
      groupProfileStorage.saveMatch(matchRecord);
    }
    
    // Send email notifications for best match if found
    let emailStatus = null;
    if (bestMatch) {
      console.log('📧 [Matching] Sending match notification emails...');
      const emailResult = await emailService.sendMatchNotification(
        {
          name: bestMatch.group1.groupName || bestMatch.group1.name || bestMatch.group1.group_name || bestMatch.group1.answers?.question1 || bestMatch.group1.answers?.q1 || 'Unknown Group 1',
          email: bestMatch.group1.email || bestMatch.group1.contactEmail || null,
          memberEmails: bestMatch.group1.memberEmails || bestMatch.group1.emails || []
        },
        {
          name: bestMatch.group2.groupName || bestMatch.group2.name || bestMatch.group2.group_name || bestMatch.group2.answers?.question1 || bestMatch.group2.answers?.q1 || 'Unknown Group 2',
          email: bestMatch.group2.email || bestMatch.group2.contactEmail || null,
          memberEmails: bestMatch.group2.memberEmails || bestMatch.group2.emails || []
        },
        {
          compatibility: bestMatch.compatibility
        }
      );
      
      emailStatus = {
        sent: emailResult.success,
        emails: emailResult.emails,
        shareLink: emailResult.shareLink,
        chatId: emailResult.chatId
      };
      
      if (emailResult.success) {
        console.log('✅ [Matching] Match notification emails sent successfully');
      } else {
        console.warn('⚠️  [Matching] Some emails failed to send:', emailResult.emails);
      }
    }
    
    // Find top matches for each group
    const matchesByGroup = {};
    let totalMatchesSaved = 0;
    
    for (const group of allProfiles) {
      const groupName = group.groupName || group.name || group.group_name || group.answers?.question1 || group.answers?.q1;
      if (!groupName) {
        console.warn('⚠️  [Matching] Skipping group with no groupName:', group?.id || group);
        continue;
      }

      const matches = await groupMatching.findMatchesForGroup(groupName, 3);
      matchesByGroup[groupName] = matches.map(m => ({
        groupName: m.group.groupName,
        compatibility: m.compatibility.percentage,
        breakdown: m.compatibility
      }));
      
      // Save top 3 matches for this group (avoid duplicates with best match)
      for (const match of matches) {
        const isBestMatchPair = bestMatch && (
          (match.group.groupName === bestMatch.group1.groupName && group.groupName === bestMatch.group2.groupName) ||
          (match.group.groupName === bestMatch.group2.groupName && group.groupName === bestMatch.group1.groupName)
        );
        
        if (!isBestMatchPair) {
          groupProfileStorage.saveMatch({
            group1Name: group.groupName,
            group2Name: match.group.groupName,
            group1Id: group.id,
            group2Id: match.group.id,
            compatibility: match.compatibility,
            matchedAt: new Date().toISOString()
          });
          totalMatchesSaved++;
        }
      }
    }
    
    const allMatches = groupProfileStorage.getAllMatches();
    
    res.json({
      success: true,
      message: 'Matching completed successfully',
      summary: {
        totalGroups: allProfiles.length,
        totalMatches: allMatches.length,
        bestMatch: bestMatch ? {
          group1: bestMatch.group1.groupName,
          group2: bestMatch.group2.groupName,
          compatibility: bestMatch.compatibility.percentage,
          breakdown: bestMatch.compatibility
        } : null
      },
      matchesByGroup,
      allMatches: allMatches.map(m => ({
        group1: m.group1Name,
        group2: m.group2Name,
        compatibility: m.compatibility?.percentage || 0,
        matchedAt: m.matchedAt,
        isBestMatch: m.isBestMatch || false
      })),
      emailStatus: emailStatus
    });
    
  } catch (error) {
    console.error('❌ Matching error:', error);
    res.status(500).json({
      error: 'Matching failed',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Support both GET and POST for easy access (just click the URL in Railway!)
app.get('/api/match', rateLimit({ windowMs: 60_000, max: 30 }), requireAdminAuth, handleMatchRequest);
app.post('/api/match', rateLimit({ windowMs: 60_000, max: 30 }), requireAdminAuth, handleMatchRequest);

// Get matches endpoint - retrieve saved matches
app.get('/api/matches', rateLimit({ windowMs: 60_000, max: 120 }), requireAdminAuth, (req, res) => {
  try {
    const groupProfileStorage = require('./services/group-profile-storage');
    const allMatches = groupProfileStorage.getAllMatches();
    const allProfiles = groupProfileStorage.getAllProfiles();
    
    res.json({
      success: true,
      totalGroups: allProfiles.length,
      totalMatches: allMatches.length,
      matches: allMatches.map(m => ({
        group1: m.group1Name,
        group2: m.group2Name,
        compatibility: m.compatibility?.percentage || 0,
        breakdown: m.compatibility,
        matchedAt: m.matchedAt,
        isBestMatch: m.isBestMatch || false
      }))
    });
  } catch (error) {
    console.error('❌ Error fetching matches:', error);
    res.status(500).json({
      error: 'Failed to fetch matches',
      message: error.message
    });
  }
});

// Get groups endpoint - retrieve all group profiles
app.get('/api/groups', rateLimit({ windowMs: 60_000, max: 120 }), requireAdminAuth, (req, res) => {
  try {
    const groupProfileStorage = require('./services/group-profile-storage');
    const allProfiles = groupProfileStorage.getAllProfiles();
    
    res.json({
      success: true,
      totalGroups: allProfiles.length,
      groups: allProfiles.map(g => ({
        groupName: g.groupName,
        id: g.id,
        size: g.answers?.question2 || g.q2 || 'N/A',
        createdAt: g.createdAt,
        hasMiniAppSessions: !!(g.miniAppSessions && Object.keys(g.miniAppSessions).length > 0),
        hasMiniAppData: !!(g.miniAppData && Object.keys(g.miniAppData).length > 0)
      }))
    });
  } catch (error) {
    console.error('❌ Error fetching groups:', error);
    res.status(500).json({
      error: 'Failed to fetch groups',
      message: error.message
    });
  }
});

// Sync mini app data endpoint - manually trigger sync for a chat
app.post('/api/sync-mini-app-data/:chatId', rateLimit({ windowMs: 60_000, max: 60 }), requireAdminAuth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const mandyWebhookModule = require('./webhooks/mandy-webhook');
    const mandyWebhook = mandyWebhookModule.instance;
    
    if (!mandyWebhook || !mandyWebhook.syncMiniAppData) {
      return res.status(500).json({
        error: 'Webhook instance not available',
        message: 'Cannot access syncMiniAppData method'
      });
    }
    
    const miniAppData = await mandyWebhook.syncMiniAppData(chatId);
    
    if (miniAppData) {
      res.json({
        success: true,
        message: 'Mini app data synced successfully',
        chatId,
        miniAppData,
        syncedAt: new Date().toISOString()
      });
    } else {
      res.json({
        success: false,
        message: 'No mini app sessions found for this chat',
        chatId
      });
    }
  } catch (error) {
    console.error('❌ Error syncing mini app data:', error);
    res.status(500).json({
      error: 'Failed to sync mini app data',
      message: error.message
    });
  }
});

// Reset/clear interview state for a chat (for testing)
app.delete('/api/reset/:chatId', rateLimit({ windowMs: 60_000, max: 60 }), requireAdminAuth, (req, res) => {
  try {
    const { chatId } = req.params;
    const groupProfileStorage = require('./services/group-profile-storage');
    
    // Get current state before clearing (for logging)
    const currentState = groupProfileStorage.getInterviewState(chatId);
    const currentProfile = groupProfileStorage.getProfileByChatId(chatId);
    
    // Clear interview state
    groupProfileStorage.clearInterviewState(chatId);
    
    res.json({
      success: true,
      message: 'Interview state cleared for chat',
      chatId,
      clearedState: currentState ? {
        hadMiniAppsShared: currentState.miniAppsShared || false,
        sessionId: currentState.sessionId
      } : null,
      hadProfile: !!currentProfile,
      note: 'Profile was NOT deleted - only interview state was cleared. User can start fresh mini app flow.'
    });
  } catch (error) {
    console.error('❌ Error resetting chat state:', error);
    res.status(500).json({
      error: 'Failed to reset chat state',
      message: error.message
    });
  }
});

// Get interview state for debugging
app.get('/api/state/:chatId', rateLimit({ windowMs: 60_000, max: 120 }), requireAdminAuth, (req, res) => {
  try {
    const { chatId } = req.params;
    const groupProfileStorage = require('./services/group-profile-storage');
    
    const state = groupProfileStorage.getInterviewState(chatId);
    const profile = groupProfileStorage.getProfileByChatId(chatId);
    
    res.json({
      success: true,
      chatId,
      interviewState: state,
      hasProfile: !!profile,
      profile: profile ? {
        groupName: profile.groupName,
        id: profile.id,
        hasMiniAppSessions: !!(profile.miniAppSessions && Object.keys(profile.miniAppSessions).length > 0),
        hasMiniAppData: !!(profile.miniAppData && Object.keys(profile.miniAppData).length > 0)
      } : null
    });
  } catch (error) {
    console.error('❌ Error getting state:', error);
    res.status(500).json({
      error: 'Failed to get state',
      message: error.message
    });
  }
});

// Clear ALL interview states (nuclear option for testing)
app.delete('/api/reset-all', rateLimit({ windowMs: 60_000, max: 30 }), requireAdminAuth, (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Clear interview state file
    const statePath = path.join(__dirname, 'data', 'interview-state.json');
    fs.writeFileSync(statePath, JSON.stringify({}, null, 2));
    
    res.json({
      success: true,
      message: 'All interview states cleared',
      note: 'Profiles were NOT deleted - only interview states were cleared'
    });
  } catch (error) {
    console.error('❌ Error resetting all states:', error);
    res.status(500).json({
      error: 'Failed to reset all states',
      message: error.message
    });
  }
});

// Receive group data from main A1Zap server
app.post('/api/groups/receive', requireIngestToken, async (req, res) => {
  try {
    console.log('📥 [Groups] Received group data from main server');
    console.log('   Data:', JSON.stringify(req.body, null, 2));
    
    const groupProfileStorage = require('./services/group-profile-storage');
    const groupData = req.body;
    
    // Validate required fields
    if (!groupData.name && !groupData.groupName) {
      return res.status(400).json({
        error: 'Missing required field',
        message: 'Group must have a "name" or "groupName" field'
      });
    }
    
    // Transform incoming data to expected format
    // Handle different possible field names from the main server
    const transformedGroup = {
      groupName: groupData.name || groupData.groupName || groupData.group_name,
      email: groupData.email || groupData.contactEmail || groupData.contact_email,
      // Store member emails for group chat creation
      memberEmails: groupData.memberEmails || groupData.member_emails || groupData.emails || groupData.members || [],
      // Map answers - handle different formats
      answers: {
        question1: groupData.name || groupData.groupName || groupData.group_name,
        question2: groupData.size || groupData.groupSize || groupData.group_size || groupData.answers?.question2,
        question3: groupData.idealDay || groupData.ideal_day || groupData.lookingFor || groupData.looking_for || groupData.answers?.question3,
        question4: groupData.fictionReference || groupData.fiction_reference || groupData.answers?.question4,
        question5: groupData.musicTaste || groupData.music_taste || groupData.answers?.question5,
        question6: groupData.dislikedCelebrity || groupData.disliked_celebrity || groupData.answers?.question6,
        question7: groupData.originStory || groupData.origin_story || groupData.answers?.question7,
        question8: groupData.emoji || groupData.vibe || groupData.answers?.question8,
        question9: groupData.romanEmpire || groupData.roman_empire || groupData.answers?.question9,
        question10: groupData.sideQuest || groupData.side_quest || groupData.answers?.question10
      },
      // Store raw data for reference
      rawData: groupData,
      // Store vibes/preferences if provided (accept multiple field names)
      vibes: groupData.vibes || groupData.vibeTags || groupData.preferences || null,
      lookingFor: groupData.lookingFor || groupData.looking_for || null,
      // Store any additional metadata
      metadata: groupData.metadata || {},
      // Store chatId if provided (for linking to chat)
      chatId: groupData.chatId || groupData.chat_id || null
    };
    
    // Check if group already exists (using composite key: name + email or chatId)
    // This prevents groups with the same name but different emails from overwriting each other
    const existingProfile = groupProfileStorage.getProfileByCompositeKey(
      transformedGroup.groupName,
      transformedGroup.email,
      transformedGroup.chatId
    );
    
    if (existingProfile) {
      // Update existing profile
      console.log(`🔄 [Groups] Updating existing group: ${transformedGroup.groupName}${transformedGroup.email ? ` (${transformedGroup.email})` : ''}`);
      const updated = groupProfileStorage.updateGroupProfile(
        transformedGroup.groupName,
        transformedGroup,
        transformedGroup.email,
        transformedGroup.chatId
      );
      
      if (updated) {
        return res.json({
          success: true,
          message: 'Group updated successfully',
          group: {
            name: updated.groupName,
            id: updated.id,
            email: updated.email,
            updated: true
          }
        });
      } else {
        return res.status(500).json({
          error: 'Failed to update group',
          message: 'Group found but update failed'
        });
      }
    } else {
      // Create new profile
      console.log(`✨ [Groups] Creating new group: ${transformedGroup.groupName}${transformedGroup.email ? ` (${transformedGroup.email})` : ''}`);
      const saved = groupProfileStorage.saveGroupProfile(transformedGroup);
      
      return res.json({
        success: true,
        message: 'Group received and saved successfully',
        group: {
          name: saved.groupName,
          id: saved.id,
          email: saved.email,
          created: true
        }
      });
    }
  } catch (error) {
    console.error('❌ Error receiving group data:', error);
    res.status(500).json({
      error: 'Failed to process group data',
      message: error.message
    });
  }
});

// Poll and create profile from mini apps endpoint
app.post('/api/poll-mini-apps/:chatId', rateLimit({ windowMs: 60_000, max: 60 }), requireAdminAuth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const mandyWebhookModule = require('./webhooks/mandy-webhook');
    const mandyWebhook = mandyWebhookModule.instance;
    
    if (!mandyWebhook || !mandyWebhook.pollAndCreateProfileFromMiniApps) {
      return res.status(500).json({
        error: 'Webhook instance not available'
      });
    }
    
    const groupProfileStorage = require('./services/group-profile-storage');
    const interviewState = groupProfileStorage.getInterviewState(chatId);
    const groupName = interviewState?.groupName || 'Unknown';
    
    const profile = await mandyWebhook.pollAndCreateProfileFromMiniApps(chatId, groupName);
    
    if (profile) {
      res.json({
        success: true,
        message: 'Profile created from mini app data',
        chatId,
        profile: {
          groupName: profile.groupName,
          id: profile.id,
          hasMiniAppData: !!(profile.miniAppData && Object.keys(profile.miniAppData).length > 0)
        }
      });
    } else {
      res.json({
        success: false,
        message: 'Not enough mini app data yet or profile already exists',
        chatId
      });
    }
  } catch (error) {
    console.error('❌ Error polling mini apps:', error);
    res.status(500).json({
      error: 'Failed to poll mini apps',
      message: error.message
    });
  }
});
// Start server
// Railway sets PORT automatically, default to 3000 for local dev
const PORT = process.env.PORT || config.server.port || 3000;
// Listen on all interfaces for Railway/production, localhost for dev
const HOST = process.env.PORT ? '0.0.0.0' : 'localhost';

const server = app.listen(PORT, HOST, () => {
  console.log(`\n🚀 Mandy the Group Matchmaker running on http://${HOST}:${PORT}`);
  console.log(`   Version: 1.0.0`);
  
  // Print agent registry summary
  agentRegistry.printSummary();
  
  console.log(`\nWebhook Endpoints:`);
  console.log(`  POST /webhook/mandy               - Mandy the Group Matchmaker`);
  console.log(`  GET  /health                      - Health check`);
  console.log(`\nAPI Endpoints:`);
  console.log(`  GET/POST /api/match               - Run matching algorithm (clickable!)`);
  console.log(`  GET  /api/matches                 - Get all saved matches`);
  console.log(`  GET  /api/groups                  - Get all group profiles`);
  console.log(`  POST /api/sync-mini-app-data/:chatId - Sync mini app data for a chat`);
  console.log(`  POST /api/poll-mini-apps/:chatId - Poll mini apps and create profile`);
  console.log(`  GET  /api/state/:chatId          - Get interview state for debugging`);
  console.log(`  DELETE /api/reset/:chatId        - Reset interview state for a chat`);
  console.log(`  DELETE /api/reset-all            - Reset ALL interview states (testing)`);
  console.log(`\nConfiguration:`);
  console.log(`  Claude API: ${config.claude.apiKey && !config.claude.apiKey.includes('your_') ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`  A1Zap API: ${config.a1zap.apiKey && !config.a1zap.apiKey.includes('your_') ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`  Mandy Agent ID: ${config.agents.mandy && config.agents.mandy.agentId ? '✅ Configured' : '❌ Not configured'}\n`);
});

// Error handling
server.on('error', (error) => {
  console.error(`❌ Server error:`, error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n📴 Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n📴 Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

