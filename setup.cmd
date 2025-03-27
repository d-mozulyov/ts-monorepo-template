@echo off
setlocal enabledelayedexpansion
:: This is a universal setup script that works on both Windows and Unix systems
:: Check for Windows platform and run appropriate setup
goto :windows 2>nul || :

#!/bin/bash
# If we get here, we're on a Unix-like system
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
node "$SCRIPT_DIR/packages/shared/cli/setup.js" "$@"
exit $?

:windows
:: Windows-specific setup
:: Get the directory where this script resides
set "SCRIPT_DIR=%~dp0"

:: Check for admin rights
net session >nul 2>&1
if %errorLevel% == 0 (
    :: Already running with admin rights, run the Node.js script
    node "%SCRIPT_DIR%packages\shared\cli\setup.js" %*
) else (
    :: Request elevation
    echo Requesting Administrator privileges...
    powershell -Command "Start-Process cmd -ArgumentList '/c cd /d \"%CD%\" && \"%~f0\" %*' -Verb RunAs"
)

exit /b %errorLevel%