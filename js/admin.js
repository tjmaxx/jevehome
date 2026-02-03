/* ============================================
   ADMIN PANEL — js/admin.js
   ============================================
   Handles admin authentication, role verification,
   and CRUD operations on the site_config table.
   Added: Timeline editor and gallery ordering.
   ============================================ */

(function () {
  'use strict';

  // ── Timeline defaults (2015-2026) ────────────
  var TIMELINE_DEFAULTS = {
    2015: { title: 'Married!', desc: 'Our February wedding — the beginning of forever.' },
    2016: { title: 'Eric Tang Arrives', desc: 'A tiny miracle joined our family.' },
    2017: { title: 'Adventures as Three', desc: 'Exploring life together as a family.' },
    2018: { title: 'Growing Together', desc: 'Learning, loving, and building foundations.' },
    2019: { title: 'Ella Tang Joins Us', desc: 'Four hearts beating as one.' },
    2020: { title: 'Staying Strong', desc: 'Home became our sanctuary.' },
    2021: { title: 'A Family of Four', desc: 'Filling our home with laughter.' },
    2022: { title: 'Making Memories', desc: 'Every moment became precious.' },
    2023: { title: 'Exploring New Places', desc: 'Family adventures near and far.' },
    2024: { title: 'Stronger Than Ever', desc: 'Building traditions.' },
    2025: { title: 'A Decade of Love', desc: 'Ten incredible years together.' },
    2026: { title: '11 Years & Forever', desc: 'Here\'s to forever.' }
  };

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

  // Gallery ordering state
  var galleryOrder = [];
  var draggedItem = null;

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

    // Gallery order buttons
    var saveOrderBtn = document.getElementById('save-gallery-order-btn');
    var resetOrderBtn = document.getElementById('reset-gallery-order-btn');

    if (saveOrderBtn) {
      saveOrderBtn.addEventListener('click', function () {
        saveGalleryOrder();
      });
    }

    if (resetOrderBtn) {
      resetOrderBtn.addEventListener('click', function () {
        deleteGalleryOrder();
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
        loadTimelineEditor();
        loadGalleryOrder();
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

  // =============================================
  // TIMELINE EDITOR
  // =============================================

  function loadTimelineEditor() {
    var sb = window.supabaseClient;
    var grid = document.getElementById('timeline-editor-grid');
    if (!grid) return;

    // First load existing config
    var configPromise = sb ? sb.from('site_config')
      .select('config_key, config_value')
      .then(function (result) {
        var config = {};
        if (result.data) {
          result.data.forEach(function (row) {
            config[row.config_key] = row.config_value;
          });
        }
        return config;
      }) : Promise.resolve({});

    configPromise.then(function (config) {
      grid.innerHTML = '';
      var years = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

      years.forEach(function (year) {
        var defaults = TIMELINE_DEFAULTS[year] || { title: '', desc: '' };
        var photoKey = 'timeline_' + year;
        var titleKey = 'timeline_' + year + '_title';
        var descKey = 'timeline_' + year + '_desc';

        var card = document.createElement('div');
        card.className = 'timeline-year-card';

        var title = document.createElement('h4');
        title.textContent = year;
        card.appendChild(title);

        // Photo preview
        var preview = document.createElement('img');
        preview.className = 'timeline-preview';
        preview.alt = 'Preview';
        if (config[photoKey] && typeof getPhotoUrl === 'function') {
          getPhotoUrl(config[photoKey]).then(function (url) {
            if (url) preview.src = url;
          });
        }
        card.appendChild(preview);

        // Photo input
        var photoField = document.createElement('div');
        photoField.className = 'admin-field';
        var photoLabel = document.createElement('label');
        photoLabel.textContent = 'Photo filename';
        var photoInput = document.createElement('input');
        photoInput.type = 'text';
        photoInput.value = config[photoKey] || '';
        photoInput.placeholder = 'e.g., IMG_1234.JPG';
        photoInput.addEventListener('input', function () {
          var val = this.value.trim();
          if (val && typeof getPhotoUrl === 'function') {
            getPhotoUrl(val).then(function (url) {
              preview.src = url || '';
            });
          } else {
            preview.src = '';
          }
        });
        photoField.appendChild(photoLabel);
        photoField.appendChild(photoInput);
        card.appendChild(photoField);

        // Title input
        var titleField = document.createElement('div');
        titleField.className = 'admin-field';
        var titleLabel = document.createElement('label');
        titleLabel.textContent = 'Title';
        var titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.value = config[titleKey] || '';
        titleInput.placeholder = defaults.title;
        titleField.appendChild(titleLabel);
        titleField.appendChild(titleInput);
        card.appendChild(titleField);

        // Description input
        var descField = document.createElement('div');
        descField.className = 'admin-field';
        var descLabel = document.createElement('label');
        descLabel.textContent = 'Description';
        var descInput = document.createElement('textarea');
        descInput.value = config[descKey] || '';
        descInput.placeholder = defaults.desc;
        descField.appendChild(descLabel);
        descField.appendChild(descInput);
        card.appendChild(descField);

        // Save button
        var saveBtn = document.createElement('button');
        saveBtn.className = 'admin-save-btn';
        saveBtn.textContent = 'Save ' + year;
        saveBtn.addEventListener('click', function () {
          saveTimelineYear(year, photoInput.value, titleInput.value, descInput.value, saveBtn);
        });
        card.appendChild(saveBtn);

        grid.appendChild(card);
      });
    });
  }

  function saveTimelineYear(year, photo, title, desc, btn) {
    var sb = window.supabaseClient;
    if (!sb) return;

    btn.disabled = true;
    btn.textContent = 'Saving...';

    var photoKey = 'timeline_' + year;
    var titleKey = 'timeline_' + year + '_title';
    var descKey = 'timeline_' + year + '_desc';

    // Upsert all three values
    var upserts = [];
    if (photo.trim()) {
      upserts.push({ config_key: photoKey, config_value: photo.trim() });
    }
    if (title.trim()) {
      upserts.push({ config_key: titleKey, config_value: title.trim() });
    }
    if (desc.trim()) {
      upserts.push({ config_key: descKey, config_value: desc.trim() });
    }

    if (upserts.length === 0) {
      btn.disabled = false;
      btn.textContent = 'Save ' + year;
      showToast('Nothing to save — all fields are empty.', true);
      return;
    }

    sb.from('site_config')
      .upsert(upserts, { onConflict: 'config_key' })
      .then(function (result) {
        btn.disabled = false;
        if (result.error) {
          btn.textContent = 'Save ' + year;
          showToast('Save failed: ' + result.error.message, true);
          return;
        }
        btn.textContent = 'Saved!';
        btn.classList.add('saved');
        showToast('Timeline ' + year + ' updated.');
        loadConfigEntries(); // Refresh main table

        setTimeout(function () {
          btn.textContent = 'Save ' + year;
          btn.classList.remove('saved');
        }, 2000);
      });
  }

  // =============================================
  // GALLERY ORDERING
  // =============================================

  function loadGalleryOrder() {
    var sb = window.supabaseClient;
    var grid = document.getElementById('gallery-order-grid');
    if (!grid) return;

    // Load existing order from config
    var orderPromise = sb ? sb.from('site_config')
      .select('config_value')
      .eq('config_key', 'gallery_order')
      .single()
      .then(function (result) {
        if (result.data && result.data.config_value) {
          try {
            return JSON.parse(result.data.config_value);
          } catch (e) {
            return [];
          }
        }
        return [];
      })
      .catch(function () { return []; }) : Promise.resolve([]);

    orderPromise.then(function (order) {
      // Use saved order, or default to ALL_PHOTOS order
      var allPhotos = window.ALL_PHOTOS || [];

      if (order && order.length > 0) {
        // Put ordered photos first, then remaining
        var ordered = [];
        var remaining = allPhotos.slice();
        order.forEach(function (filename) {
          var idx = remaining.indexOf(filename);
          if (idx !== -1) {
            ordered.push(filename);
            remaining.splice(idx, 1);
          }
        });
        galleryOrder = ordered.concat(remaining);
      } else {
        galleryOrder = allPhotos.slice();
      }

      renderGalleryGrid();
    });
  }

  function renderGalleryGrid() {
    var grid = document.getElementById('gallery-order-grid');
    if (!grid) return;

    grid.innerHTML = '';

    // Only show first 24 photos for performance
    var displayPhotos = galleryOrder.slice(0, 24);

    displayPhotos.forEach(function (filename, index) {
      var item = document.createElement('div');
      item.className = 'gallery-order-item';
      item.setAttribute('draggable', 'true');
      item.setAttribute('data-filename', filename);
      item.setAttribute('data-index', index);

      var badge = document.createElement('span');
      badge.className = 'order-badge';
      badge.textContent = index + 1;
      item.appendChild(badge);

      var img = document.createElement('img');
      img.alt = filename;
      img.loading = 'lazy';

      if (typeof getPhotoUrl === 'function') {
        getPhotoUrl(filename).then(function (url) {
          if (url) img.src = url;
        });
      }

      item.appendChild(img);

      // Drag events
      item.addEventListener('dragstart', function (e) {
        draggedItem = this;
        this.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      item.addEventListener('dragend', function () {
        this.classList.remove('dragging');
        draggedItem = null;
        // Remove drag-over from all items
        grid.querySelectorAll('.drag-over').forEach(function (el) {
          el.classList.remove('drag-over');
        });
      });

      item.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (draggedItem && draggedItem !== this) {
          this.classList.add('drag-over');
        }
      });

      item.addEventListener('dragleave', function () {
        this.classList.remove('drag-over');
      });

      item.addEventListener('drop', function (e) {
        e.preventDefault();
        this.classList.remove('drag-over');

        if (!draggedItem || draggedItem === this) return;

        var fromIndex = parseInt(draggedItem.getAttribute('data-index'), 10);
        var toIndex = parseInt(this.getAttribute('data-index'), 10);

        // Reorder galleryOrder
        var moved = galleryOrder.splice(fromIndex, 1)[0];
        galleryOrder.splice(toIndex, 0, moved);

        // Re-render
        renderGalleryGrid();
      });

      grid.appendChild(item);
    });
  }

  function saveGalleryOrder() {
    var sb = window.supabaseClient;
    if (!sb) return;

    var btn = document.getElementById('save-gallery-order-btn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    var orderJson = JSON.stringify(galleryOrder);

    sb.from('site_config')
      .upsert({ config_key: 'gallery_order', config_value: orderJson }, { onConflict: 'config_key' })
      .then(function (result) {
        btn.disabled = false;
        if (result.error) {
          btn.textContent = 'Save Order';
          showToast('Save failed: ' + result.error.message, true);
          return;
        }
        btn.textContent = 'Saved!';
        btn.classList.add('saved');
        showToast('Gallery order saved.');
        loadConfigEntries();

        setTimeout(function () {
          btn.textContent = 'Save Order';
          btn.classList.remove('saved');
        }, 2000);
      });
  }

  function deleteGalleryOrder() {
    var sb = window.supabaseClient;
    if (!sb) return;

    if (!confirm('Reset gallery to random order? This will delete your custom order.')) return;

    var btn = document.getElementById('reset-gallery-order-btn');
    btn.disabled = true;
    btn.textContent = 'Resetting...';

    sb.from('site_config')
      .delete()
      .eq('config_key', 'gallery_order')
      .then(function (result) {
        btn.disabled = false;
        btn.textContent = 'Reset to Random';

        if (result.error) {
          showToast('Reset failed: ' + result.error.message, true);
          return;
        }

        // Reset to default order
        galleryOrder = (window.ALL_PHOTOS || []).slice();
        renderGalleryGrid();
        loadConfigEntries();
        showToast('Gallery order reset to random.');
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
