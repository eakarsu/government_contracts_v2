import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, Shield, Lock, Server, Eye, Key, CheckCircle, AlertTriangle, Cloud, Users } from 'lucide-react';

const Security: React.FC = () => {
  const securityFeatures = [
    {
      icon: Lock,
      title: 'End-to-End Encryption',
      description: 'All data is encrypted in transit using TLS 1.3 and at rest using AES-256 encryption.'
    },
    {
      icon: Server,
      title: 'Secure Infrastructure',
      description: 'Hosted on enterprise-grade cloud infrastructure with 99.99% uptime SLA.'
    },
    {
      icon: Key,
      title: 'Access Control',
      description: 'Role-based access control (RBAC) and multi-factor authentication for all accounts.'
    },
    {
      icon: Eye,
      title: '24/7 Monitoring',
      description: 'Continuous security monitoring and threat detection across all systems.'
    },
    {
      icon: Cloud,
      title: 'Regular Backups',
      description: 'Automated daily backups with point-in-time recovery capabilities.'
    },
    {
      icon: Users,
      title: 'Employee Security',
      description: 'Background checks and regular security training for all team members.'
    }
  ];

  const certifications = [
    { name: 'SOC 2 Type II', description: 'Audited security controls', status: 'certified' },
    { name: 'ISO 27001', description: 'Information security management', status: 'in-progress' },
    { name: 'GDPR Compliant', description: 'European data protection', status: 'certified' },
    { name: 'CCPA Compliant', description: 'California privacy rights', status: 'certified' }
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
      <section className="py-20 bg-gradient-to-b from-green-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Shield className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Enterprise-Grade Security
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Your data security is our top priority. We implement industry-leading security
            measures to protect your sensitive government contracting information.
          </p>
        </div>
      </section>

      {/* Security Features */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">How We Protect Your Data</h2>
            <p className="text-xl text-gray-600">Multiple layers of security at every level</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {securityFeatures.map((feature, index) => (
              <div key={index} className="bg-white rounded-xl p-8 border border-gray-100 hover:shadow-lg transition-shadow">
                <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center mb-6">
                  <feature.icon className="w-7 h-7 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Certifications */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Certifications & Compliance</h2>
            <p className="text-xl text-gray-600">Meeting the highest industry standards</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {certifications.map((cert, index) => (
              <div key={index} className="bg-white rounded-xl p-6 text-center border border-gray-100">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                  cert.status === 'certified' ? 'bg-green-100' : 'bg-yellow-100'
                }`}>
                  {cert.status === 'certified' ? (
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  ) : (
                    <AlertTriangle className="w-8 h-8 text-yellow-600" />
                  )}
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{cert.name}</h3>
                <p className="text-sm text-gray-500 mb-2">{cert.description}</p>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                  cert.status === 'certified'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {cert.status === 'certified' ? 'Certified' : 'In Progress'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Practices */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Our Security Practices</h2>
          <div className="space-y-6">
            {[
              {
                title: 'Regular Security Audits',
                content: 'We conduct annual third-party penetration testing and quarterly vulnerability assessments to identify and address potential security issues.'
              },
              {
                title: 'Incident Response',
                content: 'Our dedicated security team maintains a 24/7 incident response capability with defined procedures for detecting, responding to, and recovering from security incidents.'
              },
              {
                title: 'Data Privacy',
                content: 'We follow data minimization principles, collecting only the data necessary to provide our services. All personal data is processed in accordance with GDPR and CCPA requirements.'
              },
              {
                title: 'Vendor Security',
                content: 'All third-party vendors undergo rigorous security assessments before integration. We maintain a comprehensive vendor risk management program.'
              },
              {
                title: 'Business Continuity',
                content: 'We maintain disaster recovery and business continuity plans with regular testing to ensure service availability even in adverse conditions.'
              }
            ].map((item, index) => (
              <div key={index} className="bg-white rounded-xl p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600">{item.content}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Report Vulnerability */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-6">Report a Security Vulnerability</h2>
          <p className="text-xl text-blue-100 mb-8">
            We take security seriously. If you've discovered a vulnerability, please let us know responsibly.
          </p>
          <a
            href="mailto:security@govcontractsai.com"
            className="inline-flex items-center px-8 py-4 bg-white text-blue-600 rounded-xl font-semibold hover:bg-blue-50 transition-colors"
          >
            security@govcontractsai.com
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

export default Security;
