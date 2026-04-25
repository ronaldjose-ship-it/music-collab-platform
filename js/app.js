import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, onSnapshot, doc, getDoc, setDoc, where, deleteDoc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

// Import Firebase Config
import { firebaseConfig } from './firebase-config.js';

// Check if Firebase is configured
export const isMockMode = !firebaseConfig.apiKey;

let app, db, storage, auth;

if (!isMockMode) {
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        storage = getStorage(app);
        auth = getAuth(app);
        console.log("Firebase initialized successfully");
    } catch (e) {
        console.error("Firebase init failed, falling back to mock mode", e);
    }
} else {
    console.warn("No Firebase Config found. Running in MOCK MODE using LocalStorage.");
}

export { db, storage, auth, collection, addDoc, getDocs, query, orderBy, onSnapshot, ref, uploadBytesResumable, getDownloadURL, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile, sendPasswordResetEmail, doc, getDoc, setDoc, where, deleteDoc, updateDoc, arrayUnion, arrayRemove };

// --- Mock Database Implementation (For Local Verification) ---
export const mockDB = {
    getTracks: () => {
        const defaultTracks = [
            {
                id: '1',
                title: 'Neon Nights',
                artistName: 'SynthMaster',
                genre: 'electronic',
                type: 'instrumental',
                coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=300&auto=format&fit=crop',
                audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
                timestamp: Date.now() - 86400000 
            },
            {
                id: '2',
                title: 'Acoustic Sunrise',
                artistName: 'Elena Vocals',
                genre: 'pop',
                type: 'full',
                coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=300&auto=format&fit=crop',
                audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
                timestamp: Date.now() - 172800000
            },
            {
                id: '3',
                title: 'Urban Groove',
                artistName: 'DJ Horizon',
                genre: 'hiphop',
                type: 'instrumental',
                coverUrl: 'https://images.unsplash.com/photo-1493225457124-a1a2a5f5f92e?q=80&w=300&auto=format&fit=crop',
                audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
                timestamp: Date.now() - 259200000
            }
        ];
        
        const localTracks = JSON.parse(localStorage.getItem('mockTracks') || '[]');
        return [...localTracks, ...defaultTracks];
    },
    
    addTrack: (trackData) => {
        const localTracks = JSON.parse(localStorage.getItem('mockTracks') || '[]');
        const newTrack = {
            id: Date.now().toString(),
            coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=300&auto=format&fit=crop',
            ...trackData,
            timestamp: Date.now()
        };
        localTracks.unshift(newTrack);
        localStorage.setItem('mockTracks', JSON.stringify(localTracks));
        return Promise.resolve(newTrack.id);
    }
};

// --- Format Utilities ---
export const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
    });
};

