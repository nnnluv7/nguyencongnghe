
//<![CDATA[
/* MODULE 4: CORE ENGINE (ĐÃ CẬP NHẬT FIX LỖI HISTORY) */
let config, quizData=[], userAnswers=[], currentQ=0, timer, timeLeft, studentInfo={}, deadlineTime, quizStartTime;
const Sys = window.QuizSystem;

// 1. Init
window.initQuizModule = function(cfg, containerId) {
    config = cfg; Sys.root = document.getElementById(containerId);
    if(!Sys.root) return console.error("Missing container");
    renderWelcome();
};

function renderWelcome() {
    let u = Sys.user;
    let nameHtml = u ? `<div style="font-size:1.2em;margin:20px;color:var(--qz-primary)">Xin chào, <b>${u.username}</b>!</div>` : `<div style="margin:20px;color:#e74c3c;font-weight:bold">Bạn chưa đăng nhập!</div>`;
    let btnTxt = u ? "🚀 Bắt đầu làm bài" : "🚀 Bắt đầu (Thí sinh tự do)";
    Sys.root.innerHTML = `
      <div class="qz-screen active qz-welcome">
        <h2 style="color:var(--qz-primary);text-transform:uppercase;">${document.title}</h2>
        <p>⏳ ${config.timeMinutes} phút | 📝 ${config.maxQuestions} câu</p>
        ${nameHtml}
        <div class="qz-input-group" style="${u?'display:none':''}"><label>Tên của em là gì?</label><input type="text" id="inp-name" class="qz-input" placeholder="Ví dụ: Minh Đăng" autocomplete="off"/></div>
        <button class="qz-btn" onclick="appStartQuiz()">${btnTxt}</button><br>
        ${u ? `<button class="qz-btn qz-btn-outline" onclick="appShowHistory(false)">📜 Xem lịch sử thi</button>` : ''}
      </div>`;
}

window.appStartQuiz = async function() {
    let name, id;
    if (Sys.user) { name = Sys.user.username; id = Sys.user.email; } 
    else { name = document.getElementById('inp-name').value.trim(); if(!name) { alert('Con chưa điền tên!'); return document.getElementById('inp-name').focus(); } id = getDeviceId(); }
    studentInfo = {name: name, id: id};
    Sys.ui.block(true, "Đang tải dữ liệu...");
    try {
      let links = resolveLinks(config.source);
      if(links.length===0) throw new Error("Chưa khai báo nguồn!");
      await fetchAllSources(links);
      Sys.ui.block(false); 
      quizStartTime = new Date(); deadlineTime = quizStartTime.getTime() + (config.timeMinutes * 60 * 1000);
      renderQuizScreen(); startTimer();
    } catch(e) { Sys.ui.block(false); alert("Lỗi: " + e.message); }
}

// 2. Data
function resolveLinks(src) { let u=[]; (Array.isArray(src)?src:[src]).forEach(k => { if(Sys.DB[k]) u=u.concat(Sys.DB[k]); }); return u; }
function getDeviceId() { let i=localStorage.getItem('quiz_device_id'); if(!i){i='dev_'+Date.now()+'_'+Math.random().toString(36).substr(2,9);localStorage.setItem('quiz_device_id',i);} return i; }
async function fetchAllSources(urls) {
    const res = await Promise.all(urls.map(u => fetch(u).then(r => r.text())));
    let full = []; const cl = (s) => { if(!s)return""; let t=s.trim(); if(t.startsWith('"')&&t.endsWith('"')) t=t.slice(1,-1).replace(/""/g,'"'); return t; };
    res.forEach(txt => {
        const rows = txt.split(/\r?\n/);
        for(let i=0; i<rows.length; i+=9) {
           if(i+8 >= rows.length) break;
           let type = cl(rows[i]); if(!type) continue;
           let r2 = cl(rows[i+1]), r3 = cl(rows[i+2]), qT, qI;
           if((r2.startsWith('http') && !r3.startsWith('http'))) { qI=r2; qT=r3; } else { qT=r2; qI=r3; }
           let img = qI && qI.includes('drive.google') ? qI.replace(/\/file\/d\/(.+?)\/view.*/, '/uc?export=view&id=$1') : qI;
           
           if(type === 'match') {
               let ps = []; [rows[i+3],rows[i+4],rows[i+5],rows[i+6]].forEach(l=>{ let x=cl(l); if(x&&x.includes('|')) { let p=x.split('|'); ps.push({left:p[0].trim(), right:p[1].trim()}); } });
               full.push({ type:'match', question:qT, image:img, matchPairs:ps, matchRightOrder:ps.map((_,k)=>k).sort(()=>0.5-Math.random()), explain:cl(rows[i+8]), correct:[] });
           } else {
               let op = [cl(rows[i+3]),cl(rows[i+4]),cl(rows[i+5]),cl(rows[i+6])].filter(o=>o!=="");
               let cr = (type==='text'||type==='underline') ? cl(rows[i+7]).split(',').map(s=>s.trim()) : cl(rows[i+7]).split(',').map(s=>parseInt(s.trim())).filter(n=>!isNaN(n));
               full.push({ type:type, question:qT, image:img, options:op, correct:cr, explain:cl(rows[i+8]) });
           }
        }
    });
    if(full.length===0) throw new Error("Dữ liệu trống.");
    if(config.examMode===0) { full.sort(()=>0.5-Math.random()); quizData=full.slice(0,config.maxQuestions); }
    else { let s=parseInt(config.examMode)||1, st=(s-1)*config.maxQuestions; quizData=full.slice(st, st+config.maxQuestions); if(quizData.length===0) throw new Error("Hết câu hỏi."); quizData.sort(()=>0.5-Math.random()); }
    userAnswers = new Array(quizData.length).fill(null);
}

