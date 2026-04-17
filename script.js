(function() {
    function getCurrentTime() {
        const now = new Date();
        return now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    }

    function initVenesis() {
        const trigger = document.getElementById('chat_trigger');
        const windowEl = document.getElementById('chat_window');
        const sendBtn = document.getElementById('send_btn');
        const inputEl = document.getElementById('chat_input');
        const attachBtn = document.getElementById('attach_btn');
        const fileInput = document.getElementById('file_input');
        const micBtn = document.getElementById('mic_btn');
        const speakerBtn = document.getElementById('speaker_btn');
        const messagesEl = document.getElementById('chat_messages');

        // Pokud tlačítka ještě nejsou v DOMu, zkusíme to za chvíli znovu
        if (!trigger || !sendBtn || !speakerBtn || !messagesEl) {
            setTimeout(initVenesis, 300);
            return;
        }

        // --- JAZYKOVÁ LOGIKA ---
        const lang = document.documentElement.lang.startsWith('cs') ? 'cs' : 'en';
        const translations = {
            cs: {
                welcome: "Ahoj! Jsem Venesis. Jak ti můžu dneska pomoci?",
                placeholder: "Napiš zprávu...",
                error: "⚠️ Backend neběží."
            },
            en: {
                welcome: "Hi! I'm Venesis. How can I help you today?",
                placeholder: "Type a message...",
                error: "⚠️ Backend is offline."
            }
        };
        const t = translations[lang];
        
        // Nastavení placeholderu do políčka podle jazyka
        if (inputEl) inputEl.placeholder = t.placeholder;
        // -----------------------

        console.log(`✅ Venesis AI: MOZEK NAKOPNUT A PŘIPOJEN! (Jazyk: ${lang})`);

        let selectedFile = null, mediaRecorder = null, audioChunks = [], recordedAudioBlob = null;
        let isVoiceEnabled = true, currentAudio = null, audioQueue = [], isPlaying = false, hasWelcomed = false;

        // UVÍTÁNÍ (jen zvuk, vizuál řeší Framer)
        trigger.addEventListener('click', () => {
            if (!hasWelcomed && isVoiceEnabled) {
                setTimeout(() => {
                    if (windowEl.classList.contains('active')) {
                        hasWelcomed = true;
                        audioQueue.push(t.welcome);
                        if (!isPlaying) playNextAudio();
                    }
                }, 300);
            }
        });

        // REPRODUKTOR
        speakerBtn.addEventListener('click', () => {
            isVoiceEnabled = !isVoiceEnabled;
            speakerBtn.classList.toggle('active', isVoiceEnabled);
            if (!isVoiceEnabled) {
                audioQueue = [];
                if (currentAudio) { currentAudio.pause(); currentAudio = null; }
                isPlaying = false;
            }
        });

        async function playNextAudio() {
            if (audioQueue.length === 0) { isPlaying = false; return; }
            isPlaying = true;
            const text = audioQueue.shift().replace(/<[^>]*>?/gm, '').trim();
            if (!text) return playNextAudio();
            try {
                const fd = new FormData(); fd.append("text", text);
                // --- NGROK ADRESA ZDE ---
                const res = await fetch('https://glorified-renewed-banking.ngrok-free.dev/tts', { method: 'POST', body: fd });
                if (res.ok) {
                    const blob = await res.blob();
                    currentAudio = new Audio(URL.createObjectURL(blob));
                    currentAudio.onended = playNextAudio;
                    currentAudio.play();
                } else playNextAudio();
            } catch (e) { playNextAudio(); }
        }

        // PŘÍLOHA
        attachBtn.onclick = () => fileInput.click();
        fileInput.onchange = (e) => {
            if (e.target.files.length > 0) {
                selectedFile = e.target.files[0];
                attachBtn.classList.add('active');
            }
        };

        // MIKROFON
        micBtn.onclick = async () => {
            if (mediaRecorder && mediaRecorder.state === "recording") {
                mediaRecorder.stop();
                micBtn.classList.remove('recording');
            } else {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    mediaRecorder = new MediaRecorder(stream);
                    mediaRecorder.start();
                    micBtn.classList.add('recording');
                    audioChunks = [];
                    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
                    mediaRecorder.onstop = () => { recordedAudioBlob = new Blob(audioChunks, { type: 'audio/webm' }); };
                } catch (e) { alert("Mikrofon nejede."); }
            }
        };

        // ODESLÁNÍ
        async function sendMessage() {
            const text = inputEl.value.trim();
            if (!text && !selectedFile && !recordedAudioBlob) return;

            const timeStr = getCurrentTime();
            let html = '';
            if (text) html += `<div>${text}</div>`;
            if (selectedFile) html += `<img src="${URL.createObjectURL(selectedFile)}" style="max-width:100%; border-radius:6px; margin-top:6px;">`;
            if (recordedAudioBlob) html += `<audio controls src="${URL.createObjectURL(recordedAudioBlob)}" style="max-width:100%; margin-top:6px; height:40px;"></audio>`;

            messagesEl.innerHTML += `<div class="msg_wrap user"><div class="msg">${html}</div><div class="msg_time">${timeStr}</div></div>`;
            inputEl.value = '';
            messagesEl.scrollTop = messagesEl.scrollHeight;

            const loaderId = 'l_' + Date.now();
            messagesEl.innerHTML += `<div id="${loaderId}" class="msg_wrap ai"><div class="msg" style="background:transparent;padding:0;"><div style="display:flex;gap:4px;padding:12px;"><div class="dot" style="width:6px;height:6px;background:#fff;border-radius:50%;animation:pulse-white 1s infinite"></div><div class="dot" style="width:6px;height:6px;background:#fff;border-radius:50%;animation:pulse-white 1s infinite 0.2s"></div><div class="dot" style="width:6px;height:6px;background:#fff;border-radius:50%;animation:pulse-white 1s infinite 0.4s"></div></div></div></div>`;
            messagesEl.scrollTop = messagesEl.scrollHeight;

            try {
                const fd = new FormData();
                if (text) fd.append("message", text);
                if (selectedFile) fd.append("file", selectedFile);
                else if (recordedAudioBlob) fd.append("file", recordedAudioBlob, "voice.webm");
                
                // --- PŘIDÁNO: Posíláme jazyk na backend ---
                fd.append("lang", lang);

                selectedFile = null; recordedAudioBlob = null; fileInput.value = '';
                attachBtn.classList.remove('active'); micBtn.classList.remove('recording');

                // --- NGROK ADRESA ZDE ---
                const res = await fetch('https://glorified-renewed-banking.ngrok-free.dev/chat', { method: 'POST', body: fd });
                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                let fullStr = "", started = false, msgDiv = null, incStr = "";

                function typeWriter() {
                    if (incStr.length > 0) {
                        msgDiv.innerHTML += incStr[0];
                        incStr = incStr.substring(1);
                        messagesEl.scrollTop = messagesEl.scrollHeight;
                        setTimeout(typeWriter, 20);
                    }
                }

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value, { stream: true });
                    incStr += chunk;

                    if (isVoiceEnabled) {
                        fullStr += chunk;
                        while (true) {
                            const match = fullStr.match(/(.*?[.?!>\n])/);
                            if (!match) break;
                            const sentence = match[1];
                            fullStr = fullStr.substring(sentence.length);
                            const clean = sentence.replace(/<[^>]*>?/gm, '').trim();
                            if (clean) { audioQueue.push(clean); if (!isPlaying) playNextAudio(); }
                        }
                    }

                    if (!started) {
                        const loader = document.getElementById(loaderId); if (loader) loader.remove();
                        const wrap = document.createElement('div'); wrap.className = 'msg_wrap ai';
                        msgDiv = document.createElement('div'); msgDiv.className = 'msg';
                        wrap.appendChild(msgDiv); messagesEl.appendChild(wrap);
                        started = true;
                        typeWriter();
                    }
                }
                
                // Přidání času pod AI zprávu, až když je hotovo
                if (msgDiv && msgDiv.parentElement) {
                    const tDiv = document.createElement('div');
                    tDiv.className = 'msg_time';
                    tDiv.innerText = getCurrentTime();
                    msgDiv.parentElement.appendChild(tDiv);
                }

            } catch (e) {
                const loader = document.getElementById(loaderId); if (loader) loader.remove();
                messagesEl.innerHTML += `<div class="msg_wrap ai"><div class="msg" style="background:rgba(255,0,0,0.2)">${t.error}</div></div>`;
            }
        }

        sendBtn.onclick = sendMessage;
        inputEl.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initVenesis);
    else initVenesis();
})();
