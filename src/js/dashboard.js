document.addEventListener("alpine:init", () => {
  Alpine.data("dashboardComponent", () => ({
    isCheckingAuth: true,
    employeeName: "",
    userRoles: [],

    init() {
      window.fbAuth.onAuthStateChanged(async (user) => {
        if (!user) {
          window.location.href = "./index.html";
          return;
        }

        try {
          const userDoc = await window.fbDatabase
            .collection("users")
            .doc(user.email)
            .get();
          if (userDoc.exists && userDoc.data().isActive) {
            const data = userDoc.data();
            this.employeeName = data.name;
            this.userRoles = data.roles || [];
            this.isCheckingAuth = false;
          } else {
            window.location.href = "./index.html";
          }
        } catch (error) {
          window.location.href = "./index.html";
        }
      });
    },

    async handleLogout() {
      await window.fbAuth.signOut();
      window.location.href = "./index.html";
    },
  }));
});
