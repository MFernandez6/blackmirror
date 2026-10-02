export const THEME_STORAGE_KEY = "blackline-theme";

/** Runs in <head> before paint so a saved light preference never flashes dark. */
export const themeInitScript = `(function(){try{if(localStorage.getItem("${THEME_STORAGE_KEY}")==="light"){document.documentElement.dataset.theme="light";}}catch(e){}})();`;