// Global mobile menu toggle and Auth UI
document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    
    if(menuToggle && navLinks) {
        menuToggle.addEventListener('click', () => {
            navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
            navLinks.style.flexDirection = 'column';
            navLinks.style.position = 'absolute';
            navLinks.style.top = '70px';
            navLinks.style.left = '0';
            navLinks.style.width = '100%';
            navLinks.style.background = 'var(--surface-color)';
            navLinks.style.padding = '16px';
            navLinks.style.borderBottom = '1px solid var(--border-color)';
        });
    }

    // Scroll Animations Setup
    const scrollObserverOptions = {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px"
    };

    const scrollObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-visible');
                // Optional: stop observing if it only needs to animate once
                // scrollObserver.unobserve(entry.target);
            }
        });
    }, scrollObserverOptions);

    // Initial query for elements to animate
    const initialElements = document.querySelectorAll('.card, .track-card, .page-header, .upload-container, .profile-header');
    initialElements.forEach(el => {
        if(!el.closest('.nav-container') && !el.closest('.navbar')) {
            el.classList.add('scroll-hidden');
            scrollObserver.observe(el);
            
            // Add music floating notes effect to play button if it exists
            const playBtn = el.querySelector('.play-circle');
            if (playBtn) {
                playBtn.addEventListener('click', function(e) {
                    createMusicNotes(e.clientX, e.clientY);
                });
            }
        }
    });

    // Observe dynamically added elements (like tracks fetched from DB)
    const domObserver = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if(node.nodeType === 1) { // Element node
                    if(node.classList.contains('track-card') || node.classList.contains('card')) {
                        node.classList.add('scroll-hidden');
                        scrollObserver.observe(node);
                        
                        // Add music floating notes effect to play button
                        const playBtn = node.querySelector('.play-circle');
                        if (playBtn) {
                            playBtn.addEventListener('click', function(e) {
                                createMusicNotes(e.clientX, e.clientY);
                            });
                        }
                    }
                }
            });
        });
    });
    domObserver.observe(document.body, { childList: true, subtree: true });

    // Function to create floating music notes
    window.createMusicNotes = function(x, y) {
        const notes = ['♪', '♫', '♬', '♩'];
        for(let i = 0; i < 3; i++) {
            const note = document.createElement('div');
            note.className = 'floating-note';
            note.textContent = notes[Math.floor(Math.random() * notes.length)];
            note.style.left = (x + (Math.random() * 40 - 20)) + 'px';
            note.style.top = (y + (Math.random() * 40 - 20)) + 'px';
            
            // Randomize animation slightly
            note.style.animationDuration = (1 + Math.random()) + 's';
            
            document.body.appendChild(note);
            
            setTimeout(() => {
                note.remove();
            }, 2000);
        }
    };

    // Global Auth UI State
    if(!isMockMode && auth) {
        onAuthStateChanged(auth, (user) => {
            const navAuthLink = document.getElementById('navAuthLink');
            const navProfileLink = document.getElementById('navProfileLink');
            const navChatLink = document.getElementById('navChatLink');
            const navLogoutLink = document.getElementById('navLogoutLink');
            const navFavouritesLink = document.getElementById('navFavouritesLink');
            const navStudiosLink = document.getElementById('navStudiosLink');
            
            if(user) {
                // Logged in
                initNotifications(user.uid);
                healLegacyTracks(user);
                
                // Fetch favourites right away so it's globally available
                getDocs(collection(db, "users", user.uid, "favourites")).then(favqs => {
                    const newFavs = new Set();
                    favqs.forEach(doc => newFavs.add(doc.id));
                    window.userFavourites = newFavs;
                    document.dispatchEvent(new Event('favouritesLoaded'));
                }).catch(e => console.error(e));

                // Fetch following list
                getDocs(collection(db, "users", user.uid, "following")).then(followQs => {
                    const newFollowing = new Set();
                    followQs.forEach(doc => newFollowing.add(doc.id));
                    window.userFollowing = newFollowing;
                    document.dispatchEvent(new Event('followingLoaded'));
                }).catch(e => console.error(e));

                if(navAuthLink) navAuthLink.style.display = 'none';
                if(navProfileLink) {
                    navProfileLink.style.display = 'inline-block';
                    navProfileLink.textContent = user.displayName ? user.displayName : 'My Profile';
                }
                if(navChatLink) navChatLink.style.display = 'inline-block';
                if(navFavouritesLink) navFavouritesLink.style.display = 'inline-block';
                if(navStudiosLink) navStudiosLink.style.display = 'inline-block';

                if(navLogoutLink) {
                    navLogoutLink.style.display = 'inline-block';
                    navLogoutLink.addEventListener('click', (e) => {
                        e.preventDefault();
                        signOut(auth).then(() => window.location.reload());
                    });
                }
            } else {
                // Logged out
                if(navAuthLink) {
                    navAuthLink.style.display = 'inline-block';
                    navAuthLink.textContent = 'Login';
                }
                if(navProfileLink) navProfileLink.style.display = 'none';
                if(navChatLink) navChatLink.style.display = 'none';
                if(navLogoutLink) navLogoutLink.style.display = 'none';
                if(navFavouritesLink) navFavouritesLink.style.display = 'none';
                if(navStudiosLink) navStudiosLink.style.display = 'none';
            }
        });
    }
});

