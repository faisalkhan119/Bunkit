// Community Manager - Handles Mass Bunk Polls & Eligibility
// Strategy: Strict Gate - All users must be eligible & up-to-date

const CommunityManager = {
    // State
    currentClassId: null,
    members: [],
    polls: [],
    isEligible: false,
    isClassReady: false,

    // ===================== OPEN MODAL =====================
    async openCommunityModal() {
        console.log("🗳️ Open Community Clicked");

        const modal = document.getElementById('communityModal');
        const loading = document.getElementById('communityLoading');
        const content = document.getElementById('communityContent');
        const alertBox = document.getElementById('communityAlert');
        const classNameDisplay = document.getElementById('communityClassName');

        if (!modal) {
            console.error("communityModal element not found!");
            return;
        }

        // Modal is already opened by sidebar onclick - just set loading state
        loading.style.display = 'block';
        content.style.display = 'none';

        // Guard: Not logged in
        if (!window.AuthManager || !AuthManager.user) {
            loading.style.display = 'none';
            content.style.display = 'block';
            document.getElementById('communityStatusList').innerHTML = '';
            alertBox.className = 'alert-box warning';
            alertBox.innerHTML = '🔐 <strong>Sign in required.</strong> Please sign in to access Community features.';
            classNameDisplay.textContent = 'Community';
            document.getElementById('pollsSection').style.display = 'none';
            return;
        }

        // Guard: No class selected — read from classSelector dropdown (selectedClass is local, not on window)
        const className = document.getElementById('classSelector')?.value;
        const classData = className && window.classes ? window.classes[className] : null;
        if (!className || !classData) {
            loading.style.display = 'none';
            content.style.display = 'block';
            document.getElementById('communityStatusList').innerHTML = '';
            alertBox.className = 'alert-box warning';
            alertBox.innerHTML = '📚 <strong>No class selected.</strong> Please select a class first from the main screen.';
            classNameDisplay.textContent = 'Community';
            document.getElementById('pollsSection').style.display = 'none';
            return;
        }

        // Set class ID
        this.currentClassId = className;
        classNameDisplay.textContent = this.currentClassId;

        try {
            // Step 1: Publish own status
            await this.publishStatus();

            // Step 2: Check all members
            await this.checkClassEligibility();

            // Step 3: Render dashboard
            this.renderDashboard();

        } catch (e) {
            console.error("❌ Community init error:", e);
            loading.style.display = 'none';
            content.style.display = 'block';
            alertBox.className = 'alert-box danger';
            alertBox.innerHTML = '❌ <strong>Error loading community data.</strong> ' + (e.message || 'Please try again.');
        }
    },

    // ===================== PUBLISH STATUS =====================
    async publishStatus() {
        const today = new Date().toISOString().split('T')[0];

        // Calculate from DOM (existing attendance display)
        const total = parseInt(document.getElementById('totalClasses')?.textContent || '0');
        const attended = parseInt(document.getElementById('attendedClasses')?.textContent || '0');

        const currentPercentage = total === 0 ? 0 : (attended / total * 100);
        const projectedIfSkip = total === 0 ? 0 : (attended / (total + 1)) * 100;
        const canMassBunk = projectedIfSkip >= 75.00;

        console.log(`📤 Publishing: ${currentPercentage.toFixed(1)}% | Safe to skip: ${canMassBunk}`);

        const { error } = await supabaseClient
            .from('daily_class_status')
            .upsert({
                shared_class_id: this.currentClassId,
                user_id: AuthManager.user.id,
                date: today,
                can_mass_bunk: canMassBunk,
                current_percentage: parseFloat(currentPercentage.toFixed(2)),
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

        // Step 1: Fetch all status entries for this class today
        const { data: statuses, error } = await supabaseClient
            .from('daily_class_status')
            .select('user_id, can_mass_bunk, current_percentage')
            .eq('shared_class_id', this.currentClassId)
            .eq('date', today);

        if (error) throw error;

        // Step 2: Fetch profile names in a separate query
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

        // Step 3: Build members list
        this.members = statuses.map(s => ({
            id: s.user_id,
            name: profileMap[s.user_id] || 'Student',
            percentage: s.current_percentage || 0,
            ready: s.can_mass_bunk
        }));

        const totalActive = this.members.length;
        const readyCount = this.members.filter(m => m.ready).length;
        this.isClassReady = (totalActive > 0 && totalActive === readyCount);

        console.log(`👥 Class: ${readyCount}/${totalActive} ready. ClassReady: ${this.isClassReady}`);
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

        // Render member list
        list.innerHTML = '';

        if (this.members.length === 0) {
            alertBox.className = 'alert-box warning';
            alertBox.innerHTML = '⏳ <strong>No class members found for today.</strong> You are the first one here! Ask your classmates to open Community too.';
            pollsSection.style.display = 'none';
            return;
        }

        this.members.forEach(m => {
            const div = document.createElement('div');
            div.className = 'member-item ' + (m.ready ? 'status-ready' : 'status-not-ready');

            const icon = m.ready ? '✅' : '❌';
            div.innerHTML = `
                <div class="member-info">
                    <span class="member-status-icon">${icon}</span>
                    <div>
                        <div class="member-name">${m.name}</div>
                        <div class="member-percent">${m.percentage}% Attendance</div>
                    </div>
                </div>
            `;
            list.appendChild(div);
        });

        // Update alert and poll section
        if (this.isClassReady) {
            alertBox.className = 'alert-box success';
            alertBox.innerHTML = '🎉 <strong>Mass Bunk Unlocked!</strong> All members are eligible.';

            pollsSection.style.display = 'block';
            pollsSection.style.opacity = '1';
            pollsSection.style.pointerEvents = 'auto';
            createBtn.disabled = false;

            // Load polls
            this.loadPolls();
        } else {
            alertBox.className = 'alert-box danger';
            const notReady = this.members.filter(m => !m.ready).map(m => m.name).join(', ');
            alertBox.innerHTML = `⛔ <strong>Mass Bunk Locked.</strong> Not eligible: ${notReady}`;

            pollsSection.style.display = 'block';
            pollsSection.style.opacity = '0.5';
            pollsSection.style.pointerEvents = 'none';
            createBtn.disabled = true;
        }
    },

    // ===================== LOAD POLLS =====================
    async loadPolls() {
        if (!this.currentClassId) return [];

        console.log("📥 Loading polls...");
        try {
            const { data: polls, error } = await supabaseClient
                .from('mass_bunk_polls')
                .select('*')
                .eq('shared_class_id', this.currentClassId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Fetch initiator names
            const initiatorIds = [...new Set(polls.map(p => p.initiator_uid))];
            let nameMap = {};
            if (initiatorIds.length > 0) {
                const { data: profiles } = await supabaseClient
                    .from('profiles').select('id, full_name').in('id', initiatorIds);
                if (profiles) profiles.forEach(p => { nameMap[p.id] = p.full_name; });
            }

            // Fetch votes
            const pollIds = polls.map(p => p.id);
            let votes = [];
            if (pollIds.length > 0) {
                const { data: v } = await supabaseClient
                    .from('mass_bunk_votes')
                    .select('poll_id, vote, user_id')
                    .in('poll_id', pollIds);
                if (v) votes = v;
            }

            // Build poll data
            this.polls = polls.map(p => {
                const pollVotes = votes.filter(v => v.poll_id === p.id);
                return {
                    ...p,
                    initiatorName: nameMap[p.initiator_uid] || 'Unknown',
                    yesCount: pollVotes.filter(v => v.vote === 'yes').length,
                    noCount: pollVotes.filter(v => v.vote === 'no').length,
                    myVote: pollVotes.find(v => v.user_id === AuthManager.user.id)?.vote || null,
                    isExpired: new Date() > new Date(p.date + 'T23:59:59')
                };
            });

            if (typeof renderPolls === 'function') renderPolls(this.polls);
            return this.polls;

        } catch (e) {
            console.error("❌ Load polls error:", e);
            return [];
        }
    },

    // ===================== CREATE POLL =====================
    async createPoll(subject, targetDate, message) {
        if (!this.isClassReady) {
            alert("⚠️ Class is not ready for Mass Bunk yet!");
            return;
        }

        try {
            const { error } = await supabaseClient
                .from('mass_bunk_polls')
                .insert({
                    shared_class_id: this.currentClassId,
                    initiator_uid: AuthManager.user.id,
                    date: targetDate,
                    subject_name: subject,
                    message: message,
                    status: 'active'
                });

            if (error) throw error;

            alert("✅ Poll Created!");
            this.loadPolls();
            if (typeof closeModal === 'function') closeModal('createPollModal');

        } catch (e) {
            console.error("❌ Create poll error:", e);
            alert("Error creating poll: " + e.message);
        }
    },

    // ===================== VOTE =====================
    async vote(pollId, voteType) {
        try {
            const { error } = await supabaseClient
                .from('mass_bunk_votes')
                .upsert({
                    poll_id: pollId,
                    user_id: AuthManager.user.id,
                    vote: voteType,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'poll_id, user_id' });

            if (error) throw error;
            this.loadPolls(); // Refresh

        } catch (e) {
            console.error("❌ Vote error:", e);
            alert("Vote failed: " + e.message);
        }
    },

    // UI Helper
    openCreatePollModal() {
        if (typeof openCreatePollModal === 'function') openCreatePollModal();
    }
};

// Expose globally
window.CommunityManager = CommunityManager;
