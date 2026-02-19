/* ============================================
   AGENT CHAT WIDGET
   ============================================
   Floating AI assistant for the authenticated
   anniversary app. Calls the Supabase Edge
   Function for Gemini-powered responses.

   Features:
   - Config loaded from agent_config table
   - Runtime theme via CSS custom properties
   - Chat history panel (slide-in sidebar)
   - Quick prompt suggestion buttons
   - Per-user conversation persistence
   - Short-term memory (history sent to edge fn)

   Adapted from:
     jevehome-agent/client/src/services/api.js
     jevehome-agent/client/src/hooks/useChat.js
     jevehome-agent/client/src/components/Sidebar.jsx
   ============================================ */

(function () {
  'use strict';

  // ── Config ──────────────────────────────────
  var FUNCTION_URL = 'https://sytogitulennckeismie.supabase.co/functions/v1/chat';

  // ── Runtime state ────────────────────────────
  var agentConfig = {
    model:          'gemini-2.5-flash-lite',
    welcomeMessage: 'Hi! I\'m your assistant for this site. Ask me anything about Jia & Vickey\'s journey \u2728',
    maxHistory:     20,
    widgetTheme:    { primaryColor: '#c8907e', primaryDark: '#a86f5e' },
    quickPrompts:   [],
    enabledTools:   ['timeline_context', 'quick_prompts', 'conversation_history', 'general_knowledge']
  };

  var currentConversationId = null;
  var isOpen                = false;
  var isLoading             = false;
  var historyVisible        = false;
  var abortController       = null;
  var conversations         = [];   // cached list from Supabase
  var quickPromptsShown     = true; // hidden after first user message

  // ── DOM refs ─────────────────────────────────
  var trigger       = null;
  var panel         = null;
  var messagesEl    = null;
  var inputEl       = null;
  var sendBtn       = null;
  var closeBtn      = null;
  var historySidebar = null;
  var quickPromptBar = null;

  // ── Public: called after auth succeeds ───────
  function initAgent() {
    trigger        = document.getElementById('agent-trigger');
    panel          = document.getElementById('agent-panel');
    messagesEl     = document.getElementById('agent-messages');
    inputEl        = document.getElementById('agent-input');
    sendBtn        = document.getElementById('agent-send');
    closeBtn       = document.querySelector('.agent-close-btn');

    if (!trigger || !panel) return;

    loadConfig().then(function () {
      trigger.style.display = 'flex';
      buildHistorySidebar();
      buildQuickPromptBar();
      applyTheme(agentConfig.widgetTheme);
      appendMessage('assistant', agentConfig.welcomeMessage);
      bindEvents();
    });
  }

  // ── Config loader ─────────────────────────────
  async function loadConfig() {
    var sb = window.supabaseClient;
    if (!sb) return;
    try {
      var _ref = await sb.from('agent_config').select('key, value');
      var data = _ref.data;
      if (!data) return;
      var map = {};
      data.forEach(function (r) { map[r.key] = r.value; });

      if (map.model)           agentConfig.model          = map.model;
      if (map.welcome_message) agentConfig.welcomeMessage = map.welcome_message;
      if (map.max_history)     agentConfig.maxHistory     = parseInt(map.max_history, 10);
      if (map.widget_theme)    try { agentConfig.widgetTheme  = JSON.parse(map.widget_theme); } catch { /* keep default */ }
      if (map.quick_prompts)   try { agentConfig.quickPrompts = JSON.parse(map.quick_prompts); } catch { /* keep default */ }
      if (map.enabled_tools)   try { agentConfig.enabledTools = JSON.parse(map.enabled_tools); } catch { /* keep default */ }
    } catch (e) {
      console.error('[Agent] Config load failed:', e);
    }
  }

  // ── Theme ─────────────────────────────────────
  function applyTheme(theme) {
    if (!panel || !trigger) return;
    var primary = theme.primaryColor || '#c8907e';
    var dark    = theme.primaryDark  || '#a86f5e';
    panel.style.setProperty('--agent-primary', primary);
    panel.style.setProperty('--agent-primary-dark', dark);
    trigger.style.setProperty('--agent-primary', primary);
    trigger.style.setProperty('--agent-primary-dark', dark);
  }

  // ── Build history sidebar DOM ─────────────────
  function buildHistorySidebar() {
    if (document.getElementById('agent-history-sidebar')) return;
    var sidebar = document.createElement('div');
    sidebar.id = 'agent-history-sidebar';
    sidebar.className = 'agent-history-sidebar';
    sidebar.innerHTML =
      '<div class="agent-history-header">' +
        '<span>Conversations</span>' +
        '<button class="agent-history-new-btn" id="agent-history-new">+ New</button>' +
      '</div>' +
      '<div id="agent-history-list"></div>';
    panel.insertBefore(sidebar, messagesEl);
    historySidebar = sidebar;

    document.getElementById('agent-history-new').addEventListener('click', startNewConversation);
  }

  // ── Build quick-prompt bar DOM ────────────────
  function buildQuickPromptBar() {
    if (!agentConfig.enabledTools.includes('quick_prompts')) return;
    if (!agentConfig.quickPrompts.length) return;
    if (document.getElementById('agent-quick-prompts')) return;

    var bar = document.createElement('div');
    bar.id = 'agent-quick-prompts';
    bar.className = 'agent-quick-prompts';
    agentConfig.quickPrompts.forEach(function (p) {
      var btn = document.createElement('button');
      btn.className = 'agent-quick-prompt-btn';
      btn.textContent = p.label;
      btn.addEventListener('click', function () {
        if (isLoading) return;
        inputEl.value = p.prompt;
        hideQuickPrompts();
        submitMessage();
      });
      bar.appendChild(btn);
    });

    var inputRow = panel.querySelector('.agent-input-row');
    if (inputRow) panel.insertBefore(bar, inputRow);
    quickPromptBar = bar;
  }

  function hideQuickPrompts() {
    if (quickPromptBar) {
      quickPromptBar.style.display = 'none';
      quickPromptsShown = false;
    }
  }

  // ── Event bindings ────────────────────────────
  function bindEvents() {
    trigger.addEventListener('click', togglePanel);
    closeBtn.addEventListener('click', closePanel);

    // History toggle button (injected into header)
    var historyBtn = document.getElementById('agent-history-btn');
    if (historyBtn) historyBtn.addEventListener('click', toggleHistory);

    // New chat button in header
    var newChatBtn = document.getElementById('agent-new-chat-btn');
    if (newChatBtn) newChatBtn.addEventListener('click', startNewConversation);

    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitMessage();
      }
    });
    inputEl.addEventListener('input', autoResize);
    sendBtn.addEventListener('click', submitMessage);
  }

  // ── Panel open / close ────────────────────────
  function togglePanel() {
    if (isOpen) closePanel(); else openPanel();
  }

  function openPanel() {
    isOpen = true;
    panel.classList.add('agent-panel--open');
    trigger.classList.add('agent-trigger--active');
    setTimeout(function () { if (inputEl) inputEl.focus(); }, 200);
    scrollToBottom();
  }

  function closePanel() {
    isOpen = false;
    panel.classList.remove('agent-panel--open');
    trigger.classList.remove('agent-trigger--active');
    if (historyVisible) closeHistory();
    if (abortController) {
      abortController.abort();
      abortController = null;
      setLoading(false);
    }
  }

  // ── History sidebar ───────────────────────────
  function toggleHistory() {
    if (historyVisible) closeHistory(); else openHistory();
  }

  function openHistory() {
    historyVisible = true;
    if (historySidebar) historySidebar.classList.add('open');
    var histBtn = document.getElementById('agent-history-btn');
    if (histBtn) histBtn.classList.add('agent-header-btn--active');
    renderConversationList();
  }

  function closeHistory() {
    historyVisible = false;
    if (historySidebar) historySidebar.classList.remove('open');
    var histBtn = document.getElementById('agent-history-btn');
    if (histBtn) histBtn.classList.remove('agent-header-btn--active');
  }

  // Load conversation list from Supabase
  // Adapted from jevehome-agent/client/src/hooks/useChat.js loadConversations()
  async function loadConversations() {
    var sb = window.supabaseClient;
    if (!sb) return;
    try {
      var _ref = await sb
        .from('agent_conversations')
        .select('id, title, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(50);
      conversations = _ref.data || [];
    } catch (e) {
      console.error('[Agent] Failed to load conversations:', e);
    }
  }

  // Date grouping — adapted from jevehome-agent/client/src/components/Sidebar.jsx groupByDate()
  function groupByDate(convs) {
    var now   = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var groups = {};
    var order  = [];

    convs.forEach(function (c) {
      var d    = new Date(c.updated_at || c.created_at);
      var diff = Math.floor((today - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
      var label;
      if (diff === 0)       label = 'Today';
      else if (diff === 1)  label = 'Yesterday';
      else if (diff <= 7)   label = 'Last 7 days';
      else if (diff <= 30)  label = 'Last 30 days';
      else                  label = d.toLocaleString('default', { month: 'long', year: 'numeric' });

      if (!groups[label]) { groups[label] = []; order.push(label); }
      groups[label].push(c);
    });
    return order.map(function (l) { return { label: l, items: groups[l] }; });
  }

  function renderConversationList() {
    loadConversations().then(function () {
      var list = document.getElementById('agent-history-list');
      if (!list) return;

      if (!conversations.length) {
        list.innerHTML = '<div class="agent-history-empty">No conversations yet.<br>Start chatting to see history here.</div>';
        return;
      }

      var groups = groupByDate(conversations);
      list.innerHTML = groups.map(function (g) {
        var items = g.items.map(function (c) {
          var isActive = c.id === currentConversationId ? ' active' : '';
          var title    = escHtml(c.title || 'New conversation');
          var d        = new Date(c.updated_at || c.created_at);
          var timeStr  = d.toLocaleDateString('default', { month: 'short', day: 'numeric' });
          return '<div class="agent-conv-item' + isActive + '" data-id="' + c.id + '">' +
            '<span class="agent-conv-title">' + title + '</span>' +
            '<span class="agent-conv-date">' + timeStr + '</span>' +
            '<button class="agent-conv-delete" data-id="' + c.id + '" title="Delete">✕</button>' +
          '</div>';
        }).join('');
        return '<div class="agent-conv-group">' +
          '<div class="agent-conv-group-label">' + escHtml(g.label) + '</div>' +
          items +
        '</div>';
      }).join('');

      // Bind click handlers
      list.querySelectorAll('.agent-conv-item').forEach(function (el) {
        el.addEventListener('click', function (e) {
          if (e.target.classList.contains('agent-conv-delete')) return;
          var id = el.getAttribute('data-id');
          loadConversation(id);
        });
      });

      list.querySelectorAll('.agent-conv-delete').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var id = btn.getAttribute('data-id');
          deleteConversation(id);
        });
      });
    });
  }

  // Load messages for a past conversation
  // Adapted from jevehome-agent/client/src/hooks/useChat.js loadConversation()
  async function loadConversation(id) {
    var sb = window.supabaseClient;
    if (!sb || !id) return;
    try {
      var _ref = await sb
        .from('agent_messages')
        .select('role, content')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true });

      var msgs = _ref.data || [];
      messagesEl.innerHTML = '';
      msgs.forEach(function (m) { appendMessage(m.role, m.content); });
      currentConversationId = id;
      hideQuickPrompts();
      closeHistory();
      scrollToBottom();
    } catch (e) {
      console.error('[Agent] Failed to load conversation:', e);
    }
  }

  async function deleteConversation(id) {
    var sb = window.supabaseClient;
    if (!sb) return;
    try {
      await sb.from('agent_conversations').delete().eq('id', id);
      conversations = conversations.filter(function (c) { return c.id !== id; });
      if (currentConversationId === id) {
        startNewConversation();
      }
      renderConversationList();
    } catch (e) {
      console.error('[Agent] Delete conversation failed:', e);
    }
  }

  function startNewConversation() {
    currentConversationId = null;
    messagesEl.innerHTML  = '';
    quickPromptsShown     = true;
    if (quickPromptBar) quickPromptBar.style.display = '';
    appendMessage('assistant', agentConfig.welcomeMessage);
    closeHistory();
    if (inputEl) { inputEl.value = ''; autoResize.call(inputEl); inputEl.focus(); }
  }

  // ── Message submit ────────────────────────────
  function submitMessage() {
    if (!inputEl || isLoading) return;
    var text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = '';
    autoResize.call(inputEl);
    hideQuickPrompts();
    sendMessage(text);
  }

  // ── Core send (SSE streaming) ─────────────────
  // Adapted from jevehome-agent/client/src/services/api.js sendMessage()
  async function sendMessage(text) {
    appendMessage('user', text);
    setLoading(true);

    var assistantBubble = createStreamingBubble();
    abortController = new AbortController();

    var streamedText = '';

    try {
      var session = await getSupabaseSession();
      if (!session) {
        finishStreamingBubble(assistantBubble, 'Session expired. Please refresh the page.', true);
        setLoading(false);
        return;
      }

      var body = { message: text, enabledTools: agentConfig.enabledTools };
      if (currentConversationId) body.conversationId = currentConversationId;

      var response = await fetch(FUNCTION_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
        body:    JSON.stringify(body),
        signal:  abortController.signal
      });

      if (!response.ok) {
        var errData = {};
        try { errData = await response.json(); } catch { /* ignore */ }
        throw new Error(errData.error || 'Server error ' + response.status);
      }

      // Read SSE stream — adapted from jevehome-agent/client/src/services/api.js
      var reader  = response.body.getReader();
      var decoder = new TextDecoder();
      var buffer  = '';

      while (true) {
        var chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });

        var parts = buffer.split('\n\n');
        buffer = parts.pop();

        for (var i = 0; i < parts.length; i++) {
          var line = parts[i].trim();
          if (!line.startsWith('data: ')) continue;
          var event;
          try { event = JSON.parse(line.slice(6)); } catch { continue; }

          if (event.type === 'chunk') {
            streamedText += event.text;
            updateStreamingBubble(assistantBubble, streamedText);
          } else if (event.type === 'done') {
            currentConversationId = event.conversationId || currentConversationId;
            finishStreamingBubble(assistantBubble, streamedText || 'Done.');
          } else if (event.type === 'error') {
            throw new Error(event.error || 'Unknown error from assistant.');
          }
        }
      }

    } catch (err) {
      if (err && err.name === 'AbortError') {
        if (!streamedText) {
          assistantBubble.parentNode && assistantBubble.parentNode.removeChild(assistantBubble);
        }
      } else {
        finishStreamingBubble(assistantBubble, (err && err.message) || 'Something went wrong. Please try again.', true);
      }
    } finally {
      abortController = null;
      setLoading(false);
    }
  }

  // ── Session helper ────────────────────────────
  async function getSupabaseSession() {
    try {
      if (window.supabaseClient) {
        var _ref = await window.supabaseClient.auth.getSession();
        return (_ref.data && _ref.data.session) ? _ref.data.session : null;
      }
    } catch (e) {
      console.error('[Agent] Session error:', e);
    }
    return null;
  }

  // ── DOM helpers ───────────────────────────────
  function appendMessage(role, text) {
    if (!messagesEl) return;
    var wrapper = createBubble(role, text);
    messagesEl.appendChild(wrapper);
    scrollToBottom();
    return wrapper;
  }

  function createBubble(role, text) {
    var wrapper = document.createElement('div');
    wrapper.className = 'agent-msg agent-msg--' + role;
    var bubble = document.createElement('div');
    bubble.className = 'agent-bubble';
    bubble.innerHTML = formatText(text);
    wrapper.appendChild(bubble);
    return wrapper;
  }

  function createStreamingBubble() {
    if (!messagesEl) return null;
    var wrapper = document.createElement('div');
    wrapper.className = 'agent-msg agent-msg--assistant';
    var bubble = document.createElement('div');
    bubble.className = 'agent-bubble agent-bubble--streaming';
    bubble.innerHTML = '<span class="agent-typing"><span></span><span></span><span></span></span>';
    wrapper.appendChild(bubble);
    messagesEl.appendChild(wrapper);
    scrollToBottom();
    return wrapper;
  }

  function updateStreamingBubble(wrapper, text) {
    if (!wrapper) return;
    var bubble = wrapper.querySelector('.agent-bubble');
    if (!bubble) return;
    bubble.classList.remove('agent-bubble--streaming');
    bubble.innerHTML = formatText(text);
    scrollToBottom();
  }

  function finishStreamingBubble(wrapper, text, isError) {
    if (!wrapper) return;
    var bubble = wrapper.querySelector('.agent-bubble');
    if (!bubble) return;
    bubble.classList.remove('agent-bubble--streaming');
    if (isError) bubble.classList.add('agent-bubble--error');
    bubble.innerHTML = formatText(text);
    scrollToBottom();
  }

  // Minimal markdown: bold + newlines
  function formatText(text) {
    if (!text) return '';
    var safe = String(text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    safe = safe.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    safe = safe.replace(/\n/g, '<br>');
    return safe;
  }

  function escHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function setLoading(state) {
    isLoading = state;
    if (sendBtn) sendBtn.disabled = state;
    if (inputEl) inputEl.disabled = state;
    if (trigger) trigger.classList.toggle('agent-trigger--loading', state);
  }

  function scrollToBottom() {
    if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function autoResize() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
  }

  // ── Wire into jevehome auth flow ──────────────
  // Wraps window.initApp so initAgent() runs automatically after login.
  document.addEventListener('DOMContentLoaded', function () {
    var original = window.initApp;
    window.initApp = function () {
      if (typeof original === 'function') original();
      initAgent();
    };
  });

  window.initAgent = initAgent;

})();
