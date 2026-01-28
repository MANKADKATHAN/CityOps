# 🚀 Deployment Guide for CivicPulse

This guide will help you deploy the **CivicPulse** Smart City App to the web so anyone can use it.

## 🏗️ Architecture

-   **Frontend**: React (Vite) -> Deployed on **Vercel**
-   **Backend**: Python (FastAPI) -> Deployed on **Render**
-   **Database**: PostgreSQL -> Hosted on **Supabase**

---

## 1. Deploying the Backend (Render)

We deploy the backend first because the frontend needs the Backend URL.

1.  **Push your code to GitHub** (if you haven't already).
2.  **Sign up/Log in to [Render.com](https://render.com/)**.
3.  Click **"New +"** -> **"Web Service"**.
4.  Connect your GitHub repository.
5.  **Configure the Service**:
    -   **Name**: `civicpulse-backend` (or similar)
    -   **Root Directory**: `civicpulse-backend` (Important!)
    -   **Runtime**: Python 3
    -   **Build Command**: `pip install -r requirements.txt`
    -   **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
6.  **Environment Variables** (Scroll down to "Advanced" or "Environment"):
    -   Add the following variables (copy from your `.env` or Supabase dashboard):
        -   `SUPABASE_URL`: `https://your-project.supabase.co`
        -   `SUPABASE_KEY`: `your-service-role-key` (or anon key if that's what you used extensively, but service role is better for backend admin tasks)
        -   `GEMINI_API_KEY`: `your-google-gemini-key`
7.  Click **"Create Web Service"**.
8.  **Wait for deployment**. Once live, copy the **Service URL** (e.g., `https://civicpulse-backend.onrender.com`). You will need this for the Frontend.

---

## 2. Deploying the Frontend (Vercel)

1.  **Sign up/Log in to [Vercel.com](https://vercel.com/)**.
2.  Click **"Add New..."** -> **"Project"**.
3.  Import your GitHub repository.
4.  **Configure the Project**:
    -   **Project Name**: `civicpulse-frontend`
    -   **Framework Preset**: Vite (should be detected automatically)
    -   **Root Directory**: Click "Edit" and select `civicpulse-frontend`.
5.  **Environment Variables**:
    -   Add the following:
        -   `VITE_SUPABASE_URL`: `https://your-project.supabase.co` (Same as backend)
        -   `VITE_SUPABASE_ANON_KEY`: `your-anon-key`
        -   `VITE_BACKEND_URL`: **Paste the Render Backend URL here** (e.g., `https://civicpulse-backend.onrender.com`)
            -   *Note: Do not include a trailing slash `/`.*
6.  Click **"Deploy"**.

---

## 3. Post-Deployment Checks

1.  Open your **Vercel Deployment URL**.
2.  **Test Signup/Login**: Ensure you can create accounts.
3.  **Test Dashboard**: Ensure complaints load.
4.  **Test Backend**: Submit a complaint. If it works, the connection to Render is good.
    -   *Troubleshooting*: If you see "Network Error", check the `VITE_BACKEND_URL` in Vercel settings and ensure the Render backend is "Live".

---

## 🔒 Security Note

-   Ensure your **Supabase Row Level Security (RLS)** policies are active.
-   Never expose your `service_role` key in the Frontend (Vercel) variables. Only use `anon` key there.
