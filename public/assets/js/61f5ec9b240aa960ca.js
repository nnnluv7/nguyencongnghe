
//<![CDATA[
/* MODULE 3: QUESTION TYPES REGISTRY */
(function() {
    window.QuizTypes = {};

    // 1. TEXT (Điền từ) - Đã sửa để Input nằm trong tiêu đề
    window.QuizTypes['text'] = {
        render: (q, ans, idx) => {
            let parts = q.question.split('{input}');
            // Dùng class qz-q-text để nó to đẹp như tiêu đề
            let html = `<div class="qz-q-text" style="line-height:2.2">Câu ${idx+1}: `;
            
            for(let i=0; i<parts.length; i++) {
                html += parts[i];
                // Nếu chưa phải phần cuối thì chèn Input vào
                if(i < parts.length - 1) {
                    let val = (ans && ans[i]) ? ans[i] : '';
                    html += `<input type="text" class="qz-inline-input" oninput="quizSaveAns(${idx}, ${i}, 'text', this.value)" value="${val}" autocomplete="off"/>`;
                }
            }
            return html + `</div>`;
        },
        check: (q, ans) => {
            if (!ans || !Array.isArray(ans) || ans.length !== q.correct.length) return false;
            for(let i=0; i<q.correct.length; i++) { if (ans[i].toLowerCase().trim() !== q.correct[i].toLowerCase().trim()) return false; }
            return true;
        },
        hasAnswer: (ans, q) => ans && ans.length === q.correct.length && ans.every(s => s && s.trim() !== "")
    };

    // 2. RADIO
    window.QuizTypes['radio'] = {
        render: (q, ans, idx) => {
            let layout = window.QuizLayouts.getRandom();
            let html = `<div class="qz-opts ${layout}">`;
            q.options.forEach((opt, i) => {
                let isSel = (ans === i);
                html += `<label class="qz-opt-label ${isSel?'selected':''}" onclick="quizOptionClick(this, 'radio')">
                         <input type="radio" name="opt-${idx}" value="${i}" ${isSel?'checked':''} onchange="quizSaveAns(${idx}, ${i}, 'radio')"/> ${opt}</label>`;
            });
            return html + `</div>`;
        },
        check: (q, ans) => ans !== null && ans !== undefined && ans === q.correct[0] - 1,
        hasAnswer: (ans) => ans !== null && ans !== undefined
    };

    // 3. CHECKBOX
    window.QuizTypes['checkbox'] = {
        render: (q, ans, idx) => {
            let layout = window.QuizLayouts.getRandom();
            let html = `<div class="qz-opts ${layout}">`;
            q.options.forEach((opt, i) => {
                let isSel = (ans && ans.includes(i));
                html += `<label class="qz-opt-label ${isSel?'selected':''}" onclick="quizOptionClick(this, 'checkbox')">
                         <input type="checkbox" name="opt-${idx}" value="${i}" ${isSel?'checked':''} onchange="quizSaveAns(${idx}, ${i}, 'checkbox')"/> ${opt}</label>`;
            });
            return html + `</div>`;
        },
        check: (q, ans) => {
            if (!ans || ans.length === 0) return false;
            let c = q.correct.map(x => x - 1).sort(); let u = ans.slice().sort();
            return JSON.stringify(c) === JSON.stringify(u);
        },
        hasAnswer: (ans) => ans && ans.length > 0
    };

    // 4. MATCH
    window.QuizTypes['match'] = {
        render: (q, ans, idx) => {
            let html = `<div class="qz-match-container"><div class="qz-match-col" id="match-col-left"></div><div class="qz-match-col" id="match-col-right"></div></div>`;
            setTimeout(() => { renderMatchGame(idx, q, ans); drawMatchLines(idx); }, 50);
            return html;
        },
        check: (q, ans) => {
            if (!ans || Object.keys(ans).length !== q.matchPairs.length) return false;
            for (let k in ans) { if (parseInt(ans[k]) !== parseInt(k)) return false; }
            return true;
        },
        hasAnswer: (ans, q) => ans && Object.keys(ans).length === q.matchPairs.length
    };

    // 5. CIRCLE
    window.QuizTypes['circle'] = {
        render: (q, ans, idx) => {
            let html = `<div class="qz-circle-container">`;
            q.options.forEach((opt, i) => {
                let clean = opt.replace(/^[A-D][\.\)]\s*/, ''), lbl = String.fromCharCode(65 + i), isSel = (ans === i);
                let path = "M 35.8 8.6 c -6.8 -5.6 -22.4 -2 -28.2 8.4 c -4.4 7.9 -1.6 20.4 5.2 26.2 c 8.4 7.1 22.8 5.7 30.6 -2.6 c 6.5 -7 6.1 -19.9 -1.2 -26.6";
                html += `<div class="qz-circle-item ${isSel?'selected':''}" onclick="quizOptionClick(this, 'circle')">
                         <div class="qz-circle-mark">${lbl}<svg class="qz-circle-svg" viewBox="0 0 50 50"><path d="${path}" class="qz-circle-path"/></svg></div>
                         <div class="qz-circle-text">${clean}</div>
                         <input type="radio" name="opt-${idx}" value="${i}" ${isSel?'checked':''} style="display:none" onchange="quizSaveAns(${idx}, ${i}, 'radio')"/></div>`;
            });
            return html + `</div>`;
        },
        check: (q, ans) => ans !== null && ans !== undefined && ans === q.correct[0] - 1,
        hasAnswer: (ans) => ans !== null && ans !== undefined
    };

    // 6. UNDERLINE
    window.QuizTypes['underline'] = {
        render: (q, ans, idx) => {
            let html = `<div class="qz-underline-box">`;
            q.options.join(' ').split(/\s+/).forEach((w, i) => {
                let cw = w.replace(/[.,!?;:"'()]/g, ""), isSel = (ans && ans.includes(cw + '_' + i));
                html += `<span class="qz-word ${isSel?'selected':''}" onclick="underlineClick(this, ${idx}, '${cw}', ${i})">${w}</span> `;
            });
            return html + `</div><div style="font-size:0.9em;color:#666;margin-top:5px;font-style:italic"><i class="fa-solid fa-hand-point-up"></i> Chạm vào từ để gạch chân.</div>`;
        },
        check: (q, ans) => {
            if (!ans || ans.length === 0) return false;
            let s = ans.map(v => v.split('_')[0].toLowerCase().trim()).sort();
            let c = q.correct.map(v => v.toLowerCase().trim()).sort();
            return JSON.stringify(s) === JSON.stringify(c);
        },
        hasAnswer: (ans) => ans && ans.length > 0
    };

    // --- HELPER INTERACTIONS ---
    window.quizOptionClick = (el, type) => {
        if(type==='radio') { el.parentElement.querySelectorAll('.qz-opt-label').forEach(e=>e.classList.remove('selected')); el.classList.add('selected'); }
        else if(type==='checkbox') { setTimeout(() => { let inp=el.querySelector('input'); el.classList.toggle('selected', inp.checked); }, 50); }
        else if(type==='circle') { el.parentElement.querySelectorAll('.qz-circle-item').forEach(e=>e.classList.remove('selected')); el.classList.add('selected'); let inp=el.querySelector('input'); if(inp){inp.checked=true;inp.onchange();} }
    };
    window.underlineClick = (el, idx, txt, wIdx) => {
        el.classList.toggle('selected');
        let val = txt + '_' + wIdx;
        if(!userAnswers[idx]) userAnswers[idx] = [];
        if(el.classList.contains('selected')) userAnswers[idx].push(val); else userAnswers[idx]=userAnswers[idx].filter(x=>x!==val);
        checkNextButtonState(idx);
    };

    // Match Helpers
    let matchState = {left:null, right:null};
    window.renderMatchGame = (idx, q, saved) => {
        saved = saved || {};
        const lC = document.getElementById('match-col-left'), rC = document.getElementById('match-col-right');
        if(!lC) return;
        lC.innerHTML = q.matchPairs.map((p,i) => `<div class="qz-match-item ${saved.hasOwnProperty(i)?'matched':''}" onclick="matchClick('left',${i},${idx})" id="m-left-${i}">${p.left}</div>`).join('');
        rC.innerHTML = q.matchRightOrder.map(o => `<div class="qz-match-item ${Object.values(saved).includes(o)?'matched':''}" onclick="matchClick('right',${o},${idx})" id="m-right-${o}">${q.matchPairs[o].right}</div>`).join('');
        const con = document.querySelector('.qz-match-container');
        if(con && !con.querySelector('.match-svg')) { let s=document.createElementNS('http://www.w3.org/2000/svg','svg'); s.setAttribute('class','match-svg'); con.appendChild(s); }
        matchState = {left:null, right:null};
    };
    window.matchClick = (side, id, idx) => {
        if(!userAnswers[idx]) userAnswers[idx] = {};
        if(side==='left' && userAnswers[idx].hasOwnProperty(id)) { delete userAnswers[idx][id]; updateMatchUI(idx); return; }
        if(side==='right') { let f=Object.keys(userAnswers[idx]).find(k=>userAnswers[idx][k]===id); if(f){ delete userAnswers[idx][f]; updateMatchUI(idx); return; } }
        let col = side==='left'?'match-col-left':'match-col-right';
        document.getElementById(col).querySelectorAll('.qz-match-item').forEach(e=>{ if(!e.classList.contains('matched')) e.classList.remove('active'); });
        document.getElementById((side==='left'?'m-left-':'m-right-')+id).classList.add('active');
        matchState[side] = id;
        if(matchState.left!==null && matchState.right!==null) { userAnswers[idx][matchState.left]=matchState.right; updateMatchUI(idx); }
    };
    window.updateMatchUI = (idx) => {
        let ans = userAnswers[idx] || {};
        document.querySelectorAll('.qz-match-item').forEach(e=>e.className='qz-match-item');
        matchState={left:null, right:null};
        for(let l in ans) { document.getElementById('m-left-'+l).className='qz-match-item matched'; document.getElementById('m-right-'+ans[l]).className='qz-match-item matched'; }
        drawMatchLines(idx); checkNextButtonState(idx);
    };
    window.drawMatchLines = (idx) => {
        const con = document.querySelector('.qz-match-container'); if(!con) return;
        let svg = con.querySelector('.match-svg'); while(svg.firstChild) svg.removeChild(svg.firstChild);
        let ans = userAnswers[idx]; if(!ans) return;
        const cR = con.getBoundingClientRect();
        for(let l in ans) {
            let elL=document.getElementById(`m-left-${l}`), elR=document.getElementById(`m-right-${ans[l]}`);
            if(elL && elR) {
                let rL=elL.getBoundingClientRect(), rR=elR.getBoundingClientRect();
                let ln=document.createElementNS('http://www.w3.org/2000/svg','line');
                ln.setAttribute('x1', rL.right-cR.left); ln.setAttribute('y1', rL.top+rL.height/2-cR.top);
                ln.setAttribute('x2', rR.left-cR.left); ln.setAttribute('y2', rR.top+rR.height/2-cR.top);
                ln.setAttribute('class','match-line'); svg.appendChild(ln);
            }
        }
    };
})();
//]]>
