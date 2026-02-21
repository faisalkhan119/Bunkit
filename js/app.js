// --- LAZY-LOAD CDN HELPER ---
async function loadScript(url) {
    if (document.querySelector(`script[src="${url}"]`)) return;
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = url;
        s.onload = resolve;
        s.onerror = () => reject(new Error(`Failed to load: ${url}`));
        document.head.appendChild(s);
    });
}
window.loadScript = loadScript;

// --- CDN LIBRARY URLs ---
const CDN = {
    CHART: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
    JSPDF: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    QRCODE: 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
    JSQR: 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js',
    TESSERACT: 'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/4.1.1/tesseract.min.js'
};

// --- GLOBAL ERROR HANDLER ---
window.onerror = function (msg, url, line, col, error) {
    console.error('Global Error:', msg, url, line, col, error);
    // Only alert for critical script errors that might break functionality
    if (msg.includes('SyntaxError') || msg.includes('ReferenceError') || msg.includes('TypeError')) {
        alert(`⚠️ App Error: ${msg}\n\nLine: ${line}\nPlease report this to the developer.`);
    }
    return false;
};

// --- GLOBAL STATE & CONSTANTS ---
const defaultHolidays = ["2026-01-01", "2026-01-15", "2026-01-26", "2026-02-15", "2026-03-02", "2026-03-03", "2026-03-04", "2026-03-21", "2026-03-26", "2026-03-31", "2026-04-03", "2026-04-14", "2026-05-01", "2026-05-27", "2026-06-26"];
const defaultExampleClass = {
    'CSE Core - H': {
        id: 'a0d0e740-6e71-4921-9647-703b27351c93',
        lastDate: '2026-05-06',
        holidays: [...defaultHolidays],
        sharedId: 'b0fc8471119b44ea',
        subjects: [
            { name: "Design and Analysis of Algorithms", code: "21CSC204J", shortName: "DAA", schedule: ["3", "0", "6", "0", "1,3,4", "0", "0"] },
            { name: "Database Management Systems", code: "21CSC205P", shortName: "DMS", schedule: ["2", "2", "3,4", "6", "0", "0", "0"] },
            { name: "Artificial Intelligence", code: "21CSC206T", shortName: "AI", schedule: ["4", "6", "1", "2", "6", "0", "0"] },
            { name: "Internet of Things", code: "21CSE253T", shortName: "IT", schedule: ["5", "5", "5", "5", "0", "0", "0"] },
            { name: "Universal Human Values-II", code: "21LEM202T", shortName: "UHV", schedule: ["0", "3,4", "0", "0", "0", "0", "0"] },
            { name: "Probability and Queueing Theory", code: "21MAB204T", shortName: "PQT", schedule: ["1", "1", "2", "1", "5", "0", "0"] },
            { name: "Social Engineering", code: "21PDH209T", shortName: "SE", schedule: ["6", "0", "0", "0", "2", "0", "0"] },
            { name: "Class Incharge", code: "CL", shortName: "CI", schedule: ["0", "0", "0", "3,4", "0", "0", "0"] }
        ],
        updatedAt: 1769350252992,
        periodTimes: {},
        portalSetup: {
            active: true,
            baselineData: {
                "CL": { total: 0, attended: 0 },
                "21CSC204J": { total: 0, attended: 0 },
                "21CSC205P": { total: 0, attended: 0 },
                "21CSC206T": { total: 0, attended: 0 },
                "21CSE253T": { total: 0, attended: 0 },
                "21LEM202T": { total: 0, attended: 0 },
                "21MAB204T": { total: 0, attended: 0 },
                "21PDH209T": { total: 0, attended: 0 }
            },
            baselineDate: "2026-01-29",
            semesterStartDate: "2026-01-05"
        },
        qrCode: ""
    }
};
let classes = {};
let selectedClass = null;
let editingClassName = null;
let ocrResultsCache = {};
let currentAnalysisData = [];
let isJsonMode = false;
let calculationHistory = [];

// Predefined color palette for subjects (timetable)
const subjectColors = [
    '#4facfe', '#00f2fe', '#667eea', '#764ba2', '#f093fb', '#f5576c',
    '#4facfe', '#43e97b', '#38f9d7', '#fa709a', '#fee140', '#00c6fb',
    '#a18cd1', '#fbc2eb', '#ff9a9e', '#fad0c4', '#a8edea', '#fed6e3',
    '#d299c2', '#fef9d7', '#89f7fe', '#66a6ff', '#c471f5', '#12c2e9'
];

// --- AUTHENTICATION & SYNC (Supabase Integrated) ---
// Legacy Google Drive/Auth code removed.

// Placeholder for Supabase Client Initialization
// const supabase = ...

// Personal API key from user settings
function getPersonalGeminiKey() {
    return localStorage.getItem('personalGeminiKey');
}

// Call Gemini API via backend proxy (for OCR, class import, etc.)
async function callGeminiProxy(action, payload) {
    const personalKey = getPersonalGeminiKey();

    if (personalKey) {
        // Use personal key with direct call
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${personalKey}`;
        return fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } else {
        // Use backend proxy
        return fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, ...payload })
        });
    }
}

// Call Gemini API with fallback to proxy
async function callGeminiAPI(prompt, retries = 3) {
    const personalKey = getPersonalGeminiKey();

    for (let i = 0; i < retries; i++) {
        try {
            let response;

            if (personalKey) {
                // Use personal key directly
                response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${personalKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                            generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
                        })
                    }
                );
            } else {
                // Use backend proxy
                response = await fetch('/api/gemini', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'generate',
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
                    })
                });
            }

            if (response.status === 429 || response.status === 403) {
                console.warn('API rate limited, retrying...');
                await new Promise(r => setTimeout(r, 1000));
                continue;
            }

            if (!response.ok) throw new Error(`API error: ${response.status}`);

            const data = await response.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
        } catch (error) {
            console.error('Gemini API error:', error);
            await new Promise(r => setTimeout(r, 500));
        }
    }
    return 'Sorry, API unavailable. Set personal API key in Settings.';
}

// [deleted PKCE helpers]

// [deleted OAuth Config & Init]

// [deleted Google Auth Logic]

function continueAsGuest() {
    localStorage.setItem('isGuest', 'true');
    document.body.classList.add('guest-mode'); // Ensure valid state
    localStorage.removeItem('googleUser');
    // googleUser = null; // Removed potential ReferenceError
    hideLoginScreen();
    updateAccountUI();
    // updateSidebarAccountUI(); // Removed missing function call
    // Check if first-time user - show onboarding
    checkFirstLoginPrompt();
    console.log('👤 Continuing as guest');
}

// [deleted signOutGoogle]

// --- LOGIN SCREEN FUNCTIONS ---
function showLoginScreen() {
    const loginScreen = document.getElementById('loginScreen');
    if (loginScreen) loginScreen.style.display = 'flex';
}

function hideLoginScreen() {
    // GUARD: If pending password reset, DO NOT hide login screen (app stays "locked")
    // The Modal will overlay it.
    if (localStorage.getItem('pending_password_reset') === 'true') {
        console.log('🔒 Login Screen hidden blocked due to pending password reset.');
        return;
    }

    const loginScreen = document.getElementById('loginScreen');
    if (loginScreen) loginScreen.style.display = 'none';
}

// --- MODAL HELPER FUNCTIONS ---
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        // Trigger reflow to enable CSS transition
        modal.offsetHeight;
        modal.classList.add('active');
        document.body.classList.add('backdrop-active'); // Block body scroll
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        // Add closing animation class
        modal.classList.add('closing');
        modal.classList.remove('active');
        // Wait for iOS-style closing animation to complete
        setTimeout(() => {
            modal.style.display = 'none';
            modal.classList.remove('closing');
            // Only remove backdrop-active if no other modals are open
            if (!document.querySelector('.modal.active')) {
                document.body.classList.remove('backdrop-active');
            }
        }, 310);
    }
}

// [deleted checkLoginStatus, silentTokenRefresh, checkAndAutoSync]

function updateAccountUI() {
    const guestView = document.getElementById('guestAccountView');
    const googleView = document.getElementById('googleAccountView');

    if (!guestView || !googleView) return;

    // For now, always show guest view until Supabase Auth is implemented
    guestView.style.display = 'block';
    googleView.style.display = 'none';
}

// --- PROFILE NAME MANAGEMENT ---
function createProfileModals() {
    // Create profile name modal if it doesn't exist
    if (!document.getElementById('profileNameModal')) {
        const modalHTML = `
                    <div id="profileNameModal" class="modal">
                        <div class="modal-content" style="max-width: 400px;">
                            <button class="modal-close" onclick="closeModal('profileNameModal')">&times;</button>
                            <div class="modal-header">
                                <h2>✏️ Edit Profile Name</h2>
                                <p>Update your display name</p>
                            </div>
                            <div class="form-group">
                                <label>Your Name</label>
                                <input type="text" id="profileNameInput" placeholder="Enter your name" maxlength="50">
                            </div>
                            <div class="form-actions" style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
                                <button class="btn secondary-btn" onclick="closeModal('profileNameModal')">Cancel</button>
                                <button class="btn primary-btn" onclick="saveProfileName()">💾 Save</button>
                            </div>
                        </div>
                    </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    // Create first login prompt modal if it doesn't exist
    if (!document.getElementById('firstLoginPromptModal')) {
        const firstLoginHTML = `
                    <div id="firstLoginPromptModal" class="modal">
                        <div class="modal-content" style="max-width: 420px;">
                            <div class="modal-header" style="text-align: center;">
                                <div style="font-size: 3rem; margin-bottom: 10px;">🎓</div>
                                <h2>Welcome to BunkIt!</h2>
                                <p>Let's get you set up. What should we call you?</p>
                            </div>
                            <div class="form-group">
                                <label>Your Name</label>
                                <input type="text" id="firstLoginNameInput" placeholder="Enter your name" maxlength="50">
                            </div>
                            <div class="form-actions" style="display: flex; justify-content: center; margin-top: 20px;">
                                <button class="btn primary-btn" onclick="saveFirstLoginName()" style="padding: 14px 40px; font-size: 1.1rem;">
                                    Continue →
                                </button>
                            </div>
                        </div>
                    </div>`;
        document.body.insertAdjacentHTML('beforeend', firstLoginHTML);
    }
}

function openProfileNameModal() {
    const savedName = localStorage.getItem('userProfileName') || '';
    const modal = document.getElementById('profileNameModal');
    if (!modal) {
        createProfileModals();
    }
    const nameInput = document.getElementById('profileNameInput');
    if (nameInput) nameInput.value = savedName;
    openModal('profileNameModal');
}

function saveProfileName() {
    const nameInput = document.getElementById('profileNameInput');
    const name = nameInput ? nameInput.value.trim() : '';
    if (name) {
        localStorage.setItem('userProfileName', name);
        // Sync to cloud
        if (window.SyncManager) SyncManager.saveSettings();
        updateSidebarAccountUI();
        closeModal('profileNameModal');
        showToast('Profile name updated successfully', 'success');
    } else {
        alert('⚠️ Please enter a name');
    }
}

// --- Deep Link Import Logic ---

function checkForClassImport() {
    const urlParams = new URLSearchParams(window.location.search);
    const classData = urlParams.get('class');

    if (classData) {
        // Store for import after onboarding completes
        sessionStorage.setItem('pendingClassImport', classData);

        // Clean URL without reload to avoid messy URL
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);

        console.log("🔗 Class import link detected and stored.");
    }
}

// Run immediately
checkForClassImport();

function checkClassDuplicate(name, newClassData) {
    // 1. Check for exact class name match
    if (classes[name]) {
        const existingClass = classes[name];
        const existingTimetable = JSON.parse(localStorage.getItem(`timetable_arrangement_${name}`) || '{}');

        // 1. Compare Subjects (Name, Code, Schedule)
        const formatSubject = s => ({
            n: s.name,
            c: s.code,
            s: JSON.stringify(s.schedule)
        });

        // Safety check: ensure subjects are arrays
        const existingSubjectsArr = Array.isArray(existingClass.subjects) ? existingClass.subjects : [];
        const newSubjectsArr = Array.isArray(newClassData.subjects) ? newClassData.subjects : [];

        const existingSubjectsStr = JSON.stringify(existingSubjectsArr.map(formatSubject));
        const newSubjectsStr = JSON.stringify(newSubjectsArr.map(formatSubject));

        // 2. Compare Holidays
        const sortStr = arr => JSON.stringify((Array.isArray(arr) ? arr : []).sort());
        const existingHolidaysStr = sortStr(existingClass.holidays);
        const newHolidaysStr = sortStr(newClassData.holidays);

        // 3. Compare Timetable Arrangement
        const existingTimetableStr = JSON.stringify(existingTimetable);
        const newTimetableStr = JSON.stringify(newClassData.timetable || {});

        // 4. Compare Last Date
        // Treat undefined as empty string for comparison
        const existingLastDate = existingClass.lastDate || '';
        const newLastDate = newClassData.lastDate || '';
        const isLastDateSame = existingLastDate === newLastDate;

        const isDuplicate =
            (existingSubjectsStr === newSubjectsStr) &&
            (existingHolidaysStr === newHolidaysStr) &&
            (existingTimetableStr === newTimetableStr) &&
            isLastDateSame;

        if (isDuplicate) {
            return { status: 'exact_duplicate' };
        } else {
            // Generate a unique name
            let counter = 1;
            let newName = `${name} (${counter})`;
            while (classes[newName]) {
                counter++;
                newName = `${name} (${counter})`;
            }
            return { status: 'name_conflict', suggestedName: newName };
        }
    }

    return { status: 'ok' };
}

function importClassFromURL(encodedData) {
    console.log("🔗 Processing Import Data (Raw):", encodedData);
    try {
        // Decode class data (Support for v2 compressed and v1 base64)
        let jsonString;
        if (encodedData.startsWith('v2_')) {
            // FIX: URLSearchParams converts '+' to spaces.
            // STRATEGY 1: Restore '+' and try decompression
            let fixedData = encodedData.substring(3).replace(/ /g, '+');
            console.log("Strategy 1 (Replace Space -> +):", fixedData);
            jsonString = LZString.decompressFromEncodedURIComponent(fixedData);

            if (!jsonString) {
                // STRATEGY 2: Maybe browser DIDN'T replace +? Try raw substring.
                console.warn("Strategy 1 failed. Trying Strategy 2 (Raw substring)...");
                fixedData = encodedData.substring(3);
                jsonString = LZString.decompressFromEncodedURIComponent(fixedData);
            }

            if (!jsonString) {
                // STRATEGY 3: URL Decoding might have messed up differently?
                // Try to strip any whitespace
                console.warn("Strategy 2 failed. Trying Strategy 3 (Strip whitespace)...");
                fixedData = encodedData.substring(3).replace(/\s/g, '');
                jsonString = LZString.decompressFromEncodedURIComponent(fixedData);
            }
        } else if (encodedData.match(/^v\d+_/)) {
            // Unknown future version (v3_, v4_, etc.) - show helpful error
            throw new Error("This link was created with a newer version of Bunkit. Please update the app.");
        } else {
            // Legacy v1 (Base64)
            jsonString = atob(encodedData);
        }

        if (!jsonString) {
            console.error("❌ Decompression returned null/empty.");
            throw new Error(`Decompression failed. Data length: ${encodedData.length}`);
        }
        const classData = JSON.parse(jsonString);

        // Validate essential data
        if (!classData.name || !classData.subjects) {
            throw new Error("Invalid class data structure");
        }

        // Validate subjects is non-empty array
        if (!Array.isArray(classData.subjects) || classData.subjects.length === 0) {
            throw new Error("Class must have at least one subject");
        }

        // Validate each subject has required fields
        classData.subjects.forEach((sub, index) => {
            if (!sub.name || typeof sub.name !== 'string') {
                throw new Error(`Subject ${index + 1} is missing a valid name`);
            }
        });

        // FIX: Ensure all subjects have a shortName (fallback to code if missing)
        classData.subjects.forEach(sub => {
            if (!sub.shortName || sub.shortName === 'undefined') {
                sub.shortName = sub.code || sub.name.substring(0, 3).toUpperCase();
            }
        });

        const inputName = classData.name;
        let finalName = inputName;
        let shouldImport = true;

        // STRICT DUPLICATE CHECK (Now passes full classData)
        let dupResult = { status: 'ok' };
        try {
            dupResult = checkClassDuplicate(inputName, classData);
        } catch (e) {
            console.error("Strict duplicate check crashed:", e);
            // USER REQUEST: Strict error, no copy creation
            alert("❌ Class already exists or the link is broken/invalid. Cannot import.");
            sessionStorage.removeItem('pendingClassImport');
            return; // ABORT IMPORT
        }

        if (dupResult.status === 'exact_duplicate') {
            alert(`⚠️ Class "${inputName}" already exists on this device with the same schedule!`);

            // Clear pending import to prevent infinite loop
            sessionStorage.removeItem('pendingClassImport');

            // If they are just finishing onboarding, we should still let them proceed to dashboard
            // So we just reload to show the existing class
            localStorage.setItem('hasCompletedOnboarding', 'true');
            localStorage.setItem('selectedClass', inputName);

            // Show ad before reload or after init logic? 
            // Better to trigger specifically if we were in onboarding
            if (window.bunkitAdManager) window.bunkitAdManager.showDailyAdIfNeeded();

            setTimeout(() => location.reload(), 1500); // Slight delay for ad to potentially show or track
            return;
        }

        if (dupResult.status === 'name_conflict') {
            // Ask user: Update or Copy?
            const userWantsUpdate = confirm(
                `⚠️ Class "${inputName}" already exists on this device but looks different.\n\n` +
                `Do you want to UPDATE the existing class with this new version?\n` +
                `(Cancel will create a separate copy)`
            );

            if (userWantsUpdate) {
                finalName = inputName; // Overwrite existing
            } else {
                // Create Copy
                finalName = dupResult.suggestedName;
            }
        }

        if (!shouldImport) return;

        // Import class to IndexedDB/LocalStorage
        // We simply add it to the 'classes' object and saveToStorage
        // Ensure we preserve all fields
        // Preserve Local Configs if updating
        const oldPortalSetup = classes[finalName]?.portalSetup;
        const oldSharedId = classes[finalName]?.sharedId;

        classes[finalName] = {
            lastDate: classData.lastDate || formatLocalDate(new Date()),
            subjects: classData.subjects,
            holidays: classData.holidays || [],
            periodTimes: classData.periodTimes || {}, // Import period times if available

            // CRITICAL: Preserve local configs (Portal Mode & Mass Bunk ID)
            portalSetup: classData.portalSetup || oldPortalSetup || {},
            sharedId: classData.sharedId || oldSharedId,

            updatedAt: Date.now() // Add timestamp for sync priority
        };

        // Save timetable arrangement if present
        if (classData.timetable) {
            localStorage.setItem(`timetable_arrangement_${finalName}`, JSON.stringify(classData.timetable));
        }

        // FIX: Save period times if present (using canonical snake_case key)
        if (classData.periodTimes) {
            localStorage.setItem(`period_times_${finalName}`, JSON.stringify(classData.periodTimes));
        }

        // FIX: Save period-wise view menu visibility preference if previously set? 
        // (Not strictly part of classData but good to know)

        // FIX: Check for portal setup in separate storage if needed?
        // Currently portalSetup is inside classes object, checking initPortal usage...
        // initPortal reads selectedClass.portalSetup. Correct. No separate storage needed.

        saveToStorage();

        // Auto-register class membership in Supabase
        const importedSharedId = classes[finalName]?.sharedId;
        if (importedSharedId && window.supabaseClient && window.AuthManager?.user) {
            supabaseClient.from('class_memberships').upsert({
                shared_class_id: importedSharedId,
                user_id: AuthManager.user.id
            }, { onConflict: 'shared_class_id, user_id' }).then(({ error }) => {
                if (error) console.error('Membership reg failed:', error);
                else console.log('✅ Class membership registered:', importedSharedId);
            });
        }

        // Mark onboarding complete
        localStorage.setItem('hasCompletedOnboarding', 'true');
        if (window.bunkitAdManager) window.bunkitAdManager.showDailyAdIfNeeded();

        // Clear pending import
        sessionStorage.removeItem('pendingClassImport');

        // Show success message
        const safeName = finalName.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
        showToast(`🎉 Welcome! "${safeName}" has been added!`, 'success');

        // Set as current class and reload
        localStorage.setItem('selectedClass', finalName);
        localStorage.setItem('lastOpenedClass', finalName);

        // Flag to trigger tutorial after reload (Use localStorage for better reliability across refreshes)
        localStorage.setItem('postImportTutorial', 'true');

        setTimeout(() => location.reload(), 1000);

    } catch (error) {
        console.error('Failed to import class:', error);
        // CRITICAL: Clear pending import so it doesn't loop on refresh
        sessionStorage.removeItem('pendingClassImport');

        const safeError = error.message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        alert(`❌ Failed to import class link.\n\nError: ${safeError}\n\nThe link might be broken or from an older version.`);

        // Fallback to normal onboarding if this was part of first login
        // DISABLED: User wants NO automatic modals
        if (!localStorage.getItem('hasCompletedOnboarding')) {
            console.log('📝 Import failed but not showing modal automatically. User can add class via dashboard.');
        }
    }
}

function saveFirstLoginName() {
    const nameInput = document.getElementById('firstLoginNameInput');
    const name = nameInput ? nameInput.value.trim() : '';
    if (name) {
        localStorage.setItem('userProfileName', name);
        // Sync to cloud
        if (window.SyncManager) SyncManager.saveSettings();
        updateSidebarAccountUI();
        // Close modal with iOS animation
        closeModal('firstLoginPromptModal');

        // Check if we have a pending class import from a deep link
        const pendingClass = sessionStorage.getItem('pendingClassImport');
        if (pendingClass) {
            // Skip class choice modal and import directly
            setTimeout(() => importClassFromURL(pendingClass), 350);
        } else {
            // Restore flow: Open Class Choice Modal
            openOnboardingClassModal();
        }
    } else {
        showToast('Please enter your name to continue', 'warning');
    }
}

// Handle Existing Users who click the link
if (localStorage.getItem('hasCompletedOnboarding') === 'true') {
    const pendingClass = sessionStorage.getItem('pendingClassImport');
    if (pendingClass) {
        // small delay to ensure DB is ready
        setTimeout(() => importClassFromURL(pendingClass), 500);
    }
}

let isCheckingOnboarding = false;
function checkFirstLoginPrompt() {
    if (isCheckingOnboarding) {
        console.log('🛡️ Onboarding check blocked (Lock Active)');
        return;
    }
    isCheckingOnboarding = true;
    setTimeout(() => { isCheckingOnboarding = false; }, 3000);

    // Check if user has already completed onboarding
    const hasCompleted = localStorage.getItem('hasCompletedOnboarding');
    if (hasCompleted === 'true') return;

    // PRIORITY 1: If a class import is pending, handle it
    const pendingImport = sessionStorage.getItem('pendingClassImport');
    if (pendingImport) {
        console.log("📥 Pending Import detected. Triggering import...");

        // Check if user has a profile name, if not show name prompt first
        const profileName = localStorage.getItem('userProfileName');
        if (!profileName) {
            // Show name prompt - the saveFirstLoginName function will handle import after
            console.log("📥 No profile name. Showing name prompt first...");
            if (typeof createProfileModals === 'function') createProfileModals();
            setTimeout(() => {
                if (document.getElementById('firstLoginPromptModal')) {
                    openModal('firstLoginPromptModal');
                }
            }, 500);
        } else {
            // User has name, import directly
            setTimeout(() => importClassFromURL(pendingImport), 500);
        }
        return;
    }

    // PRIORITY 2: DATA CHECK (Guest -> Signup conversion or existing data)
    // If user has ANY classes (local or synced), we assume they are already onboarded.
    const hasClasses = selectedClass || (window.classes && Object.keys(window.classes).length > 0);
    if (hasClasses) {
        // console.log("✅ User has data. Skipping onboarding.");
        return;
    }

    // PRIORITY 3: EXPLICIT NEW USER CHECKS
    // We only show onboarding if:
    // A) 'forceOnboarding' flag is set (from Email Signup)
    // B) User account is very new (< 2 mins) (from Google Signup)
    const forceOnboarding = localStorage.getItem('forceOnboarding');
    const user = window.AuthManager?.user;
    let isNewUser = false;

    if (user && user.created_at) {
        const createdTime = new Date(user.created_at).getTime();
        const now = Date.now();
        // If created in last 2 minutes, treat as new
        if ((now - createdTime) < 120000) {
            isNewUser = true;
        }
    }

    if (forceOnboarding || isNewUser || !user) {
        // Cleanup flag
        localStorage.removeItem('forceOnboarding');
    } else {
        // Standard Login with no data -> Show subtle empty state prompt (not modal)
        console.log("🚫 Standard Login (Old Account + No Data). Showing empty state prompt.");

        // Show a subtle toast after a short delay to guide user
        setTimeout(() => {
            if (typeof showToast === 'function') {
                showToast('👋 Welcome back!', 'Tap "Add Class" to get started', { duration: 5000 });
            }
        }, 1500);
        return;
    }

    // First time user (No Flag + No Data) - show onboarding
    console.log("🆕 Starting Onboarding Flow...");
    setTimeout(() => {
        // Open the Class Setup Modal directly (Skip Name Prompt as it's less critical/confusing)
        // Or follow original flow? Original flow: openModal('firstLoginPromptModal') -> Name.
        // Let's stick to original flow but ensure it opens.

        // Actually, let's skip to the main action: "Setup Your Class"
        // because "Name" is often handled in "Signup" now.
        // But if Guest? They might want a name.
        // Let's check if Guest Name exists.
        // Check for existing name from various sources
        const guestName = localStorage.getItem('guest_name');
        const profileName = localStorage.getItem('userProfileName');
        const authName = window.AuthManager?.user?.user_metadata?.full_name;

        // Consolidate name
        const existingName = guestName || profileName || authName;

        if (!existingName) {
            createProfileModals();
            const firstLoginInput = document.getElementById('firstLoginNameInput');
            if (firstLoginInput) firstLoginInput.value = '';
            openModal('firstLoginPromptModal');
        } else {
            // If name exists (e.g. from Google Login implicit?), go to Class Setup
            openOnboardingClassModal();
        }
    }, 500);
}

function openOnboardingClassModal() {
    createOnboardingClassModal();
    openModal('onboardingClassModal');
    // Bot will appear 3s after user clicks Example/Add Class buttons
}

function createOnboardingClassModal() {
    if (document.getElementById('onboardingClassModal')) return;

    const modal = document.createElement('div');
    modal.id = 'onboardingClassModal';
    modal.className = 'modal';
    modal.innerHTML = `
                <div class="modal-content" style="max-width: 400px;">
                    <div class="modal-header" style="text-align: center;">
                        <div style="font-size: 2.5rem; margin-bottom: 10px;">📚</div>
                        <h2>Setup Your Class</h2>
                        <p>Choose how you want to get started</p>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 15px; padding: 15px 0;">
                        <button class="btn primary-btn" onclick="handleCreateNewClass();" style="padding: 18px; font-size: 1.1rem;">
                            ➕ Create New Class
                        </button>
                        <button class="btn secondary-btn" onclick="useExampleClass();" style="padding: 18px; font-size: 1.1rem;">
                            📝 Use Example Class
                        </button>
                    </div>
                </div>`;
    document.body.appendChild(modal);
}

function useExampleClass() {
    // Show Bot with glow after 3 seconds
    setTimeout(() => {
        const botBtn = document.getElementById('aiChatbotButton');
        const botPanel = document.getElementById('aiChatPanel');
        if (botBtn) {
            document.body.appendChild(botBtn);
            botBtn.style.display = 'flex';
            botBtn.style.zIndex = '2147483647';
            botBtn.style.pointerEvents = 'auto';  // Ensure clicks are received
            botBtn.style.position = 'fixed';  // Ensure fixed positioning
            botBtn.classList.add('glowing-pulse');

            // Store reference globally for click detection
            window._bunkmateBot = botBtn;

            // Direct click handler using addEventListener
            botBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                e.preventDefault();

                // Close ALL modals first
                document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));

                // Close tutorial overlay if present
                const overlay = document.getElementById('bunkmateTutorialOverlay');
                if (overlay) overlay.remove();

                // Remove glow
                this.classList.remove('glowing-pulse');

                // Open chatbot panel - FORCE visibility with inline styles
                const panel = document.getElementById('aiChatPanel');
                if (panel) {
                    panel.classList.add('active');
                    panel.style.right = '0';
                    panel.style.display = 'flex';
                    panel.style.zIndex = '2147483647';
                }
            }, true);  // Capture phase
        }
        if (botPanel) {
            document.body.appendChild(botPanel);
            botPanel.style.zIndex = '2147483647';
        }
    }, 3000);

    // Close modal with animation
    closeModal('onboardingClassModal');

    localStorage.setItem('hasCompletedOnboarding', 'true');
    if (window.bunkitAdManager) window.bunkitAdManager.showDailyAdIfNeeded();

    // Explicitly Add Example Class
    const exampleClassName = 'CSE Core - H';
    // Only add if not already present (though unlikely in this flow)
    if (!classes[exampleClassName]) {
        classes[exampleClassName] = JSON.parse(JSON.stringify(defaultExampleClass[exampleClassName]));

        // [NEW] Disable Portal Mode by default for Example Class
        if (classes[exampleClassName].portalSetup) {
            classes[exampleClassName].portalSetup.active = false; // key is 'active' not 'isEnabled'
        }

        saveToStorage();
        populateClassSelector(); // Refresh dropdown
    }

    // Select the example class in dropdown
    const classSelector = document.getElementById('classSelector');
    // exampleClassName already defined above

    if (classSelector) {
        classSelector.value = exampleClassName;
        // Trigger change to load the class
        if (typeof handleDropdownChange === 'function') {
            handleDropdownChange();
        }
    }

    // Open the Edit/Share Class form for the example class
    setTimeout(() => {
        if (typeof editSelectedClass === 'function') {
            editSelectedClass();
        }
    }, 100);

    // Show Bunkmate tutorial after 3 seconds
    setTimeout(() => showBunkmateTutorial('example'), 3000);
}

function handleCreateNewClass() {
    // Show Bot with glow after 3 seconds
    setTimeout(() => {
        // ... (Bot logic preserved) ...
    }, 3000);

    // Close onboarding modal with animation
    closeModal('onboardingClassModal');
    localStorage.setItem('hasCompletedOnboarding', 'true');
    if (window.bunkitAdManager) window.bunkitAdManager.showDailyAdIfNeeded();

    // ZOMBIE TRIGGER REMOVED:
    // if (typeof openAddClassModal === 'function') openAddClassModal();

    // Show Bunkmate tutorial after 3 seconds
    setTimeout(() => showBunkmateTutorial('newclass'), 3000);
}

// ... (Rest of file) ...

// --- BUNKMATE TUTORIAL CLOUD ANIMATION ---
let tutorialCloudIndex = 0;
let tutorialMessages = [];
let tutorialInterval = null;

function showBunkmateTutorial(type) {
    const userName = localStorage.getItem('userProfileName') || 'Friend';

    // Tutorial messages in Hinglish
    const introMessages = [
        `👋 Hey ${userName}! Main <b>Bunkmate</b> hoon - tumhara personal AI assistant jo tumhari attendance manage karne mein help karega!`,
        `🎯 Bunkit app se tum dekh sakte ho ki <b>kitne lectures bunk</b> kar sakte ho bina attendance giraye. Mast hai na? 😎`,
        `📊 App tumhe batayega ki <b>75% attendance</b> maintain karne ke liye kitne classes attend karne hain ya kitne bunk kar sakte ho!`
    ];

    const newClassMessages = [
        `📝 <b>Form Entry Tab:</b> Yahaan manually apni class ka naam likho, last working date daalo, aur ek ek subject add karo with weekly schedule!`,
        `📅 <b>Weekly Schedule:</b> Har subject ke liye Monday se Sunday tak <b>kitne lectures</b> hain wo batana hai. Jaise Monday ko 2 lectures, Tuesday ko 1, etc.`,
        `🤖 <b>Inbuilt AI Import:</b> Sabse easy tarika! Apni <b>timetable ki photo</b> upload karo, AI khud subjects aur schedule extract kar lega!`,
        `⚡ <b>AI Tip:</b> Best results ke liye <b>clear photo</b> lo jisme text properly dikh raha ho. Blurry photo se galat data aa sakta hai!`,
        `📥 <b>Import from JSON:</b> Agar tumhare dost ne class export ki hai ya pehle backup liya tha, to yahan <b>paste</b> karke import karo!`,
        `📱 <b>Scan QR:</b> Dost ki class ka QR code scan karo aur <b>instantly</b> same class import ho jayegi. Sharing is caring! 🤝`,
        `🎓 <b>Pro Tip:</b> Class banana ke baad <b>hamburger menu</b> (☰) se backup le lo taaki data safe rahe!`,
        `💬 <b>Need Help?</b> Kabhi bhi confuse ho to neeche right side mein mera <b>chat icon</b> 💬 hai - kuch bhi poocho!`
    ];

    const exampleMessages = [
        `📚 Ye ek <b>Example Class</b> hai - CSE Core H semester ka demo! Isse samajh lo app kaise kaam karta hai.`,
        `👀 Dekho - <b>Class Name</b> upar hai, <b>Last Working Date</b> semester end date hai, aur neeche saare <b>subjects</b> hain!`,
        `📅 Har subject mein <b>Weekly Schedule</b> hai - matlab Mon-Sun kitne lectures hain. Ye attendance calculate karne ke liye zaroori hai!`,
        `✏️ <b>Edit kaise kare:</b> Subject name click karke change karo, schedule mein numbers change karo, ya <b>Remove</b> button se delete karo!`,
        `➕ <b>Naya Subject:</b> Neeche <b>"+ Add Subject"</b> button hai - click karke apne subjects add karo!`,
        `💾 <b>Save karna mat bhoolna:</b> Saare changes karne ke baad <b>Save Class</b> button zaroor dabao!`,
        `📊 <b>Attendance Track:</b> Save karne ke baad main screen pe subjects dikhenge - wahan se daily attendance mark karo!`,
        `💬 <b>Confused?</b> Koi tension nahi! Neeche right side mein mera <b>chat icon</b> 💬 hai - mujhse kuch bhi poocho, main hoon na! 🤗`
    ];

    // Correctly mapping 'intro' to 'introMessages'
    if (type === 'intro') {
        tutorialMessages = introMessages;
    } else {
        tutorialMessages = [...introMessages, ...(type === 'newclass' ? newClassMessages : exampleMessages)];
    }

    tutorialCloudIndex = 0;
    createTutorialOverlay();
    showNextCloud();
}

function createTutorialOverlay() {
    // ENSURE CHATBOT BUTTON EXISTS
    let botBtn = document.getElementById('aiChatbotButton');
    if (!botBtn) {
        console.warn('⚠️ aiChatbotButton missing during tutorial setup. Creating fallback.');
        botBtn = document.createElement('div');
        botBtn.id = 'aiChatbotButton';
        botBtn.innerHTML = '💬'; // Simple icon
        Object.assign(botBtn.style, {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
            zIndex: '2147483647',
            transition: 'transform 0.3s ease'
        });
        document.body.appendChild(botBtn);

        // Attach click handler (basic)
        botBtn.onclick = function () {
            const panel = document.getElementById('aiChatPanel');
            if (panel) {
                panel.classList.add('active');
                panel.style.right = '0';
            }
        };
    }

    // Remove existing if any
    const existing = document.getElementById('bunkmateTutorialOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'bunkmateTutorialOverlay';
    overlay.innerHTML = `
                    <style>
                        #bunkmateTutorialOverlay {
                            position: fixed;
                            bottom: 90px;
                            right: 20px;
                            z-index: 100000;
                            pointer-events: none;
                        }
                        .bunkmate-cloud {
                            background: white;
                            color: #333;
                            padding: 15px 20px;
                            border-radius: 20px;
                            max-width: 320px;
                            box-shadow: 0 8px 32px rgba(0,0,0,0.2);
                            position: relative;
                            animation: cloudPop 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
                            pointer-events: auto;
                            font-size: 0.95rem;
                            line-height: 1.5;
                        }
                        .bunkmate-cloud::after {
                            content: '';
                            position: absolute;
                            bottom: -10px;
                            right: 30px;
                            width: 20px;
                            height: 20px;
                            background: white;
                            transform: rotate(45deg);
                            box-shadow: 4px 4px 8px rgba(0,0,0,0.1);
                        }
                        .bunkmate-cloud-header {
                            display: flex;
                            align-items: center;
                            gap: 8px;
                            margin-bottom: 8px;
                            font-weight: 600;
                            color: #6366f1;
                        }
                        .bunkmate-cloud-text {
                            color: #444;
                        }
                        .bunkmate-cloud-actions {
                            display: flex;
                            gap: 10px;
                            margin-top: 12px;
                            justify-content: flex-end;
                        }
                        .bunkmate-btn {
                            padding: 6px 14px;
                            border: none;
                            border-radius: 8px;
                            cursor: pointer;
                            font-size: 0.85rem;
                            font-weight: 500;
                            transition: all 0.2s;
                        }
                        .bunkmate-btn-next {
                            background: linear-gradient(135deg, #6366f1, #8b5cf6);
                            color: white;
                        }
                        .bunkmate-btn-next:hover {
                            transform: scale(1.05);
                        }
                        .bunkmate-btn-skip {
                            background: #f1f5f9;
                            color: #64748b;
                        }
                        .bunkmate-btn-skip:hover {
                            background: #e2e8f0;
                        }
                        .bunkmate-progress {
                            display: flex;
                            gap: 4px;
                            margin-top: 10px;
                            justify-content: center;
                        }
                        .bunkmate-dot {
                            width: 6px;
                            height: 6px;
                            border-radius: 50%;
                            background: #e2e8f0;
                        }
                        .bunkmate-dot.active {
                            background: #6366f1;
                        }
                        @keyframes cloudPop {
                            0% { transform: scale(0) translateY(50px); opacity: 0; }
                            100% { transform: scale(1) translateY(0); opacity: 1; }
                        }
                    </style>
                    <div class="bunkmate-cloud">
                        <div class="bunkmate-cloud-header">
                            <span>🤖</span> Bunkmate
                        </div>
                        <div class="bunkmate-cloud-text" id="bunkmateCloudText"></div>
                        <div class="bunkmate-progress" id="bunkmateProgress"></div>
                        <div class="bunkmate-cloud-actions">
                            <button class="bunkmate-btn bunkmate-btn-skip" onclick="closeBunkmateTutorial()">Got it</button>
                            <button class="bunkmate-btn bunkmate-btn-next" onclick="showNextCloud()" id="bunkmateNextBtn">Next →</button>
                        </div>
                    </div>
                `;
    document.body.appendChild(overlay);
}

function showNextCloud() {
    const textEl = document.getElementById('bunkmateCloudText');
    const progressEl = document.getElementById('bunkmateProgress');
    const nextBtn = document.getElementById('bunkmateNextBtn');

    if (!textEl || tutorialCloudIndex >= tutorialMessages.length) {
        closeBunkmateTutorial();
        return;
    }

    // Update cloud with animation
    const cloud = document.querySelector('.bunkmate-cloud');
    if (cloud) {
        cloud.style.animation = 'none';
        cloud.offsetHeight; // Trigger reflow
        cloud.style.animation = 'cloudPop 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
    }

    textEl.innerHTML = tutorialMessages[tutorialCloudIndex];

    // Update progress dots
    progressEl.innerHTML = tutorialMessages.map((_, i) =>
        `<div class="bunkmate-dot ${i === tutorialCloudIndex ? 'active' : ''}"></div>`
    ).join('');

    // Update button text on last message
    if (tutorialCloudIndex === tutorialMessages.length - 1) {
        nextBtn.textContent = 'Done ✓';
    } else {
        nextBtn.textContent = 'Next →';
    }

    tutorialCloudIndex++;
}

function closeBunkmateTutorial() {
    const overlay = document.getElementById('bunkmateTutorialOverlay');
    if (overlay) {
        overlay.style.transition = 'opacity 0.3s';
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 300);
    }
    tutorialCloudIndex = 0;
    tutorialMessages = [];

    // Stop the bot icon glow when tutorial is skipped/finished
    const botBtn = document.getElementById('aiChatbotButton');
    if (botBtn) {
        botBtn.classList.remove('glowing-pulse');
    }
}

// Duplicate function removed to fix onboarding UI consistency
/* 
// [DELETED] Conflicting createProfileModals definition
*/

// Update sidebar account section UI
window.updateSidebarAccountUI = function () {
    const signInBtn = document.getElementById('sidebarSignInBtn');
    const syncBtn = document.getElementById('sidebarSyncBtn');
    const signOutBtn = document.getElementById('sidebarSignOutBtn');
    const lastSyncedDiv = document.getElementById('sidebarLastSynced');
    const userName = document.getElementById('sidebarUserName');
    const userEmail = document.getElementById('sidebarUserEmail');
    const userAvatar = document.getElementById('sidebarUserAvatar');


    if (!userName) return;

    // Check BOTH Google OAuth user AND Supabase AuthManager user
    const authManagerUser = window.AuthManager && window.AuthManager.user;
    const savedUser = localStorage.getItem('googleUser');

    // FORCE: If AuthManager user exists, we are DEFINITELY not a guest.
    if (authManagerUser) {
        localStorage.removeItem('isGuest');
        localStorage.removeItem('guest_mode_active');
    }

    const isGuest = localStorage.getItem('isGuest') === 'true';
    const profileName = localStorage.getItem('userProfileName');
    const lastSyncTime = localStorage.getItem('lastSyncTime');

    const isSignedIn = (!isGuest && savedUser) || authManagerUser;

    if (isSignedIn) {
        // Signed in user (either Google OAuth or Supabase)
        const user = savedUser ? JSON.parse(savedUser) : (authManagerUser?.user_metadata || {});
        signInBtn.style.display = 'none';
        syncBtn.style.display = 'block';
        signOutBtn.style.display = 'block';


        // Show last synced time
        if (lastSyncedDiv) {
            lastSyncedDiv.style.display = 'block';
            if (lastSyncTime) {
                const syncDate = new Date(parseInt(lastSyncTime));
                const formattedDate = syncDate.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
                const formattedTime = syncDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                lastSyncedDiv.textContent = `🕐 Last synced: ${formattedDate}, ${formattedTime}`;
            } else {
                lastSyncedDiv.textContent = '🕐 Last synced: Never';
            }
        }

        // Get display name from various sources
        const displayName = profileName || user.name || user.full_name || authManagerUser?.email?.split('@')[0] || 'User';
        const displayEmail = user.email || authManagerUser?.email || '';

        userName.textContent = displayName;
        userEmail.textContent = displayEmail;

        if (user.picture && userAvatar) {
            userAvatar.innerHTML = `<img src="${user.picture}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
        } else if (userAvatar) {
            const initial = displayName.charAt(0).toUpperCase();
            userAvatar.innerHTML = initial;
        }
    } else {
        // Guest user
        signInBtn.style.display = 'block';
        syncBtn.style.display = 'none';
        signOutBtn.style.display = 'none';

        if (lastSyncedDiv) lastSyncedDiv.style.display = 'none';

        userName.textContent = profileName || 'Guest User';
        userEmail.textContent = profileName ? 'Guest Mode' : 'Not signed in';

        if (userAvatar) {
            const initial = profileName ? profileName.charAt(0).toUpperCase() : '👤';
            userAvatar.innerHTML = initial;
        }
    }
}

// --- GOOGLE DRIVE SYNC FUNCTIONS ---
async function uploadBackupToDrive() {
    if (!googleUser?.accessToken) {
        console.log('No access token for upload');
        return false;
    }

    try {
        const backupData = getBackupDataObj();
        backupData.metadata.syncTimestamp = new Date().toISOString();

        // Check if file exists
        const fileId = await findBackupFileId();

        // Check if token was invalidated during findBackupFileId (403 error)
        if (!googleUser?.accessToken) {
            console.log('Token was cleared, consent requested. User needs to retry.');
            return false;
        }

        if (fileId) {
            // Update existing file
            await updateDriveFile(fileId, backupData);
        } else {
            // Create new file
            await createDriveFile(backupData);
        }

        localStorage.setItem('lastDriveSync', new Date().toISOString());
        updateAccountUI();
        console.log('✅ Backup uploaded to Drive');
        return true;
    } catch (error) {
        console.error('Upload to Drive failed:', error);
        return false;
    }
}

async function downloadBackupFromDrive() {
    if (!googleUser?.accessToken) {
        console.log('No access token for download');
        return null;
    }

    try {
        const fileId = await findBackupFileId();
        if (!fileId) {
            console.log('No backup file found in Drive');
            return null;
        }

        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
            {
                headers: { 'Authorization': `Bearer ${googleUser.accessToken}` }
            }
        );

        // Handle 403 Forbidden - need fresh consent
        if (response.status === 403 || response.status === 401) {
            console.log('⚠️ Drive download access denied, user needs to grant permission');
            googleUser.accessToken = null;
            // Don't auto-request - popup blocked. Next sync click will trigger proper consent
            return null;
        }

        if (!response.ok) throw new Error('Download failed');

        const data = await response.json();
        console.log('✅ Backup downloaded from Drive');
        return data;
    } catch (error) {
        console.error('Download from Drive failed:', error);
        return null;
    }
}

async function findBackupFileId() {
    try {
        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${BACKUP_FILENAME}'`,
            {
                headers: { 'Authorization': `Bearer ${googleUser.accessToken}` }
            }
        );

        // Handle 403 Forbidden - need to request consent again
        if (response.status === 403 || response.status === 401) {
            console.log('⚠️ Drive access denied, user needs to grant permission...');
            googleUser.accessToken = null; // Clear invalid token
            // DON'T auto-request consent - popup will be blocked
            // User needs to click Sync button which triggers user-action popup
            alert('🔐 Google Drive permission needed!\n\nPlease click "Sync" button again to grant Drive access.');
            return null;
        }

        const data = await response.json();
        return data.files?.[0]?.id || null;
    } catch (error) {
        console.error('Find file failed:', error);
        return null;
    }
}

async function createDriveFile(backupData) {
    const metadata = {
        name: BACKUP_FILENAME,
        parents: ['appDataFolder']
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([JSON.stringify(backupData)], { type: 'application/json' }));

    const response = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${googleUser.accessToken}` },
            body: form
        }
    );

    // Handle 403 Forbidden - need fresh consent
    if (response.status === 403 || response.status === 401) {
        googleUser.accessToken = null;
        // Don't auto-request - popup blocked. Next sync click will trigger proper consent
        throw new Error('Drive permission denied');
    }

    if (!response.ok) throw new Error('Create file failed');
    return await response.json();
}
async function updateDriveFile(fileId, backupData) {
    const response = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
        {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${googleUser.accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(backupData)
        }
    );

    // Handle 403 Forbidden - need fresh consent
    if (response.status === 403 || response.status === 401) {
        googleUser.accessToken = null;
        // Don't auto-request - popup blocked. Next sync click will trigger proper consent
        throw new Error('Drive permission denied');
    }

    if (!response.ok) throw new Error('Update file failed');
    return await response.json();
}

async function syncWithDrive() {
    // Check if user has token
    if (googleUser && !googleUser.accessToken) {
        // Try to refresh token first
        const newToken = await refreshWithToken();
        if (newToken) {
            console.log('✅ Token refreshed, proceeding with sync');
        } else {
            // No token and can't refresh - request via GIS
            if (gisInited && tokenClient) {
                showToast('🔐 Session expired', 'Please grant access', { duration: 3000 });
                requestToken({ prompt: 'consent' });
            } else {
                alert('⚠️ Please sign in with Google first.');
            }
            return;
        }
    }

    if (!googleUser?.accessToken) {
        alert('⚠️ Please sign in with Google first.');
        return;
    }

    try {
        showToast('☁️ Syncing...', 'Connecting to Google Drive', { duration: 2000 });

        const cloudBackup = await downloadBackupFromDrive();

        // Check if token was invalidated during download (403 error)
        if (!googleUser?.accessToken) {
            console.log('Token was cleared during download, consent requested. User needs to retry.');
            showToast('🔐 Permission needed', 'Please click Sync again after granting access', { duration: 4000 });
            return;
        }

        const localBackup = getBackupDataObj();

        // Check if local data is essentially empty
        const localHasData = localBackup.stats && (
            localBackup.stats.totalClasses > 0 ||
            localBackup.stats.totalLogs > 0
        );
        const cloudHasData = cloudBackup && cloudBackup.stats && (
            (cloudBackup.stats.totalClasses || 0) > 0 ||
            (cloudBackup.stats.totalLogs || 0) > 0
        );

        // Check if this is the first sync for this Google account on this device
        const syncedAccountsKey = 'syncedGoogleAccounts';
        const syncedAccounts = JSON.parse(localStorage.getItem(syncedAccountsKey) || '[]');
        const currentEmail = googleUser?.email;
        const isFirstSyncForAccount = currentEmail && !syncedAccounts.includes(currentEmail);

        if (!cloudBackup) {
            // No cloud backup - upload local (even if empty, user is starting fresh)
            if (localHasData) {
                await uploadBackupToDrive();
                showToast('☁️ Synced', 'Backup uploaded to Google Drive', { duration: 3000 });
            } else {
                showToast('☁️ Synced', 'No data to backup yet', { duration: 3000 });
            }
        } else {
            // CRITICAL: Protect against data loss
            // If local is empty but cloud has data, ALWAYS restore from cloud
            if (!localHasData && cloudHasData) {
                console.log('⚠️ Local data is empty but cloud has data - restoring from cloud');
                restoreFromBackupData(cloudBackup);
                showToast('☁️ Restored', 'Your data was restored from Google Drive', { duration: 4000 });
                celebrateAchievement('goal-reached');
                // Mark this account as synced on this device
                if (currentEmail && !syncedAccounts.includes(currentEmail)) {
                    syncedAccounts.push(currentEmail);
                    localStorage.setItem(syncedAccountsKey, JSON.stringify(syncedAccounts));
                }
                localStorage.setItem('lastSyncTime', Date.now().toString());
                localStorage.setItem('lastDriveSync', new Date().toISOString());
                updateSidebarAccountUI();
                return;
            }

            // FIRST SYNC PROTECTION: If this is first sync on this device AND both have data
            // Compare timestamps to decide action
            if (isFirstSyncForAccount && localHasData && cloudHasData) {
                const cloudClasses = cloudBackup.stats?.totalClasses || 0;
                const localClasses = localBackup.stats?.totalClasses || 0;
                const cloudTime = new Date(cloudBackup.metadata?.syncTimestamp || cloudBackup.metadata?.timestamp || 0);
                // Use lastAppInteraction (actual user activity) instead of backup timestamp
                const localInteraction = localStorage.getItem('lastAppInteraction');
                const localTime = localInteraction ? new Date(localInteraction) : new Date(0);

                // If local is NOT newer than cloud, auto-restore from cloud (safe default)
                if (localTime <= cloudTime) {
                    console.log('🔄 First sync: Local not newer than cloud, auto-restoring from cloud');
                    restoreFromBackupData(cloudBackup);
                    showToast('☁️ Restored', 'Your data was restored from Google Drive', { duration: 4000 });
                } else {
                    // Local is NEWER - this is unusual, ask user (might be on friend's device)
                    const userChoice = confirm(
                        `🔄 First sync on this device!\n\n` +
                        `This device has NEWER data than your cloud backup:\n` +
                        `☁️ Cloud backup: ${cloudClasses} class(es)\n` +
                        `📱 This device: ${localClasses} class(es)\n\n` +
                        `Choose wisely:\n` +
                        `• OK = Restore YOUR backup from Google Drive\n` +
                        `• Cancel = Keep this device's data (will overwrite cloud!)`
                    );

                    if (userChoice) {
                        // User wants their cloud backup
                        console.log('👤 User chose to restore from cloud (first sync protection)');
                        restoreFromBackupData(cloudBackup);
                        showToast('☁️ Restored', 'Your data was restored from Google Drive', { duration: 4000 });
                    } else {
                        // User chose device data - double confirm for safety
                        const doubleConfirm = confirm(
                            `⚠️ Are you SURE?\n\n` +
                            `This will PERMANENTLY replace your cloud backup ` +
                            `(${cloudClasses} classes) with this device's data (${localClasses} classes).\n\n` +
                            `This cannot be undone!`
                        );

                        if (doubleConfirm) {
                            console.log('👤 User confirmed to upload local data (first sync protection)');
                            await uploadBackupToDrive();
                            showToast('☁️ Synced', 'Cloud backup replaced with this device data', { duration: 3000 });
                        } else {
                            // User cancelled - restore from cloud instead
                            restoreFromBackupData(cloudBackup);
                            showToast('☁️ Restored', 'Your data was restored from Google Drive', { duration: 4000 });
                        }
                    }
                }

                // Mark this account as synced on this device
                syncedAccounts.push(currentEmail);
                localStorage.setItem(syncedAccountsKey, JSON.stringify(syncedAccounts));
                localStorage.setItem('lastSyncTime', Date.now().toString());
                localStorage.setItem('lastDriveSync', new Date().toISOString());
                updateSidebarAccountUI();
                return;
            }

            // Compare timestamps (only if local has data AND not first sync)
            const cloudTime = new Date(cloudBackup.metadata?.syncTimestamp || cloudBackup.metadata?.timestamp || 0);
            // Use lastAppInteraction (actual user activity) instead of backup timestamp
            const localInteraction = localStorage.getItem('lastAppInteraction');
            const localTime = localInteraction ? new Date(localInteraction) : new Date(0);

            console.log('Cloud time:', cloudTime, 'Local interaction time:', localTime);
            console.log('Local has data:', localHasData, 'Cloud has data:', cloudHasData);

            if (cloudTime > localTime) {
                // Cloud is newer - restore from cloud
                console.log('☁️ Cloud backup is newer - restoring');
                restoreFromBackupData(cloudBackup);
                showToast('☁️ Synced', 'Data restored from Google Drive', { duration: 3000 });
            } else if (localTime > cloudTime) {
                // Local is newer - upload to cloud
                console.log('📱 Local data is newer - uploading');
                await uploadBackupToDrive();
                showToast('☁️ Synced', 'Backup uploaded to Google Drive', { duration: 3000 });
            } else {
                showToast('☁️ Synced', 'Everything is up to date', { duration: 3000 });
            }
        }

        // Mark this account as synced on this device
        if (currentEmail && !syncedAccounts.includes(currentEmail)) {
            syncedAccounts.push(currentEmail);
            localStorage.setItem(syncedAccountsKey, JSON.stringify(syncedAccounts));
        }

        // Save sync timestamp
        localStorage.setItem('lastSyncTime', Date.now().toString());
        localStorage.setItem('lastDriveSync', new Date().toISOString());
        updateSidebarAccountUI();
    } catch (error) {
        console.error('Sync failed:', error);
        showToast('❌ Sync Failed', error.message, { duration: 5000 });
    }
}

function restoreFromBackupData(backupData) {
    // Use the existing restore logic
    if (backupData.classes) {
        localStorage.setItem('attendanceClasses_v2', JSON.stringify(backupData.classes));
    }
    if (backupData.attendanceLogs) {
        localStorage.setItem('attendance_logs', JSON.stringify(backupData.attendanceLogs));
    }
    if (backupData.theme) {
        localStorage.setItem('theme', backupData.theme);
        if (backupData.theme === 'dark') {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    }
    if (backupData.notificationSettings) {
        for (const className in backupData.notificationSettings) {
            localStorage.setItem(
                `notificationSettings_${className}`,
                JSON.stringify(backupData.notificationSettings[className])
            );
        }
    }
    if (backupData.timetableArrangements) {
        for (const className in backupData.timetableArrangements) {
            localStorage.setItem(
                `timetable_arrangement_${className}`,
                JSON.stringify(backupData.timetableArrangements[className])
            );
        }
    }
    if (backupData.periodTimes) {
        for (const className in backupData.periodTimes) {
            localStorage.setItem(
                `periodTimes_${className}`,
                JSON.stringify(backupData.periodTimes[className])
            );
        }
    }
    if (backupData.lastOpenedClass) {
        localStorage.setItem('lastOpenedClass', backupData.lastOpenedClass);
    }
    if (backupData.defaultView) {
        localStorage.setItem('defaultView', backupData.defaultView);
    }

    // Reload app state
    loadFromStorage();
    populateClassSelector();
    onClassChange();
}

// Initialize Google Auth when API loads
// [deleted Google Auth init]

// --- DATE UTILITY (use local timezone, not UTC) ---
function formatLocalDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Parse YYYY-MM-DD string to local midnight Date (avoids UTC timezone issues)
function parseLocalDate(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day); // month is 0-indexed
}

// --- INITIALIZATION & DATA MANAGEMENT ---
function loadFromStorage() {
    const storedClasses = localStorage.getItem('attendanceClasses_v2');
    classes = storedClasses ? JSON.parse(storedClasses) : {};

    // MIGRATION: Ensure all classes have an ID and updatedAt
    let dirty = false;
    Object.values(classes).forEach(c => {
        if (!c.id) {
            c.id = crypto.randomUUID(); // Requires Secure Context (HTTPS/Localhost)
            dirty = true;
        }
        if (!c.updatedAt) {
            c.updatedAt = Date.now();
            dirty = true;
        }
    });

    if (dirty) {
        console.log('🔄 Data Migration: Assigned UUIDs to existing classes.');
        localStorage.setItem('attendanceClasses_v2', JSON.stringify(classes));
    }

    // STRICT SINGLE CLASS POLICY (Legacy Cleanup)
    // If user has multiple classes, delete all except the most relevant one.
    const classNames = Object.keys(classes);
    if (classNames.length > 1) {
        console.warn(`⚠️ Multiple classes detected (${classNames.length}). Enforcing Single Class Policy.`);

        let survivorName = localStorage.getItem('lastOpenedClass');

        // If lastOpened is invalid or missing, pick the one with latest timestamp
        if (!survivorName || !classes[survivorName]) {
            survivorName = classNames.sort((a, b) => {
                const timeA = new Date(classes[a].updatedAt || 0).getTime();
                const timeB = new Date(classes[b].updatedAt || 0).getTime();
                return timeB - timeA; // Descending (Newest first)
            })[0];
        }

        console.log(`🏆 Keeping "${survivorName}", deleting others...`);

        // Delete others
        classNames.forEach(name => {
            if (name !== survivorName) {
                console.log(`🗑️ Deleting extra class: "${name}"`);
                if (window.SyncManager && window.SyncManager.deleteClass) {
                    SyncManager.deleteClass(name); // Cloud delete (async)
                }
                // Always clean local immediately
                delete classes[name];
                localStorage.removeItem(`notificationSettings_${name}`);
            }
        });

        // Force save local state ensuring only survivor remains
        localStorage.setItem('attendanceClasses_v2', JSON.stringify(classes));
        if (survivorName) localStorage.setItem('lastOpenedClass', survivorName);
    }

    // MULTI-TAB SYNC: If classes exist, ensure onboarding modals are closed
    if (Object.keys(classes).length > 0) {
        const onboardingModal = document.getElementById('onboardingClassModal');
        const firstLoginModal = document.getElementById('firstLoginPromptModal');

        if (onboardingModal && onboardingModal.classList.contains('active')) {
            closeModal('onboardingClassModal');
        }
        if (firstLoginModal && firstLoginModal.classList.contains('active')) {
            closeModal('firstLoginPromptModal');
        }

        if (localStorage.getItem('hasCompletedOnboarding') !== 'true') {
            localStorage.setItem('hasCompletedOnboarding', 'true');
        }
    }
}

// GLOBAL: Reload Classes Logic (Exposed for AuthManager/SyncManager)
window.loadClasses = function () {
    loadFromStorage();
    populateClassSelector();

    // Auto-restore last opened class
    const lastClass = localStorage.getItem('lastOpenedClass');
    const selector = document.getElementById('classSelector');

    if (selector) {
        if (lastClass && selector.querySelector(`option[value="${lastClass}"]`)) {
            selector.value = lastClass;
            // Only trigger change if meaningful, avoids double-fetch
            if (window.selectedClass && window.selectedClass.name === lastClass) {
                console.log('🔄 UI refreshed for current class');
            } else {
                onClassChange();
            }
        } else if (selector.options.length > 1 && !selector.value) {
            // Fallback: select first REAL class if nothing selected
            selector.selectedIndex = 1;
            onClassChange();
        }
    }
    console.log('✅ Classes reloaded from storage.');
};

// Auto-remove Example Class when user has their own classes
function autoRemoveExampleClass() {
    const exampleClassName = 'CSE Core - H';

    // Check if Example Class exists
    if (!classes[exampleClassName]) return false;

    // Check if user has other classes
    const userClasses = Object.keys(classes).filter(c => c !== exampleClassName);

    if (userClasses.length > 0) {
        console.log('🗑️ Auto-removing Example Class (user has their own classes)');

        // Remove Example Class from memory
        delete classes[exampleClassName];

        // Remove associated localStorage items
        localStorage.removeItem(`timetable_arrangement_${exampleClassName}`);
        localStorage.removeItem(`periodTimes_${exampleClassName}`);
        localStorage.removeItem(`custom_schedules_${exampleClassName}`);

        // If lastOpenedClass was Example, switch to first user class
        if (localStorage.getItem('lastOpenedClass') === exampleClassName) {
            localStorage.setItem('lastOpenedClass', userClasses[0]);
        }

        // Save to storage (and sync to cloud)
        saveToStorage();

        console.log(`✅ Example Class removed. User has: ${userClasses.join(', ')}`);
        return true;
    }
    return false;
}

// Make it globally accessible
window.autoRemoveExampleClass = autoRemoveExampleClass;

function saveToStorage() {
    try {
        localStorage.setItem('attendanceClasses_v2', JSON.stringify(classes));
        // Sync with Cloud
        if (window.SyncManager) {
            SyncManager.uploadAll();
        }
        // Track last app interaction time for sync comparison
        localStorage.setItem('lastAppInteraction', new Date().toISOString());
    } catch (e) {
        console.error("Storage save failed:", e);
        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            alert("⚠️ Storage Full!\n\nYour browser cannot save more data. Please delete old classes or clear some space.");
        }
    }
}

document.addEventListener('DOMContentLoaded', function () {
    initializeApp();
    // Clear any recovery attempt flag after successful init
    localStorage.removeItem('initRecoveryAttempt');

    // Restore saved calculation settings
    const savedMinAttendance = localStorage.getItem('calcSettings_minAttendance');
    const savedMinMedical = localStorage.getItem('calcSettings_minMedical');
    const savedIsOverall = localStorage.getItem('calcSettings_isOverall');

    if (savedMinAttendance) {
        const minAttInput = document.getElementById('minAttendanceInput');
        if (minAttInput) minAttInput.value = savedMinAttendance;
    }
    if (savedMinMedical) {
        const minMedInput = document.getElementById('minMedicalInput');
        if (minMedInput) minMedInput.value = savedMinMedical;
    }
    if (savedIsOverall !== null) {
        const overallCheckbox = document.getElementById('overallCriteriaCheckbox');
        if (overallCheckbox) overallCheckbox.checked = savedIsOverall === 'true';
    }
    // Update medical max based on restored min attendance
    if (typeof updateMedicalMax === 'function') updateMedicalMax();

    // Semester Timeline: Check mode and set read-only state
    // Strict check: Portal Mode only if `attendanceClasses_v2` exists AND has actual classes
    const storedDataStr = localStorage.getItem('attendanceClasses_v2');
    let isPortalMode = false;
    if (storedDataStr) {
        try {
            const parsedData = JSON.parse(storedDataStr);
            if (parsedData && Object.keys(parsedData).length > 0) {
                isPortalMode = true;
            }
        } catch (e) {
            console.error("Error parsing stored data for mode check", e);
        }
    }

    const currentDateInput = document.getElementById('currentDate');
    const lastDateInput = document.getElementById('lastDate');
    const startDateInput = document.getElementById('startDate');

    if (isPortalMode) {
        // Portal Mode: Dates are fixed (read-only)
        if (currentDateInput) {
            currentDateInput.readOnly = true;
            currentDateInput.style.opacity = '0.7';
            currentDateInput.title = "Date is fixed in Portal Mode";
        }
        if (lastDateInput) {
            lastDateInput.readOnly = true;
            lastDateInput.style.opacity = '0.7';
            lastDateInput.title = "Date is fixed in Portal Mode";
        }
        if (startDateInput) {
            startDateInput.readOnly = true;
            startDateInput.style.opacity = '0.7';
            startDateInput.title = "Semester Start Date is set in Portal Mode. Go to Menu → Portal Setup to change.";
        }
    } else {
        // Standard Calculation Mode: Dates are editable
        if (currentDateInput) {
            currentDateInput.readOnly = false;
            currentDateInput.style.opacity = '1';
            currentDateInput.title = "Change date to simulate scenarios";
        }
        if (lastDateInput) {
            lastDateInput.readOnly = false;
            lastDateInput.style.opacity = '1';
            lastDateInput.title = "Set semester end date";
        }
        if (startDateInput) {
            startDateInput.readOnly = false;
            startDateInput.style.opacity = '1';
            startDateInput.title = "Set semester start date for calculations";
        }
    }

    // POST-IMPORT TUTORIAL TRIGGER (moved here from restoreAppState which was never called)
    if (localStorage.getItem('postImportTutorial') === 'true') {
        localStorage.removeItem('postImportTutorial');
        console.log('🤖 [TUTORIAL] Flag detected in DOMContentLoaded! Starting 2s timer...');

        setTimeout(() => {
            console.log('🤖 [TUTORIAL] Timer complete. Showing tutorial...');

            // Ensure chatbot button exists and is visible
            let botBtn = document.getElementById('aiChatbotButton');
            if (!botBtn) {
                console.log('🤖 [TUTORIAL] Creating chatbot button...');
                botBtn = document.createElement('div');
                botBtn.id = 'aiChatbotButton';
                botBtn.innerHTML = '💬';
                Object.assign(botBtn.style, {
                    position: 'fixed',
                    bottom: '20px',
                    right: '20px',
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                    zIndex: '2147483647'
                });
                document.body.appendChild(botBtn);
            }

            botBtn.style.display = 'flex';
            botBtn.classList.add('glowing-pulse');

            // Call tutorial function
            if (typeof showBunkmateTutorial === 'function') {
                try {
                    showBunkmateTutorial('newclass');
                    console.log('✅ [TUTORIAL] Tutorial started successfully!');
                } catch (err) {
                    console.error('❌ [TUTORIAL] Error:', err);
                }
            } else {
                console.error('❌ [TUTORIAL] showBunkmateTutorial not defined!');
            }
        }, 2000);
    }
});
// === SIMPLE FIX: Auto-reload when PWA resumes from frozen state ===
let lastActiveTime = Date.now();

// Track when app was last active
setInterval(() => { lastActiveTime = Date.now(); }, 1000);

// Check if app state is broken (PWA frozen state issue)
// Only check things that are DEFINITELY broken, not normal states
function isStateBroken() {
    // Don't check during initial load
    if (!document.body) return false;

    // Don't check if initialization is in progress (Splash is visible)
    if (document.getElementById('initSplash')) return false;

    const selector = document.getElementById('classSelector');
    // Selector exists but has no options (not even default) = broken
    const selectorBroken = selector && selector.options.length === 0;

    // Theme saved as dark but body doesn't have class = broken
    const savedTheme = localStorage.getItem('theme');
    const themeBroken = savedTheme === 'dark' && !document.body.classList.contains('dark-mode');

    // Only reload if definitely broken
    return selectorBroken || themeBroken;
}

// Auto-reload logic disabled to prevent refresh loop on startup
// (Previous PWA frozen-state fix was too aggressive without the splash screen)


// Main initialization function
function initializeApp() {
    // Check if we already have data (Fast Load)
    const storedClasses = localStorage.getItem('attendanceClasses_v2');
    const hasData = storedClasses && storedClasses.length > 2; // "{}" is length 2

    if (hasData) {
        console.log('⚡ Fast Load: Data exists, skipping restoration delay.');
        window.loadClasses();

        // AUTO-REMOVE Example Class if user has their own classes
        autoRemoveExampleClass();

        document.getElementById('currentDate').value = formatLocalDate(new Date());

        // Check for openLog URL parameter (from notification click)
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('openLog') === 'true') {
            // Remove the parameter from URL
            window.history.replaceState({}, document.title, window.location.pathname);

            // Wait for UI to be ready, then open daily log
            setTimeout(() => {
                const lastClass = localStorage.getItem('lastOpenedClass');
                if (lastClass && classes[lastClass]) {
                    document.getElementById('classSelector').value = lastClass;
                    onClassChange();
                }
                openDailyLog();
                console.log('📱 Opened Daily Log from notification (Fast Load path)');
            }, 500);
        }

        // Set up Service Worker message listener for notification clicks when app is already open
        if ('serviceWorker' in navigator && !window._swMessageListenerAdded) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'OPEN_DAILY_LOG') {
                    console.log('📱 Received OPEN_DAILY_LOG message from Service Worker');
                    // Ensure we have a class selected
                    const lastClass = localStorage.getItem('lastOpenedClass');
                    if (lastClass && classes[lastClass]) {
                        document.getElementById('classSelector').value = lastClass;
                        onClassChange();
                    }
                    // Open the daily log modal
                    setTimeout(() => openDailyLog(), 200);
                }
            });
            window._swMessageListenerAdded = true; // Prevent duplicate listeners
        }

        return;
    }

    // Silent Init (No Splash)
    setTimeout(() => {
        try {
            loadFromStorage();

            // Verify classes loaded
            if (Object.keys(classes).length === 0) {
                const triggerOnboarding = async () => {
                    console.log('⚠️ No classes found. Checking user status...');

                    // Anti-Race Condition: If logged in, force a check before assuming new user
                    if (window.AuthManager && window.AuthManager.user) {
                        if (window.SyncManager) {
                            // PARANOID CHECK: Check URL Hash for OAuth redirect
                            if (window.location.hash && (window.location.hash.includes('access_token') || window.location.hash.includes('refresh_token'))) {
                                console.log('🔄 OAuth Redirect detected. Supressing Onboarding.');
                                if (typeof showToast === 'function') showToast('🔄 Authenticating...', 'Please wait.', { duration: 3000 });
                                return; // Abort - Let AuthManager handle the token
                            }

                            // PARANOID CHECK: Explicitly ask Supabase for session (Bypassing AuthManager state)
                            let session = null;
                            if (window.supabaseClient) {
                                const { data } = await window.supabaseClient.auth.getSession();
                                session = data.session;
                            }

                            // LOGGED IN FLOW
                            if (session || (window.AuthManager && window.AuthManager.user)) {
                                if (typeof showToast === 'function') showToast('☁️ Verifying Sync...', 'Checking for existing data...', { duration: 2000 });

                                const syncResult = await window.SyncManager.syncOnLogin();

                                // 1. Sync ERROR -> STOP.
                                if (!syncResult || !syncResult.success) {
                                    if (typeof showToast === 'function') showToast('❌ Sync Failed', 'Network error. Onboarding skipped.', { duration: 3000 });
                                    return;
                                }

                                // 2. Sync SUCCESS -> Check Data
                                const freshClasses = JSON.parse(localStorage.getItem('attendanceClasses_v2') || '{}');

                                // 2a. Data Found -> LOAD IT.
                                if (Object.keys(freshClasses).length > 0) {
                                    console.log('✅ Data found. Hot Reloading UI...');
                                    if (typeof showToast === 'function') showToast('✅ Status', 'One moment...', { duration: 1000 });

                                    loadFromStorage();

                                    // AUTO-REMOVE Example Class if user has their own classes
                                    autoRemoveExampleClass();

                                    document.getElementById('currentDate').value = formatLocalDate(new Date());
                                    populateClassSelector();

                                    // Use lastOpenedClass from cloud settings, NOT first option!
                                    const lastClass = localStorage.getItem('lastOpenedClass');
                                    const selector = document.getElementById('classSelector');

                                    if (lastClass && selector.querySelector(`option[value="${lastClass}"]`)) {
                                        selector.value = lastClass;
                                        console.log(`📂 Restored lastOpenedClass: ${lastClass}`);
                                    } else if (selector.options.length > 1) {
                                        // Fallback: select first REAL class, not placeholder
                                        selector.selectedIndex = 1;
                                        console.log('📂 No lastOpenedClass, selecting first class');
                                    }
                                    onClassChange();
                                    return;
                                }

                                // 2b. Data EMPTY (Valid New User) -> NO MODAL
                                // User is frustrated. We disable the auto-popup.
                                // They will see an empty dashboard and can click "Add Class" manually.
                                console.log('✅ Sync Success + Empty Data. Passive Mode (No Modal).');
                                return;

                            } else {
                                // GUEST / NOT LOGGED IN
                                // We allow Guest Onboarding ONLY if explicitly not logged in
                                // But to be safe for now, we disable auto-popup globally for this session
                                // to avoid "persistent" complaints.
                                console.log('⚠️ Guest/New User. Passive Mode (No Modal).');
                                return;
                            }
                        }
                    }
                };


                if (window.AuthManager && !window.AuthManager.isReady) {
                    console.log('⏳ Classes empty, but Auth not ready. Waiting...');
                    window.addEventListener('auth-initialized', () => {
                        // Re-check after auth is done
                        if (Object.keys(classes).length === 0) {
                            triggerOnboarding();
                        } else {
                            console.log('✅ Data synced during wait. Onboarding skipped.');
                            // Force reload UI just to be safe (sync manager handles it usually, but let's ensure)
                            if (window.onClassChange) onClassChange();
                        }
                    }, { once: true });
                } else {
                    triggerOnboarding();
                }
            }

            document.getElementById('currentDate').value = formatLocalDate(new Date());
            populateClassSelector();

            // Auto-restore last opened class
            const lastClass = localStorage.getItem('lastOpenedClass');
            const selector = document.getElementById('classSelector');

            if (lastClass && classes[lastClass]) {
                selector.value = lastClass;
                onClassChange();
            } else if (Object.keys(classes).length > 0) {
                // If no last class but classes exist, select the first one
                const firstClass = Object.keys(classes)[0];
                selector.value = firstClass;
                onClassChange();
            }

            setupEventListeners();

            const themeToggle = document.getElementById('theme-checkbox');
            const savedTheme = localStorage.getItem('theme');
            if (savedTheme) {
                if (savedTheme === 'dark') {
                    document.body.classList.add('dark-mode');
                    themeToggle.checked = true;
                }
            } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.body.classList.add('dark-mode');
                themeToggle.checked = true;
                localStorage.setItem('theme', 'dark');
            }
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('openLog') === 'true') {
                // Remove the parameter from URL
                window.history.replaceState({}, document.title, window.location.pathname);

                // Auto-select last class and scroll to dashboard
                // Auto-select last class and open daily log
                const lastClass = localStorage.getItem('lastOpenedClass');
                if (lastClass && classes[lastClass]) {
                    setTimeout(() => {
                        document.getElementById('classSelector').value = lastClass;
                        onClassChange();
                        // Open the daily log modal directly
                        openDailyLog();
                    }, 500);
                }
            }

            // Set up Service Worker message listener for notification clicks when app is already open
            if ('serviceWorker' in navigator && !window._swMessageListenerAdded) {
                navigator.serviceWorker.addEventListener('message', (event) => {
                    if (event.data && event.data.type === 'OPEN_DAILY_LOG') {
                        console.log('📱 Received OPEN_DAILY_LOG message from Service Worker');
                        // Ensure we have a class selected
                        const lastClass = localStorage.getItem('lastOpenedClass');
                        if (lastClass && classes[lastClass]) {
                            document.getElementById('classSelector').value = lastClass;
                            onClassChange();
                        }
                        // Open the daily log modal
                        setTimeout(() => openDailyLog(), 200);
                    }
                });
                window._swMessageListenerAdded = true; // Prevent duplicate listeners
            }

            // Define switchModalTab function BEFORE modal HTML


            // --- MODAL HTML DEFINITIONS ---
            // Using window.addClassModalHTML so it's accessible from openAddClassModal() outside this function
            window.addClassModalHTML = `
                <div class="modal-content">
                    <button class="modal-close" onclick="closeModal('addClassModal')">&times;</button>
                    <div class="modal-header"><h2 id="addClassModalTitle"></h2></div>
                    <div class="modal-tabs">
                        <button id="formTabBtn" class="active" onclick="switchModalTab('form')">Form Entry</button>
                        <button id="aiImportTabBtn" onclick="switchModalTab('aiImport')">✨ Inbuilt AI Import</button>
                        <button id="jsonTabBtn" onclick="switchModalTab('json')">Import from JSON</button>
                        <button id="scanTabBtn" onclick="switchModalTab('scan')">Scan QR</button>
                        <button id="shareTabBtn" onclick="switchModalTab('share')" style="display: none;">Share Class</button>
                    </div>
                    
                    <div id="formEntryTab">
                        <!-- Wizard Progress Steps -->
                        <div class="wizard-progress" style="display: flex; justify-content: center; margin-bottom: 20px; gap: 5px;">
                            <div class="wizard-step active" id="wizStep1Indicator" style="display: flex; align-items: center; gap: 5px; padding: 8px 15px; border-radius: 20px; background: var(--primary-color); color: white; font-size: 0.85rem;">
                                <span style="width: 22px; height: 22px; border-radius: 50%; background: white; color: var(--primary-color); display: flex; align-items: center; justify-content: center; font-weight: bold;">1</span>
                                Basic Info
                            </div>
                            <div class="wizard-step" id="wizStep2Indicator" style="display: flex; align-items: center; gap: 5px; padding: 8px 15px; border-radius: 20px; background: var(--light-bg); color: var(--medium-text); font-size: 0.85rem;">
                                <span style="width: 22px; height: 22px; border-radius: 50%; background: var(--border-color); color: var(--medium-text); display: flex; align-items: center; justify-content: center; font-weight: bold;">2</span>
                                Subjects
                            </div>
                            <div class="wizard-step" id="wizStep3Indicator" style="display: flex; align-items: center; gap: 5px; padding: 8px 15px; border-radius: 20px; background: var(--light-bg); color: var(--medium-text); font-size: 0.85rem;">
                                <span style="width: 22px; height: 22px; border-radius: 50%; background: var(--border-color); color: var(--medium-text); display: flex; align-items: center; justify-content: center; font-weight: bold;">3</span>
                                Timetable
                            </div>
                        </div>

                        <!-- Step 1: Basic Info -->
                        <div id="wizardStep1" class="wizard-step-content">
                            <div class="form-group">
                                <label for="newClassName">Class Name *</label>
                                <input type="text" id="newClassName" placeholder="e.g., CSE Core - H">
                            </div>
                            <div class="form-group">
                                <label for="newClassStartDate">Semester Start Date (Optional)</label>
                                <input type="date" id="newClassStartDate">
                                <p style="font-size: 0.8rem; color: var(--medium-text); margin-top: 4px;">For Portal Mode & Medical Certificate. Can set later in Portal Setup.</p>
                            </div>
                            <div class="form-group">
                                <label for="newClassLastDate">Last Working Date *</label>
                                <input type="date" id="newClassLastDate">
                            </div>
                            <div class="form-group">
                                <label for="wizPeriodCount">Periods per Day *</label>
                                <input type="number" id="wizPeriodCount" min="1" max="12" value="8" placeholder="e.g., 8">
                            </div>
                            <div style="display: flex; justify-content: flex-end; margin-top: 15px;">
                                <button class="btn primary-btn" onclick="wizardGoToStep(2)">Next →</button>
                            </div>
                        </div>

                        <!-- Step 2: Subject Details -->
                        <div id="wizardStep2" class="wizard-step-content" style="display: none;">
                            <p style="color: var(--medium-text); font-size: 0.9rem; margin-bottom: 15px;">
                                Enter the name and code for each subject. Subject codes should match your college portal (e.g., 21CSC201J).
                            </p>
                            <div id="wizSubjectsContainer" style="max-height: 350px; overflow-y: auto;"></div>
                            <button type="button" class="btn secondary-btn" onclick="addWizardSubject()" style="width: 100%; margin-top: 10px; border: 2px dashed var(--border-color); background: transparent; color: var(--primary-color); font-weight: 600;">＋ Add Subject</button>
                            <div style="display: flex; justify-content: space-between; margin-top: 15px;">
                                <button class="btn secondary-btn" onclick="wizardGoToStep(1)">← Back</button>
                                <button class="btn primary-btn" onclick="wizardGoToStep(3)">Next →</button>
                            </div>
                        </div>

                        <!-- Step 3: Timetable Grid -->
                        <div id="wizardStep3" class="wizard-step-content" style="display: none;">
                            <p style="color: var(--medium-text); font-size: 0.9rem; margin-bottom: 15px;">
                                Assign subjects to each period. Leave as "Free" if no class is scheduled.
                            </p>
                            <div id="wizTimetableGrid" style="overflow-x: auto; max-height: 400px; overflow-y: auto;"></div>
                            
                            <div class="holiday-section" style="margin-top: 15px;">
                                <label>Holidays (Optional)</label>
                                <ul id="holidayList" style="max-height: 100px; overflow-y: auto;"></ul>
                                <div class="add-holiday-form">
                                    <input type="date" id="newHolidayDate">
                                    <button type="button" class="add-holiday-btn" onclick="addHolidayToModal()">Add Holiday</button>
                                </div>
                            </div>
                            
                            <div style="display: flex; justify-content: space-between; margin-top: 15px;">
                                <button class="btn secondary-btn" onclick="wizardGoToStep(2)">← Back</button>
                                <button class="btn success-btn" onclick="submitClassFromWizard()">💾 Save Class</button>
                            </div>
                        </div>
                    </div>

                    <div id="aiImportEntryTab" style="display: none;">
                        <div class="json-instructions">
                            <strong>🤖 Inbuilt AI Import:</strong>
                            <p>Upload your <strong>Timetable</strong>, <strong>Attendance Screenshot</strong>, or any other class details. The AI will read them and fill out the form for you!</p>
                        </div>
                        
                        <div class="form-group">
                            <label>1. Upload Files (Images/Screenshots):</label>
                            <div style="border: 2px dashed #ccc; border-color: var(--border-color, #ccc); padding: 20px; text-align: center; border-radius: 8px; cursor: pointer; background: rgba(0,0,0,0.02);" onclick="document.getElementById('aiImportFiles').click()">
                                <span style="font-size: 2rem;">📂</span><br>
                                <span style="color: #666; color: var(--medium-text, #666);">Click to upload Timetable, Attendance, etc.</span>
                            </div>
                            <input type="file" id="aiImportFiles" multiple accept="image/*" style="display: none;" onchange="updateAIFileCount(this)">
                            <div id="aiFileCount" style="margin-top: 5px; font-size: 0.9rem; color: var(--success-grad-start);"></div>
                        </div>

                        <div class="form-group">
                            <label>2. Additional Details (Optional):</label>
                            <textarea id="aiImportText" placeholder="e.g., Last working day is Dec 20, 2025. Holidays are Aug 15, Oct 2." style="min-height: 80px;"></textarea>
                        </div>

                        <div id="aiImportLoading" style="display: none; text-align: center; margin: 20px 0;">
                            <div class="spinner"></div>
                            <p>🤖 AI is analyzing your files...<br>This may take a few seconds.</p>
                        </div>

                        <button class="btn primary-btn" onclick="handleAIClassImport()" style="width: 100%;">✨ Run Inbuilt AI Import</button>
                    </div>

                    <div id="jsonEntryTab" style="display: none;">
                        <div class="json-instructions">
                            <strong>How to use:</strong>
                            <ol>
                                <li>Click the button below to copy the AI prompt.</li>
                                <li>Paste it into an AI Chat (like Gemini, ChatGPT).</li>
                                <li>Attach your <strong>timetable screenshot</strong> AND your <strong>attendance details screenshot</strong>. Provide <strong>your holiday list</strong> and <strong>last working date</strong>.</li>
                                <li>The AI will generate a JSON code block. Copy it.</li>
                                <li>Paste the entire JSON code into the text box below and click Save.</li>
                            </ol>
                        </div>
                        <button class="btn secondary-btn" onclick="copyAIPrompt()" style="width: 100%; margin-bottom: 15px;">📋 Copy Prompt for AI</button>
                        <div class="form-group">
                            <label for="jsonPasteArea">Paste JSON here:</label>
                            <textarea id="jsonPasteArea" placeholder='{ "Your Class Name": { "lastDate": "...", "holidays": [...], "subjects": [...] } }'></textarea>
                        </div>
                    </div>

                    <div id="scanEntryTab" style="display: none;">
                        <div class="json-instructions">
                            <strong>Scan Class QR Code:</strong>
                            <p>Point your camera at a shared class QR code to import it instantly.</p>
                        </div>
                         <!-- File Upload Option -->
                        <div style="margin-bottom: 20px; text-align: center;">
                            <input type="file" id="qrInputFileTab" accept="image/*" style="display: none;" onchange="handleQRFileUploadInTab(this)">
                            <button class="btn secondary-btn" onclick="document.getElementById('qrInputFileTab').click()">📂 Upload QR Image</button>
                        </div>
                        <div id="readerTab" style="width: 100%; min-height: 300px;"></div>
                    </div>

                    <div id="shareEntryTab" style="display: none;">
                        <div class="modal-header" style="text-align: center; margin-bottom: 20px;">
                            <h2>📤 Share Class</h2>
                            <p>Scan this QR code to import this class setup on another device.</p>
                        </div>
                        <div id="qrcodeTab" style="display: inline-block; padding: 20px; background: white; margin: 20px auto; display: flex; justify-content: center;"></div>
                        <p style="font-size: 0.9rem; color: var(--medium-text); margin-bottom: 20px; text-align: center;">Includes subjects and holidays. Does not include your personal attendance logs.</p>
                        <div style="display: flex; gap: 10px; justify-content: center;">
                            <button class="btn success-btn" onclick="shareClassLinkFromTab()">🔗 Share via App Link</button>
                            <button class="btn secondary-btn" onclick="downloadQRImageTab()">⬇️ Download QR</button>
                        </div>
                    </div>

                    <div class="form-actions" id="modalFormActions">
                        <button class="btn primary-btn" id="modalSaveBtn" onclick="submitClassForm()">Save Class</button>
                        <button class="btn secondary-btn" onclick="closeModal('addClassModal')">Cancel</button>
                    </div>
                </div>`;

            const helpModalHTML = `
                <div class="modal-content">
                    <button class="modal-close" onclick="closeModal('helpModal')">&times;</button>
                    <div class="modal-header"><h2>💡 How to Use This Tool</h2></div>
                    
                    <div class="alert-message warning" style="border-left-color: var(--warning-color);">
                        <strong>Important:</strong> OCR (image reading) is accurate only about 95% of the time. <strong>Always compare the extracted numbers</strong> with your screenshot to ensure they are correct. You can edit them directly in the results cards.
                    </div>

                    <h4 class="help-main-heading">1. Initial Setup (First Time)</h4>
                    <p>Before you can calculate, you need to add your class details.</p>
                    <ol>
                        <li>Click <strong>"+ Add"</strong>.</li>
                        <li><strong>Manual Entry:</strong> Fill in your class name, semester end date, and add each subject with its name, code, and weekly schedule (number of classes from Monday to Sunday).</li>
                        <li><strong>Fast Entry (Recommended):</strong> Switch to the <strong>"Import from JSON"</strong> tab. Use the "Copy Prompt for AI" button and paste it into an AI chatbot (like Gemini) along with your timetable and attendance screenshots. The AI will generate a JSON code. Paste this code back into the app to set up everything automatically.</li>
                    </ol>

                    <h4 class="help-main-heading">2. Calculating Your Attendance</h4>
                    <ul>
                        <li><strong>Screenshot Upload:</strong> Once your class is set up and selected, click "Choose Image" and upload a screenshot of your college's attendance portal. The app will automatically read the data.</li>
                        <li><strong>Manual/JSON Entry:</strong> If you prefer, click "Manual Entry" to type in your attended/held classes, or "Paste JSON" to paste data extracted by an AI.</li>
                    </ul>

                    <h4 class="help-main-heading">3. Student Portal (New Feature)</h4>
                    <ul>
                        <li><strong>Create Portal:</strong> Switch to "Student Portal" mode to track your daily attendance. Set a "Baseline Date" and your current attendance stats.</li>
                        <li><strong>Daily Logging:</strong> Mark your attendance daily (Attended, Skipped, Cancelled, Duty Leave, Medical Leave). The app will automatically update your stats.</li>
                        <li><strong>Notifications:</strong> Get daily reminders to mark your attendance. You can customize the time in settings.</li>
                        <li><strong>History Editor:</strong> View and edit past logs. Use the calendar to jump to specific dates.</li>
                        <li><strong>Smart Baseline:</strong> If you add logs for dates <em>before</em> your baseline, they will only count if they exceed your initial baseline data, ensuring accuracy.</li>
                    </ul>

                    <h4 class="help-main-heading">4. Understanding the Features</h4>
                    <ul>
                        <li><strong>Calculation Settings:</strong> Set your college's minimum attendance percentage. Use the toggle to switch between viewing your status for each subject individually or for your overall average.</li>
                        <li><strong>Can I Skip Today?:</strong> A quick check to see how skipping all of today's classes would affect your final attendance percentage for each subject.</li>
                        <li><strong>Daily Dashboard:</strong> Shows which classes you have on the selected "Current Date" and a color-coded status (🔴Critical, 🟡Low, 🟢Safe) based on your latest calculation.</li>
                        <li><strong>Daily Log:</strong> Keep track of days you attended, skipped, or had classes cancelled. This makes future calculations more accurate as it accounts for cancelled classes.</li>
                        <li><strong>Leave Planner & Compulsory Events:</strong> Enter planned leaves and must-attend events to see their impact on your ability to take leave. Use the "Recalculate Max Safe Leave" to get updated recommendations.</li>
                        <li><strong>Max Safe Leave:</strong> Calculates the exact dates you could skip entirely without falling below the minimum attendance requirement, considering your planned leaves and compulsory events.</li>
                        <li><strong>Long Weekend Finder:</strong> An intelligent tool that finds the best days to take leave to get the longest continuous break possible by combining your leave days with weekends and holidays.</li>
                    </ul>
                    
                    <h4 class="help-main-heading">4. Data Management (in Hamburger Menu)</h4>
                    <ul>
                        <li><strong>Export/Import:</strong> Share your class setup with friends.</li>
                        <li><strong>Backup/Restore:</strong> Save all your classes to a file on your device and restore from it later. This is great for switching devices.</li>
                        <li><strong>History:</strong> The app automatically saves your last 10 calculations. You can view or restore any of them from the history dropdown.</li>
                    </ul>
                </div>`;


            document.getElementById('addClassModal').innerHTML = addClassModalHTML;
            document.getElementById('helpModal').innerHTML = helpModalHTML;
            document.getElementById('partialEntryModal').innerHTML = `<div class="modal-content"><button class="modal-close" onclick="closeModal('partialEntryModal')">&times;</button><div class="modal-header"><h2>Missed Subjects Entry</h2><p>OCR missed some subjects. Please enter their attendance manually.</p></div><div id="partialSubjectsGrid"></div><div class="form-actions"><button class="btn primary-btn" onclick="submitPartialEntry()">Submit & Recalculate</button></div></div>`;
            document.getElementById('exportModal').innerHTML = `<div class="modal-content"><button class="modal-close" onclick="closeModal('exportModal')">&times;</button><div class="modal-header"><h2>Export/Share Class</h2><p>Copy this JSON and share it. Your friend can import it using the 'Import from JSON' tab.</p></div><div class="form-group"><textarea id="exportJsonTextarea" readonly></textarea></div><div class="form-actions"><button class="btn primary-btn" onclick="copyExportJson()">Copy to Clipboard</button></div></div>`;
            document.getElementById('skipTodayModal').innerHTML = `<div class="modal-content"><button class="modal-close" onclick="closeModal('skipTodayModal')">&times;</button><div class="modal-header"><h2>Can You Skip Today?</h2></div><div id="skipTodayResults"></div></div>`;
            document.getElementById('dailyLogModal').innerHTML = `<div class="modal-content"><button class="modal-close" onclick="closeModal('dailyLogModal')">&times;</button><div class="modal-header"><h2>Daily Attendance Log</h2></div><div class="form-group"><label for="logDate">Current Date:</label><input type="date" id="logDate" onchange="populateDailyLog()"></div><div id="dailyLogSubjects"></div><div class="form-actions"><button class="btn primary-btn" onclick="saveDailyLog()">Save Log</button></div><p style="font-size: 0.8rem; text-align: center; margin-top: 15px;"><strong>Note:</strong> For past dates, 'Duty Leave (OD)' must be manually reflected by adding 1 to both 'Attended' and 'Held' values in the results.</p></div>`;
            document.getElementById('backupOptionsModal').innerHTML = `<div class="modal-content"><button class="modal-close" onclick="closeModal('backupOptionsModal')">&times;</button><div class="modal-header"><h2>💾 Backup Data</h2><p>Choose how you want to save your backup.</p></div><div class="form-actions" style="flex-direction: column; gap: 15px;"><button class="btn primary-btn" onclick="performBackupDownload()" style="width: 100%;">⬇️ Download JSON File</button><button class="btn success-btn" onclick="performBackupShare()" style="width: 100%;">📤 Share JSON File</button><button class="btn info-btn" onclick="performBackupCopy()" style="width: 100%;">📋 Copy JSON to Clipboard</button></div></div>`;

            // OCR Settings Modal
            document.getElementById('ocrSettingsModal').innerHTML = `
                <div class="modal-content">
                    <button class="modal-close" onclick="closeModal('ocrSettingsModal')">&times;</button>
                    <div class="modal-header">
                        <h2>🔑 API Settings</h2>
                        <p>Configure AI-powered attendance extraction</p>
                    </div>
                    
                    <div style="background: var(--card-bg); padding: 20px; border-radius: 12px; margin-bottom: 20px; border: 1px solid var(--border-color);">
                        <h3 style="margin-bottom: 15px; font-size: 1.1rem;">📍 Your Personal API Key</h3>
                        <p style="margin-bottom: 15px; color: var(--medium-text); font-size: 0.9rem;">
                            Get your own <strong>free 10,000/day quota</strong> by adding your personal Gemini API key.
                        </p>
                        
                        <div class="form-group">
                            <label for="personalGeminiKey">Your Gemini API Key:</label>
                            <input type="password" id="personalGeminiKey" placeholder="AIzaSy..." style="font-family: monospace;">
                            <small style="color: var(--medium-text); margin-top: 5px; display: block;">
                                Your key is stored locally and never shared
                            </small>
                        </div>
                        
                        <div id="personalQuotaStatus" style="margin: 15px 0; padding: 10px; background: var(--light-bg); border-radius: 8px; display: none;">
                            <strong>Your Quota Today:</strong> <span id="personalQuotaCount">0/1500</span>
                        </div>
                    </div>
                    
                    <div style="background: var(--light-bg); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <h4 style="margin-bottom: 10px; font-size: 1rem;">🔑 How to Get Free API Key:</h4>
                        <ol style="margin: 0; padding-left: 20px; color: var(--dark-text);">
                            <li>Visit <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style="color: var(--primary-grad-start);">Google AI Studio</a></li>
                            <li>Click <strong>"Get API Key"</strong> or <strong>"Create API Key"</strong></li>
                            <li>Copy the key (starts with <code>AIzaSy...</code>)</li>
                            <li>Paste it above and click <strong>Save</strong></li>
                        </ol>
                    </div>
                    
                    <div class="form-actions">
                        <button class="btn primary-btn" onclick="saveAPISettings()">💾 Save Settings</button>
                        <button class="btn secondary-btn" onclick="testPersonalKey()">🧪 Test My Key</button>
                    </div>
                </div>`;

            document.getElementById('restoreOptionsModal').innerHTML = `
                <div class="modal-content">
                    <button class="modal-close" onclick="closeModal('restoreOptionsModal')">&times;</button>
                    <div class="modal-header"><h2>♻️ Restore Data</h2><p>Choose how you want to restore your data.</p></div>
                    
                    <div class="modal-tabs">
                        <button id="restoreFileTabBtn" class="active" onclick="switchRestoreTab('file')">Upload File</button>
                        <button id="restorePasteTabBtn" onclick="switchRestoreTab('paste')">Paste JSON</button>
                    </div>

                    <div id="restoreFileTab">
                        <div style="text-align: center; padding: 20px;">
                            <p style="margin-bottom: 20px;">Upload a previously backed up .json file.</p>
                            <button class="btn primary-btn" onclick="document.getElementById('restoreInput').click()">📂 Select Backup File</button>
                        </div>
                    </div>

                    <div id="restorePasteTab" style="display: none;">
                        <div class="form-group">
                            <label for="restoreJsonPaste">Paste Backup JSON:</label>
                            <textarea id="restoreJsonPaste" placeholder='Paste your backup JSON here...' style="min-height: 200px; font-family: monospace;"></textarea>
                        </div>
                        <div class="form-actions">
                            <button class="btn primary-btn" onclick="performRestorePaste()">Restore from Text</button>
                        </div>
                    </div>
                </div>`;
        } catch (error) {
            console.error('❌ App initialization failed:', error);
            // Try to recover by reloading
            if (!localStorage.getItem('initRecoveryAttempt')) {
                localStorage.setItem('initRecoveryAttempt', Date.now().toString());
                location.reload();
            } else {
                localStorage.removeItem('initRecoveryAttempt');
                alert('App initialization failed. Please try refreshing the page or use ?forceclear in the URL to reset.');
            }
        }
    }, 1500);
}

function setupEventListeners() {
    console.log('🔌 Setting up event listeners...');
    const uploadSection = document.getElementById('uploadSection');
    const imageInput = document.getElementById('imageInput');
    ['dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadSection.addEventListener(eventName, e => {
            e.preventDefault();
            if (eventName === 'dragover') uploadSection.classList.add('dragover');
            else uploadSection.classList.remove('dragover');
            if (eventName === 'drop' && e.dataTransfer.files.length) {
                showInputMode('upload');
                const imageInput = document.getElementById('imageInput');
                imageInput.files = e.dataTransfer.files; // Sync with input
                handleImageUpload(e.dataTransfer.files);
            }
        });
    });
    imageInput.addEventListener('change', e => {
        if (e.target.files.length) {
            showInputMode('upload');
            handleImageUpload(e.target.files);
        }
    });
}

// --- HAMBURGER SIDENAV FUNCTIONS ---
function openNav() {
    document.getElementById("mySidenav").classList.add("active");
    document.getElementById("menuOverlay").classList.add("active");
    document.body.classList.add('backdrop-active'); // Block body scroll
}

function closeNav() {
    document.getElementById("mySidenav").classList.remove("active");
    document.getElementById("menuOverlay").classList.remove("active");
    document.body.classList.remove('backdrop-active'); // Restore body scroll
}

function toggleDropdown(element) {
    const content = element.nextElementSibling;
    if (content.style.display === "block") {
        content.style.display = "none";
        element.querySelector('span').innerHTML = '▾';
    } else {
        content.style.display = "block";
        element.querySelector('span').innerHTML = '▴';
    }
}

// --- DARK MODE TOGGLE ---
// Initialize dark mode toggle after DOM loads
window.addEventListener('load', function () {
    const themeCheckbox = document.getElementById('theme-checkbox');

    if (themeCheckbox) {
        // Add event listener for toggle
        themeCheckbox.addEventListener('change', function (e) {
            console.log('Theme toggle clicked:', e.target.checked);
            if (e.target.checked) {
                document.body.classList.add('dark-mode');
                localStorage.setItem('theme', 'dark');
                console.log('Dark mode enabled');
            } else {
                document.body.classList.remove('dark-mode');
                localStorage.setItem('theme', 'light');
                console.log('Dark mode disabled');
            }

            // Sync with Cloud
            if (window.SyncManager) SyncManager.uploadAll();
        });

        // Load saved theme on page load
        const savedTheme = localStorage.getItem('theme');
        console.log('Saved theme:', savedTheme);
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-mode');
            themeCheckbox.checked = true;
            console.log('Applied saved dark mode');
        }
    } else {
        console.error('Theme checkbox element not found!');
    }
});

// --- CORE HELPER FUNCTIONS ---
function getSubjectAcronym(name) {
    if (!name) return "";
    const ignoreWords = ['and', 'of', 'the', 'in', 'for', 'to'];
    return name.split(/\s+/)
        .filter(word => !ignoreWords.includes(word.toLowerCase()))
        .map(word => word[0].toUpperCase())
        .join('');
}

function getMinAttendanceCriteria() {
    const value = parseFloat(document.getElementById('minAttendanceInput').value);
    return isNaN(value) || value <= 0 ? 0.75 : value / 100;
}

function getMinMedicalCriteria() {
    const input = document.getElementById('minMedicalInput');
    const value = parseFloat(input ? input.value : 65);
    return isNaN(value) || value < 0 ? 65 : value;
}

function updateMedicalMax() {
    const minAttendance = document.getElementById('minAttendanceInput').value;
    const medicalInput = document.getElementById('minMedicalInput');
    if (medicalInput) {
        medicalInput.max = minAttendance;
        // If current value exceeds new max, reduce it
        if (parseFloat(medicalInput.value) > parseFloat(minAttendance)) {
            medicalInput.value = minAttendance;
        }
    }
}

function isOverallMode() {
    return document.getElementById('overallCriteriaCheckbox').checked;
}

function triggerRecalculation() {
    // Save calculation settings to localStorage
    const minAttendanceInput = document.getElementById('minAttendanceInput');
    const minMedicalInput = document.getElementById('minMedicalInput');
    const overallCheckbox = document.getElementById('overallCriteriaCheckbox');

    if (minAttendanceInput) localStorage.setItem('calcSettings_minAttendance', minAttendanceInput.value);
    if (minMedicalInput) localStorage.setItem('calcSettings_minMedical', minMedicalInput.value);
    if (overallCheckbox) localStorage.setItem('calcSettings_isOverall', overallCheckbox.checked);

    // Trigger Cloud Sync for Settings
    if (window.SyncManager && window.SyncManager.saveSettings) {
        window.SyncManager.saveSettings();
    }

    if (currentAnalysisData.length > 0) {
        calculateAttendance(currentAnalysisData);
    }
}

function populateClassSelector() {
    const selector = document.getElementById('classSelector');
    const datalist = document.getElementById('class-suggestions');
    selector.innerHTML = '<option value="">-- Select a Class --</option>';
    datalist.innerHTML = '';

    const classNames = Object.keys(classes).sort();
    classNames.forEach(className => {
        selector.innerHTML += `<option value="${className}">${className}</option>`;
        datalist.innerHTML += `<option value="${className}"></option>`;
    });

    // SINGLE CLASS POLICY:
    // Only show "Add Class" if:
    // 1. No classes exist
    // 2. The ONLY existing class is one of the defaults (Example/Example Class)
    const isExampleOnly = classNames.length === 1 && (classNames[0] === 'Example Class' || classNames[0] === 'Example');

    if (classNames.length === 0 || isExampleOnly) {
        // Add separator
        selector.innerHTML += '<option disabled>──────────</option>';
        // Add "Add Class" option
        selector.innerHTML += '<option value="add_new_class">➕ Add Class</option>';
    }
}

function handleSearchInput() {
    const searchInput = document.getElementById('classSearch');
    const selector = document.getElementById('classSelector');
    if (classes[searchInput.value]) {
        if (selector.value !== searchInput.value) {
            selector.value = searchInput.value;
            onClassChange();
        }
    }
}

function handleDropdownChange() {
    document.getElementById('classSearch').value = document.getElementById('classSelector').value;
    onClassChange();
}

function onClassChange() {
    const className = document.getElementById('classSelector').value;
    const content = document.getElementById('classSelectedContent');
    const timetable = document.getElementById('timetableSection');

    showInputMode('upload');
    document.getElementById('resultsSection').innerHTML = '';
    const leavePlannerSection = document.getElementById('leavePlannerSection');
    if (leavePlannerSection) leavePlannerSection.style.display = 'none';

    document.getElementById('pdfDownloadContainer').innerHTML = '';

    const maxLeaveRec = document.getElementById('maxLeaveRecommendation');
    if (maxLeaveRec) maxLeaveRec.style.display = 'none';

    const leaveRecContainer = document.getElementById('leaveRecommendationContainer');
    if (leaveRecContainer) leaveRecContainer.style.display = 'none';

    const previewSection = document.getElementById('previewSection');
    if (previewSection) previewSection.style.display = 'none';
    currentAnalysisData = [];

    if (className && classes[className]) {
        selectedClass = { ...classes[className] };
        document.getElementById('lastDate').value = selectedClass.lastDate;

        // AUTO-POPULATE: Semester Start Date from Portal Mode settings
        const startDateInput = document.getElementById('startDate');
        if (startDateInput && selectedClass.portalSetup && selectedClass.portalSetup.semesterStartDate) {
            startDateInput.value = selectedClass.portalSetup.semesterStartDate;
        }

        content.style.display = 'block';
        timetable.style.display = 'block';
        generateManualInputs();
        generateTimetable();

        // Save last opened class
        localStorage.setItem('lastOpenedClass', className);

        // Initialize Portal if available
        if (typeof initPortal === 'function') {
            initPortal();
        }

        // Initialize preview timeline dates
        if (typeof initializePreviewDates === 'function') {
            setTimeout(() => initializePreviewDates(), 100);
        }

        // Update period-wise view menu visibility
        if (typeof updatePeriodViewMenuVisibility === 'function') {
            updatePeriodViewMenuVisibility();
        }
    } else {
        selectedClass = null;
        content.style.display = 'none';
        timetable.style.display = 'none';

        // Hide timeline preview section when no class selected
        const timelinePreviewSection = document.getElementById('timelinePreviewSection');
        if (timelinePreviewSection) timelinePreviewSection.style.display = 'none';

        // Hide period-wise view menu when no class selected
        if (typeof updatePeriodViewMenuVisibility === 'function') {
            updatePeriodViewMenuVisibility();
        }
    }
}

// --- OCR & CORE CALCULATIONS ---
async function handleImageUpload(files) {
    if (!selectedClass) { alert("Please select a class first!"); return; }

    // Convert FileList to Array
    const filesArray = Array.from(files);

    const previewSection = document.getElementById('previewSection');
    const previewGrid = document.getElementById('previewImagesGrid');
    const loadingSection = document.getElementById('loadingSection');
    document.getElementById('resultsSection').innerHTML = '';

    // Clear and populate preview grid with all images
    previewGrid.innerHTML = '';
    previewSection.style.display = 'block';

    filesArray.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const container = document.createElement('div');
            container.className = 'preview-image-container';

            const img = document.createElement('img');
            img.src = e.target.result;
            img.alt = `Preview ${index + 1}`;

            const label = document.createElement('div');
            label.className = 'preview-image-label';
            label.textContent = `Image ${index + 1}`;

            container.appendChild(label);
            container.appendChild(img);
            previewGrid.appendChild(container);
        };
        reader.readAsDataURL(file);
    });

    loadingSection.style.display = 'block';

    // Show calculate ad during image processing with manual skip control
    if (window.bunkitAdManager) window.bunkitAdManager.show('calculate_ad', { manualSkip: true });

    try {
        let mergedData = {};

        // DEBUG: Log start
        console.log(`🚀 Starting Image Upload Handler with ${filesArray.length} file(s)`);

        // Process each image
        for (let i = 0; i < filesArray.length; i++) {
            const file = filesArray[i];
            console.log(`📸 Processing image ${i + 1} of ${filesArray.length}...`);

            // Call the unified OCR processor (defined later in the file)
            const result = await processAttendanceImage(file, true);

            if (result && result.success && result.data) {
                console.log(`✅ OCR Success for image ${i + 1} via ${result.method}`);
                // Merge data from this image
                mergedData = { ...mergedData, ...result.data };
            } else {
                console.warn(`⚠️ Failed to process image ${i + 1}: ${result?.error || 'Unknown error'}`);
                if (result?.error) showToast(`Image ${i + 1}: ${result.error}`, 'error');
            }
        }

        // Process merged data if we got anything
        if (Object.keys(mergedData).length > 0) {
            console.log(`✅ Successfully processed ${filesArray.length} image(s), merged data:`, mergedData);
            processJsonAndCalculate(mergedData);
        } else {
            throw new Error('Could not extract data from any of the images. Please ensure the image is clear and contains a visible attendance table.');
        }
    } catch (err) {
        console.error('❌ Processing Error:', err);
        alert(`Failed to process images: ${err.message}`);
        loadingSection.style.display = 'none';
        document.getElementById('resultsSection').innerHTML = `<div class="error-state"><i class="fas fa-exclamation-triangle"></i><p>${err.message}</p></div>`;
    } finally {
        loadingSection.style.display = 'none';
        // Always enable skip once processing is finished (or fails)
        if (window.bunkitAdManager) {
            window.bunkitAdManager.allowSkip();
        }
    }
}
// EXPLICIT EXPORT: Ensure handleImageUpload is available globally for inline HTML handlers
window.handleImageUpload = handleImageUpload;

// === OCR API - Uses Backend Proxy ===
// OCR now uses the same backend proxy as chatbot for API key security
// Personal key takes priority, otherwise backend handles key rotation

function hasPersonalGeminiKey() {
    return !!localStorage.getItem('personalGeminiKey');
}

// For backward compatibility - returns empty if no personal key
function getNextAvailableOCRKey() {
    const personalKey = localStorage.getItem('personalGeminiKey');
    if (personalKey) {
        return { key: personalKey, index: -1 };
    }
    // For shared keys, we use backend proxy instead
    return { key: null, index: -1, useProxy: true };
}

// Stub functions for backward compatibility
function markOCRKeyExhausted(keyIndex) {
    console.log('OCR keys handled by backend proxy');
}

// Legacy variable for backward compatibility
// === OCR LOGIC HAS BEEN MOVED TO UNIFIED PROCESSOR (Around Line 19606) ===
// This prevents duplicate function definitions and ensures robust fallback.

// Helper function for Data Validation (kept here as it's used by processJsonAndCalculate)
function validateAndCorrectData(jsonData) {
    if (!selectedClass || !selectedClass.subjects) return jsonData;

    // DATA SANITIZATION LAYER: Fix swapped Attended/Total values globally
    // This catches errors from both Gemini and Tesseract before any statistical correction
    Object.keys(jsonData).forEach(code => {
        const entry = jsonData[code];
        const p = parseInt(entry.present);
        const t = parseInt(entry.total);
        // Ensure they are numbers
        entry.present = isNaN(p) ? 0 : p;
        entry.total = isNaN(t) ? 0 : t;

        if (entry.present > entry.total) {
            console.warn(`Global Fix: Swapped Attended/Total for ${code} (${entry.present}/${entry.total})`);
            const temp = entry.present;
            entry.present = entry.total;
            entry.total = temp;
        }
    });

    const frequencyGroups = {};
    selectedClass.subjects.forEach(subject => { if (jsonData[subject.code]) { const weeklyFrequency = subject.schedule.reduce((a, b) => a + b, 0); if (weeklyFrequency > 0) { if (!frequencyGroups[weeklyFrequency]) { frequencyGroups[weeklyFrequency] = []; } frequencyGroups[weeklyFrequency].push(subject.code); } } }); for (const freq in frequencyGroups) { const subjectCodes = frequencyGroups[freq]; if (subjectCodes.length < 2) continue; const totals = subjectCodes.map(code => jsonData[code].total).sort((a, b) => a - b); const mid = Math.floor(totals.length / 2); const medianTotal = totals.length % 2 !== 0 ? totals[mid] : Math.round((totals[mid - 1] + totals[mid]) / 2); subjectCodes.forEach(code => { const originalData = jsonData[code]; if (Math.abs(originalData.total - medianTotal) > 15) { console.warn(`Data Correction: Subject ${code} total (${originalData.total}) is an outlier compared to its group median (${medianTotal}). Auto-correcting.`); const originalPercent = originalData.total > 0 ? (originalData.present / originalData.total) : 0; const newTotal = medianTotal; const newPresent = Math.round(newTotal * originalPercent); jsonData[code] = { total: newTotal, present: newPresent }; } }); } return jsonData;
}
function processJsonAndCalculate(jsonData) { jsonData = validateAndCorrectData(jsonData); const attendanceDataForCalc = [], missedSubjects = []; const classSubjectCodes = new Set(selectedClass.subjects.map(s => s.code)); selectedClass.subjects.forEach(subject => { if (jsonData[subject.code]) { attendanceDataForCalc.push({ ...subject, totalHeld: jsonData[subject.code].total, attended: jsonData[subject.code].present }); } else { missedSubjects.push(subject); } }); const unmatchedOcrCodes = Object.keys(jsonData).filter(code => !classSubjectCodes.has(code)); if (unmatchedOcrCodes.length > 0) { showToast(`⚠️ Unrecognized codes: ${unmatchedOcrCodes.join(', ')}`, 'warning'); console.warn('OCR extracted codes not in class:', unmatchedOcrCodes); } if (missedSubjects.length > 0 && attendanceDataForCalc.length > 0) { ocrResultsCache = jsonData; openPartialEntryModal(missedSubjects); return; } if (Object.keys(jsonData).length === 0) { alert('Could not extract any attendance data. Please try manual entry.'); return; } calculateAttendance(attendanceDataForCalc); }

function calculateAttendance(attendanceData) {
    const resultsSection = document.getElementById('resultsSection');

    // Ensure results section is visible
    resultsSection.style.display = 'block';

    // Initialize the structure with Header and View Containers
    // Check if this is Standard mode (not Portal mode) to show assumption message
    // Even if portal is active, if user switched to standard calc, show the notice
    const isInStandardCalc = sessionStorage.getItem('calculatingFromPortal') === 'true';
    const isPortalMode = selectedClass?.portalSetup?.active && !isInStandardCalc;
    const standardModeNotice = !isPortalMode ? `
                    <div style="background: linear-gradient(135deg, #3b82f620, #60a5fa20); border: 1px solid #3b82f6; border-radius: 8px; padding: 12px 16px; margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 1.2rem;">ℹ️</span>
                        <div style="flex: 1;">
                            <strong style="color: #3b82f6;">Standard Calculation Mode</strong>
                            <p style="margin: 4px 0 0 0; font-size: 0.85rem; color: var(--medium-text);">
                                This calculation assumes all your attendance has been marked till <strong>${document.getElementById('currentDate').value}</strong>. 
                                For daily tracking, try <strong>Portal Mode</strong>!
                            </p>
                        </div>
                    </div>
                ` : '';

    resultsSection.innerHTML = `
                <h2>📊 Attendance Analysis & Projections</h2>
                ${standardModeNotice}
                <div id="analysisResults" class="results-grid"></div>
                <div id="tabularAnalysisSection" style="display: none; margin-top: 20px;"></div>
                <div id="graphAnalysisSection" style="display: none; margin-top: 20px;"></div>
            `;

    const analysisResults = [];

    // Aggregate Logs - ONLY for Standard Mode (non-Portal)
    // Portal mode already handles log aggregation in calculateFromPortal()
    const portalModeActive = selectedClass?.portalSetup?.active;
    const logs = portalModeActive ? {} : (JSON.parse(localStorage.getItem('attendance_logs')) || {});
    const logStats = {}; // { code: { attended: 0, total: 0 } }

    if (!portalModeActive && logs && typeof logs === 'object') {
        Object.keys(logs).forEach(date => {
            if (!logs[date] || typeof logs[date] !== 'object') return; // Skip invalid days

            Object.keys(logs[date]).forEach(key => {
                const status = logs[date][key];
                // Extract base subject code from Subject_pX or use as-is (legacy)
                // e.g., "MATH_p1" -> "MATH", "ENG" -> "ENG"
                const code = key.split('_p')[0];
                if (!logStats[code]) logStats[code] = { attended: 0, total: 0 };

                // Match Portal mode status values: 'Attended', 'Present', 'Duty Leave (OD)', 'Medical Leave (ML)'
                const isPresent = status === 'Attended' || status === 'Present' || status === 'Duty Leave (OD)' || status === 'Medical Leave (ML)';
                const isAbsent = status === 'Skipped' || status === 'Absent';

                if (isPresent) {
                    logStats[code].attended++;
                    logStats[code].total++;
                } else if (isAbsent) {
                    logStats[code].total++;
                }
                // Cancelled adds nothing
            });
        });
    }

    attendanceData.forEach(subject => {
        // Safety check for subject existence
        if (!subject || !subject.code) return;

        const currentDateVal = document.getElementById('currentDate')?.value || formatLocalDate(new Date());
        const lastDateVal = document.getElementById('lastDate')?.value || '';

        const currentDate = parseLocalDate(currentDateVal);
        // Use a safe lastDate (fallback to current+30 days if missing, or just ignore remaining calc if critical)
        const lastDate = lastDateVal ? parseLocalDate(lastDateVal) : new Date(currentDate.getTime() + 30 * 86400000);

        const holidayDates = (selectedClass && selectedClass.holidays ? selectedClass.holidays : []).map(h => parseLocalDate(h));

        // Validate Dates
        let remaining = 0;
        try {
            remaining = countClassesInRange(new Date(currentDate.getTime() + 86400000), lastDate, subject.schedule, holidayDates, subject.code);
        } catch (e) {
            console.warn('Error calculating remaining classes:', e);
            remaining = 0;
        }

        const baseAttended = Number(subject.initialAttended ?? subject.attended) || 0;
        const baseTotal = Number(subject.initialTotal ?? subject.totalHeld) || 0;

        const logAdditions = logStats[subject.code] || { attended: 0, total: 0 };

        const attended = baseAttended + logAdditions.attended;
        const totalHeld = baseTotal + logAdditions.total;

        analysisResults.push({
            ...subject,
            remaining,
            attended: attended,
            totalHeld: totalHeld,
            initialAttended: baseAttended,
            initialTotal: baseTotal
        });
    });

    currentAnalysisData = analysisResults;

    const snapshot = {
        results: JSON.parse(JSON.stringify(currentAnalysisData)),
        settings: {
            minAttendance: document.getElementById('minAttendanceInput').value,
            overallMode: document.getElementById('overallCriteriaCheckbox').checked,
            currentDate: document.getElementById('currentDate').value,
            lastDate: document.getElementById('lastDate').value
        },
        timestamp: new Date()
    };
    calculationHistory.unshift(snapshot);
    if (calculationHistory.length > 10) calculationHistory.pop();
    updateHistoryDropdown();

    if (isOverallMode()) {
        displayOverallAnalysis();
    } else {
        displayPerSubjectAnalysis();
    }

    document.getElementById('pdfDownloadContainer').innerHTML = `<button class="btn success-btn" onclick="downloadCurrentReportPDF()">Download Report (PDF)</button>`;

    const leavePlannerSection = document.getElementById('leavePlannerSection');
    if (leavePlannerSection) leavePlannerSection.style.display = 'block';

    generateLeavePlanner();

    const maxLeaveRec = document.getElementById('maxLeaveRecommendation');
    if (maxLeaveRec) maxLeaveRec.style.display = 'block';

    calculateMaxSafeLeave();
    recommendMedicalCertificates(); // NEW: Medical Certificate Recommendation

    const leaveRecContainer = document.getElementById('leaveRecommendationContainer');
    if (leaveRecContainer) leaveRecContainer.style.display = 'block';
    findLongWeekends();
    generateTimetable();

    // UX Enhancement: Scroll to results
    document.querySelector('#resultsSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Check if calculation was triggered from Portal Mode
    // If yes, prompt user to update portal data
    setTimeout(() => {
        promptPortalUpdate();

        // [NEW] Trigger Calculation Ad
        if (window.bunkitAdManager) {
            console.log('📊 Calculation complete — triggering ad check');
            window.bunkitAdManager.showCalculateAd();
        }
    }, 500); // Small delay to let results render first

    // === Bridge for CommunityManager: expose attendance data ===
    window.getAttendanceSummary = function () {
        if (!currentAnalysisData || currentAnalysisData.length === 0) return null;

        let totalAttended = 0, totalHeld = 0, totalRemaining = 0;
        currentAnalysisData.forEach(sub => {
            totalAttended += (sub.attended || 0);
            totalHeld += (sub.totalHeld || 0);
            totalRemaining += (sub.remaining || 0);
        });

        const currentPercent = totalHeld > 0 ? (totalAttended / totalHeld) * 100 : 0;
        const finalTotal = totalHeld + totalRemaining;
        const projectedMax = finalTotal > 0 ? ((totalAttended + totalRemaining) / finalTotal) * 100 : 0;

        // "Can I Skip Today" logic: check today's schedule
        const today = new Date(document.getElementById('currentDate')?.value || new Date().toISOString().split('T')[0]);
        const dayOfWeek = today.getDay();
        const scheduleIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        let classesToday = 0;
        if (selectedClass && selectedClass.subjects) {
            selectedClass.subjects.forEach(s => {
                if (s.schedule && s.schedule[scheduleIndex]) {
                    classesToday += s.schedule[scheduleIndex];
                }
            });
        }

        // If skip all today's classes, what's thefinal %?
        const projectedIfSkip = finalTotal > 0 ? ((totalAttended + totalRemaining - classesToday) / finalTotal) * 100 : 0;
        const minCriteria = getMinAttendanceCriteria() * 100; // e.g., 75
        const canSkipToday = projectedIfSkip >= minCriteria;

        return {
            totalAttended,
            totalHeld,
            totalRemaining,
            currentPercent,
            projectedMax,
            classesToday,
            projectedIfSkip,
            minCriteria,
            canSkipToday,
            subjectCount: currentAnalysisData.length
        };
    };
}

function displayPerSubjectAnalysis() {
    const container = document.getElementById('analysisResults');
    container.innerHTML = ''; // Clear previous cards

    currentAnalysisData.forEach(subject => {
        const { alertClass, alertMessage, stats } = getSubjectAnalysis(subject.attended, subject.totalHeld, subject.remaining);
        container.innerHTML += `
                    <div class="subject-card">
                        <div class="subject-title">${subject.name} (${subject.code})</div>
                        <div class="stats-grid">
                            ${generateStatItemHTML(`currentPercent_${subject.code}`, 'Current %', stats.currentPercent.toFixed(1) + '%', 'The attendance percentage based on classes held so far.')}
                            ${generateStatItemHTML(`maxPercent_${subject.code}`, 'Attend All Classes %', stats.projectedMaxPercent.toFixed(1) + '%', 'Your final percentage if you attend ALL remaining classes.')}
                            ${generateStatItemHTML(`minPercent_${subject.code}`, 'Skip All Classes %', stats.projectedMinPercent.toFixed(1) + '%', 'Your final percentage if you SKIP all remaining classes.')}
                            ${stats.projectedMaxPercent >= (getMinAttendanceCriteria() * 100) ? generateStatItemHTML(`safeSkipPercent_${subject.code}`, 'After Safe Skips %', stats.safeSkipPercent.toFixed(1) + '%', 'Your final percentage after skipping the maximum number of classes while staying above the minimum requirement.') : ''}
                            <div class="stat-item">
                                <div class="stat-value-editable">
                                    ${(selectedClass && selectedClass.portalSetup && selectedClass.portalSetup.active) ?
                `<input type="number" id="attended_${subject.code}" value="${subject.attended}" disabled style="background:#eee;color:#777;cursor:not-allowed" title="Managed by Portal Mode">` :
                `<input type="number" id="attended_${subject.code}" value="${subject.attended}" oninput="recalculateSubject('${subject.code}')">`
            } / 
                                    ${(selectedClass && selectedClass.portalSetup && selectedClass.portalSetup.active) ?
                `<input type="number" id="total_${subject.code}" value="${subject.totalHeld}" disabled style="background:#eee;color:#777;cursor:not-allowed" title="Managed by Portal Mode">` :
                `<input type="number" id="total_${subject.code}" value="${subject.totalHeld}" oninput="recalculateSubject('${subject.code}')">`
            }
                                </div>
                                <div class="stat-label">Attended / Held</div>
                            </div>
                            ${generateStatItemHTML(`remaining_${subject.code}`, 'Remaining', stats.remaining, 'Total number of classes from tomorrow until the last working day.')}
                            ${generateStatItemHTML(`stillNeed_${subject.code}`, 'Need to Attend', stats.stillNeed, 'The minimum number of remaining classes you MUST attend to meet the requirement.')}
                            ${generateStatItemHTML(`maxSkippable_${subject.code}`, 'Can Skip', stats.maxSkippable, 'The maximum number of remaining classes you can miss and still meet the requirement.')}
                        </div>
                        <div id="alert_${subject.code}" class="alert-message ${alertClass}">${alertMessage}</div>
                    </div>`;
    });

    // Preserve current view mode (or use saved preference if currentView is not set)
    const viewToUse = currentView || localStorage.getItem('defaultView') || 'table';
    switchView(viewToUse);
}

// --- VIEW SWITCHING & ANALYTICS ---

// Load saved view preference or default to table (never default to graph)
let currentView = localStorage.getItem('defaultView') || 'table';
if (currentView === 'graph') currentView = 'table'; // Ensure graph is never default

function switchView(view) {
    currentView = view;

    // Save preference for cards/table only (never save graph as default)
    if (view === 'cards' || view === 'table') {
        localStorage.setItem('defaultView', view);
    }

    const analysisResults = document.getElementById('analysisResults');
    const tabularAnalysisSection = document.getElementById('tabularAnalysisSection');
    const graphAnalysisSection = document.getElementById('graphAnalysisSection');

    if (analysisResults) analysisResults.style.display = view === 'cards' ? 'grid' : 'none';
    if (tabularAnalysisSection) tabularAnalysisSection.style.display = view === 'table' ? 'block' : 'none';
    if (graphAnalysisSection) graphAnalysisSection.style.display = view === 'graph' ? 'block' : 'none';

    if (view === 'table') renderTabularAnalysis();
    if (view === 'graph') renderAttendanceChart();
}

function renderTabularAnalysis() {
    const container = document.getElementById('tabularAnalysisSection');
    if (!container) return;

    if (!currentAnalysisData || currentAnalysisData.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:20px;">No data available. Please calculate attendance first.</p>';
        return;
    }

    const minAttendance = getMinAttendanceCriteria() * 100;

    let html = `
                <div class="card" style="padding: 5px;">
                    <h3 style="margin-bottom: 10px; font-size: 1.2rem;">📊 Detailed Attendance Table</h3>
                    <div style="overflow-x: hidden;"> <!-- Disable scroll to force fit -->
                    <table class="analysis-table">
                        <thead>
                            <tr>
                                <th>Sub</th>
                                <th>Att/Tot</th>
                                <th>Curr%</th>
                                <th>Max%</th>
                                <th>Min%</th>
                                <th>Safe%</th>
                                <th>Rem</th>
                                <th>Need</th>
                                <th>Skip</th>
                            </tr>
                        </thead>
                        <tbody>`;

    currentAnalysisData.forEach(subject => {
        const { stats } = getSubjectAnalysis(subject.attended, subject.totalHeld, subject.remaining);
        const statusColor = stats.currentPercent >= minAttendance ? 'var(--success-grad-start)' : 'var(--danger-color)';
        const safeSkipVal = stats.projectedMaxPercent >= minAttendance ? stats.safeSkipPercent.toFixed(0) + '%' : '-';

        html += `
                    <tr>
                        <td class="subject-cell" style="font-weight: 500;">${getSubjectAcronym(subject.name)}</td>
                        <td>
                            <div class="stat-value-editable" style="justify-content: center; gap: 2px;">
                                <input type="number" id="table_attended_${subject.code}" value="${subject.attended}" oninput="recalculateSubject('${subject.code}', 'table')">
                                <span>/</span>
                                <input type="number" id="table_total_${subject.code}" value="${subject.totalHeld}" oninput="recalculateSubject('${subject.code}', 'table')">
                            </div>
                        </td>
                        <td style="font-weight: bold; color: ${statusColor}"><span id="table_currentPercent_${subject.code}">${stats.currentPercent.toFixed(0)}%</span></td>
                        <td><span id="table_maxPercent_${subject.code}">${stats.projectedMaxPercent.toFixed(0)}%</span></td>
                        <td><span id="table_minPercent_${subject.code}">${stats.projectedMinPercent.toFixed(0)}%</span></td>
                        <td><span id="table_safeSkipPercent_${subject.code}">${safeSkipVal}</span></td>
                        <td><span id="table_remaining_${subject.code}">${stats.remaining}</span></td>
                        <td style="font-weight: bold; color: var(--warning-color);"><span id="table_stillNeed_${subject.code}">${stats.stillNeed}</span></td>
                        <td style="font-weight: bold; color: var(--success-grad-start);"><span id="table_maxSkippable_${subject.code}">${stats.maxSkippable}</span></td>
                    </tr>`;
    });

    if (isOverallMode()) {
        const overall = currentAnalysisData.reduce((acc, subject) => {
            acc.attended += subject.attended;
            acc.totalHeld += subject.totalHeld;
            acc.remaining += subject.remaining;
            return acc;
        }, { attended: 0, totalHeld: 0, remaining: 0 });

        const { stats } = getSubjectAnalysis(overall.attended, overall.totalHeld, overall.remaining);
        const statusColor = stats.currentPercent >= minAttendance ? 'var(--success-grad-start)' : 'var(--danger-color)';
        const safeSkipVal = stats.projectedMaxPercent >= minAttendance ? stats.safeSkipPercent.toFixed(0) + '%' : '-';

        html += `
                    <tr style="background-color: var(--light-bg); font-weight: bold; border-top: 2px solid var(--border-color);">
                        <td class="subject-cell">OVERALL</td>
                        <td>${overall.attended}/${overall.totalHeld}</td>
                        <td style="color: ${statusColor}">${stats.currentPercent.toFixed(0)}%</td>
                        <td>${stats.projectedMaxPercent.toFixed(0)}%</td>
                        <td>${stats.projectedMinPercent.toFixed(0)}%</td>
                        <td>${safeSkipVal}</td>
                        <td>${stats.remaining}</td>
                        <td style="color: var(--warning-color);">${stats.stillNeed}</td>
                        <td style="color: var(--success-grad-start);">${stats.maxSkippable}</td>
                    </tr>`;
    }

    // Add legend
    html += `</tbody></table></div>
                    <div style="margin-top: 15px; padding: 10px; background: var(--light-bg); border-radius: 8px; font-size: 0.85rem;">
                        <h4 style="margin: 0 0 8px 0; font-size: 0.95rem;">📖 Legend</h4>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px;">
                            <div><strong>Sub:</strong> Subject</div>
                            <div><strong>Att/Tot:</strong> Attended / Total</div>
                            <div><strong>Curr%:</strong> Current %</div>
                            <div><strong>Max%:</strong> Attend All Classes %</div>
                            <div><strong>Min%:</strong> Skip All Classes %</div>
                            <div><strong>Safe%:</strong> After Safe Skips %</div>
                            <div><strong>Rem:</strong> Remaining Classes</div>
                            <div><strong>Need:</strong> Need to Attend</div>
                            <div><strong>Skip:</strong> Can Skip</div>
                        </div>
                        <h4 style="margin: 12px 0 8px 0; font-size: 0.95rem;">📚 Subjects</h4>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px;">`;

    currentAnalysisData.forEach(subject => {
        html += `<div><strong>${getSubjectAcronym(subject.name)}:</strong> ${subject.name}</div>`;
    });

    html += `</div></div></div>`;
    container.innerHTML = html;
}

let attendanceChartInstance = null;

async function renderAttendanceChart() {
    const container = document.getElementById('graphAnalysisSection');
    // Lazy-load Chart.js on first use
    try { await loadScript(CDN.CHART); } catch (e) {
        container.innerHTML = '<p style="text-align:center;padding:20px;">⚠️ Failed to load Chart library. Check your internet.</p>';
        return;
    }
    if (!container) return;

    if (!currentAnalysisData || currentAnalysisData.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:20px;">No data available. Please calculate attendance first.</p>';
        return;
    }

    const minAttendance = getMinAttendanceCriteria() * 100;
    const isOverall = isOverallMode();

    if (isOverall) {
        // Overall Mode Graph - Show aggregated metrics
        const overall = currentAnalysisData.reduce((acc, subject) => {
            acc.attended += subject.attended;
            acc.totalHeld += subject.totalHeld;
            acc.remaining += subject.remaining;
            return acc;
        }, { attended: 0, totalHeld: 0, remaining: 0 });

        const { stats } = getSubjectAnalysis(overall.attended, overall.totalHeld, overall.remaining);

        container.innerHTML = `
                    <div class="card">
                        <h3 style="margin-bottom: 15px;">📊 Overall Attendance Progress</h3>
                        <div style="height: 400px; position: relative;">
                            <canvas id="attendanceChartCanvas"></canvas>
                        </div>
                    </div>`;

        const ctx = document.getElementById('attendanceChartCanvas').getContext('2d');

        if (attendanceChartInstance) {
            attendanceChartInstance.destroy();
        }

        const labels = ['Current %', 'Attend All %', 'Skip All %', 'Required %'];
        const data = [
            stats.currentPercent,
            stats.projectedMaxPercent,
            stats.projectedMinPercent,
            minAttendance
        ];
        const colors = [
            stats.currentPercent >= minAttendance ? 'rgba(46, 204, 113, 0.7)' : 'rgba(231, 76, 60, 0.7)',
            'rgba(52, 152, 219, 0.7)',
            'rgba(52, 73, 94, 0.7)',
            'rgba(243, 156, 18, 0.7)'
        ];
        const borderColors = [
            stats.currentPercent >= minAttendance ? '#2ecc71' : '#e74c3c',
            '#3498db',
            '#34495e',
            '#f39c12'
        ];

        attendanceChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Overall Attendance',
                    data: data,
                    backgroundColor: colors,
                    borderColor: borderColors,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y', // Horizontal bar chart
                scales: {
                    x: {
                        beginAtZero: true,
                        max: 100,
                        title: { display: true, text: 'Percentage (%)' }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return context.dataset.label + ': ' + context.raw.toFixed(1) + '%';
                            }
                        }
                    },
                    legend: {
                        display: false
                    }
                }
            }
        });
    } else {
        // Per-Subject Mode Graph
        container.innerHTML = `
                    <div class="card">
                        <h3 style="margin-bottom: 15px;">📈 Per-Subject Attendance Overview</h3>
                        <div style="height: 400px; position: relative;">
                            <canvas id="attendanceChartCanvas"></canvas>
                        </div>
                    </div>`;

        const ctx = document.getElementById('attendanceChartCanvas').getContext('2d');

        if (attendanceChartInstance) {
            attendanceChartInstance.destroy();
        }

        const labels = currentAnalysisData.map(s => s.code);
        const currentData = currentAnalysisData.map(s => {
            const { stats } = getSubjectAnalysis(s.attended, s.totalHeld, s.remaining);
            return stats.currentPercent;
        });
        const requiredData = currentAnalysisData.map(() => minAttendance);

        attendanceChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Current %',
                        data: currentData,
                        backgroundColor: currentData.map(val => val >= minAttendance ? 'rgba(46, 204, 113, 0.7)' : 'rgba(231, 76, 60, 0.7)'),
                        borderColor: currentData.map(val => val >= minAttendance ? '#2ecc71' : '#e74c3c'),
                        borderWidth: 1
                    },
                    {
                        label: 'Required %',
                        data: requiredData,
                        type: 'line',
                        borderColor: '#3498db',
                        borderDash: [5, 5],
                        pointRadius: 0,
                        borderWidth: 2,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: { display: true, text: 'Percentage (%)' }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return context.dataset.label + ': ' + context.raw.toFixed(1) + '%';
                            }
                        }
                    }
                }
            }
        });
    }
}

function displayOverallAnalysis() {
    const container = document.getElementById('analysisResults');
    container.innerHTML = '';

    const overall = currentAnalysisData.reduce((acc, subject) => {
        acc.attended += subject.attended;
        acc.totalHeld += subject.totalHeld;
        acc.remaining += subject.remaining;
        return acc;
    }, { attended: 0, totalHeld: 0, remaining: 0 });

    const { alertClass, alertMessage, stats } = getSubjectAnalysis(overall.attended, overall.totalHeld, overall.remaining);

    container.innerHTML += `
                <div class="subject-card" style="border-left-color: var(--primary-grad-start);">
                    <div class="subject-title">📈 Overall Attendance Summary</div>
                    <div class="stats-grid">
                        ${generateStatItemHTML('overall_currentPercent', 'Current %', stats.currentPercent.toFixed(1) + '%', 'The overall attendance percentage based on all classes held so far.')}
                        ${generateStatItemHTML('overall_maxPercent', 'Attend All Classes %', stats.projectedMaxPercent.toFixed(1) + '%', 'Your final overall percentage if you attend ALL remaining classes.')}
                        ${generateStatItemHTML('overall_minPercent', 'Skip All Classes %', stats.projectedMinPercent.toFixed(1) + '%', 'Your final overall percentage if you SKIP all remaining classes.')}
                        ${stats.projectedMaxPercent >= (getMinAttendanceCriteria() * 100) ? generateStatItemHTML('overall_safeSkipPercent', 'After Safe Skips %', stats.safeSkipPercent.toFixed(1) + '%', 'Your final percentage after skipping the maximum number of classes while staying above the minimum requirement.') : ''}
                        ${generateStatItemHTML('overall_attendedTotal', 'Attended / Held', `${overall.attended} / ${overall.totalHeld}`, 'Total classes attended versus total classes held across all subjects.')}
                        ${generateStatItemHTML('overall_remaining', 'Remaining', stats.remaining, 'Total number of classes remaining across all subjects.')}
                        ${generateStatItemHTML('overall_stillNeed', 'Need to Attend', stats.stillNeed, 'The minimum number of remaining classes you MUST attend to meet the overall requirement.')}
                        ${generateStatItemHTML('overall_maxSkippable', 'Can Skip', stats.maxSkippable, 'The maximum number of remaining classes you can miss and still meet the overall requirement.')}
                    </div>
                    <div class="alert-message ${alertClass}">${alertMessage}</div>
                </div>`;

    // Preserve current view mode
    if (currentView) {
        switchView(currentView);
    }
}

function getSubjectAnalysis(attended, totalHeld, remaining, minCriteriaOverride = null) {
    attended = Number(attended) || 0;
    totalHeld = Number(totalHeld) || 0;
    remaining = Number(remaining) || 0;

    const minCriteria = minCriteriaOverride !== null ? minCriteriaOverride : getMinAttendanceCriteria();
    const finalTotal = totalHeld + remaining;
    const minRequired = finalTotal > 0 ? Math.ceil(minCriteria * finalTotal) : 0;
    const stillNeed = Math.max(0, minRequired - attended);
    const maxSkippable = Math.max(0, remaining - stillNeed);

    const currentPercent = totalHeld === 0 ? 0 : (attended / totalHeld) * 100;
    const projectedMaxPercent = finalTotal === 0 ? 0 : ((attended + remaining) / finalTotal) * 100;
    const projectedMinPercent = finalTotal === 0 ? 0 : (attended / finalTotal) * 100;
    const safeSkipPercent = finalTotal === 0 ? 0 : ((attended + stillNeed) / finalTotal) * 100;

    let alertClass = '', alertMessage = '';
    if (stillNeed > remaining) {
        alertClass = 'danger';
        const classesNeeded = minRequired - (attended + remaining);
        alertMessage = `<strong>Cannot Reach ${minCriteria * 100}%!</strong> Your max possible attendance is ${projectedMaxPercent.toFixed(1)}%.`;
        if (projectedMaxPercent >= 65) {
            alertMessage += `<br>🚨 You may need to condone <strong>${classesNeeded}</strong> class(es) with a medical certificate.`;
        } else {
            alertMessage += `<br>🛑 **Detainment Likely:** Max attendance is below 65%.`;
        }
    } else if (currentPercent < (minCriteria * 100)) {
        alertClass = 'warning';
        alertMessage = `<strong>Action Required:</strong> You must attend at least <strong>${stillNeed}</strong> of the remaining ${remaining} classes.`;
    } else {
        alertClass = 'success';
        alertMessage = `<strong>On Track!</strong> You can afford to miss up to <strong>${maxSkippable}</strong> more classes.`;
    }
    return { alertClass, alertMessage, stats: { currentPercent, projectedMaxPercent, projectedMinPercent, safeSkipPercent, remaining, stillNeed, maxSkippable, finalTotal, attended, totalHeld } };
}

function generateStatItemHTML(id, label, value, tooltipText) {
    return `
                <div class="stat-item">
                    <div class="stat-value" id="${id}">${value}</div>
                    <div class="stat-label">
                        ${label}
                        <i class="info-icon">i<span class="tooltip">${tooltipText}</span></i>
                    </div>
                </div>`;
}

// --- REWRITTEN: This function now performs surgical DOM updates to prevent cursor jumping ---
function recalculateSubject(subjectCode, source = 'card') {
    const subjectData = currentAnalysisData.find(s => s.code === subjectCode);
    if (!subjectData) return;

    let newAttended, newTotal;

    // Get values based on source
    if (source === 'card') {
        newAttended = parseInt(document.getElementById(`attended_${subjectCode}`).value, 10) || 0;
        newTotal = parseInt(document.getElementById(`total_${subjectCode}`).value, 10) || 0;
    } else {
        newAttended = parseInt(document.getElementById(`table_attended_${subjectCode}`).value, 10) || 0;
        newTotal = parseInt(document.getElementById(`table_total_${subjectCode}`).value, 10) || 0;
    }

    // Sync the OTHER input immediately
    if (source === 'card') {
        const tableAttended = document.getElementById(`table_attended_${subjectCode}`);
        const tableTotal = document.getElementById(`table_total_${subjectCode}`);
        if (tableAttended) tableAttended.value = newAttended;
        if (tableTotal) tableTotal.value = newTotal;
    } else {
        const cardAttended = document.getElementById(`attended_${subjectCode}`);
        const cardTotal = document.getElementById(`total_${subjectCode}`);
        if (cardAttended) cardAttended.value = newAttended;
        if (cardTotal) cardTotal.value = newTotal;
    }

    // Visual validation feedback (apply to both if they exist)
    const inputs = [
        document.getElementById(`attended_${subjectCode}`),
        document.getElementById(`total_${subjectCode}`),
        document.getElementById(`table_attended_${subjectCode}`),
        document.getElementById(`table_total_${subjectCode}`)
    ];

    inputs.forEach(input => {
        if (input) input.style.borderColor = newTotal < newAttended ? 'var(--danger-color)' : '';
    });

    if (newTotal < newAttended) return; // Stop if data is invalid

    // Update the central data store
    subjectData.attended = newAttended;
    subjectData.totalHeld = newTotal;
    subjectData.initialAttended = newAttended; // Ensure these are kept in sync for future full calcs
    subjectData.initialTotal = newTotal;

    // Recalculate stats for this subject only
    const { alertClass, alertMessage, stats } = getSubjectAnalysis(newAttended, newTotal, subjectData.remaining);
    const minAttendance = getMinAttendanceCriteria() * 100;
    const safeSkipVal = stats.projectedMaxPercent >= minAttendance ? stats.safeSkipPercent.toFixed(1) + '%' : '-';

    // Update the UI surgically without re-rendering the whole component
    const updateElementText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    // Update Card View Elements
    updateElementText(`currentPercent_${subjectCode}`, stats.currentPercent.toFixed(1) + '%');
    updateElementText(`maxPercent_${subjectCode}`, stats.projectedMaxPercent.toFixed(1) + '%');
    updateElementText(`minPercent_${subjectCode}`, stats.projectedMinPercent.toFixed(1) + '%');
    updateElementText(`safeSkipPercent_${subjectCode}`, stats.safeSkipPercent.toFixed(1) + '%');
    updateElementText(`stillNeed_${subjectCode}`, stats.stillNeed);
    updateElementText(`maxSkippable_${subjectCode}`, stats.maxSkippable);

    // Update Table View Elements
    updateElementText(`table_currentPercent_${subjectCode}`, stats.currentPercent.toFixed(1) + '%');
    updateElementText(`table_maxPercent_${subjectCode}`, stats.projectedMaxPercent.toFixed(1) + '%');
    updateElementText(`table_minPercent_${subjectCode}`, stats.projectedMinPercent.toFixed(1) + '%');
    updateElementText(`table_safeSkipPercent_${subjectCode}`, safeSkipVal);
    updateElementText(`table_remaining_${subjectCode}`, stats.remaining);
    updateElementText(`table_stillNeed_${subjectCode}`, stats.stillNeed);
    updateElementText(`table_maxSkippable_${subjectCode}`, stats.maxSkippable);

    const alertDiv = document.getElementById(`alert_${subjectCode}`);
    if (alertDiv) {
        alertDiv.className = `alert-message ${alertClass}`;
        alertDiv.innerHTML = alertMessage;
    }

    // If overall mode is active, that display needs a full refresh
    if (isOverallMode()) {
        displayOverallAnalysis();
    }

    // Re-calculate other dependent sections of the page
    calculateMaxSafeLeave();
    updateDailyDashboard();

    // UX Improvement: Scroll to the updated card

    const cardElement = document.getElementById(`attended_${subjectCode}`);
    cardElement?.closest('.subject-card')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Helper function to parse schedule values (handles both old number format and new string format)
function parseScheduleValue(scheduleValue) {
    if (typeof scheduleValue === 'number') {
        return scheduleValue;
    } else if (typeof scheduleValue === 'string') {
        if (scheduleValue === '0' || scheduleValue === '') {
            return 0;
        }
        // Count periods by splitting on comma
        return scheduleValue.split(',').filter(p => p.trim() !== '' && p.trim() !== '0').length;
    }
    return 0;
}

// Helper function to get classes for a subject on a given date (respects custom schedules and arrangements)
function getSubjectClassCountForDate(dateStr, subjectCode) {
    if (!selectedClass) return 0;
    const date = parseLocalDate(dateStr);
    const dayOfWeek = date.getDay();
    const scheduleIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    // Check custom schedule first
    const className = document.getElementById('classSelector')?.value || selectedClass.name;
    const customSchedules = JSON.parse(localStorage.getItem(`custom_schedules_${className}`) || '{}');
    const customSchedule = customSchedules[dateStr];

    if (customSchedule) {
        if (customSchedule._periods) {
            // New period-based custom schedule
            return customSchedule._periods.filter(code => code === subjectCode).length;
        } else {
            // Old count-based custom schedule
            return customSchedule[subjectCode] || 0;
        }
    }

    // Use timetable arrangement
    const arrangement = getTimetableArrangement(className) || {};
    const dayArrangement = arrangement[scheduleIndex] || [];

    if (dayArrangement.length > 0) {
        return dayArrangement.filter(item => {
            const code = typeof item === 'object' ? item?.code : item;
            return code === subjectCode;
        }).length;
    }

    // Fallback to default schedule
    const subject = selectedClass?.subjects?.find(s => s.code === subjectCode);
    if (subject) {
        return parseScheduleValue(subject.schedule[scheduleIndex]);
    }

    return 1; // Default fallback
}

function countClassesInRange(startDate, endDate, schedule, classHolidays, subjectCode) {
    let total = 0;
    if (!startDate || !endDate || startDate > endDate) return 0;
    const logs = JSON.parse(localStorage.getItem('attendance_logs')) || {};
    let current = new Date(startDate.getTime());
    const holidayTimestamps = new Set(classHolidays.map(h => h.setHours(0, 0, 0, 0)));
    while (current <= endDate) {
        const dayTime = new Date(current).setHours(0, 0, 0, 0);
        const isHolidayDay = holidayTimestamps.has(dayTime);
        if (!isHolidayDay) {
            const dateStr = formatLocalDate(current);
            let classesToday = getSubjectClassCountForDate(dateStr, subjectCode);

            const dayLog = logs[dateStr];
            if (dayLog && dayLog[subjectCode] === 'Cancelled') {
                classesToday = 0;
            }
            total += classesToday;
        }
        current.setDate(current.getDate() + 1);
    }
    return total;
}

// ==================== TIMETABLE VERSIONING ====================

/**
 * Get timetable history for a class
 * Returns array of { effectiveFrom, effectiveTo, arrangement } sorted by date
 */
function getTimetableHistory(className) {
    const historyKey = `timetable_history_${className}`;
    const history = localStorage.getItem(historyKey);
    return history ? JSON.parse(history) : [];
}

/**
 * Save a new timetable version to history
 */
function saveTimetableVersion(className, arrangement, effectiveFrom, effectiveTo = null) {
    const history = getTimetableHistory(className);

    // Add new version
    history.push({
        effectiveFrom: effectiveFrom,
        effectiveTo: effectiveTo,
        arrangement: arrangement,
        savedAt: new Date().toISOString()
    });

    // Sort by effectiveFrom date (oldest first)
    history.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));

    localStorage.setItem(`timetable_history_${className}`, JSON.stringify(history));
}

/**
 * Archive the current timetable by setting its effectiveTo date
 */
function archiveCurrentTimetable(className, archiveEndDate) {
    const history = getTimetableHistory(className);

    // Find the current (active) version - one with no effectiveTo
    const currentIdx = history.findIndex(v => !v.effectiveTo);

    if (currentIdx !== -1) {
        history[currentIdx].effectiveTo = archiveEndDate;
        localStorage.setItem(`timetable_history_${className}`, JSON.stringify(history));
    }
}

/**
 * Get timetable arrangement for a class, optionally for a specific date
 * @param {string} className - Name of the class
 * @param {string|null} forDate - Optional date string (YYYY-MM-DD) to get historical timetable
 * @returns {object} Timetable arrangement object
 */
function getTimetableArrangement(className, forDate = null) {
    // If forDate is specified, check history
    if (forDate) {
        const history = getTimetableHistory(className);

        // Find version active on that date
        for (const version of history) {
            const isAfterStart = forDate >= version.effectiveFrom;
            const isBeforeEnd = !version.effectiveTo || forDate <= version.effectiveTo;

            if (isAfterStart && isBeforeEnd) {
                return version.arrangement;
            }
        }
        // If no history matches, fall through to current
    }

    // Return current/active timetable
    const stored = localStorage.getItem(`timetable_arrangement_${className}`);
    return stored ? JSON.parse(stored) : null;
}

/**
 * Save timetable arrangement (wrapper for consistency)
 */
function saveTimetableArrangement(className, arrangement) {
    localStorage.setItem(`timetable_arrangement_${className}`, JSON.stringify(arrangement));
}

/**
 * Get period times for a class
 */
function getPeriodTimes(className) {
    const stored = localStorage.getItem(`periodTimes_${className}`);
    return stored ? JSON.parse(stored) : null;
}

/**
 * Save period times for a class
 */
function savePeriodTimes(className, periodTimes) {
    localStorage.setItem(`periodTimes_${className}`, JSON.stringify(periodTimes));
    // Sync with Cloud
    if (window.SyncManager) SyncManager.uploadAll();
}

/**
 * Check for attendance log conflicts in a date range
 * Returns count of days with logged data
 */
function checkLogConflicts(className, startDate, endDate) {
    const logs = JSON.parse(localStorage.getItem('attendance_logs')) || {};
    let conflictCount = 0;
    const affectedDates = [];

    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = formatLocalDate(d);
        if (logs[dateStr] && Object.keys(logs[dateStr]).length > 0) {
            conflictCount++;
            affectedDates.push(dateStr);
        }
    }

    return { count: conflictCount, dates: affectedDates };
}

// ==================== END TIMETABLE VERSIONING ====================

function showInputMode(mode) { // mode can be 'upload', 'manual', 'json'
    const uploadSection = document.getElementById('uploadSection');
    const manualInput = document.getElementById('manualInput');
    const jsonInput = document.getElementById('jsonInput');
    const previewImage = document.getElementById('previewImage');

    if (uploadSection) uploadSection.style.display = mode === 'upload' ? 'block' : 'none';
    if (manualInput) manualInput.style.display = mode === 'manual' ? 'block' : 'none';
    if (jsonInput) jsonInput.style.display = mode === 'json' ? 'block' : 'none';

    if (mode !== 'upload' && previewImage) {
        previewImage.style.display = 'none';
    }
}

function generateManualInputs() { const subjectsGrid = document.getElementById('subjectsGrid'); subjectsGrid.innerHTML = ''; if (!selectedClass) return; selectedClass.subjects.forEach((subject, index) => { subjectsGrid.innerHTML += `<div class="subject-input"><h4>${subject.name} (${subject.code})</h4><div class="manual-input-fields"><input type="number" id="manual_total_${index}" placeholder="Total Hours Held" min="0"><input type="number" id="manual_attended_${index}" placeholder="Hours Attended" min="0"></div></div>`; }); }
function calculateFromManual() {
    // Show calculate ad with skip delay
    if (window.AdManager) AdManager.showForCalculation();

    const attendanceData = [];
    if (!selectedClass) return;
    selectedClass.subjects.forEach((subject, index) => {
        const totalInput = document.getElementById(`manual_total_${index}`);
        const attendedInput = document.getElementById(`manual_attended_${index}`);

        if (totalInput && attendedInput) {
            const total = parseInt(totalInput.value) || 0;
            const attended = parseInt(attendedInput.value) || 0;

            if (total > 0 && attended <= total) {
                attendanceData.push({ ...subject, attended, totalHeld: total });
            }
        }
    });

    if (attendanceData.length > 0) calculateAttendance(attendanceData);
    else alert("Please enter valid data for at least one subject.");
}
function openPartialEntryModal(missedSubjects) { const grid = document.getElementById('partialSubjectsGrid'); grid.innerHTML = ''; missedSubjects.forEach(subject => { grid.innerHTML += `<div class="subject-input"><h4>${subject.name} (${subject.code})</h4><div class="manual-input-fields"><input type="number" id="partial_total_${subject.code}" placeholder="Total Hours Held" min="0"><input type="number" id="partial_attended_${subject.code}" placeholder="Hours Attended" min="0"></div></div>`; }); openModal('partialEntryModal'); }
function submitPartialEntry() {
    const grid = document.getElementById('partialSubjectsGrid');
    if (!grid) return;

    const newEntries = {};
    grid.querySelectorAll('.subject-input').forEach(inputDiv => {
        const codeMatch = inputDiv.querySelector('h4').textContent.match(/\(([^)]+)\)/);
        if (!codeMatch) return;

        const code = codeMatch[1];
        const totalInput = document.getElementById(`partial_total_${code}`);
        const attendedInput = document.getElementById(`partial_attended_${code}`);

        if (totalInput && attendedInput) {
            const total = parseInt(totalInput.value) || 0;
            const attended = parseInt(attendedInput.value) || 0;

            if (total > 0 && attended <= total) newEntries[code] = { total, present: attended };
        }
    });
    const mergedJson = { ...ocrResultsCache, ...newEntries };
    closeModal('partialEntryModal');
    processJsonAndCalculate(mergedJson);
}

function calculateFromJson() {
    // Show calculate ad with skip delay
    if (window.AdManager) AdManager.showForCalculation();

    const jsonInput = document.getElementById('attendanceJsonPasteArea');
    const jsonString = jsonInput ? jsonInput.value : '';

    if (!jsonString.trim()) {
        alert("Please paste the JSON data into the text area.");
        return;
    }
    try {
        const jsonData = JSON.parse(jsonString);
        if (typeof jsonData !== 'object' || jsonData === null || Array.isArray(jsonData)) {
            throw new Error("Invalid JSON format. Expected an object of subjects.");
        }
        processJsonAndCalculate(jsonData);
    } catch (error) {
        alert(`Error parsing JSON: ${error.message}`);
    }
}

function copyAttendanceAIPrompt() {
    const promptText = `Analyze the provided university attendance screenshot. Your task is to generate a single JSON object that maps subject codes to their attendance figures. Follow this structure precisely:

{
  "SUBJECT-CODE-1": { "total": TOTAL_CLASSES_HELD, "present": CLASSES_ATTENDED },
  "SUBJECT-CODE-2": { "total": TOTAL_CLASSES_HELD, "present": CLASSES_ATTENDED },
  ...
}

CRITICAL INSTRUCTIONS:
1.  The keys of the JSON object MUST be the exact subject codes as they appear in the screenshot.
2.  Each value MUST be an object containing two keys: "total" (for total classes held) and "present" (for classes attended).
3.  The values for "total" and "present" must be integers.
4.  Ensure that 'present' is always LESS THAN or EQUAL TO 'total'. If OCR suggests otherwise (e.g., Present: 12, Total: 10), assume an error and correct it logically (e.g., swap them or start with equal values).
5.  Provide ONLY the JSON code block in your response, with no extra text, explanations, or markdown formatting.`;
    navigator.clipboard.writeText(promptText).then(() => alert('AI prompt for attendance data copied to clipboard!'), () => alert('Failed to copy prompt.'));
}



// === NOTIFICATION FUNCTIONS ===
function openNotificationSettings() {
    // Require class selection for notification settings
    const className = document.getElementById('classSelector')?.value;
    if (!className || !classes[className]) {
        showToast('Please select a class first to configure notifications.', 'warning');
        return;
    }

    const modal = document.getElementById('notificationSettingsModal');
    // Use per-class notification settings
    const settings = JSON.parse(localStorage.getItem(`notificationSettings_${className}`) || '{"enabled":true,"time":"16:30"}');

    document.getElementById('notificationEnabled').checked = settings.enabled;
    document.getElementById('notificationTime').value = settings.time;
    document.getElementById('notificationTimeGroup').style.display = settings.enabled ? 'block' : 'none';

    // Display timezone info
    const now = new Date();
    const timezoneOffset = now.getTimezoneOffset();
    const timezoneOffsetHours = -timezoneOffset / 60;
    const isIST = timezoneOffsetHours === 5.5;
    const timezoneLabel = isIST ? 'IST (UTC+5:30)' : `UTC${timezoneOffsetHours >= 0 ? '+' : ''}${timezoneOffsetHours}`;

    const timezoneInfoEl = document.getElementById('timezoneInfo');
    if (timezoneInfoEl) {
        timezoneInfoEl.textContent = `Your timezone: ${timezoneLabel}${!isIST ? ' ⚠️ Not IST' : ''}`;
    }

    // Store which class we're configuring
    modal.dataset.className = className;

    // Update modal title to show class name
    const modalHeader = modal.querySelector('.modal-header h2');
    if (modalHeader) {
        modalHeader.innerHTML = `🔔 Notification Settings<br><small style="font-size:0.7em;opacity:0.8">for ${className}</small>`;
    }

    openModal('notificationSettingsModal');
}

function toggleNotifications(enabled) {
    if (enabled) {
        // Check if current date is within semester range
        const currentClass = localStorage.getItem('lastOpenedClass');
        if (currentClass) {
            const classesData = JSON.parse(localStorage.getItem('classes') || '{}');
            const classData = classesData[currentClass];

            if (classData && classData.lastDate) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const semesterEnd = new Date(classData.lastDate);
                semesterEnd.setHours(0, 0, 0, 0);

                // Only check if today is after last working date
                if (today > semesterEnd) {
                    alert(`⚠️ Cannot enable notifications.\n\nCurrent date is after the semester end date (${classData.lastDate}).\nPlease update your class's last working date.`);
                    document.getElementById('notificationEnabled').checked = false;
                    document.getElementById('notificationTimeGroup').style.display = 'none';
                    return;
                }
            }
        }
    }

    document.getElementById('notificationTimeGroup').style.display = enabled ? 'block' : 'none';
}

// Auto-enable notifications when portal mode is activated
async function autoEnableNotificationsForPortal() {
    // Check if notifications are already enabled
    const existingSettings = JSON.parse(localStorage.getItem('notificationSettings') || '{}');
    if (existingSettings.enabled) {
        console.log('Notifications already enabled, skipping auto-enable.');
        return;
    }

    // Check browser support
    if (!('Notification' in window)) {
        console.log('Browser does not support notifications.');
        return;
    }

    // Request permission
    let permission = Notification.permission;
    if (permission === 'default') {
        permission = await Notification.requestPermission();
    }

    if (permission !== 'granted') {
        console.log('Notification permission not granted.');
        return;
    }

    // Auto-enable with default time (4:30 PM)
    const defaultTime = '16:30';
    const settings = { enabled: true, time: defaultTime };
    localStorage.setItem('notificationSettings', JSON.stringify(settings));

    // Sync to IndexedDB for Service Worker
    try {
        const dbRequest = indexedDB.open('BunkitDB', 1);
        dbRequest.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('settings')) {
                db.createObjectStore('settings');
            }
        };
        dbRequest.onsuccess = (event) => {
            const db = event.target.result;
            const tx = db.transaction(['settings'], 'readwrite');
            const store = tx.objectStore('settings');
            store.put(settings, 'notificationSettings');
            store.delete('lastNotificationDate');

            // Notify SW to update/schedule
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({ type: 'SETTINGS_UPDATED' });
            }
        };
    } catch (error) {
        console.error('Error syncing notifications to IndexedDB:', error);
    }

    // Start notification checker
    startNotificationChecker();

    // Notify user
    alert(`🔔 Daily Notifications Enabled!\n\nYou'll receive daily reminders at ${defaultTime} to log your attendance.\n\nYou can change this time in Notification Settings from the menu.`);

    console.log('Notifications auto-enabled for Portal Mode.');
}

async function saveNotificationSettings() {
    try {
        const enabled = document.getElementById('notificationEnabled').checked;
        const time = document.getElementById('notificationTime').value;

        // Get the class name from the modal dataset OR fallback to selector
        const modal = document.getElementById('notificationSettingsModal');
        let className = modal.dataset.className;

        if (!className) {
            className = document.getElementById('classSelector')?.value;
            console.warn('Modal dataset.className missing, using selector value:', className);
        }

        if (!className) {
            alert('Error: No class selected. Please close and re-open the settings.');
            return;
        }

        console.log('Saving notification settings for class:', className, { enabled, time });

        if (enabled) {
            // FIRST: Check if current date is within semester range
            if (classes[className]) {
                const classData = classes[className];

                if (classData && classData.lastDate) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    const semesterEnd = new Date(classData.lastDate);
                    semesterEnd.setHours(0, 0, 0, 0);

                    // Only check if current date is after last working date
                    if (today > semesterEnd) {
                        showToast(`Cannot enable notifications. Current date is after the semester end date (${classData.lastDate}).`, 'error');
                        document.getElementById('notificationEnabled').checked = false;
                        return;
                    }
                }
            }

            // Request notification permission
            if (!('Notification' in window)) {
                showToast('This browser does not support notifications.', 'error');
                return;
            }

            const permission = await Notification.requestPermission();
            console.log('Notification permission:', permission);

            if (permission !== 'granted') {
                showToast('Notification permission denied. Please enable notifications in your browser settings.', 'error');
                document.getElementById('notificationEnabled').checked = false;
                return;
            }
        }

        const settings = { enabled, time };
        // Save per-class notification settings
        localStorage.setItem(`notificationSettings_${className}`, JSON.stringify(settings));

        // CRITICAL FIX: Smartly handle "Already Shown" flag
        const now = new Date();
        const [targetHour, targetMinute] = time.split(':').map(Number);
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        const targetTotalMinutes = targetHour * 60 + targetMinute;
        const currentTotalMinutes = currentHour * 60 + currentMinute;

        if (currentTotalMinutes >= targetTotalMinutes) {
            // Time has passed for today. Mark as shown so it doesn't fire immediately.
            localStorage.setItem('lastNotificationDate', now.toDateString());
            console.log('Target time passed for today. Marked as shown to prevent immediate trigger.');
        } else {
            // Time is in the future. Clear flag to ensure it fires today.
            localStorage.removeItem('lastNotificationDate');
            console.log('Target time is in future. Flag cleared to allow firing today.');
        }

        // Sync to IndexedDB for Service Worker
        try {
            const dbRequest = indexedDB.open('BunkitDB', 1);
            dbRequest.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings');
                }
            };
            dbRequest.onsuccess = (event) => {
                const db = event.target.result;
                const tx = db.transaction(['settings'], 'readwrite');
                const store = tx.objectStore('settings');

                // Store per-class notification settings
                store.put(settings, `notificationSettings_${className}`);

                // Also store all classes data for SW to check lastDate
                store.put(classes, 'classesData');

                // Clear the per-class notification shown flag
                store.delete(`lastNotificationDate_${className}`);

                console.log(`Settings for ${className} synced to IndexedDB.`);

                // Notify SW to update/schedule
                if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({
                        type: 'SETTINGS_UPDATED',
                        className: className
                    });
                }
            };

            // Sync with Cloud
            if (window.SyncManager) {
                SyncManager.uploadAll();
            }

        } catch (error) {
            console.error('Error syncing to IndexedDB:', error);
        }

        if (enabled) {
            startNotificationChecker();

            // Show test notification immediately
            if (Notification.permission === 'granted') {
                if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.ready.then(registration => {
                        registration.showNotification('✅ Notifications Enabled!', {
                            body: `You'll receive daily reminders at ${time}`,
                            icon: '/icon-192x192.png'
                        });
                    });
                } else {
                    new Notification('✅ Notifications Enabled!', {
                        body: `You'll receive daily reminders at ${time}`,
                        icon: '/icon-192x192.png'
                    });
                }
            }

            showToast(`Daily notifications enabled at ${time}!`, 'success');
            alert(`✅ Notifications enabled for ${time}!`);
        } else {
            stopNotificationChecker();
            showToast('Daily notifications disabled.', 'info');
            alert('🔕 Notifications disabled.');
        }

        closeModal('notificationSettingsModal');

    } catch (e) {
        console.error('Save Notification Settings Error:', e);
        showToast('Failed to save settings: ' + e.message, 'error');
    }
}

// === API SETTINGS FUNCTIONS ===
function openAPISettings() {
    const modal = document.getElementById('ocrSettingsModal');

    // Populate the modal content if it's empty
    if (!modal.innerHTML) {
        modal.innerHTML = `
                        <div class="modal-content">
                            <button class="modal-close" onclick="closeModal('ocrSettingsModal')">&times;</button>
                            <div class="modal-header">
                                <h2>🔑 API Settings</h2>
                                <p>Configure your Gemini API key for OCR and AI Assistant features</p>
                            </div>
                            <div class="form-group">
   <label for="personalGeminiKey">Personal Gemini API Key</label>
                                <input type="text" id="personalGeminiKey" placeholder="Optional: Enter your Gemini API key">
                                <p style="font-size:  0.85rem; color: var(--medium-text); margin-top: 5px;">
                                    Get your free 10,000 requests/day Gemini API key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio</a>
                                </p>
                            </div>
                            <div id="personalQuotaStatus" style="display: none; margin-top: 10px; padding: 10px; background: var(--light-bg); border-radius: 8px;">
                                <p style="font-size: 0.9rem; margin: 0;">
                                    ⏱️ Personal Quota Used Today: <strong id="personalQuotaCount">0/10000</strong>
                                </p>
                            </div>
                            <div style="text-align: center; margin-top: 20px;">
                                <button class="btn primary-btn" onclick="saveAPISettings()">Save Settings</button>
                                <button class="btn secondary-btn" onclick="testPersonalKey()">Test API Key</button>
                            </div>
                        </div>
                    `;
    }

    // Load saved settings
    const personalKey = localStorage.getItem('personalGeminiKey') || '';
    const personalKeyInput = document.getElementById('personalGeminiKey');
    if (personalKeyInput) {
        personalKeyInput.value = personalKey;
    }

    // Update quota display
    if (typeof updateOCRQuotaDisplay === 'function') {
        updateOCRQuotaDisplay();
    }

    openModal('ocrSettingsModal');
}

let notificationInterval = null;



function startNotificationChecker() {
    stopNotificationChecker(); // Clear any existing interval

    console.log('🎯 Starting notification checker...');

    // Check every minute
    notificationInterval = setInterval(checkAndShowNotification, 60000);
    console.log('⏱️ Interval set for every 60 seconds');

    // Check immediately
    checkAndShowNotification();
}

function stopNotificationChecker() {
    if (notificationInterval) {
        clearInterval(notificationInterval);
        notificationInterval = null;
    }
}

// In-App Toast Notification
function showToast(title, message, options = {}) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';

    const icon = options.icon || '🔔';
    const actionText = options.actionText || 'Log Now';
    const onAction = options.onAction || (() => { });
    const duration = options.duration || 8000;

    toast.innerHTML = `
                    <span class="toast-icon"></span>
                    <div class="toast-content">
                        <div class="toast-title"></div>
                        <div class="toast-message"></div>
                    </div>
                    <button class="toast-action"></button>
                    <button class="toast-close">&times;</button>
                `;

    // Securely set content
    toast.querySelector('.toast-icon').textContent = icon;
    toast.querySelector('.toast-title').textContent = title;
    toast.querySelector('.toast-message').textContent = message;
    toast.querySelector('.toast-action').textContent = actionText;

    container.appendChild(toast);

    // Action button click
    toast.querySelector('.toast-action').addEventListener('click', () => {
        onAction();
        dismissToast(toast);
    });

    // Close button click
    toast.querySelector('.toast-close').addEventListener('click', () => {
        dismissToast(toast);
    });

    // Auto-dismiss after duration
    setTimeout(() => dismissToast(toast), duration);
}

function dismissToast(toast) {
    if (!toast || toast.classList.contains('hide')) return;
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 300);
}

// 🎉 Celebration Confetti Animation
function celebrateAchievement(type = 'default') {
    if (typeof confetti !== 'function') {
        console.log('Confetti not loaded');
        return;
    }

    const configs = {
        'default': {
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
        },
        'attendance-safe': {
            particleCount: 150,
            spread: 100,
            colors: ['#22c55e', '#16a34a', '#15803d'],
            origin: { y: 0.6 }
        },
        'perfect-attendance': {
            particleCount: 200,
            spread: 120,
            colors: ['#ffd700', '#ffed4a', '#f59e0b'],
            origin: { y: 0.5 },
            scalar: 1.2
        },
        'goal-reached': {
            particleCount: 100,
            angle: 60,
            spread: 55,
            origin: { x: 0 }
        },
        'streak': {
            particleCount: 50,
            spread: 60,
            colors: ['#8b5cf6', '#a78bfa', '#c4b5fd']
        }
    };

    const config = configs[type] || configs['default'];
    confetti(config);

    // For goal-reached, fire from both sides
    if (type === 'goal-reached') {
        setTimeout(() => {
            confetti({
                ...config,
                angle: 120,
                origin: { x: 1 }
            });
        }, 150);
    }
}

// 📲 Share Attendance Summary on WhatsApp
function shareOnWhatsApp() {
    // Calculate overall and subject-wise attendance
    let totalPresent = 0;
    let totalClasses = 0;
    let summaryLines = [];

    for (const className in classes) {
        const classData = classes[className];
        const present = classData.subjects.reduce((sum, s) => sum + (s.present || 0), 0);
        const total = classData.subjects.reduce((sum, s) => sum + (s.total || 0), 0);

        if (total > 0) {
            const percentage = ((present / total) * 100).toFixed(1);
            totalPresent += present;
            totalClasses += total;

            // Add class summary
            const emoji = percentage >= 75 ? '✅' : percentage >= 65 ? '⚠️' : '❌';
            summaryLines.push(`${emoji} ${className}: ${percentage}%`);
        }
    }

    const overallPercentage = totalClasses > 0
        ? ((totalPresent / totalClasses) * 100).toFixed(1)
        : 0;

    // Create WhatsApp message
    const message = `📊 *My Attendance Summary* - Bunk it

📈 *Overall: ${overallPercentage}%*

${summaryLines.join('\n')}

📅 Updated: ${new Date().toLocaleDateString('en-IN')}

📱 Track your attendance: https://bunkitapp.in`;

    // Open WhatsApp with pre-filled message
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
}

// Share specific class attendance
function shareClassOnWhatsApp(className) {
    const classData = classes[className];
    if (!classData) return;

    let subjectLines = [];
    let totalPresent = 0;
    let totalClasses = 0;

    classData.subjects.forEach(subject => {
        const present = subject.present || 0;
        const total = subject.total || 0;
        totalPresent += present;
        totalClasses += total;

        if (total > 0) {
            const percentage = ((present / total) * 100).toFixed(1);
            const emoji = percentage >= 75 ? '✅' : percentage >= 65 ? '⚠️' : '❌';
            subjectLines.push(`${emoji} ${subject.name}: ${percentage}% (${present}/${total})`);
        }
    });

    const overallPercentage = totalClasses > 0
        ? ((totalPresent / totalClasses) * 100).toFixed(1)
        : 0;

    const message = `📚 *${className} - Attendance*

📈 *Overall: ${overallPercentage}%*

${subjectLines.join('\n')}

📅 Updated: ${new Date().toLocaleDateString('en-IN')}

📱 Track attendance: https://bunkitapp.in`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
}

function checkAndShowNotification() {
    const checkTime = new Date().toLocaleString();
    localStorage.setItem('lastNotificationCheck', checkTime);
    console.log('🔔 ========== NOTIFICATION CHECK START ==========');
    console.log('🔔 Check Time:', checkTime);

    const now = new Date();
    const today = formatLocalDate(now);
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTotalMinutes = currentHour * 60 + currentMinute;

    // Get timezone info
    const timezoneOffset = now.getTimezoneOffset();
    const timezoneOffsetHours = -timezoneOffset / 60;
    const isIST = timezoneOffsetHours === 5.5;
    console.log(`⏰ Timezone: ${isIST ? 'IST' : 'UTC' + (timezoneOffsetHours >= 0 ? '+' : '') + timezoneOffsetHours}`);

    // Loop through all classes and check each one's notification settings
    let notificationShown = false;
    for (const className in classes) {
        if (!classes.hasOwnProperty(className)) continue;

        const classData = classes[className];
        const settings = JSON.parse(localStorage.getItem(`notificationSettings_${className}`) || '{"enabled":true,"time":"16:30"}');

        console.log(`🔔 Checking class: ${className}`, settings);

        // Skip if notifications disabled for this class
        if (!settings.enabled) {
            console.log(`  ❌ ${className}: Notifications disabled`);
            continue;
        }

        // Skip if class has ended (today > lastDate)
        if (classData.lastDate && today > classData.lastDate) {
            console.log(`  ⏭️ ${className}: Class ended (${classData.lastDate})`);
            continue;
        }

        // Check if current time matches this class's notification time
        const [targetHour, targetMinute] = settings.time.split(':').map(Number);
        const targetTotalMinutes = targetHour * 60 + targetMinute;

        if (currentTotalMinutes >= targetTotalMinutes) {
            // Check if already shown for this class today
            const lastShownKey = `lastNotificationDate_${className}`;
            const lastShown = localStorage.getItem(lastShownKey);

            if (lastShown !== now.toDateString()) {
                console.log(`  ✅ ${className}: Time to notify! (${settings.time})`);

                // Set this class as last opened so notification shows for it
                localStorage.setItem('lastOpenedClass', className);

                // Show system notification (works in background too)
                showDailyLogNotification();

                // Show in-app toast notification (only when app is in foreground)
                showToast(
                    '📚 Attendance Reminder',
                    `Time to log today's attendance for ${className}!`,
                    {
                        icon: '📝',
                        actionText: 'Log Now',
                        duration: 10000,
                        onAction: () => {
                            // Select this class and open log modal
                            document.getElementById('classSelector').value = className;
                            onClassChange();
                            openLogModal();
                        }
                    }
                );

                localStorage.setItem(lastShownKey, now.toDateString());
                notificationShown = true;

                // Only show one notification at a time to avoid spam
                break;
            } else {
                console.log(`  ⏭️ ${className}: Already shown today`);
            }
        } else {
            console.log(`  ⏳ ${className}: Not time yet (current: ${currentTotalMinutes}, target: ${targetTotalMinutes})`);
        }
    }

    if (!notificationShown) {
        console.log('🔔 No notifications triggered this check');
    }
    console.log('🔔 ========== NOTIFICATION CHECK END ==========');
}


// Diagnostic test function
async function testNotificationNow() {
    console.log('🧪 === NOTIFICATION DIAGNOSTIC TEST ===');

    // Test 1: Browser Support
    if (!('Notification' in window)) {
        alert('❌ FAILED: Your browser does not support notifications');
        console.error('❌ No Notification API support');
        return;
    }
    console.log('✅ Browser supports notifications');

    // Test 2: Permission Status
    console.log(`📋 Current permission: ${Notification.permission}`);

    if (Notification.permission === 'denied') {
        alert('❌ FAILED: Notifications are blocked.\n\nPlease enable notifications in your browser settings:\n- Click the lock/info icon in address bar\n- Change notifications to "Allow"');
        return;
    }

    if (Notification.permission === 'default') {
        console.log('📣 Requesting permission...');
        const permission = await Notification.requestPermission();
        console.log(`📋 Permission after request: ${permission}`);

        if (permission !== 'granted') {
            alert('❌ FAILED: Permission denied');
            return;
        }
    }

    console.log('✅ Permission granted');

    // Test 3: Show test notification
    // Test 3: Show test notification
    try {
        console.log('🚀 Creating test notification...');
        if ('serviceWorker' in navigator) {
            console.log('⚙️ Checking Service Worker registration...');
            const registration = await navigator.serviceWorker.getRegistration();

            if (!registration) {
                throw new Error('Service Worker not registered! Please reload the page.');
            }

            console.log('✅ Service Worker found:', registration.scope);

            // Check if active
            if (!registration.active) {
                console.warn('⚠️ Service Worker found but not active yet.');
            }

            await registration.showNotification('🧪 Test Notification', {
                body: 'If you see this, notifications are working!',
                icon: '/icon-192x192.png',
                badge: '/notification-icon.png',
                tag: 'test',
                requireInteraction: false
            });
            console.log('✅ Test notification dispatched via Service Worker');
        } else {
            new Notification('🧪 Test Notification', {
                body: 'If you see this, notifications are working!',
                icon: '/icon-192x192.png',
                badge: '/notification-icon.png',
                tag: 'test',
                requireInteraction: false
            });
        }

        console.log('✅ Test notification created successfully!');
        alert('✅ SUCCESS!\n\nIf you don\'t see a notification, check:\n1. System notification settings (Windows/Mac)\n2. Browser notification settings\n3. Do Not Disturb mode');

    } catch (error) {
        console.error('❌ Error creating notification:', error);
        alert(`❌ FAILED: ${error.message}`);
    }

    // Test 4: Check if notification checker is running
    const settings = JSON.parse(localStorage.getItem('notificationSettings') || '{"enabled":true}');
    console.log('📋 Notification settings:', settings);
    console.log(`📋 Notification interval active: ${notificationInterval !== null}`);
}

async function showDailyLogNotification() {
    console.log('📢 ========== showDailyLogNotification CALLED ==========');
    const lastClass = localStorage.getItem('lastOpenedClass');
    const className = lastClass || 'your class';

    // Check if class has ended (today > lastDate)
    if (lastClass && classes[lastClass]) {
        const classData = classes[lastClass];
        const today = formatLocalDate(new Date());
        if (classData.lastDate && today > classData.lastDate) {
            console.log('⏭️ BLOCKED: Class has ended (today:', today, '> lastDate:', classData.lastDate, ')');
            return; // Don't show notification for ended class
        }
    }

    console.log('📢 Permission status:', Notification.permission);

    if (Notification.permission !== 'granted') {
        console.error('❌ FAILED: Notification permission not granted!');
        alert('Notification permission not granted. Please enable notifications.');
        return;
    }

    try {
        if ('serviceWorker' in navigator) {
            console.log('📢 Using Service Worker for notification...');
            const registration = await navigator.serviceWorker.ready;

            if (!registration) {
                throw new Error('Service Worker not ready');
            }

            console.log('📢 SW Ready, showing notification...');
            await registration.showNotification('📚 Attendance Log Reminder', {
                body: `Time to log today's attendance for ${className}!`,
                icon: '/icon-192x192.png',
                badge: '/badge-icon.png',
                tag: 'daily-log',
                requireInteraction: true,
                data: { url: '/?openLog=true' }
            });
            console.log('✅ Notification shown successfully via SW!');
        } else {
            console.log('📢 Using legacy Notification API...');
            const notification = new Notification('📚 Attendance Log Reminder', {
                body: `Time to log today's attendance for ${className}!`,
                icon: '/icon-192x192.png',
                badge: '/badge-icon.png',
                tag: 'daily-log',
                requireInteraction: true
            });
            notification.onclick = function () {
                window.focus();
                notification.close();
                if (lastClass && classes[lastClass]) {
                    document.getElementById('classSelector').value = lastClass;
                    onClassChange();
                }
            };
            console.log('✅ Notification shown successfully via legacy API!');
        }
    } catch (error) {
        console.error('❌ ERROR showing notification:', error);
        alert(`Failed to show notification: ${error.message}\n\nPlease check:\n1. Windows notification settings\n2. Browser notification permissions\n3. Do Not Disturb / Focus Assist mode`);
    }
    console.log('📢 ========== showDailyLogNotification END ==========');
}



// ==================== WIZARD & ADD CLASS HELPERS ====================

async function importClassFromJson() {
    const jsonText = document.getElementById('importJsonTextarea').value.trim();
    if (!jsonText) { alert("Please paste JSON code first."); return; }

    try {
        const data = JSON.parse(jsonText);
        // Support both formats: Wrapped export and direct data
        let className, classData;

        if (data.type === 'class_export' && data.className && data.data) {
            className = data.className;
            classData = data.data;
        } else if (Object.keys(data).length === 1 && typeof Object.values(data)[0] === 'object' && Object.values(data)[0].subjects) {
            // Likely direct export { "ClassName": { ... } }
            className = Object.keys(data)[0];
            classData = data[className];
        } else {
            throw new Error("Invalid class export format. Pasted JSON must be a valid Bunkit export.");
        }

        // Validate essential data
        if (!className || !classData.subjects || !Array.isArray(classData.subjects)) {
            throw new Error("Invalid class data: missing class name or subjects array.");
        }

        // Normalize subject shortNames (fix missing/undefined)
        classData.subjects.forEach(sub => {
            if (!sub.shortName || sub.shortName === 'undefined') {
                sub.shortName = sub.code || sub.name.substring(0, 3).toUpperCase();
            }
        });

        // Apply default values for optional fields
        classData.holidays = classData.holidays || [];
        classData.periodTimes = classData.periodTimes || {};
        classData.portalSetup = classData.portalSetup || {};
        classData.lastDate = classData.lastDate || formatLocalDate(new Date());

        // Smart duplicate detection (matches importClassFromURL logic)
        let finalName = className;
        const dupResult = checkClassDuplicate(className, classData);

        if (dupResult.status === 'exact_duplicate') {
            // XSS-safe alert
            const safeName = className.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            alert(`⚠️ Class "${safeName}" already exists with identical schedule!`);
            return;
        } else if (dupResult.status === 'name_conflict') {
            // Different data, same name - offer options
            const safeName = className.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const choice = confirm(`Class "${safeName}" exists with different data.\n\nClick OK to create "${dupResult.suggestedName}"\nClick Cancel to overwrite existing class`);
            if (choice) {
                finalName = dupResult.suggestedName;
            }
            // else: overwrite existing
        }

        // Import class using global classes object (not raw localStorage)
        classes[finalName] = {
            lastDate: classData.lastDate,
            subjects: classData.subjects,
            holidays: classData.holidays,
            periodTimes: classData.periodTimes,
            portalSetup: classData.portalSetup,
            updatedAt: Date.now() // Mark for sync
        };

        // Save timetable arrangement if present (CRITICAL - was missing!)
        if (classData.timetable && Object.keys(classData.timetable).length > 0) {
            localStorage.setItem(`timetable_arrangement_${finalName}`, JSON.stringify(classData.timetable));
        }

        // Use saveToStorage for proper sync trigger (not raw localStorage)
        if (typeof saveToStorage === 'function') {
            saveToStorage();
        } else {
            localStorage.setItem('attendanceClasses_v2', JSON.stringify(classes));
        }

        // XSS-safe success message
        const safeFinalName = finalName.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        showToast(`✅ Class "${safeFinalName}" imported successfully!`, 'success');

        closeModal('addClassModal');
        populateClassSelector();

        // Select the imported class
        const selector = document.getElementById('classSelector');
        if (selector) {
            selector.value = finalName;
            if (typeof handleDropdownChange === 'function') handleDropdownChange();
        }

    } catch (e) {
        console.error('JSON Import Error:', e);
        const safeError = e.message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        alert("❌ Import failed: " + safeError);
    }
}

function switchModalTab(tab) {
    const formTab = document.getElementById('modalTab-form');
    const jsonTab = document.getElementById('modalTab-json');
    const formBtn = document.getElementById('tabBtn-form');
    const jsonBtn = document.getElementById('tabBtn-json');

    if (formTab) formTab.style.display = tab === 'form' ? 'flex' : 'none';
    if (jsonTab) jsonTab.style.display = tab === 'json' ? 'flex' : 'none';

    if (formBtn) formBtn.style.borderBottomColor = tab === 'form' ? 'var(--primary-color)' : 'transparent';
    if (jsonBtn) jsonBtn.style.borderBottomColor = tab === 'json' ? 'var(--primary-color)' : 'transparent';
}

function handleWizardNext() {
    if (wizardCurrentStep < 3) {
        wizardGoToStep(wizardCurrentStep + 1);
        const btn = document.getElementById('wizNextBtn');
        if (btn) btn.innerHTML = wizardCurrentStep === 3 ? 'Finish ✅' : 'Next ➡';
    } else {
        submitClassFromWizard();
    }
}

function openWelcomeModal() {
    // SAFETY LOCK: User requested "NO ONBOARDING MODAL".
    // Unless we explicitly flag it, this should NEVER open.
    if (!window.explicitWelcomeAllowed) {
        console.log('🚫 openWelcomeModal blocked by Safety Lock.');
        return;
    }
    const modal = document.getElementById('welcomeModal');
    modal.innerHTML = `
                <div class="modal-content" style="max-width: 450px; text-align: center;">
                    <div class="modal-header" style="justify-content: center;"><h2>🎉 Welcome to Bunk it!</h2></div>
                    <p style="color: var(--medium-text); margin-bottom: 20px;">Let's get your attendance sorted. How would you like to start?</p>
                    
                    <div style="display: grid; gap: 12px;">
                         <button class="btn primary-btn" onclick="closeModal('welcomeModal'); openAddClassModal()" style="padding: 15px;">
                            📝 <strong>Manual Entry</strong><br><span style="font-size:0.8rem; font-weight:normal;">Fill form manually</span>
                        </button>
                        
                        <button class="btn secondary-btn" onclick="closeModal('welcomeModal'); openAddClassModal(); setTimeout(() => switchModalTab('aiImport'), 100);" style="padding: 15px; border: 2px solid var(--primary-color); color: var(--primary-color);">
                            ✨ <strong>Inbuilt AI Import</strong><br><span style="font-size:0.8rem; font-weight:normal;">Upload Timetable/Screenshots</span>
                        </button>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                             <button class="btn secondary-btn" onclick="closeModal('welcomeModal'); openAddClassModal(); setTimeout(() => switchModalTab('scan'), 100);">
                                📷 Scan QR
                            </button>
                             <button class="btn secondary-btn" onclick="closeModal('welcomeModal'); openAddClassModal(); setTimeout(() => switchModalTab('json'), 100);">
                                📂 Import JSON
                            </button>
                        </div>
                    </div>
                    <p style="margin-top: 20px; font-size: 0.8rem; color: var(--medium-text);">Data is saved locally and synced if you sign in.</p>
                </div>`;
    openModal('welcomeModal');
}

// NOTE: addClassModalHTML is defined earlier in initializeApp() with 4 tabs
// The duplicate 2-tab definition was removed to fix the modal display issue

const FALLBACK_CLASS_MODAL_HTML = `
                <div class="modal-content">
                    <button class="modal-close" onclick="closeModal('addClassModal')">&times;</button>
                    <div class="modal-header"><h2 id="addClassModalTitle"></h2></div>
                    <div class="modal-tabs">
                        <button id="formTabBtn" class="active" onclick="switchModalTab('form')">Form Entry</button>
                        <button id="aiImportTabBtn" onclick="switchModalTab('aiImport')">✨ Inbuilt AI Import</button>
                        <button id="jsonTabBtn" onclick="switchModalTab('json')">Import from JSON</button>
                        <button id="scanTabBtn" onclick="switchModalTab('scan')">Scan QR</button>
                        <button id="shareTabBtn" onclick="switchModalTab('share')" style="display: none;">Share Class</button>
                    </div>
                    
                    <div id="formEntryTab">
                        <!-- Wizard Progress Steps -->
                        <div class="wizard-progress" style="display: flex; justify-content: center; margin-bottom: 20px; gap: 5px;">
                            <div class="wizard-step active" id="wizStep1Indicator" style="display: flex; align-items: center; gap: 5px; padding: 8px 15px; border-radius: 20px; background: var(--primary-color); color: white; font-size: 0.85rem;">
                                <span style="width: 22px; height: 22px; border-radius: 50%; background: white; color: var(--primary-color); display: flex; align-items: center; justify-content: center; font-weight: bold;">1</span>
                                Basic Info
                            </div>
                            <div class="wizard-step" id="wizStep2Indicator" style="display: flex; align-items: center; gap: 5px; padding: 8px 15px; border-radius: 20px; background: var(--light-bg); color: var(--medium-text); font-size: 0.85rem;">
                                <span style="width: 22px; height: 22px; border-radius: 50%; background: var(--border-color); color: var(--medium-text); display: flex; align-items: center; justify-content: center; font-weight: bold;">2</span>
                                Subjects
                            </div>
                            <div class="wizard-step" id="wizStep3Indicator" style="display: flex; align-items: center; gap: 5px; padding: 8px 15px; border-radius: 20px; background: var(--light-bg); color: var(--medium-text); font-size: 0.85rem;">
                                <span style="width: 22px; height: 22px; border-radius: 50%; background: var(--border-color); color: var(--medium-text); display: flex; align-items: center; justify-content: center; font-weight: bold;">3</span>
                                Timetable
                            </div>
                        </div>

                        <!-- Step 1: Basic Info -->
                        <div id="wizardStep1" class="wizard-step-content">
                            <div class="form-group">
                                <label for="newClassName">Class Name *</label>
                                <input type="text" id="newClassName" placeholder="e.g., CSE Core - H">
                            </div>
                            <div class="form-group">
                                <label for="newClassStartDate">Semester Start Date (Optional)</label>
                                <input type="date" id="newClassStartDate">
                                <p style="font-size: 0.8rem; color: var(--medium-text); margin-top: 4px;">For Portal Mode & Medical Certificate. Can set later in Portal Setup.</p>
                            </div>
                            <div class="form-group">
                                <label for="newClassLastDate">Last Working Date *</label>
                                <input type="date" id="newClassLastDate">
                            </div>
                            <div class="form-group">
                                <label for="wizPeriodCount">Periods per Day *</label>
                                <input type="number" id="wizPeriodCount" min="1" max="12" value="8" placeholder="e.g., 8">
                            </div>
                            <div style="display: flex; justify-content: flex-end; margin-top: 15px;">
                                <button class="btn primary-btn" onclick="wizardGoToStep(2)">Next →</button>
                            </div>
                        </div>

                        <!-- Step 2: Subject Details -->
                        <div id="wizardStep2" class="wizard-step-content" style="display: none;">
                            <p style="color: var(--medium-text); font-size: 0.9rem; margin-bottom: 15px;">
                                Enter the name and code for each subject. Subject codes should match your college portal (e.g., 21CSC201J).
                            </p>
                            <div id="wizSubjectsContainer" style="max-height: 350px; overflow-y: auto;"></div>
                            <button type="button" class="btn secondary-btn" onclick="addWizardSubject()" style="width: 100%; margin-top: 10px; border: 2px dashed var(--border-color); background: transparent; color: var(--primary-color); font-weight: 600;">＋ Add Subject</button>
                            <div style="display: flex; justify-content: space-between; margin-top: 15px;">
                                <button class="btn secondary-btn" onclick="wizardGoToStep(1)">← Back</button>
                                <button class="btn primary-btn" onclick="wizardGoToStep(3)">Next →</button>
                            </div>
                        </div>

                        <!-- Step 3: Timetable Grid -->
                        <div id="wizardStep3" class="wizard-step-content" style="display: none;">
                            <p style="color: var(--medium-text); font-size: 0.9rem; margin-bottom: 15px;">
                                Assign subjects to each period. Leave as "Free" if no class is scheduled.
                            </p>
                            <div id="wizTimetableGrid" style="overflow-x: auto; max-height: 400px; overflow-y: auto;"></div>
                            
                            <div class="holiday-section" style="margin-top: 15px;">
                                <label>Holidays (Optional)</label>
                                <ul id="holidayList" style="max-height: 100px; overflow-y: auto;"></ul>
                                <div class="add-holiday-form">
                                    <input type="date" id="newHolidayDate">
                                    <button type="button" class="add-holiday-btn" onclick="addHolidayToModal()">Add Holiday</button>
                                </div>
                            </div>
                            
                            <div style="display: flex; justify-content: space-between; margin-top: 15px;">
                                <button class="btn secondary-btn" onclick="wizardGoToStep(2)">← Back</button>
                                <button class="btn success-btn" onclick="submitClassFromWizard()">💾 Save Class</button>
                            </div>
                        </div>
                    </div>

                    <div id="aiImportEntryTab" style="display: none;">
                        <div class="json-instructions">
                            <strong>🤖 Inbuilt AI Import:</strong>
                            <p>Upload your <strong>Timetable</strong>, <strong>Attendance Screenshot</strong>, or any other class details. The AI will read them and fill out the form for you!</p>
                        </div>
                        
                        <div class="form-group">
                            <label>1. Upload Files (Images/Screenshots):</label>
                            <div style="border: 2px dashed #ccc; border-color: var(--border-color, #ccc); padding: 20px; text-align: center; border-radius: 8px; cursor: pointer; background: rgba(0,0,0,0.02);" onclick="document.getElementById('aiImportFiles').click()">
                                <span style="font-size: 2rem;">📂</span><br>
                                <span style="color: #666; color: var(--medium-text, #666);">Click to upload Timetable, Attendance, etc.</span>
                            </div>
                            <input type="file" id="aiImportFiles" multiple accept="image/*" style="display: none;" onchange="updateAIFileCount(this)">
                            <div id="aiFileCount" style="margin-top: 5px; font-size: 0.9rem; color: var(--success-grad-start);"></div>
                        </div>

                        <div class="form-group">
                            <label>2. Additional Details (Optional):</label>
                            <textarea id="aiImportText" placeholder="e.g., Last working day is Dec 20, 2025. Holidays are Aug 15, Oct 2." style="min-height: 80px;"></textarea>
                        </div>

                        <div id="aiImportLoading" style="display: none; text-align: center; margin: 20px 0;">
                            <div class="spinner"></div>
                            <p>🤖 AI is analyzing your files...<br>This may take a few seconds.</p>
                        </div>

                        <button class="btn primary-btn" onclick="handleAIClassImport()" style="width: 100%;">✨ Run Inbuilt AI Import</button>
                    </div>

                    <div id="jsonEntryTab" style="display: none;">
                        <div class="json-instructions">
                            <strong>How to use:</strong>
                            <ol>
                                <li>Click the button below to copy the AI prompt.</li>
                                <li>Paste it into an AI Chat (like Gemini, ChatGPT).</li>
                                <li>Attach your <strong>timetable screenshot</strong> AND your <strong>attendance details screenshot</strong>. Provide <strong>your holiday list</strong> and <strong>last working date</strong>.</li>
                                <li>The AI will generate a JSON code block. Copy it.</li>
                                <li>Paste the entire JSON code into the text box below and click Save.</li>
                            </ol>
                        </div>
                        <button class="btn secondary-btn" onclick="copyAIPrompt()" style="width: 100%; margin-bottom: 15px;">📋 Copy Prompt for AI</button>
                        <div class="form-group">
                            <label for="jsonPasteArea">Paste JSON here:</label>
                            <textarea id="jsonPasteArea" placeholder='{ "Your Class Name": { "lastDate": "...", "holidays": [...], "subjects": [...] } }'></textarea>
                        </div>
                    </div>

                    <div id="scanEntryTab" style="display: none;">
                        <div class="json-instructions">
                            <strong>Scan Class QR Code:</strong>
                            <p>Point your camera at a shared class QR code to import it instantly.</p>
                        </div>
                         <!-- File Upload Option -->
                        <div style="margin-bottom: 20px; text-align: center;">
                            <input type="file" id="qrInputFileTab" accept="image/*" style="display: none;" onchange="handleQRFileUploadInTab(this)">
                            <button class="btn secondary-btn" onclick="document.getElementById('qrInputFileTab').click()">📂 Upload QR Image</button>
                        </div>
                        <div id="readerTab" style="width: 100%; min-height: 300px;"></div>
                    </div>

                    <div id="shareEntryTab" style="display: none;">
                        <div class="modal-header" style="text-align: center; margin-bottom: 20px;">
                            <h2>📤 Share Class</h2>
                            <p>Scan this QR code to import this class setup on another device.</p>
                        </div>
                        <div id="qrcodeTab" style="display: inline-block; padding: 20px; background: white; margin: 20px auto; display: flex; justify-content: center;"></div>
                        <p style="font-size: 0.9rem; color: var(--medium-text); margin-bottom: 20px; text-align: center;">Includes subjects and holidays. Does not include your personal attendance logs.</p>
                        <div style="display: flex; gap: 10px; justify-content: center;">
                            <button class="btn success-btn" onclick="shareClassLinkFromTab()">🔗 Share via App Link</button>
                            <button class="btn secondary-btn" onclick="downloadQRImageTab()">⬇️ Download QR</button>
                        </div>
                    </div>

                    <div class="form-actions" id="modalFormActions">
                        <button class="btn primary-btn" id="modalSaveBtn" onclick="submitClassForm()">Save Class</button>
                        <button class="btn secondary-btn" onclick="closeModal('addClassModal')">Cancel</button>
                    </div>
                </div>`;

function openAddClassModal(className = null) {
    // SINGLE CLASS RESTRICTION
    if (!className) { // Only check when adding NEW class
        const count = Object.keys(window.classes || {}).length;
        if (count > 0) {
            alert("⚠️ Single Class Limit\n\nYou already have a class. You can only manage one class at a time.");
            return;
        }
    }
    // SAFETY LOCK: Don't open if Auth is currently initializing (Too Early)
    if (window.AuthManager && !window.AuthManager.isReady) {
        console.warn('🚫 openAddClassModal blocked: Auth Initializing.');
        return;
    }
    const modal = document.getElementById('addClassModal');

    // LAZY LOAD FIX: Ensure modal content exists
    if (modal && !modal.innerHTML.trim()) {
        modal.innerHTML = (typeof addClassModalHTML !== 'undefined' ? addClassModalHTML : FALLBACK_CLASS_MODAL_HTML);
    }

    const title = document.getElementById('addClassModalTitle');
    const shareTabBtn = document.getElementById('shareTabBtn');

    editingClassName = className;
    switchModalTab('form');

    // Reset wizard state
    wizardCurrentStep = 1;
    wizardSubjectsData = [];
    wizardTimetableData = {};

    // Reset wizard step visibility
    const step1 = document.getElementById('wizardStep1');
    const step2 = document.getElementById('wizardStep2');
    const step3 = document.getElementById('wizardStep3');
    if (step1) step1.style.display = 'block';
    if (step2) step2.style.display = 'none';
    if (step3) step3.style.display = 'none';
    updateWizardIndicators(1);

    const jsonTabBtn = document.getElementById('jsonTabBtn');

    if (className && classes[className]) {
        // Edit Mode
        if (title) title.textContent = '📝 Edit Class';
        const classData = classes[className];

        // Initialize wizard with existing data
        initializeWizardForEdit(classData, className);

        if (jsonTabBtn) jsonTabBtn.style.display = 'none';
        if (shareTabBtn) shareTabBtn.style.display = 'inline-block';
    } else {
        // Add Mode
        if (title) title.textContent = '➕ Add New Class';
        const nameEl = document.getElementById('newClassName');
        const dateEl = document.getElementById('newClassLastDate');
        const periodCountEl = document.getElementById('wizPeriodCount');
        if (nameEl) nameEl.value = '';
        if (dateEl) dateEl.value = '';
        if (document.getElementById('newClassStartDate')) document.getElementById('newClassStartDate').value = '';
        if (periodCountEl) periodCountEl.value = '8';
        if (typeof populateHolidaysInModal === 'function') populateHolidaysInModal([]);

        if (jsonTabBtn) jsonTabBtn.style.display = 'block';
        if (shareTabBtn) shareTabBtn.style.display = 'none';
    }
    openModal('addClassModal');
}
function openImportModal() { openAddClassModal(); setTimeout(() => switchModalTab('json'), 50); }

function openDonateModal() {
    const modal = document.getElementById('donateModal');
    modal.innerHTML = `
                <div class="modal-content" style="max-width: 500px; text-align: center;">
                    <button class="modal-close" onclick="closeModal('donateModal')">&times;</button>
                    <div class="modal-header" style="padding-bottom: 10px;">
                        <h2>☕ Support the Developer</h2>
                        <p style="font-size: 0.95rem; color: var(--medium-text);">Help keep Bunk it free forever!</p>
                    </div>
                    
                    <div class="donate-message-box" style="background: var(--card-bg); padding: 20px; border-radius: 12px; margin-bottom: 20px; border: 2px solid var(--secondary-grad-start); box-shadow: 0 4px 15px rgba(79, 172, 254, 0.15);">
                        <p style="font-size: 1rem; color: var(--dark-text); margin-bottom: 15px; line-height: 1.6;">
                            Hey there! 👋 I'm a solo developer building this app in my free time to help students manage their attendance better.
                        </p>
                        <p style="font-size: 0.95rem; color: var(--dark-text); margin-bottom: 15px; line-height: 1.6;">
                            Your support helps me:
                        </p>
                        <ul style="text-align: left; font-size: 0.9rem; color: var(--dark-text); padding-left: 25px; margin-bottom: 10px; line-height: 1.8;">
                            <li>💰 Cover API costs (AI, OCR, cloud services)</li>
                            <li>🚫 Keep the app <strong>100% ad-free</strong></li>
                            <li>☁️ Add cloud sync & user accounts</li>
                            <li>🔐 Implement secure data backup</li>
                            <li>✨ Build more useful features!</li>
                        </ul>
                    </div>
                    
                    <div style="background: var(--light-bg); padding: 20px; border-radius: 12px; border: 1px solid var(--border-color);">
                        <p style="font-weight: 600; font-size: 1.1rem; margin-bottom: 15px; color: var(--secondary-grad-start);">
                            ☕ Scan to Buy Me a Coffee
                        </p>
                        <img id="donateQRImage" src="donate-qr.png" alt="UPI QR Code" style="max-width: 200px; border-radius: 12px; border: 3px solid var(--border-color); margin-bottom: 15px; background: white; padding: 10px;">
                        <p style="font-size: 0.85rem; color: var(--medium-text); margin-top: 10px; margin-bottom: 15px;">
                            Scan with any UPI app (GPay, PhonePe, Paytm, etc.)
                        </p>
                        
                        <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                            <button class="btn info-btn" onclick="downloadDonateQR()" style="padding: 10px 20px; font-size: 0.9rem;">
                                📥 Download QR
                            </button>
                            <button class="btn primary-btn" onclick="shareDonateQR()" style="padding: 10px 20px; font-size: 0.9rem;">
                                📤 Share QR
                            </button>
                        </div>
                    </div>
                    
                    <p style="font-size: 0.9rem; color: var(--medium-text); margin-top: 20px; font-style: italic;">
                        💖 Every contribution, big or small, means the world to me!
                    </p>
                    
                    <!-- Buy Me a Coffee Button -->
                    <div style="margin-top: 20px;">
                        <a href="https://buymeacoffee.com/Faisalkhan119" target="_blank" rel="noopener noreferrer" 
                           style="display: inline-flex; align-items: center; gap: 8px; padding: 12px 24px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; font-weight: 600; font-size: 0.95rem; border-radius: 10px; text-decoration: none; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3); transition: all 0.3s ease;"
                           onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(102, 126, 234, 0.4)';"
                           onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(102, 126, 234, 0.3)';">
                            ☕ Buy me a coffee
                        </a>
                    </div>
                    
                    <div style="margin-top: 15px;">
                        <button class="btn secondary-btn" onclick="closeModal('donateModal')" style="padding: 12px 30px;">
                            Maybe Later
                        </button>
                    </div>
                </div>`;
    openModal('donateModal');
}

function downloadDonateQR() {
    const link = document.createElement('a');
    link.href = 'donate-qr.png';
    link.download = 'Bunkit_Donate_QR.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function shareDonateQR() {
    try {
        const response = await fetch('donate-qr.png');
        const blob = await response.blob();
        const file = new File([blob], 'Bunkit_Donate_QR.png', { type: 'image/png' });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                title: 'Support Bunk it App',
                text: '☕ Help keep Bunk it ad-free! Scan this QR code with any UPI app to donate.',
                files: [file]
            });
        } else if (navigator.share) {
            await navigator.share({
                title: 'Support Bunk it App',
                text: '☕ Help keep Bunk it ad-free! Download the app and support the developer.',
                url: window.location.href
            });
        } else {
            alert('Sharing not supported. QR will be downloaded instead.');
            downloadDonateQR();
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            downloadDonateQR();
        }
    }
}

// Comprehensive How to Use Modal
function openHelpModal() {
    const modal = document.getElementById('helpModal');
    modal.innerHTML = `
                <div class="modal-content" style="max-width: 700px; max-height: 85vh; overflow-y: auto;">
                    <button class="modal-close" onclick="closeModal('helpModal')">&times;</button>
                    <div class="modal-header">
                        <h2>💡 How to Use Bunk it</h2>
                        <p>Complete guide to all features</p>
                    </div>
                    
                    <div style="text-align: left; padding: 10px;">
                        
                        <h3 style="color: var(--primary-grad-start); margin: 20px 0 10px;">📚 1. Setting Up Your Class</h3>
                        <ul style="line-height: 1.8; padding-left: 20px;">
                            <li><strong>Add Class:</strong> Click "+ Add Class" button to create a new class</li>
                            <li><strong>Class Name:</strong> Enter your class/section name (e.g., "CSE-A 3rd Sem")</li>
                            <li><strong>Last Working Date:</strong> Set the semester end date</li>
                            <li><strong>Subjects:</strong> Add each subject with name, code, and weekly schedule (classes per day)</li>
                            <li><strong>Holidays:</strong> Add holidays so they're excluded from calculations</li>
                            <li><strong>AI Import:</strong> Upload timetable screenshot to auto-fill class details</li>
                            <li><strong>QR Import:</strong> Scan a classmate's QR code to copy their class setup</li>
                        </ul>
                        
                        <h3 style="color: var(--primary-grad-start); margin: 20px 0 10px;">📸 2. Entering Attendance</h3>
                        <ul style="line-height: 1.8; padding-left: 20px;">
                            <li><strong>Image Upload (OCR):</strong> Upload attendance portal screenshot - AI extracts the numbers</li>
                            <li><strong>Manual Entry:</strong> Enter total and attended classes for each subject</li>
                            <li><strong>JSON Paste:</strong> Paste attendance data in JSON format from AI chat</li>
                            <li><strong>⚠️ Pro Tip:</strong> OCR is ~95% accurate - always verify extracted numbers</li>
                        </ul>
                        
                        <h3 style="color: var(--primary-grad-start); margin: 20px 0 10px;">🎓 3. Portal Mode (Daily Tracking)</h3>
                        <ul style="line-height: 1.8; padding-left: 20px;">
                            <li><strong>Enable:</strong> Go to "Student Portal" button → Set baseline date & semester start</li>
                            <li><strong>Daily Logs:</strong> Mark attended/skipped/cancelled classes each day</li>
                            <li><strong>Dashboard:</strong> See color-coded status (🔴 Danger, 🟡 Warning, 🟢 Safe)</li>
                            <li><strong>History:</strong> View/edit past logs using the calendar icon</li>
                        </ul>
                        
                        <h3 style="color: var(--primary-grad-start); margin: 20px 0 10px;">📊 4. View Options</h3>
                        <ul style="line-height: 1.8; padding-left: 20px;">
                            <li><strong>Card View:</strong> Detailed cards with all stats per subject</li>
                            <li><strong>Table View:</strong> Compact spreadsheet-style view</li>
                            <li><strong>Graph View:</strong> Visual analytics with charts</li>
                            <li><strong>Edit:</strong> Click attendance numbers in any view to update</li>
                        </ul>
                        
                        <h3 style="color: var(--primary-grad-start); margin: 20px 0 10px;">📅 5. Weekly Timetable</h3>
                        <ul style="line-height: 1.8; padding-left: 20px;">
                            <li><strong>View:</strong> Auto-generated from your subject schedules</li>
                            <li><strong>Drag & Drop:</strong> Rearrange subjects by dragging</li>
                            <li><strong>Period Times:</strong> Configure start/end times for each period</li>
                            <li><strong>Colors:</strong> Subjects color-coded by attendance status</li>
                        </ul>
                        
                        <h3 style="color: var(--primary-grad-start); margin: 20px 0 10px;">🏖️ 6. Leave Planner</h3>
                        <ul style="line-height: 1.8; padding-left: 20px;">
                            <li><strong>Plan Leaves:</strong> Add dates you plan to skip</li>
                            <li><strong>See Impact:</strong> View how leaves affect your attendance</li>
                            <li><strong>Compulsory Events:</strong> Mark events you must attend</li>
                            <li><strong>Max Safe Leave:</strong> Find maximum days you can safely skip</li>
                            <li><strong>Long Weekend Finder:</strong> Discover best leave strategy for extended breaks</li>
                        </ul>
                        
                        <h3 style="color: var(--primary-grad-start); margin: 20px 0 10px;">🤔 7. Quick Tools</h3>
                        <ul style="line-height: 1.8; padding-left: 20px;">
                            <li><strong>Can I Skip Today?:</strong> Quick check if skipping today is safe</li>
                            <li><strong>Per-Subject / Overall Mode:</strong> Toggle calculation mode in settings</li>
                            <li><strong>Min Attendance %:</strong> Set your required percentage (default 75%)</li>
                        </ul>
                        
                        <h3 style="color: var(--primary-grad-start); margin: 20px 0 10px;">🔔 8. Notifications</h3>
                        <ul style="line-height: 1.8; padding-left: 20px;">
                            <li><strong>Daily Reminders:</strong> Get notified to log attendance</li>
                            <li><strong>Custom Time:</strong> Set your preferred reminder time</li>
                            <li><strong>Per-Class Settings:</strong> Configure separately for each class</li>
                        </ul>
                        
                        <h3 style="color: var(--primary-grad-start); margin: 20px 0 10px;">💾 9. Backup & Sync</h3>
                        <ul style="line-height: 1.8; padding-left: 20px;">
                            <li><strong>Cloud Sync:</strong> Sign in to automatically sync data across all your devices securely</li>
                            <li><strong>Backup:</strong> Download complete backup as JSON file</li>
                            <li><strong>Restore:</strong> Restore from backup file</li>
                            <li><strong>Export/Import:</strong> Share class setup with friends</li>
                            <li><strong>QR Code:</strong> Share class via scannable QR</li>
                        </ul>
                        
                        <h3 style="color: var(--primary-grad-start); margin: 20px 0 10px;">🤖 10. AI Assistant</h3>
                        <ul style="line-height: 1.8; padding-left: 20px;">
                            <li><strong>Ask Questions:</strong> Click the 🤖 button for AI help</li>
                            <li><strong>Smart Advice:</strong> Get personalized leave recommendations</li>
                            <li><strong>API Key:</strong> Set your Gemini API key in API Settings for unlimited use</li>
                        </ul>
                        
                        <div style="background: var(--light-bg); padding: 15px; border-radius: 10px; margin-top: 20px;">
                            <p style="margin: 0; font-size: 0.9rem; color: var(--dark-text);">
                                💬 <strong>Need help?</strong> Contact the developer via WhatsApp button or ask the AI assistant!
                            </p>
                        </div>
                    </div>
                </div>`;
    openModal('helpModal');
}

// Privacy Policy Modal
function openPrivacyPolicy() {
    const modal = document.getElementById('privacyPolicyModal');
    modal.innerHTML = `
                <div class="modal-content" style="max-width: 700px; max-height: 85vh; overflow-y: auto;">
                    <button class="modal-close" onclick="closeModal('privacyPolicyModal')">&times;</button>
                    <div class="modal-header">
                        <h2>🔒 Privacy Policy</h2>
                        <p>Last updated: December 2024</p>
                    </div>
                    
                    <div style="text-align: left; padding: 10px; line-height: 1.8;">
                        
                        <h3 style="color: var(--primary-grad-start); margin: 20px 0 10px;">📱 Data Storage</h3>
                        <p>Bunk it stores your attendance data <strong>locally on your device</strong> for offline support. Cloud features sync data to our secure database.</p>
                        
                        <h3 style="color: var(--primary-grad-start); margin: 20px 0 10px;">☁️ Secure Cloud Sync</h3>
                        <p>When you sign in, your data is synced securely to our cloud servers (Supabase) so you can access it on any device. Your data is encrypted and safe.</p>
                        
                        <h3 style="color: var(--primary-grad-start); margin: 20px 0 10px;">📸 Image Processing</h3>
                        <p>When you upload attendance screenshots for OCR:</p>
                        <ul style="padding-left: 20px;">
                            <li>Images are processed by Google's Gemini AI API</li>
                            <li>Images are <strong>not stored</strong> on any server</li>
                            <li>Processing happens in real-time and data is immediately discarded</li>
                        </ul>
                        
                        <h3 style="color: var(--primary-grad-start); margin: 20px 0 10px;">🔑 API Keys</h3>
                        <p>Your personal Gemini API key (if provided) is stored locally on your device only. It is never sent to our servers.</p>
                        
                        <h3 style="color: var(--primary-grad-start); margin: 20px 0 10px;">🌐 Third-Party Services</h3>
                        <ul style="padding-left: 20px;">
                            <li><strong>Google Sign-in:</strong> For optional cloud sync</li>
                            <li><strong>Google Gemini AI:</strong> For OCR and AI assistant</li>
                            <li><strong>Google Fonts:</strong> For typography</li>
                        </ul>
                        
                        <h3 style="color: var(--primary-grad-start); margin: 20px 0 10px;">📊 Analytics & Tracking</h3>
                        <p>Bunk it does <strong>NOT</strong> use any analytics, tracking, or advertising services. We don't collect usage data, personal information, or browsing behavior.</p>
                        
                        <h3 style="color: var(--primary-grad-start); margin: 20px 0 10px;">🔒 Data Security</h3>
                        <ul style="padding-left: 20px;">
                            <li>All data transmission uses HTTPS encryption</li>
                            <li>Local data is protected by your device security</li>
                            <li>Google Drive sync uses OAuth 2.0 authentication</li>
                        </ul>
                        
                        <h3 style="color: var(--primary-grad-start); margin: 20px 0 10px;">🗑️ Data Deletion</h3>
                        <p>You can delete all your data at any time by:</p>
                        <ul style="padding-left: 20px;">
                            <li>Clearing browser data/cache</li>
                            <li>Uninstalling the PWA</li>
                            <li>Deleting the app folder from Google Drive (if synced)</li>
                        </ul>
                        
                        <h3 style="color: var(--primary-grad-start); margin: 20px 0 10px;">👶 Children's Privacy</h3>
                        <p>This app is designed for college/university students. We do not knowingly collect information from children under 13.</p>
                        
                        <h3 style="color: var(--primary-grad-start); margin: 20px 0 10px;">📧 Contact</h3>
                        <p>For privacy concerns or questions, contact the developer via WhatsApp: +91 6386854875</p>
                        
                        <div style="background: var(--light-bg); padding: 15px; border-radius: 10px; margin-top: 20px;">
                            <p style="margin: 0; font-size: 0.9rem; color: var(--dark-text);">
                                ✅ <strong>Summary:</strong> Your data stays on your device. We don't collect, store, or sell any personal information. Optional Google sync stores data in YOUR Drive only.
                            </p>
                        </div>
                    </div>
                </div>`;
    openModal('privacyPolicyModal');
}

function copyAIPrompt() {
    const promptText = `Generate a JSON structure for a weekly class timetable.

**Global Fields:**
* Include \`lastDate\` (validity as YYYY-MM-DD), a list of \`holidays\` (array of YYYY-MM-DD strings), and a \`qrCode\` string (for export/sharing - use empty string).
* **Optional:** Include \`semesterStartDate\` (YYYY-MM-DD) if available in the inputs.

**Subjects Array:**
* The structure must **not** include a separate \`timetableArrangement\` object. All scheduling logic belongs inside \`subjects\`.
* Each subject object must contain: \`name\`, \`code\`, \`shortName\`, and \`schedule\`.

**Schedule Logic:**
* The \`schedule\` key must be an array of 7 strings (representing days 0-6, Mon-Sun).
* Use the period number as a string (e.g., \`"1"\`).
* If a subject occupies multiple periods on one day, separate them with commas (e.g., \`"2,3"\`).
* If there is no class, use \`"0"\`.

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
}

CRITICAL INSTRUCTIONS:
1. The top-level key MUST be the class name (e.g., "CSE Core - H").
2. 'lastDate' is the single last working day of the semester.
3. 'holidays' is an array of date strings for all holiday dates.
4. For 'shortName', use a short abbreviation (2-5 characters) like "DS&A", "OS", "CO&A".
5. The 'schedule' array represents Mon(0) to Sun(6). Use period numbers as strings.
6. Provide ONLY the JSON code block in your response, with no extra text.`;
    navigator.clipboard.writeText(promptText).then(() => alert('Prompt copied to clipboard!'), () => alert('Failed to copy prompt.'));
}





function copyExportJson() { const jsonText = document.getElementById('exportJsonTextarea').value; navigator.clipboard.writeText(jsonText).then(() => { alert('Class JSON copied to clipboard!'); closeModal('exportModal'); }, () => alert('Failed to copy.')); }
function editSelectedClass() { const selected = document.getElementById('classSelector').value; if (selected) openAddClassModal(selected); else alert("Please select a class to edit first."); }
function addSubjectEntry(subject = {}) { const container = document.getElementById('subjectsContainer'); if (!container) return; const newIndex = container.children.length + 1; container.insertAdjacentHTML('beforeend', `<div class="subject-entry"><div class="subject-entry-header"><h4>Subject ${newIndex}</h4><button type="button" class="remove-subject-btn" onclick="removeSubjectEntry(this)">Remove</button></div><div class="form-group"><input type="text" placeholder="Subject Name" class="new-subject-name" value="${subject.name || ''}"></div><div class="form-group"><input type="text" placeholder="Subject Code (e.g., 21CSC202J)" class="new-subject-code" value="${subject.code || ''}"></div><label>Weekly Schedule (Mon-Sun)</label><div class="schedule-input">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => `<div class="schedule-day"><label>${day}</label><input type="number" class="new-subject-schedule" min="0" value="${(subject.schedule && subject.schedule[i]) ?? 0}"></div>`).join('')}</div></div>`); }
function removeSubjectEntry(button) { button.closest('.subject-entry').remove(); document.querySelectorAll('#subjectsContainer .subject-entry-header h4').forEach((h4, index) => h4.textContent = `Subject ${index + 1}`); }
function populateHolidaysInModal(holidays) { const holidayList = document.getElementById('holidayList'); if (!holidayList) return; holidayList.innerHTML = ''; holidays.forEach(dateStr => { const li = document.createElement('li'); li.innerHTML = `<span>${dateStr}</span><button type="button" class="remove-holiday-btn" onclick="this.parentElement.remove()">Remove</button>`; holidayList.appendChild(li); }); }
function addHolidayToModal() { const dateInput = document.getElementById('newHolidayDate'); const dateStr = dateInput.value; if (dateStr) { const holidayList = document.getElementById('holidayList'); if ([...holidayList.querySelectorAll('span')].some(span => span.textContent === dateStr)) { alert("This holiday is already in the list."); return; } const li = document.createElement('li'); li.innerHTML = `<span>${dateStr}</span><button type="button" class="remove-holiday-btn" onclick="this.parentElement.remove()">Remove</button>`; holidayList.appendChild(li); dateInput.value = ''; } }

// ==================== WIZARD FUNCTIONS ====================
let wizardCurrentStep = 1;
let wizardSubjectsData = []; // Stores subject data between steps
let wizardTimetableData = {}; // Stores timetable grid data

function wizardGoToStep(step) {
    // Validate current step before moving forward
    if (step > wizardCurrentStep) {
        if (!validateWizardStep(wizardCurrentStep)) return;
    }

    // Save data from current step before leaving
    saveWizardStepData(wizardCurrentStep);

    // Update step content visibility
    document.getElementById('wizardStep1').style.display = step === 1 ? 'block' : 'none';
    document.getElementById('wizardStep2').style.display = step === 2 ? 'block' : 'none';
    document.getElementById('wizardStep3').style.display = step === 3 ? 'block' : 'none';

    // Update progress indicators
    updateWizardIndicators(step);

    // Generate content for the new step
    if (step === 2) generateWizardSubjectsForm();
    if (step === 3) generateWizardTimetableGrid();

    wizardCurrentStep = step;
}
window.wizardGoToStep = wizardGoToStep;

function updateWizardIndicators(activeStep) {
    [1, 2, 3].forEach(s => {
        const indicator = document.getElementById(`wizStep${s}Indicator`);
        if (!indicator) return; // Guard against null element
        const numSpan = indicator.querySelector('span');
        if (!numSpan) return; // Guard against null span
        if (s <= activeStep) {
            indicator.style.background = 'var(--primary-color)';
            indicator.style.color = 'white';
            numSpan.style.background = 'white';
            numSpan.style.color = 'var(--primary-color)';
        } else {
            indicator.style.background = 'var(--light-bg)';
            indicator.style.color = 'var(--medium-text)';
            numSpan.style.background = 'var(--border-color)';
            numSpan.style.color = 'var(--medium-text)';
        }
    });
}

function validateWizardStep(step) {
    if (step === 1) {
        const className = document.getElementById('newClassName').value.trim();
        const lastDate = document.getElementById('newClassLastDate').value;
        const periodCount = parseInt(document.getElementById('wizPeriodCount').value) || 0;

        if (!className) { showToast('⚠️ Please enter a class name', 'error'); return false; }
        if (!lastDate) { showToast('⚠️ Please select a last working date', 'error'); return false; }
        if (periodCount < 1 || periodCount > 12) { showToast('⚠️ Enter 1-12 periods per day', 'error'); return false; }
        return true;
    }
    if (step === 2) {
        const container = document.getElementById('wizSubjectsContainer');
        const entries = container.querySelectorAll('.wiz-subject-entry');
        if (entries.length === 0) {
            showToast('⚠️ Add at least one subject', 'error');
            return false;
        }
        for (let i = 0; i < entries.length; i++) {
            const name = entries[i].querySelector('.wiz-subject-name').value.trim();
            const code = entries[i].querySelector('.wiz-subject-code').value.trim();
            if (!name || !code) {
                showToast(`⚠️ Subject ${i + 1}: Fill both name and code`, 'error');
                return false;
            }
        }
        return true;
    }
    return true;
}

function saveWizardStepData(step) {
    if (step === 2) {
        // Save subject data from Step 2
        const container = document.getElementById('wizSubjectsContainer');
        const entries = container.querySelectorAll('.wiz-subject-entry');
        wizardSubjectsData = [];
        entries.forEach((entry, i) => {
            wizardSubjectsData.push({
                name: entry.querySelector('.wiz-subject-name').value.trim(),
                code: entry.querySelector('.wiz-subject-code').value.trim(),
                schedule: [0, 0, 0, 0, 0, 0, 0] // Will be calculated from timetable
            });
        });
    }
    if (step === 3) {
        // Save timetable data from Step 3
        saveTimetableFromGrid();
    }
}

function generateWizardSubjectsForm() {
    const container = document.getElementById('wizSubjectsContainer');
    container.innerHTML = '';

    const subjects = wizardSubjectsData.length > 0 ? wizardSubjectsData : [{ name: '', code: '' }];
    subjects.forEach((existing, i) => {
        appendWizardSubjectRow(container, existing, i);
    });
}

function appendWizardSubjectRow(container, existing = { name: '', code: '' }, index = null) {
    const i = index !== null ? index : container.querySelectorAll('.wiz-subject-entry').length;
    container.insertAdjacentHTML('beforeend', `
                    <div class="wiz-subject-entry" style="display: grid; grid-template-columns: 1fr 1fr auto; gap: 10px; padding: 10px; margin-bottom: 10px; background: var(--light-bg); border-radius: 8px; border: 1px solid var(--border-color); align-items: end;">
                        <div class="form-group" style="margin: 0;">
                            <label style="font-size: 0.8rem; color: var(--medium-text);">Subject Name</label>
                            <input type="text" class="wiz-subject-name" value="${existing.name}" placeholder="e.g., Data Structures">
                        </div>
                        <div class="form-group" style="margin: 0;">
                            <label style="font-size: 0.8rem; color: var(--medium-text);">Subject Code</label>
                            <input type="text" class="wiz-subject-code" value="${existing.code}" placeholder="e.g., 21CSC201J">
                        </div>
                        <button type="button" onclick="removeWizardSubject(this)" style="background: none; border: none; color: var(--danger-color, #e74c3c); font-size: 1.3rem; cursor: pointer; padding: 8px; line-height: 1;" title="Remove subject">✕</button>
                    </div>
                `);
}

function addWizardSubject() {
    const container = document.getElementById('wizSubjectsContainer');
    appendWizardSubjectRow(container);
    // Scroll to the new entry
    container.scrollTop = container.scrollHeight;
}
window.addWizardSubject = addWizardSubject;

function removeWizardSubject(btn) {
    const entry = btn.closest('.wiz-subject-entry');
    if (entry) entry.remove();
}
window.removeWizardSubject = removeWizardSubject;

function generateWizardTimetableGrid() {
    const periodCount = parseInt(document.getElementById('wizPeriodCount').value) || 8;
    const container = document.getElementById('wizTimetableGrid');
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // Subject map for colors
    const subjectColorMap = {};
    const subjectNameMap = {};
    wizardSubjectsData.forEach((sub, index) => {
        subjectColorMap[sub.code] = subjectColors[index % subjectColors.length];
        subjectNameMap[sub.code] = sub.name;
    });

    // Build subject options
    let subjectOptions = '<option value="">Free</option>';
    wizardSubjectsData.forEach(sub => {
        subjectOptions += `<option value="${sub.code}">${sub.code} (${sub.name.substring(0, 15)}${sub.name.length > 15 ? '...' : ''})</option>`;
    });

    // Build styled table matching main design (Transposed: Days x Periods)
    let tableHTML = `
                    <style>
                        .wiz-tt-cell { padding: 4px; border: 1px solid var(--border-color); position: relative; height: 50px; min-width: 60px; }
                        .wiz-tt-select { 
                            width: 100%; height: 100%; opacity: 0; position: absolute; top: 0; left: 0; z-index: 2; cursor: pointer; 
                        }
                        .wiz-tt-chip {
                            position: absolute; top: 4px; left: 4px; right: 4px; bottom: 4px; border-radius: 4px;
                            display: flex; align-items: center; justify-content: center; font-size: 0.75rem; 
                            color: white; font-weight: bold; pointer-events: none; z-index: 1;
                            text-shadow: 0 1px 2px rgba(0,0,0,0.2); box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                        }
                        .wiz-tt-free {
                            color: var(--medium-text); font-weight: normal; background: var(--light-bg); border: 1px dashed var(--border-color);
                            box-shadow: none; text-shadow: none;
                        }
                    </style>
                    <table style="width: 100%; border-collapse: separate; border-spacing: 0; font-size: 0.85rem; border-radius: 8px; overflow: hidden; border: 1px solid var(--border-color);">
                        <thead>
                            <tr style="background: var(--card-bg); color: var(--text-color);">
                                <th style="padding: 10px; border-bottom: 2px solid var(--border-color); border-right: 1px solid var(--border-color); text-align: center; width: 60px;">Day</th>
                                ${Array.from({ length: periodCount }, (_, i) => `<th style="padding: 10px; border-bottom: 2px solid var(--border-color); border-left: 1px solid var(--border-color); text-align: center;">P${i + 1}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                `;

    for (let d = 0; d < 7; d++) {
        tableHTML += `<tr>
                        <td style="padding: 6px; border-right: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color); text-align: center; font-weight: bold; color: var(--medium-text); background: var(--light-bg);">${days[d]}</td>`;

        for (let p = 0; p < periodCount; p++) {
            const existingValue = wizardTimetableData[d]?.[p] || '';

            // Chip styling
            let chipHTML = `<div class="wiz-tt-chip wiz-tt-free">Free</div>`;
            if (existingValue && subjectColorMap[existingValue]) {
                const color = subjectColorMap[existingValue];
                const name = subjectNameMap[existingValue] || existingValue;
                const shortName = getSubjectShortName(name);
                chipHTML = `<div class="wiz-tt-chip" style="background: linear-gradient(135deg, ${color}, ${adjustColor(color, -20)});">
                                ${shortName}
                            </div>`;
            }

            const selectedOptions = subjectOptions.replace(
                `value="${existingValue}"`,
                `value="${existingValue}" selected`
            );

            tableHTML += `
                            <td class="wiz-tt-cell" style="border-left: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color);">
                                ${chipHTML}
                                <select class="wiz-tt-select" data-day="${d}" data-period="${p}" onchange="updateWizardCellDisplay(this)">
                                    ${selectedOptions}
                                </select>
                            </td>
                        `;
        }
        tableHTML += '</tr>';
    }

    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
}

function saveTimetableFromGrid() {
    wizardTimetableData = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    const selects = document.querySelectorAll('.wiz-tt-select');

    selects.forEach(sel => {
        const day = parseInt(sel.dataset.day);
        const period = parseInt(sel.dataset.period);
        const code = sel.value;

        // Ensure array is long enough
        while (wizardTimetableData[day].length <= period) {
            wizardTimetableData[day].push('');
        }
        wizardTimetableData[day][period] = code;
    });
}

async function submitClassFromWizard() {
    try {
        console.log("💾 submitClassFromWizard triggered");

        // Final save of grid data
        saveTimetableFromGrid();

        // Collect all data
        let className = document.getElementById('newClassName').value.trim();
        const lastDate = document.getElementById('newClassLastDate').value;
        const holidays = [...document.getElementById('holidayList').querySelectorAll('span')].map(span => span.textContent).sort();
        const semesterStartDate = document.getElementById('newClassStartDate').value;

        if (!className) throw new Error("Please enter a Class Name.");
        if (!lastDate) throw new Error("Please select a Last Working Date.");

        // Calculate schedule counts from timetable grid
        const currentWizardSubjects = JSON.parse(JSON.stringify(wizardSubjectsData)); // Deep copy to avoid reference issues
        currentWizardSubjects.forEach(sub => {
            sub.shortName = sub.shortName || getSubjectShortName(sub.name);
            sub.schedule = [0, 0, 0, 0, 0, 0, 0];
            for (let d = 0; d < 7; d++) {
                (wizardTimetableData[d] || []).forEach(code => {
                    if (code === sub.code) sub.schedule[d]++;
                });
            }
        });

        // Build timetable arrangement (period-based)
        const tempTimetableArrangement = {};
        for (let d = 0; d < 7; d++) {
            tempTimetableArrangement[d] = (wizardTimetableData[d] || []).map(code => {
                if (!code) return null;
                const sub = currentWizardSubjects.find(s => s.code === code);
                return sub ? { code: sub.code, name: sub.name, shortName: getSubjectShortName(sub.name) } : null;
            });
        }

        // Check for duplicates (New Class or Rename to Existing)
        if (!editingClassName || (editingClassName && editingClassName !== className)) {
            const dupResult = checkWizardClassDuplicate(className, currentWizardSubjects, tempTimetableArrangement);
            if (dupResult.status === 'exact_duplicate') {
                alert(`⚠️ Class "${className}" already exists with this exact schedule!`);
                return;
            }
            if (dupResult.status === 'name_conflict') {
                if (confirm(`⚠️ Class "${className}" already exists but has a different schedule.\n\nSave as "${dupResult.suggestedName}" instead?`)) {
                    className = dupResult.suggestedName;
                } else {
                    return;
                }
            }
        }

        // CAPTURE STATE
        const originalName = editingClassName;
        const isEditMode = !!originalName;
        const existingClassData = originalName ? (classes[originalName] || {}) : {};

        // Check Timetable Change (Compare NEW arrangement vs OLD stored arrangement)
        let timetableChanged = false;
        if (isEditMode) {
            timetableChanged = hasTimetableChanged(originalName, tempTimetableArrangement);
            console.log(`Timetable changed: ${timetableChanged}`);
        }

        // Define Save Operation
        const completeSaveOperation = async () => {
            console.log("Executing Final Save...");

            // 1. Handle Rename
            if (originalName && originalName !== className) {
                console.log(`Renaming "${originalName}" to "${className}"`);
                const keyPrefixes = ['notificationSettings_', 'timetable_arrangement_', 'periodTimes_', 'custom_schedules_'];
                keyPrefixes.forEach(prefix => {
                    const oldData = localStorage.getItem(`${prefix}${originalName}`);
                    if (oldData) {
                        localStorage.setItem(`${prefix}${className}`, oldData);
                        localStorage.removeItem(`${prefix}${originalName}`);
                    }
                });
                delete classes[originalName];
            }

            // 2. Save Class Object
            classes[className] = {
                ...existingClassData, // Preserve ID, portalSetup, etc.
                lastDate,
                subjects: currentWizardSubjects,
                holidays,
                updatedAt: Date.now(),
                portalSetup: {
                    ...(existingClassData.portalSetup || {}),
                    semesterStartDate
                }
            };

            // Ensure ID
            if (!classes[className].id) classes[className].id = crypto.randomUUID();

            // Shared ID
            if (window.SocialManager && !classes[className].sharedId) {
                classes[className].sharedId = await window.SocialManager.generateSharedClassId(classes[className]);
            }

            // 3. Save Timetable Arrangement
            saveTimetableArrangement(className, tempTimetableArrangement);

            // 4. Persist
            saveToStorage();

            // 5. Membership
            if (classes[className]?.sharedId && window.supabaseClient && window.AuthManager?.user) {
                supabaseClient.from('class_memberships').upsert({
                    shared_class_id: classes[className].sharedId,
                    user_id: AuthManager.user.id
                }, { onConflict: 'shared_class_id, user_id' }).then(({ error }) => {
                    if (error) console.error('Membership reg failed:', error);
                });
            }

            // 6. UI Cleanup
            closeModal('addClassModal');
            populateClassSelector();
            document.getElementById('classSelector').value = className;
            onClassChange();
            showToast(`✅ Class "${className}" saved successfully!`, 'success');

            // Reset
            wizardCurrentStep = 1;
            wizardSubjectsData = [];
            wizardTimetableData = {};
            editingClassName = null;
        };

        // Execute
        if (timetableChanged) {
            openEffectiveDateModal(className, tempTimetableArrangement, completeSaveOperation);
        } else {
            await completeSaveOperation();
        }

    } catch (error) {
        console.error("❌ Error in submitClassFromWizard:", error);
        alert("An error occurred while saving:\n" + error.message);
    }
}
window.submitClassFromWizard = submitClassFromWizard;

// ==================== EFFECTIVE DATE MODAL ====================

// Temporary storage for pending save
let pendingTimetableSave = null;

/**
 * Create the Effective Date Modal dynamically
 */
function createEffectiveDateModal() {
    if (document.getElementById('effectiveDateModal')) return;

    const modal = document.createElement('div');
    modal.id = 'effectiveDateModal';
    modal.className = 'modal';
    modal.innerHTML = `
                <div class="modal-content" style="max-width: 500px;">
                    <button class="modal-close" onclick="closeModal('effectiveDateModal')">&times;</button>
                    <div class="modal-header">
                        <h2>📅 When should this timetable apply?</h2>
                        <p>Choose when the new timetable should take effect</p>
                    </div>
                    
                    <div class="form-group">
                        <label>
                            <input type="radio" name="effectiveDateOption" value="today" checked onchange="toggleEffectiveDateRange()">
                            Apply from today onwards
                        </label>
                        <p style="font-size: 0.85rem; color: var(--medium-text); margin-left: 24px;">
                            New timetable will be used for today and all future dates. Past logs remain unchanged.
                        </p>
                    </div>
                    
                    <div class="form-group">
                        <label>
                            <input type="radio" name="effectiveDateOption" value="custom" onchange="toggleEffectiveDateRange()">
                            Apply to custom date range
                        </label>
                    </div>
                    
                    <div id="effectiveDateRangeInputs" style="display: none; margin-left: 24px; margin-bottom: 15px;">
                        <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 10px;">
                            <div class="form-group" style="margin: 0; flex: 1;">
                                <label style="font-size: 0.85rem;">Start Date</label>
                                <input type="date" id="effectiveStartDate">
                            </div>
                            <span style="margin-top: 20px;">→</span>
                            <div class="form-group" style="margin: 0; flex: 1;">
                                <label style="font-size: 0.85rem;">End Date</label>
                                <input type="date" id="effectiveEndDate">
                            </div>
                        </div>
                    </div>
                    
                    <div id="effectiveDateWarning" style="display: none; background: rgba(255, 193, 7, 0.15); padding: 12px; border-radius: 8px; border-left: 4px solid #ffc107; margin-bottom: 15px;">
                        <strong style="color: #856404;">⚠️ Warning</strong>
                        <p id="effectiveDateWarningText" style="margin: 5px 0 0; font-size: 0.9rem;"></p>
                    </div>
                    
                    <div class="form-actions" style="justify-content: space-between;">
                        <button class="btn secondary-btn" onclick="closeModal('effectiveDateModal')">Cancel</button>
                        <button class="btn success-btn" onclick="confirmEffectiveDateSave()">💾 Confirm & Save</button>
                    </div>
                </div>`;
    document.body.appendChild(modal);
}

/**
 * Toggle visibility of custom date range inputs
 */
function toggleEffectiveDateRange() {
    const option = document.querySelector('input[name="effectiveDateOption"]:checked').value;
    const rangeInputs = document.getElementById('effectiveDateRangeInputs');
    rangeInputs.style.display = option === 'custom' ? 'block' : 'none';

    if (option === 'custom') {
        checkEffectiveDateConflicts();
    } else {
        document.getElementById('effectiveDateWarning').style.display = 'none';
    }
}
window.toggleEffectiveDateRange = toggleEffectiveDateRange;

/**
 * Check for log conflicts when date range changes
 */
function checkEffectiveDateConflicts() {
    const startDate = document.getElementById('effectiveStartDate').value;
    const endDate = document.getElementById('effectiveEndDate').value;
    const warning = document.getElementById('effectiveDateWarning');
    const warningText = document.getElementById('effectiveDateWarningText');

    if (!startDate || !endDate || !pendingTimetableSave) {
        warning.style.display = 'none';
        return;
    }

    const conflicts = checkLogConflicts(pendingTimetableSave.className, startDate, endDate);

    if (conflicts.count > 0) {
        warning.style.display = 'block';
        warningText.textContent = `${conflicts.count} day(s) with logged attendance exist in this range. The new timetable will apply to these dates but existing logs will be preserved.`;
    } else {
        warning.style.display = 'none';
    }
}
window.checkEffectiveDateConflicts = checkEffectiveDateConflicts;

/**
 * Open the Effective Date Modal for timetable versioning
 */
function openEffectiveDateModal(className, newArrangement, saveCallback) {
    createEffectiveDateModal();

    pendingTimetableSave = {
        className: className,
        arrangement: newArrangement,
        saveCallback: saveCallback
    };

    // Set default dates
    const today = formatLocalDate(new Date());
    document.getElementById('effectiveStartDate').value = today;

    // Set end date to last working date if available
    const lastDate = selectedClass?.lastDate || '';
    document.getElementById('effectiveEndDate').value = lastDate || today;

    // Reset to "today" option
    document.querySelector('input[name="effectiveDateOption"][value="today"]').checked = true;
    document.getElementById('effectiveDateRangeInputs').style.display = 'none';
    document.getElementById('effectiveDateWarning').style.display = 'none';

    // Add change listeners for conflict detection
    document.getElementById('effectiveStartDate').onchange = checkEffectiveDateConflicts;
    document.getElementById('effectiveEndDate').onchange = checkEffectiveDateConflicts;

    openModal('effectiveDateModal');
}
window.openEffectiveDateModal = openEffectiveDateModal;

/**
 * Confirm save with effective date
 */
function confirmEffectiveDateSave() {
    if (!pendingTimetableSave) return;

    const option = document.querySelector('input[name="effectiveDateOption"]:checked').value;
    const today = formatLocalDate(new Date());

    let effectiveFrom = today;

    if (option === 'custom') {
        effectiveFrom = document.getElementById('effectiveStartDate').value;
        if (!effectiveFrom) {
            alert('Please select a start date.');
            return;
        }
    }

    const { className, arrangement, saveCallback } = pendingTimetableSave;

    // Get yesterday's date for archiving the old timetable
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const archiveEndDate = formatLocalDate(yesterday);

    // Check if history already has an active version
    const history = getTimetableHistory(className);
    const hasActiveVersion = history.some(v => !v.effectiveTo);

    if (hasActiveVersion) {
        // Archive the current active version
        archiveCurrentTimetable(className, archiveEndDate);
    } else {
        // First time versioning - archive the current timetable to history
        const currentArrangement = JSON.parse(localStorage.getItem(`timetable_arrangement_${className}`) || 'null');
        if (currentArrangement) {
            // Add current as first history entry (ending yesterday)
            saveTimetableVersion(className, currentArrangement, '2020-01-01', archiveEndDate);
        }
    }

    // Save new version to history as active (no end date)
    saveTimetableVersion(className, arrangement, effectiveFrom, null);

    // Also update the current active timetable
    saveTimetableArrangement(className, arrangement);

    closeModal('effectiveDateModal');
    pendingTimetableSave = null;

    // Call the original save callback to complete the class save
    if (saveCallback) {
        saveCallback();
    }

    showToast('✅ Timetable saved with effective date!', 'success');
}
window.confirmEffectiveDateSave = confirmEffectiveDateSave;

/**
 * Check if timetable has changed compared to saved version
 */
function hasTimetableChanged(className, newArrangement) {
    const oldArrangement = JSON.parse(localStorage.getItem(`timetable_arrangement_${className}`) || '{}');

    // Simple deep comparison via JSON stringify
    return JSON.stringify(oldArrangement) !== JSON.stringify(newArrangement);
}

// ==================== END EFFECTIVE DATE MODAL ====================

function updateWizardCellDisplay(select) {
    // Determine day and period
    const day = parseInt(select.dataset.day);
    const period = parseInt(select.dataset.period);

    // Update internal data immediately
    if (!wizardTimetableData[day]) wizardTimetableData[day] = [];
    wizardTimetableData[day][period] = select.value;

    // Re-render grid to update colors (simplest way to keep sync)
    generateWizardTimetableGrid();
}
window.updateWizardCellDisplay = updateWizardCellDisplay;

function initializeWizardForEdit(classData, className) {
    // Step 1: Basic info
    const nameEl = document.getElementById('newClassName');
    const dateEl = document.getElementById('newClassLastDate');
    if (nameEl) nameEl.value = className;
    if (dateEl) dateEl.value = classData.lastDate || '';
    if (document.getElementById('newClassStartDate')) document.getElementById('newClassStartDate').value = classData.portalSetup?.semesterStartDate || '';

    // Determine period count from timetable arrangement
    const ta = JSON.parse(localStorage.getItem(`timetable_arrangement_${className}`) || '{}');
    let maxPeriods = 8;

    // Calculate max non-empty period across all days
    let maxPeriodFound = 0;
    Object.values(ta).forEach(dayArr => {
        if (Array.isArray(dayArr)) {
            dayArr.forEach((period, idx) => {
                if (period) maxPeriodFound = Math.max(maxPeriodFound, idx + 1);
            });
        }
    });

    // Use found max periods
    maxPeriods = maxPeriodFound > 0 ? maxPeriodFound : 8;

    const wizPeriodEl = document.getElementById('wizPeriodCount');
    if (wizPeriodEl) wizPeriodEl.value = maxPeriods;

    // Step 2: Load subjects
    wizardSubjectsData = (classData.subjects || []).map(s => ({
        name: s.name,
        code: s.code,
        schedule: s.schedule || [0, 0, 0, 0, 0, 0, 0]
    }));

    // Step 3: Load timetable
    wizardTimetableData = {};
    for (let d = 0; d < 7; d++) {
        wizardTimetableData[d] = (ta[d] || []).map(item => {
            if (!item) return '';
            return typeof item === 'object' ? item.code : item;
        });
    }

    // Load holidays
    populateHolidaysInModal(classData.holidays || []);
}
// ==================== END WIZARD FUNCTIONS ====================

let tempTimetableArrangement = null; // Temporary storage for import verification

function generateDefaultTimetable(subjects) {
    const ta = {};
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    days.forEach((day, dayIndex) => {
        const dailySequence = [];
        subjects.forEach(subject => {
            // Handle subject.schedule which might be array or map ? 
            // The app uses array [Mon, Tue...] usually.
            const count = (subject.schedule && subject.schedule[dayIndex]) || 0;
            for (let k = 0; k < count; k++) {
                dailySequence.push(subject.code);
            }
        });
        ta[day] = dailySequence;
    });
    return ta;
}

/**
 * Checks for class duplicates.
 * Returns { status: 'ok' | 'exact_duplicate' | 'name_conflict', suggestedName: string }
 */
function checkWizardClassDuplicate(inputName, newSubjects, newTimetable = {}) {
    if (!classes[inputName]) return { status: 'ok', suggestedName: inputName };

    const existingClass = classes[inputName];

    // 1. Compare Subjects & Schedules (Most critical for identity)
    const simpleExisting = JSON.stringify(existingClass.subjects.map(s => ({ c: s.code, sc: s.schedule })));
    const simpleNew = JSON.stringify(newSubjects.map(s => ({ c: s.code, sc: s.schedule })));

    if (simpleExisting === simpleNew) {
        return { status: 'exact_duplicate', suggestedName: inputName };
    }

    // 2. Name Conflict (Same name, different data) -> Generate unique name
    let finalName = inputName;
    let counter = 1;
    while (classes[finalName]) {
        finalName = `${inputName} (${counter++})`;
    }
    return { status: 'name_conflict', suggestedName: finalName };
}

function submitClassForm() { if (isJsonMode) { submitClassFromJson(); } else { submitClassFromForm(); } }

async function submitClassFromForm() {
    let className = document.getElementById('newClassName').value.trim();
    const lastDate = document.getElementById('newClassLastDate').value;
    const startDate = document.getElementById('newClassStartDate') ? document.getElementById('newClassStartDate').value : '';

    if (!className || !lastDate) { alert('Please fill in Class Name and Last Date.'); return; }

    // DATE VALIDATION: End Date must be after Start Date
    if (startDate && lastDate && new Date(startDate) > new Date(lastDate)) {
        alert("⚠️ Date Error\n\nThe 'Semester End Date' cannot be before the 'Start Date'.\nPlease correct the dates.");
        return;
    }
    const subjects = [];
    let isValid = true;
    document.querySelectorAll('#subjectsContainer .subject-entry').forEach(entry => {
        const name = entry.querySelector('.new-subject-name').value.trim();
        const code = entry.querySelector('.new-subject-code').value.trim();
        const schedule = Array.from(entry.querySelectorAll('.new-subject-schedule')).map(i => parseInt(i.value) || 0);
        if (!name || !code) isValid = false;
        subjects.push({ name, code, schedule });
    });
    if (!isValid || subjects.length === 0) { alert('Please fill all details for each subject.'); return; }

    // DUPLICATE CODE CHECK
    const codes = subjects.map(s => s.code.toUpperCase());
    const uniqueCodes = new Set(codes);
    if (uniqueCodes.size !== codes.length) {
        alert('⚠️ Duplicate Subject Codes\n\nEach subject must have a unique code (e.g. MATH, ENG).\nYou have entered the same code more than once.');
        return;
    }

    // Check for duplicates only if creating a new class
    if (!editingClassName) {
        // Assemble full class data for strict check
        const currentHolidays = [...document.getElementById('holidayList').querySelectorAll('span')].map(span => span.textContent).sort();
        const currentTimetable = tempTimetableArrangement || JSON.parse(localStorage.getItem(`timetable_arrangement_${className}`) || '{}');

        const tempClassData = {
            name: className,
            lastDate: lastDate,
            subjects: subjects,
            holidays: currentHolidays,
            timetable: currentTimetable
        };

        const dupResult = checkClassDuplicate(className, subjects, currentTimetable);

        if (dupResult.status === 'exact_duplicate') {
            alert(`⚠️ Class "${className}" already exists with this exact schedule!`);
            return;
        }
        if (dupResult.status === 'name_conflict') {
            if (confirm(`⚠️ Class "${className}" already exists but has a different schedule.\n\nSave as "${dupResult.suggestedName}" instead?`)) {
                className = dupResult.suggestedName;
                // Update input for clarity
                const nameInput = document.getElementById('newClassName');
                if (nameInput) nameInput.value = className;
            } else {
                return;
            }
        }
    }

    const holidays = [...document.getElementById('holidayList').querySelectorAll('span')].map(span => span.textContent).sort();

    if (editingClassName && editingClassName !== className) {
        const keyPrefixes = ['notificationSettings_', 'timetable_arrangement_', 'periodTimes_', 'custom_schedules_'];
        keyPrefixes.forEach(prefix => {
            const oldData = localStorage.getItem(`${prefix}${editingClassName}`);
            if (oldData) {
                localStorage.setItem(`${prefix}${className}`, oldData);
                localStorage.removeItem(`${prefix}${editingClassName}`);
            }
        });
        delete classes[editingClassName];
    }

    const existingClass = classes[editingClassName] || classes[className] || {};

    // ORPHAN LOG CLEANUP: Check if subjects were removed
    if (editingClassName && existingClass.subjects) {
        const oldCodes = new Set(existingClass.subjects.map(s => s.code));
        const newCodes = new Set(subjects.map(s => s.code));

        // Find codes that are in OLD but NOT in NEW
        const deletedCodes = [...oldCodes].filter(x => !newCodes.has(x));

        if (deletedCodes.length > 0) {
            console.log("Cleaning up logs for deleted subjects:", deletedCodes);
            const logs = JSON.parse(localStorage.getItem('attendance_logs')) || {};
            let logsChanged = false;

            // Iterate all dates
            for (const dateKey in logs) {
                deletedCodes.forEach(delCode => {
                    // Check Legacy Key
                    if (logs[dateKey][delCode] !== undefined) {
                        delete logs[dateKey][delCode];
                        logsChanged = true;
                    }
                    // Check Namespaced Key (Future Proofing)
                    const spacedKey = `${editingClassName}_${delCode}`;
                    if (logs[dateKey][spacedKey] !== undefined) {
                        delete logs[dateKey][spacedKey];
                        logsChanged = true;
                    }
                });
                // Remove empty date entries
                if (Object.keys(logs[dateKey]).length === 0) {
                    delete logs[dateKey];
                }
            }

            if (logsChanged) {
                localStorage.setItem('attendance_logs', JSON.stringify(logs));

                // FIX: Update timestamps for all affected dates and sync
                const logTimestamps = JSON.parse(localStorage.getItem('attendance_log_timestamps') || '{}');
                Object.keys(logs).forEach(dateKey => {
                    logTimestamps[dateKey] = new Date().toISOString();
                });
                localStorage.setItem('attendance_log_timestamps', JSON.stringify(logTimestamps));

                // Sync all affected dates
                if (window.SyncManager) {
                    Object.keys(logs).forEach(dateKey => {
                        SyncManager.saveLog(dateKey, logs[dateKey] || {});
                    });
                }
            }
        }
    }

    const semesterStartDate = document.getElementById('newClassStartDate') ? document.getElementById('newClassStartDate').value : '';

    // ID MANAGEMENT
    // If editing, keep ID. If rename, keep ID. if New, generate ID.
    const classId = existingClass.id || crypto.randomUUID();

    classes[className] = {
        ...existingClass,
        id: classId,
        updatedAt: Date.now(),
        lastDate,
        subjects,
        holidays,
        portalSetup: {
            ...(existingClass.portalSetup || {}),
            semesterStartDate
        }
    };

    // SINGLE CLASS POLICY: Auto-delete "Example Class" or "Example" if a new class is created
    // This ensures the user is left with ONLY the new class.
    if (!editingClassName) {
        const examples = ['Example Class', 'Example'];
        examples.forEach(ex => {
            if (classes[ex] && className !== ex) {
                console.log(`🧹 Auto-deleting "${ex}" to enforce Single Class Policy.`);
                // Use SyncManager if available for clean cloud removal
                if (window.SyncManager) {
                    SyncManager.deleteClass(ex);
                } else {
                    delete classes[ex]; // Fallback
                }
            }
        });
    }

    // === Handle Pending Imported Timetable ===
    if (tempTimetableArrangement) {
        localStorage.setItem(`timetable_arrangement_${className}`, JSON.stringify(tempTimetableArrangement));
        tempTimetableArrangement = null; // Clear after saving
    } else {
        // Check if existing timetable is valid (not just exists, but has content)
        const existingTAJson = localStorage.getItem(`timetable_arrangement_${className}`);
        let isValidTA = false;

        if (existingTAJson) {
            try {
                const parsedTA = JSON.parse(existingTAJson);
                // Check if it has keys and at least one day is not empty
                if (parsedTA && Object.keys(parsedTA).length > 0) {
                    const hasContent = Object.values(parsedTA).some(dayArr => Array.isArray(dayArr) && dayArr.length > 0);
                    if (hasContent) isValidTA = true;
                }
            } catch (e) {
                console.warn("Invalid TA JSON found, regenerating...");
            }
        }

        // If missing or invalid, force regeneration
        if (!isValidTA) {
            const defaultAT = generateDefaultTimetable(subjects);
            if (Object.keys(defaultAT).length > 0) {
                localStorage.setItem(`timetable_arrangement_${className}`, JSON.stringify(defaultAT));
            }
        }
    }

    saveToStorage();
    alert(`Class "${className}" saved successfully!`);
    closeModal('addClassModal');
    populateClassSelector();
    document.getElementById('classSelector').value = className;
    onClassChange();
}

async function submitClassFromJson() {
    const jsonString = document.getElementById('jsonPasteArea').value;
    if (!jsonString) {
        alert('Please paste the JSON data into the text area.');
        return;
    }

    try {
        let data = JSON.parse(jsonString);

        // === NORMALIZE MINIFIED QR FORMAT ===
        // QR codes use compressed keys: n=name, l=lastDate, s=subjects, sc=schedule, h=holidays, tt=timetableArrangement
        const isMinifiedFormat = data.n && data.s && Array.isArray(data.s);

        if (isMinifiedFormat) {
            console.log('Detected minified QR format, normalizing...');
            const className = data.n;
            const normalizedData = {
                [className]: {
                    lastDate: data.l || '',
                    qrCode: '',
                    holidays: data.h || [],
                    subjects: (data.s || []).map(sub => ({
                        name: sub.n || '',
                        code: sub.c || '',
                        shortName: sub.sn || '', // If provided
                        schedule: sub.sc || [0, 0, 0, 0, 0, 0, 0]
                    })),
                    timetableArrangement: data.tt || null
                }
            };
            data = normalizedData;
        }

        let className = Object.keys(data)[0];
        if (!className) throw new Error("JSON is missing the top-level class name key.");
        const classData = data[className];

        // Check for duplicates
        const dupResult = checkClassDuplicate(className, classData.subjects, classData.timetableArrangement || classData.timetable || {});
        if (dupResult.status === 'exact_duplicate') {
            alert(`⚠️ Class "${className}" already exists with this exact schedule!`);
            return;
        }
        if (dupResult.status === 'name_conflict') {
            if (confirm(`⚠️ Class "${className}" already exists but has a different schedule.\n\nSave as "${dupResult.suggestedName}" instead?`)) {
                className = dupResult.suggestedName;
            } else {
                return;
            }
        }

        if (!classData.lastDate || !Array.isArray(classData.holidays) || !Array.isArray(classData.subjects)) {
            throw new Error("JSON structure is invalid. Missing 'lastDate', 'holidays', or 'subjects'.");
        }

        if (classData.subjects.length === 0) {
            throw new Error("Class must have at least one subject.");
        }

        // === DETECT AND CONVERT SCHEDULE FORMAT ===
        // Check if using new string format (e.g., ["1", "1,2", "0"]) or old integer format (e.g., [1, 2, 0])
        const isNewFormat = classData.subjects.some(subject => {
            if (!subject.schedule || !Array.isArray(subject.schedule)) return false;
            return subject.schedule.some(val => typeof val === 'string' && val !== '0' && val.includes(','));
        }) || classData.subjects.every(subject => {
            if (!subject.schedule || !Array.isArray(subject.schedule)) return false;
            return subject.schedule.every(val => typeof val === 'string');
        });

        console.log('Schedule format detected:', isNewFormat ? 'NEW (string-based)' : 'OLD (integer-based)');

        // Prepare Timetable Arrangement (Use imported or Generate from schedule)
        let arrangement = classData.timetableArrangement;

        if (isNewFormat && (!arrangement || Object.keys(arrangement).length === 0)) {
            // Generate arrangement from new string schedule format
            arrangement = {};
            const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

            // Calculate max periods per day
            let maxPeriods = 0;
            classData.subjects.forEach(subject => {
                subject.schedule.forEach(daySchedule => {
                    if (daySchedule && daySchedule !== '0') {
                        const periods = String(daySchedule).split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p));
                        if (periods.length > 0) {
                            maxPeriods = Math.max(maxPeriods, Math.max(...periods));
                        }
                    }
                });
            });

            // Build arrangement from schedule strings
            days.forEach((dayName, dayIndex) => {
                arrangement[dayIndex] = Array(maxPeriods).fill(null);

                classData.subjects.forEach(subject => {
                    if (subject.schedule && subject.schedule[dayIndex] && subject.schedule[dayIndex] !== '0') {
                        const periods = String(subject.schedule[dayIndex]).split(',')
                            .map(p => parseInt(p.trim()))
                            .filter(p => !isNaN(p) && p > 0);

                        periods.forEach(periodNum => {
                            if (periodNum > 0 && periodNum <= maxPeriods) {
                                arrangement[dayIndex][periodNum - 1] = subject.code;
                            }
                        });
                    }
                });

                // Clean up trailing nulls
                while (arrangement[dayIndex].length > 0 && arrangement[dayIndex][arrangement[dayIndex].length - 1] === null) {
                    arrangement[dayIndex].pop();
                }
            });

            // Convert subject schedule from string to integer count for internal use
            classData.subjects = classData.subjects.map(subject => ({
                ...subject,
                shortName: subject.shortName || getSubjectShortName(subject.name),
                schedule: subject.schedule.map(daySchedule => {
                    if (!daySchedule || daySchedule === '0') return 0;
                    return String(daySchedule).split(',').filter(p => p.trim() && p.trim() !== '0').length;
                })
            }));
        } else if (!arrangement || Object.keys(arrangement).length === 0) {
            // OLD FORMAT: Generate default timetable
            arrangement = generateDefaultTimetable(classData.subjects);

            // Ensure shortName exists
            classData.subjects = classData.subjects.map(subject => ({
                ...subject,
                shortName: subject.shortName || getSubjectShortName(subject.name)
            }));
        }

        // Store qrCode if provided
        if (classData.qrCode) {
            classData.qrCode = classData.qrCode;
        }

        // Ask user if they want to verify before saving
        const verifyMessage = `⚠️ AI-generated JSON can sometimes have errors, especially in weekly schedules.\n\nDo you want to VERIFY the data before saving?\n\n✅ Click OK to review in form view (recommended for AI-generated JSON)\n❌ Click Cancel to save directly (if copied from a classmate)`;

        const shouldVerify = confirm(verifyMessage);

        if (shouldVerify) {
            // Populate form for verification
            document.getElementById('newClassName').value = className;
            document.getElementById('newClassLastDate').value = classData.lastDate;
            if (document.getElementById('newClassStartDate')) document.getElementById('newClassStartDate').value = classData.semesterStartDate || '';

            // Populate Wizard Data
            wizardSubjectsData = classData.subjects.map(s => ({
                name: s.name,
                code: s.code,
                schedule: s.schedule || [0, 0, 0, 0, 0, 0, 0]
            }));

            // Populate Wizard Timetable from Arrangement
            wizardTimetableData = {};
            for (let d = 0; d < 7; d++) {
                const dayPlan = arrangement ? arrangement[d] : [];
                wizardTimetableData[d] = (dayPlan || []).map(item => {
                    if (!item) return '';
                    return (typeof item === 'object') ? item.code : item;
                });
            }

            // Switch Wizard to Step 2
            wizardCurrentStep = 2;
            document.getElementById('wizardStep1').style.display = 'none';
            document.getElementById('wizardStep2').style.display = 'block';
            document.getElementById('wizardStep3').style.display = 'none';
            updateWizardIndicators(2);
            generateWizardSubjectsForm();

            // Clear and populate holidays
            const holidayList = document.getElementById('holidayList');
            holidayList.innerHTML = '';
            (classData.holidays || []).forEach(dateStr => {
                const li = document.createElement('li');
                li.innerHTML = `<span>${dateStr}</span><button type="button" class="remove-holiday-btn" onclick="this.parentElement.remove()">Remove</button>`;
                holidayList.appendChild(li);
            });

            // Switch to form tab for verification
            switchModalTab('form');
            alert('✅ Data loaded into form.\n\nPlease VERIFY the Weekly Schedule for each subject, then click "Save Class".');
        } else {
            // Save directly without verification
            const existingClass = classes[className] || {};

            // === EXTRACT AND SAVE EXTERNAL DATA (MATCHING EXPORT LOGIC) ===
            if (classData.periodTimes) {
                localStorage.setItem(`periodTimes_${className}`, JSON.stringify(classData.periodTimes));
                // We don't delete it because having it in class object acts as a fallback/cache in some places
            }
            if (classData.customSchedules) {
                localStorage.setItem(`custom_schedules_${className}`, JSON.stringify(classData.customSchedules));
                delete classData.customSchedules; // Cleanup
            }
            if (classData.notificationSettings) {
                localStorage.setItem(`notificationSettings_${className}`, JSON.stringify(classData.notificationSettings));
                delete classData.notificationSettings; // Cleanup
            }

            classes[className] = { ...existingClass, ...classData };

            // Generate Shared ID
            if (window.SocialManager) {
                classes[className].sharedId = await window.SocialManager.generateSharedClassId(classes[className]);
            }

            // Save timetable arrangement
            if (arrangement) {
                localStorage.setItem(`timetable_arrangement_${className}`, JSON.stringify(arrangement));
            }

            saveToStorage();
            alert(`Class "${className}" imported successfully!`);
            closeModal('addClassModal');
            populateClassSelector();
            document.getElementById('classSelector').value = className;
            onClassChange();
        }
    } catch (error) {
        alert(`Error processing JSON: ${error.message}\nPlease ensure the pasted text is valid and matches the required format.`);
    }
}

// === AI IMPORT FUNCTIONS ===
function updateAIFileCount(fileInput) {
    const count = fileInput.files.length;
    const countDiv = document.getElementById('aiFileCount');
    if (count > 0) {
        countDiv.textContent = `✅ ${count} file${count > 1 ? 's' : ''} selected`;
    } else {
        countDiv.textContent = '';
    }
}

// Duplicate function deleted to prevent conflict with updated version at line 15925
// RE-IMPLEMENTED: Inbuilt AI Import Logic
async function handleAIClassImport() {
    const fileInput = document.getElementById('aiImportFiles');
    const textInput = document.getElementById('aiImportText');
    const loadingDiv = document.getElementById('aiImportLoading');

    if (!fileInput.files.length && !textInput.value.trim()) {
        alert('Please upload a file or enter some text details.');
        return;
    }

    // Show loading
    if (loadingDiv) loadingDiv.style.display = 'block';

    try {
        // 1. Prepare Images
        const imageParts = [];
        for (const file of fileInput.files) {
            const base64 = await fileToBase64(file);
            imageParts.push({
                inlineData: {
                    data: base64.split(',')[1],
                    mimeType: file.type
                }
            });
        }

        // 2. Prepare Prompt
        const userNotes = textInput.value.trim();
        const prompt = `You are a Data Entry Assistant for a college attendance app.
Your task is to extract CLASS TIMETABLE and DETAILS from the user's images (screenshots of timetable, calendar, etc.) and text notes.

USER NOTES: "${userNotes}"

OUTPUT FORMAT:
Return a valid JSON object matching this structure EXACTLY:
{
  "ClassName": {
    "lastDate": "YYYY-MM-DD",
    "holidays": ["YYYY-MM-DD", "YYYY-MM-DD"],
    "subjects": [
      {
        "name": "Subject Name",
        "code": "SUB101",
        "shortName": "SUB",
        "schedule": ["1,2", "0", "3", "0", "0", "0", "0"]
      }
    ],
    "timetableArrangement": {} 
  }
}

RULES:
1. "ClassName": Use a short, descriptive name (e.g., "Semester 4").
2. "lastDate": The last working day of the semester. If unknown, estimate 4 months from now.
3. "holidays": List of holiday dates (YYYY-MM-DD). Use the user's notes and any visible calendar info.
4. "subjects": Extract all subjects.
   - "schedule": An array of 7 strings (Index 0 = Monday, ..., 6 = Sunday).
   - "0" means no class.
   - "1,2" means class is in Period 1 and Period 2.
   - "1" means class is in Period 1 only.
   - If exact period numbers are not visible, just use "1" for 1 hour, "1,2" for 2 hours, etc.
5. If the image is unclear, do your best to guess based on standard college patterns.
6. RETURN ONLY JSON. NO MARKDOWN FORMATTING. NO EXPLANATIONS.`;

        // 3. Call API (Reuse logic from handleLogScreenshot)
        const personalKey = localStorage.getItem('personalGeminiKey');
        let response;

        if (personalKey) {
            response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${personalKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{ text: prompt }, ...imageParts]
                        }]
                    })
                }
            );
        } else {
            // Use backend proxy (Limited to 1 image for safety if using simple proxy)
            // If multiple images are selected, we perform best-effort with the first one + text
            const imageData = imageParts.length > 0 ? imageParts[0].inlineData.data : null;

            response = await fetch('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'vision',
                    prompt: prompt,
                    imageData: imageData, // Proxy usually expects single image
                    mimeType: imageParts.length > 0 ? fileInput.files[0].type : null
                })
            });
        }

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const result = await response.json();
        let generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // Clean JSON
        if (generatedText.includes('```json')) {
            generatedText = generatedText.split('```json')[1].split('```')[0].trim();
        } else if (generatedText.includes('```')) {
            generatedText = generatedText.split('```')[1].split('```')[0].trim();
        }

        // 4. Fill and Submit
        const jsonDetailsArea = document.getElementById('jsonPasteArea');
        if (jsonDetailsArea) {
            jsonDetailsArea.value = generatedText;
            // Determine if submitClassFromJson exists
            if (typeof submitClassFromJson === 'function') {
                submitClassFromJson();
            } else {
                alert("Error: Verification function missing. JSON pasted below for manual checking.");
            }
        }

    } catch (error) {
        console.error(error);
        alert('AI Error: ' + error.message + '\n\nPlease try again or use manual entry.');
    } finally {
        if (loadingDiv) loadingDiv.style.display = 'none';
        // Reset input? No, keep it in case of retry.
    }
}

// Helper function to convert file to base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function generateLeavePlanner() {
    const container = document.getElementById('leavePlannerSection');
    if (!container) return;
    container.innerHTML = `
                <div class="subject-card" style="border-left-color: var(--warning-color);">
                    <div class="subject-title">🗓️ Leave & Event Planner</div>
                    <p>Add planned leaves and compulsory events to get an accurate calculation of your maximum safe leave days.</p>
                    
                    <h4 style="margin-top: 20px;">🏖️ Planned Leaves</h4>
                    <div id="leavePeriodsContainer" style="margin-top: 10px;"></div>
                    <button class="add-leave-period-btn" onclick="addLeavePeriod()">+ Add Leave Period</button>

                    <h4 style="margin-top: 20px;">📌 Compulsory Events</h4>
                     <p style="font-size:0.9rem; color: var(--medium-text);">Add specific dates you absolutely must attend.</p>
                    <div id="compulsoryPeriodsContainer" style="margin-top: 10px;"></div>
                    <button class="add-compulsory-period-btn" onclick="addCompulsoryPeriod()">+ Add Compulsory Period</button>

                    <button class="btn warning-btn" onclick="calculateMaxSafeLeave()" style="margin-top: 25px; display: block; margin-left: auto; margin-right: auto;">Recalculate Max Safe Leave</button>
                    <button id="btnMaxBunk" class="btn danger-btn" onclick="calculateMaxPossibleBunk()" style="margin-top: 10px; display: block; margin-left: auto; margin-right: auto;">🚫 Max Possible Bunk (Avoid Detention)</button>
                    
                    <div id="leaveImpactResults" style="margin-top: 20px;"></div>
                </div>`;
    addLeavePeriod();
    addCompulsoryPeriod();

    // Ensure button visibility is correct immediately based on current settings
    if (typeof validateMedicalSettings === 'function') {
        validateMedicalSettings();
    }
}

// Add container for max possible bunk results below maxLeaveRecommendation
// The actual container already exists in HTML at line 2301

function addLeavePeriod() {
    const container = document.getElementById('leavePeriodsContainer');
    const newPeriod = document.createElement('div');
    newPeriod.className = 'leave-period-entry';

    // Get date constraints
    const minDate = selectedClass?.portalSetup?.semesterStartDate || document.getElementById('currentDate').value;
    const maxDate = document.getElementById('lastDate').value;

    newPeriod.innerHTML = `<label>From:</label><input type="date" class="leave-start-date" min="${minDate}" max="${maxDate}" onchange="syncLeaveEndDate(this); checkForConflicts();"><label>To:</label><input type="date" class="leave-end-date" min="${minDate}" max="${maxDate}" onchange="checkForConflicts();"><button class="remove-leave-period-btn" onclick="this.parentElement.remove(); checkForConflicts();">×</button>`;
    container.appendChild(newPeriod);
}

function addCompulsoryPeriod() {
    const container = document.getElementById('compulsoryPeriodsContainer');
    const newPeriod = document.createElement('div');
    newPeriod.className = 'compulsory-period-entry';

    // Get date constraints
    const minDate = selectedClass?.portalSetup?.semesterStartDate || document.getElementById('currentDate').value;
    const maxDate = document.getElementById('lastDate').value;

    newPeriod.innerHTML = `<label>From:</label><input type="date" class="compulsory-start-date" min="${minDate}" max="${maxDate}" onchange="syncLeaveEndDate(this); checkForConflicts();"><label>To:</label><input type="date" class="compulsory-end-date" min="${minDate}" max="${maxDate}" onchange="checkForConflicts();"><button class="remove-compulsory-period-btn" onclick="this.parentElement.remove(); checkForConflicts();">×</button>`;
    container.appendChild(newPeriod);
}

function syncLeaveEndDate(startDateInput) { const endDateInput = startDateInput.parentElement.querySelector('[class$="-end-date"]'); if (!endDateInput.value || endDateInput.value < startDateInput.value) { endDateInput.value = startDateInput.value; } }

function checkForConflicts() {
    const leaveEntries = document.querySelectorAll('.leave-period-entry');
    const compulsoryEntries = document.querySelectorAll('.compulsory-period-entry');
    let conflictFound = false;

    // Reset all leave entries first
    leaveEntries.forEach(l => l.classList.remove('unsafe-leave'));

    compulsoryEntries.forEach(c => {
        const cStartValue = c.querySelector('.compulsory-start-date').value;
        const cEndValue = c.querySelector('.compulsory-end-date').value;
        if (!cStartValue || !cEndValue) return;

        const cStart = new Date(cStartValue + 'T00:00:00');
        const cEnd = new Date(cEndValue + 'T23:59:59');

        leaveEntries.forEach(l => {
            const lStartValue = l.querySelector('.leave-start-date').value;
            const lEndValue = l.querySelector('.leave-end-date').value;
            if (!lStartValue || !lEndValue) return;

            const lStart = new Date(lStartValue + 'T00:00:00');
            const lEnd = new Date(lEndValue + 'T23:59:59');

            // Check for overlap: (StartA <= EndB) and (EndA >= StartB)
            if (cStart <= lEnd && cEnd >= lStart) {
                l.classList.add('unsafe-leave');
                if (!conflictFound) {
                    alert('Warning: A planned leave period overlaps with a compulsory event. This leave is not safe and has been highlighted.');
                    conflictFound = true;
                }
            }
        });
    });
}

function calculateLeaveImpact() {
    const resultsDiv = document.getElementById('leaveImpactResults');
    if (currentAnalysisData.length === 0) { alert("Please calculate your attendance first."); return; }

    const leavePeriods = [];
    let lastLeaveDate = null;
    document.querySelectorAll('.leave-period-entry').forEach(p => {
        const start = p.querySelector('.leave-start-date').value;
        const end = p.querySelector('.leave-end-date').value;
        if (start && end && start <= end) {
            const endDate = new Date(end + 'T00:00:00');
            leavePeriods.push({ start: new Date(start + 'T00:00:00'), end: endDate });
            if (!lastLeaveDate || endDate > lastLeaveDate) {
                lastLeaveDate = endDate;
            }
        }
    });

    if (leavePeriods.length === 0) {
        resultsDiv.innerHTML = '';
        return;
    }

    const holidayDates = (selectedClass.holidays || []).map(h => new Date(h + 'T00:00:00'));
    const currentDate = new Date(document.getElementById('currentDate').value + 'T00:00:00');

    resultsDiv.innerHTML = '<h4>Planned Leave Impact Analysis:</h4>';

    if (isOverallMode()) {
        const overall = currentAnalysisData.reduce((acc, subject) => {
            acc.attended += subject.attended;
            acc.totalHeld += subject.totalHeld;
            acc.remaining += subject.remaining;
            subject.schedule.forEach((val, i) => acc.schedule[i] = (acc.schedule[i] || 0) + parseScheduleValue(val));
            return acc;
        }, { attended: 0, totalHeld: 0, remaining: 0, schedule: Array(7).fill(0) });

        let classesMissed = 0;
        leavePeriods.forEach(period => { classesMissed += countClassesInRange(period.start, period.end, overall.schedule, holidayDates, 'overall'); });

        const finalTotal = overall.totalHeld + overall.remaining;
        const newAttended = overall.attended + overall.remaining - classesMissed;
        const newPercent = finalTotal > 0 ? (newAttended / finalTotal) * 100 : 0;
        const oldPercent = finalTotal > 0 ? ((overall.attended + overall.remaining) / finalTotal) * 100 : 0;

        let classesHeldUntilReturn = countClassesInRange(new Date(currentDate.getTime() + 86400000), lastLeaveDate, overall.schedule, holidayDates, 'overall');
        let classesMissedUntilReturn = 0;
        leavePeriods.forEach(p => classesMissedUntilReturn += countClassesInRange(p.start, p.end > lastLeaveDate ? lastLeaveDate : p.end, overall.schedule, holidayDates, 'overall'));
        const totalOnReturn = overall.totalHeld + classesHeldUntilReturn;
        const attendedOnReturn = overall.attended + classesHeldUntilReturn - classesMissedUntilReturn;
        const percentOnReturn = totalOnReturn > 0 ? (attendedOnReturn / totalOnReturn) * 100 : 0;

        resultsDiv.innerHTML += generateImpactHTML("Overall", oldPercent, newPercent, percentOnReturn, newPercent < getMinAttendanceCriteria() * 100);

    } else {
        currentAnalysisData.forEach(subject => {
            const { attended, totalHeld, remaining, schedule } = subject;
            let totalClassesMissed = 0;
            leavePeriods.forEach(period => { totalClassesMissed += countClassesInRange(period.start, period.end, schedule, holidayDates, subject.code); });

            const finalTotal = totalHeld + remaining;
            const newAttended = attended + remaining - totalClassesMissed;
            const oldPercent = finalTotal > 0 ? (((attended + remaining) / finalTotal) * 100) : 0;
            const newPercent = finalTotal > 0 ? ((newAttended / finalTotal) * 100) : 0;

            let classesHeldUntilReturn = countClassesInRange(new Date(currentDate.getTime() + 86400000), lastLeaveDate, schedule, holidayDates, subject.code);
            let classesMissedUntilReturn = 0;
            leavePeriods.forEach(p => classesMissedUntilReturn += countClassesInRange(p.start, p.end > lastLeaveDate ? lastLeaveDate : p.end, schedule, holidayDates, subject.code));
            const totalOnReturn = totalHeld + classesHeldUntilReturn;
            const attendedOnReturn = attended + classesHeldUntilReturn - classesMissedUntilReturn;
            const percentOnReturn = totalOnReturn > 0 ? (attendedOnReturn / totalOnReturn) * 100 : 0;

            resultsDiv.innerHTML += generateImpactHTML(subject.name, oldPercent, newPercent, percentOnReturn, newPercent < getMinAttendanceCriteria() * 100);
        });
    }

    // Trigger Medical Certificate Recommendation Update
    recommendMedicalCertificates();
}

function generateImpactHTML(name, oldP, newP, returnP, isDanger) {
    const minCriteriaPercent = getMinAttendanceCriteria() * 100;
    return `<div class="stat-item" style="display: block; text-align: left; padding: 10px; margin-bottom: 8px;">
                                                <div style="display:flex; justify-content: space-between; align-items: center; font-weight: 600;">
                                                    <span>${name}</span>
                                                    <span>Final: ${oldP.toFixed(1)}% → <strong class="${isDanger ? 'danger' : 'success'}" style="color:${isDanger ? 'var(--danger-color)' : 'var(--success-grad-start)'};">${newP.toFixed(1)}%</strong></span>
                                                </div>
                                                <div style="font-size:0.9rem; margin-top:5px; color: var(--medium-text);">
                                                    On return, your attendance will be <strong>${returnP.toFixed(1)}%</strong>.
                                                    ${newP < minCriteriaPercent ? `<span style="color:var(--danger-color); font-weight:bold;"> (Below ${minCriteriaPercent}%)</span>` : ''}
                                                </div>
                                            </div>`;
}

function getPlannedLeaveCost(schedule, subjectCode) {
    const leavePeriods = [];
    document.querySelectorAll('.leave-period-entry').forEach(p => {
        const start = p.querySelector('.leave-start-date').value;
        const end = p.querySelector('.leave-end-date').value;
        if (start && end && start <= end) {
            leavePeriods.push({ start: new Date(start + 'T00:00:00'), end: new Date(end + 'T00:00:00') });
        }
    });
    if (leavePeriods.length === 0) return 0;

    const holidayDates = (selectedClass.holidays || []).map(h => new Date(h + 'T00:00:00'));
    let totalMissed = 0;
    leavePeriods.forEach(p => {
        totalMissed += countClassesInRange(p.start, p.end, schedule, holidayDates, subjectCode);
    });
    return totalMissed;
}

function recommendMedicalCertificates() {
    const container = document.getElementById('medicalLeaveSection');

    // Always show the section, but display setup messages if needed
    container.style.display = 'block';

    // Check if Portal Mode is active
    if (!selectedClass || !selectedClass.portalSetup || !selectedClass.portalSetup.active) {
        container.innerHTML = `
                    <div class="subject-card" style="border-left-color: var(--info-color);">
                        <div class="subject-title">💊 Medical Certificate Opportunity</div>
                        <div style="background: rgba(52, 152, 219, 0.1); padding: 20px; border-radius: 8px; border-left: 4px solid var(--info-color); text-align: center;">
                            <p style="color: var(--info-color); font-weight: bold; margin-bottom: 10px;">📋 Portal Mode Recommended</p>
                            <p style="margin-bottom: 15px;">For accurate Medical Certificate recommendations, switch to <strong>Portal Mode</strong> where you can track daily attendance logs.</p>
                            <p style="margin-bottom: 15px; font-size: 0.9rem; color: var(--medium-text);">Standard calculation mode provides instant analysis, but Portal Mode gives you ML recommendations based on your actual attendance history.</p>
                            <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                                <button class="btn primary-btn" onclick="openPortalSetup()" style="margin-top: 10px;">🎓 Setup Portal Mode</button>
                                ${document.getElementById('standardModeToggle') ? '<button class="btn secondary-btn" onclick="switchBackToPortal()" style="margin-top: 10px;">↩️ Return to Portal</button>' : ''}
                            </div>
                        </div>
                    </div>`;
        return;
    }

    const semesterStartDate = selectedClass.portalSetup.semesterStartDate;
    if (!semesterStartDate) {
        container.innerHTML = `
                    <div class="subject-card" style="border-left-color: var(--warning-color);">
                        <div class="subject-title">💊 Medical Certificate Opportunity</div>
                        <div style="background: rgba(255, 193, 7, 0.1); padding: 20px; border-radius: 8px; border-left: 4px solid var(--warning-color); text-align: center;">
                            <p style="color: var(--warning-color); font-weight: bold; margin-bottom: 10px;">📅 Semester Start Date Required</p>
                            <p style="margin-bottom: 15px;">Please set your <strong>Semester Start Date</strong> in Portal Settings to get Medical Certificate recommendations.</p>
                            <button class="btn warning-btn" onclick="openPortalSetup()" style="margin-top: 10px;">⚙️ Open Portal Settings</button>
                        </div>
                    </div>`;
        return;
    }

    const isOverall = isOverallMode();
    let activeStats = null;

    if (isOverall) {
        let totalAttended = 0, totalHeld = 0, totalRemaining = 0, totalPlannedMissed = 0;

        currentAnalysisData.forEach(sub => {
            totalAttended += sub.attended;
            totalHeld += sub.totalHeld;
            totalRemaining += sub.remaining;
            totalPlannedMissed += getPlannedLeaveCost(sub.schedule, sub.code);
        });

        const finalTotal = totalHeld + totalRemaining;
        const projectedAttended = totalAttended + totalRemaining - totalPlannedMissed;
        const maxPossiblePercent = finalTotal > 0 ? (projectedAttended / finalTotal) * 100 : 0;

        activeStats = {
            name: "Overall",
            code: "OVERALL",
            finalTotal,
            projectedAttended,
            maxPossiblePercent
        };
    } else {
        // Per-Subject Mode: Find Bottleneck
        let minMaxPercent = 101;
        currentAnalysisData.forEach(sub => {
            const plannedMissed = getPlannedLeaveCost(sub.schedule, sub.code);
            const finalTotal = sub.totalHeld + sub.remaining;
            const projectedAttended = sub.attended + sub.remaining - plannedMissed;
            const maxPossiblePercent = finalTotal > 0 ? (projectedAttended / finalTotal) * 100 : 0;

            if (maxPossiblePercent < minMaxPercent) {
                minMaxPercent = maxPossiblePercent;
                activeStats = {
                    name: sub.name,
                    code: sub.code,
                    finalTotal,
                    projectedAttended,
                    maxPossiblePercent
                };
            }
        });
    }

    if (!activeStats) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    let html = `<div class="subject-card" style="border-left-color: var(--secondary-grad-end);">
                <div class="subject-title">🏥 Medical Certificate Opportunity</div>`;

    const minCriteria = getMinAttendanceCriteria() * 100;
    const condonationThreshold = getMinMedicalCriteria();

    if (activeStats.maxPossiblePercent >= minCriteria) {
        // CONDITION A: SAFE
        html += `<p>You don't need a medical certificate. You can meet the requirements by attending regular classes. Your max possible attendance (after planned leaves) is <strong style="color: var(--success-grad-start);">${activeStats.maxPossiblePercent.toFixed(1)}%</strong>.</p>`;
    } else if (activeStats.maxPossiblePercent < condonationThreshold) {
        // CONDITION C: CRITICAL
        html += `<p style="color: var(--danger-color);"><strong>🛑 Critical:</strong> Even with Medical Leave condonation, your projected max attendance (after planned leaves) is <strong>${activeStats.maxPossiblePercent.toFixed(1)}%</strong>, which is too low to be saved.</p>`;
    } else {
        // CONDITION B: CONDONATION NEEDED
        const targetAttended = Math.ceil((minCriteria / 100) * activeStats.finalTotal);
        const deficitClasses = targetAttended - activeStats.projectedAttended;

        html += `<p style="margin-bottom: 15px;">⚠️ <strong>Warning:</strong> After accounting for your <strong>Planned Leaves</strong>, your max possible attendance drops to <strong>${activeStats.maxPossiblePercent.toFixed(1)}%</strong>. You need to apply for Medical Leave (ML) to cross <strong>${minCriteria}%</strong>.</p>`;
        html += `<p style="margin-bottom: 15px;">You need to cover a deficit of <strong>${deficitClasses} class(es)</strong>.</p>`;

        // Date Suggestion Algorithm
        const logs = JSON.parse(localStorage.getItem('attendance_logs')) || {};
        const start = new Date(semesterStartDate);

        // Helper to check if a date is a planned leave and get all planned leave periods
        const plannedLeavePeriods = [];
        document.querySelectorAll('.leave-period-entry').forEach(p => {
            const s = p.querySelector('.leave-start-date').value;
            const e = p.querySelector('.leave-end-date').value;
            if (s && e) {
                plannedLeavePeriods.push({
                    start: new Date(s + 'T00:00:00'),
                    end: new Date(e + 'T00:00:00')
                });
            }
        });

        const isPlannedLeave = (d) => {
            const time = d.getTime();
            return plannedLeavePeriods.some(p => time >= p.start.getTime() && time <= p.end.getTime());
        };

        // Find the last (most recent) planned leave end date
        let lastPlannedLeaveEnd = null;
        plannedLeavePeriods.forEach(p => {
            if (!lastPlannedLeaveEnd || p.end > lastPlannedLeaveEnd) {
                lastPlannedLeaveEnd = p.end;
            }
        });

        // Extend end date to include all planned leaves (even future ones)
        let endDate = new Date(); // Today
        if (lastPlannedLeaveEnd && lastPlannedLeaveEnd > endDate) {
            endDate = lastPlannedLeaveEnd;
        }

        const validDates = [];

        for (let d = new Date(start); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = formatLocalDate(d);
            const isPlanned = isPlannedLeave(new Date(d));

            // Include both logged skipped dates AND planned leave dates
            if (logs[dateStr] || isPlanned) {
                let skippedCount = 0;

                if (isPlanned) {
                    // For planned leave dates, count all classes that would be skipped
                    if (isOverall) {
                        selectedClass.subjects.forEach(sub => {
                            const dayOfWeek = d.getDay();
                            const scheduleIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                            skippedCount += parseScheduleValue(sub.schedule[scheduleIndex]);
                        });
                    } else {
                        const subject = selectedClass.subjects.find(s => s.code === activeStats.code);
                        if (subject) {
                            const dayOfWeek = d.getDay();
                            const scheduleIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                            skippedCount += parseScheduleValue(subject.schedule[scheduleIndex]);
                        }
                    }
                } else if (logs[dateStr]) {
                    // For logged dates, check actual status
                    const dailyLog = logs[dateStr];

                    if (isOverall) {
                        selectedClass.subjects.forEach(sub => {
                            const status = dailyLog[sub.code];
                            if (status === 'Skipped' || status === 'Absent') {
                                const dayOfWeek = d.getDay();
                                const scheduleIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                                skippedCount += parseScheduleValue(sub.schedule[scheduleIndex]);
                            }
                        });
                    } else {
                        const status = dailyLog[activeStats.code];
                        if (status === 'Skipped' || status === 'Absent') {
                            const dayOfWeek = d.getDay();
                            const scheduleIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                            const subject = selectedClass.subjects.find(s => s.code === activeStats.code);
                            skippedCount += subject ? parseScheduleValue(subject.schedule[scheduleIndex]) : 0;
                        }
                    }
                }

                if (skippedCount > 0) {
                    // Calculate distance from last planned leave end date
                    let distanceFromPlannedLeaveEnd = Infinity;
                    if (lastPlannedLeaveEnd) {
                        distanceFromPlannedLeaveEnd = Math.abs(d - lastPlannedLeaveEnd) / (1000 * 60 * 60 * 24);
                    }

                    validDates.push({
                        date: new Date(d),
                        count: skippedCount,
                        dateStr,
                        isPlannedLeave: isPlanned,
                        distanceFromPlannedEnd: distanceFromPlannedLeaveEnd
                    });
                }
            }
        }

        // Sort by distance from planned leave end (closer to planned leave end = higher priority)
        validDates.sort((a, b) => {
            // First priority: dates closer to last planned leave end date
            if (a.distanceFromPlannedEnd !== b.distanceFromPlannedEnd) {
                return a.distanceFromPlannedEnd - b.distanceFromPlannedEnd;
            }
            // Second priority: more recent dates
            return b.date - a.date;
        });

        // Find Consecutive Blocks
        const blocks = [];
        if (validDates.length > 0) {
            let currentBlock = [validDates[0]];
            let currentSum = validDates[0].count;

            for (let i = 1; i < validDates.length; i++) {
                const prevDate = validDates[i - 1].date;
                const currDate = validDates[i].date;
                const diffDays = Math.abs((currDate - prevDate) / (1000 * 60 * 60 * 24));

                if (diffDays === 1) {
                    currentBlock.push(validDates[i]);
                    currentSum += validDates[i].count;
                } else {
                    blocks.push({ dates: currentBlock, total: currentSum });
                    currentBlock = [validDates[i]];
                    currentSum = validDates[i].count;
                }
            }
            blocks.push({ dates: currentBlock, total: currentSum });
        }

        // Strategy: Find a single block that satisfies deficit
        let bestBlock = null;
        for (const block of blocks) {
            if (block.total >= deficitClasses) {
                bestBlock = block;
                break; // Since blocks are sorted by recency, the first one we find is the most recent sufficient block
            }
        }

        if (bestBlock) {
            // We found a consecutive block
            const startDate = bestBlock.dates[bestBlock.dates.length - 1].dateStr;
            const endDate = bestBlock.dates[0].dateStr;
            const days = bestBlock.dates.length;
            html += `<div style="background: var(--light-bg); padding: 15px; border-radius: 8px;">
                        <h4 style="margin-bottom: 10px;">Recommended Dates (Consecutive):</h4>
                        <ul style="list-style-position: inside; padding-left: 0;">
                            <li><strong>${days} Day(s)</strong> from ${startDate} to ${endDate} (Covers ${bestBlock.total} classes)</li>
                        </ul>
                        <p style="font-size: 0.85rem; color: var(--medium-text); margin-top: 10px;">Applying ML for this period will help you reach the target.</p>
                    </div>`;
        } else {
            // Fallback: Pick dates (prioritized by distance to planned leave) until deficit is covered
            let accumulatedClasses = 0;
            const selectedDates = [];

            // Keep adding dates until we have enough to cover the deficit
            for (const item of validDates) {
                selectedDates.push(item);
                accumulatedClasses += item.count;

                // Stop when we have enough
                if (accumulatedClasses >= deficitClasses) {
                    break;
                }
            }

            if (accumulatedClasses >= deficitClasses) {
                html += `<div style="background: var(--light-bg); padding: 15px; border-radius: 8px;">
                            <h4 style="margin-bottom: 10px;">Recommended Dates (Strategic):</h4>
                            <ul style="list-style-position: inside; padding-left: 0;">`;
                selectedDates.forEach(d => {
                    const dateLabel = d.isPlannedLeave ? `${d.dateStr} (${d.count} classes) 📅 Planned Leave` : `${d.dateStr} (${d.count} classes)`;
                    html += `<li>${dateLabel}</li>`;
                });
                html += `</ul>
                            <p style="font-size: 0.85rem; color: var(--medium-text); margin-top: 10px;">Applying ML for these dates will cover ${accumulatedClasses} classes. Dates are prioritized near your planned leave periods.</p>
                        </div>`;
            } else {
                // Check if logs are incomplete (missing dates)
                const today = new Date();
                const semStart = new Date(semesterStartDate);
                let totalWorkingDays = 0;
                let loggedDays = 0;

                for (let d = new Date(semStart); d <= today; d.setDate(d.getDate() + 1)) {
                    const dateStr = formatLocalDate(d);
                    const check = isHolidayOrNoClass(dateStr);

                    if (!check.isHoliday) {
                        totalWorkingDays++;
                        if (logs[dateStr]) loggedDays++;
                    }
                }

                const logsComplete = loggedDays >= totalWorkingDays * 0.9; // 90% threshold

                if (!logsComplete) {
                    // Incomplete logs
                    html += `<div style="background: rgba(255, 193, 7, 0.1); padding: 15px; border-radius: 8px; border-left: 4px solid var(--warning-color);">
                                <p style="color: var(--warning-color); font-weight: bold; margin-bottom: 5px;">⚠️ Incomplete Daily Logs Detected</p>
                                <p><strong>Issue:</strong> You need ${deficitClasses} classes for ML, but only found ${accumulatedClasses} classes from available dates.</p>
                                <p style="margin-top: 10px;"><strong>📊 Log Status:</strong> ${loggedDays} out of ${totalWorkingDays} working days logged (${((loggedDays / totalWorkingDays) * 100).toFixed(0)}%)</p>
                                <p style="margin-top: 10px; font-size: 0.9rem;"><strong>✅ Action Required:</strong></p>
                                <ul style="margin-left: 20px; margin-top: 5px; font-size: 0.9rem;">
                                    <li>Complete your <strong>Daily Logs</strong> from <strong>${semesterStartDate}</strong> to today</li>
                                    <li>Mark days you were absent as "Skipped"</li>
                                    <li>Once complete, the system will find ML dates automatically</li>
                                </ul>
                                <p style="margin-top: 10px; padding: 10px; background: rgba(52, 152, 219, 0.1); border-radius: 5px; font-size: 0.85rem;">
                                    💡 <strong>Tip:</strong> Visit <strong>Edit History</strong> to see your Portal Status and quickly add missing logs.
                                </p>
                            </div>`;
                } else {
                    // Logs complete but insufficient absents
                    const plannedLeaveCount = validDates.filter(d => d.isPlannedLeave).length;
                    const skippedCount = validDates.filter(d => !d.isPlannedLeave).length;

                    html += `<div style="background: rgba(231, 76, 60, 0.1); padding: 15px; border-radius: 8px; border-left: 4px solid var(--danger-color);">
                                <p style="color: var(--danger-color); font-weight: bold; margin-bottom: 5px;">❌ Insufficient Full-Day Absents</p>
                                <p><strong>Issue:</strong> You need ${deficitClasses} classes for ML, but only have ${accumulatedClasses} classes available.</p>
                                <p style="margin-top: 10px;"><strong>📊 Available Dates:</strong></p>
                                <ul style="margin-left: 20px; margin-top: 5px;">
                                    <li><strong>${skippedCount}</strong> past absence dates (${validDates.filter(d => !d.isPlannedLeave).reduce((sum, d) => sum + d.count, 0)} classes)</li>
                                    <li><strong>${plannedLeaveCount}</strong> planned leave dates (${validDates.filter(d => d.isPlannedLeave).reduce((sum, d) => sum + d.count, 0)} classes)</li>
                                    <li><strong>Total: ${accumulatedClasses}</strong> classes (need ${deficitClasses})</li>
                                </ul>
                                <p style="margin-top: 15px; font-size: 0.9rem;"><strong>💡 Possible Solutions:</strong></p>
                                <ul style="margin-left: 20px; margin-top: 5px; font-size: 0.9rem;">
                                    <li><strong>Option 1:</strong> Reduce your planned leaves to lower the attendance requirement</li>
                                    <li><strong>Option 2:</strong> The deficit is too large to be covered by medical certificates alone</li>
                                    <li><strong>Option 3:</strong> Attend more remaining classes to improve your baseline attendance</li>
                                </ul>
                                <p style="margin-top: 10px; padding: 10px; background: rgba(52, 152, 219, 0.1); border-radius: 5px; font-size: 0.85rem;">
                                    ℹ️ <strong>Note:</strong> Medical certificates can only cover full-day absences. Partial attendance days cannot be converted to ML.
                                </p>
                            </div>`;
                }
            }
        }
    }

    html += `</div>`;
    container.innerHTML = html;
}

function calculateMaxSafeLeave() {
    calculateLeaveImpact(); // Run impact analysis first
    const container = document.getElementById('maxLeaveRecommendation');

    // Check if any subject's max possible attendance is below minimum required
    const minCriteria = getMinAttendanceCriteria() * 100;
    const unrecoverableSubjects = currentAnalysisData.filter(subject => {
        const finalTotal = subject.totalHeld + subject.remaining;
        const maxPossibleAttended = subject.attended + subject.remaining;
        const maxPossiblePercent = finalTotal > 0 ? (maxPossibleAttended / finalTotal) * 100 : 0;
        return maxPossiblePercent < minCriteria;
    });

    // If any subject is unrecoverable, show warning with option to exclude those subjects
    if (unrecoverableSubjects.length > 0) {
        container.style.display = 'block';
        const subjectNames = unrecoverableSubjects.map(s => s.name).join(', ');
        const excludeCodes = unrecoverableSubjects.map(s => s.code).join(',');
        container.innerHTML = `
                        <div class="subject-card" style="border-left-color: var(--danger-color);">
                            <div class="subject-title">⚠️ Max Safe Leave Unavailable</div>
                            <p style="color: var(--danger-color);">
                                <strong>Cannot calculate safe leave dates.</strong><br><br>
                                The following subject(s) cannot reach ${minCriteria}% minimum attendance even if you attend all remaining classes:<br>
                                <strong>${subjectNames}</strong><br><br>
                                Focus on attending all classes for these subjects. Consider applying for medical certificates if eligible.
                            </p>
                            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--border-color);">
                                <p style="font-size: 0.9rem; color: var(--medium-text); margin-bottom: 10px;">
                                    💡 Want to see leave days where you <strong>won't miss</strong> these critical subjects?
                                </p>
                                <button class="btn info-btn" onclick="calculateMaxSafeLeaveExcluding('${excludeCodes}')" style="padding: 10px 20px;">
                                    🔍 Show Safe Leave (Excluding ${unrecoverableSubjects.length > 1 ? 'These Subjects' : 'This Subject'})
                                </button>
                            </div>
                        </div>`;
        return;
    }

    const currentDate = new Date(document.getElementById('currentDate').value + 'T00:00:00');
    const lastDate = new Date(document.getElementById('lastDate').value + 'T00:00:00');
    const holidayDates = (selectedClass.holidays || []).map(h => new Date(h + 'T00:00:00'));

    // Get planned leave and compulsory dates
    const leavePeriods = Array.from(document.querySelectorAll('.leave-period-entry')).map(p => ({ start: p.querySelector('.leave-start-date').value, end: p.querySelector('.leave-end-date').value })).filter(d => d.start && d.end);
    const compulsoryPeriods = Array.from(document.querySelectorAll('.compulsory-period-entry')).map(p => ({ start: p.querySelector('.compulsory-start-date').value, end: p.querySelector('.compulsory-end-date').value })).filter(d => d.start && d.end);

    const leaveDateSet = new Set();
    leavePeriods.forEach(p => { for (let d = new Date(p.start); d <= new Date(p.end); d.setDate(d.getDate() + 1)) { leaveDateSet.add(d.setHours(0, 0, 0, 0)); } });

    const compulsoryDateSet = new Set();
    compulsoryPeriods.forEach(p => { for (let d = new Date(p.start); d <= new Date(p.end); d.setDate(d.getDate() + 1)) { compulsoryDateSet.add(d.setHours(0, 0, 0, 0)); } });


    let resultHTML = `<div class="subject-card" style="border-left-color: var(--success-grad-end);"><div class="subject-title">✅ Maximum Safe Leave</div>`;

    const realToday = new Date();
    realToday.setHours(0, 0, 0, 0);

    const futureWorkingDays = [];
    // Start from currentDate + 1 day as per original logic, BUT filter by Real Today
    for (let d = new Date(currentDate.getTime() + 86400000); d <= lastDate; d.setDate(d.getDate() + 1)) {
        const dayTime = new Date(d).setHours(0, 0, 0, 0);

        // SKIP PAST DATES: Only recommend leaves for future dates
        if (dayTime <= realToday.getTime()) continue;

        if (holidayDates.some(h => h.getTime() === dayTime) || leaveDateSet.has(dayTime) || compulsoryDateSet.has(dayTime)) continue;

        const dayOfWeek = d.getDay();
        const scheduleIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

        let totalClassesOnDay = 0;
        const costs = {};
        const dateStr = formatLocalDate(d);
        currentAnalysisData.forEach(subject => {
            const classesOnDayForSubject = getSubjectClassCountForDate(dateStr, subject.code);
            if (classesOnDayForSubject > 0) {
                costs[subject.code] = classesOnDayForSubject;
                totalClassesOnDay += classesOnDayForSubject;
            }
        });

        if (totalClassesOnDay > 0) {
            futureWorkingDays.push({ date: new Date(d), totalClasses: totalClassesOnDay, costs });
        }
    }

    if (isOverallMode()) {
        const overall = currentAnalysisData.reduce((acc, subject) => {
            acc.attended += subject.initialAttended; acc.totalHeld += subject.initialTotal; acc.remaining += subject.remaining;
            acc.schedule = acc.schedule.map((val, i) => val + subject.schedule[i]);
            return acc;
        }, { attended: 0, totalHeld: 0, remaining: 0, schedule: Array(7).fill(0) });

        let leaveCost = 0;
        leavePeriods.forEach(p => {
            leaveCost += countClassesInRange(new Date(p.start), new Date(p.end), overall.schedule, holidayDates, 'overall');
        });

        const analysis = getSubjectAnalysis(overall.attended, overall.totalHeld, overall.remaining);
        let skippableClasses = analysis.stats.maxSkippable - leaveCost;

        if (skippableClasses < 0) {
            resultHTML += `<p><strong>Warning:</strong> Your planned leave of ${leavePeriods.length} period(s) makes your attendance fall below the minimum. You are short by <strong>${Math.abs(skippableClasses)}</strong> classes.</p>`;
        } else {
            futureWorkingDays.sort((a, b) => a.totalClasses - b.totalClasses);
            let recommendedLeaveDates = [];
            for (const day of futureWorkingDays) {
                if (skippableClasses >= day.totalClasses) {
                    recommendedLeaveDates.push(day.date);
                    skippableClasses -= day.totalClasses;
                } else { break; }
            }
            recommendedLeaveDates.sort((a, b) => a - b);
            if (recommendedLeaveDates.length > 0) {
                resultHTML += `<p>After accounting for your planned leaves, you can still safely skip <strong>${recommendedLeaveDates.length} day(s)</strong>:</p>
                                        <ul style="list-style-position: inside; padding: 15px 0;">${recommendedLeaveDates.map(d => `<li>${d.toDateString()}</li>`).join('')}</ul>`;
            } else {
                resultHTML += `<p>After accounting for your planned leaves, you cannot afford to miss any more full days.</p>`;
            }
        }
    } else {
        const skippableBudget = {};
        let bottleneckSubject = { name: '', maxSkippable: Infinity };

        currentAnalysisData.forEach(subject => {
            let leaveCost = 0;
            leavePeriods.forEach(p => {
                leaveCost += countClassesInRange(new Date(p.start), new Date(p.end), subject.schedule, holidayDates, subject.code);
            });
            const analysis = getSubjectAnalysis(subject.initialAttended, subject.initialTotal, subject.remaining);
            skippableBudget[subject.code] = analysis.stats.maxSkippable - leaveCost;

            if (skippableBudget[subject.code] < bottleneckSubject.maxSkippable) {
                bottleneckSubject = { name: subject.name, maxSkippable: skippableBudget[subject.code] };
            }
        });

        if (bottleneckSubject.maxSkippable < 0) {
            resultHTML += `<p><strong>Warning:</strong> Your planned leaves make your attendance for <strong>${bottleneckSubject.name}</strong> fall below the minimum. You are short by <strong>${Math.abs(bottleneckSubject.maxSkippable)} class(es)</strong>.</p>`;
        } else {
            futureWorkingDays.sort((a, b) => a.totalClasses - b.totalClasses);
            let recommendedLeaveDates = [];
            for (const day of futureWorkingDays) {
                let isAffordable = true;
                for (const subjectCode in day.costs) {
                    if (day.costs[subjectCode] > skippableBudget[subjectCode]) {
                        isAffordable = false;
                        break;
                    }
                }

                if (isAffordable) {
                    recommendedLeaveDates.push(day.date);
                    for (const subjectCode in day.costs) {
                        skippableBudget[subjectCode] -= day.costs[subjectCode];
                    }
                }
            }
            recommendedLeaveDates.sort((a, b) => a - b);
            if (recommendedLeaveDates.length > 0) {
                resultHTML += `<p>After your planned leave, your leave is limited by <strong>${bottleneckSubject.name}</strong>. You can safely take leave on these <strong>${recommendedLeaveDates.length} day(s)</strong>:</p>
                                        <ul style="list-style-position: inside; padding: 15px 0;">${recommendedLeaveDates.map(d => `<li>${d.toDateString()}</li>`).join('')}</ul>`;
            } else {
                resultHTML += `<p>After accounting for your planned leaves, you cannot miss any more full days. Your attendance in <strong>${bottleneckSubject.name}</strong> is the limiting factor.</p>`;
            }
        }
    }

    resultHTML += `</div>`;
    container.innerHTML = resultHTML;
}

// Calculate max safe leave excluding specified subjects (days without their classes)
function calculateMaxSafeLeaveExcluding(excludeCodesStr) {
    const excludeCodes = excludeCodesStr.split(',');
    const container = document.getElementById('maxLeaveRecommendation');
    const currentDate = new Date(document.getElementById('currentDate').value + 'T00:00:00');
    const lastDate = new Date(document.getElementById('lastDate').value + 'T00:00:00');
    const holidayDates = (selectedClass.holidays || []).map(h => new Date(h + 'T00:00:00'));

    // Get excluded subject names for display
    const excludedSubjectNames = currentAnalysisData
        .filter(s => excludeCodes.includes(s.code))
        .map(s => s.name);

    // Get planned leave and compulsory dates
    const leavePeriods = Array.from(document.querySelectorAll('.leave-period-entry')).map(p => ({ start: p.querySelector('.leave-start-date').value, end: p.querySelector('.leave-end-date').value })).filter(d => d.start && d.end);
    const compulsoryPeriods = Array.from(document.querySelectorAll('.compulsory-period-entry')).map(p => ({ start: p.querySelector('.compulsory-start-date').value, end: p.querySelector('.compulsory-end-date').value })).filter(d => d.start && d.end);

    const leaveDateSet = new Set();
    leavePeriods.forEach(p => { for (let d = new Date(p.start); d <= new Date(p.end); d.setDate(d.getDate() + 1)) { leaveDateSet.add(d.setHours(0, 0, 0, 0)); } });

    const compulsoryDateSet = new Set();
    compulsoryPeriods.forEach(p => { for (let d = new Date(p.start); d <= new Date(p.end); d.setDate(d.getDate() + 1)) { compulsoryDateSet.add(d.setHours(0, 0, 0, 0)); } });

    // Find days that DON'T have classes for excluded subjects
    const safeDays = [];
    for (let d = new Date(currentDate.getTime() + 86400000); d <= lastDate; d.setDate(d.getDate() + 1)) {
        const dayTime = new Date(d).setHours(0, 0, 0, 0);
        if (holidayDates.some(h => h.getTime() === dayTime) || leaveDateSet.has(dayTime) || compulsoryDateSet.has(dayTime)) continue;

        const dayOfWeek = d.getDay();
        const scheduleIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

        // Check if any excluded subject has classes on this day
        let hasExcludedSubjectClass = false;
        for (const code of excludeCodes) {
            const subject = currentAnalysisData.find(s => s.code === code);
            if (subject && subject.schedule[scheduleIndex] > 0) {
                hasExcludedSubjectClass = true;
                break;
            }
        }

        // Only include days where excluded subjects have NO classes
        if (!hasExcludedSubjectClass) {
            // Now check if skipping this day is still safe for other subjects
            let isSafeForOthers = true;
            let totalClassesOnDay = 0;
            const costs = {};

            currentAnalysisData.forEach(subject => {
                if (!excludeCodes.includes(subject.code)) {
                    const classesOnDay = subject.schedule[scheduleIndex];
                    if (classesOnDay > 0) {
                        costs[subject.code] = classesOnDay;
                        totalClassesOnDay += classesOnDay;
                    }
                }
            });

            if (totalClassesOnDay > 0) {
                safeDays.push({ date: new Date(d), totalClasses: totalClassesOnDay, costs });
            }
        }
    }

    // Now calculate which of these safe days you can actually skip
    const skippableBudget = {};
    let bottleneckSubject = { name: '', maxSkippable: Infinity };

    currentAnalysisData.forEach(subject => {
        if (!excludeCodes.includes(subject.code)) {
            let leaveCost = 0;
            leavePeriods.forEach(p => {
                leaveCost += countClassesInRange(new Date(p.start), new Date(p.end), subject.schedule, holidayDates, subject.code);
            });

            const analysis = getSubjectAnalysis(subject.attended, subject.totalHeld, subject.remaining);
            skippableBudget[subject.code] = analysis.stats.maxSkippable - leaveCost;

            if (skippableBudget[subject.code] < bottleneckSubject.maxSkippable) {
                bottleneckSubject = { name: subject.name, maxSkippable: skippableBudget[subject.code] };
            }
        }
    });

    let resultHTML = `<div class="subject-card" style="border-left-color: var(--info-color);">
                    <div class="subject-title">🔍 Safe Leave (Excluding Critical Subjects)</div>
                    <p style="margin-bottom: 15px; padding: 10px; background: rgba(231, 76, 60, 0.1); border-radius: 8px;">
                        <strong>⚠️ Important:</strong> These are days where <strong>${excludedSubjectNames.join(', ')}</strong> have NO classes, so taking leave won't affect their attendance.
                    </p>`;

    safeDays.sort((a, b) => a.totalClasses - b.totalClasses);
    let recommendedLeaveDates = [];

    for (const day of safeDays) {
        let isAffordable = true;
        for (const subjectCode in day.costs) {
            if (day.costs[subjectCode] > skippableBudget[subjectCode]) {
                isAffordable = false;
                break;
            }
        }

        if (isAffordable) {
            recommendedLeaveDates.push(day.date);
            for (const subjectCode in day.costs) {
                skippableBudget[subjectCode] -= day.costs[subjectCode];
            }
        }
    }

    recommendedLeaveDates.sort((a, b) => a - b);

    if (recommendedLeaveDates.length > 0) {
        resultHTML += `<p>You can safely take leave on these <strong>${recommendedLeaveDates.length} day(s)</strong> without missing <strong>${excludedSubjectNames.join(', ')}</strong> classes:</p>
                        <ul style="list-style-position: inside; padding: 15px 0;">${recommendedLeaveDates.map(d => `<li>${d.toDateString()}</li>`).join('')}</ul>`;
    } else {
        resultHTML += `<p>Unfortunately, there are no upcoming days where:</p>
                        <ul style="list-style-position: inside; padding: 10px 0;">
                            <li><strong>${excludedSubjectNames.join(', ')}</strong> have no classes, AND</li>
                            <li>You can still afford to skip other subjects' classes</li>
                        </ul>
                        <p>You may need to attend all remaining classes.</p>`;
    }

    resultHTML += `<div style="margin-top: 15px;">
                    <button class="btn secondary-btn" onclick="calculateMaxSafeLeave()" style="padding: 8px 16px;">
                        ↩️ Back to Regular Calculation
                    </button>
                </div></div>`;

    container.innerHTML = resultHTML;
}

// Calculate Max Possible Bunk - Skip days at medical threshold + ML suggestions to reach min attendance
function calculateMaxPossibleBunk() {
    calculateLeaveImpact(); // Run impact analysis first
    const container = document.getElementById('maxPossibleBunkResults');
    const currentDate = new Date(document.getElementById('currentDate').value + 'T00:00:00');
    const lastDate = new Date(document.getElementById('lastDate').value + 'T00:00:00');
    const holidayDates = (selectedClass.holidays || []).map(h => new Date(h + 'T00:00:00'));

    const minCriteria = getMinAttendanceCriteria(); // e.g., 0.75 (75%)
    const detentionCriteria = getMinMedicalCriteria() / 100; // Medical threshold as decimal
    const detentionPercent = getMinMedicalCriteria(); // Medical threshold as percent (for display)

    // Get planned leave and compulsory dates
    const leavePeriods = Array.from(document.querySelectorAll('.leave-period-entry')).map(p => ({ start: p.querySelector('.leave-start-date').value, end: p.querySelector('.leave-end-date').value })).filter(d => d.start && d.end);
    const compulsoryPeriods = Array.from(document.querySelectorAll('.compulsory-period-entry')).map(p => ({ start: p.querySelector('.compulsory-start-date').value, end: p.querySelector('.compulsory-end-date').value })).filter(d => d.start && d.end);

    const leaveDateSet = new Set();
    leavePeriods.forEach(p => { for (let d = new Date(p.start); d <= new Date(p.end); d.setDate(d.getDate() + 1)) { leaveDateSet.add(d.setHours(0, 0, 0, 0)); } });

    const compulsoryDateSet = new Set();
    compulsoryPeriods.forEach(p => { for (let d = new Date(p.start); d <= new Date(p.end); d.setDate(d.getDate() + 1)) { compulsoryDateSet.add(d.setHours(0, 0, 0, 0)); } });

    // Check if any subject is already below medical threshold even with all remaining attended
    const unreachable65 = currentAnalysisData.filter(subject => {
        const finalTotal = subject.totalHeld + subject.remaining;
        const maxPossible = subject.attended + subject.remaining;
        const maxPercent = finalTotal > 0 ? (maxPossible / finalTotal) * 100 : 0;
        return maxPercent < detentionPercent;
    });

    if (unreachable65.length > 0) {
        container.style.display = 'block';
        const subjectNames = unreachable65.map(s => s.name).join(', ');
        container.innerHTML = `
                        <div class="subject-card" style="border-left-color: var(--danger-color);">
                            <div class="subject-title">🚫 Detention Risk!</div>
                            <p style="color: var(--danger-color);">
                                <strong>Critical Warning:</strong> The following subject(s) cannot reach ${detentionPercent}% even if you attend all remaining classes:<br>
                                <strong>${subjectNames}</strong><br><br>
                                You must focus on these subjects immediately or seek academic help.
                            </p>
                        </div>`;
        return;
    }

    // Calculate skippable budget at 65% threshold for each subject
    const futureWorkingDays = [];
    for (let d = new Date(currentDate.getTime() + 86400000); d <= lastDate; d.setDate(d.getDate() + 1)) {
        const dayTime = new Date(d).setHours(0, 0, 0, 0);
        if (holidayDates.some(h => h.getTime() === dayTime) || leaveDateSet.has(dayTime) || compulsoryDateSet.has(dayTime)) continue;

        const dayOfWeek = d.getDay();
        const scheduleIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

        let totalClassesOnDay = 0;
        const costs = {};
        const dateStr = formatLocalDate(d);
        currentAnalysisData.forEach(subject => {
            const classesOnDay = getSubjectClassCountForDate(dateStr, subject.code);
            if (classesOnDay > 0) {
                costs[subject.code] = classesOnDay;
                totalClassesOnDay += classesOnDay;
            }
        });

        if (totalClassesOnDay > 0) {
            futureWorkingDays.push({ date: new Date(d), totalClasses: totalClassesOnDay, costs });
        }
    }

    // Calculate max skippable at 65% threshold
    const skippableBudget65 = {};
    const skippableBudget75 = {};
    let bottleneckSubject65 = { name: '', maxSkippable: Infinity };

    currentAnalysisData.forEach(subject => {
        let leaveCost = 0;
        leavePeriods.forEach(p => {
            leaveCost += countClassesInRange(new Date(p.start), new Date(p.end), subject.schedule, holidayDates, subject.code);
        });

        // Calculate at 65% threshold
        const finalTotal = subject.totalHeld + subject.remaining;
        const minRequired65 = Math.ceil(detentionCriteria * finalTotal);
        const stillNeed65 = Math.max(0, minRequired65 - subject.attended);
        const maxSkippable65 = Math.max(0, subject.remaining - stillNeed65) - leaveCost;
        skippableBudget65[subject.code] = maxSkippable65;

        // Calculate at 75% threshold (for ML suggestions)
        const minRequired75 = Math.ceil(minCriteria * finalTotal);
        const stillNeed75 = Math.max(0, minRequired75 - subject.attended);
        const maxSkippable75 = Math.max(0, subject.remaining - stillNeed75) - leaveCost;
        skippableBudget75[subject.code] = maxSkippable75;

        if (maxSkippable65 < bottleneckSubject65.maxSkippable) {
            bottleneckSubject65 = { name: subject.name, maxSkippable: maxSkippable65 };
        }
    });

    // Find all bunkable days at 65% threshold
    const tempBudget = { ...skippableBudget65 };
    futureWorkingDays.sort((a, b) => a.totalClasses - b.totalClasses);
    let bunkableDates = [];

    for (const day of futureWorkingDays) {
        let canBunk = true;
        for (const subjectCode in day.costs) {
            if (day.costs[subjectCode] > tempBudget[subjectCode]) {
                canBunk = false;
                break;
            }
        }

        if (canBunk) {
            bunkableDates.push({ date: day.date, costs: day.costs });
            for (const subjectCode in day.costs) {
                tempBudget[subjectCode] -= day.costs[subjectCode];
            }
        }
    }

    bunkableDates.sort((a, b) => a.date - b.date);

    // Calculate classes needed via ML to go from 65% to 75%
    let mlDatesNeeded = [];
    let totalMLClassesNeeded = 0;

    currentAnalysisData.forEach(subject => {
        const finalTotal = subject.totalHeld + subject.remaining;
        const currentPercent = subject.totalHeld > 0 ? (subject.attended / subject.totalHeld) * 100 : 0;

        // Calculate attendance impact after bunking
        let bunkClassesForSubject = 0;
        bunkableDates.forEach(bd => {
            bunkClassesForSubject += bd.costs[subject.code] || 0;
        });

        // Planned leaves impact
        let plannedLeaveClasses = 0;
        leavePeriods.forEach(p => {
            plannedLeaveClasses += countClassesInRange(new Date(p.start), new Date(p.end), subject.schedule, holidayDates, subject.code);
        });

        // Final projection: attended + remaining - bunks - planned leaves
        const projectedAttended = subject.attended + subject.remaining - bunkClassesForSubject - plannedLeaveClasses;
        const projectedPercent = finalTotal > 0 ? (projectedAttended / finalTotal) * 100 : 0;

        // If projected < 75%, calculate ML classes needed
        if (projectedPercent < minCriteria * 100) {
            const deficit = Math.ceil(minCriteria * finalTotal) - projectedAttended;
            if (deficit > 0) {
                mlDatesNeeded.push({ subject: subject.name, code: subject.code, classesNeeded: deficit });
                totalMLClassesNeeded += deficit;
            }
        }
    });

    // Find best ML dates from bunked dates + planned leaves
    let availableMLDates = [];

    // Add bunk dates
    bunkableDates.forEach(bd => {
        let totalClasses = 0;
        Object.values(bd.costs).forEach(c => totalClasses += c);
        availableMLDates.push({ date: bd.date, classes: totalClasses, source: 'bunk' });
    });

    // Add planned leave dates
    leavePeriods.forEach(p => {
        for (let d = new Date(p.start + 'T00:00:00'); d <= new Date(p.end + 'T00:00:00'); d.setDate(d.getDate() + 1)) {
            const dayTime = new Date(d).setHours(0, 0, 0, 0);
            if (holidayDates.some(h => h.getTime() === dayTime)) continue;

            const dayOfWeek = d.getDay();
            const scheduleIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

            let classesOnDay = 0;
            currentAnalysisData.forEach(subject => {
                classesOnDay += parseScheduleValue(subject.schedule[scheduleIndex]);
            });

            if (classesOnDay > 0) {
                availableMLDates.push({ date: new Date(d), classes: classesOnDay, source: 'planned' });
            }
        }
    });

    // Sort by classes (descending) - suggest dates with more classes first for ML
    availableMLDates.sort((a, b) => b.classes - a.classes);

    // Select enough ML dates to cover the deficit
    let selectedMLDates = [];
    let coveredClasses = 0;
    for (const mlDate of availableMLDates) {
        if (coveredClasses >= totalMLClassesNeeded) break;
        selectedMLDates.push(mlDate);
        coveredClasses += mlDate.classes;
    }

    // Build results HTML
    container.style.display = 'block';
    let resultHTML = `
                    <div class="subject-card" style="border-left-color: var(--danger-color);">
                        <div class="subject-title">🚫 Max Possible Bunk (Avoid Detention at ${detentionPercent}%)</div>
                        <p style="margin-bottom: 15px; padding: 10px; background: rgba(231, 76, 60, 0.1); border-radius: 8px;">
                            <strong>⚠️ Important:</strong> These are dates you can skip without falling below <strong>${detentionPercent}%</strong> (detention threshold). Bottleneck: <strong>${bottleneckSubject65.name}</strong>
                        </p>`;

    if (bunkableDates.length > 0) {
        resultHTML += `
                        <h4 style="margin-top: 15px;">📅 Bunkable Days (${bunkableDates.length} days)</h4>
                        <ul style="list-style-position: inside; padding: 10px 0;">
                            ${bunkableDates.map(d => `<li>${d.date.toDateString()}</li>`).join('')}
                        </ul>`;
    } else {
        resultHTML += `<p>No additional days can be bunked without going below ${detentionPercent}%.</p>`;
    }

    // ML recommendations
    if (mlDatesNeeded.length > 0) {
        resultHTML += `
                        <div style="margin-top: 20px; padding: 15px; background: rgba(52, 152, 219, 0.1); border-radius: 8px; border-left: 4px solid var(--info-color);">
                            <h4 style="margin-bottom: 10px;">💊 Medical Certificate Needed to Reach ${(minCriteria * 100).toFixed(0)}%</h4>
                            <p>After bunking all possible days, you'll need ML for these subjects:</p>
                            <ul style="list-style-position: inside; padding: 10px 0;">
                                ${mlDatesNeeded.map(m => `<li><strong>${m.subject}</strong>: ${m.classesNeeded} class(es) needed</li>`).join('')}
                            </ul>
                            <p style="margin-top: 10px;"><strong>Total classes to cover via ML:</strong> ${totalMLClassesNeeded}</p>`;

        if (selectedMLDates.length > 0 && coveredClasses >= totalMLClassesNeeded) {
            resultHTML += `
                            <h4 style="margin-top: 15px;">📋 Recommended ML Dates (${selectedMLDates.length} days, ${coveredClasses} classes)</h4>
                            <ul style="list-style-position: inside; padding: 10px 0;">
                                ${selectedMLDates.map(d => `<li>${d.date.toDateString()} (${d.classes} classes) - <em>${d.source === 'bunk' ? 'From Bunk List' : 'From Planned Leave'}</em></li>`).join('')}
                            </ul>`;
        } else if (selectedMLDates.length > 0) {
            resultHTML += `
                            <p style="color: var(--warning-color); margin-top: 10px;">
                                ⚠️ Available dates only cover ${coveredClasses} classes. You need ${totalMLClassesNeeded - coveredClasses} more.
                            </p>`;
        } else {
            resultHTML += `<p style="margin-top: 10px;">No suitable ML dates available from bunks or planned leaves.</p>`;
        }

        resultHTML += `</div>`;
    } else {
        resultHTML += `
                        <div style="margin-top: 20px; padding: 15px; background: rgba(46, 204, 113, 0.1); border-radius: 8px; border-left: 4px solid var(--success-grad-end);">
                            <h4 style="margin-bottom: 5px;">✅ No Medical Certificate Needed!</h4>
                            <p>Even after bunking all these days, you'll stay above ${(minCriteria * 100).toFixed(0)}% in all subjects.</p>
                        </div>`;
    }

    resultHTML += `</div>`;
    container.innerHTML = resultHTML;
}

function findLongWeekends() { const resultsDiv = document.getElementById('longWeekendFinderResult'); const numLeaveDays = parseInt(document.getElementById('numLeaveDays').value); if (!numLeaveDays || numLeaveDays < 1) { resultsDiv.innerHTML = '<p>Please enter a valid number of leave days.</p>'; return; } resultsDiv.innerHTML = `<div class="loading" style="display:block; margin: 10px auto;"><div class="spinner" style="width:30px; height:30px; border-width:3px;"></div><p>Calculating best break...</p></div>`; setTimeout(() => { const currentDate = new Date(document.getElementById('currentDate').value + 'T00:00:00'); const lastDate = new Date(document.getElementById('lastDate').value + 'T00:00:00'); const holidayDates = (selectedClass.holidays || []).map(h => new Date(h + 'T00:00:00')); const totalClassesPerDay = Array(7).fill(0); if (selectedClass && selectedClass.subjects) { selectedClass.subjects.forEach(subject => { subject.schedule.forEach((numClasses, dayIndex) => { totalClassesPerDay[dayIndex] += numClasses; }); }); } const nonWorkingDays = new Set(holidayDates.map(d => d.getTime())); for (let d = new Date(currentDate); d <= lastDate; d.setDate(d.getDate() + 1)) { const dayOfWeek = d.getDay(); const scheduleIndex = (dayOfWeek === 0) ? 6 : dayOfWeek - 1; if (totalClassesPerDay[scheduleIndex] === 0) { nonWorkingDays.add(new Date(d).setHours(0, 0, 0, 0)); } } const timeline = []; for (let d = new Date(currentDate); d <= lastDate; d.setDate(d.getDate() + 1)) { const time = new Date(d).setHours(0, 0, 0, 0); timeline.push({ date: new Date(time), isWorking: !nonWorkingDays.has(time) }); } let bestBreak = { length: 0, startDate: null, endDate: null, leaveDates: [] }; for (let i = 0; i < timeline.length; i++) { let leavesUsed = 0; let currentLength = 0; let leaveDatesInBreak = []; for (let j = i; j < timeline.length; j++) { if (!timeline[j].isWorking) { currentLength++; } else { if (leavesUsed < numLeaveDays) { leavesUsed++; currentLength++; leaveDatesInBreak.push(timeline[j].date); } else { break; } } } if (currentLength > bestBreak.length) { bestBreak = { length: currentLength, startDate: timeline[i].date, endDate: timeline[i + currentLength - 1].date, leaveDates: leaveDatesInBreak }; } } if (bestBreak.length > 0) { let resultHTML = `For the longest break, take <strong>${bestBreak.leaveDates.length} day(s)</strong> of leave on: <ul style="list-style-position: inside; padding: 5px 0;">${bestBreak.leaveDates.map(d => `<li>${d.toDateString()}</li>`).join('')}</ul> This will give you a <strong>${bestBreak.length}-day</strong> break from <strong>${bestBreak.startDate.toDateString()}</strong> to <strong>${bestBreak.endDate.toDateString()}</strong>.`; resultsDiv.innerHTML = resultHTML; } else { resultsDiv.innerHTML = '<p>Could not find an optimal break with the given parameters.</p>'; } }, 50); }

function checkSkipToday() {
    if (currentAnalysisData.length === 0) {
        alert("Please calculate attendance first to get current data.");
        return;
    }

    const today = new Date(document.getElementById('currentDate').value);
    const dayOfWeek = today.getDay();
    const scheduleIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const subjectsToday = selectedClass.subjects.filter(s => s.schedule[scheduleIndex] > 0);

    // Build full modal content dynamically
    const modal = document.getElementById('skipTodayModal');
    if (!modal) return;

    modal.innerHTML = `
                    <div class="modal-content">
                        <button class="modal-close" onclick="closeModal('skipTodayModal')">&times;</button>
                        <div class="modal-header">
                            <h2>🤔 Can I Skip Today?</h2>
                            <p>See how skipping today's classes affects your final attendance</p>
                        </div>
                        <div id="skipTodayResults"></div>
                    </div>
                `;

    const resultsDiv = document.getElementById('skipTodayResults');

    if (subjectsToday.length === 0) {
        resultsDiv.innerHTML = `<p style="text-align: center;">No classes scheduled for today. You're free! 🎉</p>`;
    } else {
        let resultsHTML = '';
        subjectsToday.forEach(subject => {
            const data = currentAnalysisData.find(d => d.code === subject.code);
            if (!data) return;

            const classesToday = subject.schedule[scheduleIndex];
            const { stats } = getSubjectAnalysis(data.attended, data.totalHeld, data.remaining);

            const newFinalAttended = data.attended + data.remaining - classesToday;
            const finalTotal = data.totalHeld + data.remaining;
            const newFinalPercent = finalTotal > 0 ? (newFinalAttended / finalTotal) * 100 : 0;

            const isSafe = newFinalPercent >= (getMinAttendanceCriteria() * 100);
            resultsHTML += `
                        <div class="dashboard-subject">
                            <span>${subject.name} (${classesToday} hr/s)</span>
                            <span>${stats.projectedMaxPercent.toFixed(1)}% → <strong style="color: ${isSafe ? 'var(--success-grad-start)' : 'var(--danger-color)'}">${newFinalPercent.toFixed(1)}%</strong></span>
                        </div>`;
        });
        resultsDiv.innerHTML = resultsHTML;
    }
    openModal('skipTodayModal');
}

// Get unique color for a subject based on its index (uses subjectColors from top)
function getSubjectColor(subjectIndex) {
    return subjectColors[subjectIndex % subjectColors.length];
}

// Get short form of subject name
function getSubjectShortName(name) {
    if (!name) return '';
    const ignoreWords = ['and', 'of', 'the', 'in', 'for', 'to', 'a', 'an'];
    const words = name.split(/\s+/).filter(word => !ignoreWords.includes(word.toLowerCase()));

    if (words.length === 1) {
        // Single word: return first 3-4 letters
        return words[0].substring(0, Math.min(4, words[0].length)).toUpperCase();
    } else {
        // Multiple words: take first letter of each significant word
        return words.map(word => word[0].toUpperCase()).join('');
    }
}

// Get period times from localStorage
function getPeriodTimes(className) {
    const saved = localStorage.getItem(`period_times_${className}`);
    return saved ? JSON.parse(saved) : null;
}

// Save period times to localStorage
function savePeriodTimes(className, times) {
    localStorage.setItem(`period_times_${className}`, JSON.stringify(times));
}

// Get timetable arrangement from localStorage or generate default
function getTimetableArrangement(className) {
    const saved = localStorage.getItem(`timetable_arrangement_${className}`);
    return saved ? JSON.parse(saved) : null;
}

// Save timetable arrangement to localStorage
function saveTimetableArrangement(className, arrangement) {
    localStorage.setItem(`timetable_arrangement_${className}`, JSON.stringify(arrangement));
}

// Open period time configuration modal
function openPeriodConfigModal() {
    if (!selectedClass) {
        alert('Please select a class first.');
        return;
    }

    const className = document.getElementById('classSelector').value;
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // Calculate max periods - sum all subjects' classes per day, then take the highest day
    let maxPeriods = 0;
    const numDays = 7;
    for (let dayIdx = 0; dayIdx < numDays; dayIdx++) {
        let dayTotal = 0;
        selectedClass.subjects.forEach(subject => {
            const scheduleValue = subject.schedule[dayIdx];
            if (typeof scheduleValue === 'number') {
                dayTotal += scheduleValue;
            } else if (typeof scheduleValue === 'string' && scheduleValue !== '0' && scheduleValue !== '') {
                // New format: period slots like "1,3,4"
                const periods = scheduleValue.split(',').map(p => parseInt(p.trim(), 10)).filter(p => !isNaN(p));
                const maxInSlot = Math.max(...periods, 0);
                if (maxInSlot > dayTotal) dayTotal = maxInSlot;
            }
        });
        if (dayTotal > maxPeriods) maxPeriods = dayTotal;
    }

    if (maxPeriods === 0) {
        alert('No periods to configure. Add subjects with schedules first.');
        return;
    }

    // Get existing times
    const existingTimes = getPeriodTimes(className) || {};

    // Build modal content
    let modalHTML = `
                    <div class="modal-content">
                        <button class="modal-close" onclick="closeModal('periodConfigModal')">&times;</button>
                        <div class="modal-header">
                            <h2>⏰ Configure Period Times</h2>
                            <p>Set the time slot for each period. Next period must start at or after the previous one ends.</p>
                        </div>
                        <div class="period-config-list">
                `;

    for (let i = 0; i < maxPeriods; i++) {
        const periodTime = existingTimes[i] || { start: '', end: '' };
        modalHTML += `
                        <div class="period-config-item">
                            <label><strong>P${i + 1}</strong></label>
                            <input type="time" id="periodStart_${i}" value="${periodTime.start}" 
                                   onchange="validatePeriodTime(${i})" />
                            <span class="time-separator">to</span>
                            <input type="time" id="periodEnd_${i}" value="${periodTime.end}"
                                   onchange="validatePeriodTime(${i})" />
                        </div>
                    `;
    }

    modalHTML += `
                        </div>
                        <div class="form-actions">
                            <button class="btn primary-btn" onclick="savePeriodConfig()">💾 Save Times</button>
                            <button class="btn secondary-btn" onclick="closeModal('periodConfigModal')">Cancel</button>
                        </div>
                    </div>
                `;

    // Create or get the modal
    let modal = document.getElementById('periodConfigModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'periodConfigModal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }
    modal.innerHTML = modalHTML;
    modal.classList.add('active');
}

// Validate period times - ensure start < end and sequential ordering
function validatePeriodTime(periodIndex) {
    const startInput = document.getElementById(`periodStart_${periodIndex}`);
    const endInput = document.getElementById(`periodEnd_${periodIndex}`);

    const startTime = startInput.value;
    const endTime = endInput.value;

    // Check this period's start is before end
    if (startTime && endTime && startTime >= endTime) {
        alert(`Period ${periodIndex + 1}: End time must be after start time.`);
        endInput.value = '';
        return;
    }

    // Check previous period's end time
    if (periodIndex > 0) {
        const prevEndInput = document.getElementById(`periodEnd_${periodIndex - 1}`);
        if (prevEndInput && prevEndInput.value && startTime && startTime < prevEndInput.value) {
            alert(`Period ${periodIndex + 1} cannot start before Period ${periodIndex} ends (${prevEndInput.value}).`);
            startInput.value = prevEndInput.value;
        }
    }

    // Update min value for next period
    if (endTime && periodIndex < 20) {
        const nextStartInput = document.getElementById(`periodStart_${periodIndex + 1}`);
        if (nextStartInput) {
            nextStartInput.min = endTime;
        }
    }
}

// Save period configuration
function savePeriodConfig() {
    const className = document.getElementById('classSelector').value;
    const periodTimes = {};

    let i = 0;
    while (document.getElementById(`periodStart_${i}`)) {
        const start = document.getElementById(`periodStart_${i}`).value;
        const end = document.getElementById(`periodEnd_${i}`).value;
        if (start && end) {
            periodTimes[i] = { start, end };
        }
        i++;
    }

    savePeriodTimes(className, periodTimes);
    closeModal('periodConfigModal');
    generateTimetable(); // Refresh timetable to show times
    alert('✅ Period times saved successfully!');
}

// Generate short name / abbreviation from subject name
function getSubjectShortName(name) {
    if (!name) return '?';
    // Try to create acronym from first letters of each word
    const words = name.split(/\s+/).filter(w => w.length > 0);
    if (words.length > 1) {
        // Multi-word: take first letter of each significant word
        return words
            .filter(w => !['and', 'of', 'the', 'for', 'in', 'to', 'a', 'an'].includes(w.toLowerCase()))
            .map(w => w[0].toUpperCase())
            .join('')
            .substring(0, 5) || name.substring(0, 4).toUpperCase();
    } else {
        // Single word: take first 4 characters
        return name.substring(0, 4).toUpperCase();
    }
}

// Generate the weekly timetable (ROWS = days, COLUMNS = periods)
function generateTimetable() {
    const grid = document.getElementById('timetableGrid');
    const section = document.getElementById('timetableSection');

    if (!selectedClass || !selectedClass.subjects || selectedClass.subjects.length === 0) {
        grid.innerHTML = '<div class="timetable-empty"><p>📭 No subjects configured for this class.</p><p>Add subjects in the class settings.</p></div>';
        return;
    }

    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // Calculate which days have classes and max periods per day
    let daysWithClasses = [];
    let maxPeriodsPerDay = {};

    dayNames.forEach((day, dayIndex) => {
        let totalClassesOnDay = 0;
        selectedClass.subjects.forEach(subject => {
            const rawSchedule = subject.schedule[dayIndex];

            // Handle both formats: string ("1,2,3" or "3") and number (2)
            if (typeof rawSchedule === 'string') {
                if (rawSchedule.includes(',')) {
                    // "1,2,3" format - count positions
                    totalClassesOnDay += rawSchedule.split(',').filter(p => p.trim() && p.trim() !== '0').length;
                } else {
                    // Single string like "3" or "0" - could be count OR position
                    // If > 0, treat as 1 class (position), else 0
                    const num = parseInt(rawSchedule) || 0;
                    totalClassesOnDay += num > 0 ? 1 : 0;
                }
            } else {
                // Numeric count (legacy format)
                totalClassesOnDay += rawSchedule || 0;
            }
        });
        if (totalClassesOnDay > 0) {
            daysWithClasses.push({ index: dayIndex, name: day });
            maxPeriodsPerDay[dayIndex] = totalClassesOnDay;
        }
    });

    if (daysWithClasses.length === 0) {
        grid.innerHTML = '<div class="timetable-empty"><p>📭 No classes scheduled for any day.</p><p>Update subject schedules in the class settings.</p></div>';
        return;
    }

    // Build subject color map
    const subjectColorMap = {};
    selectedClass.subjects.forEach((subject, index) => {
        subjectColorMap[subject.code] = subjectColors[index % subjectColors.length];
    });

    // Calculate maxPeriods from BOTH schedule data AND existing arrangement
    let maxPeriods = 0;

    // 1. From schedule strings (find highest period number)
    selectedClass.subjects.forEach(subject => {
        if (subject.schedule) {
            subject.schedule.forEach(daySchedule => {
                if (typeof daySchedule === 'string' && daySchedule !== '0') {
                    const periods = daySchedule.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p) && p > 0);
                    if (periods.length > 0) {
                        maxPeriods = Math.max(maxPeriods, ...periods);
                    }
                } else if (typeof daySchedule === 'number') {
                    // Legacy count-based: assume periods 1 to N
                    maxPeriods = Math.max(maxPeriods, daySchedule);
                }
            });
        }
    });

    // 2. Also check existing arrangement for max length
    const className = document.getElementById('classSelector').value;
    const existingArrangement = getTimetableArrangement(className);
    if (existingArrangement) {
        Object.values(existingArrangement).forEach(dayArr => {
            if (Array.isArray(dayArr)) {
                // Only count up to the last OCCUPIED slot
                // This effectively trims trailing empty periods (e.g. if user set 8 periods but 7 & 8 are empty)
                for (let i = dayArr.length - 1; i >= 0; i--) {
                    if (dayArr[i] !== null) {
                        maxPeriods = Math.max(maxPeriods, i + 1);
                        break; // Found the last occupied slot for this day
                    }
                }
            }
        });
    }

    // Fallback to at least 1 if nothing found
    if (maxPeriods === 0) maxPeriods = Math.max(...Object.values(maxPeriodsPerDay), 1);
    console.log('🔍 DEBUG maxPeriods:', maxPeriods, 'from subjects:', selectedClass.subjects.map(s => s.schedule));

    // Get period times
    const periodTimes = getPeriodTimes(className) || {};

    // Get current day for highlighting (ROWS now)
    const today = new Date();
    const currentDayIndex = today.getDay(); // 0 = Sunday, 1 = Monday, ...
    const adjustedDayIndex = currentDayIndex === 0 ? 6 : currentDayIndex - 1; // Convert to Mon=0, Sun=6

    // Set up grid template: 1 column for day labels + maxPeriods columns
    grid.style.gridTemplateColumns = `50px repeat(${maxPeriods}, 1fr)`;

    // Get saved arrangement or create default
    let arrangement = getTimetableArrangement(className);

    if (!arrangement) {
        // Create default arrangement from schedule
        arrangement = {};
        daysWithClasses.forEach(day => {
            // Initialize array with maxPeriods null slots
            const dayArrangement = new Array(maxPeriods).fill(null);
            const freeSubjects = []; // For subjects without fixed positions

            selectedClass.subjects.forEach(subject => {
                let periods = [];
                const rawSchedule = subject.schedule[day.index];

                // Case 1: Specific Periods (String with comma "1,3" or Single Number String "3")
                if (typeof rawSchedule === 'string' && (rawSchedule.includes(',') || !isNaN(parseInt(rawSchedule)))) {
                    const parts = rawSchedule.split(',');
                    // Parse all parts as period numbers (1-based)
                    const parsed = parts.map(p => parseInt(p.trim())).filter(p => !isNaN(p) && p > 0);

                    if (parsed.length > 0) {
                        // ALL numbers are treated as POSITIONS now (Period 1, Period 5, etc.)
                        // "1,2,3" → Periods 1, 2, 3
                        // "5" → Period 5
                        periods = parsed;
                    }
                    // If parsed is empty (e.g., "0" or invalid), periods stays empty
                } else if (typeof rawSchedule === 'number' && rawSchedule > 0) {
                    // Case 2: Numeric Count (Legacy Format - rare)
                    // If schedule is an actual NUMBER (not string), treat as count
                    for (let k = 0; k < rawSchedule; k++) freeSubjects.push(subject);
                }

                // Place Fixed Periods
                periods.forEach(p => {
                    // p is 1-based period index
                    if (p <= maxPeriods) {
                        dayArrangement[p - 1] = {
                            code: subject.code,
                            name: subject.name,
                            shortName: subject.shortName || getSubjectShortName(subject.name)
                        };
                    }
                });
            });

            // Place Free (Count-based) Subjects in empty slots
            freeSubjects.forEach(subject => {
                const emptyIndex = dayArrangement.indexOf(null);
                if (emptyIndex !== -1) {
                    dayArrangement[emptyIndex] = {
                        code: subject.code,
                        name: subject.name,
                        shortName: subject.shortName || getSubjectShortName(subject.name)
                    };
                }
            });

            // Remove strict nulls if simple array? 
            // No, UI renders by index. Keep explicit structure, but filter holes if UI expects packed?
            // UI Loop (inferred): Iterates 0..maxPeriods. Using array index.
            // So dayArrangement[0] = Period 1.
            // We must store it exactly like this.
            arrangement[day.index] = dayArrangement;
        });
        saveTimetableArrangement(className, arrangement);
    }

    // Build HTML
    let html = '';

    // Header row (empty corner + period headers with times)
    html += '<div class="timetable-header"></div>'; // Empty corner
    for (let period = 0; period < maxPeriods; period++) {
        const timeInfo = periodTimes[period];
        let timeDisplay = '';
        if (timeInfo && timeInfo.start && timeInfo.end) {
            timeDisplay = `<span class="period-time">${timeInfo.start}-${timeInfo.end}</span>`;
        }
        html += `<div class="timetable-header">P${period + 1}${timeDisplay}</div>`;
    }

    // Day rows (each row is a day)
    daysWithClasses.forEach(day => {
        const isCurrentDay = day.index === adjustedDayIndex;
        const dayArrangement = arrangement[day.index] || [];

        // Day label
        html += `<div class="timetable-day-label${isCurrentDay ? ' current-day' : ''}">${day.name}</div>`;

        // Cells for each period
        for (let period = 0; period < maxPeriods; period++) {
            const cellId = `cell_${day.index}_${period}`;
            const rawSubject = dayArrangement[period];

            // Normalize subject (Handle both String Codes and Legacy Objects)
            let subjectAtPeriod = null;
            if (rawSubject) {
                if (typeof rawSubject === 'string') {
                    // Format: "SUBCODE"
                    const subObj = selectedClass.subjects.find(s => s.code === rawSubject);
                    if (subObj) {
                        subjectAtPeriod = {
                            code: subObj.code,
                            name: subObj.name,
                            shortName: subObj.shortName || getSubjectShortName(subObj.name)
                        };
                    }
                } else if (typeof rawSubject === 'object' && rawSubject !== null) {
                    // Legacy Format: { code, name, shortName }
                    subjectAtPeriod = rawSubject;
                }
            }

            let cellContent = '';
            if (subjectAtPeriod) {
                const subjectColor = subjectColorMap[subjectAtPeriod.code] || '#667eea';

                // Get attendance status class for current day subjects (only if not a holiday)
                let statusClass = '';
                if (isCurrentDay && currentAnalysisData && currentAnalysisData.length > 0) {
                    // Check if today is a holiday
                    const todayStr = formatLocalDate(today);
                    const isHoliday = selectedClass.holidays && selectedClass.holidays.includes(todayStr);

                    if (!isHoliday) {
                        const subjectData = currentAnalysisData.find(s => s.code === subjectAtPeriod.code);
                        if (subjectData) {
                            const { alertClass } = getSubjectAnalysis(subjectData.attended, subjectData.totalHeld, subjectData.remaining);
                            statusClass = ` status-${alertClass}`;
                        }
                    }
                }

                cellContent = `
                                <div class="subject-chip${statusClass}" 
                                     data-code="${subjectAtPeriod.code}"
                                     data-day="${day.index}"
                                     data-period="${period}"
                                     style="background: linear-gradient(135deg, ${subjectColor}, ${adjustColor(subjectColor, -20)})"
                                     title="${subjectAtPeriod.name}">
                                    ${subjectAtPeriod.shortName}
                                </div>
                            `;
            }

            html += `
                            <div class="timetable-cell${isCurrentDay ? ' current-day-row' : ''}" 
                                 id="${cellId}"
                                 data-day="${day.index}"
                                 data-period="${period}">
                                ${cellContent}
                            </div>
                        `;
        }
    });

    grid.innerHTML = html;

    // Add message with configure button
    let existingMessage = section.querySelector('.timetable-message');
    if (existingMessage) {
        existingMessage.remove();
    }

    // Check if today is a holiday
    const todayStr = formatLocalDate(today);
    const isTodayHoliday = selectedClass.holidays && selectedClass.holidays.includes(todayStr);

    const message = document.createElement('div');
    message.className = 'timetable-message';

    if (isTodayHoliday) {
        message.innerHTML = '🎉 <strong>Today is a holiday!</strong> Enjoy your day off. <button class="config-btn" onclick="openPeriodConfigModal()">⏰ Configure Period Times</button>';
        message.style.background = 'rgba(40, 167, 69, 0.15)';
        message.style.borderLeft = '4px solid #28a745';
    } else {
        message.innerHTML = '💡 <button class="config-btn" onclick="openPeriodConfigModal()">⏰ Configure Period Times</button>';
    }
    section.appendChild(message);

    // Initialize drag and drop
    initTimetableDragDrop();
}

// Adjust color brightness (for gradient effect)
function adjustColor(hex, amount) {
    let color = hex.replace('#', '');
    if (color.length === 3) {
        color = color[0] + color[0] + color[1] + color[1] + color[2] + color[2];
    }
    const num = parseInt(color, 16);
    let r = Math.min(255, Math.max(0, (num >> 16) + amount));
    let g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
    let b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
    return '#' + (r << 16 | g << 8 | b).toString(16).padStart(6, '0');
}

// Initialize drag and drop for timetable
function initTimetableDragDrop() {
    const chips = document.querySelectorAll('.subject-chip');
    const cells = document.querySelectorAll('.timetable-cell');

    // Drag and drop disabled by user request
    /* 
    chips.forEach(chip => {
        chip.addEventListener('dragstart', handleDragStart);
        chip.addEventListener('dragend', handleDragEnd);
    });

    cells.forEach(cell => {
        cell.addEventListener('dragover', handleDragOver);
        cell.addEventListener('dragleave', handleDragLeave);
        cell.addEventListener('drop', handleDrop);
    }); 
    */
}

let draggedChip = null;

function handleDragStart(e) {
    draggedChip = e.target;
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({
        code: e.target.dataset.code,
        day: parseInt(e.target.dataset.day),
        period: parseInt(e.target.dataset.period)
    }));
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    document.querySelectorAll('.timetable-cell').forEach(cell => {
        cell.classList.remove('drag-over');
    });
    draggedChip = null;
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // Only allow drop within same day
    if (draggedChip) {
        const sourceDay = parseInt(draggedChip.dataset.day);
        const targetDay = parseInt(e.currentTarget.dataset.day);
        if (sourceDay === targetDay) {
            e.currentTarget.classList.add('drag-over');
        }
    }
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');

    if (!draggedChip) return;

    const sourceData = JSON.parse(e.dataTransfer.getData('text/plain'));
    const targetDay = parseInt(e.currentTarget.dataset.day);
    const targetPeriod = parseInt(e.currentTarget.dataset.period);

    // Only allow drops within the same day
    if (sourceData.day !== targetDay) {
        return;
    }

    const className = document.getElementById('classSelector').value;
    let arrangement = getTimetableArrangement(className);

    if (!arrangement || !arrangement[targetDay]) return;

    // Swap the periods
    const dayArrangement = arrangement[targetDay];
    const sourceItem = dayArrangement[sourceData.period];
    const targetItem = dayArrangement[targetPeriod] || null;

    dayArrangement[sourceData.period] = targetItem;
    dayArrangement[targetPeriod] = sourceItem;

    // Clean up null entries
    arrangement[targetDay] = dayArrangement;

    localStorage.setItem(`timetable_arrangement_${className}`, JSON.stringify(arrangement));
    // Sync with Cloud
    if (window.SyncManager) SyncManager.uploadAll();

    // Refresh period-wise attendance modal if open (syncs with new timetable order)
    const periodModal = document.getElementById('periodAttendanceModal');
    if (periodModal && periodModal.classList.contains('active')) {
        openPeriodAttendanceModal(); // Re-render with new sequence
    }
}

// Keep updateDailyDashboard for backward compatibility but redirect to timetable
function updateDailyDashboard() {
    generateTimetable();
    if (typeof selectedClass !== 'undefined' && selectedClass && selectedClass.subjects) {
        calculateAttendance(selectedClass.subjects);
    }
}



function cleanupHolidayLogs() {
    // Get all attendance logs
    const logs = JSON.parse(localStorage.getItem('attendance_logs')) || {};
    let cleanedCount = 0;

    // Check each date in logs
    Object.keys(logs).forEach(dateStr => {
        const check = isHolidayOrNoClass(dateStr);

        // If this date is a holiday, remove all attendance markings
        if (check.isHoliday) {
            delete logs[dateStr];
            cleanedCount++;
        }
    });

    // Save cleaned logs back
    if (cleanedCount > 0) {
        localStorage.setItem('attendance_logs', JSON.stringify(logs));
        console.log(`Cleaned ${cleanedCount} holiday log(s) from imported data`);
    }

    return cleanedCount;
}

function saveDailyLog() {
    const dateStr = document.getElementById('logDate').value;
    if (!dateStr) return;

    // Check if date is a holiday - if so, prevent saving
    const check = isHolidayOrNoClass(dateStr);
    if (check.isHoliday) {
        alert(`Cannot save attendance for ${dateStr}.\n\nThis date is a ${check.reason}.\nAll subjects should remain as "Default" (no attendance marked).`);
        return; // Don't save anything
    }

    const logs = JSON.parse(localStorage.getItem('attendance_logs')) || {};

    // FIX: Create a FRESH object for this day to prevent "ghost logs"
    // (e.g., if user had 5 periods in custom schedule, marked them, then reverted to default 1 period,
    // we want the other 4 logs to be removed, not processed as a merge)
    const newDayLog = {};

    document.querySelectorAll('#dailyLogSubjects select').forEach(select => {
        const code = select.dataset.code;
        const status = select.value;

        // Only save non-default statuses
        if (status !== 'Default') {
            // Special handling for legacy keys if needed, but standardizing on code is safer
            newDayLog[code] = status;
        }
    });

    // Update the main logs object
    if (Object.keys(newDayLog).length > 0) {
        logs[dateStr] = newDayLog;
    } else {
        // If all are default, remove the entry for this date entirely
        delete logs[dateStr];
    }

    localStorage.setItem('attendance_logs', JSON.stringify(logs));

    // FIX: Track timestamp to prevent "Refresh Race Condition" overwriting local data with stale cloud data
    const logTimestamps = JSON.parse(localStorage.getItem('attendance_log_timestamps') || '{}');
    logTimestamps[dateStr] = new Date().toISOString();
    localStorage.setItem('attendance_log_timestamps', JSON.stringify(logTimestamps));

    // Sync with Cloud
    if (window.SyncManager) {
        SyncManager.saveLog(dateStr, newDayLog);
    }

    // Track last app interaction time for sync comparison
    localStorage.setItem('lastAppInteraction', new Date().toISOString());
    alert('Log saved! Your future calculations will now reflect these changes.');
    closeModal('dailyLogModal');

    // Immediate update without refresh
    if (selectedClass.portalSetup && selectedClass.portalSetup.active) {
        // Show ad during portal calculation
        if (window.AdManager) AdManager.showForCalculation();
        calculateFromPortal(); // Calculate FIRST to update currentAnalysisData
        renderPortalDashboard(); // Then refresh notification

        // FIX: Ensure results section is visible and scrolled into view
        const resultsSection = document.getElementById('resultsSection');
        if (resultsSection) {
            resultsSection.style.display = 'block';
            setTimeout(() => {
                resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 300);
        }

        // ---------------------------------------------------------
        // ROLLING BASELINE LOGIC
        // If logs are 100% complete up to today, automatically
        // advance the baseline to maximize accuracy.
        // ---------------------------------------------------------
        try {
            const logStatus = checkIncompleteLogs();
            if (logStatus.allComplete && currentAnalysisData && currentAnalysisData.length > 0) {

                const updatedBaseline = {};
                currentAnalysisData.forEach(subject => {
                    updatedBaseline[subject.code] = {
                        attended: subject.attended,
                        total: subject.totalHeld
                    };
                });

                // FIX: Use local date for baseline to prevent timezone issues (e.g., UTC vs IST)
                // This ensures the baseline date matches the "Today" used in calculations
                const newBaselineDate = formatLocalDate(new Date());

                // Update portal setup
                selectedClass.portalSetup.baselineDate = newBaselineDate;
                selectedClass.portalSetup.baselineData = updatedBaseline;

                // Save persistent
                const classes = JSON.parse(localStorage.getItem('attendanceClasses_v2')) || {};
                classes[selectedClass.name] = selectedClass;
                localStorage.setItem('attendanceClasses_v2', JSON.stringify(classes));

                // FIX: Sync to cloud
                if (window.SyncManager) SyncManager.uploadAll();

                // Notify user
                if (typeof showToast === 'function') {
                    showToast(
                        'Baseline Updated',
                        `Portal baseline moved to ${newBaselineDate}.`,
                        { icon: '📅', duration: 4000 }
                    );
                }
            }
        } catch (e) {
            console.error('Auto-baseline update failed', e);
        }
    } else {
        triggerRecalculation();
    }

    // Refresh period-wise view if it's open (keep both views in sync)
    const periodModal = document.getElementById('periodAttendanceModal');
    if (periodModal && periodModal.classList.contains('active')) {
        openPeriodAttendanceModal();
    }
}

function openBackupModal() {
    const modal = document.getElementById('backupOptionsModal');

    // Fallback: populate content if empty
    if (modal && !modal.innerHTML.trim()) {
        modal.innerHTML = `
                <div class="modal-content">
                    <button class="modal-close" onclick="closeModal('backupOptionsModal')">&times;</button>
                    <div class="modal-header">
                        <h2>💾 Backup Data</h2>
                        <p>Choose how you want to save your backup.</p>
                    </div>
                    <div class="form-actions" style="flex-direction: column; gap: 15px;">
                        <button class="btn primary-btn" onclick="performBackupDownload()" style="width: 100%;">⬇️ Download JSON File</button>
                        <button class="btn success-btn" onclick="performBackupShare()" style="width: 100%;">📤 Share JSON File</button>
                        <button class="btn info-btn" onclick="performBackupCopy()" style="width: 100%;">📋 Copy JSON to Clipboard</button>
                    </div>
                </div>`;
    }

    // Use proper openModal function
    openModal('backupOptionsModal');
}



function getBackupDataObj() {
    // Gather ALL localStorage data
    const classesData = localStorage.getItem('attendanceClasses_v2') ?
        JSON.parse(localStorage.getItem('attendanceClasses_v2')) : {};

    // Collect per-class notification settings
    const notificationSettings = {};
    for (const className in classesData) {
        const key = `notificationSettings_${className} `;
        const settings = localStorage.getItem(key);
        if (settings) {
            notificationSettings[className] = JSON.parse(settings);
        }
    }

    // Collect timetable arrangements for each class
    const timetableArrangements = {};
    for (const className in classesData) {
        const key = `timetable_arrangement_${className} `;
        const arrangement = localStorage.getItem(key);
        if (arrangement) {
            timetableArrangements[className] = JSON.parse(arrangement);
        }
    }

    // Collect period times for each class
    const periodTimes = {};
    for (const className in classesData) {
        const key = `periodTimes_${className} `;
        const times = localStorage.getItem(key);
        if (times) {
            periodTimes[className] = JSON.parse(times);
        }
    }

    // Collect custom schedules for each class
    const customSchedules = {};
    for (const className in classesData) {
        const key = `custom_schedules_${className} `;
        const schedules = localStorage.getItem(key);
        if (schedules) {
            customSchedules[className] = JSON.parse(schedules);
        }
    }

    return {
        // Metadata
        metadata: {
            version: '3.2', // Updated: Includes Custom Schedules (Multiple Timetable Versions) & Export Fixes
            appVersion: '1.0.0', // App version for restore compatibility check
            timestamp: new Date().toISOString(),
            appName: 'Bunk it - Smart Attendance Manager',
            backupType: 'complete'
        },

        // Classes data
        classes: classesData,

        // Portal/Daily logs
        attendanceLogs: localStorage.getItem('attendance_logs') ?
            JSON.parse(localStorage.getItem('attendance_logs')) : {},

        // Per-class notification settings
        notificationSettings: notificationSettings,

        // Timetable arrangements
        timetableArrangements: timetableArrangements,

        // Period times
        periodTimes: periodTimes,

        // Custom schedules (for specific dates)
        customSchedules: customSchedules,

        // Theme preference
        theme: localStorage.getItem('theme') || 'light',

        // Last opened class
        lastOpenedClass: localStorage.getItem('lastOpenedClass') || '',

        // Default view preference (cards/subjects)
        defaultView: localStorage.getItem('defaultView') || 'cards',

        // User Profile Name (Guest mode)
        userProfileName: localStorage.getItem('userProfileName') || '',

        // Personal Gemini API Key
        personalGeminiKey: localStorage.getItem('personalGeminiKey') || '',

        // Statistics
        stats: {
            totalClasses: Object.keys(classesData).length,
            totalLogs: Object.keys(
                localStorage.getItem('attendance_logs') ?
                    JSON.parse(localStorage.getItem('attendance_logs')) : {}
            ).length,
            notificationSettingsCount: Object.keys(notificationSettings).length,
            timetableArrangementsCount: Object.keys(timetableArrangements).length,
            customSchedulesCount: Object.keys(customSchedules).length
        }
    };
}

function performBackupDownload() {
    try {
        const backupData = getBackupDataObj();
        const jsonString = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        // Create download with timestamp (Local Time)
        const now = new Date();
        const timestamp = now.getFullYear() + '-' +
            String(now.getMonth() + 1).padStart(2, '0') + '-' +
            String(now.getDate()).padStart(2, '0') + '_' +
            String(now.getHours()).padStart(2, '0') + '-' +
            String(now.getMinutes()).padStart(2, '0');
        const filename = `bunkit_complete_backup_${timestamp}.json`;

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        closeModal('backupOptionsModal');
        // Success notification
        alert(`✅ Complete backup created successfully!\n\nFile: ${filename} \n\nIncludes: \n• ${backupData.stats.totalClasses} class(es) \n• ${backupData.stats.totalLogs} attendance log(s) \n• ${backupData.stats.notificationSettingsCount} notification setting(s) \n• ${backupData.stats.timetableArrangementsCount} timetable arrangement(s) \n• Theme preferences`);

    } catch (error) {
        console.error('Backup failed:', error);
        alert(`❌ Backup failed: ${error.message} \n\nPlease try again or contact support.`);
    }
}





async function performBackupShare() {
    try {
        const backupData = getBackupDataObj();
        const jsonString = JSON.stringify(backupData, null, 2);
        const now = new Date();
        const timestamp = now.getFullYear() + '-' +
            String(now.getMonth() + 1).padStart(2, '0') + '-' +
            String(now.getDate()).padStart(2, '0') + '_' +
            String(now.getHours()).padStart(2, '0') + '-' +
            String(now.getMinutes()).padStart(2, '0');
        const filename = `bunkit_complete_backup_${timestamp}.json`;

        const file = new File([jsonString], filename, { type: 'application/json' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: 'Bunk it Backup',
                text: 'Here is my Bunk it attendance backup file.'
            });
            closeModal('backupOptionsModal');
        } else {
            throw new Error("Sharing files is not supported on this browser/device.");
        }
    } catch (error) {
        console.error('Share failed:', error);
        alert(`❌ Share failed: ${error.message} \n\nTry downloading the file instead.`);
    }
}

async function performBackupCopy() {
    try {
        const backupData = getBackupDataObj();
        const jsonString = JSON.stringify(backupData, null, 2);
        await navigator.clipboard.writeText(jsonString);
        alert("✅ Backup JSON copied to clipboard!");
        closeModal('backupOptionsModal');
    } catch (error) {
        console.error('Copy failed:', error);
        alert(`❌ Copy failed: ${error.message} `);
    }
}

function openExportModal() {
    const className = document.getElementById('classSelector').value;
    if (!className) { alert('Please select a class to export.'); return; }

    const classData = { ...classes[className] };

    // Add qrCode field (empty placeholder)
    classData.qrCode = classData.qrCode || '';

    // Get timetable arrangement and convert to new string schedule format
    const arrangement = getTimetableArrangement(className);

    // Process subjects to include shortName and convert schedule to string format
    if (classData.subjects) {
        classData.subjects = classData.subjects.map((subject, index) => {
            // Add shortName if not present
            const shortName = subject.shortName || getSubjectShortName(subject.name);

            // Convert schedule to new string format using timetable arrangement
            let newSchedule = [];
            const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            days.forEach((dayName, dayIndex) => {
                if (arrangement && arrangement[dayIndex]) {
                    // Find which periods this subject occupies
                    const periods = [];
                    arrangement[dayIndex].forEach((item, periodIndex) => {
                        const itemCode = (typeof item === 'string') ? item : (item?.code || null);
                        if (itemCode === subject.code) {
                            periods.push(periodIndex + 1);
                        }
                    });
                    newSchedule.push(periods.length > 0 ? periods.join(',') : '0');
                } else {
                    // Fallback: use count-based format
                    const count = subject.schedule?.[dayIndex] || 0;
                    if (count > 0) {
                        const periods = Array.from({ length: count }, (_, i) => i + 1);
                        newSchedule.push(periods.join(','));
                    } else {
                        newSchedule.push('0');
                    }
                }
            });

            return {
                name: subject.name,
                shortName: shortName,
                code: subject.code,
                schedule: newSchedule
            };
        });
    }

    // Remove timetableArrangement from export (not part of new format)
    delete classData.timetableArrangement;

    // === INCLUDE EXTERNAL DATA (Period Times, Custom Schedules, Notifications) ===
    const periodTimes = localStorage.getItem(`periodTimes_${className}`);
    if (periodTimes) classData.periodTimes = JSON.parse(periodTimes);

    const customSchedules = localStorage.getItem(`custom_schedules_${className}`);
    if (customSchedules) classData.customSchedules = JSON.parse(customSchedules);

    const notificationSettings = localStorage.getItem(`notificationSettings_${className}`);
    if (notificationSettings) classData.notificationSettings = JSON.parse(notificationSettings);

    const exportObject = { [className]: classData };
    const jsonString = JSON.stringify(exportObject, null, 2);

    // Ensure modal content exists
    const modal = document.getElementById('exportModal');
    if (modal && !modal.innerHTML.trim()) {
        modal.innerHTML = `<div class="modal-content"><button class="modal-close" onclick="closeModal('exportModal')">&times;</button><div class="modal-header"><h2>Export/Share Class</h2><p>Copy this JSON and share it. Your friend can import it using the 'Import from JSON' tab.</p></div><div class="form-group"><textarea id="exportJsonTextarea" readonly></textarea></div><div class="form-actions"><button class="btn primary-btn" onclick="copyExportJson()">Copy to Clipboard</button></div></div>`;
    }

    const textarea = document.getElementById('exportJsonTextarea');
    if (textarea) textarea.value = jsonString;
    openModal('exportModal');
}

// NOTE: copyExportJson is defined at line ~10082 in the compressed functions
// Duplicate removed to avoid conflicts

async function shareExportJson(className) {
    const jsonString = document.getElementById("exportJsonTextarea").value;
    const filename = `bunkit_class_${className}.json`;
    const file = new File([jsonString], filename, { type: 'application/json' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({
                files: [file],
                title: `Bunk it Class: ${className}`,
                text: `Here is the setup for ${className}. Import it in Bunk it!`
            });
        } catch (err) {
            console.error("Share failed", err);
        }
    } else {
        alert("Sharing files not supported. Please copy the code instead.");
    }
}

function copyBackupToClipboard() {
    try {
        const backupData = getBackupDataObj();
        const jsonString = JSON.stringify(backupData, null, 2);
        navigator.clipboard.writeText(jsonString).then(() => {
            alert("✅ Backup JSON copied to clipboard!");
            closeModal('backupOptionsModal');
        });
    } catch (error) {
        console.error('Copy failed:', error);
        alert(`❌ Copy failed: ${error.message} `);
    }
}

function downloadBackupFile() {
    if (typeof performBackupDownload === 'function') {
        performBackupDownload();
    } else {
        alert("Backup function missing.");
    }
}

function openRestoreModal() {
    const modal = document.getElementById('restoreOptionsModal');

    // Fallback: populate content if empty
    if (modal && !modal.innerHTML.trim()) {
        modal.innerHTML = `
                <div class="modal-content">
                    <button class="modal-close" onclick="closeModal('restoreOptionsModal')">&times;</button>
                    <div class="modal-header"><h2>♻️ Restore Data</h2><p>Choose how you want to restore your data.</p></div>
                    
                    <div class="modal-tabs">
                        <button id="restoreFileTabBtn" class="active" onclick="switchRestoreTab('file')">Upload File</button>
                        <button id="restorePasteTabBtn" onclick="switchRestoreTab('paste')">Paste JSON</button>
                    </div>

                    <div id="restoreFileTab">
                        <div style="text-align: center; padding: 20px;">
                            <p style="margin-bottom: 20px;">Upload a previously backed up .json file.</p>
                            <button class="btn primary-btn" onclick="document.getElementById('restoreInput').click()">📂 Select Backup File</button>
                        </div>
                    </div>

                    <div id="restorePasteTab" style="display: none;">
                        <div class="form-group">
                            <label for="restoreJsonPaste">Paste Backup JSON:</label>
                            <textarea id="restoreJsonPaste" placeholder='Paste your backup JSON here...' style="min-height: 200px; font-family: monospace;"></textarea>
                        </div>
                        <div class="form-actions">
                            <button class="btn primary-btn" onclick="performRestorePaste()">Restore from Text</button>
                        </div>
                    </div>
                </div>`;
    }

    // Use the proper openModal function which sets display and backdrop
    openModal('restoreOptionsModal');
}

function switchRestoreTab(tab) {
    document.getElementById('restoreFileTab').style.display = tab === 'file' ? 'block' : 'none';
    document.getElementById('restorePasteTab').style.display = tab === 'paste' ? 'block' : 'none';
    document.getElementById('restoreFileTabBtn').classList.toggle('active', tab === 'file');
    document.getElementById('restorePasteTabBtn').classList.toggle('active', tab === 'paste');
}

function restoreFromPaste() {
    const jsonText = document.getElementById('restoreJsonPaste').value;
    if (!jsonText.trim()) {
        alert("Please paste the JSON code first.");
        return;
    }
    try {
        const data = JSON.parse(jsonText);
        processRestoreData(data);
        closeModal('restoreOptionsModal');
    } catch (e) {
        alert("Invalid JSON format. Please check the code.");
    }
}

function triggerRestore() {
    // Kept for backward compatibility if needed, but now we use openRestoreModal
    openRestoreModal();
}

function restoreData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const jsonString = e.target.result;
            processRestoreData(jsonString);
            closeModal('restoreOptionsModal'); // Close modal on success
        } catch (error) {
            console.error('Restore failed:', error);
            alert(`❌ Error restoring data: ${error.message} \n\nPlease ensure you're using a valid backup file.`);
        }
    };
    reader.readAsText(file);
    event.target.value = null;
}

function performRestorePaste() {
    const jsonString = document.getElementById('restoreJsonPaste').value;
    if (!jsonString.trim()) {
        alert("Please paste the backup JSON code first.");
        return;
    }
    try {
        processRestoreData(jsonString);
        closeModal('restoreOptionsModal');
        document.getElementById('restoreJsonPaste').value = ''; // Clear after success
    } catch (error) {
        console.error('Restore failed:', error);
        alert(`❌ Error restoring data: ${error.message}\n\nPlease check if the JSON is valid.`);
    }
}

function processRestoreData(jsonString) {
    const backupData = JSON.parse(jsonString);

    // Validate backup data structure
    if (!backupData || typeof backupData !== 'object') {
        throw new Error("Invalid backup format.");
    }

    // Check if it's a complete backup or old format
    const isCompleteBackup = backupData.metadata && backupData.metadata.backupType === 'complete';

    // Version check - warn if backup is from a newer version
    const currentAppVersion = '1.0.0'; // Update this when releasing new versions
    if (backupData.metadata?.appVersion && backupData.metadata.appVersion > currentAppVersion) {
        if (!confirm(`⚠️ VERSION MISMATCH WARNING\\n\\nThis backup was created with a newer version of the app (${backupData.metadata.appVersion}).\\n\\nYour current version is ${currentAppVersion}.\\n\\nRestoring may cause unexpected behavior.\\n\\nProceed anyway?`)) {
            return;
        }
    }

    if (isCompleteBackup) {
        // New comprehensive backup format
        if (!confirm(`⚠️ RESTORE COMPLETE BACKUP?\\n\\nThis will replace ALL current data:\\n\\n• Classes: ${backupData.stats?.totalClasses || 0}\\n• Logs: ${backupData.stats?.totalLogs || 0}\\n• Notification Settings: ${backupData.stats?.notificationSettingsCount || 0}\\n• Timetable Arrangements: ${backupData.stats?.timetableArrangementsCount || 0}\\n• Theme preferences\\n\\nBackup created: ${new Date(backupData.metadata.timestamp).toLocaleString()}\\n\\nContinue?`)) {
            return;
        }

        // Restore all data
        if (backupData.classes) {
            localStorage.setItem('attendanceClasses_v2', JSON.stringify(backupData.classes));
        }

        if (backupData.attendanceLogs) {
            localStorage.setItem('attendance_logs', JSON.stringify(backupData.attendanceLogs));
            // Clean up any holiday logs that may have been imported
            cleanupHolidayLogs();
        }

        if (backupData.theme) {
            localStorage.setItem('theme', backupData.theme);
            // Apply theme
            if (backupData.theme === 'dark') {
                document.body.classList.add('dark-mode');
                document.getElementById('theme-checkbox').checked = true;
            } else {
                document.body.classList.remove('dark-mode');
                document.getElementById('theme-checkbox').checked = false;
            }
        }

        // Restore per-class notification settings
        if (backupData.notificationSettings) {
            for (const className in backupData.notificationSettings) {
                if (backupData.notificationSettings.hasOwnProperty(className)) {
                    localStorage.setItem(
                        `notificationSettings_${className}`,
                        JSON.stringify(backupData.notificationSettings[className])
                    );
                }
            }
        }

        // Restore timetable arrangements
        if (backupData.timetableArrangements) {
            for (const className in backupData.timetableArrangements) {
                if (backupData.timetableArrangements.hasOwnProperty(className)) {
                    localStorage.setItem(
                        `timetable_arrangement_${className}`,
                        JSON.stringify(backupData.timetableArrangements[className])
                    );
                }
            }
        }

        // Restore period times
        if (backupData.periodTimes) {
            for (const className in backupData.periodTimes) {
                if (backupData.periodTimes.hasOwnProperty(className)) {
                    localStorage.setItem(
                        `period_times_${className}`,
                        JSON.stringify(backupData.periodTimes[className])
                    );
                }
            }
        }

        // Restore custom schedules
        if (backupData.customSchedules) {
            for (const className in backupData.customSchedules) {
                if (backupData.customSchedules.hasOwnProperty(className)) {
                    localStorage.setItem(
                        `custom_schedules_${className}`,
                        JSON.stringify(backupData.customSchedules[className])
                    );
                }
            }
        }

        // Restore last opened class
        if (backupData.lastOpenedClass) {
            localStorage.setItem('lastOpenedClass', backupData.lastOpenedClass);
        }

        // Restore default view preference
        if (backupData.defaultView) {
            localStorage.setItem('defaultView', backupData.defaultView);
        }

        // Restore User Profile Name
        if (backupData.userProfileName) {
            localStorage.setItem('userProfileName', backupData.userProfileName);
        }

        // Restore Personal Gemini API Key
        if (backupData.personalGeminiKey) {
            localStorage.setItem('personalGeminiKey', backupData.personalGeminiKey);
        }

        // Reload application state
        loadFromStorage();
        populateClassSelector();
        onClassChange();

        alert("✅ Complete data restore successful!\n\nAll your classes, logs, notification settings, timetable arrangements, and preferences have been restored.\n\nThe app will now refresh.");

        // Sync restored data to cloud
        if (window.SyncManager) {
            // We can't await easily here without refactoring to async, 
            // but alert() blocks UI. 
            // We surely want to try.
            SyncManager.uploadAll().then(() => {
                location.reload();
            }).catch(() => location.reload()); // Fallback
            return;
        }
        location.reload();

    } else {
        // Old backup format (classes only)
        if (!confirm("This appears to be an older backup (classes only). Restore?")) {
            return;
        }

        if (typeof backupData !== 'object' || Array.isArray(backupData) || backupData === null) {
            throw new Error("Invalid JSON format. Expected a class object.");
        }

        localStorage.setItem('attendanceClasses_v2', JSON.stringify(backupData));
        loadFromStorage();
        populateClassSelector();
        onClassChange();
        alert("✅ Data restored successfully!\n\nThe app will now refresh.");
        location.reload();
    }
}

function updateHistoryDropdown() {
    const dropdown = document.getElementById('historyDropdown');
    if (!dropdown) return; // Element doesn't exist yet
    dropdown.innerHTML = '';
    if (calculationHistory.length === 0) {
        dropdown.innerHTML = '<a href="#" style="color: var(--medium-text);">No history yet.</a>';
        return;
    }
    calculationHistory.forEach((item, index) => {
        const date = new Date(item.timestamp);
        const dateString = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        dropdown.innerHTML += `<a href="#" onclick="restoreFromHistory(${index}); closeNav();">Calculation from ${dateString}</a>`;
    });
    dropdown.innerHTML += `<a href="#" onclick="downloadHistoryPDF(); closeNav();"><strong>Download Full History (PDF)</strong></a>`;
}

function restoreFromHistory(index) {
    const snapshot = calculationHistory[index];
    if (!snapshot) return;

    document.getElementById('minAttendanceInput').value = snapshot.settings.minAttendance;
    document.getElementById('overallCriteriaCheckbox').checked = snapshot.settings.overallMode;
    document.getElementById('currentDate').value = snapshot.settings.currentDate;
    document.getElementById('lastDate').value = snapshot.settings.lastDate;

    calculateAttendance(snapshot.results);
    alert(`Restored state from ${new Date(snapshot.timestamp).toLocaleString()}`);
}

/**
 * Generates and downloads a PDF report of the current attendance analysis.
 * Uses jsPDF for direct, text-based PDF creation with professional design.
 */
async function downloadCurrentReportPDF() {
    // Lazy-load jsPDF on first use
    try { await loadScript(CDN.JSPDF); } catch (e) {
        alert('⚠️ Failed to load PDF library. Check your internet connection.');
        return;
    }
    // 1. Pre-computation and validation
    if (!window.jspdf) {
        alert("PDF generation library is not loaded. Please refresh the page.");
        return;
    }
    if (currentAnalysisData.length === 0) {
        alert("No report to download. Please calculate attendance first.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // 2. Document constants and state variables
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const leftMargin = 15;
    const rightMargin = pageWidth - 15;
    let yPos = 15;

    // Color palette
    const colors = {
        primary: [102, 126, 234],      // #667eea
        secondary: [118, 75, 162],     // #764BA2
        success: [34, 197, 94],        // #22c55e
        warning: [245, 158, 11],       // #f59e0b
        danger: [239, 68, 68],         // #ef4444
        text: [55, 65, 81],            // #374151
        lightText: [107, 114, 128],    // #6b7280
        white: [255, 255, 255]
    };

    // Helper function for colored rectangles
    const drawRect = (x, y, w, h, color, fill = true) => {
        doc.setFillColor(...color);
        doc.setDrawColor(...color);
        if (fill) doc.rect(x, y, w, h, 'F');
        else doc.rect(x, y, w, h, 'S');
    };

    // Helper for adding text with page break handling
    const addText = (text, size, options = {}) => {
        const { bold = false, color = colors.text, x = leftMargin, align = 'left' } = options;
        if (yPos > pageHeight - 25) {
            doc.addPage();
            yPos = 20;
        }
        doc.setFontSize(size);
        doc.setFont(undefined, bold ? 'bold' : 'normal');
        doc.setTextColor(...color);
        doc.text(text, x, yPos, { align });
        yPos += (size * 0.45);
    };

    // 3. Professional Header with gradient-like effect
    drawRect(0, 0, pageWidth, 50, colors.primary);
    drawRect(0, 43, pageWidth, 7, colors.secondary);

    // Branding: Bunk it Logo Text
    doc.setTextColor(...colors.white);
    doc.setFontSize(28);
    doc.setFont(undefined, 'bold');
    doc.text('Bunk it', leftMargin, 20);

    doc.setFontSize(14);
    doc.setFont(undefined, 'normal');
    doc.text('Smart Attendance Manager', leftMargin, 28);

    // Report Title
    doc.setFontSize(22);
    doc.setFont(undefined, 'bold');
    doc.text('Attendance Report', rightMargin, 22, { align: 'right' });

    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    const className = document.getElementById('classSelector').value || "N/A";
    doc.text(`Class: ${className}`, rightMargin, 32, { align: 'right' });

    const currentDate = new Date().toLocaleDateString('en-IN', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    doc.text(currentDate, rightMargin, 38, { align: 'right' });

    yPos = 65;

    // 4. Settings box
    drawRect(leftMargin, yPos - 5, pageWidth - 30, 18, [243, 244, 246]);
    doc.setTextColor(...colors.text);
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    const minAtt = document.getElementById('minAttendanceInput').value;
    const mode = isOverallMode() ? 'Overall Mode' : 'Per-Subject Mode';
    doc.text(`Settings: Minimum ${minAtt}% Attendance Required  |  Analysis Mode: ${mode}`, leftMargin + 5, yPos + 4);
    yPos += 22;

    // 5. Document Body
    if (isOverallMode()) {
        // Calculate overall stats
        const overall = currentAnalysisData.reduce((acc, subject) => {
            acc.attended += subject.attended;
            acc.totalHeld += subject.totalHeld;
            acc.remaining += subject.remaining;
            return acc;
        }, { attended: 0, totalHeld: 0, remaining: 0 });

        const { stats } = getSubjectAnalysis(overall.attended, overall.totalHeld, overall.remaining);

        // Overall percentage card
        const percentColor = stats.currentPercent >= 75 ? colors.success :
            stats.currentPercent >= 65 ? colors.warning : colors.danger;

        drawRect(leftMargin, yPos, pageWidth - 30, 35, percentColor);
        doc.setTextColor(...colors.white);
        doc.setFontSize(36);
        doc.setFont(undefined, 'bold');
        doc.text(`${stats.currentPercent.toFixed(1)}%`, pageWidth / 2, yPos + 22, { align: 'center' });
        doc.setFontSize(12);
        doc.text('Current Attendance', pageWidth / 2, yPos + 30, { align: 'center' });
        yPos += 45;

        // Stats grid
        const stats_items = [
            { label: 'Classes Attended', value: stats.attended },
            { label: 'Total Classes', value: stats.totalHeld },
            { label: 'Remaining', value: stats.remaining },
            { label: 'Must Attend', value: stats.stillNeed },
            { label: 'Can Skip', value: stats.maxSkippable },
            { label: 'Projected Max', value: `${stats.projectedMaxPercent.toFixed(1)}%` }
        ];

        const cardWidth = (pageWidth - 40) / 3;
        stats_items.forEach((item, i) => {
            const row = Math.floor(i / 3);
            const col = i % 3;
            const x = leftMargin + (col * (cardWidth + 5));
            const y = yPos + (row * 25);

            drawRect(x, y - 5, cardWidth - 2, 22, [249, 250, 251]);
            doc.setTextColor(...colors.text);
            doc.setFontSize(8);
            doc.text(item.label, x + 3, y + 3);
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.text(String(item.value), x + 3, y + 13);
            doc.setFont(undefined, 'normal');
        });
        yPos += 60;

    } else {
        // Per-Subject Mode
        addText('Subject-wise Analysis', 16, { bold: true, color: colors.primary });
        yPos += 5;

        currentAnalysisData.forEach((subject, index) => {
            if (yPos > pageHeight - 50) {
                doc.addPage();
                yPos = 20;
            }

            const { alertMessage, stats } = getSubjectAnalysis(subject.attended, subject.totalHeld, subject.remaining);
            const percentColor = stats.currentPercent >= 75 ? colors.success :
                stats.currentPercent >= 65 ? colors.warning : colors.danger;

            // Subject card
            drawRect(leftMargin, yPos - 3, pageWidth - 30, 28, [249, 250, 251]);

            // Percentage badge
            drawRect(rightMargin - 35, yPos, 30, 12, percentColor);
            doc.setTextColor(...colors.white);
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.text(`${stats.currentPercent.toFixed(1)}%`, rightMargin - 20, yPos + 8, { align: 'center' });

            // Subject name
            doc.setTextColor(...colors.text);
            doc.setFontSize(12);
            doc.text(`${index + 1}. ${subject.name}`, leftMargin + 3, yPos + 5);

            // Subject code
            doc.setTextColor(...colors.lightText);
            doc.setFontSize(9);
            doc.text(`Code: ${subject.code}`, leftMargin + 3, yPos + 12);

            // Stats
            doc.setTextColor(...colors.text);
            doc.setFontSize(9);
            doc.text(`Attended: ${stats.attended}/${stats.totalHeld} | Remaining: ${stats.remaining} | Must Attend: ${stats.stillNeed} | Can Skip: ${stats.maxSkippable}`, leftMargin + 3, yPos + 20);

            yPos += 33;
        });
    }

    // 6. Footer
    yPos = pageHeight - 15;
    doc.setDrawColor(...colors.lightText);
    doc.line(leftMargin, yPos - 5, rightMargin, yPos - 5);
    doc.setTextColor(...colors.lightText);
    doc.setFontSize(8);
    doc.text('Generated by Bunk it - Smart Attendance Manager | bunkitapp.in', pageWidth / 2, yPos, { align: 'center', url: 'https://bunkitapp.in' });

    // 7. Save the document
    const filename = `Attendance_Report_${className.replace(/\\s/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);

    // Celebrate!
    celebrateAchievement('default');
}

/**
 * Generates and downloads a multi-page PDF report of all calculations in the history.
 * Uses jsPDF for robust, text-based PDF creation.
 */
function downloadHistoryPDF() {
    // 1. Validation
    if (!window.jspdf) {
        alert("PDF generation library is not loaded. Please refresh the page.");
        return;
    }
    if (calculationHistory.length === 0) {
        alert("No history available to download.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // 2. Document constants and state variables
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    const leftMargin = 15;
    let yPos = 20;
    let pageNum = 1;

    // Helper to add footer with page number
    const addFooter = () => {
        doc.setFontSize(8);
        doc.text(`Page ${pageNum}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    };

    // 3. Document Header
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text('Full Calculation History', leftMargin, yPos);
    yPos += 15;

    // 4. Loop through history (oldest to newest)
    calculationHistory.slice().reverse().forEach((snapshot, index) => {
        const requiredSpace = (snapshot.results.length * 10) + 25; // Estimate space needed
        if (yPos + requiredSpace > pageHeight - 20) {
            addFooter();
            doc.addPage();
            yPos = 20;
            pageNum++;
        }

        const timestamp = new Date(snapshot.timestamp);
        const settings = snapshot.settings;
        const mode = settings.overallMode ? 'Overall' : 'Per-Subject';

        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text(`Report #${index + 1} - ${timestamp.toLocaleString()}`, leftMargin, yPos);
        yPos += 7;

        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        doc.text(`Settings: Min ${settings.minAttendance}% (${mode}) | Current Date: ${settings.currentDate}`, leftMargin, yPos);
        yPos += 8;

        // Print each subject's data from the snapshot
        snapshot.results.forEach(subject => {
            const minCriteria = (parseFloat(settings.minAttendance) || 75) / 100;
            const { stats } = getSubjectAnalysis(subject.attended, subject.totalHeld, subject.remaining, minCriteria);

            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.text(`${subject.name} (${subject.code}):`, leftMargin + 2, yPos);
            yPos += 5;

            doc.setFontSize(9);
            doc.setFont(undefined, 'normal');
            let statsLine = `Current: ${stats.currentPercent.toFixed(1)}% (${subject.attended}/${subject.totalHeld}) | `
                + `Max Projected: ${stats.projectedMaxPercent.toFixed(1)}% | `
                + `Can Skip: ${stats.maxSkippable}`;
            doc.text(statsLine, leftMargin + 4, yPos);
            yPos += 6;
        });

        yPos += 5; // Extra space between history entries
        doc.line(leftMargin, yPos, pageWidth - leftMargin, yPos); // Separator line
        yPos += 10;
    });

    // 5. Add footer to the last page and save
    addFooter();
    const filename = `Full_History_Report_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
}

function deleteSelectedClass() {
    const selector = document.getElementById('classSelector');
    const className = selector.value;
    if (!className) {
        alert('Please select a class to delete.');
        return;
    }

    if (confirm(`Are you sure you want to permanently delete the class "${className}"? This cannot be undone.`)) {
        delete classes[className];
        // Clean up associated localStorage keys
        localStorage.removeItem(`notificationSettings_${className}`);
        localStorage.removeItem(`timetable_arrangement_${className}`);
        localStorage.removeItem(`periodTimes_${className}`);
        localStorage.removeItem(`custom_schedules_${className}`);
        saveToStorage();
        populateClassSelector();

        if (selector.options.length > 1) {
            selector.selectedIndex = 1;
        } else {
            selector.selectedIndex = 0;
        }
        handleDropdownChange();
        alert(`Class "${className}" has been deleted.`);
    }
}

function restoreDefaultClass() {
    const exampleClassName = Object.keys(defaultExampleClass)[0];

    // BLOCK: If user has ANY class, don't allow Example Class
    const existingClasses = Object.keys(classes).filter(c => c !== exampleClassName);
    if (existingClasses.length > 0) {
        alert(`❌ Cannot restore Example Class.\n\nYou already have ${existingClasses.length} class(es).\nExample Class is only for new users with no data.`);
        return;
    }

    if (classes[exampleClassName]) {
        alert(`The example class "${exampleClassName}" already exists.`);
        return;
    }
    // Clone the example data to avoid modifying the constant
    const classData = JSON.parse(JSON.stringify(defaultExampleClass[exampleClassName]));

    // Extract and save separate side-loaded data
    if (classData.timetable) {
        localStorage.setItem(`timetable_arrangement_${exampleClassName}`, JSON.stringify(classData.timetable));
        delete classData.timetable; // Remove from main object to keep it lightweight
    }

    classes[exampleClassName] = classData;
    saveToStorage();
    populateClassSelector();
    document.getElementById('classSelector').value = exampleClassName;
    handleDropdownChange();
    showToast('Default example class restored.', 'info');
}

// --- PORTAL FEATURE IMPLEMENTATION ---

function openPortalSetup() {
    if (!selectedClass) { showToast("Please select a class first.", 'error'); return; }

    const modal = document.getElementById('portalSetupModal');
    let html = `
                <div class="modal-content">
                    <button class="modal-close" onclick="closeModal('portalSetupModal')">&times;</button>
                    <div class="modal-header"><h2>🎓 Student Portal Setup</h2><p>Set your current attendance baseline to start tracking daily.</p></div>
                    
                    <div class="form-group">
                        <label>Portal Start Date (Baseline Date):</label>
                        <input type="date" id="portalStartDate" value="${new Date().toISOString().split('T')[0]}">
                        <p style="font-size: 0.8rem; color: var(--medium-text);">Enter attendance data as of this date.</p>
                    </div>

                    <div class="form-group">
                        <label>Semester Start Date:</label>
                        <input type="date" id="semesterStartDate" value="${selectedClass.portalSetup?.semesterStartDate || ''}">
                        <p style="font-size: 0.8rem; color: var(--medium-text);">Used for Medical Certificate calculations.</p>
                    </div>

`;

    selectedClass.subjects.forEach(subject => {
        // Try to pre-fill from current analysis if available, or existing portal data
        let currentAttended = 0;
        let currentTotal = 0;

        if (selectedClass.portalSetup && selectedClass.portalSetup.baselineData && selectedClass.portalSetup.baselineData[subject.code]) {
            currentAttended = selectedClass.portalSetup.baselineData[subject.code].attended;
            currentTotal = selectedClass.portalSetup.baselineData[subject.code].total;
        } else if (currentAnalysisData.length > 0) {
            const analysis = currentAnalysisData.find(s => s.code === subject.code);
            if (analysis) {
                currentAttended = analysis.attended;
                currentTotal = analysis.totalHeld;
            }
        }

        html += `
                    <div class="subject-input">
                        <h4>${subject.name} (${subject.code})</h4>
                        <div class="manual-input-fields">
                            <div class="input-group">
                                <label style="font-size: 0.8rem;">Total Held</label>
                                <input type="number" id="portal_total_${subject.code}" value="${currentTotal}" min="0">
                            </div>
                            <div class="input-group">
                                <label style="font-size: 0.8rem;">Attended</label>
                                <input type="number" id="portal_attended_${subject.code}" value="${currentAttended}" min="0">
                            </div>
                        </div>
                    </div>`;
    });

    html += `
                    <div class="form-actions">
                        <button class="btn primary-btn" onclick="savePortalSetup()">🚀 Start Portal Mode</button>
                        ${selectedClass.portalSetup ? '<button class="btn danger-btn" onclick="disablePortalMode()">❌ Disable Portal</button>' : ''}
                    </div>
                </div>`;

    modal.innerHTML = html;
    openModal('portalSetupModal');
}

function savePortalSetup() {
    const startDateInput = document.getElementById('portalStartDate');
    const semesterStartInput = document.getElementById('semesterStartDate');

    if (!startDateInput || !semesterStartInput) return;

    const startDate = startDateInput.value;
    const semesterStartDate = semesterStartInput.value;

    if (!startDate) { showToast("Please select a start date.", 'error'); return; }
    if (!semesterStartDate) { showToast("Please select a Semester Start Date to enable Portal Mode.", 'error'); return; }

    // Date ordering validation
    if (new Date(semesterStartDate) > new Date(startDate)) {
        showToast("Semester Start Date cannot be after the Baseline Date.", 'error');
        return;
    }
    if (selectedClass.lastDate && new Date(startDate) > new Date(selectedClass.lastDate)) {
        showToast("Baseline Date cannot be after the Class End Date.", 'error');
        return;
    }

    const baselineData = {};
    let isValid = true;

    selectedClass.subjects.forEach(subject => {
        const totalInput = document.getElementById(`portal_total_${subject.code}`);
        const attendedInput = document.getElementById(`portal_attended_${subject.code}`);

        if (!totalInput || !attendedInput) return;

        const total = parseInt(totalInput.value) || 0;
        const attended = parseInt(attendedInput.value) || 0;

        if (attended > total) {
            showToast(`Invalid data for ${subject.name}: Attended cannot be greater than Total.`, 'error');
            isValid = false;
            return;
        }
        baselineData[subject.code] = { total, attended };
    });

    if (!isValid) return;

    selectedClass.portalSetup = {
        baselineDate: startDate,
        semesterStartDate: semesterStartDate,
        baselineData: baselineData,
        active: true
    };

    classes[selectedClass.name || document.getElementById('classSelector').value] = selectedClass; // Ensure update in main object
    saveToStorage();
    closeModal('portalSetupModal');
    initPortal();
    showToast("Portal Mode Activated! You can now track attendance daily.", 'success');

    // Auto-enable notifications if not already enabled
    autoEnableNotificationsForPortal();

    // Show period-wise view menu item
    if (typeof updatePeriodViewMenuVisibility === 'function') {
        updatePeriodViewMenuVisibility();
    }
}

function disablePortalMode() {
    if (confirm("Are you sure you want to disable Portal Mode? Your baseline data will be removed, but daily logs will remain.")) {
        delete selectedClass.portalSetup;
        classes[selectedClass.name || document.getElementById('classSelector').value] = selectedClass;
        saveToStorage();
        closeModal('portalSetupModal');
        initPortal();

        // Hide period-wise view menu item when portal mode is disabled
        if (typeof updatePeriodViewMenuVisibility === 'function') {
            updatePeriodViewMenuVisibility();
        }
    }
}

function initPortal() {
    const portalSection = document.getElementById('portalDashboardSection');
    const uploadSection = document.getElementById('uploadSection');
    const manualInput = document.getElementById('manualInput'); // Hide manual input if portal is active
    const jsonInput = document.getElementById('jsonInput');
    const portalBtn = document.getElementById('portalBtn');

    if (selectedClass && selectedClass.portalSetup && selectedClass.portalSetup.active) {
        // VALIDATION: Ensure Semester Start Date exists
        if (!selectedClass.portalSetup.semesterStartDate) {
            showToast("Action Required: Set Semester Start Date.", 'warning');
            openPortalSetup();
            return;
        }

        // Portal Active State
        portalSection.style.display = 'block';
        uploadSection.style.display = 'none'; // Hide upload in portal mode
        if (manualInput) manualInput.style.display = 'none';
        if (jsonInput) jsonInput.style.display = 'none';
        portalBtn.textContent = "Portal Settings";
        portalBtn.className = "btn secondary-btn"; // Change style to indicate active/settings

        renderPortalDashboard();
        calculateFromPortal(); // Auto-calculate on load
    } else {
        // Standard Mode
        portalSection.style.display = 'none';
        uploadSection.style.display = 'block';
        if (portalBtn) {
            portalBtn.textContent = "Student Portal";
            portalBtn.className = "btn info-btn";
        }
    }
}

function checkIncompleteLogs() {
    if (!selectedClass || !selectedClass.portalSetup || !selectedClass.portalSetup.semesterStartDate) {
        return { hasGap: false, allComplete: false };
    }

    const logs = JSON.parse(localStorage.getItem('attendance_logs')) || {};
    const today = new Date();
    const semStart = parseLocalDate(selectedClass.portalSetup.semesterStartDate);
    const baselineDate = parseLocalDate(selectedClass.portalSetup.baselineDate);
    const holidays = selectedClass.holidays || [];
    const className = document.getElementById('classSelector')?.value;
    const arrangement = getTimetableArrangement(className) || {};

    let lastLogDate = null;
    let missingDates = [];

    // Find the most recent log date
    Object.keys(logs).forEach(dateStr => {
        const logDate = parseLocalDate(dateStr);
        if (logDate >= semStart && logDate <= today) {
            if (!lastLogDate || logDate > parseLocalDate(lastLogDate)) {
                lastLogDate = dateStr;
            }
        }
    });

    // Check for missing logs by iterating through all working days from BASELINE DATE to today
    // We only need to check from baseline date onwards because baseline already covers before that
    let currentDate = new Date(baselineDate);
    currentDate.setDate(currentDate.getDate() + 1); // Start from day AFTER baseline

    while (currentDate <= today) {
        const dateStr = formatLocalDate(currentDate);

        // Skip holidays
        if (!holidays.includes(dateStr)) {
            const dayOfWeek = currentDate.getDay();
            const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

            // Check if this day has classes scheduled
            const customSchedule = getCustomScheduleForDate(dateStr);
            let hasClasses = false;

            if (customSchedule && customSchedule._periods) {
                hasClasses = customSchedule._periods.some(code => code && code !== 'Free');
            } else if (customSchedule && typeof customSchedule === 'object') {
                hasClasses = Object.keys(customSchedule).filter(k => k !== '_periods').length > 0;
            } else if (arrangement[dayIndex] && arrangement[dayIndex].length > 0) {
                hasClasses = arrangement[dayIndex].some(item => {
                    const code = typeof item === 'object' ? item?.code : item;
                    return code && code !== 'Free';
                });
            }

            // If this day has classes but no log entry, it's missing
            if (hasClasses && !logs[dateStr]) {
                missingDates.push(dateStr);
            }
        }

        currentDate.setDate(currentDate.getDate() + 1);
    }

    if (!lastLogDate) {
        // No logs at all
        return {
            hasGap: true,
            lastLogDate: formatLocalDate(semStart),
            daysBehind: missingDates.length,
            allComplete: false,
            missingDates: missingDates.slice(0, 10) // First 10 for reference
        };
    }

    const lastLog = parseLocalDate(lastLogDate);
    const todayStr = formatLocalDate(today);

    // All complete only if there are NO missing dates with classes
    if (missingDates.length === 0) {
        return { hasGap: false, allComplete: true };
    }

    // There are missing dates
    return {
        hasGap: true,
        lastLogDate,
        daysBehind: missingDates.length,
        allComplete: false,
        missingDates: missingDates.slice(0, 10) // First 10 for reference
    };
}

function openStandardCalculation() {
    // Hide portal dashboard
    const portalDashboard = document.getElementById('portalDashboardSection');
    if (portalDashboard) {
        portalDashboard.style.display = 'none';
    }

    // Show the upload section with calculation options
    const uploadSection = document.getElementById('uploadSection');
    if (uploadSection) {
        uploadSection.style.display = 'block';
    }

    // Reset date inputs to current date (today)
    const currentDateInput = document.getElementById('currentDate');
    if (currentDateInput) {
        currentDateInput.value = formatLocalDate(new Date());
    }

    // Hide any existing results or input sections
    const manualInput = document.getElementById('manualInput');
    if (manualInput) manualInput.style.display = 'none';

    const jsonInput = document.getElementById('jsonInput');
    if (jsonInput) jsonInput.style.display = 'none';

    const resultsSection = document.getElementById('resultsSection');
    if (resultsSection) resultsSection.style.display = 'none';

    // Hide leave planner and other sections
    const leavePlannerSection = document.getElementById('leavePlannerSection');
    if (leavePlannerSection) leavePlannerSection.style.display = 'none';

    const maxLeaveSection = document.getElementById('maxLeaveRecommendation');
    if (maxLeaveSection) maxLeaveSection.style.display = 'none';

    const medicalLeaveSection = document.getElementById('medicalLeaveSection');
    if (medicalLeaveSection) medicalLeaveSection.style.display = 'none';

    const leaveRecommendationContainer = document.getElementById('leaveRecommendationContainer');
    if (leaveRecommendationContainer) leaveRecommendationContainer.style.display = 'none';

    // Add standard mode toggle (Back button)
    addStandardModeToggle();

    // Re-initialize preview dates for Standard mode (unlocks start date)
    if (typeof initializePreviewDates === 'function') initializePreviewDates();

    // Scroll to upload section
    setTimeout(() => {
        if (uploadSection) {
            uploadSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 100);

    // Store that we came from portal mode
    sessionStorage.setItem('calculatingFromPortal', 'true');
}

function promptPortalUpdate() {
    // Check if we came from portal mode AND are still in the update section
    // We check if portalDashboardSection is HIDDEN to confirm we are in update mode
    const portalDashboard = document.getElementById('portalDashboardSection');
    const isUpdateSection = portalDashboard && portalDashboard.style.display === 'none';

    if (sessionStorage.getItem('calculatingFromPortal') !== 'true' || !isUpdateSection) {
        return; // Not from portal or not in update section (we are on main dashboard), no update needed
    }

    // Clear the flag
    sessionStorage.removeItem('calculatingFromPortal');

    // Show confirmation dialog with data summary
    if (!currentAnalysisData || currentAnalysisData.length === 0) {
        alert('No attendance data available to update portal.');
        return;
    }

    // Validate all subjects are present
    const expectedSubjects = selectedClass.subjects.map(s => s.code);
    const inputSubjects = currentAnalysisData.map(s => s.code);
    const missingSubjects = expectedSubjects.filter(code => !inputSubjects.includes(code));

    if (missingSubjects.length > 0) {
        // Find subject names for missing codes
        const missingNames = missingSubjects.map(code => {
            const subject = selectedClass.subjects.find(s => s.code === code);
            return subject ? subject.name : code;
        });

        alert(
            `❌ Incomplete Attendance Data\n\n` +
            `All subjects must be included to update portal.\n\n` +
            `Missing Subjects (${missingSubjects.length}):\n` +
            missingNames.map(name => `• ${name}`).join('\n') +
            `\n\nPlease input attendance for all ${expectedSubjects.length} subjects.`
        );
        return; // Don't proceed with update
    }

    // Build summary of input data
    let summary = '📊 Update Portal with This Data?\n\n';
    summary += `Date: ${new Date().toLocaleDateString()}\n\n`;
    summary += 'Attendance Summary:\n';
    currentAnalysisData.forEach(subject => {
        const percentage = subject.totalHeld > 0
            ? ((subject.attended / subject.totalHeld) * 100).toFixed(1)
            : 100;
        summary += `• ${subject.name}: ${subject.attended}/${subject.totalHeld} (${percentage}%)\n`;
    });
    summary += '\n✓ Update portal baseline to today\n';
    summary += '✓ Create log entry for today\n';
    summary += '\nConfirm to update portal?';

    const confirmed = confirm(summary);

    if (confirmed) {
        updatePortalWithCurrentData();
    } else {
        // User cancelled - show options
        const retry = confirm(
            '❌ Update Cancelled\n\n' +
            'What would you like to do?\n\n' +
            'OK: Stay here to re-input data\n' +
            'Cancel: Return to Portal without updating'
        );

        if (!retry) {
            // Return to portal without updating
            switchBackToPortal();
        }
        // If retry (OK), stay on current page for re-input
    }
}

function updatePortalWithCurrentData() {
    if (!selectedClass || !currentAnalysisData || currentAnalysisData.length === 0) {
        alert('No attendance data available to update portal.');
        return;
    }

    // Create baseline data from current input
    const updatedBaseline = {};
    currentAnalysisData.forEach(subject => {
        updatedBaseline[subject.code] = {
            attended: subject.attended,
            total: subject.totalHeld
        };
    });

    // Update portal setup - UPDATE BASELINE DATA AND DATE (Rolling Baseline)
    if (!selectedClass.portalSetup) {
        selectedClass.portalSetup = { active: true };
    }

    // UPDATE: User requested "reset logic" - so we update the baseline date to NOW.
    // This makes the current state the new anchor point.
    const newBaselineDate = new Date().toISOString().split('T')[0];

    // Update both data and date
    selectedClass.portalSetup.baselineDate = newBaselineDate;
    selectedClass.portalSetup.baselineData = updatedBaseline;

    // Save class data
    const classes = JSON.parse(localStorage.getItem('attendanceClasses_v2')) || {};
    classes[selectedClass.name] = selectedClass;
    localStorage.setItem('attendanceClasses_v2', JSON.stringify(classes));

    // FIX: Sync to cloud
    if (window.SyncManager) SyncManager.uploadAll();

    alert(
        `✅ Portal Baseline Updated!\n\n` +
        `Baseline Date: ${newBaselineDate}\n` +
        `Baseline Data Updated: ${Object.keys(updatedBaseline).length} subjects\n\n` +
        `Note: The portal will use the maximum of baseline data and your logged attendance (from baseline date to semester start) as per portal logic.`
    );

    // Switch back to portal mode
    const uploadSection = document.getElementById('uploadSection');
    if (uploadSection) uploadSection.style.display = 'none';

    const manualInput = document.getElementById('manualInput');
    if (manualInput) manualInput.style.display = 'none';

    const jsonInput = document.getElementById('jsonInput');
    if (jsonInput) jsonInput.style.display = 'none';

    const portalDashboard = document.getElementById('portalDashboardSection');
    if (portalDashboard) portalDashboard.style.display = 'block';

    removeStandardModeToggle();
    renderPortalDashboard();
    calculateFromPortal(); // Recalculate - will use max(baseline, logs) logic
}

function updatePortalFromCalculation() {
    if (!selectedClass || !currentAnalysisData || currentAnalysisData.length === 0) {
        alert('No calculation data available to update portal.');
        return;
    }

    // Get the calculation date (today by default, or from user input if available)
    const calculationDate = new Date().toISOString().split('T')[0];

    // Create baseline data from current calculation
    const newBaseline = {};
    currentAnalysisData.forEach(subject => {
        newBaseline[subject.code] = {
            attended: subject.attended,
            total: subject.totalHeld
        };
    });

    // Update portal setup
    if (!selectedClass.portalSetup) {
        selectedClass.portalSetup = { active: true };
    }

    selectedClass.portalSetup.baselineDate = calculationDate;
    selectedClass.portalSetup.baselineData = newBaseline;

    // Save to localStorage
    const classes = JSON.parse(localStorage.getItem('attendanceClasses_v2')) || {};
    classes[selectedClass.name] = selectedClass;
    localStorage.setItem('attendanceClasses_v2', JSON.stringify(classes));

    // FIX: Sync to cloud
    if (window.SyncManager) SyncManager.uploadAll();

    alert(
        `✅ Portal Updated Successfully!\n\n` +
        `Baseline Date: ${calculationDate}\n` +
        `Subjects Updated: ${Object.keys(newBaseline).length}\n\n` +
        `You can now continue tracking attendance in Portal Mode from this baseline.`
    );

    // Switch back to portal mode
    const uploadSection = document.getElementById('uploadSection');
    if (uploadSection) uploadSection.style.display = 'none';

    const portalDashboard = document.getElementById('portalDashboardSection');
    if (portalDashboard) portalDashboard.style.display = 'block';

    renderPortalDashboard();
    calculateFromPortal(); // Recalculate with new baseline
}

function renderPortalDashboard() {
    const container = document.getElementById('portalDashboardSection');
    const today = formatLocalDate(new Date());

    // Check for incomplete logs
    const incompleteLogs = checkIncompleteLogs();

    let notificationHTML = '';
    if (incompleteLogs.hasGap) {
        const daysCount = incompleteLogs.daysBehind;
        const lastLogFormatted = new Date(incompleteLogs.lastLogDate).toLocaleDateString();

        notificationHTML = `
                    <div style="background: rgba(255, 193, 7, 0.15); border-left: 4px solid var(--warning-color); padding: 15px; margin-bottom: 15px; border-radius: 8px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                            <div>
                                <p style="margin: 0; font-weight: bold; color: var(--warning-color);">⚠️ Incomplete Logs Detected</p>
                                <p style="margin: 5px 0 0 0; font-size: 0.9rem;">Last log: <strong>${lastLogFormatted}</strong> - ${daysCount} day(s) behind</p>
                            </div>
                            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                <button class="btn secondary-btn" onclick="openHistoryEditor()" style="font-size: 0.85rem; padding: 6px 12px;">📅 Complete Logs</button>
                                <button class="btn primary-btn" onclick="openStandardCalculation()" style="font-size: 0.85rem; padding: 6px 12px;">📊 Update Attendance</button>
                            </div>
                        </div>
                    </div>
                `;
    } else if (incompleteLogs.allComplete) {
        notificationHTML = `
                    <div style="background: rgba(46, 204, 113, 0.15); border-left: 4px solid var(--success-grad-start); padding: 12px; margin-bottom: 15px; border-radius: 8px;">
                        <p style="margin: 0; color: var(--success-grad-start); font-weight: bold;">✅ All logs up to date!</p>
                    </div>
                `;
    }

    container.innerHTML = `
                <div style="background: var(--card-bg); padding: 15px; margin-bottom: 15px; border-radius: 8px; border: 1px solid var(--border-color);">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                        <div>
                            <h4 style="margin: 0 0 5px 0;">Calculation Mode</h4>
                            <p style="margin: 0; font-size: 0.85rem; color: var(--medium-text);">Switch between Portal tracking and Standard calculation</p>
                        </div>
                        <div style="display: flex; gap: 10px;">
                            <button class="btn primary-btn" onclick="initPortal()" style="font-size: 0.9rem; opacity: 1; pointer-events: none;">
                                🎓 Portal Mode
                            </button>
                            <button class="btn secondary-btn" onclick="switchToStandardMode()" style="font-size: 0.9rem;">
                                🧮 Standard Calculation
                            </button>
                        </div>
                    </div>
                </div>
                ${notificationHTML}
                <div class="settings-section" style="border-left: 5px solid var(--primary-grad-start);">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:15px;">
                        <div>
                            <h3>🎓 Student Portal Active</h3>
                            <p>Tracking since: <strong>${selectedClass.portalSetup.baselineDate}</strong></p>
                        </div>
                        <div style="display:flex; gap:10px; flex-wrap: wrap;">
                            <button class="btn primary-btn" onclick="openDailyLog()">📅 Mark Today's Attendance</button>
                            <button class="btn secondary-btn" onclick="openHistoryEditor()">📜 Edit History</button>
                        </div>
                    </div>
                </div>
            `;
}

function switchToStandardMode() {
    // Hide portal dashboard
    const portalDashboard = document.getElementById('portalDashboardSection');
    if (portalDashboard) {
        portalDashboard.style.display = 'none';
    }

    // Show upload section for standard calculation
    const uploadSection = document.getElementById('uploadSection');
    if (uploadSection) {
        uploadSection.style.display = 'block';
    }

    // Reset date inputs to current date (not last logged date)
    const currentDateInput = document.getElementById('currentDate');
    if (currentDateInput) {
        currentDateInput.value = formatLocalDate(new Date());
    }

    // Hide existing results - only show after calculation
    const resultsSection = document.getElementById('resultsSection');
    if (resultsSection) {
        resultsSection.style.display = 'none';
    }

    // Hide leave planner and other sections
    const leavePlannerSection = document.getElementById('leavePlannerSection');
    if (leavePlannerSection) leavePlannerSection.style.display = 'none';

    const maxLeaveSection = document.getElementById('maxLeaveRecommendation');
    if (maxLeaveSection) maxLeaveSection.style.display = 'none';

    const leaveRecommendationContainer = document.getElementById('leaveRecommendationContainer');
    if (leaveRecommendationContainer) leaveRecommendationContainer.style.display = 'none';

    // Hide medical certificate section
    const medicalLeaveSection = document.getElementById('medicalLeaveSection');
    if (medicalLeaveSection) medicalLeaveSection.style.display = 'none';

    // Add mode toggle to standard mode
    addStandardModeToggle();

    // Mark that we're in standard calc mode (even if portal is active)
    sessionStorage.setItem('calculatingFromPortal', 'true');

    // Re-initialize preview dates for Standard mode (unlocks start date)
    if (typeof initializePreviewDates === 'function') initializePreviewDates();

    // Scroll to upload section
    setTimeout(() => {
        if (uploadSection) {
            uploadSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 100);
}

function addStandardModeToggle() {
    // Check if toggle already exists
    if (document.getElementById('standardModeToggle')) {
        return;
    }

    // Create mode toggle element with back button
    const toggleHTML = `
                <div id="standardModeToggle" style="background: var(--card-bg); padding: 15px; margin-bottom: 15px; border-radius: 8px; border: 1px solid var(--border-color);">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                        <div>
                            <h4 style="margin: 0 0 5px 0;">Update Attendance</h4>
                            <p style="margin: 0; font-size: 0.85rem; color: var(--medium-text);">Use OCR, Manual Entry, or JSON to update today's attendance</p>
                        </div>
                        <div style="display: flex; gap: 10px;">
                            <button class="btn secondary-btn" onclick="switchBackToPortal()" style="font-size: 0.9rem;">
                                ↩️ Back to Portal
                            </button>
                        </div>
                    </div>
                </div>
            `;

    // Insert before upload section
    const uploadSection = document.getElementById('uploadSection');
    if (uploadSection) {
        uploadSection.insertAdjacentHTML('beforebegin', toggleHTML);
    }
}



function removeStandardModeToggle() {
    const toggle = document.getElementById('standardModeToggle');
    if (toggle) {
        toggle.remove();
    }
}

function switchBackToPortal() {
    // Clear the portal calculation flag so no prompt appears
    sessionStorage.removeItem('calculatingFromPortal');

    // Remove the standard mode toggle
    removeStandardModeToggle();

    // Hide upload section
    const uploadSection = document.getElementById('uploadSection');
    if (uploadSection) {
        uploadSection.style.display = 'none';
    }

    // Hide manual input and JSON input sections if they're visible
    const manualInput = document.getElementById('manualInput');
    if (manualInput) {
        manualInput.style.display = 'none';
    }

    const jsonInput = document.getElementById('jsonInput');
    if (jsonInput) {
        jsonInput.style.display = 'none';
    }

    // Show portal dashboard
    const portalDashboard = document.getElementById('portalDashboardSection');
    if (portalDashboard) {
        portalDashboard.style.display = 'block';
    }

    // Refresh portal dashboard and recalculate based on portal data
    renderPortalDashboard();
    // Show ad when portal is first activated
    if (window.AdManager) AdManager.showForCalculation();
    calculateFromPortal();

    // Scroll to portal dashboard
    setTimeout(() => {
        if (portalDashboard) {
            portalDashboard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, 100);
}

// ==================== TIMELINE PREVIEW FUNCTIONS ====================
let previewModeActive = false;

function toggleTimelinePreview() {
    const content = document.getElementById('timelinePreviewContent');
    const toggle = document.getElementById('timelinePreviewToggle');
    if (content.style.display === 'none') {
        content.style.display = 'block';
        toggle.textContent = '▲';
    } else {
        content.style.display = 'none';
        toggle.textContent = '▼';
    }
}
window.toggleTimelinePreview = toggleTimelinePreview;

function initializePreviewDates() {
    // Show the preview section when Portal Mode or Standard mode is active
    const previewSection = document.getElementById('timelinePreviewSection');
    if (!previewSection) return;

    // Get current dates
    const startDateEl = document.getElementById('previewStartDate');
    const endDateEl = document.getElementById('previewEndDate');


    // Get today's date as default start for preview
    const todayStr = document.getElementById('currentDate')?.value || new Date().toISOString().split('T')[0];

    // Check if user switched to standard calc mode (even if portal is active)
    const isInStandardCalc = sessionStorage.getItem('calculatingFromPortal') === 'true';
    if (selectedClass?.portalSetup?.active && !isInStandardCalc) {
        // Portal Mode - Start = Today (Locked), End = Last Working Day (Editable)
        startDateEl.value = todayStr;
        startDateEl.disabled = true; // User can only change end date
        startDateEl.title = "Start date is fixed to today in Portal Mode";
        endDateEl.value = document.getElementById('lastDate')?.value || selectedClass.portalSetup.lastWorkingDay || '';
        previewSection.style.display = 'block';
    } else {
        // Standard Mode - Start = Today (Editable), End = Last Working Day (Editable)
        startDateEl.value = todayStr;
        startDateEl.disabled = false; // User can change both dates
        startDateEl.title = "Change start date to preview from a different point";
        endDateEl.value = document.getElementById('lastDate')?.value || '';
        // Only show if class exists
        previewSection.style.display = selectedClass ? 'block' : 'none';
    }

    // Reset preview mode indicator
    previewModeActive = false;
    const indicator = document.getElementById('previewModeIndicator');
    if (indicator) indicator.style.display = 'none';
}
window.initializePreviewDates = initializePreviewDates;

function calculateWithPreviewDates() {
    const previewStart = document.getElementById('previewStartDate')?.value;
    const previewEnd = document.getElementById('previewEndDate')?.value;

    if (!previewStart || !previewEnd) {
        showToast('⚠️ Please set both preview dates', 'error');
        return;
    }

    if (new Date(previewStart) > new Date(previewEnd)) {
        showToast('⚠️ Start date must be before end date', 'error');
        return;
    }

    previewModeActive = true;
    const indicator = document.getElementById('previewModeIndicator');
    if (indicator) indicator.style.display = 'block';

    // IMPORTANT: Update DOM inputs with preview dates
    // Because calculateAttendance() reads currentDate and lastDate from DOM
    document.getElementById('currentDate').value = previewStart;
    document.getElementById('lastDate').value = previewEnd;

    if (selectedClass?.portalSetup?.active) {
        // Portal Mode - call with overrides for semesterStart calculation
        calculateFromPortal({ startDate: previewStart, endDate: previewEnd });
    } else {
        // Standard Mode - recalculate with updated inputs
        triggerRecalculation();
    }

    showToast('🔮 Preview calculated with custom dates!', 'success');
}
window.calculateWithPreviewDates = calculateWithPreviewDates;

function resetPreviewDates() {
    window.location.reload();
}
window.resetPreviewDates = resetPreviewDates;
// ==================== END TIMELINE PREVIEW ====================

// ==================== LEGACY LOG MIGRATION ====================
// Migrate logs from old format (MATH: Skipped) to new format (MATH_p1: Skipped, MATH_p2: Skipped)
let logMigrationCompleted = false;

function migrateLegacyLogs() {
    if (logMigrationCompleted) return; // Only run once per session
    if (!selectedClass || !selectedClass.subjects) return;

    const logs = JSON.parse(localStorage.getItem('attendance_logs')) || {};
    const className = document.getElementById('classSelector')?.value;
    const arrangement = getTimetableArrangement(className) || {};
    let migrationsMade = 0;

    Object.keys(logs).forEach(dateStr => {
        const dayLog = logs[dateStr];
        if (!dayLog || typeof dayLog !== 'object') return;

        // Check if this day has any legacy keys (keys without _p suffix)
        const legacyKeys = Object.keys(dayLog).filter(key => !key.includes('_p'));
        if (legacyKeys.length === 0) return; // Already migrated

        // Get day of week for timetable lookup
        const date = parseLocalDate(dateStr);
        const dayOfWeek = date.getDay();
        const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

        // Get custom schedule or timetable
        const customSchedule = getCustomScheduleForDate(dateStr);
        let dayPeriods = [];

        if (customSchedule && customSchedule._periods) {
            dayPeriods = customSchedule._periods;
        } else if (arrangement[dayIndex] && arrangement[dayIndex].length > 0) {
            dayPeriods = arrangement[dayIndex].map(item =>
                typeof item === 'object' ? item?.code : item
            );
        }

        // Count how many times each subject appears in the timetable for this day
        const subjectPeriodCount = {};
        dayPeriods.forEach(code => {
            if (code && code !== 'FREE' && code !== null) {
                subjectPeriodCount[code] = (subjectPeriodCount[code] || 0) + 1;
            }
        });

        // Migrate each legacy key
        legacyKeys.forEach(legacyCode => {
            let status = dayLog[legacyCode];

            // Normalize old raw status codes to proper values
            if (status) {
                try {
                    const s = String(status).toUpperCase().trim();
                    if (s === 'P' || s === 'PRESENT' || s === 'ATTENDED') status = 'Attended';
                    else if (s === 'A' || s === 'ABSENT' || s === 'SKIPPED') status = 'Skipped';
                    else if (s === 'C' || s === 'CANCELLED') status = 'Cancelled';
                    else if (s === 'ML' || s === 'MEDICAL LEAVE (ML)') status = 'Medical Leave (ML)';
                    else if (s === 'OD' || s === 'DUTY LEAVE (OD)') status = 'Duty Leave (OD)';
                } catch (e) {
                    console.warn('Error normalizing legacy status:', status, e);
                }
            }

            const periodCount = subjectPeriodCount[legacyCode] || 1;

            // Create period-based entries
            for (let i = 1; i <= periodCount; i++) {
                const periodKey = `${legacyCode}_p${i}`;
                if (!dayLog[periodKey]) { // Don't overwrite existing period keys
                    dayLog[periodKey] = status;
                }
            }

            // Remove legacy key
            delete dayLog[legacyCode];
            migrationsMade++;
        });
    });

    if (migrationsMade > 0) {
        localStorage.setItem('attendance_logs', JSON.stringify(logs));
        console.log(`✅ Migrated ${migrationsMade} legacy log entries to period-based format`);

        // Sync with cloud
        if (window.SyncManager) {
            Object.keys(logs).forEach(dateStr => {
                SyncManager.saveLog(dateStr, logs[dateStr] || {});
            });
        }
    }

    logMigrationCompleted = true;
}
// ==================== END LEGACY LOG MIGRATION ====================

function calculateFromPortal(previewOverrides = null) {
    if (!selectedClass || !selectedClass.portalSetup) return;

    // Run migration for legacy logs on first calculation
    migrateLegacyLogs();

    const baseline = selectedClass.portalSetup.baselineData;
    const baselineDate = parseLocalDate(selectedClass.portalSetup.baselineDate);
    const logs = JSON.parse(localStorage.getItem('attendance_logs')) || {};

    // Check for incomplete logs to determine effective "current date"
    const logStatus = checkIncompleteLogs();
    let effectiveCurrentDate;

    if (logStatus.hasGap && logStatus.lastLogDate) {
        // Use last log date as "current date" for incomplete logs
        effectiveCurrentDate = logStatus.lastLogDate;
    } else {
        // Use today if logs are complete
        effectiveCurrentDate = formatLocalDate(new Date());
    }

    // Update the date inputs to reflect the effective current date (only if not in preview mode)
    if (!previewOverrides) {
        document.getElementById('currentDate').value = effectiveCurrentDate;
    }

    // Keep lastDate from portal setup or use default (only if not in preview mode)
    if (!previewOverrides && selectedClass.portalSetup.lastWorkingDay) {
        document.getElementById('lastDate').value = selectedClass.portalSetup.lastWorkingDay;
    }

    // 1. Calculate sums of logs BEFORE or ON baseline date
    const pastLogStats = {};

    Object.keys(logs).forEach(dateStr => {
        const logDate = parseLocalDate(dateStr);
        // Check if log is before or on baseline date
        if (logDate <= baselineDate) {
            const dayLog = logs[dateStr];
            Object.keys(dayLog).forEach(key => {
                // Check if this is legacy format (no _p suffix) or new format
                const isLegacyFormat = !key.includes('_p');
                const code = key.split('_p')[0];

                if (!pastLogStats[code]) pastLogStats[code] = { attended: 0, total: 0 };

                const status = dayLog[key];
                const s = String(status || '').toUpperCase().trim();
                const isPresent = status === 'Attended' || status === 'Present' || status === 'Duty Leave (OD)' || status === 'Medical Leave (ML)' || s === 'P' || s === 'PRESENT' || s === 'ATTENDED' || s === 'ML' || s === 'OD' || s === 'DUTY LEAVE (OD)' || s === 'MEDICAL LEAVE (ML)';
                const isAbsent = status === 'Skipped' || status === 'Absent' || s === 'A' || s === 'ABSENT' || s === 'SKIPPED';

                // For legacy format, count all classes for that subject on that day
                // For new period-based format, count just 1 per entry
                const classCount = isLegacyFormat ? getSubjectClassCountForDate(dateStr, code) : 1;

                if (isPresent) {
                    pastLogStats[code].attended += classCount;
                    pastLogStats[code].total += classCount;
                } else if (isAbsent) {
                    pastLogStats[code].total += classCount;
                }
                // Cancelled adds nothing
            });
        }
    });

    // 2. Determine Effective Baseline
    // "add logic that when people edit history and mark their attendance before the baseline date... 
    // it should not add that attended and held data... until sum attend and held classes of before base line date is more than the attend and held date on the date of baseline date"

    const effectiveStats = {};
    selectedClass.subjects.forEach(subject => {
        const code = subject.code;
        const base = baseline[code] || { attended: 0, total: 0 };
        const past = pastLogStats[code] || { attended: 0, total: 0 };

        // Logic: If user has logged enough classes to match the baseline total, 
        // OR if logs are COMPLETE (no gaps from sem start to today),
        // trust the LOGS (Fact) over the BASELINE (Estimate).
        // This fixes the case where user backfills logs (e.g. 45/100) but baseline was higher (50/100).
        if (logStatus.allComplete || (past.total >= base.total && base.total > 0)) {
            effectiveStats[code] = {
                attended: past.attended,
                total: past.total
            };
        } else {
            // Otherwise, assume logs are incomplete and trust baseline (or simple max if no baseline)
            effectiveStats[code] = {
                attended: Math.max(base.attended, past.attended),
                total: Math.max(base.total, past.total)
            };
        }
    });

    // 3. Add logs AFTER baseline date (but only up to effective current date)
    const effectiveDateObj = parseLocalDate(effectiveCurrentDate);

    Object.keys(logs).forEach(dateStr => {
        const logDate = parseLocalDate(dateStr);
        if (logDate > baselineDate && logDate <= effectiveDateObj) {
            const dayLog = logs[dateStr];
            Object.keys(dayLog).forEach(key => {
                // Check if this is legacy format (no _p suffix) or new format
                const isLegacyFormat = !key.includes('_p');
                const code = key.split('_p')[0];

                if (effectiveStats[code]) {
                    const status = dayLog[key];
                    const s = String(status || '').toUpperCase().trim();
                    const isPresent = status === 'Attended' || status === 'Present' || status === 'Duty Leave (OD)' || status === 'Medical Leave (ML)' || s === 'P' || s === 'PRESENT' || s === 'ATTENDED' || s === 'ML' || s === 'OD' || s === 'DUTY LEAVE (OD)' || s === 'MEDICAL LEAVE (ML)';
                    const isAbsent = status === 'Skipped' || status === 'Absent' || s === 'A' || s === 'ABSENT' || s === 'SKIPPED';

                    // For legacy format, count all classes for that subject on that day
                    // For new period-based format, count just 1 per entry
                    const classCount = isLegacyFormat ? getSubjectClassCountForDate(dateStr, code) : 1;

                    if (isPresent) {
                        effectiveStats[code].attended += classCount;
                        effectiveStats[code].total += classCount;
                    } else if (isAbsent) {
                        effectiveStats[code].total += classCount;
                    }
                }
            });
        }
    });

    // 4. Calculate theoretical max classes per subject from semester start to effective current date
    // Use preview overrides if provided (what-if calculations)
    const semesterStart = parseLocalDate(previewOverrides?.startDate || selectedClass.portalSetup.semesterStartDate);
    const effectiveEnd = parseLocalDate(previewOverrides?.endDate || effectiveCurrentDate);
    const holidays = selectedClass.holidays || [];
    const className = document.getElementById('classSelector')?.value;
    const arrangement = getTimetableArrangement(className) || {};

    // Count max possible classes per subject
    const maxPossibleClasses = {};
    selectedClass.subjects.forEach(s => { maxPossibleClasses[s.code] = 0; });

    let currentDate = new Date(semesterStart);
    while (currentDate <= effectiveEnd) {
        const dateStr = formatLocalDate(currentDate);

        // Skip holidays
        if (!holidays.includes(dateStr)) {
            const dayOfWeek = currentDate.getDay();
            const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

            // Use centralized helper to count classes for each subject
            selectedClass.subjects.forEach(subject => {
                const count = getSubjectClassCountForDate(dateStr, subject.code);
                if (maxPossibleClasses[subject.code] !== undefined) {
                    maxPossibleClasses[subject.code] += count;
                }
            });
        }

        currentDate.setDate(currentDate.getDate() + 1);
    }

    // 5. Cap effectiveStats at max possible classes
    selectedClass.subjects.forEach(subject => {
        const code = subject.code;
        const maxClasses = maxPossibleClasses[code] || 0;

        if (effectiveStats[code]) {
            if (effectiveStats[code].total > maxClasses) {
                console.warn(`${code}: Total classes (${effectiveStats[code].total}) capped at max possible (${maxClasses})`);
                effectiveStats[code].total = maxClasses;
            }
            if (effectiveStats[code].attended > effectiveStats[code].total) {
                console.warn(`${code}: Attended (${effectiveStats[code].attended}) capped at total (${effectiveStats[code].total})`);
                effectiveStats[code].attended = effectiveStats[code].total;
            }
        }
    });

    // Prepare data for existing calculation engine
    const attendanceData = [];
    selectedClass.subjects.forEach(subject => {
        const stats = effectiveStats[subject.code] || { attended: 0, total: 0 };
        attendanceData.push({
            ...subject,
            attended: stats.attended,
            totalHeld: stats.total
        });
    });

    calculateAttendance(attendanceData);
}

// --- MEDICAL LEAVE & HISTORY ENHANCEMENTS ---

function isHolidayOrNoClass(dateStr) {
    // Check holidays first
    if ((selectedClass.holidays || []).includes(dateStr)) return { isHoliday: true, reason: 'Holiday' };

    // Get day of week
    const date = new Date(dateStr);
    const dayOfWeek = date.getDay();
    const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 0=Mon, 6=Sun

    // Check for custom schedule - if exists, date has classes
    const customSchedule = getCustomScheduleForDate(dateStr);
    if (customSchedule) {
        // Custom schedule exists - check if it has any classes
        if (customSchedule._periods) {
            const hasPeriodsSet = customSchedule._periods.some(code => code && code !== '');
            if (hasPeriodsSet) return { isHoliday: false };
        } else {
            // Old count-based format
            const totalClasses = Object.keys(customSchedule).filter(k => k !== '_periods').reduce((sum, key) => sum + (customSchedule[key] || 0), 0);
            if (totalClasses > 0) return { isHoliday: false };
        }
    }

    // Check timetable arrangement for the day
    const className = document.getElementById('classSelector')?.value;
    const arrangement = getTimetableArrangement(className) || {};
    const dayArrangement = arrangement[dayIndex] || [];

    if (dayArrangement.length > 0) {
        // Check if any period has a subject assigned
        const hasClassesInArrangement = dayArrangement.some(item => {
            const code = typeof item === 'object' ? item?.code : item;
            return code && code !== '' && code !== null;
        });
        if (hasClassesInArrangement) return { isHoliday: false };
    }

    // Fallback: Check count-based schedule (smart)
    const hasClasses = selectedClass.subjects.some(s => getSubjectClassCountForDate(dateStr, s.code) > 0);
    if (!hasClasses) return { isHoliday: true, reason: 'No Classes Scheduled (e.g., Sunday)' };

    return { isHoliday: false };
}

function populateDailyLog() {
    const subjectList = document.getElementById('dailyLogSubjects');
    subjectList.innerHTML = '';
    const saveBtn = document.querySelector('#dailyLogModal .primary-btn');

    const dateStr = document.getElementById('logDate').value;
    const check = isHolidayOrNoClass(dateStr);

    if (check.isHoliday) {
        subjectList.innerHTML = `
                    <div style="text-align: center; padding: 30px; color: var(--medium-text);">
                        <div style="font-size: 3rem; margin-bottom: 10px;">🏖️</div>
                        <h3>No Classes Today</h3>
                        <p>You cannot mark attendance for <strong>${dateStr}</strong> because it is a <strong>${check.reason}</strong>.</p>
                    </div>`;
        if (saveBtn) saveBtn.style.display = 'none';
        return;
    }

    if (saveBtn) saveBtn.style.display = 'block';

    // Add Bulk Actions
    const bulkDiv = document.createElement('div');
    bulkDiv.className = 'bulk-actions';
    bulkDiv.style.marginBottom = '15px';
    bulkDiv.style.display = 'flex';
    bulkDiv.style.gap = '5px';
    bulkDiv.style.flexWrap = 'wrap';
    bulkDiv.innerHTML = `
                <span style="width:100%; font-size:0.8rem; color:var(--medium-text); margin-bottom:5px;">Bulk Actions:</span>
                <button class="btn secondary-btn" onclick="applyBulkAction('Attended')" style="padding: 5px 10px; font-size: 0.8rem;">All Present</button>
                <button class="btn secondary-btn" onclick="applyBulkAction('Skipped')" style="padding: 5px 10px; font-size: 0.8rem;">All Absent</button>
                <button class="btn secondary-btn" onclick="applyBulkAction('Medical Leave (ML)')" style="padding: 5px 10px; font-size: 0.8rem;">All ML</button>
                <button class="btn secondary-btn" onclick="applyBulkAction('Duty Leave (OD)')" style="padding: 5px 10px; font-size: 0.8rem;">All OD</button>
                <button class="btn info-btn" onclick="openCustomScheduleModal('${dateStr}')" style="padding: 5px 10px; font-size: 0.8rem; margin-left: auto;" title="Set a different schedule for this date if timetable was different in the past">📅 Custom Schedule</button>
            `;
    subjectList.appendChild(bulkDiv);

    const logs = JSON.parse(localStorage.getItem('attendance_logs')) || {};
    const dayLog = logs[dateStr] || {};

    // Check for custom schedule for this date
    const customSchedule = getCustomScheduleForDate(dateStr);

    // Get day of week for timetable lookup
    const date = new Date(dateStr);
    const dayOfWeek = date.getDay();
    const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 0=Mon, 6=Sun

    // Get timetable arrangement for period ordering
    const className = document.getElementById('classSelector')?.value;
    const arrangement = getTimetableArrangement(className) || {};
    const dayArrangement = arrangement[dayIndex] || [];

    // Build ordered list of subjects based on timetable periods
    const orderedSubjects = [];

    if (customSchedule && customSchedule._periods) {
        // New period-based custom schedule format
        const periodCounts = {};
        customSchedule._periods.forEach((code, periodIdx) => {
            if (!code) return; // Skip FREE periods

            const subject = selectedClass.subjects.find(s => s.code === code);
            if (!subject) return;

            periodCounts[code] = (periodCounts[code] || 0) + 1;
            const totalForSubject = customSchedule._periods.filter(c => c === code).length;

            orderedSubjects.push({
                subject,
                periodNum: periodCounts[code],
                totalPeriods: totalForSubject,
                timetablePeriod: periodIdx + 1
            });
        });
    } else if (customSchedule && typeof customSchedule === 'object' && !Array.isArray(customSchedule)) {
        // Old count-based custom schedule (backward compatibility)
        const subjectOrder = {};
        dayArrangement.forEach((item, idx) => {
            const code = typeof item === 'object' ? item?.code : item;
            if (code && !subjectOrder[code]) subjectOrder[code] = idx;
        });

        selectedClass.subjects
            .filter(s => customSchedule[s.code] > 0)
            .sort((a, b) => (subjectOrder[a.code] ?? 999) - (subjectOrder[b.code] ?? 999))
            .forEach(subject => {
                const periodCount = customSchedule[subject.code];
                for (let i = 1; i <= periodCount; i++) {
                    orderedSubjects.push({ subject, periodNum: i, totalPeriods: periodCount });
                }
            });
    } else if (dayArrangement.length > 0) {
        // Use timetable arrangement order (period by period)
        const periodCounts = {}; // Track how many periods each subject has been added

        dayArrangement.forEach((item, periodIdx) => {
            const code = typeof item === 'object' ? item?.code : item;
            if (!code) return; // Skip free periods

            const subject = selectedClass.subjects.find(s => s.code === code);
            if (!subject) return;

            periodCounts[code] = (periodCounts[code] || 0) + 1;
            const totalForSubject = dayArrangement.filter(i => {
                const c = typeof i === 'object' ? i?.code : i;
                return c === code;
            }).length;

            orderedSubjects.push({
                subject,
                periodNum: periodCounts[code],
                totalPeriods: totalForSubject,
                timetablePeriod: periodIdx + 1 // Actual period number in timetable
            });
        });
    } else {
        // Fallback: use default schedule counts in storage order
        selectedClass.subjects.forEach(subject => {
            const periodCount = parseScheduleValue(subject.schedule[dayIndex]);
            for (let i = 1; i <= periodCount; i++) {
                orderedSubjects.push({ subject, periodNum: i, totalPeriods: periodCount });
            }
        });
    }

    if (orderedSubjects.length === 0) {
        // FAILSAFE: If it's a working day but no subjects found (e.g., corrupt custom schedule), 
        // fall back to default schedule to prevent blank screen
        console.warn('⚠️ No subjects found for working day. Using default fallback.');
        selectedClass.subjects.forEach(subject => {
            const periodCount = parseScheduleValue(subject.schedule[dayIndex]);
            for (let i = 1; i <= periodCount; i++) {
                orderedSubjects.push({ subject, periodNum: i, totalPeriods: periodCount });
            }
        });
    }

    // Render subjects in order
    orderedSubjects.forEach(({ subject, periodNum, totalPeriods, timetablePeriod }) => {
        const periodKey = `${subject.code}_p${periodNum}`;
        let currentStatus = dayLog[periodKey];

        if (!currentStatus) {
            // Fallback to legacy key 'SUBJECT' if 'SUBJECT_p1' is missing
            // MODIFIED: Apply to ALL periods, not just the first one, for Auto-Fill sync
            currentStatus = dayLog[subject.code];
        }

        currentStatus = currentStatus || 'Default';

        const div = document.createElement('div');
        div.className = 'subject-log-entry';

        // Show period number if multiple or if we have timetable info
        let labelSuffix = '';
        if (timetablePeriod) {
            labelSuffix = ` (Period ${timetablePeriod})`;
        } else if (totalPeriods > 1) {
            labelSuffix = ` (Period ${periodNum})`;
        }

        div.innerHTML = `
                    <label>${subject.name}${labelSuffix}</label>
                    <select data-code="${periodKey}" data-previous-value="${currentStatus}" onchange="handleStatusChange(this)">
                        <option value="Default" ${currentStatus === 'Default' ? 'selected' : ''}>Default (Held)</option>
                        <option value="Attended" ${currentStatus === 'Attended' ? 'selected' : ''}>Attended</option>
                        <option value="Skipped" ${currentStatus === 'Skipped' ? 'selected' : ''}>Skipped</option>
                        <option value="Cancelled" ${currentStatus === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                        <option value="Duty Leave (OD)" ${currentStatus === 'Duty Leave (OD)' ? 'selected' : ''}>Duty Leave (OD)</option>
                        <option value="Medical Leave (ML)" ${currentStatus === 'Medical Leave (ML)' ? 'selected' : ''}>Medical Leave (ML)</option>
                    </select>
                `;
        subjectList.appendChild(div);
    });
}

// Custom Schedule Functions - for logging past dates with different timetables
function getCustomScheduleForDate(dateStr) {
    const className = document.getElementById('classSelector')?.value;
    if (!className) return null;
    const customSchedules = JSON.parse(localStorage.getItem(`custom_schedules_${className}`) || '{}');
    return customSchedules[dateStr] || null;
}

function openCustomScheduleModal(dateStr) {
    const modal = document.getElementById('customScheduleModal');
    const customSchedule = getCustomScheduleForDate(dateStr);
    const maxPeriods = getMaxPeriods();

    // Get day of week for default timetable
    const date = new Date(dateStr);
    const dayOfWeek = date.getDay();
    const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    // Get default timetable for this day
    const className = document.getElementById('classSelector')?.value;
    const arrangement = getTimetableArrangement(className) || {};
    const dayArrangement = arrangement[dayIndex] || [];

    // Build subject options HTML
    let subjectOptions = '<option value="">-- FREE --</option>';
    if (selectedClass?.subjects) {
        selectedClass.subjects.forEach(subject => {
            subjectOptions += `<option value="${subject.code}">${subject.name} (${subject.code})</option>`;
        });
    }

    // Build period rows
    let periodHTML = '';
    for (let i = 0; i < maxPeriods; i++) {
        // Get current value: from custom schedule or default timetable
        let currentSubject = '';

        if (customSchedule && customSchedule._periods) {
            // New period-based format
            currentSubject = customSchedule._periods[i] || '';
        } else if (dayArrangement[i]) {
            // Default from timetable
            const item = dayArrangement[i];
            currentSubject = typeof item === 'object' ? item?.code : item;
        }

        // Generate options with current selection
        let optionsWithSelection = '<option value="">-- FREE --</option>';
        if (selectedClass?.subjects) {
            selectedClass.subjects.forEach(subject => {
                const selected = subject.code === currentSubject ? 'selected' : '';
                optionsWithSelection += `<option value="${subject.code}" ${selected}>${subject.name} (${subject.code})</option>`;
            });
        }

        periodHTML += `
                        <div style="display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 8px; background: var(--light-bg);">
                            <span style="font-weight: 600; min-width: 70px; color: var(--primary-color);">Period ${i + 1}</span>
                            <select id="customPeriod_${i}" style="flex: 1; padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); font-size: 0.95rem;">
                                ${optionsWithSelection}
                            </select>
                        </div>`;
    }

    modal.innerHTML = `
                    <div class="modal-content" style="max-width: 500px;">
                        <button class="modal-close" onclick="closeModal('customScheduleModal')">&times;</button>
                        <div class="modal-header">
                            <h2>📅 Custom Schedule</h2>
                            <p>Set which subject was in each period on <strong>${dateStr}</strong></p>
                        </div>
                        <div class="modal-body" style="max-height: 400px; overflow-y: auto;">
                            <p style="font-size: 0.85rem; color: var(--medium-text); margin-bottom: 15px;">
                                <strong>💡 Tip:</strong> Use this if the timetable was different on this day. Select the subject for each period slot.
                            </p>
                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                ${periodHTML}
                            </div>
                        </div>
                        <div style="display: flex; gap: 10px; margin-top: 20px;">
                            <button class="btn secondary-btn" onclick="clearCustomSchedule('${dateStr}')" style="flex: 1;">
                                🗑️ Use Default
                            </button>
                            <button class="btn primary-btn" onclick="saveCustomSchedulePeriodBased('${dateStr}')" style="flex: 1;">
                                💾 Save Schedule
                            </button>
                        </div>
                    </div>`;

    modal.classList.add('active');
}

function updateCustomScheduleTotal() {
    let total = 0;
    const maxPeriods = getMaxPeriods();

    if (selectedClass?.subjects) {
        selectedClass.subjects.forEach(subject => {
            const input = document.getElementById(`customSched_${subject.code}`);
            if (input) {
                total += parseInt(input.value) || 0;
            }
        });
    }

    const totalEl = document.getElementById('customScheduleTotal');
    const warningEl = document.getElementById('customScheduleWarning');

    if (totalEl) {
        totalEl.textContent = `${total} / ${maxPeriods}`;
        totalEl.style.color = total > maxPeriods ? 'var(--danger-color)' : 'var(--success-grad-start)';
    }

    if (warningEl) {
        warningEl.style.display = total > maxPeriods ? 'block' : 'none';
    }
}

function saveCustomSchedule(dateStr) {
    const className = document.getElementById('classSelector')?.value;
    if (!className) return;

    const maxPeriods = getMaxPeriods();
    let total = 0;
    const scheduleData = {};

    // Get period counts for each subject
    if (selectedClass?.subjects) {
        selectedClass.subjects.forEach(subject => {
            const input = document.getElementById(`customSched_${subject.code}`);
            if (input) {
                const count = parseInt(input.value) || 0;
                if (count > 0) {
                    scheduleData[subject.code] = count;
                }
                total += count;
            }
        });
    }

    // Validation
    if (total === 0) {
        alert('Please set at least one class for a subject.');
        return;
    }

    if (total > maxPeriods) {
        alert(`Total classes (${total}) exceeds max periods (${maxPeriods}). Please reduce.`);
        return;
    }

    // Save custom schedule (now as object with counts)
    const customSchedules = JSON.parse(localStorage.getItem(`custom_schedules_${className}`) || '{}');
    customSchedules[dateStr] = scheduleData;
    localStorage.setItem(`custom_schedules_${className}`, JSON.stringify(customSchedules));

    // Sync with Cloud
    if (window.SyncManager) {
        SyncManager.uploadAll();
    }

    closeModal('customScheduleModal');
    populateDailyLog(); // Refresh the daily log form

    alert(`✅ Custom schedule saved for ${dateStr} (${total} periods)`);
}

function saveCustomSchedulePeriodBased(dateStr) {
    const className = document.getElementById('classSelector')?.value;
    if (!className) return;

    const maxPeriods = getMaxPeriods();
    const periods = [];
    const subjectCounts = {};

    // Get subject for each period from dropdowns
    for (let i = 0; i < maxPeriods; i++) {
        const select = document.getElementById(`customPeriod_${i}`);
        if (select) {
            const subjectCode = select.value;
            periods.push(subjectCode || null);
            if (subjectCode) {
                subjectCounts[subjectCode] = (subjectCounts[subjectCode] || 0) + 1;
            }
        }
    }

    // Validation - at least one subject should be selected
    const totalClasses = Object.values(subjectCounts).reduce((a, b) => a + b, 0);
    if (totalClasses === 0) {
        alert('Please select at least one subject for a period.');
        return;
    }

    // Save in new format with _periods array AND subject counts for backward compatibility
    const scheduleData = {
        ...subjectCounts,
        _periods: periods // Special key for period-by-period data
    };

    const customSchedules = JSON.parse(localStorage.getItem(`custom_schedules_${className}`) || '{}');
    customSchedules[dateStr] = scheduleData;
    localStorage.setItem(`custom_schedules_${className}`, JSON.stringify(customSchedules));

    // Sync with Cloud
    if (window.SyncManager) {
        SyncManager.uploadAll();
    }

    closeModal('customScheduleModal');
    populateDailyLog(); // Refresh the daily log form

    alert(`✅ Custom schedule saved for ${dateStr} (${totalClasses} classes)`);
}

function clearCustomSchedule(dateStr) {
    const className = document.getElementById('classSelector')?.value;
    if (!className) return;

    const customSchedules = JSON.parse(localStorage.getItem(`custom_schedules_${className}`) || '{}');
    delete customSchedules[dateStr];
    localStorage.setItem(`custom_schedules_${className}`, JSON.stringify(customSchedules));

    // Sync with Cloud
    if (window.SyncManager) {
        SyncManager.uploadAll();
    }

    closeModal('customScheduleModal');
    populateDailyLog(); // Refresh the daily log form

    alert('✅ Switched to default schedule for ' + dateStr);
}

function filterHistoryDate(dateStr) {
    const tableBody = document.getElementById('historyTableBody');
    if (!tableBody) {
        console.error('historyTableBody element not found');
        return;
    }

    if (!dateStr) {
        // If cleared, show all dates again
        const logs = JSON.parse(localStorage.getItem('attendance_logs')) || {};
        const sortedDates = Object.keys(logs).sort((a, b) => new Date(b) - new Date(a));
        tableBody.innerHTML = renderHistoryRows(sortedDates, logs);
        return;
    }

    const check = isHolidayOrNoClass(dateStr);
    if (check.isHoliday) {
        alert(`Cannot select ${dateStr}: It is a ${check.reason}.`);
        document.getElementById('historyDateFilter').value = ''; // Clear selection
        return;
    }

    const logs = JSON.parse(localStorage.getItem('attendance_logs')) || {};

    if (logs[dateStr]) {
        // Show only this date
        const filteredDates = [dateStr];
        const rowHtml = renderHistoryRows(filteredDates, logs);
        tableBody.innerHTML = rowHtml;
    } else {
        // Show inline message with Add Log button
        tableBody.innerHTML = `
                    <tr>
                        <td colspan="3" style="padding: 30px; text-align: center;">
                            <div style="color: var(--medium-text);">
                                <p style="font-size: 1.1rem; margin-bottom: 10px;">📅 No log found for <strong>${dateStr}</strong></p>
                                <p style="margin-bottom: 20px;">Would you like to add a log for this date?</p>
                                <button class="btn primary-btn" onclick="addLogForDate('${dateStr}')" style="padding: 10px 20px;">📝 Add Log for ${dateStr}</button>
                            </div>
                        </td>
                    </tr>`;
    }
}

function addLogForDate(dateStr) {
    closeModal('historyLogModal');

    // Ensure modal exists
    const logDateEl = window.ensureDailyLogModal ? window.ensureDailyLogModal() : document.getElementById('logDate');
    if (!logDateEl && window.ensureDailyLogModal) {
        // Double check if helper wasn't ready? It should be.
    }

    if (!logDateEl) {
        console.warn('logDate element not found - attempting lazy init');
        if (window.ensureDailyLogModal) window.ensureDailyLogModal();
        // Retry
        if (!document.getElementById('logDate')) {
            alert("Error: Could not initialize Daily Log Modal. Please refresh.");
            return;
        }
    }
    document.getElementById('logDate').value = dateStr;
    populateDailyLog();
    document.getElementById('dailyLogModal').classList.add('active');
}

// Helper to lazily initialize modal
window.ensureDailyLogModal = function () {
    if (!document.getElementById('logDate')) {
        console.log('Lazy-initializing Daily Log Modal...');
        const modal = document.getElementById('dailyLogModal');
        if (modal) {
            modal.innerHTML = `<div class="modal-content"><button class="modal-close" onclick="closeModal('dailyLogModal')">&times;</button><div class="modal-header"><h2>Daily Attendance Log</h2></div><div class="form-group"><label for="logDate">Current Date:</label><input type="date" id="logDate" onchange="populateDailyLog()"></div><div id="dailyLogSubjects"></div><div class="form-actions"><button class="btn primary-btn" onclick="saveDailyLog()">Save Log</button></div><p style="font-size: 0.8rem; text-align: center; margin-top: 15px;"><strong>Note:</strong> For past dates, 'Duty Leave (OD)' must be manually reflected by adding 1 to both 'Attended' and 'Held' values in the results.</p></div>`;
        }
    }
    return document.getElementById('logDate');
};

function openDailyLog() {
    const today = formatLocalDate(new Date());

    // Ensure modal exists
    const logDateEl = window.ensureDailyLogModal();
    if (!logDateEl) {
        alert("Error: Could not initialize Daily Log Modal. Please refresh.");
        return;
    }

    logDateEl.value = today;
    populateDailyLog();
    document.getElementById('dailyLogModal').classList.add('active');
}

function editLogDate(dateStr) {
    closeModal('historyLogModal');

    // Ensure modal exists
    const logDateEl = window.ensureDailyLogModal();
    if (!logDateEl) {
        alert("Error: Could not initialize Daily Log Modal. Please refresh.");
        return;
    }

    logDateEl.value = dateStr;
    populateDailyLog();
    document.getElementById('dailyLogModal').classList.add('active');
}

function applyBulkAction(status) {
    const allSelects = document.querySelectorAll('#dailyLogSubjects select');
    allSelects.forEach(select => {
        select.value = status;
    });
    if (status === 'Medical Leave (ML)') {
        alert("All subjects marked as Medical Leave (ML).");
    }
}

function handleStatusChange(selectElement) {
    const status = selectElement.value;
    const subjectCode = selectElement.dataset.code;
    const allSelects = document.querySelectorAll('#dailyLogSubjects select');

    // Check if current subject WAS ML before change
    const wasML = selectElement.dataset.previousValue === 'Medical Leave (ML)';

    if (status === 'Medical Leave (ML)') {
        // Auto-set all others to ML
        allSelects.forEach(select => {
            select.value = 'Medical Leave (ML)';
            select.dataset.previousValue = 'Medical Leave (ML)';
        });
        alert("Medical Leave (ML) selected.\n\nAll subjects for this day have been marked as ML.");
    } else if (wasML && status !== 'Medical Leave (ML)') {
        // Changing FROM ML to something else - reset all to Default
        allSelects.forEach(select => {
            select.value = 'Default';
            select.dataset.previousValue = 'Default';
        });
        alert("ML removed from this day.\n\nAll subjects have been reset to 'Default'.\nPlease mark attendance for each subject individually.");
    } else if (status === 'Attended' || status === 'Skipped' || status === 'Cancelled' || status === 'Duty Leave (OD)') {
        // Check if OTHER subjects are still ML
        const hasOtherML = Array.from(allSelects).some(s => s !== selectElement && s.value === 'Medical Leave (ML)');

        if (hasOtherML) {
            alert("Cannot mix 'Medical Leave (ML)' with other statuses.\n\nTo edit individual subjects, first change any ML subject to 'Default' to reset all.");
            selectElement.value = 'Medical Leave (ML)';
            return;
        }
    }

    // Update previous value for next change detection
    selectElement.dataset.previousValue = status;
}

// === QR SCANNER AND GENERATOR FUNCTIONS (Reference Implementation) ===

var qrStream = null;
var qrVideo = null;
var qrCanvas = null;
var qrContext = null;
var qrScanLoop = null;

function switchModalTab(tabName) {
    // Hide all tabs
    ['form', 'json', 'scan', 'share', 'aiImport'].forEach(t => {
        const el = document.getElementById(t + 'EntryTab');
        if (el) el.style.display = 'none';
        const btn = document.getElementById(t + 'TabBtn');
        if (btn) btn.classList.remove('active');
    });

    // Show selected
    const selectedEl = document.getElementById(tabName + 'EntryTab');
    if (selectedEl) selectedEl.style.display = 'block';
    const selectedBtn = document.getElementById(tabName + 'TabBtn');
    if (selectedBtn) selectedBtn.classList.add('active');

    isJsonMode = (tabName === 'json');

    // Hide/show modal Save button based on tab
    // Form Entry tab has its own save button in wizard step 3
    const modalSaveBtn = document.getElementById('modalSaveBtn');
    if (modalSaveBtn) {
        if (tabName === 'form') {
            modalSaveBtn.style.display = 'none';
        } else if (tabName === 'json') {
            modalSaveBtn.style.display = 'inline-block';
            modalSaveBtn.textContent = 'Import JSON';
            modalSaveBtn.classList.remove('success-btn');
            modalSaveBtn.classList.add('primary-btn');
        } else {
            modalSaveBtn.style.display = 'none';
        }
    }

    // Logic for specific tabs
    if (tabName === 'scan') {
        startTabScanner();
    } else {
        stopTabScanner();
    }

    if (tabName === 'share') {
        generateShareQRTab();
    }
}

async function startTabScanner() {
    // Lazy-load jsQR library
    try { await loadScript(CDN.JSQR); } catch (e) { console.warn('jsQR load failed, using BarcodeDetector fallback'); }
    const reader = document.getElementById('readerTab');
    if (!reader || qrStream) return;

    // Create video element
    reader.innerHTML = `
                    <div style="position: relative; max-width: 100%; margin: 0 auto;">
                        <video id="qrVideo" style="width: 100%; border-radius: 8px; background: #000;"></video>
                        <div id="qrStatus" style="margin-top: 10px; text-align: center; color: var(--medium-text);">
                            Starting camera...
                        </div>
                    </div>
                `;

    qrVideo = document.getElementById('qrVideo');
    qrCanvas = document.createElement('canvas');
    qrContext = qrCanvas.getContext('2d');

    // Request camera access
    navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
    })
        .then(stream => {
            qrStream = stream;
            qrVideo.srcObject = stream;
            qrVideo.setAttribute('playsinline', true);
            qrVideo.play();

            document.getElementById('qrStatus').textContent = 'Point camera at QR code...';

            // Start scanning loop
            qrVideo.addEventListener('loadedmetadata', () => {
                qrCanvas.width = qrVideo.videoWidth;
                qrCanvas.height = qrVideo.videoHeight;
                scanQRCode();
            });
        })
        .catch(err => {
            document.getElementById('qrStatus').innerHTML =
                '<span style="color: var(--danger-color);">Camera access denied. Please allow camera access and try again.</span>';
            console.error('Camera error:', err);
        });
}

async function scanQRCode() {
    if (!qrVideo || !qrStream) return;

    // Try Native BarcodeDetector first (Faster & Better)
    if ('BarcodeDetector' in window) {
        try {
            const barcodeDetector = new BarcodeDetector({ formats: ['qr_code'] });
            const barcodes = await barcodeDetector.detect(qrVideo);

            if (barcodes.length > 0) {
                onScanSuccessTab(barcodes[0].rawValue);
                stopTabScanner();
                return;
            }
        } catch (e) {
            console.warn('BarcodeDetector failed, falling back to jsQR', e);
        }
    }

    // Fallback to jsQR
    if (qrVideo.readyState === qrVideo.HAVE_ENOUGH_DATA) {
        qrCanvas.width = qrVideo.videoWidth;
        qrCanvas.height = qrVideo.videoHeight;
        qrContext.drawImage(qrVideo, 0, 0, qrCanvas.width, qrCanvas.height);

        const imageData = qrContext.getImageData(0, 0, qrCanvas.width, qrCanvas.height);

        // Check if jsQR is loaded
        if (typeof jsQR === 'function') {
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "dontInvert",
            });

            if (code) {
                onScanSuccessTab(code.data);
                stopTabScanner();
                return;
            }
        } else {
            console.error('jsQR library not loaded!');
        }
    }

    // Keep scanning
    qrScanLoop = requestAnimationFrame(scanQRCode);
}

function stopTabScanner() {
    if (qrScanLoop) {
        cancelAnimationFrame(qrScanLoop);
        qrScanLoop = null;
    }

    if (qrStream) {
        qrStream.getTracks().forEach(track => track.stop());
        qrStream = null;
    }

    if (qrVideo) {
        qrVideo.srcObject = null;
        qrVideo = null;
    }

    const reader = document.getElementById('readerTab');
    if (reader) {
        reader.innerHTML = '';
    }
}

async function handleQRFileUploadInTab(input) {
    if (input.files.length === 0) return;

    // Lazy-load jsQR library
    try { await loadScript(CDN.JSQR); } catch (e) {
        alert('⚠️ Failed to load QR scanner library. Check your internet connection.');
        return;
    }

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');

            // Resize if too large (max 800px) for performance
            const MAX_SIZE = 800;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_SIZE) {
                    height *= MAX_SIZE / width;
                    width = MAX_SIZE;
                }
            } else {
                if (height > MAX_SIZE) {
                    width *= MAX_SIZE / height;
                    height = MAX_SIZE;
                }
            }

            canvas.width = width;
            canvas.height = height;
            context.drawImage(img, 0, 0, width, height);

            const imageData = context.getImageData(0, 0, width, height);
            let code = jsQR(imageData.data, imageData.width, imageData.height);

            if (code) {
                onScanSuccessTab(code.data);
                input.value = '';
                return;
            }

            // If failed, try inverting colors (for dark mode QRs)
            console.log("Standard scan failed, trying inverted...");
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                data[i] = 255 - data[i];     // R
                data[i + 1] = 255 - data[i + 1]; // G
                data[i + 2] = 255 - data[i + 2]; // B
            }
            context.putImageData(imageData, 0, 0);
            code = jsQR(imageData.data, imageData.width, imageData.height);

            if (code) {
                onScanSuccessTab(code.data);
            } else {
                alert("Could not read QR code.\n\nTips:\n1. Ensure the image is clear and well-lit.\n2. Crop the image to show ONLY the QR code.\n3. If it's a screenshot, try zooming in before capturing.");
            }
            input.value = '';
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function onScanSuccessTab(decodedText) {
    try {
        const rawData = JSON.parse(decodedText);
        let classData = {};
        let timetableArrangement = null;

        // === NEW MINIFIED FORMAT (v2): t, ld, h, s with sch ===
        // Format: { t: "ClassName", ld: "260401", h: ["250809"], s: [{n, sn, c, sch: "1|1,2|0|..."}] }
        const isMinifiedV2 = rawData.t && rawData.s && Array.isArray(rawData.s) &&
            rawData.s.length > 0 && rawData.s[0].sch !== undefined;

        if (isMinifiedV2) {
            console.log('Detected minified QR format v2');

            // Helper: Convert YYMMDD to YYYY-MM-DD
            const expandDate = (yymmdd) => {
                if (!yymmdd || yymmdd.length !== 6) return '';
                const yy = yymmdd.slice(0, 2);
                const mm = yymmdd.slice(2, 4);
                const dd = yymmdd.slice(4, 6);
                const century = parseInt(yy) > 50 ? '19' : '20';
                return `${century}${yy}-${mm}-${dd}`;
            };

            // Parse subjects
            const processedSubjects = rawData.s.map(sub => {
                // Parse pipe-delimited schedule: "1|1,2|0|3|0|0|0" -> [1, 2, 0, 1, 0, 0, 0] (counts)
                const schParts = (sub.sch || '0|0|0|0|0|0|0').split('|');
                const schedule = schParts.map(part => {
                    if (!part || part === '0') return 0;
                    return part.split(',').filter(p => p.trim() && p.trim() !== '0').length;
                });

                return {
                    name: sub.n,
                    shortName: sub.sn || getSubjectShortName(sub.n),
                    code: sub.c,
                    schedule: schedule
                };
            });

            // Generate timetable arrangement from sch strings
            timetableArrangement = {};
            let maxPeriods = 0;

            // Calculate max periods
            rawData.s.forEach(sub => {
                const schParts = (sub.sch || '').split('|');
                schParts.forEach(part => {
                    if (part && part !== '0') {
                        const periods = part.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p) && p > 0);
                        if (periods.length > 0) {
                            maxPeriods = Math.max(maxPeriods, Math.max(...periods));
                        }
                    }
                });
            });

            // Build arrangement using day indices (0-6)
            [0, 1, 2, 3, 4, 5, 6].forEach(dayIndex => {
                timetableArrangement[dayIndex] = Array(maxPeriods).fill(null);

                rawData.s.forEach(sub => {
                    const schParts = (sub.sch || '').split('|');
                    const daySchedule = schParts[dayIndex] || '0';

                    if (daySchedule && daySchedule !== '0') {
                        const periods = daySchedule.split(',')
                            .map(p => parseInt(p.trim()))
                            .filter(p => !isNaN(p) && p > 0);

                        periods.forEach(periodNum => {
                            if (periodNum > 0 && periodNum <= maxPeriods) {
                                timetableArrangement[dayIndex][periodNum - 1] = sub.c;
                            }
                        });
                    }
                });

                // Clean up trailing nulls
                while (timetableArrangement[dayIndex].length > 0 &&
                    timetableArrangement[dayIndex][timetableArrangement[dayIndex].length - 1] === null) {
                    timetableArrangement[dayIndex].pop();
                }
            });

            classData = {
                name: rawData.t,
                lastDate: expandDate(rawData.ld),
                subjects: processedSubjects,
                holidays: (rawData.h || []).map(expandDate)
            };
        }
        // === OLD FULL FORMAT: Class name as top-level key ===
        // Format: { "ClassName": { lastDate, holidays, subjects: [{name, shortName, code, schedule}], qrCode } }
        else if (Object.keys(rawData).length === 1 &&
            rawData[Object.keys(rawData)[0]] &&
            rawData[Object.keys(rawData)[0]].subjects &&
            Array.isArray(rawData[Object.keys(rawData)[0]].subjects)) {

            const topLevelKeys = Object.keys(rawData);
            const className = topLevelKeys[0];
            const data = rawData[className];

            // Detect if schedule is string-based (new format) and convert to integer
            const processedSubjects = data.subjects.map(sub => {
                let schedule = sub.schedule;

                // Check if schedule is string array and convert to integer counts
                if (Array.isArray(schedule) && schedule.length > 0 && typeof schedule[0] === 'string') {
                    schedule = schedule.map(daySchedule => {
                        if (!daySchedule || daySchedule === '0') return 0;
                        return String(daySchedule).split(',').filter(p => p.trim() && p.trim() !== '0').length;
                    });
                }

                return {
                    name: sub.name,
                    shortName: sub.shortName || getSubjectShortName(sub.name),
                    code: sub.code,
                    schedule: schedule
                };
            });

            // Generate timetable arrangement from string schedules (period positions)
            const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            timetableArrangement = {};

            // Calculate max periods from string schedules
            let maxPeriods = 0;
            data.subjects.forEach(subject => {
                if (subject.schedule) {
                    subject.schedule.forEach(daySchedule => {
                        if (daySchedule && daySchedule !== '0') {
                            const periods = String(daySchedule).split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p));
                            if (periods.length > 0) {
                                maxPeriods = Math.max(maxPeriods, Math.max(...periods));
                            }
                        }
                    });
                }
            });

            // Build arrangement from string schedules - USE DAY INDEX as key (not name)
            days.forEach((dayName, dayIndex) => {
                timetableArrangement[dayIndex] = Array(maxPeriods).fill(null);

                data.subjects.forEach(subject => {
                    if (subject.schedule && subject.schedule[dayIndex] && subject.schedule[dayIndex] !== '0') {
                        const periods = String(subject.schedule[dayIndex]).split(',')
                            .map(p => parseInt(p.trim()))
                            .filter(p => !isNaN(p) && p > 0);

                        periods.forEach(periodNum => {
                            if (periodNum > 0 && periodNum <= maxPeriods) {
                                timetableArrangement[dayIndex][periodNum - 1] = subject.code;
                            }
                        });
                    }
                });

                // Clean up trailing nulls
                while (timetableArrangement[dayIndex].length > 0 &&
                    timetableArrangement[dayIndex][timetableArrangement[dayIndex].length - 1] === null) {
                    timetableArrangement[dayIndex].pop();
                }
            });

            classData = {
                name: className,
                lastDate: data.lastDate,
                subjects: processedSubjects,
                holidays: data.holidays || []
            };
        }
        // Handle Minified Format (n=name, l=lastDate, s=subjects, h=holidays, ta=timetableArrangement)
        else if (rawData.n && rawData.s) {
            classData = {
                name: rawData.n,
                lastDate: rawData.l,
                subjects: rawData.s.map(sub => ({
                    name: sub.n,
                    code: sub.c,
                    schedule: sub.sc
                })),
                holidays: rawData.h || []
            };

            // Extract timetable arrangement if present
            if (rawData.ti) {
                // Reconstruct from Timetable Indices (ti)
                // Now supporting ARRAY format [MonArray, TueArray...]
                const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                timetableArrangement = {};

                // Check if it's an array (new format) or object (old format/backup)
                if (Array.isArray(rawData.ti)) {
                    rawData.ti.forEach((dayIndices, dayIndex) => {
                        const dayName = days[dayIndex];
                        if (dayIndices && dayIndices.length > 0) {
                            timetableArrangement[dayIndex] = dayIndices.map(index => {
                                if (index === -1) return null; // Free Period
                                return classData.subjects[index] ? classData.subjects[index].code : null;
                            });
                        }
                    });
                } else {
                    // Object format (legacy intermediate step)
                    Object.keys(rawData.ti).forEach(day => {
                        timetableArrangement[day] = rawData.ti[day].map(index => {
                            if (index === -1) return null;
                            return classData.subjects[index] ? classData.subjects[index].code : null;
                        });
                    });
                }
            } else if (rawData.ta) {
                timetableArrangement = rawData.ta;
            }

            // === FALLBACK: Generate Default Arrangement if Missing ===
            // If no arrangement found, generate one from the subject schedule counts - USE INDEX as key
            if (!timetableArrangement || Object.keys(timetableArrangement).length === 0) {
                timetableArrangement = {};

                [0, 1, 2, 3, 4, 5, 6].forEach(dayIndex => {
                    const dailySequence = [];
                    classData.subjects.forEach(subject => {
                        // Check how many classes this subject has on this day
                        // Handle array schedule (new format) or mapped schedule
                        const count = parseScheduleValue(subject.schedule[dayIndex]);
                        for (let k = 0; k < count; k++) {
                            dailySequence.push(subject.code);
                        }
                    });
                    timetableArrangement[dayIndex] = dailySequence;
                });
            }
        } else {
            // Handle Legacy Format
            classData = rawData;
            // Check for timetableArrangement in legacy format
            if (rawData.timetableArrangement) {
                timetableArrangement = rawData.timetableArrangement;
            }
        }

        if (!classData.name || !classData.subjects || !Array.isArray(classData.subjects)) {
            alert("Invalid Class QR Code: Missing name or subjects.");
            return;
        }

        let newName = classData.name;
        let counter = 1;
        while (classes[newName]) {
            newName = `${classData.name} (${counter++})`;
        }
        classData.name = newName;

        // Add to classes
        classes[newName] = {
            lastDate: classData.lastDate || '',
            subjects: classData.subjects,
            holidays: classData.holidays || []
        };
        saveToStorage();

        // Save timetable arrangement if present, otherwise generate default
        let validTA = false;
        if (timetableArrangement && Object.keys(timetableArrangement).length > 0) {
            try {
                // Check if it has actual content
                const hasContent = Object.values(timetableArrangement).some(dayArr => Array.isArray(dayArr) && dayArr.length > 0);
                if (hasContent) validTA = true;
            } catch (e) { }
        }

        if (validTA) {
            // Convert day names to indices if needed before saving
            const convertedTA = {};
            const dayNameToIndex = { 'Mon': 0, 'Tue': 1, 'Wed': 2, 'Thu': 3, 'Fri': 4, 'Sat': 5, 'Sun': 6 };
            Object.keys(timetableArrangement).forEach(key => {
                // If key is a day name, convert to index
                if (dayNameToIndex[key] !== undefined) {
                    convertedTA[dayNameToIndex[key]] = timetableArrangement[key];
                } else {
                    convertedTA[key] = timetableArrangement[key];
                }
            });
            localStorage.setItem(`timetable_arrangement_${newName}`, JSON.stringify(convertedTA));
        } else {
            // Force generation of default timetable if missing from QR - USE INDEX as key
            const defaultTA = {};
            [0, 1, 2, 3, 4, 5, 6].forEach(dayIndex => {
                const dailySequence = [];
                classData.subjects.forEach(subject => {
                    const count = (subject.schedule && subject.schedule[dayIndex]) || 0;
                    for (let k = 0; k < count; k++) {
                        dailySequence.push(subject.code);
                    }
                });
                defaultTA[dayIndex] = dailySequence;
            });
            if (Object.keys(defaultTA).length > 0) {
                localStorage.setItem(`timetable_arrangement_${newName}`, JSON.stringify(defaultTA));
            }
        }

        populateClassSelector();

        // Select the new class
        document.getElementById('classSelector').value = newName;
        onClassChange();

        alert(`Class "${newName}" imported successfully!`);
        closeModal('addClassModal');
        stopTabScanner();

    } catch (e) {
        alert("Error parsing QR code: " + e.message);
    }
}

async function generateShareQRTab() {
    if (!editingClassName || !classes[editingClassName]) return;

    const classData = classes[editingClassName];
    const qrContainer = document.getElementById('qrcodeTab');

    try {
        // Get timetable arrangement for accurate period numbers
        const arrangement = getTimetableArrangement(editingClassName);

        // === MINIFIED FORMAT for low-density QR ===
        // t=title, ld=lastDate(YYMMDD), h=holidays, s=subjects
        // Subject: n=name, sn=shortName, c=code, sch=schedule(pipe-delimited)

        // Helper: Convert YYYY-MM-DD to YYMMDD
        const compressDate = (dateStr) => {
            if (!dateStr) return '';
            return dateStr.replace(/-/g, '').slice(2); // "2025-08-09" -> "250809"
        };

        // Build minified data
        const minifiedData = {
            t: editingClassName,
            ld: compressDate(classData.lastDate),
            h: (classData.holidays || []).map(compressDate),
            s: classData.subjects.map((subject) => {
                // Get shortName
                const shortName = subject.shortName || getSubjectShortName(subject.name);

                // Build schedule string (pipe-delimited)
                let scheduleArr = [];
                [0, 1, 2, 3, 4, 5, 6].forEach(dayIndex => {
                    if (arrangement && arrangement[dayIndex]) {
                        // Find which periods this subject occupies
                        const periods = [];
                        arrangement[dayIndex].forEach((item, periodIndex) => {
                            const itemCode = (typeof item === 'string') ? item : (item?.code || null);
                            if (itemCode === subject.code) {
                                periods.push(periodIndex + 1);
                            }
                        });
                        scheduleArr.push(periods.length > 0 ? periods.join(',') : '0');
                    } else {
                        // Fallback: use count-based format
                        const count = subject.schedule?.[dayIndex] || 0;
                        if (count > 0) {
                            const periods = Array.from({ length: count }, (_, i) => i + 1);
                            scheduleArr.push(periods.join(','));
                        } else {
                            scheduleArr.push('0');
                        }
                    }
                });

                return {
                    n: subject.name,
                    sn: shortName,
                    c: subject.code,
                    sch: scheduleArr.join('|') // "1|1,2|1|0|1|1|0"
                };
            })
        };

        const jsonString = JSON.stringify(minifiedData);
        qrContainer.innerHTML = '';

        // Show size info
        console.log(`QR Data size: ${jsonString.length} chars`);

        // Check if data is too large for QR (limit ~2.5KB for reliable scanning)
        if (jsonString.length > 2500) {
            qrContainer.innerHTML = `<div style="color:var(--warning-color); padding:20px; text-align:center;">
                            <p>⚠️ Class data is too large for QR Code (${jsonString.length} chars).</p>
                            <p style="font-size:0.8rem">Use "Copy JSON" to share via text instead.</p>
                            <button class="btn primary-btn" onclick="copyMinifiedQRData()">📋 Copy JSON</button>
                        </div>`;
            return;
        }

        // Lazy-load QRCode library
        try { await loadScript(CDN.QRCODE); } catch (e) {
            qrContainer.innerHTML = '<p style="text-align:center;padding:20px;">⚠️ Failed to load QR library.</p>';
            return;
        }
        new QRCode(qrContainer, {
            text: jsonString,
            width: 300,
            height: 300,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.L
        });

        // Center the QR code
        qrContainer.style.display = 'flex';
        qrContainer.style.flexDirection = 'column';
        qrContainer.style.alignItems = 'center';
        qrContainer.style.justifyContent = 'center';
    } catch (error) {
        console.error("QR Gen Error:", error);
        qrContainer.innerHTML = `<div style="color:var(--danger-color); padding:20px; text-align:center;">
                        <p>⚠️ Failed to generate QR Code.</p>
                        <p style="font-size:0.8rem">Data might be too large or invalid.</p>
                    </div>`;
        alert("Error generating QR code. The class data might be too large.");
    }
}

// Helper to copy minified QR data
function copyMinifiedQRData() {
    if (!editingClassName || !classes[editingClassName]) return;
    const classData = classes[editingClassName];
    const arrangement = getTimetableArrangement(editingClassName);

    const compressDate = (dateStr) => dateStr ? dateStr.replace(/-/g, '').slice(2) : '';

    const minifiedData = {
        t: editingClassName,
        ld: compressDate(classData.lastDate),
        h: (classData.holidays || []).map(compressDate),
        s: classData.subjects.map(subject => ({
            n: subject.name,
            sn: subject.shortName || getSubjectShortName(subject.name),
            c: subject.code,
            sch: [0, 1, 2, 3, 4, 5, 6].map(dayIndex => {
                if (arrangement && arrangement[dayIndex]) {
                    const periods = [];
                    arrangement[dayIndex].forEach((item, pi) => {
                        const code = typeof item === 'string' ? item : item?.code;
                        if (code === subject.code) periods.push(pi + 1);
                    });
                    return periods.length > 0 ? periods.join(',') : '0';
                }
                return '0';
            }).join('|')
        }))
    };

    navigator.clipboard.writeText(JSON.stringify(minifiedData))
        .then(() => alert('Minified JSON copied!'));
}

async function shareClassLinkFromTab() {
    if (!editingClassName || !classes[editingClassName]) {
        showToast('❌ Error: No class selected', 'error');
        return;
    }

    const currentClass = classes[editingClassName];
    const cleanClassData = {
        name: editingClassName,
        subjects: currentClass.subjects || [],
        holidays: currentClass.holidays || [],
        timetable: getTimetableArrangement(editingClassName) || {},
        periodTimes: currentClass.periodTimes || {},
        lastDate: currentClass.lastDate || ''
    };

    // Compression v2
    const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(cleanClassData));
    const encodedData = 'v2_' + compressed;
    const shareUrl = `${window.location.origin}${window.location.pathname}?class=${encodedData}`;

    // URL length validation (browsers typically support ~2000 chars, warn at 1500)
    if (shareUrl.length > 1500) {
        console.warn(`⚠️ Share URL is ${shareUrl.length} chars (may exceed limits)`);
        if (shareUrl.length > 2000) {
            showToast('⚠️ Class too large to share', 'Try removing some subjects or holidays', { duration: 5000 });
            return;
        }
        showToast('⚠️ Large class', 'Link may not work on all devices', { duration: 3000 });
    }

    const shareData = {
        title: `${cleanClassData.name} | Bunkit Class`,
        text: `${cleanClassData.name} | Bunkit Class\n\n` +
            `Hey everyone! If you want to track attendance and timetable easily, just follow these quick steps:\n\n` +
            `Click the link below and your subjects + timetable will import automatically.\n\n` +
            `Use Bunkit on the web or add it to your home screen to use it just like an app for both iOS and Android.\n\n` +
            `Import Link: ${shareUrl}`,
        url: shareUrl
    };

    if (navigator.share) {
        try {
            await navigator.share(shareData);
            showToast('✅ Link shared successfully!', 'success');
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Share failed:', err);
                copyShareLinkToClipboard(shareUrl);
            }
        }
    } else {
        copyShareLinkToClipboard(shareUrl);
    }
}

function downloadQRImageTab() {
    const qrContainer = document.getElementById('qrcodeTab');
    const canvas = qrContainer.querySelector('canvas');
    const img = qrContainer.querySelector('img');
    const source = canvas || img;

    if (!source) return;

    const link = document.createElement('a');
    link.download = `Class_QR_${editingClassName}.png`;
    link.href = source.src || source.toDataURL();
    link.click();
}

// Global exports (keeping both naming conventions for compatibility)
window.startQRScannerInTab = startTabScanner;
window.startTabScanner = startTabScanner;
window.stopTabScanner = stopTabScanner;
window.handleQRFileUploadInTab = handleQRFileUploadInTab;
window.generateShareQRInTab = generateShareQRTab;
window.generateShareQRTab = generateShareQRTab;
window.shareClassLinkFromTab = shareClassLinkFromTab;
window.downloadQRImageTab = downloadQRImageTab;


function getMissingLogDates() {
    if (!selectedClass?.portalSetup?.semesterStartDate) return [];

    const logs = JSON.parse(localStorage.getItem('attendance_logs')) || {};
    const startDate = parseLocalDate(selectedClass.portalSetup.semesterStartDate);
    const now = new Date();
    const limitDate = new Date();
    limitDate.setHours(0, 0, 0, 0);

    // Rule: If before 3:00 PM, we only expect logs up to Yesterday
    // After 3:00 PM, we expect logs for Today as well
    if (now.getHours() < 15) {
        limitDate.setDate(limitDate.getDate() - 1);
    }

    const missingDates = [];

    for (let d = new Date(startDate); d <= limitDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const check = isHolidayOrNoClass(dateStr);

        // Skip holidays and no-class days
        if (check.isHoliday) continue;

        // Check if log exists
        if (!logs[dateStr]) {
            missingDates.push(dateStr);
        }
    }

    return missingDates;
}

// ==================== PERIOD-WISE ATTENDANCE VIEW ====================

// Generate unique colors for subjects - uses same palette as timetable
function getSubjectColorsForPeriodView() {
    const colors = {};
    if (!selectedClass?.subjects) return colors;
    selectedClass.subjects.forEach((s, i) => {
        // Use the same getSubjectColor function as timetable
        const baseColor = getSubjectColor(i);
        colors[s.code] = {
            glow: baseColor,
            name: s.name,
            index: i
        };
    });
    return colors;
}

// Get timetable for a specific day (0=Mon, 6=Sun)
function getTimetableForDay(dayIndex) {
    const className = document.getElementById('classSelector')?.value;
    if (!className || !selectedClass?.subjects) return [];

    const arrangement = getTimetableArrangement(className);

    // Check if arrangement exists for this day
    // Arrangement uses numeric day indices (0=Mon, 6=Sun)
    if (arrangement && arrangement[dayIndex]) {
        // Use saved arrangement (array of objects with code, name, shortName)
        // Null items represent FREE PERIODS
        return arrangement[dayIndex].map(item => {
            // Null = free period, keep it
            if (!item) return null;
            // Handle both formats: object {code, name} or just code string
            const code = typeof item === 'object' ? item.code : item;
            if (!code) return null; // free period
            const subject = selectedClass.subjects.find(s => s.code === code);
            return subject ? { code: subject.code, name: subject.name } : null;
        }); // No filter - keep nulls for free periods
    } else {
        // Generate from schedule (fallback)
        const periods = [];
        selectedClass.subjects.forEach(subject => {
            const count = parseScheduleValue(subject.schedule[dayIndex]);
            for (let i = 0; i < count; i++) {
                periods.push({ code: subject.code, name: subject.name });
            }
        });
        return periods;
    }
}

// Check if date is holiday (using existing function)
function isDateHoliday(dateStr) {
    if (!selectedClass) return false;
    return (selectedClass.holidays || []).includes(dateStr);
}

// Get max periods across all days
function getMaxPeriods() {
    let max = 0;
    for (let d = 0; d < 7; d++) {
        const periods = getTimetableForDay(d);
        if (periods.length > max) max = periods.length;
    }
    return max;
}

// Open period-wise attendance modal
function openPeriodAttendanceModal() {
    if (!selectedClass) {
        alert('Please select a class first.');
        return;
    }

    if (!selectedClass.portalSetup?.active) {
        alert('Period-wise view is only available in Portal Mode.\n\nPlease set up Portal Mode first by clicking "Setup Portal Mode" in the dashboard.');
        return;
    }

    const className = document.getElementById('classSelector').value;
    const logs = JSON.parse(localStorage.getItem('attendance_logs')) || {};
    const subjectColors = getSubjectColorsForPeriodView();
    const maxPeriods = getMaxPeriods();

    if (maxPeriods === 0) {
        alert('No periods configured. Please set up your weekly timetable first.');
        return;
    }

    // Get date range (semester start to today)
    const startDate = parseLocalDate(selectedClass.portalSetup.semesterStartDate);
    // Use parseLocalDate with formatLocalDate to get "Today" at midnight local time
    const today = parseLocalDate(formatLocalDate(new Date()));

    // Group dates by month
    const monthGroups = {};
    for (let d = new Date(today); d >= startDate; d.setDate(d.getDate() - 1)) {
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const monthName = d.toLocaleString('default', { month: 'long', year: 'numeric' });

        if (!monthGroups[monthKey]) {
            monthGroups[monthKey] = { name: monthName, dates: [] };
        }
        monthGroups[monthKey].dates.push(new Date(d));
    }

    // Build modal HTML
    let modalHTML = `
                    <div class="modal-content" style="max-width: 95vw; width: 900px;">
                        <button class="modal-close" onclick="closeModal('periodAttendanceModal')">&times;</button>
                        <div class="modal-header">
                            <h2>📊 Period-wise Attendance</h2>
                            <p>View and edit your attendance by period. Click on any cell to change status.</p>
                        </div>
                        
                        <div class="period-legend">
                            <div class="period-legend-item"><div class="period-legend-color" style="background: rgba(200, 200, 200, 0.6); border: 2px dashed #888;"></div> Not Logged (?)</div>
                            <div class="period-legend-item"><div class="period-legend-color" style="background: #4CAF50;"></div> Present (P)</div>
                            <div class="period-legend-item"><div class="period-legend-color" style="background: #f44336;"></div> Absent (A)</div>
                            <div class="period-legend-item"><div class="period-legend-color" style="background: #9e9e9e;"></div> Cancelled (C)</div>
                            <div class="period-legend-item"><div class="period-legend-color" style="background: #2196F3;"></div> Duty Leave (OD)</div>
                            <div class="period-legend-item"><div class="period-legend-color" style="background: #FF9800;"></div> Medical (ML)</div>
                        </div>

                        <div class="period-view-container" style="margin-top: 15px;">`;

    // Render each month
    Object.keys(monthGroups).sort().reverse().forEach((monthKey, idx) => {
        const month = monthGroups[monthKey];
        let notLoggedCount = 0;
        let presentCount = 0;
        let absentCount = 0;
        let cancelledCount = 0;
        let odCount = 0;
        let mlCount = 0;

        // Calculate month stats
        month.dates.forEach(date => {
            const dateStr = formatLocalDate(date);
            const dayOfWeek = date.getDay();
            const scheduleIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

            if (!isDateHoliday(dateStr)) {
                const periods = getTimetableForDay(scheduleIndex);
                const dayLog = logs[dateStr] || {};
                const seenCounts = {};

                periods.forEach(period => {
                    // Skip null/free periods
                    if (!period || !period.code) return;

                    // Track instance count for this subject (e.g., 1st MATH, 2nd MATH)
                    seenCounts[period.code] = (seenCounts[period.code] || 0) + 1;
                    const instance = seenCounts[period.code];
                    const specificKey = `${period.code}_p${instance}`;

                    // Check period-specific key first, then fallback to legacy key
                    let status = dayLog[specificKey];
                    if (!status) {
                        status = dayLog[period.code];
                    }

                    if (!status || status === 'Default') {
                        notLoggedCount++;
                    } else if (status === 'Attended') {
                        presentCount++;
                    } else if (status === 'Skipped') {
                        absentCount++;
                    } else if (status === 'Cancelled') {
                        cancelledCount++;
                    } else if (status === 'Duty Leave (OD)') {
                        odCount++;
                    } else if (status === 'Medical Leave (ML)') {
                        mlCount++;
                    }
                });
            }
        });

        modalHTML += `
                        <div class="period-month-section ${idx > 0 ? 'collapsed' : ''}">
                            <div class="period-month-header" onclick="togglePeriodMonth(this)">
                                <h4>${month.name}</h4>
                                <div class="period-month-summary">
                                    <span class="period-summary-badge not-logged" title="Not Logged">? ${notLoggedCount}</span>
                                    <span class="period-summary-badge present" title="Present">P ${presentCount}</span>
                                    <span class="period-summary-badge absent" title="Absent">A ${absentCount}</span>
                                    <span class="period-summary-badge cancelled" title="Cancelled">C ${cancelledCount}</span>
                                    <span class="period-summary-badge od" title="Duty Leave">OD ${odCount}</span>
                                    <span class="period-summary-badge ml" title="Medical Leave">ML ${mlCount}</span>
                                    <span class="period-month-toggle">▼</span>
                                </div>
                            </div>
                            <div class="period-month-content">
                                <div class="period-grid-wrapper">
                                    <div class="period-grid" style="grid-template-columns: 90px repeat(${maxPeriods}, 1fr);">
                                        <div class="period-grid-header">
                                            <div>Date</div>`;

        for (let p = 1; p <= maxPeriods; p++) {
            modalHTML += `<div>${p}</div>`;
        }
        modalHTML += `</div>`;

        // Render dates in this month
        month.dates.forEach(date => {
            const dateStr = formatLocalDate(date);
            const dayOfWeek = date.getDay();
            const scheduleIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            const isHoliday = isDateHoliday(dateStr);
            const dayLog = logs[dateStr] || {};

            // Get subjects for this day - PRESERVE LOGGED DATA
            // Logged data is NEVER affected by timetable changes - it stays as-is
            const loggedSubjectCodes = Object.keys(dayLog);

            // FIX: Check for Custom Schedule FIRST
            const customSchedule = getCustomScheduleForDate(dateStr);
            let timetablePeriods = [];

            if (customSchedule && customSchedule._periods) {
                // Use Custom Schedule Periods (New Format)
                timetablePeriods = customSchedule._periods.map(code => {
                    if (!code) return null; // Free period
                    const subject = selectedClass.subjects.find(s => s.code === code);
                    return subject ? { code: subject.code, name: subject.name } : null;
                });
            } else if (customSchedule && typeof customSchedule === 'object' && !Array.isArray(customSchedule)) {
                // Use Custom Schedule Periods (Old Count-based Format via Fallback Logic)
                // Since old format doesn't have order, we try to reconstruct or just fall back to default
                // For simplicity and safety, we'll fall back to default timetable order but filtered by count
                // (Ideally users should just re-save as period-based if they want strict order)
                timetablePeriods = getTimetableForDay(scheduleIndex);
            } else {
                // Default Timetable
                timetablePeriods = getTimetableForDay(scheduleIndex);
            }

            // Create a combined list with smart ordering
            let periodsToShow = [];

            if (loggedSubjectCodes.length > 0) {
                // LOGGED DATA EXISTS - always show exactly what was logged
                // Only use timetable for ORDERING, never for filtering

                // Count classes per subject in timetable (skip null/free periods)
                const timetableCountBySubject = {};
                timetablePeriods.forEach(p => {
                    if (p && p.code) {
                        timetableCountBySubject[p.code] = (timetableCountBySubject[p.code] || 0) + 1;
                    }
                });

                // Count classes per subject in logs
                const logCountBySubject = {};
                loggedSubjectCodes.forEach(code => {
                    logCountBySubject[code] = (logCountBySubject[code] || 0) + 1;
                });

                // Check if any logged subject has MORE classes than timetable
                // OR if any logged subject is NOT in timetable (timetable changed)
                let shouldKeepLogOrder = false;
                for (const code of Object.keys(logCountBySubject)) {
                    const logCount = logCountBySubject[code];
                    const ttCount = timetableCountBySubject[code] || 0;
                    if (logCount > ttCount || ttCount === 0) {
                        // Extra classes OR subject no longer in timetable
                        shouldKeepLogOrder = true;
                        break;
                    }
                }

                if (shouldKeepLogOrder) {
                    // Logs have extra subjects not in timetable - show BOTH timetable AND extra logged subjects
                    // First add all timetable periods with their log status
                    const seenCounts = {};
                    const addedCodes = new Set();

                    timetablePeriods.forEach(p => {
                        if (!p) {
                            periodsToShow.push({ code: null, name: 'Free', status: 'free' });
                            return;
                        }

                        seenCounts[p.code] = (seenCounts[p.code] || 0) + 1;
                        const instance = seenCounts[p.code];
                        const specificKey = `${p.code}_p${instance}`;
                        let status = dayLog[specificKey];

                        if (!status) {
                            status = dayLog[p.code];
                        }

                        periodsToShow.push({
                            code: p.code,
                            editKey: specificKey,
                            name: p.name,
                            status: status || 'Default'
                        });
                        addedCodes.add(p.code);
                    });

                    // Then add any logged subjects NOT in timetable (timetable changed)
                    loggedSubjectCodes.forEach(code => {
                        if (!addedCodes.has(code)) {
                            const subject = selectedClass?.subjects?.find(s => s.code === code);
                            periodsToShow.push({
                                code: code,
                                name: subject?.name || code,
                                status: dayLog[code]
                            });
                        }
                    });
                } else {
                    // Timetable matches - use timetable sequence
                    // Null periods = free periods
                    const seenCounts = {};

                    periodsToShow = timetablePeriods.map(p => {
                        if (!p) return { code: null, name: 'Free', status: 'free' };

                        // Track which instance of this subject this is (e.g. 1st Math, 2nd Math)
                        seenCounts[p.code] = (seenCounts[p.code] || 0) + 1;
                        const instance = seenCounts[p.code];

                        // Try specific key first (SUBJECT_p1), then legacy key (SUBJECT) for first instance
                        const specificKey = `${p.code}_p${instance}`;
                        let status = dayLog[specificKey];

                        if (!status) {
                            status = dayLog[p.code];
                        }

                        return {
                            code: p.code,
                            // Pass the SPECIFIC key (e.g. MATH_p1) as the code for editing
                            // This ensures we save to the unique slot, not the generic subject
                            editKey: specificKey,
                            name: p.name,
                            status: status || 'Default'
                        };
                    });
                }
            } else {
                // No log data - show timetable periods as "not logged"
                // Null periods = free periods
                const seenCounts = {};

                periodsToShow = timetablePeriods.map(p => {
                    if (!p) return { code: null, name: 'Free', status: 'free' };

                    seenCounts[p.code] = (seenCounts[p.code] || 0) + 1;
                    const instance = seenCounts[p.code];
                    const specificKey = `${p.code}_p${instance}`;

                    return {
                        code: p.code,
                        editKey: specificKey,
                        name: p.name,
                        status: 'Default'
                    };
                });
            }

            // Format date display with day name
            const dayName = date.toLocaleDateString('en-GB', { weekday: 'short' });
            const dateDisplay = date.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short'
            });

            modalHTML += `<div class="period-grid-row">
                            <div class="period-date-cell"><strong>${dayName}</strong> ${dateDisplay}</div>`;

            for (let p = 0; p < maxPeriods; p++) {
                if (isHoliday) {
                    modalHTML += `<div class="period-cell holiday" title="Holiday">-</div>`;
                } else if (p < periodsToShow.length) {
                    const period = periodsToShow[p];

                    // Handle null period (shouldn't happen but safety check)
                    if (!period) {
                        modalHTML += `<div class="period-cell free-period" title="Free Period">-</div>`;
                        continue;
                    }

                    const status = period.status;
                    const subjectColor = period.code ? subjectColors[period.code] : null;

                    // FREE PERIOD - render without click handler
                    if (status === 'free') {
                        modalHTML += `<div class="period-cell free-period" title="Free Period">-</div>`;
                        continue;
                    }

                    let cellClass = 'not-logged';
                    let symbol = '?';

                    // Map status to visual representation
                    if (!status || status === 'Default') {
                        cellClass = 'not-logged';
                        symbol = '?';
                    }
                    else if (status === 'Attended') { cellClass = 'present'; symbol = 'P'; }
                    else if (status === 'Skipped') { cellClass = 'absent'; symbol = 'A'; }
                    else if (status === 'Cancelled') { cellClass = 'cancelled'; symbol = 'C'; }
                    else if (status === 'Duty Leave (OD)') { cellClass = 'od'; symbol = 'OD'; }
                    else if (status === 'Medical Leave (ML)') { cellClass = 'ml'; symbol = 'ML'; }

                    // Glow effect using subject color
                    const glowColor = subjectColor ? subjectColor.glow : '#667eea';
                    const glowStyle = `box-shadow: 0 0 8px 2px ${glowColor}40, inset 0 0 0 2px ${glowColor};`;

                    // Use editKey if available (new logic), otherwise fallback to code
                    const codeToUse = period.editKey || period.code;
                    const safeName = period.name.replace(/'/g, "\\'");

                    modalHTML += `<div class="period-cell ${cellClass}" 
                                    style="${glowStyle}"
                                    data-date="${dateStr}" 
                                    data-code="${codeToUse}"
                                    data-period="${p}"
                                    title="${period.name} | ${status}"
                                    onclick="openPeriodEditPopup(event, '${dateStr}', '${codeToUse}', '${safeName}')">${symbol}</div>`;
                } else {
                    modalHTML += `<div class="period-cell no-class">-</div>`;
                }
            }
            modalHTML += `</div>`;
        });

        modalHTML += `</div></div></div></div>`;
    });

    modalHTML += `</div></div>`;

    document.getElementById('periodAttendanceModal').innerHTML = modalHTML;
    document.getElementById('periodAttendanceModal').classList.add('active');
}

// Toggle month collapse
function togglePeriodMonth(header) {
    header.closest('.period-month-section').classList.toggle('collapsed');
}

// Open edit popup for a period cell
function openPeriodEditPopup(event, dateStr, code, subjectName) {
    event.stopPropagation();

    // Remove existing popup
    const existingPopup = document.querySelector('.period-edit-popup');
    if (existingPopup) existingPopup.remove();

    const popup = document.createElement('div');
    popup.className = 'period-edit-popup';
    popup.innerHTML = `
                    <div style="font-weight: 600; margin-bottom: 8px; padding-bottom: 5px; border-bottom: 1px solid var(--border-color);">
                        ${subjectName}<br>
                        <small style="color: var(--medium-text);">${dateStr}</small>
                    </div>
                    <button style="background: #4CAF50; color: white;" onclick="updatePeriodStatus('${dateStr}', '${code}', 'Attended')">✓ Attended</button>
                    <button style="background: #f44336; color: white;" onclick="updatePeriodStatus('${dateStr}', '${code}', 'Skipped')">✗ Skipped</button>
                    <button style="background: #9e9e9e; color: white;" onclick="updatePeriodStatus('${dateStr}', '${code}', 'Cancelled')">⨯ Cancelled</button>
                    <button style="background: #2196F3; color: white;" onclick="updatePeriodStatus('${dateStr}', '${code}', 'Duty Leave (OD)')">📋 Duty Leave</button>
                    <button style="background: #FF9800; color: white;" onclick="updatePeriodStatus('${dateStr}', '${code}', 'Medical Leave (ML)')">🏥 Medical Leave</button>
                    <button style="background: var(--light-bg); color: var(--dark-text);" onclick="updatePeriodStatus('${dateStr}', '${code}', 'Default')">↺ Default</button>
                `;

    document.body.appendChild(popup);
    popup.style.display = 'block';

    // Position near click
    const rect = event.target.getBoundingClientRect();
    popup.style.left = Math.min(rect.left, window.innerWidth - 200) + 'px';
    popup.style.top = Math.min(rect.bottom + 5, window.innerHeight - 250) + 'px';

    // Close on outside click
    setTimeout(() => {
        document.addEventListener('click', closePeriodPopup, { once: true });
    }, 100);
}

function closePeriodPopup() {
    const popup = document.querySelector('.period-edit-popup');
    if (popup) popup.remove();
}

// Update attendance status for a period (synced with attendance history)
function updatePeriodStatus(dateStr, code, status) {
    closePeriodPopup();

    const logs = JSON.parse(localStorage.getItem('attendance_logs')) || {};

    if (!logs[dateStr]) {
        logs[dateStr] = {};
    }

    // Get all subjects scheduled for this day from selectedClass.subjects
    const date = new Date(dateStr);
    const dayOfWeek = date.getDay();
    const scheduleIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    // Get ALL subject codes that have classes on this day (not just from timetable arrangement)
    const allSubjectCodes = [];
    if (selectedClass?.subjects) {
        selectedClass.subjects.forEach(subject => {
            // Check if subject has any periods on this day
            if (subject.schedule && subject.schedule[scheduleIndex] > 0) {
                allSubjectCodes.push(subject.code);
            }
        });
    }

    // Fallback to timetable arrangement if no subjects found
    if (allSubjectCodes.length === 0) {
        const todaySubjects = getTimetableForDay(scheduleIndex);
        todaySubjects.forEach(s => {
            if (!allSubjectCodes.includes(s.code)) {
                allSubjectCodes.push(s.code);
            }
        });
    }

    const currentDayLog = logs[dateStr] || {};
    const currentSubjectStatus = currentDayLog[code];

    // Check if this subject is currently ML
    const isCurrentSubjectML = currentSubjectStatus === 'Medical Leave (ML)';

    // Check if any subject is ML
    const hasAnyML = allSubjectCodes.some(subCode =>
        currentDayLog[subCode] === 'Medical Leave (ML)'
    );

    // ML SYNC LOGIC: If setting ML, mark ALL subjects as ML
    if (status === 'Medical Leave (ML)') {
        allSubjectCodes.forEach(subCode => {
            logs[dateStr][subCode] = 'Medical Leave (ML)';
            // Clear specific period instances to ensure ML applies globally
            Object.keys(logs[dateStr]).forEach(key => {
                if (key.startsWith(`${subCode}_p`)) {
                    delete logs[dateStr][key];
                }
            });
        });
        localStorage.setItem('attendance_logs', JSON.stringify(logs));

        // FIX: Update timestamp to prevent sync from overwriting local edits
        const logTimestamps1 = JSON.parse(localStorage.getItem('attendance_log_timestamps') || '{}');
        logTimestamps1[dateStr] = new Date().toISOString();
        localStorage.setItem('attendance_log_timestamps', JSON.stringify(logTimestamps1));

        // Sync to cloud
        if (window.SyncManager) SyncManager.saveLog(dateStr, logs[dateStr]);

        alert("Medical Leave (ML) selected.\n\nAll subjects for this day have been marked as ML.");
        refreshPeriodAndHistoryViews();
        return;
    }

    // If changing FROM ML to something else - reset all and apply new status
    if (isCurrentSubjectML && status !== 'Medical Leave (ML)') {
        // Reset all subjects to Default (delete their entries)
        allSubjectCodes.forEach(subCode => {
            delete logs[dateStr][subCode];
        });

        // FIX: Apply the new status the user selected (not just reset)
        if (status !== 'Default') {
            if (!logs[dateStr]) logs[dateStr] = {};
            logs[dateStr][code] = status;
        }

        // Clean up empty date
        if (logs[dateStr] && Object.keys(logs[dateStr]).length === 0) {
            delete logs[dateStr];
        }

        localStorage.setItem('attendance_logs', JSON.stringify(logs));

        // Update timestamp to prevent sync from overwriting local edits
        const logTimestamps2 = JSON.parse(localStorage.getItem('attendance_log_timestamps') || '{}');
        logTimestamps2[dateStr] = new Date().toISOString();
        localStorage.setItem('attendance_log_timestamps', JSON.stringify(logTimestamps2));

        // Sync to cloud
        if (window.SyncManager) SyncManager.saveLog(dateStr, logs[dateStr] || {});

        // FIX: Show appropriate message based on new status
        if (status === 'Default') {
            alert("ML removed from this day.\n\nAll subjects have been reset to 'Not Logged'.");
        } else {
            showToast(`ML removed. ${code} marked as ${status}.`, 'success');
        }

        refreshPeriodAndHistoryViews();
        return;
    }

    // Check if OTHER subjects are still ML - prevent mixing
    const hasOtherML = allSubjectCodes.some(subCode =>
        subCode !== code && currentDayLog[subCode] === 'Medical Leave (ML)'
    );

    if (hasOtherML && status !== 'Default') {
        alert("Cannot mix 'Medical Leave (ML)' with other statuses.\n\nAll subjects for this day are on ML. To edit, first click any cell and change to 'Default' to reset the day.");
        return;
    }

    // Normal status update
    if (status === 'Default') {
        delete logs[dateStr][code];
        if (Object.keys(logs[dateStr]).length === 0) {
            delete logs[dateStr];
        }
    } else {
        logs[dateStr][code] = status;
    }

    localStorage.setItem('attendance_logs', JSON.stringify(logs));

    // FIX: Update timestamp to prevent sync from overwriting local edits
    const logTimestamps3 = JSON.parse(localStorage.getItem('attendance_log_timestamps') || '{}');
    logTimestamps3[dateStr] = new Date().toISOString();
    localStorage.setItem('attendance_log_timestamps', JSON.stringify(logTimestamps3));

    // Sync to cloud
    if (window.SyncManager) SyncManager.saveLog(dateStr, logs[dateStr] || {});

    // Refresh all views
    refreshPeriodAndHistoryViews();
}

// Helper function to refresh both period-wise and history views
function refreshPeriodAndHistoryViews() {
    // Refresh the period modal
    openPeriodAttendanceModal();

    // Also refresh portal dashboard if visible
    if (selectedClass?.portalSetup?.active) {
        calculateFromPortal();
    }

    // Refresh history modal if it's open (keep both views in sync)
    const historyModal = document.getElementById('historyLogModal');
    if (historyModal && historyModal.classList.contains('active')) {
        openHistoryEditor();
    }
}

// Update period view menu visibility based on portal mode
function updatePeriodViewMenuVisibility() {
    const menuItem = document.getElementById('periodViewMenuItem');
    if (menuItem) {
        if (selectedClass?.portalSetup?.active) {
            menuItem.style.display = 'block';
        } else {
            menuItem.style.display = 'none';
        }
    }
}

// ==================== END PERIOD-WISE ATTENDANCE VIEW ====================

function openHistoryEditor() {
    // Clean up any holiday logs before displaying
    cleanupHolidayLogs();

    const logs = JSON.parse(localStorage.getItem('attendance_logs')) || {};
    const sortedDates = Object.keys(logs).sort((a, b) => new Date(b) - new Date(a));
    const missingDates = getMissingLogDates();

    const modal = document.getElementById('historyLogModal');
    let html = `
                <div class="modal-content">
                    <button class="modal-close" onclick="closeModal('historyLogModal')">&times;</button>
                    <div class="modal-header"><h2>📜 Attendance History</h2><p>View and edit your past daily logs.</p></div>`;

    // Portal Status Section (only show if portal is active)
    if (selectedClass?.portalSetup?.active && selectedClass?.portalSetup?.semesterStartDate) {
        const statusColor = missingDates.length === 0 ? 'var(--success-grad-start)' : 'var(--warning-color)';
        const statusIcon = missingDates.length === 0 ? '✅' : '⚠️';

        html += `
                <div class="settings-section" style="border-left: 5px solid ${statusColor}; margin-bottom: 20px;">
                        <h3 style="margin-bottom: 10px;">${statusIcon} Portal Status</h3>
                        <p style="margin-bottom: 10px;">
                            <strong>Missing Logs:</strong> 
                            <span style="color: ${statusColor}; font-size: 1.2rem; font-weight: bold;">${missingDates.length}</span> 
                            ${missingDates.length === 1 ? 'date' : 'dates'}
                        </p>`;

        if (missingDates.length > 0) {
            html += `
                            <p style="color: var(--medium-text); font-size: 0.9rem; margin-bottom: 15px;" >
                            💡 <strong>Tip:</strong> Complete your logs from the semester start date to improve Medical Leave recommendations.
                        </p>
                            <div style="max-height: 150px; overflow-y: auto; background: var(--light-bg); padding: 10px; border-radius: 8px; margin-bottom: 15px;">
                                <strong style="display: block; margin-bottom: 8px;">Missing Dates:</strong>
                                <div style="display: flex; flex-wrap: wrap; gap: 8px;">`;

            // Show up to 10 most recent missing dates
            const recentMissing = missingDates.slice(-10).reverse();
            recentMissing.forEach(date => {
                html += `<button class="btn secondary-btn" onclick="addLogForDate('${date}')" style="padding: 5px 10px; font-size: 0.8rem;">${date}</button>`;
            });

            if (missingDates.length > 10) {
                html += `<span style="color: var(--medium-text); font-size: 0.85rem; align-self: center;">...and ${missingDates.length - 10} more</span>`;
            }

            html += `
                                </div>
                            </div>
                            <div style="margin-top: 15px;">
                                <p style="font-weight: 600; margin-bottom: 10px;">📦 Bulk Log</p>
                                <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                                    <input type="file" id="autoFillLogInput" accept="image/*" style="display:none;" onchange="handleLogScreenshot(this)">
                                    <button class="btn secondary-btn" onclick="document.getElementById('autoFillLogInput').click()" style="display: flex; align-items: center; gap: 8px;">
                                        <span style="font-size: 1.1rem;">📷</span> From Screenshot
                                    </button>
                                    <button class="btn primary-btn" onclick="openBulkLogJsonModal()" style="display: flex; align-items: center; gap: 8px;">
                                        <span style="font-size: 1.1rem;">📋</span> From JSON
                                    </button>
                                </div>
                                <span id="autoFillLogStatus" style="font-size: 0.85rem; color: var(--medium-text); display: block; margin-top: 8px;"></span>
                            </div>`;
        } else {
            html += `<p style="color: var(--success-grad-start); font-weight: bold;">🎉 All dates are logged! Great job!</p>`;
        }

        html += `</div>`;
    }

    html += `
                <div class="form-group">
                        <label>Jump to Date:</label>
                        <input type="date" id="historyDateFilter" onchange="filterHistoryDate(this.value)" 
                               min="${selectedClass.portalSetup?.semesterStartDate || ''}" 
                               max="${formatLocalDate(new Date())}">
                    </div>

                    <div id="historyListContainer" style="max-height: 400px; overflow-y: auto;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background: var(--light-bg); text-align: left;">
                                    <th style="padding: 10px; border-bottom: 2px solid var(--border-color);">Date</th>
                                    <th style="padding: 10px; border-bottom: 2px solid var(--border-color);">Status</th>
                                    <th style="padding: 10px; border-bottom: 2px solid var(--border-color);">Action</th>
                                </tr>
                            </thead>
                            <tbody id="historyTableBody">`;

    html += renderHistoryRows(sortedDates, logs);

    html += `</tbody>
                        </table>
                    </div>
                </div>`;

    modal.innerHTML = html;
    modal.classList.add('active');
}

function renderHistoryRows(dates, logs) {
    if (dates.length === 0) {
        return `<tr><td colspan="3" style="padding: 20px; text-align: center;">No logs found.</td></tr>`;
    }
    return dates.map(date => {
        const dayLog = logs[date];
        const summary = Object.entries(dayLog).map(([code, status]) => {
            // Shorten status for display
            let shortStatus = status;
            if (status === 'Medical Leave (ML)') shortStatus = 'ML';
            if (status === 'Duty Leave (OD)') shortStatus = 'OD';
            return `${code}: ${shortStatus} `;
        }).join(', ');

        return `
                            <tr id="history-row-${date}" style="border-bottom: 1px solid var(--border-color);" >
                        <td style="padding: 10px;">${date}</td>
                        <td style="padding: 10px; font-size: 0.9rem; color: var(--medium-text);">${summary.substring(0, 50)}${summary.length > 50 ? '...' : ''}</td>
                        <td style="padding: 10px;">
                            <button class="btn secondary-btn" style="padding: 5px 10px; font-size: 0.8rem;" onclick="editLogDate('${date}')">Edit</button>
                        </td>
                    </tr>`;
    }).join('');
}








// ==================== AUTO-FILL LOGS FROM SCREENSHOT ====================
async function handleLogScreenshot(input) {
    if (!input.files.length) return;

    const statusSpan = document.getElementById('autoFillLogStatus');
    statusSpan.textContent = '⏳ Analyzing screenshot...';

    try {
        const missingDates = getMissingLogDates();
        if (missingDates.length === 0) {
            statusSpan.textContent = '✅ No missing dates to fill!';
            input.value = '';
            return;
        }

        // Get API key - use personal key or fall back to backend proxy
        const personalKey = localStorage.getItem('personalGeminiKey');

        // Convert image to base64
        const file = input.files[0];
        const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        // Build prompt - clear instructions for portal screenshot analysis
        const prompt = `You are analyzing an ATTENDANCE SCREENSHOT from a college/university portal.

SCREENSHOT FORMAT:
- The table has ROWS = Different DATES
- COLUMNS = Period/Hour numbers (1, 2, 3, 4, 5, 6, 7, 8...)
- Each cell contains a STATUS CODE

STATUS CODES (may appear as):
- P or Present = Present
- A or Absent = Absent  
- ML = Medical Leave
- OD = On Duty / Duty Leave
- C = Cancelled / Holiday
- - (dash) or empty = Free period / No class

DATE FORMAT NOTE:
- Indian portals typically show dates as DD-MM-YYYY (e.g., "22-01-2025")
- YOU must output dates as YYYY-MM-DD format (e.g., "2025-01-22")

DATES I NEED (in YYYY-MM-DD): ${missingDates.join(', ')}

IMPORTANT: Only extract data for the dates I listed above. Ignore all other dates.

Return ONLY a JSON array in this EXACT format:
[
  {
    "date": "2025-01-22",
    "periods": ["P", "A", "-", "P", "P", "-", "-"]
  }
]

RULES:
1. "periods" array = status for each column LEFT TO RIGHT (Period 1, Period 2, etc.)
2. Use ONLY these values: "P", "A", "ML", "OD", "C", "-"
3. Convert DD-MM-YYYY dates to YYYY-MM-DD format
4. ONLY include dates from my list above
5. If you cannot read a date clearly, SKIP IT
6. Output ONLY valid JSON, no explanations`;

        let response;

        if (personalKey) {
            // Use personal API key directly
            response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${personalKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { text: prompt },
                                {
                                    inlineData: {
                                        data: base64.split(',')[1],
                                        mimeType: file.type
                                    }
                                }
                            ]
                        }]
                    })
                }
            );
        } else {
            // Use backend proxy for shared key
            console.log('📸 Autofill: Using backend proxy');
            response = await fetch('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'vision',
                    prompt: prompt,
                    imageData: base64.split(',')[1],
                    mimeType: file.type
                })
            });
        }

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const result = await response.json();
        let generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // Extract JSON
        if (generatedText.includes('```json')) {
            generatedText = generatedText.split('```json')[1].split('```')[0].trim();
        } else if (generatedText.includes('```')) {
            generatedText = generatedText.split('```')[1].split('```')[0].trim();
        }

        const logData = JSON.parse(generatedText);

        if (!Array.isArray(logData) || logData.length === 0) {
            statusSpan.textContent = '⚠️ No matching dates found in screenshot';
            input.value = '';
            return;
        }

        // Status normalization map
        const normalizeStatus = (status) => {
            if (!status || typeof status !== 'string') return null;
            const s = status.toUpperCase().trim();
            if (s === 'P' || s === 'C') return 'Attended';
            if (s === 'A') return 'Skipped';
            if (s === 'ML') return 'Medical Leave (ML)';
            if (s === 'OD') return 'Duty Leave (OD)';
            if (s === '-' || s === '') return null; // Free period - skip
            return null;
        };

        // Apply the logs by mapping period sequence to subjects using timetable
        const className = document.getElementById('classSelector')?.value;
        const arrangement = getTimetableArrangement(className) || {};
        const logs = JSON.parse(localStorage.getItem('attendance_logs')) || {};
        let filledCount = 0;
        let skippedDates = [];

        logData.forEach(entry => {
            if (!entry.date || !entry.periods || !Array.isArray(entry.periods)) return;

            // Only fill if date is actually missing
            if (!missingDates.includes(entry.date)) return;

            // Get day of week for this date
            const date = new Date(entry.date);
            const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, etc.
            const scheduleIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to 0=Mon, 6=Sun

            // Get timetable for this day
            const dayPeriods = arrangement[scheduleIndex] || [];

            if (dayPeriods.length === 0) {
                skippedDates.push(entry.date + ' (no timetable)');
                return;
            }

            const subjectsForDay = {};
            const periodCounts = {}; // Track period numbers per subject

            // Map each period status to its subject with period-based key
            entry.periods.forEach((periodStatus, periodIndex) => {
                if (periodIndex >= dayPeriods.length) return; // More periods than timetable has

                const subjectEntry = dayPeriods[periodIndex];
                const subjectCode = typeof subjectEntry === 'object' ? subjectEntry?.code : subjectEntry;

                if (!subjectCode || subjectCode === 'FREE' || subjectCode === null) return;

                const normalizedStatus = normalizeStatus(periodStatus);
                if (!normalizedStatus) return; // Skip free periods

                // Track period number for this subject
                periodCounts[subjectCode] = (periodCounts[subjectCode] || 0) + 1;
                const periodNum = periodCounts[subjectCode];

                // Save with period-based key (e.g., MATH_p1, MATH_p2)
                const periodKey = `${subjectCode}_p${periodNum}`;
                subjectsForDay[periodKey] = normalizedStatus;
            });

            if (Object.keys(subjectsForDay).length > 0) {
                logs[entry.date] = subjectsForDay;
                filledCount++;
            }
        });

        localStorage.setItem('attendance_logs', JSON.stringify(logs));

        // FIX: Update timestamps for all filled dates and sync
        const logTimestamps = JSON.parse(localStorage.getItem('attendance_log_timestamps') || '{}');
        validEntries.forEach(entry => {
            logTimestamps[entry.date] = new Date().toISOString();
        });
        localStorage.setItem('attendance_log_timestamps', JSON.stringify(logTimestamps));

        // Sync all filled dates
        if (window.SyncManager) {
            validEntries.forEach(entry => {
                SyncManager.saveLog(entry.date, logs[entry.date] || {});
            });
        }

        // Build status message
        let statusMsg = `✅ Auto-filled ${filledCount} day(s)!`;
        if (skippedDates.length > 0) {
            console.warn('Skipped dates:', skippedDates);
            statusMsg += ` (⚠️ Skipped ${skippedDates.length} date(s))`;
        }
        statusSpan.textContent = statusMsg;
        input.value = '';

        // Refresh the view
        setTimeout(() => {
            openHistoryEditor();
            if (selectedClass?.portalSetup?.active) {
                calculateFromPortal();
            }
        }, 500);

    } catch (error) {
        console.error('Auto-fill error:', error);
        statusSpan.textContent = `❌ Error: ${error.message}`;
        input.value = '';
    }
}
window.handleLogScreenshot = handleLogScreenshot;

// ==================== BULK LOG FROM JSON ====================
function openBulkLogJsonModal() {
    const missingDates = getMissingLogDates();
    if (missingDates.length === 0) {
        showToast('✅ No missing dates to fill!', 'success');
        return;
    }

    const subjectCodes = selectedClass?.subjects?.map(s => s.code).join(', ') || 'No subjects';

    // Get number of periods per day from timetable
    const className = document.getElementById('classSelector')?.value;
    const arrangement = getTimetableArrangement(className) || {};
    let maxPeriods = 6;
    Object.values(arrangement).forEach(periods => {
        if (periods && periods.length > maxPeriods) maxPeriods = periods.length;
    });

    const prompt = `You are analyzing an ATTENDANCE SCREENSHOT from a college/university portal.

SCREENSHOT FORMAT:
- The table has ROWS = Different DATES  
- COLUMNS = Period/Hour numbers (1, 2, 3, 4, 5, 6, 7, 8...)
- Each cell contains a STATUS CODE

STATUS CODES (may appear as):
- P or Present = Present
- A or Absent = Absent
- ML = Medical Leave
- OD = On Duty / Duty Leave
- C = Cancelled / Holiday
- - (dash) or empty = Free period / No class

DATE FORMAT NOTE:
- Indian portals typically show dates as DD-MM-YYYY (e.g., "22-01-2025")
- YOU must output dates as YYYY-MM-DD format (e.g., "2025-01-22")

DATES I NEED (in YYYY-MM-DD): ${missingDates.join(', ')}

IMPORTANT: Only extract data for the dates I listed above. Ignore all other dates.

Return ONLY a JSON array in this EXACT format:
[
  {
    "date": "2025-01-22",
    "periods": ["P", "A", "-", "P", "P", "-", "-"]
  }
]

RULES:
1. "periods" array = status for each column LEFT TO RIGHT (Period 1, Period 2, etc.)
2. Use ONLY these values: "P", "A", "ML", "OD", "C", "-"
3. Convert DD-MM-YYYY dates to YYYY-MM-DD format
4. ONLY include dates from my list above
5. If you cannot read a date clearly, SKIP IT
6. Output ONLY valid JSON, no explanations`;

    const modalHTML = `
                <div class="modal-content" style="max-width: 600px;">
                    <button class="modal-close" onclick="closeModal('bulkLogJsonModal')">&times;</button>
                    <div class="modal-header">
                        <h2>📋 Bulk Log from JSON</h2>
                        <p>Use AI (ChatGPT, Gemini, etc.) to extract attendance from your screenshots.</p>
                    </div>

                    <div class="settings-section" style="margin-bottom: 15px;">
                        <h3>Step 1: Copy the Prompt</h3>
                        <p style="color: var(--medium-text); font-size: 0.9rem; margin-bottom: 10px;">
                            Copy this prompt and paste it along with your attendance screenshot to any AI chatbot.
                        </p>
                        <textarea id="bulkLogPromptText" readonly style="width: 100%; height: 120px; font-size: 0.85rem; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--light-bg); resize: none;">${prompt.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                        <button class="btn success-btn" onclick="copyBulkLogPrompt()" style="margin-top: 10px;">
                            📋 Copy Prompt
                        </button>
                    </div>

                    <div class="settings-section">
                        <h3>Step 2: Paste AI Response</h3>
                        <p style="color: var(--medium-text); font-size: 0.9rem; margin-bottom: 10px;">
                            Paste the JSON response from the AI here.
                        </p>
                        <textarea id="bulkLogJsonInput" placeholder='Paste JSON here...
[
  {"date": "2026-01-20", "periods": ["P", "A", "-", "P", "P", "-"]}
]' style="width: 100%; height: 150px; font-size: 0.85rem; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); resize: none;"></textarea>
                        <button class="btn primary-btn" onclick="applyBulkLogJson()" style="margin-top: 10px; width: 100%;">
                            ✅ Apply Logs
                        </button>
                    </div>
                </div>`;

    // Create or update modal
    let modal = document.getElementById('bulkLogJsonModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'bulkLogJsonModal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }
    modal.innerHTML = modalHTML;
    modal.classList.add('active');
}
window.openBulkLogJsonModal = openBulkLogJsonModal;

function copyBulkLogPrompt() {
    const textarea = document.getElementById('bulkLogPromptText');
    navigator.clipboard.writeText(textarea.value).then(() => {
        showToast('✅ Prompt copied to clipboard!', 'success');
    }).catch(() => {
        textarea.select();
        document.execCommand('copy');
        showToast('✅ Prompt copied!', 'success');
    });
}
window.copyBulkLogPrompt = copyBulkLogPrompt;

function applyBulkLogJson() {
    const jsonInput = document.getElementById('bulkLogJsonInput').value.trim();

    if (!jsonInput) {
        showToast('❌ Please paste the JSON first', 'error');
        return;
    }

    try {
        // Extract JSON from possible code blocks
        let jsonText = jsonInput;
        if (jsonText.includes('```json')) {
            jsonText = jsonText.split('```json')[1].split('```')[0].trim();
        } else if (jsonText.includes('```')) {
            jsonText = jsonText.split('```')[1].split('```')[0].trim();
        }

        const logData = JSON.parse(jsonText);

        if (!Array.isArray(logData) || logData.length === 0) {
            showToast('❌ Invalid JSON format. Expected an array.', 'error');
            return;
        }

        // Get timetable arrangement for period-to-subject mapping
        const className = document.getElementById('classSelector')?.value;
        const arrangement = getTimetableArrangement(className) || {};

        // Status normalization map (same as screenshot approach)
        const normalizeStatus = (status) => {
            if (!status || typeof status !== 'string') return null;
            const s = status.toUpperCase().trim();
            if (s === 'P' || s === 'C') return 'Attended';
            if (s === 'A') return 'Skipped';
            if (s === 'ML') return 'Medical Leave (ML)';
            if (s === 'OD') return 'Duty Leave (OD)';
            if (s === '-' || s === '') return null; // Free period - skip
            return null;
        };

        const logs = JSON.parse(localStorage.getItem('attendance_logs')) || {};
        const missingDates = getMissingLogDates();
        let filledCount = 0;
        let skippedDates = [];

        logData.forEach(entry => {
            if (!entry.date || !entry.periods || !Array.isArray(entry.periods)) return;

            // Only fill if date is actually missing
            if (!missingDates.includes(entry.date)) {
                console.warn(`Skipping ${entry.date} - not in missing dates`);
                return;
            }

            // Get day of week for this date
            const date = new Date(entry.date);
            const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, etc.
            const scheduleIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to 0=Mon, 6=Sun

            // Get timetable for this day
            const dayPeriods = arrangement[scheduleIndex] || [];

            if (dayPeriods.length === 0) {
                skippedDates.push(entry.date + ' (no timetable)');
                return;
            }

            const subjectsForDay = {};
            const periodCounts = {}; // Track period numbers per subject

            // Map each period status to its subject with period-based key
            entry.periods.forEach((periodStatus, periodIndex) => {
                if (periodIndex >= dayPeriods.length) return;

                const subjectEntry = dayPeriods[periodIndex];
                const subjectCode = typeof subjectEntry === 'object' ? subjectEntry?.code : subjectEntry;

                if (!subjectCode || subjectCode === 'FREE' || subjectCode === null) return;

                const normalizedStatus = normalizeStatus(periodStatus);
                if (!normalizedStatus) return;

                // Track period number for this subject
                periodCounts[subjectCode] = (periodCounts[subjectCode] || 0) + 1;
                const periodNum = periodCounts[subjectCode];

                // Save with period-based key (e.g., MATH_p1, MATH_p2)
                const periodKey = `${subjectCode}_p${periodNum}`;
                subjectsForDay[periodKey] = normalizedStatus;
            });

            if (Object.keys(subjectsForDay).length > 0) {
                logs[entry.date] = subjectsForDay;
                filledCount++;
            }
        });

        localStorage.setItem('attendance_logs', JSON.stringify(logs));

        // FIX: Update timestamps for all imported dates and sync
        const logTimestamps = JSON.parse(localStorage.getItem('attendance_log_timestamps') || '{}');
        validEntries.forEach(entry => {
            logTimestamps[entry.date] = new Date().toISOString();
        });
        localStorage.setItem('attendance_log_timestamps', JSON.stringify(logTimestamps));

        // Sync all imported dates
        if (window.SyncManager) {
            validEntries.forEach(entry => {
                SyncManager.saveLog(entry.date, logs[entry.date] || {});
            });
        }

        closeModal('bulkLogJsonModal');

        let msg = `✅ Applied ${filledCount} day(s) of logs!`;
        if (skippedDates.length > 0) {
            msg += ` (⚠️ Skipped ${skippedDates.length})`;
            console.warn('Skipped dates:', skippedDates);
        }
        showToast(msg, 'success');

        // Refresh views
        setTimeout(() => {
            openHistoryEditor();
            if (selectedClass?.portalSetup?.active) {
                calculateFromPortal();
            }
        }, 300);

    } catch (error) {
        console.error('JSON parse error:', error);
        showToast(`❌ JSON Error: ${error.message}`, 'error');
    }
}
window.applyBulkLogJson = applyBulkLogJson;
// ==================== END BULK LOG FROM JSON ====================
