import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import Navbar from "@/components/Navbar";
import { Loader2, Shield } from "lucide-react";

const userLoginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits").max(15, "Phone number is too long"),
});

type UserLoginFormData = z.infer<typeof userLoginSchema>;

const UserLogin = () => {
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const form = useForm<UserLoginFormData>({
    resolver: zodResolver(userLoginSchema),
    defaultValues: {
      email: "",
      phone: "",
    },
    mode: "onChange",
  });

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        if (session) {
          // Check role and redirect appropriately
          setTimeout(async () => {
            const { data: roleData } = await supabase
              .from("user_roles")
              .select("role")
              .eq("user_id", session.user.id)
              .eq("role", "admin")
              .maybeSingle();

            if (roleData) {
              navigate("/admin/dashboard", { replace: true });
            } else {
              navigate("/user/booking", { replace: true });
            }
          }, 0);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        // Check role and redirect
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .eq("role", "admin")
          .maybeSingle()
          .then(({ data: roleData }) => {
            if (roleData) {
              navigate("/admin/dashboard", { replace: true });
            } else {
              navigate("/user/booking", { replace: true });
            }
          });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogin = async (data: UserLoginFormData) => {
    setLoading(true);
    try {
      const { data: response, error } = await supabase.functions.invoke('user-login', {
        body: { email: data.email, phone: data.phone }
      });

      // Handle edge function errors (including 400 responses)
      if (error) {
        // Try to parse error context for better message
        const errorMessage = error.message || "Something went wrong. Please try again.";
        toast({
          title: "Login Failed",
          description: errorMessage,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Handle error in response body
      if (response?.error) {
        toast({
          title: "Login Failed",
          description: response.error,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (response?.success && response?.session) {
        // Set the session using the tokens from the edge function
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: response.session.access_token,
          refresh_token: response.session.refresh_token,
        });

        if (sessionError) throw sessionError;

        toast({
          title: response.isNewUser ? "Welcome!" : "Welcome back!",
          description: response.isNewUser 
            ? "Your account has been created. You can now book slots."
            : "You have successfully logged in.",
        });

        navigate("/user/booking", { replace: true });
      } else {
        toast({
          title: "Login Failed",
          description: "Unable to process login. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Login error:", error);
      toast({
        title: "Error",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-20">
        <div className="max-w-md mx-auto">
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="text-3xl text-center">User Login</CardTitle>
              <CardDescription className="text-center">
                Enter your email and phone to book cricket grounds
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleLogin)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="john@example.com"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mobile Number</FormLabel>
                        <FormControl>
                          <Input
                            type="tel"
                            placeholder="+91 98765 43210"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full" size="lg" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Logging in...
                      </>
                    ) : (
                      "Login / Register"
                    )}
                  </Button>
                </form>
              </Form>

              <div className="mt-6 pt-6 border-t border-border">
                <Link to="/admin/login">
                  <Button variant="outline" className="w-full" size="lg">
                    <Shield className="mr-2 h-4 w-4" />
                    Admin Login
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <footer className="bg-card border-t border-border py-8 mt-20">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2024 Box Cricket. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default UserLogin;
