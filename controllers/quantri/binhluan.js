const Review = require('../../models/Review');
const User = require('../../models/User');
const BadWord = require('../../models/BadWord');

/**
 * 1. LẤY TOÀN BỘ DANH SÁCH BÌNH LUẬN & ĐÁNH GIÁ (Để Admin xem)
 * Real URL: GET /api/quantri/qt_binhluan/all
 */
exports.getDanhSachBinhLuan = async (req, res) => {
    try {
        const danhSachReview = await Review.find()
            .populate('user_id', 'full_name email is_active') 
            .populate('product_id', 'product_name')          
            .sort({ createdAt: -1 });                        

        return res.status(200).json({
            success: true,
            data: danhSachReview
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Lỗi máy chủ khi kết nối truy vấn danh sách bình luận",
            error: error.message
        });
    }
};

/**
 * 2. ĐỔI TRẠNG THÁI KHÓA / MỞ KHÓA TÀI KHOẢN NGƯỜI DÙNG (Cập nhật động)
 * Real URL: PUT /api/quantri/qt_binhluan/lock/:userId
 * Body gửi lên: { "is_active": true hoặc false }
 */
exports.khoaTaiKhoanUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { is_active } = req.body;

        // Nếu phía frontend không truyền explicit trạng thái mong muốn, mặc định sẽ là Khóa (false)
        const trangThaiMoi = is_active !== undefined ? is_active : false;

        const userThayDoi = await User.findByIdAndUpdate(
            userId,
            { is_active: trangThaiMoi },
            { new: true }
        );

        if (!userThayDoi) {
            return res.status(404).json({ success: false, message: "Không tìm thấy người dùng này!" });
        }

        // Tự động xử lý bình luận đi kèm theo hành động:
        if (trangThaiMoi === false) {
            // Nếu KHÓA user -> Tự động ẩn toàn bộ bình luận của User này
            await Review.updateMany({ user_id: userId }, { status: 'hidden' });
        } else {
            // Nếu MỞ KHÓA user -> Tự động khôi phục hiển thị toàn bộ bình luận của User này về lại 'approved'
            await Review.updateMany({ user_id: userId }, { status: 'approved' });
        }

        const hanhDongText = trangThaiMoi ? "Mở khóa" : "Khóa";

        return res.status(200).json({
            success: true,
            message: `Đã ${hanhDongText} thành công tài khoản của thành viên: ${userThayDoi.full_name}!`
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Lỗi hệ thống khi thực hiện thay đổi trạng thái tài khoản",
            error: error.message
        });
    }
};

/**
 * 3. XÓA VĨNH VIỄN BÌNH LUẬN KHỎI DATABASE
 * Real URL: DELETE /api/quantri/qt_binhluan/delete/:id
 */
exports.xoaBinhLuan = async (req, res) => {
    try {
        const { id } = req.params;

        const blDaXoa = await Review.findByIdAndDelete(id);
        if (!blDaXoa) {
            return res.status(404).json({ success: false, message: "Bình luận này không tồn tại hoặc đã bị xóa trước đó!" });
        }

        return res.status(200).json({
            success: true,
            message: "Đã xóa vĩnh viễn dữ liệu bình luận thành công khỏi hệ thống!"
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Lỗi máy chủ khi xóa bình luận",
            error: error.message
        });
    }
};

/**
 * 🔥 4. SỬA NỘI DUNG, SỐ SAO & THAY ĐỔI TRẠNG THÁI ẨN HIỆN BÌNH LUẬN
 * Real URL: PUT /api/quantri/qt_binhluan/update/:id
 * Body gửi lên: { "comment_text": "Nội dung", "rating": 5, "status": "approved"/"hidden" }
 */
