const AIChatLog = require('../../models/AIChatLog');
const Product = require('../../models/Product');
const axios = require('axios'); 

const xuLyTuVanAI = async (req, res) => {
  try {
    const { session_id, customer_id, text } = req.body;

    if (!session_id || !text) {
      return res.status(400).json({ message: 'Thiếu định danh phiên chat hoặc nội dung tin nhắn!' });
    }

    // 🌟 SỬA BƯỚC 2: Sử dụng .populate('category') để lấy TÊN danh mục thay vì mã ID, và thêm trường 'sizes'
    let danhSachSanPham = [];
    try {
      danhSachSanPham = await Product.find({ is_active: true })
        .populate('category', 'category_name') // ➕ Lấy trường category_name từ bảng Category sang
        .select('product_name base_price category description toppings sizes'); // ➕ Thêm 'sizes' vào select
    } catch (dbErr) {
      console.error("❌ Không thể quét danh sách món từ MongoDB:", dbErr.message);
    }

    // 🌟 SỬA BƯỚC 3: Đổi mảng sản phẩm thành văn bản (Bổ sung Tên danh mục trực quan & Size ly)
    const chuoiMenuTaiLieu = danhSachSanPham.map(prod => {
      // Xử lý chuỗi danh mục đọc được bằng mắt
      const tenDanhMuc = prod.category?.category_name || "Món đặc biệt";

      // Xử lý danh sách Size
      let chuoiSize = "Món này chỉ có 1 kích thước ly mặc định.";
      if (prod.sizes && prod.sizes.length > 0) {
        chuoiSize = prod.sizes.map(s => `${s.size_name} (cộng thêm +${s.extra_price.toLocaleString('vi-VN')}đ)`).join(', ');
      }

      // Xử lý danh sách Topping
      let chuoiTopping = "Món này không có topping chọn thêm.";
      if (prod.toppings && prod.toppings.length > 0) {
        chuoiTopping = prod.toppings.map(t => `${t.topping_name} (+${t.price.toLocaleString('vi-VN')}đ)`).join(', ');
      }

      return `- Tên món: ${prod.product_name} 
  | Phân loại danh mục: ${tenDanhMuc}
  | Giá gốc (Ly thường): ${prod.base_price.toLocaleString('vi-VN')} VNĐ 
  | Kích thước (Size): ${chuoiSize}
  | Topping đi kèm: ${chuoiTopping}
  | Mô tả: ${prod.description || 'Chưa có mô tả'}`;
    }).join('\n\n');

    // 4. KIỂM TRA LỊCH SỬ CHAT LOG CŨ HOẶC KHỞI TẠO MỚI
    let chatLog = await AIChatLog.findOne({ session_id: session_id });
    if (!chatLog) {
      chatLog = new AIChatLog({ 
        customer_id: customer_id || null, 
        session_id: session_id, 
        messages: [] 
      });
    }

    chatLog.messages.push({ sender: 'customer', text: text, timestamp: new Date() });

    // 5. GỌI API GOOGLE GEMINI BẰNG AXIOS
    let aiResponseText = "";
    const apiKey = process.env.GEMINI_API_KEY; 

    try {
      if (!apiKey) {
        throw new Error("Chưa cấu hình GEMINI_API_KEY trong file .env!");
      }

      const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

      const promptHeThong = `
Bạn là Trợ lý ảo tư vấn bán hàng NGẮN GỌN của quán trà sữa. 
Nhiệm vụ của bạn là dựa vào MENU dưới đây để trả lời câu hỏi: "${text}" của khách.

DANH SÁCH MENU, PHÂN LOẠI, SIZE VÀ TOPPING:
${chuoiMenuTaiLieu || "Hiện tại hệ thống menu đang bảo trì, vui lòng quay lại sau."}

BẮT BUỘC TUÂN THỦ 4 QUY TẮC PHẢN HỒI SIÊU NGẮN:
1. ĐỘ DÀI: Câu trả lời KHÔNG ĐƯỢC VƯỢT QUÁ 3-4 DÒNG. Tuyệt đối không chào hỏi dài dòng, không văn hoa, không lặp lại câu hỏi của khách. Vào thẳng vấn đề!
2. CHỈ ĐỊNH MÓN: Chỉ tư vấn món và phân loại danh mục có trong danh sách trên. Nêu tên món kèm giá gốc, giá theo size và topping đi kèm (nếu khách hỏi). Nếu không có món khách cần, từ chối ngay trong 1 câu và gợi ý 1 món có sẵn.
3. ĐỊNH DẠNG: Sử dụng các dấu gạch đầu dòng (-) hoặc số thứ tự (1, 2) để liệt kê món/giá. Mỗi ý một dòng, không viết thành một đoạn văn dài.
4. PHONG CÁCH: Thân thiện, lịch sự, dùng từ ngữ ngắn gọn dễ hiểu phù hợp khung chat nhỏ.
`;
      const response = await axios.post(googleApiUrl, {
        contents: [{ parts: [{ text: promptHeThong }] }]
      }, {
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.data && response.data.candidates && response.data.candidates[0].content.parts[0]) {
        aiResponseText = response.data.candidates[0].content.parts[0].text;
      } else {
        throw new Error("Cấu trúc phản hồi từ Google không đúng kì vọng.");
      }

    } catch (aiErr) {
      const errorMessage = aiErr.response?.data?.error?.message || aiErr.message;
      console.error("❌ Lỗi gọi API Google Gemini bằng Axios:", errorMessage);
      console.log("🔑 Kiểm tra định dạng Key đang chạy:", apiKey ? `${apiKey.substring(0, 7)}...` : "Trống!");
      aiResponseText = "Dạ, hệ thống tư vấn tự động của quán đang bận một chút. Bạn cần hỗ trợ món nào gấp có thể nhắn hotline của quán nhé!";
    }

    chatLog.messages.push({ sender: 'ai', text: aiResponseText, timestamp: new Date() });
    await chatLog.save();

    return res.status(200).json({ sender: 'ai', text: aiResponseText, timestamp: new Date() });

  } catch (error) {
    console.error("❌ Lỗi hệ thống Controller Chat AI:", error);
    return res.status(500).json({ message: 'Lỗi server xử lý chatbox!', error: error.message });
  }
};

module.exports = { xuLyTuVanAI };