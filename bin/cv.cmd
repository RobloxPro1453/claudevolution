@echo off
rem claudevolution CLI launcher (Windows). Uses Node if installed, otherwise Deno.
where node >nul 2>nul
if not errorlevel 1 goto :node
where deno >nul 2>nul
if not errorlevel 1 goto :deno
echo claudevolution: Node ya da Deno bulunamadi. Birini kurun ve yeniden deneyin.
exit /b 127
:node
node "%~dp0cv.js" %*
exit /b %errorlevel%
:deno
deno run -A --quiet "%~dp0cv.js" %*
exit /b %errorlevel%
