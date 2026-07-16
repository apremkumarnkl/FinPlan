/**
 * FinPlan — Google Drive token proxy (Cloudflare Worker)
 * ========================================================================
 * WHY THIS EXISTS
 * Browser-only OAuth (what FinPlan uses by default) can never get a real,
 * long-lived refresh token — Google only issues those to a trusted backend,
 * because a refresh token that never expires must never be exposed to
 * client-side JavaScript. This tiny Worker IS that trusted backend: it's the
 * only place your OAuth Client Secret ever lives. It does two things and
 * nothing else:
 *   1. POST /exchange  — trade a one-time authorization "code" for an
 *      access_token + refresh_token (done once, when you first connect).
 *   2. POST /refresh    — trade your stored refresh_token for a fresh
 *      access_token (done automatically, forever, no re-consent needed).
 * It never sees, stores, or logs your FinPlan data — only Google's OAuth
 * tokens pass through it, in memory, per request.
 *
 * SETUP (about 5 minutes):
 * 1. Go to https://dash.cloudflare.com → Workers & Pages → Create → Worker.
 * 2. Paste this entire file in as the Worker's code, replacing the default.
 * 3. Go to Settings → Variables → add these two:
 *      - GOOGLE_CLIENT_ID     (same Client ID you used in FinPlan)
 *      - GOOGLE_CLIENT_SECRET (from the same Google Cloud OAuth Client —
 *        click your OAuth Client in Google Cloud Console to reveal it;
 *        mark this one as "Encrypt" in Cloudflare so it's never shown again)
 * 4. Add ALLOWED_ORIGIN too (the exact https:// URL you host FinPlan at,
 *    e.g. https://yourname.github.io — no trailing slash, no path).
 * 5. Deploy. Copy the Worker's URL (e.g. https://finplan-proxy.you.workers.dev)
 *    into FinPlan's Settings → "Token Proxy URL" field.
 * 6. In Google Cloud Console, edit your OAuth Client and add your FinPlan
 *    URL (the exact page, e.g. https://yourname.github.io/finplan.html)
 *    under "Authorized redirect URIs" — this is in ADDITION to the
 *    "Authorized JavaScript origins" entry you already added.
 */

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

function corsHeaders(env){
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

async function handleExchange(request, env){
  const { code, redirect_uri } = await request.json();
  if (!code || !redirect_uri){
    return new Response(JSON.stringify({ error: 'Missing code or redirect_uri' }), { status: 400 });
  }
  const body = new URLSearchParams({
    code,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    redirect_uri,
    grant_type: 'authorization_code',
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();
  if (!res.ok){
    return new Response(JSON.stringify({ error: data.error_description || data.error || 'Exchange failed' }), { status: 400 });
  }
  // Only ever return what the client needs — never anything else.
  return new Response(JSON.stringify({
    access_token: data.access_token,
    refresh_token: data.refresh_token, // only present on the very first exchange
    expires_in: data.expires_in,
  }), { status: 200 });
}

async function handleRefresh(request, env){
  const { refresh_token } = await request.json();
  if (!refresh_token){
    return new Response(JSON.stringify({ error: 'Missing refresh_token' }), { status: 400 });
  }
  const body = new URLSearchParams({
    refresh_token,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    grant_type: 'refresh_token',
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();
  if (!res.ok){
    return new Response(JSON.stringify({ error: data.error_description || data.error || 'Refresh failed' }), { status: 400 });
  }
  return new Response(JSON.stringify({
    access_token: data.access_token,
    expires_in: data.expires_in,
  }), { status: 200 });
}

export default {
  async fetch(request, env){
    const headers = corsHeaders(env);
    if (request.method === 'OPTIONS'){
      return new Response(null, { headers });
    }
    const url = new URL(request.url);
    try{
      let response;
      if (request.method === 'POST' && url.pathname === '/exchange'){
        response = await handleExchange(request, env);
      } else if (request.method === 'POST' && url.pathname === '/refresh'){
        response = await handleRefresh(request, env);
      } else {
        response = new Response(JSON.stringify({ error: 'Not found. Use POST /exchange or POST /refresh.' }), { status: 404 });
      }
      const finalHeaders = new Headers(response.headers);
      Object.entries(headers).forEach(([k,v])=>finalHeaders.set(k,v));
      finalHeaders.set('Content-Type', 'application/json');
      return new Response(response.body, { status: response.status, headers: finalHeaders });
    }catch(err){
      return new Response(JSON.stringify({ error: 'Worker error: ' + err.message }), { status: 500, headers: { ...headers, 'Content-Type':'application/json' } });
    }
  }
};
