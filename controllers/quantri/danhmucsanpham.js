const Category = require('../../models/Category'); // Khai báo Model Danh mục bạn vừa gửi
const Product = require('../../models/Product');
const fs = require('fs');
const path = require('path');

// =========================================================================
// 1. CHỨC NĂNG: THÊM DANH MỤC & TẠO THƯ MỤC VẬT LÝ Ở BACKEND
// =========================================================================
exports.addCategory = async (req, res) => {
  try {
    const { category_name, description, is_active } = req.body;

    if (!category_name || category_name.trim() === "") {
      return res.status(400).json({ success: false, message: "Tên danh mục không được để trống!" });
    }

    // Kiểm tra danh mục trùng tên trong hệ thống CSDL
    const danhMucTonTai = await Category.findOne({ category_name: category_name.trim() });
    if (danhMucTonTai) {
      return res.status(400).json({ success: false, message: "Danh mục này đã tồn tại trên hệ thống!" });
    }

    // 🌟 CHUẨN HÓA: Biến tên danh mục có dấu thành tên thư mục không dấu, gạch ngang
    // Ví dụ: "Trà Sữa Matcha" -> "tra-sua-matcha"
    const folderName = category_name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d").replace(/Đ/g, "d")
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "")
      .trim()
      .replace(/\s+/g, "-");

    // 2. Định nghĩa đường dẫn tương đối để lưu vào CSDL (Database)
    const relativePath = `uploads/categories/${folderName}`; 

    // 3. Tính toán đường dẫn tuyệt đối để tạo thư mục vật lý trên ổ đĩa D:
    // __dirname hiện tại là: D:\BAOCAO\milktea-backend\controllers\quantri
    // Nhảy ngược 3 cấp (../../..) sẽ về: D:\BAOCAO\milktea-backend
    const backendRootDir = process.cwd(); 
    const targetDirPath = path.join(backendRootDir, relativePath); 

    // Lệnh in kiểm tra ra màn hình Terminal Node để bạn nhìn thấy tận mắt
    console.log("👉 Đường dẫn thực tế thư mục đang tạo:", targetDirPath);
    // 4. Lệnh kiểm tra và tự động tạo thư mục trên ổ cứng máy tính
    if (!fs.existsSync(targetDirPath)) {
    fs.mkdirSync(targetDirPath, { recursive: true });
    }
    // Lưu thông tin danh mục mới vào MongoDB
    const danhMucMoi = new Category({
      category_name: category_name.trim(),
      description: description || "",
      is_active: is_active !== undefined ? is_active : true,
      folder_path: relativePath // Kết quả lưu trong DB: "uploads/categories/tra-sua-matcha"
    });

    await danhMucMoi.save();

    return res.status(201).json({
      success: true,
      message: `Đã tạo danh mục và thư mục vật lý thành công tại: ${relativePath}`,
      data: danhMucMoi
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống không thể tạo danh mục!",
      error: error.message
    });
  }
};

// =========================================================================
// 2. CHỨC NĂNG: LẤY TOÀN BỘ DANH SÁCH DANH MỤC
// =========================================================================
exports.getAllCategories = async (req, res) => {
    try {
      const danhSach = await Category.aggregate([
        {
          $lookup: {
            from: 'products',          // Tên collection trong MongoDB (Mongoose tự động đặt số nhiều viết thường)
            localField: '_id',         // ID của danh mục (_id trong bảng Category)
            foreignField: 'category',  // 🌟 ĐÃ ĐỔI: Khớp với trường 'category' trong file code Product của bạn
            as: 'cac_san_pham'
          }
        },
        {
          $project: {
            category_name: 1,
            description: 1,
            is_active: 1,
            folder_path: 1,
            createdAt: 1,
            // Đếm tổng số lượng phần tử có trong mảng sản phẩm lọc được
            product_count: { $size: '$cac_san_pham' } 
          }
        },
        {
          $sort: { createdAt: -1 } // Mới nhất xếp lên đầu
        }
      ]);
  
      return res.status(200).json({
        success: true,
        data: danhSach
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Lỗi hệ thống không thể tính toán số lượng sản phẩm danh mục!",
        error: error.message
      });
    }
  };

