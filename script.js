// Celý kód zabalíme do funkce, která počká na načtení DOMu
document.addEventListener('DOMContentLoaded', () => {
    console.log("Venesis AI: Inicializace skriptu...");

    const trigger = document.getElementById('chat_trigger');
    const windowEl = document.getElementById('chat_window');
    const closeBtn = document.getElementById('close_chat');
    const sendBtn = document.getElementById('send_btn');
    const inputEl = document.getElementById('chat_input');
    const messagesEl = document.getElementById('chat_messages');
    const attachBtn = document.getElementById('attach_btn');
    const fileInput = document.getElementById('file_input');
    const micBtn = document.getElementById('mic_btn');
    const speakerBtn = document.getElementById('speaker_btn');
    const suggestedPromptsContainer = document.getElementById('suggested_prompts');
    const promptBtns = document.querySelectorAll('.prompt_btn');

    // Kontrola, zda prvky existují
    if (!trigger || !windowEl) {
        console.error("Venesis AI: Prvky chat_trigger nebo chat_window nebyly nalezeny v HTML!");
        return;
    }

    let selectedFile = null, mediaRecorder = null, audioChunks = [], recordedAudioBlob = null, isVoiceEnabled = !1, currentAudio = null, audioQueue = [], isPlaying = !1;

    function getTime() { 
        const t = new Date; 
        return String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0') 
    }

    document.querySelectorAll('.init_time').forEach(t => { t.innerText = getTime() });

    trigger.addEventListener('click', () => {
        if (windowEl.classList.contains('active')) {
            windowEl.classList.remove('active');
            windowEl.classList.add('closing');
            setTimeout(() => { windowEl.classList.remove('closing') }, 500)
        } else {
            windowEl.classList.remove('closing');
            windowEl.classList.add('active')
        }
    });

    closeBtn.addEventListener('click', () => {
        windowEl.classList.remove('active');
        windowEl.classList.add('closing');
        setTimeout(() => { windowEl.classList.remove('closing') }, 500)
    });

    speakerBtn.addEventListener('click', () => {
        isVoiceEnabled = !isVoiceEnabled, isVoiceEnabled ? speakerBtn.classList.add('active') : (speakerBtn.classList.remove('active'), audioQueue = [], currentAudio && (currentAudio.pause(), currentAudio = null), isPlaying = !1)
    });

    async function playNextAudio() {
        if (0 === audioQueue.length) return void (isPlaying = !1);
        isPlaying = !0;
        const t = audioQueue.shift().replace(/<[^>]*>?/gm, '').trim();
        if (0 === t.length) return void playNextAudio();
        try {
            const e = new FormData;
            e.append("text", t);
            const n = await fetch('http://127.0.0.1:8000/tts', { method: 'POST', body: e });
            if (n.ok) {
                const t = await n.blob();
                currentAudio = new Audio(URL.createObjectURL(t)), currentAudio.onended = () => { playNextAudio() }, currentAudio.play()
            } else playNextAudio()
        } catch (t) { console.error(t), playNextAudio() }
    }

    attachBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', t => { t.target.files.length > 0 && (selectedFile = t.target.files[0], attachBtn.style.color = '#000') });

    micBtn.addEventListener('click', async () => {
        if (mediaRecorder && "recording" === mediaRecorder.state) mediaRecorder.stop(), micBtn.style.color = "#aaa";
        else try {
            const t = await navigator.mediaDevices.getUserMedia({ audio: !0 });
            mediaRecorder = new MediaRecorder(t), mediaRecorder.start(), micBtn.style.color = "red", audioChunks = [], mediaRecorder.addEventListener("dataavailable", t => { audioChunks.push(t.data) }), mediaRecorder.addEventListener("stop", () => { recordedAudioBlob = new Blob(audioChunks, { type: 'audio/webm' }) })
        } catch (t) { alert("K mikrofonu nebyl povolen pristup.") }
    });

    promptBtns.forEach(t => {
        t.addEventListener('click', () => { inputEl.value = t.innerText, sendMessage() })
    });

    async function sendMessage() {
        const t = inputEl.value.trim();
        if (!t && !selectedFile && !recordedAudioBlob) return;
        audioQueue = [], currentAudio && (currentAudio.pause(), currentAudio = null), isPlaying = !1, suggestedPromptsContainer && (suggestedPromptsContainer.style.display = 'none');
        let e = '';
        t && (e += `<div>${t}</div>`), selectedFile ? e += `<img src="${URL.createObjectURL(selectedFile)}" style="max-width:100%;border-radius:6px;margin-top:6px;display:block;">` : recordedAudioBlob && (e += `<audio controls src="${URL.createObjectURL(recordedAudioBlob)}" style="max-width:100%;margin-top:6px;height:40px;"></audio>`), messagesEl.innerHTML += `<div class="msg_wrap user"><div class="msg">${e}</div><div class="time">${getTime()}</div></div>`, inputEl.value = '', messagesEl.scrollTop = messagesEl.scrollHeight;
        const n = 'loader_' + Date.now();
        messagesEl.innerHTML += `<div id="${n}" class="msg_wrap ai"><div class="loader"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>`, messagesEl.scrollTop = messagesEl.scrollHeight;
        try {
            const e = new FormData;
            t && e.append("message", t), selectedFile ? e.append("file", selectedFile) : recordedAudioBlob && e.append("file", recordedAudioBlob, "hlasovka.webm"), selectedFile = null, recordedAudioBlob = null, fileInput.value = '', attachBtn.style.color = "#aaa";
            const r = await fetch('http://127.0.0.1:8000/chat', { method: 'POST', body: e }), o = r.body.getReader(), a = new TextDecoder();
            let i = "", s = !1, d = null, c = "";
            function l() { if (i.length > 0) d.innerHTML += i[0], i = i.substring(1), messagesEl.scrollTop = messagesEl.scrollHeight, setTimeout(l, 20); else s = !1 }
            for (; ;) {
                const { done: t, value: e } = await o.read();
                if (t) break;
                const r = a.decode(e, { stream: !0 });
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
                    const t = document.getElementById(n);
                    t && t.remove();
                    const e = document.createElement('div');
                    e.className = 'msg_wrap ai', d = document.createElement('div'), d.className = 'msg';
                    const r = document.createElement('div');
                    r.className = 'time', r.innerText = getTime(), e.appendChild(d), e.appendChild(r), messagesEl.appendChild(e), s = !0, l()
                }
            }
            if (isVoiceEnabled && c.trim().length > 0) {
                let t = c.replace(/<[^>]*>?/gm, '').trim();
                t.length > 0 && (audioQueue.push(t), isPlaying || playNextAudio())
            }
        } catch (t) {
            const e = document.getElementById(n);
            e && e.remove(), messagesEl.innerHTML += `<div class="msg_wrap ai"><div class="msg" style="background:red;">Chyba spojeni s backendem.</div></div>`
        }
    }

    sendBtn.addEventListener('click', sendMessage);
    inputEl.addEventListener('keypress', t => { 'Enter' === t.key && sendMessage() });

    console.log("Venesis AI: Skript byl úspěšně nastaven.");
});
