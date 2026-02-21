import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Save, Plus, Trash2, Megaphone, Image as ImageIcon, ExternalLink, AlertCircle, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AdManager = () => {
    const [activeTab, setActiveTab] = useState('daily_ad');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState(null);

    const [adData, setAdData] = useState({
        enabled: false,
        image_url: '',
        title: '',
        message: '',
        cta_buttons: [],
        skip_delay_sec: 4
    });

    useEffect(() => {
        fetchAd();
    }, [activeTab]);

    const fetchAd = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('app_config')
                .select('value')
                .eq('key', activeTab)
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            if (data?.value) {
                setAdData({
                    enabled: data.value.enabled ?? false,
                    image_url: data.value.image_url ?? '',
                    title: data.value.title ?? '',
                    message: data.value.message ?? '',
                    cta_buttons: data.value.cta_buttons ?? [],
                    skip_delay_sec: data.value.skip_delay_sec ?? 4
                });
            }
        } catch (err) {
            console.error('Error fetching ad:', err);
        } finally {
            setLoading(false);
        }
    };

    const saveAd = async () => {
        setSaving(true);
        setStatus(null);
        try {
            const { error } = await supabase
                .from('app_config')
                .upsert({
                    key: activeTab,
                    value: adData,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' });

            if (error) throw error;
            setStatus({ type: 'success', message: 'Ad configuration saved successfully!' });
            setTimeout(() => setStatus(null), 3000);
        } catch (err) {
            setStatus({ type: 'error', message: err.message || 'Failed to save configuration' });
        } finally {
            setSaving(false);
        }
    };

    const addCta = () => {
        if (adData.cta_buttons.length >= 3) return;
        setAdData({
            ...adData,
            cta_buttons: [...adData.cta_buttons, { label: 'Visit Website', url: '', type: 'website' }]
        });
    };

    const updateCta = (index, field, value) => {
        const newButtons = [...adData.cta_buttons];
        newButtons[index][field] = value;
        setAdData({ ...adData, cta_buttons: newButtons });
    };

    const removeCta = (index) => {
        const newButtons = adData.cta_buttons.filter((_, i) => i !== index);
        setAdData({ ...adData, cta_buttons: newButtons });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Megaphone className="text-primary" /> Ad Manager
                    </h1>
                    <p className="text-muted mt-1">Configure and preview app advertisements</p>
                </div>

                <button
                    onClick={saveAd}
                    disabled={saving}
                    className="btn-primary flex items-center gap-2"
                >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    Save Changes
                </button>
            </div>

            <div className="flex gap-4 p-1 bg-white/5 rounded-2xl w-fit">
                <button
                    onClick={() => setActiveTab('daily_ad')}
                    className={`px-6 py-2.5 rounded-xl font-semibold transition-all ${activeTab === 'daily_ad' ? 'bg-white/10 text-white shadow-lg' : 'text-muted hover:text-white'
                        }`}
                >
                    Daily Ad
                </button>
                <button
                    onClick={() => setActiveTab('calculate_ad')}
                    className={`px-6 py-2.5 rounded-xl font-semibold transition-all ${activeTab === 'calculate_ad' ? 'bg-white/10 text-white shadow-lg' : 'text-muted hover:text-white'
                        }`}
                >
                    Calculation Ad
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Editor */}
                <div className="space-y-6">
                    <section className="glass p-6 rounded-3xl space-y-6">
                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                            <div>
                                <h3 className="font-bold">Enable Advertisement</h3>
                                <p className="text-xs text-muted">Show this ad to your users</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={adData.enabled}
                                    onChange={(e) => setAdData({ ...adData, enabled: e.target.checked })}
                                />
                                <div className="w-14 h-7 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary shadow-inner"></div>
                            </label>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-muted uppercase tracking-wider mb-2 block">Overlay Image</label>
                                <div className="relative">
                                    <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
                                    <input
                                        type="url"
                                        placeholder="Image URL (Direct link)"
                                        className="input-field pl-12"
                                        value={adData.image_url}
                                        onChange={(e) => setAdData({ ...adData, image_url: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-muted uppercase tracking-wider mb-2 block">Ad Title</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Support the Developer ☕"
                                    className="input-field"
                                    value={adData.title}
                                    onChange={(e) => setAdData({ ...adData, title: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-muted uppercase tracking-wider mb-2 block">Main Message</label>
                                <textarea
                                    placeholder="Tell your users why they should support or check this out..."
                                    className="input-field min-h-[100px] resize-none"
                                    value={adData.message}
                                    onChange={(e) => setAdData({ ...adData, message: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-muted uppercase tracking-wider mb-2 block">Skip Delay (Sec)</label>
                                    <input
                                        type="number"
                                        min="3"
                                        max="30"
                                        className="input-field"
                                        value={adData.skip_delay_sec}
                                        onChange={(e) => setAdData({ ...adData, skip_delay_sec: parseInt(e.target.value) || 3 })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 border-t border-white/5 pt-6">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-muted uppercase tracking-wider">CTA Buttons ({adData.cta_buttons.length}/3)</label>
                                {adData.cta_buttons.length < 3 && (
                                    <button onClick={addCta} className="text-xs text-primary font-bold flex items-center gap-1 hover:underline">
                                        <Plus className="w-3 h-3" /> Add Button
                                    </button>
                                )}
                            </div>

                            <div className="space-y-3">
                                {adData.cta_buttons.map((btn, index) => (
                                    <motion.div
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        key={index}
                                        className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-3"
                                    >
                                        <div className="flex gap-2">
                                            <input
                                                className="input-field text-sm"
                                                placeholder="Label"
                                                value={btn.label}
                                                onChange={(e) => updateCta(index, 'label', e.target.value)}
                                            />
                                            <select
                                                className="input-field text-sm w-32"
                                                value={btn.type}
                                                onChange={(e) => updateCta(index, 'type', e.target.value)}
                                            >
                                                <option value="website">Website</option>
                                                <option value="instagram">Instagram</option>
                                                <option value="whatsapp">WhatsApp</option>
                                                <option value="buymeacoffee">Coffee</option>
                                                <option value="custom">Custom</option>
                                            </select>
                                            <button onClick={() => removeCta(index)} className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-all self-center">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <input
                                            className="input-field text-sm"
                                            placeholder="https://..."
                                            value={btn.url}
                                            onChange={(e) => updateCta(index, 'url', e.target.value)}
                                        />
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </section>

                    <AnimatePresence>
                        {status && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className={`flex items-center gap-3 p-4 rounded-2xl border ${status.type === 'success'
                                    ? 'bg-green-500/10 border-green-500/20 text-green-400'
                                    : 'bg-red-500/10 border-red-500/20 text-red-400'
                                    }`}
                            >
                                {status.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                                <span className="font-medium text-sm">{status.message}</span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Live Preview */}
                <div className="lg:sticky lg:top-8 h-fit">
                    <div className="flex items-center gap-2 mb-4 text-xs font-bold text-muted uppercase tracking-wider">
                        <Sparkles className="w-4 h-4 text-yellow-500" /> Live App Preview
                    </div>

                    <div className="relative aspect-[9/16] max-w-[340px] mx-auto rounded-[3rem] border-[8px] border-zinc-800 bg-[#050510] overflow-hidden shadow-2xl scale-[0.8] sm:scale-100 origin-top">
                        {/* Phone Notch/Speaker */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-zinc-800 rounded-b-2xl z-50"></div>

                        <div className="absolute inset-0 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                            <motion.div
                                key={activeTab + JSON.stringify(adData)}
                                initial={{ opacity: 0, y: 40, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                className="w-full bg-[#141428] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
                            >
                                {adData.image_url && (
                                    <img src={adData.image_url} alt="Preview" className="w-full h-32 object-cover border-b border-white/5" />
                                )}
                                <div className="p-6 text-center">
                                    <h3 className="text-lg font-bold mb-2">{adData.title || 'Your Ad Title'}</h3>
                                    <p className="text-xs text-[#94a3b8] leading-relaxed mb-6">
                                        {adData.message || 'The message you enter in the editor will appear right here for your users.'}
                                    </p>

                                    <div className="space-y-2.5">
                                        {adData.cta_buttons.map((btn, i) => (
                                            <div
                                                key={i}
                                                className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 ${btn.type === 'instagram' ? 'bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600' :
                                                    btn.type === 'whatsapp' ? 'bg-[#25D366]' :
                                                        btn.type === 'buymeacoffee' ? 'bg-[#FFDD00] text-black' :
                                                            'bg-primary'
                                                    }`}
                                            >
                                                {btn.label || 'Visit Website'} <ExternalLink className="w-3 h-3" />
                                            </div>
                                        ))}
                                    </div>

                                    <button disabled className="mt-5 w-fit mx-auto px-6 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-bold text-muted">
                                        Skip ({adData.skip_delay_sec}s)
                                    </button>
                                </div>
                            </motion.div>
                        </div>

                        {/* Simulated UI background */}
                        <div className="absolute inset-0 -z-10 opacity-10 flex flex-col p-6 space-y-4">
                            <div className="h-20 w-full bg-white/20 rounded-2xl" />
                            <div className="h-40 w-full bg-white/20 rounded-2xl" />
                            <div className="grid grid-cols-2 gap-4">
                                <div className="h-32 bg-white/20 rounded-2xl" />
                                <div className="h-32 bg-white/20 rounded-2xl" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdManager;
