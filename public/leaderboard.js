// MySQL-backed Leaderboard (via server REST API)
let leaderboard;

class Leaderboard {
    static getInstance() {
        if (!leaderboard) {
            leaderboard = new Leaderboard();
        }
        return leaderboard;
    }

    isUserAuthenticated() {
        try {
            if (typeof window.isUserAuthenticated === 'function') {
                return !!window.isUserAuthenticated();
            }
            // Fallback to Firebase compat if present
            if (typeof firebase !== 'undefined' && firebase.auth) {
                const user = firebase.auth().currentUser;
                return !!(user && !user.isAnonymous && user.email);
            }
        } catch (_) {}
        return false;
    }

    getCurrentUser() {
        try {
            if (typeof firebase !== 'undefined' && firebase.auth) {
                return firebase.auth().currentUser;
            }
        } catch (_) {}
        return null;
    }

    async updateScore(username) {
        try {
            if (!this.isUserAuthenticated()) {
                console.log('Guest or anonymous user win NOT recorded in leaderboard:', username);
                return { updated: false, reason: 'guest-user' };
            }

            const user = this.getCurrentUser();
            const body = {
                username,
                uid: user?.uid || null,
                email: user?.email || null
            };

            const resp = await fetch('/api/leaderboard/increment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                throw new Error(err.error || 'failed-to-increment');
            }
            return true;
        } catch (error) {
            console.error('Error updating wins:', error);
            return { updated: false, reason: 'error', message: error.message };
        }
    }

    async getTopPlayers(limit = 10) {
        try {
            const resp = await fetch(`/api/leaderboard/top?limit=${encodeURIComponent(limit)}`);
            if (!resp.ok) throw new Error('failed-to-fetch-top');
            const players = await resp.json();
            return Array.isArray(players) ? players.map(p => ({ username: p.username, wins: p.wins || 0 })) : [];
        } catch (error) {
            console.error('Error getting top players:', error);
            return [];
        }
    }

    async getPlayerStats(username) {
        try {
            const resp = await fetch(`/api/leaderboard/stats/${encodeURIComponent(username)}`);
            if (!resp.ok) throw new Error('failed-to-fetch-stats');
            const data = await resp.json();
            return data || null;
        } catch (error) {
            console.error('Error getting player stats:', error);
            return null;
        }
    }

    async updateLeaderboardDisplay() {
        try {
            const leaderboardElement = document.getElementById('leaderboardList');
            if (!leaderboardElement) {
                console.error('Leaderboard element not found');
                return;
            }
            leaderboardElement.innerHTML = '';

            if (!this.isUserAuthenticated()) {
                const messageDiv = document.createElement('div');
                messageDiv.className = 'leaderboard-message';
                messageDiv.innerHTML = `
                    <p>Sign in with Google to:</p>
                    <ul>
                        <li>Track your high scores</li>
                        <li>Compete on the leaderboard</li>
                        <li>Save your game statistics</li>
                    </ul>
                `;
                leaderboardElement.appendChild(messageDiv);
                return;
            }

            const topPlayers = await this.getTopPlayers();
            if (topPlayers.length === 0) {
                const messageDiv = document.createElement('div');
                messageDiv.className = 'leaderboard-message';
                messageDiv.innerHTML = '<p>No wins recorded yet. Win a game to be the first!</p>';
                leaderboardElement.appendChild(messageDiv);
                return;
            }

            topPlayers.forEach((player, index) => {
                const entry = document.createElement('div');
                entry.className = 'leaderboard-entry';
                entry.innerHTML = `
                    <span class="rank">#${index + 1}</span>
                    <span class="username">${player.username}</span>
                    <span class="score">Wins: ${player.wins}</span>
                `;
                leaderboardElement.appendChild(entry);
            });
        } catch (error) {
            console.error('Error updating leaderboard display:', error);
        }
    }
}

// Initialize Leaderboard (no Firebase dependency here)
(function initLeaderboard() {
    try {
        const lb = Leaderboard.getInstance();
        window.leaderboard = lb;
        window.getLeaderboard = () => lb;
        // Initial render (auth.js will also trigger updates on auth changes)
        lb.updateLeaderboardDisplay();
    } catch (e) {
        console.error('Failed to initialize leaderboard:', e);
    }
})();