exports.suaBinhLuan = async (req, res) => {
    try {
        const { id } = req.params;
        const { comment_text, rating, status } = req.body;

        // 1. Kiểm tra dữ liệu đầu vào cơ bản
        if (rating !== undefined && (rating < 1 || rating > 5)) {
            return res.status(400).json({ success: false, message: "Số sao đánh giá phải từ 1 đến 5 sao!" });
        }

        // Kiểm tra giá trị hợp lệ của trạng thái status gửi lên
        if (status !== undefined && !['approved', 'hidden'].includes(status)) {
            return res.status(400).json({ success: false, message: "Trạng thái hiển thị không hợp lệ!" });
        }

        // 2. Kiểm tra bộ lọc từ khóa cấm ngay khi sửa bình luận (Nếu có nhập text)
        if (comment_text && comment_text.trim() !== "") {
            const danhSachTuCam = await BadWord.find();
            const textKiemTra = comment_text.toLowerCase();

            for (let item of danhSachTuCam) {
                if (textKiemTra.includes(item.word.toLowerCase())) {
                    return res.status(400).json({
                        success: false,
                        message: `Nội dung chỉnh sửa vi phạm! Chứa từ ngữ bị cấm: "[ ${item.word} ]"`
                    });
                }
            }
        }

        // 3. Tiến hành gộp dữ liệu cập nhật vào cơ sở dữ liệu
        const capNhatData = {};
        if (comment_text !== undefined) capNhatData.comment_text = comment_text.trim();
        if (rating !== undefined) capNhatData.rating = Number(rating);
        if (status !== undefined) capNhatData.status = status; // Áp dụng cập nhật trạng thái ẩn/hiện trực tiếp từ modal

        const blDaSua = await Review.findByIdAndUpdate(
            id,
            capNhatData,
            { new: true }
        ).populate('user_id', 'full_name email is_active').populate('product_id', 'product_name');

        if (!blDaSua) {
            return res.status(404).json({ success: false, message: "Không tìm thấy bình luận cần chỉnh sửa!" });
        }

        return res.status(200).json({
            success: true,
            message: "Cập nhật thông tin bình luận và trạng thái ẩn/hiện thành công!",
            data: blDaSua
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Lỗi máy chủ khi thực hiện chỉnh sửa bình luận",
            error: error.message
        });
    }
};

// ==========================================
// 🔥 QUẢN LÝ DANH SÁCH TỪ KHÓA CẤM
// ==========================================

/**
 * 5. LẤY DANH SÁCH TỪ KHÓA CẤM (Admin quản lý)
 * Real URL: GET /api/quantri/qt_binhluan/badwords/all
 */
exports.getDanhSachTuCam = async (req, res) => {
    try {
        const danhSach = await BadWord.find().sort({ createdAt: -1 });
        return res.status(200).json({
            success: true,
            data: danhSach
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Lỗi khi lấy danh sách từ khóa cấm",
            error: error.message
        });
    }
};

/**
 * 6. THÊM TỪ KHÓA CẤM MỚI (Admin nhập từ khóa)
 * Real URL: POST /api/quantri/qt_binhluan/badwords/add
 */
exports.themTuCam = async (req, res) => {
    try {
        const { word } = req.body;

        if (!word || word.trim() === "") {
            return res.status(400).json({ success: false, message: "Từ khóa không được để trống!" });
        }

        const tuDaTonTai = await BadWord.findOne({ word: word.trim().toLowerCase() });
        if (tuDaTonTai) {
            return res.status(400).json({ success: false, message: "Từ khóa cấm này đã có trong hệ thống rồi!" });
        }

        const badWordMoi = new BadWord({ word: word.trim().toLowerCase() });
        await badWordMoi.save();

        return res.status(201).json({
            success: true,
            message: `Đã thêm từ khóa "[ ${word} ]" vào danh sách cấm thành công!`,
            data: badWordMoi
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Lỗi hệ thống khi thêm từ khóa cấm",
            error: error.message
        });
    }
};

/**
 * 7. XÓA TỪ KHÓA CẤM KHỎI HỆ THỐNG
 * Real URL: DELETE /api/quantri/qt_binhluan/badwords/delete/:id
 */
exports.xoaTuCam = async (req, res) => {
    try {
        const { id } = req.params;

        const tuDaXoa = await BadWord.findByIdAndDelete(id);
        if (!tuDaXoa) {
            return res.status(404).json({ success: false, message: "Từ khóa này không tồn tại hoặc đã xóa trước đó!" });
        }

        return res.status(200).json({
            success: true,
            message: "Đã gỡ bỏ từ khóa cấm này khỏi hệ thống!"
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Lỗi máy chủ khi xóa từ khóa cấm",
            error: error.message
        });
    }
};

