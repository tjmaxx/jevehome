/* ============================================
   AGENT ADMIN MODULE
   ============================================
   Manages the "AI Assistant" section in admin.html.
   Binds to static HTML already present in admin.html —
   no dynamic rendering of the outer structure.
   Loads / saves agent_config rows via Supabase.
   ============================================ */

(function () {
  'use strict';

  // ── Tool definitions ──────────────────────────────────────────────────────────
  var TOOLS = [
    { key: 'timeline_context',    label: 'Timeline Context',     desc: 'Injects the full anniversary timeline (2011–2026) into every conversation.' },
    { key: 'quick_prompts',       label: 'Quick Prompts',        desc: 'Shows suggestion buttons in the chat panel for users to tap.' },
    { key: 'conversation_history',label: 'Conversation Memory',  desc: 'Loads past messages so the assistant remembers context within a conversation.' },
    { key: 'general_knowledge',   label: 'General Knowledge',    desc: 'Allows questions beyond the anniversary site content.' }
  ];

  // ── Theme presets ─────────────────────────────────────────────────────────────
  var THEMES = {
    warm:    { label: 'Warm Rose',    primaryColor: '#c8907e', primaryDark: '#a86f5e' },
    ocean:   { label: 'Ocean Blue',   primaryColor: '#4a9db5', primaryDark: '#2d7a94' },
    forest:  { label: 'Forest Green', primaryColor: '#5a9c6b', primaryDark: '#3d7a50' },
    minimal: { label: 'Minimal Gray', primaryColor: '#888888', primaryDark: '#555555' }
  };

  // ── State ─────────────────────────────────────────────────────────────────────
  var config = {
    model:          'gemini-2.5-flash-lite',
    siteContext:    '',
    systemPrompt:   '',
    welcomeMessage: '',
    maxHistory:     20,
    widgetTheme:    { preset: 'warm', primaryColor: '#c8907e', primaryDark: '#a86f5e' },
    quickPrompts:   [],
    enabledTools:   ['timeline_context', 'quick_prompts', 'conversation_history', 'general_knowledge']
  };

  // ── Init ──────────────────────────────────────────────────────────────────────
  function initAgentAdmin() {
    if (!document.getElementById('section-agent')) return;
    bindTabs();
    loadConfig();
  }

  // ── Tab switching (static HTML already has tab buttons + panels) ───────────────
  function bindTabs() {
    document.querySelectorAll('.agent-admin-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tab = btn.getAttribute('data-tab');
        document.querySelectorAll('.agent-admin-tab').forEach(function (b) {
          b.classList.toggle('active', b === btn);
        });
        document.querySelectorAll('.agent-admin-panel').forEach(function (p) {
          p.classList.toggle('active', p.id === 'agent-tab-' + tab);
        });
      });
    });
  }

  // ── Load config from Supabase ─────────────────────────────────────────────────
  async function loadConfig() {
    var sb = window.supabaseClient;
    if (!sb) return;

    try {
      var res = await sb.from('agent_config').select('key, value');
      if (!res.data) return;

      var map = {};
      res.data.forEach(function (row) { map[row.key] = row.value; });

      if (map.model)           config.model          = map.model;
      if (map.site_context     !== undefined) config.siteContext    = map.site_context || '';
      if (map.system_prompt    !== undefined) config.systemPrompt   = map.system_prompt || '';
      if (map.welcome_message)  config.welcomeMessage = map.welcome_message;
      if (map.max_history)      config.maxHistory     = parseInt(map.max_history, 10);

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

    populateModelTab();
    populateToolsTab();
    populatePromptsTab();
    populateThemeTab();
    bindAllSaveButtons();
  }

  // ── Populate: Model & Prompt tab ──────────────────────────────────────────────
  function populateModelTab() {
    var modelSel  = document.getElementById('agent-model');
    var siteCtx   = document.getElementById('agent-site-context');
    var sysPrmpt  = document.getElementById('agent-system-prompt');
    var welcome   = document.getElementById('agent-welcome-message');
    var slider    = document.getElementById('agent-max-history');
    var sliderVal = document.getElementById('agent-max-history-val');

    if (modelSel)  modelSel.value  = config.model;
    if (siteCtx)   siteCtx.value   = config.siteContext;
    if (sysPrmpt)  sysPrmpt.value  = config.systemPrompt;
    if (welcome)   welcome.value   = config.welcomeMessage;
    if (slider) {
      slider.value = config.maxHistory;
      if (sliderVal) sliderVal.textContent = config.maxHistory;
      slider.addEventListener('input', function () {
        if (sliderVal) sliderVal.textContent = slider.value;
      });
    }
  }

  // ── Populate: Tools tab ───────────────────────────────────────────────────────
  function populateToolsTab() {
    var list = document.getElementById('agent-tools-list');
    if (!list) return;

    list.innerHTML = TOOLS.map(function (tool) {
      var checked = config.enabledTools.indexOf(tool.key) !== -1;
      return '<div class="agent-tool-row">' +
        '<label class="agent-tool-toggle">' +
          '<input type="checkbox" data-tool="' + tool.key + '"' + (checked ? ' checked' : '') + '>' +
          '<span class="slider"></span>' +
        '</label>' +
        '<div class="agent-tool-info">' +
          '<div class="agent-tool-name">' + escHtml(tool.label) + '</div>' +
          '<div class="agent-tool-desc">' + escHtml(tool.desc) + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  // ── Populate: Quick Prompts tab ───────────────────────────────────────────────
  function populatePromptsTab() {
    var list = document.getElementById('agent-prompts-list');
    if (!list) return;

    if (config.quickPrompts.length === 0) {
      list.innerHTML = '<p style="font-size:0.82rem;color:#999;padding:8px 0">No quick prompts yet.</p>';
      return;
    }

    list.innerHTML = config.quickPrompts.map(function (p, i) {
      return '<div class="agent-prompt-row" data-index="' + i + '">' +
        '<div class="agent-prompt-fields">' +
          '<input type="text" class="prompt-label-input" value="' + escAttr(p.label) + '" placeholder="Button label">' +
          '<input type="text" class="prompt-text-input" value="' + escAttr(p.prompt) + '" placeholder="Prompt text">' +
        '</div>' +
        '<button class="agent-prompt-delete" data-index="' + i + '" title="Delete">✕</button>' +
      '</div>';
    }).join('');

    list.querySelectorAll('.agent-prompt-delete').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-index'), 10);
        config.quickPrompts.splice(idx, 1);
        populatePromptsTab();
      });
    });
  }

  // ── Populate: Theme tab ───────────────────────────────────────────────────────
  function populateThemeTab() {
    var presetsEl  = document.getElementById('agent-theme-presets');
    var colorPrimEl = document.getElementById('agent-color-primary');
    var colorDarkEl = document.getElementById('agent-color-dark');

    if (presetsEl) {
      presetsEl.innerHTML = Object.keys(THEMES).map(function (key) {
        var t      = THEMES[key];
        var active = config.widgetTheme.preset === key ? ' active' : '';
        return '<button class="agent-theme-preset' + active + '" data-preset="' + key + '">' +
          '<span class="agent-theme-swatch" style="background:' + t.primaryColor + '"></span>' +
          t.label +
        '</button>';
      }).join('');

      presetsEl.querySelectorAll('.agent-theme-preset').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var preset = btn.getAttribute('data-preset');
          var t = THEMES[preset];
          if (!t) return;
          config.widgetTheme = { preset: preset, primaryColor: t.primaryColor, primaryDark: t.primaryDark };
          if (colorPrimEl) colorPrimEl.value = t.primaryColor;
          if (colorDarkEl) colorDarkEl.value = t.primaryDark;
          presetsEl.querySelectorAll('.agent-theme-preset').forEach(function (b) {
            b.classList.toggle('active', b === btn);
          });
        });
      });
    }

    if (colorPrimEl) colorPrimEl.value = config.widgetTheme.primaryColor || '#c8907e';
    if (colorDarkEl) colorDarkEl.value = config.widgetTheme.primaryDark  || '#a86f5e';

    // Clear preset highlight when user picks a custom colour
    function clearPreset() {
      config.widgetTheme.preset = 'custom';
      if (presetsEl) presetsEl.querySelectorAll('.agent-theme-preset').forEach(function (b) {
        b.classList.remove('active');
      });
    }
    if (colorPrimEl) colorPrimEl.addEventListener('input', clearPreset);
    if (colorDarkEl) colorDarkEl.addEventListener('input', clearPreset);
  }

  // ── Bind all save buttons ─────────────────────────────────────────────────────
  function bindAllSaveButtons() {
    // Model & Prompt
    var saveModelBtn = document.getElementById('agent-save-model-btn');
    if (saveModelBtn) {
      saveModelBtn.addEventListener('click', async function () {
        var model      = (document.getElementById('agent-model')          || {}).value || config.model;
        var siteCtx    = (document.getElementById('agent-site-context')   || {}).value || '';
        var sysPrmpt   = (document.getElementById('agent-system-prompt')  || {}).value || '';
        var welcome    = (document.getElementById('agent-welcome-message')|| {}).value || '';
        var history    = parseInt((document.getElementById('agent-max-history') || {}).value || config.maxHistory, 10);

        config.model          = model;
        config.siteContext    = siteCtx;
        config.systemPrompt   = sysPrmpt;
        config.welcomeMessage = welcome;
        config.maxHistory     = history;

        await withSaveStatus(saveModelBtn, document.getElementById('agent-save-model-status'), async function () {
          return await saveKey('model', model) &&
                 await saveKey('site_context', siteCtx) &&
                 await saveKey('system_prompt', sysPrmpt) &&
                 await saveKey('welcome_message', welcome) &&
                 await saveKey('max_history', String(history));
        });
      });
    }

    // Tools
    var saveToolsBtn = document.getElementById('agent-save-tools-btn');
    if (saveToolsBtn) {
      saveToolsBtn.addEventListener('click', async function () {
        var checks = document.querySelectorAll('#agent-tools-list input[type="checkbox"]');
        var enabled = [];
        checks.forEach(function (cb) { if (cb.checked) enabled.push(cb.getAttribute('data-tool')); });
        config.enabledTools = enabled;

        await withSaveStatus(saveToolsBtn, document.getElementById('agent-save-tools-status'), function () {
          return saveKey('enabled_tools', enabled);
        });
      });
    }

    // Quick Prompts — add button
    var addPromptBtn = document.getElementById('agent-add-prompt-btn');
    if (addPromptBtn) {
      addPromptBtn.addEventListener('click', function () {
        config.quickPrompts.push({ label: 'New prompt', prompt: '' });
        populatePromptsTab();
      });
    }

    // Quick Prompts — save
    var savePromptsBtn = document.getElementById('agent-save-prompts-btn');
    if (savePromptsBtn) {
      savePromptsBtn.addEventListener('click', async function () {
        // Read current values from input fields
        var rows = document.querySelectorAll('#agent-prompts-list .agent-prompt-row');
        var prompts = [];
        rows.forEach(function (row) {
          var label  = (row.querySelector('.prompt-label-input') || {}).value || '';
          var prompt = (row.querySelector('.prompt-text-input')  || {}).value || '';
          if (label.trim() || prompt.trim()) prompts.push({ label: label.trim(), prompt: prompt.trim() });
        });
        config.quickPrompts = prompts;

        await withSaveStatus(savePromptsBtn, document.getElementById('agent-save-prompts-status'), function () {
          return saveKey('quick_prompts', prompts);
        });
      });
    }

    // Theme
    var saveThemeBtn = document.getElementById('agent-save-theme-btn');
    if (saveThemeBtn) {
      saveThemeBtn.addEventListener('click', async function () {
        var primary = (document.getElementById('agent-color-primary') || {}).value || config.widgetTheme.primaryColor;
        var dark    = (document.getElementById('agent-color-dark')    || {}).value || config.widgetTheme.primaryDark;
        config.widgetTheme.primaryColor = primary;
        config.widgetTheme.primaryDark  = dark;

        await withSaveStatus(saveThemeBtn, document.getElementById('agent-save-theme-status'), function () {
          return saveKey('widget_theme', config.widgetTheme);
        });
      });
    }
  }

  // ── Save a single key to Supabase (upsert) ────────────────────────────────────
  async function saveKey(key, value) {
    var sb = window.supabaseClient;
    if (!sb) return false;
    var res = await sb
      .from('agent_config')
      .upsert({ key: key, value: typeof value === 'string' ? value : JSON.stringify(value) },
               { onConflict: 'key' });
    return !res.error;
  }

  // ── Show save status (button flash + status label) ────────────────────────────
  async function withSaveStatus(btn, statusEl, fn) {
    btn.disabled = true;
    btn.textContent = 'Saving…';
    var ok = false;
    try { ok = await fn(); } catch (e) { console.error(e); }

    btn.textContent = 'Save';
    btn.disabled = false;

    if (statusEl) {
      statusEl.textContent = ok ? 'Saved!' : 'Save failed';
      statusEl.style.color = ok ? '' : '#e74c3c';
      statusEl.classList.add('visible');
      setTimeout(function () { statusEl.classList.remove('visible'); }, 2500);
    }
  }

  // ── Utilities ─────────────────────────────────────────────────────────────────
  function escHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function escAttr(str) {
    return escHtml(str).replace(/"/g, '&quot;');
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    var interval = setInterval(function () {
      var dashboard = document.getElementById('admin-dashboard');
      if (dashboard && dashboard.style.display !== 'none' && dashboard.style.display !== '') {
        clearInterval(interval);
        initAgentAdmin();
      }
    }, 300);
  });

  window.initAgentAdmin = initAgentAdmin;

})();
