document.addEventListener('alpine:init', () => {
    
    Alpine.data('requestsComponent', () => ({
        isCheckingAuth: true,
        isSubmitting: false,
        activeRequestType: 'petty', // الافتراضي عهدة (petty)
        employeeName: '',
        employeeDept: '',
        userRoles: [],
        
        allInitiatives: [],
        filteredInitiatives: [],
        activeInitiativeDesc: '',


        // أضف هذين السطرين الجديدين هنا:
        returnedRequests: [], 
        editingRequestId: null, 

        departments: [
            "الإدارة التنفيذية",
            "إدارة الدعم المؤسسي",
            "إدارة التوعية والبرامج الصحية",
            "إدارة الاستدامة المالية",
            "إدارة الاستراتيجية وتطوير الأعمال",
            "إدارة الفروع",
            "إدارة الاتصال المؤسسي"
        ],

        // هيكل بيانات استمارة العهدة (petty) الافتراضي
        pettyForm: {
            requestDate: '',
            title: '',
            selectedDept: '',
            justification: '',
            amount: '',
            hasPrevious: false,
            isLinked: false,
            initiativeId: '',
            unlinkedReason: ''
        },





        // هيكل بيانات استمارة طلب الشراء (purchase) الافتراضي المكتمل
        purchaseForm: {
            requestDate: '',
            title: '',
            selectedDept: '',
            justification: '',
            isLinked: false,
            unlinkedReason: '',
            vendorName: '',
            accountName: '',
            iban: '',
            bankName: 'في انتظار كتابة رقم الحساب...',
            items: [],
             initiativeId: ''
        },
        // كائن تخزين ملفات طلب الشراء المرفوعة حياً
        purchaseFiles: { quotes: null, registry: null, ibanImg: null },
        purchaseInitiativeDesc: '', 






        /*
        init() {
            // التحقق الفوري والمشدد من حالة الجلسة
            window.fbAuth.onAuthStateChanged(async (user) => {
                if (!user) {
                    window.location.href = './index.html';
                } else {
                    try {
                        const userDoc = await window.fbDatabase.collection('users').doc(user.email).get();
                        if (userDoc.exists && userDoc.data().isActive) {
                            const data = userDoc.data();
                            this.employeeName = data.name;
                            this.employeeDept = data.department;
                            this.userRoles = data.roles || [];
                            
                            // جلب المبادرات بالكامل لفلترتها لاحقاً
                            await this.fetchAllInitiatives();
                            this.isCheckingAuth = false;
                        } else {
                            window.location.href = './index.html';
                        }
                    } catch (error) {
                        window.location.href = './index.html';
                    }
                }
            });
        },
        */

        init() {
            window.fbAuth.onAuthStateChanged(async (user) => {
                if (!user) {
                    window.location.href = './index.html';
                } else {
                    try {
                        const userDoc = await window.fbDatabase.collection('users').doc(user.email).get();
                        if (userDoc.exists && userDoc.data().isActive) {
                            const data = userDoc.data();
                            this.employeeName = data.name;
                            this.employeeDept = data.department;
                            this.userRoles = data.roles || [];
                            
                            await this.fetchAllInitiatives();
                            
                            // أضف دالة الاستماع اللحظي للطلبات المرجعة هنا:
                            this.fetchReturnedRequests(user.email);
                            
                            this.isCheckingAuth = false;
                        } else {
                            window.location.href = './index.html';
                        }
                    } catch (error) {
                        window.location.href = './index.html';
                    }
                }
            });
        },

        


        async fetchAllInitiatives() {
            const snapshot = await window.fbDatabase.collection('initiatives').where('status', '==', 'active').get();
            this.allInitiatives = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        },
        // دالة الفلترة الديناميكية للمبادرات بناءً على اختيار الإدارة
        handleDeptChange() {

            // 1. تحديد الإدارة المستهدفة بناءً على نوع البوابة النشطة حالياً (عهدة أم شراء)
            let selectedDepartment = '';
            
            if (this.activeRequestType === 'petty') {
                selectedDepartment = this.pettyForm.selectedDept;
            } else if (this.activeRequestType === 'purchase') {
                selectedDepartment = this.purchaseForm.selectedDept;
            }

            console.log('جاري تصفية المبادرات النشطة للإدارة المختارة حياً:', selectedDepartment);

            // 2. فلترة حزمة المبادرات الكلية القادمة من Firestore المطابقة تماماً لهذه الإدارة
            this.filteredInitiatives = this.allInitiatives.filter(init => init.department === selectedDepartment);
            
            // 3. تصفير الاختيارات السابقة لمنع أي تداخل لغوي أو مالي في الاستمارات
            this.pettyForm.initiativeId = '';
            this.activeInitiativeDesc = '';
            
            this.purchaseForm.initiativeId = '';
            this.purchaseInitiativeDesc = '';



            /*
            this.filteredInitiatives = this.allInitiatives.filter(init => init.department === this.pettyForm.selectedDept || init.department === this.purchaseForm.selectedDept);
            this.pettyForm.initiativeId = '';
            this.activeInitiativeDesc = '';
            
            // أضف هذين السطرين لتصفير المبادرة المحددة لطلب الشراء عند تغيير الإدارة المعنية:
            this.purchaseForm.initiativeId = '';
            this.purchaseInitiativeDesc = '';
            */


        },

        // تحديث نص علامة الاستفهام التلميحية بناءً على المبادرة المحددة
        updateTooltip() {
            const selected = this.filteredInitiatives.find(init => init.id === this.pettyForm.initiativeId);
            this.activeInitiativeDesc = selected ? selected.description : '';
        },

        updatePurchaseTooltip() {
            const selected = this.filteredInitiatives.find(init => init.id === this.purchaseForm.initiativeId);
            this.purchaseInitiativeDesc = selected ? selected.description : '';
        },






        // دالة جلب الطلبات المرجعة للموظف الحالي حياً
        fetchReturnedRequests(email) {
            window.fbDatabase.collection('requests')
                .where('applicantEmail', '==', email)
                .where('currentStage', '==', 'applicant')
                .where('status', '==', 'returned')
                .onSnapshot((snapshot) => {
                    this.returnedRequests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                });
        },

        // دالة سحب بيانات الطلب المرجع وحقنها في الاستمارة لتعديلها
        /*
        loadReturnedRequestToForm(req) {
            this.activeRequestType = req.requestType;
            this.editingRequestId = req.id; // حفظ المعرف لتعديله بدلاً من إضافة مستند جديد
            
            this.pettyForm = {
                requestDate: req.requestDate,
                title: req.title,
                selectedDept: req.selectedDept,
                justification: req.justification,
                amount: req.amount,
                hasPrevious: req.hasPreviousUnclosedCustody,
                isLinked: req.isLinkedToInitiative,
                initiativeId: req.initiativeId,
                unlinkedReason: req.unlinkedReason || ''
            };
            // تحديث فلاتر المبادرات والتلميحات بناءً على البيانات المحقونة
            this.handleDeptChange();
            this.pettyForm.initiativeId = req.initiativeId;
            this.updateTooltip();
            
            // سحب الشاشة لأعلى الاستمارة ليرى الموظف الحقول
            window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        */

                // [كود مطور وحاسم]: دالة فحص نوع المعاملة المرجعة وحقن بياناتها في الاستمارة الصحيحة حياً
        loadReturnedRequestToForm(req) {
            this.activeRequestType = req.requestType; // تبديل واجهة العرض تلقائياً (petty أو purchase)
            this.editingRequestId = req.id; // حفظ معرف المستند لتحديثه بدلاً من تكراره

            if (req.requestType === 'purchase') {
                // 1. [حالة طلب الشراء]: شحن وحقن البيانات والجدول المصرفي والأصناف لـ purchaseForm
                this.purchaseForm = {
                    requestDate: req.requestDate || '',
                    title: req.title || '',
                    selectedDept: req.selectedDept || '',
                    justification: req.justification || '',
                    isLinked: req.isLinkedToInitiative || false,
                    initiativeId: req.initiativeId || '',
                    unlinkedReason: req.unlinkedReason || '',
                    vendorName: req.vendorName || '',
                    accountName: req.accountName || '',
                    iban: req.ibanNumber ? req.ibanNumber.replace('SA', '') : '', // سحب رمز الثبات للـ Input
                    bankName: req.bankName || 'جاري التحقق من المصرف...',
                    items: req.items ? [...req.items] : [] // نسخ مصفوفة الأصناف المرفوعة بالكامل حياً
                };
                
                // تحديث فلاتر المبادرات التابعة لإدارة الشراء وعلامة المساعدة (؟) حياً
                this.handleDeptChange();
                this.purchaseForm.initiativeId = req.initiativeId || '';
                this.updatePurchaseTooltip();

            } else {
                // 2. [حالة طلب العهدة]: شحن وحقن البيانات لـ pettyForm (الحالي لديك)
                this.pettyForm = {
                    requestDate: req.requestDate || '',
                    title: req.title || '',
                    selectedDept: req.selectedDept || '',
                    justification: req.justification || '',
                    amount: req.amount || '',
                    hasPrevious: req.hasPreviousUnclosedCustody || false,
                    isLinked: req.isLinkedToInitiative || false,
                    initiativeId: req.initiativeId || '',
                    unlinkedReason: req.unlinkedReason || ''
                };
                
                // تحديث فلاتر المبادرات لطلب العهدة
                this.handleDeptChange();
                this.pettyForm.initiativeId = req.initiativeId || '';
                this.updateTooltip();
            }
            
            // سحب الشاشة بنعومة لأعلى النموذج ليتسنى للموظف رؤية الحقول المعدلة فوراً على الجوال
            window.scrollTo({ top: 0, behavior: 'smooth' });
        },













        // إرسال طلب العهدة (petty) إلى Firestore وبدء الـ Workflow للمدقق
        /*
        async submitPettyRequest() {
            this.isSubmitting = true;
            const currentUser = window.fbAuth.currentUser;
            
            // تحديد اسم المبادرة المختار لإدراجه كبيانات نصية مرافقة
            const selectedInit = this.filteredInitiatives.find(init => init.id === this.pettyForm.initiativeId);
            const initName = selectedInit ? selectedInit.name : '';

            try {
                await window.fbDatabase.collection('requests').add({
                    requestType: 'petty',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    applicantEmail: currentUser.email,
                    applicantName: this.employeeName,
                    requestDate: this.pettyForm.requestDate,
                    title: this.pettyForm.title,
                    department: this.employeeDept, // إدارة الموظف الرسمية
                    selectedDept: this.pettyForm.selectedDept, // الإدارة المحددة للطلب
                    justification: this.pettyForm.justification,
                    amount: parseFloat(this.pettyForm.amount),
                    hasPreviousUnclosedCustody: this.pettyForm.hasPrevious,
                    isLinkedToInitiative: this.pettyForm.isLinked,
                    initiativeId: this.pettyForm.initiativeId,
                    initiativeName: initName,
                    unlinkedReason: this.pettyForm.isLinked ? '' : this.pettyForm.unlinkedReason,
                    
                    // بدء رحلة الطلب وتوجيهه فوراً إلى المدقق (auditor)
                    currentStage: 'auditor',
                    status: 'pending',
                    
                    // سجل الحركات التاريخي الشفاف للطلب
                    timeline: [{
                        stage: 'applicant',
                        action: 'created',
                        userEmail: currentUser.email,
                        userName: this.employeeName,
                        timestamp: new Date(),
                        note: 'تم تقديم طلب العهدة بنجاح وبدء رحلة التدقيق والاعتمادات الممالية.'
                    }]
                });

                alert('تم إرسال طلب العهدة بنجاح وهو الآن لدى المدقق المالي للمراجعة.');
                
                // تصفير الاستمارة بعد الإرسال الناجح
                this.pettyForm = { requestDate: '', title: '', selectedDept: '', justification: '', amount: '', hasPrevious: false, isLinked: false, initiativeId: '', unlinkedReason: '' };
                this.filteredInitiatives = [];
                this.activeInitiativeDesc = '';

            } catch (error) {
                console.error('خطأ أثناء إرسال طلب العهدة:', error);
                alert('حدث خطأ أثناء إرسال الطلب للخادم، يرجى المحاولة لاحقاً.');
            } finally {
                this.isSubmitting = false;
            }
        },
        */

        async submitPettyRequest() {
            this.isSubmitting = true;
            const currentUser = window.fbAuth.currentUser;
            
            const selectedInit = this.filteredInitiatives.find(init => init.id === this.pettyForm.initiativeId);
            const initName = selectedInit ? selectedInit.name : '';

            // جهزنا حزمة البيانات المعدلة أو الجديدة
            const requestData = {
                requestType: 'petty',
                requestDate: this.pettyForm.requestDate,
                title: this.pettyForm.title,
                department: this.employeeDept,
                selectedDept: this.pettyForm.selectedDept,
                justification: this.pettyForm.justification,
                //amount: parseFloat(this.pettyForm.amount),
                amount: this.pettyForm.amount ? parseFloat(this.pettyForm.amount) : 0,
                hasPreviousUnclosedCustody: this.pettyForm.hasPrevious,
                isLinkedToInitiative: this.pettyForm.isLinked,
                initiativeId: this.pettyForm.initiativeId,
                initiativeName: initName,
                unlinkedReason: this.pettyForm.isLinked ? '' : this.pettyForm.unlinkedReason,
                
                // إعادة توجيه مسار الحركة للمدقق المالي مجدداً وفك الحظر عنه
                currentStage: 'auditor',
                status: 'pending'
            };

            try {
                if (this.editingRequestId) {
                    // [حالة إعادة الإرسال]: جلب المستند الحالي لإضافة حركة التعديل على المصفوفة التاريخية
                    const reqDoc = await window.fbDatabase.collection('requests').doc(this.editingRequestId).get();
                    const currentTimeline = reqDoc.exists ? (reqDoc.data().timeline || []) : [];
                    
                    requestData.timeline = [...currentTimeline, {
                        stage: 'applicant',
                        action: 'resubmitted_after_modifications',
                        userEmail: currentUser.email,
                        userName: this.employeeName,
                        timestamp: new Date(),
                        note: 'قام الموظف بتعديل البيانات المطلوبة وإعادة إرسال المعاملة الممالية للتدقيق.'
                    }];

                    // تحديث نفس المستند القديم بدون تكرار
                    await window.fbDatabase.collection('requests').doc(this.editingRequestId).update(requestData);
                    alert('تمت إعادة إرسال المعاملة المعدلة بنجاح إلى المدقق المالي.');
                } else {
                    // [حالة طلب جديد لأول مرة]:
                    requestData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                    requestData.applicantEmail = currentUser.email;
                    requestData.applicantName = this.employeeName;
                    requestData.timeline = [{
                        stage: 'applicant',
                        action: 'created',
                        userEmail: currentUser.email,
                        userName: this.employeeName,
                        timestamp: new Date(),
                        note: 'تم تقديم طلب العهدة بنجاح وبدء رحلة التدقيق والاعتمادات الممالية.'
                    }];

                    await window.fbDatabase.collection('requests').add(requestData);

                    // ضعه مباشرة بعد سطر await window.fbDatabase.collection('requests').add(requestData);
                    window.notifyNextManager('auditor', this.employeeName, this.pettyForm.title);


                    alert('تم إرسال طلب العهدة بنجاح وهو الآن لدى المدقق المالي للمراجعة.');
                }

                // تصفير كامل للاستمارة وحالة التعديل بعد النجاح
                this.editingRequestId = null;
                this.pettyForm = { requestDate: '', title: '', selectedDept: '', justification: '', amount: '', hasPrevious: false, isLinked: false, initiativeId: '', unlinkedReason: '' };
                this.filteredInitiatives = [];
                this.activeInitiativeDesc = '';

            } catch (error) {
                console.error('خطأ أثناء معالجة الطلب:', error);
                alert('حدث خطأ أثناء إرسال البيانات.');
            } finally {
                this.isSubmitting = false;
            }
        },













        // دالة التقاط الـ IBAN وتطهيره وتحديث اسم البنك (الكود البرمجي المطور الخاص بك)
        onIbanInput(value) {
            var cleanValue = value.replace(/[^0-9]/g, ''); 
            this.purchaseForm.iban = cleanValue;
            
            if (cleanValue.length === 22) {
                var fullIban = "SA" + cleanValue;
                if (!this.isValidIbanMod97(fullIban)) { 
                    this.purchaseForm.bankName = "⚠️ رقم IBAN غير صحيح رياضياً (فشل فحص MOD 97)"; 
                    return; 
                }
                var bankCode = cleanValue.substring(2, 4);
                var bankMap = { 
                    '10': 'البنك الأهلي السعودي (SNB)', 
                    '15': 'بنك البلاد', '20': 'بنك الرياض',
                    '30': 'البنك العربي الوطني (ANB)', '45': 'البنك السعودي الأول (SAB)',
                    '55': 'البنك السعودي الفرنسي', '80': 'مصرف الراجحي',
                    '05': 'مصرف الإنماء', '60': 'بنك الجزيرة', '76': 'البنك السعودي للاستثمار'
                };
                this.purchaseForm.bankName = bankMap[bankCode] || 'مصرف سعودي محلي الموثق';
            } else { 
                this.purchaseForm.bankName = 'في انتظار اكتمال خانات رقم الحساب (22 رقم)...'; 
            }
        },

        // دالة التحقق الرياضي الدولي الحذرة MOD97 المكملة لكودك لتشغيله بكفاءة
        isValidIbanMod97(iban) {
            var rearranged = iban.substring(4) + iban.substring(0, 4);
            var numeric = rearranged.split('').map(c => isNaN(c) ? (c.charCodeAt(0) - 55).toString() : c).join('');
            var remainder = 0;
            for (var i = 0; i < numeric.length; i++) { remainder = (remainder * 10 + parseInt(numeric[i])) % 97; }
            return remainder === 1;
        },

        // دوال التحكم وإضافة وحذف عناصر جدول الأصناف حياً ومجموعه الكلي تلقائياً
        addPurchaseItem(detail, amount) {
            this.purchaseForm.items.push({ detail: detail, amount: parseFloat(amount) });
        },
        deletePurchaseItem(index) {
            this.purchaseForm.items.splice(index, 1);
        },
        calculatePurchaseTotal() {
            let total = this.purchaseForm.items.reduce((sum, item) => sum + item.amount, 0);
            return total.toFixed(2);
        },

        // دالة معالجة ورفع طلب الشراء المكتمل ومرفقاته بـ Base64 لـ Firestore وبدء الـ Workflow للمدقق
        /*
        async submitPurchaseRequest() {
            this.isSubmitting = true;
            const currentUser = window.fbAuth.currentUser;

            // إجبار قراءة وتحويل ملف عرض الأسعار الإلزامي لـ Base64 قبل الإرسال لتفادي مشاكل الحسابات المدفوعة
            const reader = new FileReader();
            reader.readAsDataURL(this.purchaseFiles.quotes);
            
            reader.onload = async () => {
                const quotesBase64 = reader.result;

                const selectedInit = this.filteredInitiatives.find(init => init.id === this.purchaseForm.initiativeId);
                const initName = selectedInit ? selectedInit.name : '';



                try {
                    await window.fbDatabase.collection('requests').add({
                        requestType: 'purchase',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        applicantEmail: currentUser.email,
                        applicantName: this.employeeName,
                        department: this.employeeDept,
                        
                        requestDate: this.purchaseForm.requestDate,
                        title: this.purchaseForm.title,
                        selectedDept: this.purchaseForm.selectedDept,
                        justification: this.purchaseForm.justification,
                        isLinkedToInitiative: this.purchaseForm.isLinked,
                        unlinkedReason: this.purchaseForm.isLinked ? '' : this.purchaseForm.unlinkedReason,

                        initiativeId: this.purchaseForm.isLinked ? this.purchaseForm.initiativeId : '',
                        initiativeName: this.purchaseForm.isLinked ? initName : '',
                        unlinkedReason: this.purchaseForm.isLinked ? '' : this.purchaseForm.unlinkedReason,

                        
                        vendorName: this.purchaseForm.vendorName,
                        accountName: this.purchaseForm.accountName,
                        ibanNumber: "SA" + this.purchaseForm.iban,
                        bankName: this.purchaseForm.bankName,
                        
                        items: this.purchaseForm.items,
                        totalAmount: parseFloat(this.calculatePurchaseTotal()),
                        
                        // حقن المستند المرفوع مشفراً حياً داخل قاعدة البيانات مجاناً
                        attachedQuotesFile: quotesBase64,
                        
                        currentStage: 'auditor', // توجيهه فوراً للمرحلة الأولى للتدقيق
                        status: 'pending',
                        
                        timeline: [{
                            stage: 'applicant', action: 'created',
                            userEmail: currentUser.email, userName: this.employeeName,
                            timestamp: new Date(), note: 'تم تقديم طلب الشراء وإدراج عروض الأسعار بنجاح وبدء رحلة الموافقات.'
                        }]
                    });

                    // تنبيه وإرسال إيميل للمدقق المالي الموكل بالمرحلة القادمة تلقائياً (محرك الإشعارات ثنائي الاتجاه)
                    if (window.notifyNextManager) { window.notifyNextManager('auditor', this.employeeName, this.purchaseForm.title); }

                    alert('تم إرسال طلب الشراء الإداري بنجاح وهو الآن معروض لدى المدقق المالي للمراجعة.');
                    
                    // تصفير الاستمارة والمرفقات بالكامل بعد النجاح المباشر
                    this.purchaseForm = { requestDate: '', title: '', selectedDept: '', justification: '', isLinked: false, unlinkedReason: '', vendorName: '', accountName: '', iban: '', bankName: 'في انتظار كتابة رقم الحساب...', items: [] };
                    this.purchaseFiles = { quotes: null, registry: null, ibanImg: null };

                } catch (error) {
                    console.error('خطأ أثناء حفظ طلب الشراء:', error);
                    alert('حدث خطأ أثناء معالجة الطلب.');
                } finally {
                    this.isSubmitting = false;
                }
            };
        },
        */

              // [كود مطور وحاسم 100%]: دالة فك تشفير كافة المرفقات بالتتابع وإرسال طلب الشراء المكتمل
        async submitPurchaseRequest() {
            this.isSubmitting = true;
            const currentUser = window.fbAuth.currentUser;

            // دالة داخلية ذكية ومضمونة لتحويل الملفات إلى نصوص Base64
            const getBase64 = (file) => {
                return new Promise((resolve) => {
                    if (!file) { resolve(null); return; }
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => resolve(null);
                });
            };

            try {

                // الكود المطور والنهائي المتناسق مع التعديل الجديد:
                const fileQuotes = this.purchaseFiles.quotes ? this.purchaseFiles.quotes : null;
                const fileRegistry = this.purchaseFiles.registry ? this.purchaseFiles.registry : null;
                const fileIbanImg = this.purchaseFiles.ibanImg ? this.purchaseFiles.ibanImg : null;

                if (!fileQuotes) {
                    alert('تنبيه: يجب إرفاق ملف عروض الأسعار أولاً قبل إرسال طلب الشراء الإداري.');
                    this.isSubmitting = false;
                    return;
                }

                const quotesBase64 = await getBase64(fileQuotes);
                const registryBase64 = await getBase64(fileRegistry);
                const ibanImgBase64 = await getBase64(fileIbanImg);

                console.log('نجاح تشفير وحقن الملفات الثلاثة بالكامل في السيرفر.');


                const selectedInit = this.filteredInitiatives.find(init => init.id === this.purchaseForm.initiativeId);
                const initName = selectedInit ? selectedInit.name : '';

                // 3. رفع وحفظ المستند المالي بالكامل في مجموعات الـ Firestore حياً
                await window.fbDatabase.collection('requests').add({
                    requestType: 'purchase',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    applicantEmail: currentUser.email,
                    applicantName: this.employeeName,
                    department: this.employeeDept,
                    
                    requestDate: this.purchaseForm.requestDate,
                    title: this.purchaseForm.title,
                    selectedDept: this.purchaseForm.selectedDept,
                    justification: this.purchaseForm.justification,
                    isLinkedToInitiative: this.purchaseForm.isLinked,
                    unlinkedReason: this.purchaseForm.isLinked ? '' : this.purchaseForm.unlinkedReason,
                    
                    vendorName: this.purchaseForm.vendorName,
                    accountName: this.purchaseForm.accountName,
                    ibanNumber: "SA" + this.purchaseForm.iban,
                    bankName: this.purchaseForm.bankName,
                    
                    items: this.purchaseForm.items,
                    totalAmount: parseFloat(this.calculatePurchaseTotal()),
                    
                    // حقن وحفظ الملفات الثلاثة بنصوصها الصافية والكاملة داخل قاعدة البيانات مجاناً وبدون مشاكل
                    attachedQuotesFile: quotesBase64,     // (إلزامي)
                    attachedRegistryFile: registryBase64, // (اختياري - سيظهر للمدقق فوراً إذا رفع الموظف ملفاً)
                    attachedIbanFile: ibanImgBase64,       // (اختياري - سيظهر للمدقق فوراً إذا رفع الموظف ملفاً)
                    
                    currentStage: 'auditor',
                    status: 'pending',
                    
                    timeline: [{
                        stage: 'applicant', action: 'created',
                        userEmail: currentUser.email, userName: this.employeeName,
                        timestamp: new Date(), note: 'تم تقديم طلب الشراء وإدراج المرفقات والملفات البنكية بنجاح.'
                    }]
                });

                // إرسال التنبيه البريد الإلكتروني للمدقق المالي للمرحلة التالية
                if (window.notifyNextManager) { window.notifyNextManager('auditor', this.employeeName, this.purchaseForm.title); }

                alert('تم إرسال طلب الشراء وكامل المرفقات بنجاح، وهي الآن معروضة في لوحة المدقق المالي للمراجعة المعمقة.');
                

                this.purchaseForm = { requestDate: '', title: '', selectedDept: '', justification: '', isLinked: false, unlinkedReason: '', vendorName: '', accountName: '', iban: '', bankName: 'في انتظار كتابة رقم الحساب...', items: [] };

                this.purchaseFiles.quotes = null;
                this.purchaseFiles.registry = null;
                this.purchaseFiles.ibanImg = null;
    
                
                // إعادة تصفير مدخلات حقول الرفع في واجهة الـ HTML بصرياً
                document.getElementById('file_quotes').value = '';
                document.getElementById('file_registry').value = '';
                document.getElementById('file_iban').value = '';

            } catch (error) {
                console.error('خطأ حرج أثناء معالجة المرفقات المتعددة وحفظ طلب الشراء:', error);
                alert('حدث خطأ أثناء رفع ومعالجة ملفات الطلب المالية، يرجى إعادة المحاولة.');
            } finally {
                this.isSubmitting = false;
            }
        },















        async handleLogout() {
            await window.fbAuth.signOut();
            window.location.href = './index.html';
        }
    }));
});
