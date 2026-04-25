import { isMockMode, mockDB, db, auth, collection, getDocs, doc, deleteDoc, formatDate } from './app.js';

let tracks = [];
let currentPlayIndex = -1;
let isPlaying = false;

// Audio Elements
const audioElement = document.getElementById('audioElement');
const globalPlayer = document.getElementById('globalPlayer');
const playPauseBtn = document.getElementById('playPauseBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const progressBar = document.getElementById('progressBar');
const progressBarContainer = document.getElementById('progressBarContainer');
const currentTimeEl = document.getElementById('currentTime');
const durationTimeEl = document.getElementById('durationTime');

document.addEventListener('DOMContentLoaded', () => {
    // If favourite data is already available, load now
    if (window.userFavourites && window.userFavourites.size > 0) {
        loadTracks();
    } else {
        // Wait for it
        document.addEventListener('favouritesLoaded', loadTracks);
    }
    
    setupAudioPlayer();
});

async function loadTracks() {
    const container = document.getElementById('favouritesContainer');
    if(!container) return;
    
    container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading your playlist...</p></div>';

    if (!window.userFavourites || window.userFavourites.size === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 40px; color: var(--text-secondary);">Your playlist is empty! Go browse and heart some tracks.</div>`;
        return;
    }

    try {
        if (isMockMode) {
            const all = mockDB.getTracks();
            tracks = all.filter(t => window.userFavourites.has(t.id));
            setTimeout(() => renderTracks(tracks), 500); 
        } else {
            const querySnapshot = await getDocs(collection(db, "tracks"));
            tracks = [];
            querySnapshot.forEach((doc) => {
                if (window.userFavourites.has(doc.id)) {
                    tracks.push({ id: doc.id, ...doc.data() });
                }
            });
            renderTracks(tracks);
        }
    } catch (error) {
        console.error("Error loading favourites:", error);
        container.innerHTML = `<p style="color:red; text-align:center;">Failed to load playlist. Please try again later.</p>`;
    }
}

function renderTracks(trackList) {
    const container = document.getElementById('favouritesContainer');
    if(!container) return;
    
    if (trackList.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 40px; color: var(--text-secondary);">Your playlist is empty! Go browse and heart some tracks.</div>`;
        return;
    }
    
    container.innerHTML = '';
    
    trackList.forEach((track, index) => {
        const card = document.createElement('div');
        card.className = 'track-card card glass playlist-track-card';
        card.innerHTML = `
            <div style="position:relative;">
                <img src="${track.coverUrl || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=300&auto=format&fit=crop'}" alt="${track.title}" class="track-cover">
                <div class="play-overlay">
                    <div class="play-circle" data-url="${track.audioUrl}" data-id="${track.id}" data-index="${index}">
                        <i class="ph-fill ph-play"></i>
                    </div>
                </div>
            </div>
            <div class="track-info">
                <h3>${track.title}</h3>
                
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <span class="badge ${track.type}">${track.type === 'full' ? 'Full Track' : 'Instrumental'}</span>
                    <span style="font-size:0.8rem; color:var(--text-secondary); text-transform:capitalize;">${track.genre}</span>
                </div>
                
                <div class="track-meta" style="justify-content:flex-end;">
                    <div style="display:flex; gap:8px; align-items:center;">
                        <button class="favourite-track-btn favourited" data-id="${track.id}">
                            <i class="ph-fill ph-heart"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(card);
    });

    // Play listeners
    document.querySelectorAll('.play-circle').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const trackId = e.currentTarget.getAttribute('data-id');
            const trackUrl = e.currentTarget.getAttribute('data-url');
            const trackIndex = parseInt(e.currentTarget.getAttribute('data-index'));
            currentPlayIndex = trackIndex;
            playTrack(trackId, trackUrl);
        });
    });

    // Remove from favourites listener
    document.querySelectorAll('.favourite-track-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if(!auth || !auth.currentUser) return;
            const trackId = e.currentTarget.getAttribute('data-id');
            const uid = auth.currentUser.uid;
            
            // Optimistic UI Removal
            window.userFavourites.delete(trackId);
            const card = e.currentTarget.closest('.track-card');
            card.style.opacity = '0';
            card.style.transform = 'scale(0.9)';
            setTimeout(() => {
                tracks = tracks.filter(t => t.id !== trackId);
                renderTracks(tracks);
            }, 300);

            try {
                // Background DB Sync
                await deleteDoc(doc(db, "users", uid, "favourites", trackId));
            } catch(err) {
                console.error("Error removing favourite", err);
                // Optionally could revert here, but for a playlist visually popping back in might be jarring
            }
        });
    });
}

function playTrack(trackId, url) {
    const track = tracks.find(t => t.id === trackId);
    if(!track) return;

    document.getElementById('playerTitle').textContent = track.title;
    document.getElementById('playerArtist').textContent = track.artistName;
    document.getElementById('playerCover').src = track.coverUrl || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=300&auto=format&fit=crop';
    
    document.querySelectorAll('.play-circle').forEach(btn => {
        btn.classList.remove('playing');
        btn.innerHTML = `<i class="ph-fill ph-play"></i>`;
    });
    
    const activeBtn = document.querySelector(`.play-circle[data-id="${trackId}"]`);
    if(activeBtn) {
        activeBtn.classList.add('playing');
        activeBtn.innerHTML = `<i class="ph-fill ph-pause"></i>`;
    }

    if(audioElement.src !== url) {
        audioElement.src = url;
    }
    
    audioElement.play();
    isPlaying = true;
    updatePlayPauseIcon();
    globalPlayer.classList.add('active');
}

function setupAudioPlayer() {
    if(!playPauseBtn) return;
    
    playPauseBtn.addEventListener('click', () => {
        if(audioElement.src) {
            if(isPlaying) {
                audioElement.pause();
            } else {
                audioElement.play();
            }
            isPlaying = !isPlaying;
            updatePlayPauseIcon();
        }
    });

    nextBtn.addEventListener('click', playNextTrack);
    prevBtn.addEventListener('click', playPrevTrack);

    audioElement.addEventListener('timeupdate', () => {
        const current = audioElement.currentTime;
        const duration = audioElement.duration;
        
        if(!isNaN(duration)) {
            const progressPercent = (current / duration) * 100;
            progressBar.style.width = `${progressPercent}%`;
            
            currentTimeEl.textContent = formatTime(current);
            durationTimeEl.textContent = formatTime(duration);
        }
    });
    
    audioElement.addEventListener('ended', () => {
        playNextTrack();
    });

    progressBarContainer.addEventListener('click', (e) => {
        const width = progressBarContainer.clientWidth;
        const clickX = e.offsetX;
        const duration = audioElement.duration;
        
        if(!isNaN(duration)) {
            audioElement.currentTime = (clickX / width) * duration;
        }
    });
}

function playNextTrack() {
    if (tracks.length === 0) return;
    currentPlayIndex++;
    if (currentPlayIndex >= tracks.length) {
        currentPlayIndex = 0; // Loop back to start
    }
    const nextTrack = tracks[currentPlayIndex];
    playTrack(nextTrack.id, nextTrack.audioUrl);
}

function playPrevTrack() {
    if (tracks.length === 0) return;
    currentPlayIndex--;
    if (currentPlayIndex < 0) {
        currentPlayIndex = tracks.length - 1; // Play last track
    }
    const prevTrack = tracks[currentPlayIndex];
    playTrack(prevTrack.id, prevTrack.audioUrl);
}

function updatePlayPauseIcon() {
    playPauseBtn.innerHTML = isPlaying 
        ? `<i class="ph-fill ph-pause"></i>` 
        : `<i class="ph-fill ph-play"></i>`;
}

function formatTime(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
}
