(async function () {
  try {
    const theme = localStorage.getItem('theme_switch');
    let mode = 'light';

    if (
      theme === 'dark_mode' ||
      (theme === 'follow_os' &&
       window.matchMedia('(prefers-color-scheme: dark)').matches)
    ) {
      mode = 'dark';
    }

    document.documentElement.setAttribute('color-mode', mode);
  } catch (error) {
    console.error('Error setting preload theme:', error);
    // Fallback to light mode on error
    document.documentElement.setAttribute('color-mode', 'light');
  }
})();
