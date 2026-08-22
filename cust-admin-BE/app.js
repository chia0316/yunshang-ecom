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
const productFeaturedTagsRouter = require('./routes/productFeaturedTags');
const settingsRouter = require('./routes/settings');
const couponsRouter = require('./routes/coupons');
const enquiriesRouter = require('./routes/enquiries');
const cartRouter = require('./routes/cart');

const app = express();
app.use(cors());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serves product images placed in public/images by filename — the default,
// dev-friendly counterpart to uploading to S3 via /api/products/upload-images.
app.use('/api/static/images', express.static(path.join(__dirname, 'public/images')));

// Serves product videos placed in public/videos by filename — counterpart to
// uploading via /api/products/upload-video.
app.use('/api/static/videos', express.static(path.join(__dirname, 'public/videos')));

// Every route lives under /api/ now — consistent naming, and it's what
// lets nginx proxy /api/ straight through to this app with no path
// rewriting at all (see nginx/templates/default.conf.template).
app.use('/api/user', userRouter);
app.use('/api/admin', adminRouter);
app.use('/api/admin/dashboard', analyticsRouter);
app.use('/api/auth', authRouter);

app.use('/api/products', productRouter);
app.use('/api/products/wishlist', wishlistRouter);
app.use('/api/category', categoryRouter);
app.use('/api/orders', orderRouter);
app.use('/api/orderdetails', orderDetailsRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/delivery-slots', deliverySlotsRouter);
app.use('/api/product-featured-tags', productFeaturedTagsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/coupons', couponsRouter);
app.use('/api/enquiries', enquiriesRouter);
app.use('/api/cart', cartRouter);

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
