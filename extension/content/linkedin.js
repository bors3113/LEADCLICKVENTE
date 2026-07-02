// LinkedIn Copilot content script.
//
// Reads what is already visible on the profile page the user is viewing,
// shows a Shadow-DOM panel to generate an AI outreach draft, and inserts the
// draft into LinkedIn's message composer. It never clicks Message or Send —
// the user always reviews and sends the message themselves.

(() => {
  const PANEL_HOST_ID = 'lcv-copilot-host';

  // ---------------------------------------------------------------------
  // Profile extraction. LinkedIn's DOM changes often, so each field tries a
  // stack of sources (JSON-LD -> meta tags -> CSS selectors -> title) and the
  // panel renders every field as an editable input — the user is the final
  // source of truth, broken selectors just mean an empty field.
  // ---------------------------------------------------------------------

  function text(el) {
    return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
  }

  function firstMatch(selectors, root = document) {
    for (const sel of selectors) {
      try {
        const t = text(root.querySelector(sel));
        if (t) return t;
      } catch { /* invalid selector on this DOM version — try the next */ }
    }
    return '';
  }

  function jsonLdPerson() {
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const data = JSON.parse(script.textContent);
        const nodes = Array.isArray(data['@graph']) ? data['@graph'] : [data];
        const person = nodes.find((n) => n && n['@type'] === 'Person');
        if (person) return person;
      } catch { /* not JSON or not the shape we want */ }
    }
    return null;
  }

  function extractProfile() {
    const person = jsonLdPerson() || {};
    const ogTitle = document.querySelector('meta[property="og:title"]');

    const name =
      String(person.name || '').trim() ||
      firstMatch(['main h1', 'h1']) ||
      (ogTitle ? ogTitle.content.split(/[|\-–]/)[0].trim() : '') ||
      document.title.split(/[|\-–]/)[0].trim();

    const headline =
      String(person.jobTitle && (Array.isArray(person.jobTitle) ? person.jobTitle[0] : person.jobTitle) || '').trim() ||
      firstMatch([
        'main .text-body-medium.break-words',
        '[data-generated-suggestion-target]',
      ]);

    const worksFor = person.worksFor;
    const company =
      String((Array.isArray(worksFor) ? worksFor[0] && worksFor[0].name : worksFor && worksFor.name) || '').trim() ||
      firstMatch([
        'main [aria-label*="Current company"]',
        'button[aria-label^="Current company"]',
      ]);

    const address = person.address;
    const location =
      String((address && (address.addressLocality || address.name)) || '').trim() ||
      firstMatch(['main .text-body-small.inline.t-black--light.break-words']);

    let about = '';
    const aboutAnchor = document.querySelector('#about');
    if (aboutAnchor) {
      const section = aboutAnchor.closest('section');
      about = firstMatch(['.inline-show-more-text', '[class*="line-clamp"]'], section || document);
    }
    about = about || String(person.description || '').trim();

    return {
      name,
      headline,
      company,
      location,
      about: about.slice(0, 2000),
    };
  }

  // ---------------------------------------------------------------------
  // Insert into LinkedIn's message composer (Quill-like contenteditable).
  // execCommand('insertText') is still the only reliable way to make the
  // editor register the text so the Send button enables.
  // ---------------------------------------------------------------------

  function findComposer() {
    return document.querySelector('div.msg-form__contenteditable[contenteditable="true"]');
  }

  function insertIntoComposer(textValue) {
    const composer = findComposer();
    if (!composer) return false;
    composer.focus();
    // Replace any existing draft content.
    document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, textValue);
    composer.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  // ---------------------------------------------------------------------
  // Panel UI (Shadow DOM so LinkedIn's CSS can't bleed in).
  // ---------------------------------------------------------------------

  const PANEL_CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: -apple-system, "Segoe UI", Roboto, sans-serif; }
    .fab {
      position: fixed; bottom: 24px; right: 24px; z-index: 2147483646;
      background: #2563eb; color: #fff; border: none; border-radius: 24px;
      padding: 10px 18px; font-size: 13px; font-weight: 600; cursor: pointer;
      box-shadow: 0 4px 14px rgba(37, 99, 235, .4);
    }
    .panel {
      position: fixed; bottom: 76px; right: 24px; z-index: 2147483646;
      width: 360px; max-height: min(640px, calc(100vh - 100px)); overflow-y: auto;
      background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
      box-shadow: 0 10px 30px rgba(15, 23, 42, .18); padding: 16px;
      display: none;
    }
    .panel.open { display: block; }
    h3 { margin: 0 0 10px; font-size: 15px; color: #0f172a; }
    label { display: block; font-size: 11px; font-weight: 600; color: #475569; margin: 8px 0 2px; text-transform: uppercase; letter-spacing: .03em; }
    input, textarea, select {
      width: 100%; padding: 6px 8px; font-size: 13px; color: #0f172a;
      border: 1px solid #cbd5e1; border-radius: 6px; background: #fff;
    }
    textarea { resize: vertical; }
    .row { display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap; }
    button.action {
      padding: 7px 12px; font-size: 12px; font-weight: 600; border: none;
      border-radius: 6px; cursor: pointer; background: #e2e8f0; color: #0f172a;
    }
    button.action.primary { background: #2563eb; color: #fff; }
    button.action:disabled { opacity: .5; cursor: not-allowed; }
    .status { font-size: 12px; margin-top: 8px; min-height: 16px; color: #475569; }
    .status.err { color: #dc2626; }
    .credits { font-size: 11px; color: #64748b; margin-top: 6px; }
    .note { font-size: 11px; color: #94a3b8; margin-top: 8px; }
  `;

  const PANEL_HTML = `
    <button class="fab" id="fab">AI Copilot</button>
    <div class="panel" id="panel">
      <h3>LinkedIn AI Copilot</h3>

      <label>Name</label><input id="f-name" />
      <label>Headline</label><input id="f-headline" />
      <label>Company</label><input id="f-company" />
      <label>Location</label><input id="f-location" />
      <label>About</label><textarea id="f-about" rows="2"></textarea>

      <label>Your goal</label>
      <textarea id="f-goal" rows="2" placeholder="e.g. introduce my agency and book a 15-min call"></textarea>

      <label>Tone</label>
      <select id="f-tone">
        <option value="professional">Professional</option>
        <option value="friendly">Friendly</option>
        <option value="direct">Direct</option>
      </select>

      <div class="row">
        <button class="action primary" id="btn-generate">Generate draft</button>
      </div>

      <label>Draft</label>
      <textarea id="f-draft" rows="6" placeholder="Your draft will appear here — edit freely."></textarea>

      <div class="row">
        <button class="action" id="btn-shorter" disabled>Shorter</button>
        <button class="action" id="btn-professional" disabled>More professional</button>
        <button class="action" id="btn-friendly" disabled>More friendly</button>
      </div>
      <div class="row">
        <button class="action primary" id="btn-insert" disabled>Insert into message box</button>
        <button class="action" id="btn-copy" disabled>Copy</button>
      </div>

      <div class="status" id="status"></div>
      <div class="credits" id="credits"></div>
      <p class="note">Drafts are suggestions — you review, edit, and click Send yourself.</p>
    </div>
  `;

  function mountPanel() {
    if (document.getElementById(PANEL_HOST_ID)) return;

    const host = document.createElement('div');
    host.id = PANEL_HOST_ID;
    document.documentElement.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = PANEL_CSS;
    shadow.appendChild(style);

    const wrap = document.createElement('div');
    wrap.innerHTML = PANEL_HTML;
    shadow.appendChild(wrap);

    const $ = (id) => shadow.getElementById(id);
    const fields = ['name', 'headline', 'company', 'location', 'about'];
    const rewriteButtons = [
      ['btn-shorter', 'shorter'],
      ['btn-professional', 'more_professional'],
      ['btn-friendly', 'more_friendly'],
    ];

    let busy = false;

    function setStatus(message, isError) {
      $('status').textContent = message || '';
      $('status').className = isError ? 'status err' : 'status';
    }

    function setDraftButtonsEnabled(enabled) {
      for (const [id] of rewriteButtons) $(id).disabled = !enabled;
      $('btn-insert').disabled = !enabled;
      $('btn-copy').disabled = !enabled;
    }

    function fillFields() {
      const profile = extractProfile();
      for (const f of fields) {
        if (!$('f-' + f).value) $('f-' + f).value = profile[f] || '';
      }
    }

    function readProfile() {
      const profile = {};
      for (const f of fields) {
        const v = $('f-' + f).value.trim();
        if (v) profile[f] = v;
      }
      return profile;
    }

    async function request(payload) {
      if (busy) return;
      busy = true;
      $('btn-generate').disabled = true;
      setStatus('Generating…');
      try {
        const res = await chrome.runtime.sendMessage({ type: 'GENERATE_DRAFT', payload });
        if (!res || !res.ok) {
          setStatus((res && res.error) || 'Something went wrong.', true);
          return;
        }
        $('f-draft').value = res.data.draft;
        setDraftButtonsEnabled(true);
        setStatus('Done — edit the draft as you like.');
        if (typeof res.data.creditsRemaining === 'number') {
          $('credits').textContent = `${res.data.creditsRemaining} credits remaining`;
        }
      } finally {
        busy = false;
        $('btn-generate').disabled = false;
      }
    }

    $('fab').addEventListener('click', () => {
      const panel = $('panel');
      panel.classList.toggle('open');
      if (panel.classList.contains('open')) fillFields();
    });

    $('btn-generate').addEventListener('click', () => {
      const goal = $('f-goal').value.trim();
      if (!goal) {
        setStatus('Describe your goal first.', true);
        return;
      }
      request({
        action: 'draft',
        goal,
        tone: $('f-tone').value,
        profile: readProfile(),
      });
    });

    for (const [id, rewrite] of rewriteButtons) {
      $(id).addEventListener('click', () => {
        const message = $('f-draft').value.trim();
        if (!message) return;
        request({
          action: 'rewrite',
          message,
          rewrite,
          tone: $('f-tone').value,
          profile: readProfile(),
        });
      });
    }

    $('btn-insert').addEventListener('click', () => {
      const draft = $('f-draft').value.trim();
      if (!draft) return;
      if (insertIntoComposer(draft)) {
        setStatus('Inserted — review it, then click Send when ready.');
      } else {
        navigator.clipboard.writeText(draft);
        setStatus('No message box open — copied to clipboard instead. Open a conversation and paste.');
      }
    });

    $('btn-copy').addEventListener('click', async () => {
      const draft = $('f-draft').value.trim();
      if (!draft) return;
      await navigator.clipboard.writeText(draft);
      setStatus('Copied to clipboard.');
    });
  }

  function unmountPanel() {
    const host = document.getElementById(PANEL_HOST_ID);
    if (host) host.remove();
  }

  // ---------------------------------------------------------------------
  // SPA navigation: LinkedIn swaps pages without full reloads, so watch the
  // URL and mount/unmount the panel as the user moves around.
  // ---------------------------------------------------------------------

  function isCopilotPage() {
    return /^\/(in|messaging)\//.test(location.pathname);
  }

  let lastUrl = '';
  function onUrlChange() {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    if (isCopilotPage()) {
      // Give LinkedIn's client-side render a moment before extracting.
      setTimeout(mountPanel, 800);
    } else {
      unmountPanel();
    }
  }

  onUrlChange();
  setInterval(onUrlChange, 1000);
})();
