import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import StarField from '@/components/StarField';
import { Mail, Check, Zap, Lock, Video, Sparkles, Shield, ArrowRight } from 'lucide-react';
import { z } from 'zod';

const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/');
      }
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate password strength for signup
      if (!isLogin) {
        const validation = passwordSchema.safeParse(password);
        if (!validation.success) {
          throw new Error(validation.error.errors[0].message);
        }
      }

      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast({ title: 'Welcome back!', description: 'You have successfully signed in.' });
        navigate('/');
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        if (error) throw error;
        setEmailSent(true);
        toast({ 
          title: 'Check your email!', 
          description: 'We sent you a confirmation link. Please verify your email to continue.' 
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen sora-hero flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
      <StarField />
      
      <div className="relative z-10 w-full max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-12 lg:gap-16 items-center">
          
          {/* Left Side - Premium Marketing Content */}
          <div className="hidden lg:block space-y-10 animate-fade-in">
            {/* Premium Badge */}
            <div className="inline-flex items-center gap-2.5 bg-primary/5 backdrop-blur-sm px-5 py-2.5 rounded-full border border-primary/10">
              <Sparkles className="w-4 h-4 text-primary animate-pulse" />
              <span className="text-sm font-semibold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                100 Free Credits • No Card Required
              </span>
            </div>

            {/* Hero Headline */}
            <div className="space-y-5">
              <h1 className="text-5xl xl:text-6xl font-bold leading-[1.1] tracking-tight">
                Professional Video
                <br />
                <span className="bg-gradient-to-r from-primary via-primary to-primary/80 bg-clip-text text-transparent">
                  Watermarking
                </span>
                <br />
                Made Simple
              </h1>
              <p className="text-xl text-muted-foreground leading-relaxed max-w-lg">
                Join thousands of creators using AI-powered technology to protect and brand their content
              </p>
            </div>

            {/* Premium Feature Cards */}
            <div className="space-y-4">
              {[
                {
                  icon: Zap,
                  title: 'Lightning Fast Processing',
                  description: 'Add or remove watermarks in seconds with advanced AI',
                },
                {
                  icon: Video,
                  title: 'Professional Quality',
                  description: 'Studio-grade output with seamless integration',
                },
                {
                  icon: Shield,
                  title: '100% Secure & Private',
                  description: 'Bank-level encryption with auto-deletion after processing',
                },
              ].map((feature, index) => (
                <div
                  key={index}
                  className="group flex items-start gap-4 p-5 rounded-xl bg-background/40 backdrop-blur-sm border border-border/50 hover:border-primary/20 hover:bg-background/60 transition-all duration-300"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 transition-colors">
                    <feature.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="space-y-1 pt-0.5">
                    <h3 className="font-semibold text-foreground">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Trust Indicators */}
            <div className="flex items-center gap-6 pt-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="w-4 h-4 text-primary" />
                <span>No credit card</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="w-4 h-4 text-primary" />
                <span>100 free credits</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="w-4 h-4 text-primary" />
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>

          {/* Right Side - Premium Auth Form */}
          <div className="glass-card rounded-3xl p-8 sm:p-10 lg:p-12 space-y-8 animate-scale-in shadow-xl border-2">
            {emailSent ? (
              <div className="text-center space-y-6">
                <div className="mx-auto w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <Mail className="w-10 h-10 text-primary" />
                </div>
                <div className="space-y-3">
                  <h2 className="text-3xl font-bold tracking-tight">Check Your Email</h2>
                  <p className="text-muted-foreground text-base">
                    We've sent a verification link to
                  </p>
                  <p className="font-semibold text-foreground text-lg">{email}</p>
                  <p className="text-sm text-muted-foreground px-6">
                    Click the link in the email to verify your account and claim your 100 free credits!
                  </p>
                </div>
                <Button 
                  onClick={() => {
                    setEmailSent(false);
                    setEmail('');
                    setPassword('');
                  }}
                  variant="outline"
                  className="w-full h-12 mt-4"
                >
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Back to Sign In
                </Button>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="text-center space-y-3">
                  <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                    {isLogin ? 'Welcome Back' : (
                      <>
                        Get Started{' '}
                        <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                          Free
                        </span>
                      </>
                    )}
                  </h2>
                  <p className="text-base text-muted-foreground">
                    {isLogin ? 'Sign in to continue watermarking' : '100 free credits waiting • No credit card required'}
                  </p>
                </div>

                {/* Google Sign In Button */}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-14 text-base font-medium hover:bg-accent/50 transition-all duration-300 group"
                  onClick={handleGoogleSignIn}
                >
                  <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                  <ArrowRight className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </Button>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border/50" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase tracking-wider">
                    <span className="bg-card px-4 text-muted-foreground font-medium">Or continue with email</span>
                  </div>
                </div>

                {/* Email Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2.5">
                    <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-12 bg-background/50 border-border/50 focus:border-primary transition-colors"
                    />
                  </div>
                  <div className="space-y-2.5">
                    <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      className="h-12 bg-background/50 border-border/50 focus:border-primary transition-colors"
                    />
                    {!isLogin && password.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Password must be 8+ characters with uppercase, lowercase, and numbers
                      </p>
                    )}
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full btn-hero h-14 text-base font-semibold shadow-lg hover:shadow-xl transition-all" 
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Processing...
                      </span>
                    ) : isLogin ? (
                      <span className="flex items-center gap-2">
                        Sign In
                        <ArrowRight className="w-4 h-4" />
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        Create Free Account
                      </span>
                    )}
                  </Button>
                </form>

                {/* Mobile Benefits */}
                {!isLogin && (
                  <div className="lg:hidden space-y-3 pt-2 border-t border-border/50">
                    {[
                      '100 free credits instantly',
                      'No credit card required',
                      'Secure & encrypted processing'
                    ].map((benefit, index) => (
                      <div key={index} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                        <Check className="w-4 h-4 text-primary flex-shrink-0" />
                        <span>{benefit}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Toggle Auth Mode */}
                <div className="text-center pt-2">
                  <p className="text-sm text-muted-foreground">
                    {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setIsLogin(!isLogin);
                        setEmailSent(false);
                      }}
                      className="text-primary hover:underline font-semibold transition-colors"
                    >
                      {isLogin ? 'Sign up for free' : 'Sign in'}
                    </button>
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
