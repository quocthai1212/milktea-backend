const Product = require('../../models/Product');
const Category = require('../../models/Category'); // 🌟 IMPORT THÊM MODEL DANH MỤC ĐỂ LẤY ĐƯỜNG DẪN CSDL
const cloudinary = require('cloudinary').v2; 
const fs = require('fs');

// =========================================================================
// ⚙️ CẤU HÌNH CLOUDINARY
// =========================================================================
cloudinary.config({
  cloud_name: 'dujhb2n60', 
  api_key: '269411484339472',       
  api_secret: 'e18Y7VvIVJCFmlaFDeq0vi5R-3A'  
});

// Hàm bổ trợ: Tự động dọn dẹp các file tạm lưu trong thư mục multer (ổ cứng) nếu quá trình xử lý bị lỗi
const xoaAnhTamThoi = (files) => {
  if (!files) return;
  if (files['avatar']) {
    files['avatar'].forEach(file => { if (fs.existsSync(file.path)) fs.unlinkSync(file.path); });
  }
  if (files['images']) {
    files['images'].forEach(file => { if (fs.existsSync(file.path)) fs.unlinkSync(file.path); });
  }
};

// Hàm bổ trợ: Trích xuất chính xác Public ID bao gồm cả cây thư mục lồng nhau từ URL Cloudinary để xóa ảnh
const getPublicIdFromUrl = (url) => {
  if (!url || !url.includes('cloudinary.com')) return null;
  try {
    const parts = url.split('/');
    const uploadIndex = parts.indexOf('upload');
    if (uploadIndex !== -1 && parts.length > uploadIndex + 2) {
      // Bốc toàn bộ cụm phía sau v12345678/ và bỏ đuôi mở rộng file (.png, .jpg)
      const publicIdWithVersion = parts.slice(uploadIndex + 2).join('/');
      return publicIdWithVersion.substring(0, publicIdWithVersion.lastIndexOf('.'));
    }
    return null;
  } catch (error) {
    return null;
  }
};

// =========================================================================
// 🔍 1. LẤY DANH SÁCH SẢN PHẨM (Giữ nguyên)
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
// ➕ 2. THÊM SẢN PHẨM MỚI (Tự động lồng vào đúng thư mục Danh mục trong CSDL)
// =========================================================================
exports.addsanpham = async (req, res) => {
  try {
    const { product_name, base_price, category, description, is_active, toppings, sizes } = req.body;

    if (!product_name || !base_price || !category) {
      xoaAnhTamThoi(req.files);
      return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ Tên món, Loại và Giá gốc!" });
    }

    // 🌟 BƯỚC QUAN TRỌNG: Tìm thông tin danh mục của sản phẩm này trong DB để bốc folder_path gốc
    const danhMucGoc = await Category.findById(category);
    // Nếu tìm thấy trong CSDL thì lấy folder_path gốc (Ví dụ: "milktea/categories/tra-sua"), ngược lại dùng fallback "milktea"
    const rootCategoryFolder = danhMucGoc && danhMucGoc.folder_path ? danhMucGoc.folder_path : 'milktea';

    let dbAvatarPath = "";
    // Đẩy ảnh Avatar vào thư mục: milktea/categories/ten-danh-muc/avatar
    if (req.files && req.files['avatar'] && req.files['avatar'].length > 0) {
      const uploadResult = await cloudinary.uploader.upload(req.files['avatar'][0].path, {
        folder: `${rootCategoryFolder}/avatar` 
      });
      dbAvatarPath = uploadResult.secure_url; 
    }

    let dbImagesPaths = [];
    // Đẩy danh sách ảnh phụ vào thư mục: milktea/categories/ten-danh-muc/album
    if (req.files && req.files['images'] && req.files['images'].length > 0) {
      for (const file of req.files['images']) {
        const uploadResult = await cloudinary.uploader.upload(file.path, {
          folder: `${rootCategoryFolder}/album`
        });
        dbImagesPaths.push(uploadResult.secure_url);
      }
    }

    // Xóa file tạm ở đĩa cứng vật lý
    xoaAnhTamThoi(req.files);

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
    return res.status(201).json({ success: true, message: `Đã thêm món ${product_name} thành công!`, data: sanPhamMoi });
  } catch (error) {
    xoaAnhTamThoi(req.files);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống không thể thêm món!", error: error.message });
  }
};

