# Hosting Guide

This project is ready for a two-service deployment:

- Backend API: Render web service
- Frontend app: Vercel Vite deployment

The frontend must be deployed after the backend URL is known, because Vercel needs `VITE_API_BASE`.

## 1. Push The Project To GitHub

Create a GitHub repository and push this folder.

```bash
git add .
git commit -m "Prepare project for deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

If the remote already exists, skip `git remote add origin`.

## 2. Deploy Backend On Render

Use Render Blueprint deployment with the existing `render.yaml`.

1. Open Render.
2. Choose New > Blueprint.
3. Connect the GitHub repository.
4. Select the repository and let Render read `render.yaml`.
5. Create the `autoassign-api` service.

Render should use:

```text
Build command: npm install && npm run prisma:generate --workspace server && npm run build --workspace server
Start command: npm run db:deploy --workspace server && npm run start --workspace server
Health check: /health
```

Set these backend environment variables in Render:

```env
NODE_VERSION=22
DATABASE_URL=file:./dev.db
SUPER_ADMIN_EMAIL=your-admin-email@example.com
BREVO_API_KEY=your-brevo-api-key
BREVO_SENDER_EMAIL=your-verified-sender-email@example.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password
MAIL_FROM=AutoAssign <your-email@gmail.com>
APP_BASE_URL=https://YOUR-RENDER-SERVICE.onrender.com
```

On Render Free, use `BREVO_API_KEY` for OTP email. Gmail SMTP uses ports that Render Free blocks, so keep SMTP only for local testing or paid hosting.

After deployment, test:

```text
https://YOUR-RENDER-SERVICE.onrender.com/health
```

It should return:

```json
{ "ok": true }
```

## 3. Deploy Frontend On Vercel

Use the existing `vercel.json`.

1. Open Vercel.
2. Import the same GitHub repository.
3. Keep the framework as Vite.
4. Add this environment variable:

```env
VITE_API_BASE=https://YOUR-RENDER-SERVICE.onrender.com
```

Vercel should use:

```text
Install command: npm install
Build command: npm run build --workspace client
Output directory: client/dist
```

Deploy, then open the Vercel URL. That is the link you can share with people.

## Database Note

The current Render free setup uses SQLite at `file:./dev.db`. This is fine for a live demo, but the data may reset when Render restarts, rebuilds, or moves the service.

For real persistent data, use one of these options:

- Render paid service with a persistent disk and `DATABASE_URL=file:/var/data/dev.db`
- Postgres, with the Prisma datasource changed from `sqlite` to `postgresql`

## Common Fixes

If the frontend says it cannot reach the API, check:

- `VITE_API_BASE` in Vercel points to the Render backend URL.
- The Render backend is awake and `/health` returns `{ "ok": true }`.
- The backend URL does not have a trailing slash in `VITE_API_BASE`.

If registration OTP email fails on Render Free, check:

- `BREVO_API_KEY` is set in Render.
- `BREVO_SENDER_EMAIL` is a sender verified in Brevo.
- `MAIL_FROM` uses the same verified sender, for example `AutoAssign <your-email@example.com>`.
- The backend was redeployed after adding the environment variables.
