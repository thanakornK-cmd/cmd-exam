# CMD AI Adoption Exam 2026 — Problem #4

This is the lightest of the four problems. Ship it fast and ship it deployed.

## What to build

An event registration system.

- Stack: **Next.js**, **Nest.js**, or **Go**.
- One repo. User pages, admin pages, and API in the same project.
- Automated tests. What you test is your call. Pick what would matter if this were a real event with real people.

User can:
- Submit a registration form with name, email, phone, and any other fields a real event would ask for.
- Upload multiple supporting documents.
- Set a password at submission time.
- Receive a reference code on submission.
- Return with reference code and password to view their submission.
- Edit any field, replace documents, add new documents.

Admin can:
- Log in with username and password from `.env`.
- See the list of all registrations.
- Click any registration to see its details.
- Download a name tag PDF for any registration.

## Deployment

- Deploy anywhere. Vercel, Railway, Fly, Render, your own VPS.
- The senior opens the URL, submits a registration with files, comes back with the reference code, edits something, opens the admin page, and downloads a tag. If all of that works, you pass the URL check.

## What to deliver

- The deployed URL.
- The code, shown to the senior at your seat.
- Tests.

## คำที่ต้องเข้าใจให้ตรงกัน

- **Reference code** — รหัสที่ระบบให้ผู้ใช้หลังลงทะเบียน ใช้กลับเข้ามาแก้ไขได้
- **Tag** — ป้ายชื่อผู้ลงทะเบียน (ในที่นี้คือ PDF ไม่ใช่กระดาษจริง)