// Community Manager - Mass Bunk Polls & Eligibility
// Strategy: Strict Gate - All users must be eligible & up-to-date

const CommunityManager = {
    currentClassId: null,
    members: [],
    polls: [],
    isEligible: false,
    isClassReady: false,

    // ===================== HELPERS =====================
    getMyName() {
        // Try multiple sources for user's name
        const userName = localStorage.getItem('userName');
        if (userName) return userName;
        const meta = AuthManager.user?.user_metadata;
        if (meta?.full_name) return meta.full_name;
        if (meta?.name) return meta.name;
        if (AuthManager.user?.email) return AuthManager.user.email.split('@')[0];
        return 'Me';
    },

    getClassData() {
        const className = document.getElementById('classSelector')?.value;
        if (!className || !window.classes) return null;
        return { name: className, data: window.classes[className] };
    },

    // Calculate attendance from class data directly (not from DOM)
    calculateAttendanceFromClass(classData) {
        if (!classData || !classData.subjects) return { total: 0, attended: 0, percentage: 0 };

        let total = 0, attended = 0;

        // Subjects array uses "present" field (not "attended")
        if (Array.isArray(classData.subjects)) {
            classData.subjects.forEach(sub => {
                total += (sub.total || 0);
                attended += (sub.present || 0);  // KEY: field is "present" not "attended"
            });
        }

        // Also add portal baseline if exists
        if (classData.portalSetup && classData.portalSetup.active && classData.portalSetup.baseline) {
            const baseline = classData.portalSetup.baseline;
            Object.values(baseline).forEach(b => {
                total += (b.total || 0);
                attended += (b.attended || 0);  // baseline uses "attended"
            });
        }

        const percentage = total === 0 ? 0 : (attended / total * 100);
        console.log(`📊 Attendance calc: ${attended}/${total} = ${percentage.toFixed(1)}%`);
        return { total, attended, percentage };
    },

    // ===================== OPEN MODAL =====================
    async openCommunityModal() {
        console.log("🗳️ Open Community Modal");

        const loading = document.getElementById('communityLoading');
        const content = document.getElementById('communityContent');
        const alertBox = document.getElementById('communityAlert');
        const classNameDisplay = document.getElementById('communityClassName');

        // Set loading state
        if (loading) loading.style.display = 'block';
        if (content) content.style.display = 'none';

        // Guard: Not logged in
        if (!window.AuthManager || !AuthManager.user) {
            loading.style.display = 'none';
            content.style.display = 'block';
            document.getElementById('communityStatusList').innerHTML = '';
            alertBox.className = 'alert-box warning';
            alertBox.innerHTML = `
                <div style="text-align:center; padding: 10px;">
                    <div style="font-size: 2rem; margin-bottom: 10px;">🔐</div>
                    <strong>Sign In Required</strong>
                    <p style="margin-top:8px; font-size:0.9rem; opacity:0.8;">Community features require a signed-in account. Please sign in first.</p>
                </div>`;
            classNameDisplay.textContent = 'Community';
            document.getElementById('pollsSection').style.display = 'none';
            return;
        }

        // Guard: No class selected
        const classInfo = this.getClassData();
        if (!classInfo || !classInfo.data) {
            loading.style.display = 'none';
            content.style.display = 'block';
            document.getElementById('communityStatusList').innerHTML = '';
            alertBox.className = 'alert-box warning';
            alertBox.innerHTML = `
                <div style="text-align:center; padding: 10px;">
                    <div style="font-size: 2rem; margin-bottom: 10px;">📚</div>
                    <strong>No Class Selected</strong>
                    <p style="margin-top:8px; font-size:0.9rem; opacity:0.8;">Please select a class from the main screen first.</p>
                </div>`;
            classNameDisplay.textContent = 'Community';
            document.getElementById('pollsSection').style.display = 'none';
            return;
        }

        this.currentClassId = classInfo.name;
        classNameDisplay.textContent = classInfo.name;

        try {
            await this.publishStatus(classInfo.data);
            await this.checkClassEligibility();
            this.renderDashboard();
        } catch (e) {
            console.error("❌ Community init error:", e);
            loading.style.display = 'none';
            content.style.display = 'block';
            alertBox.className = 'alert-box danger';
            alertBox.innerHTML = `
                <div style="text-align:center; padding: 10px;">
                    <div style="font-size: 2rem; margin-bottom: 10px;">❌</div>
                    <strong>Connection Error</strong>
                    <p style="margin-top:8px; font-size:0.9rem; opacity:0.8;">${e.message || 'Could not connect to community server. Check your internet.'}</p>
                </div>`;
        }
    },

    // ===================== PUBLISH STATUS =====================
    async publishStatus(classData) {
        const today = new Date().toISOString().split('T')[0];

        // Use the app's own attendance calculation via bridge function
        const summary = window.getAttendanceSummary ? window.getAttendanceSummary() : null;

        let currentPercent = 0;
        let projectedIfSkip = 0;
        let canMassBunk = false;

        if (summary) {
            currentPercent = summary.currentPercent;
            projectedIfSkip = summary.projectedIfSkip;
            canMassBunk = summary.canSkipToday;
            console.log(`📤 Using app's attendance: ${currentPercent.toFixed(1)}% | Skip→${projectedIfSkip.toFixed(1)}% | Eligible: ${canMassBunk}`);
        } else {
            console.warn("⚠️ No attendance data available (getAttendanceSummary returned null). User needs to calculate attendance first.");
            this._noAttendanceData = true;
        }

        this.isEligible = canMassBunk;
        this._myPercentage = currentPercent;
        this._myProjected = projectedIfSkip;
        this._hasData = !!summary;

        const { error } = await supabaseClient
            .from('daily_class_status')
            .upsert({
                shared_class_id: this.currentClassId,
                user_id: AuthManager.user.id,
                date: today,
                can_mass_bunk: canMassBunk,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id, date, shared_class_id' });

        if (error) {
            console.error("❌ Publish status error:", error);
            throw error;
        }
    },

    // ===================== CHECK CLASS ELIGIBILITY =====================
    async checkClassEligibility() {
        const today = new Date().toISOString().split('T')[0];

        const { data: statuses, error } = await supabaseClient
            .from('daily_class_status')
            .select('user_id, can_mass_bunk')
            .eq('shared_class_id', this.currentClassId)
            .eq('date', today);

        if (error) throw error;

        // Fetch profile names
        const userIds = statuses.map(s => s.user_id);
        let profileMap = {};

        if (userIds.length > 0) {
            const { data: profiles, error: pErr } = await supabaseClient
                .from('profiles')
                .select('id, full_name')
                .in('id', userIds);
            if (!pErr && profiles) {
                profiles.forEach(p => { profileMap[p.id] = p.full_name; });
            }
        }

        // Build members list
        const myId = AuthManager.user.id;
        this.members = statuses.map(s => {
            const isMe = s.user_id === myId;
            return {
                id: s.user_id,
                name: isMe ? this.getMyName() : (profileMap[s.user_id] || 'Classmate'),
                percentage: isMe ? this._myPercentage : null, // Only show own %
                projected: isMe ? this._myProjected : null,
                ready: s.can_mass_bunk,
                isMe: isMe
            };
        });

        // Sort: me first, then ready, then not ready
        this.members.sort((a, b) => {
            if (a.isMe) return -1;
            if (b.isMe) return 1;
            if (a.ready && !b.ready) return -1;
            if (!a.ready && b.ready) return 1;
            return 0;
        });

        const totalActive = this.members.length;
        const readyCount = this.members.filter(m => m.ready).length;
        this.isClassReady = (totalActive > 0 && totalActive === readyCount);
    },

    // ===================== RENDER DASHBOARD =====================
    renderDashboard() {
        const loading = document.getElementById('communityLoading');
        const content = document.getElementById('communityContent');
        const list = document.getElementById('communityStatusList');
        const alertBox = document.getElementById('communityAlert');
        const pollsSection = document.getElementById('pollsSection');
        const createBtn = document.getElementById('createPollBtn');

        loading.style.display = 'none';
        content.style.display = 'block';
        list.innerHTML = '';

        const totalMembers = this.members.length;
        const readyCount = this.members.filter(m => m.ready).length;
        const notReadyMembers = this.members.filter(m => !m.ready);

        // === No members ===
        if (totalMembers === 0) {
            alertBox.className = 'alert-box warning';
            alertBox.innerHTML = `
                <div style="text-align:center; padding: 10px;">
                    <div style="font-size: 2rem; margin-bottom: 10px;">👋</div>
                    <strong>You're the first one here!</strong>
                    <p style="margin-top:8px; font-size:0.9rem; opacity:0.8;">Ask your classmates to open Community too so everyone's status shows up.</p>
                </div>`;
            pollsSection.style.display = 'none';
            return;
        }

        // === Render member cards ===
        this.members.forEach(m => {
            const div = document.createElement('div');
            div.className = 'member-item ' + (m.ready ? 'status-ready' : 'status-not-ready');
            div.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-radius:12px; background: var(--card-bg); margin-bottom:8px;';

            const icon = m.ready ? '✅' : '❌';
            const tag = m.isMe ? ' <span style="font-size:0.75rem; background:var(--primary-grad-start); color:white; padding:2px 8px; border-radius:10px; margin-left:6px;">You</span>' : '';

            let details = '';
            if (m.isMe && this._hasData && m.percentage !== null) {
                details = `<div class="member-percent" style="font-size:0.8rem; color:var(--medium-text); margin-top:2px;">${m.percentage.toFixed(1)}% attendance`;
                if (!m.ready && m.projected !== null) {
                    details += ` → ${m.projected.toFixed(1)}% if skip (need ≥75%)`;
                }
                details += '</div>';
            } else if (m.isMe && !this._hasData) {
                details = `<div class="member-percent" style="font-size:0.8rem; color:#e67e22; margin-top:2px;">⚠️ Calculate attendance first (use main screen)</div>`;
            } else if (!m.isMe) {
                details = `<div class="member-percent" style="font-size:0.8rem; color:var(--medium-text); margin-top:2px;">${m.ready ? 'Can safely bunk' : 'Cannot bunk today'}</div>`;
            }

            div.innerHTML = `
                <div style="display:flex; align-items:center; gap:12px; flex:1;">
                    <span style="font-size:1.3rem;">${icon}</span>
                    <div>
                        <div class="member-name" style="font-weight:600; font-size:0.95rem;">${m.name}${tag}</div>
                        ${details}
                    </div>
                </div>
                <div style="font-size:0.8rem; font-weight:600; color:${m.ready ? '#2ecc71' : '#e74c3c'};">${m.ready ? 'READY' : 'NOT READY'}</div>
            `;
            list.appendChild(div);
        });

        // === Status alert with detailed reason ===
        if (this.isClassReady) {
            alertBox.className = 'alert-box success';
            alertBox.innerHTML = `
                <div style="display:flex; align-items:center; gap:12px;">
                    <span style="font-size:1.8rem;">🎉</span>
                    <div>
                        <strong>Mass Bunk Unlocked!</strong>
                        <p style="margin:4px 0 0; font-size:0.85rem; opacity:0.85;">All ${totalMembers} members are eligible. Create a poll to coordinate!</p>
                    </div>
                </div>`;
            pollsSection.style.display = 'block';
            pollsSection.style.opacity = '1';
            pollsSection.style.pointerEvents = 'auto';
            if (createBtn) createBtn.disabled = false;
            this.loadPolls();
        } else {
            // Build detailed reason
            let reasonHTML = '';
            notReadyMembers.forEach(m => {
                const isMe = m.isMe;
                let personalReason = '';
                if (isMe && !this._hasData) {
                    personalReason = 'You haven\'t calculated attendance yet. Go back and calculate first, then reopen Community.';
                } else if (isMe && m.projected !== null) {
                    if (m.projected < 75) {
                        personalReason = `If you skip today, your attendance drops to ${m.projected.toFixed(1)}% (below 75% limit). Current: ${m.percentage.toFixed(1)}%`;
                    } else {
                        personalReason = `Current: ${m.percentage.toFixed(1)}%`;
                    }
                } else {
                    personalReason = 'Their attendance is too low to safely skip today.';
                }
                reasonHTML += `<div style="display:flex; align-items:flex-start; gap:8px; padding:6px 0; ${notReadyMembers.length > 1 ? 'border-bottom:1px solid rgba(0,0,0,0.05);' : ''}">
                    <span style="color:#e74c3c; flex-shrink:0;">●</span>
                    <div>
                        <strong>${m.name}${isMe ? ' (You)' : ''}</strong>
                        <div style="font-size:0.82rem; opacity:0.8; margin-top:2px;">${personalReason}</div>
                    </div>
                </div>`;
            });

            alertBox.className = 'alert-box danger';
            alertBox.innerHTML = `
                <div>
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                        <span style="font-size:1.5rem;">⛔</span>
                        <div>
                            <strong>Mass Bunk Locked</strong>
                            <div style="font-size:0.82rem; opacity:0.8; margin-top:2px;">${readyCount}/${totalMembers} members ready — ALL must be eligible</div>
                        </div>
                    </div>
                    <div style="background:rgba(0,0,0,0.03); border-radius:8px; padding:10px 12px; margin-top:8px;">
                        <div style="font-size:0.8rem; font-weight:600; color:#721c24; margin-bottom:6px;">❓ Why is it locked:</div>
                        ${reasonHTML}
                    </div>
                </div>`;

            pollsSection.style.display = 'block';
            pollsSection.style.opacity = '0.4';
            pollsSection.style.pointerEvents = 'none';
            if (createBtn) createBtn.disabled = true;
        }
    },

    // ===================== LOAD POLLS =====================
    async loadPolls() {
        if (!this.currentClassId) return;
        try {
            const { data: polls, error } = await supabaseClient
                .from('mass_bunk_polls')
                .select('*')
                .eq('shared_class_id', this.currentClassId)
                .order('created_at', { ascending: false });
            if (error) throw error;

            const initiatorIds = [...new Set(polls.map(p => p.initiator_uid))];
            let nameMap = {};
            if (initiatorIds.length > 0) {
                const { data: profiles } = await supabaseClient.from('profiles').select('id, full_name').in('id', initiatorIds);
                if (profiles) profiles.forEach(p => { nameMap[p.id] = p.full_name; });
            }

            const pollIds = polls.map(p => p.id);
            let votes = [];
            if (pollIds.length > 0) {
                const { data: v } = await supabaseClient.from('mass_bunk_votes').select('poll_id, vote, user_id').in('poll_id', pollIds);
                if (v) votes = v;
            }

            this.polls = polls.map(p => {
                const pv = votes.filter(v => v.poll_id === p.id);
                return {
                    ...p,
                    initiatorName: nameMap[p.initiator_uid] || 'Unknown',
                    yesCount: pv.filter(v => v.vote === 'yes').length,
                    noCount: pv.filter(v => v.vote === 'no').length,
                    myVote: pv.find(v => v.user_id === AuthManager.user.id)?.vote || null,
                    isExpired: new Date() > new Date(p.date + 'T23:59:59')
                };
            });

            if (typeof renderPolls === 'function') renderPolls(this.polls);
        } catch (e) {
            console.error("❌ Load polls error:", e);
        }
    },

    // ===================== CREATE POLL =====================
    async createPoll(subject, targetDate, message) {
        if (!this.isClassReady) {
            alert("⚠️ Class is not ready for Mass Bunk yet!");
            return;
        }
        try {
            const { error } = await supabaseClient.from('mass_bunk_polls').insert({
                shared_class_id: this.currentClassId,
                initiator_uid: AuthManager.user.id,
                date: targetDate
            });
            if (error) throw error;
            alert("✅ Poll Created!");
            this.loadPolls();
            if (typeof closeModal === 'function') closeModal('createPollModal');
        } catch (e) {
            console.error("❌ Create poll error:", e);
            alert("Error: " + e.message);
        }
    },

    // ===================== VOTE =====================
    async vote(pollId, voteType) {
        try {
            const { error } = await supabaseClient.from('mass_bunk_votes').upsert({
                poll_id: pollId,
                user_id: AuthManager.user.id,
                vote: voteType,
                updated_at: new Date().toISOString()
            }, { onConflict: 'poll_id, user_id' });
            if (error) throw error;
            this.loadPolls();
        } catch (e) {
            console.error("❌ Vote error:", e);
            alert("Vote failed: " + e.message);
        }
    },

    openCreatePollModal() {
        if (typeof openCreatePollModal === 'function') openCreatePollModal();
    }
};

window.CommunityManager = CommunityManager;
