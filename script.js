document.addEventListener('DOMContentLoaded', () => {
    
    // Pojistka pro Framer - počkáme, dokud se nevykreslí všechna tlačítka
    function initVenesis() {
        function getCurrentTime() {
    const now = new Date();
    return now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
}
        const trigger = document.getElementById('chat_trigger');
        const windowEl = document.getElementById('chat_window');
        const sendBtn = document.getElementById('send_btn');
        const inputEl = document.getElementById('chat_input');
        const attachBtn = document.getElementById('attach_btn');
        const fileInput = document.getElementById('file_input');
        const micBtn = document.getElementById('mic_btn');
        const speakerBtn = document.getElementById('speaker_btn');
        const messagesEl = document.getElementById('chat_messages');

        // Pokud tlačítka ještě neexistují, zkusíme to za chviličku znovu
        if (!trigger || !sendBtn || !speakerBtn) {
            setTimeout(initVenesis, 300);
            return;
        }

        console.log("Venesis AI: Mozek z GitHubu připojen a běží!");

        let selectedFile = null, mediaRecorder = null, audioChunks = [], recordedAudioBlob = null;
        let isVoiceEnabled = true, currentAudio = null, audioQueue = [], isPlaying = false, hasWelcomed = false;

        // 1. UVÍTÁNÍ (Framer řeší vizuální otevření, my jen přidáme zvuk)
        trigger.addEventListener('click', () => {
            if (!hasWelcomed && isVoiceEnabled) {
                setTimeout(() => {
                    if (windowEl.classList.contains('active')) {
                        hasWelcomed = true;
                        audioQueue.push("Ahoj! Jsem Venesis. Jak ti můžu dneska pomoci?");
                        if (!isPlaying) playNextAudio();
                    }
                }, 300); // 300ms zpoždění, aby okno stihlo vyjet
            }
        });

        // 2. HLASITOST (Zapnuto/Vypnuto)
        speakerBtn.addEventListener('click', () => {
            isVoiceEnabled = !isVoiceEnabled;
            if (isVoiceEnabled) {
                speakerBtn.classList.add('active');
            } else {
                speakerBtn.classList.remove('active');
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
                const fd = new FormData();
                fd.append("text", text);
                const res = await fetch('http://127.0.0.1:8000/tts', { method: 'POST', body: fd });
                if (res.ok) {
                    const blob = await res.blob();
                    currentAudio = new Audio(URL.createObjectURL(blob));
                    currentAudio.onended = playNextAudio;
                    currentAudio.play();
                } else {
                    playNextAudio();
                }
            } catch (e) {
                console.error("TTS chyba:", e);
                playNextAudio();
            }
        }

        // 3. PŘÍLOHA (Vybrání souboru)
        attachBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                selectedFile = e.target.files[0];
                attachBtn.classList.add('active'); // Sponka svítí
            }
        });

        // 4. MIKROFON (Nahrávání hlasovky)
        micBtn.addEventListener('click', async () => {
            if (mediaRecorder && mediaRecorder.state === "recording") {
                mediaRecorder.stop();
                micBtn.classList.remove('recording'); // Vypne pulzování
            } else {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    mediaRecorder = new MediaRecorder(stream);
                    mediaRecorder.start();
                    micBtn.classList.add('recording'); // Zapne pulzování
                    audioChunks = [];
                    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
                    mediaRecorder.onstop = () => {
                        recordedAudioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    };
                } catch (e) {
                    alert("Přístup k mikrofonu byl odepřen.");
                }
            }
        });

        // 5. ODESLÁNÍ ZPRÁVY A KOMUNIKACE S BACKENDEM
        async function sendMessage() {
            const text = inputEl.value.trim();
            if (!text && !selectedFile && !recordedAudioBlob) return;

            audioQueue = [];
            if (currentAudio) { currentAudio.pause(); currentAudio = null; }
            isPlaying = false;

            let html = '';
            if (text) html += `<div>${text}</div>`;
            if (selectedFile) html += `<img src="${URL.createObjectURL(selectedFile)}" style="max-width:100%; border-radius:6px; margin-top:6px;">`;
            if (recordedAudioBlob) html += `<audio controls src="${URL.createObjectURL(recordedAudioBlob)}" style="max-width:100%; margin-top:6px; height:40px;"></audio>`;

            const timeStr = getCurrentTime();
            messagesEl.innerHTML += `<div class="msg_wrap user"><div class="msg">${html}</div><div class="msg_time">${timeStr}</div></div>`;
            inputEl.value = '';
            messagesEl.scrollTop = messagesEl.scrollHeight;

            const loaderId = 'loader_' + Date.now();
            messagesEl.innerHTML += `<div id="${loaderId}" class="msg_wrap ai"><div class="msg" style="background:transparent; padding:0;"><div style="display:flex; gap:4px; padding:12px;"><div style="width:6px; height:6px; background:#fff; border-radius:50%; animation: pulse-white 1s infinite;"></div><div style="width:6px; height:6px; background:#fff; border-radius:50%; animation: pulse-white 1s infinite 0.2s;"></div><div style="width:6px; height:6px; background:#fff; border-radius:50%; animation: pulse-white 1s infinite 0.4s;"></div></div></div></div>`;
            messagesEl.scrollTop = messagesEl.scrollHeight;

            try {
                const fd = new FormData();
                if (text) fd.append("message", text);
                if (selectedFile) fd.append("file", selectedFile);
                else if (recordedAudioBlob) fd.append("file", recordedAudioBlob, "hlasovka.webm");

                // Reset po odeslání
                selectedFile = null;
                recordedAudioBlob = null;
                fileInput.value = '';
                attachBtn.classList.remove('active');
                micBtn.classList.remove('recording');

                const res = await fetch('http://127.0.0.1:8000/chat', { method: 'POST', body: fd });
                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                let incStr = "", started = false, msgDiv = null, fullStr = "";

                // Efekt postupného psaní (Typewriter)
                function typeWriter() {
                    if (incStr.length > 0) {
                        msgDiv.innerHTML += incStr[0];
                        incStr = incStr.substring(1);
                        messagesEl.scrollTop = messagesEl.scrollHeight;
                        setTimeout(typeWriter, 20);
                    } else {
                        started = false;
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
                            const cleanSentence = sentence.replace(/<[^>]*>?/gm, '').trim();
                            if (cleanSentence) {
                                audioQueue.push(cleanSentence);
                                if (!isPlaying) playNextAudio();
                            }
                        }
                    }

                    if (!started) {
                        const loader = document.getElementById(loaderId);
                        if (loader) loader.remove();
                        const wrap = document.createElement('div');
                        wrap.className = 'msg_wrap ai';
                        msgDiv = document.createElement('div');
                        msgDiv.className = 'msg';
                        wrap.appendChild(msgDiv);
                        messagesEl.appendChild(wrap);
                        started = true;
                        typeWriter();
                    }
                }

                if (isVoiceEnabled && fullStr.trim()) {
                    const cleanSentence = fullStr.replace(/<[^>]*>?/gm, '').trim();
                    if (cleanSentence) {
                        audioQueue.push(cleanSentence);
                        if (!isPlaying) playNextAudio();
                    }
                }

            } catch (e) {
                const loader = document.getElementById(loaderId);
                if (loader) loader.remove();
                messagesEl.innerHTML += `<div class="msg_wrap ai"><div class="msg" style="background:rgba(255,0,0,0.2); border-color:red;">⚠️ Chybí spojení s backendem (127.0.0.1).</div></div>`;
                messagesEl.scrollTop = messagesEl.scrollHeight;
            }
        }

        sendBtn.addEventListener('click', sendMessage);
        inputEl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }

    // Spuštění inicializace
    initVenesis();
});
