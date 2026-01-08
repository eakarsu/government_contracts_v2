import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search, FileText, TrendingUp, Shield, CheckCircle, ArrowRight,
  BarChart3, Users, Globe, Award, Star, ChevronRight, Play,
  Zap, Target, Clock, DollarSign, Building2, Sparkles, Trophy
} from 'lucide-react';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');

  const features = [
    {
      icon: Search,
      title: 'AI-Powered Search',
      description: 'Find relevant government contracts instantly with natural language search powered by advanced AI.'
    },
    {
      icon: TrendingUp,
      title: 'Win Probability Analysis',
      description: 'Get AI-driven predictions on your chances of winning specific contracts based on your profile.'
    },
    {
      icon: FileText,
      title: 'Proposal Generator',
      description: 'Generate professional RFP responses in minutes with our AI proposal drafter.'
    },
    {
      icon: Shield,
      title: 'Compliance Checker',
      description: 'Automatically verify your eligibility and compliance requirements for each opportunity.'
    },
    {
      icon: Target,
      title: 'Smart Matching',
      description: 'Receive personalized contract recommendations based on your capabilities and past performance.'
    },
    {
      icon: BarChart3,
      title: 'Market Intelligence',
      description: 'Access real-time market insights, competitor analysis, and agency spending trends.'
    }
  ];

  const stats = [
    { value: '50K+', label: 'Active Contracts', icon: FileText },
    { value: '$2.5T', label: 'Contract Value', icon: DollarSign },
    { value: '5,000+', label: 'Companies Trust Us', icon: Building2 },
    { value: '85%', label: 'Win Rate Increase', icon: TrendingUp }
  ];

  const testimonials = [
    {
      quote: "GovContracts AI helped us increase our win rate by 40%. The AI insights are incredibly accurate.",
      author: "Sarah Johnson",
      role: "CEO, TechDefense Solutions",
      avatar: "SJ",
      rating: 5
    },
    {
      quote: "The proposal generator alone saved us 20+ hours per bid. Game changer for small businesses.",
      author: "Michael Chen",
      role: "BD Director, Cyber Innovations",
      avatar: "MC",
      rating: 5
    },
    {
      quote: "Finally, a platform that makes government contracting accessible. Best investment we've made.",
      author: "Emily Rodriguez",
      role: "Founder, GreenTech Federal",
      avatar: "ER",
      rating: 5
    }
  ];

  const pricingPlans = [
    {
      name: 'Starter',
      price: 99,
      period: '/month',
      description: 'Perfect for small businesses getting started',
      features: [
        'Up to 100 contract searches/month',
        'Basic AI matching',
        '5 proposal drafts/month',
        'Email support',
        'Single user'
      ],
      cta: 'Start Free Trial',
      popular: false
    },
    {
      name: 'Professional',
      price: 299,
      period: '/month',
      description: 'For growing government contractors',
      features: [
        'Unlimited contract searches',
        'Advanced AI matching & scoring',
        'Unlimited proposal drafts',
        'Win probability analysis',
        'Compliance checker',
        'Priority support',
        'Up to 5 users'
      ],
      cta: 'Start Free Trial',
      popular: true
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      description: 'For large organizations',
      features: [
        'Everything in Professional',
        'Custom AI training',
        'API access',
        'Dedicated success manager',
        'SLA guarantee',
        'Unlimited users',
        'On-premise deployment option'
      ],
      cta: 'Contact Sales',
      popular: false
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm z-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">GovContracts AI</span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-600 hover:text-gray-900 font-medium">Features</a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900 font-medium">Pricing</a>
              <a href="#testimonials" className="text-gray-600 hover:text-gray-900 font-medium">Testimonials</a>
              <Link to="/login" className="text-gray-600 hover:text-gray-900 font-medium">Login</Link>
              <Link
                to="/register"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Get Started Free
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center px-4 py-2 bg-blue-100 rounded-full text-blue-700 text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4 mr-2" />
              Powered by Advanced AI Technology
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 leading-tight mb-6">
              Win More Government
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600"> Contracts</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              AI-powered platform to discover, analyze, and win federal contracts.
              From opportunity identification to proposal generation, we've got you covered.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Link
                to="/register"
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 bg-blue-600 text-white rounded-xl font-semibold text-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/30 hover:shadow-xl"
              >
                Start Free 14-Day Trial
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
              <button className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 bg-white text-gray-700 rounded-xl font-semibold text-lg border-2 border-gray-200 hover:border-gray-300 transition-all">
                <Play className="mr-2 w-5 h-5" />
                Watch Demo
              </button>
            </div>
            <p className="text-sm text-gray-500">
              No credit card required. Start searching contracts in minutes.
            </p>
          </div>

          {/* Hero Image/Dashboard Preview */}
          <div className="mt-16 relative">
            <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent z-10 pointer-events-none" />
            <div className="bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-800">
              <div className="bg-gray-800 px-4 py-3 flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <div className="p-6 bg-gradient-to-br from-gray-900 to-gray-800">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-gray-400 text-sm">Active Opportunities</span>
                      <TrendingUp className="w-4 h-4 text-green-400" />
                    </div>
                    <div className="text-2xl font-bold text-white">2,847</div>
                    <div className="text-green-400 text-sm">+12% this week</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-gray-400 text-sm">Match Score</span>
                      <Target className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="text-2xl font-bold text-white">92%</div>
                    <div className="text-blue-400 text-sm">High relevance</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-gray-400 text-sm">Win Probability</span>
                      <Award className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="text-2xl font-bold text-white">78%</div>
                    <div className="text-purple-400 text-sm">Above average</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-xl mb-4">
                  <stat.icon className="w-6 h-6 text-blue-600" />
                </div>
                <div className="text-3xl md:text-4xl font-bold text-gray-900 mb-1">{stat.value}</div>
                <div className="text-gray-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Everything You Need to Win
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Powerful AI tools designed specifically for government contractors
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-lg hover:border-blue-100 transition-all group"
              >
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Get Started in Minutes
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Three simple steps to transform your government contracting
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              {
                step: '01',
                title: 'Create Your Profile',
                description: 'Enter your company capabilities, certifications, and past performance. Our AI learns what contracts fit you best.',
                icon: Users
              },
              {
                step: '02',
                title: 'Discover Opportunities',
                description: 'Get personalized contract recommendations with AI-powered matching and win probability scores.',
                icon: Search
              },
              {
                step: '03',
                title: 'Win Contracts',
                description: 'Use our AI proposal generator and compliance tools to submit winning bids faster than ever.',
                icon: Trophy
              }
            ].map((item, index) => (
              <div key={index} className="relative">
                <div className="text-7xl font-bold text-gray-100 absolute -top-4 left-0">{item.step}</div>
                <div className="relative pt-12">
                  <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center mb-6">
                    <item.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">{item.title}</h3>
                  <p className="text-gray-600">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-24 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Trusted by Contractors Nationwide
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              See how companies are winning more contracts with our platform
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100"
              >
                <div className="flex items-center mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-600 mb-6 italic">"{testimonial.quote}"</p>
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold">
                    {testimonial.avatar}
                  </div>
                  <div className="ml-4">
                    <div className="font-semibold text-gray-900">{testimonial.author}</div>
                    <div className="text-sm text-gray-500">{testimonial.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Choose the plan that fits your business. All plans include a 14-day free trial.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {pricingPlans.map((plan, index) => (
              <div
                key={index}
                className={`rounded-2xl p-8 ${
                  plan.popular
                    ? 'bg-blue-600 text-white ring-4 ring-blue-600 ring-offset-2 scale-105'
                    : 'bg-white border-2 border-gray-100'
                }`}
              >
                {plan.popular && (
                  <div className="text-sm font-medium bg-blue-500 text-white px-3 py-1 rounded-full inline-block mb-4">
                    Most Popular
                  </div>
                )}
                <h3 className={`text-2xl font-bold mb-2 ${plan.popular ? 'text-white' : 'text-gray-900'}`}>
                  {plan.name}
                </h3>
                <p className={`text-sm mb-6 ${plan.popular ? 'text-blue-100' : 'text-gray-500'}`}>
                  {plan.description}
                </p>
                <div className="mb-6">
                  <span className={`text-4xl font-bold ${plan.popular ? 'text-white' : 'text-gray-900'}`}>
                    {typeof plan.price === 'number' ? `$${plan.price}` : plan.price}
                  </span>
                  <span className={plan.popular ? 'text-blue-100' : 'text-gray-500'}>{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, fIndex) => (
                    <li key={fIndex} className="flex items-start">
                      <CheckCircle className={`w-5 h-5 mr-3 mt-0.5 flex-shrink-0 ${plan.popular ? 'text-blue-200' : 'text-green-500'}`} />
                      <span className={plan.popular ? 'text-blue-50' : 'text-gray-600'}>{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => navigate('/register')}
                  className={`w-full py-3 rounded-xl font-semibold transition-all ${
                    plan.popular
                      ? 'bg-white text-blue-600 hover:bg-blue-50'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-r from-blue-600 to-indigo-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Win More Government Contracts?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of contractors using AI to find and win federal opportunities.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="w-full sm:w-80 px-6 py-4 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-white/30"
            />
            <button
              onClick={() => navigate(`/register?email=${encodeURIComponent(email)}`)}
              className="w-full sm:w-auto px-8 py-4 bg-white text-blue-600 rounded-xl font-semibold hover:bg-blue-50 transition-all flex items-center justify-center"
            >
              Get Started Free
              <ChevronRight className="ml-2 w-5 h-5" />
            </button>
          </div>
          <p className="text-blue-200 text-sm mt-4">
            14-day free trial. No credit card required.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold text-white">GovContracts AI</span>
              </div>
              <p className="text-gray-400 text-sm">
                AI-powered platform for discovering and winning government contracts.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><Link to="/api-docs" className="hover:text-white transition-colors">API Documentation</Link></li>
                <li><a href="#" className="hover:text-white transition-colors">Integrations</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/about" className="hover:text-white transition-colors">About</Link></li>
                <li><Link to="/blog" className="hover:text-white transition-colors">Blog</Link></li>
                <li><Link to="/careers" className="hover:text-white transition-colors">Careers</Link></li>
                <li><Link to="/contact" className="hover:text-white transition-colors">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/legal" className="hover:text-white transition-colors">Legal</Link></li>
                <li><Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link></li>
                <li><Link to="/terms" className="hover:text-white transition-colors">Terms</Link></li>
                <li><Link to="/security" className="hover:text-white transition-colors">Security</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>&copy; {new Date().getFullYear()} GovContracts AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
