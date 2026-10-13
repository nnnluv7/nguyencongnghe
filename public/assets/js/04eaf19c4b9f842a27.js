
//<![CDATA[ 

function hideArticle() {
const articles = document.querySelectorAll('article.post-filter');

articles.forEach(article => {
	var currentUrl = window.location.href;
	if (currentUrl === "https://okla123.blogspot.com/" || currentUrl.includes('/search/?q')) {
    const postTag = article.querySelector('.post-tag');
    if (postTag && ['Tools', 'private', 'Kho', 'PrintMWWG'].includes(postTag.textContent.trim())) {
        article.style.display = 'none';
    }}
});
}
hideArticle();



const modal = document.querySelector('.modal');
              const xHuongDan = document.querySelector('.js-hdin');
              const closeModal = document.querySelector('.modal__body-right');
              const allCover = document.getElementsByClassName("allcovertit");
              const xChangTit = document.querySelector('.js-changetit');
              const closeModalTit = document.querySelector('.modal_tit-header-right'); 
              const modalTit = document.querySelector('.modal_tit');
              const modalTit0 = document.querySelector('.modal_tit-0');
              const modalTit1 = document.querySelector('.modal_tit-1');
              const modalTit2 = document.querySelector('.modal_tit-2');
              const modalTit3 = document.querySelector('.modal_tit-3');
              const modalTit4 = document.querySelector('.modal_tit-4');
              const modalTit5 = document.querySelector('.modal_tit-5');
              const modalTit6 = document.querySelector('.modal_tit-6');
              const modalTit7 = document.querySelector('.modal_tit-7');
              const modalTit8 = document.querySelector('.modal_tit-8');
              const modalTit9 = document.querySelector('.modal_tit-9');

                function showHdin() {
                   modal.classList.add('modal-open');
                   }
                function hideHdin() {
                   modal.classList.remove('modal-open');
                   }
                function showTit() {
                   modalTit.classList.add('modal-open');
               }
                function hideTit() {
                   modalTit.classList.remove('modal-open');
                   }
                function changeTit0() {      
                  modalTit.classList.remove('modal-open');

                  for (var i = 0; i < allCover.length; i++) {
                  allCover[i].style.background = "var(--title-cover)";
                  allCover[i].style.backgroundSize = "100% 100%";
                  }
               }
                function changeTit1() {      
                  modalTit.classList.remove('modal-open');
                  for (var i = 0; i < allCover.length; i++) {
                  allCover[i].style.background = "var(--title-cover1)";
                  allCover[i].style.backgroundSize = "100% 100%";
                  }
               }
                function changeTit2() {      
                  modalTit.classList.remove('modal-open');
                  for (var i = 0; i < allCover.length; i++) {
                  allCover[i].style.background = "var(--title-cover2)";
                  allCover[i].style.backgroundSize = "100% 100%";
                  }
               }
                function changeTit3() {      
                  modalTit.classList.remove('modal-open');
                  for (var i = 0; i < allCover.length; i++) {
                  allCover[i].style.background = "var(--title-cover3)";
                  allCover[i].style.backgroundSize = "100% 100%";
                  }
               }
                function changeTit4() {      
                  modalTit.classList.remove('modal-open');
                  for (var i = 0; i < allCover.length; i++) {
                  allCover[i].style.background = "var(--title-cover4)";
                  allCover[i].style.backgroundSize = "100% 100%";
                  }
               }
                function changeTit5() {      
                  modalTit.classList.remove('modal-open');
                  for (var i = 0; i < allCover.length; i++) {
                  allCover[i].style.background = "var(--title-cover5)";
                  allCover[i].style.backgroundSize = "100% 100%";
                  }
               }
                function changeTit6() {      
                  modalTit.classList.remove('modal-open');
                  for (var i = 0; i < allCover.length; i++) {
                  allCover[i].style.background = "var(--title-cover6)";
                  allCover[i].style.backgroundSize = "100% 100%";
                  }
               }
                function changeTit7() {      
                  modalTit.classList.remove('modal-open');
                  for (var i = 0; i < allCover.length; i++) {
                  allCover[i].style.background = "var(--title-cover7)";
                  allCover[i].style.backgroundSize = "100% 100%";
                  }
               }
                function changeTit8() {      
                  modalTit.classList.remove('modal-open');
                  for (var i = 0; i < allCover.length; i++) {
                  allCover[i].style.background = "var(--title-cover8)";
                  allCover[i].style.backgroundSize = "100% 100%";
                  }
               }
                function changeTit9() {      
                  modalTit.classList.remove('modal-open');
                  for (var i = 0; i < allCover.length; i++) {
                  allCover[i].style.background = "var(--title-cover9)";
                  allCover[i].style.backgroundSize = "100% 100%";
                  }
               }

              xHuongDan.addEventListener('click', showHdin);
              closeModal.addEventListener('click', hideHdin);
              xChangTit.addEventListener('click', showTit);
              closeModalTit.addEventListener('click', hideTit);
              modalTit0.addEventListener('click', changeTit0);
              modalTit1.addEventListener('click', changeTit1);
              modalTit2.addEventListener('click', changeTit2);
              modalTit3.addEventListener('click', changeTit3);
              modalTit4.addEventListener('click', changeTit4);
              modalTit5.addEventListener('click', changeTit5);
              modalTit6.addEventListener('click', changeTit6);
              modalTit7.addEventListener('click', changeTit7);
              modalTit8.addEventListener('click', changeTit8);
              modalTit9.addEventListener('click', changeTit9);


//]]>    
