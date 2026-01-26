# 📧 Supabase OTP Setup (Copy-Paste)

Your app is configured to use **6-digit OTP codes**. Copy and paste these templates into your **Supabase Dashboard > Authentication > Email Templates**.

---

## 1. Confirm Signup (Confirmation Section)
**Subject:** `Your Bunkit Verification Code 📚`

**Body (Copy HTML below):**
```html
<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; text-align: center;">
  <div style="font-size: 32px; margin-bottom: 20px;">📚</div>
  <h2 style="color: #1e293b; margin-top: 0;">Welcome to Bunkit!</h2>
  <p style="color: #475569; line-height: 1.6;">
    Your smart attendance manager is almost ready. Use the 6-digit code below to verify your account:
  </p>
  <div style="margin: 30px 0;">
    <span style="font-size: 36px; font-weight: bold; color: #3b82f6; letter-spacing: 5px; background: #f1f5f9; padding: 10px 20px; border-radius: 8px;">
      {{ .Token }}
    </span>
  </div>
  <p style="color: #94a3b8; font-size: 13px; margin-top: 30px;">
    Enter this code in the app to complete your registration.
  </p>
</div>
```

---

## 2. Reset Password (Reset Password Section)
**Subject:** `Your Bunkit Password Reset Code 🔐`

**Body (Copy HTML below):**
```html
<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; text-align: center;">
  <div style="font-size: 32px; margin-bottom: 20px;">🔐</div>
  <h2 style="color: #1e293b; margin-top: 0;">Reset Your Password</h2>
  <p style="color: #475569; line-height: 1.6;">
    We received a request to reset your password. Use the verification code below to proceed:
  </p>
  <div style="margin: 30px 0;">
    <span style="font-size: 36px; font-weight: bold; color: #ef4444; letter-spacing: 5px; background: #fef2f2; padding: 10px 20px; border-radius: 8px;">
      {{ .Token }}
    </span>
  </div>
  <p style="color: #475569; line-height: 1.6;">
    Enter this code in the "Forgot Password" screen to set a new password.
  </p>
  <p style="color: #94a3b8; font-size: 13px; margin-top: 30px;">
    If you didn't request a reset, you can safely ignore this email.
  </p>
</div>
```

---

## 3. Magic Link (Optional)
If you decide to enable Magic Links later, use `{{ .ConfirmationURL }}`. But for now, use **{{ .Token }}** as shown above.
