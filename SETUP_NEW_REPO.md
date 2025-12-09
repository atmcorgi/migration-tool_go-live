# Hướng dẫn tạo Git Repo mới và Deploy lên Vercel

## Bước 1: Xóa Git history cũ (nếu có)

Nếu folder hiện tại đang có git history từ repo cũ, bạn cần xóa nó:

```bash
cd /Users/maccutui/Downloads/migration-tool_Dec-08

# Xóa folder .git cũ (nếu có)
rm -rf .git

# Hoặc nếu muốn giữ lại nhưng tạo branch mới
# git checkout --orphan new-main
# git rm -rf .
```

## Bước 2: Tạo Git Repo mới

### Option A: Tạo repo trên GitHub/GitLab/Bitbucket trước

1. **Tạo repo mới trên GitHub:**
   - Vào GitHub → New Repository
   - Đặt tên: `directus-migration-tool` (hoặc tên bạn muốn)
   - **KHÔNG** tích "Initialize with README"
   - Copy URL repo (ví dụ: `https://github.com/your-username/directus-migration-tool.git`)

2. **Khởi tạo Git local và push:**

```bash
cd /Users/maccutui/Downloads/migration-tool_Dec-08

# Khởi tạo git repo mới
git init

# Thêm tất cả files (trừ những file trong .gitignore)
git add .

# Commit lần đầu
git commit -m "Initial commit: Directus Migration Tool with secure OTP authentication"

# Thêm remote (thay YOUR_USERNAME và REPO_NAME)
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git

# Đổi tên branch thành main (nếu cần)
git branch -M main

# Push lên GitHub
git push -u origin main
```

### Option B: Tạo repo local trước, sau đó push lên GitHub

```bash
cd /Users/maccutui/Downloads/migration-tool_Dec-08

# Khởi tạo git repo
git init

# Thêm files
git add .

# Commit
git commit -m "Initial commit: Directus Migration Tool"

# Sau đó tạo repo trên GitHub và push như Option A
```

## Bước 3: Kiểm tra các file nhạy cảm

Đảm bảo các file sau **KHÔNG** được commit:

- ✅ `.env` - đã có trong .gitignore
- ✅ `.env.local` - đã có trong .gitignore  
- ✅ `node_modules/` - đã có trong .gitignore
- ✅ `dist/` - đã có trong .gitignore

**LƯU Ý QUAN TRỌNG:**
- **KHÔNG BAO GIỜ** commit file `.env` có chứa `MIGRATION_SECRET`
- Secret chỉ set trên Vercel Environment Variables

## Bước 4: Tạo file .env.example (optional)

Tạo file `.env.example` để hướng dẫn người khác:

```bash
# .env.example
# Copy file này thành .env và điền giá trị thực tế
# KHÔNG commit file .env vào git!

# Migration Secret - dùng để generate OTP code
# Set trên Vercel Environment Variables với key: MIGRATION_SECRET
MIGRATION_SECRET=your-secret-key-here
```

## Bước 5: Deploy lên Vercel

### 5.1. Kết nối Vercel với GitHub

1. Vào [vercel.com](https://vercel.com)
2. Sign in với GitHub
3. Click "Add New Project"
4. Import repo vừa tạo
5. Vercel sẽ tự detect Vite project

### 5.2. Cấu hình Environment Variables

1. Trong Vercel project settings → Environment Variables
2. Thêm biến:
   - **Key**: `MIGRATION_SECRET`
   - **Value**: Secret key của bạn (giữ bí mật!)
   - **Environment**: Production, Preview, Development

### 5.3. Deploy

Vercel sẽ tự động:
- Build project (`npm run build`)
- Deploy API routes trong folder `/api`
- Deploy static files từ `/dist`

## Bước 6: Test sau khi deploy

1. **Test API route:**
```bash
curl -X POST https://your-app.vercel.app/api/verify-code \
  -H "Content-Type: application/json" \
  -d '{"code":"1234"}'
```

2. **Generate code để test:**
```bash
# Local (cần set MIGRATION_SECRET)
MIGRATION_SECRET=your-secret npm run generate-code
```

3. **Test trên browser:**
   - Mở `https://your-app.vercel.app`
   - Nhập code vừa generate
   - Kiểm tra login thành công

## Checklist trước khi commit

- [ ] Đã xóa `.git` folder cũ (nếu có)
- [ ] Đã kiểm tra `.gitignore` đầy đủ
- [ ] Không có file `.env` trong git
- [ ] Không có `node_modules/` trong git
- [ ] Không có `dist/` trong git
- [ ] Đã test code hoạt động local
- [ ] Đã đọc `VERCEL_DEPLOYMENT.md`

## Troubleshooting

### Lỗi: "MIGRATION_SECRET is not set"
- Kiểm tra Environment Variables trên Vercel
- Đảm bảo key đúng: `MIGRATION_SECRET` (không có prefix `VITE_`)

### Lỗi: API route không hoạt động
- Kiểm tra `vercel.json` có đúng cấu hình không
- Kiểm tra file `/api/verify-code.ts` có tồn tại không
- Xem logs trên Vercel Dashboard

### Lỗi: Build failed
- Kiểm tra `package.json` có đầy đủ dependencies không
- Chạy `npm install` local để test
- Xem build logs trên Vercel

