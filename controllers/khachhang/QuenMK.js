const User = require('../../models/User'); 
const bcrypt = require('bcryptjs'); 
const { Resend } = require('resend'); // Sử dụng HTTP API của Resend

// 1. CẤU HÌNH API KEY CỦA RESEND (Đã điền mã key thật của bạn)
const resend = new Resend('re_XyHqMqSf_FGByQFdNPQhYvqs3dPYkSqNv'); 

// Lưu tạm OTP ở bộ nhớ RAM
const otpCache = new Map();

/**
 * @route   POST /api/khachhang/quenmk/gui-otp
 * @desc    Gửi mã OTP 6 số về Email khách hàng bằng HTTP API của Resend
 */
exports.guiMaOTP = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: "Vui lòng nhập email!" });
        }

        // 1. Kiểm tra xem email có tồn tại trong hệ thống không
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: "Email này chưa được đăng ký trong hệ thống!" });
        }

        // 2. Tạo mã OTP ngẫu nhiên 6 chữ số
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expireAt = Date.now() + 3 * 60 * 1000; // Hết hạn sau 3 phút
        
        // Lưu OTP vào cache
        otpCache.set(email, { otp, expireAt });

        // 3. Tiến hành gọi HTTP API gửi mail của Resend (Không lo bị Render chặn cổng)
        const { data, error } = await resend.emails.send({
            // ⚠️ LƯU Ý CHO TÀI KHOẢN FREE:
            // - Dòng 'from' BẮT BUỘC giữ nguyên đuôi <onboarding@resend.dev>
            // - Dòng 'to' (email nhận) phải là CHÍNH EMAIL bạn dùng để đăng ký tài khoản Resend khi test đồ án.
            from: 'MilkTea Paradise <onboarding@resend.dev>', 
            to: email, 
            subject: '👑 [MilkTea Paradise] Mã OTP khôi phục mật khẩu của bạn',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; padding: 20px; border-radius: 10px;">
                    <h2 style="color: #ff6b81; text-align: center;">Khôi Phục Mật Khẩu</h2>
                    <p>Xin chào <strong>${user.full_name}</strong>,</p>
                    <p>Chúng tôi nhận được yêu cầu khôi phục mật khẩu từ bạn. Vui lòng sử dụng mã OTP dưới đây để tiếp tục. Mã này có hiệu lực trong vòng <b>3 phút</b>.</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <span style="font-size: 32px; font-weight: bold; color: #ff6b81; letter-spacing: 5px; background: #fff5f6; padding: 10px 20px; border: 2px dashed #ff6b81; border-radius: 5px;">
                            ${otp}
                        </span>
                    </div>
                    <p style="color: #777; font-size: 13px;">Nếu bạn không yêu cầu hành động này, vui lòng bỏ qua email này.</p>
                    <hr style="border: 0; border-top: 1px solid #eee;">
                    <p style="text-align: center; color: #aaa; font-size: 12px;">© 2026 MilkTea Paradise. All rights reserved.</p>
                </div>
            `
        });

        // Nếu API Resend trả về lỗi (ví dụ sai API key hoặc gửi sai email nhận cho tk free)
        if (error) {
            console.error("Lỗi từ cổng API Resend:", error);
            return res.status(500).json({ success: false, message: "Không thể gửi mail qua tổng đài API!" });
        }

        return res.status(200).json({ 
            success: true, 
            message: "Mã OTP đã được gửi thành công đến email của bạn!" 
        });

    } catch (error) {
        console.error("Lỗi hệ thống gửi OTP:", error);
        return res.status(500).json({ success: false, message: "Có lỗi xảy ra từ phía máy chủ!" });
    }
};

/**
 * @route   POST /api/khachhang/xac-nhan-otp
 * @desc    Xác thực OTP và tiến hành mã hóa, đổi mật khẩu mới (Giữ nguyên)
 */
exports.xacNhanOTPVaDoiMK = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        if (!email || !otp || !newPassword) {
            return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ thông tin!" });
        }

        const cachedData = otpCache.get(email);
        if (!cachedData) {
            return res.status(400).json({ success: false, message: "Mã OTP đã hết hạn hoặc chưa được yêu cầu!" });
        }

        if (Date.now() > cachedData.expireAt) {
            otpCache.delete(email);
            return res.status(400).json({ success: false, message: "Mã OTP đã hết hạn sử dụng!" });
        }

        if (cachedData.otp !== otp) {
            return res.status(400).json({ success: false, message: "Mã OTP không chính xác!" });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: "Không tìm thấy người dùng!" });
        }

        const saltRound = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRound);

        user.password = hashedPassword; 
        await user.save();

        otpCache.delete(email);
        return res.status(200).json({ success: true, message: "Đổi mật khẩu thành công!" });

    } catch (error) {
        console.error("Lỗi xác nhận OTP:", error);
        return res.status(500).json({ success: false, message: "Có lỗi xảy ra từ phía máy chủ!" });
    }
};