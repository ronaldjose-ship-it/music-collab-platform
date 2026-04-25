// Simple Static Guidance Tree for the AI Assistant MVP
document.addEventListener('DOMContentLoaded', () => {
    const aiBotToggle = document.getElementById('aiBotToggle');
    const aiBotWindow = document.getElementById('aiBotWindow');
    const closeBot = document.getElementById('closeBot');
    const messagesContainer = document.getElementById('aiBotMessages');
    const optionsContainer = document.getElementById('aiBotOptions');

    if(!aiBotToggle) return;

    let chatOpen = false;

    aiBotToggle.addEventListener('click', () => {
        chatOpen = !chatOpen;
        if(chatOpen) {
            aiBotWindow.classList.remove('hidden');
            aiBotToggle.style.transform = 'scale(0)';
            if(messagesContainer.children.length === 0) {
                initiateChat();
            }
        }
    });

    closeBot.addEventListener('click', () => {
        chatOpen = false;
        aiBotWindow.classList.add('hidden');
        aiBotToggle.style.transform = 'scale(1)';
    });

    function appendMessage(text, isBot = true) {
        const div = document.createElement('div');
        div.className = `msg-bubble ${isBot ? 'msg-bot' : 'msg-user'}`;
        div.innerHTML = text; // allow bolding, links, etc
        
        // simple animation
        div.style.animation = 'fadeInUp 0.3s ease-out forwards';
        messagesContainer.appendChild(div);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function setOptions(options) {
        optionsContainer.innerHTML = '';
        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'preset-btn';
            btn.textContent = opt.text;
            btn.onclick = () => {
                appendMessage(opt.text, false);
                optionsContainer.innerHTML = ''; // clear options
                
                // simulate typing delay
                const typing = document.createElement('div');
                typing.className = 'msg-bubble msg-bot';
                typing.innerHTML = '<span class="dots">...</span>';
                messagesContainer.appendChild(typing);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;

                setTimeout(() => {
                    typing.remove();
                    opt.callback();
                }, 800);
            };
            optionsContainer.appendChild(btn);
        });
    }

    // --- The Dialogue Tree ---
    function initiateChat() {
        appendMessage("Hi there! 👋 I'm your Symphony Assistant.");
        setTimeout(() => {
            appendMessage("I can help you find the right music or match you with artists based on your project needs.");
            setTimeout(() => {
                appendMessage("Are you looking for background instrumentals or full vocal compositions?");
                setOptions([
                    { text: 'Instrumentals (Beats/Background)', callback: handleInstrumental },
                    { text: 'Full Compositions (With Vocals)', callback: handleVocals },
                    { text: 'I want to collaborate', callback: handleCollab }
                ]);
            }, 600);
        }, 500);
    }

    function handleInstrumental() {
        appendMessage("Great! Instrumentals are perfect for videos, podcasts, and rappers.");
        appendMessage("Which genre fits your vibe best?");
        setOptions([
            { text: 'Electronic / EDM', callback: () => suggestMatches('electronic', 'instrumental') },
            { text: 'Hip Hop / Lo-Fi', callback: () => suggestMatches('hiphop', 'instrumental') },
            { text: 'Pop / Modern', callback: () => suggestMatches('pop', 'instrumental') },
            { text: 'Classical / Cinematic', callback: () => suggestMatches('classical', 'instrumental') }
        ]);
    }

    function handleVocals() {
        appendMessage("Awesome. Full compositions are great for playlists and licensing.");
        appendMessage("Any preferred genre?");
        setOptions([
            { text: 'Pop / R&B', callback: () => suggestMatches('pop', 'full') },
            { text: 'Rock / Alternative', callback: () => suggestMatches('rock', 'full') },
            { text: 'Electronic', callback: () => suggestMatches('electronic', 'full') }
        ]);
    }
    
    function handleCollab() {
       appendMessage("Collabs build the community! We have amazing producers and vocalists here."); 
       appendMessage("Check out <a href='profile.html?artist=DJ%20Horizon' style='color:var(--primary-color); text-decoration:underline;'>DJ Horizon's</a> profile, they are currently looking for vocalists!");
       
       setOptions([
           { text: 'Start over', callback: initiateChat }
       ]);
    }

    function suggestMatches(genre, type) {
        // Here it would hook into Smart Matching System and query the DB.
        // For MVP we just guide them to use filter or mock a recommendation.
        
        appendMessage(`Searching Smart Matches for <b>${genre} ${type}s</b>...`);
        
        setTimeout(() => {
             appendMessage(`Found excellent matches! I recommend checking out tracks by <b>SynthMaster</b> or <b>Elena Vocals</b>.`);
             appendMessage(`You can find these in the <a href="index.html" style="color:var(--primary-color); text-decoration:underline;">Browse</a> tab using the filter options.`);
             
             setOptions([
                { text: 'Start over', callback: initiateChat },
                { text: 'Thanks!', callback: () => {
                    appendMessage("You're welcome! Let me know if you need anything else.");
                }}
            ]);
        }, 1200);
    }
});
