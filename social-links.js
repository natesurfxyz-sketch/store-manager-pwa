(() => {
  'use strict';

  const FORM_FIELDS = [
    ['whatsapp', 'WhatsApp'],
    ['facebook', 'Facebook'],
    ['instagram', 'Instagram'],
    ['tiktok', 'TikTok'],
    ['website', 'Website']
  ];
  const icons = { whatsapp: '◉', facebook: 'f', instagram: '◎', tiktok: '♪', website: '↗' };
  let socialForSave = {};
  let activeCustomerId = null;

  function cleanLink(key, value) {
    const input = String(value || '').trim();
    if (!input) return '';
    if (key === 'whatsapp' && !/^https?:\/\//i.test(input)) {
      const number = input.replace(/\D/g, '');
      return number ? `https://wa.me/${number}` : '';
    }
    const withScheme = /^https?:\/\//i.test(input) ? input : `https://${input}`;
    try {
      const parsed = new URL(withScheme);
      return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
    } catch (_) {
      return '';
    }
  }

  function readFormLinks() {
    const links = {};
    for (const [key] of FORM_FIELDS) {
      const value = cleanLink(key, document.querySelector(`#social-${key}`)?.value);
      if (value) links[key] = value;
    }
    return links;
  }

  function addFields() {
    const form = document.querySelector('#customer-form');
    if (!form || form.dataset.socialLinksReady) return;
    form.dataset.socialLinksReady = 'true';
    const group = document.createElement('fieldset');
    group.className = 'customer-social-fields';
    const legend = document.createElement('legend');
    legend.textContent = 'Social links (optional)';
    group.append(legend);
    for (const [key, label] of FORM_FIELDS) {
      const wrapper = document.createElement('div');
      const inputLabel = document.createElement('label');
      inputLabel.htmlFor = `social-${key}`;
      inputLabel.textContent = label;
      const input = document.createElement('input');
      input.id = `social-${key}`;
      input.type = 'text';
      input.autocomplete = 'url';
      input.placeholder = key === 'whatsapp' ? 'Phone number or link' : 'https://…';
      wrapper.append(inputLabel, input);
      group.append(wrapper);
    }
    const submit = form.querySelector('button[type="submit"]');
    form.insertBefore(group, submit || null);

    form.addEventListener('submit', () => {
      socialForSave = readFormLinks();
      window.__customerSocialForSave = socialForSave;
      window.__customerSocialEditId = form.querySelector('#c-id')?.value || '';
    }, true);

    const dialog = document.querySelector('#customer-dialog');
    if (dialog) {
      new MutationObserver(() => {
        if (!dialog.open) return;
        const id = form.querySelector('#c-id')?.value || '';
        if (!id) {
          group.querySelectorAll('input').forEach(input => { input.value = ''; });
          return;
        }
        loadCustomer(id).then(customer => {
          if (!customer || !dialog.open || form.querySelector('#c-id')?.value !== id) return;
          for (const [key] of FORM_FIELDS) {
            const value = cleanLink(key, customer.social_links?.[key]);
            const input = document.querySelector(`#social-${key}`);
            if (input) input.value = value;
          }
        });
      }).observe(dialog, { attributes: true, attributeFilter: ['open'] });
    }
  }

  function patchPersistence() {
    const nativeFetch = window.fetch;
    window.fetch = function(input, init) {
      const url = typeof input === 'string' ? input : input?.url || '';
      const options = init || {};
      if (/\/rest\/v1\/customers(?:\?|$)/.test(url) && options.body && socialForSave) {
        try {
          const parsed = JSON.parse(options.body);
          const merge = row => row && typeof row === 'object' ? { ...row, social_links: { ...(row.social_links || {}), ...socialForSave } } : row;
          options.body = JSON.stringify(Array.isArray(parsed) ? parsed.map(merge) : merge(parsed));
        } catch (_) { /* Leave non-JSON requests untouched. */ }
      }
      return nativeFetch.call(this, input, options);
    };

    const nativePut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(value, ...args) {
      if (this.name === 'queue' && value?.table === 'customers' && value.row && socialForSave) {
        value = { ...value, row: { ...value.row, social_links: { ...(value.row.social_links || {}), ...socialForSave } } };
      } else if (this.name === 'cache' && value?.key === 'customers' && Array.isArray(value.value) && socialForSave) {
        const editId = window.__customerSocialEditId;
        const target = value.value.find(customer => editId ? customer.id === editId : customer.phone === document.querySelector('#c-phone')?.value.trim());
        if (target) target.social_links = { ...(target.social_links || {}), ...socialForSave };
      }
      return nativePut.call(this, value, ...args);
    };
  }

  function openAppDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('store-manager-offline-v2', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function loadCustomer(id) {
    try {
      const db = await openAppDb();
      return await new Promise((resolve, reject) => {
        const request = db.transaction('cache').objectStore('cache').get('customers');
        request.onsuccess = () => resolve((request.result?.value || []).find(customer => customer.id === id) || null);
        request.onerror = () => reject(request.error);
      });
    } catch (_) { return null; }
  }

  function safeLink(value) {
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch (_) { return ''; }
  }

  function addContactActions(phoneParagraph, customer, links) {
    const phone = String(customer.phone || '').trim();
    const number = phone.replace(/\D/g, '');
    const actions = document.createElement('span');
    actions.className = 'customer-contact-actions';
    if (phone) {
      const call = document.createElement('a');
      call.className = 'customer-social-button';
      call.href = `tel:${phone.replace(/[^\d+]/g, '')}`;
      call.textContent = 'Call';
      actions.append(call);
    }
    const whatsapp = document.createElement('a');
    whatsapp.className = 'customer-social-button';
    whatsapp.href = safeLink(links.whatsapp) || (number ? `https://wa.me/${number}` : '');
    whatsapp.textContent = 'WhatsApp';
    if (whatsapp.href) { whatsapp.target = '_blank'; whatsapp.rel = 'noopener noreferrer'; actions.append(whatsapp); }
    if (actions.childElementCount) phoneParagraph.append(' ', actions);
  }

  async function renderCustomerLinks(id) {
    if (!id) return;
    const customer = await loadCustomer(id);
    const detail = document.querySelector('#customer-detail');
    if (!customer || !detail || detail.dataset.socialLinksCustomer === id) return;
    detail.dataset.socialLinksCustomer = id;
    const card = detail.querySelector('.card');
    if (!card) return;
    const links = customer.social_links || {};
    const phoneParagraph = [...card.querySelectorAll('p')].find(paragraph => paragraph.textContent.trim().startsWith('Phone:'));
    if (phoneParagraph) addContactActions(phoneParagraph, customer, links);
    const socialRow = document.createElement('div');
    socialRow.className = 'customer-social-buttons';
    for (const [key, label] of FORM_FIELDS) {
      const href = safeLink(links[key]);
      if (!href) continue;
      const anchor = document.createElement('a');
      anchor.className = 'customer-social-button customer-social-icon';
      anchor.href = href;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.setAttribute('aria-label', label);
      anchor.title = label;
      anchor.textContent = icons[key];
      socialRow.append(anchor);
    }
    if (socialRow.childElementCount) card.append(socialRow);
  }

  function watchProfile() {
    const list = document.querySelector('#customer-list');
    list?.addEventListener('click', event => {
      const button = event.target.closest('[data-id]');
      if (button) activeCustomerId = button.dataset.id;
    }, true);
    const detail = document.querySelector('#customer-detail');
    if (detail) new MutationObserver(() => {
      if (activeCustomerId) renderCustomerLinks(activeCustomerId);
    }).observe(detail, { childList: true, subtree: true });
  }

  function addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .customer-social-fields{border:0;border-top:1px solid #e3e8ef;padding:12px 0 0;margin:12px 0 0;display:grid;grid-template-columns:1fr 1fr;gap:0 10px}
      .customer-social-fields legend{font-weight:600;padding:0 6px 0 0}.customer-social-fields input{margin-bottom:4px}
      .customer-social-buttons,.customer-contact-actions{display:inline-flex;flex-wrap:wrap;gap:8px;margin:8px 0}
      .customer-social-button{display:inline-flex;align-items:center;justify-content:center;min-width:36px;min-height:36px;padding:7px 10px;border-radius:9px;background:#e8eef6;color:#183153;text-decoration:none;font-weight:700}
      .customer-social-icon{font-size:1.15rem}
    `;
    document.head.append(style);
  }

  function init() {
    addStyles();
    addFields();
    patchPersistence();
    watchProfile();
    new MutationObserver(addFields).observe(document.body, { childList: true, subtree: true });
  }

  init();
})();
