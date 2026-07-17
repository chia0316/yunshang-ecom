const Wishlist = require('../productModels/Wishlist.model');
const Product = require('../productModels/Product.model');
const { Op } = require('sequelize');
const getWishlist = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(500).send({ error: 'Unauthorized request' });
    }
    const wishlistData = await Wishlist.findAll({
      where: {
        user_id: userId
      },
      include: [
        {
          model: Product,
          required: true
        }
      ]
    });
    return res
      .status(200)
      .send({ wishlist: wishlistData.map((item) => item.product) });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const addToWishlist = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(500).send({ error: 'Unauthorized request' });
    }
    const product_id = req.body.product_id;
    const newWishlistItem = await Wishlist.create({
      user_id: userId,
      product_id: product_id
    });
    if (newWishlistItem) {
      return res
        .status(200)
        .send({ message: 'Added to wishlist successfully' });
    } else {
      throw 'Error while adding to wishlist';
    }
  } catch (error) {
    console.log(error);
    return res.status(500).send({ error: error.message });
  }
};

const deleteFromWishlist = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(500).send({ error: 'Unauthorized request' });
    }
    const product_id = req.params.id;
    console.log('Product id: ', product_id);
    const deletedWishlistItem = await Wishlist.destroy({
      where: {
        [Op.and]: [{ user_id: userId }, { product_id: product_id }]
      }
    });
    console.log(deletedWishlistItem);
    if (deletedWishlistItem) {
      return res
        .status(200)
        .send({ message: 'Deleted from wishlist successfully' });
    } else {
      throw 'Error while deleting from wishlist';
    }
  } catch (error) {
    console.log(error);
    return res.status(500).send({ error: error.message });
  }
};

module.exports = {
  getWishlist,
  addToWishlist,
  deleteFromWishlist
};
