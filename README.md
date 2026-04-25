# Ahlul-Athar-web

واجهة بداية لمنصة متكاملة تدعم الويب والجوال، وتم تجهيزها لتكون قابلة للتثبيت كتطبيق (PWA).

## Features

- صفحة تسجيل دخول احترافية ومتجاوبة (RTL).
- تسجيل الدخول عبر Google باستخدام Firebase Authentication.
- تسجيل الدخول عبر رقم الهاتف + كلمة مرور (بصيغة alias عبر Email/Password).
- زر تثبيت التطبيق على الجهاز عند توفر `beforeinstallprompt`.
- جاهز للنشر على Vercel.

## Tech Stack

- React + TypeScript + Vite
- Firebase Authentication
- Vite PWA Plugin

## Setup

1. انسخ ملف البيئة:

   ```bash
   cp .env.example .env
   ```

2. أدخل بيانات Firebase في `.env`.
3. فعّل موفري تسجيل الدخول من Firebase Console:
   - Google
   - Email/Password
4. ثبّت الحزم وشغّل المشروع:

   ```bash
   npm install
   npm run dev
   ```

## Important Note (Phone + Password)

Firebase لا يدعم بشكل مباشر تسجيل الدخول "رقم هاتف + كلمة مرور" كموفر افتراضي.
في هذا الإصدار استخدمنا mapping من رقم الهاتف إلى بريد داخلي بصيغة:

`<phone>@ahlul-athar.app`

ثم تسجيل الدخول عبر Email/Password. لاحقًا يمكننا تحويلها إلى تدفق أقوى (OTP + كلمة مرور مخصصة عبر Cloud Functions / Firestore).

## Deploy to Vercel

1. ارفع المشروع إلى GitHub.
2. اربط المستودع مع [Vercel](https://vercel.com/).
3. أضف متغيرات البيئة نفسها داخل إعدادات المشروع في Vercel.
4. نفذ Deploy.
