document.addEventListener("alpine:init", () => {
  Alpine.data("requestsComponent", () => ({
    googleScriptUrl:
      "https://script.google.com/macros/s/AKfycbwY3GJ-LfT0JCzlIssYarY5CYz8VHl0DPugBu_qwThInphJ2t7dlVjMY_Rosxac6ALB/exec",
    emailUrl:
      "https://script.google.com/macros/s/AKfycbxtIwOfNQw8B0Tk-jBqpo8ipd7bcxGJQzMTBkvmVXekNhTpEMaUOEVS26TMPcNSaPKQMg/exec",
    googleFolderId: "12p-QnZcUBHojxxZR9l1aNlejFdXClwKm",

    isCheckingAuth: true,
    isSubmitting: false,
    activeRequestType: "loan",
    employeeName: "",
    employeeDept: "",
    employeePosition: "",
    userRoles: [],
    auditorEmails: [],

    allInitiatives: [],
    filteredInitiatives: [],
    activeInitiativeDesc: "",

    returnedRequests: [],
    editingRequestId: null,

    departments: [
      "الإدارة التنفيذية",
      "إدارة الدعم المؤسسي",
      "إدارة التوعية والبرامج الصحية",
      "إدارة الاستدامة المالية",
      "إدارة الاستراتيجية وتطوير الأعمال",
      "إدارة الفروع",
      "إدارة الاتصال المؤسسي",
    ],

    loanForm: {
      requestData: "",
      selectedPosition: "",
      selectedDept: "",
      justification: "",
      amount: "",
      hasOutstandingLoans: false,
    },

    pettyForm: {
      requestDate: "",
      selectedPosition: "",
      selectedDept: "",
      justification: "",
      amount: "",
      hasOutstandingPetties: false,
      isLinkedToInitiative: false,
      initiativeId: "",
      reasonNotLinkedToInitiative: "",
    },

    purchaseForm: {
      requestDate: "",
      selectedPosition: "",
      selectedDept: "",
      justification: "",
      isLinkedToInitiative: false,
      initiativeId: "",
      reasonNotLinkedToInitiative: "",
      vendorName: "",
      officialVendorName: "",
      iban: "",
      bankName: "في انتظار كتابة رقم الحساب...",
      items: [],
    },

    purchaseFiles: { quotes: null, registry: null, ibanImg: null },
    purchaseInitiativeDesc: "",

    overtimeForm: {
      requestDate: "",
      selectedPosition: "",
      selectedDept: "",
      justification: "",
      isLinkedToInitiative: false,
      initiativeId: "",
      reasonNotLinkedToInitiative: "",
      items: [],
    },

    overtimeItemsTemplate: {
      name: "",
      detail: "",
      time: "",
      amount: "",
      file: null,
    },
    overtimeInitiativeDesc: "",
    isUploadingOvertimeFile: false,

    generalForm: {
      requestDate: "",
      selectedPosition: "",
      selectedDept: "",
      justification: "",
      isLinkedToInitiative: false,
      initiativeId: "",
      reasonNotLinkedToInitiative: "",
      items: [],
    },
    generalInitiativeDesc: "",
    generalItemsTemplate: { detail: "", amount: "", file: null },
    isUploadingGeneralFile: false,

    init() {
      window.fbAuth.onAuthStateChanged(async (user) => {
        if (!user) {
          window.location.href = "./index.html";
        } else {
          try {
            const userDoc = await window.fbDatabase.collection("users").doc(user.email).get();
            if (userDoc.exists && userDoc.data().isActive) {
              const data = userDoc.data();
              this.employeeName = data.name;
              ((this.employeePosition = data.position), (this.employeeDept = data.department));
              this.userRoles = data.roles || [];

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

              await this.fetchAllInitiatives();

              this.isCheckingAuth = false;
            } else {
              window.location.href = "./index.html";
            }
          } catch (error) {
            window.location.href = "./index.html";
          }
        }
      });

      window.setupIdleTimer(15);
    },

    async fetchAllInitiatives() {
      const snapshot = await window.fbDatabase.collection("initiatives").where("status", "==", "active").get();
      this.allInitiatives = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    },

    handleDeptChange() {
      let selectedDepartment = "";

      if (this.activeRequestType === "loan") {
        selectedDepartment = this.loanForm.selectedDept;
      } else if (this.activeRequestType === "petty") {
        selectedDepartment = this.pettyForm.selectedDept;
      } else if (this.activeRequestType === "purchase") {
        selectedDepartment = this.purchaseForm.selectedDept;
      } else if (this.activeRequestType === "overtime") {
        selectedDepartment = this.overtimeForm.selectedDept;
      } else if (this.activeRequestType === "general") {
        selectedDepartment = this.generalForm.selectedDept;
      }

      this.filteredInitiatives = this.allInitiatives.filter((init) => init.department === selectedDepartment);

      this.pettyForm.initiativeId = "";
      this.purchaseForm.initiativeId = "";
      this.overtimeForm.initiativeId = "";
      this.generalForm.initiativeId = "";
      this.activeInitiativeDesc = "";
    },

    updatePettyTooltip() {
      const selected = this.filteredInitiatives.find((init) => init.id === this.pettyForm.initiativeId);
      this.activeInitiativeDesc = selected ? selected.description : "";
    },

    updatePurchaseTooltip() {
      const selected = this.filteredInitiatives.find((init) => init.id === this.purchaseForm.initiativeId);
      this.purchaseInitiativeDesc = selected ? selected.description : "";
    },

    updateOvertimeTooltip() {
      const selected = this.filteredInitiatives.find((init) => init.id === this.overtimeForm.initiativeId);
      this.overtimeInitiativeDesc = selected ? selected.description : "";
    },

    updateGeneralTooltip() {
      const selected = this.filteredInitiatives.find((init) => init.id === this.generalForm.initiativeId);
      this.generalInitiativeDesc = selected ? selected.description : "";
    },

    async submitLoanRequest() {
      this.isSubmitting = true;
      const currentUser = window.fbAuth.currentUser;

      const selectedInit = this.filteredInitiatives.find((init) => init.id === this.loanForm.initiativeId);
      const initName = selectedInit ? selectedInit.name : "";

      const requestData = {
        requestType: "loan",
        requestDate: this.loanForm.requestDate,
        position: this.employeePosition,
        department: this.employeeDept,
        selectedDept: this.loanForm.selectedDept,
        justification: this.loanForm.justification,
        amount: this.loanForm.amount ? Math.round(parseFloat(this.loanForm.amount)).toFixed(2) : "0.00",
        hasOutstandingLoans: this.loanForm.hasOutstandingLoans,
        currentStage: "auditor",
        status: "pending",
        approval: {
          auditor: false,
          accountant: false,
          manager: false,
          ceo: false,
          chairman: false,
        },
      };

      try {
        const random4Dig = Math.floor(1000 + Math.random() * 9000);
        const now = new Date();
        const day = String(now.getDate()).padStart(2, "0");
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const year = now.getFullYear();

        requestData.requestNumber = `${year}-${month}-${day}-${random4Dig}`;
        requestData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        requestData.applicantEmail = currentUser.email;
        requestData.applicantName = this.employeeName;
        requestData.timeline = [
          {
            stage: "الموظف",
            action: "جديد",
            userEmail: currentUser.email,
            userName: this.employeeName,
            timestamp: new Date(),
            note: "تم تقديم طلب السلفة بنجاح وبدء رحلة مسار الاعتمادات",
          },
        ];

        await window.fbDatabase.collection("requests").add(requestData);

        const employeeEmailBody = `
        <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-w: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <div style="background-color: #f59e0b; padding: 24px; text-align: center; color: white;">
                <h2 style="margin: 0; font-size: 22px; font-weight: 600;">تأكيد استلام طلب السلفة </h2>
            </div>
            <div style="padding: 24px; background-color: #ffffff; color: #1f2937; line-height: 1.6;">
                <p style="font-size: 16px; margin-bottom: 16px;">مرحباً <strong>${this.employeeName}</strong>،</p>
                <p style="font-size: 15px; color: #4b5563;">تم تسجيل طلب السلفة الخاص بك بنجاح في النظام تحت رقم <span style="color: #1d4ed8; font-weight: bold;">${requestData.requestNumber}</span></p>
                
                <div style="background-color: #f9fafb; border-right: 4px solid #f59e0b; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
                    <p style="margin: 4px 0; font-size: 14px;"><strong>نوع الطلب:</strong> طلب سلفة</p>
                    <p style="margin: 4px 0; font-size: 14px;"><strong>المبلغ المطلوب:</strong> ${requestData.amount} ريال</p>
                    <p style="margin: 4px 0; font-size: 14px;"><strong>مبررات الطلب:</strong> ${requestData.justification}</p>
                    <p style="margin: 4px 0; font-size: 14px; color: #d97706;"><strong>تنويه:</strong> سوف يتم اطلاعكم على الموافقة النهائية على الطلب أو رفضه من خلال البريد الالكتروني</p>
                </div>
            </div>
        </div>
        `;

        const auditorEmailBody = `
        <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-w: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <div style="background-color: #2563eb; padding: 24px; text-align: center; color: white;">
                <h2 style="margin: 0; font-size: 22px; font-weight: 600;">طلب سلفة جديد بانتظار التدقيق </h2>
            </div>
            <div style="padding: 24px; background-color: #ffffff; color: #1f2937; line-height: 1.6;">
                <p style="font-size: 16px; margin-bottom: 16px;">عزيزي مسؤول التدقيق،،</p>
                <p style="font-size: 15px; color: #4b5563;">نفيدكم بوجود طلب سلفة جديد في النظام يتطلب مراجعتكم وتعميدكم الأولي في مسار الاعتمادات للانتقال للمرحلة التالية.</p>
            
                <table style="width: 100%; margin: 20px 0; border-collapse: collapse; font-size: 14px;">
                    <tr style="background-color: #f9fafb;"><td style="padding: 10px; font-weight: bold; width: 35%;">مقدم الطلب:</td><td style="padding: 10px;">${this.employeeName}</td></tr>
                    <tr><td style="padding: 10px; font-weight: bold;">القسم / الوظيفة:</td><td style="padding: 10px;">${this.employeeDept} / ${this.employeePosition}</td></tr>
                    <tr style="background-color: #f9fafb;"><td style="padding: 10px; font-weight: bold;">مبلغ السلفة:</td><td style="padding: 10px; font-weight: bold; color: #059669;">${requestData.amount} ريال</td></tr>
                    <tr style="background-color: #f9fafb;"><td style="padding: 10px; font-weight: bold;">طلب من:</td><td style="padding: 10px; font-weight: bold; color: #059669;">${this.loanForm.selectedDept}</td></tr>
                    <tr style="background-color: #f9fafb;"><td style="padding: 10px; font-weight: bold;">مبررات الطلب:</td><td style="padding: 10px; font-weight: bold; color: #059669;">${requestData.justification}</td></tr>
                    <tr><td style="padding: 10px; font-weight: bold;">رقم الطلب:</td><td style="padding: 10px; color: #2563eb; font-weight: bold;">${requestData.requestNumber}</td></tr>
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
              subject: `طلب تعميد سلفة جديد من الموظف: ${this.employeeName}`,
              body: auditorEmailBody,
            }),
          }),
        );

        const employeeFetchPromise = fetch(this.emailUrl, {
          method: "POST",
          mode: "no-cors",
          cache: "no-cache",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to_email: currentUser.email,
            subject: `تأكيد تسجيل طلب سلفة جديد برقم ${requestData.requestNumber}`,
            body: employeeEmailBody,
          }),
        });

        await Promise.all([employeeFetchPromise, ...auditorFetchPromises]);

        /*
        await Promise.all([
          fetch(scriptUrl, {
            method: "POST",
            mode: "no-cors",
            cache: "no-cache",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to_email: currentUser.email,
              subject: `تأكيد تسجيل طلب سلفة رقم ${requestData.requestNumber}`,
              body: employeeEmailBody,
            }),
          }),
          fetch(scriptUrl, {
            method: "POST",
            mode: "no-cors",
            cache: "no-cache",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to_email: auditorEmail,
              subject: `طلب تعميد سلفة جديد من الموظف: ${this.employeeName}`,
              body: auditorEmailBody,
            }),
          }),
        ]);
        */

        alert("تم إرسال طلب السلفة بنجاح وهو الآن لدى المدقق للمراجعة");

        this.loanForm = {
          requestDate: "",
          selectedPosition: "",
          selectedDept: "",
          justification: "",
          amount: "",
          hasOutstandingLoans: false,
        };
        this.filteredInitiatives = [];
        this.activeInitiativeDesc = "";
        this.loanForm.selectedPosition = this.employeePosition;
      } catch (error) {
        console.error("خطأ أثناء معالجة الطلب", error);
        alert("حدث خطأ أثناء إرسال البيانات");
      } finally {
        this.isSubmitting = false;
      }
    },

    async submitPettyRequest() {
      this.isSubmitting = true;
      const currentUser = window.fbAuth.currentUser;

      const selectedInit = this.filteredInitiatives.find((init) => init.id === this.pettyForm.initiativeId);
      const initName = selectedInit ? selectedInit.name : "";

      const requestData = {
        requestType: "petty",
        requestDate: this.pettyForm.requestDate,
        position: this.employeePosition,
        department: this.employeeDept,
        selectedDept: this.pettyForm.selectedDept,
        justification: this.pettyForm.justification,
        amount: this.pettyForm.amount ? (Math.round(parseFloat(this.pettyForm.amount) * 100) / 100).toFixed(2) : "0.00",
        hasOutstandingPetties: this.pettyForm.hasOutstandingPetties,
        isLinkedToInitiative: this.pettyForm.isLinkedToInitiative,
        initiativeId: this.pettyForm.initiativeId,
        initiativeName: initName,
        reasonNotLinkedToInitiative: this.pettyForm.isLinkedToInitiative
          ? ""
          : this.pettyForm.reasonNotLinkedToInitiative,
        currentStage: "auditor",
        status: "pending",
        approval: {
          auditor: false,
          accountant: false,
          manager: false,
          ceo: false,
          chairman: false,
        },
      };

      try {
        const random4Dig = Math.floor(1000 + Math.random() * 9000);
        const now = new Date();
        const day = String(now.getDate()).padStart(2, "0");
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const year = now.getFullYear();

        requestData.requestNumber = `${year}-${month}-${day}-${random4Dig}`;
        requestData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        requestData.applicantEmail = currentUser.email;
        requestData.applicantName = this.employeeName;
        requestData.timeline = [
          {
            stage: "الموظف",
            action: "جديد",
            userEmail: currentUser.email,
            userName: this.employeeName,
            timestamp: new Date(),
            note: "تم تقديم طلب العهدة بنجاح وبدء رحلة مسار الاعتمادات",
          },
        ];

        await window.fbDatabase.collection("requests").add(requestData);

        const employeeEmailBody = `
        <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-w: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <div style="background-color: #f59e0b; padding: 24px; text-align: center; color: white;">
                <h2 style="margin: 0; font-size: 22px; font-weight: 600;">تأكيد استلام طلب العهدة </h2>
            </div>
            <div style="padding: 24px; background-color: #ffffff; color: #1f2937; line-height: 1.6;">
                <p style="font-size: 16px; margin-bottom: 16px;">مرحباً <strong>${this.employeeName}</strong>،</p>
                <p style="font-size: 15px; color: #4b5563;">تم تسجيل طلب العهدة الخاص بك بنجاح في النظام تحت رقم <span style="color: #1d4ed8; font-weight: bold;">${requestData.requestNumber}</span></p>
                
                <div style="background-color: #f9fafb; border-right: 4px solid #f59e0b; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
                    <p style="margin: 4px 0; font-size: 14px;"><strong>نوع الطلب:</strong> طلب عهدة</p>
                    <p style="margin: 4px 0; font-size: 14px;"><strong>المبلغ المطلوب:</strong> ${requestData.amount} ريال</p>
                    <p style="margin: 4px 0; font-size: 14px;"><strong>مبررات الطلب:</strong> ${requestData.justification}</p>
                    <p style="margin: 4px 0; font-size: 14px; color: #d97706;"><strong>تنويه:</strong> سوف يتم اطلاعكم على الموافقة النهائية على الطلب أو رفضه من خلال البريد الالكتروني</p>
                </div>
            </div>
        </div>
        `;

        const auditorEmailBody = `
        <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-w: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <div style="background-color: #2563eb; padding: 24px; text-align: center; color: white;">
                <h2 style="margin: 0; font-size: 22px; font-weight: 600;">طلب عهدة جديد بانتظار التدقيق </h2>
            </div>
            <div style="padding: 24px; background-color: #ffffff; color: #1f2937; line-height: 1.6;">
                <p style="font-size: 16px; margin-bottom: 16px;">عزيزي مسؤول التدقيق،،</p>
                <p style="font-size: 15px; color: #4b5563;">نفيدكم بوجود طلب عهدة جديد في النظام يتطلب مراجعتكم وتعميدكم الأولي في مسار الاعتمادات للانتقال للمرحلة التالية.</p>
            
                <table style="width: 100%; margin: 20px 0; border-collapse: collapse; font-size: 14px;">
                    <tr style="background-color: #f9fafb;"><td style="padding: 10px; font-weight: bold; width: 35%;">مقدم الطلب:</td><td style="padding: 10px;">${this.employeeName}</td></tr>
                    <tr><td style="padding: 10px; font-weight: bold;">القسم / الوظيفة:</td><td style="padding: 10px;">${this.employeeDept} / ${this.employeePosition}</td></tr>
                    <tr style="background-color: #f9fafb;"><td style="padding: 10px; font-weight: bold;">مبلغ العهدة:</td><td style="padding: 10px; font-weight: bold; color: #059669;">${requestData.amount} ريال</td></tr>
                    <tr style="background-color: #f9fafb;"><td style="padding: 10px; font-weight: bold;">طلب من:</td><td style="padding: 10px; font-weight: bold; color: #059669;">${this.pettyForm.selectedDept}</td></tr>
                    <tr style="background-color: #f9fafb;"><td style="padding: 10px; font-weight: bold;">مبررات الطلب:</td><td style="padding: 10px; font-weight: bold; color: #059669;">${requestData.justification}</td></tr>
                    <tr><td style="padding: 10px; font-weight: bold;">رقم الطلب:</td><td style="padding: 10px; color: #2563eb; font-weight: bold;">${requestData.requestNumber}</td></tr>
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
              subject: `طلب تعميد عهدة جديد من الموظف: ${this.employeeName}`,
              body: auditorEmailBody,
            }),
          }),
        );

        const employeeFetchPromise = fetch(this.emailUrl, {
          method: "POST",
          mode: "no-cors",
          cache: "no-cache",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to_email: currentUser.email,
            subject: `تأكيد تسجيل طلب عهدة جديد برقم ${requestData.requestNumber}`,
            body: employeeEmailBody,
          }),
        });

        await Promise.all([employeeFetchPromise, ...auditorFetchPromises]);

        alert("تم إرسال طلب العهدة بنجاح وهو الآن لدى المدقق للمراجعة");

        this.pettyForm = {
          requestDate: "",
          selectedPosition: "",
          selectedDept: "",
          justification: "",
          amount: "",
          hasOutstandingPetties: false,
          isLinkedToInitiative: false,
          initiativeId: "",
          reasonNotLinkedToInitiative: "",
        };

        this.filteredInitiatives = [];
        this.activeInitiativeDesc = "";
        this.pettyForm.selectedPosition = this.employeePosition;
      } catch (error) {
        console.error("خطأ أثناء معالجة الطلب", error);
        alert("حدث خطأ أثناء إرسال البيانات");
      } finally {
        this.isSubmitting = false;
      }
    },

    onIbanInput(value) {
      var cleanValue = value.replace(/[^0-9]/g, "");
      this.purchaseForm.iban = cleanValue;

      if (cleanValue.length === 22) {
        var fullIban = "SA" + cleanValue;
        if (!this.isValidIbanMod97(fullIban)) {
          this.purchaseForm.bankName = "رقم الآيبان المدخل غير صحيح لأنه لا يتبع ضوابط الآيبان المعتمدة";
          return;
        }
        var bankCode = cleanValue.substring(2, 4);
        var bankMap = {
          10: "البنك الأهلي السعودي (SNB)",
          15: "بنك البلاد",
          20: "بنك الرياض",
          30: "البنك العربي الوطني (ANB)",
          45: "البنك السعودي الأول (SAB)",
          55: "البنك السعودي الفرنسي",
          80: "مصرف الراجحي",
          "05": "مصرف الإنماء",
          60: "بنك الجزيرة",
          76: "البنك السعودي للاستثمار",
        };
        this.purchaseForm.bankName = bankMap[bankCode] || "مصرف سعودي محلي الموثق";
      } else {
        this.purchaseForm.bankName = "في انتظار اكتمال خانات رقم الحساب (22 رقم)...";
      }
    },

    isValidIbanMod97(iban) {
      var rearranged = iban.substring(4) + iban.substring(0, 4);
      var numeric = rearranged
        .split("")
        .map((c) => (isNaN(c) ? (c.charCodeAt(0) - 55).toString() : c))
        .join("");
      var remainder = 0;
      for (var i = 0; i < numeric.length; i++) {
        remainder = (remainder * 10 + parseInt(numeric[i])) % 97;
      }
      return remainder === 1;
    },

    addPurchaseItem(detail, amount) {
      if (!detail || !amount) return;

      this.purchaseForm.items.push({
        detail: detail,
        amount: parseFloat(amount),
      });
    },
    updatePurchaseItem(index) {
      let targetItem = JSON.parse(JSON.stringify(this.purchaseForm.items[index]));
      this.deletePurchaseItem(index);
      return targetItem;
    },
    deletePurchaseItem(index) {
      this.purchaseForm.items.splice(index, 1);
    },
    calculatePurchaseTotal() {
      let total = this.purchaseForm.items.reduce((sum, item) => sum + item.amount, 0);
      return total.toFixed(2);
    },

    async submitPurchaseRequest() {
      this.isSubmitting = true;
      const currentUser = window.fbAuth.currentUser;

      try {
        if (!this.purchaseFiles.quotes) {
          alert("تنبيه: يجب إرفاق ملف عروض الأسعار أولاً قبل إرسال طلب الشراء.");
          this.isSubmitting = false;
          return;
        }

        const quotesDriveUrl = this.purchaseFiles.quotes.url || null;
        const registryDriveUrl =
          this.purchaseFiles.registry && this.purchaseFiles.registry.url ? this.purchaseFiles.registry.url : null;
        const ibanImgDriveUrl =
          this.purchaseFiles.ibanImg && this.purchaseFiles.ibanImg.url ? this.purchaseFiles.ibanImg.url : null;

        const selectedInit = this.filteredInitiatives.find((init) => init.id === this.purchaseForm.initiativeId);
        const initName = selectedInit ? selectedInit.name : "";

        const random4Dig = Math.floor(1000 + Math.random() * 9000);
        const now = new Date();
        const day = String(now.getDate()).padStart(2, "0");
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const year = now.getFullYear();

        requestNumber = `${year}-${month}-${day}-${random4Dig}`;

        await window.fbDatabase.collection("requests").add({
          requestType: "purchase",
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          applicantEmail: currentUser.email,
          applicantName: this.employeeName,
          requestNumber: requestNumber,
          requestDate: this.purchaseForm.requestDate,
          position: this.employeePosition,
          department: this.employeeDept,
          selectedDept: this.purchaseForm.selectedDept,
          justification: this.purchaseForm.justification,
          isLinkedToInitiative: this.purchaseForm.isLinkedToInitiative,
          reasonNotLinkedToInitiative: this.purchaseForm.isLinkedToInitiative
            ? ""
            : this.purchaseForm.reasonNotLinkedToInitiative,
          vendorName: this.purchaseForm.vendorName,
          officialVendorName: this.purchaseForm.officialVendorName,
          iban: "SA" + this.purchaseForm.iban,
          bankName: this.purchaseForm.bankName,
          items: this.purchaseForm.items,
          totalAmount: parseFloat(this.calculatePurchaseTotal()),
          attachedQuotesFile: quotesDriveUrl,
          attachedRegistryFile: registryDriveUrl,
          attachedIbanFile: ibanImgDriveUrl,
          currentStage: "auditor",
          status: "pending",
          approval: {
            auditor: false,
            accountant: false,
            manager: false,
            ceo: false,
            chairman: false,
          },
          timeline: [
            {
              stage: "الموظف",
              action: "جديد",
              userEmail: currentUser.email,
              userName: this.employeeName,
              timestamp: new Date(),
              note: "تم تقديم طلب الشراء وإدراج المرفقات بنجاح",
            },
          ],
        });

        const employeeEmailBody = `
        <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-w: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <div style="background-color: #f59e0b; padding: 24px; text-align: center; color: white;">
                <h2 style="margin: 0; font-size: 22px; font-weight: 600;">تأكيد استلام طلب شراء </h2>
            </div>
            <div style="padding: 24px; background-color: #ffffff; color: #1f2937; line-height: 1.6;">
                <p style="font-size: 16px; margin-bottom: 16px;">مرحباً <strong>${this.employeeName}</strong>،</p>
                <p style="font-size: 15px; color: #4b5563;">تم تسجيل طلب الشراء الخاص بك بنجاح في النظام تحت رقم <span style="color: #1d4ed8; font-weight: bold;">${requestNumber}</span></p>
                
                <div style="background-color: #f9fafb; border-right: 4px solid #f59e0b; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
                    <p style="margin: 4px 0; font-size: 14px;"><strong>نوع الطلب:</strong> طلب شراء</p>
                    <p style="margin: 4px 0; font-size: 14px;"><strong>المبلغ المطلوب:</strong> ${parseFloat(this.calculatePurchaseTotal())} ريال</p>
                    <p style="margin: 4px 0; font-size: 14px;"><strong>مبررات الطلب:</strong> ${this.purchaseForm.justification}</p>
                    <p style="margin: 4px 0; font-size: 14px; color: #d97706;"><strong>تنويه:</strong> سوف يتم اطلاعكم على الموافقة النهائية على الطلب أو رفضه من خلال البريد الالكتروني</p>
                </div>
            </div>
        </div>
        `;

        const auditorEmailBody = `
        <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-w: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <div style="background-color: #2563eb; padding: 24px; text-align: center; color: white;">
                <h2 style="margin: 0; font-size: 22px; font-weight: 600;">طلب شراء جديد بانتظار التدقيق </h2>
            </div>
            <div style="padding: 24px; background-color: #ffffff; color: #1f2937; line-height: 1.6;">
                <p style="font-size: 16px; margin-bottom: 16px;">عزيزي مسؤول التدقيق،،</p>
                <p style="font-size: 15px; color: #4b5563;">نفيدكم بوجود طلب شراء جديد في النظام يتطلب مراجعتكم وتعميدكم الأولي في مسار الاعتمادات للانتقال للمرحلة التالية.</p>
            
                <table style="width: 100%; margin: 20px 0; border-collapse: collapse; font-size: 14px;">
                    <tr style="background-color: #f9fafb;"><td style="padding: 10px; font-weight: bold; width: 35%;">مقدم الطلب:</td><td style="padding: 10px;">${this.employeeName}</td></tr>
                    <tr><td style="padding: 10px; font-weight: bold;">القسم / الوظيفة:</td><td style="padding: 10px;">${this.employeeDept} / ${this.employeePosition}</td></tr>
                    <tr style="background-color: #f9fafb;"><td style="padding: 10px; font-weight: bold;">المبلغ المطلوب:</td><td style="padding: 10px; font-weight: bold; color: #059669;">${parseFloat(this.calculatePurchaseTotal())} ريال</td></tr>
                    <tr style="background-color: #f9fafb;"><td style="padding: 10px; font-weight: bold;">طلب من:</td><td style="padding: 10px; font-weight: bold; color: #059669;">${this.purchaseForm.selectedDept}</td></tr>
                    <tr style="background-color: #f9fafb;"><td style="padding: 10px; font-weight: bold;">مبررات الطلب:</td><td style="padding: 10px; font-weight: bold; color: #059669;">${this.purchaseForm.justification}</td></tr>
                    <tr><td style="padding: 10px; font-weight: bold;">رقم الطلب:</td><td style="padding: 10px; color: #2563eb; font-weight: bold;">${requestNumber}</td></tr>
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
              subject: `طلب تعميد شراء جديد من الموظف: ${this.employeeName}`,
              body: auditorEmailBody,
            }),
          }),
        );

        const employeeFetchPromise = fetch(this.emailUrl, {
          method: "POST",
          mode: "no-cors",
          cache: "no-cache",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to_email: currentUser.email,
            subject: `تأكيد تسجيل طلب شراء جديد برقم ${requestNumber}`,
            body: employeeEmailBody,
          }),
        });

        await Promise.all([employeeFetchPromise, ...auditorFetchPromises]);

        alert("تم إرسال طلب الشراء وكامل المرفقات بنجاح، في انتظار موافقة المدقق");

        this.purchaseForm = {
          requestDate: "",
          selectedPosition: "",
          selectedDept: "",
          justification: "",
          isLinkedToInitiative: false,
          initiativeId: "",
          reasonNotLinkedToInitiative: "",
          vendorName: "",
          officialVendorName: "",
          iban: "",
          bankName: "في انتظار كتابة رقم الحساب...",
          items: [],
        };

        this.filteredInitiatives = [];
        this.activeInitiativeDesc = "";
        this.purchaseForm.selectedPosition = this.employeePosition;

        this.purchaseFiles.quotes = null;
        this.purchaseFiles.registry = null;
        this.purchaseFiles.ibanImg = null;

        // إعادة تصفير مدخلات حقول الرفع في واجهة الـ HTML بصرياً
        document.getElementById("file_quotes").value = "";
        document.getElementById("file_registry").value = "";
        document.getElementById("file_iban").value = "";
      } catch (error) {
        console.error("خطأ حرج أثناء معالجة المرفقات المتعددة وحفظ طلب الشراء:", error);
        alert("حدث خطأ أثناء رفع ومعالجة ملفات الطلب المالية، يرجى إعادة المحاولة.");
      } finally {
        this.isSubmitting = false;
      }
    },

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

    async submitOvertimeRequest() {
      if (this.isUploadingOvertimeFile) {
        alert("يرجى الانتظار حتى ينتهي رفع الملفات ");
        return;
      }
      this.isSubmitting = true;
      const currentUser = window.fbAuth.currentUser;

      try {
        const selectedInit = this.filteredInitiatives.find((init) => init.id === this.overtimeForm.initiativeId);
        const initName = selectedInit ? selectedInit.name : "";

        const random4Dig = Math.floor(1000 + Math.random() * 9000);
        const now = new Date();
        const day = String(now.getDate()).padStart(2, "0");
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const year = now.getFullYear();

        requestNumber = `${year}-${month}-${day}-${random4Dig}`;

        await window.fbDatabase.collection("requests").add({
          requestType: "overtime",
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          applicantEmail: currentUser.email,
          applicantName: this.employeeName,
          requestNumber: requestNumber,
          requestDate: this.overtimeForm.requestDate,
          position: this.employeePosition,
          department: this.employeeDept,
          selectedDept: this.overtimeForm.selectedDept,
          justification: this.overtimeForm.justification,
          isLinkedToInitiative: this.overtimeForm.isLinkedToInitiative,
          reasonNotLinkedToInitiative: this.overtimeForm.isLinkedToInitiative
            ? ""
            : this.overtimeForm.reasonNotLinkedToInitiative,
          items: this.overtimeForm.items,
          totalAmount: parseFloat(this.calculateOvertimeTotal()),
          currentStage: "auditor",
          status: "pending",
          approval: {
            auditor: false,
            accountant: false,
            manager: false,
            ceo: false,
            chairman: false,
          },
          timeline: [
            {
              stage: "الموظف",
              action: "جديد",
              userEmail: currentUser.email,
              userName: this.employeeName,
              timestamp: new Date().toISOString(),
              note: "تم تقديم طلب العمل الاضافي وإدراج المرفقات بنجاح",
            },
          ],
        });

        const employeeEmailBody = `
        <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-w: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <div style="background-color: #f59e0b; padding: 24px; text-align: center; color: white;">
                <h2 style="margin: 0; font-size: 22px; font-weight: 600;">تأكيد استلام طلب العمل الاضافي </h2>
            </div>
            <div style="padding: 24px; background-color: #ffffff; color: #1f2937; line-height: 1.6;">
                <p style="font-size: 16px; margin-bottom: 16px;">مرحباً <strong>${this.employeeName}</strong>،</p>
                <p style="font-size: 15px; color: #4b5563;">تم تسجيل طلب العمل الاضافي الخاص بك بنجاح في النظام تحت رقم <span style="color: #1d4ed8; font-weight: bold;">${requestNumber}</span></p>
                
                <div style="background-color: #f9fafb; border-right: 4px solid #f59e0b; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
                    <p style="margin: 4px 0; font-size: 14px;"><strong>نوع الطلب:</strong> طلب عمل اضافي</p>
                    <p style="margin: 4px 0; font-size: 14px;"><strong>المبلغ المطلوب:</strong> ${parseFloat(this.calculateOvertimeTotal())} ريال</p>
                    <p style="margin: 4px 0; font-size: 14px;"><strong>مبررات الطلب:</strong> ${this.overtimeForm.justification}</p>
                    <p style="margin: 4px 0; font-size: 14px; color: #d97706;"><strong>تنويه:</strong> سوف يتم اطلاعكم على الموافقة النهائية على الطلب أو رفضه من خلال البريد الالكتروني</p>
                </div>
            </div>
        </div>
        `;

        const auditorEmailBody = `
        <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-w: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <div style="background-color: #2563eb; padding: 24px; text-align: center; color: white;">
                <h2 style="margin: 0; font-size: 22px; font-weight: 600;">طلب عمل اضافي جديد بانتظار التدقيق </h2>
            </div>
            <div style="padding: 24px; background-color: #ffffff; color: #1f2937; line-height: 1.6;">
                <p style="font-size: 16px; margin-bottom: 16px;">عزيزي مسؤول التدقيق،،</p>
                <p style="font-size: 15px; color: #4b5563;">نفيدكم بوجود طلب عمل اضافي جديد في النظام يتطلب مراجعتكم وتعميدكم الأولي في مسار الاعتمادات للانتقال للمرحلة التالية.</p>
            
                <table style="width: 100%; margin: 20px 0; border-collapse: collapse; font-size: 14px;">
                    <tr style="background-color: #f9fafb;"><td style="padding: 10px; font-weight: bold; width: 35%;">مقدم الطلب:</td><td style="padding: 10px;">${this.employeeName}</td></tr>
                    <tr><td style="padding: 10px; font-weight: bold;">القسم / الوظيفة:</td><td style="padding: 10px;">${this.employeeDept} / ${this.employeePosition}</td></tr>
                    <tr style="background-color: #f9fafb;"><td style="padding: 10px; font-weight: bold;">المبلغ المطلوب:</td><td style="padding: 10px; font-weight: bold; color: #059669;">${parseFloat(this.calculateOvertimeTotal())} ريال</td></tr>
                    <tr style="background-color: #f9fafb;"><td style="padding: 10px; font-weight: bold;">طلب من:</td><td style="padding: 10px; font-weight: bold; color: #059669;">${this.overtimeForm.selectedDept}</td></tr>
                    <tr style="background-color: #f9fafb;"><td style="padding: 10px; font-weight: bold;">مبررات الطلب:</td><td style="padding: 10px; font-weight: bold; color: #059669;">${this.overtimeForm.justification}</td></tr>
                    <tr><td style="padding: 10px; font-weight: bold;">رقم الطلب:</td><td style="padding: 10px; color: #2563eb; font-weight: bold;">${requestNumber}</td></tr>
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
              subject: `طلب تعميد عمل اضافي جديد من الموظف: ${this.employeeName}`,
              body: auditorEmailBody,
            }),
          }),
        );

        const employeeFetchPromise = fetch(this.emailUrl, {
          method: "POST",
          mode: "no-cors",
          cache: "no-cache",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to_email: currentUser.email,
            subject: `تأكيد تسجيل طلب عمل اضافي جديد برقم ${requestNumber}`,
            body: employeeEmailBody,
          }),
        });

        await Promise.all([employeeFetchPromise, ...auditorFetchPromises]);

        alert("تم إرسال طلب العمل الاضافي وكامل المرفقات بنجاح، في انتظار موافقة المدقق");

        this.overtimeForm = {
          requestDate: "",
          selectedPosition: "",
          selectedDept: "",
          justification: "",
          isLinkedToInitiative: false,
          initiativeId: "",
          reasonNotLinkedToInitiative: "",
          items: [],
        };

        this.filteredInitiatives = [];
        this.activeInitiativeDesc = "";
        this.overtimeForm.selectedPosition = this.employeePosition;
      } catch (error) {
        console.error("خطأ حرج أثناء معالجة المرفقات المتعددة وحفظ طلب العمل الاضافي:", error);
        alert("حدث خطأ أثناء رفع ومعالجة ملفات الطلب العمل الاضافي، يرجى إعادة المحاولة.");
      } finally {
        this.isSubmitting = false;
      }
    },

    addOvertimeItem() {
      if (
        !this.overtimeItemsTemplate.name.trim() ||
        !this.overtimeItemsTemplate.detail ||
        !this.overtimeItemsTemplate.amount
      ) {
        alert("يرجى إدخال اسم الموظف والتفصيل والمبلغ.");
        return;
      }

      if (this.isUploadingOvertimeFile) {
        alert("يرجى الانتظار حتى ينتهي رفع الملف الحالي.");
        return;
      }

      this.overtimeForm.items.push({ ...this.overtimeItemsTemplate });

      this.overtimeItemsTemplate = {
        name: "",
        detail: "",
        time: "",
        amount: "",
        file: null,
      };
      document.querySelector('input[type="file"]').value = "";
    },

    async deleteOvertimeItem(index) {
      let item = this.overtimeForm.items[index];
      if (item && item.file && item.file.url) {
        await this.deleteFileFromGoogleDrive(item.file.url);
      }
      this.overtimeForm.items.splice(index, 1);
    },

    editOvertimeItem(index) {
      this.overtimeItemsTemplate = { ...this.overtimeForm.items[index] };
      this.deleteOvertimeItem(index);
    },
    calculateOvertimeTotal() {
      return this.overtimeForm.items.reduce((sum, item) => sum + parseFloat(item.amount || 0.0), 0);
    },

    async handleOvertimeFiles(e) {
      const file = e.target.files[0];
      if (!file) return;

      this.isUploadingOvertimeFile = true; // تفعيل مؤشر التحميل بصرياً للزر

      // إذا كان هناك ملف مرفوع مسبقاً في النموذج المؤقت نقوم بحذفه أولاً
      if (this.overtimeItemsTemplate.file && this.overtimeItemsTemplate.file.url) {
        await this.deleteFileFromGoogleDrive(this.overtimeItemsTemplate.file.url);
      }

      const uploadedUrl = await this.fileToIdAndUpload(file);
      if (uploadedUrl) {
        this.overtimeItemsTemplate.file = {
          name: file.name,
          url: uploadedUrl,
        };
      } else {
        alert("تعذر رفع الملف، يرجى المحاولة مجدداً.");
        this.overtimeItemsTemplate.file = null;
      }

      this.isUploadingOvertimeFile = false; // إغلاق مؤشر التحميل
    },

    async submitGeneralRequest() {
      if (this.isUploadingGeneralFile) {
        alert("يرجى الانتظار حتى ينتهي رفع الملفات الحالية أولاً.");
        return;
      }
      this.isSubmitting = true;
      const currentUser = window.fbAuth.currentUser;

      try {
        const selectedInit = this.filteredInitiatives.find((init) => init.id === this.generalForm.initiativeId);
        const initName = selectedInit ? selectedInit.name : "";

        const random4Dig = Math.floor(1000 + Math.random() * 9000);
        const now = new Date();
        const day = String(now.getDate()).padStart(2, "0");
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const year = now.getFullYear();

        requestNumber = `${year}-${month}-${day}-${random4Dig}`;

        await window.fbDatabase.collection("requests").add({
          requestType: "general",
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          applicantEmail: currentUser.email,
          applicantName: this.employeeName,
          requestDate: this.generalForm.requestDate,
          position: this.employeePosition,
          department: this.employeeDept,
          selectedDept: this.generalForm.selectedDept,
          justification: this.generalForm.justification,
          isLinkedToInitiative: this.generalForm.isLinkedToInitiative,
          reasonNotLinkedToInitiative: this.generalForm.isLinkedToInitiative
            ? ""
            : this.generalForm.reasonNotLinkedToInitiative,
          items: this.generalForm.items,
          totalAmount: parseFloat(this.calculateGeneralTotal()),
          currentStage: "auditor",
          status: "pending",
          approval: {
            auditor: false,
            accountant: false,
            manager: false,
            ceo: false,
            chairman: false,
          },
          timeline: [
            {
              stage: "الموظف",
              action: "الجديد",
              userEmail: currentUser.email,
              userName: this.employeeName,
              timestamp: new Date().toISOString(),
              note: "تم تقديم الطلب العام وإدراج المرفقات بنجاح",
            },
          ],
        });

        const employeeEmailBody = `
        <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-w: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <div style="background-color: #f59e0b; padding: 24px; text-align: center; color: white;">
                <h2 style="margin: 0; font-size: 22px; font-weight: 600;">تأكيد استلام طلب عام </h2>
            </div>
            <div style="padding: 24px; background-color: #ffffff; color: #1f2937; line-height: 1.6;">
                <p style="font-size: 16px; margin-bottom: 16px;">مرحباً <strong>${this.employeeName}</strong>،</p>
                <p style="font-size: 15px; color: #4b5563;">تم تسجيل طلب عام الخاص بك بنجاح في النظام تحت رقم <span style="color: #1d4ed8; font-weight: bold;">${requestNumber}</span></p>
                
                <div style="background-color: #f9fafb; border-right: 4px solid #f59e0b; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
                    <p style="margin: 4px 0; font-size: 14px;"><strong>نوع الطلب:</strong> طلب عام</p>
                    <p style="margin: 4px 0; font-size: 14px;"><strong>المبلغ المطلوب:</strong> ${parseFloat(this.calculateGeneralTotal())} ريال</p>
                    <p style="margin: 4px 0; font-size: 14px;"><strong>مبررات الطلب:</strong> ${this.generalForm.justification}</p>
                    <p style="margin: 4px 0; font-size: 14px; color: #d97706;"><strong>تنويه:</strong> سوف يتم اطلاعكم على الموافقة النهائية على الطلب أو رفضه من خلال البريد الالكتروني</p>
                </div>
            </div>
        </div>
        `;

        const auditorEmailBody = `
        <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-w: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <div style="background-color: #2563eb; padding: 24px; text-align: center; color: white;">
                <h2 style="margin: 0; font-size: 22px; font-weight: 600;">طلب عام جديد بانتظار التدقيق </h2>
            </div>
            <div style="padding: 24px; background-color: #ffffff; color: #1f2937; line-height: 1.6;">
                <p style="font-size: 16px; margin-bottom: 16px;">عزيزي مسؤول التدقيق،،</p>
                <p style="font-size: 15px; color: #4b5563;">نفيدكم بوجود طلب عام جديد في النظام يتطلب مراجعتكم وتعميدكم الأولي في مسار الاعتمادات للانتقال للمرحلة التالية.</p>
            
                <table style="width: 100%; margin: 20px 0; border-collapse: collapse; font-size: 14px;">
                    <tr style="background-color: #f9fafb;"><td style="padding: 10px; font-weight: bold; width: 35%;">مقدم الطلب:</td><td style="padding: 10px;">${this.employeeName}</td></tr>
                    <tr><td style="padding: 10px; font-weight: bold;">القسم / الوظيفة:</td><td style="padding: 10px;">${this.employeeDept} / ${this.employeePosition}</td></tr>
                    <tr style="background-color: #f9fafb;"><td style="padding: 10px; font-weight: bold;">المبلغ المطلوب:</td><td style="padding: 10px; font-weight: bold; color: #059669;">${parseFloat(this.calculateGeneralTotal())} ريال</td></tr>
                    <tr style="background-color: #f9fafb;"><td style="padding: 10px; font-weight: bold;">طلب من:</td><td style="padding: 10px; font-weight: bold; color: #059669;">${this.generalForm.selectedDept}</td></tr>
                    <tr style="background-color: #f9fafb;"><td style="padding: 10px; font-weight: bold;">مبررات الطلب:</td><td style="padding: 10px; font-weight: bold; color: #059669;">${this.generalForm.justification}</td></tr>
                    <tr><td style="padding: 10px; font-weight: bold;">رقم الطلب:</td><td style="padding: 10px; color: #2563eb; font-weight: bold;">${requestNumber}</td></tr>
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
              subject: `تعميد طلب عام جديد من الموظف: ${this.employeeName}`,
              body: auditorEmailBody,
            }),
          }),
        );

        const employeeFetchPromise = fetch(this.emailUrl, {
          method: "POST",
          mode: "no-cors",
          cache: "no-cache",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to_email: currentUser.email,
            subject: `تأكيد تسجيل طلب عام جديد برقم ${requestNumber}`,
            body: employeeEmailBody,
          }),
        });

        await Promise.all([employeeFetchPromise, ...auditorFetchPromises]);

        alert("تم إرسال الطلب العام وكامل المرفقات بنجاح، في انتظار موافقة المدقق");

        this.generalForm = {
          requestDate: "",
          selectedPosition: "",
          selectedDept: "",
          justification: "",
          isLinkedToInitiative: false,
          initiativeId: "",
          reasonNotLinkedToInitiative: "",
          items: [],
        };
        this.filteredInitiatives = [];
        this.activeInitiativeDesc = "";
        this.generalForm.selectedPosition = this.employeePosition;
      } catch (error) {
        console.error("خطأ حرج أثناء معالجة المرفقات المتعددة وحفظ الطلب العام", error);
        alert("حدث خطأ أثناء رفع ومعالجة ملفات الطلب العام، يرجى إعادة المحاولة");
      } finally {
        this.isSubmitting = false;
      }
    },

    addGeneralItem() {
      if (!this.generalItemsTemplate.detail || !this.generalItemsTemplate.amount) {
        alert("يرجى إدخال التفصيل والمبلغ.");
        return;
      }

      if (this.isUploadingGeneralFile) {
        alert("يرجى الانتظار حتى ينتهي رفع الملف الحالي.");
        return;
      }

      this.generalForm.items.push({ ...this.generalItemsTemplate });

      this.generalItemsTemplate = { detail: "", amount: "", file: null };

      let fileInput = document.getElementById("general_file_input");
      if (fileInput) fileInput.value = "";
    },

    async deleteGeneralItem(index) {
      let item = this.generalForm.items[index];
      // تدمير وحذف الملف السحابي من جوجل درايف عند حذف الموظف من الجدول نهائياً
      if (item && item.file && item.file.url) {
        await this.deleteFileFromGoogleDrive(item.file.url);
      }
      this.generalForm.items.splice(index, 1);
    },

    async editGeneralItem(index) {
      // فصل البيانات ونقلها للنموذج العلوي الحركي للتعديل بأمان
      this.generalItemsTemplate = { ...this.generalForm.items[index] };
      this.generalForm.items.splice(index, 1);
    },

    calculateGeneralTotal() {
      return this.generalForm.items.reduce((sum, item) => sum + parseFloat(item.amount || 0.0), 0);
    },

    async handleGeneralFiles(e) {
      const file = e.target.files[0];
      if (!file) return;

      this.isUploadingGeneralFile = true; // تفعيل مؤشر التحميل بصرياً للزر

      // إذا كان هناك ملف مرفوع مسبقاً في النموذج المؤقت نقوم بحذفه أولاً لتوفير المساحة المجانية
      if (this.generalItemsTemplate.file && this.generalItemsTemplate.file.url) {
        await this.deleteFileFromGoogleDrive(this.generalItemsTemplate.file.url);
      }

      const uploadedUrl = await this.fileToIdAndUpload(file);
      if (uploadedUrl) {
        this.generalItemsTemplate.file = {
          name: file.name,
          url: uploadedUrl,
        };
        console.log("تم الحصول على رابط الملف العام بنجاح:", uploadedUrl);
      } else {
        alert("تعذر رفع الملف، يرجى المحاولة مجدداً.");
        this.generalItemsTemplate.file = null;
      }

      this.isUploadingGeneralFile = false; // إغلاق مؤشر التحميل
    },

    async handleLogout() {
      await window.fbAuth.signOut();
      window.location.href = "./index.html";
    },
  }));
});
