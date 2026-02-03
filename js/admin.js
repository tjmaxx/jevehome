/* ============================================
   ADMIN PANEL — js/admin.js
   ============================================
   Handles admin authentication, role verification,
   and CRUD operations on the site_config table.
   ============================================ */

(function () {
  'use strict';

  // ── DOM references ────────────────────────
  var loginScreen   = document.getElementById('admin-login');
  var deniedScreen  = document.getElementById('admin-denied');
  var dashboard     = document.getElementById('admin-dashboard');
  var loginForm     = document.getElementById('admin-login-form');
  var loginError    = document.getElementById('admin-login-error');
  var loginBtn      = document.getElementById('admin-login-btn');
  var logoutBtn     = document.getElementById('admin-logout-btn');
  var configBody    = document.getElementById('admin-config-body');
  var addBtn        = document.getElementById('admin-add-btn');
  var toastEl       = document.getElementById('admin-toast');
  var userNameEl    = document.getElementById('admin-user-name');

  // ── Bootstrap ─────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    checkAdminSession();
    bindEvents();
  });

  // ── Event bindings ────────────────────────
  function bindEvents() {
    // Login form
    if (loginForm) {
      loginForm.addEventListener('submit', function (e) {
        e.preventDefault();
        handleLogin();
      });
    }

    // Logout
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        handleLogout();
      });
    }

    // Add new config entry
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        handleAddConfig();
      });
    }
  }

  // ── Check if user is already logged in ────
  function checkAdminSession() {
    var sb = window.supabaseClient;
    if (!sb) {
      showScreen('login');
      return;
    }

    sb.auth.getSession().then(function (result) {
      var session = result.data.session;
      if (session) {
        verifyAdminRole(session.user);
      } else {
        showScreen('login');
      }
    }).catch(function () {
      showScreen('login');
    });
  }

  // ── Login handler ─────────────────────────
  function handleLogin() {
    var sb = window.supabaseClient;
    if (!sb) {
      showLoginError('Supabase is not configured.');
      return;
    }

    var email    = document.getElementById('admin-email').value.trim();
    var password = document.getElementById('admin-password').value;

    if (!email || !password) {
      showLoginError('Please enter email and password.');
      return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = 'Signing in...';

    sb.auth.signInWithPassword({ email: email, password: password })
      .then(function (result) {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Sign In';

        if (result.error) {
          showLoginError(result.error.message);
          return;
        }
        verifyAdminRole(result.data.user);
      })
      .catch(function () {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Sign In';
        showLoginError('An unexpected error occurred.');
      });
  }

  // ── Verify the user has admin role ────────
  function verifyAdminRole(user) {
    var sb = window.supabaseClient;
    if (!sb) return;

    sb.from('users_profile')
      .select('display_name, role')
      .eq('id', user.id)
      .single()
      .then(function (result) {
        console.log('[admin] Profile query result:', JSON.stringify(result));

        if (result.error || !result.data) {
          console.error('[admin] Profile fetch failed:', result.error);
          showScreen('denied');
          return;
        }

        if (result.data.role !== 'admin') {
          console.log('[admin] Role is:', result.data.role, '(not admin)');
          showScreen('denied');
          return;
        }

        // Admin confirmed — show dashboard
        if (userNameEl) {
          userNameEl.textContent = result.data.display_name || user.email;
        }
        showScreen('dashboard');
        loadConfigEntries();
      })
      .catch(function () {
        showScreen('denied');
      });
  }

  // ── Logout handler ────────────────────────
  function handleLogout() {
    var sb = window.supabaseClient;
    if (!sb) return;

    sb.auth.signOut().then(function () {
      showScreen('login');
      if (configBody) configBody.innerHTML = '';
    });
  }

  // ── Screen switcher ───────────────────────
  function showScreen(name) {
    loginScreen.style.display  = name === 'login'     ? 'flex'  : 'none';
    deniedScreen.style.display = name === 'denied'    ? 'flex'  : 'none';
    dashboard.style.display    = name === 'dashboard' ? 'block' : 'none';
  }

  // ── Login error display ───────────────────
  function showLoginError(msg) {
    if (loginError) {
      loginError.textContent = msg;
      loginError.style.display = 'block';
    }
  }

  // ── Load all config entries ───────────────
  function loadConfigEntries() {
    var sb = window.supabaseClient;
    if (!sb || !configBody) return;

    sb.from('site_config')
      .select('id, config_key, config_value')
      .order('config_key')
      .then(function (result) {
        if (result.error) {
          showToast('Failed to load config: ' + result.error.message, true);
          return;
        }

        configBody.innerHTML = '';
        (result.data || []).forEach(function (row) {
          configBody.appendChild(createConfigRow(row));
        });
      });
  }

  // ── Create a table row for a config entry ─
  function createConfigRow(row) {
    var tr = document.createElement('tr');

    // Key cell
    var tdKey = document.createElement('td');
    tdKey.textContent = row.config_key;
    tdKey.style.fontWeight = '600';
    tdKey.style.fontFamily = 'monospace';
    tdKey.style.fontSize = '0.85rem';
    tr.appendChild(tdKey);

    // Value input cell
    var tdValue = document.createElement('td');
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'admin-config-input';
    input.value = row.config_value;
    input.setAttribute('data-id', row.id);
    input.setAttribute('data-original', row.config_value);

    // Update preview on input change — resolve filename to signed URL
    input.addEventListener('input', function () {
      var val = this.value.trim();
      if (val) {
        getPhotoUrl(val).then(function (url) {
          preview.src = url || val;
        });
      } else {
        preview.src = '';
      }
    });

    tdValue.appendChild(input);
    tr.appendChild(tdValue);

    // Preview cell
    var tdPreview = document.createElement('td');
    var preview = document.createElement('img');
    preview.className = 'admin-config-preview';
    preview.src = '';
    preview.alt = 'Preview';
    preview.onerror = function () {
      this.style.background = '#fee';
      this.style.border = '2px solid #e74c3c';
    };
    preview.onload = function () {
      this.style.background = '';
      this.style.border = '1px solid #eee';
    };
    // Load signed URL for initial preview
    if (row.config_value && typeof getPhotoUrl === 'function') {
      getPhotoUrl(row.config_value).then(function (url) {
        if (url) preview.src = url;
      });
    }

    tdPreview.appendChild(preview);
    tr.appendChild(tdPreview);

    // Action cell
    var tdAction = document.createElement('td');
    var saveBtn = document.createElement('button');
    saveBtn.className = 'admin-save-btn';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', function () {
      handleSaveConfig(row.id, input.value, saveBtn);
    });

    var deleteBtn = document.createElement('button');
    deleteBtn.className = 'admin-save-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.style.background = '#e74c3c';
    deleteBtn.style.color = '#fff';
    deleteBtn.style.marginLeft = '8px';
    deleteBtn.addEventListener('click', function () {
      handleDeleteConfig(row.id, tr);
    });

    tdAction.appendChild(saveBtn);
    tdAction.appendChild(deleteBtn);
    tr.appendChild(tdAction);

    return tr;
  }

  // ── Save a config entry ───────────────────
  function handleSaveConfig(id, newValue, btn) {
    var sb = window.supabaseClient;
    if (!sb) return;

    if (!newValue.trim()) {
      showToast('Photo path cannot be empty.', true);
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Saving...';

    sb.from('site_config')
      .update({ config_value: newValue.trim(), updated_at: new Date().toISOString() })
      .eq('id', id)
      .then(function (result) {
        btn.disabled = false;
        if (result.error) {
          btn.textContent = 'Save';
          showToast('Save failed: ' + result.error.message, true);
          return;
        }
        btn.textContent = 'Saved!';
        btn.classList.add('saved');
        showToast('Configuration updated successfully.');

        setTimeout(function () {
          btn.textContent = 'Save';
          btn.classList.remove('saved');
        }, 2000);
      });
  }

  // ── Delete a config entry ─────────────────
  function handleDeleteConfig(id, trElement) {
    if (!confirm('Delete this config entry? This cannot be undone.')) return;

    var sb = window.supabaseClient;
    if (!sb) return;

    sb.from('site_config')
      .delete()
      .eq('id', id)
      .then(function (result) {
        if (result.error) {
          showToast('Delete failed: ' + result.error.message, true);
          return;
        }
        trElement.remove();
        showToast('Config entry deleted.');
      });
  }

  // ── Add new config entry ──────────────────
  function handleAddConfig() {
    var sb = window.supabaseClient;
    if (!sb) return;

    var keyInput   = document.getElementById('new-config-key');
    var valueInput = document.getElementById('new-config-value');
    var key   = keyInput.value.trim();
    var value = valueInput.value.trim();

    if (!key || !value) {
      showToast('Both config key and photo path are required.', true);
      return;
    }

    addBtn.disabled = true;
    addBtn.textContent = 'Adding...';

    sb.from('site_config')
      .insert({ config_key: key, config_value: value })
      .select()
      .then(function (result) {
        addBtn.disabled = false;
        addBtn.textContent = 'Add Entry';

        if (result.error) {
          showToast('Add failed: ' + result.error.message, true);
          return;
        }

        // Add new row to table
        if (result.data && result.data[0] && configBody) {
          configBody.appendChild(createConfigRow(result.data[0]));
        }

        keyInput.value = '';
        valueInput.value = '';
        showToast('New config entry added.');
      });
  }

  // ── Toast notification ────────────────────
  var toastTimer = null;

  function showToast(message, isError) {
    if (!toastEl) return;

    toastEl.textContent = message;
    toastEl.className = 'admin-toast show' + (isError ? ' error' : '');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.className = 'admin-toast';
    }, 3000);
  }

})();
