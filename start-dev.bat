@echo off
echo Iniciando Backend y Frontend...
start "Backend - SEIO" cmd /k "cd server && npm run start:dev"
timeout /t 3 /nobreak > nul
start "Frontend - SEIO" cmd /k "cd client && npm start"
echo.
echo Servidores iniciados en ventanas separadas
echo Presiona cualquier tecla para cerrar esta ventana...
pause > nul
