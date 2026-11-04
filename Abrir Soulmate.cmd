@echo off
setlocal
cd /d "%~dp0"
if exist "%~dp0..\Aplicacion\soulmate-portable.json" (
  if not exist "%~dp0..\Temporal" mkdir "%~dp0..\Temporal"
  set "TEMP=%~dp0..\Temporal"
  set "TMP=%~dp0..\Temporal"
  set "ELECTRON_BUILDER_CACHE=%~dp0..\Herramientas\electron-builder"
  set "ELECTRON_CACHE=%~dp0..\Herramientas\electron"
  set "npm_config_cache=%~dp0..\Herramientas\npm-cache"
  call npm.cmd start -- --soulmate-portable-root="%~dp0.."
) else (
  call npm.cmd start
)
