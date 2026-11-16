const CACHE_NAME = "store-manager-v4";
const APP_FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg"];

// UI-only enhancement layer. Keeping the app's original HTML and business logic
// untouched means Supabase settings, sync, roles and existing workflows survive.
const UI_CSS = `
:root{color-scheme:light dark;--navy:#183153;--accent:#e98332;--bg:#f4f6f9;--surface:#fff;--text:#172033;--muted:#697586;--line:#e4e9f0;--shadow:0 6px 22px rgba(24,49,83,.08);--success:#17834b;--warning:#a96500;--danger:#b42318;--safe-bottom:env(safe-area-inset-bottom,0px);--safe-top:env(safe-area-inset-top,0px)}
@media(prefers-color-scheme:dark){:root{--bg:#101820;--surface:#19232e;--text:#edf2f7;--muted:#a9b5c3;--line:#30404f;--shadow:0 7px 24px rgba(0,0,0,.24);--success:#55c98a;--warning:#ffc15c;--danger:#ff8b82}}
*{box-sizing:border-box}html{background:var(--bg)}body{max-width:760px;padding:calc(76px + var(--safe-top)) 16px calc(92px + var(--safe-bottom));margin:0 auto;background:var(--bg);color:var(--text);font:16px/1.5 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}h1,h2,h3{color:var(--text);line-height:1.2}h1{font-size:21px;margin:0}h2{font-size:22px;margin:8px 0 16px}h3{font-size:17px}.muted{color:var(--muted)!important}header.topline{position:fixed;z-index:20;top:0;left:50%;transform:translateX(-50%);width:min(100%,760px);height:calc(64px + var(--safe-top));padding:var(--safe-top) 16px 8px;background:var(--surface);border-bottom:1px solid var(--line);box-shadow:0 2px 10px rgba(24,49,83,.05);align-items:center}header.topline>div:first-child>div{display:none}.badge{display:inline-flex;align-items:center;gap:7px;background:#e8f6ee;color:var(--success);border-radius:999px;padding:5px 10px;font-size:12px;font-weight:700;white-space:nowrap}.badge:before{content:"";width:8px;height:8px;border-radius:50%;background:currentColor}.badge.low{background:#fff3df;color:var(--warning)}.badge.out{background:#ffebe9;color:var(--danger)}
input,select,textarea,button{font:inherit;font-size:16px;min-height:44px;border-radius:12px;border:1px solid var(--line);background:var(--surface);color:var(--text)}input,select,textarea{padding:11px 13px}button{padding:9px 14px;background:var(--navy);color:#fff;border:0;font-weight:650;transition:transform .12s,filter .12s}button:active{transform:scale(.98)}button.secondary{background:var(--surface);color:var(--navy);border:1px solid var(--line)}@media(prefers-color-scheme:dark){button.secondary{color:#dbe8f7}}button:disabled{opacity:.5}.hidden{display:none!important}.card,.product-card,form{background:var(--surface);color:var(--text);border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow);padding:15px;margin:11px 0}.view{padding-top:8px}.view>h2{margin-top:5px}.grid{gap:12px}.inline{gap:8px}.product-card{position:relative;padding:12px}.product-card img.photo{width:58px;height:58px;object-fit:cover;float:left;margin:0 12px 8px 0;border-radius:12px}.product-card:after{content:"";display:block;clear:both}.product-card h3{margin:2px 0 5px}.product-card p{margin:7px 0}.product-card .qr{clear:both}.product-card .row{clear:both}.purchase{border-color:var(--line)}
/* Bottom navigation */
.nav{z-index:30;position:fixed;left:50%;transform:translateX(-50%);bottom:0;width:min(100%,760px);padding:6px 8px calc(6px + var(--safe-bottom));background:var(--surface);border-top:1px solid var(--line);box-shadow:0 -6px 20px rgba(24,49,83,.08);gap:2px}.nav button{flex:1;max-width:none;min-height:54px;margin:0;padding:5px 2px;background:transparent;color:var(--muted);font-size:11px;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:1px;border-radius:12px}.nav button.active{background:color-mix(in srgb,var(--accent) 12%,var(--surface));color:var(--navy)}@media(prefers-color-scheme:dark){.nav button.active{color:#ffd2ae}}.nav-icon{font-size:19px;line-height:1}
/* Dashboard summary */
#home-summary{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:0;border:0;background:transparent;box-shadow:none}.summary-tile{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:14px;box-shadow:var(--shadow);min-height:84px}.summary-tile strong{display:block;font-size:20px;margin-top:5px;color:var(--navy)}@media(prefers-color-scheme:dark){.summary-tile strong{color:#ffd2ae}}#low-stock>.card,#recent-orders>.card{padding:12px 14px;margin:7px 0;box-shadow:none;display:flex;justify-content:space-between;align-items:center}
/* Product filters and create/edit sheet */
#product-filters{display:flex;gap:8px;overflow:auto;padding:2px 0 8px}.filter-chip{width:auto;white-space:nowrap;margin:0;border-radius:999px;min-height:38px;padding:7px 14px}.filter-chip.selected{background:var(--navy);color:white}.product-fab{position:fixed;z-index:24;right:max(18px,calc((100vw - 720px)/2));bottom:calc(82px + var(--safe-bottom));width:58px;height:58px;border-radius:50%;font-size:30px;box-shadow:0 8px 22px rgba(24,49,83,.3);padding:0}.product-sheet{position:fixed;inset:0;z-index:50;width:100%;height:100%;max-width:none;max-height:none;margin:0;padding:0;border:0;border-radius:0;background:transparent}.product-sheet[open]{display:flex;align-items:flex-end}.product-sheet::backdrop{background:rgba(10,20,34,.5)}.sheet-inner{width:min(100%,760px);max-height:94dvh;overflow:auto;margin:0 auto;background:var(--bg);border-radius:18px 18px 0 0;padding:18px 16px calc(24px + var(--safe-bottom));box-shadow:var(--shadow)}.sheet-handle{width:42px;height:5px;background:var(--line);border-radius:5px;margin:0 auto 12px}.sheet-inner form{margin:0;box-shadow:none;max-height:none;overflow:visible}.sheet-head{display:flex;justify-content:space-between;align-items:center}.sheet-close{width:44px;padding:6px;background:transparent;color:var(--muted);font-size:22px}
/* Sale cart stays accessible above the bottom navigation */
#orders-view{padding-bottom:210px}#orders-view>.card:last-of-type{position:fixed;z-index:18;bottom:calc(62px + var(--safe-bottom));left:50%;transform:translateX(-50%);width:min(calc(100% - 24px),736px);margin:0;padding:12px 16px;background:var(--surface);box-shadow:0 -5px 24px rgba(24,49,83,.12)}#cart-list .card{padding:10px;margin:7px 0;box-shadow:none}#cart-list [data-delta]{width:44px;min-width:44px;padding:4px;font-size:20px}#order-products>.card{padding:11px;margin:7px 0;box-shadow:none}.stock-warning{display:block;color:var(--danger);font-weight:700;font-size:13px}
/* Customer segmented control and rows */
.tabs{padding:4px;background:var(--line);border-radius:14px}.tabs button{margin:0;min-height:40px;border-radius:11px;background:transparent;color:var(--muted);box-shadow:none}.tabs button.active{background:var(--surface);color:var(--navy);box-shadow:0 2px 7px rgba(24,49,83,.1)}#customer-list>.card{min-height:72px;margin:8px 0;padding:10px 12px;box-shadow:none}.customer-avatar{width:44px;height:44px;flex:0 0 44px;border-radius:50%;background:color-mix(in srgb,var(--accent) 20%,var(--surface));color:var(--navy);display:grid;place-items:center;font-weight:800}.customer-row{display:flex;align-items:center;gap:12px;flex:1}.customer-meta{min-width:0}.customer-meta strong,.customer-meta span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.customer-meta span{color:var(--muted);font-size:13px}.contact-actions{display:flex;gap:8px}.contact-actions a{display:grid;place-items:center;min-width:44px;min-height:44px;border-radius:12px;background:var(--line);color:var(--navy);text-decoration:none;font-size:20px}
/* Accessible dialogs, menu, loading and toast */
dialog{background:var(--surface);color:var(--text);border-radius:18px;border:1px solid var(--line);box-shadow:var(--shadow);padding:18px;max-height:92dvh;overflow:auto}dialog::backdrop{background:rgba(10,20,34,.52)}#menu-dialog{width:min(92%,360px)}#toast-region{position:fixed;z-index:100;left:50%;transform:translateX(-50%);bottom:calc(78px + var(--safe-bottom));width:min(calc(100% - 32px),440px);display:grid;gap:8px;pointer-events:none}.toast{background:#183153;color:white;border-radius:12px;padding:12px 16px;box-shadow:var(--shadow);animation:toast-in .18s ease-out}.toast.error{background:#a62b25}@keyframes toast-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}.loading-spinner{width:22px;height:22px;border:3px solid var(--line);border-top-color:var(--accent);border-radius:50%;animation:spin .7s linear infinite;display:inline-block;vertical-align:middle}@keyframes spin{to{transform:rotate(360deg)}}.empty-state{text-align:center;padding:26px 16px;color:var(--muted);background:var(--surface);border:1px dashed var(--line);border-radius:16px}.more-trigger{font-size:11px!important}
@media(max-width:420px){body{padding-left:12px;padding-right:12px}.grid{gap:8px}.product-card .row{gap:5px}.product-card .row button{padding:8px 5px;font-size:13px}.sheet-inner{padding-left:13px;padding-right:13px}}
`;

