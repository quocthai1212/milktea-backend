// Nạp các Model chuẩn 100% theo tên file và cấu trúc của bạn
const Order = require('../../models/Order'); 
const User = require('../../models/User'); 

const donHangController = {
    
    // 1. 🔍 Lấy và lọc danh sách tất cả đơn hàng (Đổ ra bảng quản trị)
    getDonHang: async (req, res) => {
        try {
            const { status, payment_method } = req.query;
            let filter = {};

            // Bộ lọc trạng thái đơn hàng
            if (status && status !== 'all') {
                filter.status = status;
            }
            // Bộ lọc phương thức thanh toán (Khớp enum: 'QR_CODE', 'CASH', 'PAYOS')
            if (payment_method && payment_method !== 'all') {
                filter.payment_method = payment_method;
            }

            // Lấy danh sách, populate thông tin định danh từ bảng User
            const danhSachDonHang = await Order.find(filter)
                .populate('customer_id', 'full_name phone email') 
                .populate('shipper_id', 'full_name phone')
                .populate('staff_id', 'full_name')
                .sort({ createdAt: -1 }); // Đơn mới nhất lên đầu

            return res.status(200).json({
                success: true,
                message: "Lấy danh sách đơn hàng thành công",
                data: danhSachDonHang
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: "Lỗi máy chủ khi lấy danh sách đơn hàng",
                error: error.message
            });
        }
    },

    // 2. 👁️ Xem chi tiết một đơn hàng cụ thể theo ID
    getChiTietDonHang: async (req, res) => {
        try {
            const { id } = req.params;

            const donHang = await Order.findById(id)
                .populate('customer_id')
                .populate('shipper_id')
                .populate('staff_id')
                .populate('promotion_code');

            if (!donHang) {
                return res.status(404).json({
                    success: false,
                    message: "Không tìm thấy đơn hàng yêu cầu"
                });
            }

            return res.status(200).json({
                success: true,
                message: "Lấy chi tiết đơn hàng thành công",
                data: donHang
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: "Lỗi hệ thống khi lấy chi tiết đơn hàng",
                error: error.message
            });
        }
    },

    // 3. ⚙️ Điều phối trạng thái đơn hàng & Gán Shipper (Cập nhật lịch sử status_history)
    updateTrangThaiDonHang: async (req, res) => {
        try {
            const { id } = req.params;
            const { status, shipper_id, cancel_reason, staff_id } = req.body;

            // 1. Kiểm tra đơn hàng tồn tại
            const donHangCheck = await Order.findById(id);
            if (!donHangCheck) {
                return res.status(404).json({
                    success: false,
                    message: "Không tìm thấy đơn hàng để cập nhật"
                });
            }

            // 2. Xây dựng Object dữ liệu cập nhật
            let updateData = {};
            
            // Nếu có cập nhật trạng thái (Khớp enum: 'pending', 'preparing', 'shipping', 'completed', 'failed', 'cancelled')
            if (status) {
                updateData.status = status;
                
                // Đồng bộ cập nhật trạng thái thanh toán tự động nếu đơn thành công hoặc bị hủy
                if (status === 'completed') {
                    updateData.payment_status = 'PAID';
                } else if (status === 'cancelled' || status === 'failed') {
                    updateData.payment_status = 'CANCELLED';
                }
            }

            // Nếu chỉ định shipper
            if (shipper_id) {
                updateData.shipper_id = shipper_id;
            }

            // Nếu có nhân viên xử lý tại quầy hoặc duyệt đơn
            if (staff_id) {
                updateData.staff_id = staff_id;
            }

            // Nếu rơi vào trạng thái hủy hoặc thất bại (Bom hàng)
            if (status === 'failed' || status === 'cancelled') {
                updateData.cancel_reason = cancel_reason || "Hủy đơn hàng theo yêu cầu hệ thống/khách hàng";
            }

            // 3. 🔄 ĐẨY LỊCH SỬ VÀO `status_history` (Theo đúng cấu trúc Schema phụ của bạn)
            if (status) {
                const lichSuMoi = {
                    status: status,
                    updated_at: new Date(),
                    reason: cancel_reason || (shipper_id ? "Gán tài xế vận chuyển" : "Cập nhật tiến độ đơn hàng")
                };
                
                // Sử dụng toán tử $push để nạp thêm một dòng vào mảng lịch sử của Mongoose
                updateData.$push = { status_history: lichSuMoi };
            }

            // 4. Thực thi cập nhật dữ liệu
            // Lưu ý: Nếu dùng `$push`, ta tách lệnh ra hoặc gộp trực tiếp vào findByIdAndUpdate
            const donHangCapNhat = await Order.findByIdAndUpdate(
                id,
                updateData,
                { new: true }
            ).populate('customer_id').populate('shipper_id');

            return res.status(200).json({
                success: true,
                message: `Cập nhật đơn hàng thành công! Trạng thái hiện tại: [${status || donHangCheck.status}]`,
                data: donHangCapNhat
            });

        } catch (error) {
            return res.status(500).json({
                success: false,
                message: "Lỗi máy chủ khi cập nhật đơn hàng",
                error: error.message
            });
        }
    },

    // 4. 🖨️ Trích xuất dữ liệu phục vụ việc in biên lai hóa đơn nhanh
    getDuLieuInDonHang: async (req, res) => {
        try {
            const { id } = req.params;

            const donHangIn = await Order.findById(id)
                .populate('customer_id', 'full_name phone')
                .select('items total_amount products_subtotal discount_amount shipping_fee payment_method shipping_address createdAt status');

            if (!donHangIn) {
                return res.status(404).json({
                    success: false,
                    message: "Không tìm thấy dữ liệu hóa đơn"
                });
            }

            return res.status(200).json({
                success: true,
                message: "Trích xuất dữ liệu in thành công",
                data: donHangIn
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: "Lỗi hệ thống khi lấy dữ liệu in",
                error: error.message
            });
        }
    }
};

module.exports = donHangController;