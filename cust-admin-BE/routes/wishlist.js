const express = require('express');
const router = express.Router();
const { authenticate } = require('../utils/authenticator');

const wishlistController = require('../controllers/wishlist');

router.get('/', authenticate, wishlistController.getWishlist);
router.post('/', authenticate, wishlistController.addToWishlist);
router.delete('/:id', authenticate, wishlistController.deleteFromWishlist);

module.exports = router;
