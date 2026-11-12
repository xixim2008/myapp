@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 我的工作台

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   [错误] 没有检测到 Node.js
  echo   请先安装 Node.js 18 或更高版本：https://nodejs.org
  echo.
  pause
  exit /b 1
)

node server\server.js
pause
