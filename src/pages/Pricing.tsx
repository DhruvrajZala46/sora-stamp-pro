import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const pricingPlans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for trying out SoraStamp",
    features: [
      "5 videos per month",
      "All features included",
      "100MB max file size",
    ],
    videoLimit: 5,
    highlighted: false,
    checkoutLink: null,
  },
  {
    name: "Starter",
    price: "$5",
    period: "month",
    description: "Great for regular users",
    features: [
      "25 videos per month",
      "All features included",
      "100MB max file size",
    ],
    videoLimit: 25,
    highlighted: false,
    productId: "95d38e1c-8f47-4048-b3e3-f06edc38b8d9",
  },
  {
    name: "Pro",
    price: "$9",
    period: "month",
    description: "For content creators",
    features: [
      "100 videos per month",
      "All features included",
      "300MB max file size",
    ],
    videoLimit: 100,
    highlighted: false,
    productId: "0dfb8146-7505-4dc9-b7ce-a669919533b2",
  },
  {
    name: "Unlimited",
    price: "$29",
    period: "month",
    description: "For power users",
    features: [
      "Unlimited videos (500/month)",
      "Everything in Pro",
      "500MB max file size",
      "Ultra-fast processing",
      "Priority support",
    ],
    videoLimit: 500,
    highlighted: true,
    productId: "240aaa37-f58b-4f9c-93ae-e0df52f0644c",
  },
];

export default function Pricing() {
  const navigate = useNavigate();
  const [currentPlan, setCurrentPlan] = useState<string>("free");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkAuth();

    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    const checkoutId = params.get('checkout_id');

    if (status === 'success' && checkoutId) {
      toast.success("Payment successful! Activating your subscription...");
      supabase.functions.invoke('sync-subscription').finally(() => {
        checkAuth();
      });
    } else if (status === 'cancelled') {
      toast.info("Checkout canceled.");
    }

    if (status) {
      const url = new URL(window.location.href);
      url.searchParams.delete('status');
      url.searchParams.delete('checkout_id');
      url.searchParams.delete('customer_session_token');
      window.history.replaceState({}, '', url.pathname);
    }
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {

        const { data: subscription } = await supabase
          .from('user_subscriptions')
          .select('plan')
          .eq('user_id', user.id)
          .maybeSingle();

        if (subscription) {
          setCurrentPlan(subscription.plan);
        }
      }
    } catch (error) {
      console.error('Error checking auth:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (plan: any) => {
    if (!user) {
      toast.error("🔐 Sign In Required - Please sign in to your account to upgrade your plan.");
      navigate('/auth');
      return;
    }

    if (!('productId' in plan) || !plan.productId) {
      toast.info("ℹ️ You're Already on the Free Plan - Select a paid plan above to unlock more features!");
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('create-polar-checkout', {
        body: { productId: plan.productId, redirectOrigin: window.location.origin },
      });
      if (error || !data?.url) throw error || new Error('No checkout URL');
      window.location.href = data.url;
    } catch (err: any) {
      console.error('Checkout error:', err);
      toast.error("❌ Checkout Failed - Unable to start the checkout process. Please try again or contact support.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} plan={currentPlan} />
      
      <div className="container mx-auto px-4 py-20">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4 gradient-text">
            Choose Your Plan
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Start with our free plan and upgrade as you grow
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
          {pricingPlans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative p-8 ${
                plan.highlighted
                  ? 'border-primary shadow-lg shadow-primary/20 scale-105'
                  : 'border-border'
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                  Most Popular
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {plan.description}
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">/{plan.period}</span>
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => handleUpgrade(plan)}
                disabled={loading || currentPlan === plan.name.toLowerCase()}
                className={`w-full ${
                  plan.highlighted
                    ? 'bg-primary hover:bg-primary/90'
                    : 'bg-secondary hover:bg-secondary/90'
                }`}
              >
                {currentPlan === plan.name.toLowerCase()
                  ? 'Current Plan'
                  : 'Upgrade Now'}
              </Button>
            </Card>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="mt-20 max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">Can I change my plan later?</h3>
              <p className="text-muted-foreground">
                Yes! You can upgrade or downgrade your plan at any time. Changes will be reflected immediately.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">What happens if I exceed my video limit?</h3>
              <p className="text-muted-foreground">
                You'll be prompted to upgrade your plan. Your existing videos will remain safe.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Do you offer refunds?</h3>
              <p className="text-muted-foreground">
                Yes, we offer a 14-day money-back guarantee on all paid plans.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