// 3. Render
function renderQuizScreen() { Sys.root.innerHTML = `<div class="qz-screen active"><div class="qz-header"><span id="qz-prog"></span><div class="qz-timer">⏳ <span id="qz-time">00:00</span></div></div><div id="qz-body" style="padding:20px 0"></div><div class="qz-footer"><button class="qz-btn-sm qz-btn-back" onclick="appPrevQ()" id="btn-back" disabled>Quay lại</button><button class="qz-btn-sm qz-btn-skip" onclick="appSkipQ()" id="btn-skip">Bỏ qua</button><button class="qz-btn-sm qz-btn-next" onclick="appNextQ()" id="btn-next">Tiếp theo</button></div></div>`; renderQuestion(0); }

function renderQuestion(idx) {
    const q = quizData[idx];
    document.getElementById('qz-prog').innerText = `Câu ${idx+1}/${quizData.length}`;
    document.getElementById('btn-back').disabled = (idx === 0);
    document.getElementById('btn-next').innerText = (idx === quizData.length - 1) ? "Nộp bài" : "Tiếp theo";
    let img = q.image ? `<div class="qz-img-wrap"><img src="${q.image}" class="qz-img"/></div>` : '';
    
    // --- GỌI MODULE TYPES ---
    let handler = window.QuizTypes[q.type];
    let content = "";
    if (handler) {
        if (q.type === 'text') {
            content = handler.render(q, userAnswers[idx], idx);
        } else {
            content = `<div class="qz-q-text">Câu ${idx+1}: ${q.question}</div>` + handler.render(q, userAnswers[idx], idx);
        }
    } else { content = "Lỗi: Loại câu hỏi chưa được hỗ trợ"; }
    document.getElementById('qz-body').innerHTML = img + content;
    checkNextButtonState(idx);
}

// 4. Interaction
window.quizSaveAns = (qIdx, val, type, extra) => { 
    if(type==='radio') userAnswers[qIdx] = parseInt(val);
    else if(type==='checkbox') { if(!userAnswers[qIdx]) userAnswers[qIdx]=[]; let arr=[]; document.getElementsByName('opt-'+qIdx).forEach(i=>{if(i.checked) arr.push(parseInt(i.value))}); userAnswers[qIdx]=arr; }
    else if(type==='text') { if(!userAnswers[qIdx]) userAnswers[qIdx]=[]; userAnswers[qIdx][val] = extra.trim(); }
    checkNextButtonState(qIdx);
}
window.checkNextButtonState = (idx) => { 
    let h = window.QuizTypes[quizData[idx].type]; let ok = h ? h.hasAnswer(userAnswers[idx], quizData[idx]) : false;
    let b = document.getElementById('btn-next'); if(ok) b.classList.add('active'); else b.classList.remove('active');
}
window.appNextQ = () => { if(!document.getElementById('btn-next').classList.contains('active')) return; if(currentQ<quizData.length-1){currentQ++;renderQuestion(currentQ)}else{finishQuiz()} }
window.appSkipQ = () => { userAnswers[currentQ]=null; if(currentQ<quizData.length-1){currentQ++;renderQuestion(currentQ)}else{finishQuiz()} }
window.appPrevQ = () => { if(currentQ>0){currentQ--;renderQuestion(currentQ)} }

