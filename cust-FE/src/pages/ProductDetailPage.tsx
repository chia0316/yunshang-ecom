import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Heart, Share, Minus, Plus, ShoppingCart, Truck, Shield } from 'lucide-react';
import { apiFetch, getProductImageUrl } from '../lib/api';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import type { Product } from '../lib/types';

const ProductDetailPage: React.FC = () => {
  const { id } = useParams();
  const { dispatch } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    setLoading(true);
    setSelectedImage(0);
    apiFetch<Product>(`/api/products/single/${id}`, { auth: false })
      .then(setProduct)
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center text-gray-500">
        Loading product...
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Product not found</h1>
        <Link to="/products" className="text-amber-600 hover:text-amber-700">
          Browse all products
        </Link>
      </div>
    );
  }

  const effectivePrice = product.sale_price ? Number(product.sale_price) : Number(product.price);
  const images = product.image_filenames.length > 0 ? product.image_filenames : [undefined];
  const inStock = product.stock_qty > 0;

  const handleAddToCart = () => {
    for (let i = 0; i < quantity; i++) {
      dispatch({
        type: 'ADD_TO_CART',
        payload: {
          id: product.id,
          name: product.name,
          price: effectivePrice,
          image: getProductImageUrl(product.image_filenames[0]),
          leadTimeDays: product.lead_time_days,
        },
      });
    }
  };

  const updateQuantity = (newQuantity: number) => {
    setQuantity(Math.max(1, newQuantity));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-8">
        <Link to="/" className="hover:text-gray-700">Home</Link>
        <span>/</span>
        <Link to="/products" className="hover:text-gray-700">Products</Link>
        <span>/</span>
        <span className="text-gray-900">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Product Images */}
        <div className="space-y-4">
          <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
            <img
              src={getProductImageUrl(images[selectedImage])}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>

          {images.length > 1 && (
            <div className="grid grid-cols-4 gap-4">
              {images.map((image, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedImage(index)}
                  className={`aspect-square bg-gray-100 rounded-lg overflow-hidden ${
                    selectedImage === index ? 'ring-2 ring-amber-600' : ''
                  }`}
                >
                  <img
                    src={getProductImageUrl(image)}
                    alt={`${product.name} ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="space-y-6">
          <div>
            {product.brand && (
              <p className="text-sm font-medium text-amber-600 mb-2">{product.brand}</p>
            )}
            <h1 className="text-3xl font-bold text-gray-900 mb-4">{product.name}</h1>

            <div className="flex items-center space-x-4 mb-6">
              <span className="text-3xl font-bold text-gray-900">${effectivePrice.toFixed(2)}</span>
              {product.sale_price && (
                <span className="text-2xl text-gray-500 line-through">
                  ${Number(product.price).toFixed(2)}
                </span>
              )}
            </div>
          </div>

          <p className="text-gray-600 leading-relaxed">{product.description}</p>

          {product.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {product.tags.map((tag) => (
                <span key={tag} className="px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Quantity */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Quantity</h3>
            <div className="flex items-center space-x-4">
              <div className="flex items-center border border-gray-200 rounded-lg">
                <button
                  onClick={() => updateQuantity(quantity - 1)}
                  className="p-2 hover:bg-gray-100 transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="px-4 py-2 font-medium">{quantity}</span>
                <button
                  onClick={() => updateQuantity(quantity + 1)}
                  className="p-2 hover:bg-gray-100 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {inStock ? (
                <span className="text-green-600 font-medium">In Stock ({product.stock_qty})</span>
              ) : (
                <span className="text-red-600 font-medium">Out of Stock</span>
              )}
            </div>
            {product.lead_time_days > 0 && (
              <p className="text-sm text-amber-600">
                Estimated delivery lead time: ~{Math.round(product.lead_time_days / 7)} week
                {Math.round(product.lead_time_days / 7) === 1 ? '' : 's'}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-4">
            <button
              onClick={handleAddToCart}
              disabled={!inStock}
              className="w-full bg-amber-600 text-white py-4 px-6 rounded-lg hover:bg-amber-700 transition-colors font-semibold text-lg flex items-center justify-center space-x-2 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              <ShoppingCart className="w-5 h-5" />
              <span>{inStock ? 'Add to Cart' : 'Out of Stock'}</span>
            </button>

            <div className="flex space-x-4">
              <button
                onClick={() => toggleWishlist(product)}
                className={`flex-1 border py-3 px-4 rounded-lg transition-colors font-medium flex items-center justify-center space-x-2 ${
                  isWishlisted(product.id)
                    ? 'border-red-200 bg-red-50 text-red-600'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Heart className={`w-5 h-5 ${isWishlisted(product.id) ? 'fill-current' : ''}`} />
                <span>{isWishlisted(product.id) ? 'In Wishlist' : 'Add to Wishlist'}</span>
              </button>

              <button className="flex-1 border border-gray-200 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-50 transition-colors font-medium flex items-center justify-center space-x-2">
                <Share className="w-5 h-5" />
                <span>Share</span>
              </button>
            </div>
          </div>

          {/* Specifications */}
          {product.weight_kg && (
            <div className="border-t pt-6">
              <h3 className="font-semibold text-gray-900 mb-4">Specifications</h3>
              <div className="flex justify-between">
                <span className="text-gray-600">Weight:</span>
                <span className="font-medium">{product.weight_kg} kg</span>
              </div>
            </div>
          )}

          {/* Guarantees */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-3">
                <Truck className="w-6 h-6 text-amber-600" />
                <div>
                  <p className="font-medium text-sm">Island-wide Delivery</p>
                  <p className="text-xs text-gray-500">Scheduled after order confirmation</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Shield className="w-6 h-6 text-amber-600" />
                <div>
                  <p className="font-medium text-sm">Warranty Included</p>
                  <p className="text-xs text-gray-500">Manufacturing defects</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailPage;
