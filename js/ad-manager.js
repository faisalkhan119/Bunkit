// ============================================================
// Bunkit Ad Manager — js/ad-manager.js
// Renders ad overlays from app_config, tracks analytics events
// to the ad_events table, and auto-skips when user returns
// after clicking a CTA link.
// ============================================================

class BunkitAdManager {
    constructor() {
        this._pendingDismiss = false;
        this._activeAdType = null;
        this._activeOverlayEl = null;
        this._visibilityHandler = null;
        this._skipTimer = null;
    }

    // ----- INTERNAL: track an event to Supabase ad_events -----
    async _trackEvent(adType, eventType, buttonLabel = null, buttonUrl = null) {
        const client = window.supabaseClient;
        if (!client) { console.warn('[AdManager] No Supabase client — skipping track'); return; }
        try {
            // Supabase JS v2 NEVER throws — errors come back as { error }
            const { error } = await client.from('ad_events').insert({
                ad_type: adType,
                event_type: eventType,
                button_label: buttonLabel,
                button_url: buttonUrl
            });
            if (error) {
                console.warn(`[AdManager] ❌ Insert failed (${adType}/${eventType}):`, error.message, '|code:', error.code);
            } else {
                console.log(`[AdManager] ✅ Tracked: ${adType} → ${eventType}`, buttonLabel || '');
            }
        } catch (e) {
            console.warn('[AdManager] Track exception:', e.message);
        }
    }

    // ----- INTERNAL: fetch a single config key from app_config -----
    async _fetchConfig(adType) {
        const client = window.supabaseClient;
        if (!client) return null;
        try {
            const { data, error } = await client
                .from('app_config')
                .select('value')
                .eq('key', adType)
                .single();
            if (error || !data) return null;
            return data.value;
        } catch (e) {
            console.warn('[AdManager] Fetch config error:', e.message);
            return null;
        }
    }

    // ----- Dismiss the active overlay -----
    dismiss() {
        if (this._visibilityHandler) {
            document.removeEventListener('visibilitychange', this._visibilityHandler);
            this._visibilityHandler = null;
        }
        if (this._skipTimer) {
            clearInterval(this._skipTimer);
            this._skipTimer = null;
        }
        const el = this._activeOverlayEl;
        if (el) {
            el.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
            el.style.opacity = '0';
            el.style.transform = 'scale(0.95)';
            setTimeout(() => { if (el.parentNode) el.remove(); }, 380);
        }
        this._activeOverlayEl = null;
        this._pendingDismiss = false;
        this._activeAdType = null;
    }