// 5. Finish & Timer
async function finishQuiz() {
    clearInterval(timer);
    let now = new Date().getTime(), dur = Math.min(now - quizStartTime, config.timeMinutes*60000);
    let score = 0; quizData.forEach((q,i) => { let h = window.QuizTypes[q.type]; if(h && h.check(q, userAnswers[i])) score++; });
    let dStr = `${Math.floor(dur/60000)} phút ${Math.floor((dur%60000)/1000)} giây`;
    let rev = config.allowReview==="yes" ? `<button class="qz-btn" onclick="appReview()">Xem đáp án</button>` : '';
    Sys.root.innerHTML = `<div class="qz-screen active" style="text-align:center"><h2 style="color:var(--qz-primary)">KẾT QUẢ</h2><p>Học sinh: <b>${studentInfo.name}</b></p><div class="qz-score-box">${score}/${quizData.length}</div><p>Thời gian: ${dStr}</p><p id="save-msg" style="color:orange">Đang lưu...</p><div class="qz-footer" style="justify-content:center;gap:10px">${rev}<button class="qz-btn qz-btn-outline" onclick="location.reload()">Làm lại</button></div></div>`;
    try { const saved = await Sys.callApi({ action:'save_score', name:studentInfo.name, email:studentInfo.id, quizName:document.title, score:`${score}/${quizData.length}`, detail:new Date().toLocaleString(), duration:dStr }); if (saved.status !== "success") throw new Error(saved.msg || "Lỗi lưu kết quả"); document.getElementById('save-msg').innerText="✅ Đã lưu kết quả!"; document.getElementById('save-msg').style.color="green"; } catch(e){ document.getElementById('save-msg').innerText="⚠️ Lỗi lưu"; }
}
function startTimer() { timer = setInterval(() => { let left = deadlineTime - new Date().getTime(); if(left<=0) { left=0; finishQuiz(); } let m=Math.floor(left/60000), s=Math.floor((left%60000)/1000); document.getElementById('qz-time').innerText = `${m<10?'0'+m:m}:${s<10?'0'+s:s}`; }, 500); }

