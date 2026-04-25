import { auth, db, storage, collection, query, orderBy, getDocs, onAuthStateChanged, ref, uploadBytesResumable, getDownloadURL, deleteDoc, addDoc } from './app.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
    const profileName = document.getElementById('profileName');
    const profileRole = document.getElementById('profileRole');
    const profileBio = document.getElementById('profileBio');
    const profileImage = document.getElementById('profileImage');
    const profileExpertise = document.getElementById('profileExpertise');
    
    // Modal Elements
    const editProfileBtn = document.getElementById('editProfileBtn');
    const editProfileModal = document.getElementById('editProfileModal');
    const closeEditModal = document.getElementById('closeEditModal');
    const editProfileForm = document.getElementById('editProfileForm');
    const editImagePreview = document.getElementById('editImagePreview');
    const profileImageUpload = document.getElementById('profileImageUpload');
    const editStatus = document.getElementById('editStatus');
    const saveProfileBtn = document.getElementById('saveProfileBtn');

    let currentUserId = null;
    let viewingOwnProfile = false;

    // By default hide modal proper through css or class
    editProfileModal.style.display = 'none';

    onAuthStateChanged(auth, async (user) => {
        if(user) {
            currentUserId = user.uid;
            
            const urlParams = new URLSearchParams(window.location.search);
            const routeArtistId = urlParams.get('artistId');
            const routeArtistName = urlParams.get('artist');
            
            let targetUid = user.uid;
            viewingOwnProfile = true;
            
            if (routeArtistId && routeArtistId !== user.uid) {
                targetUid = routeArtistId;
                viewingOwnProfile = false;
            } else if (!routeArtistId && routeArtistName && routeArtistName !== user.displayName) {
                targetUid = null;
                viewingOwnProfile = false;
            }
            
            profileName.textContent = viewingOwnProfile ? (user.displayName || 'Unnamed Artist') : (routeArtistName || 'Artist Name');
            
            if (viewingOwnProfile) {
                editProfileBtn.style.display = 'inline-block';
                document.getElementById('messageBtn').style.display = 'none';
                document.getElementById('followBtn').style.display = 'none';
            } else {
                editProfileBtn.style.display = 'none';
                document.getElementById('messageBtn').style.display = 'inline-block';
                document.getElementById('followBtn').style.display = 'inline-block';
                
                // Set follow button initial state
                if (window.userFollowing && window.userFollowing.has(targetUid)) {
                    document.getElementById('followBtnText').textContent = 'Following';
                    document.getElementById('followBtn').querySelector('i').classList.replace('ph-user-plus', 'ph-check');
                }
            }
            
            // Fetch User Docs
            await loadUserProfile(targetUid);
            await loadUserTracks(targetUid, viewingOwnProfile ? user.displayName : routeArtistName);
            await loadFollowerCount(targetUid);
        } else {
            profileName.textContent = 'Artist Name';
            profileBio.textContent = 'Please log in to view your profile.';
        }
    });

    const messageBtn = document.getElementById('messageBtn');
    if (messageBtn) {
        messageBtn.addEventListener('click', () => {
             const urlParams = new URLSearchParams(window.location.search);
             const targetUid = urlParams.get('artistId');
             if(!targetUid || !currentUserId) {
                 if (!targetUid && currentUserId) alert("Cannot message this artist: no unique ID found for legacy profile.");
                 return;
             }
             window.location.href = `chat.html?contactId=${targetUid}&contactName=${encodeURIComponent(profileName.textContent)}`;
        });
    }

    const followBtn = document.getElementById('followBtn');
    if (followBtn) {
        followBtn.addEventListener('click', async () => {
             const urlParams = new URLSearchParams(window.location.search);
             const targetUid = urlParams.get('artistId');
             if(!targetUid || !currentUserId) {
                 alert("You must be logged in to follow.");
                 return;
             }

             if (!window.userFollowing) window.userFollowing = new Set();
             const isFollowing = window.userFollowing.has(targetUid);
             const followBtnText = document.getElementById('followBtnText');
             const followIcon = followBtn.querySelector('i');
             const countDisplay = document.getElementById('followerCountDisplay');
             let currentCount = parseInt(countDisplay.textContent) || 0;

             // Optimistic UI
             if (isFollowing) {
                 window.userFollowing.delete(targetUid);
                 followBtnText.textContent = 'Follow';
                 followIcon.classList.replace('ph-check', 'ph-user-plus');
                 countDisplay.textContent = Math.max(0, currentCount - 1) + ' followers';
             } else {
                 window.userFollowing.add(targetUid);
                 followBtnText.textContent = 'Following';
                 followIcon.classList.replace('ph-user-plus', 'ph-check');
                 countDisplay.textContent = (currentCount + 1) + ' followers';
             }

             // Background Save
             try {
                 if (isFollowing) {
                     await deleteDoc(doc(db, "users", currentUserId, "following", targetUid));
                     await deleteDoc(doc(db, "users", targetUid, "followers", currentUserId));
                 } else {
                     await setDoc(doc(db, "users", currentUserId, "following", targetUid), { timestamp: Date.now() });
                     await setDoc(doc(db, "users", targetUid, "followers", currentUserId), { timestamp: Date.now() });
                     
                     // Send Notification
                     await addDoc(collection(db, "users", targetUid, "notifications"), {
                         type: 'new_follower',
                         senderId: currentUserId,
                         timestamp: Date.now(),
                         read: false
                     });
                 }
             } catch(err) {
                 console.error("Follow error", err);
             }
        });
    }

    async function loadFollowerCount(uid) {
        if(!uid) return;
        try {
            const snap = await getDocs(collection(db, "users", uid, "followers"));
            document.getElementById('followerCountDisplay').textContent = snap.size + (snap.size === 1 ? ' follower' : ' followers');
        } catch(e) {}
    }

    async function loadUserProfile(uid) {
        if (!uid) {
            profileRole.textContent = "Music Artist";
            profileBio.textContent = "Legacy profile (uploaded before profile ID tracking). Details unavailable.";
            return;
        }
        try {
            const userDoc = await getDoc(doc(db, "users", uid));
            if(userDoc.exists()) {
                const data = userDoc.data();
                if(data.role) profileRole.textContent = data.role;
                if(data.bio) profileBio.textContent = data.bio;
                if(data.photoURL) {
                    profileImage.src = data.photoURL;
                    editImagePreview.src = data.photoURL;
                }
                if(data.expertise) {
                    profileExpertise.innerHTML = '';
                    data.expertise.split(',').forEach(item => {
                        profileExpertise.innerHTML += `<span class="badge" style="background:rgba(99,102,241,0.2); color:#a5b4fc;">${item.trim()}</span>`;
                    });
                }
                
                // Pre-fill form
                document.getElementById('editRole').value = data.role || '';
                document.getElementById('editBio').value = data.bio || '';
                document.getElementById('editExpertise').value = data.expertise || '';
            }
        } catch (error) {
            console.error("Error loading user profile:", error);
        }
    }

    // Modal behavior
    editProfileBtn.addEventListener('click', () => {
        editProfileModal.style.display = 'flex';
    });

    closeEditModal.addEventListener('click', (e) => {
        e.preventDefault();
        editProfileModal.style.display = 'none';
    });
    
    profileImageUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if(file) {
            editImagePreview.src = URL.createObjectURL(file);
        }
    });

    editProfileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if(!currentUserId) return;

        saveProfileBtn.disabled = true;
        editStatus.style.display = 'block';

        const role = document.getElementById('editRole').value;
        const bio = document.getElementById('editBio').value;
        const expertise = document.getElementById('editExpertise').value;
        const file = profileImageUpload.files[0];

        try {
            let photoUrlToSave = profileImage.src;

            if(file) {
                editStatus.textContent = "Uploading image...";
                const fileRef = ref(storage, `profiles/${currentUserId}_${Date.now()}`);
                const uploadTask = await uploadBytesResumable(fileRef, file);
                photoUrlToSave = await getDownloadURL(uploadTask.ref);
            }

            editStatus.textContent = "Saving profile data...";
            await setDoc(doc(db, "users", currentUserId), {
                role: role,
                bio: bio,
                expertise: expertise,
                photoURL: photoUrlToSave
            }, { merge: true });

            editStatus.textContent = "Success!";
            editStatus.style.color = "var(--success)";
            
            setTimeout(() => {
                editProfileModal.style.display = 'none';
                saveProfileBtn.disabled = false;
                editStatus.style.display = 'none';
                editStatus.style.color = "var(--primary-color)";
                loadUserProfile(currentUserId);
            }, 1000);

        } catch (error) {
            console.error(error);
            editStatus.textContent = "Failed to save.";
            editStatus.style.color = "red";
            saveProfileBtn.disabled = false;
        }
    });

    // Load profile specific tracks
    async function loadUserTracks(artistId, artistName) {
        const container = document.getElementById('profileTracksContainer');
        if(!container || (!artistId && !artistName)) return;

        try {
            const q = query(collection(db, "tracks"), orderBy("timestamp", "desc"));
            const snapshot = await getDocs(q);
            let tracks = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                if(data.artistId === artistId || (artistName && data.artistName === artistName)) {
                    tracks.push({ id: doc.id, ...data });
                }
            });

            container.innerHTML = '';
            if(tracks.length === 0) {
                container.innerHTML = '<p style="color:var(--text-secondary)">No portfolio tracks uploaded yet.</p>';
                return;
            }

            tracks.forEach(track => {
                container.innerHTML += `
                    <div class="track-card card glass playlist-track-card" style="position:relative;">
                        ${(currentUserId && currentUserId === track.artistId) ? `<button class="delete-track-btn" data-id="${track.id}" style="position:absolute; top:8px; right:8px; background:rgba(239,68,68,0.8); color:white; border:none; border-radius:50%; width:28px; height:28px; display:flex; justify-content:center; align-items:center; cursor:pointer; z-index:10; transition:0.2s;"><i class="ph ph-trash"></i></button>` : ''}
                        <img src="${track.coverUrl || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=300&auto=format&fit=crop'}" class="track-cover" style="margin-bottom:12px;">
                        <div>
                            <h4 style="margin-bottom:4px; font-size:1rem;">${track.title}</h4>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:0;">${track.genre} • <i class="ph ph-shield-check" style="color:var(--success)"></i></p>
                                <button class="favourite-track-btn ${window.userFavourites && window.userFavourites.has(track.id) ? 'favourited' : ''}" data-id="${track.id}" style="width:24px; height:24px; font-size:0.9rem;">
                                    <i class="${window.userFavourites && window.userFavourites.has(track.id) ? 'ph-fill' : 'ph'} ph-heart"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            // Attach delete listeners
            document.querySelectorAll('#profileTracksContainer .delete-track-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    if(!confirm("Are you sure you want to permanently delete this track?")) return;
                    const trackId = e.currentTarget.getAttribute('data-id');
                    try {
                        e.currentTarget.innerHTML = '<div class="spinner" style="width:10px;height:10px;border-width:2px;margin:0;"></div>';
                        await deleteDoc(doc(db, "tracks", trackId));
                        loadUserTracks(artistId, artistName);
                    } catch(err) {
                        console.error(err);
                        alert("Failed to delete track.");
                        e.currentTarget.innerHTML = '<i class="ph ph-trash"></i>';
                    }
                });
            });

            // Attach favourite listeners
            document.querySelectorAll('#profileTracksContainer .favourite-track-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    if(!auth || !auth.currentUser) {
                        alert("Please log in to favourite tracks.");
                        return;
                    }
                    const trackId = e.currentTarget.getAttribute('data-id');
                    const uid = auth.currentUser.uid;
                    
                    if (!window.userFavourites) window.userFavourites = new Set();
                    const isFavourited = window.userFavourites.has(trackId);
                    
                    // Optimistic UI
                    if (isFavourited) {
                        window.userFavourites.delete(trackId);
                        e.currentTarget.classList.remove('favourited');
                        e.currentTarget.querySelector('i').classList.replace('ph-fill', 'ph');
                    } else {
                        window.userFavourites.add(trackId);
                        e.currentTarget.classList.add('favourited');
                        e.currentTarget.querySelector('i').classList.replace('ph', 'ph-fill');
                        
                        if (window.createMusicNotes) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            window.createMusicNotes(rect.left + rect.width / 2, rect.top + rect.height / 2);
                        }
                    }
                    
                    // Background DB Sync
                    try {
                        if (isFavourited) {
                            await deleteDoc(doc(db, "users", uid, "favourites", trackId));
                        } else {
                            await setDoc(doc(db, "users", uid, "favourites", trackId), { timestamp: Date.now() });
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

        } catch(e) {
            console.error(e);
            container.innerHTML = '<p>Error loading portfolio.</p>';
        }
    }
    
    // Default interactive rating logic remains
    const stars = document.querySelectorAll('.rate-star');
    const feedback = document.getElementById('ratingFeedback');
    stars.forEach(star => {
        star.addEventListener('click', (e) => {
            const val = e.target.getAttribute('data-val');
            stars.forEach(s => {
                s.style.color = s.getAttribute('data-val') <= val ? '#fbbf24' : '#475569';
            });
            feedback.style.display = 'block';
            setTimeout(() => { feedback.style.display = 'none'; }, 3000);
        });
    });
});
