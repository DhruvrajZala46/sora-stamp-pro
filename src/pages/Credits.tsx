import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Coins, Loader2, Check, Sparkles } from 'lucide-react';
import StarField from '@/components/StarField';

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price_usd: number;
  polar_product_id: string | null;
}

const Credits = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [credits, setCredits] = useState(0);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasingPackageId, setPurchasingPackageId] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
    fetchPackages();
  }, []);

  // Handle return from checkout: verify via webhook and refresh credits
  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const status = params.get('status');
      const checkoutId = params.get('checkout_id');

      if (!user || status !== 'success') return;

      toast({
        title: "Processing payment...",
        description: "Verifying your payment. This may take a few seconds.",
      });

      const old = credits;
      let attempts = 0;
      const maxAttempts = 10;

      while (attempts < maxAttempts) {
        try {
          const { data } = await supabase
            .from('user_subscriptions')
            .select('credits')
            .eq('user_id', user.id)
            .single();
          const current = data?.credits || 0;

          if (current > old) {
            setCredits(current);
            toast({
              title: "Payment successful!",
              description: "Credits have been added to your account.",
            });
            navigate('/credits', { replace: true });
            return;
          }
        } catch (e) {
          console.warn('Polling credits failed:', e);
        }
        await new Promise((r) => setTimeout(r, 1200));
        attempts++;
      }

      toast({
        title: "Payment verified but credits not added.",
        description: "Please refresh or contact support.",
        variant: "destructive",
      });
      navigate('/credits', { replace: true });
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/auth');
      return;
    }
    setUser(user);
    fetchCredits(user.id);
  };

  const fetchCredits = async (userId: string) => {
    const { data } = await supabase
      .from('user_subscriptions')
      .select('credits')
      .eq('user_id', userId)
      .single();

    if (data) {
      setCredits(data.credits || 0);
    }
  };

  const fetchPackages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('credit_packages')
      .select('*')
      .eq('is_active', true)
      .order('credits', { ascending: true });

    if (error) {
      console.error('Error fetching packages:', error);
    } else {
      setPackages(data || []);
    }
    setLoading(false);
  };

  const handlePurchase = async (pkg: CreditPackage) => {
    if (!pkg.polar_product_id) {
      toast({
        title: "Coming Soon",
        description: "This package will be available soon!",
        variant: "default"
      });
      return;
    }

    setPurchasingPackageId(pkg.id);

    try {
      const { data, error } = await supabase.functions.invoke('purchase-credits', {
        body: { packageId: pkg.id }
      });

      if (error) throw error;

      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast({
        title: "Error",
        description: "Failed to create checkout. Please try again.",
        variant: "destructive"
      });
      setPurchasingPackageId(null);
    }
  };

  const getBonusPercentage = (credits: number) => {
    if (credits >= 1000) return 20;
    if (credits >= 350) return 15;
    if (credits >= 150) return 10;
    return 0;
  };

  return (
    <div className="min-h-screen sora-hero">
      <StarField />
      <Navbar user={user} />
      
      <div className="relative z-10 pt-24 pb-16 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-4 mb-12">
            <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full">
              <Coins className="w-5 h-5 text-primary" />
              <span className="text-lg font-semibold">You have {credits} credits</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold">Purchase Credits</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Buy credits to use our services • No subscriptions, pay as you go!
            </p>
            <div className="mt-6 p-4 bg-primary/10 rounded-lg inline-block">
              <p className="text-sm text-muted-foreground mb-2">Current Pricing:</p>
              <p className="text-lg"><strong>Remove Watermark:</strong> 100 credits per video</p>
              <p className="text-lg"><strong>Add Watermark:</strong> 200 credits per video</p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {packages.map((pkg, index) => {
                const bonus = getBonusPercentage(pkg.credits);
                const isPopular = index === 1;
                
                return (
                  <Card 
                    key={pkg.id} 
                    className={`relative overflow-hidden ${isPopular ? 'border-primary border-2 scale-105' : ''}`}
                  >
                    {isPopular && (
                      <div className="absolute top-0 left-0 right-0 bg-primary text-primary-foreground text-center py-2 text-sm font-semibold">
                        MOST POPULAR
                      </div>
                    )}
                    {bonus > 0 && (
                      <Badge className="absolute top-4 right-4 bg-accent">
                        +{bonus}% Bonus
                      </Badge>
                    )}
                    <div className={`p-6 ${isPopular ? 'pt-14' : ''}`}>
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-2xl font-bold mb-2">{pkg.name}</h3>
                          <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-bold">${pkg.price_usd}</span>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Coins className="w-5 h-5 text-primary" />
                            <span className="text-lg font-semibold">{pkg.credits} credits</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Check className="w-5 h-5 text-green-500" />
                            <span className="text-sm">{Math.floor(pkg.credits / 100)} watermark removals</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Check className="w-5 h-5 text-green-500" />
                            <span className="text-sm">{Math.floor(pkg.credits / 200)} watermark additions</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Check className="w-5 h-5 text-green-500" />
                            <span className="text-sm">Credits never expire</span>
                          </div>
                        </div>

                        <Button
                          onClick={() => handlePurchase(pkg)}
                          disabled={purchasingPackageId === pkg.id || !pkg.polar_product_id}
                          className="w-full"
                          variant={isPopular ? "default" : "outline"}
                        >
                          {purchasingPackageId === pkg.id ? (
                            <>
                              <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <Sparkles className="mr-2 w-4 h-4" />
                              {pkg.polar_product_id ? 'Buy Now' : 'Coming Soon'}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          <div className="mt-12 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              💳 Secure payment powered by Polar • 🔒 Your credits never expire
            </p>
            <p className="text-xs text-muted-foreground">
              All prices in USD. Credits are non-refundable.
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Credits;