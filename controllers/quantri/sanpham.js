const Product = require('../../models/Product');
const fs = require('fs');
const path = require('path');

// Hàm bổ trợ: Tự động dọn dẹp các ảnh vừa upload lên nếu dữ liệu đầu vào (Text) bị lỗi validate
const xoaAnhTamThoi = (files) => {
  if (!files) return;
  if (files['avatar']) {
    files['avatar'].forEach(file => { if (fs.existsSync(file.path)) fs.unlinkSync(file.path); });
  }
  if (files['images']) {
    files['images'].forEach(file => { if (fs.existsSync(file.path)) fs.unlinkSync(file.path); });
  }
};

// =========================================================================
// 🔍 1. LẤY DANH SÁCH SẢN PHẨM (Dành cho trang Quản trị)
// =========================================================================
exports.getsanpham = async (req, res) => {
  try {
    const danhSach = await Product.find().populate('category').sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: danhSach });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi không thể lấy danh sách món!", error: error.message });
  }
};

// =========================================================================
// ➕ 2. THÊM SẢN PHẨM MỚI (Lưu ảnh vào ổ cứng & CSDL dựa vào danh mục cha)
// =========================================================================
exports.addsanpham = async (req, res) => {
  try {
    const { product_name, base_price, category, description, is_active, toppings, sizes } = req.body;

    if (!product_name || !base_price || !category) {
      xoaAnhTamThoi(req.files);
      return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ Tên món, Loại và Giá gốc!" });
    }

    const backendRootDir = process.cwd();

    let dbAvatarPath = "";
    if (req.files && req.files['avatar'] && req.files['avatar'].length > 0) {
      dbAvatarPath = req.files['avatar'][0].path.replace(backendRootDir + path.sep, "").replace(/\\/g, "/");
    }

    let dbImagesPaths = [];
    if (req.files && req.files['images'] && req.files['images'].length > 0) {
      dbImagesPaths = req.files['images'].map(file => {
        return file.path.replace(backendRootDir + path.sep, "").replace(/\\/g, "/");
      });
    }

    const sanPhamMoi = new Product({
      product_name: product_name.trim(),
      base_price: Number(base_price),
      avatar: dbAvatarPath,
      images: dbImagesPaths,
      category,
      description: description || "",
      is_active: is_active !== undefined ? (is_active === 'true' || is_active === true) : true,
      toppings: toppings ? (typeof toppings === 'string' ? JSON.parse(toppings) : toppings) : [], 
      sizes: sizes ? (typeof sizes === 'string' ? JSON.parse(sizes) : sizes) : []        
    });

    await sanPhamMoi.save();
    return res.status(201).json({ success: true, message: `Đã thêm món ${product_name} vào menu thành công!`, data: sanPhamMoi });
  } catch (error) {
    xoaAnhTamThoi(req.files);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống không thể thêm món!", error: error.message });
  }
};

