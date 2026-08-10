document.addEventListener("alpine:init", () => {
  Alpine.data("loginComponent", () => ({
    isLoading: false,
    errorMessage: "",

    init() {
      this.errorMessage = "";
      this.isLoading = false;
    },

    async handleGoogleLogin() {
      this.isLoading = true;
      this.errorMessage = "";

      try {
        await window.fbAuth.signOut();

        // التحقق من أن الحساب صحيح + يتبع نطاق الجمعية
        const result = await window.fbAuth.signInWithPopup(
          window.googleProvider,
        );
        const email = result.user.email;

        if (!email.endsWith("@ibtsm.org.sa")) {
          this.errorMessage =
            "عذراً، يجب استخدام البريد الإلكتروني الرسمي للجمعية فقط (@ibtsm.org.sa).";
          await window.fbAuth.signOut();
          this.isLoading = false;
          return;
        }

        // التحقق من أن صاحب الحساب لنطاق الجمعية مسموح له استخدام البوابة
        const userDoc = await window.fbDatabase
          .collection("users")
          .doc(email)
          .get();
        if (!userDoc.exists) {
          this.errorMessage =
            "هذا الحساب ليس لديه صلاحية استخدام البوابة، يرجى مراجعة الدعم الفني.";
          await window.fbAuth.signOut();
          this.isLoading = false;
          return;
        }

        // التأكد من أن الحسب غير معطل
        const userData = userDoc.data();
        if (userData.isActive === false) {
          this.errorMessage =
            "تم تعطيل صلاحية دخول هذا الحساب مؤقتاً ... يرجى مراجعة الدعم الفني";
          await window.fbAuth.signOut();
          this.isLoading = false;
          return;
        }

        // في حال كان صحاب الحساب أكثر من صلاحية .. تعرض صفحة الداشبورد  ... عدا ذلك تعرض صفحة الطلبات المالية
        const userRoles = userData.roles || [];
        if (userRoles.length > 1) {
          window.location.href = "./dashboard.html";
          return;
        }

        if (userRoles.includes("admin")) {
          window.location.href = "./admin.html";
          return;
        }

        if (userRoles.includes("auditor")) {
          window.location.href = "./auditor.html";
          return;
        }

        if (userRoles.includes("manager")) {
          window.location.href = "./manager.html";
          return;
        }

        if (userRoles.includes("ceo")) {
          window.location.href = "./ceo.html";
          return;
        }

        if (userRoles.includes("chairman")) {
          window.location.href = "./chairman.html";
          return;
        }

        if (userRoles.includes("accountant")) {
          window.location.href = "./accountant.html";
          return;
        }

        if (userRoles.includes("employee")) {
          window.location.href = "./requests.html";
          return;
        }

        localStorage.setItem(
          "login_error_message",
          "لم يتم تحديد صلاحية دخول صالحة لهذا الحساب.",
        );
        await window.fbAuth.signOut();
        window.location.reload();
      } catch (error) {
        console.error("حدث خطأ أثناء تسجيل الدخول:", error);
        if (error.code === "auth/popup-closed-by-user") {
          this.errorMessage = "تم إغلاق نافذة تسجيل الدخول قبل اكتمال العملية.";
        } else if (error.code === "auth/network-request-failed") {
          this.errorMessage = "فشل الاتصال بالشبكة، يرجى التحقق من الإنترنت.";
        } else {
          this.errorMessage = "حدث خطأ غير متوقع أثناء التحقق من الصلاحيات.";
        }
      } finally {
        this.isLoading = false;
      }
    },
  }));
});
