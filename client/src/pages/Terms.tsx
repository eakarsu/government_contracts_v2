import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, Scale, AlertTriangle, CreditCard, Shield, Ban, Mail } from 'lucide-react';

const Terms: React.FC = () => {
  const lastUpdated = 'January 1, 2026';

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
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Terms of Service</h1>
          <p className="text-gray-600">Last updated: {lastUpdated}</p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="prose prose-lg max-w-none">
            <p className="text-gray-600 mb-8">
              Welcome to GovContracts AI. By accessing or using our platform, you agree to be bound by these
              Terms of Service. Please read them carefully before using our services.
            </p>

            <div className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Acceptance of Terms</h2>
              <p className="text-gray-600">
                By creating an account or using GovContracts AI, you agree to these Terms of Service and our
                Privacy Policy. If you are using our services on behalf of an organization, you represent that
                you have the authority to bind that organization to these terms.
              </p>
            </div>

            <div className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Description of Services</h2>
              <p className="text-gray-600 mb-4">
                GovContracts AI provides an AI-powered platform for:
              </p>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0" />
                  Searching and discovering government contract opportunities
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0" />
                  Analyzing win probability and contract fit
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0" />
                  Generating proposal drafts and documents
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0" />
                  Checking compliance requirements
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0" />
                  Providing market intelligence and analytics
                </li>
              </ul>
            </div>

            <div className="mb-12">
              <div className="flex items-center mb-4">
                <CreditCard className="w-6 h-6 text-blue-600 mr-3" />
                <h2 className="text-2xl font-bold text-gray-900">3. Billing and Payments</h2>
              </div>
              <ul className="space-y-3 text-gray-600">
                <li>Subscription fees are billed in advance on a monthly or annual basis</li>
                <li>All fees are non-refundable unless otherwise stated</li>
                <li>You authorize us to charge your payment method for all fees</li>
                <li>Prices may change with 30 days notice</li>
                <li>Failed payments may result in service suspension</li>
              </ul>
            </div>

            <div className="mb-12">
              <div className="flex items-center mb-4">
                <Shield className="w-6 h-6 text-blue-600 mr-3" />
                <h2 className="text-2xl font-bold text-gray-900">4. User Responsibilities</h2>
              </div>
              <p className="text-gray-600 mb-4">You agree to:</p>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0" />
                  Provide accurate and complete information
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0" />
                  Maintain the security of your account credentials
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0" />
                  Use the services only for lawful purposes
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0" />
                  Not share account access with unauthorized users
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0" />
                  Comply with all applicable laws and regulations
                </li>
              </ul>
            </div>

            <div className="mb-12">
              <div className="flex items-center mb-4">
                <Ban className="w-6 h-6 text-red-600 mr-3" />
                <h2 className="text-2xl font-bold text-gray-900">5. Prohibited Uses</h2>
              </div>
              <p className="text-gray-600 mb-4">You may not:</p>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-red-600 rounded-full mt-2 mr-3 flex-shrink-0" />
                  Attempt to reverse engineer or copy our AI technology
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-red-600 rounded-full mt-2 mr-3 flex-shrink-0" />
                  Use automated systems to scrape or extract data
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-red-600 rounded-full mt-2 mr-3 flex-shrink-0" />
                  Resell or redistribute our services without authorization
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-red-600 rounded-full mt-2 mr-3 flex-shrink-0" />
                  Submit false or misleading information
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-red-600 rounded-full mt-2 mr-3 flex-shrink-0" />
                  Interfere with the operation of our services
                </li>
              </ul>
            </div>

            <div className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Intellectual Property</h2>
              <p className="text-gray-600">
                All content, features, and functionality of GovContracts AI, including but not limited to
                our AI algorithms, software, text, graphics, and logos, are owned by GovContracts AI and
                protected by intellectual property laws. You retain ownership of content you submit to our
                platform.
              </p>
            </div>

            <div className="mb-12 bg-yellow-50 border border-yellow-200 rounded-2xl p-6">
              <div className="flex items-start">
                <AlertTriangle className="w-6 h-6 text-yellow-600 mr-4 mt-1" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">7. Disclaimer of Warranties</h3>
                  <p className="text-gray-600">
                    Our services are provided "as is" without warranties of any kind. While our AI provides
                    analysis and recommendations, we do not guarantee contract wins or specific outcomes.
                    Users are responsible for verifying all information and making their own business decisions.
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Limitation of Liability</h2>
              <p className="text-gray-600">
                GovContracts AI shall not be liable for any indirect, incidental, special, consequential,
                or punitive damages resulting from your use of our services. Our total liability shall not
                exceed the amount paid by you in the twelve months preceding the claim.
              </p>
            </div>

            <div className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Termination</h2>
              <p className="text-gray-600">
                Either party may terminate this agreement at any time. Upon termination, your right to use
                our services will immediately cease. We may suspend or terminate accounts that violate these
                terms without prior notice.
              </p>
            </div>

            <div className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">10. Governing Law</h2>
              <p className="text-gray-600">
                These terms shall be governed by the laws of the District of Columbia, United States,
                without regard to conflict of law provisions. Any disputes shall be resolved in the federal
                or state courts located in Washington, D.C.
              </p>
            </div>

            <div className="bg-blue-50 rounded-2xl p-8">
              <div className="flex items-start">
                <Mail className="w-6 h-6 text-blue-600 mr-4 mt-1" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Questions About These Terms?</h3>
                  <p className="text-gray-600 mb-4">
                    If you have any questions about these Terms of Service, please contact our Legal Team.
                  </p>
                  <a
                    href="mailto:legal@govcontractsai.com"
                    className="text-blue-600 font-medium hover:text-blue-700"
                  >
                    legal@govcontractsai.com
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

export default Terms;
