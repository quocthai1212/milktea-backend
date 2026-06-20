const mongoose = require('mongoose');

const BadWordSchema = new mongoose.Schema({
    word: { 
        type: String, 
        required: true, 
        unique: true, // Không cho phép trùng lặp từ khóa
        trim: true, 
        lowercase: true // Tự động đổi về chữ thường để lúc quét không sót (ví dụ: "Lừa Đảo" thành "lừa đảo")
    }
}, { timestamps: true }); // Tự động lưu ngày thêm (createdAt)

module.exports = mongoose.model('BadWord', BadWordSchema);