window.appReview = function() {
    let html = `<h3 style="text-align:center;padding:20px;color:var(--qz-primary)">CHI TIẾT ĐÁP ÁN</h3><div style="padding:20px">`;
    quizData.forEach((q, i) => {
        let h = window.QuizTypes[q.type]; 
        let isRight = h ? h.check(q, userAnswers[i]) : false;
        let img = q.image ? `<div class="qz-img-wrap"><img src="${q.image}" class="qz-img" style="max-height:150px"/></div>` : '';
        let qTxt = (q.type === 'text') ? q.question.replace(/{input}/g, '...') : q.question;
        html += `<div class="qz-review-item"><div class="qz-q-text" style="color:${isRight?'var(--qz-ok)':'var(--qz-err)'}">Câu ${i+1}: ${qTxt}</div>${img}`;

        if (q.type === 'text') {
            let uArr = userAnswers[i]||[], cArr = q.correct;
            for(let k=0; k<cArr.length; k++) {
                let uV = uArr[k]||"", cV = cArr[k], ok = (uV.toLowerCase().trim()===cV.toLowerCase().trim());
                html += `<div class="qz-text-review-row ${ok?'correct':'wrong'}"><span>Ô ${k+1}: <b>${uV||"(Trống)"}</b></span>${!ok?` <span>(Đúng: <b>${cV}</b>)</span>`:''} <span class="qz-status-icon">${ok?'<i class="fa-solid fa-check"></i>':'<i class="fa-solid fa-times"></i>'}</span></div>`;
            }
        } else if (q.type === 'match') {
             let uMap = userAnswers[i]||{};
             html += `<div style="display:flex;justify-content:space-between;font-weight:bold;margin-bottom:10px;font-size:0.9em"><span>Cặp nối</span><span>Kết quả</span></div>`;
             q.matchPairs.forEach((p, idx) => {
                let uSel = uMap[idx], ok = (uSel === idx), uTxt = (uSel !== undefined) ? q.matchPairs[uSel].right : "(Chưa nối)";
                html += `<div class="qz-match-review-row ${ok?'correct':'wrong'}" style="display:flex;justify-content:space-between;align-items:center;"><div><span>${p.left}</span> <i class="fa-solid fa-arrow-right"></i> ${ok ? `<span>${p.right}</span>` : `<span>${uTxt}</span> <br><small style="color:var(--qz-primary)">(Đúng: ${p.right})</small>`}</div><div class="qz-status-icon">${ok?'<i class="fa-solid fa-check"></i>':'<i class="fa-solid fa-times"></i>'}</div></div>`;
             });
        } else if (q.type === 'circle') {
             html += `<div class="qz-circle-container">`;
             q.options.forEach((opt, oIdx) => {
                 let cl = opt.replace(/^[A-D][\.\)]\s*/, ''), lb = String.fromCharCode(65 + oIdx), isC = q.correct.includes(oIdx+1), isU = (userAnswers[i]===oIdx);
                 let cls = isC ? 'correct' : (isU ? 'wrong' : '');
                 html += `<div class="qz-circle-item ${cls}" style="pointer-events:none"><div class="qz-circle-mark">${lb}</div><div class="qz-circle-text">${cl}</div><div class="qz-status-icon">${isC?'<i class="fa-solid fa-check"></i>':(isU?'<i class="fa-solid fa-times"></i>':'')}</div></div>`;
             });
             html += `</div>`;
        } else if (q.type === 'underline') {
             let ws = q.options.join(' ').split(/\s+/), uSel = userAnswers[i]||[]; 
             html += `<div class="qz-underline-box" style="pointer-events:none">`;
             ws.forEach((w, wIdx) => {
                 let cw = w.replace(/[.,!?;:"'()]/g, ""), k = cw+'_'+wIdx, isSel = uSel.includes(k), isKey = q.correct.some(c=>c.toLowerCase().trim()===cw.toLowerCase().trim());
                 let cls = (isSel&&isKey)?'r-correct':((isSel&&!isKey)?'r-wrong':((!isSel&&isKey)?'r-missed':''));
                 html += `<span class="qz-word ${cls}">${w}</span> `;
             });
             html += `</div><div style="margin-top:10px;color:var(--qz-ok)"><b>Đáp án đúng:</b> ${q.correct.join(', ')}</div>`;
        } else {
             q.options.forEach((opt, oIdx)=>{
               let isC = q.correct.includes(oIdx+1), isU = Array.isArray(userAnswers[i]) ? userAnswers[i].includes(oIdx) : userAnswers[i]===oIdx;
               let cls = isC ? 'correct' : (isU ? 'wrong' : '');
               html += `<div class="qz-review-opt ${cls}">${opt} <span class="qz-status-icon">${isC?'<i class="fa-solid fa-check"></i>':(isU?'<i class="fa-solid fa-times"></i>':'')}</span></div>`;
            });
        }
        if(q.explain) html += `<div class="qz-explain">💡 ${q.explain}</div>`; 
        html += `</div>`; 
    });
    html += `<div style="text-align:center;padding:20px"><button class="qz-btn" onclick="location.reload()">Thoát</button></div></div>`; 
    Sys.root.innerHTML = html; window.scrollTo(0,0);
}

// ========================================================
// ĐÂY LÀ PHẦN BỔ SUNG ĐỂ FIX LỖI HISTORY PAGE CỦA MÀY
// ========================================================
window.appShowHistory = function(isAlone) {
    let email = Sys.user ? Sys.user.email : getDeviceId();
    if(!isAlone) Sys.ui.block(true, "Tra cứu..."); else if(Sys.root) document.getElementById(Sys.root.id).innerHTML='<p style="text-align:center">Đang tải dữ liệu...</p>';
    
    fetch(Sys.API_URL + `?action=history&email=${encodeURIComponent(email)}`).then(r=>r.json()).then(d => {
        if(!isAlone) Sys.ui.block(false);
        
        let container = Sys.root; // Lấy container hiện tại
        if(!container) return;    // Nếu không có container thì thôi
        
        if(d.length===0) { 
            let m="Không tìm thấy lịch sử nào."; 
            if(isAlone) container.innerHTML=`<p style="text-align:center;padding:20px">${m}</p>`; 
            else alert(m); 
            return; 
        }
        
        let h = `<div class="qz-screen active" style="display:block">
                    <h3 style="text-align:center;color:var(--qz-primary);margin-bottom:20px">LỊCH SỬ THI</h3>
                    <div class="table-wrap">
                        <table class="qz-history-table">
                            <tr><th>Ngày</th><th>Bài thi</th><th>Điểm</th></tr>
                            ${d.map(x=>`<tr><td>${new Date(x.time).toLocaleDateString()}</td><td>${x.quizName}</td><td style="color:var(--qz-primary);font-weight:bold">${x.score}</td></tr>`).join('')}
                        </table>
                    </div>
                    ${isAlone ? '' : `<div style="text-align:center;margin-top:20px"><button class="qz-btn" onclick="location.reload()">Quay lại</button></div>`}
                 </div>`;
        container.innerHTML = h;
    }).catch(e=>{ 
        if(!isAlone) Sys.ui.block(false); 
        if(isAlone && Sys.root) Sys.root.innerHTML='<p style="text-align:center;color:red">Lỗi kết nối!</p>'; 
        else alert("Lỗi mạng"); 
    });
}

// HÀM CẦU NỐI MỚI (MÀY CẦN HÀM NÀY ĐỂ TRANG LỊCH SỬ HTML CHẠY ĐƯỢC)
window.initHistoryPage = function(divId) {
    // 1. Tìm cái div chứa lịch sử
    Sys.root = document.getElementById(divId);
    if(!Sys.root) return console.error("Không tìm thấy div: " + divId);
    
    // 2. Gọi hàm hiển thị lịch sử (chế độ độc lập = true)
    appShowHistory(true);
};
//]]>
