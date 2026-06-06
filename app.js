var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
require('dotenv').config(); // 1. Đọc file cấu hình mật .env

// NẠP ĐẦY ĐỦ CÁC THƯ VIỆN Ở ĐÂY TRƯỚC KHI DÙNG
const mongoose = require('mongoose'); 
const cors = require('cors'); 
const bcrypt = require('bcryptjs'); 
const User = require('./models/User'); 
const Role = require('./models/Role');

var indexRouter = require('./routes/index');
var dangkyRouter = require('./routes/khachhang/dang_ky');
var dangnhapRouter = require('./routes/dang_nhap');
var qt_nhanvienRouter = require('./routes/quantri/nhanvien');
var qt_sanphamRouter = require('./routes/quantri/sanpham');
var paymentRouter = require('./routes/khachhang/payment.routes');
var kh_trangchuRouter = require('./routes/khachhang/khachhang');
var thongkeRouter = require('./routes/quantri/thongke');
var danhmucRouter = require('./routes/quantri/danhmuc');
var qt_khuyenmaiRouter = require('./routes/quantri/khuyenmai');

var app = express();

// BẬT CÔNG TẮC BẢO MẬT CORS
app.use(cors()); 

app.use(logger('dev'));
app.use(express.json()); 
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', dangnhapRouter);
app.use('/api/auth', dangkyRouter);
app.use('/api/quantri/qt_nhanvien', qt_nhanvienRouter);
app.use('/api/quantri/qt_sanpham', qt_sanphamRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/khachhang', kh_trangchuRouter);
app.use('/api/quantri/thongke', thongkeRouter);
app.use('/api/quantri/danhmuc', danhmucRouter);
app.use('/api/quantri/qt_khuyenmai', qt_khuyenmaiRouter);


app.use('/', indexRouter);

// ĐOẠN KẾT NỐI DATABASE PHẢI ĐỂ Ở ĐÁY FILE (NGAY TRÊN MODULE.EXPORTS)
mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        console.log('===================================================');
        console.log('✅ [DATABASE] Kết nối MongoDB Atlas THÀNH CÔNG!');
        console.log('===================================================');
        
        // 1. TỰ ĐỘNG KHỞI TẠO 3 QUYỀN BẰNG TIẾNG VIỆT (Bây giờ biến Role đã hoạt động hợp lệ)
        const cacQuyenHienTai = await Role.countDocuments();
        if (cacQuyenHienTai === 0) {
            await Role.insertMany([
                { _id: 1, role_name: 'quan_tri', description: 'Quản trị viên tối cao' },
                { _id: 2, role_name: 'nhan_vien', description: 'Nhân viên hệ thống' },
                { _id: 3, role_name: 'khach_hang', description: 'Khách hàng' }
            ]);
            console.log('🛡️ [DATABASE] Đã khởi tạo 3 nhóm quyền tiếng Việt (quan_tri, nhan_vien, khach_hang)!');
        }

        // 2. TỰ ĐỘNG TẠO TÀI KHOẢN QUẢN TRỊ (ADMIN)
        const adminExist = await User.findOne({ email: 'admin@system.com' }); 
        if (!adminExist) {
            const hashedAdminPassword = await bcrypt.hash('admin123', 10);
            await User.create({
                email: 'admin@system.com',
                password: hashedAdminPassword,
                full_name: 'Hệ Thống Quản Trị Tối Cao', 
                phone: '0999999999',
                role_id: 1, 
                shipping_addresses: [], 
                attendance: []          
            });
            console.log('👑 [DATABASE] Đã tự tạo tài khoản QUẢN TRỊ -> admin@system.com / admin123');
        }
    })
    .catch(err => {
        console.log('❌ [DATABASE] THẤT BẠI! KHÔNG THỂ KẾT NỐI MONGODB! - ', err.message);
    });

module.exports = app;
