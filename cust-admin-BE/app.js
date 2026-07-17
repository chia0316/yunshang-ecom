require('dotenv').config();
const path = require('path');
const express = require('express');
const logger = require('morgan');
const cors = require('cors');

const db = require('./database/connection');
const userRouter = require('./routes/user');
const adminRouter = require('./routes/admin');
const analyticsRouter = require('./routes/analytics');
const authRouter = require('./routes/auth');
const productRouter = require('./routes/product');
const wishlistRouter = require('./routes/wishlist');
const categoryRouter = require('./routes/category');
const orderRouter = require('./routes/order');
const orderDetailsRouter = require('./routes/orderDetails');
const paymentRouter = require('./routes/payment');
const reportsRouter = require('./routes/reports');
const deliverySlotsRouter = require('./routes/deliverySlots');

const app = express();
app.use(cors());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serves product images placed in public/images by filename — the default,
// dev-friendly counterpart to uploading to S3 via /api/products/upload-images.
app.use('/static/images', express.static(path.join(__dirname, 'public/images')));

app.use('/user', userRouter);
app.use('/admin', adminRouter);
app.use('/admin/dashboard', analyticsRouter);
app.use('/auth', authRouter);

app.use('/api/products', productRouter);
app.use('/api/products/wishlist', wishlistRouter);
app.use('/api/category', categoryRouter);
app.use('/api/orders', orderRouter);
app.use('/api/orderdetails', orderDetailsRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/delivery-slots', deliverySlotsRouter);

app.get('/', (req, res) => res.status(200).send({ message: 'Alive!' }));

const PORT = process.env.PORT || 8000;

db.authenticate()
  .then(() => {
    console.log('Connection has been established successfully.');
  })
  .catch((error) => {
    console.error('Unable to connect to the database:', error);
  });

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});