// =========================================================================
// 3. CHỨC NĂNG: CẬP NHẬT DANH MỤC (KHÔNG ĐỔI ĐƯỜNG DẪN THƯ MỤC CŨ)
// =========================================================================
// =========================================================================
// 3. CHỨC NĂNG: CẬP NHẬT DANH MỤC & ĐỔI TÊN THƯ MỤC VẬT LÝ TƯƠNG ỨNG
// =========================================================================
exports.updateCategory = async (req, res) => {
    try {
      const { id } = req.params;
      const { category_name, description, is_active } = req.body;
  
      const danhMuc = await Category.findById(id);
      if (!danhMuc) {
        return res.status(404).json({ success: false, message: "Không tìm thấy danh mục này!" });
      }
  
      // Kiểm tra xem người dùng có thay đổi tên danh mục hay không
      if (category_name && category_name.trim() !== danhMuc.category_name) {
        const nameTrimmed = category_name.trim();
        
        // 1. Kiểm tra xem tên mới có bị trùng với danh mục khác trong DB không
        const trungTen = await Category.findOne({ category_name: nameTrimmed });
        if (trungTen) {
          return res.status(400).json({ success: false, message: "Tên danh mục mới này đã tồn tại!" });
        }
  
        // 2. Chuẩn hóa tên thư mục MỚI từ tên danh mục mới
        const newFolderName = nameTrimmed
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/đ/g, "d").replace(/Đ/g, "d")
          .toLowerCase()
          .replace(/[^a-z0-9 ]/g, "")
          .trim()
          .replace(/\s+/g, "-");
  
        const newRelativePath = `uploads/categories/${newFolderName}`;
        const backendRootDir = process.cwd();
  
        // 3. XỬ LÝ ĐỔI TÊN THƯ MỤC TRÊN Ổ CỨNG
        if (danhMuc.folder_path) {
          const oldDirPath = path.join(backendRootDir, danhMuc.folder_path);
          const newDirPath = path.join(backendRootDir, newRelativePath);
  
          // Nếu thư mục cũ THỰC SỰ TỒN TẠI trên ổ đĩa và tên thư mục mới khác tên cũ
          if (fs.existsSync(oldDirPath) && oldDirPath !== newDirPath) {
            fs.renameSync(oldDirPath, newDirPath);
            console.log(`✏️ Đã đổi tên thư mục vật lý từ [${danhMuc.folder_path}] thành [${newRelativePath}]`);
          } else if (!fs.existsSync(oldDirPath)) {
            // Trường hợp hi hữu: DB có đường dẫn nhưng ổ cứng chưa có thư mục (do trước đó lỗi), ta tự tạo mới luôn
            fs.mkdirSync(newDirPath, { recursive: true });
          }
        }
  
        // 4. Cập nhật thông tin mới vào đối tượng danh mục
        danhMuc.category_name = nameTrimmed;
        danhMuc.folder_path = newRelativePath; // Cập nhật đường dẫn mới vào DB
      }
  
      // Cập nhật các trường thông tin khác nếu có truyền lên
      if (description !== undefined) danhMuc.description = description;
      if (is_active !== undefined) danhMuc.is_active = is_active;
  
      // Lưu mọi thay đổi vào MongoDB
      await danhMuc.save();
      
      return res.status(200).json({
        success: true,
        message: "Cập nhật thông tin danh mục và thư mục vật lý thành công!",
        data: danhMuc
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: "Lỗi không thể cập nhật danh mục!", error: error.message });
    }
  };
// =========================================================================
// 4. CHỨC NĂNG: XÓA DANH MỤC KHỎI HỆ THỐNG
// =========================================================================
// =========================================================================
// 4. CHỨC NĂNG: XÓA DANH MỤC KHỎI HỆ THỐNG & XÓA THƯ MỤC VẬT LÝ
// =========================================================================
exports.deleteCategory = async (req, res) => {
    try {
      const { id } = req.params;
  
      // 1. Tìm danh mục trong CSDL trước để lấy được trường 'folder_path'
      const danhMuc = await Category.findById(id);
      if (!danhMuc) {
        return res.status(404).json({ success: false, message: "Không tìm thấy danh mục cần xóa!" });
      }
  
      // 2. Tiến hành xóa thư mục vật lý ngoài đời thực (nếu có lưu folder_path)
      if (danhMuc.folder_path) {
        const backendRootDir = process.cwd(); // Lấy đường dẫn gốc của dự án
        const targetDirPath = path.join(backendRootDir, danhMuc.folder_path);
  
        // Kiểm tra xem thư mục đó thực sự có tồn tại trên ổ đĩa không
        if (fs.existsSync(targetDirPath)) {
          // Lệnh xóa thư mục kèm theo tất cả các file/thư mục con bên trong nó (áp dụng cho Node.js 14.14.0+)
          fs.rmSync(targetDirPath, { recursive: true, force: true });
          console.log(`🗑️ Đã xóa thư mục vật lý tại: ${targetDirPath}`);
        }
      }
  
      // 3. Sau khi xóa thư mục xong, tiến hành xóa bản ghi trong CSDL MongoDB
      await Category.findByIdAndDelete(id);
  
      return res.status(200).json({
        success: true,
        message: `Đã xóa hoàn toàn danh mục [${danhMuc.category_name}] và thư mục hình ảnh đi kèm!`
      });
  
    } catch (error) {
      return res.status(500).json({ 
        success: false, 
        message: "Lỗi không thể xóa danh mục và thư mục vật lý!", 
        error: error.message 
      });
    }
  };