const landingPage = document.getElementById('landing-page');
const appShell = document.getElementById('app-shell');

function startApp() {
  if (!appShell || !landingPage) return;

  landingPage.classList.add('is-hidden');
  landingPage.setAttribute('aria-hidden', 'true');
  appShell.classList.remove('hidden');
  document.body.classList.remove('landing-active');
}

if (landingPage) {
  const startButtons = landingPage.querySelectorAll('.start-logo');

  startButtons.forEach((button) => {
    button.addEventListener('click', startApp);
  });

  landingPage.addEventListener('keydown', (event) => {
    const isActivationKey = event.key === 'Enter' || event.key === ' ';
    const isStartTarget = event.target instanceof Element && event.target.closest('.start-logo');
    if (isActivationKey && isStartTarget) {
      event.preventDefault();
      startApp();
    }
  });
}