const UI_JS = `
(() => {
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const toastRegion=document.createElement('div');toastRegion.id='toast-region';document.body.append(toastRegion);
  const originalAlert=window.alert;window.alert=(message)=>{const item=document.createElement('div');item.className='toast';item.textContent=String(message);toastRegion.append(item);setTimeout(()=>item.remove(),3200)};
  const header=document.querySelector('header.topline');
  const signout=document.querySelector('#signout');
  const menu=document.createElement('dialog');menu.id='menu-dialog';menu.innerHTML='<h2>More</h2><p class="muted">Store and account</p><button id="menu-signout">Sign out</button><button class="secondary" id="menu-close">Close</button>';document.body.append(menu);
  const more=document.createElement('button');more.className='more-trigger';more.dataset.more='true';more.innerHTML='<span class="nav-icon">☰</span><span>More</span>';
  const nav=document.querySelector('#navigation');
  if(nav){const current=[...nav.querySelectorAll('button')];const icons=['⌂','▦','＋','♙'];const labels=['Home','Products','Sell','Customers'];current.forEach((b,i)=>{b.innerHTML='<span class="nav-icon">'+icons[i]+'</span><span>'+labels[i]+'</span>';});more.onclick=()=>menu.showModal();nav.append(more);}
  if(signout){$('#menu-signout').onclick=()=>{menu.close();signout.click()};}$('#menu-close').onclick=()=>menu.close();
  // Product editor becomes a full-height bottom sheet while keeping original form handlers.
  const productForm=$('#product-form');let sheet=null;
  if(productForm){sheet=document.createElement('dialog');sheet.id='product-sheet';sheet.className='product-sheet';sheet.innerHTML='<div class="sheet-inner"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">Add product</h2><button class="sheet-close" type="button" aria-label="Close">×</button></div></div>';sheet.querySelector('.sheet-inner').append(productForm);document.body.append(sheet);sheet.querySelector('.sheet-close').onclick=()=>sheet.close();sheet.addEventListener('click',e=>{if(e.target===sheet)sheet.close()});
    const fab=document.createElement('button');fab.className='product-fab';fab.type='button';fab.setAttribute('aria-label','Add product');fab.textContent='+';document.body.append(fab);fab.onclick=()=>{productForm.reset();$('#edit-id').value='';$('#p-qty').value='0';$('#p-reorder').value='5';$('#product-form-title').textContent='Add product';$('#product-submit').textContent='Save product';$('#product-cancel').classList.add('hidden');$('#sheet-title').textContent='Add product';sheet.showModal()};
    $('#product-cancel')?.addEventListener('click',()=>sheet.close());
    const title=$('#product-form-title');new MutationObserver(()=>{const editing=title.textContent.toLowerCase().includes('edit');$('#sheet-title').textContent=editing?'Edit product':'Add product';if(editing&&!sheet.open)sheet.showModal();if(!editing&&sheet.open)sheet.close()}).observe(title,{childList:true,subtree:true,characterData:true});
    const productView=$('#products-view');const filters=document.createElement('div');filters.id='product-filters';filters.innerHTML=['All','Low stock','Out of stock'].map((x,i)=>'<button type="button" class="filter-chip '+(!i?'selected':'')+'" data-filter="'+x.toLowerCase()+'">'+x+'</button>').join('');productView.insertBefore(filters,$('#product-list'));
    filters.onclick=e=>{const b=e.target.closest('[data-filter]');if(!b)return;filters.querySelectorAll('button').forEach(x=>x.classList.toggle('selected',x===b));$('#product-list').dataset.filter=b.dataset.filter;filterProducts()};
    $('#product-search')?.addEventListener('input',filterProducts);function filterProducts(){const f=$('#product-list').dataset.filter||'all';$('#product-list').querySelectorAll('.product-card').forEach(card=>{const badge=card.querySelector('.badge');const out=badge?.classList.contains('out'),low=badge?.classList.contains('low');card.classList.toggle('hidden',f==='out of stock'?!out:f==='low stock'?!(low&&!out):false)})}
    new MutationObserver(filterProducts).observe($('#product-list'),{childList:true,subtree:true});
  }
  // Move account action into the More menu, but retain the existing sign-out handler.
  if(signout){signout.classList.add('hidden');}
  // Dashboard: turn existing live summary values into four at-a-glance cards.
  const summary=$('#home-summary');if(summary){const observer=new MutationObserver(()=>{const text=summary.textContent||'';const sales=(text.match(/Sales:\s*([\d.,]+)/i)||[])[1]||'0.00';const orders=(text.match(/orders:\s*(\d+)/i)||[])[1]||'0';const products=(text.match(/Products:\s*(\d+)/i)||[])[1]||'0';const low=$$('#low-stock .card').length;const items=$$('#recent-orders .card').length;summary.innerHTML='<div class="summary-tile">Today’s sales<strong>'+sales+'</strong></div><div class="summary-tile">Orders<strong>'+orders+'</strong></div><div class="summary-tile">Items sold<strong>'+items+'</strong></div><div class="summary-tile">Low stock<strong>'+low+'</strong></div>';});observer.observe(summary,{childList:true,subtree:true,characterData:true});setTimeout(()=>observer.disconnect(),3000)}
  // Customer list rows gain initials; profile actions use the existing phone value.
  function decorateCustomers(){document.querySelectorAll('#customer-list>.card').forEach(card=>{if(card.dataset.decorated)return;const button=card.querySelector('.customer-open');const title=card.querySelector('strong');if(!title||!button)return;card.dataset.decorated='1';const detail=card.querySelector('div');const name=title.textContent.trim();const info=detail?.textContent.trim()||'';const initials=name.split(/\\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();const row=document.createElement('div');row.className='customer-row';row.innerHTML='<div class="customer-avatar">'+initials+'</div><div class="customer-meta"><strong>'+name+'</strong><span>'+info+'</span></div>';card.innerHTML='';card.append(row,button);});}
  const customerList=$('#customer-list');if(customerList)new MutationObserver(decorateCustomers).observe(customerList,{childList:true,subtree:true});
  const customerDetail=$('#customer-detail');if(customerDetail)new MutationObserver(()=>{if(customerDetail.dataset.contactDecorated)return;const phoneText=[...customerDetail.querySelectorAll('p')].find(p=>/Phone:/i.test(p.textContent));if(!phoneText)return;const number=(phoneText.textContent.match(/\\+?[0-9][0-9 ()-]{6,}/)||[])[0];if(!number)return;customerDetail.dataset.contactDecorated='1';const compact=number.replace(/[^0-9+]/g,'');const actions=document.createElement('div');actions.className='contact-actions';actions.innerHTML='<a href="tel:'+compact+'" aria-label="Call customer">☎</a><a href="https://wa.me/'+compact.replace(/^\\+/,'')+'" target="_blank" rel="noopener" aria-label="Message on WhatsApp">◉</a>';phoneText.after(actions)}).observe(customerDetail,{childList:true,subtree:true});
  // Friendly empty-state copy for existing feature lists.
  function emptyHints(){const pairs=[['#product-list','No products yet. Tap + to add one.'],['#customer-list','No customers here yet. Tap Add to create a profile.'],['#orders-list','No orders yet. Create an order from Sell.'],['#low-stock','No low-stock products. You’re all set.']];for(const [sel,msg]of pairs){const el=$(sel);if(el&&!el.children.length)el.innerHTML='<div class="empty-state">'+msg+'</div>';}}
  setTimeout(emptyHints,800);
  // Keep the cart and navigation usable on small screens; show loading feedback on first data load.
  const app=$('#app');if(app){const spinner=document.createElement('div');spinner.id='loading-indicator';spinner.className='empty-state';spinner.innerHTML='<span class="loading-spinner" aria-label="Loading"></span> Loading your store…';const home=$('#home-view');if(home)home.prepend(spinner);setTimeout(()=>spinner.remove(),1800)}
  const conn=$('#connection');if(conn){const mo=new MutationObserver(()=>{conn.setAttribute('aria-label',conn.textContent);});mo.observe(conn,{childList:true,characterData:true,subtree:true})}
})();
`;

