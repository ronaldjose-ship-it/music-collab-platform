import { isMockMode, mockDB, db, auth, collection, getDocs, query, orderBy, formatDate, deleteDoc, addDoc, where, onAuthStateChanged } from './app.js';
import { doc, setDoc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let tracks = [];
let currentAudio = null;
let isPlaying = false;

// Audio Elements
const audioElement = document.getElementById('audioElement');
const globalPlayer = document.getElementById('globalPlayer');
const playPauseBtn = document.getElementById('playPauseBtn');
const progressBar = document.getElementById('progressBar');
const progressBarContainer = document.getElementById('progressBarContainer');
const currentTimeEl = document.getElementById('currentTime');
const durationTimeEl = document.getElementById('durationTime');

document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('favouritesLoaded', () => {
        if (tracks.length > 0) {
            renderTracks(tracks);
        }
    });

    loadTracks().then(() => {
        setupFilters();
        setupAudioPlayer();
    });
});

async function loadTracks() {
    const container = document.getElementById('tracksContainer');
    if(!container) return;
    
    try {
        if (isMockMode) {
            tracks = mockDB.getTracks();
            setTimeout(() => renderTracks(tracks), 800); // Simulate network delay
        } else {
            // Real Firebase Fetch
            const q = query(collection(db, "tracks"), orderBy("timestamp", "desc"));
            const querySnapshot = await getDocs(q);
            tracks = [];
            querySnapshot.forEach((doc) => {
                tracks.push({ id: doc.id, ...doc.data() });
            });
            renderTracks(tracks);
        }
    } catch (error) {
        console.error("Error loading tracks:", error);
        container.innerHTML = `<p style="color:red">Failed to load tracks. Please try again later.</p>`;
    }
}

