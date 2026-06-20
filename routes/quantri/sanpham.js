const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Import model Danh mục để tra cứu tên thư mục cha dựa trên ID sản phẩm thuộc về
const Category = require('../../models/Category'); 
// Import file controller xử lý nghiệp vụ sản phẩm
const sanphamController = require('../../controllers/quantri/sanpham');

// =========================================================================
// ⚙️ CẤU HÌNH MULTER: TỰ ĐỘNG PHÂN LOẠI FILE ẢNH VÀO THƯ MỤC DANH MỤC CHA
// =========================================================================
const storage = multer.diskStorage({
  // 1. Định vị thư mục lưu ảnh vật lý trên ổ đĩa
  destination: async (req, file, cb) => {
    try {
      // Frontend gửi FormData lên, trường ID danh mục 'category' phải nằm TRƯỚC các trường file ảnh
      const { category } = req.body; 

      // Thư mục dự phòng trong trường hợp hi hữu không tìm thấy danh mục cha
      let relativePath = 'uploads/categories/khac'; 

      if (category) {
        // Tìm bản ghi danh mục trong MongoDB dựa vào ID gửi lên
        const danhMucCha = await Category.findById(category);
        
        // Nếu tìm thấy danh mục và danh mục đó có cấu trúc đường dẫn (VD: uploads/categories/tra-sua)
        if (danhMucCha && danhMucCha.folder_path) {
          relativePath = danhMucCha.folder_path;
        }
      }

      // Tạo đường dẫn tuyệt đối dẫn đến thư mục cha trên ổ cứng (D:\BAOCAO\milktea-backend\uploads\categories\...)
      const targetPath = path.join(process.cwd(), relativePath);

      // Nếu thư mục vật lý này chưa tồn tại ngoài đời thực (do vô tình bị xóa), hệ thống tự tạo lại
      if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
      }

      // Trả kết quả đường dẫn chuẩn cho Multer thực hiện ghi file
      cb(null, targetPath);
    } catch (error) {
      cb(error, null);
    }
  },

  // 2. Định nghĩa quy tắc đặt tên file ảnh để không bao giờ bị trùng lặp
  filename: (req, file, cb) => {
    // Sinh chuỗi ngẫu nhiên bằng Timestamp thời gian thực
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // Lấy đuôi mở rộng của ảnh gốc (VD: .jpg, .png)
    const ext = path.extname(file.originalname);
    
    // Đặt tiền tố (prefix) dựa trên trường gửi lên để phân biệt ảnh đại diện và ảnh giới thiệu phụ
    const prefix = file.fieldname === 'avatar' ? 'avatar' : 'thumb';
    
    // Chuẩn hóa xóa bỏ ký tự đặc biệt trong tên file gốc nếu có
    const originalNameClean = path.basename(file.originalname, ext)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-');
    
    // Kết quả tên file lưu trên máy: VD "avatar-matcha-tran-chau-17189234.jpg"
    cb(null, `${prefix}-${originalNameClean}-${uniqueSuffix}${ext}`);
  }
});

// Giới hạn cấu hình cho bộ upload
const upload = multer({ storage: storage });

// =========================================================================
// 🚀 ĐỊNH NGHĨA CÁC ROUTE API SẢN PHẨM
// =========================================================================

// 🔍 Lấy danh sách sản phẩm
router.get('/all', sanphamController.getsanpham);

// ➕ Thêm sản phẩm mới 
// Đón nhận đồng thời: 1 file từ trường 'avatar' và tối đa 10 files từ trường 'images'
router.post('/add', upload.fields([
  { name: 'avatar', maxCount: 1 },  // Nhận 1 file duy nhất làm ảnh đại diện chính
  { name: 'images', maxCount: 10 }  // Nhận tối đa 10 files làm album ảnh giới thiệu phụ
]), sanphamController.addsanpham);

// ✏️ Chỉnh sửa thông tin sản phẩm (Cũng kiểm tra cấu hình đổi ảnh và dọn file cũ)
router.put('/update/:id', upload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'images', maxCount: 10 }
]), sanphamController.updatesanpham);

// 🗑️ Xóa hoàn toàn sản phẩm (Quét dọn xóa sạch các tệp ảnh đi kèm trên máy)
router.delete('/delete/:id', sanphamController.deletesanpham);

module.exports = router;