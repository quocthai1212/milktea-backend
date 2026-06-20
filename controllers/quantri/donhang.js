// Nạp các Model chuẩn 100% theo tên file và cấu trúc của bạn
const Order = require('../../models/Order'); 
const User = require('../../models/User'); 
const Payment = require('../../models/Payment');
const ShippingConfig = require('../../models/ShippingConfig'); // Đảm bảo đã nạp model Chi nhánh này
async function ganThongTinThanhToanPayOS(donHangs) {
    const list = Array.isArray(donHangs) ? donHangs : [donHangs];
    const orderIds = list
        .filter((don) => don?.payment_method === 'PAYOS' && don?.payment_status === 'PAID')
        .map((don) => don._id);

    if (!orderIds.length) return donHangs;

    const payments = await Payment.find({ order_id: { $in: orderIds }, status: 'PAID' })
        .select('order_id order_code amount payment_link_id paid_at status method bank_account_name bank_account_number bank_description bank_amount_paid bank_reference raw_webhook_data')
        .lean();
        
    const paymentMap = new Map(payments.map((payment) => [String(payment.order_id), payment]));

    list.forEach((don) => {
        const payment = paymentMap.get(String(don._id));
        if (payment) {
            // 1. Lấy nội dung gốc từ ngân hàng
            let rawDesc = payment.bank_description || payment.raw_webhook_data?.description || "";
            let cleanDesc = rawDesc; 

            if (rawDesc) {
                // 🔍 REGEX MỚI: Tìm cụm chữ_số viết hoa (Mã GD) đứng trước cụm MilkTea+số
                // Khớp chính xác dạng: "CSABD0PGMB2 MilkTea734868"
                const regex = /([A-Z0-BA-Z0-9]{6,})\s+(MilkTea\d+)/i;
                const matchMatch = rawDesc.match(regex);
                
                if (matchMatch) {
                    // matchMatch[0] sẽ lấy trọn vẹn cả "Mã GD + MilkTeaXXXXXX"
                    cleanDesc = matchMatch[0]; 
                } else {
                    // Phương án dự phòng 2: Nếu không thấy mã GD, cố gắng lấy riêng chữ MilkTea
                    const fallbackMatch = rawDesc.match(/MilkTea\d+/i);
                    if (fallbackMatch) cleanDesc = fallbackMatch[0];
                }
            } else if (payment.order_code) {
                cleanDesc = `MilkTea${payment.order_code}`;
            }

            // Gán dữ liệu sạch ra trường hiển thị
            payment.display_description = cleanDesc; 
            payment.raw_description = rawDesc; // Vẫn giữ lại chuỗi gốc để rê chuột xem nếu cần

            don.payment_info = payment;
        }
    });

    return donHangs;
}

