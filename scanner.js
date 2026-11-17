/* Reliable barcode / QR scanner. Takes over every ".scan-button" in the app. */
(() => {
  const LIB = 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js';
  let scanner = null, loading = null, overlay = null;
  const $ = s => document.querySelector(s);

  function toast(text) {
    const t = document.createElement('div');
    t.textContent = text;
    t.style.cssText = 'position:fixed;left:50%;bottom:96px;transform:translateX(-50%);max-width:90%;background:#183153;color:#fff;padding:12px 18px;border-radius:12px;font:600 15px system-ui;z-index:10000;box-shadow:0 6px 20px #0005';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }

  function loadLib() {
    if (window.Html5Qrcode) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise((ok, no) => {
      const s = document.createElement('script');
      s.src = LIB;
      s.onload = ok;
      s.onerror = () => { loading = null; no(new Error('Could not load the scanner. Check your internet and try again.')); };
      document.head.appendChild(s);
    });
    return loading;
  }

  function build() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#000;display:none;flex-direction:column';
    overlay.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;color:#fff;font:600 17px system-ui"><span>Scan barcode / QR</span><button id="scan-close" type="button" style="width:auto;margin:0;padding:10px 18px;border:0;border-radius:10px;background:#fff;color:#111;font:600 15px system-ui">Close</button></div>' +
      '<div id="scan-reader" style="flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden"></div>' +
      '<p id="scan-msg" style="color:#fff;text-align:center;padding:12px 16px 28px;margin:0;font:15px/1.4 system-ui">Starting camera…</p>';
    document.body.appendChild(overlay);
    overlay.querySelector('#scan-close').onclick = close;
    return overlay;
  }

  async function close() {
    if (scanner) {
      try { await scanner.stop(); } catch (e) {}
      try { scanner.clear(); } catch (e) {}
      scanner = null;
    }
    if (overlay) overlay.style.display = 'none';
  }

  function apply(target, code) {
    const el = target && $('#' + target);
    if (!el) return;
    el.value = code;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    if (target === 'order-search') {
      const b = document.querySelectorAll('#order-products [data-add]');
      if (b.length === 1 && !b[0].disabled) b[0].click();
    }
    toast('Scanned: ' + code);
  }

  async function open(target) {
    build();
    overlay.style.display = 'flex';
    const msg = $('#scan-overlay-msg') || overlay.querySelector('#scan-msg');
    msg.textContent = 'Starting camera…';
    try {
      await loadLib();
      const F = Html5QrcodeSupportedFormats;
      scanner = new Html5Qrcode('scan-reader', {
        formatsToSupport: [F.QR_CODE, F.EAN_13, F.EAN_8, F.CODE_128, F.CODE_39, F.UPC_A, F.UPC_E, F.ITF, F.DATA_MATRIX],
        useBarCodeDetectorIfSupported: true,
        verbose: false
      });
      let done = false;
      const onOk = async text => {
        if (done) return;
        done = true;
        if (navigator.vibrate) navigator.vibrate(80);
        await close();
        apply(target, text);
      };
      const box = (vw, vh) => {
        const w = Math.floor(vw * 0.86);
        return { width: w, height: Math.floor(Math.min(vh * 0.6, w * 0.6)) };
      };
      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 12, qrbox: box, videoConstraints: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } },
          onOk, () => {}
        );
      } catch (e1) {
        await scanner.start({ facingMode: 'environment' }, { fps: 12, qrbox: box }, onOk, () => {});
      }
      msg.textContent = 'Hold the code steady, 10-20 cm away, in good light. Keep barcodes horizontal.';
    } catch (e) {
      msg.textContent = 'Camera scan failed: ' + (e && e.message ? e.message : e) + ' Allow camera permission and try again.';
    }
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('.scan-button');
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    open(b.dataset.target);
  }, true);
})();
