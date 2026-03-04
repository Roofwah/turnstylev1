TURNSTYLE AUTH IMPLEMENTATION — NextAuth + Resend OTP
======================================================

1. INSTALL DEPENDENCIES
   npm install next-auth @auth/prisma-adapter nodemailer

2. SCHEMA CHANGES
   Add NextAuth required tables to prisma/schema.prisma:
   - Account model
   - Session model
   - VerificationToken model
   - Link User to Account and Session
   Run migration script to add tables to Railway DB.

3. CONFIGURE NEXTAUTH
   - Create app/api/auth/[...nextauth]/route.ts
   - Configure Email provider using Resend SMTP
   - Configure PrismaAdapter
   - Set NEXTAUTH_SECRET and NEXTAUTH_URL in Vercel env vars

4. RESEND SMTP CONFIG
   - Use Resend SMTP credentials (not API key)
   - From: noreply@status.turnstylehost.com
   - Custom branded OTP email template

5. LOGIN PAGE
   - Update /login/page.tsx to use NextAuth signIn()
   - Email input → sends magic link via Resend
   - Matching dark theme UI

6. MIDDLEWARE
   - Create middleware.ts to protect all /dashboard/* routes
   - Redirect unauthenticated users to /login
   - Allow /review/* and /api/terms/* without auth

7. REMOVE HARDCODED ADMIN
   - Remove TEMP_USER_EMAIL from campaigns.ts
   - Use session.user.id as createdById

8. ADMIN USER MANAGEMENT
   - Add invite screen at /dashboard/admin/users
   - Admin can add/remove approved email addresses
   - Non-approved emails get "contact us" message

9. TEST & DEPLOY
   - Test locally with real email
   - Set env vars in Vercel
   - Smoke test on app.turnstylehost.com