function inject(source, code, id) {
  if (source.includes(id)) return source;
  const style = `<style id="store-manager-ui">${code}</style>`;
  return source.replace("</head>", `${style}</head>`).replace("</body>", `<script id="store-manager-ui-script">${UI_JS}<\/script></body>`);
}

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith("store-manager-") && key !== CACHE_NAME)
    .map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const isDocument = event.request.mode === "navigate" || url.pathname.endsWith("/index.html") || url.pathname.endsWith("/");
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    try {
      const response = cached || await fetch(event.request);
      if (!response.ok) return response;
      if (isDocument) {
        const source = await response.text();
        return new Response(inject(source, UI_CSS, "store-manager-ui"), {
          status: response.status,
          statusText: response.statusText,
          headers: new Headers({"Content-Type":"text/html; charset=utf-8", "Cache-Control":"no-cache"})
        });
      }
      if (!cached) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      }
      return response;
    } catch (error) {
      if (cached && isDocument) {
        const source = await cached.text();
        return new Response(inject(source, UI_CSS, "store-manager-ui"), {headers:{"Content-Type":"text/html; charset=utf-8"}});
      }
      if (isDocument) {
        const fallback = await caches.match("./index.html");
        if (fallback) return new Response(inject(await fallback.text(), UI_CSS, "store-manager-ui"), {headers:{"Content-Type":"text/html; charset=utf-8"}});
      }
      throw error;
    }
  })());
});
