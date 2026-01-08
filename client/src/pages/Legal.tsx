import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, Scale, Shield, FileCheck, AlertTriangle, Gavel, BookOpen } from 'lucide-react';

const Legal: React.FC = () => {
  const legalDocuments = [
    {
      icon: FileCheck,
      title: 'Terms of Service',
      description: 'The rules and guidelines for using our platform',
      link: '/terms',
      updated: 'January 1, 2026'
    },
    {
      icon: Shield,
      title: 'Privacy Policy',
      description: 'How we collect, use, and protect your data',
      link: '/privacy',
      updated: 'January 1, 2026'
    },
    {
      icon: Scale,
      title: 'Acceptable Use Policy',
      description: 'Guidelines for appropriate use of our services',
      link: '#',
      updated: 'January 1, 2026'
    },
    {
      icon: AlertTriangle,
      title: 'Security Policy',
      description: 'Our commitment to protecting your information',
      link: '/security',
      updated: 'January 1, 2026'
    },
    {
      icon: Gavel,
      title: 'Cookie Policy',
      description: 'How we use cookies and similar technologies',
      link: '#',
      updated: 'January 1, 2026'
    },
    {
      icon: BookOpen,
      title: 'DMCA Policy',
      description: 'Digital Millennium Copyright Act compliance',
      link: '#',
      updated: 'January 1, 2026'
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

      {/* Header */}
      <section className="py-16 bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Scale className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Legal Information</h1>
          <p className="text-xl text-gray-600">
            Review our legal documents, policies, and compliance information
          </p>
        </div>
      </section>

      {/* Legal Documents Grid */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {legalDocuments.map((doc, index) => (
              <Link
                key={index}
                to={doc.link}
                className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg hover:border-blue-100 transition-all group"
              >
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-600 transition-colors">
                  <doc.icon className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{doc.title}</h3>
                <p className="text-gray-600 text-sm mb-4">{doc.description}</p>
                <p className="text-xs text-gray-400">Last updated: {doc.updated}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Compliance Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Compliance & Certifications</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { name: 'SOC 2 Type II', status: 'Certified' },
              { name: 'GDPR', status: 'Compliant' },
              { name: 'CCPA', status: 'Compliant' },
              { name: 'ISO 27001', status: 'In Progress' }
            ].map((cert, index) => (
              <div key={index} className="bg-white rounded-xl p-6 text-center border border-gray-100">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Shield className="w-6 h-6 text-green-600" />
                </div>
                <div className="font-semibold text-gray-900">{cert.name}</div>
                <div className="text-sm text-green-600">{cert.status}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Legal */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Questions About Our Policies?</h2>
          <p className="text-gray-600 mb-8">
            Our legal team is here to help with any questions about our terms, privacy practices, or compliance.
          </p>
          <a
            href="mailto:legal@govcontractsai.com"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            Contact Legal Team
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

export default Legal;
