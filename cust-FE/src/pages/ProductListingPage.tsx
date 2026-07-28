import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Filter, Grid, List, ChevronDown, Star, Heart } from 'lucide-react';
import { apiFetch, getProductImageUrl } from '../lib/api';
import { useWishlist } from '../context/WishlistContext';
import type { Category, Product } from '../lib/types';

const ProductListingPage: React.FC = () => {
  const { categoryId } = useParams();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const [sortBy, setSortBy] = useState('featured');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Category[]>('/api/category', { auth: false }).then(setCategories);
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page_size: '100' });
    if (categoryId) params.set('category_id', categoryId);

    apiFetch<{ data: Product[] }>(`/api/products?${params.toString()}`, { auth: false })
      .then((res) => setProducts(res.data))
      .finally(() => setLoading(false));
  }, [categoryId]);

  const effectivePrice = (product: Product) =>
    product.sale_price ? Number(product.sale_price) : Number(product.price);

  const filteredProducts = products
    .slice()
    .sort((a, b) => {
      if (sortBy === 'price-low') return effectivePrice(a) - effectivePrice(b);
      if (sortBy === 'price-high') return effectivePrice(b) - effectivePrice(a);
      return 0;
    });

  const categoryName = categories.find((c) => String(c.id) === categoryId)?.name || 'All Products';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{categoryName}</h1>
          <p className="text-gray-600">
            {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} found
          </p>
        </div>

        <div className="flex items-center space-x-4 mt-4 lg:mt-0">
          <div className="flex border border-gray-200 rounded-lg">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-amber-600 text-white' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-amber-600 text-white' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="appearance-none bg-white border border-gray-200 rounded-lg px-4 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            >
              <option value="featured">Featured</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="lg:hidden flex items-center space-x-2 px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:text-gray-900"
          >
            <Filter className="w-4 h-4" />
            <span>Filters</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Filters */}
        <div className={`lg:w-64 space-y-6 ${showFilters ? 'block' : 'hidden lg:block'}`}>
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-4">Categories</h3>
              <div className="space-y-2">
                <Link
                  to="/products"
                  className={`block text-sm ${!categoryId ? 'text-amber-600 font-medium' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  All Products
                </Link>
                {categories.map((cat) => (
                  <Link
                    key={cat.id}
                    to={`/products/${cat.id}`}
                    className={`block text-sm ${categoryId === String(cat.id) ? 'text-amber-600 font-medium' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    {cat.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Products Grid */}
        <div className="flex-1">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading products...</div>
          ) : (
            <>
              <div
                className={
                  viewMode === 'grid'
                    ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                    : 'space-y-6'
                }
              >
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    className={`bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300 group ${
                      viewMode === 'list' ? 'flex' : ''
                    }`}
                  >
                    <div className={`relative overflow-hidden ${viewMode === 'list' ? 'w-48' : 'aspect-square'}`}>
                      <img
                        src={getProductImageUrl(product.image_filenames[0])}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />

                      {product.sale_price && (
                        <div className="absolute top-4 left-4 bg-red-500 text-white px-2 py-1 rounded text-sm font-medium">
                          Sale
                        </div>
                      )}

                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          toggleWishlist(product);
                        }}
                        className="absolute top-4 right-4 p-2 bg-white bg-opacity-80 rounded-full hover:bg-opacity-100 transition-all duration-200"
                        title={isWishlisted(product.id) ? 'Remove from wishlist' : 'Add to wishlist'}
                      >
                        <Heart
                          className={`w-4 h-4 ${
                            isWishlisted(product.id) ? 'text-red-500 fill-current' : 'text-gray-600'
                          }`}
                        />
                      </button>

                      {product.stock_qty === 0 && (
                        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                          <span className="text-white font-semibold">Out of Stock</span>
                        </div>
                      )}
                    </div>

                    <div className={`p-6 ${viewMode === 'list' ? 'flex-1' : ''}`}>
                      <Link to={`/product/${product.id}`} className="block mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-amber-600 transition-colors">
                          {product.name}
                        </h3>
                      </Link>

                      {product.brand && (
                        <div className="flex items-center mb-3">
                          <Star className="w-4 h-4 text-amber-400 fill-current" />
                          <span className="ml-1 text-sm text-gray-600">{product.brand}</span>
                        </div>
                      )}

                      <div className="flex items-center mb-4">
                        <span className="text-2xl font-bold text-gray-900">
                          ${effectivePrice(product).toFixed(2)}
                        </span>
                        {product.sale_price && (
                          <span className="ml-2 text-lg text-gray-500 line-through">
                            ${Number(product.price).toFixed(2)}
                          </span>
                        )}
                      </div>

                      {viewMode === 'list' && (
                        <p className="text-gray-600 mb-4">{product.short_description}</p>
                      )}

                      <Link
                        to={`/product/${product.id}`}
                        className="w-full bg-amber-600 text-white py-2 px-4 rounded-lg hover:bg-amber-700 transition-colors font-medium text-center block"
                      >
                        View Details
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

              {filteredProducts.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500 text-lg">No products found matching your criteria.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductListingPage;
