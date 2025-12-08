#!/bin/bash

echo "========================================="
echo "   Spec Driven Development - Setup Script"
echo "========================================="
echo

# Check if we're in the correct directory
if [ ! -f "package.json" ]; then
    echo -e "\033[0;31mERROR: package.json not found in current directory\033[0m"
    echo "Please ensure you are in the spec-driven-development project directory"
    echo
    echo "Expected workflow:"
    echo "1. git clone <your-git-repo-link>"
    echo "2. cd spec-driven-development"
    echo "3. ./setup.sh"
    exit 1
fi

# Verify it's the correct project by checking package.json content
if ! grep -q "spec-driven-development" package.json; then
    echo -e "\033[0;31mERROR: This doesn't appear to be the spec-driven-development project\033[0m"
    echo "Please ensure you're in the correct project directory"
    exit 1
fi

echo -e "\033[0;32mFound spec-driven-development project directory ✓\033[0m"
echo

# Colors for better output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_error() {
    echo -e "${RED}ERROR: $1${NC}"
}

print_success() {
    echo -e "${GREEN}$1${NC}"
}

print_info() {
    echo -e "${YELLOW}$1${NC}"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed or not in PATH"
    echo "Please install Node.js v14 or higher from https://nodejs.org/"
    exit 1
fi

# Check if VS Code is installed
if ! command -v code &> /dev/null; then
    print_error "VS Code CLI is not available"
    echo "Please ensure VS Code is installed and added to PATH"
    echo "See: https://code.visualstudio.com/docs/setup/setup-overview"
    exit 1
fi

print_info "Checking Node.js version..."
node --version
echo

print_info "Step 1: Installing dependencies..."
echo "====================================="
if npm install; then
    print_success "Dependencies installed successfully!"
    
    print_info "Checking for security vulnerabilities..."
    if ! npm audit --audit-level moderate >/dev/null 2>&1; then
        print_info "Security vulnerabilities detected. Attempting to fix..."
        if npm audit fix; then
            print_success "Security vulnerabilities fixed successfully!"
        else
            print_info "WARNING: Some vulnerabilities could not be auto-fixed"
            echo "You may need to update dependencies manually"
            echo "Run 'npm audit' for details"
        fi
    fi
else
    print_error "npm install failed"
    exit 1
fi
echo

print_info "Step 2: Compiling the extension..."
echo "==================================="
if npm run compile; then
    print_success "Extension compiled successfully!"
else
    print_error "Compilation failed"
    exit 1
fi
echo

print_info "Step 3: Packaging the extension..."
echo "==================================="
if npm run package; then
    print_success "Extension packaged successfully!"
else
    print_error "Packaging failed"
    exit 1
fi
echo

print_info "Step 4: Installing extension in VS Code..."
echo "==========================================="

# Check if we're running from VS Code integrated terminal
RUNNING_FROM_VSCODE=false
if [ -n "$VSCODE_PID" ] || [ "$TERM_PROGRAM" = "vscode" ]; then
    RUNNING_FROM_VSCODE=true
fi

if [ "$RUNNING_FROM_VSCODE" = "true" ]; then
    print_info "Running from VS Code integrated terminal - proceeding with installation..."
else
    print_info "Running from external terminal - proceeding with installation..."
fi

print_info "Checking current extension installation..."
CURRENT_EXTENSIONS=$(code --list-extensions --show-versions 2>/dev/null)
SPEC_EXTENSION=$(echo "$CURRENT_EXTENSIONS" | grep "spec-driven-development" || true)

if [ -n "$SPEC_EXTENSION" ]; then
    CURRENT_VERSION=$(echo "$SPEC_EXTENSION" | cut -d'@' -f2)
    print_info "Current extension found. Checking version..."
    echo "Currently installed version: $CURRENT_VERSION"
    echo "New package version: 1.0.0"
    
    if [ "$CURRENT_VERSION" = "1.0.0" ]; then
        print_info "Same version detected - reinstalling to update code changes..."
    else
        print_info "Different version detected - updating from $CURRENT_VERSION to 1.0.0..."
    fi
else
    print_info "No previous version found - performing fresh installation..."
fi

print_info "Installing extension: spec-driven-development-1.0.0.vsix"
echo "Running: code --install-extension spec-driven-development-1.0.0.vsix --force"

# Install the extension with force flag
if code --install-extension spec-driven-development-1.0.0.vsix --force; then
    INSTALL_EXIT_CODE=0
else
    INSTALL_EXIT_CODE=$?
fi

echo "Install command completed (exit code: $INSTALL_EXIT_CODE)"

if [ $INSTALL_EXIT_CODE -eq 0 ]; then
    print_info "Verifying installation..."
    if code --list-extensions 2>/dev/null | grep -q "spec-driven-development"; then
        print_success "Extension installed and verified successfully!"
    else
        print_info "WARNING: Extension installation may not have completed properly"
        echo "Please verify manually in VS Code Extensions panel"
    fi
else
    print_error "Extension installation failed with exit code $INSTALL_EXIT_CODE"
    echo ""
    echo "Debugging information:"
    echo "- VS Code version:"
    code --version 2>&1
    echo "- Current directory: $(pwd)"
    echo "- VSIX file exists: $(if [ -f 'spec-driven-development-1.0.0.vsix' ]; then echo 'Yes'; else echo 'No'; fi)"
    echo ""
    echo "Alternative installation methods:"
    echo "1. Open VS Code"
    echo "2. Open Command Palette (Cmd+Shift+P on Mac, Ctrl+Shift+P on Linux)"
    echo "3. Type 'Extensions: Install from VSIX'"
    echo "4. Select: spec-driven-development-1.0.0.vsix"
    exit 1
fi
echo

echo "========================================="
print_success "   Setup completed successfully! "
echo "========================================="
echo
echo "Next steps:"
echo "1. Open VS Code"
echo "2. Open Command Palette (Cmd+Shift+P on Mac, Ctrl+Shift+P on Linux)"
echo "3. Select \"Developer: Reload Window\""
echo "4. The Spec Driven Development extension should now be active"
echo