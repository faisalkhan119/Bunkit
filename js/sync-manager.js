// Sync Manager - Handles Data Synchronization
// Strategy: Last Write Wins (Time-based)

const SyncManager = {
    pendingUploads: false,
    syncing: false,

    syncPromise: null,

    async syncOnLogin(wasGuest = false) {
        if (this.syncPromise) return this.syncPromise;

        this.syncPromise = (async () => {
            this.syncing = true;
            this.updateSyncStatus('Syncing...');

            try {
                // 1. Download Cloud Data
                const { data: cloudClasses, error: classError } = await supabaseClient.from('classes').select('*');
                const { data: cloudLogs, error: logError } = await supabaseClient.from('attendance_logs').select('*');
                const { data: cloudSettings, error: setError } = await supabaseClient.from('user_settings').select('*').single();

                if (classError || logError) throw new Error("Fetch failed");

                // 2. Load Local Data
                const localClasses = JSON.parse(localStorage.getItem('attendanceClasses_v2') || '{}');
                const localLogs = JSON.parse(localStorage.getItem('attendance_logs') || '{}');

                // 3. ID-BASED MERGE STRATEGY (Last Write Wins)
                const finalClasses = {};
                const localProcessedIds = new Set();
                const renames = {}; // Map<OldName, NewName> for log migration

                // Step 3a: Process Cloud Classes
                cloudClasses.forEach(row => {
                    const cloudData = row.data;
                    const cloudId = cloudData.id;
                    const cloudName = row.name;

                    // Restore side-loaded items for cloud class
                    if (cloudData.timetableArrangement) localStorage.setItem(`timetable_arrangement_${cloudName}`, JSON.stringify(cloudData.timetableArrangement));
                    if (cloudData.periodTimes) localStorage.setItem(`periodTimes_${cloudName}`, JSON.stringify(cloudData.periodTimes));

                    // Find matching local class by ID
                    let matchingLocalName = null;
                    let localData = null;

                    for (const [lName, lData] of Object.entries(localClasses)) {
                        if (lData.id === cloudId) {
                            matchingLocalName = lName;
                            localData = lData;
                            break;
                        }
                    }

                    // 2. If No ID match, Try Match by NAME (Merge-by-Name Strategy)
                    if (!localData && localClasses[cloudName]) {
                        // Double check it hasn't been matched by ID to another class
                        let alreadyMatched = false;
                        for (const processedId of localProcessedIds) {
                            if (localClasses[cloudName].id === processedId) alreadyMatched = true;
                        }

                        if (!alreadyMatched) {
                            console.log(`🔗 Linking Local "${cloudName}" to Cloud Class (Name Match)`);
                            matchingLocalName = cloudName;
                            localData = localClasses[cloudName];
                            localData.id = cloudId; // ADOPT CLOUD ID
                        }
                    }

                    if (localData) {
                        localProcessedIds.add(cloudId);

                        // Content-Based Deduplication (Check if basically identical)
                        const cloudHash = JSON.stringify({ s: cloudData.subjects, h: cloudData.holidays, sd: cloudData.startDate });
                        const localHash = JSON.stringify({ s: localData.subjects, h: localData.holidays, sd: localData.startDate });

                        // Compare Timestamps (Default to Cloud if missing)
                        const cloudTime = cloudData.updatedAt || 0;
                        const localTime = localData.updatedAt || 0;

                        if (localTime > cloudTime && cloudHash !== localHash) {
                            // Local is newer AND different -> Keep Local (and mark for upload)
                            console.log(`🏠 Local version newer for "${cloudName}". Keeping Local.`);
                            finalClasses[matchingLocalName] = localData; // Keep local name/data
                            this.pendingUploads = true;
                        } else {
                            // Cloud is newer OR identical -> Keep Cloud
                            if (cloudHash !== localHash) console.log(`☁️ Cloud version newer for "${cloudName}". Overwriting Local.`);
                            else console.log(`✨ Content identical for "${cloudName}". updates synced.`);

                            finalClasses[cloudName] = cloudData;

                            // If name changed in cloud, we might need to handle that, but for now assume cloud name wins
                            if (matchingLocalName !== cloudName) {
                                renames[matchingLocalName] = cloudName;
                            }
                        }
                    } else {
                        // New from Cloud
                        finalClasses[cloudName] = cloudData;
                    }
                });

                // Step 3b: Process Remaining Local Classes (No ID match in Cloud)
                for (const [lName, lData] of Object.entries(localClasses)) {
                    if (lData.id && localProcessedIds.has(lData.id)) continue; // Already processed

                    // Content Check against existing final classes to prevent "Name (Local)" duplicates of same functionality
                    // (e.g. User logged out, then logged in, local became anonymous but is same as cloud)
                    let isDuplicateContent = false;
                    for (const [fName, fData] of Object.entries(finalClasses)) {
                        // aggressive DEDUPLICATION: Normalize hash (handle null/undefined/empty arrays similarly)
                        const normalize = (d) => JSON.stringify({
                            s: d.subjects || [],
                            h: d.holidays || [],
                            sd: d.startDate || ""
                        });

                        if (normalize(fData) === normalize(lData)) {
                            console.log(`🧹 Content Identical: Merging "${lName}" into "${fName}"`);
                            isDuplicateContent = true;
                            if (lName !== fName) renames[lName] = fName; // Map logs
                            break;
                        }
                    }
                    if (isDuplicateContent) continue; // Skip adding this local duplicate

                    // 2. Fuzzy Name Match (e.g. "Class (Local)" vs "Class")
                    // If content is slightly different but name suggests it's a copy
                    const baseName = lName.replace(/ \(Local\)+$/, '').replace(/ \(Example\)+$/, '');
                    if (finalClasses[baseName]) {
                        console.log(`✨ Fuzzy Match: "${lName}" looks like a copy of "${baseName}". Merging...`);

                        // Merge Strategy: Keep Cloud (baseName) but try to save any extra subjects?
                        // For now, STRICT MERGE as requested: Cloud/Base wins.
                        // But we MUST merge logs.
                        renames[lName] = baseName;

                        // Also, check timestamps
                        const fData = finalClasses[baseName];
                        if ((lData.updatedAt || 0) > (fData.updatedAt || 0)) {
                            console.log(`   -> Local is newer, adopting local basics.`);
                            fData.subjects = lData.subjects;
                            fData.startDate = lData.startDate;
                            fData.holidays = lData.holidays;
                            finalClasses[baseName] = fData;
                            this.pendingUploads = true;
                        }

                        continue; // Skip adding the duplicate file
                    }
                    if (fHash === lHash) {
                        console.log(`🧹 Creating clean merge for "${lName}" -> Merged with "${fName}" (Content Identical)`);
                        isDuplicateContent = true;
                        break;
                    }
                }
                if (isDuplicateContent) continue; // Skip adding this local duplicate

                // Check for Name Collision in Final Set
                // Check for Name Collision in Final Set
                if (finalClasses[lName]) {
                    // USER REQUEST: STRICT MERGE (No Duplicates)
                    console.log(`⚠️ STRICT MERGE: Name Collision for "${lName}". Merging...`);

                    const fData = finalClasses[lName];
                    const lTime = new Date(lData.updatedAt || 0).getTime();
                    const fTime = new Date(fData.updatedAt || 0).getTime();

                    if (lTime > fTime) {
                        console.log(`🏠 Local "${lName}" is newer (${lTime} > ${fTime}). Overwriting cloud entry locally.`);
                        lData.id = fData.id; // Keep Cloud ID (Critical for Sync)
                        finalClasses[lName] = lData;
                        this.pendingUploads = true;
                    } else {
                        console.log(`☁️ Cloud "${lName}" is newer/same. Local changes discarded.`);
                    }
                } else {
                    // No Collision -> Safe to add
                    finalClasses[lName] = lData;
                    this.pendingUploads = true; // New local data needs upload
                }
            }

                // Step 3c: Commit Classes
                localStorage.setItem('attendanceClasses_v2', JSON.stringify(finalClasses));
            window.classes = finalClasses;

            // Step 4: Merge Logs & Migrate Renamed Logs
            const finalLogs = { ...localLogs };

            // Apply Renames to Local Logs FIRST
            Object.keys(renames).forEach(oldName => {
                const newName = renames[oldName];
                for (const date in finalLogs) {
                    const dayLogs = finalLogs[date];
                    if (!dayLogs) continue;

                    // Iterate keys in the day log
                    Object.keys(dayLogs).forEach(key => {
                        // Check for Namespaced Keys: "OldName_Subject"
                        if (key.startsWith(`${oldName}_`)) {
                            const suffix = key.substring(oldName.length + 1);
                            const newKey = `${newName}_${suffix}`;
                            dayLogs[newKey] = dayLogs[key];
                            delete dayLogs[key];
                        }
                        // Legacy: We assume legacy logs might be lost or we don't touch them 
                        // because we can't be sure which class they belong to if unspaced.
                        // But given the "Smart Rename" happens on login, we assume current logs are fresh.
                    });
                }
            });

            // Merge Cloud Logs (Blind merge for now, or could use timestamps if we had them per log entry)
            cloudLogs.forEach(row => {
                if (!finalLogs[row.date]) finalLogs[row.date] = {};
                Object.assign(finalLogs[row.date], row.logs);
            });

            localStorage.setItem('attendance_logs', JSON.stringify(finalLogs));
            window.attendanceLogs = finalLogs;

            // Step 5: Settings (Cloud Wins mostly)
            if (cloudSettings) {
                if (cloudSettings.theme) localStorage.setItem('theme', cloudSettings.theme);
                if (cloudSettings.preferences) {
                    const prefs = cloudSettings.preferences;
                    if (prefs.lastOpenedClass) localStorage.setItem('lastOpenedClass', prefs.lastOpenedClass);
                    if (prefs.userProfileName) localStorage.setItem('userProfileName', prefs.userProfileName); // Restore Name
                    // Restore others...
                    if (prefs.minAttendance) localStorage.setItem('calcSettings_minAttendance', prefs.minAttendance);
                }
            }

            console.log('✅ ID-Based Sync Complete');

            // If we have pending uploads (New Local data or conflicts), upload now
            if (this.pendingUploads) {
                console.log('📤 Uploading synced data...');
                await this.uploadAll();
                this.pendingUploads = false;
            }

            this.updateSyncStatus('Synced');

            // Reload App UI
            if (window.loadFromStorage) window.loadFromStorage();
            if (window.populateClassSelector) window.populateClassSelector();

            // Refresh specific UI parts
            this.refreshCalculationSettingsUI();
            this.subscribeToChanges(); // Subscribe to real-time

            return { success: true, count: Object.keys(finalClasses).length };

        } catch (e) {
            console.error('Sync failed:', e);
            this.updateSyncStatus('Sync Error');
            return { success: false, error: e.message || "Unknown Error" };
        } finally {
            this.syncing = false;
            this.syncPromise = null;
        }
    })();

return this.syncPromise;
    },

    async uploadAll() {
    if (!AuthManager.user) return;
    this.updateSyncStatus('Uploading...');

    const localClasses = JSON.parse(localStorage.getItem('attendanceClasses_v2') || '{}');
    const theme = localStorage.getItem('theme') || 'light';
    const lastOpenedClass = localStorage.getItem('lastOpenedClass');
    const userProfileName = localStorage.getItem('userProfileName');

    // Gather Notifications
    const notifications = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('notificationSettings_')) {
            notifications[key] = JSON.parse(localStorage.getItem(key));
        }
    }

    try {
        const user_id = AuthManager.user.id;

        // 1. Upsert Classes
        for (const [name, data] of Object.entries(localClasses)) {
            // Enrich data with side-loaded localStorage items
            const arrangement = localStorage.getItem(`timetable_arrangement_${name}`);
            if (arrangement) data.timetableArrangement = JSON.parse(arrangement);

            const pTimes = localStorage.getItem(`periodTimes_${name}`);
            if (pTimes) data.periodTimes = JSON.parse(pTimes);

            await supabaseClient.from('classes').upsert({
                user_id,
                name,
                data,
                updated_at: new Date()
            }, { onConflict: 'user_id, name' });
        }

        // 2. Upsert Settings
        await supabaseClient.from('user_settings').upsert({
            user_id,
            theme,
            preferences: {
                lastOpenedClass,
                userProfileName,
                notifications,
                // FIXED: Use correct localStorage keys matching index.html
                minAttendance: localStorage.getItem('calcSettings_minAttendance'),
                minMedical: localStorage.getItem('calcSettings_minMedical'),
                isOverall: localStorage.getItem('calcSettings_isOverall'),
                personalGeminiKey: localStorage.getItem('personalGeminiKey') // Encrypted if possible in future
            },
            updated_at: new Date()
        });

        // 3. Upsert Logs (CRITICAL MISSING STEP ADDED)
        const localLogs = JSON.parse(localStorage.getItem('attendance_logs') || '{}');
        for (const [date, logs] of Object.entries(localLogs)) {
            await supabaseClient.from('attendance_logs').upsert({
                user_id,
                date,
                logs,
                updated_at: new Date()
            }, { onConflict: 'user_id, date' });
        }

        this.updateSyncStatus('Synced');
    } catch (e) {
        console.error('Upload failed:', e);
        this.updateSyncStatus('Offline');
        this.pendingUploads = true;
    }
},

    async forceResync() {
    if (!confirm("Force Global Sync?\n\nThis will re-upload ALL your local data to the cloud, ensuring everything is saved.\n\nContinue?")) return;
    this.syncing = false; // Reset lock
    await this.uploadAll();
    alert("✅ Forced Sync Complete!\nYour local data is now on the cloud.");
    window.location.reload();
},

    async saveClass(name, data) {
    if (!AuthManager.user) return;
    this.updateSyncStatus('Saving...');
    try {
        await supabaseClient.from('classes').upsert({
            user_id: AuthManager.user.id,
            name,
            data,
            updated_at: new Date()
        }, { onConflict: 'user_id, name' }); // Name must be unique per user
        this.updateSyncStatus('Saved');
    } catch (e) {
        console.error(e);
        this.updateSyncStatus('Offline (Saved Locally)');
    }
},

    async saveLog(date, logs) {
    if (!AuthManager.user) return;
    this.updateSyncStatus('Saving...');
    try {
        await supabaseClient.from('attendance_logs').upsert({
            user_id: AuthManager.user.id,
            date,
            logs,
            updated_at: new Date()
        }, { onConflict: 'user_id, date' });
        this.updateSyncStatus('Saved');
    } catch (e) {
        console.error(e);
        this.updateSyncStatus('Offline (Saved Locally)');
    }
},

    async saveSettings() {
    if (!AuthManager.user) return;
    this.updateSyncStatus('Saving settings...');

    const theme = localStorage.getItem('theme') || 'light';
    const lastOpenedClass = localStorage.getItem('lastOpenedClass');
    const userProfileName = localStorage.getItem('userProfileName');

    // Gather Notifications
    const notifications = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('notificationSettings_')) {
            notifications[key] = JSON.parse(localStorage.getItem(key));
        }
    }

    try {
        await supabaseClient.from('user_settings').upsert({
            user_id: AuthManager.user.id,
            theme,
            preferences: {
                lastOpenedClass,
                userProfileName,
                notifications,
                minAttendance: localStorage.getItem('calcSettings_minAttendance'),
                minMedical: localStorage.getItem('calcSettings_minMedical'),
                isOverall: localStorage.getItem('calcSettings_isOverall'),
                personalGeminiKey: localStorage.getItem('personalGeminiKey')
            },
            updated_at: new Date()
        });
        this.updateSyncStatus('Saved');
    } catch (e) {
        console.error('Settings save failed:', e);
        this.updateSyncStatus('Offline (Saved Locally)');
    }
},

    async deleteClass(name) {
    if (!AuthManager.user) return;
    this.updateSyncStatus('Deleting...');
    try {
        await supabaseClient.from('classes').delete()
            .eq('user_id', AuthManager.user.id)
            .eq('name', name);

        // Also clean up logs for this class? 
        // The logs are stored by date { "CLASS_NAME": "Status" }. 
        // It's hard to clean up logs efficiently without a dedicated structure.
        // For now, we leave logs as they are (orphaned).

        // CLEANUP GHOST NOTIFICATIONS
        // Notification settings are stored as 'notificationSettings_CLASSNAME'
        const notifKey = `notificationSettings_${name}`;
        if (localStorage.getItem(notifKey)) {
            localStorage.removeItem(notifKey);
            // Also update Cloud Settings immediately to sync deletion
            await this.saveSettings();
        }

        this.updateSyncStatus('Deleted');
    } catch (e) {
        console.error('Delete failed:', e);
        this.updateSyncStatus('Error deleting');
    }
},

    async subscribeToChanges() {
    if (!AuthManager.user) return;

    console.log("🔌 Subscribing to Realtime changes...");
    const channel = supabaseClient.channel('realtime_sync')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'classes', filter: `user_id=eq.${AuthManager.user.id}` },
            (payload) => {
                console.log('Class Change:', payload);
                this.handleClassChange(payload);
            }
        )
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'attendance_logs', filter: `user_id=eq.${AuthManager.user.id}` },
            (payload) => {
                console.log('Log Change:', payload);
                this.handleLogChange(payload);
            }
        )
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'user_settings', filter: `user_id=eq.${AuthManager.user.id}` },
            (payload) => {
                console.log('Settings Change:', payload);
                this.handleSettingsChange(payload);
            }
        )
        .subscribe();
},