// =========================================================================
// ✏️ 3. SỬA THÔNG TIN SẢN PHẨM (Tự động nhận diện thư mục mới khi đổi danh mục)
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

    // 🌟 Xác định ID danh mục đích (nếu đổi loại mới thì lấy category mới, còn không giữ nguyên loại cũ)
    const targetCategoryId = category || sanPham.category;
    const danhMucGoc = await Category.findById(targetCategoryId);
    const rootCategoryFolder = danhMucGoc && danhMucGoc.folder_path ? danhMucGoc.folder_path : 'milktea';

    // A. XỬ LÝ SỬA ẢNH ĐẠI DIỆN (AVATAR)
    if (req.files && req.files['avatar'] && req.files['avatar'].length > 0) {
      // Xóa ảnh cũ trên Cloudinary nếu có
      if (sanPham.avatar && sanPham.avatar.startsWith('http')) {
        const publicId = getPublicIdFromUrl(sanPham.avatar);
        if (publicId) await cloudinary.uploader.destroy(publicId);
      }
      // Upload ảnh mới vào đúng thư mục avatar của danh mục hiện tại
      const uploadResult = await cloudinary.uploader.upload(req.files['avatar'][0].path, { 
        folder: `${rootCategoryFolder}/avatar` 
      });
      sanPham.avatar = uploadResult.secure_url;
    }

    // B. XỬ LÝ ALBUM ẢNH PHỤ TÍCH LŨY
    let mangAnhCuConLai = [];
    if (remain_images) {
      mangAnhCuConLai = typeof remain_images === 'string' ? JSON.parse(remain_images) : remain_images;
    }

    // Xóa các ảnh phụ bị Frontend loại bỏ khỏi Cloudinary
    if (sanPham.images && sanPham.images.length > 0) {
      for (const oldImageUrl of sanPham.images) {
        if (!mangAnhCuConLai.includes(oldImageUrl)) {
          const publicId = getPublicIdFromUrl(oldImageUrl);
          if (publicId) await cloudinary.uploader.destroy(publicId);
        }
      }
    }

    // Tải các ảnh phụ MỚI chọn thêm lên thư mục album của danh mục hiện tại
    let mangAnhPhuMoi = [];
    if (req.files && req.files['images'] && req.files['images'].length > 0) {
      for (const file of req.files['images']) {
        const uploadResult = await cloudinary.uploader.upload(file.path, { 
          folder: `${rootCategoryFolder}/album` 
        });
        mangAnhPhuMoi.push(uploadResult.secure_url);
      }
    }

    // Dọn dẹp tệp tạm local trên ổ cứng
    xoaAnhTamThoi(req.files);

    // Hợp nhất mảng ảnh cũ và mới
    sanPham.images = [...mangAnhCuConLai, ...mangAnhPhuMoi];

    // C. CẬP NHẬT CÁC THÔNG TIN KHÁC
    if (product_name) sanPham.product_name = product_name.trim();
    if (base_price !== undefined) sanPham.base_price = Number(base_price);
    if (category) sanPham.category = category;
    if (description !== undefined) sanPham.description = description;
    if (is_active !== undefined) sanPham.is_active = is_active === 'true' || is_active === true;
    
    if (toppings !== undefined) sanPham.toppings = typeof toppings === 'string' ? JSON.parse(toppings) : toppings;
    if (sizes !== undefined) sanPham.sizes = typeof sizes === 'string' ? JSON.parse(sizes) : sizes;

    await sanPham.save();
    return res.status(200).json({ success: true, message: "Cập nhật thông tin món thành công!", data: sanPham });
  } catch (error) {
    xoaAnhTamThoi(req.files);
    return res.status(500).json({ success: false, message: "Lỗi không thể cập nhật thông tin món!", error: error.message });
  }
};

// =========================================================================
// 🗑️ 4. XÓA SẢN PHẨM KHỎI MENU (Dọn sạch ảnh theo URL dựa vào Public ID cụ thể)
// =========================================================================
exports.deletesanpham = async (req, res) => {
  try {
    const { id } = req.params;

    const sanPham = await Product.findById(id);
    if (!sanPham) return res.status(404).json({ success: false, message: "Không tìm thấy món để xóa!" });

    // Xóa ảnh avatar trên Cloudinary
    if (sanPham.avatar && sanPham.avatar.startsWith('http')) {
      const publicId = getPublicIdFromUrl(sanPham.avatar);
      if (publicId) await cloudinary.uploader.destroy(publicId);
    }

    // Xóa các hình ảnh album phụ trên Cloudinary
    if (sanPham.images && sanPham.images.length > 0) {
      for (const imageUrl of sanPham.images) {
        const publicId = getPublicIdFromUrl(imageUrl);
        if (publicId) await cloudinary.uploader.destroy(publicId);
      }
    }

    await Product.findByIdAndDelete(id);
    return res.status(200).json({ success: true, message: `Đã xóa hoàn toàn món [${sanPham.product_name}] khỏi hệ thống!` });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi hệ thống không thể xóa món!", error: error.message });
  }
};