document.addEventListener("alpine:init", () => {
  Alpine.data("adminComponent", () => ({
    isCheckingAuth: true,
    currentTab: "users",
    adminName: "",
    initiatives: [],
    users: [],
    userRoles: [],

    departments: [
      "الإدارة التنفيذية",
      "إدارة الدعم المؤسسي",
      "إدارة التوعية والبرامج الصحية",
      "إدارة الاستدامة المالية",
      "إدارة الاستراتيجية وتطوير الأعمال",
      "إدارة الفروع",
      "إدارة الاتصال المؤسسي",
    ],

    availableRoles: {
      employee: "موظف",
      auditor: "المدقق",
      manager: "مدير الإدارة",
      ceo: "الرئيس التنفيذي",
      chairman: "رئيس مجلس الإدارة",
      accountant: "المحاسب",
      admin: "مسؤول النظام",
    },

    newInitiative: { name: "", department: "", description: "" },
    newUser: { name: "", position: "", email: "", department: "", roles: [] },

    init() {
      window.fbAuth.onAuthStateChanged(async (user) => {
        if (!user) {
          window.location.href = "./index.html";
        } else {
          try {
            const adminDoc = await window.fbDatabase
              .collection("users")
              .doc(user.email)
              .get();
            if (adminDoc.exists) {
              this.adminName = adminDoc.data().name;
    
              const roles = adminDoc.data().roles || [];
              this.userRoles = roles;
              if (!roles.includes("admin")) {
                alert("عذراً، لا تمتلك صلاحيات دخول على صفحة التحكم.");
                await window.fbAuth.signOut();
                window.location.href = "./index.html";
                return;
              }
            } else {
              this.adminName = user.displayName || user.email;
            }
          } catch (error) {
            this.adminName = user.displayName || user.email;
          }

          this.fetchInitiatives();
          this.fetchUsers();

          this.isCheckingAuth = false;
        }
      });
    },

    fetchInitiatives() {
      window.fbDatabase
        .collection("initiatives")
        .orderBy("createdAt", "desc")
        .onSnapshot((snapshot) => {
          this.initiatives = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
        });
    },

    fetchUsers() {
      window.fbDatabase.collection("users").onSnapshot((snapshot) => {
        this.users = snapshot.docs.map((doc) => doc.data());
      });
    },

    async addInitiative() {
      try {
        await window.fbDatabase.collection("initiatives").add({
          name: this.newInitiative.name,
          department: this.newInitiative.department,
          description: this.newInitiative.description,
          status: "active",
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        this.newInitiative = { name: "", department: "", description: "" };
        alert("تم حفظ المبادرة الجديدة بنجاح");
      } catch (error) {
        console.error("خطأ أثناء إضافة المبادرة", error);
        alert("حدث خطأ أثناء حفظ المبادرة");
      }
    },

    async toggleInitiativeStatus(init) {
      const nextStatus = init.status === "active" ? "disabled" : "active";
      await window.fbDatabase.collection("initiatives").doc(init.id).update({
        status: nextStatus,
      });
    },

    async deleteInitiative(id) {
      if (confirm("هل أنت متأكد من حذف هذه المبادرة نهائياً؟")) {
        await window.fbDatabase.collection("initiatives").doc(id).delete();
      }
    },

    async addUser() {
      const emailClean = this.newUser.email.trim().toLowerCase();

      if (!emailClean.endsWith("@ibtsm.org.sa")) {
        alert("خطأ: يجب إدخال بريد إلكتروني ينتمي لنطاق الجمعية المعتمد فقط.");
        return;
      }

      try {
        await window.fbDatabase.collection("users").doc(emailClean).set({
          name: this.newUser.name,
          email: emailClean,
          position: this.newUser.position,
          department: this.newUser.department,
          roles: this.newUser.roles,
          isActive: true,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        this.newUser = { name: "", email: "", position: "", department: "", roles: [] };
        alert("تم إضافة المستخدم وتفعيل صلاحياته بنجاح");
      } catch (error) {
        console.error("خطأ أثناء إضافة المستخدم", error);
        alert("حدث خطأ أثناء حفظ بيانات المستخدم");
      }
    },

    async toggleUserStatus(user) {
      await window.fbDatabase.collection("users").doc(user.email).update({
        isActive: !user.isActive,
      });
    },

    async deleteUser(email) {
      if (
        confirm("هل أنت متأكد من حذف المستخدم وصلاحياته نهائياً؟")
      ) {
        await window.fbDatabase.collection("users").doc(email).delete();
      }
    },

    async updateInitiative(id, updatedName, updatedDept, updatedDesc) {
      if (!updatedName.trim() || !updatedDept.trim()) {
        alert("خطأ: لا يمكن ترك اسم المبادرة أو وصفها أو الإدارة فارغاً");
        return false;
      }
      try {
        await window.fbDatabase.collection("initiatives").doc(id).update({
          name: updatedName,
          department: updatedDept,
          description: updatedDesc,
        });
        return true; // تعود بقيمة true لإغلاق وضع التعديل في الواجهة
      } catch (error) {
        console.error("حدث خطأ أثناء تعديل المبادرة", error);
        alert("فشل تحديث البيانات في السيرفر");
        return false;
      }
    },

    async updateUser(email, updatedName, updatePosition, updatedDept, updatedRoles) {
      if (!updatedName.trim() || !updatedDept.trim()) {
        alert("خطأ: جميع الحقول إلزامية");
        return false;
      }
      if (updatedRoles.length === 0) {
        alert("خطأ: يجب تحديد صلاحية واحدة على الأقل للمستخدم");
        return false;
      }
      try {
        await window.fbDatabase.collection("users").doc(email).update({
          name: updatedName,
          position: updatePosition,
          department: updatedDept,
          roles: updatedRoles,
        });
        return true; // تعود بقيمة true لإغلاق وضع التعديل في جدول الواجهة
      } catch (error) {
        console.error("حدث خطأ أثناء تعديل بيانات المستخدم", error);
        alert("فشل تحديث بيانات المستخدم في السيرفر");
        return false;
      }
    },

    async handleLogout() {
      await window.fbAuth.signOut();
      window.location.href = "./index.html";
    },
  }));
});
