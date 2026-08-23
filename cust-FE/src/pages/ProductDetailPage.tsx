import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Heart, Share, Minus, Plus, ShoppingCart, Truck, Shield, Play, X, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import { apiFetch, getProductImageUrl, getProductVideoUrl } from '../lib/api';
import { useCart, withVariantLabel } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import type { Product } from '../lib/types';

const ProductDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  // Which value is picked per option axis — starts matching whatever product
  // actually loaded, and narrows the "Other options" swatch grid below to
  // only the siblings matching every selected axis (see selectAxisValue).
  const [selectedAxisValues, setSelectedAxisValues] = useState<Record<string, string>>({});

  useEffect(() => {
    // Only the very first load shows the full-page "Loading product..."
    // state (loading starts true and is never reset to true again below).
    // Switching variants keeps the current product on screen while the new
    // one loads in the background, instead of blanking the whole page and
    // flashing back — that swap is near-instant anyway.
    setSelectedImage(0);
    setQuantity(1);
    setLightboxOpen(false);
    apiFetch<Product>(`/api/products/single/${id}`, { auth: false })
      .then((data) => {
        setProduct(data);
        setSelectedAxisValues(data.variant_options || {});
        setLoading(false);
      })
      .catch(() => {
        setProduct(null);
        setLoading(false);
      });
  }, [id]);

  // Computed ahead of the early returns below (rather than alongside `media`
  // further down, which only exists once `product` is confirmed loaded) so
  // this stays a plain, unconditionally-called hook.
  const mediaCount = product
    ? (product.image_filenames.length > 0 ? product.image_filenames.length : 1) +
      (product.video_filename ? 1 : 0)
    : 0;

  useEffect(() => {
    if (!lightboxOpen || mediaCount === 0) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false);
      else if (e.key === 'ArrowLeft') setSelectedImage((i) => (i - 1 + mediaCount) % mediaCount);
      else if (e.key === 'ArrowRight') setSelectedImage((i) => (i + 1) % mediaCount);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, mediaCount]);

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
        <Link to="/products" className="text-terracotta-600 hover:text-terracotta-700">
          Browse all products
        </Link>
      </div>
    );
  }

  const effectivePrice = product.sale_price ? Number(product.sale_price) : Number(product.price);
  const imageFilenames = product.image_filenames.length > 0 ? product.image_filenames : [undefined];
  const videoUrl = getProductVideoUrl(product.video_filename);
  const media: { type: 'image' | 'video'; src: string }[] = [
    ...imageFilenames.map((filename) => ({ type: 'image' as const, src: getProductImageUrl(filename) })),
    ...(videoUrl ? [{ type: 'video' as const, src: videoUrl }] : []),
  ];
  const inStock = product.stock_qty > 0;

  // Sibling variants (including this one) — powers the switcher below.
  const variants = product.variants && product.variants.length > 1 ? product.variants : [];
  const optionAxes = Array.from(
    new Set(variants.flatMap((v) => (v.variant_options ? Object.keys(v.variant_options) : [])))
  );

  // Distinct values for an axis (e.g. Material: Fabric/Vancouver/Solana/
  // Champagne) — grouped, not deduped to one arbitrary variant, since many
  // siblings can share the same axis value (e.g. several different Fabric
  // colorways all just labeled "Fabric").
  const axisValues = (axis: string) => {
    const seen = new Set<string>();
    const values: string[] = [];
    variants.forEach((v) => {
      const value = v.variant_options?.[axis];
      if (value && !seen.has(value)) {
        seen.add(value);
        values.push(value);
      }
    });
    return values;
  };

  // Picking a "Choose an option" pill narrows the filter rather than
  // navigating outright — if that narrows things to exactly one sibling
  // (the common case: every axis value maps 1:1 to a single variant), jump
  // straight there, same as a direct navigation. If several siblings still
  // share that value (e.g. 8 different Fabric colorways), it just filters
  // the swatch grid below down to that group instead of listing all 31.
  const selectAxisValue = (axis: string, value: string) => {
    const nextSelection = { ...selectedAxisValues, [axis]: value };
    setSelectedAxisValues(nextSelection);
    const matches = variants.filter((v) =>
      Object.entries(nextSelection).every(([a, val]) => v.variant_options?.[a] === val)
    );
    if (matches.length === 1 && matches[0].id !== product.id) {
      navigate(`/product/${matches[0].id}`);
    }
  };

  // Siblings matching every currently selected axis value — what the
  // "Other options" swatch grid actually renders.
  const filteredVariants = variants.filter((v) =>
    Object.entries(selectedAxisValues).every(([axis, val]) => v.variant_options?.[axis] === val)
  );

  const handleAddToCart = () => {
    addToCart(
      {
        id: product.id,
        name: withVariantLabel(product.name, product.variant_options),
        price: effectivePrice,
        image: getProductImageUrl(product.image_filenames[0]),
        leadTimeDays: product.lead_time_days,
      },
      quantity
    );
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
          <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden group/main">
            {media[selectedImage].type === 'video' ? (
              <video
                key={media[selectedImage].src}
                src={media[selectedImage].src}
                controls
                className="w-full h-full object-contain"
              />
            ) : (
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="block w-full h-full cursor-zoom-in"
                aria-label="View larger image"
              >
                <img
                  src={media[selectedImage].src}
                  alt={product.name}
                  className="w-full h-full object-contain"
                />
                <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-xs font-medium text-white opacity-0 transition-opacity group-hover/main:opacity-100">
                  <ZoomIn className="w-3.5 h-3.5" />
                  Click to zoom
                </span>
              </button>
            )}
          </div>

          {media.length > 1 && (
            <div className="grid grid-cols-4 gap-4">
              {media.map((item, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedImage(index)}
                  className={`relative aspect-square bg-gray-100 rounded-lg overflow-hidden ${
                    selectedImage === index ? 'ring-2 ring-terracotta-600' : ''
                  }`}
                >
                  {item.type === 'video' ? (
                    <>
                      <video
                        src={item.src}
                        muted
                        preload="metadata"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <Play className="w-6 h-6 text-white fill-current" />
                      </span>
                    </>
                  ) : (
                    <img
                      src={item.src}
                      alt={`${product.name} ${index + 1}`}
                      className="w-full h-full object-contain"
                    />
                  )}
                </button>
              ))}
            </div>
          )}

          {filteredVariants.length > 1 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Other options ({filteredVariants.length})
              </h3>
              <div className="grid grid-cols-4 gap-4">
                {filteredVariants.map((v) => {
                  const isCurrent = v.id === product.id;
                  // SKU, not the variant option value — several siblings can
                  // share the same option label (e.g. multiple "Champagne"
                  // colorways within one material), so the label alone
                  // doesn't tell them apart; the SKU always does.
                  const label = v.sku;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => !isCurrent && navigate(`/product/${v.id}`)}
                      className={`group relative aspect-square bg-gray-100 rounded-lg overflow-hidden ${
                        isCurrent ? 'ring-2 ring-terracotta-600' : 'hover:ring-2 hover:ring-gray-300'
                      }`}
                      title={label}
                    >
                      <img
                        src={getProductImageUrl(v.image_filenames[0] || product.image_filenames[0])}
                        alt={label}
                        className="w-full h-full object-contain"
                      />
                      <span className="absolute inset-x-0 bottom-0 break-words bg-black/50 px-1 py-0.5 text-[10px] leading-tight text-white">
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="space-y-6">
          <div>
            {product.brand && (
              <p className="text-sm font-medium text-terracotta-600 mb-2">{product.brand}</p>
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

          {optionAxes.length > 0 && (
            <div className="space-y-4">
              {optionAxes.map((axis) => (
                <div key={axis}>
                  <h3 className="font-semibold text-gray-900 mb-2">
                    {axis === 'Option' ? 'Choose an option' : axis}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {axisValues(axis).map((value) => {
                      const isSelected = selectedAxisValues[axis] === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => !isSelected && selectAxisValue(axis, value)}
                          className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                            isSelected
                              ? 'border-stone-900 bg-stone-900 text-white'
                              : 'border-gray-200 text-gray-700 hover:border-stone-900'
                          }`}
                        >
                          {value}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

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
            </div>
            {product.lead_time_days > 0 && (
              <p className="text-sm text-terracotta-600">
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
              className="w-full bg-stone-900 text-white py-4 px-6 rounded-lg hover:bg-stone-800 transition-colors font-semibold text-lg flex items-center justify-center space-x-2 disabled:bg-gray-300 disabled:cursor-not-allowed"
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
          {product.dimensions && (
            <div className="border-t pt-6">
              <h3 className="font-semibold text-gray-900 mb-4">Specifications</h3>
              <div className="flex justify-between">
                <span className="text-gray-600">Dimensions:</span>
                <span className="font-medium">{product.dimensions}</span>
              </div>
            </div>
          )}

          {/* Guarantees */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-3">
                <Truck className="w-6 h-6 text-terracotta-600" />
                <div>
                  <p className="font-medium text-sm">Island-wide Delivery</p>
                  <p className="text-xs text-gray-500">Scheduled after order confirmation</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Shield className="w-6 h-6 text-terracotta-600" />
                <div>
                  <p className="font-medium text-sm">Warranty Included</p>
                  <p className="text-xs text-gray-500">Manufacturing defects</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {lightboxOpen && media[selectedImage].type === 'image' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-8 h-8" />
          </button>

          {mediaCount > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedImage((i) => (i - 1 + mediaCount) % mediaCount);
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white transition-colors"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-10 h-10" />
            </button>
          )}

          <img
            src={media[selectedImage].src}
            alt={product.name}
            className="max-h-[90vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {mediaCount > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedImage((i) => (i + 1) % mediaCount);
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white transition-colors"
              aria-label="Next image"
            >
              <ChevronRight className="w-10 h-10" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ProductDetailPage;
