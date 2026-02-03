/* ============================================
   SUPABASE STORAGE — Signed URL Helper
   ============================================
   Provides getPhotoUrl() and getPhotoUrls() to
   fetch signed URLs from the private "photos"
   Supabase Storage bucket. Caches URLs in memory
   to avoid redundant API calls within a session.
   ============================================ */

(function () {
  'use strict';

  var BUCKET = 'photos';
  var SIGNED_URL_EXPIRY = 3600; // 1 hour in seconds
  var urlCache = {};

  /**
   * Get a signed URL for a single photo filename.
   * Returns a Promise that resolves to the signed URL string.
   */
  function getPhotoUrl(filename) {
    if (!filename) return Promise.resolve('');

    // Return cached URL if available
    if (urlCache[filename]) {
      return Promise.resolve(urlCache[filename]);
    }

    var sb = window.supabaseClient;
    if (!sb) return Promise.resolve('');

    return sb.storage
      .from(BUCKET)
      .createSignedUrl(filename, SIGNED_URL_EXPIRY)
      .then(function (result) {
        if (result.error || !result.data) {
          console.warn('[storage] Failed to get signed URL for:', filename, result.error);
          return '';
        }
        urlCache[filename] = result.data.signedUrl;
        return result.data.signedUrl;
      })
      .catch(function (err) {
        console.warn('[storage] Error getting signed URL for:', filename, err);
        return '';
      });
  }

  /**
   * Get signed URLs for an array of filenames.
   * Returns a Promise that resolves to an array of signed URL strings
   * in the same order as the input filenames.
   */
  function getPhotoUrls(filenames) {
    if (!filenames || !filenames.length) return Promise.resolve([]);

    // Separate cached from uncached
    var uncached = [];
    var uncachedIndices = [];

    filenames.forEach(function (f, i) {
      if (!urlCache[f]) {
        uncached.push(f);
        uncachedIndices.push(i);
      }
    });

    // All cached — return immediately
    if (uncached.length === 0) {
      return Promise.resolve(filenames.map(function (f) { return urlCache[f] || ''; }));
    }

    var sb = window.supabaseClient;
    if (!sb) return Promise.resolve(filenames.map(function () { return ''; }));

    return sb.storage
      .from(BUCKET)
      .createSignedUrls(uncached, SIGNED_URL_EXPIRY)
      .then(function (result) {
        if (result.error || !result.data) {
          console.warn('[storage] Batch signed URL error:', result.error);
          return filenames.map(function () { return ''; });
        }

        // Cache the new URLs
        result.data.forEach(function (item) {
          if (item.signedUrl && item.path) {
            urlCache[item.path] = item.signedUrl;
          }
        });

        // Return in original order
        return filenames.map(function (f) { return urlCache[f] || ''; });
      })
      .catch(function (err) {
        console.warn('[storage] Batch signed URL error:', err);
        return filenames.map(function () { return ''; });
      });
  }

  // Expose globally
  window.getPhotoUrl = getPhotoUrl;
  window.getPhotoUrls = getPhotoUrls;

})();
