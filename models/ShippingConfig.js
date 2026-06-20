const mongoose = require('mongoose');

const ShippingConfigSchema = new mongoose.Schema({
    // 1. Tên phân biệt giữa các cơ sở / chi nhánh trà sữa
    branch_name: { 
        type: String, 
        required: true,
        unique: true, // Tránh tạo trùng tên cơ sở (VD: Chi nhánh 1 - Vĩnh Long)
        trim: true
    },
    
    // 2. Địa chỉ gốc của chi nhánh đó (Dùng làm tâm để tính khoảng cách giao hàng)
    shop_address: { 
        type: String, 
        required: true,
        trim: true
    },
    
    // 3. Đơn giá tiền ship tính trên mỗi 1 km của chi nhánh này (Ví dụ: 5000)
    shipping_fee_per_km: { 
        type: Number, 
        required: true, 
        default: 5000 
    },
    
    // 4. Khoảng cách/Bán kính giao hàng tối đa mà chi nhánh này nhận ship (km)
    max_delivery_km: { 
        type: Number, 
        required: true, 
        default: 20 
    },
    
    // 5. Trạng thái hoạt động của chi nhánh (Cho phép tắt đi nếu cơ sở đó nghỉ bán)
    is_active: {
        type: Boolean,
        default: true
    },
    latitude: { type: Number, required: false, default: 0 },
    longitude: { type: Number, required: false, default: 0 }
}, { 
    timestamps: true // Tự động thêm trường createdAt (ngày tạo) và updatedAt (ngày sửa)
});

// Xuất model ra với tên 'ShippingConfig' để bảng Order có thể ref chính xác tới
module.exports = mongoose.model('ShippingConfig', ShippingConfigSchema);