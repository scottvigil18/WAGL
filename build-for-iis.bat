@echo off
echo === Building WAGL for IIS ===
echo.

echo [1/3] Installing backend dependencies...
cd backend
call npm install --production
cd ..

echo.
echo [2/3] Installing frontend dependencies and building...
cd frontend
call npm install
call npm run build
cd ..

echo.
echo [3/3] Build complete!
echo.
echo === Deployment Instructions ===
echo.
echo 1. Install iisnode: https://github.com/azure/iisnode/releases
echo 2. Install URL Rewrite Module: https://www.iis.net/downloads/microsoft/url-rewrite
echo 3. Create a new IIS website pointing to: %CD%
echo 4. Ensure the App Pool uses "No Managed Code" (since Node handles everything)
echo 5. Grant IIS_IUSRS read/write access to the backend\data folder
echo 6. Set environment variable PORT=process.env.PORT (iisnode handles this)
echo.
echo The app will be available at your IIS site URL.
echo Frontend: served from frontend\dist\
echo Backend API: /api/golf/* routed through iisnode
echo.
pause
