require('dotenv').config();
const axios = require('axios'); // 👈 Dùng axios giống hệt Chatbox

async function analyzeSentiment(text) {
    if (!text || text.trim() === "") {
        return { label: 'neutral', score: 0, raw: null };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    
    // Nếu chưa có key, trả về mặc định để không làm sập API bình luận
    if (!apiKey) {
        console.error("❌ Chưa cấu hình GEMINI_API_KEY trong file .env!");
        return { label: 'unknown', score: 0, raw: 'Thiếu API Key' };
    }

    // Câu lệnh ép AI trả về JSON chuẩn
    const prompt = `Phân tích cảm xúc của bình luận sau bằng tiếng Việt (bình luận của khách mua trà sữa). 
    Trả về duy nhất định dạng JSON như sau, không kèm ký tự markdown (\`\`\`json) hay giải thích gì thêm: 
    {"label": "positive"|"neutral"|"negative", "score": từ -1 đến 1}.
    
    Bình luận: "${text}"`;

    // Đường dẫn API của Google y hệt bên Chatbox (sử dụng gemini-2.5-flash cho nhanh và chuẩn JSON)
    const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    try {
        const response = await axios.post(googleApiUrl, {
            contents: [{ parts: [{ text: prompt }] }],
            // Ép cấu hình đầu ra phải là JSON
            generationConfig: {
                responseMimeType: "application/json"
            }
        }, {
            headers: { 'Content-Type': 'application/json' }
        });

        // Bóc tách dữ liệu từ cấu trúc phản hồi của Google
        if (response.data && response.data.candidates && response.data.candidates[0].content.parts[0]) {
            const aiRawText = response.data.candidates[0].content.parts[0].text.trim();
            
            // Giải mã chuỗi JSON mà AI trả về
            const result = JSON.parse(aiRawText);
            
            return {
                label: result.label || 'neutral',
                score: typeof result.score === 'number' ? result.score : 0,
                raw: aiRawText
            };
        } else {
            throw new Error("Cấu trúc phản hồi từ Google không đúng kỳ vọng.");
        }

    } catch (error) {
        const errorMessage = error.response?.data?.error?.message || error.message;
        console.error("❌ Lỗi gọi API phân tích cảm xúc bằng Axios:", errorMessage);
        
        // Trả về nhãn unknown khi lỗi mạng/lỗi key để bảo vệ hệ thống, khách vẫn bình luận được
        return { 
            label: 'unknown', 
            score: 0, 
            raw: errorMessage 
        };
    }
}

module.exports = { analyzeSentiment };