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

var qt_nhanvienRouter = require('./routes/quantri/nhanvien');
var qt_sanphamRouter = require('./routes/quantri/sanpham');
var thongkeRouter = require('./routes/quantri/thongke');
var danhmucRouter = require('./routes/quantri/danhmuc');
var qt_khuyenmaiRouter = require('./routes/quantri/khuyenmai');
var qt_donhangRouter = require('./routes/quantri/donhang');
var qt_khachhangRouter = require('./routes/quantri/khachhang');
var qt_binhluanRouter = require('./routes/quantri/binhluan');
var qt_chinhanhRouter = require('./routes/quantri/chinhanh');


var nhanvienDonHangRouter = require('./routes/nhanvien/load_danhsach');

var dangkyRouter = require('./routes/khachhang/dang_ky');
var dangnhapRouter = require('./routes/dang_nhap');
var paymentRouter = require('./routes/khachhang/payment.routes');
var kh_trangchuRouter = require('./routes/khachhang/khachhang');
var kh_khuyenmaiRouter = require('./routes/khachhang/khuyenmai');
var kh_quenmkRouter = require('./routes/khachhang/quenmk');

var shipperDonHangRouter = require('./routes/shipper/don_hang');


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
app.use('/api/quantri/thongke', thongkeRouter);
app.use('/api/quantri/danhmucsanpham', danhmucRouter);
app.use('/api/quantri/donhang', qt_donhangRouter);
app.use('/api/quantri/qt_khuyenmai', qt_khuyenmaiRouter);
app.use('/api/quantri/qt_khachhang', qt_khachhangRouter);
app.use('/api/quantri/qt_binhluan', qt_binhluanRouter);
app.use('/api/quantri/qt_chinhanh', qt_chinhanhRouter);


app.use('/api/nhanvien', nhanvienDonHangRouter);

app.use('/api/payments', paymentRouter);
app.use('/api/khachhang/khuyenmai', kh_khuyenmaiRouter);
app.use('/api/khachhang/quenmk', kh_quenmkRouter);
app.use('/api/khachhang', kh_trangchuRouter);


app.use('/api/shipper', shipperDonHangRouter);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/', indexRouter);

// ĐOẠN KẾT NỐI DATABASE PHẢI ĐỂ Ở ĐÁY FILE (NGAY TRÊN MODULE.EXPORTS)
mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        console.log('===================================================');
        console.log('✅ [DATABASE] Kết nối MongoDB Atlas THÀNH CÔNG!');
        console.log('===================================================');
        
        // 💡 ĐÃ CẬP NHẬT: TỰ ĐỘNG KHỞI TẠO 4 QUYỀN (Thêm quyền shipper)
        const cacQuyenHienTai = await Role.countDocuments();
        if (cacQuyenHienTai === 0) {
            await Role.insertMany([
                { _id: 1, role_name: 'quan_tri', description: 'Quản trị viên tối cao' },
                { _id: 2, role_name: 'nhan_vien', description: 'Nhân viên hệ thống' },
                { _id: 3, role_name: 'khach_hang', description: 'Khách hàng' },
                { _id: 4, role_name: 'shipper', description: 'Nhân viên giao hàng' }
            ]);
            console.log('🛡️ [DATABASE] Đã khởi tạo 4 nhóm quyền tiếng Việt (quan_tri, nhan_vien, khach_hang, shipper)!');
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