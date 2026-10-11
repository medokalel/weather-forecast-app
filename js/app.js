/* ==========================================================
   Weather forecast app
   - Search suggestions (WeatherAPI search.json), debounced
   - Latest-request-wins: stale requests are aborted (AbortController)
   - Timeouts, typed errors, friendly messages
   - °C / °F toggle and last city persisted in localStorage
   - Falls back to the last saved forecast when the network fails
   - API text is only ever written with textContent (no innerHTML)
   ========================================================== */
(function () {
    "use strict";

    // ---------- Config ----------
    const CFG = Object.assign(
        {
            API_KEY: "",
            API_BASE: "https://api.weatherapi.com/v1",
            DEFAULT_CITY: "Cairo",
            DEBOUNCE_MS: 300,
            TIMEOUT_MS: 10000,
            MIN_QUERY_LENGTH: 2,
            MAX_SUGGESTIONS: 6
        },
        window.WEATHER_CONFIG || {}
    );

    const hasKey = Boolean(CFG.API_KEY) && CFG.API_KEY !== "YOUR_API_KEY_HERE";
    const usesOwnProxy = !/^https:\/\/api\.weatherapi\.com(\/|$)/.test(CFG.API_BASE);
    const configured = hasKey || usesOwnProxy;

    const FALLBACK_ICON = "assets/img/fallback-icon.png";
    const KEY_CITY = "weather.city";
    const KEY_UNIT = "weather.unit";
    const KEY_CACHE = "weather.cache";

    // ---------- DOM ----------
    const $ = (sel, root) => (root || document).querySelector(sel);
    const form = $("#search-form");
    const input = $("#search-input");
    const list = $("#suggestions");
    const locateBtn = $("#locate-btn");
    const cards = $("#cards");
    const notice = $("#notice");
    const noticeText = $("#notice-text");
    const retryBtn = $("#retry-btn");
    const statusEl = $("#status");
    const unitButtons = document.querySelectorAll(".unit-btn");

    const todayEls = {
        name: $("#today-name"),
        date: $("#today-date"),
        place: $("#place"),
        temp: $("#today-temp"),
        unit: $("#today-unit"),
        icon: $("#today-icon"),
        condition: $("#today-condition"),
        feels: $("#today-feels"),
        rain: $("#today-rain"),
        wind: $("#today-wind"),
        dir: $("#today-dir"),
        updated: $("#today-updated")
    };

    const dayEls = Array.from(document.querySelectorAll(".card--day")).map((card) => ({
        name: $('[data-field="name"]', card),
        icon: $('[data-field="icon"]', card),
        max: $('[data-field="max"]', card),
        min: $('[data-field="min"]', card),
        text: $('[data-field="text"]', card),
        rain: $('[data-field="rain"]', card)
    }));

    // ---------- State ----------
    const state = {
        unit: "c",
        model: null,        // normalized forecast currently on screen
        city: null,         // { label, q } last requested city
        suggestions: [],
        active: -1
    };

    let forecastCtl = null;   // AbortController for the in-flight forecast
    let suggestCtl = null;    // AbortController for the in-flight suggestions
    let debounceTimer = null;
    const suggestCache = new Map();

    // ---------- Storage (can throw in private mode / when blocked) ----------
    const store = {
        get(key, fallback) {
            try {
                const raw = localStorage.getItem(key);
                return raw === null ? fallback : JSON.parse(raw);
            } catch (_) {
                return fallback;
            }
        },
        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (_) { /* storage unavailable: the app still works */ }
        }
    };

    // ---------- Errors ----------
    class WeatherError extends Error {
        constructor(kind) {
            super(kind);
            this.kind = kind;
        }
    }

    const API_CODE_KIND = {
        1002: "auth", 2006: "auth", 2008: "auth",
        2007: "quota",
        1003: "notfound", 1005: "notfound", 1006: "notfound",
        9999: "server"
    };

    function kindFromResponse(status, body) {
        const code = body && body.error && body.error.code;
        if (code && API_CODE_KIND[code]) return API_CODE_KIND[code];
        if (status === 401 || status === 403) return "auth";
        if (status === 429) return "quota";
        if (status >= 500) return "server";
        if (status >= 400) return "notfound";
        return "badresponse";
    }

    function messageFor(err, city) {
        switch (err.kind) {
            case "config":
                return "Add your WeatherAPI key to js/config.js to load forecasts. The README explains how.";
            case "auth":
                return "The weather service rejected this app's API key. If you run this app, check js/config.js.";
            case "quota":
                return "The weather service's request limit has been reached. Try again later.";
            case "notfound":
                return 'We couldn\'t find "' + ((city && city.label) || "that place") +
                    '". Check the spelling or pick a suggestion.';
            case "timeout":
                return "The weather service took too long to respond. Check your connection and try again.";
            case "network":
                return "Can't reach the weather service. Check your connection and try again.";
            case "server":
                return "The weather service had a problem. Try again in a moment.";
            default:
                return "The weather service sent data this app couldn't read. Try again.";
        }
    }

    // ---------- HTTP ----------
    /**
     * GET {API_BASE}/{path}. Rejects with WeatherError:
     * aborted (caller cancelled), timeout, network, auth, quota, notfound, server, badresponse.
     */
    async function request(path, params, signal) {
        if (!configured) throw new WeatherError("config");
        if (signal.aborted) throw new WeatherError("aborted");

        const url = new URL(CFG.API_BASE.replace(/\/+$/, "") + "/" + path);
        if (hasKey) url.searchParams.set("key", CFG.API_KEY);
        Object.keys(params).forEach((k) => url.searchParams.set(k, params[k]));

        // One internal controller lets us tell "caller cancelled" from "we timed out".
        const guard = new AbortController();
        let timedOut = false;
        const timer = setTimeout(() => { timedOut = true; guard.abort(); }, CFG.TIMEOUT_MS);
        const relay = () => guard.abort();
        signal.addEventListener("abort", relay, { once: true });

        try {
            const res = await fetch(url, { signal: guard.signal, headers: { Accept: "application/json" } });
            let body = null;
            try {
                body = await res.json();
            } catch (err) {
                if (guard.signal.aborted) throw err;   // aborted while reading the body
                /* otherwise: non-JSON body, handled below */
            }
            if (!res.ok || (body && body.error)) throw new WeatherError(kindFromResponse(res.status, body));
            if (body === null) throw new WeatherError("badresponse");
            return body;
        } catch (err) {
            if (err instanceof WeatherError) throw err;
            if (signal.aborted) throw new WeatherError("aborted");
            if (timedOut) throw new WeatherError("timeout");
            throw new WeatherError("network");
        } finally {
            clearTimeout(timer);
            signal.removeEventListener("abort", relay);
        }
    }

    // ---------- Data shaping ----------
    function num(v) {
        const n = Number(v);
        if (v === null || v === "" || !Number.isFinite(n)) throw new Error("not a number");
        return n;
    }

    /** Reduce the API payload to just what the UI needs; throw badresponse if malformed. */
    function normalize(raw) {
        try {
            const days = raw.forecast.forecastday;
            if (!Array.isArray(days) || days.length === 0) throw new Error("no days");
            const cur = raw.current;
            const loc = raw.location;
            return {
                city: String(loc.name),
                region: String(loc.region || ""),
                country: String(loc.country || ""),
                lat: num(loc.lat),
                lon: num(loc.lon),
                updated: String(cur.last_updated || ""),
                current: {
                    tempC: num(cur.temp_c), tempF: num(cur.temp_f),
                    feelsC: num(cur.feelslike_c), feelsF: num(cur.feelslike_f),
                    text: String(cur.condition.text),
                    icon: String(cur.condition.icon || ""),
                    windKph: num(cur.wind_kph), windMph: num(cur.wind_mph),
                    dir: String(cur.wind_dir || ""),
                    rain: Number(days[0].day.daily_chance_of_rain) || 0
                },
                days: days.slice(0, 3).map((d) => ({
                    date: String(d.date),
                    maxC: num(d.day.maxtemp_c), maxF: num(d.day.maxtemp_f),
                    minC: num(d.day.mintemp_c), minF: num(d.day.mintemp_f),
                    text: String(d.day.condition.text),
                    icon: String(d.day.condition.icon || ""),
                    rain: Number(d.day.daily_chance_of_rain) || 0
                }))
            };
        } catch (_) {
            throw new WeatherError("badresponse");
        }
    }

    function isModel(m) {
        return Boolean(m && m.current && Array.isArray(m.days) && m.days.length > 0 && typeof m.city === "string");
    }

    // ---------- Formatting ----------
    const weekdayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" });
    const dayMonthFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });

    /** "2026-10-11" is the location's local date: format it as-is, never shift it by the viewer's timezone. */
    function parseISODate(iso) {
        const [y, m, d] = iso.split("-").map(Number);
        const date = new Date(Date.UTC(y, m - 1, d));
        if (Number.isNaN(date.getTime())) throw new Error("bad date");
        return date;
    }

    const COMPASS = {
        N: "North", NNE: "North-northeast", NE: "Northeast", ENE: "East-northeast",
        E: "East", ESE: "East-southeast", SE: "Southeast", SSE: "South-southeast",
        S: "South", SSW: "South-southwest", SW: "Southwest", WSW: "West-southwest",
        W: "West", WNW: "West-northwest", NW: "Northwest", NNW: "North-northwest"
    };

    const deg = (value) => Math.round(value) + "°";

    function safeIcon(src) {
        // Only accept icons from WeatherAPI's CDN; anything else gets the local fallback.
        const full = src.indexOf("//") === 0 ? "https:" + src : src;
        return /^https:\/\/cdn\.weatherapi\.com\//.test(full) ? full : FALLBACK_ICON;
    }

    function setIcon(img, src, alt) {
        img.onerror = function () {
            img.onerror = null;
            img.src = FALLBACK_ICON;
        };
        img.src = safeIcon(src);
        img.alt = alt;
    }

    function displayName(m) {
        const parts = [m.city];
        if (m.region && m.region !== m.city) parts.push(m.region);
        if (m.country) parts.push(m.country);
        return parts.join(", ");
    }

    // ---------- Rendering ----------
    function render() {
        const m = state.model;
        if (!m) return;
        const f = state.unit === "f";

        const first = parseISODate(m.days[0].date);
        todayEls.name.textContent = weekdayFmt.format(first);
        todayEls.date.textContent = dayMonthFmt.format(first);
        todayEls.date.setAttribute("datetime", m.days[0].date);

        todayEls.place.textContent = displayName(m);
        todayEls.temp.textContent = Math.round(f ? m.current.tempF : m.current.tempC);
        todayEls.unit.textContent = f ? "°F" : "°C";
        setIcon(todayEls.icon, m.current.icon, m.current.text);
        todayEls.condition.textContent = m.current.text;
        todayEls.feels.textContent = "Feels like " + deg(f ? m.current.feelsF : m.current.feelsC);
        todayEls.rain.textContent = Math.round(m.current.rain) + "%";
        todayEls.wind.textContent = f
            ? Math.round(m.current.windMph) + " mph"
            : Math.round(m.current.windKph) + " km/h";
        todayEls.dir.textContent = COMPASS[m.current.dir] || m.current.dir || "–";
        const time = m.updated.split(" ")[1];
        todayEls.updated.textContent = time ? "Updated at " + time + " local time" : "";

        dayEls.forEach((els, i) => {
            const d = m.days[i + 1];
            if (!d) {
                els.name.textContent = "–";
                els.max.textContent = "–";
                els.min.textContent = "–";
                els.text.textContent = "";
                els.rain.textContent = "";
                return;
            }
            els.name.textContent = weekdayFmt.format(parseISODate(d.date));
            els.max.textContent = deg(f ? d.maxF : d.maxC);
            els.min.textContent = "Low " + deg(f ? d.minF : d.minC);
            els.text.textContent = d.text;
            els.rain.textContent = Math.round(d.rain) + "% chance of rain";
            setIcon(els.icon, d.icon, d.text);
        });

        document.title = m.city + " weather: 3-day forecast";
    }

    function setLoading(on, label) {
        cards.setAttribute("aria-busy", on ? "true" : "false");
        if (on) statusEl.textContent = "Loading weather for " + label + "…";
    }

    function showNotice(kind, text, canRetry) {
        notice.dataset.kind = kind;
        noticeText.textContent = text;
        retryBtn.hidden = !canRetry;
        notice.hidden = false;
    }

    function clearNotice() {
        notice.hidden = true;
        noticeText.textContent = "";
    }

    // ---------- Forecast loading ----------
    async function loadCity(city) {
        cancelSuggestions();
        closeList();
        if (forecastCtl) forecastCtl.abort();            // newest request wins
        const ctl = (forecastCtl = new AbortController());

        state.city = city;
        clearNotice();
        setLoading(true, city.label);

        try {
            const raw = await request(
                "forecast.json",
                { q: city.q, days: 3, aqi: "no", alerts: "no" },
                ctl.signal
            );
            if (ctl !== forecastCtl) return;
            const model = normalize(raw);

            state.model = model;
            render();
            input.value = displayName(model);
            statusEl.textContent = "Showing the forecast for " + displayName(model) + ".";

            // Persist by coordinates so the saved city is unambiguous next visit.
            const q = model.lat + "," + model.lon;
            store.set(KEY_CITY, { label: displayName(model), q: q });
            store.set(KEY_CACHE, { q: q, savedAt: Date.now(), model: model });
            state.city = { label: displayName(model), q: q };
        } catch (err) {
            if (ctl !== forecastCtl || err.kind === "aborted") return;
            handleLoadError(err, city);
        } finally {
            if (ctl === forecastCtl) setLoading(false);
        }
    }

    function handleLoadError(err, city) {
        const recoverable = ["network", "timeout", "server", "quota"].indexOf(err.kind) !== -1;
        const cache = store.get(KEY_CACHE, null);

        // Graceful degradation: show the last good forecast for this city, clearly labelled.
        if (recoverable && cache && cache.q === city.q && isModel(cache.model)) {
            try {
                state.model = cache.model;
                render();
                const when = new Date(cache.savedAt).toLocaleString(undefined, {
                    dateStyle: "medium", timeStyle: "short"
                });
                showNotice(
                    "warn",
                    "We couldn't refresh the forecast, so this is the version saved on " + when + ".",
                    true
                );
                statusEl.textContent = "Showing a saved forecast.";
                return;
            } catch (_) { /* cache unusable: fall through to the error message */ }
        }

        showNotice("error", messageFor(err, city), err.kind !== "config" && err.kind !== "auth");
        statusEl.textContent = "Couldn't load the forecast.";
    }

    // ---------- Suggestions ----------
    function cancelSuggestions() {
        clearTimeout(debounceTimer);
        if (suggestCtl) {
            suggestCtl.abort();
            suggestCtl = null;
        }
    }

    function onInput() {
        const q = input.value.trim();
        clearTimeout(debounceTimer);
        if (q.length < CFG.MIN_QUERY_LENGTH) {
            cancelSuggestions();
            closeList();
            return;
        }
        debounceTimer = setTimeout(() => fetchSuggestions(q), CFG.DEBOUNCE_MS);
    }

    function buildLabel(item) {
        const parts = [item.name];
        if (item.region && item.region !== item.name) parts.push(item.region);
        if (item.country) parts.push(item.country);
        return parts.join(", ");
    }

    async function fetchSuggestions(q) {
        const key = q.toLowerCase();
        if (suggestCache.has(key)) {
            showSuggestions(suggestCache.get(key));
            return;
        }
        if (suggestCtl) suggestCtl.abort();
        const ctl = (suggestCtl = new AbortController());

        try {
            const data = await request("search.json", { q: q }, ctl.signal);
            if (ctl !== suggestCtl) return;
            const items = (Array.isArray(data) ? data : [])
                .filter((d) => d && d.name && Number.isFinite(Number(d.lat)) && Number.isFinite(Number(d.lon)))
                .slice(0, CFG.MAX_SUGGESTIONS)
                .map((d) => ({ label: buildLabel(d), q: Number(d.lat) + "," + Number(d.lon) }));
            if (suggestCache.size >= 50) suggestCache.clear();
            suggestCache.set(key, items);
            showSuggestions(items);
        } catch (_) {
            // Suggestions are a nicety: if they fail, the user can still press Search.
            if (ctl === suggestCtl) closeList();
        }
    }

    function showSuggestions(items) {
        state.suggestions = items;
        state.active = -1;
        list.textContent = "";
        if (items.length === 0) {
            closeList();
            return;
        }
        items.forEach((item, i) => {
            const li = document.createElement("li");
            li.id = "suggestion-" + i;
            li.setAttribute("role", "option");
            li.setAttribute("aria-selected", "false");
            li.dataset.index = String(i);
            li.textContent = item.label;
            list.appendChild(li);
        });
        list.hidden = false;
        input.setAttribute("aria-expanded", "true");
        statusEl.textContent = items.length + (items.length === 1 ? " suggestion" : " suggestions") + " available.";
    }

    function closeList() {
        list.hidden = true;
        list.textContent = "";
        state.suggestions = [];
        state.active = -1;
        input.setAttribute("aria-expanded", "false");
        input.removeAttribute("aria-activedescendant");
    }

    function setActive(index) {
        const options = list.children;
        if (options.length === 0) return;
        state.active = (index + options.length) % options.length;
        Array.prototype.forEach.call(options, (el, i) => {
            el.setAttribute("aria-selected", i === state.active ? "true" : "false");
        });
        input.setAttribute("aria-activedescendant", "suggestion-" + state.active);
        options[state.active].scrollIntoView({ block: "nearest" });
    }

    function chooseSuggestion(index) {
        const item = state.suggestions[index];
        if (!item) return;
        input.value = item.label;
        loadCity(item);
    }

    // ---------- Events ----------
    input.addEventListener("input", onInput);

    input.addEventListener("keydown", (e) => {
        const open = !list.hidden;
        if (e.key === "ArrowDown") {
            if (!open) return;
            e.preventDefault();
            setActive(state.active + 1);
        } else if (e.key === "ArrowUp") {
            if (!open) return;
            e.preventDefault();
            setActive(state.active < 0 ? -1 : state.active - 1);
        } else if (e.key === "Enter" && open && state.active >= 0) {
            e.preventDefault();
            chooseSuggestion(state.active);
        } else if (e.key === "Escape" && open) {
            e.preventDefault();
            cancelSuggestions();
            closeList();
        }
    });

    input.addEventListener("blur", () => { cancelSuggestions(); closeList(); });

    // Keep focus in the input while the pointer interacts with the list.
    list.addEventListener("mousedown", (e) => e.preventDefault());
    list.addEventListener("click", (e) => {
        const li = e.target.closest("li");
        if (li) chooseSuggestion(Number(li.dataset.index));
    });

    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) {
            showNotice("info", "Type a city name to search.", false);
            input.focus();
            return;
        }
        loadCity({ label: text, q: text });
    });

    retryBtn.addEventListener("click", () => {
        if (state.city) loadCity(state.city);
    });

    window.addEventListener("online", () => {
        if (!notice.hidden && state.city && notice.dataset.kind !== "info") loadCity(state.city);
    });

    locateBtn.addEventListener("click", () => {
        if (!navigator.geolocation) {
            showNotice("error", "This browser can't share your location. Search for a city instead.", false);
            return;
        }
        statusEl.textContent = "Finding your location…";
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                // Two decimals (~1 km) is plenty for a city forecast and shares less.
                const q = pos.coords.latitude.toFixed(2) + "," + pos.coords.longitude.toFixed(2);
                loadCity({ label: "your location", q: q });
            },
            (err) => {
                showNotice(
                    "error",
                    err.code === 1
                        ? "Location access was blocked. Allow it in your browser, or search for a city."
                        : "We couldn't work out your location. Search for a city instead.",
                    false
                );
            },
            { timeout: 8000, maximumAge: 600000 }
        );
    });

    unitButtons.forEach((btn) => {
        btn.addEventListener("click", () => setUnit(btn.dataset.unit));
    });

    function setUnit(unit) {
        state.unit = unit === "f" ? "f" : "c";
        unitButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.unit === state.unit)));
        store.set(KEY_UNIT, state.unit);
        render();   // both units are in the data already: no new request
    }

    // ---------- Start ----------
    function init() {
        const savedUnit = store.get(KEY_UNIT, "c");
        state.unit = savedUnit === "f" ? "f" : "c";
        unitButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.unit === state.unit)));

        if (!configured) {
            todayEls.place.textContent = "Setup needed";
            showNotice("error", messageFor(new WeatherError("config")), false);
            return;
        }

        const saved = store.get(KEY_CITY, null);
        const start = saved && typeof saved.q === "string" && typeof saved.label === "string"
            ? saved
            : { label: CFG.DEFAULT_CITY, q: CFG.DEFAULT_CITY };

        // Paint the saved forecast instantly, then refresh it in the background.
        const cache = store.get(KEY_CACHE, null);
        if (cache && cache.q === start.q && isModel(cache.model)) {
            try {
                state.model = cache.model;
                render();
            } catch (_) { state.model = null; }
        }

        loadCity(start);
    }

    init();
})();
