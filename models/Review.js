const mongoose = require('mongoose');
// Đường dẫn chuẩn tới file AI Helper chạy bằng Axios của bạn
const { analyzeSentiment } = require('../routes/quantri/aiHelper'); 

const ReviewSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true }, 
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 }, 
    comment_text: { type: String, trim: true, default: "" },
    review_images: [{ type: String }],

    ai_sentiment: {
        label: { 
            type: String, 
            enum: ['positive', 'neutral', 'negative', 'unknown'], 
            default: 'unknown' 
        },
        score: { type: Number, default: 0 },
        ai_raw_response: { type: mongoose.Schema.Types.Mixed } 
    }
}, { timestamps: true });
  
ReviewSchema.index({ user_id: 1, order_id: 1, product_id: 1 }, { unique: true });

// 🔥 SỬA KHU VỰC NÀY: Bỏ hoàn toàn tham số "next" và lệnh "next()" đi bớt rườm rà
ReviewSchema.pre('save', async function () {
    if (this.isModified('comment_text') && this.comment_text.trim() !== "") {
        try {
            const aiResult = await analyzeSentiment(this.comment_text);
            this.ai_sentiment = {
                label: aiResult.label,     
                score: aiResult.score,     
                ai_raw_response: aiResult.raw
            };
        } catch (error) {
            this.ai_sentiment = { label: 'unknown', score: 0, ai_raw_response: error.message };
        }
    }
    // Không gọi next() ở đây nữa, async function tự biết khi nào kết thúc để lưu dữ liệu!
});

module.exports = mongoose.models.Review || mongoose.model('Review', ReviewSchema);