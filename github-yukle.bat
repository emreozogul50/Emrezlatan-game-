@echo off
chcp 65001 >nul
cd /d "%~dp0"
title GitHub yukleme

where git >nul 2>nul
if errorlevel 1 (
  echo Git kurulu degil. Acilan sayfadan kur, sonra bu dosyayi tekrar calistir.
  start https://git-scm.com/downloads
  pause
  exit /b
)

set "REPO=https://github.com/emreozogul50/Emrezlatan-game-.git"
if exist ".repo-url" set /p REPO=<.repo-url

echo.
echo Repo adresi: %REPO%
echo Baska bir repoya yuklemek istersen yeni adresi yaz, aynisi ise sadece ENTER bas.
set /p NEWREPO="Adres (ENTER = ayni): "
if not "%NEWREPO%"=="" set "REPO=%NEWREPO%"
>.repo-url echo %REPO%

if exist ".git" (
  echo Mevcut git klasoru bulundu, uzerine yaziliyor.
) else (
  echo Git klasoru yok, yeni olusturuluyor. Bu normal.
  git init
)

git add .
git commit -m "EZ Vampir Koylu guncelleme"
git branch -M main
git remote remove origin >nul 2>nul
git remote add origin %REPO%
git push -u origin main --force

echo.
if errorlevel 1 (
  echo Yukleme basarisiz. Yukaridaki hata satirini oku.
) else (
  echo Bitti. Render birkac dakika icinde yeni surumu kurar.
)
pause
