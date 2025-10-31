@echo off
echo 🚀 Starting Motor Health Monitoring System...
echo.

REM Check current data mode
node toggle.js
echo.

echo 📋 Starting services in order...
echo.

echo 1️⃣ Starting Main Server...
start "Main Server" cmd /k "node server.js"
timeout /t 3

echo 2️⃣ Starting UDP Service...
start "UDP Service" cmd /k "node server/startUDPService.js"
timeout /t 3

echo 3️⃣ Starting AI Service...
start "AI Service" cmd /k "cd ai-service && python app.py"
timeout /t 3

echo 4️⃣ Starting React App...
start "React App" cmd /k "npm start"

echo.
echo ✅ All services starting...
echo 🌐 React app will open at http://localhost:3000
echo.
echo 📝 To change data mode:
echo   node toggle.js fake   (for fake data)
echo   node toggle.js real   (for Raspberry Pi data)
pause