handleClassChange(payload) {
    const { eventType, new: newRow, old: oldRow } = payload;
    const localClasses = JSON.parse(localStorage.getItem('attendanceClasses_v2') || '{}');

    if (eventType === 'INSERT' || eventType === 'UPDATE') {
        localClasses[newRow.name] = newRow.data;
        // Restore side-loaded
        if (newRow.data.timetableArrangement) {
            localStorage.setItem(`timetable_arrangement_${newRow.name}`, JSON.stringify(newRow.data.timetableArrangement));
        }
        if (newRow.data.periodTimes) {
            localStorage.setItem(`periodTimes_${newRow.name}`, JSON.stringify(newRow.data.periodTimes));
        }
    } else if (eventType === 'DELETE') {
        delete localClasses[oldRow.name];
    }

    localStorage.setItem('attendanceClasses_v2', JSON.stringify(localClasses));
    if (window.loadFromStorage) window.loadFromStorage();
},

handleLogChange(payload) {
    const { eventType, new: newRow } = payload;
    if (eventType === 'INSERT' || eventType === 'UPDATE') {
        const localLogs = JSON.parse(localStorage.getItem('attendance_logs') || '{}');
        // payload.new.date, payload.new.logs
        if (!localLogs[newRow.date]) localLogs[newRow.date] = {};
        Object.assign(localLogs[newRow.date], newRow.logs);
        localStorage.setItem('attendance_logs', JSON.stringify(localLogs));
        if (window.loadFromStorage) window.loadFromStorage();
    }
},

handleSettingsChange(payload) {
    const { eventType, new: newRow } = payload;
    if (eventType === 'INSERT' || eventType === 'UPDATE') {
        if (newRow.theme) {
            localStorage.setItem('theme', newRow.theme);
            if (newRow.theme === 'dark') document.body.classList.add('dark-mode');
            else document.body.classList.remove('dark-mode');
        }
        // For simplicity, we just reload heavily dependent settings or partial update
        if (newRow.preferences) {
            // Partial update logic matching syncOnLogin...
        }
    }
},

// Refresh Calculation Settings UI from localStorage values
refreshCalculationSettingsUI() {
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

    // Update medical max constraint
    if (window.updateMedicalMax) window.updateMedicalMax();

    console.log('🔄 Calculation Settings UI refreshed from localStorage');
},

updateSyncStatus(msg) {
    const el = document.getElementById('sidebarSyncStatus');
    if (el) el.textContent = `☁️ ${msg}`;
}
};

window.SyncManager = SyncManager;
