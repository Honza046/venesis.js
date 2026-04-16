function startVenesisBrain() {
    const trigger = document.getElementById('chat_trigger');
    const windowEl = document.getElementById('chat_window');
    const sendBtn = document.getElementById('send_btn');
    const inputEl = document.getElementById('chat_input');
    
    // Čekáme, dokud Framer ty prvky nevykreslí (pokud tam ještě nejsou)
    if (!trigger || !sendBtn || !inputEl) {
        setTimeout(startVenesisBrain, 500);
        return;
    }

    console.log("Venesis AI: Mozek připojen k designu!");

    const messagesEl = document.getElementById('chat_messages');
    const attachBtn = document.getElementById('attach_btn');
    const fileInput = document.getElementById('file_input');
    const micBtn = document.getElementById('mic_btn');
    const speakerBtn = document.getElementById('speaker_btn');

    let selectedFile = null, mediaRecorder = null, audioChunks = [], recordedAudioBlob = null, isVoiceEnabled = true, currentAudio = null, audioQueue = [], isPlaying = false, hasWelcomed = false;

    // Repráček je od začátku zapnutý
    if (speakerBtn) speakerBtn.classList.add('active');

    function getTime() { 
        const t = new Date; 
        return String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0') 
    }

    // HLASOVÉ UVÍTÁNÍ PŘI KLIKNUTÍ NA LOGO
    trigger.addEventListener('click', () => {
        if (!hasWelcomed && isVoiceEnabled) {
            // Počkáme 200ms, aby se stihlo otevřít okno ve Frameru
            setTimeout(() => {
                if (windowEl.classList.contains('active')) {
                    hasWelcomed = true;
                    audioQueue.push("Ahoj! Jsem Venesis. Jak ti můžu dneska pomoci?");
                    if (!isPlaying) playNextAudio();
                }
            }, 200);
        }
    });

    // Tlačítko zvuku
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
        if (0 === audioQueue.length) return void (isPlaying = false);
        isPlaying = true;
        const t = audioQueue.shift().replace(/<[^>]*>?/gm, '').trim();
        if (0 === t.length) return void playNextAudio();
        try {
            const e = new FormData; e.append("text", t);
            // POZOR LOKÁLNÍ SERVER
            const n = await fetch('http://127.0.0.1:8000/tts', { method: 'POST', body: e });
            if (n.ok) {
                const t = await n.blob();
                currentAudio = new Audio(URL.createObjectURL(t));
                currentAudio.onended = () => { playNextAudio() };
                currentAudio.play();
            } else playNextAudio()
        } catch (t) { console.error(t), playNextAudio() }
    }

    // Přílohy
    attachBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', t => { 
        if (t.target.files.length > 0) {
            selectedFile = t.target.files[0];
            attachBtn.classList.add('active'); 
        }
    });

    // Mikrofon
    micBtn.addEventListener('click', async () => {
        if (mediaRecorder && "recording" === mediaRecorder.state) {
            mediaRecorder.stop();
            micBtn.classList.remove('recording'); 
        } else try {
            const t = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(t);
            mediaRecorder.start();
            micBtn.classList.add('recording'); 
            audioChunks = [];
            mediaRecorder.addEventListener("dataavailable", t => { audioChunks.push(t.data) });
            mediaRecorder.addEventListener("stop", () => { recordedAudioBlob = new Blob(audioChunks, { type: 'audio/webm' }) });
        } catch (t) { alert("K mikrofonu nebyl povolen přístup.") }
    });

    // Odesílání zpráv
    async function sendMessage() {
        const t = inputEl.value.trim();
        if (!t && !selectedFile && !recordedAudioBlob) return;
        
        audioQueue = [];
        if (currentAudio) { currentAudio.pause(); currentAudio = null; }
        isPlaying = false;
        
        let e = '';
        if (t) e += `<div>${t}</div>`;
        if (selectedFile) e += `<img src="${URL.createObjectURL(selectedFile)}" style="max-width:100%;border-radius:6px;margin-top:6px;display:block;">`;
        if (recordedAudioBlob) e += `<audio controls src="${URL.createObjectURL(recordedAudioBlob)}" style="max-width:100%;margin-top:6px;height:40px;"></audio>`;
        
        messagesEl.innerHTML += `<div class="msg_wrap user"><div class="msg">${e}</div></div>`;
        inputEl.value = '';
        messagesEl.scrollTop = messagesEl.scrollHeight;
        
        const n = 'loader_' + Date.now();
        messagesEl.innerHTML += `<div id="${n}" class="msg_wrap ai"><div class="msg" style="background:transparent; padding:0;"><div style="display:flex; gap:4px; padding:12px;"><div style="width:6px; height:6px; background:#fff; border-radius:50%; animation: pulse-mic 1s infinite;"></div><div style="width:6px; height:6px; background:#fff; border-radius:50%; animation: pulse-mic 1s infinite 0.2s;"></div><div style="width:6px; height:6px; background:#fff; border-radius:50%; animation: pulse-mic 1s infinite 0.4s;"></div></div></div></div>`;
        messagesEl.scrollTop = messagesEl.scrollHeight;
        
        try {
            const e = new FormData;
            if (t) e.append("message", t);
            if (selectedFile) e.append("file", selectedFile);
            else if (recordedAudioBlob) e.append("file", recordedAudioBlob, "hlasovka.webm");
            
            selectedFile = null;
            recordedAudioBlob = null;
            fileInput.value = '';
            attachBtn.classList.remove('active');
            
            // POZOR LOKÁLNÍ SERVER
            const r = await fetch('http://127.0.0.1:8000/chat', { method: 'POST', body: e });
            const o = r.body.getReader(), a = new TextDecoder();
            let i = "", s = false, d = null, c = "";
            
            function l() { if (i.length > 0) d.innerHTML += i[0], i = i.substring(1), messagesEl.scrollTop = messagesEl.scrollHeight, setTimeout(l, 20); else s = false }
            
            for (; ;) {
                const { done: t, value: e } = await o.read();
                if (t) break;
                const r = a.decode(e, { stream: true });
                if (i += r, isVoiceEnabled) {
                    c += r;
                    for (; ;) {
                        const t = c.match(/(.*?[.?!>\n])/);
                        if (!t) break;
                        let e = t[1];
                        c = c.substring(e.length);
                        let n = e.replace(/<[^>]*>?/gm, '').trim();
                        n.length > 0 && (audioQueue.push(n), isPlaying || playNextAudio())
                    }
                }
                if (!s) {
                    const t = document.getElementById(n); t && t.remove();
                    const e = document.createElement('div'); e.className = 'msg_wrap ai';
                    d = document.createElement('div'); d.className = 'msg';
                    e.appendChild(d); messagesEl.appendChild(e); s = true; l();
                }
            }
            if (isVoiceEnabled && c.trim().length > 0) {
                let t = c.replace(/<[^>]*>?/gm, '').trim();
                t.length > 0 && (audioQueue.push(t), isPlaying || playNextAudio())
            }
        } catch (t) {
            const e = document.getElementById(n); e && e.remove();
            messagesEl.innerHTML += `<div class="msg_wrap ai"><div class="msg" style="background: rgba(255,0,0,0.2); border-color: red;">⚠️ Chybí spojení s backendem (127.0.0.1).</div></div>`;
            messagesEl.scrollTop = messagesEl.scrollHeight;
        }
    }

    sendBtn.addEventListener('click', sendMessage);
    inputEl.addEventListener('keypress', t => { 'Enter' === t.key && sendMessage() });
}

// Spuštění po načtení
startVenesisBrain();