function renderTracks(trackList) {
    const container = document.getElementById('tracksContainer');
    if(!container) return;
    
    if (trackList.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 40px; color: var(--text-secondary);">No tracks found. Be the first to upload!</div>`;
        return;
    }
    
    container.innerHTML = '';
    
    trackList.forEach(track => {
        const card = document.createElement('div');
        card.className = 'track-card card glass';
        card.innerHTML = `
            <div style="position:relative;">
                ${(auth.currentUser && auth.currentUser.uid === track.artistId && !isMockMode) ? `<button class="delete-track-btn" data-id="${track.id}" style="position:absolute; top:8px; right:8px; background:rgba(239,68,68,0.8); color:white; border:none; border-radius:50%; width:32px; height:32px; display:flex; justify-content:center; align-items:center; cursor:pointer; z-index:10; transition:0.2s;"><i class="ph ph-trash"></i></button>` : ''}
                <img src="${track.coverUrl || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=300&auto=format&fit=crop'}" alt="${track.title}" class="track-cover">
                <div class="play-overlay">
                    <div class="play-circle" data-url="${track.audioUrl}" data-id="${track.id}">
                        <i class="ph-fill ph-play"></i>
                    </div>
                </div>
            </div>
            <div class="track-info">
                <h3>${track.title}</h3>
                
                <div class="artist-snippet" id="artistSnippet-${track.id}" style="display:flex; align-items:center; gap:8px; margin-bottom:12px; padding:6px; background:rgba(255,255,255,0.03); border-radius:8px; cursor:pointer; transition:background 0.2s;" onclick="window.location.href='profile.html?artistId=${track.artistId || ''}&artist=${encodeURIComponent(track.artistName)}'" onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background='rgba(255,255,255,0.03)'">
                     <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=100&auto=format&fit=crop" class="snippet-avatar" style="width:32px; height:32px; border-radius:50%; object-fit:cover;">
                     <div style="flex-grow:1; overflow:hidden;">
                         <p style="margin:0; font-size:0.9rem; font-weight:500; color:var(--text-primary);">${track.artistName}</p>
                         <p class="snippet-bio" style="margin:0; font-size:0.75rem; color:var(--text-secondary); white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">Loading artist info...</p>
                     </div>
                </div>
                
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <span class="badge ${track.type}">${track.type === 'full' ? 'Full Track' : 'Instrumental'}</span>
                    <span style="font-size:0.8rem; color:var(--text-secondary); text-transform:capitalize;">${track.genre}</span>
                </div>
                
                <div class="track-rating-container" id="ratingContainer-${track.id}" style="margin-bottom:12px; display:flex; align-items:center; gap:8px;">
                    <div class="stars" style="color:#475569; display:flex; gap:2px;"></div>
                    <span class="rating-value" style="font-size:0.8rem; color:var(--text-secondary);"></span>
                </div>
                
                <div class="track-meta">
                    <span><i class="ph ph-calendar"></i> ${formatDate(track.timestamp)}</span>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <i class="ph ph-shield-check" style="color:var(--success)" title="Ownership Verified"></i>
                        <button class="favourite-track-btn ${window.userFavourites && window.userFavourites.has(track.id) ? 'favourited' : ''}" data-id="${track.id}">
                            <i class="${window.userFavourites && window.userFavourites.has(track.id) ? 'ph-fill' : 'ph'} ph-heart"></i>
                        </button>
                        <button class="download-track-btn" data-id="${track.id}" data-url="${track.audioUrl}" data-title="${track.title.replace(/"/g, '&quot;')}" data-artist="${track.artistId}"><i class="ph ph-download-simple"></i></button>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(card);
        
        setupTrackRating(track.id, track.artistId);
        loadArtistSnippet(track.artistId, track.id);
    });

    // Attach delete listeners
    document.querySelectorAll('.delete-track-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if(!confirm("Are you sure you want to permanently delete this track?")) return;
            const trackId = e.currentTarget.getAttribute('data-id');
            try {
                e.currentTarget.innerHTML = '<div class="spinner" style="width:12px;height:12px;border-width:2px;"></div>';
                await deleteDoc(doc(db, "tracks", trackId));
                loadTracks();
            } catch(err) {
                console.error(err);
                alert("Failed to delete track.");
                e.currentTarget.innerHTML = '<i class="ph ph-trash"></i>';
            }
        });
    });

    // Attach play listeners
    document.querySelectorAll('.play-circle').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const trackId = e.currentTarget.getAttribute('data-id');
            const trackUrl = e.currentTarget.getAttribute('data-url');
            playTrack(trackId, trackUrl);
        });
    });

    // Attach download request listeners
    document.querySelectorAll('.download-track-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const trackId = e.currentTarget.getAttribute('data-id');
            const audioUrl = e.currentTarget.getAttribute('data-url');
            const trackTitle = e.currentTarget.getAttribute('data-title');
            const artistId = e.currentTarget.getAttribute('data-artist');
            handleDownloadRequest(trackId, audioUrl, trackTitle, artistId, e.currentTarget);
        });
    });

    // Attach favourite listeners
    document.querySelectorAll('.favourite-track-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if(!auth || !auth.currentUser) {
                alert("Please log in to favourite tracks.");
                return;
            }
            
            const trackId = e.currentTarget.getAttribute('data-id');
            const uid = auth.currentUser.uid;
            
            if (!window.userFavourites) window.userFavourites = new Set();
            const isFavourited = window.userFavourites.has(trackId);
            
            // Optimistic UI update
            if (isFavourited) {
                window.userFavourites.delete(trackId);
                e.currentTarget.classList.remove('favourited');
                e.currentTarget.querySelector('i').classList.replace('ph-fill', 'ph');
            } else {
                window.userFavourites.add(trackId);
                e.currentTarget.classList.add('favourited');
                e.currentTarget.querySelector('i').classList.replace('ph', 'ph-fill');
                
                // Show music animation
                if (window.createMusicNotes) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    window.createMusicNotes(rect.left + rect.width / 2, rect.top + rect.height / 2);
                }
            }

            if(isMockMode) return;

            // Background save to DB
            try {
                if (isFavourited) {
                    await deleteDoc(doc(db, "users", uid, "favourites", trackId));
                } else {
                    await setDoc(doc(db, "users", uid, "favourites", trackId), {
                        timestamp: Date.now()
                    });
                }
            } catch(err) {
                console.error("Error toggling favourite", err);
                // Revert on error
                if (isFavourited) {
                    window.userFavourites.add(trackId);
                    e.currentTarget.classList.add('favourited');
                    e.currentTarget.querySelector('i').classList.replace('ph', 'ph-fill');
                } else {
                    window.userFavourites.delete(trackId);
                    e.currentTarget.classList.remove('favourited');
                    e.currentTarget.querySelector('i').classList.replace('ph-fill', 'ph');
                }
            }
        });
    });
}

async function handleDownloadRequest(trackId, audioUrl, trackTitle, artistId, btnEl) {
    if(!auth || !auth.currentUser) {
        alert("Please log in to download tracks.");
        return;
    }
    const uid = auth.currentUser.uid;
    
    if(uid === artistId) {
        window.open(audioUrl, '_blank');
        return;
    }

    if(isMockMode) {
        alert("Download requested! (Mock Mode)");
        return;
    }

    btnEl.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;margin:0;"></div>';

    try {
        const accessRef = doc(db, "tracks", trackId, "access", uid);
        const accessDoc = await getDoc(accessRef);
        
        if (accessDoc.exists() && accessDoc.data().status === 'granted') {
            btnEl.innerHTML = '<i class="ph ph-download-simple"></i>';
            window.open(audioUrl, '_blank');
            return;
        }

        if (accessDoc.exists() && accessDoc.data().status === 'pending') {
            alert("You have already sent an access request for this track. Awaiting artist approval.");
            btnEl.innerHTML = '<i class="ph ph-download-simple"></i>';
            return;
        }

        if (accessDoc.exists() && accessDoc.data().status === 'denied') {
            alert("The artist has denied your download request for this track.");
            btnEl.innerHTML = '<i class="ph ph-prohibit" style="color:#ef4444;"></i>';
            btnEl.style.borderColor = '#ef4444';
            btnEl.style.cursor = 'not-allowed';
            btnEl.disabled = true;
            return;
        }

        // 1. Set access doc
        await setDoc(accessRef, { status: 'pending', timestamp: Date.now() });

        // 2. Find or Create chat
        const chatsRef = collection(db, "chats");
        const q = query(chatsRef, where("participants", "array-contains", uid));
        const chatsSnap = await getDocs(q);
        
        let chatId = null;
        chatsSnap.forEach(d => {
            if(d.data().participants.includes(artistId)) {
                chatId = d.id;
            }
        });

        if(!chatId) {
            const newChatRef = await addDoc(collection(db, "chats"), {
                participants: [uid, artistId],
                lastUpdated: Date.now(),
                lastMessage: "Download Request Sent"
            });
            chatId = newChatRef.id;
        }

        // 3. Send custom message
        await addDoc(collection(db, "chats", chatId, "messages"), {
            type: 'download_request',
            trackId: trackId,
            trackTitle: trackTitle,
            requesterId: uid,
            ownerId: artistId,
            status: 'delivered', // Generic chat status
            accessStatus: 'pending', // Important new decoupled state variable
            audioUrl: audioUrl,
            timestamp: Date.now(),
            text: `[Download Request]: ${trackTitle}`
        });
        
        // Update chat
        await setDoc(doc(db, "chats", chatId), {
            lastMessage: `Requested access to "${trackTitle}"`,
            lastUpdated: Date.now()
        }, {merge:true});

        // Notify
        await addDoc(collection(db, "users", artistId, "notifications"), {
            type: 'download_request',
            senderId: uid,
            text: `Requested download access for "${trackTitle}"`,
            timestamp: Date.now(),
            read: false
        });

        alert("Download request sent to the artist successfully! You will see it in Messages.");
        btnEl.innerHTML = '<i class="ph ph-check"></i>';
        
    } catch(err) {
        console.error(err);
        alert("Action failed. Try again later.");
        btnEl.innerHTML = '<i class="ph ph-download-simple"></i>';
    }
}

function setupFilters() {
    const searchInput = document.getElementById('searchInput');
    const genreFilter = document.getElementById('genreFilter');
    const typeFilter = document.getElementById('typeFilter');
    
    if(!searchInput) return;

    const applyFilters = () => {
        const search = searchInput.value.toLowerCase();
        const genre = genreFilter.value;
        const type = typeFilter.value;
        
        const filtered = tracks.filter(t => {
            const matchSearch = t.title.toLowerCase().includes(search) || t.artistName.toLowerCase().includes(search);
            const matchGenre = genre === 'all' || t.genre === genre;
            const matchType = type === 'all' || t.type === type;
            return matchSearch && matchGenre && matchType;
        });
        
        renderTracks(filtered);
    };

    searchInput.addEventListener('input', applyFilters);
    genreFilter.addEventListener('change', applyFilters);
    typeFilter.addEventListener('change', applyFilters);
}

// --- Artist Snippet Logic ---
async function loadArtistSnippet(artistId, trackId) {
    if(!artistId || isMockMode) {
        const snippet = document.getElementById(`artistSnippet-${trackId}`);
        if(snippet) snippet.querySelector('.snippet-bio').textContent = 'Electronic / Hip Hop Producer';
        return;
    }
    try {
        const userDoc = await getDoc(doc(db, "users", artistId));
        const snippet = document.getElementById(`artistSnippet-${trackId}`);
        if(userDoc.exists() && snippet) {
            const data = userDoc.data();
            if(data.photoURL) snippet.querySelector('.snippet-avatar').src = data.photoURL;
            snippet.querySelector('.snippet-bio').textContent = data.bio || 'Music Artist';
        } else if(snippet) {
            snippet.querySelector('.snippet-bio').textContent = 'Artist';
        }
    } catch(e) { }
}

// --- Rating Logic ---
function setupTrackRating(trackId, artistId) {
    const container = document.getElementById(`ratingContainer-${trackId}`);
    if(!container) return;
    const starsDiv = container.querySelector('.stars');
    const valueSpan = container.querySelector('.rating-value');
    
    // Draw 5 default stars
    starsDiv.innerHTML = Array(5).fill('<i class="ph-fill ph-star rate-star" style="cursor:pointer; transition:color 0.2s;"></i>').join('');
    const stars = starsDiv.querySelectorAll('.rate-star');
    
    // Check if user is logged in
    const currentUser = auth ? auth.currentUser : null;
    const isOwnTrack = currentUser && currentUser.uid === artistId;
    
    if (isOwnTrack) {
        starsDiv.style.opacity = '0.5';
        starsDiv.title = "You cannot rate your own track";
        stars.forEach(s => s.style.cursor = 'not-allowed');
    }

    if (!isMockMode) {
        // Real-time listener for ratings calculation
        const ratingsRef = collection(db, "tracks", trackId, "ratings");
        onSnapshot(ratingsRef, (snapshot) => {
            let total = 0;
            let count = snapshot.size;
            let userRatingValue = 0;
            
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                total += data.rating;
                if(currentUser && docSnap.id === currentUser.uid) {
                    userRatingValue = data.rating;
                }
            });
            
            const avg = count > 0 ? (total / count).toFixed(1) : 0;
            valueSpan.textContent = count > 0 ? `${avg} (${count})` : "No ratings";
            
            // Highlight stars based on user's own rating or average if not rated
            const highlightVal = userRatingValue > 0 ? userRatingValue : Math.round(avg);
            stars.forEach((star, index) => {
                star.style.color = (index < highlightVal) ? '#fbbf24' : '#475569';
            });
        });
    }

    // Click handler
    stars.forEach((star, index) => {
        star.addEventListener('click', async () => {
            if(!currentUser) {
                alert("Please log in to rate tracks.");
                return;
            }
            if(isOwnTrack) {
                alert("You cannot rate your own uploaded track.");
                return;
            }
            if(isMockMode) {
                stars.forEach((s, i) => s.style.color = (i <= index) ? '#fbbf24' : '#475569');
                valueSpan.textContent = "Thanks for rating!";
                return;
            }
            // Save rating to firestore
            const val = index + 1;
            try {
                await setDoc(doc(db, "tracks", trackId, "ratings", currentUser.uid), {
                    rating: val,
                    timestamp: Date.now()
                });
            } catch (err) {
                console.error("Failed to save rating", err);
            }
        });
        
        star.addEventListener('mouseenter', () => {
            if(!currentUser || isOwnTrack) return;
            stars.forEach((s, i) => s.style.color = (i <= index) ? '#fbbf24' : '#475569');
        });
        star.addEventListener('mouseleave', () => {
            if(!currentUser || isOwnTrack) return;
            // Let the onSnapshot handle resetting visually, or it will snap back when moved out if we had a local variable
            // For simplicity, we just trigger a DOM update or await onSnapshot
        });
    });
}

// --- Audio Player Logic ---
function playTrack(trackId, url) {
    const track = tracks.find(t => t.id === trackId);
    if(!track) return;

    document.getElementById('playerTitle').textContent = track.title;
    document.getElementById('playerArtist').textContent = track.artistName;
    document.getElementById('playerCover').src = track.coverUrl || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=300&auto=format&fit=crop';
    
    // Update play buttons visually
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
        isPlaying = false;
        updatePlayPauseIcon();
        progressBar.style.width = '0%';
        currentTimeEl.textContent = '0:00';
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
