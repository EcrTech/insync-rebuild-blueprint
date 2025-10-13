import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/Auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function SignUp() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const inviteCode = searchParams.get("invite");
  const [loading, setLoading] = useState(false);
  const [inviteData, setInviteData] = useState<any>(null);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    organizationName: "",
    organizationSlug: "",
  });

  useEffect(() => {
    if (inviteCode) {
      fetchInviteDetails();
    }
  }, [inviteCode]);

  const fetchInviteDetails = async () => {
    try {
      const { data, error } = await supabase
        .from("org_invites")
        .select("*, organizations(name, slug)")
        .eq("invite_code", inviteCode)
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (error) throw error;

      if (data) {
        setInviteData(data);
        if (data.email) {
          setFormData(prev => ({ ...prev, email: data.email }));
        }
      } else {
        toast({
          variant: "destructive",
          title: "Invalid invite",
          description: "This invite link is invalid or has expired",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load invite details",
      });
    }
  };

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
    let createdUserId: string | null = null;

    try {
      if (inviteData) {
        // Join existing organization via invite
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: {
              first_name: formData.firstName,
              last_name: formData.lastName,
              org_id: inviteData.org_id,
            },
          },
        });

        if (authError) throw authError;
        if (!authData.user) throw new Error("No user returned");

        // Mark invite as used
        await supabase
          .from("org_invites")
          .update({ 
            used_at: new Date().toISOString(),
            used_by: authData.user.id 
          })
          .eq("id", inviteData.id);

        toast({
          title: "Account created!",
          description: `Welcome to ${inviteData.organizations.name}`,
        });
      } else {
        // Create new organization (original flow with improved error handling)
        
        // Step 1: Check if slug already exists and generate unique one
        console.log("Checking slug uniqueness for:", formData.organizationSlug);
        const { data: uniqueSlug, error: slugError } = await supabase
          .rpc("generate_unique_slug", { base_slug: formData.organizationSlug });

        if (slugError) {
          console.error("Slug generation error:", slugError);
          throw new Error("Failed to generate organization URL");
        }

        if (uniqueSlug !== formData.organizationSlug) {
          console.log("Slug was taken, using unique slug:", uniqueSlug);
          toast({
            title: "Organization URL adjusted",
            description: `Using "${uniqueSlug}" as your organization URL was already taken`,
          });
        }

        // Step 2: Create auth user
        console.log("Creating auth user...");
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: {
              first_name: formData.firstName,
              last_name: formData.lastName,
            },
          },
        });

        if (authError) {
          console.error("Auth error:", authError);
          throw new Error(`Failed to create account: ${authError.message}`);
        }
        if (!authData.user) throw new Error("No user returned from signup");

        createdUserId = authData.user.id;
        console.log("Auth user created successfully:", createdUserId);

        // Step 3: Create organization
        console.log("Creating organization with slug:", uniqueSlug);
        const { data: orgData, error: orgError } = await supabase
          .from("organizations")
          .insert({
            name: formData.organizationName,
            slug: uniqueSlug,
          })
          .select()
          .single();

        if (orgError) {
          console.error("Organization creation error:", orgError);
          
          // Cleanup: Delete the auth user we just created
          console.log("Cleaning up orphaned user account...");
          await supabase.rpc("cleanup_orphaned_profile", { user_id: createdUserId });
          
          // Show user-friendly error
          if (orgError.code === "23505") { // Unique constraint violation
            throw new Error("Organization name or URL is already taken. Please try a different name.");
          }
          throw new Error(`Failed to create organization: ${orgError.message}`);
        }

        console.log("Organization created successfully:", orgData.id);

        // Step 4: Update profile with org_id
        console.log("Updating profile with org_id...");
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ org_id: orgData.id })
          .eq("id", authData.user.id);

        if (profileError) {
          console.error("Profile update error:", profileError);
          throw new Error(`Failed to link account to organization: ${profileError.message}`);
        }

        // Step 5: Assign admin role
        console.log("Assigning admin role...");
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({
            user_id: authData.user.id,
            org_id: orgData.id,
            role: "admin",
          });

        if (roleError) {
          console.error("Role assignment error:", roleError);
          throw new Error(`Failed to assign admin role: ${roleError.message}`);
        }

        // Step 6: Create default pipeline stages and dispositions
        console.log("Creating default data...");
        const [pipelineResult, dispositionsResult] = await Promise.allSettled([
          supabase.rpc("create_default_pipeline_stages", { _org_id: orgData.id }),
          supabase.rpc("create_default_call_dispositions", { _org_id: orgData.id })
        ]);

        if (pipelineResult.status === "rejected") {
          console.error("Failed to create default pipeline stages:", pipelineResult.reason);
        }
        if (dispositionsResult.status === "rejected") {
          console.error("Failed to create default dispositions:", dispositionsResult.reason);
        }

        console.log("Signup completed successfully!");
        toast({
          title: "Account created!",
          description: "Welcome to In-Sync",
        });
      }

      navigate("/dashboard");
    } catch (error: any) {
      console.error("Signup error:", error);
      
      toast({
        variant: "destructive",
        title: "Sign up failed",
        description: error.message || "An unexpected error occurred. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout 
      title={inviteData ? `Join ${inviteData.organizations.name}` : "Create your account"} 
      subtitle={inviteData ? "Complete your registration to join the team" : "Start your journey with In-Sync"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {inviteData && (
          <div className="bg-primary/10 p-3 rounded-md text-sm">
            You're joining <strong>{inviteData.organizations.name}</strong> as a{" "}
            <strong>{inviteData.role.replace("_", " ")}</strong>
          </div>
        )}

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
            disabled={inviteData?.email}
            required
          />
        </div>

        {!inviteData && (
          <>
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
          </>
        )}

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