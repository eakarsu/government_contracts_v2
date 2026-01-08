import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, Clock, ArrowRight, Tag, User, Search } from 'lucide-react';

const Blog: React.FC = () => {
  const featuredPost = {
    title: '10 AI Strategies to Increase Your Government Contract Win Rate in 2026',
    excerpt: 'Discover how artificial intelligence is revolutionizing the way small businesses compete for and win federal contracts.',
    author: 'Sarah Chen',
    date: 'January 5, 2026',
    readTime: '8 min read',
    category: 'Strategy',
    image: 'AI'
  };

  const posts = [
    {
      title: 'Understanding the New SAM.gov Updates for 2026',
      excerpt: 'A comprehensive guide to navigating the latest changes to the System for Award Management.',
      author: 'Michael Roberts',
      date: 'January 3, 2026',
      readTime: '5 min read',
      category: 'Compliance'
    },
    {
      title: 'How to Write Winning Technical Proposals',
      excerpt: 'Expert tips on crafting technical proposals that stand out from the competition.',
      author: 'Emily Davis',
      date: 'December 28, 2025',
      readTime: '7 min read',
      category: 'Proposals'
    },
    {
      title: 'Small Business Set-Asides: Your Complete Guide',
      excerpt: 'Everything you need to know about qualifying for and winning set-aside contracts.',
      author: 'Alex Thompson',
      date: 'December 20, 2025',
      readTime: '10 min read',
      category: 'Small Business'
    },
    {
      title: 'GSA Schedule: Is It Right for Your Business?',
      excerpt: 'Weighing the pros and cons of obtaining a GSA Schedule contract.',
      author: 'Sarah Chen',
      date: 'December 15, 2025',
      readTime: '6 min read',
      category: 'GSA'
    },
    {
      title: 'Building Your Past Performance Record from Scratch',
      excerpt: 'Strategies for new contractors to build credible past performance references.',
      author: 'Michael Roberts',
      date: 'December 10, 2025',
      readTime: '8 min read',
      category: 'Strategy'
    },
    {
      title: 'NAICS Codes Explained: Choosing the Right Ones',
      excerpt: 'How to select the optimal NAICS codes for your government contracting business.',
      author: 'Emily Davis',
      date: 'December 5, 2025',
      readTime: '5 min read',
      category: 'Basics'
    }
  ];

  const categories = ['All', 'Strategy', 'Proposals', 'Compliance', 'Small Business', 'GSA', 'Basics'];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">GovContracts AI</span>
            </Link>
            <div className="flex items-center space-x-6">
              <Link to="/login" className="text-gray-600 hover:text-gray-900 font-medium">Login</Link>
              <Link to="/register" className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="py-16 bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Government Contracting Blog
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Expert insights, strategies, and tips to help you win more federal contracts
            </p>
            <div className="relative max-w-xl mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search articles..."
                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-4 overflow-x-auto py-4">
            {categories.map((category, index) => (
              <button
                key={index}
                className={`px-4 py-2 rounded-full whitespace-nowrap font-medium transition-colors ${
                  index === 0 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Post */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2">
              <div className="p-8 lg:p-12 text-white">
                <div className="flex items-center space-x-2 mb-4">
                  <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium">
                    Featured
                  </span>
                  <span className="px-3 py-1 bg-white/20 rounded-full text-sm">
                    {featuredPost.category}
                  </span>
                </div>
                <h2 className="text-3xl font-bold mb-4">{featuredPost.title}</h2>
                <p className="text-blue-100 mb-6">{featuredPost.excerpt}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mr-3">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-medium">{featuredPost.author}</div>
                      <div className="text-blue-200 text-sm flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        {featuredPost.readTime}
                      </div>
                    </div>
                  </div>
                  <button className="flex items-center text-white font-medium hover:underline">
                    Read Article
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="hidden lg:flex items-center justify-center bg-blue-500/20 p-12">
                <div className="text-9xl font-bold text-white/20">{featuredPost.image}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Posts Grid */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Latest Articles</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post, index) => (
              <article
                key={index}
                className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                  <FileText className="w-12 h-12 text-gray-300" />
                </div>
                <div className="p-6">
                  <div className="flex items-center space-x-2 mb-3">
                    <span className="px-2 py-1 bg-blue-100 text-blue-600 rounded text-xs font-medium">
                      {post.category}
                    </span>
                    <span className="text-gray-400 text-sm">{post.date}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                    {post.title}
                  </h3>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">{post.excerpt}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center mr-2">
                        <User className="w-4 h-4 text-gray-500" />
                      </div>
                      <span className="text-sm text-gray-600">{post.author}</span>
                    </div>
                    <span className="text-sm text-gray-400 flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      {post.readTime}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* Load More */}
          <div className="text-center mt-12">
            <button className="px-8 py-3 border-2 border-gray-200 rounded-xl font-medium text-gray-700 hover:border-gray-300 transition-colors">
              Load More Articles
            </button>
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Subscribe to Our Newsletter
          </h2>
          <p className="text-gray-600 mb-8">
            Get the latest government contracting tips and insights delivered to your inbox weekly.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
            <input
              type="email"
              placeholder="Enter your email"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors whitespace-nowrap">
              Subscribe
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-white">GovContracts AI</span>
            </div>
            <div className="flex space-x-6 text-sm">
              <Link to="/about" className="hover:text-white">About</Link>
              <Link to="/contact" className="hover:text-white">Contact</Link>
              <Link to="/privacy" className="hover:text-white">Privacy</Link>
              <Link to="/terms" className="hover:text-white">Terms</Link>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-sm">
            &copy; {new Date().getFullYear()} GovContracts AI. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Blog;
