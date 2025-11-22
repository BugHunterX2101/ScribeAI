@echo off
echo Starting ScribeAI Services...

echo Starting Server on port 3001...
start "ScribeAI Server" cmd /k "npm run server"

timeout /t 5 /nobreak

echo Starting Frontend on port 3000...
start "ScribeAI Frontend" cmd /k "npm run dev"

echo Both services are starting...
echo Server: http://localhost:3001
echo Frontend: http://localhost:3000