// =========================================================================
// ✏️ 3. SỬA THÔNG TIN SẢN PHẨM (XỬ LÝ LỌC XÓA ẢNH CŨ VÀ THÊM ẢNH MỚI)
// =========================================================================
exports.updatesanpham = async (req, res) => {
  try {
    const { id } = req.params;
    const { product_name, base_price, category, description, is_active, toppings, sizes, remain_images } = req.body;

    const sanPham = await Product.findById(id);
    if (!sanPham) {
      xoaAnhTamThoi(req.files);
      return res.status(404).json({ success: false, message: "Không tìm thấy món này!" });
    }

    const backendRootDir = process.cwd();

    // ---------------------------------------------------------------------
    // A. XỬ LÝ SỬA ẢNH ĐẠI DIỆN (AVATAR)
    // ---------------------------------------------------------------------
    if (req.files && req.files['avatar'] && req.files['avatar'].length > 0) {
      if (sanPham.avatar && sanPham.avatar.trim() !== "") {
        const oldAvatarPath = path.join(backendRootDir, sanPham.avatar);
        if (fs.existsSync(oldAvatarPath)) {
          fs.unlinkSync(oldAvatarPath);
          console.log(`✏️ Đã xóa file ảnh đại diện cũ trên máy: ${oldAvatarPath}`);
        }
      }
      sanPham.avatar = req.files['avatar'][0].path.replace(backendRootDir + path.sep, "").replace(/\\/g, "/");
    }

    // ---------------------------------------------------------------------
    // B. 🌟 XỬ LÝ ALBUM ẢNH PHỤ TÍCH LŨY (XÓA ẢNH BỊ LOẠI BỎ & THÊM ẢNH MỚI)
    // ---------------------------------------------------------------------
    let mangAnhCuConLai = [];
    if (remain_images) {
      // Parse mảng ảnh cũ còn lại được Frontend gửi lên dưới dạng JSON string
      mangAnhCuConLai = typeof remain_images === 'string' ? JSON.parse(remain_images) : remain_images;
    }

    // Bước 1: Quét và dọn dẹp các tệp tin vật lý của những ảnh đã bị người dùng bấm 'X' xóa bỏ
    if (sanPham.images && sanPham.images.length > 0) {
      sanPham.images.forEach(oldImagePath => {
        // Nếu ảnh từng tồn tại trong DB nhưng hiện tại không nằm trong danh sách giữ lại -> Xóa file cứng
        if (!mangAnhCuConLai.includes(oldImagePath)) {
          const absoluteOldPath = path.join(backendRootDir, oldImagePath);
          if (fs.existsSync(absoluteOldPath)) {
            fs.unlinkSync(absoluteOldPath);
            console.log(`🗑️ Đã xóa file ảnh phụ bị loại bỏ trên ổ cứng: ${absoluteOldPath}`);
          }
        }
      });
    }

    // Bước 2: Thu thập đường dẫn của các file ảnh phụ MỚI chọn thêm (nếu có)
    let mangAnhPhuMoi = [];
    if (req.files && req.files['images'] && req.files['images'].length > 0) {
      mangAnhPhuMoi = req.files['images'].map(file => {
        return file.path.replace(backendRootDir + path.sep, "").replace(/\\/g, "/");
      });
    }

    // Bước 3: Hợp nhất (Tích lũy) = Ảnh cũ còn lại + Ảnh mới upload thêm vào làm mảng dữ liệu mới cho sản phẩm
    sanPham.images = [...mangAnhCuConLai, ...mangAnhPhuMoi];


    // ---------------------------------------------------------------------
    // C. CẬP NHẬT CÁC THÔNG TIN DẠNG CHỮ KHÁC
    // ---------------------------------------------------------------------
    if (product_name) sanPham.product_name = product_name.trim();
    if (base_price !== undefined) sanPham.base_price = Number(base_price);
    if (category) sanPham.category = category;
    if (description !== undefined) sanPham.description = description;
    if (is_active !== undefined) {
      sanPham.is_active = is_active === 'true' || is_active === true;
    }
    
    if (toppings !== undefined) {
      sanPham.toppings = typeof toppings === 'string' ? JSON.parse(toppings) : toppings;
    }
    if (sizes !== undefined) {
      sanPham.sizes = typeof sizes === 'string' ? JSON.parse(sizes) : sizes;
    }

    await sanPham.save(); // Thực hiện lưu lại toàn bộ thay đổi mới vào MongoDB
    return res.status(200).json({ success: true, message: "Cập nhật thông tin món và hình ảnh thành công!", data: sanPham });
  } catch (error) {
    xoaAnhTamThoi(req.files);
    return res.status(500).json({ success: false, message: "Lỗi không thể cập nhật thông tin món!", error: error.message });
  }
};

// =========================================================================
// 🗑️ 4. XÓA SẢN PHẨM KHỎI MENU (Xóa sạch bách toàn bộ các file ảnh trên ổ cứng)
// =========================================================================
exports.deletesanpham = async (req, res) => {
  try {
    const { id } = req.params;

    const sanPham = await Product.findById(id);
    if (!sanPham) {
      return res.status(404).json({ success: false, message: "Không tìm thấy món để xóa!" });
    }

    const backendRootDir = process.cwd();

    if (sanPham.avatar && sanPham.avatar.trim() !== "") {
      const avatarPath = path.join(backendRootDir, sanPham.avatar);
      if (fs.existsSync(avatarPath)) {
        fs.unlinkSync(avatarPath);
        console.log(`🗑️ Đã xóa file ảnh đại diện thành công tại: ${avatarPath}`);
      }
    }

    if (sanPham.images && sanPham.images.length > 0) {
      sanPham.images.forEach(imagePath => {
        const absoluteImagePath = path.join(backendRootDir, imagePath);
        if (fs.existsSync(absoluteImagePath)) {
          fs.unlinkSync(absoluteImagePath);
          console.log(`🗑️ Đã xóa file ảnh giới thiệu thành công tại: ${absoluteImagePath}`);
        }
      });
    }

    await Product.findByIdAndDelete(id);
    
    return res.status(200).json({ 
      success: true, 
      message: `Đã xóa hoàn toàn món [${sanPham.product_name}] cùng toàn bộ kho hình ảnh vật lý đi kèm!` 
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi hệ thống không thể xóa món!", error: error.message });
  }
};