# 🚀 Quick Start - Tạo Repo Mới và Deploy Vercel

## Bước 1: Tạo Repo Git Mới

### Cách nhanh nhất (dùng script):
```bash
cd /Users/maccutui/Downloads/migration-tool_Dec-08
./setup-new-repo.sh
```

### Hoặc làm thủ công:
```bash
# Xóa git cũ (nếu có)
rm -rf .git

# Tạo repo mới
git init
git add .
git commit -m "Initial commit: Directus Migration Tool"

# Tạo repo trên GitHub, sau đó:
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git
git branch -M main
git push -u origin main
```

## Bước 2: Deploy lên Vercel

1. **Vào [vercel.com](https://vercel.com)** → Sign in với GitHub
2. **Add New Project** → Import repo vừa tạo
3. **Set Environment Variable**:
   - Key: `MIGRATION_SECRET`
   - Value: Secret key của bạn (giữ bí mật!)
4. **Deploy** → Vercel tự động build và deploy

## Bước 3: Generate Code để Test

```bash
# Local (cần set MIGRATION_SECRET)
MIGRATION_SECRET=your-secret npm run generate-code
```

Copy code hiển thị và test trên app Vercel.

## ✅ Checklist

- [ ] Đã xóa `.git` folder cũ
- [ ] Đã tạo repo mới trên GitHub
- [ ] Đã push code lên GitHub
- [ ] Đã deploy lên Vercel
- [ ] Đã set `MIGRATION_SECRET` trên Vercel
- [ ] Đã test generate code và login thành công

## 📝 Lưu ý

- **KHÔNG** commit file `.env` vào git
- Secret chỉ set trên Vercel Environment Variables
- Code OTP thay đổi mỗi 60 giây
- Session hết hạn sau 8 giờ

## 🆘 Troubleshooting

**Lỗi: "MIGRATION_SECRET is not set"**
→ Kiểm tra Environment Variables trên Vercel

**API route không hoạt động**
→ Kiểm tra file `/api/verify-code.ts` có tồn tại không

**Build failed**
→ Chạy `npm install` và `npm run build` local để test
