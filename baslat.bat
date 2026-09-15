@echo off
chcp 65001 >nul
cd /d "%~dp0"
title EZ Vampir Koylu

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js kurulu degil. Acilan sayfadan LTS surumunu kur, sonra bu dosyayi tekrar calistir.
  start https://nodejs.org
  pause
  exit /b
)

if not exist node_modules (
  echo Paketler kuruluyor, bir kereye mahsus 1-2 dakika surer...
  call npm install
  if errorlevel 1 ( echo Kurulum basarisiz. & pause & exit /b )
)

if not exist .env copy .env.example .env >nul

echo.
echo Oyun baslatiliyor: http://localhost:3000
echo Kapatmak icin bu pencereyi kapat.
echo.
start "" http://localhost:3000
npm start
pause
