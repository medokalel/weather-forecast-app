/*
 * Copy this file to js/config.js and fill in your own values.
 *   cp js/config.example.js js/config.js
 *
 * js/config.js is listed in .gitignore, so it is never committed.
 * Commit config.example.js only (it contains no secrets).
 *
 * IMPORTANT: anything loaded by a browser can be read by visitors.
 * .gitignore keeps the key out of your repository; it does NOT hide it on a
 * deployed site. See "API key safety" in the README for the safer options.
 */
window.WEATHER_CONFIG = {
    // Get a free key at https://www.weatherapi.com/
    API_KEY: "YOUR_API_KEY_HERE",

    // Default endpoint. To use your own proxy (so the key stays server-side),
    // point this at it, e.g. "https://weather-proxy.example.workers.dev/v1",
    // and leave API_KEY empty. Remember to allow that origin in the
    // Content-Security-Policy meta tag in index.html.
    API_BASE: "https://api.weatherapi.com/v1",

    // City shown on the first visit, before anything is saved.
    DEFAULT_CITY: "Cairo"
};
