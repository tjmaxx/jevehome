/* ============================================
   THE TANGS — 11 Years of Us
   Main JavaScript
   ============================================
   MODIFIED: init() is now exposed as window.initApp()
   and called by auth.js after successful login.
   Added: loadSiteConfig() fetches photo paths from
   Supabase site_config table (with hardcoded fallbacks).
   Photos are loaded via Supabase Storage signed URLs
   using getPhotoUrl() / getPhotoUrls() from storage.js.
   UPDATED: Timeline built dynamically from config.
   Gallery order can be customized via gallery_order config.
   ============================================ */

(function () {
  'use strict';

  // ── Timeline defaults (2015-2026) ────────────
  var TIMELINE_DEFAULTS = {
    2015: {
      title: 'Married!',
      desc: 'Jia & Vickey — our February wedding marked the beginning of forever. Two hearts, one journey.'
    },
    2016: {
      title: 'Eric Tang Arrives',
      desc: 'A tiny miracle joined our family. Our hearts expanded in ways we never imagined possible. Parenthood changed everything beautifully.'
    },
    2017: {
      title: 'Adventures as Three',
      desc: 'Exploring life together as a family, creating memories, and watching Eric discover the world.'
    },
    2018: {
      title: 'Growing Together',
      desc: 'Learning, loving, and building the foundation for our growing family.'
    },
    2019: {
      title: 'Ella Tang Joins Us',
      desc: 'Our family became complete with the arrival of our second little one. Four hearts beating as one.'
    },
    2020: {
      title: 'Staying Strong',
      desc: 'A challenging year brought us closer. Home became our sanctuary, family our strength.'
    },
    2021: {
      title: 'A Family of Four',
      desc: 'Watching our kids grow together, filling our home with laughter and love.'
    },
    2022: {
      title: 'Making Memories',
      desc: 'From park days to cozy evenings at home, every moment became precious.'
    },
    2023: {
      title: 'Exploring New Places',
      desc: 'Family adventures near and far — every day is a gift we cherish together.'
    },
    2024: {
      title: 'Stronger Than Ever',
      desc: 'Nearly a decade of love, growth, and family. Building traditions that will last generations.'
    },
    2025: {
      title: 'A Decade of Love',
      desc: 'Ten incredible years together. Looking back at how far we\'ve come, grateful for every moment.'
    },
    2026: {
      title: '11 Years & Forever',
      desc: 'Eleven years of marriage, love, and family. Here\'s to the next eleven, and all the years after that.'
    }
  };

  // ── Gallery photo list (from photo-list.js) ───
  // Shuffle photos for variety, use gallery_order from config if available
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = a[i];
      a[i] = a[j];
      a[j] = temp;
    }
    return a;
  }

  var PHOTOS = []; // Will be set from window.ALL_PHOTOS
  var PHOTOS_PER_PAGE = 12;
  var photosLoaded = 0;
  var appInitialized = false;
  var photoCaptions = {}; // Loaded from config

  // Default romantic captions (used when no custom caption is set)
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
    "Love, laughter, and us",
    "Every moment with you is a gift",
    "Our beautiful journey together",
    "This is my happy place",
    "The moments that matter most",
    "Forever grateful for this",
    "My whole world in one photo",
    "These are the days we live for",
    "Nothing but love",
    "Our story, one photo at a time",
    "Blessed beyond measure"
  ];

  // ── Expose init as window.initApp ─────────
  // Called by auth.js after successful authentication.
  // Prevents running gallery/animations when content is hidden.
  window.initApp = function () {
    if (appInitialized) return;
    appInitialized = true;

    // Initialize PHOTOS from window.ALL_PHOTOS
    if (window.ALL_PHOTOS && window.ALL_PHOTOS.length) {
      PHOTOS = shuffle(window.ALL_PHOTOS);
    }

    // Load site config from Supabase, then initialize UI
    loadSiteConfig().then(function () {
      init();
    });
  };

  function init() {
    initNav();
    initHeroAnimations();
    initFloatingHearts();
    initScrollReveal();
    initCounterAnimation();
    initGallery();
    initLightbox();
    initSmoothScroll();
    initLogoEasterEgg();
    initKonamiCode();
    initReadWhen();
    initODOW();
  }

  // ── Load site config from Supabase ────────
  // Fetches photo paths for timeline/hero/message from the
  // site_config table. Falls back to hardcoded defaults if
  // Supabase is unavailable or not configured.
  function loadSiteConfig() {
    var sb = window.supabaseClient;
    if (!sb) {
      buildTimeline({});
      return Promise.resolve();
    }

    return sb.from('site_config')
      .select('config_key, config_value')
      .then(function (result) {
        if (result.error || !result.data) {
          buildTimeline({});
          return;
        }

        var config = {};
        result.data.forEach(function (row) {
          config[row.config_key] = row.config_value;
        });

        // Load photo captions from config
        Object.keys(config).forEach(function (key) {
          if (key.startsWith('caption_')) {
            var filename = key.replace('caption_', '');
            photoCaptions[filename] = config[key];
          }
        });

        // Check for gallery_order and reorder PHOTOS
        if (config.gallery_order) {
          try {
            var order = JSON.parse(config.gallery_order);
            if (Array.isArray(order) && order.length > 0) {
              // Build ordered array: photos in order first, then remaining shuffled
              var ordered = [];
              var remaining = PHOTOS.slice();
              order.forEach(function (filename) {
                var idx = remaining.indexOf(filename);
                if (idx !== -1) {
                  ordered.push(filename);
                  remaining.splice(idx, 1);
                }
              });
              PHOTOS = ordered.concat(remaining);
            }
          } catch (e) {
            // Invalid JSON, ignore
          }
        }

        // Build timeline from config
        buildTimeline(config);

        // Collect all filenames that need signed URLs
        var urlPromises = [];

        // Hero background
        if (config.hero_bg_photo) {
          urlPromises.push(
            getPhotoUrl(config.hero_bg_photo).then(function (url) {
              if (url) {
                var heroEl = document.querySelector('#app-content .hero');
                if (heroEl) {
                  heroEl.style.backgroundImage =
                    'linear-gradient(135deg, rgba(44,36,32,0.7) 0%, rgba(200,144,126,0.4) 100%), url(' + url + ')';
                }
              }
            })
          );
        }

        // Message background
        if (config.message_bg_photo) {
          urlPromises.push(
            getPhotoUrl(config.message_bg_photo).then(function (url) {
              if (url) {
                var msgEl = document.querySelector('#app-content .message-section');
                if (msgEl) {
                  msgEl.style.backgroundImage =
                    'linear-gradient(135deg, rgba(44,36,32,0.85) 0%, rgba(200,144,126,0.5) 100%), url(' + url + ')';
                }
              }
            })
          );
        }

        return Promise.all(urlPromises);
      })
      .catch(function () {
        // Silently fall back to defaults
        buildTimeline({});
      });
  }

  // ── Build Timeline dynamically ────────────
  // Config keys: timeline_YYYY (photo), timeline_YYYY_title, timeline_YYYY_desc
  function buildTimeline(config) {
    var container = document.getElementById('timeline-container');
    if (!container) return;

    container.innerHTML = '';
    var years = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

    years.forEach(function (year) {
      var defaults = TIMELINE_DEFAULTS[year] || { title: year.toString(), desc: '' };

      // Get from config or use defaults
      var photoKey = 'timeline_' + year;
      var titleKey = 'timeline_' + year + '_title';
      var descKey = 'timeline_' + year + '_desc';

      var photo = config[photoKey] || '';
      var title = config[titleKey] || defaults.title;
      var desc = config[descKey] || defaults.desc;

      // Create timeline item
      var item = document.createElement('div');
      item.className = 'timeline-item scroll-reveal';

      var dot = document.createElement('div');
      dot.className = 'timeline-dot';

      var content = document.createElement('div');
      content.className = 'timeline-content';

      // Image wrapper
      var imgWrapper = document.createElement('div');
      imgWrapper.className = 'timeline-image-wrapper';

      var img = document.createElement('img');
      img.className = 'timeline-image';
      img.alt = title;
      img.loading = 'lazy';
      img.src = '';

      // Load signed URL for photo if set
      if (photo && typeof getPhotoUrl === 'function') {
        getPhotoUrl(photo).then(function (url) {
          if (url) img.src = url;
        });
      }

      imgWrapper.appendChild(img);

      // Text content
      var textDiv = document.createElement('div');
      textDiv.className = 'timeline-text';

      var yearSpan = document.createElement('span');
      yearSpan.className = 'timeline-year';
      yearSpan.textContent = year;

      var titleH3 = document.createElement('h3');
      titleH3.className = 'timeline-title';
      titleH3.textContent = title;

      var descP = document.createElement('p');
      descP.className = 'timeline-desc';
      descP.textContent = desc;

      textDiv.appendChild(yearSpan);
      textDiv.appendChild(titleH3);
      textDiv.appendChild(descP);

      content.appendChild(imgWrapper);
      content.appendChild(textDiv);

      item.appendChild(dot);
      item.appendChild(content);
      container.appendChild(item);
    });
  }

  // ── Navigation ──────────────────────────────
  function initNav() {
    var nav = document.getElementById('nav');
    var toggle = document.getElementById('navToggle');
    var links = document.getElementById('navLinks');
    var backdrop = document.getElementById('navBackdrop');

    if (!nav || !toggle || !links) return;

    function closeMenu() {
      toggle.classList.remove('active');
      links.classList.remove('active');
      if (backdrop) backdrop.classList.remove('active');
      document.body.classList.remove('nav-open');
    }

    // Scroll state
    var lastScroll = 0;
    window.addEventListener('scroll', function () {
      var current = window.scrollY;

      if (current > 80) {
        nav.classList.add('nav-scrolled');
      } else {
        nav.classList.remove('nav-scrolled');
      }

      // Hide/show on scroll direction
      if (current > lastScroll && current > 300) {
        nav.classList.add('nav-hidden');
      } else {
        nav.classList.remove('nav-hidden');
      }
      lastScroll = current;
    });

    // Mobile toggle
    toggle.addEventListener('click', function () {
      var isOpen = links.classList.toggle('active');
      toggle.classList.toggle('active');
      if (backdrop) backdrop.classList.toggle('active', isOpen);
      document.body.classList.toggle('nav-open', isOpen);
    });

    // Close menu on link click
    links.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', closeMenu);
    });

    // Close menu on backdrop click
    if (backdrop) {
      backdrop.addEventListener('click', closeMenu);
    }

    // Active link tracking
    var sections = document.querySelectorAll('section[id]');
    window.addEventListener('scroll', function () {
      var scrollPos = window.scrollY + 200;
      sections.forEach(function (section) {
        var top = section.offsetTop;
        var height = section.offsetHeight;
        var id = section.getAttribute('id');
        var link = links.querySelector('a[href="#' + id + '"]');
        if (link) {
          if (scrollPos >= top && scrollPos < top + height) {
            links.querySelectorAll('a').forEach(function (a) { a.classList.remove('active'); });
            link.classList.add('active');
          }
        }
      });
    });
  }

  // ── Hero entrance animations ────────────────
  function initHeroAnimations() {
    var elements = document.querySelectorAll('.animate-on-load');
    elements.forEach(function (el) {
      var delay = parseInt(el.getAttribute('data-delay') || '0', 10);
      setTimeout(function () {
        el.classList.add('visible');
      }, delay);
    });
  }

  // ── Floating hearts in hero ─────────────────
  function initFloatingHearts() {
    var container = document.getElementById('heroParticles');
    if (!container) return;

    var heartSymbols = ['\u2665', '\u2764', '\u2661'];

    function createHeart() {
      var heart = document.createElement('span');
      heart.className = 'floating-heart';
      heart.textContent = heartSymbols[Math.floor(Math.random() * heartSymbols.length)];

      // Random properties
      var size = Math.random() * 20 + 10;
      var left = Math.random() * 100;
      var duration = Math.random() * 8 + 6;
      var delay = Math.random() * 4;
      var opacity = Math.random() * 0.3 + 0.1;

      heart.style.cssText =
        'position:absolute;' +
        'bottom:-20px;' +
        'left:' + left + '%;' +
        'font-size:' + size + 'px;' +
        'opacity:' + opacity + ';' +
        'animation:floatHeart ' + duration + 's ease-in-out ' + delay + 's infinite;' +
        'pointer-events:none;' +
        'color:var(--color-rose, #e8a0a0);';

      container.appendChild(heart);
    }

    // Create initial batch
    for (var i = 0; i < 15; i++) {
      createHeart();
    }
  }

  // ── Scroll Reveal (IntersectionObserver) ────
  function initScrollReveal() {
    var reveals = document.querySelectorAll('.scroll-reveal');

    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var delay = parseInt(entry.target.getAttribute('data-delay') || '0', 10);
            setTimeout(function () {
              entry.target.classList.add('revealed');
            }, delay);
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15, rootMargin: '0px 0px -50px 0px' });

      reveals.forEach(function (el) {
        observer.observe(el);
      });
    } else {
      // Fallback: show everything
      reveals.forEach(function (el) { el.classList.add('revealed'); });
    }
  }

  // ── Counter animation ───────────────────────
  function initCounterAnimation() {
    var counters = document.querySelectorAll('.counter-number');

    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.5 });

      counters.forEach(function (c) { observer.observe(c); });
    } else {
      counters.forEach(animateCounter);
    }
  }

  function animateCounter(el) {
    var target = parseInt(el.getAttribute('data-target'), 10);
    var duration = 2000;
    var startTime = null;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease out
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.floor(eased * target).toLocaleString();

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = target.toLocaleString();
      }
    }

    requestAnimationFrame(step);
  }

  // ── Photo Gallery ───────────────────────────
  function initGallery() {
    loadMorePhotos();

    var btn = document.getElementById('loadMoreBtn');
    if (btn) {
      btn.addEventListener('click', function () {
        loadMorePhotos();
        if (photosLoaded >= PHOTOS.length) {
          btn.style.display = 'none';
        }
      });
    }
  }

  function loadMorePhotos() {
    var grid = document.getElementById('galleryGrid');
    if (!grid || !PHOTOS.length) return;

    var start = photosLoaded;
    var end = Math.min(photosLoaded + PHOTOS_PER_PAGE, PHOTOS.length);
    var batch = PHOTOS.slice(start, end);

    photosLoaded = end;

    // Fetch signed URLs for the batch, then create gallery items
    getPhotoUrls(batch).then(function (urls) {
      for (var i = 0; i < batch.length; i++) {
        var item = createGalleryItem(batch[i], start + i, urls[i]);
        grid.appendChild(item);
      }

      // Hide button if all loaded
      if (photosLoaded >= PHOTOS.length) {
        var btn = document.getElementById('loadMoreBtn');
        if (btn) btn.style.display = 'none';
      }

      // Re-init scroll-reveal for new items
      initScrollReveal();
    });
  }

  function createGalleryItem(filename, index, signedUrl) {
    var item = document.createElement('div');
    item.className = 'gallery-item scroll-reveal';

    var img = document.createElement('img');
    img.src = signedUrl || '';
    img.alt = 'Family photo';
    img.className = 'gallery-image';
    img.loading = 'lazy';
    img.setAttribute('data-index', index);
    img.setAttribute('data-filename', filename);

    // Handle load errors gracefully
    img.onerror = function () {
      item.style.display = 'none';
    };

    var overlay = document.createElement('div');
    overlay.className = 'gallery-overlay';

    // Get caption - custom or random default
    var caption = photoCaptions[filename] || DEFAULT_CAPTIONS[index % DEFAULT_CAPTIONS.length];

    var captionEl = document.createElement('p');
    captionEl.className = 'gallery-caption';
    captionEl.textContent = caption;

    var icon = document.createElement('span');
    icon.className = 'gallery-icon';
    icon.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';

    overlay.appendChild(captionEl);
    overlay.appendChild(icon);
    item.appendChild(img);
    item.appendChild(overlay);

    // Click to open lightbox
    item.addEventListener('click', function () {
      openLightbox(index);
    });

    return item;
  }

  // ── Lightbox ────────────────────────────────
  var currentLightboxIndex = 0;

  function initLightbox() {
    var lightbox = document.getElementById('lightbox');
    var closeBtn = document.getElementById('lightboxClose');
    var prevBtn = document.getElementById('lightboxPrev');
    var nextBtn = document.getElementById('lightboxNext');

    if (!lightbox) return;

    closeBtn.addEventListener('click', closeLightbox);
    prevBtn.addEventListener('click', function () { navigateLightbox(-1); });
    nextBtn.addEventListener('click', function () { navigateLightbox(1); });

    // Click backdrop to close
    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox || e.target.classList.contains('lightbox-content')) {
        closeLightbox();
      }
    });

    // Keyboard navigation
    document.addEventListener('keydown', function (e) {
      if (!lightbox.classList.contains('active')) return;

      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') navigateLightbox(-1);
      if (e.key === 'ArrowRight') navigateLightbox(1);
    });

    // Touch/swipe support
    var touchStartX = 0;
    var touchEndX = 0;

    lightbox.addEventListener('touchstart', function (e) {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    lightbox.addEventListener('touchend', function (e) {
      touchEndX = e.changedTouches[0].screenX;
      var diff = touchStartX - touchEndX;
      if (Math.abs(diff) > 50) {
        if (diff > 0) navigateLightbox(1);    // swipe left → next
        else navigateLightbox(-1);             // swipe right → prev
      }
    }, { passive: true });
  }

  function openLightbox(index) {
    var lightbox = document.getElementById('lightbox');
    var img = document.getElementById('lightboxImg');

    currentLightboxIndex = index;
    getPhotoUrl(PHOTOS[index]).then(function (url) {
      img.src = url || '';
    });
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    var lightbox = document.getElementById('lightbox');
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
  }

  function navigateLightbox(direction) {
    var total = Math.min(photosLoaded, PHOTOS.length);
    currentLightboxIndex = (currentLightboxIndex + direction + total) % total;
    var img = document.getElementById('lightboxImg');
    img.style.opacity = '0';
    getPhotoUrl(PHOTOS[currentLightboxIndex]).then(function (url) {
      img.src = url || '';
      img.style.opacity = '1';
    });
  }

  // ── Smooth scroll ───────────────────────────
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        var targetId = this.getAttribute('href');
        var target = document.querySelector(targetId);
        if (target) {
          var offset = 70; // nav height
          var top = target.getBoundingClientRect().top + window.scrollY - offset;
          window.scrollTo({ top: top, behavior: 'smooth' });
        }
      });
    });
  }

  // ── Hidden Easter Egg on Logo ──────────────
  function initLogoEasterEgg() {
    var logo = document.querySelector('#app-content .nav-logo');
    if (!logo) return;

    var clickCount = 0;
    var clickTimer = null;
    var lastTapTime = 0;

    var messages = {
      7: {
        title: 'You found a secret!',
        text: 'Keep tapping if you want to know more...',
        icon: '✨'
      },
      14: {
        title: 'To my beautiful wife',
        text: 'Vickey, you are the best thing that ever happened to me. Every day with you is a gift.',
        icon: '💕'
      },
      21: {
        title: 'My Forever Promise',
        text: 'Vickey, thank you for 11 amazing years. For choosing me, for Eric & Ella, for everything. I fall more in love with you every single day. Here\'s to forever, my love.',
        icon: '💍'
      }
    };

    function handleTap(e) {
      // Prevent double-firing on touch devices
      var now = Date.now();
      if (now - lastTapTime < 100) return;
      lastTapTime = now;

      clickCount++;

      // Reset counter after 3 seconds of no clicks
      clearTimeout(clickTimer);
      clickTimer = setTimeout(function () {
        clickCount = 0;
      }, 3000);

      // Check for milestone
      if (messages[clickCount]) {
        e.preventDefault();
        showEasterEggMessage(messages[clickCount]);
      }
    }

    // Support both click and touch
    logo.addEventListener('click', handleTap);
    logo.addEventListener('touchend', function (e) {
      // Prevent ghost click
      e.preventDefault();
      handleTap(e);
    });
  }

  function showEasterEggMessage(msg) {
    // Remove existing message if any
    var existing = document.getElementById('easter-egg-message');
    if (existing) existing.remove();

    // Create overlay
    var overlay = document.createElement('div');
    overlay.id = 'easter-egg-message';
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:10001;' +
      'background:rgba(0,0,0,0.85);backdrop-filter:blur(8px);' +
      'display:flex;align-items:center;justify-content:center;' +
      'opacity:0;transition:opacity 0.4s ease;';

    // Create message box
    var box = document.createElement('div');
    box.style.cssText =
      'background:linear-gradient(135deg,#faf7f4,#f5ece3);' +
      'border-radius:20px;padding:48px 40px;max-width:420px;' +
      'text-align:center;transform:scale(0.9);' +
      'transition:transform 0.4s cubic-bezier(0.34,1.56,0.64,1);' +
      'box-shadow:0 25px 60px rgba(0,0,0,0.3);';

    var icon = document.createElement('div');
    icon.style.cssText = 'font-size:3rem;margin-bottom:16px;';
    icon.textContent = msg.icon;

    var title = document.createElement('h3');
    title.style.cssText =
      'font-family:"Playfair Display",Georgia,serif;' +
      'font-size:1.6rem;color:#3a2e28;margin-bottom:16px;';
    title.textContent = msg.title;

    var text = document.createElement('p');
    text.style.cssText =
      'font-family:"Inter",-apple-system,sans-serif;' +
      'font-size:1.05rem;line-height:1.8;color:#5a4e48;margin-bottom:24px;';
    text.textContent = msg.text;

    var closeBtn = document.createElement('button');
    closeBtn.style.cssText =
      'background:#c8907e;color:#fff;border:none;' +
      'padding:12px 32px;border-radius:30px;' +
      'font-family:"Inter",-apple-system,sans-serif;' +
      'font-size:0.9rem;font-weight:600;cursor:pointer;' +
      'transition:background 0.3s,transform 0.2s;';
    closeBtn.textContent = 'Close';
    closeBtn.onmouseover = function() { this.style.background = '#a86f5e'; };
    closeBtn.onmouseout = function() { this.style.background = '#c8907e'; };

    box.appendChild(icon);
    box.appendChild(title);
    box.appendChild(text);
    box.appendChild(closeBtn);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // Animate in
    requestAnimationFrame(function () {
      overlay.style.opacity = '1';
      box.style.transform = 'scale(1)';
    });

    // Close handlers
    function closeMessage() {
      overlay.style.opacity = '0';
      box.style.transform = 'scale(0.9)';
      setTimeout(function () {
        overlay.remove();
      }, 400);
    }

    closeBtn.addEventListener('click', closeMessage);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeMessage();
    });

    // Close on Escape
    var escHandler = function (e) {
      if (e.key === 'Escape') {
        closeMessage();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  // ── Konami Code Easter Egg ─────────────────
  // Desktop: ↑ ↑ ↓ ↓ ← → ← → B A
  // Mobile: Tap the "11" hero number 5 times quickly
  function initKonamiCode() {
    // Desktop keyboard version
    var konamiCode = [
      'ArrowUp', 'ArrowUp',
      'ArrowDown', 'ArrowDown',
      'ArrowLeft', 'ArrowRight',
      'ArrowLeft', 'ArrowRight',
      'KeyB', 'KeyA'
    ];
    var konamiIndex = 0;
    var konamiTimer = null;

    document.addEventListener('keydown', function (e) {
      // Don't trigger if typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      // Check if key matches next in sequence
      if (e.code === konamiCode[konamiIndex]) {
        konamiIndex++;

        // Reset after 2 seconds of no input
        clearTimeout(konamiTimer);
        konamiTimer = setTimeout(function () {
          konamiIndex = 0;
        }, 2000);

        // Complete sequence!
        if (konamiIndex === konamiCode.length) {
          konamiIndex = 0;
          clearTimeout(konamiTimer);
          triggerKonamiEasterEgg();
        }
      } else {
        // Wrong key, reset
        konamiIndex = 0;
      }
    });

    // Mobile touch version - tap the "11" hero number 5 times
    var heroNumber = document.querySelector('.hero-number');
    if (heroNumber) {
      var tapCount = 0;
      var tapTimer = null;
      var lastTapTime = 0;

      function handleHeroTap(e) {
        var now = Date.now();
        if (now - lastTapTime < 100) return; // Debounce
        lastTapTime = now;

        tapCount++;

        clearTimeout(tapTimer);
        tapTimer = setTimeout(function () {
          tapCount = 0;
        }, 2000);

        if (tapCount >= 5) {
          tapCount = 0;
          clearTimeout(tapTimer);
          e.preventDefault();
          triggerKonamiEasterEgg();
        }
      }

      heroNumber.addEventListener('click', handleHeroTap);
      heroNumber.addEventListener('touchend', function (e) {
        e.preventDefault();
        handleHeroTap(e);
      });

      // Make it tappable
      heroNumber.style.cursor = 'pointer';
    }
  }

  function triggerKonamiEasterEgg() {
    // Create heart explosion container
    var heartsContainer = document.createElement('div');
    heartsContainer.id = 'konami-hearts';
    heartsContainer.style.cssText =
      'position:fixed;inset:0;z-index:10000;pointer-events:none;overflow:hidden;';
    document.body.appendChild(heartsContainer);

    // Spawn many floating hearts
    var heartSymbols = ['❤️', '💕', '💖', '💗', '💓', '💝', '💘', '💞', '🥰', '😍'];
    var heartCount = 50;

    for (var i = 0; i < heartCount; i++) {
      (function (index) {
        setTimeout(function () {
          createKonamiHeart(heartsContainer, heartSymbols);
        }, index * 60);
      })(i);
    }

    // Show romantic message after hearts start
    setTimeout(function () {
      showKonamiMessage();
    }, 800);

    // Clean up hearts container after animation
    setTimeout(function () {
      heartsContainer.remove();
    }, 8000);
  }

  function createKonamiHeart(container, symbols) {
    var heart = document.createElement('div');
    var symbol = symbols[Math.floor(Math.random() * symbols.length)];
    var startX = Math.random() * 100;
    var size = Math.random() * 30 + 20;
    var duration = Math.random() * 3 + 4;
    var drift = (Math.random() - 0.5) * 200;

    heart.textContent = symbol;
    heart.style.cssText =
      'position:absolute;' +
      'bottom:-50px;' +
      'left:' + startX + '%;' +
      'font-size:' + size + 'px;' +
      'opacity:0;' +
      'transform:translateX(0) rotate(0deg);' +
      'transition:none;';

    container.appendChild(heart);

    // Animate using requestAnimationFrame for smooth motion
    var startTime = null;
    var startY = window.innerHeight + 50;

    function animate(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = (timestamp - startTime) / (duration * 1000);

      if (progress < 1) {
        var y = startY - (progress * (window.innerHeight + 150));
        var x = drift * Math.sin(progress * Math.PI * 2);
        var rotation = progress * 360;
        var opacity = progress < 0.1 ? progress * 10 : (progress > 0.8 ? (1 - progress) * 5 : 1);

        heart.style.transform = 'translateX(' + x + 'px) rotate(' + rotation + 'deg)';
        heart.style.bottom = (window.innerHeight - y) + 'px';
        heart.style.opacity = Math.min(opacity, 0.9);

        requestAnimationFrame(animate);
      } else {
        heart.remove();
      }
    }

    requestAnimationFrame(animate);
  }

  function showKonamiMessage() {
    // Remove existing if any
    var existing = document.getElementById('konami-message');
    if (existing) existing.remove();

    // Create overlay
    var overlay = document.createElement('div');
    overlay.id = 'konami-message';
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:10002;' +
      'background:rgba(58,46,40,0.9);backdrop-filter:blur(12px);' +
      'display:flex;align-items:center;justify-content:center;' +
      'opacity:0;transition:opacity 0.6s ease;';

    // Create content
    var content = document.createElement('div');
    content.style.cssText =
      'text-align:center;color:#faf7f4;padding:40px;' +
      'max-width:500px;transform:scale(0.9);' +
      'transition:transform 0.6s cubic-bezier(0.34,1.56,0.64,1);';

    var hearts = document.createElement('div');
    hearts.style.cssText = 'font-size:3rem;margin-bottom:20px;';
    hearts.textContent = '💕';

    var title = document.createElement('h2');
    title.style.cssText =
      'font-family:"Great Vibes",cursive;' +
      'font-size:3rem;margin-bottom:20px;' +
      'color:#d4a76a;';
    title.textContent = 'My Dearest Vickey';

    var message = document.createElement('p');
    message.style.cssText =
      'font-family:"Playfair Display",Georgia,serif;' +
      'font-size:1.3rem;line-height:2;font-style:italic;' +
      'margin-bottom:24px;';
    message.textContent =
      'In a world of 8 billion people, I found you. ' +
      'In a lifetime of moments, I choose you — every single day. ' +
      'You are my home, my heart, my everything.';

    var signature = document.createElement('p');
    signature.style.cssText =
      'font-family:"Great Vibes",cursive;' +
      'font-size:2rem;color:#e8b4b8;';
    signature.textContent = 'Forever yours, Jia';

    var closeHint = document.createElement('p');
    closeHint.style.cssText =
      'margin-top:32px;font-size:0.85rem;opacity:0.5;' +
      'font-family:"Inter",-apple-system,sans-serif;';
    closeHint.textContent = 'Click anywhere to close';

    content.appendChild(hearts);
    content.appendChild(title);
    content.appendChild(message);
    content.appendChild(signature);
    content.appendChild(closeHint);
    overlay.appendChild(content);
    document.body.appendChild(overlay);

    // Animate in
    requestAnimationFrame(function () {
      overlay.style.opacity = '1';
      content.style.transform = 'scale(1)';
    });

    // Close handler
    function closeOverlay() {
      overlay.style.opacity = '0';
      content.style.transform = 'scale(0.9)';
      setTimeout(function () {
        overlay.remove();
      }, 600);
      document.removeEventListener('keydown', escHandler);
    }

    overlay.addEventListener('click', closeOverlay);

    var escHandler = function (e) {
      if (e.key === 'Escape') closeOverlay();
    };
    document.addEventListener('keydown', escHandler);
  }

  // ── Read This When... ──────────────────────
  var readWhenMessages = {};
  var READ_WHEN_DEFAULTS = {
    sad: {
      title: 'When You Feel Sad',
      icon: '🤗',
      message: 'My love, sadness is temporary, but my love for you is forever. Whatever is weighing on your heart, remember that you are stronger than you know. I believe in you, and I\'m always here to hold you through the hard times. You are not alone — you have me, Eric, and Ella. We love you more than words can say.'
    },
    stressed: {
      title: 'When You Feel Stressed',
      icon: '💆',
      message: 'Take a deep breath, my love. Whatever is causing you stress right now, we will figure it out together. You don\'t have to carry everything alone. Let me share your burden. Remember: no deadline, no task, no problem is more important than your peace. Take a break. I\'ve got you.'
    },
    lonely: {
      title: 'When You Feel Lonely',
      icon: '🫂',
      message: 'Even when I\'m not physically next to you, my heart is always with you. Close your eyes and feel my arms around you. You are never truly alone — you are loved beyond measure. Our family\'s love surrounds you every moment of every day. I\'m just a call away.'
    },
    doubt: {
      title: 'When You Doubt Yourself',
      icon: '⭐',
      message: 'Stop right there. The woman I married is incredible, capable, and amazing. You\'ve accomplished so much — raising two beautiful kids, building our home, and being the heart of our family. Don\'t let doubt cloud your vision. I see how extraordinary you are, and I need you to see it too.'
    },
    angry: {
      title: 'When You\'re Angry at Me',
      icon: '😅',
      message: 'I\'m sorry. Whatever I did (or didn\'t do), I\'m truly sorry. You have every right to be upset, and I want to make it right. My love for you is bigger than any argument. Please give me a chance to understand and to do better. You mean everything to me.'
    },
    happy: {
      title: 'A Little Smile for You',
      icon: '😄',
      message: 'Did you know that you\'re the most beautiful person in the world to me? That your laugh is my favorite sound? That watching you with Eric and Ella fills my heart with so much joy? You came here to smile, so here it is: I love you, I adore you, and I\'m so grateful you\'re mine. 💕'
    },
    love: {
      title: 'You Are So Loved',
      icon: '💖',
      message: 'I love you. Not just today, but every single day since the moment I met you. You are the first thing I think about in the morning and the last thing on my mind at night. You gave me Eric and Ella. You gave me a home. You gave me everything. You are loved, cherished, and adored — always and forever.'
    },
    miss: {
      title: 'When You Miss Me',
      icon: '💑',
      message: 'I miss you too, always. Even when we\'re apart, you\'re in my thoughts constantly. Look at our photos, remember our laughs, and know that I\'m counting the moments until I can hold you again. Distance means nothing when someone means everything. I\'ll be with you soon, my love.'
    }
  };

  function initReadWhen() {
    var trigger = document.getElementById('read-when-trigger');
    var menu = document.getElementById('read-when-menu');
    var modal = document.getElementById('read-when-modal');

    if (!trigger || !menu || !modal) return;

    // Show the trigger button
    trigger.style.display = 'flex';

    // Load custom messages from config
    loadReadWhenMessages();

    // Open menu
    trigger.addEventListener('click', function () {
      menu.classList.add('active');
      document.body.style.overflow = 'hidden';
    });

    // Close menu
    var menuClose = menu.querySelector('.read-when-close');
    if (menuClose) {
      menuClose.addEventListener('click', closeMenu);
    }
    menu.addEventListener('click', function (e) {
      if (e.target === menu) closeMenu();
    });

    function closeMenu() {
      menu.classList.remove('active');
      document.body.style.overflow = '';
    }

    // Option buttons
    var options = menu.querySelectorAll('.read-when-option');
    options.forEach(function (opt) {
      opt.addEventListener('click', function () {
        var key = this.getAttribute('data-key');
        closeMenu();
        setTimeout(function () {
          showReadWhenMessage(key);
        }, 200);
      });
    });

    // Close modal
    var modalClose = modal.querySelector('.read-when-modal-close');
    if (modalClose) {
      modalClose.addEventListener('click', closeModal);
    }
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeModal();
    });

    function closeModal() {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }

    // Escape key closes both
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (modal.classList.contains('active')) {
          closeModal();
        } else if (menu.classList.contains('active')) {
          closeMenu();
        }
      }
    });
  }

  function loadReadWhenMessages() {
    var sb = window.supabaseClient;
    if (!sb) return;

    sb.from('site_config')
      .select('config_key, config_value')
      .like('config_key', 'readwhen_%')
      .then(function (result) {
        if (result.data) {
          result.data.forEach(function (row) {
            // Keys like: readwhen_sad_title, readwhen_sad_message
            readWhenMessages[row.config_key] = row.config_value;
          });
        }
      })
      .catch(function () {
        // Silently use defaults
      });
  }

  function showReadWhenMessage(key) {
    var modal = document.getElementById('read-when-modal');
    if (!modal) return;

    var defaults = READ_WHEN_DEFAULTS[key] || {
      title: 'A Message for You',
      icon: '💕',
      message: 'You are loved, always.'
    };

    // Check for custom messages from config
    var title = readWhenMessages['readwhen_' + key + '_title'] || defaults.title;
    var icon = readWhenMessages['readwhen_' + key + '_icon'] || defaults.icon;
    var message = readWhenMessages['readwhen_' + key + '_message'] || defaults.message;

    modal.querySelector('.read-when-modal-icon').textContent = icon;
    modal.querySelector('.read-when-modal-title').textContent = title;
    modal.querySelector('.read-when-modal-message').textContent = message;

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  // ── ODOW (One Day One Word) ───────────────────
  // Love notes from 2011-2012, displayed as animated sticky notes
  var odowEntries = [];
  var odowCurrentIndex = 0;
  var odowAutoplayTimer = null;
  var odowIsPlaying = false;

  function initODOW() {
    var sticky = document.getElementById('odowSticky');
    var textEl = document.getElementById('odowText');
    var dateEl = document.getElementById('odowDate');
    var prevBtn = document.getElementById('odowPrev');
    var nextBtn = document.getElementById('odowNext');
    var shuffleBtn = document.getElementById('odowShuffle');
    var autoplayBtn = document.getElementById('odowAutoplay');
    var currentEl = document.getElementById('odowCurrent');
    var totalEl = document.getElementById('odowTotal');

    if (!sticky || !textEl) return;

    // Load entries from Supabase
    loadODOWEntries().then(function () {
      if (odowEntries.length === 0) return;

      // Start at random position
      odowCurrentIndex = Math.floor(Math.random() * odowEntries.length);
      renderODOW();

      // Navigation
      if (prevBtn) {
        prevBtn.addEventListener('click', function () {
          navigateODOW(-1);
        });
      }
      if (nextBtn) {
        nextBtn.addEventListener('click', function () {
          navigateODOW(1);
        });
      }

      // Shuffle to random
      if (shuffleBtn) {
        shuffleBtn.addEventListener('click', function () {
          var newIndex = Math.floor(Math.random() * odowEntries.length);
          if (newIndex === odowCurrentIndex && odowEntries.length > 1) {
            newIndex = (newIndex + 1) % odowEntries.length;
          }
          odowCurrentIndex = newIndex;
          animateODOWTransition('random');
        });
      }

      // Autoplay
      if (autoplayBtn) {
        autoplayBtn.addEventListener('click', function () {
          if (odowIsPlaying) {
            stopODOWAutoplay();
          } else {
            startODOWAutoplay();
          }
        });
      }

      // Touch swipe support
      var touchStartX = 0;
      var touchEndX = 0;
      sticky.addEventListener('touchstart', function (e) {
        touchStartX = e.changedTouches[0].screenX;
      }, { passive: true });
      sticky.addEventListener('touchend', function (e) {
        touchEndX = e.changedTouches[0].screenX;
        handleODOWSwipe();
      }, { passive: true });

      function handleODOWSwipe() {
        var diff = touchStartX - touchEndX;
        if (Math.abs(diff) > 50) { // Min swipe distance
          if (diff > 0) {
            navigateODOW(1); // Swipe left = next
          } else {
            navigateODOW(-1); // Swipe right = prev
          }
        }
      }
    });
  }

  function loadODOWEntries() {
    var sb = window.supabaseClient;
    if (!sb) return Promise.resolve();

    return sb.from('odow')
      .select('id, content, note_date')
      .order('note_date', { ascending: true })
      .then(function (result) {
        if (result.data && result.data.length > 0) {
          odowEntries = result.data;
        }
      })
      .catch(function (err) {
        console.error('Error loading ODOW:', err);
      });
  }

  function renderODOW() {
    var textEl = document.getElementById('odowText');
    var dateEl = document.getElementById('odowDate');
    var currentEl = document.getElementById('odowCurrent');
    var totalEl = document.getElementById('odowTotal');

    if (!textEl || odowEntries.length === 0) return;

    var entry = odowEntries[odowCurrentIndex];
    textEl.textContent = entry.content;
    dateEl.textContent = formatODOWDate(entry.note_date);

    if (currentEl) currentEl.textContent = odowCurrentIndex + 1;
    if (totalEl) totalEl.textContent = odowEntries.length;
  }

  function formatODOWDate(dateStr) {
    if (!dateStr) return '';
    // Parse various date formats
    var parts;
    if (dateStr.includes('/')) {
      parts = dateStr.split('/');
      // Handle MM/DD/YYYY or M/D/YY
      var month = parseInt(parts[0], 10);
      var day = parseInt(parts[1], 10);
      var year = parts[2];
      if (year.length === 2) {
        year = '20' + year;
      }
      var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return months[month - 1] + ' ' + day + ', ' + year;
    }
    return dateStr;
  }

  function navigateODOW(direction) {
    var newIndex = odowCurrentIndex + direction;
    if (newIndex < 0) newIndex = odowEntries.length - 1;
    if (newIndex >= odowEntries.length) newIndex = 0;

    odowCurrentIndex = newIndex;
    animateODOWTransition(direction > 0 ? 'next' : 'prev');
  }

  function animateODOWTransition(direction) {
    var sticky = document.getElementById('odowSticky');
    if (!sticky) return;

    // Slide out
    sticky.classList.remove('slide-in');
    if (direction === 'next' || direction === 'random') {
      sticky.classList.add('slide-out-left');
    } else {
      sticky.classList.add('slide-out-right');
    }

    // After animation, update content and slide in
    setTimeout(function () {
      renderODOW();
      sticky.classList.remove('slide-out-left', 'slide-out-right');
      sticky.classList.add('slide-in');

      // Clean up class after animation
      setTimeout(function () {
        sticky.classList.remove('slide-in');
      }, 400);
    }, 280);
  }

  function startODOWAutoplay() {
    var autoplayBtn = document.getElementById('odowAutoplay');
    if (odowIsPlaying) return;

    odowIsPlaying = true;
    if (autoplayBtn) autoplayBtn.classList.add('playing');

    // Auto-advance every 5 seconds
    odowAutoplayTimer = setInterval(function () {
      navigateODOW(1);
    }, 5000);
  }

  function stopODOWAutoplay() {
    var autoplayBtn = document.getElementById('odowAutoplay');
    odowIsPlaying = false;
    if (autoplayBtn) autoplayBtn.classList.remove('playing');

    if (odowAutoplayTimer) {
      clearInterval(odowAutoplayTimer);
      odowAutoplayTimer = null;
    }
  }

})();
