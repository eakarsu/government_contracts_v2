import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, Shield, Lock, Eye, Database, Globe, Mail } from 'lucide-react';

const Privacy: React.FC = () => {
  const lastUpdated = 'January 1, 2026';

  const sections = [
    {
      icon: Database,
      title: 'Information We Collect',
      content: [
        'Account information (name, email, company details)',
        'Usage data and analytics',
        'Contract search history and preferences',
        'Proposal drafts and documents you upload',
        'Payment and billing information',
        'Communications with our support team'
      ]
    },
    {
      icon: Eye,
      title: 'How We Use Your Information',
      content: [
        'Provide and improve our services',
        'Personalize your contract recommendations',
        'Process payments and manage subscriptions',
        'Send important service updates',
        'Analyze usage patterns to improve our AI',
        'Comply with legal obligations'
      ]
    },
    {
      icon: Lock,
      title: 'Data Security',
      content: [
        'AES-256 encryption for data at rest',
        'TLS 1.3 for data in transit',
        'Regular security audits and penetration testing',
        'SOC 2 Type II compliance',
        'Multi-factor authentication available',
        'Regular employee security training'
      ]
    },
    {
      icon: Globe,
      title: 'Data Sharing',
      content: [
        'We never sell your personal data',
        'Limited sharing with service providers',
        'May share anonymized, aggregate data',
        'Legal compliance when required by law',
        'Business transfers with your consent'
      ]
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
            <Shield className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Privacy Policy</h1>
          <p className="text-gray-600">Last updated: {lastUpdated}</p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="prose prose-lg max-w-none">
            <p className="text-gray-600 mb-8">
              At GovContracts AI, we take your privacy seriously. This Privacy Policy explains how we collect,
              use, disclose, and safeguard your information when you use our platform. Please read this
              privacy policy carefully.
            </p>

            {sections.map((section, index) => (
              <div key={index} className="mb-12">
                <div className="flex items-center mb-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mr-4">
                    <section.icon className="w-5 h-5 text-blue-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">{section.title}</h2>
                </div>
                <ul className="space-y-2 ml-14">
                  {section.content.map((item, i) => (
                    <li key={i} className="text-gray-600 flex items-start">
                      <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Rights</h2>
              <p className="text-gray-600 mb-4">
                Depending on your location, you may have the following rights regarding your personal data:
              </p>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0" />
                  Right to access your personal data
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0" />
                  Right to correct inaccurate data
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0" />
                  Right to delete your data
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0" />
                  Right to export your data
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0" />
                  Right to opt-out of marketing communications
                </li>
              </ul>
            </div>

            <div className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Cookies</h2>
              <p className="text-gray-600">
                We use cookies and similar tracking technologies to enhance your experience on our platform.
                These include essential cookies for functionality, analytics cookies to understand usage patterns,
                and preference cookies to remember your settings. You can control cookie preferences through
                your browser settings.
              </p>
            </div>

            <div className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Children's Privacy</h2>
              <p className="text-gray-600">
                Our services are not intended for individuals under 18 years of age. We do not knowingly
                collect personal information from children. If you believe we have collected information
                from a child, please contact us immediately.
              </p>
            </div>

            <div className="bg-blue-50 rounded-2xl p-8">
              <div className="flex items-start">
                <Mail className="w-6 h-6 text-blue-600 mr-4 mt-1" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Questions or Concerns?</h3>
                  <p className="text-gray-600 mb-4">
                    If you have any questions about this Privacy Policy or our data practices,
                    please contact our Privacy Team.
                  </p>
                  <a
                    href="mailto:privacy@govcontractsai.com"
                    className="text-blue-600 font-medium hover:text-blue-700"
                  >
                    privacy@govcontractsai.com
                  </a>
                </div>
              </div>
            </div>
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

export default Privacy;
