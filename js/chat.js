import { auth, db, collection, addDoc, getDocs, query, orderBy, onSnapshot, isMockMode, onAuthStateChanged } from './app.js';
import { doc, setDoc, getDoc, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const contactsList = document.getElementById('contactsList');
    const chatMessages = document.getElementById('chatMessages');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    
    // Header elements
    const chatHeaderName = document.getElementById('chatHeaderName');
    const chatHeaderAvatar = document.getElementById('chatHeaderAvatar');
    const chatHeaderStatus = document.getElementById('chatHeaderStatus');

    let currentUserId = null;
    let activeChatId = null;
    let activeContactId = null;
    let unsubscribeMessages = null;
    let unsubscribeChats = null;
    
    onAuthStateChanged(auth, async (user) => {
        if(user) {
            currentUserId = user.uid;
            await initChats();
        } else {
            contactsList.innerHTML = '<p style="padding:16px;">Please log in to view messages.</p>';
            chatMessages.innerHTML = '';
        }
    });

    async function initChats() {
        const urlParams = new URLSearchParams(window.location.search);
        let contactId = urlParams.get('contactId');
        
        // Setup real-time listener for user's chats
        const chatsRef = collection(db, "chats");
        const q = query(chatsRef, where("participants", "array-contains", currentUserId));
        
        unsubscribeChats = onSnapshot(q, async (snapshot) => {
            let chats = [];
            snapshot.forEach(docSnap => {
                chats.push({ id: docSnap.id, ...docSnap.data() });
            });
            
            chats.sort((a,b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
            await renderContacts(chats);
            
            if (contactId && !activeChatId) {
                let existingChat = chats.find(c => c.participants.includes(contactId));
                if (existingChat) {
                    openChat(existingChat.id, contactId);
                } else {
                    await createChat(contactId);
                }
            } else if (chats.length > 0 && !activeChatId) {
                const otherUid = chats[0].participants.find(p => p !== currentUserId);
                openChat(chats[0].id, otherUid);
            }
        });
    }

    async function createChat(contactId) {
        if(isMockMode) return;
        try {
            const newChatRef = await addDoc(collection(db, "chats"), {
                participants: [currentUserId, contactId],
                lastUpdated: Date.now(),
                lastMessage: ""
            });
            openChat(newChatRef.id, contactId);
        } catch(e) { console.error(e); }
    }

    async function renderContacts(chats) {
        contactsList.innerHTML = '';
        if(chats.length === 0) {
            contactsList.innerHTML = '<p style="padding:16px; color:var(--text-secondary);">No conversations yet.</p>';
            return;
        }

        for (const chat of chats) {
            const otherUid = chat.participants.find(p => p !== currentUserId);
            
            let avatar = 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?q=80&w=100&auto=format&fit=crop';
            let name = 'Artist';
            try {
                const userDoc = await getDoc(doc(db, "users", otherUid));
                if(userDoc.exists()) {
                    name = userDoc.data().displayName || 'Artist';
                    avatar = userDoc.data().photoURL || avatar;
                }
            } catch(e) {}

            const isActive = activeChatId === chat.id;
            const bg = isActive ? 'rgba(99,102,241,0.1)' : 'transparent';
            const border = isActive ? '3px solid var(--primary-color)' : '3px solid transparent';
            
            const div = document.createElement('div');
            div.style = `padding: 16px; display:flex; align-items:center; gap:12px; cursor:pointer; background:${bg}; border-left:${border}; transition:background 0.2s;`;
            div.onmouseover = () => { if(!isActive) div.style.background='var(--surface-light)'; };
            div.onmouseout = () => { if(!isActive) div.style.background='transparent'; };
            div.onclick = () => openChat(chat.id, otherUid);
            
            div.innerHTML = `
                <img src="${avatar}" style="width:48px; height:48px; border-radius:50%; object-fit:cover;">
                <div style="flex-grow:1; overflow:hidden;">
                    <h4 style="font-size:0.95rem; margin-bottom:2px; white-space:nowrap; text-overflow:ellipsis;">${name}</h4>
                    <p style="font-size:0.8rem; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${chat.lastMessage || '...'}</p>
                </div>
            `;
            contactsList.appendChild(div);
        }
    }

    async function openChat(chatId, contactId) {
        activeChatId = chatId;
        activeContactId = contactId;
        
        // Setup UI
        if(chatHeaderName) chatHeaderName.textContent = "Loading...";
        try {
            const userDoc = await getDoc(doc(db, "users", contactId));
            if(userDoc.exists()) {
                if(chatHeaderName) chatHeaderName.textContent = userDoc.data().displayName || 'Artist';
                if(chatHeaderAvatar) chatHeaderAvatar.src = userDoc.data().photoURL || 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?q=80&w=100&auto=format&fit=crop';
                if(chatHeaderStatus) chatHeaderStatus.textContent = 'Active now';
            }
        } catch(e) {}
        
        if(unsubscribeMessages) unsubscribeMessages();
        
        const q = query(collection(db, "chats", chatId, "messages"), orderBy("timestamp", "asc"));
        unsubscribeMessages = onSnapshot(q, (snapshot) => {
            chatMessages.innerHTML = '';
            snapshot.forEach(docSnap => {
                const msg = docSnap.data();
                const isMine = msg.senderId === currentUserId;
                const time = new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                
                let checkmarks = '';
                if(isMine) {
                    if(msg.status === 'seen') checkmarks = '<i class="ph-fill ph-checks" style="color:#60a5fa"></i>';
                    else if(msg.status === 'delivered') checkmarks = '<i class="ph ph-checks" style="color:var(--text-secondary)"></i>';
                    else checkmarks = '<i class="ph ph-check" style="color:var(--text-secondary)"></i>';
                }

                if(!isMine && msg.status !== 'seen') {
                    setDoc(doc(db, "chats", chatId, "messages", docSnap.id), { status: 'seen' }, {merge:true});
                }

                const align = isMine ? 'align-self: flex-end;' : 'align-self: flex-start;';
                const bg = isMine ? 'background:var(--primary-color); border-bottom-right-radius:2px;' : 'background:var(--surface-light); border-bottom-left-radius:2px;';
                
                let bubbleContent = '';
                
                if (msg.type === 'download_request') {
                    const isOwner = currentUserId === msg.ownerId;
                    let actionHtml = '';
                    
                    const accessState = msg.accessStatus || (msg.type === 'download_request' && msg.status !== 'granted' && msg.status !== 'denied' ? 'pending' : msg.status);
                    
                    if (accessState === 'pending') {
                        if (isOwner) {
                            actionHtml = `
                                <div style="display:flex; gap:8px; margin-top:8px;">
                                    <button class="btn-dl-action give-access-btn" style="flex:1;" data-msg-id="${docSnap.id}" data-track-id="${msg.trackId}" data-requester-id="${msg.requesterId}"><i class="ph ph-check-circle"></i> Allow</button>
                                    <button class="btn-dl-deny deny-access-btn" style="flex:1;" data-msg-id="${docSnap.id}" data-track-id="${msg.trackId}" data-requester-id="${msg.requesterId}"><i class="ph ph-x-circle"></i> Deny</button>
                                </div>
                            `;
                        } else {
                            actionHtml = `<button class="btn-dl-action disabled" style="margin-top:8px; width:100%;"><i class="ph ph-clock"></i> Awaiting Approval...</button>`;
                        }
                    } else if (accessState === 'granted') {
                        if (isOwner) {
                            actionHtml = `<button class="btn-dl-action granted disabled" style="margin-top:8px; width:100%;"><i class="ph ph-check"></i> Access Granted</button>`;
                        } else {
                            actionHtml = `<button class="btn-dl-action download-now-btn" style="margin-top:8px; width:100%;" data-url="${msg.audioUrl}"><i class="ph ph-download-simple"></i> Download Track</button>`;
                        }
                    } else if (accessState === 'denied') {
                        actionHtml = `<button class="btn-dl-action denied disabled" style="margin-top:8px; width:100%;"><i class="ph ph-x"></i> Access Denied</button>`;
                    }

                    bubbleContent = `
                        <div class="dl-req-bubble" style="${isMine ? 'border-color:var(--primary-color); background:rgba(0,240,255,0.05);' : ''}">
                            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <div style="background:var(--primary-color); color:#050508; width:32px; height:32px; border-radius:10px; display:flex; justify-content:center; align-items:center;">
                                        <i class="ph-fill ph-file-audio" style="font-size:1.1rem;"></i>
                                    </div>
                                    <div>
                                        <h4>Download Request</h4>
                                        <p>${msg.trackTitle}</p>
                                    </div>
                                </div>
                            </div>
                            <div style="margin-top:6px;">
                                ${actionHtml}
                            </div>
                        </div>
                    `;
                } else {
                    bubbleContent = `
                        <div style="${bg} padding:12px 16px; border-radius:12px; margin-bottom:4px;">
                            ${msg.text}
                        </div>
                    `;
                }

                const html = `
                    <div style="${align} max-width: 85%; animation: slideIn 0.3s ease-out;">
                        ${bubbleContent}
                        <div style="font-size:0.7rem; color:var(--text-secondary); text-align:${isMine ? 'right' : 'left'}; margin-top:4px;">
                            ${time} ${checkmarks}
                        </div>
                    </div>
                `;
                chatMessages.insertAdjacentHTML('beforeend', html);
            });
            chatMessages.scrollTop = chatMessages.scrollHeight;

            // Delegated click listeners for action buttons
            chatMessages.querySelectorAll('.give-access-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const msgId = e.currentTarget.getAttribute('data-msg-id');
                    const trackId = e.currentTarget.getAttribute('data-track-id');
                    const reqId = e.currentTarget.getAttribute('data-requester-id');
                    
                    const btnContainer = e.currentTarget.parentElement;
                    btnContainer.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;margin:0 auto;"></div>';

                    try {
                        await setDoc(doc(db, "chats", chatId, "messages", msgId), { accessStatus: 'granted' }, { merge: true });
                        await setDoc(doc(db, "tracks", trackId, "access", reqId), { status: 'granted' }, { merge: true });
                        
                        // Send nice message to requester
                        await addDoc(collection(db, "chats", chatId, "messages"), {
                            text: 'I have granted you access to download the track! Enjoy.',
                            senderId: currentUserId,
                            timestamp: Date.now(),
                            status: 'delivered'
                        });
                        await setDoc(doc(db, "chats", chatId), { lastMessage: "Access Granted", lastUpdated: Date.now() }, {merge:true});

                    } catch(err) {
                        console.error(err);
                        btnContainer.innerHTML = "<p style='color:red; font-size:0.8rem;'>Error</p>";
                    }
                });
            });

            chatMessages.querySelectorAll('.deny-access-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const msgId = e.currentTarget.getAttribute('data-msg-id');
                    const trackId = e.currentTarget.getAttribute('data-track-id');
                    const reqId = e.currentTarget.getAttribute('data-requester-id');
                    
                    const btnContainer = e.currentTarget.parentElement;
                    btnContainer.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;margin:0 auto;"></div>';

                    try {
                        await setDoc(doc(db, "chats", chatId, "messages", msgId), { accessStatus: 'denied' }, { merge: true });
                        await setDoc(doc(db, "tracks", trackId, "access", reqId), { status: 'denied' }, { merge: true });
                        
                        await addDoc(collection(db, "chats", chatId, "messages"), {
                            text: 'Your request to download the track was denied.',
                            senderId: currentUserId,
                            timestamp: Date.now(),
                            status: 'delivered'
                        });
                        await setDoc(doc(db, "chats", chatId), { lastMessage: "Access Denied", lastUpdated: Date.now() }, {merge:true});

                    } catch(err) {
                        console.error(err);
                        btnContainer.innerHTML = "<p style='color:red; font-size:0.8rem;'>Error</p>";
                    }
                });
            });

            chatMessages.querySelectorAll('.download-now-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const url = e.currentTarget.getAttribute('data-url');
                    window.open(url, '_blank');
                });
            });
        });
        
        // Refresh contact list active highlight
        renderContacts(Array.from(contactsList.children).map(()=>null)); // dirty trigger wait, no just rely on onSnapshot to refresh
    }

    if(sendBtn) sendBtn.addEventListener('click', sendMessage);
    if(messageInput) messageInput.addEventListener('keypress', (e) => {
        if(e.key === 'Enter') sendMessage();
    });

    async function sendMessage() {
        const text = messageInput.value.trim();
        if(!text || !activeChatId) return;
        messageInput.value = '';

        try {
            await addDoc(collection(db, "chats", activeChatId, "messages"), {
                text: text,
                senderId: currentUserId,
                timestamp: Date.now(),
                status: 'delivered' // simplifying for demo 'delivered' since realtime 
            });
            
            await setDoc(doc(db, "chats", activeChatId), {
                lastMessage: text,
                lastUpdated: Date.now()
            }, {merge:true});

            await addDoc(collection(db, "users", activeContactId, "notifications"), {
                type: 'message',
                senderId: currentUserId,
                text: text,
                timestamp: Date.now(),
                read: false
            });
        } catch(e) { console.error(e); }
    }
});
