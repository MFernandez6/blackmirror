export const THEME_STORAGE_KEY = "blackline-theme";

/** Light is the default (rendered on <html>); runs before paint so a saved dark choice never flashes light. */
export const themeInitScript = `(function(){try{if(localStorage.getItem("${THEME_STORAGE_KEY}")==="dark"){delete document.documentElement.dataset.theme;}}catch(e){}})();`;
