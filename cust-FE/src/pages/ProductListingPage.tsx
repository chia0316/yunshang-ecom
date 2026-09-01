import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import {
  Filter,
  Grid,
  List,
  ChevronDown,
  Star,
  Heart,
  LayoutGrid,
  UtensilsCrossed,
  BedDouble,
  Sofa,
  Lamp,
  Armchair,
  Table,
  Palette,
} from 'lucide-react';
import { apiFetch, getProductImageUrl } from '../lib/api';
import { useWishlist } from '../context/WishlistContext';
import type { Category, Product } from '../lib/types';

// Best-effort icon per category name — categories are admin-defined free
// text, so this matches on common furniture-store keywords and falls back
// to a generic grid icon rather than guessing wrong.
const getCategoryIcon = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes('dining') || n.includes('kitchen')) return UtensilsCrossed;
  if (n.includes('bed') || n.includes('mattress')) return BedDouble;
  if (n.includes('sofa') || n.includes('living') || n.includes('couch')) return Sofa;
  if (n.includes('light') || n.includes('lamp')) return Lamp;
  if (n.includes('chair') || n.includes('seat')) return Armchair;
  if (n.includes('table') || n.includes('desk')) return Table;
  if (n.includes('decor') || n.includes('art') || n.includes('mirror')) return Palette;
  return LayoutGrid;
};

// Picks black or white text for a given hex background so an admin-chosen
// featured-tag color stays readable regardless of what color was picked.
const getContrastTextColor = (hex: string) => {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return '#000000';
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#000000' : '#ffffff';
};

const ProductListingPage: React.FC = () => {
  const { categoryId } = useParams();
  const [searchParams] = useSearchParams();
  const searchText = searchParams.get('search') || '';
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
    const params = new URLSearchParams({ page_size: '100', grouped: 'true' });
    if (categoryId) params.set('category_id', categoryId);
    if (searchText) params.set('searchText', searchText);

    apiFetch<{ data: Product[] }>(`/api/products?${params.toString()}`, { auth: false })
      .then((res) => setProducts(res.data))
      .finally(() => setLoading(false));
  }, [categoryId, searchText]);

  const effectivePrice = (product: Product) =>
    product.sale_price ? Number(product.sale_price) : Number(product.price);

  const hasMultipleVariants = (product: Product) =>
    (product.variant_count || 0) > 1 && product.min_price !== product.max_price;

  const filteredProducts = products
    .slice()
    .sort((a, b) => {
      if (sortBy === 'price-low') return effectivePrice(a) - effectivePrice(b);
      if (sortBy === 'price-high') return effectivePrice(b) - effectivePrice(a);
      return 0;
    });

  const categoryName = categories.find((c) => String(c.id) === categoryId)?.name || 'All Products';
  const pageTitle = searchText ? `Search results for "${searchText}"` : categoryName;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{pageTitle}</h1>
          <p className="text-gray-600">
            {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} found
            {searchText && (
              <>
                {' '}
                — <Link to="/products" className="text-terracotta-600 hover:text-terracotta-700">Clear search</Link>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center space-x-4 mt-4 lg:mt-0">
          <div className="flex border border-gray-200 rounded-lg">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-stone-900 text-white' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-stone-900 text-white' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="appearance-none bg-white border border-gray-200 rounded-lg px-4 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
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
              <div className="space-y-1">
                <Link
                  to="/products"
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${!categoryId ? 'bg-stone-900 text-white font-medium' : 'text-gray-600 hover:bg-stone-100 hover:text-gray-900'}`}
                >
                  <LayoutGrid className="w-4 h-4 shrink-0" />
                  All Products
                </Link>
                {categories.map((cat) => {
                  const Icon = getCategoryIcon(cat.name);
                  const active = categoryId === String(cat.id);
                  return (
                    <Link
                      key={cat.id}
                      to={`/products/${cat.id}`}
                      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${active ? 'bg-stone-900 text-white font-medium' : 'text-gray-600 hover:bg-stone-100 hover:text-gray-900'}`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {cat.name}
                    </Link>
                  );
                })}
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
                    <div className={`relative overflow-hidden bg-gray-50 ${viewMode === 'list' ? 'w-48' : 'aspect-square'}`}>
                      <img
                        src={getProductImageUrl(product.image_filenames[0])}
                        alt={product.name}
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                      />

                      {(product.featured_tag || product.sale_price) && (
                        <div
                          className="absolute top-4 left-4 px-2 py-1 rounded text-sm font-medium"
                          style={
                            product.featured_tag
                              ? {
                                  backgroundColor: product.featured_tag.color,
                                  color: getContrastTextColor(product.featured_tag.color),
                                }
                              : { backgroundColor: '#ef4444', color: '#ffffff' }
                          }
                        >
                          {product.featured_tag ? product.featured_tag.label : 'Sale'}
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
                        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-terracotta-600 transition-colors">
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
                        {hasMultipleVariants(product) ? (
                          <span className="text-2xl font-bold text-gray-900">
                            From ${Number(product.min_price).toFixed(2)}
                          </span>
                        ) : (
                          <>
                            <span className="text-2xl font-bold text-gray-900">
                              ${effectivePrice(product).toFixed(2)}
                            </span>
                            {product.sale_price && (
                              <span className="ml-2 text-lg text-gray-500 line-through">
                                ${Number(product.price).toFixed(2)}
                              </span>
                            )}
                          </>
                        )}
                      </div>

                      {viewMode === 'list' && (
                        <p className="text-gray-600 mb-4">{product.short_description}</p>
                      )}

                      <Link
                        to={`/product/${product.id}`}
                        className="w-full bg-stone-900 text-white py-2 px-4 rounded-lg hover:bg-stone-800 transition-colors font-medium text-center block"
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
