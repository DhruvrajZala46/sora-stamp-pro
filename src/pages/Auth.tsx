import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import StarField from '@/components/StarField';
import { Mail, Sparkles, Shield, Zap, ArrowRight } from 'lucide-react';

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
    <div className="min-h-screen sora-hero flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12 relative overflow-hidden">
      <StarField />
      
      {/* Ambient glow effects */}
      <div className="absolute top-20 left-10 w-96 h-96 bg-primary/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-20 right-10 w-80 h-80 bg-primary/15 rounded-full blur-[100px] animate-pulse delay-1000" />
      
      <div className="relative z-10 w-full max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          
          {/* Left Side - Premium Marketing */}
          <div className="hidden lg:flex flex-col justify-center space-y-8 animate-fade-in">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-sm">
                <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                <span className="text-sm font-medium bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
                  Limited Offer: 100 Free Credits
                </span>
              </div>
              
              <h1 className="text-5xl xl:text-6xl font-bold leading-tight">
                Professional Video
                <br />
                <span className="bg-gradient-to-r from-primary via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Watermarking
                </span>
              </h1>
              
              <p className="text-lg text-muted-foreground leading-relaxed">
                Add or remove watermarks in seconds using AI-powered technology.
                Join thousands of creators protecting their content.
              </p>
            </div>

            <div className="space-y-4">
              {[
                { icon: Zap, title: 'Instant Processing', desc: 'AI-powered watermark removal and addition in seconds' },
                { icon: Shield, title: 'Enterprise Security', desc: 'Bank-level encryption with auto-deletion after processing' },
                { icon: Sparkles, title: 'Studio Quality', desc: 'Professional results with seamless integration' }
              ].map((feature, i) => (
                <div key={i} className="group flex items-start gap-4 p-4 rounded-xl bg-card/50 border border-border/50 backdrop-blur-sm hover:border-primary/30 transition-all duration-300">
                  <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <feature.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>

          {/* Right Side - Premium Auth Form */}
          <div className="premium-card rounded-3xl p-8 sm:p-10 space-y-8 animate-scale-in border-2 backdrop-blur-xl">
            {emailSent ? (
              <div className="text-center space-y-6">
                <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center">
                  <Mail className="w-10 h-10 text-primary" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold">Check Your Inbox</h2>
                  <p className="text-muted-foreground">
                    We sent a verification link to
                  </p>
                  <p className="font-semibold text-foreground">{email}</p>
                </div>
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <p className="text-sm text-muted-foreground">
                    Click the link to verify your account and unlock <span className="font-semibold text-primary">100 free credits</span> instantly
                  </p>
                </div>
                <Button 
                  onClick={() => {
                    setEmailSent(false);
                    setEmail('');
                    setPassword('');
                  }}
                  variant="outline"
                  className="w-full h-12"
                >
                  Back to Sign In
                </Button>
              </div>
            ) : (
              <>
                <div className="text-center space-y-3">
                  <h2 className="text-3xl sm:text-4xl font-bold">
                    {isLogin ? 'Welcome Back' : (
                      <>
                        Get <span className="bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">100 Credits</span> Free
                      </>
                    )}
                  </h2>
                  <p className="text-base text-muted-foreground">
                    {isLogin ? 'Continue your creative journey' : 'Start watermarking instantly — no payment required'}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="group w-full h-13 text-base font-medium bg-card/50 hover:bg-card border-border/50 hover:border-primary/30 transition-all duration-300"
                  onClick={handleGoogleSignIn}
                >
                  <div className="flex items-center justify-center gap-3 w-full">
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
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
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border/50" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-3 text-muted-foreground font-medium">Or continue with</span>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-12 bg-background/50 border-border/50 focus:border-primary/50 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Minimum 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="h-12 bg-background/50 border-border/50 focus:border-primary/50 transition-colors"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full btn-hero h-13 text-base font-semibold shadow-lg" 
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
                        Claim 100 Free Credits
                        <ArrowRight className="w-4 h-4" />
                      </span>
                    )}
                  </Button>
                </form>

                {!isLogin && (
                  <div className="lg:hidden p-5 rounded-xl bg-primary/5 border border-primary/10">
                    <p className="text-sm font-medium text-center mb-3">What's included:</p>
                    <div className="space-y-2">
                      {['100 credits instantly', 'No payment required', 'Enterprise-grade security'].map((item, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-border/50">
                  <p className="text-center text-sm text-muted-foreground">
                    {isLogin ? "Don't have an account? " : 'Already have an account? '}
                    <button
                      type="button"
                      onClick={() => {
                        setIsLogin(!isLogin);
                        setEmailSent(false);
                      }}
                      className="text-primary hover:text-primary/80 font-semibold transition-colors"
                    >
                      {isLogin ? 'Create free account' : 'Sign in'}
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
