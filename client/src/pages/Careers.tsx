import React from 'react';
import { Link } from 'react-router-dom';
import {
  FileText, Briefcase, MapPin, Clock, DollarSign, Users, Heart, Zap,
  Globe, Coffee, GraduationCap, Plane, ArrowRight, Building2
} from 'lucide-react';

const Careers: React.FC = () => {
  const benefits = [
    { icon: DollarSign, title: 'Competitive Salary', description: 'Top-tier compensation packages' },
    { icon: Heart, title: 'Health Benefits', description: 'Full medical, dental, and vision' },
    { icon: Plane, title: 'Unlimited PTO', description: 'Take time when you need it' },
    { icon: Globe, title: 'Remote First', description: 'Work from anywhere in the US' },
    { icon: GraduationCap, title: 'Learning Budget', description: '$2,000 annual education stipend' },
    { icon: Coffee, title: 'Home Office', description: '$1,000 setup allowance' }
  ];

  const openPositions = [
    {
      title: 'Senior Full-Stack Engineer',
      department: 'Engineering',
      location: 'Remote (US)',
      type: 'Full-time',
      salary: '$150K - $200K'
    },
    {
      title: 'Machine Learning Engineer',
      department: 'AI/ML',
      location: 'Remote (US)',
      type: 'Full-time',
      salary: '$160K - $220K'
    },
    {
      title: 'Product Manager',
      department: 'Product',
      location: 'Washington, DC',
      type: 'Full-time',
      salary: '$130K - $170K'
    },
    {
      title: 'Senior DevOps Engineer',
      department: 'Engineering',
      location: 'Remote (US)',
      type: 'Full-time',
      salary: '$140K - $180K'
    },
    {
      title: 'Government Contracts Specialist',
      department: 'Operations',
      location: 'Washington, DC',
      type: 'Full-time',
      salary: '$90K - $120K'
    },
    {
      title: 'Customer Success Manager',
      department: 'Customer Success',
      location: 'Remote (US)',
      type: 'Full-time',
      salary: '$80K - $110K'
    },
    {
      title: 'UX/UI Designer',
      department: 'Design',
      location: 'Remote (US)',
      type: 'Full-time',
      salary: '$100K - $140K'
    },
    {
      title: 'Sales Development Representative',
      department: 'Sales',
      location: 'Remote (US)',
      type: 'Full-time',
      salary: '$60K - $80K + Commission'
    }
  ];

  const values = [
    {
      icon: Zap,
      title: 'Move Fast',
      description: 'We ship quickly and iterate based on feedback. Perfect is the enemy of good.'
    },
    {
      icon: Users,
      title: 'Customer Obsessed',
      description: 'Every decision starts with the question: "How does this help our customers win?"'
    },
    {
      icon: Heart,
      title: 'Own It',
      description: 'We take ownership of our work and see things through to completion.'
    },
    {
      icon: Globe,
      title: 'Think Big',
      description: 'We\'re building the future of government contracting. Dream big.'
    }
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
      <section className="py-20 bg-gradient-to-b from-purple-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center px-4 py-2 bg-purple-100 rounded-full text-purple-700 text-sm font-medium mb-6">
            <Briefcase className="w-4 h-4 mr-2" />
            We're Hiring!
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Build the Future of Government Contracting
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
            Join our mission to democratize access to $700 billion in federal contracts.
            We're looking for passionate people who want to make a real impact.
          </p>
          <a
            href="#positions"
            className="inline-flex items-center px-8 py-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            View Open Positions
            <ArrowRight className="ml-2 w-5 h-5" />
          </a>
        </div>
      </section>

      {/* Company Values */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Our Values</h2>
            <p className="text-xl text-gray-600">The principles that guide how we work</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <value.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{value.title}</h3>
                <p className="text-gray-600">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Benefits & Perks</h2>
            <p className="text-xl text-gray-600">We take care of our team</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((benefit, index) => (
              <div key={index} className="bg-white rounded-xl p-6 border border-gray-100 flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <benefit.icon className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">{benefit.title}</h3>
                  <p className="text-gray-600 text-sm">{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Open Positions */}
      <section id="positions" className="py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Open Positions</h2>
            <p className="text-xl text-gray-600">{openPositions.length} open roles across all teams</p>
          </div>
          <div className="space-y-4">
            {openPositions.map((position, index) => (
              <div
                key={index}
                className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg hover:border-blue-100 transition-all cursor-pointer group"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {position.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-4 h-4" />
                        {position.department}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {position.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {position.type}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-green-600 font-medium">{position.salary}</span>
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2">
                      Apply
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* No Matching Role */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-6">Don't See a Perfect Fit?</h2>
          <p className="text-xl text-blue-100 mb-8">
            We're always looking for talented people. Send us your resume and let's talk.
          </p>
          <a
            href="mailto:careers@govcontractsai.com"
            className="inline-flex items-center px-8 py-4 bg-white text-blue-600 rounded-xl font-semibold hover:bg-blue-50 transition-colors"
          >
            careers@govcontractsai.com
          </a>
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

export default Careers;
