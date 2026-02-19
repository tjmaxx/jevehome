/* ============================================
   AUTHENTICATION MODULE
   ============================================
   Handles sign-in, sign-up, sign-out, and
   session detection. Controls visibility of
   the fake landing page vs. the real content.
   Added: Email-based access restriction.
   ============================================ */

(function () {
  'use strict';

  // ── Access is granted by role in users_profile table ───────────────────────
  // Roles 'admin' and 'family' are allowed in. Manage access via Supabase
  // Dashboard → Table Editor → users_profile, or via the admin panel.
  // No emails are hardcoded here — keep personal data out of source code.

  // ── DOM references ────────────────────────
  var publicLanding     = null;
  var appContent        = null;
  var authModal         = null;
  var signOutFloat      = null;
  var accessRestricted  = null;

  // ── Wait for DOM then bootstrap ───────────
  document.addEventListener('DOMContentLoaded', function () {
    publicLanding    = document.getElementById('public-landing');
    appContent       = document.getElementById('app-content');
    authModal        = document.getElementById('auth-modal');
    signOutFloat     = document.getElementById('sign-out-float');
    accessRestricted = document.getElementById('access-restricted');

    bindAuthUI();
    checkSession();
  });

  // ── Bind all auth-related UI events ───────
  function bindAuthUI() {
    // Open modal
    var signInBtns = document.querySelectorAll('[data-auth-open]');
    signInBtns.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        openAuthModal();
      });
    });

    // Close modal
    var closeBtn = document.getElementById('auth-modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeAuthModal);
    }

    // Close on backdrop click
    if (authModal) {
      authModal.addEventListener('click', function (e) {
        if (e.target === authModal) closeAuthModal();
      });
    }

    // Tab switching (Sign In / Sign Up)
    var tabs = document.querySelectorAll('.auth-tab');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var target = this.getAttribute('data-tab');
        switchAuthTab(target);
      });
    });

    // Sign In form submit
    var signInForm = document.getElementById('signin-form');
    if (signInForm) {
      signInForm.addEventListener('submit', function (e) {
        e.preventDefault();
        handleSignIn();
      });
    }

    // Sign Up form submit
    var signUpForm = document.getElementById('signup-form');
    if (signUpForm) {
      signUpForm.addEventListener('submit', function (e) {
        e.preventDefault();
        handleSignUp();
      });
    }

    // Floating sign-out button
    if (signOutFloat) {
      signOutFloat.addEventListener('click', function (e) {
        e.preventDefault();
        handleSignOut();
      });
    }

    // Mobile nav sign out button
    var mobileSignOut = document.getElementById('mobile-sign-out-btn');
    if (mobileSignOut) {
      mobileSignOut.addEventListener('click', function (e) {
        e.preventDefault();
        handleSignOut();
      });
    }

    // Sign out from restricted page
    var restrictedSignOut = document.getElementById('restricted-sign-out-btn');
    if (restrictedSignOut) {
      restrictedSignOut.addEventListener('click', function (e) {
        e.preventDefault();
        handleSignOut();
      });
    }
  }

  // ── Modal helpers ─────────────────────────
  function openAuthModal() {
    if (authModal) {
      authModal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeAuthModal() {
    if (authModal) {
      authModal.classList.remove('active');
      document.body.style.overflow = '';
      clearAuthErrors();
    }
  }

  function switchAuthTab(target) {
    // Update tab buttons
    document.querySelectorAll('.auth-tab').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-tab') === target);
    });
    // Show/hide forms
    document.querySelectorAll('.auth-form').forEach(function (f) {
      f.classList.toggle('active', f.id === target + '-form');
    });
    clearAuthErrors();
  }

  function showAuthError(message) {
    var activeForm = document.querySelector('.auth-form.active');
    if (!activeForm) return;
    var errEl = activeForm.querySelector('.auth-error');
    if (errEl) {
      errEl.textContent = message;
      errEl.style.display = 'block';
    }
  }

  function clearAuthErrors() {
    document.querySelectorAll('.auth-error').forEach(function (el) {
      el.textContent = '';
      el.style.display = 'none';
    });
  }

  function setAuthLoading(isLoading) {
    var btns = document.querySelectorAll('.auth-submit-btn');
    btns.forEach(function (btn) {
      btn.disabled = isLoading;
      btn.textContent = isLoading ? 'Please wait...' : btn.getAttribute('data-label');
    });
  }

  // ── Check existing session on page load ───
  function checkSession() {
    var sb = window.supabaseClient;
    if (!sb) {
      // No Supabase configured — show landing
      showPublicLanding();
      return;
    }

    sb.auth.getSession().then(function (result) {
      var session = result.data.session;
      if (session) {
        onAuthenticated(session.user);
      } else {
        showPublicLanding();
      }
    }).catch(function () {
      showPublicLanding();
    });

    // Listen for auth state changes (e.g., token refresh, logout in another tab)
    sb.auth.onAuthStateChange(function (event, session) {
      if (event === 'SIGNED_OUT') {
        showPublicLanding();
      }
    });
  }

  // ── Sign In ───────────────────────────────
  function handleSignIn() {
    var sb = window.supabaseClient;
    if (!sb) return;

    var email    = document.getElementById('signin-email').value.trim();
    var password = document.getElementById('signin-password').value;

    if (!email || !password) {
      showAuthError('Please enter your email and password.');
      return;
    }

    setAuthLoading(true);

    sb.auth.signInWithPassword({ email: email, password: password })
      .then(function (result) {
        setAuthLoading(false);
        if (result.error) {
          showAuthError(result.error.message);
          return;
        }
        closeAuthModal();
        onAuthenticated(result.data.user);
      })
      .catch(function (err) {
        setAuthLoading(false);
        showAuthError('An unexpected error occurred. Please try again.');
      });
  }

  // ── Sign Up ───────────────────────────────
  function handleSignUp() {
    var sb = window.supabaseClient;
    if (!sb) return;

    var name     = document.getElementById('signup-name').value.trim();
    var email    = document.getElementById('signup-email').value.trim();
    var password = document.getElementById('signup-password').value;

    if (!email || !password) {
      showAuthError('Please fill in all required fields.');
      return;
    }

    if (password.length < 6) {
      showAuthError('Password must be at least 6 characters.');
      return;
    }

    setAuthLoading(true);

    sb.auth.signUp({
      email: email,
      password: password,
      options: {
        data: { display_name: name || 'Family Member' }
      }
    }).then(function (result) {
      setAuthLoading(false);
      if (result.error) {
        showAuthError(result.error.message);
        return;
      }
      // Some Supabase configs require email confirmation
      if (result.data.user && !result.data.session) {
        showAuthError('Check your email for a confirmation link, then sign in.');
        switchAuthTab('signin');
        return;
      }
      closeAuthModal();
      onAuthenticated(result.data.user);
    }).catch(function () {
      setAuthLoading(false);
      showAuthError('An unexpected error occurred. Please try again.');
    });
  }

  // ── Sign Out ──────────────────────────────
  function handleSignOut() {
    var sb = window.supabaseClient;
    if (!sb) return;

    sb.auth.signOut().then(function () {
      showPublicLanding();
    });
  }

  // ── View state management ─────────────────

  function showPublicLanding() {
    if (publicLanding)    publicLanding.style.display = '';
    if (appContent)       appContent.style.display = 'none';
    if (signOutFloat)     signOutFloat.style.display = 'none';
    if (accessRestricted) accessRestricted.style.display = 'none';
  }

  function showAccessRestricted() {
    if (publicLanding)    publicLanding.style.display = 'none';
    if (appContent)       appContent.style.display = 'none';
    if (signOutFloat)     signOutFloat.style.display = 'none';
    if (accessRestricted) accessRestricted.style.display = 'flex';
  }

  function showAppContent() {
    if (publicLanding)    publicLanding.style.display = 'none';
    if (appContent)       appContent.style.display = '';
    if (signOutFloat)     signOutFloat.style.display = 'flex';
    if (accessRestricted) accessRestricted.style.display = 'none';

    // Initialize the real app (gallery, animations, etc.)
    if (typeof window.initApp === 'function') {
      window.initApp();
    }
  }

  function onAuthenticated(user) {
    // Fetch user profile to check role
    fetchUserProfile(user.id).then(function (profile) {
      var role = profile.role || '';

      // Allow if role is 'admin' or 'family'
      if (role === 'admin' || role === 'family') {
        showAppContent();
      } else {
        showAccessRestricted();
      }
    }).catch(function () {
      // Profile fetch failed — deny access to be safe
      showAccessRestricted();
    });
  }

  function fetchUserProfile(userId) {
    var sb = window.supabaseClient;
    if (!sb) return Promise.resolve({ display_name: 'Family Member', role: '' });

    return sb.from('users_profile')
      .select('display_name, role')
      .eq('id', userId)
      .single()
      .then(function (result) {
        if (result.error || !result.data) {
          return { display_name: 'Family Member', role: '' };
        }
        return {
          display_name: result.data.display_name || 'Family Member',
          role: result.data.role || ''
        };
      })
      .catch(function () {
        return { display_name: 'Family Member', role: '' };
      });
  }

})();
