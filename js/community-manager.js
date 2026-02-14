// Community Manager - Handles Mass Bunk Polls & Eligibility
// Strategy: Strict Gate - All users must be eligible & up-to-date

const CommunityManager = {
    // State
    currentClassId: null, // derived from class name
    members: [],
    polls: [],
    isEligible: false, // Is the current user eligible?
    isClassReady: false, // Is the WHOLE class ready?

    // Constants
    TABLES: {
        STATUS: 'daily_class_status',
        POLLS: 'mass_bunk_polls',
        VOTES: 'mass_bunk_votes',
        PROFILES: 'profiles'
    },

    // 1. Initialize & Subscribe
    async init() {
        if (!AuthManager.user || !window.selectedClass) return;

        // Generate shared ID (for now, just the class name)
        // In future, this could be a UUID from the class object if we implement strict class linking
        this.currentClassId = window.selectedClass.name;

        console.log(`🗳️ Community Manager initialized for ${this.currentClassId}`);

        // Publish my status immediately
        await this.publishStatus();

        // Load data
        await this.checkClassEligibility();
    },

    // 2. Publish Current User Status
    async publishStatus() {
        if (!AuthManager.user || !window.selectedClass) return;

        // Use today's date for status tracking
        const today = new Date().toISOString().split('T')[0];

        // Calculate Eligibility Logic
        const total = parseInt(document.getElementById('totalClasses')?.textContent || '0');
        const attended = parseInt(document.getElementById('attendedClasses')?.textContent || '0');

        // Real percentage calculation
        const currentPercentage = total === 0 ? 0 : (attended / total * 100);

        // "Can I Skip Today" Calculation (Simulated)
        // We need to know if skipping TODAY drops them below 75%
        // projected = attended / (total + 1) * 100
        const projectedIfSkip = (attended / (total + 1)) * 100;
        const SafeLimit = 75.00;

        const canMassBunk = projectedIfSkip >= SafeLimit;

        // Logs Check: Does user have data for today? Not strictly checking logs here
        // as we assume the local state reflects their current standing.

        console.log(`📤 Publishing Status: ${currentPercentage.toFixed(2)}% | Can Bunk: ${canMassBunk}`);

        try {
            const { error } = await supabaseClient
                .from('daily_class_status')
                .upsert({
                    shared_class_id: this.currentClassId,
                    user_id: AuthManager.user.id,
                    date: today,
                    can_mass_bunk: canMassBunk, // Strict: Must be high attendance
                    current_percentage: parseFloat(currentPercentage.toFixed(2)),
                    updated_at: new Date()
                }, { onConflict: 'user_id, date, shared_class_id' });

            if (error) {
                console.error("❌ Failed to publish status:", error);
            }
        } catch (e) {
            console.error("❌ Exception publishing status:", e);
        }
    },

    // 3. Check Whole Class Eligibility
    async checkClassEligibility() {
        if (!this.currentClassId) return { isReady: false, members: [] };

        const today = new Date().toISOString().split('T')[0];

        try {
            // Fetch status of ALL users for this class for TODAY
            // Note: We need to join with profiles to get names
            const { data: statuses, error } = await supabaseClient
                .from('daily_class_status')
                .select(`
                    user_id, 
                    can_mass_bunk, 
                    current_percentage,
                    user_id_profile:profiles!inner(full_name)
                `)
                .eq('shared_class_id', this.currentClassId)
                .eq('date', today);

            if (error) throw error;

            this.members = statuses.map(s => ({
                id: s.user_id,
                name: s.user_id_profile?.full_name || 'Student',
                percentage: s.current_percentage,
                ready: s.can_mass_bunk
            }));

            // STRICT RULE: ALL active members must be ready

            const totalActive = this.members.length;
            const readyCount = this.members.filter(m => m.ready).length;

            this.isClassReady = (totalActive > 0 && totalActive === readyCount);

            console.log(`👥 Class Status: ${readyCount}/${totalActive} ready.`);

            return {
                isReady: this.isClassReady,
                members: this.members
            };

        } catch (e) {
            console.error("❌ Failed to check class eligibility:", e);
            return { isReady: false, members: [] };
        }
    },

    // 4. Load Polls (Only if Class is Ready)
    async loadPolls() {
        if (!this.currentClassId) return [];

        console.log("📥 Loading polls...");
        try {
            // Fetch Polls
            const { data: polls, error } = await supabaseClient
                .from('mass_bunk_polls')
                .select(`
                    *,
                    initiator:initiator_uid(full_name)
                `)
                .eq('shared_class_id', this.currentClassId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            console.log(`📥 Loaded ${polls.length} polls.`);

            // Fetch Votes for these polls
            const pollIds = polls.map(p => p.id);
            let votes = [];
            if (pollIds.length > 0) {
                const { data: v, error: vError } = await supabaseClient
                    .from('mass_bunk_votes')
                    .select('poll_id, vote, user_id') // we can join profile if we want names
                    .in('poll_id', pollIds);

                if (!vError) votes = v;
            }

            // Merge Data
            this.polls = polls.map(p => {
                const pollVotes = votes.filter(v => v.poll_id === p.id);
                return {
                    ...p,
                    initiatorName: p.initiator?.full_name || 'Unknown',
                    yesCount: pollVotes.filter(v => v.vote === 'yes').length,
                    noCount: pollVotes.filter(v => v.vote === 'no').length,
                    myVote: pollVotes.find(v => v.user_id === AuthManager.user.id)?.vote || null,
                    // Calculate expiry (Auto-expire at end of target date)
                    isExpired: new Date() > new Date(p.date + 'T23:59:59')
                };
            });

            // Render Polls
            if (typeof renderPolls === 'function') {
                renderPolls(this.polls);
            }

            return this.polls;

        } catch (e) {
            console.error("❌ Failed to load polls:", e);
            return [];
        }
    },

    // 5. Create Poll
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
            // Reload
            this.loadPolls();

            // Close Create Modal (if exists)
            if (typeof closeModal === 'function') closeModal('createPollModal');

        } catch (e) {
            console.error("❌ Failed to create poll:", e);
            alert("Error creating poll: " + e.message);
        }
    },

    // 6. Vote
    async vote(pollId, voteType) {
        if (!this.isClassReady) {
            alert("⚠️ Usage blocked. Class eligibility changed.");
            return;
        }

        try {
            const { error } = await supabaseClient
                .from('mass_bunk_votes')
                .upsert({
                    poll_id: pollId,
                    user_id: AuthManager.user.id,
                    vote: voteType,
                    updated_at: new Date()
                }, { onConflict: 'poll_id, user_id' });

            if (error) throw error;

            // Refresh polls to show updated counts
            this.loadPolls();

        } catch (e) {
            console.error("❌ Vote failed:", e);
        }
    },

    // UI Helpers
    openCreatePollModal() {
        if (typeof openCreatePollModal === 'function') openCreatePollModal();
    },

    // Open Modal Logic to be implemented in UI chunk
    async openCommunityModal() {
        console.log("Open Community Clicked");
        await this.init(); // Refresh data

        // This function will be defined in index.html script or helper
        if (typeof renderCommunityModal === 'function') {
            renderCommunityModal();
        }
    }
};

// Expose
window.CommunityManager = CommunityManager;
