/* Store branding: logo, store name, theme color taken from the logo, home-screen icon, and the app's clean look. */
(() => {
  'use strict';
  const CACHE_KEY = 'sm_brand_v1';
  const DEFAULT = { name: 'Store Manager', logo: null, color: '#183153' };
  const cfg = window.STORE_CONFIG || {};
  const client = window.supabase && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false } })
    : null;
  const $ = (s, r = document) => r.querySelector(s);

  // <utils>
  const toHex = ([r, g, b]) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const parseHex = h => { h = String(h || '').replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); const n = parseInt(h, 16); return Number.isNaN(n) ? [24, 49, 83] : [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  function rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2;
    if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
    return [h, s, l];
  }
  function hsl2rgb(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2; let r = 0, g = 0, b = 0;
    if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0]; else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c]; else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
    return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
  }
  const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  // A readable version of the brand color for text on a card (darker on light cards, lighter on dark cards).
  function textOn(rgb, card) {
    let [h, s, l] = rgb2hsl(...rgb); const dark = lum(card) < 0.3;
    for (let i = 0; i < 50; i++) { const c = hsl2rgb(h, s, l); if (contrast(c, card) >= 4.5) return toHex(c); l += dark ? 0.02 : -0.02; if (l < 0 || l > 1) break; }
    return dark ? '#ffffff' : '#000000';
  }
  // Picks the logo's main color: the most vivid color wins; plain black/grey logos use their grey.
  function dominantFromData(d) {
    const buckets = new Map(); let gr = 0, gg = 0, gb = 0, gn = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3]; if (a < 160) continue;
      const [h, sat, l] = rgb2hsl(r, g, b); if (l > 0.94) continue;
      if (l < 0.1 || sat < 0.2) { gr += r; gg += g; gb += b; gn++; continue; }
      const w = sat * (1 - Math.abs(2 * l - 1)) + 0.05, k = Math.round(h / 24) % 15, o = buckets.get(k) || { w: 0, r: 0, g: 0, b: 0 };
      o.w += w; o.r += r * w; o.g += g * w; o.b += b * w; buckets.set(k, o);
    }
    let best = null; buckets.forEach(o => { if (!best || o.w > best.w) best = o; });
    let rgb;
    if (best && best.w >= Math.max(8, gn * 0.12)) rgb = [best.r / best.w, best.g / best.w, best.b / best.w];
    else if (gn > 0) rgb = [gr / gn, gg / gn, gb / gn];
    else return DEFAULT.color;
    const [h, s, l] = rgb2hsl(...rgb);
    return toHex(hsl2rgb(h, s, Math.max(0.22, Math.min(0.72, l))));
  }
  // </utils>

  const load = () => { try { return { ...DEFAULT, ...(JSON.parse(localStorage.getItem(CACHE_KEY)) || {}) }; } catch (e) { return { ...DEFAULT }; } };
  const store = b => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(b)); } catch (e) {} };
  let brand = load(), role = null, loaded = false, ready = false, deferredInstall = null;

  function toast(text, bad) {
    const t = document.createElement('div'); t.textContent = text;
    t.style.cssText = 'position:fixed;left:50%;bottom:96px;transform:translateX(-50%);max-width:92%;padding:12px 18px;border-radius:12px;color:#fff;font-weight:700;z-index:10001;box-shadow:0 6px 20px #0005;background:' + (bad ? '#d92d20' : 'var(--brand-text,#183153)');
    document.body.appendChild(t); setTimeout(() => t.remove(), bad ? 5000 : 2800);
  }
  const friendly = e => /could not find the function/i.test(e?.message || '') ? 'Branding is not set up yet. Run the branding SQL in Supabase first.' : (e?.message || 'Something went wrong.');

  // ---- Look and feel ------------------------------------------------------
  const style = document.createElement('style');
  style.textContent = `
:root{color-scheme:light dark;--bg:#f4f6fa;--bg2:#eef1f6;--card:#fff;--ink:#0f172a;--mut:#64748b;--line:#e2e8f0;--brand-l:#183153;--ink-l:#fff;--soft-l:rgba(24,49,83,.12);--bt-l:#183153;--brand-d:#6d9be0;--ink-d:#0b1020;--soft-d:rgba(109,155,224,.2);--bt-d:#9db8e0;--brand:var(--brand-l);--brand-ink:var(--ink-l);--brand-soft:var(--soft-l);--brand-text:var(--bt-l);--shadow:0 1px 2px rgba(15,23,42,.05),0 8px 24px rgba(15,23,42,.06)}
@media(prefers-color-scheme:dark){:root{--bg:#0b1020;--bg2:#101828;--card:#151c2b;--ink:#f1f5f9;--mut:#94a3b8;--line:#25304a;--brand:var(--brand-d);--brand-ink:var(--ink-d);--brand-soft:var(--soft-d);--brand-text:var(--bt-d);--shadow:0 1px 2px rgba(0,0,0,.4),0 8px 24px rgba(0,0,0,.35)}}
html,body{background:var(--bg)!important;color:var(--ink)!important}
body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif!important;font-size:16px;line-height:1.45;padding-bottom:110px!important}
.muted{color:var(--mut)!important}
h1,h2,h3{color:var(--ink)!important;letter-spacing:-.01em}
h2{font-size:1.45rem;margin:.3em 0 .6em}h3{font-size:1.05rem}
form,.card,.product-card,dialog,.onboarding-panel,.onboarding-settings,.onboarding-choice{background:var(--card)!important;color:var(--ink)!important;border:1px solid var(--line)!important;border-radius:18px!important;box-shadow:var(--shadow)!important}
.onboarding-panel form,dialog form{background:transparent!important;border:0!important;box-shadow:none!important;padding:0!important;margin:0!important}
input,select,textarea{background:var(--bg2)!important;color:var(--ink)!important;border:1px solid var(--line)!important;border-radius:12px!important;padding:13px 14px!important;font-size:16px!important;min-height:46px}
input:focus,select:focus,textarea:focus{outline:2px solid var(--brand)!important;outline-offset:0;border-color:transparent!important}
input[type=color]{padding:4px!important}
label{color:var(--mut)!important;font-size:.85rem;font-weight:600}
main button:not(.secondary):not(.danger),dialog button:not(.secondary):not(.danger),#onboarding-root form button:not(.onboarding-link):not(.onboarding-back){background:var(--brand)!important;color:var(--brand-ink)!important;border:0!important;border-radius:12px!important;min-height:46px;font-weight:700;box-shadow:none!important}
main button.secondary,dialog button.secondary{background:var(--brand-soft)!important;color:var(--brand-text)!important;border:0!important;border-radius:12px!important;min-height:46px;font-weight:700;box-shadow:none!important}
main .tabs button.active{background:var(--brand)!important;color:var(--brand-ink)!important}
button{transition:transform .08s ease,opacity .2s}button:active{transform:scale(.97)}button:disabled{opacity:.5}
.danger{background:#d92d20!important;color:#fff!important;border:0!important}
.onboarding-link,.onboarding-back{background:none!important;color:var(--brand-text)!important;border:0!important;box-shadow:none!important;width:auto!important;min-height:0!important;padding:6px 0!important;font-weight:600}
.onboarding-choice{width:100%;text-align:left;padding:16px!important;margin-bottom:10px;display:flex;flex-direction:column;gap:4px;cursor:pointer}
.onboarding-choice span{color:var(--mut)!important}
.onboarding-code{background:var(--brand-soft)!important;color:var(--brand-text)!important;border-radius:12px;padding:12px;font-weight:800;letter-spacing:.1em;text-align:center;margin:8px 0}
.onboarding-error{color:#d92d20!important}
header.topline{position:sticky;top:0;z-index:5;background:var(--bg)!important;padding:12px 0 10px!important;margin:0!important}
header h1{font-size:1.25rem!important;margin:0!important;line-height:1.2}
header .muted{font-size:.8rem}
.brand-mark{width:44px;height:44px;border-radius:14px;background:var(--brand);color:var(--brand-ink);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.2rem;overflow:hidden;flex:none;border:1px solid var(--line)}
.brand-mark img{width:100%;height:100%;object-fit:contain;background:#fff}
.brand-mark.big{width:72px;height:72px;border-radius:20px;font-size:1.8rem}
.onboarding-brand-mark{display:flex;align-items:center;justify-content:center;margin:0 auto 10px}
#navigation{background:var(--card)!important;border-top:1px solid var(--line)!important;box-shadow:0 -6px 20px rgba(0,0,0,.06)!important}
#navigation button{background:transparent!important;color:var(--mut)!important;border:0!important;border-radius:12px!important;box-shadow:none!important}
#navigation button.active{background:var(--brand-soft)!important;color:var(--brand-text)!important}
.stats{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}
.stats .card{margin:0!important;padding:14px!important}
.stat strong{display:block;font-size:1.5rem;margin-top:4px}
.pcard .ph{background:var(--brand-soft)!important;color:var(--brand-text)!important}
main .sellbar{background:var(--brand)!important;color:var(--brand-ink)!important;border:0!important}
main .sellbar button:not(.secondary):not(.danger){background:var(--brand-ink)!important;color:var(--brand)!important}
.bar i{background:var(--brand)!important}
#navigation button{display:flex!important;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:8px 1px!important}
#navigation button span{font-size:11px;font-weight:600}
#navigation .nv{display:block;width:22px;height:22px}
#connection{background:var(--brand-soft)!important;color:var(--brand-text)!important;font-size:.78rem;font-weight:600;padding:5px 11px 5px 9px!important;border-radius:99px;display:inline-flex;align-items:center;gap:6px;flex:none}
#connection::before{content:"";width:8px;height:8px;border-radius:50%;background:#22c55e}
#connection.low::before{background:#f59e0b}
main #signout{background:transparent!important;color:var(--mut)!important;min-height:36px!important;padding:6px 12px!important}
#add-product-toggle{margin:4px 0 12px}
`;
  document.head.append(style);

  const isMono = rgb => rgb2hsl(...rgb)[1] < 0.18;
  const iconBg = () => isMono(parseHex(brand.color)) ? '#111827' : brand.color;
  function schemeColors(rgb, card) {
    const dark = lum(card) < 0.3; let bg, soft, text;
    if (isMono(rgb)) { bg = dark ? [241, 245, 249] : [17, 24, 39]; soft = dark ? 'rgba(241,245,249,.14)' : 'rgba(17,24,39,.08)'; text = toHex(bg); }
    else {
      bg = rgb.slice(); const [bh, bs] = rgb2hsl(...bg); let bl = rgb2hsl(...bg)[2];
      for (let i = 0; i < 30 && contrast(bg, card) < 3; i++) { bl += dark ? 0.03 : -0.03; if (bl > 0.9 || bl < 0.1) break; bg = hsl2rgb(bh, bs, bl); }
      soft = `rgba(${bg.map(Math.round).join(',')},${dark ? 0.2 : 0.14})`; text = textOn(bg, card);
    }
    return { bg: toHex(bg), ink: contrast(bg, [255, 255, 255]) >= 3 ? '#ffffff' : '#111111', soft, text };
  }
  function applyTheme() {
    const rgb = parseHex(brand.color), L = schemeColors(rgb, [255, 255, 255]), D = schemeColors(rgb, [21, 28, 43]), st = document.documentElement.style;
    st.setProperty('--brand-l', L.bg); st.setProperty('--ink-l', L.ink); st.setProperty('--soft-l', L.soft); st.setProperty('--bt-l', L.text);
    st.setProperty('--brand-d', D.bg); st.setProperty('--ink-d', D.ink); st.setProperty('--soft-d', D.soft); st.setProperty('--bt-d', D.text);
    let meta = $('meta[name=theme-color]'); if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.append(meta); }
    meta.content = L.bg;
  }

  const initial = () => (brand.name || 'S').trim().slice(0, 1).toUpperCase() || 'S';
  const sig = () => [brand.name, brand.logo ? brand.logo.length : 0, brand.color].join('|');
  function markHtml() { return brand.logo ? `<img alt="" src="${brand.logo}">` : initial(); }
  function applyDom() {
    document.title = brand.name || DEFAULT.name;
    const header = $('header.topline');
    if (header) {
      const h1 = $('h1', header); if (h1 && h1.textContent !== brand.name) h1.textContent = brand.name;
      let mark = $('#brand-logo');
      if (!mark) {
        const left = header.firstElementChild; const wrap = document.createElement('div');
        while (left.firstChild) wrap.append(left.firstChild);
        left.style.cssText = 'display:flex;align-items:center;gap:12px;min-width:0';
        mark = document.createElement('div'); mark.id = 'brand-logo'; mark.className = 'brand-mark'; left.append(mark, wrap);
      }
      if (mark.dataset.sig !== sig()) { mark.innerHTML = markHtml(); mark.dataset.sig = sig(); }
    }
    document.querySelectorAll('.onboarding-brand').forEach(el => {
      const h = $('h1', el), m = $('.onboarding-brand-mark', el);
      if (h && h.textContent !== brand.name) h.textContent = brand.name;
      if (m && m.dataset.sig !== sig()) { if (brand.logo || brand.name !== DEFAULT.name) m.innerHTML = `<span class="brand-mark big">${markHtml()}</span>`; m.dataset.sig = sig(); }
    });
    const prev = $('#be-preview'); if (prev && prev.dataset.sig !== sig()) { prev.innerHTML = markHtml(); prev.dataset.sig = sig(); }
  }

  // ---- Home-screen icon and install name ----------------------------------
  const loadImg = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
  function roundRect(x, px, py, w, h, r) { x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r); x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath(); }
  function drawIcon(size, img) {
    const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
    x.fillStyle = iconBg(); x.fillRect(0, 0, size, size);
    const pad = size * 0.16;
    if (img) { x.fillStyle = '#ffffff'; roundRect(x, pad * 0.75, pad * 0.75, size - pad * 1.5, size - pad * 1.5, size * 0.18); x.fill(); x.drawImage(img, pad, pad, size - pad * 2, size - pad * 2); }
    else { x.fillStyle = lum(parseHex(iconBg())) > 0.35 ? '#111' : '#fff'; x.font = `800 ${size * 0.55}px system-ui,sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(initial(), size / 2, size / 2 + size * 0.03); }
    return c.toDataURL('image/png');
  }
  function setLink(rel, href, type) {
    let l = $(`link[rel="${rel}"]`); if (!l) { l = document.createElement('link'); l.rel = rel; document.head.append(l); }
    l.href = href; if (type) l.type = type;
  }
  let manifestSig = '';
  async function applyManifest() {
    if (manifestSig === sig()) return; manifestSig = sig();
    try {
      const img = brand.logo ? await loadImg(brand.logo).catch(() => null) : null;
      const i192 = drawIcon(192, img), i512 = drawIcon(512, img), base = new URL('./', location.href).href;
      const m = { name: brand.name, short_name: (brand.name || 'Store').slice(0, 12), start_url: base, scope: base, display: 'standalone', background_color: '#ffffff', theme_color: iconBg(),
        icons: [{ src: i192, sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: i512, sizes: '512x512', type: 'image/png', purpose: 'any' }, { src: i512, sizes: '512x512', type: 'image/png', purpose: 'maskable' }] };
      const url = URL.createObjectURL(new Blob([JSON.stringify(m)], { type: 'application/manifest+json' }));
      let link = $('link[rel=manifest]'); if (!link) { link = document.createElement('link'); link.rel = 'manifest'; document.head.append(link); }
      if (link.dataset.blob) URL.revokeObjectURL(link.dataset.blob);
      link.href = url; link.dataset.blob = url;
      setLink('icon', i192, 'image/png'); setLink('apple-touch-icon', i192);
    } catch (e) { console.warn('Branding icon failed', e); }
  }
  function applyAll() { applyTheme(); applyDom(); applyManifest(); }

  // ---- Load the store's branding after sign-in ----------------------------
  async function loadBrand() {
    if (!client || loaded) return;
    const { data: { session } } = await client.auth.getSession(); if (!session) return;
    loaded = true;
    const { data, error } = await client.rpc('get_store_branding');
    if (!error && data) { brand = { name: data.name || DEFAULT.name, logo: data.logo_url || null, color: data.brand_color || DEFAULT.color }; store(brand); applyAll(); fillEditor(); }
    const p = await client.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
    role = p.data?.role || null; ready = true; mountEditor();
  }

  // ---- Settings card: install button (everyone) + branding editor (owner) --
  let draft = null;
  function mountEditor() {
    const view = $('#settings-view'); if (!view || $('#brand-editor', view) || !ready) return;
    const box = document.createElement('div'); box.id = 'brand-editor'; box.className = 'onboarding-settings'; box.style.marginBottom = '12px';
    const owner = role === 'owner';
    box.innerHTML = (owner ? `<h3>Store branding</h3><p class="muted">Your logo and name appear in the app and on the home-screen icon. The app color follows your logo.</p>
      <div style="display:flex;gap:14px;align-items:center;margin-bottom:8px"><div id="be-preview" class="brand-mark big"></div><div style="flex:1;display:grid;gap:8px"><button type="button" class="secondary" id="be-choose">Choose logo</button><button type="button" class="secondary" id="be-remove">Remove logo</button></div></div>
      <input id="be-file" type="file" accept="image/*" hidden>
      <label for="be-name">Store name</label><input id="be-name" maxlength="60">
      <label for="be-color">App color</label><div style="display:flex;gap:10px;align-items:center"><input id="be-color" type="color" style="width:72px;flex:none"><button type="button" class="secondary" id="be-auto" style="flex:1">Match my logo</button></div>
      <p class="muted small" id="be-hint"></p><button type="button" id="be-save">Save branding</button>` : '')
      + `<div id="be-install-box" style="margin-top:${owner ? 16 : 0}px"><h3>Install the app</h3><p class="muted small">Android: tap Install. iPhone: tap Share, then Add to Home Screen. Install after saving your branding so the icon and name match. If you installed earlier, remove the old icon and install again.</p><button type="button" id="be-install" class="hidden">Install app</button></div>`;
    const first = view.querySelector('h2'); first ? first.after(box) : view.prepend(box);
    if (owner) wireEditor();
    wireInstall(); fillEditor(); applyDom();
  }
  function fillEditor() {
    if (!$('#be-name')) return;
    draft = { name: brand.name, logo: brand.logo, color: brand.color };
    $('#be-name').value = draft.name; $('#be-color').value = draft.color;
  }
  function wireEditor() {
    $('#be-choose').onclick = () => $('#be-file').click();
    $('#be-name').oninput = e => { draft.name = e.target.value; brand = { ...brand, name: draft.name || DEFAULT.name }; applyDom(); };
    $('#be-color').oninput = e => { draft.color = e.target.value; brand = { ...brand, color: draft.color }; $('#be-hint').textContent = ''; applyTheme(); applyDom(); };
    $('#be-remove').onclick = () => { draft.logo = null; brand = { ...brand, logo: null }; applyDom(); $('#be-hint').textContent = 'Logo removed. Save to keep this.'; };
    $('#be-file').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const img = await loadImg(URL.createObjectURL(f));
        let out = null, canvas = null;
        for (const size of [256, 192, 128]) {
          canvas = document.createElement('canvas'); canvas.width = canvas.height = size; const x = canvas.getContext('2d');
          const s = Math.min(img.naturalWidth, img.naturalHeight), sx = (img.naturalWidth - s) / 2, sy = (img.naturalHeight - s) / 2;
          x.drawImage(img, sx, sy, s, s, 0, 0, size, size);
          out = canvas.toDataURL('image/png'); if (out.length > 200000) out = canvas.toDataURL('image/webp', 0.85);
          if (out.length <= 200000) break;
        }
        draft.logo = out; draft.color = dominantFromData(canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data);
        brand = { ...brand, logo: draft.logo, color: draft.color }; $('#be-color').value = draft.color;
        $('#be-hint').textContent = 'Color picked from your logo. Change it if you prefer, then Save.'; applyTheme(); applyDom();
      } catch (err) { toast('Could not read that image. Try a PNG or JPG.', true); }
      e.target.value = '';
    };
    $('#be-auto').onclick = async () => {
      if (!draft.logo) return toast('Add a logo first.', true);
      const img = await loadImg(draft.logo), c = document.createElement('canvas'); c.width = c.height = 128; c.getContext('2d').drawImage(img, 0, 0, 128, 128);
      draft.color = dominantFromData(c.getContext('2d').getImageData(0, 0, 128, 128).data); $('#be-color').value = draft.color;
      brand = { ...brand, color: draft.color }; $('#be-hint').textContent = 'Color picked from your logo.'; applyTheme(); applyDom();
    };
    $('#be-save').onclick = async () => {
      const b = $('#be-save'); b.disabled = true; b.textContent = 'Saving…';
      const { error } = await client.rpc('update_store_branding', { p_name: (draft.name || '').trim(), p_logo_url: draft.logo || null, p_brand_color: draft.color });
      b.disabled = false; b.textContent = 'Save branding';
      if (error) return toast(friendly(error), true);
      brand = { name: (draft.name || '').trim() || DEFAULT.name, logo: draft.logo || null, color: draft.color }; store(brand); applyAll();
      toast('Branding saved. Install the app again to update the home-screen icon.');
    };
  }
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; showInstall(); });
  function showInstall() { const b = $('#be-install'); if (b && deferredInstall) b.classList.remove('hidden'); }
  function wireInstall() {
    const b = $('#be-install'); if (!b) return;
    b.onclick = async () => { if (!deferredInstall) return; deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; b.classList.add('hidden'); };
    showInstall();
    if (window.matchMedia('(display-mode: standalone)').matches) $('#be-install-box')?.classList.add('hidden');
  }

  // ---- Bottom menu icons --------------------------------------------------
  const ICONS = {
    home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    products: '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
    orders: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 11.5a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.8L20 7H6"/>',
    customers: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c2 .6 3.3 2.3 3.7 5.2"/>',
    reports: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    more: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'
  };
  function decorateNav() {
    document.querySelectorAll('#navigation button').forEach(b => {
      if (b.dataset.deco) return;
      const key = b.dataset.view || (b.classList.contains('onboarding-nav-button') ? 'more' : ''); if (!ICONS[key]) return;
      const label = ((b.querySelector('span:last-child') || b).textContent || '').trim();
      b.innerHTML = `<svg class="nv" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[key]}</svg><span>${label}</span>`;
      b.dataset.deco = '1';
    });
  }

  // ---- Products: keep the add form tucked away until needed ---------------
  function mountProductToggle() {
    const form = $('#product-form'), title = $('#product-form-title'); if (!form || !title || $('#add-product-toggle')) return;
    const btn = document.createElement('button'); btn.type = 'button'; btn.id = 'add-product-toggle'; btn.style.width = '100%'; form.before(btn);
    let open = false;
    const sync = () => { const editing = title.textContent === 'Edit product'; form.classList.toggle('hidden', !(open || editing)); btn.classList.toggle('hidden', editing); btn.textContent = open ? '✕ Close form' : '＋ Add product'; };
    btn.onclick = () => { open = !open; sync(); if (open) form.scrollIntoView({ behavior: 'smooth' }); };
    form.addEventListener('reset', () => { open = false; setTimeout(sync, 0); });
    new MutationObserver(sync).observe(title, { childList: true, characterData: true, subtree: true });
    sync();
  }

  // ---- Keep everything in sync as the app re-renders ----------------------
  let queued = false;
  const tick = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; applyDom(); decorateNav(); mountProductToggle(); const app = $('#app'); if (app && !app.classList.contains('hidden')) { if (!loaded) loadBrand(); mountEditor(); } }); };
  new MutationObserver(tick).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  applyAll(); tick();
})();