const donHangController = {
    
    // 1. 🔍 Lấy và lọc danh sách tất cả đơn hàng (Hỗ trợ lọc theo Chi nhánh)
    getDonHang: async (req, res) => {
        try {
            // 🌟 THÊM: branch_id lấy từ Query của Frontend gửi lên
            const { status, payment_method, branch_id } = req.query;
            let filter = {};

            if (status && status !== 'all') {
                filter.status = status;
            }
            if (payment_method && payment_method !== 'all') {
                filter.payment_method = payment_method;
            }
            // 🌟 THÊM: Logic lọc theo chi nhánh cụ thể
            if (branch_id && branch_id !== 'all') {
                filter.branch_id = branch_id;
            }

            const danhSachDonHang = await Order.find(filter)
                .populate('customer_id', 'full_name phone email') 
                .populate('shipper_id', 'full_name phone')
                .populate('staff_id', 'full_name')
                .populate('branch_id', 'branch_name shop_address') // 🌟 THÊM: Nạp thông tin chi nhánh (Tên & Địa chỉ)
                .sort({ createdAt: -1 })
                .lean();

            await ganThongTinThanhToanPayOS(danhSachDonHang);

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

    // 2. 👁️ Xem chi tiết một đơn hàng cụ thể theo ID (Bổ sung thông tin chi nhánh)
    getChiTietDonHang: async (req, res) => {
        try {
            const { id } = req.params;

            const donHang = await Order.findById(id)
                .populate('customer_id')
                .populate('shipper_id')
                .populate('staff_id')
                .populate('promotion_code')
                .populate('branch_id', 'branch_name shop_address shipping_fee_per_km') // 🌟 THÊM: Chi tiết chi nhánh
                .lean();

            if (!donHang) {
                return res.status(404).json({
                    success: false,
                    message: "Không tìm thấy đơn hàng yêu cầu"
                });
            }

            await ganThongTinThanhToanPayOS(donHang);

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

    // 3. ⚙️ Điều phối trạng thái đơn hàng & Chuyển đổi trạng thái nhanh
    updateTrangThaiDonHang: async (req, res) => {
        try {
            const { id } = req.params;
            const { status, shipper_id, cancel_reason, staff_id, branch_id } = req.body; // Thêm tiếp nhận branch_id nếu cần chuyển chi nhánh thủ công

            // 1. Kiểm tra đơn hàng tồn tại
            const donHangCheck = await Order.findById(id);
            if (!donHangCheck) {
                return res.status(404).json({
                    success: false,
                    message: "Không tìm thấy đơn hàng để cập nhật"
                });
            }

            // 2. Xây dựng Object chứa các trường cập nhật thông thường ($set)
            let fieldsToSet = {};
            let ghiChuLichSu = ""; 
            
            if (status) {
                fieldsToSet.status = status;
                
                switch (status) {
                    case 'preparing':
                        ghiChuLichSu = "Đơn hàng đã được xác nhận và chuyển xuống bộ phận pha chế.";
                        break;
                    case 'ready':
                        ghiChuLichSu = "Sản phẩm đã chuẩn bị xong, đóng gói hoàn tất và chờ tài xế đến lấy.";
                        break;
                    case 'shipping':
                        ghiChuLichSu = "Đơn hàng đã được bàn giao cho tài xế và đang trên đường giao đến bạn.";
                        break;
                    case 'completed':
                        ghiChuLichSu = donHangCheck.status === 'shipping' 
                            ? "Tài xế báo cáo đã giao hàng hoàn tất. Khách hàng nhận hàng thành công."
                            : "Admin/Điều phối viên ép trạng thái hoàn thành đơn hàng.";
                        
                        fieldsToSet.payment_status = 'PAID'; 
                        break;
                    case 'failed':
                        ghiChuLichSu = `Giao hàng không thành công. Lý do: ${cancel_reason || "Khách không nghe máy / Hoàn hàng"}`;
                        fieldsToSet.payment_status = 'FAILED';
                        break;
                    case 'cancelled':
                        ghiChuLichSu = `Đơn hàng đã bị hủy bỏ. Lý do: ${cancel_reason || "Khách yêu cầu hủy hoặc cửa hàng hết nguyên liệu"}`;
                        fieldsToSet.payment_status = 'CANCELLED';
                        break;
                    default:
                        ghiChuLichSu = `Chuyển trạng thái đơn sang [${status}].`;
                }
            }

            if (shipper_id) fieldsToSet.shipper_id = shipper_id;
            if (staff_id) fieldsToSet.staff_id = staff_id;
            if (branch_id) fieldsToSet.branch_id = branch_id; // Cho phép đổi chi nhánh xử lý nếu cần

            if (status === 'failed' || status === 'cancelled') {
                fieldsToSet.cancel_reason = cancel_reason || "Hủy theo yêu cầu điều phối.";
            }

            // 3. Chuẩn bị Object lệnh tổng hợp gửi cho MongoDB
            let updatePayload = { $set: fieldsToSet };

            // 4. Cấu trúc mảng lịch sử (status_history) thời gian thực
            if (status) {
                const lichSuMoi = {
                    status: status,
                    updated_at: new Date(),
                    reason: cancel_reason || ghiChuLichSu,
                    updated_by: staff_id || null // Ghi nhận nhân viên/admin đổi trạng thái
                };
                
                updatePayload.$push = { status_history: lichSuMoi };
            }

            // 5. Thực thi cập nhật dữ liệu với Payload tách lớp an toàn
            const STATUS_VI = {
                'pending': 'Chờ duyệt',
                'preparing': 'Đang pha chế',
                'ready': 'Đã pha chế xong (Chờ giao)',
                'shipping': 'Đang giao hàng',
                'completed': 'Giao hàng thành công',
                'failed': 'Giao hàng thất bại (Khách BOM)',
                'cancelled': 'Đã hủy đơn'
            };
            
            const donHangCapNhat = await Order.findByIdAndUpdate(
                id,
                updatePayload,
                { new: true }
            ).populate('customer_id').populate('shipper_id').populate('staff_id').populate('branch_id'); // Thêm populate ở đây
            
            const statusTiengViet = STATUS_VI[status] || status.toUpperCase();
            
            return res.status(200).json({
                success: true,
                message: `Chuyển trạng thái đơn hàng sang [${statusTiengViet}] thành công!`,
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
                .populate('branch_id', 'branch_name shop_address') // 🌟 THÊM: In ra biên lai thì cần có tên + địa chỉ chi nhánh bán hàng
                .select('items total_amount products_subtotal discount_amount shipping_fee payment_method shipping_address branch_id createdAt status');

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