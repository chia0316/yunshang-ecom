import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Star } from 'lucide-react';
import { apiFetch } from '../lib/api';
import type { Category } from '../lib/types';

// Homepage "Shop by Category" is a fixed, curated set (not every category in
// the catalog) — matched against Category.name from the API.
const FEATURED_CATEGORIES = [
  { name: 'Beds', image: 'https://images.pexels.com/photos/2029694/pexels-photo-2029694.jpeg?auto=compress&cs=tinysrgb&w=500' },
  { name: 'Sofas', image: 'https://images.pexels.com/photos/6438748/pexels-photo-6438748.jpeg?auto=compress&cs=tinysrgb&w=500' },
  { name: 'Dining Furniture', image: 'https://images.pexels.com/photos/11125359/pexels-photo-11125359.jpeg?auto=compress&cs=tinysrgb&w=500' },
  { name: 'Mobility Aids', image: 'https://images.pexels.com/photos/8543059/pexels-photo-8543059.jpeg?auto=compress&cs=tinysrgb&w=500' },
];

const HomePage: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    apiFetch<Category[]>('/api/category', { auth: false }).then(setCategories);
  }, []);

  // Always shows all 4 cards, even if a name isn't found in the API yet
  // (e.g. categories not seeded on a fresh environment) — falls back to
  // linking at the unfiltered product listing instead of disappearing.
  const featuredCategories = FEATURED_CATEGORIES.map((featured) => ({
    ...featured,
    category: categories.find((c) => c.name === featured.name),
  }));

  const promos = [
    {
      title: 'Opening Sales',
      description: 'Up to 40% off on selected items',
      image: 'https://images.pexels.com/photos/1350789/pexels-photo-1350789.jpeg?auto=compress&cs=tinysrgb&w=800',
      cta: 'Shop Now',
    },
    {
      title: 'New Collection',
      description: 'Modern minimalist designs',
      image: 'https://images.pexels.com/photos/2029698/pexels-photo-2029698.jpeg?auto=compress&cs=tinysrgb&w=800',
      cta: 'Explore',
    },
  ];

  const reviews = [
    {
      name: 'Mr Tan',
      rating: 5,
      comment:
        "Bought this for my elderly father who needs help turning regularly. The flip function is smooth and at a nice, gentle pace — doesn't jolt him at all. Really eases the burden of manual repositioning, and he seems much more comfortable now. Would recommend to anyone caring for elderly parents.",
      product: 'Electrical Flipping Bed (Single)',
    },
    {
      name: 'Ms L.',
      rating: 5,
      comment:
        "I sleep so much more soundly since switching to this bed. My favourite feature is being able to angle it up slightly when I'm browsing my phone before sleep — much better for my neck than propping up on pillows. Great investment for the bedroom.",
      product: 'Yoga Electrical Bed (King Size)',
    },
    {
      name: 'Mr Chan',
      rating: 5,
      comment:
        "After a long day at work, this is exactly what I needed. I sit down for what's supposed to be a quick rest and end up dozing off — it's that comfortable. The Solana leather feels great too. Highly recommend for anyone who wants to properly unwind at home.",
      product: 'Sofa - CL398 Long (Solana 6201)',
    },
  ];

  return (
    <div className="space-y-16">
      {/* Hero Banner */}
      <section className="relative h-screen bg-gray-900 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: 'url(/banner/hero-red-chair.png)',
          }}
        >
          {/* Only darkens the left side, where the text sits — the right
              side (chair) stays at full brightness. */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/20 to-transparent"></div>
        </div>
        
        <div className="relative z-20 h-full flex items-center justify-center text-center text-white px-4">
          <div className="max-w-4xl">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              Crafted for
              <span className="block text-terracotta-400">Modern Living</span>
            </h1>
            
            <p className="text-xl md:text-2xl mb-8 text-white max-w-2xl mx-auto leading-relaxed">
              Discover our curated collection of premium furniture designed to transform your space into a haven of comfort and style.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/products"
                className="inline-flex items-center px-8 py-4 bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors font-semibold text-lg group"
              >
                Shop Collection
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              
              <Link
                to="/products"
                className="inline-flex items-center px-8 py-4 border-2 border-white text-white rounded-lg hover:bg-white hover:text-gray-900 transition-colors font-semibold text-lg"
              >
                Explore Catalog
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Shop by Category</h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Find the perfect pieces for every room in your home
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {featuredCategories.map(({ category, image, name }) => (
            <Link
              key={name}
              to={category ? `/products/${category.id}` : '/products'}
              className="group relative overflow-hidden rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <div className="aspect-square">
                <img
                  src={image}
                  alt={name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                <div className="absolute bottom-4 left-4 right-4">
                  <h3 className="text-white text-2xl font-bold mb-2">{name}</h3>
                  <span className="text-terracotta-400 font-medium group-hover:text-terracotta-300 transition-colors">
                    Explore Collection →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Promo Banners */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {promos.map((promo, index) => (
            <div
              key={index}
              className="relative overflow-hidden rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 group cursor-pointer"
            >
              <div className="aspect-[16/9]">
                <img
                  src={promo.image}
                  alt={promo.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent"></div>
                <div className="absolute inset-0 flex items-center">
                  <div className="p-8 text-white">
                    <h3 className="text-3xl md:text-4xl font-bold mb-3">{promo.title}</h3>
                    <p className="text-lg md:text-xl mb-6 text-gray-200">{promo.description}</p>
                    <button className="inline-flex items-center px-6 py-3 bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors font-semibold">
                      {promo.cta}
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Customer Reviews */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">What Our Customers Say</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Real reviews from real customers who love their Casa Yun furniture
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {reviews.map((review, index) => (
              <div
                key={index}
                className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <div className="flex items-center mb-4">
                  {[...Array(review.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-amber-400 fill-current" />
                  ))}
                </div>
                
                <p className="text-gray-700 mb-6 leading-relaxed">{review.comment}</p>
                
                <div className="border-t pt-4">
                  <p className="font-semibold text-gray-900">{review.name}</p>
                  <p className="text-sm text-gray-500">Purchased: {review.product}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-terracotta-600 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Transform Your Space?
          </h2>
          <p className="text-xl text-terracotta-100 mb-8 max-w-2xl mx-auto">
            Browse our complete collection and find the perfect pieces for your home today.
          </p>
          <Link
            to="/products"
            className="inline-flex items-center px-8 py-4 bg-white text-terracotta-600 rounded-lg hover:bg-gray-100 transition-colors font-semibold text-lg group"
          >
            Start Shopping
            <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </section>

      {/* Visit / Enquiry CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-10 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Prefer to See It in Person?</h2>
          <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
            Book a showroom appointment or send us a question and our team will get back to you.
          </p>
          <Link
            to="/visit-us"
            className="inline-flex items-center px-6 py-3 border-2 border-terracotta-600 text-terracotta-600 rounded-lg hover:bg-terracotta-600 hover:text-white transition-colors font-semibold"
          >
            Visit Us / Enquire
            <ArrowRight className="ml-2 w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
};

export default HomePage;