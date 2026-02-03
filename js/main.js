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
      title: 'Where It All Began',
      desc: 'Jia & Vickey — two hearts found each other, and our love story began. The start of our greatest adventure.'
    },
    2016: {
      title: 'Building Our World',
      desc: 'Exploring life together, creating memories, and dreaming about the future side by side.'
    },
    2017: {
      title: 'Growing Together',
      desc: 'Learning, loving, and laying the foundation for the family we would become.'
    },
    2018: {
      title: 'Eric Tang Arrives',
      desc: 'A tiny miracle joined our family. Our hearts expanded in ways we never imagined possible. Parenthood changed everything beautifully.'
    },
    2019: {
      title: 'Adventures as Three',
      desc: 'Through every season, we grew stronger. From park days to cozy evenings at home, every moment became precious.'
    },
    2020: {
      title: 'Staying Strong',
      desc: 'A challenging year brought us closer. Home became our sanctuary, family our strength.'
    },
    2021: {
      title: 'Ella Tang Joins Us',
      desc: 'Our family became complete with the arrival of our second little one. Four hearts beating as one.'
    },
    2022: {
      title: 'A Family of Four',
      desc: 'Watching our kids grow together, filling our home with laughter and love.'
    },
    2023: {
      title: 'Making Memories',
      desc: 'Exploring new places, celebrating milestones — every day is a gift we cherish together.'
    },
    2024: {
      title: 'Stronger Than Ever',
      desc: 'Nearly a decade of love, growth, and family. Building traditions that will last generations.'
    },
    2025: {
      title: 'Married!',
      desc: 'Our February wedding — officially sealing our love after years of building a life together.'
    },
    2026: {
      title: '11 Years & Forever',
      desc: 'Eleven years of love, growth, and family. Here\'s to the next eleven, and all the years after that. Our story is just beginning.'
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

    if (!nav || !toggle || !links) return;

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
      toggle.classList.toggle('active');
      links.classList.toggle('active');
      document.body.classList.toggle('nav-open');
    });

    // Close menu on link click
    links.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        toggle.classList.remove('active');
        links.classList.remove('active');
        document.body.classList.remove('nav-open');
      });
    });

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

    var icon = document.createElement('span');
    icon.className = 'gallery-icon';
    icon.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>';

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

})();
