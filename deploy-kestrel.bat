@echo off
echo === Building WAGL for Kestrel ===
echo.

echo [1/4] Building frontend...
cd frontend
call npm run build
cd ..

echo.
echo [2/4] Copying frontend to proxy/wwwroot...
if exist proxy\wwwroot rmdir /s /q proxy\wwwroot
mkdir proxy\wwwroot
xcopy /s /e /y frontend\dist\* proxy\wwwroot\

echo.
echo [3/4] Building .NET proxy...
cd proxy
dotnet publish -c Release -o ..\publish
cd ..

echo.
echo [4/4] Done!
echo.
echo === How to Run ===
echo.
echo 1. Start the Node.js backend:
echo    cd backend ^& node src/index.js
echo.
echo 2. Start Kestrel (in another terminal):
echo    cd publish ^& WaglProxy.exe
echo.
echo 3. Open http://localhost:5000
echo.
echo Kestrel serves the frontend and proxies /api/* to Node.js on port 4000.
echo.
pause
