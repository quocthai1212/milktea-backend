const ShippingConfig = require('../../models/ShippingConfig');

/**
 * 1. LẤY DANH SÁCH TẤT CẢ CHI NHÁNH
 * GET /api/quantri/chinhanh/all
 */
exports.getDanhSachChiNhanh = async (req, res) => {
    try {
        const danhSach = await ShippingConfig.find().sort({ createdAt: -1 });
        return res.status(200).json({
            success: true,
            message: "Lấy danh sách chi nhánh thành công!",
            data: danhSach
        });
    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            message: "Lỗi khi lấy danh sách chi nhánh", 
            error: error.message 
        });
    }
};

/**
 * 5. LẤY DANH SÁCH CHI NHÁNH HOẠT ĐỘNG (DÀNH CHO KHÁCH HÀNG CHỌN)
 * GET /api/khachhang/chi-nhanh HOẶC GET /api/khachhang/don-hang/chi-nhanh
 */
exports.getChiNhanhChoKhachHang = async (req, res) => {
    try {
        // Chỉ lấy các chi nhánh đang hoạt động (không bị cấu hình false)
        const danhSach = await ShippingConfig.find({ is_active: { $ne: false } }).sort({ branch_name: 1 });
        return res.status(200).json({
            success: true,
            message: "Lấy danh sách chi nhánh phục vụ thành công!",
            data: danhSach
        });
    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            message: "Lỗi hệ thống khi tải danh sách chi nhánh", 
            error: error.message 
        });
    }
};

/**
 * 2. THÊM CHI NHÁNH MỚI
 * POST /api/quantri/chinhanh/add
 * Body: { branch_name, shop_address, shipping_fee_per_km, max_delivery_km, latitude, longitude }
 */
exports.themMoiChiNhanh = async (req, res) => {
    try {
        // ✅ Đã thêm latitude, longitude vào destructuring từ req.body
        const { branch_name, shop_address, shipping_fee_per_km, max_delivery_km, latitude, longitude } = req.body;

        if (!branch_name || !shop_address) {
            return res.status(400).json({ success: false, message: "Tên chi nhánh và địa chỉ không được để trống!" });
        }

        const nameExists = await ShippingConfig.findOne({ branch_name: branch_name.trim() });
        if (nameExists) {
            return res.status(400).json({ success: false, message: "Tên chi nhánh này đã tồn tại!" });
        }

        const chiNhanhMoi = new ShippingConfig({
            branch_name: branch_name.trim(),
            shop_address: shop_address.trim(),
            shipping_fee_per_km: shipping_fee_per_km !== undefined ? Number(shipping_fee_per_km) : 5000,
            max_delivery_km: max_delivery_km !== undefined ? Number(max_delivery_km) : 20,
            // ✅ Gán giá trị tọa độ lưu vào DB (ép kiểu Number hoặc mặc định là 0)
            latitude: latitude !== undefined ? Number(latitude) : 0,
            longitude: longitude !== undefined ? Number(longitude) : 0
        });

        await chiNhanhMoi.save();
        return res.status(201).json({
            success: true,
            message: "Thêm chi nhánh thành công!",
            data: chiNhanhMoi
        });
    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            message: "Lỗi khi thêm chi nhánh mới", 
            error: error.message 
        });
    }
};

/**
 * 3. SỬA THÔNG TIN CHI NHÁNH
 * PUT /api/quantri/chinhanh/update/:id
 */
exports.capNhatChiNhanh = async (req, res) => {
    try {
        const { id } = req.params;
        // ✅ Đã thêm latitude, longitude hứng từ req.body khi admin bấm Lưu sửa đổi
        const { branch_name, shop_address, shipping_fee_per_km, max_delivery_km, is_active, latitude, longitude } = req.body;

        const updateData = {};
        if (branch_name !== undefined) updateData.branch_name = branch_name.trim();
        if (shop_address !== undefined) updateData.shop_address = shop_address.trim();
        if (shipping_fee_per_km !== undefined) updateData.shipping_fee_per_km = Number(shipping_fee_per_km);
        if (max_delivery_km !== undefined) updateData.max_delivery_km = Number(max_delivery_km);
        if (is_active !== undefined) updateData.is_active = is_active;
        
        // ✅ Kiểm tra và cập nhật tọa độ mới khi chỉnh sửa
        if (latitude !== undefined) updateData.latitude = Number(latitude);
        if (longitude !== undefined) updateData.longitude = Number(longitude);

        const chiNhanhCapNhat = await ShippingConfig.findByIdAndUpdate(id, updateData, { new: true });
        
        if (!chiNhanhCapNhat) {
            return res.status(404).json({ success: false, message: "Không tìm thấy chi nhánh cần sửa!" });
        }

        return res.status(200).json({
            success: true,
            message: "Cập nhật chi nhánh thành công!",
            data: chiNhanhCapNhat
        });
    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            message: "Lỗi khi cập nhật chi nhánh", 
            error: error.message 
        });
    }
};

/**
 * 4. XÓA CHI NHÁNH
 * DELETE /api/quantri/chinhanh/delete/:id
 */
exports.xoaChiNhanh = async (req, res) => {
    try {
        const { id } = req.params;
        const chiNhanhDaXoa = await ShippingConfig.findByIdAndDelete(id);

        if (!chiNhanhDaXoa) {
            return res.status(404).json({ success: false, message: "Chi nhánh này không tồn tại hoặc đã bị xóa!" });
        }

        return res.status(200).json({
            success: true,
            message: "Xóa chi nhánh thành công!"
        });
    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            message: "Lỗi khi xóa chi nhánh", 
            error: error.message 
        });
    }
};