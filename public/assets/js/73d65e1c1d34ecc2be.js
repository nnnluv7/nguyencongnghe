/* Compatibility for a cached page: never override the NCN preference. */
if(window.NCN_APPEARANCE)window.NCN_APPEARANCE.refresh();
else try{document.getElementById("mainContent")?.classList.toggle("dark",localStorage.getItem("ncn-theme")==="dark");}catch{}
