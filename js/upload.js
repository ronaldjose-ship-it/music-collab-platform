import { isMockMode, mockDB, db, storage, auth, collection, addDoc, ref, uploadBytesResumable, getDownloadURL } from './app.js';

document.addEventListener('DOMContentLoaded', () => {
    const uploadForm = document.getElementById('uploadForm');
    const fileInput = document.getElementById('audioFile');
    const dropZone = document.getElementById('dropZone');
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const removeFile = document.getElementById('removeFile');
    const submitBtn = document.getElementById('submitBtn');
    const statusDiv = document.getElementById('uploadStatus');

    if(!uploadForm) return;

    let selectedFile = null;

    // File Drag & Drop
    dropZone.addEventListener('click', () => fileInput.click());
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if(e.dataTransfer.files.length) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if(e.target.files.length) {
            handleFileSelect(e.target.files[0]);
        }
    });

    removeFile.addEventListener('click', () => {
        selectedFile = null;
        fileInput.value = '';
        dropZone.style.display = 'block';
        fileInfo.style.display = 'none';
        
        // Reset valid state visual
        dropZone.style.borderColor = 'var(--border-color)';
    });

    function handleFileSelect(file) {
        if(file.type.includes('audio/')) {
            selectedFile = file;
            fileName.textContent = file.name;
            dropZone.style.display = 'none';
            fileInfo.style.display = 'flex';
        } else {
            alert('Please select a valid audio file (mp3, wav).');
        }
    }

    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if(!selectedFile && isMockMode) {
             // Let it pretend to upload for mock mode if user tests without selecting correctly
             // But actually require it if not mocked
             if(!isMockMode) {
                 alert('Please select an audio file first.');
                 return;
             }
        } else if (!selectedFile && !isMockMode) {
            alert('Please select an audio file first.');
            return;
        }

        const title = document.getElementById('trackTitle').value;
        const artist = document.getElementById('artistName').value;
        const genre = document.getElementById('genre').value;
        const type = document.getElementById('trackType').value;

        // Visual feedback
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px;margin:0;"></div> Uploading...';
        statusDiv.style.display = 'block';
        statusDiv.textContent = 'Preparing upload...';
        statusDiv.style.color = 'var(--text-secondary)';

        try {
            let audioUrl = '';

            if (isMockMode) {
                // Mock upload delay
                statusDiv.textContent = 'Uploading to mock storage...';
                await new Promise(resolve => setTimeout(resolve, 1500));
                
                // Real local MP3 URL for test playback
                audioUrl = (type === 'instrumental') 
                    ? 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3'
                    : 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3';
                    
                await mockDB.addTrack({
                    title: title,
                    artistName: artist,
                    genre: genre,
                    type: type,
                    audioUrl: audioUrl
                });

            } else {
                // Firebase Implementation
                statusDiv.textContent = 'Uploading audio file...';
                const fileRef = ref(storage, `tracks/${Date.now()}_${selectedFile.name}`);
                const uploadTask = uploadBytesResumable(fileRef, selectedFile);

                // Wait for upload
                await new Promise((resolve, reject) => {
                    uploadTask.on('state_changed', 
                        (snapshot) => {
                            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                            statusDiv.textContent = `Uploading: ${Math.round(progress)}%`;
                        }, 
                        (error) => reject(error), 
                        async () => {
                            audioUrl = await getDownloadURL(uploadTask.snapshot.ref);
                            resolve();
                        }
                    );
                });

                statusDiv.textContent = 'Saving metadata...';
                await addDoc(collection(db, "tracks"), {
                    title: title,
                    artistName: artist,
                    artistId: auth.currentUser ? auth.currentUser.uid : null,
                    genre: genre,
                    type: type,
                    audioUrl: audioUrl,
                    timestamp: Date.now()
                });
            }

            statusDiv.textContent = 'Successfully Uploaded!';
            statusDiv.style.color = 'var(--success)';
            
            setTimeout(() => {
                window.location.href = 'browse.html'; // Redirect to browse
            }, 1000);

        } catch (error) {
            console.error("Upload failed", error);
            statusDiv.textContent = 'Upload failed: ' + error.message;
            statusDiv.style.color = 'red';
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Try Again';
        }
    });
});
