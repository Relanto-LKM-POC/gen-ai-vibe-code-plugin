@echo off
echo =========================================
echo   Spec Driven Development - Setup Script
echo =========================================
echo.

:: Check if we're in the correct directory
if not exist "package.json" (
    echo ERROR: package.json not found in current directory
    echo Please ensure you are in the spec-driven-development project directory
    echo.
    echo Expected workflow:
    echo 1. git clone ^<your-git-repo-link^>
    echo 2. cd spec-driven-development
    echo 3. setup.bat
    pause
    exit /b 1
)

:: Verify it's the correct project by checking package.json content
findstr /c:"spec-driven-development" package.json >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: This doesn't appear to be the spec-driven-development project
    echo Please ensure you're in the correct project directory
    pause
    exit /b 1
)

echo Found spec-driven-development project directory ✓
echo.

:: Check if Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js v14 or higher from https://nodejs.org/
    pause
    exit /b 1
)

:: Check if VS Code is installed
where code >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: VS Code CLI is not available
    echo Please ensure VS Code is installed and added to PATH
    echo See: https://code.visualstudio.com/docs/setup/setup-overview
    pause
    exit /b 1
)

echo Checking Node.js version...
node --version
echo.

echo Step 1: Installing dependencies...
echo =====================================
call npm install
if %errorlevel% neq 0 (
    echo ERROR: npm install failed
    pause
    exit /b 1
)
echo Dependencies installed successfully!

echo Checking for security vulnerabilities...
call npm audit --audit-level moderate
if %errorlevel% neq 0 (
    echo Security vulnerabilities detected. Attempting to fix...
    call npm audit fix
    if %errorlevel% neq 0 (
        echo WARNING: Some vulnerabilities could not be auto-fixed
        echo You may need to update dependencies manually
        echo Run 'npm audit' for details
    ) else (
        echo Security vulnerabilities fixed successfully!
    )
)
echo.

echo Step 2: Compiling the extension...
echo ===================================
call npm run compile
if %errorlevel% neq 0 (
    echo ERROR: Compilation failed
    pause
    exit /b 1
)
echo Extension compiled successfully!
echo.

echo Step 3: Packaging the extension...
echo ===================================
call npm run package
if %errorlevel% neq 0 (
    echo ERROR: Packaging failed
    pause
    exit /b 1
)
echo Extension packaged successfully!
echo.

echo Step 4: Installing extension in VS Code...
echo ===========================================

:: Check if we're running from VS Code integrated terminal
set RUNNING_FROM_VSCODE=false
if defined VSCODE_PID set RUNNING_FROM_VSCODE=true
if defined TERM_PROGRAM (
    if /i "%TERM_PROGRAM%"=="vscode" set RUNNING_FROM_VSCODE=true
)

if "%RUNNING_FROM_VSCODE%"=="true" (
    echo Running from VS Code integrated terminal - proceeding with installation...
) else (
    echo Running from external terminal - proceeding with installation...
)

echo Checking current extension installation...
code --list-extensions --show-versions | findstr "spec-driven-development" >nul 2>&1
set CURRENT_INSTALLED=%errorlevel%

if %CURRENT_INSTALLED% equ 0 (
    echo Current extension found. Checking version...
    for /f "tokens=2 delims=@" %%v in ('code --list-extensions --show-versions ^| findstr "spec-driven-development"') do (
        echo Currently installed version: %%v
        echo New package version: 1.0.0
        if "%%v"=="1.0.0" (
            echo Same version detected - reinstalling to update code changes...
        ) else (
            echo Different version detected - updating from %%v to 1.0.0...
        )
    )
) else (
    echo No previous version found - performing fresh installation...
)

echo Installing extension: spec-driven-development-1.0.0.vsix
echo Running: code --install-extension spec-driven-development-1.0.0.vsix --force
code --install-extension spec-driven-development-1.0.0.vsix --force
set INSTALL_EXIT_CODE=%errorlevel%
echo Install command completed (exit code: %INSTALL_EXIT_CODE%)

if %INSTALL_EXIT_CODE% neq 0 (
    echo ERROR: Extension installation failed with exit code %INSTALL_EXIT_CODE%
    echo.
    echo Debugging information:
    echo - VS Code version: 
    code --version 2>&1
    echo - Current directory: %CD%
    echo - VSIX file exists: 
    if exist "spec-driven-development-1.0.0.vsix" (echo Yes) else (echo No)
    echo.
    echo Alternative installation methods:
    echo 1. Open VS Code
    echo 2. Press Ctrl+Shift+P
    echo 3. Type "Extensions: Install from VSIX"
    echo 4. Select: spec-driven-development-1.0.0.vsix
    pause
    exit /b 1
)

echo Verifying installation...
code --list-extensions | findstr "spec-driven-development" >nul
if %errorlevel% equ 0 (
    echo Extension installed and verified successfully!
) else (
    echo WARNING: Extension installation may not have completed properly
    echo Please verify manually in VS Code Extensions panel
)
echo.

echo =========================================
echo   Setup completed successfully! 
echo =========================================
echo.
echo Next steps:
echo 1. Open VS Code
echo 2. Open Command Palette (Ctrl+Shift+P)
echo 3. Select "Developer: Reload Window"
echo 4. The Spec Driven Development extension should now be active
echo.
echo Press any key to exit...
pause >nul