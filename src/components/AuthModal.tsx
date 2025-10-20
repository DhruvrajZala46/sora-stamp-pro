import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// Client-side password hardening (mitigation when backend leaked-password check is off)
const COMMON_PASSWORDS = new Set([
  'password','123456','123456789','qwerty','12345678','111111','123123','abc123','password1','iloveyou',
  'admin','letmein','welcome','monkey','dragon','football','baseball','sunshine','trustno1','qwerty123'
]);

const validatePassword = (email: string, password: string) => {
  const schema = z
    .string()
    .min(12, 'Use at least 12 characters')
    .max(72, 'Use at most 72 characters')
    .regex(/[A-Z]/, 'Add an uppercase letter')
    .regex(/[a-z]/, 'Add a lowercase letter')
    .regex(/[0-9]/, 'Add a number')
    .regex(/[^A-Za-z0-9]/, 'Add a symbol')
    .refine((p) => !COMMON_PASSWORDS.has(p.toLowerCase()), 'Password is too common')
    .refine((p) => {
      const local = (email.split('@')[0] || '').toLowerCase();
      return local ? !p.toLowerCase().includes(local) : true;
    }, 'Avoid using your email in the password');

  return schema.safeParse(password);
};

const AuthModal = ({ open, onOpenChange, onSuccess }: AuthModalProps) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast({ title: 'Welcome back!', description: 'You have successfully signed in.' });
      } else {
        // Client-side validation before signup
        const emailCheck = z.string().email('Enter a valid email').max(255, 'Email too long').safeParse(email);
        if (!emailCheck.success) {
          throw new Error(emailCheck.error.issues[0]?.message || 'Invalid email');
        }

        const pwdCheck = validatePassword(email, password);
        if (!pwdCheck.success) {
          throw new Error(pwdCheck.error.issues[0]?.message || 'Weak password');
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        if (error) throw error;
        toast({ title: 'Account created!', description: 'Welcome to SoraStamp.' });
      }
      onSuccess();
      onOpenChange(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border">
        <DialogHeader>
          <DialogTitle className="text-2xl">{isLogin ? 'Welcome Back' : 'Create Account'}</DialogTitle>
          <DialogDescription>
            {isLogin ? 'Sign in to start watermarking your videos' : 'Get started with 3 free videos'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-background/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={12}
              className="bg-background/50"
            />
          </div>
          <Button type="submit" className="w-full btn-hero" disabled={loading}>
            {loading ? 'Loading...' : isLogin ? 'Sign In' : 'Sign Up'}
          </Button>
        </form>
        <div className="text-center text-sm text-muted-foreground mt-4">
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-primary hover:underline font-medium"
          >
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AuthModal;
