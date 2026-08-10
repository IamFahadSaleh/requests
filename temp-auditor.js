document.addEventListener('alpine:init', () => {
    
    Alpine.data('auditorComponent', () => ({
        isCheckingAuth: true,
        auditorName: '',
        requests: [],

        // أضف هذا المتغير الجديد هنا:
        returnedRequests: [], 

         // أضف هذه المتغيرات الأربعة الجديدة هنا:
        showQuotesModal: false,
        quotesModalTitle: '',
        quotesBase64Data: '',
        isQuotesImage: true,

        init() {
            // حل مشكلة التزامن عبر الانتظار الصارم لتأكيد حالة الجلسة من Firebase Auth
            window.fbAuth.onAuthStateChanged(async (user) => {
                if (!user) {
                    console.log('لا توجد جلسة نشطة، يتم التوجيه لصفحة الدخول.');
                    window.location.href = './index.html';
                    return;
                }

                try {
                    // جلب مستند الموظف الموثق من Firestore بالبريد الإلكتروني
                    const userDoc = await window.fbDatabase.collection('users').doc(user.email).get();
                    
                    if (userDoc.exists && userDoc.data().isActive) {
                        const userData = userDoc.data();
                        const roles = userData.roles || [];
                        
                        console.log('تم العثور على الحساب بنجاح. الصلاحيات الحالية:', roles);

                        // التحقق المرن والدقيق لضمان عدم الطرد الخاطئ
                        if (roles.includes('auditor')) {
                            this.auditorName = userData.name;
                            // استدعاء دالة جلب الطلبات فور التأكد التام من الصلاحية
                            this.fetchPendingAuditorRequests();
                            this.fetchReturnedAuditorRequests(); 
                        } else {
                            console.warn('الحساب نشط ولكنه لا يملك صلاحية auditor في المصفوفة.');
                            window.location.href = './index.html';
                        }
                    } else {
                        console.warn('المستند غير موجود في Firestore أو أن الحساب معطل.');
                        window.location.href = './index.html';
                    }
                } catch (error) {
                    console.error('حدث خطأ حرج أثناء التحقق الأمني من الصلاحيات:', error);
                    window.location.href = './index.html';
                }
            });
        },

        // جلب لحظي للطلبات التي تقع حالياً في محطة المدقق ومفتوحة (pending)
        fetchPendingAuditorRequests() {
            window.fbDatabase.collection('requests')
                .where('currentStage', '==', 'auditor')
                .where('status', '==', 'pending')
                .onSnapshot((snapshot) => {
                    this.requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    // إلغاء حجب الصفحة وعرض البطاقات فور اكتمال المزامنة بنجاح
                    this.isCheckingAuth = false;
                }, (error) => {
                    console.error('فشل الجلب اللحظي للمعاملات من Firestore:', error);
                });
        },


         // جلب لحظي ومباشر لكافة المعاملات المرجعة من قبل المدققين والتي تقف في حوزة الموظف
        fetchReturnedAuditorRequests() {
            window.fbDatabase.collection('requests')
                .where('currentStage', '==', 'applicant')
                .where('status', '==', 'returned')
                .onSnapshot((snapshot) => {
                    this.returnedRequests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                }, (error) => {
                    console.error('فشل جلب المعاملات المرجعة من Firestore:', error);
                });
        },

        // 1. دالة التعديل المباشر على بيانات الاستمارة المؤقتة في السيرفر
        /*
        async updateRequestData(id, newTitle, newJust, newAmount) {
            if (!newTitle.trim() || !newJust.trim() || !newAmount) {
                alert('خطأ: لا يمكن حفظ حقول فارغة أثناء التعديل المالي.');
                return false;
            }
            try {
                await window.fbDatabase.collection('requests').doc(id).update({
                    title: newTitle,
                    justification: newJust,
                    amount: parseFloat(newAmount)
                });
                return true;
            } catch (error) {
                console.error('خطأ أثناء تحديث بيانات الطلب:', error);
                alert('فشل حفظ البيانات المحدثة.');
                return false;
            }
        },
        */

                // دالة التعديل المباشر على بيانات الاستمارة حياً في السيرفر لطلب العهدة أو الشراء
        async updateRequestData(id, newTitle, newJust, newAmount) {
            if (!newTitle.trim() || !newJust.trim() || !newAmount) {
                alert('خطأ: لا يمكن حفظ حقول فارغة أثناء التعديل المالي.');
                return false;
            }
            try {
                // جلب المستند الحالي لمعرفة نوعه وإصلاح مشكلة الـ NaN
                const reqDoc = await window.fbDatabase.collection('requests').doc(id).get();
                const reqType = reqDoc.exists ? reqDoc.data().requestType : 'petty';

                const updatePayload = {
                    title: newTitle,
                    justification: newJust
                };

                // تحديث حقل القيمة المالي الصحيح المستهدف بناءً على البوابة النشطة
                if (reqType === 'purchase') {
                    updatePayload.totalAmount = parseFloat(newAmount);
                } else {
                    updatePayload.amount = parseFloat(newAmount);
                }

                await window.fbDatabase.collection('requests').doc(id).update(updatePayload);
                return true;
            } catch (error) {
                console.error('خطأ أثناء تحديث بيانات المعاملة:', error);
                alert('فشل حفظ البيانات المحدثة.');
                return false;
            }
        },




        // 2. دالة الموافقة والتحويل لمدير الدعم المؤسسي (المرحلة الثانية)
        async approveRequest(req, note) {
            const currentUser = window.fbAuth.currentUser;
            const updatedTimeline = [...req.timeline, {
                stage: 'auditor',
                action: 'approved',
                userEmail: currentUser.email,
                userName: this.auditorName,
                timestamp: new Date(),
                note: note.trim() || 'تمت المراجعة والتدقيق والموافقة على العهدة.'
            }];

            try {
                await window.fbDatabase.collection('requests').doc(req.id).update({
                    currentStage: 'institutional_support', // النقل للمحطة القادمة للسياسة والميزانية
                    timeline: updatedTimeline
                });
                

                // ضعه مباشرة بعد سطر await window.fbDatabase.collection('requests').doc(req.id).update(...)
                window.sendEmailNotification(req.applicantEmail, req.applicantName, req.title, 'المدقق المالي', 'تمت الموافقة والتحويل لمدير الدعم المؤسسي', note);

                window.notifyNextManager('institutional_support', req.applicantName, req.title);


                alert('تم اعتماد الطلب وتحويله بنجاح إلى مدير الدعم المؤسسي.');
                // هنا سنقوم بربط ميزة إرسال الإيميل الإلكتروني للمنشئ بحالة طلبة لاحقاً
            } catch (error) {
                alert('حدث خطأ أثناء اعتماد المعاملة.');
            }
        },

        // 3. دالة الرفض مع الملاحظة والإرجاع المباشر لمنشئ الطلب
        async returnRequestToApplicant(req, note) {
            if (!note.trim()) {
                alert('خطأ حرج: يجب كتابة ملاحظة أو سبب الإرجاع في خانة الملاحظات ليعرف الموظف سبب تعديل الاستمارة.');
                return;
            }
            const currentUser = window.fbAuth.currentUser;
            const updatedTimeline = [...req.timeline, {
                stage: 'auditor',
                action: 'returned_for_modifications',
                userEmail: currentUser.email,
                userName: this.auditorName,
                timestamp: new Date(),
                note: note.trim()
            }];

            try {
                await window.fbDatabase.collection('requests').doc(req.id).update({
                    currentStage: 'applicant', // إرجاعها لحوزة الموظف
                    status: 'returned',       // تحديث الحالة ليعرف الموظف أنها بحاجة لتعديل
                    timeline: updatedTimeline
                });


                // ضعه مباشرة بعد سطر نجاح التحديث في الـ try
                window.sendEmailNotification(req.applicantEmail, req.applicantName, req.title, 'المدقق المالي', 'تم إرجاع الطلب بحاجة لتعديلاتك', note);
                window.notifyNextManager('applicant', req.applicantName, req.title);



                alert('تم إرجاع المعاملة بنجاح إلى منشئ الطلب وتنبيهه بالملاحظات.');
            } catch (error) {
                alert('حدث خطأ أثناء إرجاع الطلب.');
            }
        },

        // 4. دالة الرفض النهائي التام وإنهاء رحلة المعاملة المالي
        async rejectAndTerminateRequest(req, note) {
            if (!note.trim()) {
                alert('خطأ حرج: يجب كتابة سبب الرفض النهائي وإغلاق المعاملة.');
                return;
            }
            if (confirm('تنبيه: هل أنت متأكد من رفض الطلب نهائياً وإنهاء رحلته؟ لا يمكن التراجع عن هذا الإجراء.')) {
                const currentUser = window.fbAuth.currentUser;
                const updatedTimeline = [...req.timeline, {
                    stage: 'auditor',
                    action: 'rejected_and_terminated',
                    userEmail: currentUser.email,
                    userName: this.auditorName,
                    timestamp: new Date(),
                    note: note.trim()
                }];

                try {
                    await window.fbDatabase.collection('requests').doc(req.id).update({
                        status: 'rejected', // تحديث نهائي ومغلق بالرفض
                        timeline: updatedTimeline
                    });


                    // ضعه مباشرة بعد سطر نجاح التحديث في الـ try
                    window.sendEmailNotification(req.applicantEmail, req.applicantName, req.title, 'المدقق المالي', 'تم رفض الطلب نهائياً وإغلاقه', note);



                    alert('تم رفض المعاملة نهائياً وإغلاق ملف الطلب المالي.');
                } catch (error) {
                    alert('حدث خطأ أثناء معالجة رفض الطلب.');
                }
            }
        },




         // دالة فك التشفير والمعاينة الفورية لعروض أسعار طلبات الشراء حياً للمدقق
        viewAttachedQuotes(base64Data, title) {
            if (!base64Data) {
                alert('خطأ: لا يوجد ملف عروض أسعار مرفق مع هذا الطلب المالي.');
                return;
            }
            this.quotesModalTitle = title;
            this.quotesBase64Data = base64Data;
            
            // التحقق من نوع الملف لمعرفة هل هو ملف PDF أم صورة عادية عبر فحص رأس النص
            if (base64Data.startsWith('data:application/pdf')) {
                this.isQuotesImage = false; // تفعيل عرض الـ iframe لملفات الـ PDF
            } else {
                this.isQuotesImage = true;  // تفعيل عرض صورة الـ img للصور العادية
            }
            this.showQuotesModal = true; // فتح نافذة المعاينة
        },





        // دالة مساعدة لتنسيق تواريخ المعاملات
        formatTimestamp(ts) {
            if (!ts) return 'الآن';
            const date = ts.toDate ? ts.toDate() : new Date(ts);
            return date.toLocaleString('ar-SA', { hour12: true });
        },

        async handleLogout() {
            await window.fbAuth.signOut();
            window.location.href = './index.html';
        }
    }));
});
