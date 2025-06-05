import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { CheckCircle, XCircle, Mail, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function VerifyPage() {
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();
  const { email, token } = router.query;

  const verifyEmail = useCallback(async () => {
    if (!email || !token) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, token }),
      });

      const data = await response.json();

      if (response.ok) {
        setVerificationStatus('success');
        setMessage(data.message || 'Email verified successfully!');
        
        // Store the token if provided
        if (data.token) {
          localStorage.setItem('auth_token', data.token);
        }

        // Redirect to main page after 2 seconds
        setTimeout(() => {
          router.push('/');
        }, 2000);
      } else {
        setVerificationStatus('error');
        setMessage(data.error || 'Verification failed');
      }
    } catch {
      setVerificationStatus('error');
      setMessage('Network error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [email, token, router]);

  useEffect(() => {
    if (email && token) {
      verifyEmail();
    }
  }, [email, token, verifyEmail]);

  const handleResendVerification = async () => {
    if (!email) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Verification email resent successfully!');
      } else {
        setMessage(data.error || 'Failed to resend verification email');
      }
    } catch {
      setMessage('Network error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md text-center">
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-center mb-4">
            {verificationStatus === 'pending' && (
              <Mail className="h-16 w-16 text-blue-500" />
            )}
            {verificationStatus === 'success' && (
              <CheckCircle className="h-16 w-16 text-green-500" />
            )}
            {verificationStatus === 'error' && (
              <XCircle className="h-16 w-16 text-red-500" />
            )}
          </div>
          
          <h1 className="text-2xl font-semibold text-white mb-2">
            {verificationStatus === 'pending' && 'Verifying Email'}
            {verificationStatus === 'success' && 'Email Verified!'}
            {verificationStatus === 'error' && 'Verification Failed'}
          </h1>
        </div>

        {/* Content */}
        <div className="mb-6">
          {verificationStatus === 'pending' && !email && !token && (
            <p className="text-gray-400">
              Please check your email for the verification link.
            </p>
          )}

          {verificationStatus === 'pending' && email && token && isLoading && (
            <p className="text-gray-400">
              Verifying your email address...
            </p>
          )}

          {message && (
            <p className={`text-sm ${
              verificationStatus === 'success' ? 'text-green-400' : 
              verificationStatus === 'error' ? 'text-red-400' : 'text-gray-400'
            }`}>
              {message}
            </p>
          )}

          {verificationStatus === 'success' && (
            <p className="text-gray-400 mt-4">
              Redirecting to dashboard...
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-4">
          {verificationStatus === 'error' && email && (
            <button
              onClick={handleResendVerification}
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg transition-colors"
            >
              {isLoading ? 'Sending...' : 'Resend Verification Email'}
            </button>
          )}

          <Link
            href="/login"
            className="inline-flex items-center justify-center w-full bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Login
          </Link>
        </div>

        {/* Email display */}
        {email && (
          <div className="mt-6 pt-4 border-t border-gray-700">
            <p className="text-xs text-gray-500">
              Verifying: {email}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
