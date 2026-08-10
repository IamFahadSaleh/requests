document.addEventListener("alpine:init", () => {
  Alpine.data("ceoComponent", () => ({
    googleScriptUrl:
      "https://script.google.com/macros/s/AKfycbwY3GJ-LfT0JCzlIssYarY5CYz8VHl0DPugBu_qwThInphJ2t7dlVjMY_Rosxac6ALB/exec",
    emailUrl:
      "https://script.google.com/macros/s/AKfycbxtIwOfNQw8B0Tk-jBqpo8ipd7bcxGJQzMTBkvmVXekNhTpEMaUOEVS26TMPcNSaPKQMg/exec",

    currentView: "table",
    selectedrequest: null,
    isSubmitting: false,
    isApproveSubmitting: false,
    isReturnSubmitting: false,
    isRejectSubmitting: false,
    isCheckingAuth: true,
    ceoName: "",
    ceoDept: "",
    ceoPosition: "",
    note: "",
    userRoles: [],
    auditorEmails: [],
    chairmanEmails: [],
    requests: [],

    departments: [
      "الإدارة التنفيذية",
      "إدارة الدعم المؤسسي",
      "إدارة التوعية والبرامج الصحية",
      "إدارة الاستدامة المالية",
      "إدارة الاستراتيجية وتطوير الأعمال",
      "إدارة الفروع",
      "إدارة الاتصال المؤسسي",
    ],

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
            const userData = userDoc.data();
            const roles = userData.roles || [];
            this.userRoles = roles;

            const chairmanSnapshot = await window.fbDatabase
              .collection("users")
              .where("roles", "array-contains", "chairman")
              .where("isActive", "==", true)
              .get();

            this.chairmanEmails = [];
            chairmanSnapshot.forEach((doc) => {
              const userData = doc.data();
              if (userData.email) {
                this.chairmanEmails.push(userData.email);
              }
            });

            const auditorsSnapshot = await window.fbDatabase
              .collection("users")
              .where("roles", "array-contains", "auditor")
              .where("isActive", "==", true)
              .get();

            this.auditorEmails = [];
            auditorsSnapshot.forEach((doc) => {
              const userData = doc.data();
              if (userData.email) {
                this.auditorEmails.push(userData.email);
              }
            });

            if (roles.includes("ceo")) {
              this.ceoName = userData.name;
              this.ceoDept = userData.department;
              this.ceoPosition = userData.position;
            } else {
              window.location.href = "./index.html";
            }

            this.fetchPendingCeoRequests();
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

    fetchPendingCeoRequests() {
      window.fbDatabase
        .collection("requests")
        .where("currentStage", "==", "ceo")
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
          stage: "الرئيس التنفيذي",
          action: "موافقة",
          userEmail: currentUser.email,
          userName: this.ceoName,
          timestamp: new Date(),
          note: this.note.trim(),
        },
      ];

      try {
        await window.fbDatabase.collection("requests").doc(request.id).update({
          currentStage: "chairman",
          status: "pending",
          "approval.ceo": true,
          timeline: updatedTimeline,
        });

        const chairmanEmailBody = `
        <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-w: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <div style="background-color: #2563eb; padding: 24px; text-align: center; color: white;">
                <h2 style="margin: 0; font-size: 22px; font-weight: 600;">طلب سلفة بانتظار تعميد رئيس مجلس الإدارة </h2>
            </div>
            <div style="padding: 24px; background-color: #ffffff; color: #1f2937; line-height: 1.6;">
                <p style="font-size: 16px; margin-bottom: 16px;">عزيزي رئيس مجلس الإدارة،،</p>
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

        const chairmanFetchPromises = this.chairmanEmails.map((email) =>
          fetch(this.emailUrl, {
            method: "POST",
            mode: "no-cors",
            cache: "no-cache",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to_email: email,
              subject: `طلب تعميد سلفة من الموظف: ${request.applicantName}`,
              body: chairmanEmailBody,
            }),
          }),
        );

        await Promise.all(chairmanFetchPromises);

        alert("تمت الموافقة على الطلب وتحويله إلى رئيس مجلس الإدارة");
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
          stage: "الرئيس التنفيذي",
          action: "ارجاع",
          userEmail: currentUser.email,
          userName: this.ceoName,
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

        alert("تم ارجاع الطلب وتحويله إلى المدقق");
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
          stage: "الرئيس التنفيذي",
          action: "رفض",
          userEmail: currentUser.email,
          userName: this.ceoName,
          timestamp: new Date(),
          note: this.note.trim(),
        },
      ];

      const timelineRows = updatedTimeline
        .map((note, index) => {
          const dateOnly = note.timestamp
            ? (note.timestamp.toDate
                ? note.timestamp.toDate()
                : new Date(note.timestamp)
              )
                .toISOString()
                .split("T")[0]
            : "";

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

    formatTimestamp(ts) {
      if (!ts) return "الآن";
      const date = ts.toDate ? ts.toDate() : new Date(ts);
      return date.toLocaleString("ar-SA", { hour12: true });
    },

    async handleLogout() {
      await window.fbAuth.signOut();
      window.location.href = "./index.html";
    },
  }));
});
