import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, Users, Target, Award, Globe, Shield, ArrowRight, Linkedin, Twitter } from 'lucide-react';

const About: React.FC = () => {
  const team = [
    { name: 'Alex Thompson', role: 'CEO & Co-Founder', image: 'AT', bio: 'Former DOD contractor with 15+ years experience' },
    { name: 'Sarah Chen', role: 'CTO & Co-Founder', image: 'SC', bio: 'Ex-Google AI researcher, Stanford PhD' },
    { name: 'Michael Roberts', role: 'VP of Sales', image: 'MR', bio: '20+ years in government contracting' },
    { name: 'Emily Davis', role: 'Head of Product', image: 'ED', bio: 'Product leader from Salesforce and Oracle' }
  ];

  const values = [
    { icon: Target, title: 'Mission-Driven', description: 'We believe every qualified business deserves access to government opportunities.' },
    { icon: Shield, title: 'Trust & Security', description: 'Your data security is paramount. We maintain the highest security standards.' },
    { icon: Users, title: 'Customer First', description: 'We succeed when our customers win contracts. Your success is our success.' },
    { icon: Award, title: 'Excellence', description: 'We continuously innovate to provide the best AI-powered tools available.' }
  ];

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

      {/* Hero */}
      <section className="py-20 bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Democratizing Government Contracting with AI
          </h1>
          <p className="text-xl text-gray-600">
            We're on a mission to level the playing field for small and medium businesses
            seeking federal contracts. Our AI technology makes government contracting
            accessible, efficient, and winnable.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">Our Story</h2>
              <div className="space-y-4 text-gray-600">
                <p>
                  GovContracts AI was founded in 2023 by a team of government contracting veterans
                  and AI experts who saw a fundamental problem: small businesses were being left
                  behind in the $700 billion federal marketplace.
                </p>
                <p>
                  Large contractors had armies of business development professionals and expensive
                  tools. Small businesses were stuck manually searching SAM.gov and writing proposals
                  from scratch.
                </p>
                <p>
                  We built GovContracts AI to change that. Our platform uses advanced AI to help
                  any business find relevant opportunities, assess their win probability, and
                  generate professional proposals in minutes instead of weeks.
                </p>
                <p>
                  Today, we're proud to serve over 5,000 contractors across the country, helping
                  them win billions in government contracts.
                </p>
              </div>
            </div>
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-8 text-white">
              <Globe className="w-16 h-16 mb-6 opacity-80" />
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <div className="text-4xl font-bold">5,000+</div>
                  <div className="text-blue-200">Active Contractors</div>
                </div>
                <div>
                  <div className="text-4xl font-bold">$2.5B+</div>
                  <div className="text-blue-200">Contracts Won</div>
                </div>
                <div>
                  <div className="text-4xl font-bold">50K+</div>
                  <div className="text-blue-200">Contracts Indexed</div>
                </div>
                <div>
                  <div className="text-4xl font-bold">85%</div>
                  <div className="text-blue-200">Win Rate Increase</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Our Values</h2>
            <p className="text-xl text-gray-600">The principles that guide everything we do</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, index) => (
              <div key={index} className="bg-white rounded-xl p-6 shadow-sm">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                  <value.icon className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{value.title}</h3>
                <p className="text-gray-600 text-sm">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Leadership Team</h2>
            <p className="text-xl text-gray-600">Meet the people building the future of government contracting</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {team.map((member, index) => (
              <div key={index} className="text-center">
                <div className="w-32 h-32 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4">
                  {member.image}
                </div>
                <h3 className="text-lg font-semibold text-gray-900">{member.name}</h3>
                <p className="text-blue-600 font-medium mb-2">{member.role}</p>
                <p className="text-gray-600 text-sm">{member.bio}</p>
                <div className="flex items-center justify-center space-x-3 mt-4">
                  <a href="#" className="text-gray-400 hover:text-blue-600"><Linkedin className="w-5 h-5" /></a>
                  <a href="#" className="text-gray-400 hover:text-blue-600"><Twitter className="w-5 h-5" /></a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-6">Join Our Mission</h2>
          <p className="text-xl text-blue-100 mb-8">
            Ready to transform your government contracting business?
          </p>
          <Link
            to="/register"
            className="inline-flex items-center px-8 py-4 bg-white text-blue-600 rounded-xl font-semibold hover:bg-blue-50 transition-all"
          >
            Start Free Trial
            <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
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

export default About;
