/* ============================================
   ADMIN PANEL — js/admin.js
   ============================================
   Handles admin authentication, role verification,
   and CRUD operations on the site_config table.
   Added: Timeline editor and gallery ordering.
   ============================================ */

(function () {
  'use strict';

  // ── Read When defaults ───────────────────────
  var READWHEN_OPTIONS = [
    { key: 'sad', emoji: '😢', label: 'Feel sad' },
    { key: 'stressed', emoji: '😰', label: 'Feel stressed' },
    { key: 'lonely', emoji: '🥺', label: 'Feel lonely' },
    { key: 'doubt', emoji: '😔', label: 'Doubt yourself' },
    { key: 'angry', emoji: '😤', label: 'Feel angry at me' },
    { key: 'happy', emoji: '😊', label: 'Want to smile' },
    { key: 'love', emoji: '💕', label: 'Need to feel loved' },
    { key: 'miss', emoji: '🫂', label: 'Miss me' }
  ];

  // ── Timeline defaults (2011-2026) ────────────
  var TIMELINE_DEFAULTS = {
    2011: { title: 'Where It All Began', desc: 'Two students crossed paths at Virginia Tech.' },
    2012: { title: 'Long Distance Love', desc: 'Miles apart — Virginia Tech and Washington DC.' },
    2013: { title: 'Together Again', desc: 'Finally reunited! No more counting down the days.' },
    2014: { title: 'Building Our Future', desc: 'A year of dreams taking shape.' },
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
        loadReadWhenEditor();
        loadCaptionEditor();
        loadGalleryOrder();
        initODOWAdmin();
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
      var years = [2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

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
  // READ THIS WHEN EDITOR
  // =============================================

  function loadReadWhenEditor() {
    var sb = window.supabaseClient;
    var grid = document.getElementById('readwhen-editor-grid');
    if (!grid) return;

    // First load existing config
    var configPromise = sb ? sb.from('site_config')
      .select('config_key, config_value')
      .like('config_key', 'readwhen_%')
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

      READWHEN_OPTIONS.forEach(function (opt) {
        var messageKey = 'readwhen_' + opt.key + '_message';

        var card = document.createElement('div');
        card.className = 'readwhen-card';

        // Header
        var header = document.createElement('div');
        header.className = 'readwhen-card-header';

        var emoji = document.createElement('span');
        emoji.className = 'emoji';
        emoji.textContent = opt.emoji;

        var title = document.createElement('h4');
        title.textContent = opt.label;

        header.appendChild(emoji);
        header.appendChild(title);
        card.appendChild(header);

        // Message textarea
        var field = document.createElement('div');
        field.className = 'admin-field';

        var label = document.createElement('label');
        label.textContent = 'Custom message (leave blank for default)';
        label.style.fontSize = '0.75rem';
        label.style.display = 'block';
        label.style.marginBottom = '6px';
        label.style.color = '#666';

        var textarea = document.createElement('textarea');
        textarea.value = config[messageKey] || '';
        textarea.placeholder = 'Enter a supportive message...';

        field.appendChild(label);
        field.appendChild(textarea);
        card.appendChild(field);

        // Save button
        var saveBtn = document.createElement('button');
        saveBtn.className = 'admin-save-btn';
        saveBtn.textContent = 'Save';
        saveBtn.addEventListener('click', function () {
          saveReadWhenMessage(opt.key, textarea.value, saveBtn);
        });
        card.appendChild(saveBtn);

        grid.appendChild(card);
      });
    });
  }

  function saveReadWhenMessage(key, message, btn) {
    var sb = window.supabaseClient;
    if (!sb) return;

    btn.disabled = true;
    btn.textContent = 'Saving...';

    var configKey = 'readwhen_' + key + '_message';

    // If message is empty, delete the config entry (use default)
    if (!message.trim()) {
      sb.from('site_config')
        .delete()
        .eq('config_key', configKey)
        .then(function (result) {
          btn.disabled = false;
          if (result.error) {
            btn.textContent = 'Save';
            showToast('Failed to reset: ' + result.error.message, true);
            return;
          }
          btn.textContent = 'Reset!';
          showToast('Message reset to default.');
          loadConfigEntries();

          setTimeout(function () {
            btn.textContent = 'Save';
          }, 2000);
        });
      return;
    }

    // Upsert the message
    sb.from('site_config')
      .upsert({ config_key: configKey, config_value: message.trim() }, { onConflict: 'config_key' })
      .then(function (result) {
        btn.disabled = false;
        if (result.error) {
          btn.textContent = 'Save';
          showToast('Save failed: ' + result.error.message, true);
          return;
        }
        btn.textContent = 'Saved!';
        btn.classList.add('saved');
        showToast('Message saved.');
        loadConfigEntries();

        setTimeout(function () {
          btn.textContent = 'Save';
          btn.classList.remove('saved');
        }, 2000);
      });
  }

  // =============================================
  // PHOTO CAPTIONS EDITOR
  // =============================================

  var captionPhotosLoaded = 0;
  var CAPTIONS_PER_PAGE = 12;
  var captionConfig = {};

  var DEFAULT_CAPTIONS = [
    "A moment I'll treasure forever",
    "My heart smiles looking at this",
    "Pure happiness captured",
    "Love in its purest form",
    "This is what forever looks like",
    "My favorite people in one frame",
    "Memories we'll never forget",
    "The best days of our lives",
    "Where my heart belongs",
    "Love, laughter, and us"
  ];

  function loadCaptionEditor() {
    var sb = window.supabaseClient;
    var grid = document.getElementById('caption-editor-grid');
    var loadMoreBtn = document.getElementById('load-more-captions-btn');
    if (!grid) return;

    // Reset
    captionPhotosLoaded = 0;
    grid.innerHTML = '';

    // Load existing captions from config
    var configPromise = sb ? sb.from('site_config')
      .select('config_key, config_value')
      .like('config_key', 'caption_%')
      .then(function (result) {
        captionConfig = {};
        if (result.data) {
          result.data.forEach(function (row) {
            var filename = row.config_key.replace('caption_', '');
            captionConfig[filename] = row.config_value;
          });
        }
        return captionConfig;
      }) : Promise.resolve({});

    configPromise.then(function () {
      loadMoreCaptions();
    });

    // Load more button
    if (loadMoreBtn) {
      loadMoreBtn.onclick = function () {
        loadMoreCaptions();
      };
    }
  }

  function loadMoreCaptions() {
    var grid = document.getElementById('caption-editor-grid');
    var loadMoreBtn = document.getElementById('load-more-captions-btn');
    if (!grid) return;

    var allPhotos = window.ALL_PHOTOS || [];
    var start = captionPhotosLoaded;
    var end = Math.min(start + CAPTIONS_PER_PAGE, allPhotos.length);
    var batch = allPhotos.slice(start, end);

    captionPhotosLoaded = end;

    batch.forEach(function (filename, i) {
      var card = document.createElement('div');
      card.className = 'caption-card';

      var img = document.createElement('img');
      img.className = 'caption-card-image';
      img.alt = filename;
      if (typeof getPhotoUrl === 'function') {
        getPhotoUrl(filename).then(function (url) {
          if (url) img.src = url;
        });
      }
      card.appendChild(img);

      var input = document.createElement('input');
      input.type = 'text';
      input.value = captionConfig[filename] || '';
      input.placeholder = DEFAULT_CAPTIONS[(start + i) % DEFAULT_CAPTIONS.length];
      card.appendChild(input);

      var saveBtn = document.createElement('button');
      saveBtn.className = 'admin-save-btn';
      saveBtn.textContent = 'Save';
      saveBtn.addEventListener('click', function () {
        saveCaption(filename, input.value, saveBtn);
      });
      card.appendChild(saveBtn);

      grid.appendChild(card);
    });

    // Hide load more button if all loaded
    if (loadMoreBtn && captionPhotosLoaded >= allPhotos.length) {
      loadMoreBtn.style.display = 'none';
    }
  }

  function saveCaption(filename, caption, btn) {
    var sb = window.supabaseClient;
    if (!sb) return;

    btn.disabled = true;
    btn.textContent = 'Saving...';

    var configKey = 'caption_' + filename;

    // If caption is empty, delete (use default)
    if (!caption.trim()) {
      sb.from('site_config')
        .delete()
        .eq('config_key', configKey)
        .then(function (result) {
          btn.disabled = false;
          if (result.error) {
            btn.textContent = 'Save';
            showToast('Failed: ' + result.error.message, true);
            return;
          }
          btn.textContent = 'Reset!';
          delete captionConfig[filename];
          showToast('Caption reset to default.');
          setTimeout(function () { btn.textContent = 'Save'; }, 2000);
        });
      return;
    }

    sb.from('site_config')
      .upsert({ config_key: configKey, config_value: caption.trim() }, { onConflict: 'config_key' })
      .then(function (result) {
        btn.disabled = false;
        if (result.error) {
          btn.textContent = 'Save';
          showToast('Failed: ' + result.error.message, true);
          return;
        }
        btn.textContent = 'Saved!';
        btn.classList.add('saved');
        captionConfig[filename] = caption.trim();
        showToast('Caption saved.');
        setTimeout(function () {
          btn.textContent = 'Save';
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

  // =============================================
  // ODOW (One Day One Word) ADMIN
  // =============================================

  var odowEntries = [];
  var odowLoaded = 0;
  var ODOW_PER_PAGE = 20;
  var odowSearchTerm = '';

  function initODOWAdmin() {
    var addBtn = document.getElementById('odow-add-btn');
    var searchInput = document.getElementById('odow-search');
    var loadMoreBtn = document.getElementById('odow-load-more-btn');

    if (addBtn) {
      addBtn.addEventListener('click', addODOWEntry);
    }

    if (searchInput) {
      var searchTimeout;
      searchInput.addEventListener('input', function () {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(function () {
          odowSearchTerm = searchInput.value.trim().toLowerCase();
          odowLoaded = 0;
          loadODOWEntries(true);
        }, 300);
      });
    }

    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', function () {
        loadODOWEntries(false);
      });
    }

    // Initial load
    loadODOWEntries(true);
  }

  function loadODOWEntries(reset) {
    var sb = window.supabaseClient;
    var list = document.getElementById('odow-entries-list');
    var countEl = document.getElementById('odow-count');
    var loadMoreBtn = document.getElementById('odow-load-more-btn');

    if (!sb || !list) return;

    if (reset) {
      odowLoaded = 0;
      list.innerHTML = '<p style="text-align:center;color:#888;padding:20px;">Loading...</p>';
    }

    var query = sb.from('odow')
      .select('id, content, note_date', { count: 'exact' })
      .order('note_date', { ascending: true })
      .range(odowLoaded, odowLoaded + ODOW_PER_PAGE - 1);

    if (odowSearchTerm) {
      query = query.ilike('content', '%' + odowSearchTerm + '%');
    }

    query.then(function (result) {
      if (result.error) {
        list.innerHTML = '<p style="text-align:center;color:#e74c3c;">Error loading entries</p>';
        return;
      }

      var entries = result.data || [];
      var total = result.count || 0;

      if (countEl) countEl.textContent = total;

      if (reset) {
        list.innerHTML = '';
      }

      if (entries.length === 0 && odowLoaded === 0) {
        list.innerHTML = '<p style="text-align:center;color:#888;padding:20px;">No entries found</p>';
        if (loadMoreBtn) loadMoreBtn.style.display = 'none';
        return;
      }

      entries.forEach(function (entry) {
        var card = createODOWCard(entry);
        list.appendChild(card);
      });

      odowLoaded += entries.length;

      // Show/hide load more button
      if (loadMoreBtn) {
        loadMoreBtn.style.display = odowLoaded < total ? 'inline-block' : 'none';
      }
    });
  }

  function createODOWCard(entry) {
    var card = document.createElement('div');
    card.className = 'odow-entry-card';
    card.setAttribute('data-id', entry.id);

    card.innerHTML =
      '<div class="odow-entry-content">' + escapeHtml(entry.content) + '</div>' +
      '<div class="odow-entry-date">' + escapeHtml(entry.note_date) + '</div>' +
      '<div class="odow-entry-actions">' +
        '<button class="odow-edit-btn" title="Edit">&#9998;</button>' +
        '<button class="odow-delete-btn" title="Delete">&#10005;</button>' +
      '</div>' +
      '<div class="odow-entry-edit">' +
        '<textarea class="edit-content" rows="3">' + escapeHtml(entry.content) + '</textarea>' +
        '<input type="text" class="edit-date" value="' + escapeHtml(entry.note_date) + '">' +
        '<div class="odow-entry-edit-actions">' +
          '<button class="save-edit-btn">Save</button>' +
          '<button class="cancel-edit-btn">Cancel</button>' +
        '</div>' +
      '</div>';

    // Edit button
    card.querySelector('.odow-edit-btn').addEventListener('click', function () {
      card.classList.add('editing');
    });

    // Delete button
    card.querySelector('.odow-delete-btn').addEventListener('click', function () {
      if (confirm('Delete this entry?')) {
        deleteODOWEntry(entry.id, card);
      }
    });

    // Save edit
    card.querySelector('.save-edit-btn').addEventListener('click', function () {
      var newContent = card.querySelector('.edit-content').value.trim();
      var newDate = card.querySelector('.edit-date').value.trim();
      if (newContent) {
        updateODOWEntry(entry.id, newContent, newDate, card);
      }
    });

    // Cancel edit
    card.querySelector('.cancel-edit-btn').addEventListener('click', function () {
      card.classList.remove('editing');
      card.querySelector('.edit-content').value = entry.content;
      card.querySelector('.edit-date').value = entry.note_date;
    });

    return card;
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function addODOWEntry() {
    var sb = window.supabaseClient;
    var contentEl = document.getElementById('odow-new-content');
    var dateEl = document.getElementById('odow-new-date');
    var btn = document.getElementById('odow-add-btn');

    if (!sb || !contentEl || !dateEl) return;

    var content = contentEl.value.trim();
    var noteDate = dateEl.value.trim();

    if (!content) {
      showToast('Please enter note content', true);
      return;
    }

    if (!noteDate) {
      // Default to today's date
      var today = new Date();
      noteDate = (today.getMonth() + 1) + '/' + today.getDate() + '/' + today.getFullYear();
    }

    btn.disabled = true;
    btn.textContent = 'Adding...';

    sb.from('odow')
      .insert({ content: content, note_date: noteDate })
      .then(function (result) {
        btn.disabled = false;
        btn.textContent = 'Add Entry';

        if (result.error) {
          showToast('Failed to add: ' + result.error.message, true);
          return;
        }

        showToast('Entry added!');
        contentEl.value = '';
        dateEl.value = '';
        loadODOWEntries(true);
      });
  }

  function updateODOWEntry(id, content, noteDate, card) {
    var sb = window.supabaseClient;
    if (!sb) return;

    sb.from('odow')
      .update({ content: content, note_date: noteDate })
      .eq('id', id)
      .then(function (result) {
        if (result.error) {
          showToast('Failed to update: ' + result.error.message, true);
          return;
        }

        showToast('Entry updated!');
        card.classList.remove('editing');
        card.querySelector('.odow-entry-content').textContent = content;
        card.querySelector('.odow-entry-date').textContent = noteDate;
      });
  }

  function deleteODOWEntry(id, card) {
    var sb = window.supabaseClient;
    if (!sb) return;

    sb.from('odow')
      .delete()
      .eq('id', id)
      .then(function (result) {
        if (result.error) {
          showToast('Failed to delete: ' + result.error.message, true);
          return;
        }

        showToast('Entry deleted.');
        card.remove();

        // Update count
        var countEl = document.getElementById('odow-count');
        if (countEl) {
          var current = parseInt(countEl.textContent, 10) || 0;
          countEl.textContent = Math.max(0, current - 1);
        }
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
