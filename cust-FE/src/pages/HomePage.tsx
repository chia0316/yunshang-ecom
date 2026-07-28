import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Star, Play } from 'lucide-react';
import { apiFetch } from '../lib/api';
import type { Category } from '../lib/types';

const CATEGORY_IMAGES = [
  'https://images.pexels.com/photos/1080721/pexels-photo-1080721.jpeg?auto=compress&cs=tinysrgb&w=500',
  'https://images.pexels.com/photos/271624/pexels-photo-271624.jpeg?auto=compress&cs=tinysrgb&w=500',
  'https://images.pexels.com/photos/1099816/pexels-photo-1099816.jpeg?auto=compress&cs=tinysrgb&w=500',
  'https://images.pexels.com/photos/667838/pexels-photo-667838.jpeg?auto=compress&cs=tinysrgb&w=500',
];

const HomePage: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    apiFetch<Category[]>('/api/category', { auth: false }).then(setCategories);
  }, []);

  const promos = [
    {
      title: 'Summer Sale',
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
      name: 'Sarah Johnson',
      rating: 5,
      comment: 'Amazing quality furniture! The delivery was quick and the sofa is exactly as pictured.',
      product: 'Modern Sectional Sofa',
    },
    {
      name: 'Michael Chen',
      rating: 5,
      comment: 'Love the dining table I purchased. Great craftsmanship and excellent customer service.',
      product: 'Oak Dining Table',
    },
    {
      name: 'Emily Davis',
      rating: 5,
      comment: 'The bedroom set exceeded my expectations. Beautiful design and very comfortable.',
      product: 'Platform Bed Frame',
    },
  ];

  return (
    <div className="space-y-16">
      {/* Hero Video Banner */}
      <section className="relative h-screen bg-gray-900 overflow-hidden">
        <div className="absolute inset-0 bg-black bg-opacity-40 z-10"></div>
        
        {/* Video Background Placeholder */}
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: 'url(https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=1600)',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent"></div>
        </div>
        
        <div className="relative z-20 h-full flex items-center justify-center text-center text-white px-4">
          <div className="max-w-4xl">
            {/* Play Button Overlay */}
            <div className="mb-8">
              <button className="inline-flex items-center justify-center w-20 h-20 bg-white bg-opacity-20 backdrop-blur-sm rounded-full hover:bg-opacity-30 transition-all duration-300 group">
                <Play className="w-8 h-8 text-white ml-1 group-hover:scale-110 transition-transform" fill="currentColor" />
              </button>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              Crafted for
              <span className="block text-amber-400">Modern Living</span>
            </h1>
            
            <p className="text-xl md:text-2xl mb-8 text-gray-200 max-w-2xl mx-auto leading-relaxed">
              Discover our curated collection of premium furniture designed to transform your space into a haven of comfort and style.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/products"
                className="inline-flex items-center px-8 py-4 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-semibold text-lg group"
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
          {categories.map((category, index) => (
            <Link
              key={category.id}
              to={`/products/${category.id}`}
              className="group relative overflow-hidden rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <div className="aspect-square">
                <img
                  src={CATEGORY_IMAGES[index % CATEGORY_IMAGES.length]}
                  alt={category.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                <div className="absolute bottom-4 left-4 right-4">
                  <h3 className="text-white text-2xl font-bold mb-2">{category.name}</h3>
                  <span className="text-amber-400 font-medium group-hover:text-amber-300 transition-colors">
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
                    <button className="inline-flex items-center px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-semibold">
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
      <section className="bg-amber-600 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Transform Your Space?
          </h2>
          <p className="text-xl text-amber-100 mb-8 max-w-2xl mx-auto">
            Browse our complete collection and find the perfect pieces for your home today.
          </p>
          <Link
            to="/products"
            className="inline-flex items-center px-8 py-4 bg-white text-amber-600 rounded-lg hover:bg-gray-100 transition-colors font-semibold text-lg group"
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
            className="inline-flex items-center px-6 py-3 border-2 border-amber-600 text-amber-600 rounded-lg hover:bg-amber-600 hover:text-white transition-colors font-semibold"
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