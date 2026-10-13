
//<![CDATA[
/* MODULE 1: HẠ TẦNG & AUTH */
window.QuizSystem = {
    // 1. Cấu hình Database & API
    DB: {
        "ctkm": ["https://docs.google.com/spreadsheets/d/e/2PACX-1vQKmfueT0R0ELPYhZzeKb6ImZZswds30NhDbPlbAHizp5BaxS_IIzzhIltMhFpZ9iVWAqc01SASit26/pub?output=csv"]
    },
    API_URL: window.CG_CONFIG.apiUrl,
    HISTORY_URL: "/p/lich-su-thi.html",
    
    // 2. Biến dùng chung
    user: null, root: null,
    
    // 3. Helper: Gọi API & Chặn màn hình
    callApi: async function(d) {
        this.ui.block(true, "Đang xử lý...");
        try {
            const r = await fetch(this.API_URL, {method: 'POST', body: JSON.stringify(d)});
            const j = await r.json(); this.ui.block(false); return j;
        } catch(e) { this.ui.block(false); return {status: "error", msg: "Lỗi kết nối: " + e}; }
    },
    ui: {
        block: (s, t) => { 
            const b = document.getElementById('qz-save-blocker'); 
            if(s) { document.getElementById('blocker-title').innerText = t; b.style.display = 'flex'; } 
            else { b.style.display = 'none'; } 
        }
    }
};

// --- LOGIC AUTH (LOGIN/REGISTER) ---
(function() {
    const Sys = window.QuizSystem;

    function initAuth() {
        const s = localStorage.getItem('qz_user');
        try { if(s) { Sys.user = JSON.parse(s); } } catch(e) { localStorage.removeItem('qz_user'); } renderHeader(!!Sys.user);
        renderModals();
    }

    function renderHeader(isLog) {
        // Desktop
        const hD = document.getElementById('auth-header-desktop');
        if(hD) {
            hD.innerHTML = isLog ? 
            `<div class="user-menu-wrap" onclick="toggleUserMenu('desk')"><div class="auth-btn btn-user"><i class="fa-solid fa-user-circle"></i> ${Sys.user.username} <i class="fa-solid fa-caret-down"></i></div><div id="user-dropdown-desk" class="user-dropdown"><a class="user-item" href="${Sys.HISTORY_URL}"><i class="fa-solid fa-history"></i> Lịch sử thi</a><div class="user-item" onclick="doLogout()"><i class="fa-solid fa-sign-out-alt"></i> Đăng xuất</div></div></div>` : 
            `<button class="auth-btn btn-login" onclick="openModal('login')">Đăng nhập</button><button class="auth-btn btn-reg" onclick="openModal('reg')">Đăng ký</button>`;
        }
        // Mobile
        const hM = document.getElementById('auth-header-mobile');
        if(hM) {
            hM.innerHTML = isLog ? 
            `<div class="mobile-user-row" onclick="toggleMobileMenu()"><span><i class="fa-solid fa-user-circle"></i> ${Sys.user.username}</span><i class="fa-solid fa-chevron-down"></i></div><div id="mobile-dropdown" class="mobile-user-menu"><a class="user-item" href="${Sys.HISTORY_URL}"><i class="fa-solid fa-history"></i> Xem lịch sử thi</a><div class="user-item" onclick="doLogout()"><i class="fa-solid fa-sign-out-alt"></i> Đăng xuất</div></div>` : 
            `<div class="mobile-auth-btns"><button class="auth-btn btn-login" onclick="openModal('login')">Đăng nhập</button><button class="auth-btn btn-reg" onclick="openModal('reg')">Đăng ký</button></div>`;
        }
    }

    function renderModals() {
        if(document.getElementById('modal-login')) return;
        let d = document.createElement('div');
        d.innerHTML = `
        <div id="modal-login" class="auth-modal"><div class="auth-box"><span class="auth-close" onclick="closeAuth()">&times;</span><h3 style="text-align:center;color:var(--qz-primary)">ĐĂNG NHẬP</h3><input id="log-user" class="auth-input" placeholder="Tên đăng nhập"><input type="password" id="log-pass" class="auth-input" placeholder="Mật khẩu"><p id="login-msg" style="color:red;display:none;text-align:center"></p><button class="auth-submit" onclick="doLogin()">Đăng nhập</button><div class="auth-link" onclick="openModal('reg')">Chưa có tài khoản? Đăng ký</div></div></div>
        <div id="modal-reg" class="auth-modal"><div class="auth-box"><span class="auth-close" onclick="closeAuth()">&times;</span><h3 style="text-align:center;color:var(--qz-primary)">ĐĂNG KÝ</h3><input id="reg-user" class="auth-input" placeholder="Tên đăng nhập"><input id="reg-email" class="auth-input" placeholder="Email"><input type="password" id="reg-pass" class="auth-input" placeholder="Mật khẩu"><input type="password" id="reg-repass" class="auth-input" placeholder="Nhập lại mật khẩu"><p id="reg-msg" style="color:red;display:none;text-align:center"></p><button class="auth-submit" onclick="doRegister()">Đăng ký</button><div class="auth-link" onclick="openModal('login')">Đã có tài khoản? Đăng nhập</div></div></div>
        <div id="qz-save-blocker" class="qz-blocker"><div class="qz-spinner"></div><p id="blocker-title">Đang xử lý...</p></div>`;
        document.body.appendChild(d);
    }

    // Expose Functions
    window.toggleUserMenu = (t) => { const m=document.getElementById('user-dropdown-'+t); if(m) m.classList.toggle('show'); }
    window.toggleMobileMenu = () => { const m=document.getElementById('mobile-dropdown'); if(m) m.classList.toggle('open'); }
    window.openModal = (id) => { document.querySelectorAll('.auth-modal').forEach(e=>e.style.display='none'); document.getElementById('modal-'+id).style.display='flex'; }
    window.closeAuth = () => { document.querySelectorAll('.auth-modal').forEach(e=>e.style.display='none'); }
    window.doLogout = () => { localStorage.removeItem('qz_user'); Sys.user=null; renderHeader(false); location.reload(); }
    
    window.doLogin = async () => { 
        const u = document.getElementById('log-user').value.trim(), p = document.getElementById('log-pass').value, msg = document.getElementById('login-msg'); 
        if(!u||!p) return showMsg(msg,"Nhập tên và mật khẩu!"); 
        const res = await Sys.callApi({action:'login',username:u,password:p}); 
        if(res.status=='success'){ Sys.user={username:res.username,email:res.email}; localStorage.setItem('qz_user',JSON.stringify(Sys.user)); closeAuth(); renderHeader(true); location.reload(); } else showMsg(msg,res.msg); 
    }
    window.doRegister = async () => { 
        const u = document.getElementById('reg-user').value.trim(), e = document.getElementById('reg-email').value.trim(), p = document.getElementById('reg-pass').value, rp = document.getElementById('reg-repass').value, msg = document.getElementById('reg-msg'); 
        if(!u||!e||!p) return showMsg(msg,"Điền đủ thông tin!"); if(p!==rp) return showMsg(msg,"Mật khẩu không khớp!"); 
        const res = await Sys.callApi({action:'register',username:u,email:e,password:p}); 
        if(res.status=='success'){ alert("Đăng ký thành công!"); openModal('login'); } else showMsg(msg,res.msg); 
    }
    function showMsg(el, txt) { el.style.display = 'block'; el.innerText = txt; }

    initAuth();
})();
//]]>
