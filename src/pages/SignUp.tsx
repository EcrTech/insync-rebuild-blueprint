import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/Auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function SignUp() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    organizationName: "",
    organizationSlug: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Auto-generate slug from organization name
    if (name === "organizationName") {
      const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      setFormData(prev => ({ ...prev, organizationSlug: slug }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast({
        variant: "destructive",
        title: "Passwords don't match",
        description: "Please make sure your passwords match",
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        variant: "destructive",
        title: "Password too short",
        description: "Password must be at least 6 characters",
      });
      return;
    }

    setLoading(true);

    try {
      // Sign up the user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("No user returned");

      // Create organization
      const { data: orgData, error: orgError } = await supabase
        .from("organizations")
        .insert({
          name: formData.organizationName,
          slug: formData.organizationSlug,
        })
        .select()
        .single();

      if (orgError) throw orgError;

      // Update profile with org_id
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ org_id: orgData.id })
        .eq("id", authData.user.id);

      if (profileError) throw profileError;

      // Assign admin role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: authData.user.id,
          org_id: orgData.id,
          role: "admin",
        });

      if (roleError) throw roleError;

      // Create default pipeline stages and dispositions
      await supabase.rpc("create_default_pipeline_stages", { _org_id: orgData.id });
      await supabase.rpc("create_default_call_dispositions", { _org_id: orgData.id });

      toast({
        title: "Account created!",
        description: "Welcome to In-Sync",
      });

      navigate("/dashboard");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Sign up failed",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Create your account" subtitle="Start your journey with In-Sync">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">First Name</Label>
            <Input
              id="firstName"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last Name</Label>
            <Input
              id="lastName"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="organizationName">Organization Name</Label>
          <Input
            id="organizationName"
            name="organizationName"
            value={formData.organizationName}
            onChange={handleChange}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="organizationSlug">Organization ID (URL)</Label>
          <Input
            id="organizationSlug"
            name="organizationSlug"
            value={formData.organizationSlug}
            onChange={handleChange}
            required
          />
          <p className="text-xs text-muted-foreground">
            Your organization URL will be: insync.app/{formData.organizationSlug}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Creating account..." : "Create Account"}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}