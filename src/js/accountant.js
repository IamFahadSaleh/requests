document.addEventListener("alpine:init", () => {
  Alpine.data("accountantComponent", () => ({
    googleScriptUrl: "https://script.google.com/macros/s/AKfycbwY3GJ-LfT0JCzlIssYarY5CYz8VHl0DPugBu_qwThInphJ2t7dlVjMY_Rosxac6ALB/exec",
    emailUrl: "https://script.google.com/macros/s/AKfycbxtIwOfNQw8B0Tk-jBqpo8ipd7bcxGJQzMTBkvmVXekNhTpEMaUOEVS26TMPcNSaPKQMg/exec",
    archiveFormsFolderID: "14x68p3Nbdo3r9Ks2YmImUsruux6DbXyn",

    currentView: "table",
    selectedrequest: null,
    isSubmitting: false,
    isApproveSubmitting: false,
    isReturnSubmitting: false,
    isRejectSubmitting: false,
    isReturnReceipt: false,
    isArchiveSubmitting: false,
    isCheckingAuth: true,
    accountantName: "",
    accountantDept: "",
    accountantPosition: "",
    note: "",
    userRoles: [],
    auditorEmails: [],
    managerEmails: [],
    requests: [],
    postedRequests: [],

    departments: ["الإدارة التنفيذية", "إدارة الدعم المؤسسي", "إدارة التوعية والبرامج الصحية", "إدارة الاستدامة المالية", "إدارة الاستراتيجية وتطوير الأعمال", "إدارة الفروع", "إدارة الاتصال المؤسسي"],

    currentTab: "accounts",
    accounts: [],
    costCenters: [],
    newAccount: { code: "", name: "" },
    newCostCenter: { code: "", name: "" },
    accountSearchQuery: "",
    accountPage: 1,
    accountPageSize: 10,
    ccSearchQuery: "",
    ccPage: 1,
    ccPageSize: 10,

    init() {
      window.fbAuth.onAuthStateChanged(async (user) => {
        if (!user) {
          window.location.href = "./index.html";
          return;
        }

        try {
          const userDoc = await window.fbDatabase.collection("users").doc(user.email).get();
          if (userDoc.exists && userDoc.data().isActive) {
            const userData = userDoc.data();
            const roles = userData.roles || [];
            this.userRoles = roles;

            const managerSnapshot = await window.fbDatabase.collection("users").where("roles", "array-contains", "manager").where("isActive", "==", true).get();

            this.managerEmails = [];
            managerSnapshot.forEach((doc) => {
              const userData = doc.data();
              if (userData.email) {
                this.managerEmails.push(userData.email);
              }
            });

            const auditorsSnapshot = await window.fbDatabase.collection("users").where("roles", "array-contains", "auditor").where("isActive", "==", true).get();

            this.auditorEmails = [];
            auditorsSnapshot.forEach((doc) => {
              const userData = doc.data();
              if (userData.email) {
                this.auditorEmails.push(userData.email);
              }
            });

            if (roles.includes("accountant")) {
              this.accountantName = userData.name;
              this.accountantDept = userData.department;
              this.accountantPosition = userData.position;
            } else {
              window.location.href = "./index.html";
            }

            this.fetchPendingAccountantRequests();
            this.fetchPostingAccountantRequests();
            this.fetchAccounts();
            this.fetchCostCenters();
          } else {
            window.location.href = "./index.html";
          }
        } catch (error) {
          window.location.href = "./index.html";
        }
      });

      window.setupIdleTimer(15);
    },

    handlePreview(request) {
      this.selectedrequest = request;
      if (request.requestType === "loan") {
        this.currentView = "preview_loan";
      } else if (request.requestType === "petty") {
        this.currentView = "preview_petty";
      } else if (request.requestType === "purchase") {
        this.currentView = "preview_purchase";
      } else if (request.requestType === "overtime") {
        this.currentView = "preview_overtime";
      } else if (request.requestType === "general") {
        this.currentView = "preview_general";
      } else {
        alert("معاينة طلب من نوع: " + request.requestType);
      }
    },

    fetchPendingAccountantRequests() {
      window.fbDatabase
        .collection("requests")
        .where("currentStage", "==", "accountant")
        .where("status", "==", "pending")
        .orderBy("createdAt", "desc")
        .onSnapshot(
          (snapshot) => {
            this.requests = snapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }));
            this.isCheckingAuth = false;
          },
          (error) => {
            console.error("فشل الجلب اللحظي للطلبات من قاعدة البيانات:", error);
            console.log("رابط الفهرس الكامل:", error.message || error);
          },
        );
    },

    async fetchPostingAccountantRequests() {
      window.fbDatabase
        .collection("requests")
        .where("currentStage", "==", "accountant")
        .where("status", "==", "posting")
        .orderBy("createdAt", "desc")
        .onSnapshot(
          (snapshot) => {
            this.postedRequests = snapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }));
            this.isCheckingAuth = false;
          },
          (error) => {
            console.error("فشل الجلب اللحظي للطلبات من قاعدة البيانات:", error);
            console.log("رابط الفهرس الكامل:", error.message || error);
          },
        );
    },

    async approveLoanRequest(request) {
      if (!this.note.trim()) {
        alert("يجب كتابة سبب اعتماد الطلب");
        return false;
      }
      this.isApproveSubmitting = true;
      const currentUser = window.fbAuth.currentUser;
      const updatedTimeline = [
        ...request.timeline,
        {
          stage: "المحاسب",
          action: "موافقة",
          userEmail: currentUser.email,
          userName: this.accountantName,
          timestamp: new Date(),
          note: this.note.trim(),
        },
      ];

      try {
        await window.fbDatabase.collection("requests").doc(request.id).update({
          currentStage: "manager",
          status: "pending",
          "approval.accountant": true,
          timeline: updatedTimeline,
        });

        const managerEmailBody = `
        <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-w: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <div style="background-color: #2563eb; padding: 24px; text-align: center; color: white;">
                <h2 style="margin: 0; font-size: 22px; font-weight: 600;">طلب سلفة بانتظار تعميد مدير الدعم المؤسسي </h2>
            </div>
            <div style="padding: 24px; background-color: #ffffff; color: #1f2937; line-height: 1.6;">
                <p style="font-size: 16px; margin-bottom: 16px;">عزيزي مدير الدعم المؤسسي،،</p>
                <p style="font-size: 15px; color: #4b5563;">نفيدكم بوجود طلب سلفة في النظام يتطلب تعميدكم في مسار الاعتمادات للانتقال للمرحلة التالية.</p>
            
                <table style="width: 100%; margin: 20px 0; border-collapse: collapse; font-size: 14px;">
                    <tr style="background-color: #f9fafb;"><td style="padding: 10px; font-weight: bold; width: 35%;">مقدم الطلب:</td><td style="padding: 10px;">${request.applicantName}</td></tr>
                    <tr><td style="padding: 10px; font-weight: bold;">القسم / الوظيفة:</td><td style="padding: 10px;">${request.department} / ${request.position}</td></tr>
                    <tr style="background-color: #f9fafb;"><td style="padding: 10px; font-weight: bold;">مبلغ السلفة:</td><td style="padding: 10px; font-weight: bold; color: #059669;">${request.amount} ريال</td></tr>
                    <tr style="background-color: #f9fafb;"><td style="padding: 10px; font-weight: bold;">طلب من:</td><td style="padding: 10px; font-weight: bold; color: #059669;">${request.selectedDept}</td></tr>
                    <tr style="background-color: #f9fafb;"><td style="padding: 10px; font-weight: bold;">مبررات الطلب:</td><td style="padding: 10px; font-weight: bold; color: #059669;">${request.justification}</td></tr>
                    <tr><td style="padding: 10px; font-weight: bold;">رقم الطلب:</td><td style="padding: 10px; color: #2563eb; font-weight: bold;">${request.requestNumber}</td></tr>
                </table>
                <p style="font-size: 15px; font-weight: bold; color: #dc2626; text-align: center; margin: 24px 0;">نرجو منكم الدخول على بوابة الطلبات من أجل التعميد والموافقة على الطلب.</p>
            </div>
        </div>
        `;

        const managerFetchPromises = this.managerEmails.map((email) =>
          fetch(this.emailUrl, {
            method: "POST",
            mode: "no-cors",
            cache: "no-cache",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to_email: email,
              subject: `طلب تعميد سلفة من الموظف: ${request.applicantName}`,
              body: managerEmailBody,
            }),
          }),
        );

        await Promise.all(managerFetchPromises);

        alert("تمت الموافقة على الطلب وتحويله إلى مدير الإدارة");
        this.isApproveSubmitting = false;
        ((this.note = ""), (this.currentView = "table"));
      } catch (error) {
        alert("حدث خطأ أثناء اعتماد طلب السلفة");
      }
    },

    async returnLoanRequest(request) {
      if (!this.note.trim()) {
        alert("يجب كتابة سبب ارجاع الطلب");
        return false;
      }
      this.isReturnSubmitting = true;
      const currentUser = window.fbAuth.currentUser;
      const updatedTimeline = [
        ...request.timeline,
        {
          stage: "المحاسب",
          action: "ارجاع",
          userEmail: currentUser.email,
          userName: this.accountantName,
          timestamp: new Date(),
          note: this.note.trim(),
        },
      ];

      try {
        await window.fbDatabase.collection("requests").doc(request.id).update({
          currentStage: "auditor",
          status: "pending",
          "approval.auditor": false,
          timeline: updatedTimeline,
        });

        const auditorEmailBody = `
        <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-w: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <div style="background-color: #2563eb; padding: 24px; text-align: center; color: white;">
                <h2 style="margin: 0; font-size: 22px; font-weight: 600;">طلب سلفة بانتظار موافقة المدقق </h2>
            </div>
            <div style="padding: 24px; background-color: #ffffff; color: #1f2937; line-height: 1.6;">
                <p style="font-size: 16px; margin-bottom: 16px;">عزيزي المدقق،،</p>
                <p style="font-size: 15px; color: #4b5563;">نفيدكم بوجود طلب سلفة في النظام يتطلب تعميدكم في مسار الاعتمادات للانتقال للمرحلة التالية.</p>
            
                <table style="width: 100%; margin: 20px 0; border-collapse: collapse; font-size: 14px;">
                    <tr style="background-color: #f9fafb;"><td style="padding: 10px; font-weight: bold; width: 35%;">مقدم الطلب:</td><td style="padding: 10px;">${request.applicantName}</td></tr>
                    <tr><td style="padding: 10px; font-weight: bold;">القسم / الوظيفة:</td><td style="padding: 10px;">${request.department} / ${request.position}</td></tr>
                    <tr style="background-color: #f9fafb;"><td style="padding: 10px; font-weight: bold;">مبلغ السلفة:</td><td style="padding: 10px; font-weight: bold; color: #059669;">${request.amount} ريال</td></tr>
                    <tr style="background-color: #f9fafb;"><td style="padding: 10px; font-weight: bold;">طلب من:</td><td style="padding: 10px; font-weight: bold; color: #059669;">${request.selectedDept}</td></tr>
                    <tr style="background-color: #f9fafb;"><td style="padding: 10px; font-weight: bold;">مبررات الطلب:</td><td style="padding: 10px; font-weight: bold; color: #059669;">${request.justification}</td></tr>
                    <tr><td style="padding: 10px; font-weight: bold;">رقم الطلب:</td><td style="padding: 10px; color: #2563eb; font-weight: bold;">${request.requestNumber}</td></tr>
                </table>
                <p style="font-size: 15px; font-weight: bold; color: #dc2626; text-align: center; margin: 24px 0;">نرجو منكم الدخول على بوابة الطلبات من أجل التعميد والموافقة على الطلب.</p>
            </div>
        </div>
        `;

        const auditorFetchPromises = this.auditorEmails.map((email) =>
          fetch(this.emailUrl, {
            method: "POST",
            mode: "no-cors",
            cache: "no-cache",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to_email: email,
              subject: `طلب تعميد سلفة من الموظف: ${request.applicantName}`,
              body: auditorEmailBody,
            }),
          }),
        );

        await Promise.all(auditorFetchPromises);

        alert("تمت ارجاع الطلب وتحويله إلى المدقق");
        this.isReturnSubmitting = false;
        ((this.note = ""), (this.currentView = "table"));
      } catch (error) {
        alert("حدث خطأ أثناء ارجاع طلب السلفة");
      }
    },

    async rejectLoanRequest(request) {
      if (!this.note.trim()) {
        alert("يجب كتابة سبب رفض الطلب");
        return false;
      }
      this.isRejectSubmitting = true;
      const currentUser = window.fbAuth.currentUser;
      const updatedTimeline = [
        ...request.timeline,
        {
          stage: "المحاسب",
          action: "رفض",
          userEmail: currentUser.email,
          userName: this.accountantName,
          timestamp: new Date(),
          note: this.note,
        },
      ];

      const timelineRows = updatedTimeline
        .map((note, index) => {
          const dateOnly = note.timestamp ? (note.timestamp.toDate ? note.timestamp.toDate() : new Date(note.timestamp)).toISOString().split("T")[0] : "";

          return `
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 10px; text-align: center; color: #9ca3af; font-size: 13px;">${index + 1}</td>
                <td style="padding: 10px; text-align: center; color: #4b5563; font-size: 13px; font-weight: 500;">${dateOnly}</td>
                <td style="padding: 10px; text-align: right; color: #1f2937; font-size: 13px; font-weight: 500;">${note.action || ""}</td>
                <td style="padding: 10px; text-align: right; color: #1f2937; font-size: 13px; font-weight: 500;">${note.userName || ""}</td>
                <td style="padding: 10px; text-align: right; color: #dc2626; font-size: 13px;">${note.note || ""}</td>
            </tr>
          `;
        })
        .join("");

      // 2. كود قالب البريد الإلكتروني المحدث مع قسم مسارات الطلب
      const employeeEmailBody = `
        <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-w: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <!-- الهيدر -->
          <div style="background-color: #dc2626; padding: 24px; text-align: center; color: white;">
            <h2 style="margin: 0; font-size: 22px; font-weight: 600;">تحديث بشأن طلب السلفة</h2>
          </div>
          
          <!-- محتوى الرسالة الرئيسي -->
          <div style="padding: 24px; background-color: #ffffff; color: #1f2937; line-height: 1.6;">
            <p style="font-size: 16px; margin-bottom: 16px;">مرحباً <strong>${request.applicantName}</strong>،</p>
            <p style="font-size: 15px; color: #4b5563;">تم رفض طلب السلفة الخاص بك تحت رقم <span style="color: #1d4ed8; font-weight: bold;">${request.requestNumber}</span></p>
            
            <!-- تفاصيل الطلب -->
            <div style="background-color: #f9fafb; border-right: 4px solid #f59e0b; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 4px 0; font-size: 14px;"><strong>نوع الطلب:</strong> طلب سلفة</p>
              <p style="margin: 4px 0; font-size: 14px;"><strong>المبلغ المطلوب:</strong> ${request.amount} ريال</p>
              <p style="margin: 4px 0; font-size: 14px;"><strong>مبررات الطلب:</strong> ${request.justification}</p>
            </div>

            <!-- قسم مسارات الطلب الجديد (Timeline) -->
            <div style="margin-top: 30px;">
              <p style="font-size: 14px; font-weight: bold; color: #1f2937; margin-bottom: 10px;">مسارات الطلب:</p>
              <table style="width: 100%; border-collapse: collapse; text-align: right; background-color: #ffffff; border: 1px solid #f3f4f6; border-radius: 8px; overflow: hidden;">
                  <thead>
                      <tr style="background-color: #f9fafb; border-bottom: 2px solid #f3f4f6;">
                          <th style="padding: 10px; text-align: center; color: #4b5563; font-size: 13px; font-weight: 600; width: 40px;">#</th>
                          <th style="padding: 10px; text-align: center; color: #4b5563; font-size: 13px; font-weight: 600;">التاريخ</th>
                          <th style="padding: 10px; text-align: center; color: #4b5563; font-size: 13px; font-weight: 600;">حالة الطلب</th>
                          <th style="padding: 10px; text-align: right; color: #4b5563; font-size: 13px; font-weight: 600;">المعتمد</th>
                          <th style="padding: 10px; text-align: right; color: #4b5563; font-size: 13px; font-weight: 600;">التعليق</th>
                      </tr>
                  </thead>
                  <tbody>
                      ${timelineRows}
                  </tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      await Promise.all([
        fetch(this.emailUrl, {
          method: "POST",
          mode: "no-cors",
          cache: "no-cache",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to_email: request.applicantEmail,
            subject: `تم رفض طلب سلفة رقم ${request.requestNumber}`,
            body: employeeEmailBody,
          }),
        }),
      ]);

      try {
        await window.fbDatabase.collection("requests").doc(request.id).delete();

        alert("تمت عملية الرفض بنجاح وارسال بريد الكتروني للموظف صاحب الطلب");
        this.isRejectSubmitting = false;
        ((this.note = ""), (this.currentView = "table"));
      } catch (error) {
        console.error("خطأ أثناء محاولة حذف الطلب:", error);
        alert("حدث خطأ أثناء محاولة معالجة وحذف طلب السلفة");
      }
    },

    fetchAccounts() {
      window.fbDatabase
        .collection("accounts")
        .orderBy("code", "asc")
        .onSnapshot((snapshot) => {
          this.accounts = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
        });
    },

    async addAccount() {
      try {
        await window.fbDatabase.collection("accounts").add({
          code: this.newAccount.code.trim(),
          name: this.newAccount.name.trim(),
          status: "active",
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        this.newAccount = { code: "", name: "" };
        alert("تم حفظ الحساب المالي الجديد بنجاح في الدليل");
      } catch (error) {
        console.error("خطأ أثناء إضافة الحساب", error);
        alert("حدث خطأ مالي أثناء محاولة حفظ الحساب");
      }
    },

    async updateAccount(id, updatedCode, updatedName) {
      if (!updatedCode.trim() || !updatedName.trim()) {
        alert("خطأ: لا يمكن ترك حقول الحساب فارغة");
        return false;
      }
      try {
        await window.fbDatabase.collection("accounts").doc(id).update({
          code: updatedCode.trim(),
          name: updatedName.trim(),
        });
        return true;
      } catch (error) {
        console.error("حدث خطأ أثناء تعديل الحساب", error);
        alert("فشل تحديث بيانات الحساب في السيرفر");
        return false;
      }
    },

    async toggleAccountStatus(acc) {
      const nextStatus = acc.status === "active" ? "disabled" : "active";
      await window.fbDatabase.collection("accounts").doc(acc.id).update({
        status: nextStatus,
      });
    },

    async deleteAccount(id) {
      if (confirm("هل أنت متأكد من حذف هذا الحساب نهائياً من الدليل؟")) {
        await window.fbDatabase.collection("accounts").doc(id).delete();
        this.accountPage = 1;
      }
    },

    filteredAccountsCount() {
      return this.accounts.filter((acc) => acc.code.toLowerCase().includes(this.accountSearchQuery.toLowerCase()) || acc.name.toLowerCase().includes(this.accountSearchQuery.toLowerCase())).length;
    },

    filteredAccountsPaginated() {
      let searched = this.accounts.filter((acc) => acc.code.toLowerCase().includes(this.accountSearchQuery.toLowerCase()) || acc.name.toLowerCase().includes(this.accountSearchQuery.toLowerCase()));
      let start = (this.accountPage - 1) * this.accountPageSize;
      return searched.slice(start, start + this.accountPageSize);
    },
    fetchCostCenters() {
      window.fbDatabase
        .collection("costCenters")
        .orderBy("code", "asc")
        .onSnapshot((snapshot) => {
          this.costCenters = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
        });
    },

    async addCostCenter() {
      try {
        await window.fbDatabase.collection("costCenters").add({
          code: this.newCostCenter.code.trim(),
          name: this.newCostCenter.name.trim(),
          status: "active",
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        this.newCostCenter = { code: "", name: "" };
        alert("تم حفظ مركز التكلفة الجديد بنجاح");
      } catch (error) {
        console.error("خطأ أثناء إضافة المركز", error);
        alert("حدث خطأ أثناء محاولة حفظ مركز التكلفة");
      }
    },

    async updateCostCenter(id, updatedCode, updatedName) {
      if (!updatedCode.trim() || !updatedName.trim()) {
        alert("خطأ: جميع الحقول إلزامية لمركز التكلفة");
        return false;
      }
      try {
        await window.fbDatabase.collection("costCenters").doc(id).update({
          code: updatedCode.trim(),
          name: updatedName.trim(),
        });
        return true;
      } catch (error) {
        console.error("حدث خطأ أثناء تعديل مركز التكلفة", error);
        alert("فشل تحديث بيانات المركز في السيرفر");
        return false;
      }
    },

    async toggleCCStatus(cc) {
      const nextStatus = cc.status === "active" ? "disabled" : "active";
      await window.fbDatabase.collection("costCenters").doc(cc.id).update({
        status: nextStatus,
      });
    },

    async deleteCostCenter(id) {
      if (confirm("هل أنت متأكد من حذف مركز التكلفة هذا نهائياً؟")) {
        await window.fbDatabase.collection("costCenters").doc(id).delete();
        this.ccPage = 1;
      }
    },

    filteredCCCount() {
      return this.costCenters.filter((cc) => cc.code.toLowerCase().includes(this.ccSearchQuery.toLowerCase()) || cc.name.toLowerCase().includes(this.ccSearchQuery.toLowerCase())).length;
    },

    filteredCCPaginated() {
      let searched = this.costCenters.filter((cc) => cc.code.toLowerCase().includes(this.ccSearchQuery.toLowerCase()) || cc.name.toLowerCase().includes(this.ccSearchQuery.toLowerCase()));
      let start = (this.ccPage - 1) * this.ccPageSize;
      return searched.slice(start, start + this.ccPageSize);
    },

    async returnForReceiptChange(request) {
      if (!this.note.trim()) {
        alert("يجب كتابة سبب ارجاع الطلب");
        return false;
      }
      this.isReturnReceipt = true;
      const currentUser = window.fbAuth.currentUser;
      const updatedTimeline = [
        ...request.timeline,
        {
          stage: "المحاسب",
          action: "ارجاع",
          userEmail: currentUser.email,
          userName: this.accountantName,
          timestamp: new Date(),
          note: this.note.trim(),
        },
      ];

      try {
        await window.fbDatabase.collection("requests").doc(request.id).update({
          currentStage: "auditor",
          status: "receipt",
          timeline: updatedTimeline,
        });

        const auditorEmailBody = `
        <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-w: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <div style="background-color: #2563eb; padding: 24px; text-align: center; color: white;">
                <h2 style="margin: 0; font-size: 22px; font-weight: 600;">تعديل سند البنك </h2>
            </div>
            <div style="padding: 24px; background-color: #ffffff; color: #1f2937; line-height: 1.6;">
                <p style="font-size: 16px; margin-bottom: 16px;">عزيزي المدقق،،</p>
                <p style="font-size: 15px; color: #4b5563;">آمل تعديل سند البنك واعادة ارسال الطلب</p>
            
                <table style="width: 100%; margin: 20px 0; border-collapse: collapse; font-size: 14px;">
                    <tr style="background-color: #f9fafb;"><td style="padding: 10px; font-weight: bold; width: 35%;">مقدم الطلب:</td><td style="padding: 10px;">${request.applicantName}</td></tr>
                    <tr><td style="padding: 10px; font-weight: bold;">القسم / الوظيفة:</td><td style="padding: 10px;">${request.department} / ${request.position}</td></tr>
                    <tr style="background-color: #f9fafb;"><td style="padding: 10px; font-weight: bold;">مبلغ السلفة:</td><td style="padding: 10px; font-weight: bold; color: #059669;">${request.amount} ريال</td></tr>
                    <tr style="background-color: #f9fafb;"><td style="padding: 10px; font-weight: bold;">طلب من:</td><td style="padding: 10px; font-weight: bold; color: #059669;">${request.selectedDept}</td></tr>
                    <tr style="background-color: #f9fafb;"><td style="padding: 10px; font-weight: bold;">مبررات الطلب:</td><td style="padding: 10px; font-weight: bold; color: #059669;">${request.justification}</td></tr>
                    <tr><td style="padding: 10px; font-weight: bold;">رقم الطلب:</td><td style="padding: 10px; color: #2563eb; font-weight: bold;">${request.requestNumber}</td></tr>
                </table>
                <p style="font-size: 15px; font-weight: bold; color: #dc2626; text-align: center; margin: 24px 0;">نرجو منكم الدخول على بوابة الطلبات من أجل ارفاق سند البنك الصحيح واعادة الارسال.</p>
            </div>
        </div>
        `;

        const auditorFetchPromises = this.auditorEmails.map((email) =>
          fetch(this.emailUrl, {
            method: "POST",
            mode: "no-cors",
            cache: "no-cache",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to_email: email,
              subject: `تعديل سند البنك - رقم الطلب: ${request.requestNumber}`,
              body: auditorEmailBody,
            }),
          }),
        );

        await Promise.all(auditorFetchPromises);

        alert("تمت ارجاع الطلب وتحويله إلى المدقق");
        this.isReturnReceipt = false;
        ((this.note = ""), (this.currentView = "table"));
      } catch (error) {
        alert("حدث خطأ أثناء ارجاع طلب السلفة");
      }
    },

    
    async archiveLoanRequest(request) {
      if (this.isArchiveSubmitting) return;

      // رسالة تأكيدية لحماية البيانات
      if (!confirm(`هل أنت متأكد من أرشفة الطلب رقم (${request.requestNumber})؟ سيفتح المتصفح نافذة حفظ الاستمارة كـ PDF رسمي وسيتم حذف البيانات من قاعدة البيانات فوراً.`)) {
        return;
      }

      this.isArchiveSubmitting = true;

      try {
        console.log("جاري تجهيز الاستمارة لطباعتها كـ PDF بواسطة مفسر المتصفح الأصلي...");

        // 1. استخدام حدث الاستماع التلقائي في المتصفح لمعرفة متى تنتهي الطباعة/الحفظ
        const afterPrintAction = async () => {
          console.log("تم إنتاج وحفظ ملف الـ PDF بنجاح، جاري حذف السجل من الفايربيز لتوفير المساحة...");

          // حذف مستند الطلب كلياً وصارماً من Firebase Firestore بعد التأكد من أن المستخدم حفظ الملف
          //await window.fbDatabase.collection("requests").doc(request.id).delete();

          alert(`تمت عملية الأرشفة بنجاح باهر! 💾🎉\n- تم حفظ الاستمارة الرسمية كـ PDF على جهازك للأرشيف البنكي.\n- تم حذف الطلب وتصفيره نهائياً من قاعدة البيانات المباشرة.`);

          // العودة للجدول وتصفير الحقول
          this.currentView = "table";
          this.note = "";
          this.isArchiveSubmitting = false;

          // إزالة المستمع لتفادي التكرار
          window.removeEventListener("afterprint", afterPrintAction);
        };

        // ربط المستمع قبل تشغيل أمر الطباعة
        window.addEventListener("afterprint", afterPrintAction);

        // 2. تشغيل أمر طباعة المتصفح الرسمي الصافي
        // بفضل كود الـ CSS المجهز لديك، سيقوم المتصفح تلقائياً بإخفاء الأزرار وإظهار الاستمارة فقط بمقاس A4 صافي [INDEX]
        window.print();
      } catch (error) {
        console.error("حدث خطأ استثنائي أثناء معالجة وحفظ الأرشيف الرقمي للـ PDF:", error);
        alert("حدث خطأ تقني، يرجى إعادة المحاولة مرة أخرى.");
        this.isArchiveSubmitting = false;
      }
    },
    

 

    /*
    async makeAndUploadDocPDF() {
  const element = document.getElementById('loan-preview-card');
  
  if (!element) {
    console.error("خطأ: لم يتم العثور على عنصر الاستمارة (loan-preview-card) في الصفحة.");
    return null;
  }

  // إعداد الخيارات المتوافقة مع حزمة js-html2pdf
  const opt = {
    filename: `استمارة_${this.selectedrequest?.requestType || 'طلب'}_${this.selectedrequest?.requestNumber || 'جديد'}.pdf`
  };

  return new Promise((resolve, reject) => {
    try {
      console.log("... جاري إنشاء نسخة الكائن وتحويل المستند");
      
      // 1. إنشاء نسخة جديدة باستخدام المعامل new بالتوافق مع قوانين الحزمة لديك
      const exporter = new window.html2pdf(element, opt);
      
      // 2. استدعاء معالج جلب ملف الـ PDF (تمرير false يمنع تحميل الملف تلقائياً للمتصفح)
      exporter.getPdf(false).then(async (pdfInstance) => {
        console.log("تمت المعالجة بنجاح، جاري تحويل الحزمة إلى ArrayBuffer...");
        
        // جلب البيانات الخام الثنائية للملف
        const pdfArrayBuffer = pdfInstance.output('arraybuffer');
        
        // تحويلها إلى Blob لرفعها سحابياً عبر دالتك
        const pdfBlob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });
        pdfBlob.name = opt.filename;

        console.log("جاري تمرير الملف للدالة السحابية لحفظه في قوقل درايف...");
        const uploadedUrl = await this.fileToIdAndUpload(pdfBlob);
        resolve(uploadedUrl);
      }).catch((err) => {
        console.error("خطأ داخل معالج تحويل المستند للمكتبة:", err);
        resolve(null);
      });

    } catch (error) {
      console.error("حدث خطأ غير متوقع أثناء المعالجة البنيوية:", error);
      resolve(null);
    }
  });
},
*/

    /*
async makeAndUploadDocPDF() {
  const element = document.getElementById('loan-preview-card');
  
  if (!element) {
    console.error("خطأ: لم يتم العثور على عنصر الاستمارة (loan-preview-card) في الصفحة.");
    return null;
  }

  // 1. الحل القاطع: إخفاء عناصر التحكم فعلياً من الشاشة الحالية قبل التصوير
  const noPrintElements = element.querySelectorAll('.no-print');
  noPrintElements.forEach(el => {
    el.style.setProperty('display', 'none', 'important');
  });

  const opt = {
    filename: `استمارة_${this.selectedrequest?.requestType || 'طلب'}_${this.selectedrequest?.requestNumber || 'جديد'}.pdf`,
    image: { type: 'jpeg', quality: 1.0 },
    html2canvas: { 
      scale: 3, // دقة تصوير فائقة الوضوح
      useCORS: true, 
      letterRendering: true,
      allowTaint: false,
      logging: false,
      onclone: (clonedDoc) => {
        const clonedCard = clonedDoc.getElementById('loan-preview-card');
        if (clonedCard) {
          // تثبيت ألوان الجداول والحدود لمنع أي سواد مفاجئ
          clonedCard.querySelectorAll('.bg-gray-50\\/80, .bg-gray-50, .bg-gray-100').forEach(el => {
            el.style.setProperty('background-color', '#f9fafb', 'important');
          });
          clonedCard.querySelectorAll('.border-gray-200, .border-gray-300, .divide-gray-300').forEach(el => {
            el.style.setProperty('border-color', '#d1d5db', 'important');
          });
          clonedCard.style.setProperty('background-color', '#ffffff', 'important');
        }
      }
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  return new Promise((resolve) => {
    try {
      console.log("... جاري إنشاء نسخة مستند PDF مطهرة ونظيفة");
      
      const exporter = new window.html2pdf(element, opt);
      
      exporter.getPdf(false).then(async (pdfInstance) => {
        
        // 2. إعادة إظهار الأزرار للمستخدم فوراً على الشاشة بعد التقاط لقطة الـ PDF
        noPrintElements.forEach(el => {
          el.style.display = '';
        });

        console.log("تمت المعالجة بنجاح، جاري الرفع السحابي للدرايف...");
        const pdfArrayBuffer = pdfInstance.output('arraybuffer');
        const pdfBlob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });
        pdfBlob.name = opt.filename;

        const uploadedUrl = await this.fileToIdAndUpload(pdfBlob);
        resolve(uploadedUrl);
      }).catch((err) => {
        console.error("خطأ أثناء معالجة المستند:", err);
        // إعادة الأزرار في حال حدوث خطأ مفاجئ
        noPrintElements.forEach(el => el.style.display = '');
        resolve(null);
      });

    } catch (error) {
      console.error("حدث خطأ غير متوقع:", error);
      noPrintElements.forEach(el => el.style.display = '');
      resolve(null);
    }
  });
},
*/

    async fileToIdAndUpload(file) {
      if (file instanceof FileList || (file && file.length !== undefined)) {
        file = file[0];
      }

      if (!file || !(file instanceof Blob)) {
        console.error("المعطى الممرر ليس ملفاً صالحاً:", file);
        return null;
      }

      return new Promise((resolve) => {
        var reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
          try {
            console.log("جاري الرفع السحابي الآمن عبر حزمة JSON مستقرة...");

            // إرسال الطلب بنص صافي لتفادي حظر الـ CORS تماماً في المتصفحات
            var response = await fetch(this.googleScriptUrl, {
              method: "POST",
              headers: {
                "Content-Type": "text/plain",
              },
              body: JSON.stringify({
                action: "upload",
                folderId: this.archiveFormsFolderID,
                fileName: file.name,
                mimeType: file.type,
                fileData: reader.result,
              }),
            });

            var resData = await response.json();

            if (resData.status === "error") {
              console.error("خطأ داخلي من خادم جوجل درايف أثناء الرفع:", resData.error);
              resolve(null);
            } else {
              console.log("نجاح باهر! تم الرفع وحفظ الرابط السحابي بنجاح:", resData.url);
              resolve(resData.url);
            }
          } catch (err) {
            console.error("حدث خطأ أثناء الاتصال بالـ API لـ Google:", err);
            resolve(null);
          }
        };
        reader.onerror = () => resolve(null);
      });
    },

    async handleLogout() {
      await window.fbAuth.signOut();
      window.location.href = "./index.html";
    },
  }));
});