    // ----- Build and show an ad overlay for the given adType -----
    async show(adType) {
        // Don't stack overlays
        if (this._activeOverlayEl) return;

        const config = await this._fetchConfig(adType);
        if (!config || !config.enabled) {
            console.log(`[AdManager] ${adType} is disabled or not configured`);
            return;
        }

        this._activeAdType = adType;
        const skipDelay = typeof config.skip_delay_sec === 'number' ? config.skip_delay_sec : 4;
        const ctaButtons = Array.isArray(config.cta_buttons) ? config.cta_buttons : [];

        // Fire view event
        this._trackEvent(adType, 'view');

        // ---- Inject keyframe styles once ----
        if (!document.getElementById('bunkit-ad-styles')) {
            const style = document.createElement('style');
            style.id = 'bunkit-ad-styles';
            style.textContent = `
                @keyframes bk-adIn { from { opacity:0; transform:scale(0.93) translateY(16px); } to { opacity:1; transform:scale(1) translateY(0); } }
                @keyframes bk-overlayIn { from { opacity:0; } to { opacity:1; } }
                .bk-ad-overlay { animation: bk-overlayIn 0.3s ease; }
                .bk-ad-card { animation: bk-adIn 0.45s cubic-bezier(0.22,1,0.36,1); }
                .bk-cta-btn:hover { opacity:0.88; transform:translateY(-1px); }
                .bk-skip-btn:not(:disabled):hover { background:rgba(255,255,255,0.15)!important; color:#e2e8f0!important; }
            `;
            document.head.appendChild(style);
        }

        // ---- Overlay ----
        const overlay = document.createElement('div');
        overlay.className = 'bk-ad-overlay';
        overlay.style.cssText = [
            'position:fixed;inset:0;',
            'background:rgba(5,5,15,0.92);',
            'backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);',
            'display:flex;align-items:center;justify-content:center;',
            'z-index:2147483647;',
            'padding:20px;',
            'font-family:-apple-system,BlinkMacSystemFont,"Outfit",sans-serif;'
        ].join('');

        // ---- Card ----
        const card = document.createElement('div');
        card.className = 'bk-ad-card';
        card.style.cssText = [
            'background:linear-gradient(145deg,rgba(18,18,36,0.99),rgba(8,8,20,0.99));',
            'border:1px solid rgba(255,255,255,0.09);',
            'border-radius:24px;padding:28px 24px 24px;',
            'max-width:400px;width:100%;',
            'position:relative;',
            'box-shadow:0 40px 80px rgba(0,0,0,0.7),0 0 0 1px rgba(108,99,255,0.08);'
        ].join('');

        // ---- Skip Button ----
        const skipBtn = document.createElement('button');
        skipBtn.className = 'bk-skip-btn';
        skipBtn.style.cssText = [
            'position:absolute;top:14px;right:14px;',
            'background:rgba(255,255,255,0.07);',
            'border:1px solid rgba(255,255,255,0.1);',
            'color:#64748b;border-radius:999px;',
            'padding:5px 13px;font-size:11px;font-weight:700;',
            'cursor:not-allowed;transition:all 0.2s;',
            'letter-spacing:0.02em;'
        ].join('');
        skipBtn.disabled = true;
        skipBtn.textContent = `Skip in ${skipDelay}s`;

        let remaining = skipDelay;
        this._skipTimer = setInterval(() => {
            remaining--;
            if (remaining <= 0) {
                clearInterval(this._skipTimer);
                this._skipTimer = null;
                skipBtn.disabled = false;
                skipBtn.style.cursor = 'pointer';
                skipBtn.style.color = '#94a3b8';
                skipBtn.textContent = 'Skip ✕';
            } else {
                skipBtn.textContent = `Skip in ${remaining}s`;
            }
        }, 1000);

        skipBtn.onclick = () => {
            if (skipBtn.disabled) return;
            this._trackEvent(adType, 'skip');
            this.dismiss();
        };

        // ---- Ad Image ----
        if (config.image_url) {
            const img = document.createElement('img');
            img.src = config.image_url;
            img.alt = config.title || 'Ad Banner';
            img.style.cssText = 'width:100%;border-radius:16px;margin-bottom:18px;object-fit:cover;max-height:180px;display:block;';
            img.onerror = () => img.style.display = 'none';
            card.appendChild(img);
        }

        // ---- Title ----
        if (config.title) {
            const h = document.createElement('h2');
            h.textContent = config.title;
            h.style.cssText = 'color:#f1f5f9;font-size:19px;font-weight:700;margin:0 0 8px;line-height:1.3;padding-right:60px;';
            card.appendChild(h);
        }

        // ---- Message ----
        if (config.message) {
            const p = document.createElement('p');
            p.textContent = config.message;
            p.style.cssText = 'color:#8896ab;font-size:13.5px;line-height:1.65;margin:0 0 20px;';
            card.appendChild(p);
        }

        // ---- CTA Buttons ----
        if (ctaButtons.length > 0) {
            const btnWrap = document.createElement('div');
            btnWrap.style.cssText = 'display:flex;flex-direction:column;gap:10px;';

            ctaButtons.forEach((cta) => {
                const btn = document.createElement('a');
                btn.href = cta.url || '#';
                btn.target = '_blank';
                btn.rel = 'noopener noreferrer';
                btn.textContent = cta.label || 'Visit';
                btn.className = 'bk-cta-btn';
                btn.style.cssText = [
                    'display:block;text-align:center;',
                    'padding:13px 20px;',
                    'background:linear-gradient(135deg,#6c63ff,#4f46e5);',
                    'color:#fff;text-decoration:none;',
                    'border-radius:14px;font-weight:600;font-size:14px;',
                    'transition:opacity 0.2s,transform 0.2s;',
                    'box-shadow:0 4px 16px rgba(79,70,229,0.35);'
                ].join('');

                btn.onclick = () => {
                    // Track CTA click
                    this._trackEvent(adType, 'click', cta.label, cta.url);
                    // Set auto-skip: when user returns to this tab, dismiss the ad
                    this._pendingDismiss = true;
                    if (this._visibilityHandler) {
                        document.removeEventListener('visibilitychange', this._visibilityHandler);
                    }
                    this._visibilityHandler = () => {
                        if (document.visibilityState === 'visible' && this._pendingDismiss) {
                            console.log('[AdManager] User returned — auto-dismissing ad');
                            this.dismiss();
                        }
                    };
                    document.addEventListener('visibilitychange', this._visibilityHandler);
                };
                btnWrap.appendChild(btn);
            });

            card.appendChild(btnWrap);
        }

        card.appendChild(skipBtn);
        overlay.appendChild(card);
        document.body.appendChild(overlay);
        this._activeOverlayEl = overlay;

        console.log(`[AdManager] Showing ${adType}`);
    }

    // ----- Show daily_ad — throttled to once per calendar day -----
    async showDailyAdIfNeeded() {
        const today = new Date().toDateString();
        const key = 'bunkit_daily_ad_date';
        if (localStorage.getItem(key) === today) {
            console.log('[AdManager] Daily ad already shown today');
            return;
        }
        await this.show('daily_ad');
        // Only mark as shown if actually displayed (i.e., was enabled)
        if (!this._activeAdType) return; // was disabled, don't mark
        localStorage.setItem(key, today);
    }

    // ----- Show calculate_ad — called from bunk/calc feature -----
    async showCalculateAd() {
        await this.show('calculate_ad');
    }
}

// Initialize and attach to window so app.js can call it
window.bunkitAdManager = new BunkitAdManager();

// Show daily ad 2.5 seconds after page load (gives Supabase time to init)
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.supabaseClient) {
            window.bunkitAdManager.showDailyAdIfNeeded();
        } else {
            // Retry once after Supabase has more time to load
            setTimeout(() => window.bunkitAdManager.showDailyAdIfNeeded(), 3000);
        }
    }, 2500);
});
