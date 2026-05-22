# Ubuntu setup (Insider Library)

## 1. Fix Python venv

Your error means the `venv` package is missing, so Python created a **broken** virtualenv (no `activate`, no `pip`).

```bash
sudo apt update
sudo apt install python3-venv python3-pip
```

Remove the broken folder and recreate:

```bash
cd ~/Desktop/Insider\ Library/backend
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

If `source venv/bin/activate` still fails, use:

```bash
./venv/bin/pip install -r requirements.txt
./venv/bin/uvicorn app.main:app --reload --port 8000
```

## 2. Frontend (Node 18)

The project uses **Vite 5** and **React Router 6**, which support Node 18 (Ubuntu’s default).

```bash
cd ~/Desktop/Insider\ Library/frontend
rm -rf node_modules package-lock.json   # only if you had old Vite 7 installs
npm install
npm run dev
```

Keep the backend running in another terminal.

## 3. Quick check

- Backend health: `curl http://127.0.0.1:8000/health`
- Frontend: browser at `http://127.0.0.1:5173`

## 4. Admin access

```bash
cd backend
sqlite3 insider_library.db "UPDATE users SET is_admin = 1 WHERE email = 'your@email.com';"
```

Then visit: `http://127.0.0.1:5173/internal-admin-8d14c11` (log in as that user first).

## 5. `python` vs `python3`

On Ubuntu, use **`python3`** for venv and scripts. To add a `python` command:

```bash
sudo apt install python-is-python3
```
