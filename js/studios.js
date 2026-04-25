import { auth, db, storage, collection, addDoc, getDocs, query, orderBy, onSnapshot, doc, getDoc, setDoc, where, updateDoc, arrayUnion, ref, uploadBytesResumable, getDownloadURL, isMockMode } from './app.js';

document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const openCreateStudioBtn = document.getElementById('openCreateStudioBtn');
    const createStudioModal = document.getElementById('createStudioModal');
    const closeCreateModal = document.getElementById('closeCreateModal');
    const submitCreateStudio = document.getElementById('submitCreateStudio');
    const newStudioName = document.getElementById('newStudioName');
    
    const studiosList = document.getElementById('studiosList');
    const studioPlaceholder = document.getElementById('studioPlaceholder');
    const studioContent = document.getElementById('studioContent');
    const activeStudioName = document.getElementById('activeStudioName');
    const activeStudioMembers = document.getElementById('activeStudioMembers');
    
    // Tabs
    const tabs = document.querySelectorAll('.studio-tab');
    const tabContentChat = document.getElementById('tabContent-chat');
    const tabContentFiles = document.getElementById('tabContent-files');
    
    // Chat
    const studioMessages = document.getElementById('studioMessages');
    const studioMessageInput = document.getElementById('studioMessageInput');
    const studioSendBtn = document.getElementById('studioSendBtn');
    
    // Files
    const studioFileInput = document.getElementById('studioFileInput');
    const fileUploadStatus = document.getElementById('fileUploadStatus');
    const studioFilesList = document.getElementById('studioFilesList');
    
    // Invite Modal
    const inviteBtn = document.getElementById('inviteBtn');
    const inviteModal = document.getElementById('inviteModal');
    const closeInviteModal = document.getElementById('closeInviteModal');
    const userSearchInput = document.getElementById('userSearchInput');
    const userSearchResults = document.getElementById('userSearchResults');

    let currentUserId = null;
    let activeStudioId = null;
    let unsubscribeMessages = null;
    let unsubscribeFiles = null;
    let unsubscribeStudios = null;

    auth.onAuthStateChanged(async (user) => {
        if(user) {
            currentUserId = user.uid;
            initStudios();
        } else {
            studiosList.innerHTML = '<p style="padding:16px;">Please log in to view your studios.</p>';
        }
    });

    // --- Tab Logic ---
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const target = tab.getAttribute('data-tab');
            if(target === 'chat') {
                tabContentChat.style.display = 'flex';
                tabContentFiles.style.display = 'none';
                studioMessages.scrollTop = studioMessages.scrollHeight;
            } else {
                tabContentChat.style.display = 'none';
                tabContentFiles.style.display = 'flex';
            }
        });
    });

    // --- Studio Creation ---
    openCreateStudioBtn.addEventListener('click', () => createStudioModal.style.display = 'flex');
    closeCreateModal.addEventListener('click', () => {
        createStudioModal.style.display = 'none';
        newStudioName.value = '';
    });

    submitCreateStudio.addEventListener('click', async () => {
        const name = newStudioName.value.trim();
        if(!name || !currentUserId) return;
        
        submitCreateStudio.disabled = true;
        submitCreateStudio.textContent = 'Creating...';

        try {
            const newStudioRef = await addDoc(collection(db, "studios"), {
                name: name,
                creatorId: currentUserId,
                members: [currentUserId],
                pendingInvites: [],
                lastUpdated: Date.now()
            });
            
            createStudioModal.style.display = 'none';
            newStudioName.value = '';
            openStudio(newStudioRef.id);
        } catch(err) {
            console.error("Error creating studio", err);
            alert("Failed to create studio.");
        } finally {
            submitCreateStudio.disabled = false;
            submitCreateStudio.textContent = 'Create Room';
        }
    });

    // --- Fetch Studios ---
    function initStudios() {
        const q = query(collection(db, "studios"), where("members", "array-contains", currentUserId));
        unsubscribeStudios = onSnapshot(q, (snapshot) => {
            let studios = [];
            snapshot.forEach(docSnap => {
                studios.push({ id: docSnap.id, ...docSnap.data() });
            });
            
            studios.sort((a,b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
            renderStudiosList(studios);
        });
    }

    function renderStudiosList(studios) {
        studiosList.innerHTML = '';
        if(studios.length === 0) {
            studiosList.innerHTML = '<p style="padding:16px; color:var(--text-secondary);">You are not in any studios.</p>';
            return;
        }

        studios.forEach(studio => {
            const isActive = activeStudioId === studio.id;
            const bg = isActive ? 'rgba(99,102,241,0.1)' : 'transparent';
            const border = isActive ? '3px solid var(--primary-color)' : '3px solid transparent';
            
            const div = document.createElement('div');
            div.style = `padding: 16px; display:flex; align-items:center; gap:12px; cursor:pointer; background:${bg}; border-left:${border}; transition:background 0.2s;`;
            div.onmouseover = () => { if(!isActive) div.style.background='var(--surface-light)'; };
            div.onmouseout = () => { if(!isActive) div.style.background='transparent'; };
            div.onclick = () => openStudio(studio.id);
            
            div.innerHTML = `
                <div style="width:40px; height:40px; border-radius:8px; background:var(--surface-light); display:flex; justify-content:center; align-items:center; color:var(--primary-color);">
                    <i class="ph-fill ph-users-three" style="font-size:1.5rem;"></i>
                </div>
                <div style="flex-grow:1; overflow:hidden;">
                    <h4 style="font-size:0.95rem; margin-bottom:2px; white-space:nowrap; text-overflow:ellipsis;">${studio.name}</h4>
                    <p style="font-size:0.8rem; color:var(--text-secondary);">${studio.members.length} member(s)</p>
                </div>
            `;
            studiosList.appendChild(div);
        });
    }

    // --- Open Studio ---
    async function openStudio(studioId) {
        activeStudioId = studioId;
        studioPlaceholder.style.display = 'none';
        studioContent.style.display = 'flex';
        
        // Listen to active studio metadata
        onSnapshot(doc(db, "studios", studioId), (docSnap) => {
            if(docSnap.exists()) {
                const data = docSnap.data();
                activeStudioName.textContent = data.name;
                activeStudioMembers.textContent = `${data.members.length} member(s)`;
            }
        });

        // Chat listener
        if(unsubscribeMessages) unsubscribeMessages();
        const mq = query(collection(db, "studios", studioId, "messages"), orderBy("timestamp", "asc"));
        unsubscribeMessages = onSnapshot(mq, (snapshot) => {
            studioMessages.innerHTML = '';
            snapshot.forEach(docSnap => {
                const msg = docSnap.data();
                const isMine = msg.senderId === currentUserId;
                const time = new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                
                const align = isMine ? 'align-self: flex-end;' : 'align-self: flex-start;';
                const bg = isMine ? 'background:var(--primary-color); border-bottom-right-radius:2px;' : 'background:var(--surface-light); border-bottom-left-radius:2px;';
                
                const html = `
                    <div style="${align} max-width: 85%; animation: slideIn 0.3s ease-out;">
                        <span style="font-size:0.7rem; color:var(--text-secondary); margin-bottom:2px; display:block;">${isMine ? 'You' : msg.senderName || 'Member'}</span>
                        <div style="${bg} padding:12px 16px; border-radius:12px; margin-bottom:4px;">
                            ${msg.text}
                        </div>
                        <div style="font-size:0.7rem; color:var(--text-secondary); text-align:${isMine ? 'right' : 'left'}; margin-top:4px;">
                            ${time}
                        </div>
                    </div>
                `;
                studioMessages.insertAdjacentHTML('beforeend', html);
            });
            studioMessages.scrollTop = studioMessages.scrollHeight;
        });

        // Files listener
        if(unsubscribeFiles) unsubscribeFiles();
        const fq = query(collection(db, "studios", studioId, "files"), orderBy("timestamp", "desc"));
        unsubscribeFiles = onSnapshot(fq, (snapshot) => {
            studioFilesList.innerHTML = '';
            if(snapshot.empty) {
                studioFilesList.innerHTML = '<div style="color:var(--text-secondary); text-align:center; padding:20px;">No files shared yet.</div>';
                return;
            }
            snapshot.forEach(docSnap => {
                const file = docSnap.data();
                const time = new Date(file.timestamp).toLocaleDateString();
                
                let icon = 'ph-file';
                let color = 'white';
                if(file.type.startsWith('audio/')) { icon = 'ph-file-audio'; color = 'var(--accent-color)'; }
                else if(file.type.startsWith('image/')) { icon = 'ph-file-image'; color = 'var(--primary-color)'; }
                
                const html = `
                    <div class="file-item">
                        <div style="display:flex; align-items:center; gap:12px; overflow:hidden;">
                            <div style="width:40px; height:40px; border-radius:8px; background:rgba(255,255,255,0.05); display:flex; justify-content:center; align-items:center;">
                                <i class="ph-fill ${icon}" style="font-size:1.5rem; color:${color};"></i>
                            </div>
                            <div style="overflow:hidden;">
                                <p style="margin:0; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${file.name}</p>
                                <p style="margin:0; font-size:0.75rem; color:var(--text-secondary);">Uploaded by ${file.uploaderName || 'User'} • ${time}</p>
                            </div>
                        </div>
                        <a href="${file.url}" target="_blank" class="btn-secondary" style="width:auto; padding:6px 12px; text-decoration:none;"><i class="ph ph-download-simple"></i></a>
                    </div>
                `;
                studioFilesList.insertAdjacentHTML('beforeend', html);
            });
        });

        // Refresh studio list active styling
        initStudios(); 
    }

    // --- Chat Send ---
    async function sendStudioMessage() {
        const text = studioMessageInput.value.trim();
        if(!text || !activeStudioId) return;
        studioMessageInput.value = '';

        let senderName = auth.currentUser.displayName || 'Artist';
        try {
            await addDoc(collection(db, "studios", activeStudioId, "messages"), {
                text: text,
                senderId: currentUserId,
                senderName: senderName,
                timestamp: Date.now()
            });
            await updateDoc(doc(db, "studios", activeStudioId), { lastUpdated: Date.now() });
        } catch(e) { console.error("Error sending", e); }
    }

    studioSendBtn.addEventListener('click', sendStudioMessage);
    studioMessageInput.addEventListener('keypress', (e) => {
        if(e.key === 'Enter') sendStudioMessage();
    });

    // --- File Upload ---
    studioFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if(!file || !activeStudioId) return;

        fileUploadStatus.style.display = 'block';
        
        try {
            const storRef = ref(storage, `studios/${activeStudioId}/files/${Date.now()}_${file.name}`);
            const uploadTask = await uploadBytesResumable(storRef, file);
            const url = await getDownloadURL(uploadTask.ref);

            await addDoc(collection(db, "studios", activeStudioId, "files"), {
                name: file.name,
                url: url,
                type: file.type,
                uploaderId: currentUserId,
                uploaderName: auth.currentUser.displayName || 'Artist',
                timestamp: Date.now()
            });
            
            // Notify chat
            await addDoc(collection(db, "studios", activeStudioId, "messages"), {
                text: `🎵 Shared a new file: ${file.name}`,
                senderId: currentUserId,
                senderName: auth.currentUser.displayName || 'Artist',
                timestamp: Date.now()
            });
            await updateDoc(doc(db, "studios", activeStudioId), { lastUpdated: Date.now() });
            
        } catch(err) {
            console.error("Upload error", err);
            alert("File upload failed.");
        } finally {
            fileUploadStatus.style.display = 'none';
            studioFileInput.value = '';
        }
    });

    // --- Invite Logic ---
    inviteBtn.addEventListener('click', () => {
        inviteModal.style.display = 'flex';
        userSearchResults.innerHTML = '<div style="color:var(--text-secondary); text-align:center; padding:20px;">Type to search</div>';
        userSearchInput.value = '';
    });
    
    closeInviteModal.addEventListener('click', () => {
        inviteModal.style.display = 'none';
    });

    userSearchInput.addEventListener('input', async (e) => {
        const queryText = e.target.value.trim().toLowerCase();
        if(queryText.length < 2) {
            userSearchResults.innerHTML = '<div style="color:var(--text-secondary); text-align:center; padding:20px;">Type at least 2 characters...</div>';
            return;
        }
        
        userSearchResults.innerHTML = '<div class="spinner" style="margin: 20px auto;"></div>';
        
        try {
            // We'll fetch all users for a simple client-side search (fine for small MVP, normally use Algolia/etc)
            const usersSnap = await getDocs(collection(db, "users"));
            userSearchResults.innerHTML = '';
            let found = 0;
            
            usersSnap.forEach(uDoc => {
                const uData = uDoc.data();
                if(uDoc.id !== currentUserId && uData.displayName && uData.displayName.toLowerCase().includes(queryText)) {
                    found++;
                    const row = document.createElement('div');
                    row.style = 'display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid var(--border-color);';
                    row.innerHTML = `
                        <div style="display:flex; align-items:center; gap:12px;">
                            <img src="${uData.photoURL || 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?q=80&w=100&auto=format&fit=crop'}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;">
                            <div>
                                <p style="margin:0; font-weight:600; font-size:0.9rem;">${uData.displayName}</p>
                            </div>
                        </div>
                        <button class="btn-primary invite-user-btn" data-uid="${uDoc.id}" style="width:auto; padding:6px 12px; font-size:0.8rem;">Invite</button>
                    `;
                    userSearchResults.appendChild(row);
                }
            });
            
            if(found === 0) {
                 userSearchResults.innerHTML = '<div style="color:var(--text-secondary); text-align:center; padding:20px;">No users found.</div>';
            }
            
            // Attach invite actions
            document.querySelectorAll('.invite-user-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const targetUid = e.target.getAttribute('data-uid');
                    e.target.disabled = true;
                    e.target.innerHTML = 'Sending...';
                    
                    try {
                        // 1. Add to pending inside studio
                        await updateDoc(doc(db, "studios", activeStudioId), {
                            pendingInvites: arrayUnion(targetUid)
                        });
                        
                        // 2. Send notification to user
                        await addDoc(collection(db, "users", targetUid, "notifications"), {
                            type: 'studio_invite',
                            studioId: activeStudioId,
                            studioName: activeStudioName.textContent,
                            senderId: currentUserId,
                            timestamp: Date.now(),
                            read: false,
                            state: 'pending'
                        });
                        
                        e.target.innerHTML = '<i class="ph ph-check"></i> Sent';
                        e.target.style.background = 'var(--success)';
                        e.target.style.borderColor = 'var(--success)';
                    } catch(err) {
                        console.error(err);
                        e.target.innerHTML = 'Error';
                        e.target.disabled = false;
                    }
                });
            });

        } catch(e) {
            console.error(e);
            userSearchResults.innerHTML = '<div style="color:red; text-align:center; padding:20px;">Search failed.</div>';
        }
    });

});
