(function initVenesis() {
    const g = id => document.getElementById(id);
    const tr = g('chat_trigger'), wi = g('chat_window'), cl = g('close_chat'),
          sb = g('send_btn'), ie = g('chat_input'), me = g('chat_messages'),
          ab = g('attach_btn'), fi = g('file_input'), mb = g('mic_btn'), sp = g('speaker_btn');

    // Pojistka: Čekáme na Framer, až vykreslí úplně celou lištu
    if (!tr || !sb || !sp || !ab || !mb) {
        setTimeout(initVenesis, 300);
        return;
    }

    console.log("Venesis AI: Vše načteno, systém je online!");

    let sf=null, mr=null, ac=[], rb=null, ve=true, ca=null, aq=[], ip=false, hw=false;

    // 1. OTEVÍRÁNÍ OKNA A UVÍTÁNÍ
    tr.onclick = () => {
        wi.classList.toggle('active');
        if (wi.classList.contains('active') && !hw && ve) {
            hw = true;
            aq.push("Ahoj! Jsem Venesis. Jak ti můžu dneska pomoci?");
            if (!ip) playAudio();
        }
    };
    cl.onclick = () => wi.classList.remove('active');

    // 2. ZVUK ON/OFF
    sp.onclick = () => {
        ve = !ve;
        if (ve) {
            sp.classList.add('active');
        } else {
            sp.classList.remove('active');
            aq = [];
            if(ca){ ca.pause(); ca=null; }
            ip=false;
        }
    };

    async function playAudio() {
        if (aq.length === 0) { ip = false; return; }
        ip = true;
        let txt = aq.shift().replace(/<[^>]*>?/gm,'').trim();
        if (!txt) return playAudio();
        try {
            let fd = new FormData(); fd.append("text", txt);
            let res = await fetch('http://127.0.0.1:8000/tts', {method:'POST', body:fd});
            if (res.ok) {
                let b = await res.blob();
                ca = new Audio(URL.createObjectURL(b));
                ca.onended = playAudio;
                ca.play();
            } else playAudio();
        } catch(e) { console.log("TTS Error:", e); playAudio(); }
    }

    // 3. PŘÍLOHA
    ab.onclick = () => fi.click();
    fi.onchange = e => {
        if (e.target.files.length > 0) {
            sf = e.target.files[0];
            ab.classList.add('active'); // Sponka svítí
        }
    };

    // 4. MIKROFON
    mb.onclick = async () => {
        if (mr && mr.state === "recording") {
            mr.stop(); 
            mb.classList.remove('recording'); // Vypne pulzování
        } else try {
            let stream = await navigator.mediaDevices.getUserMedia({audio:true});
            mr = new MediaRecorder(stream);
            mr.start(); 
            mb.classList.add('recording'); // Zapne pulzování
            ac = [];
            mr.ondataavailable = e => ac.push(e.data);
            mr.onstop = () => rb = new Blob(ac, {type:'audio/webm'});
        } catch(e) { alert("Mikrofon odepřen."); }
    };

    // 5. ODESLÁNÍ
    async function sendMsg() {
        let txt = ie.value.trim();
        if (!txt && !sf && !rb) return;
        
        aq = []; if(ca){ca.pause(); ca=null;} ip = false;

        let html = '';
        if (txt) html += `<div>${txt}</div>`;
        if (sf) html += `<img src="${URL.createObjectURL(sf)}" style="max-width:100%;border-radius:6px;margin-top:6px;">`;
        if (rb) html += `<audio controls src="${URL.createObjectURL(rb)}" style="max-width:100%;margin-top:6px;height:40px;"></audio>`;

        me.innerHTML += `<div class="msg_wrap user"><div class="msg">${html}</div></div>`;
        ie.value = ''; me.scrollTop = me.scrollHeight;

        let lid = 'l_'+Date.now();
        me.innerHTML += `<div id="${lid}" class="msg_wrap ai"><div class="msg" style="background:0 0;padding:0"><div style="display:flex;gap:4px;padding:12px"><div style="width:6px;height:6px;background:#fff;border-radius:50%;animation:pulse-white 1s infinite"></div><div style="width:6px;height:6px;background:#fff;border-radius:50%;animation:pulse-white 1s infinite .2s"></div><div style="width:6px;height:6px;background:#fff;border-radius:50%;animation:pulse-white 1s infinite .4s"></div></div></div></div>`;
        me.scrollTop = me.scrollHeight;

        try {
            let fd = new FormData();
            if (txt) fd.append("message", txt);
            if (sf) fd.append("file", sf);
            else if (rb) fd.append("file", rb, "hlasovka.webm");

            sf = null; rb = null; fi.value = '';
            ab.classList.remove('active'); mb.classList.remove('recording');

            let res = await fetch('http://127.0.0.1:8000/chat', {method:'POST', body:fd});
            let reader = res.body.getReader(), dec = new TextDecoder();
            let iStr = "", sFlag = false, dNode = null, fStr = "";

            function typeWriter() {
                if (iStr.length > 0) {
                    dNode.innerHTML += iStr[0];
                    iStr = iStr.substring(1);
                    me.scrollTop = me.scrollHeight;
                    setTimeout(typeWriter, 20);
                } else sFlag = false;
            }

            while(true) {
                let {done, value} = await reader.read();
                if (done) break;
                let chunk = dec.decode(value, {stream:true});
                iStr += chunk;

                if (ve) {
                    fStr += chunk;
                    while(true) {
                        let m = fStr.match(/(.*?[.?!>\n])/);
                        if (!m) break;
                        let sent = m[1];
                        fStr = fStr.substring(sent.length);
                        let clean = sent.replace(/<[^>]*>?/gm,'').trim();
                        if (clean) { aq.push(clean); if(!ip) playAudio(); }
                    }
                }

                if (!sFlag) {
                    let ld = g(lid); if(ld) ld.remove();
                    let w = document.createElement('div'); w.className = 'msg_wrap ai';
                    dNode = document.createElement('div'); dNode.className = 'msg';
                    w.appendChild(dNode); me.appendChild(w);
                    sFlag = true; typeWriter();
                }
            }
            if (ve && fStr.trim()) {
                let clean = fStr.replace(/<[^>]*>?/gm,'').trim();
                if (clean) { aq.push(clean); if(!ip) playAudio(); }
            }

        } catch(e) {
            let ld = g(lid); if(ld) ld.remove();
            me.innerHTML += `<div class="msg_wrap ai"><div class="msg" style="background:rgba(255,0,0,.2);border-color:red">Chyba (127.0.0.1)</div></div>`;
            me.scrollTop = me.scrollHeight;
        }
    }

    sb.onclick = sendMsg;
    ie.onkeypress = e => { if(e.key === 'Enter') sendMsg(); };

})();