// --- Push Notification Init ---
function initNotifications(uid) {
    if(isMockMode) return;
    
    let navContainer = document.querySelector('.nav-container');
    if(!navContainer) return;

    if(!document.getElementById('navNotificationContainer')) {
        const notifHtml = `
            <div id="navNotificationContainer" style="position:relative; margin-right:16px; display:flex; align-items:center;">
                <button id="notificationBtn" style="background:none; border:none; color:white; font-size:1.5rem; cursor:pointer; position:relative; padding:8px;">
                    <i class="ph ph-bell"></i>
                    <span id="notificationBadge" style="display:none; position:absolute; top:2px; right:2px; background:var(--accent-color); color:white; font-size:0.65rem; font-weight:bold; padding:2px 6px; border-radius:10px;">0</span>
                </button>
                <div id="notificationDropdown" class="glass card" style="display:none; position:absolute; top:48px; right:0; width:300px; max-height:400px; overflow-y:auto; z-index:100; padding:0; background: rgba(5, 5, 8, 0.95); border: 1px solid var(--border-color);">
                    <div style="padding:12px 16px; border-bottom:1px solid var(--border-color); font-weight:600; text-align:left;">Notifications</div>
                    <div id="notificationList" style="text-align:left;"></div>
                    <div id="markReadBtn" style="padding:12px; text-align:center; font-size:0.8rem; color:var(--primary-color); cursor:pointer; border-top:1px solid var(--border-color);">Mark all as read</div>
                </div>
            </div>
        `;
        const menuToggle = document.querySelector('.menu-toggle');
        if(menuToggle) {
            menuToggle.insertAdjacentHTML('beforebegin', notifHtml);
        } else {
            navContainer.insertAdjacentHTML('beforeend', notifHtml);
        }
    }

    const notifBtn = document.getElementById('notificationBtn');
    const notifDropdown = document.getElementById('notificationDropdown');
    const notifList = document.getElementById('notificationList');
    const badge = document.getElementById('notificationBadge');
    const markReadBtn = document.getElementById('markReadBtn');
    let unreadDocs = [];

    notifBtn.onclick = () => {
        notifDropdown.style.display = notifDropdown.style.display === 'none' ? 'block' : 'none';
    };

    const q = query(collection(db, "users", uid, "notifications"), orderBy("timestamp", "desc"));
    onSnapshot(q, async (snapshot) => {
        notifList.innerHTML = '';
        unreadDocs = [];
        
        if(snapshot.empty) {
            notifList.innerHTML = '<div style="padding:16px; color:var(--text-secondary); text-align:center; font-size:0.9rem;">No new notifications</div>';
            badge.style.display = 'none';
            return;
        }

        let unreadCount = 0;
        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            if(!data.read) {
                unreadCount++;
                unreadDocs.push(docSnap.id);
            }
            
            let senderName = "User";
            try {
               const sDoc = await getDoc(doc(db, "users", data.senderId));
               if(sDoc.exists()) senderName = sDoc.data().displayName || "Artist";
            } catch(e) {}
            
            const time = new Date(data.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            const bg = data.read ? 'transparent' : 'rgba(99,102,241,0.1)';
            
            const item = document.createElement('div');
            item.style = `padding:12px 16px; border-bottom:1px solid var(--border-color); cursor:pointer; background:${bg}; transition:background 0.2s;`;
            item.onmouseover = () => item.style.background = 'var(--surface-light)';
            item.onmouseout = () => item.style.background = bg;
            if (data.type === 'studio_invite') {
                item.style.cursor = 'default';
                item.innerHTML = `
                    <div style="font-size:0.85rem; font-weight:600; margin-bottom:4px; color:var(--text-primary);">Studio Invite</div>
                    <div style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:4px;">${senderName} invited you to join "${data.studioName}"</div>
                    <div style="font-size:0.7rem; color:var(--text-secondary); margin-bottom:6px;">${time}</div>
                    ${(!data.state || data.state === 'pending') ? `
                        <div style="display:flex; gap:8px;">
                            <button class="btn-primary accept-invite-btn" style="padding:4px 8px; width:auto; flex-grow:1; font-size:0.8rem;">Accept</button>
                            <button class="btn-secondary deny-invite-btn" style="padding:4px 8px; width:auto; flex-grow:1; font-size:0.8rem;">Deny</button>
                        </div>
                    ` : `<div style="font-size:0.8rem; color:var(--text-secondary); font-style:italic;">Invite ${data.state}</div>`}
                `;
                
                const acceptBtn = item.querySelector('.accept-invite-btn');
                const denyBtn = item.querySelector('.deny-invite-btn');
                if (acceptBtn) {
                    acceptBtn.onclick = async (e) => {
                        e.stopPropagation();
                        acceptBtn.innerHTML = '...';
                        try {
                            const studioRef = doc(db, "studios", data.studioId);
                            // arrayRemove is imported globally in app.js if needed, or we just do a direct db call
                            // Because of firebase modular, let's use the exported arrayUnion/Remove
                            await updateDoc(studioRef, {
                                pendingInvites: arrayRemove(uid),
                                members: arrayUnion(uid)
                            });
                            await setDoc(doc(db, "users", uid, "notifications", docSnap.id), { state: 'accepted', read: true }, { merge: true });
                        } catch(err) { console.error(err); acceptBtn.innerHTML = 'Error'; }
                    };
                }
                if (denyBtn) {
                    denyBtn.onclick = async (e) => {
                        e.stopPropagation();
                        denyBtn.innerHTML = '...';
                        try {
                            const studioRef = doc(db, "studios", data.studioId);
                            await updateDoc(studioRef, {
                                pendingInvites: arrayRemove(uid)
                            });
                            await setDoc(doc(db, "users", uid, "notifications", docSnap.id), { state: 'denied', read: true }, { merge: true });
                        } catch(err) { console.error(err); denyBtn.innerHTML = 'Error'; }
                    };
                }
            } else if (data.type === 'new_follower') {
                item.onclick = async () => {
                    if(!data.read) await setDoc(doc(db, "users", uid, "notifications", docSnap.id), {read:true}, {merge:true});
                    window.location.href = `profile.html?artistId=${data.senderId}&artist=${encodeURIComponent(senderName)}`;
                };
                item.innerHTML = `
                    <div style="font-size:0.85rem; font-weight:600; margin-bottom:4px; color:var(--primary-color);">New Follower!</div>
                    <div style="font-size:0.8rem; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${senderName} started following you</div>
                    <div style="font-size:0.7rem; color:var(--text-secondary); margin-top:6px;">${time}</div>
                `;
            } else if (data.type === 'new_track') {
                item.onclick = async () => {
                    if(!data.read) await setDoc(doc(db, "users", uid, "notifications", docSnap.id), {read:true}, {merge:true});
                    window.location.href = `profile.html?artistId=${data.artistId}&artist=${encodeURIComponent(data.artistName)}`;
                };
                item.innerHTML = `
                    <div style="font-size:0.85rem; font-weight:600; margin-bottom:4px; color:var(--accent-color);">New Music Released</div>
                    <div style="font-size:0.8rem; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${data.artistName} uploaded a track: "${data.trackTitle}"</div>
                    <div style="font-size:0.7rem; color:var(--text-secondary); margin-top:6px;">${time}</div>
                `;
            } else {
                item.onclick = async () => {
                    if(!data.read) await setDoc(doc(db, "users", uid, "notifications", docSnap.id), {read:true}, {merge:true});
                    window.location.href = `chat.html?contactId=${data.senderId}`;
                };
                
                item.innerHTML = `
                    <div style="font-size:0.85rem; font-weight:600; margin-bottom:4px; color:var(--text-primary);">${senderName} sent a message</div>
                    <div style="font-size:0.8rem; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">"${data.text}"</div>
                    <div style="font-size:0.7rem; color:var(--text-secondary); margin-top:6px;">${time}</div>
                `;
            }
            notifList.appendChild(item);
        }
        
        if(unreadCount > 0) {
            badge.textContent = unreadCount;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    });
    
    markReadBtn.onclick = async () => {
        for(let nid of unreadDocs) {
            try { await setDoc(doc(db, "users", uid, "notifications", nid), {read:true}, {merge:true}); } catch(e) {}
        }
    };
}

async function healLegacyTracks(user) {
    if(!user.displayName || isMockMode) return;
    try {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        if(!userDoc.exists() || !userDoc.data().displayName) {
            await setDoc(userDocRef, { displayName: user.displayName }, {merge: true});
        }
        
        const q = query(collection(db, "tracks"), where("artistName", "==", user.displayName));
        const snapshot = await getDocs(q);
        snapshot.forEach(async (docSnap) => {
            const data = docSnap.data();
            if(!data.artistId) {
                await setDoc(doc(db, "tracks", docSnap.id), { artistId: user.uid }, {merge: true});
            }
        });
    } catch(e) {}
}
