document.addEventListener("alpine:init", () => {
  Alpine.data("auditorComponent", () => ({
    googleScriptUrl: "https://script.google.com/macros/s/AKfycbwY3GJ-LfT0JCzlIssYarY5CYz8VHl0DPugBu_qwThInphJ2t7dlVjMY_Rosxac6ALB/exec",
    emailUrl: "https://script.google.com/macros/s/AKfycbxtIwOfNQw8B0Tk-jBqpo8ipd7bcxGJQzMTBkvmVXekNhTpEMaUOEVS26TMPcNSaPKQMg/exec",

    googleFolderId: "1SfKMeC3leNd098HkjRY9sMU_RpBXsNOz",

    currentView: "table",
    selectedrequest: null,
    isSubmitting: false,
    isApproveSubmitting: false,
    isRejectSubmitting: false,
    isReceiptUploading: false,
    isCheckingAuth: true,
    auditorName: "",
    auditorDept: "",
    auditorPosition: "",
    note: "",
    accountantsEmails: [],
    userRoles: [],
    requests: [],
    receiptRequests: [],

    departments: ["الإدارة التنفيذية", "إدارة الدعم المؤسسي", "إدارة التوعية والبرامج الصحية", "إدارة الاستدامة المالية", "إدارة الاستراتيجية وتطوير الأعمال", "إدارة الفروع", "إدارة الاتصال المؤسسي"],

    // uploading receipt
    selectedReceiptFile: null,
    receiptUrl: "",

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

            const accountantsSnapshot = await window.fbDatabase.collection("users").where("roles", "array-contains", "accountant").where("isActive", "==", true).get();

            this.accountantsEmails = [];
            accountantsSnapshot.forEach((doc) => {
              const userData = doc.data();
              if (userData.email) {
                this.accountantsEmails.push(userData.email);
              }
            });

            if (roles.includes("auditor")) {
              this.auditorName = userData.name;
              this.auditorDept = userData.department;
              this.auditorPosition = userData.position;

              // جلب الطلبات فور التحقق من صلاحيات المستخدم
              this.fetchPendingAuditorRequests();
              this.fetchReceiptAuditorRequests();
            } else {
              window.location.href = "./index.html";
            }
          } else {
            window.location.href = "./index.html";
          }
        } catch (error) {
          console.error("Auth error:", error);
          window.location.href = "./index.html";
        }
      });

      window.setupIdleTimer(15);
    },

    fetchPendingAuditorRequests() {
      window.fbDatabase
        .collection("requests")
        .where("currentStage", "==", "auditor")
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

    fetchReceiptAuditorRequests() {
      window.fbDatabase
        .collection("requests")
        .where("currentStage", "==", "auditor")
        .where("status", "==", "receipt")
        .orderBy("createdAt", "desc")
        .onSnapshot(
          (snapshot) => {
            this.receiptRequests = snapshot.docs.map((doc) => ({
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

    handlePreview(request) {
      this.selectedrequest = request;
      this.receiptUrl = request.receipt || "";
      this.selectedReceiptFile = null;

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

    handleChange(request) {
      this.selectedrequest = request;
      if (request.requestType === "loan") {
        this.currentView = "change_loan";
      } else if (request.requestType === "petty") {
        this.currentView = "change_petty";
      } else if (request.requestType === "purchase") {
        this.currentView = "change_purchase";
      } else if (request.requestType === "overtime") {
        this.currentView = "change_overtime";
      } else if (request.requestType === "general") {
        this.currentView = "change_general";
      } else {
        alert("معاينة طلب من نوع: " + request.requestType);
      }
    },

    handlePrint(request) {
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
      }

      this.$nextTick(() => {
        setTimeout(() => {
          window.print();
          this.currentView = "table";
        }, 150);
      });
    },

    async updateLoanRequest() {
      if (
        !this.selectedrequest.justification?.trim() ||
        !this.selectedrequest.selectedDept ||
        this.selectedrequest.amount === undefined ||
        this.selectedrequest.amount === null ||
        this.selectedrequest.amount === "" ||
        this.selectedrequest.hasOutstandingLoans === undefined ||
        this.selectedrequest.hasOutstandingLoans === null
      ) {
        alert("خطأ: لا يمكن حفظ حقول فارغة أثناء التعديل");
        return false;
      }

      this.isSubmitting = true;

      try {
        const parsedAmount = parseFloat(this.selectedrequest.amount);
        const finalAmount = isNaN(parsedAmount) ? 0 : parsedAmount;

        await window.fbDatabase.collection("requests").doc(this.selectedrequest.id).update({
          selectedDept: this.selectedrequest.selectedDept,
          justification: this.selectedrequest.justification.trim(),
          amount: finalAmount,
          hasOutstandingLoans: this.selectedrequest.hasOutstandingLoans,
        });

        const employeeEmailBody = `
        <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-w: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <div style="background-color: #f59e0b; padding: 24px; text-align: center; color: white;">
            <h2 style="margin: 0; font-size: 22px; font-weight: 600;">تعديل طلب السلفة </h2>
          </div>
          <div style="padding: 24px; background-color: #ffffff; color: #1f2937; line-height: 1.6;">
            <p style="font-size: 16px; margin-bottom: 16px;">مرحباً <strong>${this.selectedrequest.applicantName}</strong>،</p>
            <p style="font-size: 15px; color: #4b5563;">نفيدكم بانه تم تعديل طلب السلفة الخاص بك تحت رقم <span style="color: #1d4ed8; font-weight: bold;">${this.selectedrequest.requestNumber}</span></p>
              
            <div style="background-color: #f9fafb; border-right: 4px solid #f59e0b; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 4px 0; font-size: 14px;"><strong>نوع الطلب:</strong> طلب سلفة</p>
              <p style="margin: 4px 0; font-size: 14px;"><strong>المبلغ المطلوب:</strong> ${this.selectedrequest.amount} ريال</p>
              <p style="margin: 4px 0; font-size: 14px;"><strong>مبررات الطلب:</strong> ${this.selectedrequest.justification}</p>
              <p style="margin: 4px 0; font-size: 14px; color: #d97706;"><strong>تنويه:</strong> وسوف يتم اطلاعكم على الموافقة النهائية على الطلب أو رفضه من خلال البريد الالكتروني</p>
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
              to_email: this.selectedrequest.applicantEmail,
              subject: `تم تعديل طلب سلفة رقم ${this.selectedrequest.requestNumber}`,
              body: employeeEmailBody,
            }),
          }),
        ]);

        alert("تم تحديث بيانات الطلب بنجاح");
        this.currentView = "table";
        return true;
      } catch (error) {
        console.error("خطأ أثناء تحديث بيانات الطلب:", error);
        alert("فشل حفظ البيانات المحدثة.");
        return false;
      } finally {
        this.isSubmitting = false;
      }
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
          stage: "المدقق",
          action: "موافقة",
          userEmail: currentUser.email,
          userName: this.auditorName,
          timestamp: new Date(),
          note: this.note.trim(),
        },
      ];

      try {
        await window.fbDatabase.collection("requests").doc(request.id).update({
          currentStage: "accountant",
          status: "pending",
          "approval.auditor": true,
          timeline: updatedTimeline,
        });

        const accountantEmailBody = `
         <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-w: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <div style="background-color: #2563eb; padding: 24px; text-align: center; color: white;">
                <h2 style="margin: 0; font-size: 22px; font-weight: 600;">طلب سلفة بانتظار الموافقة </h2>
            </div>
            <div style="padding: 24px; background-color: #ffffff; color: #1f2937; line-height: 1.6;">
                <p style="font-size: 16px; margin-bottom: 16px;">عزيزي المحاسب،،</p>
                <p style="font-size: 15px; color: #4b5563;">نفيدكم بوجود طلب سلفة في النظام يتطلب مراجعتكم وتعميدكم في مسار الاعتمادات للانتقال للمرحلة التالية.</p>
            
                <table style="width: 100%; margin: 20px 0; border-collapse: collapse; font-size: 14px;">
                    <tr style="background-color: #f9fafb;"><td style="padding: 10px; font-weight: bold; width: 35%;">مقدم الطلب:</td><td style="padding: 10px;">${request.applicantName}</td></tr>
                    <tr><td style="padding: 10px; font-weight: bold;">القسم / الوظيفة:</td><td style="padding: 10px;">${request.department} / ${request.position}</td></tr>
                    <tr style="background-color: #f9fafb;"><td style="padding: 10px; font-weight: bold;">المبلغ المطلوب:</td><td style="padding: 10px; font-weight: bold; color: #059669;">${request.amount} ريال</td></tr>
                    <tr style="background-color: #f9fafb;"><td style="padding: 10px; font-weight: bold;">طلب من:</td><td style="padding: 10px; font-weight: bold; color: #059669;">${request.selectedDept}</td></tr>
                    <tr style="background-color: #f9fafb;"><td style="padding: 10px; font-weight: bold;">مبررات الطلب:</td><td style="padding: 10px; font-weight: bold; color: #059669;">${request.justification}</td></tr>
                    <tr><td style="padding: 10px; font-weight: bold;">رقم الطلب:</td><td style="padding: 10px; color: #2563eb; font-weight: bold;">${request.requestNumber}</td></tr>
                </table>
                <p style="font-size: 15px; font-weight: bold; color: #dc2626; text-align: center; margin: 24px 0;">نرجو منكم الدخول على بوابة الطلبات من أجل التعميد والموافقة على الطلب.</p>
            </div>
        </div>
      `;

        const accountantFetchPromises = this.accountantsEmails.map((email) =>
          fetch(this.emailUrl, {
            method: "POST",
            mode: "no-cors",
            cache: "no-cache",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to_email: email,
              subject: `طلب تعميد سلفة من الموظف: ${request.applicantName}`,
              body: accountantEmailBody,
            }),
          }),
        );

        await Promise.all(accountantFetchPromises);

        alert("تمت مراجعة الطلب وتحويله إلى المحاسب");
        this.isApproveSubmitting = false;
        ((this.note = ""), (this.currentView = "table"));
      } catch (error) {
        alert("حدث خطأ أثناء اعتماد طلب السلفة");
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
          stage: "المدقق",
          action: "الرفض",
          userEmail: currentUser.email,
          userName: this.auditorName,
          timestamp: new Date(),
          note: this.note.trim(),
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

      const employeeEmailBody = `
        <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-w: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <!-- الهيدر -->
          <div style="background-color: #dc2626; padding: 24px; text-align: center; color: white;">
            <h2 style="margin: 0; font-size: 22px; font-weight: 600;">رفض طلب السلفة</h2>
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
        this.isRejectSubmitting = true;
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

    //functions for receipt uploading
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
                folderId: this.googleFolderId,
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

    /*
    selectRequest(request) {
      this.selectedrequest = request;
      this.receiptUrl = request.receipt || "";
      this.selectedReceiptFile = null;
      this.currentView = "detail";
    },

    viewRequestDetails(request) {
      // السطر الأصلي الموجود لديك لتحديد الطلب الحالي
      this.selectedrequest = request;

      // 👈 الحل السحري: انسخ هذا السطر وضعه هنا فوراً لملء الرابط من Firebase
      this.receiptUrl = request.receipt || "";

      // تصفير ملف الذاكرة المؤقت لضمان عدم حدوث تضارب بصري
      this.selectedReceiptFile = null;

      // السطر الأصلي لديك للانتقال لصفحة المعاينة
      this.currentView = "detail";
    },
    */

    async updateFileInGoogleDrive(oldFileUrl, newFile) {
      if (newFile instanceof FileList || (newFile && newFile.length !== undefined)) {
        newFile = newFile[0];
      }

      if (!newFile) return oldFileUrl;

      // 1. إذا كان هناك ملف قديم، يحذفه فوراً عبر طلب FormData الآمن والمحدث
      if (oldFileUrl) {
        await this.deleteFileFromGoogleDrive(oldFileUrl);
      }

      // 2. رفع الملف الجديد
      return await this.fileToIdAndUpload(newFile);
    },

    async deleteFileFromGoogleDrive(fileUrl) {
      if (!fileUrl) return;

      try {
        console.log("جاري حذف الملف السحابي الآمن عبر حزمة JSON...");

        var response = await fetch(this.googleScriptUrl, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain", // تفادي فحص الـ Preflight والـ CORS
          },
          body: JSON.stringify({
            action: "delete",
            fileUrl: fileUrl,
          }),
        });

        var resData = await response.json();
        if (resData.status === "success") {
          console.log("تم تدمير وحذف الملف بنجاح كلي من سحابة Google Drive وتوفير المساحة!");
        } else {
          console.error("خطأ داخلي من سيرفر جوجل أثناء الحذف:", resData.error);
        }
      } catch (error) {
        console.error("حدث خطأ شبكي أثناء محاولة حذف الملف السحابي:", error);
      }
    },

    async saveReceiptOnly(request) {
      if (!this.selectedReceiptFile && !this.receiptUrl) {
        alert("اختر سند البنك لحفظه");
        return false;
      }

      const requestTypeTranslations = {
        loan: "سلفة",
        petty: "عهدة",
        purchase: "شراء",
        overtime: "عمل إضافي",
        general: "عام",
      };

      this.isReceiptUploading = true;

      try {
        let finalReceiptUrl = this.receiptUrl;

        if (this.selectedReceiptFile) {
          let fileToUpload = this.selectedReceiptFile[0] || this.selectedReceiptFile;
          const fileExtension = fileToUpload.name.split(".").pop();
          const reqNumber = request.requestNumber || request.id || "unknown";
          const newFileName = `سند_البنك_رقم_${reqNumber}.${fileExtension}`;
          const renamedFile = new File([fileToUpload], newFileName, {
            type: fileToUpload.type,
          });

          finalReceiptUrl = await this.updateFileInGoogleDrive(this.receiptUrl, renamedFile);
          if (!finalReceiptUrl) {
            alert("فشل رفع المرفق إلى جوجل درايف يرجى إعادة المحاولة");
            return false;
          }
          this.receiptUrl = finalReceiptUrl;
        }

        const currentUser = window.fbAuth.currentUser;
        const updatedTimeline = [
          ...request.timeline,
          {
            stage: "المدقق",
            action: "السند",
            userEmail: currentUser.email,
            userName: this.auditorName,
            timestamp: new Date(),
            note: "تم ارفاق سند البنك",
          },
        ];

        await window.fbDatabase.collection("requests").doc(request.id).update({
          currentStage: "accountant",
          status: "posting",
          timeline: updatedTimeline,
          receipt: finalReceiptUrl,
        });

        this.selectedReceiptFile = null;

        const employeeEmailBody = `
        <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-w: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <div style="background-color: #f59e0b; padding: 24px; text-align: center; color: white;">
                <h2 style="margin: 0; font-size: 22px; font-weight: 600;">تأكيد الموافقة على طلب مالي </h2>
            </div>
            <div style="padding: 24px; background-color: #ffffff; color: #1f2937; line-height: 1.6;">
                <p style="font-size: 16px; margin-bottom: 16px;">مرحباً <strong>${request.applicantName}</strong>،</p>
                <p style="font-size: 15px; color: #4b5563;">لقد تمت الموافقة على طلبك رقم <span style="color: #1d4ed8; font-weight: bold;">${request.requestNumber}</span></p>
                
                <div style="background-color: #f9fafb; border-right: 4px solid #f59e0b; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
                    <p style="margin: 4px 0; font-size: 14px;"><strong>نوع الطلب:</strong> طلب <span>${requestTypeTranslations[request.requestType] || request.requestType}</span></p>
                    <p style="margin: 4px 0; font-size: 14px;"><strong>المبلغ المطلوب:</strong> ${request.amount} ريال</p>
                    <p style="margin: 4px 0; font-size: 14px;"><strong>مبررات الطلب:</strong> ${request.justification}</p>
                </div>
                ${
                  finalReceiptUrl
                    ? `
                  <div style="text-align: center; margin: 20px 0;">
                      <a href="${finalReceiptUrl}" target="_blank" style="background-color: #007B9D; color: white; padding: 10px 20px; text-decoration: none; font-size: 14px; font-weight: bold; border-radius: 8px; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                          📂 فتح ومعاينة السند البنكي المرفق
                      </a>
                  </div>
                  `
                    : `
                  <p style="margin: 12px 0; font-size: 14px; color: #ef4444; text-align: center; background-color: #fef2f2; padding: 8px; border-radius: 6px; border: 1px dashed #fca5a5;">
                      ⚠️ تنويه: لم يتم إرفاق أي سند بنكي مع هذا الطلب.
                  </p>
                `
                }
            </div>
        </div>
        `;

        const accountantEmailBody = `
        <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-w: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <div style="background-color: #2563eb; padding: 24px; text-align: center; color: white;">
                <h2 style="margin: 0; font-size: 22px; font-weight: 600;">صورة من سند البنك لطلب <span>${requestTypeTranslations[request.requestType] || request.requestType}</span> </h2>
            </div>
            <div style="padding: 24px; background-color: #ffffff; color: #1f2937; line-height: 1.6;">
                <p style="font-size: 16px; margin-bottom: 16px;">عزيزي المحاسب،،</p>
                <p style="font-size: 15px; color: #4b5563;">لقد تمت الموافقة على طلب <span>${requestTypeTranslations[request.requestType] || request.requestType}</span> مرفق لكم سند البنك</p>
            
                <table style="width: 100%; margin: 20px 0; border-collapse: collapse; font-size: 14px;">
                    <tr style="background-color: #f9fafb;"><td style="padding: 10px; font-weight: bold; width: 35%;">مقدم الطلب:</td><td style="padding: 10px;">${request.applicantName}</td></tr>
                    <tr><td style="padding: 10px; font-weight: bold;">القسم / الوظيفة:</td><td style="padding: 10px;">${request.department} / ${request.position}</td></tr>
                    <tr style="background-color: #f9fafb;"><td style="padding: 10px; font-weight: bold;">مبلغ السلفة:</td><td style="padding: 10px; font-weight: bold; color: #059669;">${request.amount} ريال</td></tr>
                    <tr style="background-color: #f9fafb;"><td style="padding: 10px; font-weight: bold;">طلب من:</td><td style="padding: 10px; font-weight: bold; color: #059669;">${request.selectedDept}</td></tr>
                    <tr style="background-color: #f9fafb;"><td style="padding: 10px; font-weight: bold;">مبررات الطلب:</td><td style="padding: 10px; font-weight: bold; color: #059669;">${request.justification}</td></tr>
                    <tr><td style="padding: 10px; font-weight: bold;">رقم الطلب:</td><td style="padding: 10px; color: #2563eb; font-weight: bold;">${request.requestNumber}</td></tr>
                </table>
                <p style="font-size: 15px; font-weight: bold; color: #dc2626; text-align: center; margin: 24px 0;">نرجو منكم الدخول على بوابة الطلبات من أجل ترصيد الطلب في المالية</p>
            </div>
            ${
              finalReceiptUrl
                ? `
              <div style="text-align: center; margin: 20px 0;">
                  <a href="${finalReceiptUrl}" target="_blank" style="background-color: #007B9D; color: white; padding: 10px 20px; text-decoration: none; font-size: 14px; font-weight: bold; border-radius: 8px; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                      📂 فتح ومعاينة السند البنكي المرفق
                  </a>
              </div>
              `
                : `
              <p style="margin: 12px 0; font-size: 14px; color: #ef4444; text-align: center; background-color: #fef2f2; padding: 8px; border-radius: 6px; border: 1px dashed #fca5a5;">
                  ⚠️ تنويه: لم يتم إرفاق أي سند بنكي مع هذا الطلب.
              </p>
            `
            }
        </div>
        `;

        const accountantFetchPromises = this.accountantsEmails.map((email) =>
          fetch(this.emailUrl, {
            method: "POST",
            mode: "no-cors",
            cache: "no-cache",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to_email: email,
              subject: `مرفق سند البنك للطلب المالي من الموظف: ${request.applicantName}`,
              body: accountantEmailBody,
            }),
          }),
        );

        const employeeFetchPromise = fetch(this.emailUrl, {
          method: "POST",
          mode: "no-cors",
          cache: "no-cache",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to_email: request.applicantEmail,
            subject: `مرفق سند البنك للطلب المالي برقم ${request.requestNumber}`,
            body: employeeEmailBody,
          }),
        });

        await Promise.all([employeeFetchPromise, ...accountantFetchPromises]);

        alert(`تم رفع السند بنجاح برقم الطلب (${request.requestNumber || ""})`);
        this.isReceiptUploading = false;
        this.currentView = "table";
      } catch (error) {
        console.error("خطأ أثناء حفظ المرفق:", error);
        alert("حدث خطأ تقني أثناء محاولة حفظ السند البنكي.");
      }
    },

    async deleteReceiptFully(request) {
      if (!this.receiptUrl) {
        alert("لا يوجد سند متاح لحذفه سحابياً.");
        return;
      }

      if (!confirm("هل أنت متأكد من رغبتك في حذف هذا السند البنكي نهائياً من النظام؟")) {
        return;
      }

      try {
        console.log("بدء تدمير المرفق سحابياً وتصفير السجلات...");
        await this.deleteFileFromGoogleDrive(this.receiptUrl);
        await window.fbDatabase.collection("requests").doc(request.id).update({
          receipt: "",
        });

        this.receiptUrl = "";
        this.selectedReceiptFile = null;

        alert("تم حذف سند الصرف البنكي بنجاح من جوجل درايف وقاعدة البيانات! 🗑️");
      } catch (error) {
        console.error("خطأ أثناء محاولة تدمير السند بالكامل:", error);
        alert("حدث خطأ تقني أثناء محاولة حذف السند، يرجى المحاولة لاحقاً.");
      }
    },
  }));
});
