const firebaseConfig = {
    apiKey: "AIzaSyCDvHyeR3ynVOuzDwvRqrVY7Sg2aYe83IQ",
    authDomain: "requestsapp-56a3d.firebaseapp.com",
    projectId: "requestsapp-56a3d",
    storageBucket: "requestsapp-56a3d.firebasestorage.app",
    messagingSenderId: "302707066521",
    appId: "1:302707066521:web:98de6f6576b4ff3b599a08"
};

// سنقوم باستدعاء وتهيئة خدمات Firebase الأساسية (Auth و Firestore)
// وتخزينها في متغيرات عالمية (window) لتتمكن بقية الملفات مثل login.js من استخدامها فوراً
window.fbApp = firebase.initializeApp(firebaseConfig);
window.fbAuth = firebase.auth();
window.fbDatabase = firebase.firestore();
window.fbDatabase.settings({
    experimentalForceLongPolling: true,
    experimentalAutoDetectLongPolling: false,
    merge: true
});

// إعداد موفر خدمة تسجيل الدخول بواسطة جوجل (Google Auth Provider)
window.googleProvider = new firebase.auth.GoogleAuthProvider();

// تخصيص عملية الدخول لتجبر المستخدم دائماً على اختيار حسابه واظهار نافذة الاختيار
window.googleProvider.setCustomParameters({
    prompt: 'select_account'
});



// أضف هذا السطر في نهاية ملف firebase-config.js لاستدعاء مكتبة الإرسال من الـ CDN محلياً
const script = document.createElement('script');
script.src = "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js";
document.head.appendChild(script);

script.onload = function() {
    // تفعيل الخدمة باستخدام المفتاح العام الخاص بك (Public Key) المأخوذ من موقع EmailJS
    emailjs.init("k6TFJB70LuQ9yRVxS"); 
};

// دالة عالمية موحدة مخصصة لإرسال إشعارات البريد الإلكتروني للموظف فوراً
window.sendEmailNotification = function(toEmail, applicantName, requestTitle, currentStage, statusAction, managerNote) {
    const templateParams = {
        to_email: toEmail,
        applicant_name: applicantName,
        request_title: requestTitle,
        current_stage: currentStage,
        status_action: statusAction,
        manager_note: managerNote || 'لا توجد ملاحظات إضافية.'
    };

    // إرسال الإيميل عبر القالب المجهز (Template ID و Service ID)
    emailjs.send('service_xmpi1ji', 'template_4v86nid', templateParams)
        .then(() => console.log('تم إرسال إشعار البريد الإلكتروني للموظف بنجاح.'))
        .catch((error) => console.error('فشل إرسال إشعار البريد الإلكتروني:', error));
};




// دالة عالمية للبحث عن المسؤولين عن المرحلة القادمة وإرسال إيميل تنبيهي لهم بوجود طلب معلق
window.notifyNextManager = async function(nextStage, applicantName, requestTitle) {
    try {
        // 1. الاستعلام من قاعدة البيانات للوصول إلى إيميل المسؤول الموكل بهذه المرحلة
        const usersSnapshot = await window.fbDatabase.collection('users')
            .where('isActive', '==', true)
            .get();
        
        let targetEmails = [];
        
        // البحث في مصفوفة الصلاحيات لجميع الموظفين النشطين لالتقاط البريد الإلكتروني للمسؤول القادم
        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            const roles = userData.roles || [];
            if (roles.includes(nextStage)) {
                targetEmails.push(userData.email);
            }
        });

        // الترجمة اللغوية المفهومة للمرحلة في نص الإيميل
        const stagesArabic = {
            'auditor': 'المدقق',
            'manager': 'مدير الإدارة',
            'ceo': 'الرئيس التنفيذي',
            'chairman': 'رئيس مجلس الإدارة',
            'accountant': 'المحاسب',
            'applicant': 'منشئ الطلب (الموظف)'
        };

        // 2. إرسال إيميل التنبيه لكل مسؤول عن هذه المرحلة (يدعم حال وجود أكثر من محاسب أو مدقق)
        targetEmails.forEach(managerEmail => {
            const managerParams = {
                to_email: managerEmail,
                stage_name: stagesArabic[nextStage] || nextStage,
                applicant_name: applicantName,
                request_title: requestTitle,
                system_url: window.location.origin // رابط السيرفر المباشر للدخول
            };

            // إرسال الإيميل للمسؤول عبر قالب التنبيه المخصص للمسؤولين في EmailJS
            emailjs.send('service_xmpi1ji', 'template_4v86nid', managerParams)
                .then(() => console.log(`تم إرسال إيميل تنبيهي للمسؤول القادم (${managerEmail}) بنجاح.`))
                .catch((error) => console.error('فشل إرسال التنبيه للمسؤول:', error));
        });

    } catch (error) {
        console.error('حدث خطأ أثناء محاولة جلب بيانات المسؤول القادم للتنبيه البريدي:', error);
    }
};


