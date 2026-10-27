# Money Dashboard (MERN)

Income, expenses, profit/loss, calendar reminders and downloadable reports, with email-verified accounts.

## Setup
1. Install Node 18+ and MongoDB (local) or create a free MongoDB Atlas cluster.
2. `server/.env` is created for you with a random `JWT_SECRET`. Set `MONGO_URI` if needed.
3. Run:
   ```
   npm install
   npm run install:all
   npm run dev
   ```
4. Open http://localhost:5173 and create an account.

## Email verification
- Development: leave `SMTP_HOST` empty. The verification link is printed in the server terminal; open it in the browser.
- Production: fill `SMTP_*` and `MAIL_FROM` (Gmail app password, Brevo, Mailgun, SES, etc.) and set `CLIENT_URL` to your site URL.

## Security notes
- Passwords hashed with bcrypt (cost 12); verification tokens stored as SHA-256 hashes and expire in 24 hours.
- Login requires a verified email. JWT lasts 7 days. Auth endpoints are rate limited. Every query is scoped to the logged-in user.
- Logout clears the token in the browser. For production, serve over HTTPS.

## Reports
`GET /api/reports/export?format=pdf|xlsx|csv&period=day|month|year&content=summary|transactions&from=YYYY-MM-DD&to=YYYY-MM-DD&cur=₹`
"# daily-task" 
