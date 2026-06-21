const Category = require('../../models/Category'); 
const Product = require('../../models/Product');
const cloudinary = require('cloudinary').v2;

// =========================================================================
// ⚙️ CẤU HÌNH CLOUDINARY
// =========================================================================
cloudinary.config({
  cloud_name: 'dujhb2n60', 
  api_key: '269411484339472',       
  api_secret: 'e18Y7VvIVJCFmlaFDeq0vi5R-3A'  
});

// =========================================================================
// ➕ 1. CHỨC NĂNG: THÊM DANH MỤC & TẠO THƯ MỤC TRÊN CLOUDINARY NGAY LẬP TỨC
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
    const folderName = category_name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d").replace(/Đ/g, "d")
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "")
      .trim()
      .replace(/\s+/g, "-");

    // Đường dẫn gốc của danh mục này trên Cloudinary
    const cloudFolderPath = `milktea/categories/${folderName}`; 

    // 🌟 GỌI CLOUDINARY TẠO THƯ MỤC THEO TÊN DANH MỤC NGAY LẬP TỨC
    try {
      await cloudinary.api.create_folder(cloudFolderPath);
      console.log(`✨ Đã tạo thư mục thành công trên Cloudinary: ${cloudFolderPath}`);
    } catch (cloudError) {
      console.error("Lỗi tạo thư mục danh mục trên Cloudinary:", cloudError.message);
    }

    // Lưu thông tin danh mục mới vào MongoDB
    const danhMucMoi = new Category({
      category_name: category_name.trim(),
      description: description || "",
      is_active: is_active !== undefined ? is_active : true,
      folder_path: cloudFolderPath // Lưu vào DB: "milktea/categories/tra-sua-matcha"
    });

    await danhMucMoi.save();

    return res.status(201).json({
      success: true,
      message: `Đã tạo danh mục và thư mục [${folderName}] thành công trên Cloudinary!`,
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
// 🔍 2. CHỨC NĂNG: LẤY TOÀN BỘ DANH SÁCH DANH MỤC
// =========================================================================
exports.getAllCategories = async (req, res) => {
  try {
    const danhSach = await Category.aggregate([
      {
        $lookup: {
          from: 'products',          
          localField: '_id',         
          foreignField: 'category',  
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
          product_count: { $size: '$cac_san_pham' } 
        }
      },
      {
        $sort: { createdAt: -1 } 
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
// ✏️ 3. CHỨC NĂNG: CẬP NHẬT DANH MỤC & ĐỔI TÊN THƯ MỤC TRÊN CLOUD
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
      
      const trungTen = await Category.findOne({ category_name: nameTrimmed });
      if (trungTen) {
        return res.status(400).json({ success: false, message: "Tên danh mục mới này đã tồn tại!" });
      }

      // Chuẩn hóa tên thư mục MỚI
      const newFolderName = nameTrimmed
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d").replace(/Đ/g, "d")
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, "")
        .trim()
        .replace(/\s+/g, "-");

      const newCloudPath = `milktea/categories/${newFolderName}`;

      // 🌟 TỰ ĐỘNG TẠO TIẾP THƯ MỤC THEO TÊN MỚI TRÊN CLOUDINARY
      try {
        await cloudinary.api.create_folder(newCloudPath);
        console.log(`✏️ Đã tạo thư mục mới trên Cloudinary: ${newCloudPath}`);
      } catch (e) {
        console.log("Thư mục mới đã tồn tại hoặc có lỗi:", e.message);
      }

      danhMuc.category_name = nameTrimmed;
      danhMuc.folder_path = newCloudPath; 
    }

    if (description !== undefined) danhMuc.description = description;
    if (is_active !== undefined) danhMuc.is_active = is_active;

    await danhMuc.save();
    
    return res.status(200).json({
      success: true,
      message: "Cập nhật thông tin danh mục thành công!",
      data: danhMuc
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi không thể cập nhật danh mục!", error: error.message });
  }
};

// =========================================================================
// 🗑️ 4. CHỨC NĂNG: XÓA DANH MỤC & DỌN DẸP SẠCH SẼ THƯ MỤC TRÊN CLOUDINARY
// =========================================================================
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Tìm danh mục trong CSDL
    const danhMuc = await Category.findById(id);
    if (!danhMuc) {
      return res.status(404).json({ success: false, message: "Không tìm thấy danh mục cần xóa!" });
    }

    // 2. Xử lý dọn dẹp toàn bộ dữ liệu & cấu trúc thư mục trên Cloudinary
    if (danhMuc.folder_path) {
      try {
        // Bước A: Xóa sạch toàn bộ file ảnh nằm bên trong (quét sâu qua tiền tố đường dẫn)
        await cloudinary.api.delete_resources_by_prefix(`${danhMuc.folder_path}/`);
        
        // Bước B: Xóa lần lượt các thư mục con rỗng (avatar và album) nếu có phát sinh từ API sản phẩm
        await cloudinary.api.delete_folder(`${danhMuc.folder_path}/avatar`).catch(() => {});
        await cloudinary.api.delete_folder(`${danhMuc.folder_path}/album`).catch(() => {});
        
        // Bước C: Xóa chính thư mục gốc mang tên danh mục đó
        await cloudinary.api.delete_folder(danhMuc.folder_path);
        console.log(`🗑️ Đã xóa sạch cấu trúc thư mục [${danhMuc.folder_path}] trên Cloudinary`);
      } catch (cloudError) {
        console.log("Thông báo dọn dẹp Cloudinary (Bỏ qua nếu thư mục trống):", cloudError.message);
      }
    }

    // 3. Tiến hành xóa bản ghi trong CSDL MongoDB
    await Category.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: `Đã xóa hoàn toàn danh mục [${danhMuc.category_name}] khỏi hệ thống!`
    });

  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: "Lỗi không thể xóa danh mục!", 
      error: error.message 
    });
  }
};