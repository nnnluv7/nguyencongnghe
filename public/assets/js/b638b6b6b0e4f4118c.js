
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

// Legacy callers open the same verified account used by the website and VIP.
(function() {
    const account = () => import('/assets/ncn-account.js?v=20261027-photo-save-1').then(module => module.getAccount());
    window.openModal = id => account().then(service => service.open(id));
    window.closeAuth = () => window.NCNAccount?.close();
    window.doLogin = () => window.openModal('login');
    window.doRegister = () => window.openModal('register');
    window.doForgot = () => window.openModal('recovery');
    window.doLogout = () => account().then(service => service.signOut());
    window.toggleUserMenu = () => { const menu=document.querySelector('.ncn-account-menu');if(menu)menu.open=!menu.open; };
    window.toggleMobileMenu = window.toggleUserMenu;
    if(!document.getElementById('qz-save-blocker')) {
      const blocker=document.createElement('div');blocker.id='qz-save-blocker';blocker.className='qz-blocker';
      blocker.innerHTML='<div class="qz-spinner"></div><p id="blocker-title">Đang xử lý...</p>';document.body.append(blocker);
    }
    account();
})();
//]]>
