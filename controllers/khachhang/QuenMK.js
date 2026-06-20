const User = require('../../models/User'); 
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs'); // 👈 THÊM: Import thư viện bcrypt để mã hóa

// Lưu tạm OTP ở bộ nhớ RAM
const otpCache = new Map();

// 1. CẤU HÌNH TRANPORTER ĐỂ GỬI MAIL (Dùng Gmail sinh viên VLUTE)
// 🎯 ĐỔI ĐOẠN NÀY TRONG FILE CONTROLLER LÀ XONG LUÔN:
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, 
    localAddress: '0.0.0.0', // 🔥 Dòng này cứu mạng Server khỏi lỗi sập mạng IPv6 trên Render
    auth: {
        user: '22004285@st.vlute.edu.vn', 
        pass: 'anis tvqd xana zpsz'       
    },
    tls: {
        rejectUnauthorized: false 
    }
});
/**
 * @route   POST /api/khachhang/quen-mat-khau
 * @desc    Gửi mã OTP 6 số về Email khách hàng
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
        
        // Đặt thời gian hết hạn cho OTP (3 phút)
        const expireAt = Date.now() + 3 * 60 * 1000; 
        
        // Lưu OTP vào cache
        otpCache.set(email, { otp, expireAt });

        // 3. Cấu hình nội dung Email gửi cho khách
        const mailOptions = {
            from: '"MilkTea Paradise" <22004285@st.vlute.edu.vn>', // 👈 Thay đổi đồng bộ với email gửi của bạn
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
                    <p style="color: #777; font-size: 13px;">Nếu bạn không yêu cầu hành động này, vui lòng bỏ qua email này hoặc liên hệ hỗ trợ nếu thấy có dấu hiệu bất thường.</p>
                    <hr style="border: 0; border-top: 1px solid #eee;">
                    <p style="text-align: center; color: #aaa; font-size: 12px;">© 2026 MilkTea Paradise. All rights reserved.</p>
                </div>
            `
        };

        // 4. Tiến hành gửi Mail
        await transporter.sendMail(mailOptions);

        return res.status(200).json({ 
            success: true, 
            message: "Mã OTP đã được gửi thành công đến email của bạn!" 
        });

    } catch (error) {
        console.error("Lỗi gửi OTP:", error);
        return res.status(500).json({ success: false, message: "Có lỗi xảy ra từ phía máy chủ!" });
    }
};

/**
 * @route   POST /api/khachhang/xac-nhan-otp
 * @desc    Xác thực OTP và tiến hành mã hóa, đổi mật khẩu mới
 */
exports.xacNhanOTPVaDoiMK = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        if (!email || !otp || !newPassword) {
            return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ thông tin!" });
        }

        // 1. Lấy dữ liệu OTP đã lưu trong cache ra đối chiếu
        const cachedData = otpCache.get(email);

        if (!cachedData) {
            return res.status(400).json({ success: false, message: "Mã OTP đã hết hạn hoặc chưa được yêu cầu!" });
        }

        // 2. Kiểm tra OTP hết hạn chưa
        if (Date.now() > cachedData.expireAt) {
            otpCache.delete(email); // Xóa mã hết hạn
            return res.status(400).json({ success: false, message: "Mã OTP đã hết hạn sử dụng!" });
        }

        // 3. Kiểm tra tính chính xác của OTP
        if (cachedData.otp !== otp) {
            return res.status(400).json({ success: false, message: "Mã OTP không chính xác!" });
        }

        // 4. Tìm kiếm người dùng theo email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: "Không tìm thấy người dùng!" });
        }

        // 5. 🎯 TIẾN HÀNH MÃ HÓA MẬT KHẨU MỚI BẰNG BCRYPT
        const saltRound = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRound);

        // 6. Gán mật khẩu đã mã hóa và lưu lại
        user.password = hashedPassword; 
        await user.save();

        // Xóa OTP khỏi cache sau khi dùng xong
        otpCache.delete(email);

        return res.status(200).json({ success: true, message: "Đổi mật khẩu thành công!" });

    } catch (error) {
        console.error("Lỗi xác nhận OTP:", error);
        return res.status(500).json({ success: false, message: "Có lỗi xảy ra từ phía máy chủ!" });
    }
};