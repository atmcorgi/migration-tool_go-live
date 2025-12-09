#!/bin/bash

# Script để setup Git repo mới cho Directus Migration Tool
# Usage: ./setup-new-repo.sh [github-repo-url]

set -e

echo "🚀 Setting up new Git repository..."
echo ""

# Kiểm tra xem có .git folder không
if [ -d ".git" ]; then
    echo "⚠️  Found existing .git folder"
    read -p "Do you want to remove it and start fresh? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🗑️  Removing existing .git folder..."
        rm -rf .git
        echo "✅ Removed"
    else
        echo "❌ Aborted. Please remove .git manually if needed."
        exit 1
    fi
fi

# Khởi tạo git repo mới
echo ""
echo "📦 Initializing new Git repository..."
git init

# Thêm tất cả files
echo "📝 Adding files..."
git add .

# Commit đầu tiên
echo "💾 Creating initial commit..."
git commit -m "Initial commit: Directus Migration Tool with secure OTP authentication

- Server-side OTP verification via Vercel API routes
- Session management with expiration
- Rate limiting protection
- Production-ready configuration"

echo ""
echo "✅ Git repository initialized successfully!"
echo ""

# Nếu có GitHub URL được cung cấp
if [ -n "$1" ]; then
    echo "🔗 Adding remote repository: $1"
    git remote add origin "$1"
    git branch -M main
    
    echo ""
    read -p "Do you want to push to GitHub now? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "📤 Pushing to GitHub..."
        git push -u origin main
        echo "✅ Pushed successfully!"
    else
        echo "ℹ️  You can push later with: git push -u origin main"
    fi
else
    echo "ℹ️  To connect to GitHub, run:"
    echo "   git remote add origin <your-github-repo-url>"
    echo "   git branch -M main"
    echo "   git push -u origin main"
fi

echo ""
echo "✨ Setup complete!"
echo ""
echo "📚 Next steps:"
echo "   1. Create a new repository on GitHub"
echo "   2. Add remote: git remote add origin <repo-url>"
echo "   3. Push: git push -u origin main"
echo "   4. Deploy to Vercel (see VERCEL_DEPLOYMENT.md)"
echo "   5. Set MIGRATION_SECRET in Vercel Environment Variables"
echo ""

