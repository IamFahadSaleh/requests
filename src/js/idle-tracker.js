window.setupIdleTimer = function (timeoutMinutes = 15) {
  const timeoutDuration = timeoutMinutes * 60 * 1000;
  let idleTimer;

  const logoutUser = () => {
    if (window.fbAuth) {
      window.fbAuth.signOut().finally(() => {
        window.location.href = "./index.html";
      });
    } else {
      window.location.href = "./index.html";
    }
  };

  const resetTimer = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(logoutUser, timeoutDuration);
  };

  const activityEvents = [
    "mousemove",
    "keydown",
    "scroll",
    "click",
    "touchstart",
  ];
  activityEvents.forEach((event) => window.addEventListener(event, resetTimer));

  resetTimer(); // تشغيل العداد لأول مرة
};
