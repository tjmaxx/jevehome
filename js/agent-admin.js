/* ============================================
   AGENT ADMIN MODULE
   ============================================
   Manages the "AI Assistant" section in admin.html.
   Adapted from:
     jevehome-agent/client/src/components/AdminPage.jsx
     jevehome-agent/client/src/components/ToolMenu.jsx

   Loads/saves agent_config table rows via Supabase.
   Tabs: Model | Tools | Quick Prompts | Theme
   ============================================ */

(function () {
  'use strict';

  // ── Tool definitions (anniversary-site specific) ─────────────────────────────
  var TOOLS = [
    {
      key: 'timeline_context',
      label: 'Timeline Context',
      desc: 'Injects the full anniversary timeline (2011–2026) into the assistant\'s knowledge for every conversation.'
    },
    {
      key: 'quick_prompts',
      label: 'Quick Prompts',
      desc: 'Shows configurable suggestion buttons in the chat panel for users to tap.'
    },
    {
      key: 'conversation_history',
      label: 'Conversation Memory',
      desc: 'Loads previous messages from the same conversation so the assistant remembers context.'
    },
    {
      key: 'general_knowledge',
      label: 'General Knowledge',
      desc: 'Allows the assistant to answer questions beyond the anniversary site content.'
    }
  ];

  // ── Theme presets ─────────────────────────────────────────────────────────────
  var THEMES = {
    warm:    { label: 'Warm Rose',      primaryColor: '#c8907e', primaryDark: '#a86f5e' },
    ocean:   { label: 'Ocean Blue',     primaryColor: '#4a9db5', primaryDark: '#2d7a94' },
    forest:  { label: 'Forest Green',   primaryColor: '#5a9c6b', primaryDark: '#3d7a50' },
    minimal: { label: 'Minimal Gray',   primaryColor: '#888888', primaryDark: '#555555' }
  };

  // ── Available models ──────────────────────────────────────────────────────────
  var MODELS = [
    { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite (Recommended — fast & capable)' },
    { value: 'gemini-2.0-flash-001',  label: 'Gemini 2.0 Flash (Stable)' },
    { value: 'gemini-2.5-pro',        label: 'Gemini 2.5 Pro (Most capable, slower)' }
  ];

  // ── State ─────────────────────────────────────────────────────────────────────
  var config = {
    model:          'gemini-2.5-flash-lite',
    systemPrompt:   '',
    welcomeMessage: '',
    maxHistory:     20,
    widgetTheme:    { preset: 'warm', primaryColor: '#c8907e', primaryDark: '#a86f5e' },
    quickPrompts:   [],
    enabledTools:   ['timeline_context', 'quick_prompts', 'conversation_history', 'general_knowledge']
  };

  var activeTab = 'model';

  // ── Init ──────────────────────────────────────────────────────────────────────
  function initAgentAdmin() {
    var section = document.getElementById('section-agent');
    if (!section) return;
    loadConfig();
  }

  // ── Load config from Supabase ─────────────────────────────────────────────────
  async function loadConfig() {
    var sb = window.supabaseClient;
    if (!sb) return;

    try {
      var _ref = await sb.from('agent_config').select('key, value');
      var data = _ref.data;
      if (!data) return;

      var map = {};
      data.forEach(function (row) { map[row.key] = row.value; });

      if (map.model)          config.model          = map.model;
      if (map.system_prompt !== undefined) config.systemPrompt = map.system_prompt;
      if (map.welcome_message) config.welcomeMessage = map.welcome_message;
      if (map.max_history)    config.maxHistory      = parseInt(map.max_history, 10);

      if (map.widget_theme) {
        try { config.widgetTheme = JSON.parse(map.widget_theme); } catch { /* keep default */ }
      }
      if (map.quick_prompts) {
        try { config.quickPrompts = JSON.parse(map.quick_prompts); } catch { /* keep default */ }
      }
      if (map.enabled_tools) {
        try { config.enabledTools = JSON.parse(map.enabled_tools); } catch { /* keep default */ }
      }
    } catch (e) {
      console.error('[AgentAdmin] Load failed:', e);
    }

    renderTabs();
    renderActiveTab();
  }

  // ── Save a single key to Supabase (upsert) ────────────────────────────────────
  // Same pattern as admin.js: sb.from('site_config').upsert(...)
  async function saveKey(key, value) {
    var sb = window.supabaseClient;
    if (!sb) return false;
    var _ref = await sb
      .from('agent_config')
      .upsert({ key: key, value: typeof value === 'string' ? value : JSON.stringify(value) },
               { onConflict: 'key' });
    return !_ref.error;
  }

  // ── Tab rendering ─────────────────────────────────────────────────────────────
  function renderTabs() {
    var container = document.getElementById('agent-admin-tabs');
    if (!container) return;
    var tabs = [
      { key: 'model',   label: 'Model & Prompt' },
      { key: 'tools',   label: 'Tools' },
      { key: 'prompts', label: 'Quick Prompts' },
      { key: 'theme',   label: 'Theme' }
    ];
    container.innerHTML = tabs.map(function (t) {
      return '<button class="agent-admin-tab' + (t.key === activeTab ? ' active' : '') +
             '" data-tab="' + t.key + '">' + t.label + '</button>';
    }).join('');
    container.querySelectorAll('.agent-admin-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeTab = btn.getAttribute('data-tab');
        renderTabs();
        renderActiveTab();
      });
    });
  }

  function renderActiveTab() {
    var content = document.getElementById('agent-admin-content');
    if (!content) return;
    switch (activeTab) {
      case 'model':   content.innerHTML = renderModelTab();   bindModelTab();   break;
      case 'tools':   content.innerHTML = renderToolsTab();   bindToolsTab();   break;
      case 'prompts': content.innerHTML = renderPromptsTab(); bindPromptsTab(); break;
      case 'theme':   content.innerHTML = renderThemeTab();   bindThemeTab();   break;
    }
  }

  // ── Model & Prompt tab ────────────────────────────────────────────────────────
  function renderModelTab() {
    var modelOptions = MODELS.map(function (m) {
      return '<option value="' + m.value + '"' + (m.value === config.model ? ' selected' : '') + '>' +
             m.label + '</option>';
    }).join('');

    return '<div class="agent-admin-fields">' +
      '<div class="admin-field">' +
        '<label>AI Model</label>' +
        '<select id="agent-model-select">' + modelOptions + '</select>' +
      '</div>' +
      '<div class="admin-field">' +
        '<label>Custom System Prompt <span class="agent-admin-hint">(leave empty to use the default anniversary assistant persona)</span></label>' +
        '<textarea id="agent-system-prompt" rows="5" placeholder="You are a warm assistant...">' +
          escHtml(config.systemPrompt) + '</textarea>' +
      '</div>' +
      '<div class="admin-field">' +
        '<label>Welcome Message</label>' +
        '<input type="text" id="agent-welcome-msg" value="' + escAttr(config.welcomeMessage) + '" ' +
               'placeholder="Hi! I\'m your assistant...">' +
      '</div>' +
      '<div class="admin-field">' +
        '<label>Conversation History Depth — <strong id="agent-history-val">' + config.maxHistory + '</strong> messages</label>' +
        '<input type="range" id="agent-max-history" min="4" max="40" step="2" value="' + config.maxHistory + '">' +
        '<p class="agent-admin-hint">How many past messages the assistant remembers per conversation turn.</p>' +
      '</div>' +
      '<button class="admin-save-btn" id="agent-save-model">Save Model Settings</button>' +
    '</div>';
  }

  function bindModelTab() {
    var historySlider = document.getElementById('agent-max-history');
    var historyVal    = document.getElementById('agent-history-val');
    if (historySlider && historyVal) {
      historySlider.addEventListener('input', function () {
        historyVal.textContent = historySlider.value;
      });
    }

    var saveBtn = document.getElementById('agent-save-model');
    if (!saveBtn) return;
    saveBtn.addEventListener('click', async function () {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';

      var model   = document.getElementById('agent-model-select').value;
      var prompt  = document.getElementById('agent-system-prompt').value.trim();
      var welcome = document.getElementById('agent-welcome-msg').value.trim();
      var history = parseInt(document.getElementById('agent-max-history').value, 10);

      config.model          = model;
      config.systemPrompt   = prompt;
      config.welcomeMessage = welcome;
      config.maxHistory     = history;

      var ok = await saveKey('model', model) &&
               await saveKey('system_prompt', prompt) &&
               await saveKey('welcome_message', welcome) &&
               await saveKey('max_history', String(history));

      showToast(ok ? 'Model settings saved.' : 'Save failed — check console.', !ok);
      saveBtn.textContent = ok ? 'Saved ✓' : 'Save failed';
      setTimeout(function () {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Model Settings';
      }, 2000);
    });
  }

  // ── Tools tab ─────────────────────────────────────────────────────────────────
  function renderToolsTab() {
    var rows = TOOLS.map(function (tool) {
      var checked = config.enabledTools.indexOf(tool.key) !== -1;
      return '<div class="agent-tool-row">' +
        '<label class="agent-tool-toggle">' +
          '<input type="checkbox" data-tool="' + tool.key + '"' + (checked ? ' checked' : '') + '>' +
          '<span class="agent-tool-slider"></span>' +
        '</label>' +
        '<div class="agent-tool-info">' +
          '<span class="agent-tool-label">' + escHtml(tool.label) + '</span>' +
          '<span class="agent-tool-desc">' + escHtml(tool.desc) + '</span>' +
        '</div>' +
      '</div>';
    }).join('');

    return '<div class="agent-tools-list" id="agent-tools-list">' + rows + '</div>' +
           '<button class="admin-save-btn" id="agent-save-tools">Save Tools</button>';
  }

  function bindToolsTab() {
    var saveBtn = document.getElementById('agent-save-tools');
    if (!saveBtn) return;
    saveBtn.addEventListener('click', async function () {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';

      var checks = document.querySelectorAll('#agent-tools-list input[type="checkbox"]');
      var enabled = [];
      checks.forEach(function (cb) {
        if (cb.checked) enabled.push(cb.getAttribute('data-tool'));
      });
      config.enabledTools = enabled;

      var ok = await saveKey('enabled_tools', enabled);
      showToast(ok ? 'Tools saved.' : 'Save failed — check console.', !ok);
      saveBtn.textContent = ok ? 'Saved ✓' : 'Save failed';
      setTimeout(function () {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Tools';
      }, 2000);
    });
  }

  // ── Quick Prompts tab ─────────────────────────────────────────────────────────
  function renderPromptsTab() {
    var rows = config.quickPrompts.map(function (p, i) {
      return '<div class="agent-prompt-row" data-index="' + i + '">' +
        '<div class="agent-prompt-texts">' +
          '<span class="agent-prompt-label-text">' + escHtml(p.label) + '</span>' +
          '<span class="agent-prompt-prompt-text">' + escHtml(p.prompt) + '</span>' +
        '</div>' +
        '<button class="agent-prompt-delete" data-index="' + i + '" title="Delete">✕</button>' +
      '</div>';
    }).join('');

    return '<div id="agent-prompts-list">' + (rows || '<p class="agent-admin-hint" style="padding:8px 0">No quick prompts yet. Add one below.</p>') + '</div>' +
      '<div class="agent-prompt-add-form">' +
        '<input type="text" id="agent-prompt-label-input" placeholder="Button label (e.g. Tell me about 2017)" maxlength="60">' +
        '<textarea id="agent-prompt-text-input" rows="2" placeholder="Full prompt sent to AI..." maxlength="300"></textarea>' +
        '<button class="admin-add-btn" id="agent-add-prompt">+ Add Prompt</button>' +
      '</div>' +
      '<button class="admin-save-btn" id="agent-save-prompts">Save Quick Prompts</button>';
  }

  function bindPromptsTab() {
    document.querySelectorAll('.agent-prompt-delete').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-index'), 10);
        config.quickPrompts.splice(idx, 1);
        renderActiveTab();
      });
    });

    var addBtn = document.getElementById('agent-add-prompt');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        var label  = (document.getElementById('agent-prompt-label-input').value || '').trim();
        var prompt = (document.getElementById('agent-prompt-text-input').value || '').trim();
        if (!label || !prompt) { showToast('Both label and prompt text are required.', true); return; }
        config.quickPrompts.push({ label: label, prompt: prompt });
        renderActiveTab();
      });
    }

    var saveBtn = document.getElementById('agent-save-prompts');
    if (saveBtn) {
      saveBtn.addEventListener('click', async function () {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving…';
        var ok = await saveKey('quick_prompts', config.quickPrompts);
        showToast(ok ? 'Quick prompts saved.' : 'Save failed — check console.', !ok);
        saveBtn.textContent = ok ? 'Saved ✓' : 'Save failed';
        setTimeout(function () {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save Quick Prompts';
        }, 2000);
      });
    }
  }

  // ── Theme tab ─────────────────────────────────────────────────────────────────
  function renderThemeTab() {
    var presetBtns = Object.keys(THEMES).map(function (key) {
      var t = THEMES[key];
      var active = config.widgetTheme.preset === key ? ' agent-theme-preset--active' : '';
      return '<button class="agent-theme-preset' + active + '" data-preset="' + key + '" ' +
             'style="--preview-color:' + t.primaryColor + '">' +
               '<span class="agent-theme-swatch"></span>' + t.label +
             '</button>';
    }).join('');

    return '<div class="agent-theme-presets">' + presetBtns + '</div>' +
      '<div class="agent-theme-custom">' +
        '<div class="admin-field">' +
          '<label>Primary Color</label>' +
          '<div class="agent-color-row">' +
            '<input type="color" id="agent-color-primary" value="' + (config.widgetTheme.primaryColor || '#c8907e') + '">' +
            '<span id="agent-color-primary-val">' + (config.widgetTheme.primaryColor || '#c8907e') + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="admin-field">' +
          '<label>Primary Dark Color <span class="agent-admin-hint">(hover/active states)</span></label>' +
          '<div class="agent-color-row">' +
            '<input type="color" id="agent-color-dark" value="' + (config.widgetTheme.primaryDark || '#a86f5e') + '">' +
            '<span id="agent-color-dark-val">' + (config.widgetTheme.primaryDark || '#a86f5e') + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="agent-theme-preview" id="agent-theme-preview">' +
          '<div class="agent-preview-bubble agent-preview-bubble--user">User message</div>' +
          '<div class="agent-preview-bubble agent-preview-bubble--assistant">Assistant reply ✨</div>' +
          '<div class="agent-preview-send">Send</div>' +
        '</div>' +
      '</div>' +
      '<button class="admin-save-btn" id="agent-save-theme">Save Theme</button>';
  }

  function bindThemeTab() {
    function updatePreview() {
      var primary = document.getElementById('agent-color-primary').value;
      var dark    = document.getElementById('agent-color-dark').value;
      document.getElementById('agent-color-primary-val').textContent = primary;
      document.getElementById('agent-color-dark-val').textContent    = dark;
      var preview = document.getElementById('agent-theme-preview');
      if (preview) {
        preview.style.setProperty('--preview-primary', primary);
        preview.style.setProperty('--preview-dark', dark);
      }
    }

    var colorPrimary = document.getElementById('agent-color-primary');
    var colorDark    = document.getElementById('agent-color-dark');
    if (colorPrimary) colorPrimary.addEventListener('input', function () { updatePreview(); clearPreset(); });
    if (colorDark)    colorDark.addEventListener('input',    function () { updatePreview(); clearPreset(); });

    // Preset buttons
    document.querySelectorAll('.agent-theme-preset').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var preset = btn.getAttribute('data-preset');
        var t = THEMES[preset];
        if (!t) return;
        config.widgetTheme = { preset: preset, primaryColor: t.primaryColor, primaryDark: t.primaryDark };
        if (colorPrimary) colorPrimary.value = t.primaryColor;
        if (colorDark)    colorDark.value    = t.primaryDark;
        document.querySelectorAll('.agent-theme-preset').forEach(function (b) {
          b.classList.toggle('agent-theme-preset--active', b === btn);
        });
        updatePreview();
      });
    });

    function clearPreset() {
      config.widgetTheme.preset = 'custom';
      document.querySelectorAll('.agent-theme-preset').forEach(function (b) {
        b.classList.remove('agent-theme-preset--active');
      });
    }

    // Initialize preview
    updatePreview();

    var saveBtn = document.getElementById('agent-save-theme');
    if (!saveBtn) return;
    saveBtn.addEventListener('click', async function () {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';
      var primary = document.getElementById('agent-color-primary').value;
      var dark    = document.getElementById('agent-color-dark').value;
      config.widgetTheme.primaryColor = primary;
      config.widgetTheme.primaryDark  = dark;
      var ok = await saveKey('widget_theme', config.widgetTheme);
      showToast(ok ? 'Theme saved.' : 'Save failed — check console.', !ok);
      saveBtn.textContent = ok ? 'Saved ✓' : 'Save failed';
      setTimeout(function () {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Theme';
      }, 2000);
    });
  }

  // ── Utilities ─────────────────────────────────────────────────────────────────
  function escHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function escAttr(str) {
    return escHtml(str).replace(/"/g, '&quot;');
  }

  function showToast(msg, isError) {
    // Reuse admin.html's existing showToast if available
    if (typeof window.showAdminToast === 'function') {
      window.showAdminToast(msg, isError);
      return;
    }
    // Fallback: use the admin toast element directly
    var toast = document.querySelector('.admin-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.toggle('error', !!isError);
    toast.classList.add('show');
    setTimeout(function () { toast.classList.remove('show'); }, 3000);
  }

  // ── Bootstrap when admin page is ready ───────────────────────────────────────
  // admin.html initialises Supabase and authenticates before calling initDashboard().
  // We hook in by waiting for DOMContentLoaded and polling for the dashboard visibility,
  // or just exposing initAgentAdmin for admin.js to call explicitly if needed.
  document.addEventListener('DOMContentLoaded', function () {
    // Poll until the dashboard is visible (after admin auth)
    var interval = setInterval(function () {
      var dashboard = document.getElementById('admin-dashboard');
      if (dashboard && dashboard.style.display !== 'none' && dashboard.style.display !== '') {
        clearInterval(interval);
        initAgentAdmin();
      }
      // Also trigger if section-agent is in the DOM (dashboard already shown)
      var section = document.getElementById('section-agent');
      if (section) {
        clearInterval(interval);
        initAgentAdmin();
      }
    }, 300);
  });

  window.initAgentAdmin = initAgentAdmin;

})();
