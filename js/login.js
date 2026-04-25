import { auth, db, doc, setDoc, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail } from './app.js';

document.addEventListener('DOMContentLoaded', () => {
    const authForm = document.getElementById('authForm');
    const authTitle = document.getElementById('authTitle');
    const authSubtitle = document.getElementById('authSubtitle');
    const authBtn = document.getElementById('authBtn');
    const toggleModeBtn = document.getElementById('toggleAuthMode');
    const togglePrompt = document.getElementById('togglePrompt');
    const nameGroup = document.getElementById('nameGroup');
    const authError = document.getElementById('authError');

    if(!authForm) return;

    let isLoginMode = true;

    toggleModeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        isLoginMode = !isLoginMode;
        authError.style.display = 'none';

        if(isLoginMode) {
            authTitle.textContent = 'Artist Portal';
            authSubtitle.textContent = 'Sign in to upload your tracks and manage your portfolio.';
            authBtn.textContent = 'Sign In';
            nameGroup.style.display = 'none';
            document.getElementById('artistName').required = false;
            togglePrompt.textContent = 'New to Symphony?';
            toggleModeBtn.textContent = 'Create an Account';
        } else {
            authTitle.textContent = 'Join Symphony';
            authSubtitle.textContent = 'Create an artist account to share your music.';
            authBtn.textContent = 'Register';
            nameGroup.style.display = 'block';
            document.getElementById('artistName').required = true;
            togglePrompt.textContent = 'Already have an account?';
            toggleModeBtn.textContent = 'Sign In';
            document.getElementById('forgotPasswordContainer').style.display = 'none';
        }
    });

    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            if (!email) {
                authError.style.display = 'block';
                authError.textContent = 'Please enter your email above to reset password.';
                return;
            }
            try {
                authError.style.display = 'none';
                await sendPasswordResetEmail(auth, email);
                document.getElementById('resetFeedback').style.display = 'block';
                setTimeout(() => document.getElementById('resetFeedback').style.display = 'none', 5000);
            } catch (error) {
                authError.style.display = 'block';
                authError.textContent = 'Could not send reset email.';
            }
        });
    }

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const name = document.getElementById('artistName').value;

        authBtn.disabled = true;
        authBtn.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px;margin:0;"></div> Processing...';
        authError.style.display = 'none';

        try {
            if(isLoginMode) {
                await signInWithEmailAndPassword(auth, email, password);
                window.location.href = 'browse.html'; // Redirect to home
            } else {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                // Set the display name
                await updateProfile(userCredential.user, {
                    displayName: name
                });
                
                try {
                    await setDoc(doc(db, "users", userCredential.user.uid), {
                        displayName: name,
                        createdAt: Date.now()
                    });
                } catch(e) { console.error(e); }
                
                window.location.href = 'browse.html';
            }
        } catch (error) {
            console.error(error);
            authError.style.display = 'block';
            
            // Format Firebase errors neatly
            let msg = error.message;
            if(error.code === 'auth/invalid-credential') msg = 'Invalid email or password.';
            if(error.code === 'auth/email-already-in-use') msg = 'An account with this email already exists.';
            if(error.code === 'auth/weak-password') msg = 'Password must be at least 6 characters.';
            
            authError.textContent = msg;
            
            authBtn.disabled = false;
            authBtn.textContent = isLoginMode ? 'Sign In' : 'Register';
        }
    });
});