/**
 * @route   GET /api/quantri/binhluan/sentiment-stats
 * @desc    Thống kê tổng quan cảm xúc AI và danh sách các món bị chê nhiều nhất
 */
exports.getThongKeCamXuc = async (req, res) => {
    try {
      // 1. Dùng Aggregate để đếm số lượng review theo từng nhãn cảm xúc AI
      const statsGroup = await Review.aggregate([
        {
          $group: {
            // Phòng hờ những bản ghi cũ bị thiếu trường thì gộp chung vào unknown
            _id: { $ifNull: ["$ai_sentiment.label", "unknown"] }, 
            count: { $sum: 1 }
          }
        }
      ]);
  
      // Tạo form mẫu dữ liệu sạch để chuẩn bị đổ số lượng vào
      const thongKeTongQuan = { positive: 0, negative: 0, neutral: 0, unknown: 0 };
      let tongSoBinhLuan = 0;
  
      // Duyệt qua kết quả từ MongoDB để gán số lượng vào Object
      statsGroup.forEach(item => {
        if (thongKeTongQuan.hasOwnProperty(item._id)) {
          thongKeTongQuan[item._id] = item.count;
          tongSoBinhLuan += item.count;
        }
      });
  
      // 2. Tính toán tỷ lệ phần trăm (%) tương ứng của từng nhãn để Frontend dễ vẽ biểu đồ tròn
      const tyLePhanTram = {
        positive: tongSoBinhLuan > 0 ? Math.round((thongKeTongQuan.positive / tongSoBinhLuan) * 100) : 0,
        negative: tongSoBinhLuan > 0 ? Math.round((thongKeTongQuan.negative / tongSoBinhLuan) * 100) : 0,
        neutral: tongSoBinhLuan > 0 ? Math.round((thongKeTongQuan.neutral / tongSoBinhLuan) * 100) : 0,
        unknown: tongSoBinhLuan > 0 ? Math.round((thongKeTongQuan.unknown / tongSoBinhLuan) * 100) : 0,
      };
  
      // 3. Tìm top 5 sản phẩm/món nước nhận nhiều nhãn "negative" nhất để cảnh báo quán cải thiện chất lượng
      const topBiChe = await Review.aggregate([
        { $match: { "ai_sentiment.label": "negative" } }, // Chỉ lọc ra những review bị chê
        {
          $group: {
            _id: "$product_id",
            soBinhLuanTieuCuc: { $sum: 1 }
          }
        },
        { $sort: { soBinhLuanTieuCuc: -1 } }, // Thằng bị chê nhiều nhất đứng đầu danh sách
        { $limit: 5 }, // Chốt lấy top 5 món
        {
          $lookup: { // Kết nối (Join) sang bảng products để lấy thông tin món nước
            from: "products", // Chú ý: Hãy kiểm tra xem collection trong MongoDB của bạn tên là "products" đúng không nhé!
            localField: "_id",
            foreignField: "_id",
            as: "thongTinMon"
          }
        },
        { $unwind: "$thongTinMon" },
        {
          $project: {
            _id: 1,
            tenSanPham: "$thongTinMon.product_name",
            giaGoc: "$thongTinMon.base_price",
            soLuongTieuCuc: "$soBinhLuanTieuCuc"
          }
        }
      ]);
  
      // Trả kết quả JSON siêu đẹp về cho Frontend
      return res.status(200).json({
        success: true,
        message: "Tải dữ liệu thống kê biểu cảm AI thành công!",
        data: {
          tongSoBinhLuan,
          soLuongChiTiet: thongKeTongQuan,
          tyLePhanTram: tyLePhanTram,
          topSanPhamBiChe: topBiChe
        }
      });
  
    } catch (error) {
      console.error("❌ Lỗi thống kê cảm xúc AI:", error);
      return res.status(500).json({
        success: false,
        message: "Lỗi máy chủ khi xử lý lấy thống kê biểu cảm: " + error.message
      });
    }
  };