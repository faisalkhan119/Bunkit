import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { BookOpen, Plus, Trash2, Send, Copy, Loader2, CheckCircle, ExternalLink, FileJson, Sparkles, Edit3, ChevronRight, ChevronLeft, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AdminClassCreatorPage = () => {
    const [inputMode, setInputMode] = useState('wizard'); // 'wizard', 'json', 'ai'

    // Wizard State
    const [wizardStep, setWizardStep] = useState(1);
    const [className, setClassName] = useState('');
    const [startDate, setStartDate] = useState('');
    const [lastDate, setLastDate] = useState('');
    const [periodsPerDay, setPeriodsPerDay] = useState(8);
    const [subjects, setSubjects] = useState([{ name: '', code: '' }]);
    const [timetable, setTimetable] = useState(Array(7).fill().map(() => Array(8).fill(''))); // 7 days, periodsPerDay
    const [holidays, setHolidays] = useState([]);
    const [newHoliday, setNewHoliday] = useState('');

    // JSON Verification State
    const [jsonError, setJsonError] = useState('');

    // JSON State
    const [jsonInput, setJsonInput] = useState('');

    // AI State
    const [aiFiles, setAiFiles] = useState([]);
    const [aiNotes, setAiNotes] = useState('');

    // Global Assignment State
    const [targetEmail, setTargetEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const aiPromptText = `Generate a JSON structure for a weekly class timetable.

**Global Fields:**
* Include \`lastDate\` (validity as YYYY-MM-DD), a list of \`holidays\` (array of YYYY-MM-DD strings), and a \`qrCode\` string (for export/sharing - use empty string).
* **Optional:** Include \`semesterStartDate\` (YYYY-MM-DD) if available in the inputs.

**Subjects Array:**
* The structure must **not** include a separate \`timetableArrangement\` object. All scheduling logic belongs inside \`subjects\`.
* Each subject object must contain: \`name\`, \`code\`, \`shortName\`, and \`schedule\`.

**Schedule Logic:**
* The \`schedule\` key must be an array of 7 strings (representing days 0-6, Mon-Sun).
* Use the period number as a string (e.g., "1").
* If a subject occupies multiple periods on one day, separate them with commas (e.g., "2,3").
* If there is no class, use "0".

EXACT JSON STRUCTURE:
{
  "CLASS NAME": {
    "lastDate": "YYYY-MM-DD",
    "semesterStartDate": "YYYY-MM-DD",
    "qrCode": "",
    "holidays": ["YYYY-MM-DD", "YYYY-MM-DD"],
    "subjects": [
      {
        "name": "Full Subject Name",
        "shortName": "ABBR",
        "code": "SUBJECT-CODE",
        "schedule": ["1", "1,2", "0", "3", "0", "0", "0"]
      }
    ]
  }
}`;

    const handlePeriodsChange = (e) => {
        const val = parseInt(e.target.value) || 1;
        const newPeriods = Math.min(Math.max(val, 1), 12);
        setPeriodsPerDay(newPeriods);
        // Adjust timetable array size
        setTimetable(prev => prev.map(day => {
            const newDay = [...day];
            newDay.length = newPeriods;
            return newDay.fill('', day.length, newPeriods);
        }));
    };

    const addSubject = () => setSubjects([...subjects, { name: '', code: '' }]);
    const removeSubject = (index) => {
        if (subjects.length > 1) setSubjects(subjects.filter((_, i) => i !== index));
    };
    const updateSubject = (index, field, value) => {
        const newSubjects = [...subjects];
        newSubjects[index][field] = value;
        setSubjects(newSubjects);
    };

    const updateTimetable = (dayIndex, periodIndex, subjectName) => {
        const newTimetable = [...timetable];
        newTimetable[dayIndex][periodIndex] = subjectName;
        setTimetable(newTimetable);
    };

    const addHoliday = () => {
        if (newHoliday && !holidays.includes(newHoliday)) {
            setHolidays([...holidays, newHoliday].sort());
            setNewHoliday('');
        }
    };
    const removeHoliday = (date) => setHolidays(holidays.filter(h => h !== date));

    const generateClassId = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
    const generateSharedId = () => {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        return Array(6).fill().map(() => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    };

    const handleParseJson = () => {
        setJsonError('');
        try {
            if (!jsonInput.trim()) throw new Error("Please paste JSON first.");

            const parsed = JSON.parse(jsonInput);
            const classKey = Object.keys(parsed)[0];
            if (!classKey) throw new Error("JSON must contain a root class name object.");

            const data = parsed[classKey];

            // 1. Set Basic Info
            setClassName(classKey);
            setStartDate(data.semesterStartDate || '');
            setLastDate(data.lastDate || '');
            setHolidays(data.holidays || []);

            // 2. Extract and Set Subjects
            const parsedSubjects = (data.subjects || []).map(sub => ({
                name: sub.name || 'Unnamed Subject',
                code: sub.code || ''
            }));
            if (parsedSubjects.length === 0) throw new Error("No subjects found in JSON.");
            setSubjects(parsedSubjects);

            // 3. Reconstruct Timetable
            // First determine max periods to set periodsPerDay
            let maxPeriodsFound = 8; // default minimum
            const rawSchedules = (data.subjects || []).map(s => s.schedule || Array(7).fill("0"));

            rawSchedules.forEach(scheduleArray => {
                scheduleArray.forEach(dayStr => {
                    if (dayStr !== "0") {
                        const periods = dayStr.split(',');
                        periods.forEach(p => {
                            const pNum = parseInt(p.trim());
                            if (!isNaN(pNum) && pNum > maxPeriodsFound) {
                                maxPeriodsFound = pNum;
                            }
                        });
                    }
                });
            });

            // Cap at 12 to match UI limits
            maxPeriodsFound = Math.min(Math.max(maxPeriodsFound, 1), 12);
            setPeriodsPerDay(maxPeriodsFound);

            const newTimetable = Array(7).fill().map(() => Array(maxPeriodsFound).fill(''));

            // Map subjects onto the timetable grid
            (data.subjects || []).forEach(sub => {
                const sched = sub.schedule || Array(7).fill("0");
                sched.forEach((dayStr, dayIdx) => {
                    if (dayIdx >= 7) return; // Prevent out of bounds
                    if (dayStr !== "0") {
                        const periods = dayStr.split(',');
                        periods.forEach(p => {
                            const pIndex = parseInt(p.trim()) - 1; // 1-based to 0-based
                            if (pIndex >= 0 && pIndex < maxPeriodsFound) {
                                newTimetable[dayIdx][pIndex] = sub.name;
                            }
                        });
                    }
                });
            });

            setTimetable(newTimetable);

            // 4. Switch to Wizard Mode for verification
            setInputMode('wizard');
            setWizardStep(3); // Jump to step 3 so they can see the final timetable immediately
            setJsonInput(''); // Optional: clear JSON after successful pull

        } catch (error) {
            setJsonError(error.message || "Invalid JSON structure.");
        }
    };

    const handleCreateClass = async (e) => {
        if (e) e.preventDefault();
        setLoading(true);
        setResult(null);

        let finalClassObject = null;
        const sharedId = generateSharedId();

        try {
            if (inputMode === 'wizard') {
                if (!className || !lastDate) throw new Error("Class Name and Last Working Date are required.");
                const validSubjects = subjects.filter(s => s.name.trim());
                if (validSubjects.length === 0) throw new Error("At least one subject is required.");

                const processedSubjects = validSubjects.map(sub => {
                    const sched = Array(7).fill('0');
                    for (let day = 0; day < 7; day++) {
                        const periods = [];
                        for (let p = 0; p < periodsPerDay; p++) {
                            if (timetable[day][p] === sub.name) periods.push((p + 1).toString());
                        }
                        sched[day] = periods.length > 0 ? periods.join(',') : '0';
                    }
                    return {
                        name: sub.name,
                        code: sub.code || sub.name.substring(0, 3).toUpperCase(),
                        total: 0,
                        present: 0,
                        schedule: sched
                    };
                });

                finalClassObject = {
                    id: generateClassId(),
                    name: className.trim(),
                    startDate: startDate || null,
                    lastDate: lastDate,
                    subjects: processedSubjects,
                    holidays: holidays,
                    sharedId: sharedId,
                    timetableArrangement: {}
                };

            } else if (inputMode === 'json') {
                throw new Error("Please click 'Parse & Verify' first to review the data in the form before deploying.");
            } else if (inputMode === 'ai') {
                throw new Error("AI Import is visually mocked for Admin. Use 'Paste JSON' with an external AI for now.");
            }

            // Database Transactions
            const { error: shareError } = await supabase
                .from('shared_classes')
                .insert({ id: sharedId, class_data: finalClassObject });

            if (shareError) throw shareError;

            let assignmentMessage = '';
            if (targetEmail.trim()) {
                const { data: profile, error: profileErr } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('email', targetEmail.trim().toLowerCase())
                    .single();

                if (profileErr || !profile) {
                    assignmentMessage = ` (Warning: User ${targetEmail} not found, but share link was created.)`;
                } else {
                    const { error: pushError } = await supabase
                        .from('classes')
                        .upsert({
                            user_id: profile.id,
                            name: finalClassObject.name,
                            data: finalClassObject,
                            updated_at: new Date().toISOString()
                        }, { onConflict: 'user_id, name' });

                    if (pushError) throw pushError;
                    assignmentMessage = ` (Successfully assigned to ${targetEmail})`;
                }
            }

            setResult({
                type: 'success',
                message: `Class "${finalClassObject.name}" deployed!${assignmentMessage}`,
                shareId: sharedId
            });

        } catch (error) {
            setResult({ type: 'error', message: error.message });
        } finally {
            setLoading(false);
        }
    };

    const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
        <div className="space-y-8 animate-fade-in max-w-5xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold flex items-center gap-3">
                    <BookOpen className="text-primary" /> Class Deployer
                </h1>
                <p className="text-muted mt-1">Create exact class templates including timetables and deploy them.</p>
            </div>

            <div className="flex gap-2 p-1 bg-white/5 rounded-2xl w-fit">
                {[{ id: 'wizard', icon: Edit3, label: 'Form Entry' },
                { id: 'ai', icon: Sparkles, label: 'Inbuilt AI' },
                { id: 'json', icon: FileJson, label: 'Paste JSON' }].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setInputMode(tab.id)}
                        className={`px-6 py-2.5 rounded-xl flex items-center gap-2 font-medium transition-all ${inputMode === tab.id ? 'bg-primary text-white shadow-lg' : 'text-muted hover:text-white hover:bg-white/5'}`}
                    >
                        <tab.icon className="w-4 h-4" /> {tab.label}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Main Content Column */}
                <div className="lg:col-span-3">
                    <div className="glass p-6 rounded-3xl space-y-6">
                        {inputMode === 'wizard' && (
                            <div className="space-y-6">
                                {/* Wizard Progress Steps */}
                                <div className="flex justify-center gap-2 mb-8 border-b border-white/5 pb-6">
                                    {[1, 2, 3].map(step => (
                                        <div key={step} className={`flex items-center gap-3 px-5 py-2.5 rounded-2xl transition-all ${wizardStep === step ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white/5 text-muted'}`}>
                                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${wizardStep === step ? 'bg-white text-primary' : 'bg-white/10'}`}>{step}</span>
                                            <span className="text-sm font-medium">{step === 1 ? 'Basic Info' : step === 2 ? 'Subjects' : 'Timetable'}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Step 1: Basic Info */}
                                {wizardStep === 1 && (
                                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
                                        <div><label className="block text-sm font-medium text-muted mb-2">Class Name *</label><input type="text" required placeholder="e.g., CSE Core - H" value={className} onChange={(e) => setClassName(e.target.value)} className="input-field" /></div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div><label className="block text-sm font-medium text-muted mb-2">Semester Start Date</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input-field" /></div>
                                            <div><label className="block text-sm font-medium text-muted mb-2">Last Working Date *</label><input type="date" required value={lastDate} onChange={(e) => setLastDate(e.target.value)} className="input-field" /></div>
                                        </div>
                                        <div><label className="block text-sm font-medium text-muted mb-2">Periods per Day *</label><input type="number" min="1" max="12" value={periodsPerDay} onChange={handlePeriodsChange} className="input-field" /></div>
                                        <div className="flex justify-end pt-4"><button className="btn primary-btn flex items-center gap-2" onClick={() => { if (!className || !lastDate) return alert("Fill required fields"); setWizardStep(2); }}>Next <ChevronRight className="w-5 h-5" /></button></div>
                                    </motion.div>
                                )}

                                {/* Step 2: Subjects */}
                                {wizardStep === 2 && (
                                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                                        <div className="flex justify-between items-center mb-2"><p className="text-sm text-muted">Add all subjects taught in this class.</p><button type="button" onClick={addSubject} className="text-primary hover:text-white flex items-center gap-1 text-sm font-bold"><Plus className="w-4 h-4" /> Add Subject</button></div>
                                        <AnimatePresence>
                                            {subjects.map((sub, idx) => (
                                                <motion.div key={idx} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="flex gap-3 items-center">
                                                    <input type="text" required placeholder="Subject Name" value={sub.name} onChange={(e) => updateSubject(idx, 'name', e.target.value)} className="input-field flex-[2]" />
                                                    <input type="text" placeholder="Code (Opt)" value={sub.code} onChange={(e) => updateSubject(idx, 'code', e.target.value)} className="input-field flex-1" />
                                                    {subjects.length > 1 && <button type="button" onClick={() => removeSubject(idx)} className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-all"><Trash2 className="w-5 h-5" /></button>}
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                        <div className="flex justify-between pt-6 border-t border-white/5 mt-6">
                                            <button className="btn secondary-btn flex items-center gap-2" onClick={() => setWizardStep(1)}><ChevronLeft className="w-5 h-5" /> Back</button>
                                            <button className="btn primary-btn flex items-center gap-2" onClick={() => { if (subjects.filter(s => s.name).length === 0) return alert("Add at least 1 subject"); setWizardStep(3); }}>Next <ChevronRight className="w-5 h-5" /></button>
                                        </div>
                                    </motion.div>
                                )}

                                {/* Step 3: Timetable */}
                                {wizardStep === 3 && (
                                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                                        <div className="space-y-3">
                                            <h3 className="font-semibold text-white/90">Timetable Grid</h3>
                                            <div className="overflow-x-auto border border-white/10 rounded-xl">
                                                <table className="w-full text-sm text-left">
                                                    <thead className="bg-white/5 text-muted uppercase text-xs">
                                                        <tr>
                                                            <th className="px-4 py-3 font-semibold w-24">Day</th>
                                                            {Array(periodsPerDay).fill().map((_, i) => <th key={i} className="px-2 py-3 font-semibold text-center">P{i + 1}</th>)}
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-white/5">
                                                        {daysOfWeek.map((day, dIdx) => (
                                                            <tr key={day} className="hover:bg-white/[0.02]">
                                                                <td className="px-4 py-2 font-medium text-white/80">{day}</td>
                                                                {Array(periodsPerDay).fill().map((_, pIdx) => (
                                                                    <td key={pIdx} className="px-1 py-1">
                                                                        <select
                                                                            value={timetable[dIdx][pIdx]}
                                                                            onChange={(e) => updateTimetable(dIdx, pIdx, e.target.value)}
                                                                            className="w-full min-w-[100px] bg-black/30 border border-white/10 rounded-lg py-1.5 px-2 text-xs text-white/90 focus:border-primary outline-none"
                                                                        >
                                                                            <option value="">Free</option>
                                                                            {subjects.filter(s => s.name).map((s, i) => <option key={i} value={s.name}>{s.name.substring(0, 15)}</option>)}
                                                                        </select>
                                                                    </td>
                                                                ))}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <h3 className="font-semibold text-white/90 flex items-center gap-2"><Calendar className="w-4 h-4" /> Holidays</h3>
                                            <div className="flex gap-2">
                                                <input type="date" value={newHoliday} onChange={e => setNewHoliday(e.target.value)} className="input-field" />
                                                <button type="button" onClick={addHoliday} className="btn secondary-btn shrink-0">Add</button>
                                            </div>
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {holidays.map(h => (
                                                    <span key={h} className="bg-red-500/10 text-red-400 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-2">
                                                        {h} <button onClick={() => removeHoliday(h)} className="hover:text-white">&times;</button>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex justify-between pt-6 border-t border-white/5 mt-6">
                                            <button className="btn secondary-btn flex items-center gap-2" onClick={() => setWizardStep(2)}><ChevronLeft className="w-5 h-5" /> Back</button>
                                        </div>
                                    </motion.div>
                                )}
                            </div>
                        )}

                        {inputMode === 'ai' && (
                            <div className="space-y-5 animate-fade-in">
                                <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl text-primary font-medium flex items-center gap-3">
                                    <Sparkles className="w-6 h-6" />
                                    <p>Upload Timetable and let BunkIt AI generate the structure. Note: For this admin panel demo, please use the <b>Paste JSON</b> mode with an external AI.</p>
                                </div>
                                <div className="border-2 border-dashed border-white/20 p-10 rounded-2xl text-center text-muted hover:border-primary/50 transition-colors cursor-pointer bg-white/5">
                                    <div className="text-4xl mb-3">📂</div>
                                    <p className="font-semibold">Click to upload Timetable, Attendance, etc.</p>
                                    <input type="file" multiple accept="image/*" className="hidden" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-muted mb-2">Additional Details</label>
                                    <textarea placeholder="e.g., Holidays are Aug 15, Oct 2." className="input-field min-h-[100px]"></textarea>
                                </div>
                            </div>
                        )}

                        {inputMode === 'json' && (
                            <div className="space-y-5 animate-fade-in">
                                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                                    <h4 className="font-bold text-blue-400 mb-2 border-b border-blue-500/20 pb-2">How to use AI parsing:</h4>
                                    <ol className="list-decimal list-inside text-sm text-blue-200/80 space-y-1.5 marker:text-blue-500">
                                        <li>Copy the strict JSON prompt below.</li>
                                        <li>Paste it into ChatGPT/Gemini alongside your Timetable image.</li>
                                        <li>Include your semester 'startDate', 'lastDate' and 'holidays' list.</li>
                                        <li>Copy the resulting JSON back here to deploy.</li>
                                    </ol>
                                    <button type="button" onClick={() => { navigator.clipboard.writeText(aiPromptText); alert('Prompt copied!'); }} className="w-full mt-4 py-2.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-bold rounded-xl transition-all">📋 Copy AI Prompt</button>
                                </div>
                                <textarea
                                    value={jsonInput}
                                    onChange={(e) => setJsonInput(e.target.value)}
                                    placeholder='{&#10; "Class Name": {&#10;   "lastDate": "2025-12-25",&#10;   "subjects": [...]&#10; }&#10;}'
                                    className="input-field font-mono text-sm leading-relaxed"
                                    style={{ minHeight: '300px' }}
                                    spellCheck="false"
                                />
                                {jsonError && <p className="text-red-400 text-sm font-semibold">{jsonError}</p>}
                                <div className="flex justify-end pt-2">
                                    <button
                                        onClick={handleParseJson}
                                        disabled={!jsonInput.trim()}
                                        className="btn primary-btn flex items-center gap-2"
                                    >
                                        <CheckCircle className="w-5 h-5" />
                                        Parse & Verify in Form
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar Column (Action & Results) */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="glass p-5 rounded-3xl space-y-5">
                        <h3 className="font-bold text-white/90">Direct Assignment</h3>
                        <div>
                            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">Target Email (Optional)</label>
                            <input type="email" placeholder="user@gmail.com" value={targetEmail} onChange={(e) => setTargetEmail(e.target.value)} className="input-field bg-black/20 focus:bg-white/5" />
                            <p className="text-[11px] text-muted mt-2 leading-tight">If entered, this class will auto-install on their app next sync.</p>
                        </div>
                        <button
                            onClick={handleCreateClass}
                            disabled={loading || (inputMode === 'wizard' && wizardStep !== 3)}
                            className={`w-full btn primary-btn py-3.5 shadow-lg shadow-primary/20 flex flex-col items-center justify-center gap-1.5 h-auto leading-none disabled:opacity-50`}
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                            <span className="font-bold">Deploy Class Array</span>
                            {inputMode === 'wizard' && wizardStep !== 3 && <span className="text-[10px] opacity-70">Complete Wizard first</span>}
                        </button>
                    </div>

                    <AnimatePresence>
                        {result && (
                            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className={`glass p-5 rounded-3xl border-2 ${result.type === 'success' ? 'border-green-500/30' : 'border-red-500/30'}`}>
                                <div className="flex gap-3 mb-3">
                                    <div className={`shrink-0 ${result.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                                        {result.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
                                    </div>
                                    <div>
                                        <h4 className={`font-bold text-sm ${result.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>{result.type === 'success' ? 'Deployed' : 'Failed'}</h4>
                                        <p className="text-xs text-white/70 mt-1 leading-relaxed">{result.message}</p>
                                    </div>
                                </div>
                                {result.shareId && (
                                    <div className="pt-3 border-t border-white/5 mt-3 space-y-2">
                                        <p className="text-xs text-muted mb-1">Send this link to students to install the class:</p>
                                        <div className="flex bg-black/40 rounded-lg overflow-hidden border border-white/5">
                                            <input type="text" readOnly value={`https://bunkitapp.in/?shared_class_id=${result.shareId}`} className="w-full bg-transparent px-3 py-2 text-xs font-mono text-muted outline-none" />
                                            <button
                                                onClick={() => {
                                                    const textToCopy = `BunkIt Request\nInstall Class Using Below Link:\nhttps://bunkitapp.in/?shared_class_id=${result.shareId}`;
                                                    navigator.clipboard.writeText(textToCopy);
                                                    alert('Copied in BunkIt format!');
                                                }}
                                                className="px-3 bg-white/5 hover:bg-white/10 text-white transition-colors flex items-center justify-center"
                                                title="Copy BunkIt Format"
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

export default AdminClassCreatorPage;
