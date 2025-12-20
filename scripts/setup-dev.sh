#!/bin/bash

# Oaysus CLI Development Setup Script
# This script sets up dual CLI commands:
#   - oaysus     → Production version (from npm registry)
#   - oaysus-dev → Local development version (from this repo)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Oaysus CLI Development Setup${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "${YELLOW}CLI Directory:${NC} $CLI_DIR"
echo ""

# Detect npm global bin directory
NPM_BIN=$(npm bin -g 2>/dev/null || echo "$HOME/.npm-global/bin")
echo -e "${YELLOW}NPM Global Bin:${NC} $NPM_BIN"
echo ""

# Step 1: Remove any existing npm link for @oaysus/cli
echo -e "${BLUE}[1/4]${NC} Cleaning up existing links..."
npm unlink -g @oaysus/cli 2>/dev/null || true
rm -f "$NPM_BIN/oaysus-dev" 2>/dev/null || true
echo -e "${GREEN}  ✓ Cleaned up existing links${NC}"

# Step 2: Install production CLI from npm
echo -e "${BLUE}[2/4]${NC} Installing production CLI from npm..."
npm install -g @oaysus/cli
echo -e "${GREEN}  ✓ Production CLI installed${NC}"

# Step 3: Build local CLI (if needed)
if [ ! -f "$CLI_DIR/dist/index.js" ]; then
    echo -e "${BLUE}[3/4]${NC} Building local CLI..."
    cd "$CLI_DIR"
    bun run build
    echo -e "${GREEN}  ✓ Local CLI built${NC}"
else
    echo -e "${BLUE}[3/4]${NC} Local CLI already built"
    echo -e "${GREEN}  ✓ Skipped (run 'bun run build' manually if needed)${NC}"
fi

# Step 4: Create symlink for oaysus-dev
echo -e "${BLUE}[4/4]${NC} Creating oaysus-dev symlink..."
ln -sf "$CLI_DIR/bin/oaysus.js" "$NPM_BIN/oaysus-dev"
chmod +x "$CLI_DIR/bin/oaysus.js"
echo -e "${GREEN}  ✓ oaysus-dev symlink created${NC}"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Setup Complete!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${YELLOW}oaysus${NC}     → Production (npm registry)"
echo -e "  ${YELLOW}oaysus-dev${NC} → Development (local: $CLI_DIR)"
echo ""
echo -e "  Verify with:"
echo -e "    ${BLUE}oaysus --version${NC}"
echo -e "    ${BLUE}oaysus-dev --version${NC}"
echo ""

# Verify installation
echo -e "${BLUE}Verification:${NC}"
if command -v oaysus &> /dev/null; then
    echo -e "  ${GREEN}✓${NC} oaysus:     $(which oaysus)"
else
    echo -e "  ${RED}✗${NC} oaysus not found in PATH"
fi

if command -v oaysus-dev &> /dev/null; then
    echo -e "  ${GREEN}✓${NC} oaysus-dev: $(which oaysus-dev)"
else
    echo -e "  ${RED}✗${NC} oaysus-dev not found in PATH"
fi

echo ""
