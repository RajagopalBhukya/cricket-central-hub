import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { Loader2, Eye, EyeOff } from "lucide-react";

// Admin credentials (hidden trigger)
const ADMIN_NAME = "Admin Gamehub";
const ADMIN_EMAIL = "rajagopalbhukya614@gmail.com";
const ADMIN_PHONE = "9381115918";
const ADMIN_PASSWORD = "Gamehub123$";

const userLoginSchema = z.object({
  username: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits").max(15, "Phone number is too long"),
  password: z.string().optional(),
});

type UserLoginFormData = z.infer<typeof userLoginSchema>;

const UserLogin = () => {
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const form = useForm<UserLoginFormData>({
    resolver: zodResolver(userLoginSchema),
    defaultValues: {
      username: "",
      email: "",
      phone: "",
      password: "",
    },
    mode: "onChange",
  });

  const watchedValues = form.watch(["username", "email", "phone"]);

  // Check if admin credentials are entered
  useEffect(() => {
    const [username, email, phone] = watchedValues;
    const isAdminCredentials = 
      username?.includes(ADMIN_NAME) && 
      email === ADMIN_EMAIL && 
      phone === ADMIN_PHONE;
    
    setShowPasswordField(isAdminCredentials);
  }, [watchedValues]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        if (session) {
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

  const handleAdminLogin = async (data: UserLoginFormData) => {
    if (data.password !== ADMIN_PASSWORD) {
      toast({
        title: "Access Denied",
        description: "Invalid admin password",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Try to sign in as admin first
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      });

      if (signInError) {
        // Admin doesn't exist, create using edge function (bypasses normal user flow)
        const { data: createResponse, error: createError } = await supabase.functions.invoke('set-admin-role', {
          body: { 
            email: ADMIN_EMAIL, 
            password: ADMIN_PASSWORD,
            fullName: ADMIN_NAME,
            phoneNumber: ADMIN_PHONE,
            createUser: true
          }
        });

        if (createError || createResponse?.error) {
          toast({
            title: "Error",
            description: createResponse?.error || createError?.message || "Failed to setup admin account",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        // Now sign in after creation
        const { error: retryError } = await supabase.auth.signInWithPassword({
          email: ADMIN_EMAIL,
          password: ADMIN_PASSWORD,
        });

        if (retryError) {
          toast({
            title: "Error",
            description: "Admin account created but login failed. Please try again.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      }

      toast({
        title: "Welcome Admin!",
        description: "Redirecting to dashboard...",
      });
      navigate("/admin/dashboard", { replace: true });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (data: UserLoginFormData) => {
    // Check if this is admin login
    if (showPasswordField) {
      await handleAdminLogin(data);
      return;
    }

    setLoading(true);
    try {
      const { data: response, error } = await supabase.functions.invoke('user-login', {
        body: { email: data.email, phone: data.phone, username: data.username }
      });

      if (error) {
        const errorMessage = error.message || "Something went wrong. Please try again.";
        toast({
          title: "Login Failed",
          description: errorMessage,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

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
              <CardTitle className="text-2xl text-center">Please fill this form to book a slot</CardTitle>
              <CardDescription className="text-center">
                Enter your details to continue
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleLogin)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>User Name</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            placeholder="Enter your name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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
                            placeholder="9876543210"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {showPasswordField && (
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Admin Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showPassword ? "text" : "password"}
                                placeholder="Enter admin password"
                                {...field}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() => setShowPassword(!showPassword)}
                              >
                                {showPassword ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <Button type="submit" className="w-full" size="lg" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : showPasswordField ? (
                      "Login as Admin"
                    ) : (
                      "Continue to Booking"
                    )}
                  </Button>
                </form>
              </Form>
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
